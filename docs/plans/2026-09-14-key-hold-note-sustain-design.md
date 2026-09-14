# Key-hold note sustain (piano pedal simulation)

## Problem

Notes are triggered on `keydown`/`pointerdown` and simply play out their full
sample decay — there is no way for the player to control how long a note
rings by controlling how long they hold the key. Holding a physical key also
has an existing bug: the OS's keyboard auto-repeat keeps firing `keydown`
(since `event.repeat` is never checked), which re-triggers `pieceEngine`
rapidly and stacks many different notes on top of each other ("se tocan
todas juntas").

## Goal

Holding a key sustains its note for as long as it's held (natural sample
decay, since real piano samples already decay on their own). Releasing the
key early cuts the note with a short fade-out — simulating a piano damper:
holding = damper up, releasing = damper falls and mutes the string.

## Design

### `InputSource` port

Replace `onTrigger(): () => void` with an id-correlated press/release pair:

```ts
export type InputListener = (id: string) => void;

export interface InputSource {
  onPress(listener: InputListener): () => void;
  onRelease(listener: InputListener): () => void;
}
```

`DomInputSource`:
- `keydown` → ignore when `event.repeat` is true; otherwise fire `onPress(event.code)`.
- `keyup` → fire `onRelease(event.code)`.
- `pointerdown` → fire `onPress('pointer:' + event.pointerId)`.
- `pointerup` and `pointercancel` → fire `onRelease('pointer:' + event.pointerId)`.
- Tracks an internal `Set<string>` of currently-pressed ids. On `blur`, fires
  `onRelease` for every id still in the set (covers alt-tab / focus loss,
  where the browser may never send `keyup` for a physically-held key).

### `AudioEngine` port

`noteOn` returns a handle instead of `void`; `noteOff(midi)` is removed from
the port — release always goes through the handle of the specific voice that
was started.

```ts
export interface NoteHandle {
  release(): void;
}

export interface AudioEngine {
  init(): Promise<void>;
  noteOn(midi: MidiNote, velocity: Velocity): NoteHandle;
}
```

`WebAudioEngine` keeps its existing `Map<MidiNote, ActiveNote>` (used for the
retrigger-cuts-previous-same-pitch behavior, unchanged) but each `noteOn`
also returns a handle closing over the exact `ActiveNote` object it created.
`release()` only fades/stops if `active.get(midi) === thatExactVoice` — if a
retrigger already replaced it, `release()` is a no-op. This makes explicit
release-by-key and implicit retrigger-cut independent, so two overlapping
holds of the same pitch never stop each other's wrong voice.

The existing `RELEASE_SECONDS = 0.03` fade is reused for both retrigger-cut
and manual release — no new constant.

### `main.ts` wiring

```
Map<string, NoteHandle[]>   // press id -> handles it started
```

- `onPress(id)`: if paused, ignore. Trigger `pieceEngine.trigger()`, `noteOn`
  each resulting note, store the handles under `id`.
- `onRelease(id)`: look up `id`, call `.release()` on each stored handle,
  delete the entry.
- On pause: release every currently-held handle and clear the map, so a note
  never keeps sounding behind the pause menu.

## Edge cases covered

- OS key auto-repeat no longer spams triggers (fixes the "all notes at once" bug).
- Two physical keys held at once are tracked and released independently.
- Same pitch retriggered while an earlier hold of it is still active: the
  earlier hold's later release is a safe no-op, never cuts the new voice.
- Losing window focus while a key is physically held no longer leaves a note
  stuck sustaining forever.
- Quick press+release still gets the existing 30ms fade — no minimum note
  duration needed.

## Blast radius

- `src/ports/InputSource.ts`, `src/ports/AudioEngine.ts` — signature changes.
- `src/adapters/web/input/DomInputSource.ts` (+ its test).
- `src/adapters/web/audio/WebAudioEngine.ts` (+ its test).
- `test/fakes/FakeInputSource.ts`, `test/fakes/FakeAudioEngine.ts` (+ their tests).
- `src/main.ts` — trigger wiring (both the gameplay handler and the preview
  playback loop, which only needs to ignore the returned handle).

No other `InputSource`/`AudioEngine` implementations exist in the codebase.
