import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface ScanProgressProps {
  progress: number;   // 0-100
  stage?: string;
  size?: number;
}

export function ScanProgress({ progress, stage, size = 120 }: ScanProgressProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    if (progress < 100) {
      loop.start();
    } else {
      loop.stop();
    }
    return () => loop.stop();
  }, [progress]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress / 100);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Background circle */}
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 3,
            borderColor: '#1A1A1A',
          },
        ]}
      />

      {/* Progress indicator - using a simple arc approximation */}
      <View style={[styles.progressOverlay, { width: size, height: size }]}>
        {progress < 100 && (
          <Animated.View
            style={[
              styles.spinner,
              {
                width: size - 6,
                height: size - 6,
                borderRadius: (size - 6) / 2,
                borderWidth: 3,
                borderTopColor: '#FFFFFF',
                borderRightColor: 'transparent',
                borderBottomColor: 'transparent',
                borderLeftColor: 'transparent',
                transform: [{ rotate: spin }],
              },
            ]}
          />
        )}
        {progress >= 100 && (
          <View style={styles.completeCheck}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
        )}
      </View>

      {/* Center content */}
      <View style={styles.centerContent}>
        <Text style={styles.percentage}>{Math.round(progress)}%</Text>
      </View>

      {stage ? (
        <Text style={[styles.stage, { marginTop: size / 2 + 16 }]}>{stage}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
  },
  progressOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    position: 'absolute',
  },
  completeCheck: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentage: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  stage: {
    position: 'absolute',
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    width: 200,
  },
});
