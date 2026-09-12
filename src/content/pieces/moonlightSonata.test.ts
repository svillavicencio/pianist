import { describe, expect, it } from 'vitest';
import { moonlightSonataPiece } from './moonlightSonata';

describe('moonlightSonataPiece', () => {
  it('has the complete movement: 821 chords extracted from the real MIDI transcription', () => {
    expect(moonlightSonataPiece.chords).toHaveLength(821);
    expect(moonlightSonataPiece.numScreens).toBe(821);
  });

  it('opens with the C# minor bass (C#2, C#3) under the arpeggio\'s first note (G#3)', () => {
    const opening = moonlightSonataPiece.chords[0]!;
    expect(opening.notes.map((n) => n.midi)).toEqual([37, 49, 56]);
  });

  it('does NOT repeat the sustained bass on the following single-note taps', () => {
    const second = moonlightSonataPiece.chords[1]!;
    const third = moonlightSonataPiece.chords[2]!;
    expect(second.notes.map((n) => n.midi)).toEqual([61]);
    expect(third.notes.map((n) => n.midi)).toEqual([64]);
  });

  it('re-strikes only when the bass actually changes, at the start of bar 2 (B1, B2)', () => {
    const bar2Start = moonlightSonataPiece.chords[12]!;
    expect(bar2Start.notes.map((n) => n.midi)).toEqual([35, 47, 56]);
  });

  it('ends on the final 6-note chord of the movement', () => {
    const finalChord = moonlightSonataPiece.chords.at(-1)!;
    expect(finalChord.notes.map((n) => n.midi)).toEqual([37, 44, 49, 52, 56, 61]);
  });

  it('uses the real MIDI timing for originalTimeMs, starting at 0', () => {
    expect(moonlightSonataPiece.chords[0]!.originalTimeMs).toBe(0);
    expect(moonlightSonataPiece.chords[1]!.originalTimeMs).toBe(333);
    expect(moonlightSonataPiece.chords.at(-1)!.originalTimeMs).toBe(272000);
  });

  it('sets screenDurationMs to the real gap until the next event, and 0 for the last event', () => {
    expect(moonlightSonataPiece.chords[0]!.screenDurationMs).toBe(333);
    expect(moonlightSonataPiece.chords.at(-1)!.screenDurationMs).toBe(0);
  });

  it('plays every note at pianissimo velocity', () => {
    for (const chord of moonlightSonataPiece.chords) {
      for (const note of chord.notes) {
        expect(note.velocity).toBe(50);
      }
    }
  });
});
