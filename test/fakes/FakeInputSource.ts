import type { InputListener, InputSource } from '../../src/ports/InputSource';

/** An `InputSource` double that lets a test simulate press/release manually. */
export class FakeInputSource implements InputSource {
  private pressListeners: InputListener[] = [];
  private releaseListeners: InputListener[] = [];

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

  /** Simulate pressing `id` — notifies every currently-registered press listener. */
  press(id: string): void {
    for (const listener of this.pressListeners) {
      listener(id);
    }
  }

  /** Simulate releasing `id` — notifies every currently-registered release listener. */
  release(id: string): void {
    for (const listener of this.releaseListeners) {
      listener(id);
    }
  }
}
