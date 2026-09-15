# Archive Report: Upgrade Piano Audio Realism

**Change**: `upgrade-piano-audio-realism`
**Archived**: 2026-09-14
**Artifact Store**: openspec
**Status**: **ARCHIVED WITH PENDING HUMAN GATE** (not a defect; intentional risk acceptance by maintainer)

## Executive Summary

This change upgrades the piano audio from an eight-file baseline to a verified 641-file Salamander Yamaha C5 sampler with progressive loading, independent voices, and measured output safety. Implementation is complete, automated verification passes all code-level requirements with zero CRITICAL findings, and all six in-scope code blockers are confirmed fixed. The change closes with `verify-report` verdict **FAIL** — not because of remaining defects, but because the specification's own acceptance criteria require a human A/B listening session before production cutover, and that human gate has not yet occurred. The project maintainer has explicitly reviewed this situation and explicitly authorized archiving and shipping this change with that pending human listening gate still open, as a deliberate, informed risk acceptance for their personal project. This archive records that decision and closes the SDD cycle.

## Verification Status

### Verdict and Root Cause

**Verify-report verdict**: `fail` (evidence_revision: `sha256:80fc730072379897a2d9ef43e8ade3d41e6c5847bd41695997dfa004ecc93def`)
**Reason for FAIL**: Spec-completeness gate requiring human listening, not code defects.

The specification defines 15 requirements and 30 scenarios. Automated testing covers 7/15 requirements and 19/30 scenarios. The verdict is `fail` because `gentle-ai sdd-verify-validate` refuses a passing verdict when coverage falls below totals (7<15, 19<30). This is a schema-level completeness gate, not a claim of defects.

### Why the Remaining Coverage Cannot Be Automated

Two scenarios structurally require human listening and are correctly not automatable:

1. **"Pumping or source clipping is audible"** (Requirement: Headroom and limiter/compressor safety)
   - Spec text: "Automated tests MUST NOT substitute for this listening gate"
   - Measurement of numeric peak values cannot prove a sound is acceptable to human ears
   - Human listening is the sole valid test for audible artifacts

2. **"A/B evidence passes"** (Requirement: Human A/B listening gate before cutover)
   - Spec text: "human listening evidence MUST record ... observations, and an explicit pass/fail decision"
   - Defines required passages, loudness-normalization method, listener details, browser conditions, and specific observation fields
   - Only a human listener comparing the old and new paths can produce this evidence

Several other scenarios (endpoint-key handling, dense-chord peak measurement, unsupported-pedal diagnostics, automated rollback proof) were partial/untested in the prior verification and carry forward as partial; they are not part of the named blockers below.

### Code-Level Blockers — All Confirmed Fixed

All six in-scope code blockers from the failed prior verification are **independently re-confirmed fixed** per the verify-report's own independent re-derivation this session:

| Blocker | Area | Status | Evidence |
|---------|------|--------|----------|
| 1. Full-bank progressive loading not wired | `realPianoSamples.ts`, `progressivePianoLoader.ts`, `main.ts` | ✅ FIXED | `decodeIndex < 45` test proves priority scheduling; piece MIDIs fed into prewarming |
| 2. Harmonic routing cannot resolve verified assets | `realPianoSamples.ts`, `harmonicRouting.test.ts` | ✅ FIXED | Real provider harmonic warming test; `getHarmonic(midi, velocity)` returns decoded buffer after prewarm |
| 3. 64-voice cap not actually enforced | `WebAudioEngine.ts:205` | ✅ FIXED | End-to-end test drives 88 note-ons; `activeVoices === 64`, `voiceSteals === 24` (hardened confirmation) |
| 4. No-compatible-asset fallback boundary missing | `WebAudioEngine.ts:56-69`, `main.ts:167-174` | ✅ FIXED | Real, unwarmed provider routes to legacy engine; observable `audio-error` status when no fallback |
| 5. Autoplay/context recovery not observable | `main.ts:45-55,357` | ✅ FIXED | Recovery publishes `audio-context-blocked`, composition wires `guardedTrigger` into real performance handler; halves proven (note: full recovery cycle is not composed into a single test; see Warnings) |
| 6. Validator/intake fail-closed coverage incomplete | `validate-piano-assets.cjs`, `validate-piano-assets.test.mjs` | ✅ FIXED | 14 negative-case tests reject missing anchors, layers, grouping, traversal, duplication, bad role identity, provenance mismatches, byte totals (note: synthetic file corruption not tested; see Warnings) |

