/**
 * src/navigation/AppNavigator.tsx
 * ---------------------------------------------
 * Central place to configure React Navigation.
 * Title ? Lobby ? PreGame ? Board ? Friends ? Settings.
 */

import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import { Linking } from 'react-native';

import BoardScreen from '@screens/BoardScreen';
import FriendsScreen from '@screens/FriendsScreen';
import LobbyScreen from '@screens/LobbyScreen';
import PreGameScreen from '@screens/PreGameScreen';
import ChallengeScreen from '@screens/ChallengeScreen';
import LocalChallengePlayScreen from '@screens/LocalChallengePlayScreen';
import ResultScreen from '@screens/ResultScreen';
import JottsScreen from '@screens/JottsScreen';
import ChallengeHistoryScreen from '@screens/ChallengeHistoryScreen';
import BotSetupScreen from '@screens/BotSetupScreen';
import FriendWizardScreen from '@screens/FriendWizardScreen';
import TutorialScreen from '@screens/tutorial/TutorialScreen';
import GameModesScreen from '@screens/GameModesScreen';
import StatsScreen from '@screens/StatsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TitleScreen from '@screens/TitleScreen';
// NOTE: Using relative path because alias @linking is not configured in tsconfig paths yet.
import { parseDeepLink } from '../linking/deepLinking';
import { isServerFunctionsEnabled } from '@src/flags';

export type RootStackParamList = {
  Title: undefined;
  Lobby: undefined;
  PreGame: undefined;
  Board: undefined | { mode?: 'pvp' | 'solo' | 'bot'; sessionId?: string };
  Friends: undefined;
  Settings: undefined;
  Challenge:
    | undefined
    | {
        prefillCode?: string;
        autoImport?: boolean;
        showOnly?: 'create' | 'enter' | 'blind';
        targetTab?: 'offer' | 'return' | 'start' | 'legacy';
      };
  LocalChallengePlay: { sessionId: string };
  ResultImport: { prefillCode?: string };
  Jotts: { returnTo?: 'Challenge' } | undefined;
  ChallengeHistory: undefined;
  Stats: undefined;
  BotSetup: undefined;
  FriendWizard: undefined;
  Tutorial: { firstLaunch?: boolean } | undefined;
  GameModes: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator(): React.JSX.Element {
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const serverEnabled = isServerFunctionsEnabled();

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      const parsed = parseDeepLink(url);
      if (!parsed.kind || !parsed.code) return;
      if (!navRef.current) return;
      if (parsed.kind === 'challenge') {
        navRef.current.navigate('Challenge', {
          prefillCode: parsed.code,
          autoImport: true,
        } as never);
      } else if (parsed.kind === 'result') {
        navRef.current.navigate('ResultImport', { prefillCode: parsed.code } as never);
      } else if (parsed.kind === 'offer' || parsed.kind === 'return') {
        navRef.current.navigate('Challenge', {
          prefillCode: parsed.code,
        } as never);
      }
    };

    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator
        initialRouteName={serverEnabled ? 'Title' : 'Lobby'}
        screenOptions={{
          headerShown: false,
        }}
      >
        {serverEnabled ? <Stack.Screen name="Title" component={TitleScreen} /> : null}
        <Stack.Screen name="Lobby" component={LobbyScreen} />
        {serverEnabled ? <Stack.Screen name="PreGame" component={PreGameScreen} /> : null}
        <Stack.Screen name="Board" component={BoardScreen} />
        {serverEnabled ? <Stack.Screen name="Friends" component={FriendsScreen} /> : null}
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Challenge" component={ChallengeScreen} />
        <Stack.Screen name="LocalChallengePlay" component={LocalChallengePlayScreen} />
        <Stack.Screen name="ResultImport" component={ResultScreen} />
        <Stack.Screen name="Jotts" component={JottsScreen} />
        <Stack.Screen name="ChallengeHistory" component={ChallengeHistoryScreen} />
        <Stack.Screen name="Stats" component={StatsScreen} />
        <Stack.Screen name="BotSetup" component={BotSetupScreen} />
        <Stack.Screen name="FriendWizard" component={FriendWizardScreen} />
        <Stack.Screen name="Tutorial" component={TutorialScreen} />
        <Stack.Screen name="GameModes" component={GameModesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

