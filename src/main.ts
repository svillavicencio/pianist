import * as PIXI from 'pixi.js';
import { PieceEngine } from './domain/PieceEngine';
import { WatchModePlayer } from './domain/WatchModePlayer';
import { upcomingChordsPreview } from './domain/upcomingNotesPreview';
import type { Chord, Piece } from './domain/types';
import { WebAudioEngine } from './adapters/web/audio/WebAudioEngine';
import type { NoteHandle } from './ports/AudioEngine';
import { loadRealPianoSamples } from './adapters/web/audio/realPianoSamples';
import { PixiRenderer } from './adapters/web/render/PixiRenderer';
import { DomInputSource } from './adapters/web/input/DomInputSource';
import { SystemClock } from './adapters/web/time/SystemClock';
import { contentCatalog, contentPieces } from './content/catalog';
import { renderMainMenu, type MainMenuHandle } from './ui/mainMenu';
import { renderPauseMenu, type PauseMenuHandle } from './ui/pauseMenu';
import { renderGameOverlay } from './ui/gameOverlay';
import { injectBaseStyles } from './ui/styles';

/** How much of a piece's real timeline the "Preview" button plays, in ms, before auto-stopping. */
const PREVIEW_DURATION_MS = 12_000;
/** Hard cap on chords played by a preview, in case a very dense piece packs more than expected into the window. */
const MAX_PREVIEW_CHORDS = 80;

/** How far ahead (in authored screen-duration ms) the in-game "falling notes" lane looks — touchpianist's rhythm cue. */
const UPCOMING_LOOKAHEAD_MS = 3000;
/** Hard cap on dots drawn in the upcoming-notes lane, so a dense trill passage can't flood the screen. */
const UPCOMING_MAX_NOTES = 40;

