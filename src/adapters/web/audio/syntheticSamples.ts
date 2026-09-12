/**
 * Generates a short synthetic decaying tone as a stand-in for a real piano
 * sample, so `WebAudioEngine` has something to play before the real
 * recorded-sample content pipeline exists. Not meant to ship — this is dev
 * fixture code for the walking skeleton only.
 */
export function generateSyntheticSample(
  context: BaseAudioContext,
  midi: number,
  durationSeconds = 1.5,
): AudioBuffer {
  const { sampleRate } = context;
  const length = Math.floor(sampleRate * durationSeconds);
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // Standard MIDI-note-to-frequency conversion (A4 = midi 69 = 440Hz).
  const frequency = 440 * 2 ** ((midi - 69) / 12);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-3 * t);
    data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3;
  }

  return buffer;
}
