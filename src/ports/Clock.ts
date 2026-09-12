/**
 * An injectable source of time, so anything that schedules playback (Watch
 * mode) can be tested deterministically without waiting on real wall-clock
 * time.
 */
export interface Clock {
  /** Current time in milliseconds, on whatever epoch the implementation chooses — only deltas matter. */
  now(): number;
  /** Schedule `callback` to run after `delayMs`. Returns a handle usable with `cancel`. */
  schedule(callback: () => void, delayMs: number): number;
  /** Cancel a previously scheduled callback. Cancelling twice or an unknown handle is a no-op. */
  cancel(handle: number): void;
}
