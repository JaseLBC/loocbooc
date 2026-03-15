import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Gyroscope } from 'expo-sensors';
import { ScanGuide } from './ScanGuide';
import { QualityIndicator, QualityState } from './QualityIndicator';
import { ScanProgress } from '../garment/ScanProgress';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';

const SCAN_DURATION_SECONDS = 60;
const FRAME_CAPTURE_INTERVAL_MS = 500; // 2fps

type ScanPhase = 'idle' | 'countdown' | 'scanning' | 'uploading' | 'processing' | 'complete' | 'error';

interface GarmentScannerProps {
  onComplete?: (ugi: string) => void;
}

export function GarmentScanner({ onComplete }: GarmentScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [timeRemaining, setTimeRemaining] = useState(SCAN_DURATION_SECONDS);
  const [frames, setFrames] = useState<string[]>([]);
  const [imuData, setImuData] = useState<object[]>([]);
  const [quality, setQuality] = useState<QualityState>({
    lighting: 'unknown',
    motion: 'unknown',
    coverage: 'unknown',
  });
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStage, setScanStage] = useState('');
  const [currentUGI, setCurrentUGI] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const frameInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const gyroSubscription = useRef<ReturnType<typeof Gyroscope.addListener> | null>(null);
  const currentGyro = useRef({ x: 0, y: 0, z: 0 });
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const addGarment = useAppStore((s) => s.addGarment);
  const updateGarment = useAppStore((s) => s.updateGarment);

  // Pulse animation for the record button
  useEffect(() => {
    if (phase === 'scanning') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [phase]);

  const cleanup = useCallback(() => {
    if (frameInterval.current) clearInterval(frameInterval.current);
    if (timerInterval.current) clearInterval(timerInterval.current);
    if (pollInterval.current) clearInterval(pollInterval.current);
    if (gyroSubscription.current) gyroSubscription.current.remove();
    frameInterval.current = null;
    timerInterval.current = null;
    pollInterval.current = null;
    gyroSubscription.current = null;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startGyroscope = useCallback(() => {
    Gyroscope.setUpdateInterval(100);
    gyroSubscription.current = Gyroscope.addListener((data) => {
      currentGyro.current = data;
    });
  }, []);

  const captureFrame = useCallback(async () => {
    if (!cameraRef.current) return null;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        base64: true,
        skipProcessing: true,
      });
      return photo?.base64 || null;
    } catch {
      return null;
    }
  }, []);

  const startCountdown = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera Permission', 'Loocbooc needs camera access to scan garments.');
        return;
      }
    }
    setPhase('countdown');
    setCountdown(3);

    let count = 3;
    const countdownTimer = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countdownTimer);
        startScan();
      }
    }, 1000);
  }, [permission]);

  const startScan = useCallback(async () => {
    // Create garment record
    const garment = await api.createGarment('Scanned Garment', 'unknown');
    setCurrentUGI(garment.ugi);
    addGarment(garment);

    setPhase('scanning');
    setTimeRemaining(SCAN_DURATION_SECONDS);
    setFrames([]);
    setImuData([]);

    // Start quality monitoring
    setQuality({ lighting: 'good', motion: 'good', coverage: 'good' });

    startGyroscope();

    // Capture frames at 2fps
    const capturedFrames: string[] = [];
    const capturedImu: object[] = [];

    frameInterval.current = setInterval(async () => {
      const frame = await captureFrame();
      if (frame) {
        capturedFrames.push(frame);
        capturedImu.push({
          timestamp: Date.now(),
          gyro: { ...currentGyro.current },
        });

        // Simple quality checks
        const gyroMag = Math.sqrt(
          currentGyro.current.x ** 2 +
          currentGyro.current.y ** 2 +
          currentGyro.current.z ** 2
        );
        setQuality({
          lighting: 'good', // Would need real luminance analysis
          motion: gyroMag > 2.5 ? 'fast' : 'good',
          coverage: 'good',
        });
      }
    }, FRAME_CAPTURE_INTERVAL_MS);

    // Countdown timer
    let remaining = SCAN_DURATION_SECONDS;
    timerInterval.current = setInterval(() => {
      remaining--;
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        cleanup();
        setFrames(capturedFrames);
        setImuData(capturedImu);
        uploadAndProcess(garment.ugi, capturedFrames, capturedImu);
      }
    }, 1000);
  }, [captureFrame, startGyroscope, addGarment, cleanup]);

  const stopScanEarly = useCallback(() => {
    if (phase !== 'scanning') return;
    cleanup();
    Alert.alert(
      'Stop scan?',
      'You\'ve captured some frames. Upload what we have?',
      [
        { text: 'Keep scanning', style: 'cancel', onPress: () => startScan() },
        {
          text: 'Upload',
          onPress: () => {
            if (currentUGI) {
              uploadAndProcess(currentUGI, frames, imuData);
            }
          },
        },
      ]
    );
  }, [phase, cleanup, currentUGI, frames, imuData]);

  const uploadAndProcess = useCallback(
    async (ugi: string, capturedFrames: string[], capturedImu: object[]) => {
      setPhase('uploading');
      setScanProgress(0);
      setScanStage('Uploading frames...');

      try {
        await api.uploadFrames(ugi, capturedFrames, capturedImu);
      } catch {
        // Continue even if upload fails — mock mode handles this
      }

      setPhase('processing');
      updateGarment(ugi, { status: 'processing' });

      // Poll for status
      pollInterval.current = setInterval(async () => {
        const status = await api.getScanStatus(ugi);
        setScanProgress(status.progress);
        setScanStage(status.stage || '');

        if (status.status === 'complete') {
          if (pollInterval.current) clearInterval(pollInterval.current);
          updateGarment(ugi, { status: 'complete', model_url: status.model_url });
          setPhase('complete');
          setTimeout(() => {
            onComplete?.(ugi);
          }, 1500);
        } else if (status.status === 'failed') {
          if (pollInterval.current) clearInterval(pollInterval.current);
          setPhase('error');
          updateGarment(ugi, { status: 'failed' });
        }
      }, 3000);
    },
    [updateGarment, onComplete]
  );

  const reset = useCallback(() => {
    cleanup();
    setPhase('idle');
    setFrames([]);
    setImuData([]);
    setScanProgress(0);
    setCurrentUGI(null);
    setQuality({ lighting: 'unknown', motion: 'unknown', coverage: 'unknown' });
  }, [cleanup]);

  // ─── Render phases ─────────────────────────────────────────────────────────

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          Loocbooc needs your camera to scan garments for 3D reconstruction.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'uploading' || phase === 'processing') {
    return (
      <View style={styles.processingContainer}>
        <ScanProgress
          progress={phase === 'uploading' ? 5 : scanProgress}
          stage={scanStage}
          size={160}
        />
        <Text style={styles.processingTitle}>
          {phase === 'uploading' ? 'Uploading scan...' : 'Building 3D model...'}
        </Text>
        <Text style={styles.processingSubtitle}>
          {phase === 'uploading'
            ? `${frames.length} frames captured`
            : 'This takes about 30 seconds'}
        </Text>
        {currentUGI ? (
          <Text style={styles.ugiText}>{currentUGI}</Text>
        ) : null}
      </View>
    );
  }

  if (phase === 'complete') {
    return (
      <View style={styles.processingContainer}>
        <Text style={styles.completeEmoji}>✅</Text>
        <Text style={styles.processingTitle}>Scan complete</Text>
        <Text style={styles.processingSubtitle}>Opening 3D model...</Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.processingContainer}>
        <Text style={styles.errorEmoji}>❌</Text>
        <Text style={styles.processingTitle}>Scan failed</Text>
        <TouchableOpacity style={styles.retryButton} onPress={reset}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
      />

      {/* Scan overlay */}
      <ScanGuide
        type="garment"
        isScanning={phase === 'scanning'}
        timeRemaining={phase === 'scanning' ? timeRemaining : undefined}
      />

      {/* Quality indicators — only show while scanning */}
      {phase === 'scanning' && (
        <View style={styles.qualityContainer}>
          <QualityIndicator quality={quality} />
        </View>
      )}

      {/* Countdown overlay */}
      {phase === 'countdown' && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownNumber}>{countdown}</Text>
          <Text style={styles.countdownText}>Get ready...</Text>
        </View>
      )}

      {/* Bottom controls */}
      <View style={styles.controls}>
        {phase === 'idle' && (
          <>
            <Text style={styles.hint}>Position garment, then tap to start 60-second scan</Text>
            <TouchableOpacity style={styles.recordButton} onPress={startCountdown}>
              <View style={styles.recordInner} />
            </TouchableOpacity>
          </>
        )}

        {phase === 'scanning' && (
          <>
            <Text style={styles.hint}>Walk slowly around the garment</Text>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity style={styles.stopButton} onPress={stopScanEarly}>
                <View style={styles.stopInner} />
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.frameCount}>{frames.length > 0 ? `${frames.length} frames` : ''}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionText: {
    color: '#9CA3AF',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  qualityContainer: {
    position: 'absolute',
    top: 20,
    right: 16,
    zIndex: 10,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  countdownNumber: {
    color: '#FFFFFF',
    fontSize: 120,
    fontWeight: '800',
    letterSpacing: -5,
  },
  countdownText: {
    color: '#9CA3AF',
    fontSize: 18,
    marginTop: -20,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    paddingTop: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    gap: 12,
  },
  hint: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  recordInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239,68,68,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#EF4444',
  },
  stopInner: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  frameCount: {
    color: '#4B5563',
    fontSize: 12,
  },
  processingContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  processingTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  processingSubtitle: {
    color: '#9CA3AF',
    fontSize: 15,
    textAlign: 'center',
  },
  ugiText: {
    color: '#4B5563',
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 8,
  },
  completeEmoji: {
    fontSize: 64,
  },
  errorEmoji: {
    fontSize: 64,
  },
  retryButton: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
