import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseListener } from './SupabaseListener';

const { supabaseMock, storeMocks } = vi.hoisted(() => {
  const authStore = {
    setCurrentUser: vi.fn(),
    currentUser: null as { id: string; isAdmin: boolean } | null,
  };
  const songStore = {
    setCurrentUser: vi.fn(),
    fetchScheduledSongs: vi.fn().mockResolvedValue([]),
  };
  const votingStore = {
    getUserVotedScheduledTrack: vi.fn().mockResolvedValue(null),
  };

  return {
    supabaseMock: {
      rpc: vi.fn(),
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
    },
    storeMocks: {
      authStore,
      songStore,
      votingStore,
    },
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
  hasResetToken: () => false,
  hasAuthToken: () => false,
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: (selector: (state: typeof storeMocks.authStore) => unknown) =>
    selector(storeMocks.authStore),
  useSongStore: (selector: (state: typeof storeMocks.songStore) => unknown) =>
    selector(storeMocks.songStore),
  useVotingStore: (selector: (state: typeof storeMocks.votingStore) => unknown) =>
    selector(storeMocks.votingStore),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SupabaseListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMocks.authStore.currentUser = null;
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('handles anonymous initial session by fetching songs + vote state', async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null } });

    render(<SupabaseListener />);

    await waitFor(() => {
      expect(storeMocks.songStore.fetchScheduledSongs).toHaveBeenCalledTimes(1);
      expect(storeMocks.votingStore.getUserVotedScheduledTrack).toHaveBeenCalledTimes(1);
    });
  });

  it('hydrates authenticated session and checks admin status', async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1' } } },
    });
    supabaseMock.rpc.mockResolvedValueOnce({ data: true, error: null });

    render(<SupabaseListener />);

    await waitFor(() => {
      expect(supabaseMock.rpc).toHaveBeenCalledWith('is_admin', { id: 'user-1' });
      expect(storeMocks.authStore.setCurrentUser).toHaveBeenCalledWith({
        id: 'user-1',
        isAdmin: true,
      });
      expect(storeMocks.songStore.setCurrentUser).toHaveBeenCalledWith({
        id: 'user-1',
        isAdmin: true,
      });
    });
  });
});
