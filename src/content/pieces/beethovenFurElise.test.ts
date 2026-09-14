import { describe, expect, it } from "vitest";
import type { Chord } from "../../domain/types";
import { beethovenFurElisePiece } from "./beethovenFurElise";

describe("beethovenFurElisePiece", () => {
  it("has the complete verified performance mapping", () => {
    expect(beethovenFurElisePiece.chords).toHaveLength(785);
    expect(beethovenFurElisePiece.numScreens).toBe(785);
  });

  it("preserves the verified opening attack", () => {
    const opening = beethovenFurElisePiece.chords[0]!;
    expect(opening.originalTimeMs).toBe(867);
    expect(
      opening.notes.map((note: Chord["notes"][number]) => [
        note.midi,
        note.velocity,
      ]),
    ).toEqual([[76, 36]]);
    expect(opening.screenDurationMs).toBeGreaterThan(0);
  });

  it("preserves the verified final attack", () => {
    const finalChord = beethovenFurElisePiece.chords.at(-1)!;
    expect(finalChord.originalTimeMs).toBe(164981);
    expect(finalChord.screenDurationMs).toBe(0);
    expect(
      finalChord.notes.map((note: Chord["notes"][number]) => [
        note.midi,
        note.velocity,
      ]),
    ).toEqual([
      [33, 17],
      [45, 25],
      [69, 36],
    ]);
  });

  it("preserves velocity diversity and maximum simultaneity", () => {
    const velocities = new Set(
      beethovenFurElisePiece.chords.flatMap((chord: Chord) =>
        chord.notes.map((note: Chord["notes"][number]) => note.velocity),
      ),
    );
    expect(velocities.size).toBe(52);
    expect(
      Math.max(
        ...beethovenFurElisePiece.chords.map(
          (chord: Chord) => chord.notes.length,
        ),
      ),
    ).toBe(6);
  });

  it("has chronological attacks with no duplicate pitch in an attack", () => {
    for (let index = 0; index < beethovenFurElisePiece.chords.length; index++) {
      const chord = beethovenFurElisePiece.chords[index]!;
      const next = beethovenFurElisePiece.chords[index + 1];
      expect(
        new Set(chord.notes.map((note: Chord["notes"][number]) => note.midi))
          .size,
      ).toBe(chord.notes.length);
      if (next) expect(chord.screenDurationMs).toBeGreaterThan(0);
      if (next)
        expect(next.originalTimeMs).toBeGreaterThan(chord.originalTimeMs);
    }
  });
});
