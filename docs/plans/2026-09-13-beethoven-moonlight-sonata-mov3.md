# Beethoven Moonlight Sonata Movement 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the complete verified Bernd Krueger performance of Moonlight Sonata movement 3 as a distinct piece in the existing Beethoven pack.

**Architecture:** Preserve and attribute the exact source MIDI, validate source identity/profile before parsing, and generate immutable `Piece` data offline with piecewise tempo conversion and exact-tick attack grouping. Reuse the deterministic formatted serializer proven by the current performance-MIDI mappers.

**Tech Stack:** TypeScript, Vitest, Node.js built-ins, Vite.

---

## Task 1: Preserve source and write RED tests

**Files:**

- Create: `public/midi/mond_3.mid`
- Modify: `public/midi/ATTRIBUTION.md`
- Create: `src/content/pieces/beethovenMoonlightSonataMov3.test.ts`
- Modify: `src/content/catalog.test.ts`

### Step 1: Preserve exact source

Download `http://piano-midi.de/midis/beethoven/mond_3.mid` with `http://piano-midi.de/beeth.htm` as referrer. Require SHA-256 `6f01e20c125731b984ab831c48afa4efbc191e0e70b19dcbeb3b01daaea795a9`. Document Beethoven, Sonata No. 14 Op. 27/2 movement 3, Bernd Krueger, piano-midi.de, and CC BY-SA 3.0 DE.

### Step 2: Write focused failing tests

Expect a distinct `beethoven_moonlight_sonata_mov3` piece with 3,781 attacks. Pin opening `[1, [[37,42]]]`, ending `[410021, [[37,67],[40,67],[44,79],[49,79],[61,83],[64,83],[68,97],[73,97]]]`, velocity diversity, maximum simultaneity 8, chronological timing, positive non-final screen durations, and no duplicate pitch per attack.

### Step 3: Write failing catalog expectations

Expect movement 3 inside the existing Beethoven pack and full data in `contentPieces`, while preserving the existing Moonlight entry and avoiding a duplicate pack.

### Step 4: Run RED

Run the focused piece and catalog tests. Expected: fail because the new module and registration are absent.

---

## Task 2: Build mapper and generated piece

**Files:**

- Create: `scripts/parse-beethoven-moonlight-sonata-mov3.cjs`
- Create: `src/content/pieces/beethovenMoonlightSonataMov3.ts`

### Step 1: Validate source profile

Fail unless the mapper sees the pinned SHA, MIDI format 1, eight tracks, 480 PPQ, 1,223 tempo events, track 1/channel 0 with 3,466 note-ons, track 2/channel 0 with 3,072 note-ons, and zero note-ons in all other tracks.

### Step 2: Generate exact attacks

Select tracks 1 and 2 only. Build the piecewise tick-to-millisecond map, group attacks by exact tick, deduplicate same-pitch attacks by maximum velocity, sort pitches, and assert 6,538 note-ons, 3,781 attacks, zero collisions, 86 velocities, maximum simultaneity 8, and the pinned opening/ending.

### Step 3: Emit formatted static TypeScript

Reuse the dependency-free `formatRawEvents` and repository-formatted template strategy from the corrected current mappers. Use `beethoven_moonlight_sonata_mov3`, `Moonlight Sonata — 3rd Movement`, `Ludwig van Beethoven`, an existing theme, and a proportional `numScreens` value.

### Step 4: Prove byte stability

Generate once, allow automatic formatting, record the module SHA, and run the mapper twice. Require current-before/run-1/run-2 hashes to be identical.

---

## Task 3: Register and verify

**Files:**

- Modify: `src/content/catalog.ts`
- Modify: `src/content/catalog.test.ts`

### Step 1: Register without replacement

Add the movement 3 summary to the existing Beethoven pack and its full data to `contentPieces`. Preserve the prior Moonlight piece and all other entries.

### Step 2: Run GREEN

Run focused piece and catalog tests. Expected: pass.

### Step 3: Run complete checks

Run the full test suite, typecheck, build, and `git diff --check`. Remove generated `.vitest/` and `dist/` artifacts afterward without touching authored or unrelated worktree changes.

### Step 4: Audible checkpoint

Ask the user to verify the opening arpeggios, rapid transitions, repeated chords, climax, and final chord before final candidate review.
