/** A single normalized user action meant to advance the piece — a keypress or a tap, we don't care which. */
export type TriggerListener = () => void;

/**
 * Normalizes "the user did a thing" (any key, any tap) into one abstract
 * signal. The domain never touches KeyboardEvent/PointerEvent/etc — only this.
 */
export interface InputSource {
  /** Register a listener invoked once per user trigger. Returns an unsubscribe function. */
  onTrigger(listener: TriggerListener): () => void;
}
