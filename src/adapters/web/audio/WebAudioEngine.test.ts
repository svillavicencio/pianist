import { describe, expect, it } from 'vitest';
import { WebAudioEngine } from './WebAudioEngine';
import type { MidiNote } from '../../../domain/types';

/**
 * Hand-rolled fakes for the tiny slice of the Web Audio API WebAudioEngine uses.
 * Each fake just records the calls made on it so tests can assert wiring —
 * no real audio graph, no jsdom, no third-party mocking library.
 */
class FakeAudioParam {
  value = 0;
  readonly setValueAtTimeCalls: Array<{ value: number; time: number }> = [];
  readonly linearRampToValueAtTimeCalls: Array<{ value: number; time: number }> = [];
  readonly cancelScheduledValuesCalls: number[] = [];

  setValueAtTime(value: number, time: number): FakeAudioParam {
    this.value = value;
    this.setValueAtTimeCalls.push({ value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): FakeAudioParam {
    this.value = value;
    this.linearRampToValueAtTimeCalls.push({ value, time });
    return this;
  }

  cancelScheduledValues(time: number): FakeAudioParam {
    this.cancelScheduledValuesCalls.push(time);
    return this;
  }
}

class FakeAudioBufferSourceNode {
  buffer: unknown = null;
  readonly playbackRate = new FakeAudioParam();
  readonly connectedTo: unknown[] = [];
  readonly startCalls: Array<number | undefined> = [];
  readonly stopCalls: Array<number | undefined> = [];

  connect(destination: unknown): unknown {
    this.connectedTo.push(destination);
    return destination;
  }

  start(when?: number): void {
    this.startCalls.push(when);
  }

  stop(when?: number): void {
    this.stopCalls.push(when);
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam();
  readonly connectedTo: unknown[] = [];

  connect(destination: unknown): unknown {
    this.connectedTo.push(destination);
    return destination;
  }
}

class FakeAudioContext {
  currentTime = 0;
  readonly destination = { marker: 'destination' };
  readonly createdSources: FakeAudioBufferSourceNode[] = [];
  readonly createdGains: FakeGainNode[] = [];

  createBufferSource(): FakeAudioBufferSourceNode {
    const source = new FakeAudioBufferSourceNode();
    this.createdSources.push(source);
    return source;
  }

  createGain(): FakeGainNode {
    const gainNode = new FakeGainNode();
    this.createdGains.push(gainNode);
    return gainNode;
  }
}

/** Builds a WebAudioEngine wired to a fresh FakeAudioContext, casting past the real Web Audio types. */
function buildEngine(sampleMidis: readonly MidiNote[]) {
  const context = new FakeAudioContext();
  const samples = new Map(sampleMidis.map((midi) => [midi, { id: midi } as unknown as AudioBuffer]));
  const engine = new WebAudioEngine(context as unknown as BaseAudioContext, samples);
  return { context, samples, engine };
}

describe('WebAudioEngine.init', () => {
  it('resolves once samples are already populated', async () => {
    const { engine } = buildEngine([60]);
    await expect(engine.init()).resolves.toBeUndefined();
  });

  it('rejects when no samples were provided', async () => {
    const { engine } = buildEngine([]);
    await expect(engine.init()).rejects.toThrow();
  });
});

describe('WebAudioEngine.noteOn', () => {
  it('wires bufferSource -> gainNode -> destination and starts playback', () => {
    const { context, samples, engine } = buildEngine([60]);

    engine.noteOn(60, 127);

    const source = context.createdSources[0]!;
    const gainNode = context.createdGains[0]!;

    expect(source.buffer).toBe(samples.get(60));
    expect(source.connectedTo).toEqual([gainNode]);
    expect(gainNode.connectedTo).toEqual([context.destination]);
    expect(source.startCalls).toEqual([undefined]);
  });

  it('sets playbackRate for the nearest available sample, not the exact target', () => {
    const { context, engine } = buildEngine([60]);

    engine.noteOn(72, 100); // an octave above the only sample

    const source = context.createdSources[0]!;
    expect(source.playbackRate.value).toBe(2);
  });

  it('sets gain from velocity', () => {
    const { context, engine } = buildEngine([60]);

    engine.noteOn(60, 0);
    expect(context.createdGains[0]!.gain.value).toBe(0);

    engine.noteOn(60, 127);
    expect(context.createdGains[1]!.gain.value).toBe(1);
  });

  it('retriggers an already-sounding note by stopping the previous source first', () => {
    const { context, engine } = buildEngine([60]);

    engine.noteOn(60, 100);
    const firstSource = context.createdSources[0]!;
    expect(firstSource.stopCalls).toEqual([]);

    engine.noteOn(60, 100);
    expect(firstSource.stopCalls).toHaveLength(1);
    expect(context.createdSources).toHaveLength(2);
  });
});

describe('WebAudioEngine handle.release()', () => {
  it('ramps gain down and stops the tracked source', () => {
    const { context, engine } = buildEngine([60]);
    context.currentTime = 5;

    const handle = engine.noteOn(60, 100);
    const source = context.createdSources[0]!;
    const gainNode = context.createdGains[0]!;

    handle.release();

    expect(gainNode.gain.linearRampToValueAtTimeCalls).toEqual([{ value: 0, time: 5.03 }]);
    expect(source.stopCalls).toEqual([5.03]);
  });

  it('does not stop the source again on a second release() call', () => {
    const { context, engine } = buildEngine([60]);
    const handle = engine.noteOn(60, 100);
    const source = context.createdSources[0]!;

    handle.release();
    handle.release();

    expect(source.stopCalls).toHaveLength(1);
  });

  it('is a no-op if the voice was already replaced by a retrigger of the same pitch', () => {
    const { context, engine } = buildEngine([60]);

    const firstHandle = engine.noteOn(60, 100);
    const firstSource = context.createdSources[0]!;
    engine.noteOn(60, 100); // retriggers — stops firstSource, starts a second voice
    const secondSource = context.createdSources[1]!;

    firstHandle.release();

    expect(firstSource.stopCalls).toHaveLength(1); // only the retrigger's stop — release() added nothing
    expect(secondSource.stopCalls).toEqual([]); // and definitely didn't touch the new voice
  });
});
