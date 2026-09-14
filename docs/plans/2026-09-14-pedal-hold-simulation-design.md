# Pedal-hold simulation (touchpianist-style)

## Problem

Each press/release is currently tracked independently: holding key A sustains
only A's notes, and tapping key B while A is still held starts B's own notes
which get cut (with the 400ms release fade) as soon as B is released — even
though A is still ringing. In touchpianist, holding any key acts like a
sustain pedal: while at least one key is down, every note played keeps
ringing regardless of how quickly its own key is released, and everything
cuts together only when the last held key finally comes up.

## Design

Lives entirely in `main.ts` — no `InputSource`/`AudioEngine` port changes.

Add `activePresses: Set<string>` alongside the existing `heldNotes: Map<string, NoteHandle[]>`.

- `onPress(id)`: unchanged except also `activePresses.add(id)`.
- `onRelease(id)`: `activePresses.delete(id)`.
  - If `activePresses` is now empty (the last held key just came up — the
    pedal fully lifts): release every handle in `heldNotes` (this press's and
    any deferred from earlier releases while the pedal was still down), then
    clear `heldNotes`.
  - Otherwise (something else is still held — pedal still down): do nothing
    else. This press's notes stay in `heldNotes`, unreleased, ringing.

A single key tapped or held alone (nothing else ever pressed concurrently)
behaves exactly as before: `activePresses` goes straight to empty on its own
release, so it flushes immediately.

`releaseAllHeldNotes()` (used on pause) also clears `activePresses`, so
pausing silences everything regardless of pedal state.

## Other change

Bump `KEY_RELEASE_SECONDS` from 0.4 to 0.6 (`WebAudioEngine.ts`) — the retrigger
fade (`RETRIGGER_RELEASE_SECONDS = 0.03`) is untouched.

## Rejected alternative

A dedicated "pedal key" (e.g. spacebar) separate from note keys — not what
touchpianist does (it's ordinary multi-key holding, not a dedicated control)
and adds a control nobody asked for.
