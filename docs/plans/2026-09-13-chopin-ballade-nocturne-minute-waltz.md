# Chopin Ballade, Nocturne, and Minute Waltz Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three verified human-performance Chopin pieces to the existing composer pack, one audible checkpoint at a time.

**Architecture:** Preserve each source MIDI with accurate attribution/restrictions, validate its SHA before parsing, and generate deterministic static `Piece` data offline. Reuse the proven piecewise tempo and exact-tick attack algorithm while selecting musical tracks/channels explicitly from per-track evidence.

**Tech Stack:** TypeScript, Vitest, Node.js built-in MIDI/crypto tooling, Vite.

---

## Task 1: Add Ballade No. 1 source and RED tests

**Files:**

- Create: `public/midi/chpn_op23.mid`
- Modify: `public/midi/ATTRIBUTION.md`
- Create: `src/content/pieces/chopinBalladeNo1.test.ts`
- Modify: `src/content/catalog.test.ts`

### Step 1: Add failing expectations

Expect a complete `chopin_ballade_no1_op23` piece inside the existing Chopin pack. Pin source/profile expectations from the verified MIDI, plus opening/final attacks and no duplicate pitches.

### Step 2: Run RED

Run: `npx vitest run src/content/pieces/chopinBalladeNo1.test.ts src/content/catalog.test.ts`

Expected: FAIL because the module and catalog entry do not exist.

### Step 3: Preserve source and attribution

Download `http://piano-midi.de/midis/chopin/chpn_op23.mid`; require SHA-256 `8edb6532d13512ea156439d8b07cf8e8292be38a8706617a2bf50165b1a7df03`; document Bernd Krueger and CC BY-SA 3.0 DE.

---

## Task 2: Generate and register Ballade No. 1

**Files:**

- Create: `scripts/parse-chopin-ballade-no1.cjs`
- Create: `src/content/pieces/chopinBalladeNo1.ts`
- Modify: `src/content/catalog.ts`

### Step 1: Inspect and select musical tracks

Report every track's note counts/channels and explicitly select only the piano tracks. Fail if the source hash/header/profile differs.

### Step 2: Generate deterministic static data

Create the mapper using piecewise tempo conversion, exact-tick grouping, maximum-velocity deduplication, stable pitch order, and dependency-free formatted output.

### Step 3: Register in the Chopin pack

Add the piece summary to the existing `chopin` pack and full data to `contentPieces`.

### Step 4: Run GREEN and determinism checks

Run the mapper twice and require an unchanged generated-module SHA. Run focused tests, catalog tests, full tests, typecheck, and build.

### Step 5: Audible checkpoint

Ask the user to verify the Ballade before starting the Nocturne.

---

## Task 3: Add Nocturne Op. 9 No. 2 source and RED tests

**Files:**

- Create: `public/midi/chopin_nocturne_op9_no2.mid`
- Create: `public/midi/chopin-nocturne-op9-no2-ATTRIBUTION.md`
- Create: `src/content/pieces/chopinNocturneOp9No2.test.ts`
- Modify: `src/content/catalog.test.ts`

### Step 1: Preserve the restricted source accurately

Download the Daisuke Inoue-attributed sequence through Kunst der Fuge's published download route. Require SHA-256 `2c4adfd66324487ad4a1667c0f7a79c9fe4091477c11da6863e3d7314caf35d3`. State personal/non-commercial use and no redistribution permission.

### Step 2: Write failing tests

Expect `chopin_nocturne_op9_no2` in the existing Chopin pack. Pin the verified 1,298 note-ons, 627 attack groups, 536 tempo events, 69 velocities, six-note maximum, opening/final attacks, and duplicate-pitch absence.

### Step 3: Run RED

Run focused piece and catalog tests. Expected: FAIL before implementation.

---

## Task 4: Generate and register Nocturne Op. 9 No. 2

**Files:**

- Create: `scripts/parse-chopin-nocturne-op9-no2.cjs`
- Create: `src/content/pieces/chopinNocturneOp9No2.ts`
- Modify: `src/content/catalog.ts`

### Step 1: Audit low-PPQ tracks

Validate format 1, five tracks, 48 PPQ, per-track roles, and selected channels. Preserve all source performance tempo changes and attacks.

### Step 2: Generate and register

Emit deterministic static data and add it to the existing Chopin pack and content map.

### Step 3: Run GREEN and determinism checks

Run the mapper twice, focused/catalog/full tests, typecheck, and build.

### Step 4: Audible checkpoint

Ask the user to verify melody, ornaments, accompaniment, and ending before starting Minute Waltz.

---

## Task 5: Add Minute Waltz source and RED tests

**Files:**

- Create: `public/midi/chopin_minute_waltz_op64_no1.mid`
- Create: `public/midi/chopin-minute-waltz-op64-no1-ATTRIBUTION.md`
- Create: `src/content/pieces/chopinMinuteWaltz.test.ts`
- Modify: `src/content/catalog.test.ts`

### Step 1: Preserve the piano-roll source accurately

Download Kunst der Fuge's Duo-Art MIDI of Ignaz Friedman's performance. Require SHA-256 `137882646e225b14a6f58328d3b6b380efec50322d2780a454a2138ebeafc4ce`. State personal/non-commercial use and no redistribution permission.

### Step 2: Write failing tests

Expect `chopin_minute_waltz_op64_no1` in the existing Chopin pack. Pin 1,465 note-ons, 1,217 attack groups, 44 velocities, four-note maximum, opening/final attacks, and no duplicate pitches. Preserve expressive note placement despite a single global tempo event.

### Step 3: Run RED

Run focused piece and catalog tests. Expected: FAIL before implementation.

---

## Task 6: Generate and register Minute Waltz

**Files:**

- Create: `scripts/parse-chopin-minute-waltz.cjs`
- Create: `src/content/pieces/chopinMinuteWaltz.ts`
- Modify: `src/content/catalog.ts`

### Step 1: Inspect and select piano-roll tracks

Validate format 1, eight tracks, 192 PPQ, track/channel roles, and source integrity.

### Step 2: Generate and register

Generate byte-stable static data and add the piece to the existing Chopin pack and content map.

### Step 3: Run GREEN and determinism checks

Run the mapper twice, focused/catalog/full tests, typecheck, and build.

### Step 4: Audible checkpoint

Ask the user to verify the complete Minute Waltz performance.

---

## Task 7: Final verification and RDD preflight

### Step 1: Verify all source and output hashes

Run all current repository MIDI mappers. Confirm each source hash and generated-module determinism.

### Step 2: Run the complete verification suite

Run: `npm test && npm run typecheck && npm run build && git diff --check`

Expected: all tests pass, no type errors, successful build, and no whitespace errors.

### Step 3: Clean generated artifacts

Remove `.vitest/`, `.codegraph/`, `dist/`, and temporary comparison files without touching authored changes or the user's pre-existing `.gitignore` modification.

### Step 4: Inspect scope

Confirm no mechanical substitute MIDI, unauthorized extra download, duplicate Chopin pack, or unrelated source change entered the candidate.

### Step 5: Run Receipt-driven review preflight

Call `gentle_review` with `{"operation":"inspect"}`, select intended untracked authored files when offered, and follow the provider transition exactly before reporting completion.
