/** Callbacks fired by the pause screen's three actions — each maps to exactly one button. */
export interface PauseMenuCallbacks {
  onResume(): void;
  onRestart(): void;
  onMainMenu(): void;
}

/** Handle a screen renderer returns so a future composition root can tear it down before showing another. */
export interface PauseMenuHandle {
  destroy(): void;
}

/** Renders the in-game pause screen: Resume, Restart, and Main Menu, one real `<button>` each. */
export function renderPauseMenu(container: HTMLElement, callbacks: PauseMenuCallbacks): PauseMenuHandle {
  const scrim = document.createElement('div');
  scrim.className = 'pause-menu__scrim';
  container.appendChild(scrim);

  const root = document.createElement('div');
  root.className = 'pause-menu';

  const cleanups: Array<() => void> = [];

  const addButton = (className: string, label: string, onClick: () => void): void => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    cleanups.push(() => button.removeEventListener('click', onClick));
    root.appendChild(button);
  };

  addButton('pause-menu__resume-button', 'Resume', () => callbacks.onResume());
  addButton('pause-menu__restart-button', 'Restart', () => callbacks.onRestart());
  addButton('pause-menu__main-menu-button', 'Main Menu', () => callbacks.onMainMenu());

  container.appendChild(root);

  return {
    destroy(): void {
      for (const cleanup of cleanups) cleanup();
      root.remove();
      scrim.remove();
    },
  };
}
