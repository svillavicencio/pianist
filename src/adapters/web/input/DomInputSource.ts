import type { InputListener, InputSource } from '../../../ports/InputSource';

/** The subset of `EventTarget`'s listener API this adapter needs — lets tests inject `window`, `document`, or a fake. */
export interface EventListenerTarget {
  addEventListener: typeof window.addEventListener;
  removeEventListener: typeof window.removeEventListener;
}

/**
 * An `InputSource` backed by real DOM events. Any key or pointer press/release
 * counts as a press/release, identified by `event.code` (keyboard) or
 * `pointer:<pointerId>` (pointer). OS key auto-repeat is filtered out — a held
 * key fires one press, not a stream of them. On window blur (e.g. alt-tab),
 * every id still tracked as pressed is force-released, since the browser
 * doesn't reliably send `keyup`/`pointerup` for something still physically
 * held when focus is lost.
 */
export class DomInputSource implements InputSource {
  private pressListeners: InputListener[] = [];
  private releaseListeners: InputListener[] = [];
  private readonly pressedIds = new Set<string>();
  private readonly target: EventListenerTarget;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
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

  private readonly handleBlur = (): void => {
    for (const id of Array.from(this.pressedIds)) {
      this.release(id);
    }
  };

  constructor(target: EventListenerTarget) {
    this.target = target;
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('pointerdown', this.handlePointerDown);
    this.target.addEventListener('pointerup', this.handlePointerUp);
    this.target.addEventListener('pointercancel', this.handlePointerUp);
    this.target.addEventListener('blur', this.handleBlur);
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
    this.target.removeEventListener('pointercancel', this.handlePointerUp);
    this.target.removeEventListener('blur', this.handleBlur);
  }

  private press(id: string): void {
    this.pressedIds.add(id);
    for (const listener of this.pressListeners) {
      listener(id);
    }
  }

  private release(id: string): void {
    if (!this.pressedIds.delete(id)) return;
    for (const listener of this.releaseListeners) {
      listener(id);
    }
  }
}
