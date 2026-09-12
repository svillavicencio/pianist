import type { Chord, Piece } from '../../domain/types';

/**
 * "Ode to Joy" (Beethoven, Symphony No. 9, 1824 — public domain), the
 * iconic 8-bar main theme, first two phrases. MIDI numbers use C4 = 60 as
 * middle C.
 */
const NOTE_SEQUENCE: readonly number[] = [
  64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62, 64, 64, 65, 67, 67, 65, 64, 62, 60, 60,
  62, 64, 62, 60, 60,
];

const MS_PER_NOTE = 400;

const chords: readonly Chord[] = NOTE_SEQUENCE.map((midi, index) => ({
  originalTimeMs: MS_PER_NOTE * index,
  screenDurationMs: MS_PER_NOTE,
  notes: [{ midi, velocity: 90 }],
}));

export const odeToJoyPiece: Piece = {
  dataName: 'beethoven_ode_to_joy',
  displayName: 'Ode to Joy',
  colorTheme: 'ocean',
  numScreens: NOTE_SEQUENCE.length,
  chords,
};
