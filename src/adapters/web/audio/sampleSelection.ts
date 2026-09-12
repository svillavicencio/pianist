import type { MidiNote, Velocity } from '../../../domain/types';

/**
 * Picks the recorded sample closest to the target note. On an exact tie
 * between two equidistant samples, prefers the lower one (arbitrary but
 * deterministic choice — matches "round down" intuition for pitch rounding).
 * Throws if `availableSampleMidis` is empty — callers must have at least one sample.
 */
export function findNearestSample(
  targetMidi: MidiNote,
  availableSampleMidis: readonly MidiNote[],
): MidiNote {
  if (availableSampleMidis.length === 0) {
    throw new Error('findNearestSample requires at least one available sample');
  }

  let nearest = availableSampleMidis[0]!;
  let nearestDistance = Math.abs(targetMidi - nearest);

  for (const sampleMidi of availableSampleMidis) {
    const distance = Math.abs(targetMidi - sampleMidi);
    if (distance < nearestDistance || (distance === nearestDistance && sampleMidi < nearest)) {
      nearest = sampleMidi;
      nearestDistance = distance;
    }
  }

  return nearest;
}

/** Equal-temperament playback-rate multiplier to pitch-shift a recorded sample onto the target note. */
export function playbackRateFor(targetMidi: MidiNote, sampleMidi: MidiNote): number {
  return 2 ** ((targetMidi - sampleMidi) / 12);
}

/** Maps MIDI velocity (0-127) linearly onto a Web Audio gain (0-1), clamping out-of-range input. */
export function gainFor(velocity: Velocity): number {
  const clamped = Math.min(127, Math.max(0, velocity));
  return clamped / 127;
}
