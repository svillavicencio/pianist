import * as PIXI from 'pixi.js';
import { PieceEngine } from './domain/PieceEngine';
import { WebAudioEngine } from './adapters/web/audio/WebAudioEngine';
import { generateSyntheticSample } from './adapters/web/audio/syntheticSamples';
import { PixiRenderer } from './adapters/web/render/PixiRenderer';
import { DomInputSource } from './adapters/web/input/DomInputSource';
import { walkingSkeletonPiece } from './fixtures/walkingSkeletonPiece';

/**
 * Composition root for the "walking skeleton": wires the real web adapters
 * to the real domain logic with a tiny hand-authored piece, to validate the
 * end-to-end loop before the UI shell exists. Not the final app entry point.
 */
async function main(): Promise<void> {
  const mount = document.getElementById('app');
  if (!mount) throw new Error('missing #app mount element');

  const app = new PIXI.Application();
  await app.init({ resizeTo: window, background: '#111111' });
  mount.appendChild(app.canvas);

  const audioCtx = new AudioContext();

  // Walking skeleton only: synthesize two base samples instead of loading
  // real recorded piano samples (that's the not-yet-built content track).
  // WebAudioEngine pitch-shifts every other note from whichever is nearest.
  const samples = new Map<number, AudioBuffer>([
    [48, generateSyntheticSample(audioCtx, 48)],
    [72, generateSyntheticSample(audioCtx, 72)],
  ]);

  const audioEngine = new WebAudioEngine(audioCtx, samples);
  await audioEngine.init();

  const renderer = new PixiRenderer(app.stage, window.innerWidth, window.innerHeight);
  window.addEventListener('resize', () => renderer.resize(window.innerWidth, window.innerHeight));

  const pieceEngine = new PieceEngine(walkingSkeletonPiece);
  const inputSource = new DomInputSource(window);

  inputSource.onTrigger(() => {
    if (audioCtx.state === 'suspended') void audioCtx.resume();

    const notes = pieceEngine.trigger();
    for (const note of notes) {
      audioEngine.noteOn(note.midi, note.velocity);
      renderer.spawnNoteVisual(note.midi, walkingSkeletonPiece.colorTheme);
    }
    if (pieceEngine.isFinished()) {
      console.log('walking skeleton: piece finished');
    }
  });

  let lastTime = performance.now();
  function frame(now: number): void {
    renderer.tick(now - lastTime);
    lastTime = now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  console.log('walking skeleton ready — press any key or tap to advance the piece');
}

main().catch((error: unknown) => {
  console.error('walking skeleton failed to start', error);
});
