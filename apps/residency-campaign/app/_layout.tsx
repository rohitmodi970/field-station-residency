import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Slot } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortalProvider } from '@gorhom/portal';
import { StatusBar } from 'expo-status-bar';
import { useResidencyStore } from '../src/stores/residencyStore';
import './global.css';

export default function RootLayout() {
  const initialize = useResidencyStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <PortalProvider>
          <StatusBar style="dark" backgroundColor="#FAF9F6" />
          <Slot />
        </PortalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
});
