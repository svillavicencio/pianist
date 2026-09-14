# Chopin Fantaisie-Impromptu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Chopin's complete *Fantaisie-Impromptu*, Op. 66, as a real-MIDI-derived playable piece in the catalog.

**Architecture:** Keep MIDI parsing offline and ship immutable generated `Piece` data, matching the existing large-piece modules. Reuse the recovered mapper from Claude's global scratchpad, preserve the Pianovera/piano-midi.de source file and attribution, and make only the catalog registration plus focused tests in addition to the new piece module.

**Tech Stack:** TypeScript, Vitest, Node.js offline MIDI parser, Vite.

---

## Task 1: Preserve the source MIDI and mapper artifacts

**Files:**

- Create: `public/midi/chpn_op66.mid`
- Create: `scripts/parse-chopin-fantaisie-impromptu.cjs`
- Create: `public/midi/ATTRIBUTION.md`

### Step 1: Copy the recovered Pianovera MIDI into the repository

Copy `chpn_op66.mid` from the global Claude scratchpad into `public/midi/`.

### Step 2: Adapt the recovered parser into a repository-local script

Copy the recovered `parse.js` to `scripts/parse-chopin-fantaisie-impromptu.cjs`, fix its duplicate-count initialization so it runs without temporal-dead-zone access, and make its input/output paths resolve from the repository. Keep the exact algorithm: format-1 parsing, piecewise tempo mapping, tracks 1-2 note merge, exact-tick grouping, max-velocity deduplication, and ascending pitch sort.

### Step 3: Add source attribution

Document Pianovera/piano-midi.de, the direct source URL, the MIDI filename, and the reported Creative Commons BY-SA 3.0 DE terms in `public/midi/ATTRIBUTION.md`.

### Step 4: Run the parser and verify its summary

Run: `node scripts/parse-chopin-fantaisie-impromptu.cjs`

Expected: 3,050 note-ons, 2,561 chords, 76 distinct velocities, maximum chord size 5, and zero deduplication collisions.

---

## Task 2: Add the generated piece module and regression tests

**Files:**

- Create: `src/content/pieces/chopinFantaisieImpromptu.ts`
- Create: `src/content/pieces/chopinFantaisieImpromptu.test.ts`

### Step 1: Generate the static event data

Use the parser output to populate `RAW_EVENTS` as `[originalTimeMs, [[midi, velocity], ...]]`, then apply the established `screenDurationMs` mapping and export `chopinFantaisieImpromptuPiece`.

### Step 2: Write focused regression tests

Assert the complete 2,561-chord/2,561-screen piece, the opening `[44, 56]` dyad at 0 ms, the final event data from `summary.json`, piecewise timing (including the 2,730 ms second event), velocity variation, maximum five-note simultaneity, and absence of duplicate pitches per chord.

### Step 3: Run the focused tests

Run: `npx vitest run src/content/pieces/chopinFantaisieImpromptu.test.ts`

Expected: PASS.

---

## Task 3: Register the Chopin catalog pack

**Files:**

- Modify: `src/content/catalog.ts`
- Modify: `src/content/catalog.test.ts`

### Step 1: Write catalog expectations

Add assertions for a Chopin composer pack, its display name, the `chopin_fantaisie_impromptu` data name, title, and `amethyst` theme.

### Step 2: Register the import, pack entry, and content map entry

Add a `chopin` pack named `Frédéric Chopin` / `Romantic Favorites`, reference the new piece, and add it to `contentPieces`.

### Step 3: Run catalog tests

Run: `npx vitest run src/content/catalog.test.ts`

Expected: PASS.

---

## Task 4: Verify the complete integration

**Files:**

- Verify all changed files listed above.

### Step 1: Run the full test suite

Run: `npm test`

Expected: all tests pass.

### Step 2: Run typechecking and production build

Run: `npm run typecheck && npm run build`

Expected: no TypeScript errors and a successful Vite build.

### Step 3: Inspect the final diff

Run: `git diff --stat && git status --short` and confirm no unrelated files are included; retain the pre-existing `.gitignore` change without modifying it.

### Step 4: Run Receipt-driven review preflight

After implementation and normalization, call `gentle_review` with `{"operation":"inspect"}` and follow only the returned transition before reporting completion.
