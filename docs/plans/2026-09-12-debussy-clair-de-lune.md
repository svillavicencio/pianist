# Debussy Clair de lune Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Debussy's complete *Clair de lune* as a real-MIDI-derived playable piece in the catalog.

**Architecture:** The initial Pianovera/Mutopia source choice is superseded by the verified Bernd Krueger piano-midi.de performance MIDI (CC BY-SA 3.0 DE). Parse that source offline with the existing repository-local mapper pattern and ship generated static `Piece` data. Keep the change isolated to source/attribution artifacts, one generated piece and test, and catalog registration/tests.

**Tech Stack:** TypeScript, Vitest, Node.js MIDI parser, Vite.

---

## Task 1: Acquire and map the source MIDI

**Files:**

- Create: `public/midi/debussy_clair_de_lune.mid`
- Create: `public/midi/debussy-clair-de-lune-ATTRIBUTION.md`
- Create: `scripts/parse-debussy-clair-de-lune.cjs`

#### Step 1: Record the superseded source choice

The initial Pianovera/Mutopia source choice was superseded after verification showed that the piano-midi.de performance is the appropriate source.

#### Step 2: Use the verified piano-midi.de MIDI

The Pianovera public-domain MIDI instruction is superseded. Use the verified MIDI at `http://piano-midi.de/midis/debussy/deb_clai.mid`, by Bernd Krueger, licensed CC BY-SA 3.0 DE, and store it as `public/midi/debussy_clair_de_lune.mid`.

#### Step 3: Adapt the existing offline mapper

Create a repository-local CommonJS script based on `scripts/parse-chopin-fantaisie-impromptu.cjs`. Resolve paths from the repository, parse all relevant musical tracks, build piecewise tempo timing, group note-ons by exact tick, deduplicate same-pitch attacks using maximum velocity, sort pitches, and emit mapper diagnostics plus generated raw event data.

#### Step 4: Record attribution

The Pianovera attribution and public-domain documentation instruction is superseded. Document the verified source URL `http://piano-midi.de/midis/debussy/deb_clai.mid`, Bernd Krueger as author, the CC BY-SA 3.0 DE license, title/composer, and the fact that the shipped data is generated from this file.

#### Step 5: Run the mapper and record its summary

Run: `node scripts/parse-debussy-clair-de-lune.cjs`

Expected: the script completes and reports stable note-on/chord counts, tempo events, velocity diversity, and collision count for use in regression tests.

---

## Task 2: Add generated piece data and tests

**Files:**

- Create: `src/content/pieces/debussyClairDeLune.ts`
- Create: `src/content/pieces/debussyClairDeLune.test.ts`

#### Step 1: Generate the static module

Use the mapper output to populate `RAW_EVENTS`, derive `screenDurationMs` from adjacent events, and export `debussyClairDeLunePiece` with a stable data name, display title, and existing visual theme.

#### Step 2: Write regression tests

Assert the mapper's complete chord count, opening and final event data, tempo-derived timing, varying velocities, maximum simultaneous-note count, and no duplicate MIDI pitches inside a chord.

#### Step 3: Run focused tests

Run: `npx vitest run src/content/pieces/debussyClairDeLune.test.ts`

Expected: PASS.

---

## Task 3: Register Debussy in the catalog

**Files:**

- Modify: `src/content/catalog.ts`
- Modify: `src/content/catalog.test.ts`

#### Step 1: Add catalog regression coverage

Assert that the catalog exposes a Debussy pack and finds the Clair de lune summary by its data name, title, and theme.

#### Step 2: Register the pack and piece

Add the Debussy import, a `debussy` composer pack, its piece summary, and the full piece to `contentPieces`.

#### Step 3: Run catalog tests

Run: `npx vitest run src/content/catalog.test.ts`

Expected: PASS.

---

## Task 4: Verify and review

#### Step 1: Run the complete test suite

Run: `npm test`

Expected: all tests pass.

#### Step 2: Run typecheck and build

Run: `npm run typecheck && npm run build`

Expected: no type errors and a successful Vite build.

#### Step 3: Inspect scope and artifacts

Run: `git status --short && git diff --stat`; remove only generated test/build artifacts and confirm the pre-existing `.gitignore` change remains untouched.

#### Step 4: Run RDD review preflight

After implementation is normalized, call `gentle_review` with `{"operation":"inspect"}` and follow only its returned transition before reporting completion.
