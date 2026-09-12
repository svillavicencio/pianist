import type { Chord, Piece } from '../../domain/types';

/**
 * Beethoven's "Moonlight Sonata" (Piano Sonata No. 14, Op. 27 No. 2, 1801 —
 * public domain), opening bars of the 1st movement: the famous C# minor
 * triplet arpeggio (G#3-C#4-E4) over a sustained low C#2 bass. Simplified to
 * one triplet per "bar" (the real piece has four) so a short piece still
 * meaningfully exercises simultaneous notes — this is our own simplified
 * arrangement of the public-domain composition (pitches verified against
 * touchpianist.com's own tutorial data, but re-grouped/re-timed ourselves
 * rather than copied). MIDI numbers use C4 = 60 as middle C.
 */
const BASS = 37; // C#2
const BASS_OCTAVE = 49; // C#3
const FIFTH = 56; // G#3
const ARPEGGIO_2 = 61; // C#4
const ARPEGGIO_3 = 64; // E4

/** Pianissimo, per the score's dynamic marking. */
const VELOCITY = 50;

const OPENING_BAR: readonly (readonly number[])[] = [[BASS, BASS_OCTAVE, FIFTH], [ARPEGGIO_2], [ARPEGGIO_3]];
const BAR: readonly (readonly number[])[] = [[BASS, FIFTH], [ARPEGGIO_2], [ARPEGGIO_3]];
const FINAL_CHORD: readonly number[] = [BASS, BASS_OCTAVE, FIFTH, ARPEGGIO_2];

const RAW_CHORDS: readonly (readonly number[])[] = [
  ...OPENING_BAR,
  ...Array.from({ length: 7 }, () => BAR).flat(),
  FINAL_CHORD,
];

const MS_PER_EVENT = 500;

const chords: readonly Chord[] = RAW_CHORDS.map((notes, index) => ({
  originalTimeMs: MS_PER_EVENT * index,
  screenDurationMs: MS_PER_EVENT,
  notes: notes.map((midi) => ({ midi, velocity: VELOCITY })),
}));

export const moonlightSonataPiece: Piece = {
  dataName: 'beethoven_moonlight_sonata',
  displayName: 'Moonlight Sonata (Opening)',
  colorTheme: 'parliament',
  numScreens: chords.length,
  chords,
};
