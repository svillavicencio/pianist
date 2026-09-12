import type { InputSource, TriggerListener } from '../../src/ports/InputSource';

/** An `InputSource` double that lets a test fire triggers manually via `fire()`. */
export class FakeInputSource implements InputSource {
  private listeners: TriggerListener[] = [];

  onTrigger(listener: TriggerListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((registered) => registered !== listener);
    };
  }

  /** Simulate a user trigger — notifies every currently-registered listener. */
  fire(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
