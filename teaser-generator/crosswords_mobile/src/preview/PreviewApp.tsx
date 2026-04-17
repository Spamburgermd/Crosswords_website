/**
 * PreviewApp.tsx
 * Root for preview-only app. Loads Atlantic fonts, then renders stack navigator.
 */
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';

import PreviewNavigator from './PreviewNavigator';

export default function PreviewApp(): React.JSX.Element {
  const [fontsLoaded] = useFonts({
    NotoSerif_400Regular: require('../../assets/fonts/NotoSerif_400Regular.ttf'),
    LibreBaskerville_400Regular: require('../../assets/fonts/LibreBaskerville-Regular.ttf'),
    LibreBaskerville_700Bold: require('../../assets/fonts/LibreBaskerville-Bold.ttf'),
    'Cinzel-Regular': require('../../assets/fonts/Cinzel-Regular.ttf'),
    CinzelDecorative_700Bold: require('../../assets/fonts/CinzelDecorative-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fdfdfd' }}>
        <ActivityIndicator size="large" color="#1e1e1e" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <PreviewNavigator />
    </NavigationContainer>
  );
}
