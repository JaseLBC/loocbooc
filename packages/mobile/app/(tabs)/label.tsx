import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { LabelScanner } from '../../components/camera/LabelScanner';
import { Header } from '../../components/ui/Header';
import type { LabelScanResult } from '../../lib/api';

export default function LabelScreen() {
  const handleResult = (result: LabelScanResult) => {
    // Result is shown inline by LabelScanner
    console.log('Label scan result:', result.composition);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerArea}>
        <Header title="Scan Label" subtitle="Care label → fabric physics" showBack />
      </SafeAreaView>
      <LabelScanner onResult={handleResult} />
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
