# Apply progress — upgrade-piano-audio-realism

## Status consumed

Consumed native status: `applyState: ready`, artifact store `openspec`, change
`upgrade-piano-audio-realism`, repo-local workspace
`/home/flow/dev/personal-projects/gordopianist`, sole allowed edit root is the
repository, and 4/4 implementation rows were unchecked. The explicit delivery
exception was consumed: one candidate is allowed despite the High 400-line
forecast; no commit, push, publishing, deployment, production sampler default,
or A/B approval was authorized.

## Completed tasks and persisted checkboxes

- Unit 1 — provenance, deterministic intake, manifest, assets, attribution, and
  validation: completed; tasks.md line 66 is `[x]`.
- Unit 2 — progressive loader, provider boundary, bounded scheduler, partial
  failure, generation cancellation, and decoded cache: completed; tasks.md line
  96 is `[x]`.
- Unit 3 — deterministic layered selection, independent voices, pressure cap,
  output graph, and safe ancillary policy: completed; tasks.md line 126 is
  `[x]`.
- Unit 4 — shared composition-root sampler seam, DEV-only query override,
  packaging validation, and A/B evidence record: completed; tasks.md line 158
  is `[x]`.

The persisted tasks artifact was re-read and all four reported implementation
rows visibly contain `- [x]`.

## Files changed

- `public/piano-samples/` — 641 pinned MP3 assets, manifest JSON, and attribution.
- `scripts/intake-salamander-piano.cjs`
- `scripts/validate-piano-assets.cjs`
- `src/adapters/web/audio/pianoAssetManifest.ts`
- `src/adapters/web/audio/progressivePianoLoader.ts`
- `src/adapters/web/audio/realPianoSamples.ts` and focused tests
- `src/adapters/web/audio/sampleSelection.ts`
- `src/adapters/web/audio/WebAudioEngine.ts` and focused tests
- `src/main.ts`
- `package.json`
- `openspec/changes/upgrade-piano-audio-realism/ab-listening.md`

## TDD Cycle Evidence

| Unit | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- |
| 1 | Added manifest/selection tests first; focused run failed because manifest and selector were absent. | Generated pinned manifest and assets; focused tests passed. | Validator, typecheck, build, and packaged paths passed with exact inventory. | Consolidated manifest generation/validation and reran focused checks. |
| 2 | Added loader tests before loader implementation; focused run initially exposed pending rejection handling. | Implemented max-two scheduler, deduplication, partial failures, bootstrap prewarm, generation cancellation, and LRU bounds. | Focused loader tests passed, then full suite/typecheck/build passed. | Replaced rejected `finally` cleanup with rejection-safe promise cleanup and reran suite. |
| 3 | Added independent-voice/compressor tests before the new engine behavior. | Implemented layered provider lookup, overlapping voice IDs, 64-voice pressure policy, release lifecycle, and compressor graph. | Focused audio tests and full suite passed. | Kept legacy map compatibility and adapter-owned unsupported-pedal diagnostics. |
| 4 | Added the DEV-only path seam and package validation expectations before integration edits. | Wired one context-scoped provider, query-gated sampler selection, legacy production default, and dist validation. | `npm test`, typecheck, build, and asset validator all passed. | Recorded incomplete human gate explicitly rather than fabricating listening evidence. |

## Verification evidence

- `npm test` — PASS, 39 files / 321 tests.
- Focused audio suite — PASS, 4 files / 25 tests.
- `npm run typecheck` — PASS.
- `npm run build` — PASS.
- `npm run validate:piano-assets` — PASS: 641 files, 90,413,373 bytes;
  480 attacks, 88 releases, 69 harmonics, 4 pedals; dist package verified.
- Bootstrap compressed bytes measured from the 30 v8 attack files: 5,621,632
  bytes. Full bank: 90,413,373 bytes.
- Pinned source: `0cd2c034f820c53e83ab22f5c13bd490b9e4de85`.
- Runtime harness: local Vite development A/B seam is available with
  `?audio=sampler`; no human listening was performed in this apply session.

## Deviations and risks

- `ab-listening.md` remains intentionally pending. It contains no listener,
  device/browser, normalized comparison, or pass/fail claim; production remains
  legacy-default.
- Pedal files are packaged and validated but not audibly activated because the
  approved domain has no valid pedal event. Round robin behavior is not claimed.
- No public port, gameplay/content data, workflow, Vite base, deployment state,
  or Git history was changed.

## Remaining tasks

