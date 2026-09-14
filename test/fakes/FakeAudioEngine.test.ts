import { describe, expect, it } from 'vitest';
import { FakeAudioEngine } from './FakeAudioEngine';

describe('FakeAudioEngine', () => {
  it('records each noteOn call in order', () => {
    const engine = new FakeAudioEngine();
    engine.noteOn(60, 100);
    engine.noteOn(64, 90);

    expect(engine.notesOn).toEqual([
      { midi: 60, velocity: 100 },
      { midi: 64, velocity: 90 },
    ]);
  });

  it('records a noteOff when the returned handle is released', () => {
    const engine = new FakeAudioEngine();
    const handle = engine.noteOn(60, 100);

    expect(engine.notesOff).toEqual([]);
    handle.release();
    expect(engine.notesOff).toEqual([60]);
  });

  it('records releases independently per handle', () => {
    const engine = new FakeAudioEngine();
    const a = engine.noteOn(60, 100);
    const b = engine.noteOn(64, 90);

    b.release();
    a.release();
    expect(engine.notesOff).toEqual([64, 60]);
  });

  it('marks itself initialized after init() resolves', async () => {
    const engine = new FakeAudioEngine();
    expect(engine.initCalled).toBe(false);

    await engine.init();
    expect(engine.initCalled).toBe(true);
  });
});
