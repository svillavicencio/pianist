/** Callback fired by the overlay's only affordance: pausing the game. */
export interface GameOverlayCallbacks {
  onPause(): void;
}

/** Handle a screen renderer returns so a future composition root can tear it down before showing another. */
export interface GameOverlayHandle {
  destroy(): void;
}

/** Renders the always-visible in-game overlay: a single "Menu" button, matching touchpianist's pause affordance. */
export function renderGameOverlay(container: HTMLElement, callbacks: GameOverlayCallbacks): GameOverlayHandle {
  const root = document.createElement('div');
  root.className = 'game-overlay';

  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'game-overlay__menu-button';
  menuButton.textContent = 'Menu';
  const handleClick = (): void => callbacks.onPause();
  menuButton.addEventListener('click', handleClick);
  root.appendChild(menuButton);

  container.appendChild(root);

  return {
    destroy(): void {
      menuButton.removeEventListener('click', handleClick);
      root.remove();
    },
  };
}
