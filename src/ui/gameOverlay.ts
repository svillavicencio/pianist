/** Callbacks fired by the overlay's affordances: pausing, and seeking within the piece. */
export interface GameOverlayCallbacks {
  onPause(): void;
  /** Fired when the progress bar is clicked; `ratio` is the click position as a 0..1 fraction of the piece. */
  onSeek(ratio: number): void;
}

/** Handle a screen renderer returns so a future composition root can tear it down before showing another. */
export interface GameOverlayHandle {
  /** Updates the progress bar and label to reflect `currentChordIndex` out of `totalChords`. */
  setProgress(currentChordIndex: number, totalChords: number): void;
  destroy(): void;
}

/**
 * Renders the always-visible in-game overlay: a short "how to play" hint, a
 * clickable progress bar showing (and letting you jump within) how far the
 * piece has advanced, and the "Menu" button, matching touchpianist's pause affordance.
 */
export function renderGameOverlay(container: HTMLElement, callbacks: GameOverlayCallbacks): GameOverlayHandle {
  const root = document.createElement('div');
  root.className = 'game-overlay';

  const hint = document.createElement('p');
  hint.className = 'game-overlay__hint';
  hint.textContent = 'Tap, click, or press any key to play the next note';
  root.appendChild(hint);

  const progressTrack = document.createElement('div');
  progressTrack.className = 'game-overlay__progress-track';

  const progressFill = document.createElement('div');
  progressFill.className = 'game-overlay__progress-fill';
  progressTrack.appendChild(progressFill);

  const handleSeek = (event: MouseEvent): void => {
    const rect = progressTrack.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    callbacks.onSeek(Math.min(Math.max(ratio, 0), 1));
  };
  progressTrack.addEventListener('click', handleSeek);
  root.appendChild(progressTrack);

  const progressLabel = document.createElement('span');
  progressLabel.className = 'game-overlay__progress-label';
  progressLabel.textContent = '0 / 0';
  root.appendChild(progressLabel);

  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'game-overlay__menu-button';
  menuButton.textContent = 'Menu';
  const handleClick = (): void => callbacks.onPause();
  menuButton.addEventListener('click', handleClick);
  root.appendChild(menuButton);

  container.appendChild(root);

  return {
    setProgress(currentChordIndex: number, totalChords: number): void {
      const ratio = totalChords > 0 ? currentChordIndex / totalChords : 0;
      const clampedRatio = Math.min(Math.max(ratio, 0), 1);
      progressFill.style.width = `${clampedRatio * 100}%`;
      progressLabel.textContent = `${currentChordIndex} / ${totalChords}`;
    },
    destroy(): void {
      progressTrack.removeEventListener('click', handleSeek);
      menuButton.removeEventListener('click', handleClick);
      root.remove();
    },
  };
}
