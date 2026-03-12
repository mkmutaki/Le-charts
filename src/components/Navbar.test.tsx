import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Navbar } from './Navbar';

const navigateMock = vi.fn();

let authState: {
  currentUser: { id: string; isAdmin: boolean } | null;
  checkAdminStatus: ReturnType<typeof vi.fn>;
};

let weekendState: {
  weeklyChampions: Array<{
    weekStartDate: string;
    scheduledTrackId: string;
    finalRank: number;
    voteCount: number;
    trackName: string;
    artistName: string;
    artworkUrl: string | null;
  }>;
  fetchWeeklyChampions: ReturnType<typeof vi.fn>;
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: () => authState,
  useWeekendStore: () => weekendState,
}));

vi.mock('./ResetPasswordModal', () => ({
  ResetPasswordModal: () => null,
}));

vi.mock('./ui/toggle', () => ({
  Toggle: ({
    children,
    pressed,
    onPressedChange,
    ...props
  }: {
    children: ReactNode;
    pressed?: boolean;
    onPressedChange?: (next: boolean) => void;
  }) => (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange?.(!pressed)}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('./ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('Navbar champions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authState = {
      currentUser: null,
      checkAdminStatus: vi.fn().mockResolvedValue(false),
    };

    weekendState = {
      weeklyChampions: [],
      fetchWeeklyChampions: vi.fn().mockResolvedValue([]),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('renders three champion pills when three champions exist', async () => {
    weekendState.weeklyChampions = [
      {
        weekStartDate: '2026-03-02',
        scheduledTrackId: 'track-1',
        finalRank: 1,
        voteCount: 14,
        trackName: 'Champion One',
        artistName: 'Artist A',
        artworkUrl: 'https://img/1',
      },
      {
        weekStartDate: '2026-03-02',
        scheduledTrackId: 'track-2',
        finalRank: 2,
        voteCount: 12,
        trackName: 'Champion Two',
        artistName: 'Artist B',
        artworkUrl: 'https://img/2',
      },
      {
        weekStartDate: '2026-03-02',
        scheduledTrackId: 'track-3',
        finalRank: 3,
        voteCount: 10,
        trackName: 'Champion Three',
        artistName: 'Artist C',
        artworkUrl: 'https://img/3',
      },
    ];

    render(<Navbar />);

    expect(screen.getAllByTestId('champion-pill')).toHaveLength(3);
    expect(screen.getByText('Champion One')).toBeInTheDocument();

    await waitFor(() => {
      expect(weekendState.fetchWeeklyChampions).toHaveBeenCalledWith(undefined, {
        force: true,
      });
    });
  });

  it('renders a single champion pill for sparse weeks', () => {
    weekendState.weeklyChampions = [
      {
        weekStartDate: '2026-03-02',
        scheduledTrackId: 'track-only',
        finalRank: 1,
        voteCount: 6,
        trackName: 'Only Winner',
        artistName: 'Solo Artist',
        artworkUrl: 'https://img/only',
      },
    ];

    render(<Navbar />);

    expect(screen.getAllByTestId('champion-pill')).toHaveLength(1);
    expect(screen.getByText('Only Winner')).toBeInTheDocument();
  });

  it('renders nothing when no champions are available', () => {
    weekendState.weeklyChampions = [];

    render(<Navbar />);

    expect(screen.queryByTestId('champion-pill')).toBeNull();
  });

  it('renders previous week champions when store provides fallback champions', () => {
    weekendState.weeklyChampions = [
      {
        weekStartDate: '2026-03-02',
        scheduledTrackId: 'fallback-1',
        finalRank: 1,
        voteCount: 9,
        trackName: 'Fallback Winner',
        artistName: 'Artist F',
        artworkUrl: 'https://img/fallback',
      },
    ];

    render(<Navbar />);

    expect(screen.getByText('Fallback Winner')).toBeInTheDocument();
    expect(screen.getAllByTestId('champion-pill')).toHaveLength(1);
  });

  it('renders artwork and truncation class for long champion names', () => {
    weekendState.weeklyChampions = [
      {
        weekStartDate: '2026-03-02',
        scheduledTrackId: 'long-name-track',
        finalRank: 1,
        voteCount: 20,
        trackName: 'This Is A Very Long Champion Track Name That Should Truncate',
        artistName: 'Long Name Artist',
        artworkUrl: 'https://img/long',
      },
    ];

    render(<Navbar />);

    const championImage = screen.getByRole('img', {
      name: /This Is A Very Long Champion Track Name That Should Truncate artwork/i,
    });
    const nameElement = screen.getByText(
      'This Is A Very Long Champion Track Name That Should Truncate'
    );

    expect(championImage).toBeInTheDocument();
    expect(nameElement).toHaveClass('truncate');
  });
});