**Evidence base**: verify-report independently re-ran source inspection and actual test execution for all blockers in the same session. This is not a re-read of `apply-progress.md` claims — it is direct command execution and source reading at verification time.

### Test Command Results

All verification commands passed:

| Command | Result | Note |
|---------|--------|------|
| `npm test` | 358 tests, 43 files | ✅ PASS — all green |
| `npm run typecheck` | 0 errors | ✅ PASS — clean |
| `npm run build` | ✅ PASS | Non-blocking Vite chunk-size warning (pre-existing) |
| `npm run validate:piano-assets` | 641 files, 90,413,373 bytes | ✅ PASS — exact inventory: 480 attacks, 88 releases, 69 harmonics, 4 pedals |

### Git Staging Integrity

All six files that the apply agent initially reported as "lost" were independently confirmed to be staged and complete in this verification session:

- `package.json` — staged with content
- `public/piano-samples/ATTRIBUTION.md` — staged with content
- `src/adapters/web/audio/WebAudioEngine.ts` — staged with content
- `src/adapters/web/audio/realPianoSamples.ts` — staged with content
- `src/adapters/web/audio/sampleSelection.ts` — staged with content
- `src/main.ts` — staged with content

`git diff --` (unstaged) against these files is empty — no un-staged changes remain. The staged content is real and non-empty (506 insertions, 203 deletions confirmed by `git diff --cached --stat`).

### Scope Boundaries Confirmed

- `src/adapters/web/render/PixiRenderer.ts` and `.test.ts` — **zero diff**, both staged and unstaged. Completely untouched.
- `openspec/changes/upgrade-piano-audio-realism/ab-listening.md` — **unchanged, correctly pending**. No fabricated listener, date, or decision. Every field reads `pending`.
- Production audio path remains `legacy`-default in production builds. The sampler is reachable only via DEV-only `?audio=sampler` query override.

## Maintainer Authorization

