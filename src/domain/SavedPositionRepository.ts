import type { SavedPosition } from './types';

/** Persists and retrieves a single saved cursor position per piece, for pin/resume. */
export interface SavedPositionRepository {
  save(position: SavedPosition): void;
  load(pieceDataName: string): SavedPosition | undefined;
  clear(pieceDataName: string): void;
}