/** Slices `piece.chords` down to the leading chunk a preview should play, honoring both the time and count caps. */
function previewChordsFor(piece: Piece): readonly Chord[] {
  if (piece.chords.length === 0) return [];
  const startTimeMs = piece.chords[0]!.originalTimeMs;
  return piece.chords
    .filter((chord) => chord.originalTimeMs - startTimeMs <= PREVIEW_DURATION_MS)
    .slice(0, MAX_PREVIEW_CHORDS);
}

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

  const renderer = new PixiRenderer(app.stage, window.innerWidth, window.innerHeight, UPCOMING_LOOKAHEAD_MS);
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
  // BASE_URL already carries a trailing slash (e.g. '/pianist/' on GitHub
  // Pages, '/' in dev) — loadRealPianoSamples appends its own leading slash
  // per filename, so this path segment must not carry one of its own.
  const samplesPromise = loadRealPianoSamples(audioCtx, `${import.meta.env.BASE_URL}piano-samples`);

  let menuHandle: MainMenuHandle | undefined;

  // Preview playback state (Watch mode on a real clock, capped to a short window) —
  // lets the main menu answer "what does this piece sound like?" before committing to it.
  const previewClock = new SystemClock();
  let previewPlayer: WatchModePlayer | undefined;
  let previewStopTimer: ReturnType<typeof setTimeout> | undefined;
  let previewDataName: string | undefined;
  let previewGeneration = 0;

  function stopPreview(): void {
    previewGeneration += 1;
    previewPlayer?.stop();
    previewPlayer = undefined;
    if (previewStopTimer !== undefined) {
      clearTimeout(previewStopTimer);
      previewStopTimer = undefined;
    }
    if (previewDataName !== undefined) {
      previewDataName = undefined;
      menuHandle?.setPreviewing(null);
    }
  }

  async function startPreview(dataName: string): Promise<void> {
    const generation = ++previewGeneration;
    const piece = contentPieces.get(dataName);
    if (!piece) return;

    const chords = previewChordsFor(piece);
    if (chords.length === 0) return;

    const samples = await samplesPromise;
    if (generation !== previewGeneration) return; // superseded (stopped, or another preview/perform started) while loading

    const previewAudio = new WebAudioEngine(audioCtx, samples);
    await previewAudio.init();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    if (generation !== previewGeneration) return;

    previewDataName = dataName;
    menuHandle?.setPreviewing(dataName);

    previewPlayer = new WatchModePlayer({ ...piece, chords }, previewClock, (notes) => {
      for (const note of notes) previewAudio.noteOn(note.midi, note.velocity);
    });
    previewPlayer.start();

    const durationMs = chords[chords.length - 1]!.originalTimeMs - chords[0]!.originalTimeMs + 400;
    previewStopTimer = setTimeout(() => {
      if (previewDataName === dataName) stopPreview();
    }, durationMs);
  }

  function togglePreview(dataName: string): void {
    if (previewDataName === dataName) {
      stopPreview();
      return;
    }
    stopPreview();
    void startPreview(dataName);
  }

  function showMainMenu(): void {
    gameContainer.style.display = 'none';
    menuContainer.style.display = '';
    menuHandle = renderMainMenu(menuContainer, contentCatalog, {
      onSelectPiece(dataName): void {
        void startPiece(dataName);
      },
      onPreviewPiece(dataName): void {
        togglePreview(dataName);
      },
    });
  }

  async function startPiece(dataName: string): Promise<void> {
    const piece = contentPieces.get(dataName);
    if (!piece) return;

    stopPreview();
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

    // Redraws the "falling notes" preview lane from wherever the cursor now sits — called after
    // every cursor move (trigger, seek, restart) so it always shows what's actually coming up next.
    // An arrow function (not a hoisted `function` declaration) so TS keeps `piece` narrowed non-null here.
    // `continuedFromPreviousTap` must be true only for a normal single-chord advance (a tap) — that's
    // what lets the renderer keep the fall flowing instead of snapping the new "next" note into place.
    const refreshUpcoming = (continuedFromPreviousTap: boolean): void => {
      const upcoming = upcomingChordsPreview(
        piece.chords.slice(pieceEngine.currentChordIndex),
        UPCOMING_LOOKAHEAD_MS,
        UPCOMING_MAX_NOTES,
      );
      renderer.showUpcoming(upcoming, piece.colorTheme, continuedFromPreviousTap);
    };

    // Notes currently sounding because a press hasn't released yet, keyed by the press id
    // (physical key code or `pointer:<id>`) that started them — see docs/plans/2026-09-14-key-hold-note-sustain-design.md.
    const heldNotes = new Map<string, NoteHandle[]>();
    // Press ids currently physically down. As long as this is non-empty, it's like a sustain
    // pedal being held: a released press's notes keep ringing instead of cutting off, and
    // everything in `heldNotes` only actually releases once the last held press comes up —
    // see docs/plans/2026-09-14-pedal-hold-simulation-design.md.
    const activePresses = new Set<string>();

    function releaseAllHeldNotes(): void {
      for (const handles of heldNotes.values()) {
        for (const handle of handles) handle.release();
      }
      heldNotes.clear();
      activePresses.clear();
    }

    const unsubscribePress = input.onPress((id) => {
      if (paused) return;
      if (audioCtx.state === 'suspended') void audioCtx.resume();

      const notes = pieceEngine.trigger();
      const handles: NoteHandle[] = [];
      for (const note of notes) {
        handles.push(audioEngine.noteOn(note.midi, note.velocity));
        renderer.spawnNoteVisual(note.midi, piece.colorTheme);
      }
      heldNotes.set(id, handles);
      activePresses.add(id);
      overlay.setProgress(pieceEngine.currentChordIndex, piece.chords.length);
      refreshUpcoming(true);
    });

    const unsubscribeRelease = input.onRelease((id) => {
      activePresses.delete(id);
      if (activePresses.size > 0) return; // pedal still down — leave every held note ringing

      for (const handles of heldNotes.values()) {
        for (const handle of handles) handle.release();
      }
      heldNotes.clear();
    });

    const overlay = renderGameOverlay(gameContainer, {
      onPause(): void {
        if (paused) return;
        paused = true;
        releaseAllHeldNotes();
        pauseHandle = renderPauseMenu(gameContainer, {
          onResume(): void {
            pauseHandle?.destroy();
            pauseHandle = undefined;
            paused = false;
          },
          onRestart(): void {
            pieceEngine.reset();
            overlay.setProgress(pieceEngine.currentChordIndex, piece.chords.length);
            refreshUpcoming(false);
            pauseHandle?.destroy();
            pauseHandle = undefined;
            paused = false;
          },
          onMainMenu(): void {
            pauseHandle?.destroy();
            unsubscribePress();
            unsubscribeRelease();
            input.destroy();
            overlay.destroy();
            showMainMenu();
          },
        });
      },
      onSeek(ratio): void {
        if (paused) return;
        pieceEngine.seekTo(Math.round(ratio * piece.chords.length));
        overlay.setProgress(pieceEngine.currentChordIndex, piece.chords.length);
        refreshUpcoming(false);
      },
    });
    overlay.setProgress(pieceEngine.currentChordIndex, piece.chords.length);
    refreshUpcoming(false);
  }

  showMainMenu();
}

main().catch((error: unknown) => {
  console.error('pianist failed to start', error);
});
