import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../lib/store';
import { GarmentCard } from '../../components/garment/GarmentCard';
import { api } from '../../lib/api';

export default function HomeScreen() {
  const router = useRouter();
  const apiConnected = useAppStore((s) => s.apiConnected);
  const garments = useAppStore((s) => s.garments);
  const setApiConnected = useAppStore((s) => s.setApiConnected);
  const addGarment = useAppStore((s) => s.addGarment);

  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate in
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 100 }),
      ]),
      Animated.timing(ctaOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Load garments
    api.listGarments().then((items) => {
      items.forEach(addGarment);
    });

    // Check API
    api.healthCheck().then(setApiConnected);
  }, []);

  const recentGarments = garments.slice(0, 5);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Animated.View
            style={{
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            }}
          >
            <Text style={styles.logo}>LOOCBOOC</Text>
            <Text style={styles.logoSub}>Scanner</Text>
          </Animated.View>

          {/* API status */}
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: apiConnected ? '#22C55E' : '#F59E0B' },
              ]}
            />
            <Text style={styles.statusText}>
              {apiConnected ? 'Connected' : 'Demo mode'}
            </Text>
          </View>
        </View>

        {/* Main CTAs */}
        <Animated.View style={[styles.ctaSection, { opacity: ctaOpacity }]}>
          <TouchableOpacity
            style={styles.primaryCTA}
            onPress={() => router.push('/(tabs)/scan')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaEmoji}>📸</Text>
            <View style={styles.ctaText}>
              <Text style={styles.ctaTitle}>Scan a Garment</Text>
              <Text style={styles.ctaDescription}>
                60-second full 3D capture
              </Text>
            </View>
            <Text style={styles.ctaArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryCTA}
            onPress={() => router.push('/(tabs)/label')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaEmoji}>🏷️</Text>
            <View style={styles.ctaText}>
              <Text style={styles.ctaTitle}>Scan a Care Label</Text>
              <Text style={styles.ctaDescription}>
                Extract fabric composition + physics
              </Text>
            </View>
            <Text style={styles.ctaArrow}>→</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Recent scans */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Scans</Text>

          {recentGarments.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👗</Text>
              <Text style={styles.emptyTitle}>No scans yet</Text>
              <Text style={styles.emptyText}>
                Scan your first garment to see it here
              </Text>
            </View>
          ) : (
            recentGarments.map((garment) => (
              <GarmentCard key={garment.ugi} garment={garment} />
            ))
          )}
        </View>

        {/* About */}
        <View style={styles.about}>
          <Text style={styles.aboutText}>
            Loocbooc creates physics-accurate 3D garment files from camera scans.
            Every garment gets a Universal Garment Identifier (UGI).
          </Text>
        </View>
      </ScrollView>
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
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  logoSub: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: -2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111111',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
  ctaSection: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  primaryCTA: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  secondaryCTA: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  ctaEmoji: {
    fontSize: 28,
  },
  ctaText: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  ctaDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  ctaArrow: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  recentSection: {
    paddingHorizontal: 20,
    gap: 4,
  },
  sectionTitle: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    color: '#4B5563',
    fontSize: 13,
    textAlign: 'center',
  },
  about: {
    margin: 20,
    padding: 16,
    backgroundColor: '#111111',
    borderRadius: 12,
    marginTop: 8,
  },
  aboutText: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
