import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { WebView } from 'react-native-webview';
import { Header } from '../../components/ui/Header';
import { PhysicsDisplay } from '../../components/garment/PhysicsDisplay';
import { ScanProgress } from '../../components/garment/ScanProgress';
import { api, Garment } from '../../lib/api';
import { useAppStore } from '../../lib/store';

const VIEWER_HTML = (modelUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #111; overflow: hidden; }
    canvas { width: 100vw; height: 100vh; display: block; }
    #loading { 
      position: fixed; top: 50%; left: 50%; 
      transform: translate(-50%, -50%);
      color: #fff; font-family: system-ui; font-size: 14px;
      text-align: center;
    }
    #placeholder {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #4B5563;
      font-family: system-ui;
    }
    .big { font-size: 64px; display: block; margin-bottom: 12px; }
    .small { font-size: 13px; }
  </style>
</head>
<body>
  <div id="placeholder">
    <span class="big">👗</span>
    <span class="small">3D model viewer<br/>Full viewer requires custom build</span>
  </div>
</body>
</html>
`;

export default function GarmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [garment, setGarment] = useState<Garment | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollProgress, setPollProgress] = useState(0);
  const [pollStage, setPollStage] = useState('');
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const storedGarments = useAppStore((s) => s.garments);
  const updateGarment = useAppStore((s) => s.updateGarment);

  useEffect(() => {
    if (!id) return;

    // Try to find in store first for instant render
    const stored = storedGarments.find((g) => g.ugi === id);
    if (stored) {
      setGarment(stored);
      setLoading(false);
      animateIn();
    }

    // Fetch fresh data
    api.getGarment(id).then((data) => {
      setGarment(data);
      setLoading(false);
      animateIn();

      // If still processing, poll for updates
      if (data.status === 'processing' || data.status === 'pending') {
        startPolling(id);
      }
    });

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [id]);

  const animateIn = () => {
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  const startPolling = (ugi: string) => {
    pollInterval.current = setInterval(async () => {
      const status = await api.getScanStatus(ugi);
      setPollProgress(status.progress);
      setPollStage(status.stage || '');

      if (status.status === 'complete') {
        if (pollInterval.current) clearInterval(pollInterval.current);
        const updated = await api.getGarment(ugi);
        setGarment(updated);
        updateGarment(ugi, updated);
      }
    }, 3000);
  };

  const copyUGI = async () => {
    if (!id) return;
    await Clipboard.setStringAsync(id);
    Alert.alert('Copied', `UGI ${id} copied to clipboard`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title="Garment" showBack />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!garment) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title="Garment" showBack />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Garment not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isProcessing = garment.status === 'processing' || garment.status === 'pending';

  return (
    <SafeAreaView style={styles.safe}>
      <Header
        title={garment.name}
        showBack
        rightAction={{ label: 'Share', onPress: copyUGI }}
      />

      <Animated.ScrollView
        style={[styles.scroll, { opacity: contentOpacity }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 3D Model viewer or processing state */}
        <View style={styles.modelSection}>
          {isProcessing ? (
            <View style={styles.processingBox}>
              <ScanProgress progress={pollProgress} stage={pollStage} size={120} />
              <Text style={styles.processingTitle}>Building 3D model...</Text>
              <Text style={styles.processingSubtitle}>
                {pollStage || 'Processing your scan'}
              </Text>
            </View>
          ) : garment.model_url ? (
            <View style={styles.webviewContainer}>
              <WebView
                source={{ html: VIEWER_HTML(garment.model_url) }}
                style={styles.webview}
                scrollEnabled={false}
              />
            </View>
          ) : (
            <View style={styles.modelPlaceholder}>
              <Text style={styles.modelEmoji}>👗</Text>
              <Text style={styles.modelPlaceholderText}>3D model ready</Text>
              <Text style={styles.modelPlaceholderSub}>
                Full viewer available in production build
              </Text>
            </View>
          )}
        </View>

        {/* UGI */}
        <TouchableOpacity style={styles.ugiCard} onPress={copyUGI}>
          <Text style={styles.ugiLabel}>UNIVERSAL GARMENT IDENTIFIER</Text>
          <Text style={styles.ugiValue}>{garment.ugi}</Text>
          <Text style={styles.ugiHint}>Tap to copy</Text>
        </TouchableOpacity>

        {/* Fabric composition */}
        {garment.composition && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>FABRIC COMPOSITION</Text>
            <Text style={styles.compositionValue}>{garment.composition}</Text>
          </View>
        )}

        {/* Physics parameters */}
        {garment.physics && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>FABRIC PHYSICS</Text>
            <Text style={styles.cardSubtitle}>
              Physics simulation parameters derived from composition
            </Text>
            <View style={{ marginTop: 16 }}>
              <PhysicsDisplay physics={garment.physics} animate />
            </View>
          </View>
        )}

        {/* Status */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Status</Text>
            <Text
              style={[
                styles.metaValue,
                garment.status === 'complete' && { color: '#22C55E' },
                garment.status === 'failed' && { color: '#EF4444' },
                isProcessing && { color: '#F59E0B' },
              ]}
            >
              {garment.status.charAt(0).toUpperCase() + garment.status.slice(1)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Category</Text>
            <Text style={styles.metaValue}>{garment.category}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Created</Text>
            <Text style={styles.metaValue}>
              {new Date(garment.created_at).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>

        {/* Try on placeholder */}
        <View style={styles.tryOnCard}>
          <Text style={styles.tryOnEmoji}>🪄</Text>
          <View>
            <Text style={styles.tryOnTitle}>Virtual Try-On</Text>
            <Text style={styles.tryOnSub}>Coming soon — build a Loocbooc avatar to try this on</Text>
          </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 60,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
  },
  modelSection: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111111',
    height: 280,
  },
  processingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  processingTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  processingSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#111111',
  },
  modelPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modelEmoji: {
    fontSize: 64,
  },
  modelPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modelPlaceholderSub: {
    color: '#4B5563',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  ugiCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  ugiLabel: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  ugiValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  ugiHint: {
    color: '#4B5563',
    fontSize: 11,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  cardLabel: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  cardSubtitle: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  compositionValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  metaCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaKey: {
    color: '#6B7280',
    fontSize: 13,
  },
  metaValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  tryOnCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderStyle: 'dashed',
  },
  tryOnEmoji: {
    fontSize: 28,
  },
  tryOnTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  tryOnSub: {
    color: '#4B5563',
    fontSize: 12,
    marginTop: 2,
  },
});
