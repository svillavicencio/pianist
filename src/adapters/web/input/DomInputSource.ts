import type { InputSource, TriggerListener } from '../../../ports/InputSource';

/** The subset of `EventTarget`'s listener API this adapter needs — lets tests inject `window`, `document`, or a fake. */
export interface EventListenerTarget {
  addEventListener: typeof window.addEventListener;
  removeEventListener: typeof window.removeEventListener;
}

/** An `InputSource` backed by real DOM events — any keydown or pointerdown counts as a trigger. */
export class DomInputSource implements InputSource {
  private listeners: TriggerListener[] = [];
  private readonly target: EventListenerTarget;
  private readonly handleEvent = (): void => {
    for (const listener of this.listeners) {
      listener();
    }
  };

  constructor(target: EventListenerTarget) {
    this.target = target;
    this.target.addEventListener('keydown', this.handleEvent);
    this.target.addEventListener('pointerdown', this.handleEvent);
  }

  onTrigger(listener: TriggerListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((registered) => registered !== listener);
    };
  }

  /** Beyond the bare `InputSource` port: detaches the underlying DOM listeners entirely (e.g. when leaving the game screen). */
  destroy(): void {
    this.target.removeEventListener('keydown', this.handleEvent);
    this.target.removeEventListener('pointerdown', this.handleEvent);
  }
}
