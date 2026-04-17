/**
 * PreviewNavigator.tsx
 * Stack navigator for Atlantic preview screens only. No legacy routes.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AtlanticWelcomePreview from '../screens/preview/AtlanticWelcomePreview';
import AtlanticLobbyPreview from '../screens/preview/AtlanticLobbyPreview';
import AtlanticBoardPreview from '../screens/preview/AtlanticBoardPreview';
import AtlanticFriendsPreview from '../screens/preview/AtlanticFriendsPreview';
import AtlanticSettingsPreview from '../screens/preview/AtlanticSettingsPreview';
import AtlanticOutcomePreview from '../screens/preview/AtlanticOutcomePreview';
import PreviewMenuScreen from '../screens/preview/PreviewMenuScreen';

export type PreviewStackParamList = {
  Welcome: undefined;
  Lobby: undefined;
  Board: undefined;
  Friends: undefined;
  Settings: undefined;
  Outcome: undefined;
  PreviewMenu: undefined;
};

const Stack = createNativeStackNavigator<PreviewStackParamList>();

export default function PreviewNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Welcome" component={AtlanticWelcomePreview} />
      <Stack.Screen name="Lobby" component={AtlanticLobbyPreview} />
      <Stack.Screen name="Board" component={AtlanticBoardPreview} />
      <Stack.Screen name="Friends" component={AtlanticFriendsPreview} />
      <Stack.Screen name="Settings" component={AtlanticSettingsPreview} />
      <Stack.Screen name="Outcome" component={AtlanticOutcomePreview} />
      <Stack.Screen name="PreviewMenu" component={PreviewMenuScreen} />
    </Stack.Navigator>
  );
}
