import { installDailyLifecycleReconciler } from './localChallenge/dailyLifecycleBinding';
import { reconcileDailySessions } from './localChallenge/dailyLifecycle';

jest.mock('./localChallenge/dailyLifecycle', () => ({
  reconcileDailySessions: jest.fn(async () => ({
    todayDate: '2026-04-10',
    status: 'play',
    guessesUsed: 0,
    guessLimit: 25,
  })),
}));
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
  },
}));

describe('RealAppRoot daily lifecycle binding', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reconciles daily sessions on app start and foreground', () => {
    const listenerRef: { current: ((state: string) => void) | null } = { current: null };
    const remove = jest.fn();
    const appState = {
      addEventListener: jest.fn((_type: 'change', cb: (state: string) => void) => {
        listenerRef.current = cb;
        return { remove };
      }),
    };

    const cleanup = installDailyLifecycleReconciler(appState as never);

    expect(reconcileDailySessions).toHaveBeenCalledTimes(1);
    if (listenerRef.current) {
      listenerRef.current('background');
    }
    expect(reconcileDailySessions).toHaveBeenCalledTimes(1);
    if (listenerRef.current) {
      listenerRef.current('active');
    }
    expect(reconcileDailySessions).toHaveBeenCalledTimes(2);

    cleanup();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
