import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVotingStore } from './useVotingStore';

const { supabaseMock, toastMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  toastMock: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'device-123',
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

type VoteRow = {
  scheduled_track_id: string;
};

function createSongVotesTable(params?: {
  maybeSingleResults?: Array<{ data: VoteRow | null; error: { message: string } | null }>;
  insertError?: { message: string } | null;
  deleteError?: { message: string } | null;
}) {
  const maybeSingleResults = params?.maybeSingleResults ?? [{ data: null, error: null }];
  const maybeSingle = vi.fn();
  for (const result of maybeSingleResults) {
    maybeSingle.mockResolvedValueOnce(result);
  }
  if (maybeSingleResults.length > 0) {
    maybeSingle.mockResolvedValue(maybeSingleResults[maybeSingleResults.length - 1]);
  }

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    maybeSingle,
    insert: vi.fn().mockResolvedValue({ error: params?.insertError ?? null }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockResolvedValue({
          error: params?.deleteError ?? null,
        }),
      }),
    }),
  };
}

describe('useVotingStore.upvoteScheduledTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useVotingStore.setState({
      ...useVotingStore.getState(),
      currentUser: null,
      isLoading: false,
      votedScheduledTrackId: null,
      currentVoteDate: null,
    });
  });

  it('allows one vote per device per scheduled date and rejects a duplicate', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [{ data: null, error: null }],
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );

    const firstVote = await useVotingStore.getState().upvoteScheduledTrack('track-1', '2026-02-25');
    const secondVote = await useVotingStore.getState().upvoteScheduledTrack('track-1', '2026-02-25');

    expect(firstVote).toBe(true);
    expect(secondVote).toBe(false);
    expect(songVotesTable.insert).toHaveBeenCalledTimes(1);
    expect(toastMock.info).toHaveBeenCalledWith('You already liked this song');
  });

  it('rejects voting for a different track after already voting that day', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [{ data: null, error: null }],
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );

    await useVotingStore.getState().upvoteScheduledTrack('track-1', '2026-02-25');
    const secondTrackVote = await useVotingStore.getState().upvoteScheduledTrack('track-2', '2026-02-25');

    expect(secondTrackVote).toBe(false);
    expect(songVotesTable.insert).toHaveBeenCalledTimes(1);
    expect(toastMock.info).toHaveBeenCalledWith('You can only vote for one song per day');
  });

  it('rejects insert when an existing vote is already in the database', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [
        {
          data: { scheduled_track_id: 'track-1' },
          error: null,
        },
      ],
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );

    const result = await useVotingStore.getState().upvoteScheduledTrack('track-2', '2026-02-25');

    expect(result).toBe(false);
    expect(songVotesTable.insert).not.toHaveBeenCalled();
  });

  it('returns false when insert policy rejects invalid vote payloads', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [{ data: null, error: null }],
      insertError: { message: 'new row violates row-level security policy' },
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );

    const result = await useVotingStore.getState().upvoteScheduledTrack('', '2026-02-25');

    expect(result).toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith('Failed to vote for song');
  });

  it('returns false when the future-date check constraint rejects the vote', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [{ data: null, error: null }],
      insertError: { message: 'new row violates check constraint "song_votes_scheduled_date_check"' },
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );

    const result = await useVotingStore.getState().upvoteScheduledTrack('track-1', '2026-03-15');

    expect(result).toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith('Failed to vote for song');
  });
});

describe('useVotingStore.resetScheduledVotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useVotingStore.setState({
      ...useVotingStore.getState(),
      currentUser: { id: 'admin-user', isAdmin: true },
      isLoading: false,
      votedScheduledTrackId: 'track-1',
      currentVoteDate: '2026-02-25',
    });
  });

  it('does not delete votes when the user is not admin', async () => {
    const songVotesTable = createSongVotesTable();
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );
    supabaseMock.rpc.mockResolvedValueOnce({ data: false, error: null });

    await useVotingStore.getState().resetScheduledVotes('2026-02-25');

    expect(songVotesTable.delete).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith('Only admins can reset votes');
  });

  it('deletes all scheduled votes for the date when user is admin', async () => {
    const songVotesTable = createSongVotesTable();
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );
    supabaseMock.rpc.mockResolvedValueOnce({ data: true, error: null });

    await useVotingStore.getState().resetScheduledVotes('2026-02-25');

    expect(songVotesTable.delete).toHaveBeenCalledTimes(1);
    expect(useVotingStore.getState().votedScheduledTrackId).toBeNull();
  });
});
