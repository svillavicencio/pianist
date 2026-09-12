import * as PIXI from 'pixi.js';
import { PieceEngine } from './domain/PieceEngine';
import { WebAudioEngine } from './adapters/web/audio/WebAudioEngine';
import { loadRealPianoSamples } from './adapters/web/audio/realPianoSamples';
import { PixiRenderer } from './adapters/web/render/PixiRenderer';
import { DomInputSource } from './adapters/web/input/DomInputSource';
import { contentCatalog, contentPieces } from './content/catalog';
import { renderMainMenu, type MainMenuHandle } from './ui/mainMenu';
import { renderPauseMenu, type PauseMenuHandle } from './ui/pauseMenu';
import { renderGameOverlay } from './ui/gameOverlay';
import { injectBaseStyles } from './ui/styles';

/**
 * Composition root: wires the real web adapters, the real content catalog,
 * and the UI shell together into the actual app flow (menu -> perform ->
 * pause -> menu). This replaces the walking-skeleton's hardcoded fixture
 * piece and synthetic tone now that real content exists.
 */
async function main(): Promise<void> {
  injectBaseStyles();

  const mount = document.getElementById('app');
  if (!mount) throw new Error('missing #app mount element');

  const menuContainer = document.createElement('div');
  const gameContainer = document.createElement('div');
  gameContainer.style.display = 'none';
  mount.append(menuContainer, gameContainer);

  const app = new PIXI.Application();
  await app.init({ resizeTo: window, background: '#111111' });
  gameContainer.appendChild(app.canvas);

  const renderer = new PixiRenderer(app.stage, window.innerWidth, window.innerHeight);
  window.addEventListener('resize', () => renderer.resize(window.innerWidth, window.innerHeight));

  let lastTime = performance.now();
  function frame(now: number): void {
    renderer.tick(now - lastTime);
    lastTime = now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const audioCtx = new AudioContext();
  // Real samples load in the background as soon as the app starts, so the
  // first "Perform" click doesn't have to wait on the network round trip.
  const samplesPromise = loadRealPianoSamples(audioCtx, '/piano-samples');

  let menuHandle: MainMenuHandle | undefined;

  function showMainMenu(): void {
    gameContainer.style.display = 'none';
    menuContainer.style.display = '';
    menuHandle = renderMainMenu(menuContainer, contentCatalog, (dataName) => {
      void startPiece(dataName);
    });
  }

  async function startPiece(dataName: string): Promise<void> {
    const piece = contentPieces.get(dataName);
    if (!piece) return;

    menuHandle?.destroy();
    menuContainer.style.display = 'none';
    gameContainer.style.display = '';

    const samples = await samplesPromise;
    const audioEngine = new WebAudioEngine(audioCtx, samples);
    await audioEngine.init();

    const pieceEngine = new PieceEngine(piece);
    const input = new DomInputSource(window);

    let paused = false;
    let pauseHandle: PauseMenuHandle | undefined;

    const unsubscribe = input.onTrigger(() => {
      if (paused) return;
      if (audioCtx.state === 'suspended') void audioCtx.resume();

      const notes = pieceEngine.trigger();
      for (const note of notes) {
        audioEngine.noteOn(note.midi, note.velocity);
        renderer.spawnNoteVisual(note.midi, piece.colorTheme);
      }
    });

    const overlay = renderGameOverlay(gameContainer, {
      onPause(): void {
        if (paused) return;
        paused = true;
        pauseHandle = renderPauseMenu(gameContainer, {
          onResume(): void {
            pauseHandle?.destroy();
            pauseHandle = undefined;
            paused = false;
          },
          onRestart(): void {
            pieceEngine.reset();
            pauseHandle?.destroy();
            pauseHandle = undefined;
            paused = false;
          },
          onMainMenu(): void {
            pauseHandle?.destroy();
            unsubscribe();
            input.destroy();
            overlay.destroy();
            showMainMenu();
          },
        });
      },
    });
  }

  showMainMenu();
}

main().catch((error: unknown) => {
  console.error('gordopianist failed to start', error);
});