No unchecked implementation task rows remain. Human A/B listening, production
cutover, publishing, deployment, and any commit/push remain outside this apply
phase and are not authorized by this artifact.

## Workload / PR boundary

This is one explicitly accepted `size:exception` candidate with four internal
rollback boundaries: (1) provenance/assets, (2) loader/provider, (3)
selection/engine, and (4) composition-root/validation. Authored code is above
the canonical 400-line review budget by the accepted exception; binary workload
is separately 641 files and exactly 90,413,373 bytes. No chaining was selected.

## Scope correction

The remediation restored `src/adapters/web/render/PixiRenderer.test.ts` byte-for-byte to HEAD after tooling reformatted it outside the approved audio surfaces. A status review found no other modified tracked file outside the original allowed surfaces attributable to this candidate.

## Remediation evidence — verifier revision sha256:fa0561bf05d76ee5252fae92c8c6cf4177589642bd59eba320c54ae1b35e2b73

| Task mapping | Test file / evidence | RED | GREEN | TRIANGULATE | Status |
| --- | --- | --- | --- | --- | --- |
| Loader generation guards, canonical URLs, and progressive plan | `src/adapters/web/audio/progressivePianoLoader.test.ts` | ✅ Written — actual RED was the focused TypeScript failure that `startPlan` did not exist. | ✅ Passed — late completion rejects as superseded, does not cache/count/publish, URLs join as `/pianist/piano-samples/...`, and bootstrap plan fetches all requested v8 assets while decoding only seeds. | ✅ Passed — focused loader tests plus full suite and typecheck. | ✅ Written / ✅ Passed |
| Release, harmonic, voice pressure, and diagnostics | `src/adapters/web/audio/WebAudioEngine.test.ts` | ✅ Written — actual RED was the focused TypeScript failure for the provider fixture missing `prewarmBootstrap`; no historical behavioral RED is claimed. | ✅ Passed — provider release uses 35 ms, harmonic hook is routed when verified, stealing records diagnostics and orders releasing voices first. | ✅ Passed — focused engine tests plus full suite/build. | ✅ Written / ✅ Passed |
| Composition-root query and lifecycle safety | `src/main.test.ts`, `src/main.ts` | ✅ Written — the existing path seam was already green; no fabricated historical RED is claimed. | ✅ Passed — DEV-only query behavior, guarded startup, preview disposal, resume handling, and sampler prewarm are covered. | ✅ Passed — focused composition test, full suite, typecheck, and production build. | ✅ Written / ✅ Passed |
| Fail-closed provenance and inventory validation | `scripts/validate-piano-assets.cjs` | ✅ Written — actual validator RED rejected the first hardened identity rule on `harmLA1` because ancillary identities lack anchor/layer fields. | ✅ Passed — role-specific identity, provenance, directory equality, order, MP3 signature, traversal, metadata/hash, attribution, and dist checks pass. | ✅ Passed — `npm run validate:piano-assets` against committed files and packaged output. | ✅ Written / ✅ Passed |

### Remediation safety-net evidence

| Safety Net command | Result |
| --- | --- |
| `git diff --check` | ✅ Passed |
| Focused audio/composition tests | ✅ Passed — 5 files, 35 tests |
| `npm test` | ✅ Passed — 40 files, 326 tests |
| `npm run typecheck` | ✅ Passed |
| `npm run build` | ✅ Passed (non-blocking Vite chunk-size warning) |
| `npm run validate:piano-assets` | ✅ Passed — 641 files, 90,413,373 bytes; dist verified |
| `tasks.md` checkbox re-read | ✅ Passed — all four implementation rows remain checked |
| Out-of-scope tracked diff check | ✅ Passed — `PixiRenderer.test.ts` has no staged or unstaged diff |

The original apply evidence is retained above but is explicitly not treated as
proof of historical RED or complete scenario coverage; this remediation records
only the newly observed RED outputs and the current independently rerun green
and safety-net results. `ab-listening.md` remains pending, production remains
legacy-default, and no deployment or cutover occurred.

## Second bounded remediation — verifier evidence sha256:b9cd33b89f6848b6d46958583fd2515fc0926855cd76cd53305fc19a0acb7536

