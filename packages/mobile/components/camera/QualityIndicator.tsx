import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface QualityState {
  lighting: 'good' | 'poor' | 'unknown';
  motion: 'good' | 'fast' | 'unknown';
  coverage: 'good' | 'poor' | 'unknown';
}

interface QualityIndicatorProps {
  quality: QualityState;
}

interface Indicator {
  label: string;
  state: 'good' | 'warn' | 'unknown';
  message: string;
}

export function QualityIndicator({ quality }: QualityIndicatorProps) {
  const indicators: Indicator[] = [
    {
      label: 'Light',
      state: quality.lighting === 'good' ? 'good' : quality.lighting === 'poor' ? 'warn' : 'unknown',
      message:
        quality.lighting === 'good'
          ? 'Good lighting'
          : quality.lighting === 'poor'
          ? 'Too dark'
          : '...',
    },
    {
      label: 'Motion',
      state: quality.motion === 'good' ? 'good' : quality.motion === 'fast' ? 'warn' : 'unknown',
      message:
        quality.motion === 'good'
          ? 'Good speed'
          : quality.motion === 'fast'
          ? 'Move slower'
          : '...',
    },
    {
      label: 'Frame',
      state:
        quality.coverage === 'good' ? 'good' : quality.coverage === 'poor' ? 'warn' : 'unknown',
      message:
        quality.coverage === 'good'
          ? 'In frame'
          : quality.coverage === 'poor'
          ? 'Point at garment'
          : '...',
    },
  ];

  return (
    <View style={styles.container}>
      {indicators.map((ind) => (
        <View key={ind.label} style={styles.item}>
          <Text style={styles.icon}>
            {ind.state === 'good' ? '✅' : ind.state === 'warn' ? '⚠️' : '○'}
          </Text>
          <Text
            style={[
              styles.message,
              ind.state === 'warn' && styles.warnText,
              ind.state === 'unknown' && styles.unknownText,
            ]}
          >
            {ind.message}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 14,
    width: 20,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  warnText: {
    color: '#F59E0B',
  },
  unknownText: {
    color: '#6B7280',
  },
});
