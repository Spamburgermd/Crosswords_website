/**
 * src/hooks/useGameState.ts
 * ---------------------------------------------
 * React Query hook that polls the server for game state. The polling interval adapts
 * based on the current status so we poll more aggressively during active play.
 * Query is enabled only when apiKey and gameId (>0) are present; errors are surfaced
 * (retry disabled so screens can show the real error).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchGameState } from '@lib/api';
import { isServerFunctionsEnabled } from '@src/flags';
import type { GameState } from '@schemas/api';

const GAME_STATE_QUERY_KEY = 'game-state';

export function useGameState(apiKey: string | null, gameId: number | null) {
  const queryClient = useQueryClient();
  const enabled = Boolean(apiKey && gameId != null && gameId > 0);
  const serverDisabled = !isServerFunctionsEnabled();

  const query = useQuery<GameState, Error>({
    queryKey: [GAME_STATE_QUERY_KEY, apiKey, gameId],
    queryFn: () => fetchGameState(apiKey as string, gameId as number),
    enabled: enabled && !serverDisabled,
    // No try/catch: errors from fetchGameState (HTTP + parse) are passed through unchanged.
    retry: 0,
    refetchInterval: (observer) => {
      const status = (observer.state.data as GameState | undefined)?.status;
      if (status === 'active' || status === 'starting') {
        return 1000;
      }
      return 5000;
    },
    refetchOnWindowFocus: false,
  });

  const invalidate = () => {
    if (gameId) {
      queryClient
        .invalidateQueries({ queryKey: [GAME_STATE_QUERY_KEY, apiKey, gameId] })
        .catch(() => undefined);
    }
  };

  if (serverDisabled) {
    return {
      ...query,
      data: undefined,
      isLoading: false,
      error: undefined,
      refetch: async () => undefined,
      invalidate: () => undefined,
    };
  }

  return { ...query, invalidate };
}
