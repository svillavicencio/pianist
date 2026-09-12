import { describe, expect, it } from 'vitest';
import { beethovenPathetiqueMov1Piece } from './beethovenPathetiqueMov1';

describe('beethovenPathetiqueMov1Piece', () => {
  it('has the complete piece: 3075 chords extracted from the real MIDI performance', () => {
    expect(beethovenPathetiqueMov1Piece.chords).toHaveLength(3075);
    expect(beethovenPathetiqueMov1Piece.numScreens).toBe(3075);
  });

  it('opens with the famous dense Grave chord (both hands struck together)', () => {
    const first = beethovenPathetiqueMov1Piece.chords[0]!;
    expect(first.notes.map((n) => n.midi)).toEqual([36, 39, 43, 48, 51, 55, 60]);
    expect(first.notes.map((n) => n.velocity)).toEqual([70, 70, 70, 81, 79, 79, 93]);
    expect(first.originalTimeMs).toBe(0);
  });

  it('moves to the second and third Grave chords', () => {
    const second = beethovenPathetiqueMov1Piece.chords[1]!;
    const third = beethovenPathetiqueMov1Piece.chords[2]!;
    expect(second.notes.map((n) => n.midi)).toEqual([51, 55, 60]);
    expect(second.notes.map((n) => n.velocity)).toEqual([36, 40, 47]);
    expect(third.notes.map((n) => n.midi)).toEqual([50, 55, 59, 62]);
    expect(third.notes.map((n) => n.velocity)).toEqual([41, 42, 42, 50]);
  });

  it('ends on the final chord of the piece', () => {
    const finalChord = beethovenPathetiqueMov1Piece.chords.at(-1)!;
    expect(finalChord.notes.map((n) => n.midi)).toEqual([36, 39, 43, 48, 51, 55, 60]);
    expect(finalChord.notes.map((n) => n.velocity)).toEqual([74, 74, 74, 89, 86, 103, 103]);
  });

  it('uses the real, tempo-map-aware MIDI timing for originalTimeMs', () => {
    expect(beethovenPathetiqueMov1Piece.chords[0]!.originalTimeMs).toBe(0);
    expect(beethovenPathetiqueMov1Piece.chords[1]!.originalTimeMs).toBe(4125);
    expect(beethovenPathetiqueMov1Piece.chords[2]!.originalTimeMs).toBe(4500);
    expect(beethovenPathetiqueMov1Piece.chords.at(-1)!.originalTimeMs).toBe(558630);
  });

  it('sets screenDurationMs to the real gap until the next event, and 0 for the last event', () => {
    expect(beethovenPathetiqueMov1Piece.chords[0]!.screenDurationMs).toBe(4125);
    expect(beethovenPathetiqueMov1Piece.chords.at(-1)!.screenDurationMs).toBe(0);
  });

  it('preserves the real, varying MIDI velocities instead of a flat constant', () => {
    const velocities = new Set(
      beethovenPathetiqueMov1Piece.chords.flatMap((chord) => chord.notes.map((n) => n.velocity)),
    );
    expect(velocities.size).toBe(82);
  });

  it('reaches the densest simultaneous chord of the piece (8 notes, both hands stacked)', () => {
    const maxSize = Math.max(
      ...beethovenPathetiqueMov1Piece.chords.map((chord) => chord.notes.length),
    );
    expect(maxSize).toBe(8);
    const denseChords = beethovenPathetiqueMov1Piece.chords.filter(
      (chord) => chord.notes.length === maxSize,
    );
    expect(denseChords).toHaveLength(5);
  });

  it('spans both the slow Grave introduction (dense chords) and the fast Allegro (sparser groupings)', () => {
    const singleNoteCount = beethovenPathetiqueMov1Piece.chords.filter(
      (chord) => chord.notes.length === 1,
    ).length;
    expect(singleNoteCount).toBe(1383);
  });

  it('never contains a duplicate MIDI note within the same chord', () => {
    for (const chord of beethovenPathetiqueMov1Piece.chords) {
      const midis = chord.notes.map((n) => n.midi);
      expect(new Set(midis).size).toBe(midis.length);
    }
  });
});
