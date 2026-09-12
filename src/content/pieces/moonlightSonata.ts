import type { Chord, Piece } from '../../domain/types';

/**
 * Beethoven's "Moonlight Sonata" (Piano Sonata No. 14, Op. 27 No. 2, 1801 —
 * public domain), opening ~16 bars of the 1st movement: the famous C# minor
 * triplet arpeggio over a moving bass line.
 *
 * Pitches and chord groupings below are extracted programmatically from the
 * Mutopia Project's public-domain MIDI transcription
 * (mutopiaproject.org/ftp/BeethovenLv/O27/moonlight/moonlight-mids.zip,
 * track 1 = right hand arpeggio, track 2 = left hand bass) — NOT recalled
 * from memory. Each event pairs the right hand's current arpeggio note with
 * whichever left-hand bass note(s) are sustained at that instant, which is
 * why the chord notes change bar to bar (the bass descends C#-B-A-F#-G#-...)
 * instead of repeating. MIDI numbers use C4 = 60 as middle C.
 */
const RAW_CHORDS: readonly (readonly number[])[] = [
  [37, 49, 56],
  [37, 49, 61],
  [37, 49, 64],
  [37, 49, 56],
  [37, 49, 61],
  [37, 49, 64],
  [37, 49, 56],
  [37, 49, 61],
  [37, 49, 64],
  [37, 49, 56],
  [37, 49, 61],
  [37, 49, 64],
  [35, 47, 56],
  [35, 47, 61],
  [35, 47, 64],
  [35, 47, 56],
  [35, 47, 61],
  [35, 47, 64],
  [35, 47, 56],
  [35, 47, 61],
  [35, 47, 64],
  [35, 47, 56],
  [35, 47, 61],
  [35, 47, 64],
  [33, 45, 57],
  [33, 45, 61],
  [33, 45, 64],
  [33, 45, 57],
  [33, 45, 61],
  [33, 45, 64],
  [30, 42, 57],
  [30, 42, 62],
  [30, 42, 66],
  [30, 42, 57],
  [30, 42, 62],
  [30, 42, 66],
  [32, 44, 56],
  [32, 44, 60],
  [32, 44, 66],
  [32, 44, 56],
  [32, 44, 61],
  [32, 44, 64],
  [32, 44, 56],
  [32, 44, 61],
  [32, 44, 63],
  [32, 44, 54],
  [32, 44, 60],
  [32, 44, 63],
  [37, 44, 49, 52],
];

/** Pianissimo, per the score's dynamic marking. */
const VELOCITY = 50;

/** A quarter note = 1000ms at the piece's Adagio sostenuto tempo (~60bpm); each event is one triplet eighth = 1000/3ms, rounded. */
const MS_PER_EVENT = 333;

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
