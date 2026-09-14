# Verified Debussy and Heroic Polonaise Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Correct Debussy with a real-performance source, then add a verified Heroic Polonaise.

**Architecture:** Keep MIDI ingestion offline and generate immutable TypeScript `Piece` modules. The initial Pianovera/Mutopia Debussy source choice is superseded: SHA `4eee9a...` belonged to that source, while the verified current piano-midi.de performance source is SHA `4dee23...`. Deliver the work in two source-verified stages with an audible checkpoint after each stage; reuse exact-tick attack grouping and piecewise tempo conversion, while making track/channel selection explicit and testable.

**Tech Stack:** TypeScript, Vitest, Node.js MIDI parsing, Vite.

---

## Task 1: Replace Debussy's unsuitable engraving MIDI

The initial Pianovera/Mutopia source choice and its SHA `4eee9a...` are superseded by the verified piano-midi.de CC BY-SA 3.0 DE performance source, current SHA `4dee23...`.

**Files:**

- Replace: `public/midi/debussy_clair_de_lune.mid`
- Modify: `public/midi/debussy-clair-de-lune-ATTRIBUTION.md`
- Modify: `scripts/parse-debussy-clair-de-lune.cjs`
- Regenerate: `src/content/pieces/debussyClairDeLune.ts`
- Modify: `src/content/pieces/debussyClairDeLune.test.ts`

### Step 1: Write corrected source expectations

Change the focused tests to expect the audited piano-midi.de performance profile: format 1, seven tracks, 480 PPQ, 733 tempo events, 1,491 note-ons, 815 grouped attacks, 58 velocities, one collision, and maximum simultaneity seven. Pin the verified opening and final events.

### Step 2: Run the focused test to establish RED

Run: `npx vitest run src/content/pieces/debussyClairDeLune.test.ts`

Expected: FAIL against the current 763-event flat-velocity mapping.

### Step 3: Replace the source and update attribution

Download `http://piano-midi.de/midis/debussy/deb_clai.mid`, record Bernd Krueger and CC BY-SA 3.0 DE, and remove claims that Pianovera provided a human performance.

### Step 4: Make track selection observable

Update the mapper to report per-track note counts and selected musical tracks/channels. Exclude non-note control tracks by evidence rather than blindly flattening every track. Keep exact-tick grouping and maximum-velocity deduplication.

### Step 5: Regenerate and verify GREEN

Run the mapper and focused test. Expected: the audited statistics above and all Debussy tests pass.

### Step 6: Run integration checks

Run: `npx vitest run src/content/catalog.test.ts && npm run typecheck`

Expected: PASS.

### Step 7: Audible checkpoint

Ask the user to play the corrected Debussy piece. Do not begin the Polonaise until the user confirms the notes now correspond.

---

## Task 2: Add Chopin's Heroic Polonaise

**Files:**

- Create: `public/midi/chpn_op53.mid`
- Modify: `public/midi/ATTRIBUTION.md`
- Create: `scripts/parse-chopin-heroic-polonaise.cjs`
- Create: `src/content/pieces/chopinHeroicPolonaise.ts`
- Create: `src/content/pieces/chopinHeroicPolonaise.test.ts`
- Modify: `src/content/catalog.ts`
- Modify: `src/content/catalog.test.ts`

### Step 1: Add failing piece and catalog tests

Expect `chopin_heroic_polonaise_op53` in the existing Chopin pack. Pin the audited source profile: format 1, eight tracks, 480 PPQ, 1,946 tempo events, 6,052 note-ons, 2,214 grouped attacks, 83 velocities, zero collisions, and maximum simultaneity eight. Add opening/final event assertions derived directly from the source.

### Step 2: Run tests to establish RED

Run: `npx vitest run src/content/pieces/chopinHeroicPolonaise.test.ts src/content/catalog.test.ts`

Expected: FAIL because the module and catalog entry do not exist.

### Step 3: Preserve the source and attribution

Download `http://piano-midi.de/midis/chopin/chpn_op53.mid` and document Bernd Krueger and CC BY-SA 3.0 DE.

### Step 4: Generate the static piece

Create the mapper with explicit note-track selection, piecewise timing, exact-tick grouping, maximum-velocity deduplication, and stable pitch ordering. Generate the complete `Piece` module.

### Step 5: Register it in the existing Chopin pack

Add the summary to the current Chopin pack and the full piece to `contentPieces`; do not create a duplicate composer pack.

### Step 6: Run GREEN checks

Run the mapper, focused tests, catalog tests, and typecheck. Expected: PASS with the audited source statistics.

### Step 7: Audible checkpoint

Ask the user to play the complete Polonaise.

---

## Task 3: Final verification and review

### Step 1: Run all verification

Run: `npm test && npm run typecheck && npm run build`

Expected: all tests pass, no type errors, and Vite builds successfully.

### Step 2: Remove generated artifacts

Remove `.vitest/`, `.codegraph/`, and any untracked build/cache output created during verification, without touching authored source or the user's pre-existing `.gitignore` change.

### Step 3: Inspect final scope

Run: `git status --short`, `git diff --check`, and a complete changed-file inventory. Confirm no alternate MIDI downloads or temporary comparison files entered the repository.

### Step 4: Run Receipt-driven review preflight

Call `gentle_review` with `{"operation":"inspect"}`, select only intended untracked authored files when offered, and follow the provider transition exactly before reporting completion.
