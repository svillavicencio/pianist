import { describe, expect, it } from 'vitest';
import { parsePieceData } from './parsePieceData';

describe('parsePieceData', () => {
  it('returns an empty array for empty input', () => {
    expect(parsePieceData([])).toEqual([]);
  });

  it('parses a single note into a single one-note chord', () => {
    const chords = parsePieceData([0, 1930, 61, 26]);
    expect(chords).toEqual([
      { originalTimeMs: 0, screenDurationMs: 1930, notes: [{ midi: 61, velocity: 26 }] },
    ]);
  });

  it('groups consecutive tuples sharing the same originalTimeMs into one chord', () => {
    const chords = parsePieceData([0, 1930, 37, 35, 0, 1930, 49, 35, 0, 1930, 56, 33]);
    expect(chords).toEqual([
      {
        originalTimeMs: 0,
        screenDurationMs: 1930,
        notes: [
          { midi: 37, velocity: 35 },
          { midi: 49, velocity: 35 },
          { midi: 56, velocity: 33 },
        ],
      },
    ]);
  });

  it('parses a chord followed by separate single-note chords, per the reverse-engineered example', () => {
    const chords = parsePieceData([
      0, 1930, 37, 35, 0, 1930, 49, 35, 0, 1930, 56, 33, 160, 1930, 61, 26, 320, 1930, 64, 26,
    ]);

    expect(chords).toEqual([
      {
        originalTimeMs: 0,
        screenDurationMs: 1930,
        notes: [
          { midi: 37, velocity: 35 },
          { midi: 49, velocity: 35 },
          { midi: 56, velocity: 33 },
        ],
      },
      { originalTimeMs: 160, screenDurationMs: 1930, notes: [{ midi: 61, velocity: 26 }] },
      { originalTimeMs: 320, screenDurationMs: 1930, notes: [{ midi: 64, velocity: 26 }] },
    ]);
  });

  it('throws a clear error when the flat array length is not a multiple of 4', () => {
    expect(() => parsePieceData([0, 1930, 61])).toThrow(/multiple of 4/);
  });
});
