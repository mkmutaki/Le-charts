import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVotingStore } from './useVotingStore';

const { supabaseMock, toastMock, getOrCreateDeviceIdMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  toastMock: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
  getOrCreateDeviceIdMock: vi.fn(() => '9b2f89a8-e0fe-4fa1-b37b-f95f7ca39b8c'),
}));

vi.mock('../deviceId', () => ({
  getOrCreateDeviceId: getOrCreateDeviceIdMock,
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

  const deleteBuilder = {
    error: params?.deleteError ?? null,
    eq: vi.fn(),
    not: vi.fn().mockResolvedValue({ error: params?.deleteError ?? null }),
  };
  deleteBuilder.eq.mockImplementation(() => deleteBuilder);

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    maybeSingle,
    insert: vi.fn().mockResolvedValue({ error: params?.insertError ?? null }),
    delete: vi.fn().mockReturnValue(deleteBuilder),
    deleteBuilder,
  };
}

let mockedNow = 1_000_000;

describe('useVotingStore.getUserVotedScheduledTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedNow += 300_000;
    vi.spyOn(Date, 'now').mockReturnValue(mockedNow);
    localStorage.clear();
    useVotingStore.setState({
      ...useVotingStore.getState(),
      currentUser: null,
      isLoading: false,
      votedScheduledTrackId: null,
      currentVoteDate: null,
    });
  });

  it('returns null and stores unvoted state when there is no vote for the date', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [{ data: null, error: null }],
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );

    const result = await useVotingStore.getState().getUserVotedScheduledTrack('2026-02-27');

    expect(result).toBeNull();
    expect(useVotingStore.getState().currentVoteDate).toBe('2026-02-27');
    expect(useVotingStore.getState().votedScheduledTrackId).toBeNull();
  });

  it('returns the voted track id when a vote exists for the device/date', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [{ data: { scheduled_track_id: 'track-1' }, error: null }],
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );

    const result = await useVotingStore.getState().getUserVotedScheduledTrack('2026-02-27');

    expect(result).toBe('track-1');
    expect(useVotingStore.getState().votedScheduledTrackId).toBe('track-1');
  });

  it('handles vote-state fetch failures gracefully', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [{ data: null, error: { message: 'network failed' } }],
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );

    const result = await useVotingStore.getState().getUserVotedScheduledTrack('2026-02-27');

    expect(result).toBeNull();
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});

