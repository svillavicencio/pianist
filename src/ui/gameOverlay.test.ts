// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderGameOverlay } from './gameOverlay';

describe('renderGameOverlay', () => {
  it('renders a real <button> that calls onPause on click', () => {
    const container = document.createElement('div');
    const onPause = vi.fn();
    renderGameOverlay(container, { onPause });

    const button = container.querySelector<HTMLButtonElement>('.game-overlay__menu-button')!;
    expect(button.tagName).toBe('BUTTON');
    button.click();

    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('calls onPause exactly once per click', () => {
    const container = document.createElement('div');
    const onPause = vi.fn();
    renderGameOverlay(container, { onPause });

    const button = container.querySelector<HTMLButtonElement>('.game-overlay__menu-button')!;
    button.click();
    button.click();

    expect(onPause).toHaveBeenCalledTimes(2);
  });

  it('destroy() empties only what it added and detaches the listener on the old button', () => {
    const container = document.createElement('div');
    const preexisting = document.createElement('p');
    preexisting.className = 'unrelated-sibling';
    container.appendChild(preexisting);

    const onPause = vi.fn();
    const handle = renderGameOverlay(container, { onPause });
    const button = container.querySelector<HTMLButtonElement>('.game-overlay__menu-button')!;

    handle.destroy();

    expect(container.children.length).toBe(1);
    expect(container.querySelector('.unrelated-sibling')).toBe(preexisting);
    button.click();
    expect(onPause).not.toHaveBeenCalled();
  });
});
