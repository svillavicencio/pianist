import { describe, expect, it } from "vitest";
import { debussyClairDeLunePiece } from "./debussyClairDeLune";

describe("debussyClairDeLunePiece", () => {
  it("has the complete verified performance mapping", () => {
    expect(debussyClairDeLunePiece.chords).toHaveLength(815);
    expect(debussyClairDeLunePiece.numScreens).toBe(815);
  });

  it("opens with the tempo-mapped opening dyad", () => {
    const first = debussyClairDeLunePiece.chords[0]!;
    const second = debussyClairDeLunePiece.chords[1]!;
    expect(first.originalTimeMs).toBe(300);
    expect(first.screenDurationMs).toBeGreaterThan(0);
    expect(first.notes.map((note) => [note.midi, note.velocity])).toEqual([
      [65, 36],
      [68, 43],
    ]);
    expect(second.originalTimeMs).toBeGreaterThan(first.originalTimeMs);
  });

  it("pins the verified final attack", () => {
    const finalChord = debussyClairDeLunePiece.chords.at(-1)!;
    expect(finalChord.originalTimeMs).toBe(244040);
    expect(finalChord.screenDurationMs).toBe(0);
    expect(finalChord.notes.map((note) => [note.midi, note.velocity])).toEqual([
      [92, 34],
    ]);
  });

  it("preserves the source MIDI velocity profile and maximum simultaneity", () => {
    const velocities = new Set(
      debussyClairDeLunePiece.chords.flatMap((chord) =>
        chord.notes.map((note) => note.velocity),
      ),
    );
    expect(velocities.size).toBe(58);
    expect(
      Math.max(
        ...debussyClairDeLunePiece.chords.map((chord) => chord.notes.length),
      ),
    ).toBe(7);
  });

  it("never contains duplicate MIDI pitches within a chord", () => {
    for (const chord of debussyClairDeLunePiece.chords) {
      const midis = chord.notes.map((note) => note.midi);
      expect(new Set(midis).size).toBe(midis.length);
    }
  });
});
