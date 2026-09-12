import { describe, expect, it } from 'vitest';
import { moonlightSonataPiece } from './moonlightSonata';

describe('moonlightSonataPiece', () => {
  it('has exactly 25 chords (8 simplified bars + one final cadence chord)', () => {
    expect(moonlightSonataPiece.chords).toHaveLength(25);
    expect(moonlightSonataPiece.numScreens).toBe(25);
  });

  it('opens with the full 3-note establishing chord (C#2, C#3, G#3)', () => {
    const opening = moonlightSonataPiece.chords[0]!;
    expect(opening.notes.map((n) => n.midi)).toEqual([37, 49, 56]);
  });

  it('plays the triplet arpeggio as single notes after the opening chord', () => {
    const [, second, third] = moonlightSonataPiece.chords;
    expect(second!.notes).toEqual([{ midi: 61, velocity: 50 }]);
    expect(third!.notes).toEqual([{ midi: 64, velocity: 50 }]);
  });

  it('re-strikes a 2-note bass+fifth chord (C#2, G#3) at the start of each later bar', () => {
    const barStart = moonlightSonataPiece.chords[3]!; // first event of bar 2
    expect(barStart.notes.map((n) => n.midi)).toEqual([37, 56]);
  });

  it('ends with a 4-note cadence chord (C#2, C#3, G#3, C#4)', () => {
    const finalChord = moonlightSonataPiece.chords.at(-1)!;
    expect(finalChord.notes.map((n) => n.midi)).toEqual([37, 49, 56, 61]);
  });

  it('increments originalTimeMs by 500ms per event, starting at 0, all at pianissimo velocity', () => {
    moonlightSonataPiece.chords.forEach((chord, index) => {
      expect(chord.originalTimeMs).toBe(500 * index);
      expect(chord.screenDurationMs).toBe(500);
      for (const note of chord.notes) {
        expect(note.velocity).toBe(50);
      }
    });
  });
});