**Explicit Decision**: The project maintainer (this repository's owner) has reviewed this exact situation and explicitly authorized archiving and shipping this change with the pending human A/B listening gate still open. This is a deliberate, informed risk acceptance — not a claim that the listening happened or the spec's criteria are met, but an acknowledgment that deployment is acceptable without completing that final human gate at this time.

**Scope of Authorization**: Deploy and ship the current state (code complete, automated verification green, all 6 code blockers fixed, listening gate not yet done) as a live change, understanding that the listening session and any resulting quality issues or remediation remain as open follow-up work.

**Recording**: This archive report records this authorization transparently so that future maintenance and any post-deployment issues carry the context that the human listening gate was explicitly deferred, not overlooked.

## Spec and Implementation Coverage

### Requirements Coverage

**Automated coverage**: 7/15 requirements ✅
**Reason for incomplete**: 2/15 are human-listening-only (by design); 6/15 are partial/untested from prior cycles (out of scope for this remediation)

### Scenario Coverage

**Automated coverage**: 19/30 scenarios ✅
**Pending by design**: 2/30 require human A/B listening (`ab-listening.md`)
**Partial/untested**: 9/30 from prior coverage gaps (not regressed by this cycle)

### Open Warnings (Non-Blocking)

These are pre-existing gaps or new low-severity gaps identified in this verification; none block archive or the maintainer's authorization:

1. **Autoplay recovery composition not proven end-to-end**: The two halves ("blocked never triggers", "ready triggers directly") are unit-tested separately, but no test drives a single stateful fake context through suspended → resume → second gesture actually triggering. The mechanism is architecturally sound, but the composed flow is inferred from platform semantics, not proven by a single test. (Recommend: stateful fake context for a future strengthening pass.)

2. **Per-file hash/size mismatch rejection not synthetically tested**: File-level `metadata/hash mismatch` validation is exercised only against real, currently-matching files. No synthetic byte-tampered test file proves the rejection path. (Recommend: synthetic tampered file test in a future cycle.)

3. **Intake script provenance verification partially inert**: The script verifies the already-fetched local checkout's `git rev-parse HEAD` against the pinned commit, but does not independently re-fetch the pinned tree against live remote source. (Note: This is a pre-existing gap, not newly introduced; scope does not require fixing it for archive.)

None of these are CRITICAL and all are marked non-blocking in the verify-report. They remain open for future improvement.

## A/B Listening Gate — Correctly Pending

`openspec/archive/2026-09-14-upgrade-piano-audio-realism/ab-listening.md` remains in its fully pending state:

```
Status: **PENDING — no human approval claimed.**
```

Every field (Listener, Date/time, Device/browser, Build, Manifest SHA-256, Loudness normalization, Pass/fail decision) reads `pending`. This is correct and by design. No fabricated listener or decision was added. The human A/B listening session must occur as a separate, future activity if (and when) the maintainer chooses to conduct it.

## Archive Contents Verified

- ✅ `proposal.md` — present
- ✅ `specs/piano-audio/spec.md` — present (copied to main `openspec/specs/piano-audio/spec.md`)
- ✅ `design.md` — present
- ✅ `tasks.md` — present, all 4 implementation tasks marked `[x]`
- ✅ `apply-progress.md` — present (intermediate snapshot)
- ✅ `verify-report.md` — present (evidence_revision `sha256:80fc730072379897a2d9ef43e8ade3d41e6c5847bd41695997dfa004ecc93def`)
- ✅ `ab-listening.md` — present, correctly pending

## Spec Sync

Main spec created at `openspec/specs/piano-audio/spec.md`:
- **Source**: `openspec/archive/2026-09-14-upgrade-piano-audio-realism/specs/piano-audio/spec.md`
- **Verification**: `diff` between source and destination shows no differences (files byte-identical)
- **Action**: The delta spec became the main spec (no prior spec existed; no merge required)

## Roleback Boundary

If production cutover or deployment later encounters issues:

1. Disable sampler selection at the composition root (change default back to `legacy`)
2. Dispose sampler loader/engine; retain verified assets for investigation
3. Restore legacy eight-sample path as production playback
4. Investigation and remediation remain separate from the initial cutover

## Summary and Closure

| Item | Status |
|------|--------|
| Implementation complete | ✅ 4/4 tasks marked complete |
| Code verification (automated) | ✅ Zero CRITICAL, all 6 blockers fixed, 358 tests pass |
| Spec-level verification | FAIL due to pending human A/B gate (by design, not a defect) |
| Maintainer authorization for deployment | ✅ Explicit, informed approval to ship with pending listening gate |
| Archive folder moved | ✅ `openspec/changes/upgrade-piano-audio-realism/` → `openspec/archive/2026-09-14-upgrade-piano-audio-realism/` |
| Main specs updated | ✅ `openspec/specs/piano-audio/spec.md` created |
| Artifact integrity verified | ✅ `diff -r` confirms no truncation or alteration |

**SDD Cycle Status**: CLOSED. The change is archived, the main spec is updated, and the project maintainer has authorized deployment with explicit knowledge that the A/B listening gate remains pending and is not part of this cycle.

## Next Steps (For Maintainers)

1. **Optional**: Review the archived design and implementation for local development testing.
2. **Optional**: Conduct human A/B listening in `src/main.ts` using `?audio=legacy` vs. `?audio=sampler` when ready, and record results in the archived `ab-listening.md` if a future decision is needed.
3. **Out of scope for this SDD cycle**: Publishing to GitHub Pages, production cutover, or any deployment/delivery actions. Those remain separate human gates under ordinary repository policy.
