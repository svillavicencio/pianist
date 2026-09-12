import type { Piece } from '../domain/types';

/**
 * A tiny hand-authored piece used ONLY to validate the end-to-end loop (the
 * "walking skeleton") before the real content pipeline exists. Not meant to
 * ship — replace with a real public-domain transcription once the content
 * track lands. Four chords: C4, E4, G4, then all three together.
 */
export const walkingSkeletonPiece: Piece = {
  dataName: 'walking-skeleton',
  displayName: 'Walking Skeleton (C major arpeggio)',
  colorTheme: 'parliament',
  numScreens: 4,
  chords: [
    { originalTimeMs: 0, screenDurationMs: 500, notes: [{ midi: 60, velocity: 90 }] },
    { originalTimeMs: 500, screenDurationMs: 500, notes: [{ midi: 64, velocity: 90 }] },
    { originalTimeMs: 1000, screenDurationMs: 500, notes: [{ midi: 67, velocity: 90 }] },
    {
      originalTimeMs: 1500,
      screenDurationMs: 500,
      notes: [
        { midi: 60, velocity: 100 },
        { midi: 64, velocity: 100 },
        { midi: 67, velocity: 100 },
      ],
    },
  ],
};
