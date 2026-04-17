/**
 * App.tsx
 * Entry point. Wraps real app root with gesture and safe-area providers.
 */
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';

import RealAppRoot from './src/RealAppRoot';

export default function App(): React.JSX.Element {
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RealAppRoot />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
