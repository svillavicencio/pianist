import { describe, expect, it } from "vitest";
import { createProgressivePianoLoader } from "./progressivePianoLoader";
import { PIANO_MANIFEST } from "./pianoAssetManifest";
const asset = (id: string, group: "bootstrap" | "full" = "bootstrap") => ({
 id,
 path: `piano-samples/${id}.mp3`,
 role: "attack" as const,
 anchorMidi: 60,
 layer: 8,
 format: "mp3" as const,
 bytes: 1,
 sha256: "x",
 group,
});
const smallManifest = {
 source: {
  adaptation: "x",
  commit: "x",
  url: "x",
  original: "x",
  adaptationLicense: "MIT",
  audioLicense: "CC-BY-3.0",
 } as any,
 assets: [
  asset("a"),
  asset("b"),
  asset("c"),
  asset("d"),
  asset("e"),
  asset("f"),
  asset("g"),
  asset("h"),
  asset("i", "full"),
 ],
 totalBytes: 9,
};
const response = {
 ok: true,
 arrayBuffer: async () => new ArrayBuffer(1),
} as Response;
describe("progressive piano loader", () => {
 it("deduplicates pending requests and caps work", async () => {
  let calls = 0;
  const loader = createProgressivePianoLoader(
   {} as BaseAudioContext,
   smallManifest,
   {
    fetchImpl: async () => {
     calls++;
     return response;
    },
    decode: async () => ({ length: 1, numberOfChannels: 1 }) as AudioBuffer,
    concurrency: 2,
   },
  );
  const [a, b] = await Promise.all([loader.request("a"), loader.request("a")]);
  expect(a).toBe(b);
  expect(calls).toBe(1);
 });
 it("records partial failures without rejecting other work", async () => {
  const loader = createProgressivePianoLoader(
   {} as BaseAudioContext,
   smallManifest,
   {
    fetchImpl: async (url) => {
     if (String(url).endsWith("/b.mp3")) throw new Error("offline");
     return response;
    },
    decode: async () => ({ length: 1, numberOfChannels: 1 }) as AudioBuffer,
   },
  );
  await expect(loader.request("a")).resolves.toBeDefined();
  await expect(loader.request("b")).rejects.toThrow("offline");
  expect(loader.state().failed).toBe(1);
 });
 it("uses canonical base URL joining", async () => {
  const urls: string[] = [];
  const loader = createProgressivePianoLoader(
   {} as BaseAudioContext,
   smallManifest,
   {
    baseUrl: "/pianist/",
    fetchImpl: async (url) => {
     urls.push(String(url));
     return response;
    },
    decode: async () => ({ length: 1, numberOfChannels: 1 }) as AudioBuffer,
   },
  );
  await loader.request("a");
  expect(urls[0]).toBe("/pianist/piano-samples/a.mp3");
 });
 it("does not publish or resolve an in-flight request after supersession", async () => {
  let finish!: () => void;
  const loader = createProgressivePianoLoader(
   {} as BaseAudioContext,
   smallManifest,
   {
    fetchImpl: async () =>
     new Promise<Response>((resolve) => {
      finish = () => resolve(response);
     }),
    decode: async () => ({ length: 1, numberOfChannels: 1 }) as AudioBuffer,
   },
  );
  const stale = loader.request("a");
  const before = loader.state();
  loader.cancel();
  finish();
  await expect(stale).rejects.toThrow(/superseded/);
  expect(loader.state().generation).toBe(before.generation + 1);
  expect(loader.state().successful).toBe(0);
  expect(loader.get("a")).toBeUndefined();
 });
 it("loads all bootstrap assets but only decodes the eight seed buffers", async () => {
  let decodes = 0;
  const loader = createProgressivePianoLoader(
   {} as BaseAudioContext,
   smallManifest,
   {
    fetchImpl: async () => response,
    decode: async () => {
     decodes++;
     return { length: 1, numberOfChannels: 1 } as AudioBuffer;
    },
   },
  );
  await loader.startPlan({
   bootstrapIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
   seedIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
   visible: true,
   saveData: false,
  });
  expect(decodes).toBe(8);
  expect(loader.state().bootstrapReady).toBe(true);
 });
});
describe("full-bank plan", () => {
 it("fetches the remaining 611 assets only while eligible", async () => {
  let fetches = 0,
   decodes = 0;
  const loader = createProgressivePianoLoader(
   {} as BaseAudioContext,
   PIANO_MANIFEST,
   {
    fetchImpl: async () => {
     fetches++;
     return response;
    },
    decode: async () => {
     decodes++;
     return { length: 1, numberOfChannels: 1 } as AudioBuffer;
    },
   },
  );
  const bootstrap = PIANO_MANIFEST.assets
   .filter((a) => a.role === "attack" && a.layer === 8)
   .map((a) => a.id);
  await loader.startPlan({
   bootstrapIds: bootstrap,
   seedIds: bootstrap.slice(0, 8),
   visible: true,
   saveData: false,
  });
  await new Promise((r) => setTimeout(r, 20));
  expect(fetches).toBe(641);
  expect(decodes).toBe(8);
 });
 it("does not schedule idle assets when hidden", async () => {
  let fetches = 0;
  const loader = createProgressivePianoLoader(
   {} as BaseAudioContext,
   PIANO_MANIFEST,
   {
    fetchImpl: async () => {
     fetches++;
     return response;
    },
    decode: async () => ({ length: 1, numberOfChannels: 1 }) as AudioBuffer,
   },
  );
  const bootstrap = PIANO_MANIFEST.assets
   .filter((a) => a.role === "attack" && a.layer === 8)
   .map((a) => a.id);
  await loader.startPlan({
   bootstrapIds: bootstrap,
   seedIds: bootstrap.slice(0, 8),
   visible: false,
   saveData: false,
  });
  expect(fetches).toBe(30);
 });
});
