import { describe, expect, it } from "vitest";
import { WebAudioEngine } from "./WebAudioEngine";
import { createPianoSampleProvider } from "./realPianoSamples";
class Param {
 value = 0;
 ramps: any[] = [];
 cancelScheduledValues() {}
 setValueAtTime(v: number) {
  this.value = v;
  return this;
 }
 linearRampToValueAtTime(v: number, t: number) {
  this.ramps.push([v, t]);
  return this;
 }
}
class Source {
 buffer: any;
 playbackRate = new Param();
 connected: any[] = [];
 starts = 0;
 stops: any[] = [];
 onended = () => {};
 connect(x: any) {
  this.connected.push(x);
  return x;
 }
 start() {
  this.starts++;
 }
 stop(t: number) {
  this.stops.push(t);
 }
}
class Gain {
 gain = new Param();
 connected: any[] = [];
 connect(x: any) {
  this.connected.push(x);
  return x;
 }
 disconnect() {}
}
class Compressor extends Gain {
 threshold = new Param();
 knee = new Param();
 ratio = new Param();
 attack = new Param();
 release = new Param();
}
class Context {
 currentTime = 0;
 destination = {};
 sources: Source[] = [];
 gains: Gain[] = [];
 compressor = new Compressor();
 createBufferSource() {
  const x = new Source();
  this.sources.push(x);
  return x;
 }
 createGain() {
  const x = new Gain();
  this.gains.push(x);
  return x;
 }
 createDynamicsCompressor() {
  return this.compressor;
 }
}
function engine() {
 const context = new Context();
 const e = new WebAudioEngine(
  context as unknown as BaseAudioContext,
  new Map([[60, { id: 60 } as unknown as AudioBuffer]]),
 );
 return { context, e };
}
describe("WebAudioEngine", () => {
 it("uses master headroom and compressor defaults", () => {
  const { context, e } = engine();
  e.noteOn(60, 127);
  expect(context.gains[0]!.gain.value).toBe(0.7);
  expect(context.compressor.threshold.value).toBe(-18);
 });
 it("keeps repeated same-pitch voices independent", () => {
  const { context, e } = engine();
  const first = e.noteOn(60, 100);
  const second = e.noteOn(60, 100);
  expect(context.sources).toHaveLength(2);
  first.release();
  expect(context.sources[0]!.stops).toHaveLength(1);
  expect(context.sources[1]!.stops).toHaveLength(0);
  second.release();
  expect(context.sources[1]!.stops).toHaveLength(1);
 });
 it("routes key-specific release through provider with a 35ms attack fade", () => {
  const { context } = engine();
  const release = { id: "release" } as unknown as AudioBuffer;
  const provider = {
   loader: {} as any,
   prewarmBootstrap: async () => {},
   prewarmPiece: async () => {},
   getAttack: () => ({
    buffer: { id: "attack" } as unknown as AudioBuffer,
    playbackRate: 1,
    gain: 0.5,
    assetId: "attack",
   }),
   getRelease: () => release,
   getHarmonic: () => undefined,
  };
  const handle = new WebAudioEngine(
   context as unknown as BaseAudioContext,
   provider,
  ).noteOn(60, 100);
  handle.release();
  expect(context.sources[1]!.buffer).toBe(release);
  expect(context.sources[0]!.stops).toEqual([0.035]);
 });
 it("routes a verified harmonic buffer when the provider supplies one", () => {
  const { context } = engine();
  const provider = {
   loader: {} as any,
   prewarmBootstrap: async () => {},
   prewarmPiece: async () => {},
   getAttack: () => ({
    buffer: { id: "attack" } as unknown as AudioBuffer,
    playbackRate: 1,
    gain: 0.5,
    assetId: "attack",
   }),
   getRelease: () => undefined,
   getHarmonic: () => ({ id: "harmonic" }) as unknown as AudioBuffer,
  };
  new WebAudioEngine(context as unknown as BaseAudioContext, provider).noteOn(
   60,
   100,
  );
  expect(context.sources).toHaveLength(2);
  expect(context.sources[1]!.buffer).toEqual({ id: "harmonic" });
 });
 it("steals releasing voices before active voices", () => {
  const { e } = engine();
  const first = e.noteOn(60, 100);
  for (let i = 1; i < 64; i++) e.noteOn(60, 100);
  first.release();
  e.noteOn(60, 100);
  expect(e.diagnostics().activeVoices).toBeLessThanOrEqual(64);
  expect(e.diagnostics().lastVoiceSteal?.reason).toBe("releasing-first");
 });
 it("caps active voices deterministically", () => {
  const { e } = engine();
  for (let i = 0; i < 65; i++) e.noteOn(60, 100);
  expect(e.diagnostics().maxVoices).toBe(64);
  expect(e.diagnostics().activeVoices).toBeLessThanOrEqual(64);
  expect(e.diagnostics().voiceSteals).toBe(1);
  expect(e.diagnostics().lastVoiceSteal?.reason).toBe("oldest-active");
 });
 it("enforces the 64-voice bound end-to-end through the real manifest provider across distinct pitches", async () => {
  const context = new Context();
  const provider = createPianoSampleProvider(
   context as unknown as BaseAudioContext,
   "/pianist/",
   {
    fetchImpl: async () =>
     ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }) as unknown as Response,
    decode: async () => ({ length: 1, numberOfChannels: 1 }) as AudioBuffer,
   },
  );
  await provider.prewarmBootstrap();
  await new Promise((resolve) => setTimeout(resolve, 20));
  // The eight bootstrap seed anchors are always decoded after
  // prewarmBootstrap; cycling across them exercises real cross-pitch
  // selection while keeping every note-on resolvable.
  const seedMidis = [21, 24, 27, 30, 33, 36, 39, 42];
  const e = new WebAudioEngine(context as unknown as BaseAudioContext, provider);
  for (let i = 0; i < 88; i++) e.noteOn(seedMidis[i % seedMidis.length]!, 100);
  expect(e.diagnostics().activeVoices).toBeLessThanOrEqual(64);
  expect(e.diagnostics().activeVoices).toBe(64);
  expect(e.diagnostics().voiceSteals).toBe(88 - 64);
 });
});
