import { describe, expect, it } from 'vitest';
import { lisztLaCampanellaPiece } from './lisztLaCampanella';

describe('lisztLaCampanellaPiece', () => {
  it('has the complete piece: 2329 chords extracted from the real MIDI performance', () => {
    expect(lisztLaCampanellaPiece.chords).toHaveLength(2329);
    expect(lisztLaCampanellaPiece.numScreens).toBe(2329);
  });

  it('opens with the repeated-note bell figure: a two-note dyad struck three times', () => {
    const first = lisztLaCampanellaPiece.chords[0]!;
    const second = lisztLaCampanellaPiece.chords[1]!;
    const third = lisztLaCampanellaPiece.chords[2]!;
    expect(first.notes.map((n) => n.midi)).toEqual([63, 75]);
    expect(first.notes.map((n) => n.velocity)).toEqual([24, 28]);
    expect(second.notes.map((n) => n.midi)).toEqual([63, 75]);
    expect(second.notes.map((n) => n.velocity)).toEqual([24, 28]);
    expect(third.notes.map((n) => n.midi)).toEqual([63, 75]);
    expect(third.notes.map((n) => n.velocity)).toEqual([24, 28]);
  });

  it('leaps up to a higher dyad on the fourth chord', () => {
    const fourth = lisztLaCampanellaPiece.chords[3]!;
    expect(fourth.notes.map((n) => n.midi)).toEqual([87, 99]);
    expect(fourth.notes.map((n) => n.velocity)).toEqual([28, 34]);
  });

  it('ends on the final chord of the piece', () => {
    const finalChord = lisztLaCampanellaPiece.chords.at(-1)!;
    expect(finalChord.notes.map((n) => n.midi)).toEqual([59, 63, 68, 71, 80, 83, 87, 92]);
    expect(finalChord.notes.map((n) => n.velocity)).toEqual([83, 83, 83, 99, 83, 83, 99, 104]);
  });

  it('uses the real, tempo-map-aware MIDI timing for originalTimeMs', () => {
    expect(lisztLaCampanellaPiece.chords[0]!.originalTimeMs).toBe(375);
    expect(lisztLaCampanellaPiece.chords[1]!.originalTimeMs).toBe(750);
    expect(lisztLaCampanellaPiece.chords[2]!.originalTimeMs).toBe(1125);
    expect(lisztLaCampanellaPiece.chords.at(-1)!.originalTimeMs).toBe(246289);
  });

  it('sets screenDurationMs to the real gap until the next event, and 0 for the last event', () => {
    expect(lisztLaCampanellaPiece.chords[0]!.screenDurationMs).toBe(375);
    expect(lisztLaCampanellaPiece.chords.at(-1)!.screenDurationMs).toBe(0);
  });

  it('preserves the real, varying MIDI velocities instead of a flat constant', () => {
    const velocities = new Set(
      lisztLaCampanellaPiece.chords.flatMap((chord) => chord.notes.map((n) => n.velocity)),
    );
    expect(velocities.size).toBeGreaterThan(10);
  });

  it('reaches the densest simultaneous chord of the piece (8 notes, no duplicate pitches to dedupe)', () => {
    const maxSize = Math.max(...lisztLaCampanellaPiece.chords.map((chord) => chord.notes.length));
    expect(maxSize).toBe(8);
  });

  it('is dominated by single-note chords, unlike the denser chordal Rachmaninoff/Moonlight pieces', () => {
    const singleNoteCount = lisztLaCampanellaPiece.chords.filter(
      (chord) => chord.notes.length === 1,
    ).length;
    expect(singleNoteCount).toBe(1446);
    expect(singleNoteCount / lisztLaCampanellaPiece.chords.length).toBeGreaterThan(0.5);
  });

  it('never contains a duplicate MIDI note within the same chord', () => {
    for (const chord of lisztLaCampanellaPiece.chords) {
      const midis = chord.notes.map((n) => n.midi);
      expect(new Set(midis).size).toBe(midis.length);
    }
  });
});
