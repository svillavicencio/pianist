const BASE_STYLE_ELEMENT_ID = 'pianist-base-styles';

/** Injects the shared base stylesheet into `document.head`, guarded so double calls are a no-op. Opt-in — the eventual composition root calls this once, none of the screens call it themselves. */
export function injectBaseStyles(): void {
  if (document.getElementById(BASE_STYLE_ELEMENT_ID)) return;

  const style = document.createElement('style');
  style.id = BASE_STYLE_ELEMENT_ID;
  style.textContent = `
    :root {
      --bg: #14161a;
      --surface: #1c1f26;
      --surface-hover: #262a33;
      --border: #33384344;
      --text: #e8e8e8;
      --text-dim: #a8adb8;
      --accent: #5b8dee;
      --accent-hover: #7aa2f2;
      --pack-gradient: linear-gradient(160deg, #20242d, #191c22);
    }

    body { margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; }

    button {
      background: var(--surface);
      color: var(--text);
      border: 1px solid #454a54;
      border-radius: 6px;
      padding: 0.5em 1em;
      font-size: 1em;
      cursor: pointer;
      transition: background-color 120ms ease;
    }
    button:hover { background: var(--surface-hover); }
    button:active { background: #1f2127; }

    /* Main menu */
    .main-menu { max-width: 760px; margin: 0 auto; padding: 2.5em 1.25em 4em; box-sizing: border-box; }
    .main-menu__header { text-align: center; margin-bottom: 2em; }
    .main-menu__title { margin: 0 0 0.25em; font-size: 2.5em; font-weight: 700; letter-spacing: -0.03em; }
    .main-menu__subtitle { margin: 0; color: var(--text-dim); font-size: 1.05em; }
    .main-menu__empty { text-align: center; color: var(--text-dim); }

    .main-menu__pack {
      background: var(--pack-gradient);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25em 1.5em;
      margin-bottom: 1.25em;
      box-shadow: 0 8px 24px #00000040;
    }
    .main-menu__pack-title { margin: 0 0 0.1em; font-size: 1.2em; }
    .main-menu__composer-title { margin: 0 0 0.75em; font-weight: normal; color: var(--text-dim); }

    .main-menu__piece-list { list-style: none; margin: 0; padding: 0; }
    .main-menu__piece-row {
      display: flex;
      align-items: center;
      gap: 0.75em;
      padding: 0.6em 0.5em;
      border-radius: 8px;
      transition: background-color 120ms ease;
    }
    .main-menu__piece-row:hover { background: var(--surface-hover); }
    .main-menu__piece-row--previewing { background: #5b8dee1a; }
    .main-menu__piece-row + .main-menu__piece-row { border-top: 1px solid var(--border); }

    .main-menu__piece-name { font-weight: 600; }
    .main-menu__piece-info { color: var(--text-dim); font-size: 0.9em; }
    .main-menu__piece-row > :is(.main-menu__piece-name, .main-menu__piece-info) { margin-right: auto; }

    .main-menu__preview-button {
      background: transparent;
      border-color: var(--accent);
      color: var(--accent);
      min-width: 8em;
    }
    .main-menu__preview-button:hover { background: #5b8dee22; }
    .main-menu__piece-row--previewing .main-menu__preview-button {
      background: var(--accent);
      color: #0b0d10;
    }

    .main-menu__perform-button { background: var(--accent); color: #0b0d10; border-color: var(--accent); font-weight: 600; }
    .main-menu__perform-button:hover { background: var(--accent-hover); }

    /* In-game overlay */
    .game-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      gap: 0.85em;
      padding: 0.6em 1em;
      background: linear-gradient(to bottom, #0b0d10cc, #0b0d1000);
    }
    .game-overlay__hint {
      position: fixed;
      left: 50%;
      bottom: 1.5em;
      transform: translateX(-50%);
      margin: 0;
      padding: 0.4em 1em;
      border-radius: 999px;
      background: #0b0d10aa;
      color: var(--text-dim);
      font-size: 0.9em;
      pointer-events: none;
      white-space: nowrap;
    }
    .game-overlay__progress-track {
      flex: 1;
      height: 8px;
      border-radius: 999px;
      background: #ffffff22;
      cursor: pointer;
      overflow: hidden;
    }
    .game-overlay__progress-fill {
      height: 100%;
      width: 0%;
      background: var(--accent);
      border-radius: 999px;
      transition: width 80ms linear;
    }
    .game-overlay__progress-label {
      color: var(--text-dim);
      font-size: 0.85em;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* Pause menu */
    .pause-menu__scrim {
      position: fixed;
      inset: 0;
      background: #05060766;
      backdrop-filter: blur(2px);
    }
    .pause-menu {
      /* Own fixed+inset+margin:auto, independent of the scrim's — the scrim only dims the
         viewport, it doesn't establish a containing block the card can center inside of. Without
         this the card falls back to static positioning and lands wherever it sits in normal
         document flow (in practice, off-screen below the fold). */
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      gap: 0.6em;
      align-items: stretch;
      justify-content: center;
      width: 240px;
      margin: auto;
      height: fit-content;
      padding: 1.5em;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 12px 40px #000000a0;
    }
    .pause-menu button { padding: 0.65em 1em; }
  `;
  document.head.appendChild(style);
}
