import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { GarmentScanner } from '../../components/camera/GarmentScanner';
import { Header } from '../../components/ui/Header';

export default function ScanScreen() {
  const router = useRouter();

  const handleScanComplete = (ugi: string) => {
    router.push(`/garment/${ugi}`);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerArea}>
        <Header title="Scan Garment" showBack />
      </SafeAreaView>
      <GarmentScanner onComplete={handleScanComplete} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerArea: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
});
