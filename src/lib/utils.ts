import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Tile Puzzle Game Utilities
export const GRID_SIZE = 3;
export const TILE_COUNT = GRID_SIZE * GRID_SIZE;
export const EMPTY_TILE_VALUE = TILE_COUNT - 1;

export const IMAGE_URL =
  "https://upload.wikimedia.org/wikipedia/en/7/70/Graduation_%28album%29.jpg";

export const getPosition = (index: number) => ({
  row: Math.floor(index / GRID_SIZE),
  col: index % GRID_SIZE,
});

export const isAdjacent = (index1: number, index2: number): boolean => {
  const pos1 = getPosition(index1);
  const pos2 = getPosition(index2);
  return (
    Math.abs(pos1.row - pos2.row) + Math.abs(pos1.col - pos2.col) === 1
  );
};

export const isWon = (tiles: number[]): boolean =>
  tiles.every((tile, index) => tile === index);

export const getBackgroundPosition = (tileValue: number): string => {
  const x = (tileValue % GRID_SIZE) * 100;
  const y = Math.floor(tileValue / GRID_SIZE) * 100;
  return `-${x}px -${y}px`;
};

export const shuffleTiles = async (tiles: number[], emptyIndex: number) => {
  const shuffled = [...tiles];
  let currentEmptyIndex = emptyIndex;
  const moves = 100 + Math.floor(Math.random() * 50);

  for (let i = 0; i < moves; i++) {
    const possibleMoves: number[] = [];
    const emptyPos = getPosition(currentEmptyIndex);

    if (emptyPos.row > 0) possibleMoves.push(currentEmptyIndex - GRID_SIZE);
    if (emptyPos.row < GRID_SIZE - 1)
      possibleMoves.push(currentEmptyIndex + GRID_SIZE);
    if (emptyPos.col > 0) possibleMoves.push(currentEmptyIndex - 1);
    if (emptyPos.col < GRID_SIZE - 1)
      possibleMoves.push(currentEmptyIndex + 1);

    const targetIndex =
      possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    [shuffled[currentEmptyIndex], shuffled[targetIndex]] = [
      shuffled[targetIndex],
      shuffled[currentEmptyIndex],
    ];
    currentEmptyIndex = targetIndex;
  }

  return { tiles: shuffled, emptyIndex: currentEmptyIndex };
};
