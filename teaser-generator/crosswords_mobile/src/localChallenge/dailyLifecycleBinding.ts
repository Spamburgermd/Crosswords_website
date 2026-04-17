/**
 * src/localChallenge/dailyLifecycleBinding.ts
 * -----------------------------------------------------------
 * Small app-state binding so RealAppRoot can trigger daily reconciliation on
 * startup and when the app returns to the foreground.
 */

import type { NativeEventSubscription } from 'react-native';
import { AppState } from 'react-native';

import { reconcileDailySessions } from './dailyLifecycle';

type AppStateLike = {
  addEventListener: (
    type: 'change',
    listener: (state: string) => void,
  ) => Pick<NativeEventSubscription, 'remove'> | { remove: () => void };
};

export function installDailyLifecycleReconciler(appState: AppStateLike = AppState): () => void {
  void reconcileDailySessions().catch(() => undefined);

  const subscription = appState.addEventListener('change', (nextState: string) => {
    if (nextState === 'active') {
      void reconcileDailySessions().catch(() => undefined);
    }
  });

  return () => subscription.remove();
}
