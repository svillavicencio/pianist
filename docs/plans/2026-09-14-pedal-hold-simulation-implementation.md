# Pedal-hold Simulation Implementation Plan

**Goal:** Holding any key acts like a sustain pedal — notes from other keys keep ringing regardless of how fast they're released, and everything releases together only when the last held key comes up. Bump the release fade to 600ms.

Full design: `docs/plans/2026-09-14-pedal-hold-simulation-design.md`.

### Task 1: Bump `KEY_RELEASE_SECONDS` to 0.6

**Files:** `src/adapters/web/audio/WebAudioEngine.ts`, `src/adapters/web/audio/WebAudioEngine.test.ts`

- Update the constant `KEY_RELEASE_SECONDS = 0.4` → `0.6`.
- Update the test asserting `{ value: 0, time: 5.4 }` / `[5.4]` → `5.6`.
- Run: `npx vitest run src/adapters/web/audio/WebAudioEngine.test.ts` — expect PASS.

### Task 2: Pedal-hold logic in `main.ts`

**Files:** `src/main.ts`

Add `activePresses: Set<string>` next to `heldNotes`. In the `onPress` handler, add `activePresses.add(id)`. Replace the `onRelease` handler body:

```ts
const unsubscribeRelease = input.onRelease((id) => {
  activePresses.delete(id);
  if (activePresses.size > 0) return; // pedal still down — leave this press's notes ringing

  for (const handles of heldNotes.values()) {
    for (const handle of handles) handle.release();
  }
  heldNotes.clear();
});
```

`releaseAllHeldNotes()` (used on pause) also clears `activePresses`.

Verify: `npx tsc --noEmit` and `npx vitest run` — expect no errors, all tests pass (no dedicated main.ts unit tests exist).

### Task 3: Commit and push

```bash
git add src/adapters/web/audio/WebAudioEngine.ts src/adapters/web/audio/WebAudioEngine.test.ts src/main.ts docs/plans/2026-09-14-pedal-hold-simulation-design.md docs/plans/2026-09-14-pedal-hold-simulation-implementation.md
git commit -m "feat: simulate a sustain pedal via multi-key hold, lengthen release fade to 600ms"
git push origin master
```
