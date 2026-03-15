import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { Garment } from '../../lib/api';

interface GarmentCardProps {
  garment: Garment;
}

export function GarmentCard({ garment }: GarmentCardProps) {
  const router = useRouter();

  const statusColor = {
    pending: '#9CA3AF',
    processing: '#F59E0B',
    complete: '#22C55E',
    failed: '#EF4444',
  }[garment.status];

  const statusLabel = {
    pending: 'Queued',
    processing: 'Processing',
    complete: 'Complete',
    failed: 'Failed',
  }[garment.status];

  const timeAgo = formatTimeAgo(garment.created_at);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push(`/garment/${garment.ugi}`)}
      activeOpacity={0.7}
    >
      {/* Thumbnail placeholder */}
      <View style={styles.thumbnail}>
        <Text style={styles.thumbnailIcon}>👗</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{garment.name}</Text>
        <Text style={styles.ugi} numberOfLines={1}>{garment.ugi}</Text>
        {garment.composition ? (
          <Text style={styles.composition} numberOfLines={1}>{garment.composition}</Text>
        ) : null}
        <Text style={styles.time}>{timeAgo}</Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 1000 / 60);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  thumbnail: {
    width: 52,
    height: 52,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailIcon: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  ugi: {
    color: '#4B5563',
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  composition: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  time: {
    color: '#4B5563',
    fontSize: 11,
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
