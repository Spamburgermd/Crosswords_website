/**
 * src/stores/userStore.ts
 * ---------------------------------------------
 * Lightweight Zustand store to remember the player\'s display name across screens.
 * Later steps will expand this with IDs from the backend or Supabase auth.
 */
import { create } from 'zustand';

export type UserState = {
  username: string;
  setUsername: (value: string) => void;
};

const useUserStore = create<UserState>((set) => ({
  username: '',
  setUsername: (value: string) => set({ username: value }),
}));

export default useUserStore;
