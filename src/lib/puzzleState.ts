/**
 * Puzzle State Persistence Manager
 * Handles saving and loading puzzle state to/from localStorage
 * Automatically resets state when the date or album changes
 */

interface PuzzleStateData {
  moveCount: number;
  hasReachedMaxMoves: boolean;
  isWon: boolean;
  lastPlayedDate: string; // ISO date string (YYYY-MM-DD)
  tiles: number[];
  emptyTileIndex: number;
  gameStarted: boolean;
  albumCoverUrl: string; // Track which album this state belongs to
}

export type PersistedPuzzleState = Omit<PuzzleStateData, 'lastPlayedDate' | 'albumCoverUrl'>;

export type PuzzleStateStatus = 'none' | 'fresh' | 'in-progress' | 'won' | 'game-over';

export interface PuzzleStateMeta {
  status: PuzzleStateStatus;
  canResume: boolean;
  isGameOver: boolean;
}

const STORAGE_KEY = 'le-charts-puzzle-state';

/**
 * Save puzzle state to localStorage
 * Includes date and album URL to detect when reset is needed
 */
export const savePuzzleState = (
  state: Omit<PuzzleStateData, 'lastPlayedDate' | 'albumCoverUrl'>,
  albumCoverUrl: string
) => {
  const stateWithDate: PuzzleStateData = {
    ...state,
    lastPlayedDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    albumCoverUrl,
  };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithDate));
  } catch (error) {
    console.error('Failed to save puzzle state:', error);
  }
};

/**
 * Load puzzle state from localStorage
 * Returns null if:
 * - No saved state exists
 * - It's a new day
 * - The album has changed
 */
export const loadPuzzleState = (currentAlbumUrl: string): PersistedPuzzleState | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const state: PuzzleStateData = JSON.parse(stored);
    const today = new Date().toISOString().split('T')[0];
    
    // Reset if it's a new day
    if (state.lastPlayedDate !== today) {
      clearPuzzleState();
      return null;
    }
    
    // Reset if the album has changed
    if (state.albumCoverUrl !== currentAlbumUrl) {
      clearPuzzleState();
      return null;
    }
    
    // Return state without the metadata fields
    return {
      moveCount: state.moveCount,
      hasReachedMaxMoves: state.hasReachedMaxMoves,
      isWon: state.isWon,
      tiles: state.tiles,
      emptyTileIndex: state.emptyTileIndex,
      gameStarted: state.gameStarted,
    };
  } catch (error) {
    console.error('Failed to load puzzle state:', error);
    return null;
  }
};

/**
 * Load puzzle state and return meta information about the user's progress.
 * Useful for deciding whether to show a resume/continue CTA or the game-over dialog on page load.
 */
export const loadPuzzleStateWithMeta = (currentAlbumUrl: string): {
  state: PersistedPuzzleState | null;
  meta: PuzzleStateMeta;
} => {
  const defaultMeta: PuzzleStateMeta = {
    status: 'none',
    canResume: false,
    isGameOver: false,
  };

  const state = loadPuzzleState(currentAlbumUrl);

  if (!state) {
    return { state: null, meta: defaultMeta };
  }

  const isGameOver = state.hasReachedMaxMoves && !state.isWon;
  const status: PuzzleStateStatus = state.isWon
    ? 'won'
    : isGameOver
      ? 'game-over'
      : state.gameStarted
        ? 'in-progress'
        : 'fresh';

  return {
    state,
    meta: {
      status,
      canResume: status === 'in-progress' && (state.moveCount > 0 || state.gameStarted),
      isGameOver,
    },
  };
};

/**
 * Clear puzzle state from localStorage
 * Useful for manual resets or when conditions change
 */
export const clearPuzzleState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear puzzle state:', error);
  }
};
