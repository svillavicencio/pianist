import type { AudioEngine, NoteHandle } from '../../../ports/AudioEngine';
import type { MidiNote, Velocity } from '../../../domain/types';
import { findNearestSample, gainFor, playbackRateFor } from './sampleSelection';

/** Duration (seconds) of the linear gain fade-out applied before a source is stopped, to avoid a click. */
const RELEASE_SECONDS = 0.03;

interface ActiveNote {
  readonly source: AudioBufferSourceNode;
  readonly gainNode: GainNode;
}

/**
 * `AudioEngine` implementation using the raw Web Audio API: decoded samples are
 * pitch-shifted via playback rate to cover notes that have no recorded sample.
 * Takes the context and samples as constructor arguments (rather than building
 * them itself) so this class stays trivially testable with fakes.
 */
export class WebAudioEngine implements AudioEngine {
  private readonly active = new Map<MidiNote, ActiveNote>();

  constructor(
    private readonly context: BaseAudioContext,
    private readonly samples: ReadonlyMap<MidiNote, AudioBuffer>,
  ) {}

  /** Loading/decoding audio files is out of scope for this adapter — the caller populates `samples` up front. */
  async init(): Promise<void> {
    if (this.samples.size === 0) {
      throw new Error('WebAudioEngine requires at least one decoded sample to be provided');
    }
  }

  noteOn(midi: MidiNote, velocity: Velocity): NoteHandle {
    // Retrigger: stop anything already sounding for this note before starting the new one.
    this.stopActive(midi);

    const sampleMidi = findNearestSample(midi, Array.from(this.samples.keys()));
    const buffer = this.samples.get(sampleMidi)!;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRateFor(midi, sampleMidi);

    const gainNode = this.context.createGain();
    gainNode.gain.value = gainFor(velocity);

    source.connect(gainNode);
    gainNode.connect(this.context.destination);
    source.start();

    const voice: ActiveNote = { source, gainNode };
    this.active.set(midi, voice);

    return {
      release: () => {
        if (this.active.get(midi) !== voice) return; // already retriggered — nothing to release
        this.stopActive(midi);
      },
    };
  }

  private stopActive(midi: MidiNote): void {
    const note = this.active.get(midi);
    if (!note) return;

    const now = this.context.currentTime;
    note.gainNode.gain.cancelScheduledValues(now);
    note.gainNode.gain.setValueAtTime(note.gainNode.gain.value, now);
    note.gainNode.gain.linearRampToValueAtTime(0, now + RELEASE_SECONDS);
    note.source.stop(now + RELEASE_SECONDS);

    this.active.delete(midi);
  }
}
