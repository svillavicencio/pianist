/** A press or release of one physical input (a specific key or pointer) — identified by `id` so a later release can be matched to its press. */
export type InputListener = (id: string) => void;

/**
 * Normalizes "the user pressed/released a thing" (any key, any tap) into two
 * abstract signals. The domain never touches KeyboardEvent/PointerEvent/etc —
 * only this. `id` is opaque to callers: it exists only to correlate a later
 * `onRelease` call back to the `onPress` that started it.
 */
export interface InputSource {
  /** Register a listener invoked once per press. Returns an unsubscribe function. */
  onPress(listener: InputListener): () => void;
  /** Register a listener invoked once per release of a previously-pressed id. Returns an unsubscribe function. */
  onRelease(listener: InputListener): () => void;
}