describe('useVotingStore.upvoteScheduledTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedNow += 300_000;
    vi.spyOn(Date, 'now').mockReturnValue(mockedNow);
    localStorage.clear();
    useVotingStore.setState({
      ...useVotingStore.getState(),
      currentUser: null,
      isLoading: false,
      votedScheduledTrackId: null,
      currentVoteDate: null,
    });
  });

  it('submits the vote payload with device_id, scheduled_track_id, and scheduled_date', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [{ data: null, error: null }],
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );
    getOrCreateDeviceIdMock.mockReturnValueOnce('3f57f53f-5f28-4444-a71f-b8f137fdbf1f');

    const result = await useVotingStore
      .getState()
      .upvoteScheduledTrack('track-1', '2026-02-25');

    expect(result).toBe(true);
    expect(songVotesTable.insert).toHaveBeenCalledWith({
      scheduled_track_id: 'track-1',
      scheduled_date: '2026-02-25',
      device_id: '3f57f53f-5f28-4444-a71f-b8f137fdbf1f',
    });
  });

  it('allows unauthenticated visitors to vote', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [{ data: null, error: null }],
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );
    useVotingStore.setState({
      ...useVotingStore.getState(),
      currentUser: null,
    });

    const result = await useVotingStore
      .getState()
      .upvoteScheduledTrack('track-anon', '2026-02-25');

    expect(result).toBe(true);
    expect(songVotesTable.insert).toHaveBeenCalledTimes(1);
  });

  it('allows one vote per device/date and blocks duplicate vote before insert', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [{ data: null, error: null }],
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );

    const firstVote = await useVotingStore
      .getState()
      .upvoteScheduledTrack('track-1', '2026-02-25');
    const secondVote = await useVotingStore
      .getState()
      .upvoteScheduledTrack('track-1', '2026-02-25');

    expect(firstVote).toBe(true);
    expect(secondVote).toBe(false);
    expect(songVotesTable.insert).toHaveBeenCalledTimes(1);
    expect(toastMock.info).toHaveBeenCalledWith('You already liked this song');
  });

  it('blocks voting for a different track after a vote already exists for the date', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [{ data: null, error: null }],
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );

    await useVotingStore.getState().upvoteScheduledTrack('track-1', '2026-02-25');
    const secondTrackVote = await useVotingStore
      .getState()
      .upvoteScheduledTrack('track-2', '2026-02-25');

    expect(secondTrackVote).toBe(false);
    expect(songVotesTable.insert).toHaveBeenCalledTimes(1);
    expect(toastMock.info).toHaveBeenCalledWith('You can only vote for one song per day');
  });

  it('rejects insert when an existing DB vote is found', async () => {
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

    const result = await useVotingStore
      .getState()
      .upvoteScheduledTrack('track-2', '2026-02-25');

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

  it('returns false when future-date check constraint rejects the vote', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [{ data: null, error: null }],
      insertError: { message: 'new row violates check constraint "song_votes_scheduled_date_check"' },
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );

    const result = await useVotingStore
      .getState()
      .upvoteScheduledTrack('track-1', '2026-03-15');

    expect(result).toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith('Failed to vote for song');
  });

  it('permits voting again after a new device ID is issued (e.g., storage cleared)', async () => {
    const songVotesTable = createSongVotesTable({
      maybeSingleResults: [
        { data: null, error: null },
        { data: null, error: null },
      ],
    });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );
    getOrCreateDeviceIdMock
      .mockReturnValueOnce('c8853ce5-bf06-4ecf-a860-3f73f375f951')
      .mockReturnValueOnce('5a1c9820-429f-4177-9a0f-fad8f4dce4d2');

    const firstVote = await useVotingStore
      .getState()
      .upvoteScheduledTrack('track-1', '2026-02-25');

    useVotingStore.setState({
      ...useVotingStore.getState(),
      votedScheduledTrackId: null,
      currentVoteDate: null,
    });

    const secondVote = await useVotingStore
      .getState()
      .upvoteScheduledTrack('track-1', '2026-02-25');

    expect(firstVote).toBe(true);
    expect(secondVote).toBe(true);
    expect(songVotesTable.insert).toHaveBeenCalledTimes(2);
  });
});

describe('useVotingStore admin vote deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedNow += 300_000;
    vi.spyOn(Date, 'now').mockReturnValue(mockedNow);
    localStorage.clear();
    useVotingStore.setState({
      ...useVotingStore.getState(),
      currentUser: { id: 'admin-user', isAdmin: true },
      isLoading: false,
      votedScheduledTrackId: 'track-1',
      currentVoteDate: '2026-02-25',
    });
  });

  it('does not delete track votes when the user is not admin', async () => {
    const songVotesTable = createSongVotesTable();
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );
    supabaseMock.rpc.mockResolvedValueOnce({ data: false, error: null });

    const success = await useVotingStore
      .getState()
      .deleteScheduledTrackVotes('track-1', '2026-02-25');

    expect(success).toBe(false);
    expect(songVotesTable.delete).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith('Only admins can delete votes');
  });

  it('deletes votes for a specific track and date when user is admin', async () => {
    const songVotesTable = createSongVotesTable();
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'song_votes' ? songVotesTable : {}
    );
    supabaseMock.rpc.mockResolvedValueOnce({ data: true, error: null });

    const success = await useVotingStore
      .getState()
      .deleteScheduledTrackVotes('track-1', '2026-02-25');

    expect(success).toBe(true);
    expect(songVotesTable.delete).toHaveBeenCalledTimes(1);
    expect(songVotesTable.deleteBuilder.eq).toHaveBeenNthCalledWith(1, 'scheduled_date', '2026-02-25');
    expect(songVotesTable.deleteBuilder.eq).toHaveBeenNthCalledWith(2, 'scheduled_track_id', 'track-1');
    expect(useVotingStore.getState().votedScheduledTrackId).toBeNull();
  });
});

describe('useVotingStore.resetScheduledVotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedNow += 300_000;
    vi.spyOn(Date, 'now').mockReturnValue(mockedNow);
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
