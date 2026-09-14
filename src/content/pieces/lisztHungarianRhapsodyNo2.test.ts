import { describe, expect, it } from "vitest";
import type { Chord, NoteEvent } from "../../domain/types";
import { lisztHungarianRhapsodyNo2Piece } from "./lisztHungarianRhapsodyNo2";

describe("lisztHungarianRhapsodyNo2Piece", () => {
  it("contains the complete verified performance", () => {
    expect(lisztHungarianRhapsodyNo2Piece.dataName).toBe(
      "liszt_hungarian_rhapsody_no2",
    );
    expect(lisztHungarianRhapsodyNo2Piece.displayName).toBe(
      "Hungarian Rhapsody No. 2",
    );
    expect(lisztHungarianRhapsodyNo2Piece.chords).toHaveLength(3261);
    expect(lisztHungarianRhapsodyNo2Piece.numScreens).toBe(3261);
  });

  it("preserves the verified opening and final attacks", () => {
    const first = lisztHungarianRhapsodyNo2Piece.chords[0]!;
    const finalChord = lisztHungarianRhapsodyNo2Piece.chords.at(-1)!;
    expect([
      first.originalTimeMs,
      first.notes.map((n: NoteEvent) => [n.midi, n.velocity]),
    ]).toEqual([1134, [[61, 77]]]);
    expect([
      finalChord.originalTimeMs,
      finalChord.notes.map((n: NoteEvent) => [n.midi, n.velocity]),
    ]).toEqual([
      525750,
      [
        [30, 74],
        [42, 88],
        [54, 91],
        [66, 107],
      ],
    ]);
    expect(finalChord.screenDurationMs).toBe(0);
  });

  it("pins the verified source profile and chronological timing", () => {
    const notes = lisztHungarianRhapsodyNo2Piece.chords.flatMap(
      (chord: Chord) => chord.notes,
    );
    expect(notes).toHaveLength(6760);
    expect(new Set(notes.map((note: NoteEvent) => note.velocity)).size).toBe(
      84,
    );
    expect(
      Math.max(
        ...lisztHungarianRhapsodyNo2Piece.chords.map(
          (c: Chord) => c.notes.length,
        ),
      ),
    ).toBe(8);
    for (
      let index = 0;
      index < lisztHungarianRhapsodyNo2Piece.chords.length;
      index++
    ) {
      const chord = lisztHungarianRhapsodyNo2Piece.chords[index]!;
      const next = lisztHungarianRhapsodyNo2Piece.chords[index + 1];
      expect(chord.screenDurationMs).toBe(
        next ? next.originalTimeMs - chord.originalTimeMs : 0,
      );
      expect(chord.screenDurationMs).toBeGreaterThanOrEqual(0);
      if (next) expect(chord.screenDurationMs).toBeGreaterThan(0);
    }
  });

  it("never contains duplicate MIDI notes within an attack", () => {
    for (const chord of lisztHungarianRhapsodyNo2Piece.chords) {
      const midis = chord.notes.map((note: NoteEvent) => note.midi);
      expect(new Set(midis).size).toBe(midis.length);
    }
  });
});
