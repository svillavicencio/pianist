import type { MidiNote } from '../../../domain/types';

/** Pure MIDI-note-to-filename map for the recorded Salamander Grand Piano samples (see ATTRIBUTION.md). */
export const REAL_PIANO_SAMPLE_FILES: ReadonlyMap<MidiNote, string> = new Map([
  [36, 'C2v8.flac'],
  [45, 'A2v8.flac'],
  [48, 'C3v8.flac'],
  [57, 'A3v8.flac'],
  [60, 'C4v8.flac'],
  [69, 'A4v8.flac'],
  [72, 'C5v8.flac'],
  [81, 'A5v8.flac'],
]);

/**
 * Fetches and decodes every real piano sample from `baseUrl`, keyed by MIDI note.
 * `fetchImpl` is injectable so this is testable without a real network/browser —
 * defaults to the global `fetch`. Any single fetch or decode failure rejects the
 * whole promise; this loader's only job is to try honestly, not to swallow errors.
 */
export async function loadRealPianoSamples(
  context: BaseAudioContext,
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Map<MidiNote, AudioBuffer>> {
  const entries = await Promise.all(
    [...REAL_PIANO_SAMPLE_FILES.entries()].map(async ([midi, filename]) => {
      const response = await fetchImpl(`${baseUrl}/${filename}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer);
      return [midi, audioBuffer] as const;
    }),
  );

  return new Map(entries);
}
