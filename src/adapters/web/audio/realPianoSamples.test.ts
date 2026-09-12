import { describe, expect, it } from 'vitest';
import { REAL_PIANO_SAMPLE_FILES, loadRealPianoSamples } from './realPianoSamples';

describe('REAL_PIANO_SAMPLE_FILES', () => {
  it('maps every MIDI key to a valid MIDI number (0-127)', () => {
    for (const midi of REAL_PIANO_SAMPLE_FILES.keys()) {
      expect(midi).toBeGreaterThanOrEqual(0);
      expect(midi).toBeLessThanOrEqual(127);
      expect(Number.isInteger(midi)).toBe(true);
    }
  });

  it('maps each known octave-anchor note to its exact recorded filename', () => {
    expect(REAL_PIANO_SAMPLE_FILES).toEqual(
      new Map([
        [36, 'C2v8.flac'],
        [45, 'A2v8.flac'],
        [48, 'C3v8.flac'],
        [57, 'A3v8.flac'],
        [60, 'C4v8.flac'],
        [69, 'A4v8.flac'],
        [72, 'C5v8.flac'],
        [81, 'A5v8.flac'],
      ]),
    );
  });
});

/** Fake Response-shaped object — just enough for `loadRealPianoSamples` to call `.arrayBuffer()`. */
class FakeResponse {
  constructor(private readonly buffer: ArrayBuffer) {}

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.buffer;
  }
}

describe('loadRealPianoSamples', () => {
  it('fetches every sample file from baseUrl and decodes it into the returned map', async () => {
    const fetchCalls: string[] = [];
    const fakeFetch = async (url: string) => {
      fetchCalls.push(url);
      return new FakeResponse(new ArrayBuffer(8)) as unknown as Response;
    };

    const decodedBuffers = new Map<ArrayBuffer, unknown>();
    const fakeContext = {
      decodeAudioData: async (data: ArrayBuffer) => {
        const fakeBuffer = { id: data };
        decodedBuffers.set(data, fakeBuffer);
        return fakeBuffer as unknown as AudioBuffer;
      },
    } as unknown as BaseAudioContext;

    const result = await loadRealPianoSamples(fakeContext, 'https://example.test/samples', fakeFetch as typeof fetch);

    expect(fetchCalls.sort()).toEqual(
      [...REAL_PIANO_SAMPLE_FILES.values()].map((file) => `https://example.test/samples/${file}`).sort(),
    );

    expect(result.size).toBe(REAL_PIANO_SAMPLE_FILES.size);
    for (const midi of REAL_PIANO_SAMPLE_FILES.keys()) {
      expect(result.get(midi)).toBeDefined();
    }
  });

  it('rejects when a fetch fails, instead of swallowing the error', async () => {
    const failingFetch = async () => {
      throw new Error('network down');
    };
    const fakeContext = {
      decodeAudioData: async () => ({}) as unknown as AudioBuffer,
    } as unknown as BaseAudioContext;

    await expect(
      loadRealPianoSamples(fakeContext, 'https://example.test/samples', failingFetch as typeof fetch),
    ).rejects.toThrow('network down');
  });

  it('rejects when decoding fails, instead of swallowing the error', async () => {
    const fakeFetch = async () => new FakeResponse(new ArrayBuffer(8)) as unknown as Response;
    const fakeContext = {
      decodeAudioData: async () => {
        throw new Error('bad audio data');
      },
    } as unknown as BaseAudioContext;

    await expect(
      loadRealPianoSamples(fakeContext, 'https://example.test/samples', fakeFetch as typeof fetch),
    ).rejects.toThrow('bad audio data');
  });
});