| Task mapping | Focused test file | RED evidence | GREEN evidence | Boundary triangulation | Status |
| --- | --- | --- | --- | --- | --- |
| Full-bank progression and Save-Data/visibility gating | `src/adapters/web/audio/progressivePianoLoader.test.ts` | ✅ Written — actual RED was the missing `startPlan` API/type error before implementation. | ✅ Passed — eligible plans schedule 641 fetches with only eight decodes; hidden plans fetch only 30 bootstrap assets. | ✅ Passed — max-two scheduler, stale completion, URL joining, partial failure, and full-bank plan tests. | ✅ Written / ✅ Passed |
| Manifest-backed harmonic routing | `src/adapters/web/audio/harmonicRouting.test.ts`, `src/adapters/web/audio/WebAudioEngine.test.ts` | ✅ Written — actual RED was the absent `harmonicAssetFor` export; the real-manifest test then failed until filename prefixes were handled. | ✅ Passed — supported real harmonic IDs resolve deterministically, unsupported ranges return undefined, and provider requests actual harmonic IDs. | ✅ Passed — real manifest role/range assertions and engine routing test. | ✅ Written / ✅ Passed |
| Hard voice bound and deterministic diagnostics | `src/adapters/web/audio/WebAudioEngine.test.ts` | ✅ Written — actual RED changed the 65-voice diagnostic expectation from generic pressure to deterministic oldest-active tie behavior. | ✅ Passed — victim is removed before insertion, active voices remain <=64, and diagnostics expose victim ID/reason. | ✅ Passed — releasing-first and 64+ pressure tests. | ✅ Written / ✅ Passed |
| Legacy fallback and context recovery | `src/adapters/web/audio/fallback.test.ts`, `src/main.test.ts` | ✅ Written — actual RED exposed missing `legacyFallback`, `legacyFallbacks`, and `resumeAudioContext` APIs. | ✅ Passed — unavailable sampler notes delegate to legacy with typed status; resume publishes blocked then ready. | ✅ Passed — focused tests, full suite, and production build. | ✅ Written / ✅ Passed |
| Fail-closed provenance and inventory semantics | `scripts/intake-salamander-piano.cjs`, `scripts/validate-piano-assets.cjs` | ✅ Written — actual RED was validator rejection of ancillary duplicate identity and then harmonic filename regex; both were corrected. | ✅ Passed — exact anchors/layers/groups, signatures, paths, hashes, directory equality, attribution, provenance, and dist checks. | ✅ Passed — offline validator over committed and packaged files. | ✅ Written / ✅ Passed |
| Composition-root lifecycle and A/B boundary | `src/main.test.ts`, `src/main.ts` | ✅ Written — existing DEV/production seam was already green; no historical RED is claimed beyond the new recovery API compile RED. | ✅ Passed — shared provider, preview disposal/cancellation, gesture-gated prewarm, observable context status, DEV-only query, and legacy default remain intact. | ✅ Passed — focused composition test, full suite, typecheck, build, and validator. | ✅ Written / ✅ Passed |

### Second remediation safety net

| Command/evidence | Result |
| --- | --- |
| `git diff --check` | ✅ Passed |
| Focused remediation suite | ✅ Passed — 5 files, 35 tests before second-cycle additions; current focused additions also pass. |
| `npm test` | ✅ Passed — 42 files, 334 tests |
| `npm run typecheck` | ✅ Passed |
| `npm run build` | ✅ Passed; only non-blocking Vite chunk-size warning |
| `npm run validate:piano-assets` | ✅ Passed — 641 files, 90,413,373 bytes; dist verified |
| `tasks.md` re-read | ✅ Passed — lines 66, 96, 126, and 158 remain checked |
| `git status` scope inspection | ✅ Passed for candidate implementation; `PixiRenderer.test.ts` restored to HEAD with no staged or unstaged diff |

The A/B record remains pending and contains no fabricated listener approval.
Production remains legacy-default. No commit, push, deployment, sync, cutover,
or public pedal activation occurred. The verify report was not edited.

## Third bounded remediation — verifier evidence sha256:08d1c7a7819e6eaabce3de8bdc6cc7ec5ed7d07d83354eeb9ef75feb2ec52ef0

### Pre-remediation discovery: prior working-tree fixes were never staged

Before making any change, re-inspection found the working tree already
contained substantially more correct behavior than `git`'s index/HEAD for the
already-tracked adapter files (`WebAudioEngine.ts`, `main.ts`,
`sampleSelection.ts`, `realPianoSamples.ts`, `package.json`,
`public/piano-samples/ATTRIBUTION.md`): `git diff --cached` against those
paths was empty (index === HEAD, the pre-change baseline), while the working
tree already had harmonic routing via `harmonicAssetFor`, voice-cap victim
deletion in `steal()`, `legacyFallback` wiring, and `audio-context-blocked`
CustomEvent publication. None of that had ever been `git add`ed by the prior
two remediation cycles. This apply session independently re-verified each of
the 6 in-scope blockers against that working-tree state with real
(non-fake-only) tests rather than assuming either the code or the report was
correct, found one genuine unfixed defect (full-bank priority scheduling) and
one genuine testability gap needing a small safe refactor (gesture-gated
trigger), confirmed the remaining areas were already behaviorally correct but
under-proven, and staged the entire cumulative state at the end.

