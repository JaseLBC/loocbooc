import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ScanGuideProps {
  type: 'garment' | 'label';
  isScanning: boolean;
  timeRemaining?: number;
}

export function ScanGuide({ type, isScanning, timeRemaining }: ScanGuideProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (isScanning) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      const opacity = Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      opacity.start();
      return () => {
        pulse.stop();
        opacity.stop();
      };
    }
  }, [isScanning]);

  if (type === 'label') {
    return (
      <View style={styles.labelOverlay}>
        <Animated.View
          style={[
            styles.labelGuide,
            {
              opacity: opacityAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          {/* Corner brackets */}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </Animated.View>
        <Text style={styles.guideText}>
          {isScanning ? 'Scanning label...' : 'Position care label in frame'}
        </Text>
      </View>
    );
  }

  // Garment guide
  return (
    <View style={styles.garmentOverlay}>
      <Animated.View
        style={[
          styles.garmentGuide,
          {
            opacity: isScanning ? opacityAnim : 0.4,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {/* Garment silhouette outline */}
        <Text style={styles.silhouette}>👗</Text>
      </Animated.View>

      {isScanning && timeRemaining !== undefined ? (
        <View style={styles.timerContainer}>
          <Text style={styles.timerNumber}>{timeRemaining}</Text>
          <Text style={styles.timerLabel}>seconds remaining</Text>
        </View>
      ) : (
        <Text style={styles.guideText}>
          {isScanning ? 'Walk slowly around the garment' : 'Position garment in frame'}
        </Text>
      )}

      {/* Corner guides */}
      <View style={[styles.garmentCorner, styles.garmentTopLeft]} />
      <View style={[styles.garmentCorner, styles.garmentTopRight]} />
      <View style={[styles.garmentCorner, styles.garmentBottomLeft]} />
      <View style={[styles.garmentCorner, styles.garmentBottomRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Label guide
  labelOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelGuide: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.4,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },

  // Garment guide
  garmentOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentGuide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouette: {
    fontSize: 120,
    opacity: 0.15,
  },
  timerContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  timerNumber: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -2,
  },
  timerLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  guideText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },

  garmentCorner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  garmentTopLeft: {
    top: 60,
    left: 30,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  garmentTopRight: {
    top: 60,
    right: 30,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  garmentBottomLeft: {
    bottom: 180,
    left: 30,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  garmentBottomRight: {
    bottom: 180,
    right: 30,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
});
