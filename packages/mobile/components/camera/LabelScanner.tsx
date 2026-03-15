import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScanGuide } from './ScanGuide';
import { PhysicsDisplay } from '../garment/PhysicsDisplay';
import { api, LabelScanResult } from '../../lib/api';
import { useAppStore } from '../../lib/store';

type LabelPhase = 'idle' | 'scanning' | 'processing' | 'result' | 'error';

interface LabelScannerProps {
  onResult?: (result: LabelScanResult) => void;
}

export function LabelScanner({ onResult }: LabelScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<LabelPhase>('idle');
  const [result, setResult] = useState<LabelScanResult | null>(null);
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const setLastLabelScan = useAppStore((s) => s.setLastLabelScan);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (phase === 'result') {
      Animated.timing(resultOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [phase]);

  const captureLabel = async () => {
    if (!cameraRef.current) return;
    setPhase('scanning');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (!photo?.base64) throw new Error('No image captured');

      setPhase('processing');

      const scanResult = await api.scanLabel(photo.base64);
      setResult(scanResult);
      setLastLabelScan(scanResult);
      setPhase('result');
      onResult?.(scanResult);
    } catch (err) {
      console.error('Label scan error:', err);
      setPhase('error');
    }
  };

  const reset = () => {
    setPhase('idle');
    setResult(null);
    resultOpacity.setValue(0);
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          Point your camera at a care label to extract fabric composition.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'processing') {
    return (
      <View style={styles.processingContainer}>
        <Text style={styles.processingEmoji}>🔍</Text>
        <Text style={styles.processingTitle}>Reading label...</Text>
        <Text style={styles.processingSubtitle}>Extracting fabric composition</Text>
      </View>
    );
  }

  if (phase === 'result' && result) {
    return (
      <Animated.ScrollView
        style={[styles.resultContainer, { opacity: resultOpacity }]}
        contentContainerStyle={styles.resultContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Composition */}
        <View style={styles.compositionCard}>
          <Text style={styles.compositionLabel}>FABRIC COMPOSITION</Text>
          <Text style={styles.compositionValue}>{result.composition}</Text>
          <Text style={styles.confidence}>
            {Math.round(result.confidence * 100)}% confidence
          </Text>
          {result.raw_text ? (
            <View style={styles.rawTextContainer}>
              <Text style={styles.rawTextLabel}>Label text</Text>
              <Text style={styles.rawText}>{result.raw_text}</Text>
            </View>
          ) : null}
        </View>

        {/* Physics */}
        <View style={styles.physicsCard}>
          <Text style={styles.physicsTitle}>FABRIC PHYSICS</Text>
          <Text style={styles.physicsSubtitle}>
            Simulation parameters derived from composition
          </Text>
          <View style={{ marginTop: 20 }}>
            <PhysicsDisplay physics={result.physics} animate />
          </View>
        </View>

        {/* Fibres breakdown */}
        {Object.keys(result.fibres).length > 0 && (
          <View style={styles.fibresCard}>
            <Text style={styles.fibresTitle}>FIBRE BREAKDOWN</Text>
            <View style={styles.fibresGrid}>
              {Object.entries(result.fibres).map(([fibre, pct]) => (
                <View key={fibre} style={styles.fibreItem}>
                  <Text style={styles.fibrePct}>{pct}%</Text>
                  <Text style={styles.fibreName}>{capitalize(fibre)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.scanAgainButton} onPress={reset}>
            <Text style={styles.scanAgainText}>Scan Another Label</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.processingContainer}>
        <Text style={styles.processingEmoji}>❌</Text>
        <Text style={styles.processingTitle}>Couldn't read label</Text>
        <Text style={styles.processingSubtitle}>
          Make sure the care label is clearly visible and well-lit
        </Text>
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

      <ScanGuide type="label" isScanning={phase === 'scanning'} />

      {/* Bottom controls */}
      <View style={styles.controls}>
        <Text style={styles.hint}>
          {phase === 'scanning'
            ? 'Capturing...'
            : 'Position the care label in the frame, then tap to scan'}
        </Text>
        {phase === 'idle' && (
          <TouchableOpacity style={styles.captureButton} onPress={captureLabel}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    paddingTop: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    gap: 16,
  },
  hint: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  captureInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
  },
  processingContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  processingEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  processingTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  processingSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 16,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  resultContent: {
    padding: 20,
    paddingBottom: 60,
    gap: 16,
  },
  compositionCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 20,
    gap: 6,
  },
  compositionLabel: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  compositionValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  confidence: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '500',
  },
  rawTextContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
  },
  rawTextLabel: {
    color: '#4B5563',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rawText: {
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  physicsCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 20,
  },
  physicsTitle: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  physicsSubtitle: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },
  fibresCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  fibresTitle: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  fibresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fibreItem: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  fibrePct: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  fibreName: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    gap: 12,
  },
  scanAgainButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  scanAgainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
