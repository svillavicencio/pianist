import { describe, expect, it } from 'vitest';
import { moonlightSonataPiece } from './moonlightSonata';

describe('moonlightSonataPiece', () => {
  it('has exactly 49 chords, extracted from the real MIDI transcription', () => {
    expect(moonlightSonataPiece.chords).toHaveLength(49);
    expect(moonlightSonataPiece.numScreens).toBe(49);
  });

  it('opens with the C# minor bass (C#2, C#3) under the arpeggio\'s first note (G#3)', () => {
    const opening = moonlightSonataPiece.chords[0]!;
    expect(opening.notes.map((n) => n.midi)).toEqual([37, 49, 56]);
  });

  it('moves the bass down to B (B1, B2) at the start of bar 2, not repeating bar 1\'s bass', () => {
    const bar2Start = moonlightSonataPiece.chords[12]!;
    expect(bar2Start.notes.map((n) => n.midi)).toEqual([35, 47, 56]);
  });

  it('keeps descending through A and F# basses in later bars', () => {
    const barWithABass = moonlightSonataPiece.chords[24]!;
    expect(barWithABass.notes.map((n) => n.midi)).toEqual([33, 45, 57]);

    const barWithFSharpBass = moonlightSonataPiece.chords[30]!;
    expect(barWithFSharpBass.notes.map((n) => n.midi)).toEqual([30, 42, 57]);
  });

  it('ends on a 4-note cadence chord (C#2, G#2, C#3, E3)', () => {
    const finalChord = moonlightSonataPiece.chords.at(-1)!;
    expect(finalChord.notes.map((n) => n.midi)).toEqual([37, 44, 49, 52]);
  });

  it('increments originalTimeMs by 333ms per event, starting at 0, all at pianissimo velocity', () => {
    moonlightSonataPiece.chords.forEach((chord, index) => {
      expect(chord.originalTimeMs).toBe(333 * index);
      expect(chord.screenDurationMs).toBe(333);
      for (const note of chord.notes) {
        expect(note.velocity).toBe(50);
      }
    });
  });
});
