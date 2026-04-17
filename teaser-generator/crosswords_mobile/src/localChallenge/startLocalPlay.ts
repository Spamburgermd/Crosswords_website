/**
 * src/localChallenge/startLocalPlay.ts
 * -----------------------------------------------------------
 * Helper to start a seed-based local game in one tap.
 * Keeps the seed hidden unless the user later chooses to share it.
 */
import type { NavigationProp } from '@react-navigation/native';
import { Alert } from 'react-native';

import { canonicalizeDictionaryId, supportsCurrentTargetPattern } from '@src/dictionary/dictionaryAdapter';
import { createSeedSession } from './localChallengeStore';
import { createRandomSeed } from './seedInput';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Params = {
  navigation: NavigationProp<RootStackParamList>;
  dictionaryId?: string;
  difficulty?: string;
  timerLimitSeconds?: number;
};

export function startLocalPlay({
  navigation,
  dictionaryId = 'standard',
  difficulty,
  timerLimitSeconds,
}: Params): void {
  try {
    const canonical = canonicalizeDictionaryId(dictionaryId);
    if (!supportsCurrentTargetPattern(canonical)) {
      Alert.alert('Unsupported dictionary', 'This dictionary needs a different game mode pattern.');
      return;
    }
    const seed = createRandomSeed();
    const sessionId = createSeedSession({
      seed,
      dictionaryId: canonical,
      difficulty,
      timerLimitSeconds,
    });
    navigation.navigate('LocalChallengePlay', { sessionId });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not start local play. Please try again.';
    Alert.alert('Could not start game', message);
  }
}
