const BASE_STYLE_ELEMENT_ID = 'gordopianist-base-styles';

/** Injects the shared base stylesheet into `document.head`, guarded so double calls are a no-op. Opt-in — the eventual composition root calls this once, none of the screens call it themselves. */
export function injectBaseStyles(): void {
  if (document.getElementById(BASE_STYLE_ELEMENT_ID)) return;

  const style = document.createElement('style');
  style.id = BASE_STYLE_ELEMENT_ID;
  style.textContent = `
    body { margin: 0; background: #14161a; color: #e8e8e8; font-family: system-ui, sans-serif; }
    button { background: #2a2d34; color: #e8e8e8; border: 1px solid #454a54; border-radius: 4px; padding: 0.5em 1em; font-size: 1em; cursor: pointer; }
    button:hover { background: #383c45; }
    button:active { background: #1f2127; }
    .main-menu, .pause-menu, .game-overlay { padding: 1em; }
    .main-menu__pack { margin-bottom: 1.5em; }
    .main-menu__pack-title { margin: 0 0 0.1em; }
    .main-menu__composer-title { margin: 0 0 0.5em; font-weight: normal; color: #a8adb8; }
    .main-menu__piece-list { list-style: none; margin: 0; padding: 0; }
    .main-menu__piece-row { display: flex; align-items: center; gap: 0.75em; padding: 0.35em 0; }
    .main-menu__piece-info { color: #a8adb8; font-size: 0.9em; }
    .pause-menu { display: flex; flex-direction: column; gap: 0.5em; align-items: flex-start; }
    .game-overlay { position: fixed; top: 0.5em; right: 0.5em; padding: 0; }
  `;
  document.head.appendChild(style);
}
