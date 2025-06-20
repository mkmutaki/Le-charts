import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  TILE_COUNT,
  EMPTY_TILE_VALUE,
  IMAGE_URL,
  isAdjacent,
  isWon,
  getBackgroundPosition,
  shuffleTiles,
} from '@/lib/utils';
import type { TilePuzzleState } from '@/lib/types';

interface TilePuzzleProps {
  onComplete: () => void;
}

const TilePuzzle = ({ onComplete }: TilePuzzleProps) => {
  const [gameState, setGameState] = useState<TilePuzzleState>({
    tiles: Array.from({ length: TILE_COUNT }, (_, i) => i),
    emptyTileIndex: EMPTY_TILE_VALUE,
    moveCount: 0,
    isWon: false,
    isShuffling: false,
  });

  const handleTileClick = useCallback((tileValue: number) => {
    if (gameState.isShuffling || gameState.isWon) return;

    const clickedTileIndex = gameState.tiles.indexOf(tileValue);
    
    if (isAdjacent(clickedTileIndex, gameState.emptyTileIndex)) {
      setGameState(prev => {
        const newTiles = [...prev.tiles];
        [newTiles[clickedTileIndex], newTiles[prev.emptyTileIndex]] = 
          [newTiles[prev.emptyTileIndex], newTiles[clickedTileIndex]];
        
        const newMoveCount = prev.moveCount + 1;
        const hasWon = isWon(newTiles);
        
        if (hasWon) {
          setTimeout(() => onComplete(), 2000);
        }
        
        return {
          ...prev,
          tiles: newTiles,
          emptyTileIndex: clickedTileIndex,
          moveCount: newMoveCount,
          isWon: hasWon,
        };
      });
    }
  }, [gameState.isShuffling, gameState.isWon, gameState.tiles, gameState.emptyTileIndex, onComplete]);

  const handleShuffle = useCallback(async () => {
    setGameState(prev => ({
      ...prev,
      isShuffling: true,
      isWon: false,
      moveCount: 0,
    }));

    const { tiles: shuffledTiles, emptyIndex } = await shuffleTiles(
      gameState.tiles,
      gameState.emptyTileIndex
    );

    setGameState(prev => ({
      ...prev,
      tiles: shuffledTiles,
      emptyTileIndex: emptyIndex,
      isShuffling: false,
    }));
  }, [gameState.tiles, gameState.emptyTileIndex]);

  return (
    <div className="min-h-screen bg-[#121213] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Sliding Tile Puzzle</CardTitle>
          <p className="text-sm text-muted-foreground">Reassemble the Graduation album cover!</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Game Grid */}
          <div className="relative w-[300px] h-[300px] mx-auto border-2 border-slate-700 rounded-lg overflow-hidden shadow-md">
            {gameState.tiles.map((tileValue, currentIndex) => {
              const isEmpty = tileValue === EMPTY_TILE_VALUE;
              const top = Math.floor(currentIndex / 3) * 100;
              const left = (currentIndex % 3) * 100;
              
              return (
                <div
                  key={tileValue}
                  className={cn(
                    "absolute w-[100px] h-[100px] border border-slate-400 transition-all duration-300 ease-out cursor-pointer rounded",
                    isEmpty ? "bg-slate-700 cursor-default" : "shadow-inner",
                    !gameState.isShuffling && !isEmpty && "hover:brightness-110"
                  )}
                  style={{
                    top: `${top}px`,
                    left: `${left}px`,
                    backgroundImage: isEmpty ? 'none' : `url('${IMAGE_URL}')`,
                    backgroundSize: '300px 300px',
                    backgroundPosition: isEmpty ? 'center' : getBackgroundPosition(tileValue),
                  }}
                  onClick={() => handleTileClick(tileValue)}
                  role="button"
                  tabIndex={0}
                  aria-label={isEmpty ? 'Empty tile' : `Tile ${tileValue + 1}`}
                />
              );
            })}
          </div>
          
          {/* Controls */}
          <div className="flex justify-between items-center">
            <Button
              onClick={handleShuffle}
              disabled={gameState.isShuffling}
              variant="default"
              size="sm"
            >
              {gameState.isShuffling ? 'Shuffling...' : 'Shuffle'}
            </Button>
            
            <div className="text-lg font-medium">
              Moves: <span className="font-bold">{gameState.moveCount}</span>
            </div>
          </div>
          
          {/* Win Message */}
          {gameState.isWon && (
            <div className="text-center text-green-600 font-semibold text-lg animate-pulse">
              🎉 You solved it in {gameState.moveCount} moves! 🎉
            </div>
          )}
          
          <p className="text-xs text-muted-foreground text-center">
            Album Cover: Kanye West - Graduation
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TilePuzzle;