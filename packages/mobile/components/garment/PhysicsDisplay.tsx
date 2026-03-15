import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { physicsToDisplay } from '../../lib/physicsDisplay';
import type { PhysicsParams } from '../../lib/api';

interface PhysicsDisplayProps {
  physics: PhysicsParams;
  animate?: boolean;
}

export function PhysicsDisplay({ physics, animate = true }: PhysicsDisplayProps) {
  const items = physicsToDisplay(physics);

  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <PhysicsBar
          key={item.label}
          item={item}
          animate={animate}
          delay={index * 120}
        />
      ))}
    </View>
  );
}

interface PhysicsBarProps {
  item: ReturnType<typeof physicsToDisplay>[0];
  animate: boolean;
  delay: number;
}

function PhysicsBar({ item, animate, delay }: PhysicsBarProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animate) {
      Animated.timing(widthAnim, {
        toValue: item.value,
        duration: 800,
        delay,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(item.value);
    }
  }, [item.value, animate, delay]);

  const levelColor = {
    Low: '#9CA3AF',
    Medium: '#F59E0B',
    High: '#22C55E',
  }[item.level];

  return (
    <View style={styles.barContainer}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{item.label}</Text>
        <Text style={[styles.level, { color: levelColor }]}>{item.level}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: levelColor,
            },
          ]}
        />
      </View>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  barContainer: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  level: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  track: {
    height: 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  description: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 16,
  },
});
