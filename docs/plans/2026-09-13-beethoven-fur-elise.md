# Beethoven Für Elise Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the complete verified Bernd Krueger performance of Für Elise as a distinct piece in the existing Beethoven pack.

**Architecture:** Preserve and attribute the exact source MIDI, validate source identity and musical profile before parsing, and generate immutable `Piece` data offline with piecewise tempo conversion and exact-tick attack grouping. Reuse the deterministic formatted serializer proven by the current performance-MIDI mappers.

**Tech Stack:** TypeScript, Vitest, Node.js built-ins, Vite.

---

## Task 1: Preserve source and write RED tests

**Files:**

- Create: `public/midi/elise.mid`
- Modify: `public/midi/ATTRIBUTION.md`
- Create: `src/content/pieces/beethovenFurElise.test.ts`
- Modify: `src/content/catalog.test.ts`

### Step 1: Preserve exact source

Download `http://piano-midi.de/midis/beethoven/elise.mid` with `http://piano-midi.de/beeth.htm` as referrer. Require SHA-256 `a1481bdafe94d33e0de8934c97aec45534c908bc797bae7293f626074aec2e07`. Document Beethoven, Für Elise/WoO 59, Bernd Krueger, piano-midi.de, and CC BY-SA 3.0 DE.

### Step 2: Write focused failing tests

Expect `beethoven_fur_elise` with 785 attacks. Pin opening `[867, [[76,36]]]`, ending `[164981, [[33,17],[45,25],[69,36]]]`, 52 velocities, maximum simultaneity 6, chronological timing, positive non-final screen durations, and no duplicate pitch per attack. Treat the actual measured MIDI timing as authoritative instead of the catalog page's 3:48 label.

### Step 3: Write failing catalog expectations

Expect Für Elise inside the existing Beethoven pack and full data in `contentPieces`, preserving every existing entry and avoiding a duplicate pack.

### Step 4: Run RED

Run focused piece and catalog tests. Expected: fail because the module and registration do not yet exist.

---

## Task 2: Build mapper and generated piece

**Files:**

- Create: `scripts/parse-beethoven-fur-elise.cjs`
- Create: `src/content/pieces/beethovenFurElise.ts`

### Step 1: Validate source profile

Fail unless the mapper sees the pinned SHA, MIDI format 1, eight tracks, 480 PPQ, 923 tempo events, track 1/channel 0 with 601 note-ons, track 2/channel 0 with 440 note-ons, and zero note-ons on all other tracks.

### Step 2: Generate exact attacks

Select tracks 1 and 2 only. Build the piecewise tick-to-millisecond map, group attacks by exact tick, deduplicate same-pitch attacks by maximum velocity, sort pitches, and assert 1,041 note-ons, 785 attacks, zero collisions, 52 velocities, maximum simultaneity 6, and the pinned opening/ending.

### Step 3: Emit formatted static TypeScript

Reuse the dependency-free `formatRawEvents` and repository-formatted template strategy from the existing verified mappers. Use `beethoven_fur_elise`, `Für Elise`, `Ludwig van Beethoven`, an existing theme, and proportional `numScreens`.

### Step 4: Prove byte stability

Generate once, allow automatic formatting, record the module SHA, and run the mapper twice. Require current-before/run-1/run-2 hashes to be identical.

---

## Task 3: Register and verify

**Files:**

- Modify: `src/content/catalog.ts`
- Modify: `src/content/catalog.test.ts`

### Step 1: Register without replacement

Add Für Elise to the existing Beethoven pack and `contentPieces`. Preserve all current pieces.

### Step 2: Run GREEN

Run focused piece and catalog tests. Expected: pass.

### Step 3: Run complete checks

Run the full test suite, typecheck, build, and `git diff --check`. Remove generated `.vitest/` and `dist/` artifacts afterward without touching `.gitignore` or other user-owned changes.

### Step 4: Audible checkpoint

Ask the user to verify the familiar refrain, contrasting episodes, return, and final chord.

---

## Task 4: Audit deployment pipeline

**Files:**

- Read: repository workflow/config/build/deployment files discovered from the project

### Step 1: Map deployment activation

Identify the exact branch trigger, GitHub Actions workflow, Pages publishing mechanism, permissions, environment, build command, artifact path, base URL, and required secrets/settings.

### Step 2: Verify deployment preconditions

Confirm whether a commit and push to `master` are sufficient, whether the local branch/remote diverge, and whether generated content is included in the production build.

### Step 3: Present the release action

Report the exact safe command sequence and risks. Do not push, merge, publish, alter workflow configuration, or trigger deployment without explicit user authorization.
