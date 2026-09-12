import type { Chord, Piece } from '../../domain/types';

/**
 * "Mary Had a Little Lamb" (traditional American nursery rhyme, public
 * domain), the standard simple melody. MIDI numbers use C4 = 60 as middle C.
 */
const NOTE_SEQUENCE: readonly number[] = [
  64, 62, 60, 62, 64, 64, 64, 62, 62, 62, 64, 67, 67, 64, 62, 60, 62, 64, 64, 64, 64, 62, 62, 64, 62, 60,
];

const MS_PER_NOTE = 400;

const chords: readonly Chord[] = NOTE_SEQUENCE.map((midi, index) => ({
  originalTimeMs: MS_PER_NOTE * index,
  screenDurationMs: MS_PER_NOTE,
  notes: [{ midi, velocity: 90 }],
}));

export const maryHadALittleLambPiece: Piece = {
  dataName: 'traditional_mary_had_a_little_lamb',
  displayName: 'Mary Had a Little Lamb',
  colorTheme: 'forest',
  numScreens: NOTE_SEQUENCE.length,
  chords,
};
