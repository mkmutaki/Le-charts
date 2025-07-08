import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, Play } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import {
  TILE_COUNT,
  EMPTY_TILE_VALUE,
  isAdjacent,
  isWon,
  getBackgroundPosition,
  shuffleTiles,
} from '@/lib/utils';
import { usePuzzleSettings } from '@/hooks/usePuzzleSettings';
import type { TilePuzzleState } from '@/lib/types';

interface TilePuzzleProps {
  onComplete: () => void;
}

const TilePuzzle = ({ onComplete }: TilePuzzleProps) => {
  const { settings, loading } = usePuzzleSettings();
  const [showReferenceImage, setShowReferenceImage] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState<TilePuzzleState>({
    tiles: Array.from({ length: TILE_COUNT }, (_, i) => i),
    emptyTileIndex: EMPTY_TILE_VALUE,
    moveCount: 0,
    isWon: false,
    isShuffling: false,
  });

  const handleTileClick = useCallback((tileValue: number) => {
    if (gameState.isShuffling || gameState.isWon || !gameStarted) return;

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
  }, [gameState.isShuffling, gameState.isWon, gameState.tiles, gameState.emptyTileIndex, onComplete, gameStarted]);

  const handleShuffle = useCallback(async () => {
    if (!gameStarted) {
      setGameStarted(true);
    }
    
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
  }, [gameState.tiles, gameState.emptyTileIndex, gameStarted]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const imageUrl = settings?.current_album_cover_url;
  const albumTitle = settings?.album_title || 'Unknown Album';
  const albumArtist = settings?.album_artist || 'Unknown Artist';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Navbar overlay */}
      <Navbar />
      
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Album of the day</CardTitle>
          <p className="text-sm text-muted-foreground">Reassemble the {albumTitle} album cover!</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Game Grid */}
          <div className="relative w-[300px] h-[300px] mx-auto border-2 border-border rounded-lg overflow-hidden shadow-md">
            {gameState.tiles.map((tileValue, currentIndex) => {
              const isEmpty = tileValue === EMPTY_TILE_VALUE;
              const top = Math.floor(currentIndex / 3) * 100;
              const left = (currentIndex % 3) * 100;
              
              return (
                <div
                  key={tileValue}
                  className={cn(
                    "absolute w-[100px] h-[100px] border border-border transition-all duration-300 ease-out cursor-pointer rounded",
                    isEmpty ? "bg-muted cursor-default" : "shadow-inner",
                    !gameState.isShuffling && !isEmpty && "hover:brightness-110"
                  )}
                  style={{
                    top: `${top}px`,
                    left: `${left}px`,
                    backgroundImage: isEmpty ? 'none' : `url('${imageUrl}')`,
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
            
            {/* Start Button Overlay */}
            {!gameStarted && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
                <motion.button
                  onClick={handleShuffle}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-primary text-primary-foreground font-medium px-6 py-3 rounded-full shadow-lg flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Click to Start
                </motion.button>
              </div>
            )}
          </div>
          
          {/* Controls */}
          <div className="flex justify-between items-center">
            {/* View Reference button moved to left position */}
            <motion.button
              onClick={() => setShowReferenceImage(true)}
              className="group relative flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg hover:border-muted-foreground"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ImageIcon className="h-3 w-3" />
              <span>View Reference</span>
              {imageUrl && (
                <div 
                  className="w-8 h-8 rounded border border-border bg-cover bg-center ml-1"
                  style={{ 
                    backgroundImage: `url('${imageUrl}')`,
                    backgroundSize: 'cover'
                  }}
                />
              )}
            </motion.button>
            
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
            Album Cover: {albumArtist} - {albumTitle}
          </p>
        </CardContent>
      </Card>

      {/* Reference Image Modal */}
      <AnimatePresence>
        {showReferenceImage && imageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowReferenceImage(false)}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 30,
                duration: 0.4 
              }}
              className="relative max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative bg-card rounded-xl overflow-hidden shadow-2xl">
                <div className="absolute top-2 right-2 z-10">
                  <motion.button
                    onClick={() => setShowReferenceImage(false)}
                    className="bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="h-4 w-4" />
                  </motion.button>
                </div>
                
                <img
                  src={imageUrl}
                  alt={`${albumArtist} - ${albumTitle} album cover`}
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
                
                <div className="p-4 bg-card">
                  <h3 className="text-lg font-semibold text-card-foreground">{albumTitle}</h3>
                  <p className="text-sm text-muted-foreground">{albumArtist}</p>
                  <p className="text-xs text-muted-foreground mt-1">Reference image for the puzzle</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TilePuzzle;
