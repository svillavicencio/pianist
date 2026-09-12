import { describe, expect, it } from 'vitest';
import { PieceEngine } from './PieceEngine';
import type { Piece } from './types';

function makePiece(): Piece {
  return {
    dataName: 'test-piece',
    displayName: 'Test Piece',
    colorTheme: 'parliament',
    numScreens: 1,
    chords: [
      { originalTimeMs: 0, screenDurationMs: 100, notes: [{ midi: 60, velocity: 40 }] },
      {
        originalTimeMs: 100,
        screenDurationMs: 100,
        notes: [
          { midi: 62, velocity: 40 },
          { midi: 65, velocity: 40 },
        ],
      },
      { originalTimeMs: 200, screenDurationMs: 100, notes: [{ midi: 67, velocity: 40 }] },
    ],
  };
}

describe('PieceEngine', () => {
  it('starts at chord index 0, not finished', () => {
    const engine = new PieceEngine(makePiece());
    expect(engine.currentChordIndex).toBe(0);
    expect(engine.isFinished()).toBe(false);
  });

  it('trigger() advances through chords in order, returning each chord notes', () => {
    const engine = new PieceEngine(makePiece());

    expect(engine.trigger()).toEqual([{ midi: 60, velocity: 40 }]);
    expect(engine.currentChordIndex).toBe(1);

    expect(engine.trigger()).toEqual([
      { midi: 62, velocity: 40 },
      { midi: 65, velocity: 40 },
    ]);
    expect(engine.currentChordIndex).toBe(2);

    expect(engine.trigger()).toEqual([{ midi: 67, velocity: 40 }]);
    expect(engine.currentChordIndex).toBe(3);
  });

  it('is finished once every chord has been triggered', () => {
    const engine = new PieceEngine(makePiece());
    engine.trigger();
    engine.trigger();
    engine.trigger();
    expect(engine.isFinished()).toBe(true);
  });

  it('trigger() after the last chord keeps returning [] and stays finished', () => {
    const engine = new PieceEngine(makePiece());
    engine.trigger();
    engine.trigger();
    engine.trigger();

    expect(engine.trigger()).toEqual([]);
    expect(engine.isFinished()).toBe(true);
    expect(engine.currentChordIndex).toBe(3);

    expect(engine.trigger()).toEqual([]);
    expect(engine.isFinished()).toBe(true);
  });

  it('reset() moves the cursor back to the start', () => {
    const engine = new PieceEngine(makePiece());
    engine.trigger();
    engine.trigger();
    engine.reset();

    expect(engine.currentChordIndex).toBe(0);
    expect(engine.isFinished()).toBe(false);
    expect(engine.trigger()).toEqual([{ midi: 60, velocity: 40 }]);
  });

  it('seekTo() jumps the cursor to an arbitrary valid index', () => {
    const engine = new PieceEngine(makePiece());
    engine.seekTo(2);

    expect(engine.currentChordIndex).toBe(2);
    expect(engine.trigger()).toEqual([{ midi: 67, velocity: 40 }]);
    expect(engine.isFinished()).toBe(true);
  });

  it('seekTo() clamps a negative index to 0', () => {
    const engine = new PieceEngine(makePiece());
    engine.seekTo(1);
    engine.seekTo(-5);
    expect(engine.currentChordIndex).toBe(0);
  });

  it('seekTo() clamps an index beyond the end to chords.length', () => {
    const engine = new PieceEngine(makePiece());
    engine.seekTo(999);
    expect(engine.currentChordIndex).toBe(3);
    expect(engine.isFinished()).toBe(true);
  });

  it('handles an empty piece without throwing', () => {
    const engine = new PieceEngine({ ...makePiece(), chords: [] });
    expect(engine.isFinished()).toBe(true);
    expect(engine.trigger()).toEqual([]);
    expect(engine.currentChordIndex).toBe(0);
  });
});
