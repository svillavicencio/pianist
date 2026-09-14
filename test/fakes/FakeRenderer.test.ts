import { describe, expect, it } from 'vitest';
import { FakeRenderer } from './FakeRenderer';

describe('FakeRenderer', () => {
  it('records each spawned note visual in order', () => {
    const renderer = new FakeRenderer();
    renderer.spawnNoteVisual(60, 'parliament');
    renderer.spawnNoteVisual(64, 'parliament');

    expect(renderer.spawnedVisuals).toEqual([
      { midi: 60, colorTheme: 'parliament' },
      { midi: 64, colorTheme: 'parliament' },
    ]);
  });

  it('accumulates ticked time across calls', () => {
    const renderer = new FakeRenderer();
    renderer.tick(16);
    renderer.tick(16);

    expect(renderer.totalTickedMs).toBe(32);
  });

  it('remembers the most recent resize', () => {
    const renderer = new FakeRenderer();
    renderer.resize(800, 600);
    renderer.resize(1024, 768);

    expect(renderer.lastResize).toEqual({ width: 1024, height: 768 });
  });

  it('remembers the most recent upcoming-chords preview', () => {
    const renderer = new FakeRenderer();
    renderer.showUpcoming([{ distanceMs: 0, midis: [60] }], 'parliament', false);
    renderer.showUpcoming([{ distanceMs: 500, midis: [64, 67] }], 'parliament', true);

    expect(renderer.lastUpcoming).toEqual([{ distanceMs: 500, midis: [64, 67] }]);
    expect(renderer.lastUpcomingContinuedFromPreviousTap).toBe(true);
  });
});
