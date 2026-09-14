import { describe, expect, it } from "vitest";
import { beethovenMoonlightSonataMov3Piece } from "./beethovenMoonlightSonataMov3";

describe("beethovenMoonlightSonataMov3Piece", () => {
  it("has the complete verified performance mapping", () => {
    expect(beethovenMoonlightSonataMov3Piece.chords).toHaveLength(3781);
    expect(beethovenMoonlightSonataMov3Piece.numScreens).toBe(3781);
  });

  it("preserves the verified opening attack", () => {
    const opening = beethovenMoonlightSonataMov3Piece.chords[0]!;
    expect(opening.originalTimeMs).toBe(1);
    expect(opening.notes.map((note) => [note.midi, note.velocity])).toEqual([
      [37, 42],
    ]);
    expect(opening.screenDurationMs).toBeGreaterThan(0);
  });

  it("preserves the verified final attack", () => {
    const finalChord = beethovenMoonlightSonataMov3Piece.chords.at(-1)!;
    expect(finalChord.originalTimeMs).toBe(410021);
    expect(finalChord.screenDurationMs).toBe(0);
    expect(finalChord.notes.map((note) => [note.midi, note.velocity])).toEqual([
      [37, 67],
      [40, 67],
      [44, 79],
      [49, 79],
      [61, 83],
      [64, 83],
      [68, 97],
      [73, 97],
    ]);
  });

  it("preserves velocity diversity and maximum simultaneity", () => {
    const velocities = new Set(
      beethovenMoonlightSonataMov3Piece.chords.flatMap((chord) =>
        chord.notes.map((note) => note.velocity),
      ),
    );
    expect(velocities.size).toBe(86);
    expect(
      Math.max(
        ...beethovenMoonlightSonataMov3Piece.chords.map(
          (chord) => chord.notes.length,
        ),
      ),
    ).toBe(8);
  });

  it("has chronological attacks with no duplicate pitch in an attack", () => {
    for (
      let index = 0;
      index < beethovenMoonlightSonataMov3Piece.chords.length;
      index++
    ) {
      const chord = beethovenMoonlightSonataMov3Piece.chords[index]!;
      const next = beethovenMoonlightSonataMov3Piece.chords[index + 1];
      expect(new Set(chord.notes.map((note) => note.midi)).size).toBe(
        chord.notes.length,
      );
      if (next) expect(chord.screenDurationMs).toBeGreaterThan(0);
      if (next)
        expect(next.originalTimeMs).toBeGreaterThan(chord.originalTimeMs);
    }
  });
});
