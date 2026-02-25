import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './useAuthStore';
import { useScheduleStore } from './useScheduleStore';

const {
  toastErrorMock,
  toastSuccessMock,
  scheduleAlbumServiceMock,
  getScheduledAlbumsServiceMock,
  getAlbumForDateServiceMock,
  updateScheduledAlbumServiceMock,
  deleteScheduledAlbumServiceMock,
  checkDateAvailabilityServiceMock,
  isAdminUserMock,
  getLocalDateStringMock,
} = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  scheduleAlbumServiceMock: vi.fn(),
  getScheduledAlbumsServiceMock: vi.fn(),
  getAlbumForDateServiceMock: vi.fn(),
  updateScheduledAlbumServiceMock: vi.fn(),
  deleteScheduledAlbumServiceMock: vi.fn(),
  checkDateAvailabilityServiceMock: vi.fn(),
  isAdminUserMock: vi.fn(),
  getLocalDateStringMock: vi.fn(() => '2026-02-25'),
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

vi.mock('../services/adminService', () => ({
  isAdminUser: isAdminUserMock,
}));

vi.mock('../services/scheduledAlbumService', () => ({
  scheduleAlbum: scheduleAlbumServiceMock,
  getScheduledAlbums: getScheduledAlbumsServiceMock,
  getAlbumForDate: getAlbumForDateServiceMock,
  updateScheduledAlbum: updateScheduledAlbumServiceMock,
  deleteScheduledAlbum: deleteScheduledAlbumServiceMock,
  checkDateAvailability: checkDateAvailabilityServiceMock,
}));

vi.mock('../dateUtils', () => ({
  getLocalDateString: getLocalDateStringMock,
}));

describe('useScheduleStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      ...useAuthStore.getState(),
      currentUser: null,
      isLoading: false,
    });
    useScheduleStore.setState({
      ...useScheduleStore.getState(),
      currentUser: null,
      scheduledAlbums: [],
      completedAlbums: [],
      todayAlbum: null,
      isLoading: false,
      isLoadingCompleted: false,
      error: null,
    });
  });

  it('fetchScheduledAlbums skips when there is no authenticated user', async () => {
    await useScheduleStore.getState().fetchScheduledAlbums({ force: true });

    expect(isAdminUserMock).not.toHaveBeenCalled();
    expect(getScheduledAlbumsServiceMock).not.toHaveBeenCalled();
    expect(useScheduleStore.getState().scheduledAlbums).toEqual([]);
    expect(useScheduleStore.getState().completedAlbums).toEqual([]);
  });

  it('fetchScheduledAlbums splits upcoming/today vs completed albums for admins', async () => {
    useAuthStore.setState({
      ...useAuthStore.getState(),
      currentUser: { id: 'admin-1', isAdmin: true },
    });
    isAdminUserMock.mockResolvedValue(true);
    getScheduledAlbumsServiceMock.mockResolvedValue([
      { id: 'a1', scheduled_date: '2026-02-24' },
      { id: 'a2', scheduled_date: '2026-02-25' },
      { id: 'a3', scheduled_date: '2026-02-27' },
    ]);

    await useScheduleStore.getState().fetchScheduledAlbums({ force: true });

    expect(getScheduledAlbumsServiceMock).toHaveBeenCalledWith('all');
    expect(useScheduleStore.getState().scheduledAlbums.map((a) => a.id)).toEqual(['a2', 'a3']);
    expect(useScheduleStore.getState().completedAlbums.map((a) => a.id)).toEqual(['a1']);
  });

  it('scheduleAlbum blocks unauthenticated users', async () => {
    const result = await useScheduleStore.getState().scheduleAlbum(
      {
        spotifyAlbumId: 'album-1',
        albumName: 'Album',
        artistName: 'Artist',
        artworkUrl: 'https://image.test/a.jpg',
        trackCount: 1,
      },
      [],
      '2026-02-25'
    );

    expect(result).toEqual({
      success: false,
      error: 'You must be logged in to schedule albums',
    });
    expect(scheduleAlbumServiceMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith('You must be logged in to schedule albums');
  });

  it('scheduleAlbum blocks non-admin users', async () => {
    useAuthStore.setState({
      ...useAuthStore.getState(),
      currentUser: { id: 'user-1', isAdmin: false },
    });
    isAdminUserMock.mockResolvedValue(false);

    const result = await useScheduleStore.getState().scheduleAlbum(
      {
        spotifyAlbumId: 'album-1',
        albumName: 'Album',
        artistName: 'Artist',
        artworkUrl: 'https://image.test/a.jpg',
        trackCount: 1,
      },
      [],
      '2026-02-25'
    );

    expect(result).toEqual({
      success: false,
      error: 'Only admins can schedule albums',
    });
    expect(scheduleAlbumServiceMock).not.toHaveBeenCalled();
  });

  it('scheduleAlbum schedules and refreshes state for admins', async () => {
    useAuthStore.setState({
      ...useAuthStore.getState(),
      currentUser: { id: 'admin-1', isAdmin: true },
    });
    isAdminUserMock.mockResolvedValue(true);
    scheduleAlbumServiceMock.mockResolvedValue({ success: true, albumId: 'album-id' });
    getScheduledAlbumsServiceMock.mockResolvedValue([]);

    const result = await useScheduleStore.getState().scheduleAlbum(
      {
        spotifyAlbumId: 'album-1',
        albumName: 'Album',
        artistName: 'Artist',
        artworkUrl: 'https://image.test/a.jpg',
        trackCount: 2,
      },
      [
        {
          spotifyTrackId: 'track-1',
          trackName: 'Track 1',
          artistName: 'Artist',
          trackNumber: 1,
        },
      ],
      '2026-02-25'
    );

    expect(result).toEqual({ success: true, albumId: 'album-id' });
    expect(scheduleAlbumServiceMock).toHaveBeenCalledTimes(1);
    expect(getScheduledAlbumsServiceMock).toHaveBeenCalledTimes(1);
    expect(toastSuccessMock).toHaveBeenCalledWith('Album "Album" scheduled for 2026-02-25');
  });

  it('deleteSchedule removes deleted album from local scheduledAlbums list', async () => {
    useAuthStore.setState({
      ...useAuthStore.getState(),
      currentUser: { id: 'admin-1', isAdmin: true },
    });
    useScheduleStore.setState({
      ...useScheduleStore.getState(),
      scheduledAlbums: [
        { id: 'keep-me', scheduled_date: '2026-02-26' },
        { id: 'delete-me', scheduled_date: '2026-02-27' },
      ],
    });
    isAdminUserMock.mockResolvedValue(true);
    deleteScheduledAlbumServiceMock.mockResolvedValue({ success: true });

    const result = await useScheduleStore.getState().deleteSchedule('delete-me');

    expect(result).toEqual({ success: true });
    expect(deleteScheduledAlbumServiceMock).toHaveBeenCalledWith('delete-me');
    expect(useScheduleStore.getState().scheduledAlbums.map((a) => a.id)).toEqual(['keep-me']);
  });
});
