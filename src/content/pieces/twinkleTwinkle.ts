import type { Chord, Piece } from '../../domain/types';

/**
 * "Twinkle, Twinkle, Little Star" (public domain — the centuries-old French
 * folk tune "Ah! vous dirai-je, Maman"), the first real piece of shipped
 * content. MIDI numbers use C4 = 60 as middle C.
 */
const NOTE_SEQUENCE: readonly number[] = [
  60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60, 67, 67, 65, 65, 64, 64, 62, 67, 67, 65, 65,
  64, 64, 62, 60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60,
];

const MS_PER_NOTE = 400;

const chords: readonly Chord[] = NOTE_SEQUENCE.map((midi, index) => ({
  originalTimeMs: MS_PER_NOTE * index,
  screenDurationMs: MS_PER_NOTE,
  notes: [{ midi, velocity: 90 }],
}));

export const twinkleTwinklePiece: Piece = {
  dataName: 'traditional_twinkle_twinkle',
  displayName: 'Twinkle, Twinkle, Little Star',
  colorTheme: 'sunset',
  numScreens: NOTE_SEQUENCE.length,
  chords,
};