| Task mapping | Focused test file | RED evidence | GREEN evidence | Boundary triangulation | Status |
| --- | --- | --- | --- | --- | --- |
| Blocker 1 — full-bank progressive loading and selected-piece/preview priority scheduling | `src/adapters/web/audio/realPianoSamples.test.ts` | ✅ Written — actual RED was `decodeIndex` = -1: `prewarmBootstrap()` took no priority argument, so a piece's non-seed anchor decode was queued behind hundreds of full-bank fetch-only jobs instead of being prioritized. | ✅ Passed — `prewarmBootstrap(priorityMidis)` now computes the nearest layer-8 anchor per priority MIDI and passes it as `startPlan`'s `priorityIds`, so the decode lands right after the bootstrap group (`decodeIndex < 45`) instead of after the full bank. `main.ts` now passes the preview/piece MIDIs into `prewarmBootstrap`. | ✅ Passed — focused test, `progressivePianoLoader.test.ts` full-bank tests, full suite, typecheck, build. | ✅ Written / ✅ Passed |
| Blocker 2 — harmonic identity/routing resolves through the real manifest, not only a fake provider | `src/adapters/web/audio/realPianoSamples.test.ts`, `src/adapters/web/audio/harmonicRouting.test.ts` | ✅ Written — actual RED was `provider.getHarmonic!(21,100)` returning `undefined` after a real prewarm: harmonics were never proactively requested, so the hook could only ever start a background fetch and return nothing on the note it was needed for. | ✅ Passed — `prewarmBootstrap`/`prewarmPiece` now also request the matching harmonic asset per priority MIDI via `harmonicAssetFor`, so `getHarmonic` resolves a genuinely decoded buffer. Added an end-to-end `WebAudioEngine` + real `createPianoSampleProvider` test (`harmonicRouting.test.ts`) proving a real routed harmonic voice is created for a supported note, and that an unsupported range never fabricates one — both through the real manifest/loader pipeline, not a fake. | ✅ Passed — new real-provider tests, existing pure `harmonicAssetFor` manifest tests, full suite, typecheck, build. | ✅ Written / ✅ Passed |
| Blocker 3 — 64-voice cap enforcement, proven end-to-end through real selection | `src/adapters/web/audio/WebAudioEngine.test.ts` | N/A — independent re-inspection of `WebAudioEngine.steal()` found the victim is already removed from `voices` (`this.voices.delete(victim.id)`) before the new voice is inserted, so the map never exceeds the cap; the existing fake-buffer cap test already asserted `activeVoices <= 64`, not "65 created sources". No behavioral RED was reproducible. | ✅ Passed (hardening) — added an end-to-end test using the real `createPianoSampleProvider` (not a fake `Map`) cycling 88 note-ons across the 8 real decoded bootstrap-seed pitches, asserting `activeVoices` stays exactly 64 and `voiceSteals === 88 - 64` through genuine manifest-backed selection. | ✅ Passed — new real-provider cap test, existing fake-buffer cap/steal tests, full suite, typecheck, build. | ✅ Written (hardening, no prior RED reproduced) / ✅ Passed |
| Blocker 4 — no-compatible-asset fallback/error boundary, proven end-to-end through real components | `src/adapters/web/audio/fallback.test.ts` | N/A — independent re-inspection found `WebAudioEngine.noteOn()` already delegates to `options.legacyFallback` and records `legacy-fallback`, or throws `no-compatible-asset` and publishes `audio-error` via `subscribeStatus` when no fallback is configured; `main.ts` already builds a real `legacyFallback` via `createLegacyFallback()` and passes it to both `startPreview` and `startPiece`. No behavioral RED was reproducible against the existing fake-only test. | ✅ Passed (hardening) — added two end-to-end tests using a real, unwarmed `createPianoSampleProvider` (genuinely has no compatible loaded attack) routed into a real legacy `WebAudioEngine` instance, proving delegation and `legacy-fallback` status through real components; and a second test proving the observable `audio-error` status/throw when no legacy fallback is configured. | ✅ Passed — new real-component fallback tests, existing fake-based fallback test, full suite, typecheck, build. | ✅ Written (hardening, no prior RED reproduced) / ✅ Passed |
| Blocker 5 — autoplay/context recovery observability and noteOn-no-op prevention | `src/main.test.ts` | ✅ Written — actual RED was `guardedTrigger is not a function`: the gesture-gated recovery logic lived inline inside `onPress` with no exported, independently testable unit proving a suspended context never reaches the trigger callback. | ✅ Passed — extracted `guardedTrigger(context, publish, trigger)` (behavior-preserving refactor of the existing `onPress` body) and wired it into `onPress`; new tests prove the trigger callback is never invoked while the context is suspended (recovery is attempted and `audio-context-blocked`/`ready` is published instead), and that it runs directly with no spurious resume attempt once the context is ready. `audioStatus` is still published via the existing `window.dispatchEvent(new CustomEvent('piano-audio-status', ...))` integration-boundary call. | ✅ Passed — new `guardedTrigger` tests, existing `resumeAudioContext`/`audioPathFor` tests, full suite, typecheck, build. | ✅ Written / ✅ Passed |
| Blocker 6 — validator/intake fail-closed coverage, proven by negative-path tests | `scripts/validate-piano-assets.test.mjs` | ✅ Written — before the refactor, `scripts/validate-piano-assets.cjs` had no `module.exports` and no test file, so its anchor/grouping/ancillary-identity fail-closed rules were only ever exercised against the (already-correct) real asset set — never proven to actually reject a corrupted manifest. Requiring the pure check functions failed until the export refactor landed. | ✅ Passed — refactored the script into named, filesystem-independent check functions (`checkManifestProvenance`, `checkManifestOrder`, `checkAssetPathsAndIdentities`, `checkAttackAnchorCoverage`, `checkGroupingAndAncillaryIdentity`, `checkManifestDirectoryEquality`, `checkInventoryCounts`, `checkManifestAssets`) plus a `require.main` guard and `module.exports`, with byte/hash/signature/attribution/dist checks unchanged and still inline in `validatePianoAssets()`. Added 14 negative/positive-path tests proving each rule actually rejects a synthetic corrupted manifest (missing anchor, missing velocity layer, wrong bootstrap/full group, bad ancillary filename identity for release/harmonic/pedal, duplicate identity, path traversal, unpinned/inconsistent provenance, wrong inventory byte total) and that the real committed manifest passes every one of them. | ✅ Passed — new `validate-piano-assets.test.mjs`, `npm run validate:piano-assets` against the real committed assets and packaged `dist/`, full suite, typecheck, build. | ✅ Written / ✅ Passed |

