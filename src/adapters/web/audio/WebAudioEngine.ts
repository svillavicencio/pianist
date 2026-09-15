import type { AudioEngine, NoteHandle } from "../../../ports/AudioEngine";
import type { MidiNote, Velocity } from "../../../domain/types";
import { findNearestSample, playbackRateFor, gainFor } from "./sampleSelection";
import type { PianoSampleProvider } from "./realPianoSamples";

export type AudioStatus =
  | "ready"
  | "audio-context-blocked"
  | "legacy-fallback"
  | "audio-error";
export interface WebAudioEngineOptions {
  maxVoices?: number;
  masterGain?: number;
  legacyFallback?: AudioEngine;
}
interface Voice {
  id: number;
  midi: MidiNote;
  source: AudioBufferSourceNode;
  gain: GainNode;
  released: boolean;
  started: number;
}
export class WebAudioEngine implements AudioEngine {
  private readonly voices = new Map<number, Voice>();
  private nextId = 1;
  private voiceSteals = 0;
  private legacyFallbacks = 0;
  private audioStatus: AudioStatus = "ready";
  private readonly statusListeners = new Set<(status: AudioStatus) => void>();
  private lastVoiceSteal: { victimId: number; reason: string } | undefined;
  private outputGain: GainNode;
  private compressor: DynamicsCompressorNode;
  constructor(
    private readonly context: BaseAudioContext,
    private readonly samples:
      | ReadonlyMap<MidiNote, AudioBuffer>
      | PianoSampleProvider,
    private readonly options: WebAudioEngineOptions = {},
  ) {
    this.outputGain = context.createGain();
    this.outputGain.gain.value = options.masterGain ?? 0.7;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 24;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.outputGain.connect(this.compressor);
    this.compressor.connect(context.destination);
  }
  async init(): Promise<void> {
    if (this.samples instanceof Map && this.samples.size === 0)
      throw new Error("WebAudioEngine requires at least one decoded sample");
  }
  noteOn(midi: MidiNote, velocity: Velocity): NoteHandle {
    if (velocity <= 0) return { release: () => {} };
    const selected = this.select(midi, velocity);
    if (!selected) {
      if (this.options.legacyFallback) {
        this.legacyFallbacks++;
        this.audioStatus = "legacy-fallback";
        for (const listener of this.statusListeners) listener(this.audioStatus);
        return this.options.legacyFallback.noteOn(midi, velocity);
      }
      this.audioStatus = "audio-error";
      for (const listener of this.statusListeners) listener(this.audioStatus);
      throw new Error(`no-compatible-asset:${midi}`);
    }
    if (this.voices.size >= (this.options.maxVoices ?? 64)) this.steal();
    const source = this.context.createBufferSource();
    source.buffer = selected.buffer;
    source.playbackRate.value = selected.rate;
    const gain = this.context.createGain();
    gain.gain.value = selected.gain;
    source.connect(gain);
    gain.connect(this.outputGain);
    const voice: Voice = {
      id: this.nextId++,
      midi,
      source,
      gain,
      released: false,
      started: this.context.currentTime,
    };
    this.voices.set(voice.id, voice);
    source.onended = () => {
      if (this.voices.get(voice.id) === voice) this.voices.delete(voice.id);
    };
    source.start();
    if (
      "getHarmonic" in this.samples &&
      typeof this.samples.getHarmonic === "function" &&
      selected.assetId
    ) {
      const harmonic = this.samples.getHarmonic(midi, velocity);
      if (harmonic) {
        const harmonicSource = this.context.createBufferSource();
        harmonicSource.buffer = harmonic;
        const harmonicGain = this.context.createGain();
        harmonicGain.gain.value = 0.08;
        harmonicSource.connect(harmonicGain);
        harmonicGain.connect(this.outputGain);
        harmonicSource.start();
      }
    }
    return { release: () => this.release(voice) };
  }
  subscribeStatus(listener: (status: AudioStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.audioStatus);
    return () => this.statusListeners.delete(listener);
  }
  dispose(): void {
    for (const voice of this.voices.values()) this.release(voice);
    this.voices.clear();
    this.outputGain.disconnect();
    this.compressor.disconnect();
  }
  diagnostics() {
    return {
      activeVoices: this.voices.size,
      maxVoices: this.options.maxVoices ?? 64,
      masterGain: this.outputGain.gain.value,
      unsupportedPedal: true,
      voiceSteals: this.voiceSteals,
      lastVoiceSteal: this.lastVoiceSteal,
      legacyFallbacks: this.legacyFallbacks,
      audioStatus: this.audioStatus,
    };
  }
  private select(
    midi: MidiNote,
    velocity: Velocity,
  ):
    | { buffer: AudioBuffer; rate: number; gain: number; assetId?: string }
    | undefined {
    if ("getAttack" in this.samples) {
      const x = this.samples.getAttack(midi, velocity);
      return (
        x && {
          buffer: x.buffer,
          rate: x.playbackRate,
          gain: x.gain,
          assetId: x.assetId,
        }
      );
    }
    const available = [...this.samples.keys()];
    if (!available.length) return undefined;
    const sample = findNearestSample(midi, available);
    return {
      buffer: this.samples.get(sample)!,
      rate: playbackRateFor(midi, sample),
      gain: gainFor(velocity),
    };
  }
  private release(voice: Voice): void {
    if (voice.released) return;
    voice.released = true;
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    const releaseBuffer =
      "getRelease" in this.samples
        ? this.samples.getRelease(voice.midi)
        : undefined;
    const duration = releaseBuffer ? 0.035 : 0.9;
    voice.gain.gain.linearRampToValueAtTime(0, now + duration);
    voice.source.stop(now + duration);
    if (releaseBuffer) {
      const source = this.context.createBufferSource();
      source.buffer = releaseBuffer;
      const gain = this.context.createGain();
      gain.gain.value = 0.22;
      source.connect(gain);
      gain.connect(this.outputGain);
      source.start();
    }
  }
  private steal(): void {
    const victim = [...this.voices.values()].sort(
      (a, b) =>
        Number(!a.released) - Number(!b.released) ||
        (a.released ? a.started : a.gain.gain.value) -
          (b.released ? b.started : b.gain.gain.value) ||
        a.started - b.started ||
        a.id - b.id,
    )[0];
    if (victim) {
      this.voiceSteals++;
      const activeVoices = [...this.voices.values()].filter(
        (voice) => !voice.released,
      );
      const quietest =
        activeVoices.length > 1 &&
        activeVoices.filter(
          (voice) => voice.gain.gain.value === victim.gain.gain.value,
        ).length > 1
          ? "oldest-active"
          : "quietest-active";
      const reason = victim.released ? "releasing-first" : quietest;
      this.lastVoiceSteal = { victimId: victim.id, reason };
      this.release(victim);
      this.voices.delete(victim.id);
    }
  }
}
