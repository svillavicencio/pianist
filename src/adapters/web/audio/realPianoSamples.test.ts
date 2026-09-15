import { describe, expect, it } from "vitest";
import {
  REAL_PIANO_SAMPLE_FILES,
  loadRealPianoSamples,
} from "./realPianoSamples";

describe("REAL_PIANO_SAMPLE_FILES", () => {
  it("maps every MIDI key to a valid MIDI number (0-127)", () => {
    for (const midi of REAL_PIANO_SAMPLE_FILES.keys()) {
      expect(midi).toBeGreaterThanOrEqual(0);
      expect(midi).toBeLessThanOrEqual(127);
      expect(Number.isInteger(midi)).toBe(true);
    }
  });

  it("maps each known octave-anchor note to its exact recorded filename", () => {
    expect(REAL_PIANO_SAMPLE_FILES).toEqual(
      new Map([
        [36, "C2v8.flac"],
        [45, "A2v8.flac"],
        [48, "C3v8.flac"],
        [57, "A3v8.flac"],
        [60, "C4v8.flac"],
        [69, "A4v8.flac"],
        [72, "C5v8.flac"],
        [81, "A5v8.flac"],
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

describe("loadRealPianoSamples", () => {
  it("fetches every sample file from baseUrl and decodes it into the returned map", async () => {
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

    const result = await loadRealPianoSamples(
      fakeContext,
      "https://example.test/samples",
      fakeFetch as typeof fetch,
    );

    expect(fetchCalls.sort()).toEqual(
      [...REAL_PIANO_SAMPLE_FILES.values()]
        .map((file) => `https://example.test/samples/${file}`)
        .sort(),
    );

    expect(result.size).toBe(REAL_PIANO_SAMPLE_FILES.size);
    for (const midi of REAL_PIANO_SAMPLE_FILES.keys()) {
      expect(result.get(midi)).toBeDefined();
    }
  });

  it("rejects when a fetch fails, instead of swallowing the error", async () => {
    const failingFetch = async () => {
      throw new Error("network down");
    };
    const fakeContext = {
      decodeAudioData: async () => ({}) as unknown as AudioBuffer,
    } as unknown as BaseAudioContext;

    await expect(
      loadRealPianoSamples(
        fakeContext,
        "https://example.test/samples",
        failingFetch as typeof fetch,
      ),
    ).rejects.toThrow("network down");
  });

  it("rejects when decoding fails, instead of swallowing the error", async () => {
    const fakeFetch = async () =>
      new FakeResponse(new ArrayBuffer(8)) as unknown as Response;
    const fakeContext = {
      decodeAudioData: async () => {
        throw new Error("bad audio data");
      },
    } as unknown as BaseAudioContext;

    await expect(
      loadRealPianoSamples(
        fakeContext,
        "https://example.test/samples",
        fakeFetch as typeof fetch,
      ),
    ).rejects.toThrow("bad audio data");
  });
});

import { PIANO_MANIFEST, assetUrl } from "./pianoAssetManifest";
import { selectAttack } from "./sampleSelection";
import { createPianoSampleProvider, harmonicAssetFor } from "./realPianoSamples";

describe("priority scheduling through the real provider", () => {
  it("decodes a selected piece's anchor ahead of full-bank fetch scheduling", async () => {
    const log: string[] = [];
    const urlOf = new Map<ArrayBuffer, string>();
    const okResponse = { ok: true };
    const provider = createPianoSampleProvider(
      {} as BaseAudioContext,
      "/pianist/",
      {
        fetchImpl: async (url: RequestInfo | URL) => {
          const buf = new ArrayBuffer(1);
          urlOf.set(buf, String(url));
          log.push(`fetch:${String(url)}`);
          return {
            ...okResponse,
            arrayBuffer: async () => buf,
          } as unknown as Response;
        },
        decode: async (data: ArrayBuffer) => {
          log.push(`decode:${urlOf.get(data) ?? "?"}`);
          return { length: 1, numberOfChannels: 1 } as AudioBuffer;
        },
      },
    );

    // Midi 60 (C4) is not among the eight bootstrap seed anchors, so its
    // decode can only happen through explicit priority scheduling, not
    // through the awaited bootstrap-seed step.
    await provider.prewarmBootstrap([60]);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const decodeIndex = log.findIndex(
      (entry) => entry.startsWith("decode:") && entry.includes("C4v8"),
    );
    expect(decodeIndex).toBeGreaterThanOrEqual(0);
    // A prioritized decode must land right after the bootstrap group (eight
    // fetches + eight seed decodes), not after hundreds of unrelated
    // full-bank fetch-only jobs queued ahead of it.
    expect(decodeIndex).toBeLessThan(45);
  });
});

describe("harmonic warming through the real provider", () => {
  it("proactively loads the harmonic asset for a prewarmed piece note", async () => {
    const provider = createPianoSampleProvider(
      {} as BaseAudioContext,
      "/pianist/",
      {
        fetchImpl: async () =>
          ({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(1),
          }) as unknown as Response,
        decode: async () =>
          ({ length: 1, numberOfChannels: 1 }) as AudioBuffer,
      },
    );

    await provider.prewarmBootstrap([21]);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const expectedAsset = harmonicAssetFor(21, 100);
    expect(expectedAsset).toBeDefined();
    // The real getHarmonic hook must resolve a genuinely decoded buffer once
    // the piece has been prewarmed, not stay undefined on the first note.
    expect(provider.getHarmonic!(21, 100)).toBeDefined();
  });
});

describe("verified piano manifest", () => {
  it("contains exact inventory and bytes", () => {
    expect(PIANO_MANIFEST.assets).toHaveLength(641);
    expect(
      PIANO_MANIFEST.assets.filter((a) => a.role === "attack"),
    ).toHaveLength(480);
    expect(PIANO_MANIFEST.totalBytes).toBe(90413373);
  });
  it("constructs local base URLs", () => {
    expect(assetUrl("/pianist/", "piano-samples/C4v8.mp3")).toBe(
      "/pianist/piano-samples/C4v8.mp3",
    );
  });
  it("selects deterministic anchor and velocity layer", () => {
    const available = PIANO_MANIFEST.assets.filter(
      (a) => a.role === "attack" && a.layer === 8,
    );
    const result = selectAttack({
      midi: 30,
      velocity: 64,
      available,
      manifest: PIANO_MANIFEST,
    });
    expect(result?.anchorMidi).toBe(30);
    expect(result?.layer).toBe(8);
  });
});
