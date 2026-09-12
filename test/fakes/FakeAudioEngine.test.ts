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

  it('records each noteOff call in order', () => {
    const engine = new FakeAudioEngine();
    engine.noteOff(60);
    engine.noteOff(64);

    expect(engine.notesOff).toEqual([60, 64]);
  });

  it('marks itself initialized after init() resolves', async () => {
    const engine = new FakeAudioEngine();
    expect(engine.initCalled).toBe(false);

    await engine.init();
    expect(engine.initCalled).toBe(true);
  });
});