### Third remediation safety-net evidence

| Safety Net command | Result |
| --- | --- |
| `npm run validate:piano-assets` | ✅ Passed — 641 files, 90,413,373 bytes; 480 attacks, 88 releases, 69 harmonics, 4 pedals; dist package verified |
| Focused audio/composition/validator tests (`src/adapters/web/audio/`, `src/main.test.ts`, `scripts/validate-piano-assets.test.mjs`) | ✅ Passed — 8 files, 66 tests |
| `npm test` (full suite) | ✅ Passed — 43 files, 358 tests |
| `npm run typecheck` | ✅ Passed, no errors |
| `npm run build` | ✅ Passed (non-blocking Vite chunk-size warning, unchanged from prior cycles) |
| `tasks.md` checkbox re-read | ✅ Passed — all four implementation rows (lines 66, 96, 126, 158) remain `- [x]` |
| `PixiRenderer.ts` / `PixiRenderer.test.ts` diff (staged and unstaged) | ✅ Passed — both empty; file untouched |
| `ab-listening.md` diff (this session) | ✅ Passed — untouched by this session; its pre-existing pending content (no listener/decision) was already staged from an earlier cycle and was not edited here |
| `git add -A -- . ':!.pi' ':!.vitest'` | ✅ Passed — staged every created/modified file (including files from earlier remediation cycles that were left unstaged); only `.pi/` and `.vitest/` remain untracked |

Only 5 of the 6 in-scope blockers required a functional code change (1, 2, 5)
or a testability refactor (6); blockers 3 and 4 were independently
re-verified as already behaviorally correct and were hardened with new
end-to-end, real-component tests rather than fakes. No commit, push,
deployment, sync, production cutover, or public pedal activation occurred.
`ab-listening.md` remains untouched and pending by design. The verify report
was not edited.

## Next recommendation

`sdd-verify`
