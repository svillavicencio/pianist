import type { PieceCatalog } from '../domain/PieceCatalog';

/** Callbacks fired by the piece-picker screen's two per-row affordances. */
export interface MainMenuCallbacks {
  onSelectPiece(dataName: string): void;
  /** Fired when a piece's "Preview" button is clicked — toggles a short audio preview of that piece. */
  onPreviewPiece(dataName: string): void;
}

/** Handle a screen renderer returns so a future composition root can tear it down before showing another. */
export interface MainMenuHandle {
  /** Marks `dataName` as the piece currently previewing (flips its button to "Stop"), or clears every row when `null`. */
  setPreviewing(dataName: string | null): void;
  destroy(): void;
}

/** Renders the piece-picker screen: one section per composer pack, one row per piece, Preview + Perform buttons each. */
export function renderMainMenu(
  container: HTMLElement,
  catalog: PieceCatalog,
  callbacks: MainMenuCallbacks,
): MainMenuHandle {
  const root = document.createElement('div');
  root.className = 'main-menu';

  const cleanups: Array<() => void> = [];
  const previewRows: Array<{ dataName: string; button: HTMLButtonElement; row: HTMLElement }> = [];

  const header = document.createElement('header');
  header.className = 'main-menu__header';

  const title = document.createElement('h1');
  title.className = 'main-menu__title';
  title.textContent = 'gordopianist';
  header.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.className = 'main-menu__subtitle';
  subtitle.textContent = 'Preview a piece below, then tap, click, or press any key to play its next note.';
  header.appendChild(subtitle);

  root.appendChild(header);

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

      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.className = 'main-menu__preview-button';
      previewButton.textContent = '▶ Preview';
      const handlePreviewClick = (): void => callbacks.onPreviewPiece(piece.dataName);
      previewButton.addEventListener('click', handlePreviewClick);
      cleanups.push(() => previewButton.removeEventListener('click', handlePreviewClick));
      row.appendChild(previewButton);
      previewRows.push({ dataName: piece.dataName, button: previewButton, row });

      const performButton = document.createElement('button');
      performButton.type = 'button';
      performButton.className = 'main-menu__perform-button';
      performButton.textContent = 'Perform';
      const handleClick = (): void => callbacks.onSelectPiece(piece.dataName);
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
    setPreviewing(dataName: string | null): void {
      for (const entry of previewRows) {
        const isPreviewing = entry.dataName === dataName;
        entry.button.textContent = isPreviewing ? '■ Stop' : '▶ Preview';
        entry.row.classList.toggle('main-menu__piece-row--previewing', isPreviewing);
      }
    },
    destroy(): void {
      for (const cleanup of cleanups) cleanup();
      root.remove();
    },
  };
}
