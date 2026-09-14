import type { InputListener, InputSource } from '../../../ports/InputSource';

/** The subset of `EventTarget`'s listener API this adapter needs — lets tests inject `window`, `document`, or a fake. */
export interface EventListenerTarget {
  addEventListener: typeof window.addEventListener;
  removeEventListener: typeof window.removeEventListener;
}

/**
 * An `InputSource` backed by real DOM events. Any key or pointer press/release
 * counts as a press/release, identified by `event.code` (keyboard) or
 * `pointer:<pointerId>` (pointer).
 */
export class DomInputSource implements InputSource {
  private pressListeners: InputListener[] = [];
  private releaseListeners: InputListener[] = [];
  private readonly target: EventListenerTarget;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.press(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.release(event.code);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.press(`pointer:${event.pointerId}`);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.release(`pointer:${event.pointerId}`);
  };

  constructor(target: EventListenerTarget) {
    this.target = target;
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('pointerdown', this.handlePointerDown);
    this.target.addEventListener('pointerup', this.handlePointerUp);
  }

  onPress(listener: InputListener): () => void {
    this.pressListeners.push(listener);
    return () => {
      this.pressListeners = this.pressListeners.filter((registered) => registered !== listener);
    };
  }

  onRelease(listener: InputListener): () => void {
    this.releaseListeners.push(listener);
    return () => {
      this.releaseListeners = this.releaseListeners.filter((registered) => registered !== listener);
    };
  }

  /** Beyond the bare `InputSource` port: detaches the underlying DOM listeners entirely (e.g. when leaving the game screen). */
  destroy(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('pointerdown', this.handlePointerDown);
    this.target.removeEventListener('pointerup', this.handlePointerUp);
  }

  private press(id: string): void {
    for (const listener of this.pressListeners) {
      listener(id);
    }
  }

  private release(id: string): void {
    for (const listener of this.releaseListeners) {
      listener(id);
    }
  }
}
