/**
 * src/stores/gameStore.ts
 * ---------------------------------------------
 * Zustand store that keeps track of the mocked game lifecycle for Step 1.
 * Later steps will replace this with data from the FastAPI backend, but for now
 * we simply hold the current status and an optional countdown timer value that
 * the Lobby screen can manipulate.
 */
import { create } from 'zustand';

/**
 * Possible game states for the mock flow. We intentionally start at waiting
 * so the Lobby can show a "Ready to create or join" message.
 */
export type GameStatus = 'waiting' | 'countdown' | 'active';

export type GameState = {
  status: GameStatus;
  countdownSeconds: number | null;
  setStatus: (nextStatus: GameStatus) => void;
  setCountdownSeconds: (value: number | null) => void;
  startMockGame: (durationSeconds: number) => void;
  tickCountdown: () => void;
  resetGame: () => void;
};

const useGameStore = create<GameState>((set) => ({
  status: 'waiting',
  countdownSeconds: null,
  setStatus: (nextStatus) => set({ status: nextStatus }),
  setCountdownSeconds: (value) => set({ countdownSeconds: value }),
  startMockGame: (durationSeconds) =>
    set({
      status: 'countdown',
      countdownSeconds: durationSeconds,
    }),
  tickCountdown: () =>
    set((current) => {
      if (current.countdownSeconds === null) {
        return current;
      }

      const nextValue = Math.max(current.countdownSeconds - 1, 0);
      return {
        countdownSeconds: nextValue,
      };
    }),
  resetGame: () => set({ status: 'waiting', countdownSeconds: null }),
}));

export default useGameStore;


