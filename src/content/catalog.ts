import { PieceCatalog } from '../domain/PieceCatalog';
import type { Piece } from '../domain/types';
import { twinkleTwinklePiece } from './pieces/twinkleTwinkle';

/** Browsable menu of every shipped piece, grouped by composer pack. */
export const contentCatalog = new PieceCatalog([
  {
    composer: 'traditional',
    composerDisplay: 'Traditional',
    packDisplay: 'Folk & Nursery Tunes',
    pieces: [
      {
        dataName: twinkleTwinklePiece.dataName,
        displayName: twinkleTwinklePiece.displayName,
        colorTheme: twinkleTwinklePiece.colorTheme,
      },
    ],
  },
]);

/** Full `Piece` data for every piece the catalog references, keyed by dataName — the composition root loads chord data from here (a real app would fetch these lazily; for now everything is bundled). */
export const contentPieces: ReadonlyMap<string, Piece> = new Map([[twinkleTwinklePiece.dataName, twinkleTwinklePiece]]);
