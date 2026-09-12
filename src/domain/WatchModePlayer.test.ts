import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../test/fakes/FakeClock';
import { WatchModePlayer } from './WatchModePlayer';
import type { NoteEvent, Piece } from './types';

function makePiece(): Piece {
  return {
    dataName: 'test-piece',
    displayName: 'Test Piece',
    colorTheme: 'parliament',
    numScreens: 1,
    chords: [
      { originalTimeMs: 1000, screenDurationMs: 100, notes: [{ midi: 60, velocity: 40 }] },
      { originalTimeMs: 1160, screenDurationMs: 100, notes: [{ midi: 61, velocity: 26 }] },
      { originalTimeMs: 1320, screenDurationMs: 100, notes: [{ midi: 64, velocity: 26 }] },
    ],
  };
}

describe('WatchModePlayer', () => {
  it('fires the first chord immediately on start()', () => {
    const clock = new FakeClock();
    const received: (readonly NoteEvent[])[] = [];
    const player = new WatchModePlayer(makePiece(), clock, (notes) => received.push(notes));

    player.start();

    expect(received).toEqual([[{ midi: 60, velocity: 40 }]]);
  });

  it('fires subsequent chords after the delta between originalTimeMs values', () => {
    const clock = new FakeClock();
    const received: (readonly NoteEvent[])[] = [];
    const player = new WatchModePlayer(makePiece(), clock, (notes) => received.push(notes));

    player.start();
    expect(received).toHaveLength(1);

    clock.advance(159);
    expect(received).toHaveLength(1);

    clock.advance(1);
    expect(received).toHaveLength(2);
    expect(received[1]).toEqual([{ midi: 61, velocity: 26 }]);

    clock.advance(160);
    expect(received).toHaveLength(3);
    expect(received[2]).toEqual([{ midi: 64, velocity: 26 }]);
  });

  it('stop() cancels pending chords so they never fire', () => {
    const clock = new FakeClock();
    const received: (readonly NoteEvent[])[] = [];
    const player = new WatchModePlayer(makePiece(), clock, (notes) => received.push(notes));

    player.start();
    player.stop();
    clock.advance(1000);

    expect(received).toHaveLength(1);
  });

  it('stop() is safe to call with nothing scheduled, or after playback finished', () => {
    const clock = new FakeClock();
    const player = new WatchModePlayer(makePiece(), clock, () => {});

    expect(() => player.stop()).not.toThrow();

    player.start();
    clock.advance(1000);
    expect(() => player.stop()).not.toThrow();
  });

  it('handles a piece with zero chords without throwing', () => {
    const clock = new FakeClock();
    const received: (readonly NoteEvent[])[] = [];
    const piece: Piece = { ...makePiece(), chords: [] };
    const player = new WatchModePlayer(piece, clock, (notes) => received.push(notes));

    expect(() => player.start()).not.toThrow();
    clock.advance(1000);
    expect(received).toEqual([]);
  });

  it('handles a piece with a single chord, firing only that one', () => {
    const clock = new FakeClock();
    const received: (readonly NoteEvent[])[] = [];
    const piece: Piece = { ...makePiece(), chords: [makePiece().chords[0]!] };
    const player = new WatchModePlayer(piece, clock, (notes) => received.push(notes));

    player.start();
    clock.advance(10000);

    expect(received).toEqual([[{ midi: 60, velocity: 40 }]]);
  });
});
