# Liszt Hungarian Rhapsody No. 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the complete verified Bernd Krueger performance of Liszt's Hungarian Rhapsody No. 2 to the existing Liszt pack.

**Architecture:** Preserve and attribute the exact source MIDI, validate its identity/profile before parsing, and generate immutable `Piece` data offline with piecewise tempo conversion and exact-tick attack grouping. Reuse the deterministic formatted serializer proven by the current performance-MIDI mappers.

**Tech Stack:** TypeScript, Vitest, Node.js built-ins, Vite.

---

## Task 1: Add source and RED tests

**Files:**

- Create: `public/midi/liz_rhap02.mid`
- Modify: `public/midi/ATTRIBUTION.md`
- Create: `src/content/pieces/lisztHungarianRhapsodyNo2.test.ts`
- Modify: `src/content/catalog.test.ts`

### Step 1: Preserve the exact source

Download `http://piano-midi.de/midis/liszt/liz_rhap02.mid` with the canonical page as referrer. Require SHA-256 `19f62d62836e8df9d760de8cb645e6020a05c444651ad974be62ddef9ef1d654`. Document Franz Liszt, Hungarian Rhapsody No. 2, S.244/2; Bernd Krueger; piano-midi.de; and CC BY-SA 3.0 DE.

### Step 2: Write focused failing tests

Expect `liszt_hungarian_rhapsody_no2` with 3,261 exact-tick attacks. Pin opening `[1134, [[61, 77]]]`, ending `[525750, [[30,74],[42,88],[54,91],[66,107]]]`, broad velocity diversity, maximum simultaneity 8, chronological timing, positive screen durations except the final event, and no duplicate pitch within an attack.

### Step 3: Write failing catalog expectations

Expect the piece summary inside the existing Liszt pack and the full piece in `contentPieces`. Do not accept a duplicate pack.

### Step 4: Run RED

Run focused piece and catalog tests. Expected: fail because the module and registration do not yet exist.

---

## Task 2: Build deterministic mapper and generated piece

**Files:**

- Create: `scripts/parse-liszt-hungarian-rhapsody-no2.cjs`
- Create: `src/content/pieces/lisztHungarianRhapsodyNo2.ts`

### Step 1: Validate source identity and track profile

The mapper must fail unless it sees the pinned SHA, MIDI format 1, 17 tracks, 480 PPQ, 2,849 tempo events, track 1/channel 0 with 3,892 note-ons, track 2/channel 0 with 2,868 note-ons, and zero note-ons on all other tracks.

### Step 2: Generate exact attacks

Select tracks 1 and 2 only. Build a piecewise tick-to-millisecond tempo map, group attacks by exact tick, deduplicate same-pitch collisions by maximum velocity, sort pitches, and assert 6,760 note-ons, 3,261 attacks, zero collisions, 84 velocities, maximum simultaneity 8, and the pinned opening/ending.

### Step 3: Emit repository-formatted TypeScript

Reuse the dependency-free `formatRawEvents` strategy from the corrected Chopin and Debussy mappers. Use id/data name `liszt_hungarian_rhapsody_no2`, display name `Hungarian Rhapsody No. 2`, composer `Franz Liszt`, an existing suitable theme, and a proportional existing `numScreens` convention.

### Step 4: Prove byte stability

Generate the module, allow repository formatting, record its SHA, run the mapper twice, and require the current-before/run-1/run-2 hashes to be identical.

---

## Task 3: Register and verify

**Files:**

- Modify: `src/content/catalog.ts`
- Modify: `src/content/catalog.test.ts`

### Step 1: Register in the existing Liszt pack

Add the summary to the current Liszt pack and the full piece to `contentPieces`. Reuse the existing theme and preserve all prior registrations.

### Step 2: Run GREEN

Run focused piece and catalog tests. Expected: pass.

### Step 3: Run complete verification

Run the full test suite, typecheck, build, and `git diff --check`. Remove generated `.vitest/` and `dist/` artifacts afterward without touching authored or pre-existing changes.

### Step 4: Audible checkpoint

Ask the user to verify the slow introduction, Friska transition, fast repeated-note passages, climax, and final chord before final candidate review.
