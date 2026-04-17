/**
 * src/RealAppRoot.tsx
 * -----------------------------------------------------------
 * Root wrapper for the real (non-preview) app flow. Provides the same
 * providers/wrappers that PreviewApp used, but routes to AppNavigator
 * (real screens) instead of PreviewNavigator.
 *
 * Providers:
 * - QueryClientProvider: required by LobbyScreen, BoardScreen, FriendsScreen, useGameState
 * - useFonts: same font loading as PreviewApp before rendering content
 */
import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';

import AppNavigator from './navigation/AppNavigator';
import SplashScreen from './screens/SplashScreen';
import useSessionStore from './stores/sessionStore';
import { isServerFunctionsEnabled } from './flags';
import { logOfflineApiCallSummary } from './lib/api';
import { installDailyLifecycleReconciler } from './localChallenge/dailyLifecycleBinding';

const queryClient = new QueryClient();

export default function RealAppRoot(): React.JSX.Element {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (isServerFunctionsEnabled()) {
      useSessionStore.getState().ensureApiKey();
    }
    if (!isServerFunctionsEnabled() && __DEV__) {
      console.log('Server functions disabled: running local-only flow');
      logOfflineApiCallSummary();
    }
  }, []);

  useEffect(() => installDailyLifecycleReconciler(), []);

  const [fontsLoaded] = useFonts({
    NotoSerif_400Regular: require('../assets/fonts/NotoSerif_400Regular.ttf'),
    LibreBaskerville_400Regular: require('../assets/fonts/LibreBaskerville-Regular.ttf'),
    LibreBaskerville_700Bold: require('../assets/fonts/LibreBaskerville-Bold.ttf'),
    'Cinzel-Regular': require('../assets/fonts/Cinzel-Regular.ttf'),
    CinzelDecorative_700Bold: require('../assets/fonts/CinzelDecorative-Bold.ttf'),
  });

  // Keep splash visible for minimum duration after fonts load
  useEffect(() => {
    if (fontsLoaded) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 4000); // 4 second delay after fonts load
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

  // Show splash screen while fonts loading or during minimum display time
  if (!fontsLoaded || showSplash) {
    return <SplashScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppNavigator />
    </QueryClientProvider>
  );
}
