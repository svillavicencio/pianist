import type { PieceCatalog } from '../domain/PieceCatalog';

/** Handle a screen renderer returns so a future composition root can tear it down before showing another. */
export interface MainMenuHandle {
  destroy(): void;
}

/** Renders the piece-picker screen: one section per composer pack, one row per piece, a "Perform" button each. */
export function renderMainMenu(
  container: HTMLElement,
  catalog: PieceCatalog,
  onSelectPiece: (dataName: string) => void,
): MainMenuHandle {
  const root = document.createElement('div');
  root.className = 'main-menu';

  const cleanups: Array<() => void> = [];

  if (catalog.packs.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'main-menu__empty';
    empty.textContent = 'No pieces available yet.';
    root.appendChild(empty);
  }

  for (const pack of catalog.packs) {
    const section = document.createElement('section');
    section.className = 'main-menu__pack';

    const packTitle = document.createElement('h2');
    packTitle.className = 'main-menu__pack-title';
    packTitle.textContent = pack.packDisplay;
    section.appendChild(packTitle);

    const composerTitle = document.createElement('h3');
    composerTitle.className = 'main-menu__composer-title';
    composerTitle.textContent = pack.composerDisplay;
    section.appendChild(composerTitle);

    const list = document.createElement('ul');
    list.className = 'main-menu__piece-list';

    for (const piece of pack.pieces) {
      const row = document.createElement('li');
      row.className = 'main-menu__piece-row';

      const name = document.createElement('span');
      name.className = 'main-menu__piece-name';
      name.textContent = piece.displayName;
      row.appendChild(name);

      if (piece.displayInfo) {
        const info = document.createElement('span');
        info.className = 'main-menu__piece-info';
        info.textContent = piece.displayInfo;
        row.appendChild(info);
      }

      const performButton = document.createElement('button');
      performButton.type = 'button';
      performButton.className = 'main-menu__perform-button';
      performButton.textContent = 'Perform';
      const handleClick = (): void => onSelectPiece(piece.dataName);
      performButton.addEventListener('click', handleClick);
      cleanups.push(() => performButton.removeEventListener('click', handleClick));
      row.appendChild(performButton);

      list.appendChild(row);
    }

    section.appendChild(list);
    root.appendChild(section);
  }

  container.appendChild(root);

  return {
    destroy(): void {
      for (const cleanup of cleanups) cleanup();
      root.remove();
    },
  };
}
