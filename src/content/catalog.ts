import { PieceCatalog } from '../domain/PieceCatalog';
import type { Piece } from '../domain/types';
import { twinkleTwinklePiece } from './pieces/twinkleTwinkle';
import { maryHadALittleLambPiece } from './pieces/maryHadALittleLamb';
import { odeToJoyPiece } from './pieces/odeToJoy';
import { moonlightSonataPiece } from './pieces/moonlightSonata';
import { rachmaninoffPreludeOp3No2Piece } from './pieces/rachmaninoffPreludeOp3No2';
import { lisztLaCampanellaPiece } from './pieces/lisztLaCampanella';

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
      {
        dataName: maryHadALittleLambPiece.dataName,
        displayName: maryHadALittleLambPiece.displayName,
        colorTheme: maryHadALittleLambPiece.colorTheme,
      },
    ],
  },
  {
    composer: 'beethoven',
    composerDisplay: 'Ludwig van Beethoven',
    packDisplay: 'Piano Favorites',
    pieces: [
      {
        dataName: odeToJoyPiece.dataName,
        displayName: odeToJoyPiece.displayName,
        colorTheme: odeToJoyPiece.colorTheme,
      },
      {
        dataName: moonlightSonataPiece.dataName,
        displayName: moonlightSonataPiece.displayName,
        colorTheme: moonlightSonataPiece.colorTheme,
      },
    ],
  },
  {
    composer: 'rachmaninoff',
    composerDisplay: 'Sergei Rachmaninoff',
    packDisplay: 'Romantic Showpieces',
    pieces: [
      {
        dataName: rachmaninoffPreludeOp3No2Piece.dataName,
        displayName: rachmaninoffPreludeOp3No2Piece.displayName,
        colorTheme: rachmaninoffPreludeOp3No2Piece.colorTheme,
      },
    ],
  },
  {
    composer: 'liszt',
    composerDisplay: 'Franz Liszt',
    packDisplay: 'Virtuoso Etudes',
    pieces: [
      {
        dataName: lisztLaCampanellaPiece.dataName,
        displayName: lisztLaCampanellaPiece.displayName,
        colorTheme: lisztLaCampanellaPiece.colorTheme,
      },
    ],
  },
]);

/** Full `Piece` data for every piece the catalog references, keyed by dataName — the composition root loads chord data from here (a real app would fetch these lazily; for now everything is bundled). */
export const contentPieces: ReadonlyMap<string, Piece> = new Map([
  [twinkleTwinklePiece.dataName, twinkleTwinklePiece],
  [maryHadALittleLambPiece.dataName, maryHadALittleLambPiece],
  [odeToJoyPiece.dataName, odeToJoyPiece],
  [moonlightSonataPiece.dataName, moonlightSonataPiece],
  [rachmaninoffPreludeOp3No2Piece.dataName, rachmaninoffPreludeOp3No2Piece],
  [lisztLaCampanellaPiece.dataName, lisztLaCampanellaPiece],
]);
