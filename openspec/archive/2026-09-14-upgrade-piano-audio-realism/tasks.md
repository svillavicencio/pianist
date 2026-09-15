# Upgrade Piano Audio Realism — Implementation Tasks

## Review Workload Forecast

| Field | Value |
| ------- | ------- |
| Estimated authored changed lines | Unit 1: 180–260; Unit 2: 260–360; Unit 3: 320–420; Unit 4: 180–260; total: 940–1,300 authored lines |
| Binary file count / bytes | 641 audio files; exactly 90,413,373 committed bytes (480 attacks, 88 releases, 69 harmonics, 4 pedals); measured separately from authored-line budget |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Decision needed before apply | Yes |
| Proposed chain boundaries | PR 1: provenance/intake/manifest and assets; PR 2: loader/provider/fallback; PR 3: selection/engine; PR 4: DEV-only integration and validation/gate evidence |
| Largest reviewer burden | Provenance and binary intake: 641 files, hashes, licenses, exact byte accounting, and packaged-output identity |
| Why | The authored implementation spans four independently testable boundaries and the asset workload is large even though binary bytes are not ordinary code-review lines |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending; do not select a chain strategy or size exception in this phase |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

**Apply gate:** Before implementation crosses the review budget, the delivery owner must choose the chain boundaries or explicitly authorize another permitted strategy. No `size:exception` is authorized. Production default, publishing, and deployment remain unchanged.

## Human-Controlled Gates

- **Source/provenance gate:** Before downloading or checking in any new audio, accept evidence for the pinned `tambien/Piano` commit, original Salamander authority, MIT adaptation terms, CC BY 3.0 audio rights, conversion/redistribution terms, and required attribution. If evidence is incomplete or contradictory, stop; do not invent an asset set.
- **Review-budget gate:** Before apply begins, review the forecast and approve the proposed chain boundaries. If the implementation cannot remain within the selected review slice, stop and request a delivery decision; do not silently exceed 400 authored changed lines.
- **A/B gate:** Before changing any production selection, record the required loudness-normalized human listening evidence and obtain an explicit pass decision. Automated tests do not satisfy this gate.
- **Publishing/deployment gate:** Do not publish assets, deploy GitHub Pages, or make the sampler production-default in this change. Those actions require separate explicit authorization after provenance, build, review, and A/B evidence pass.

## Ordered Implementation Work Units

### Unit 1 — Pinned provenance, deterministic intake, manifest, and measured asset workload

**Start state:** The repository has the eight-file FLAC baseline in `public/piano-samples/`, its existing attribution, and no accepted 641-file manifest. The legacy loader remains the only production path.

**Likely files and surfaces:**

- Create `scripts/intake-salamander-piano.cjs` (or an equivalent checked-in intake tool) that fetches only the pinned adaptation tree and fails closed on source, commit, role, format, or rights mismatch.
- Create `scripts/validate-piano-assets.cjs` for deterministic inventory, SHA-256, byte/format, path, role-count, grouping, and build-output validation.
- Create or generate `src/adapters/web/audio/pianoAssetManifest.ts` containing `PianoAsset`, `AttackAsset`, `AncillaryAsset`, `PianoManifest`, `PIANO_MANIFEST`, and `PIANO_MANIFEST_SHA256`; keep generated output reproducible and reviewable.
- Update `public/piano-samples/ATTRIBUTION.md` with distinct MIT adaptation and CC BY 3.0 audio obligations, source URLs/commit, derivation notice, and verification date/evidence.
- Add the verified 641 files below `public/piano-samples/` only after the source/provenance gate; preserve the existing eight-file baseline until later integration changes it.
- Add the smallest package/script or test configuration needed to run the validator without introducing a runtime CDN or non-deterministic generation.
- Add `src/adapters/web/audio/realPianoSamples.test.ts` cases for exact inventory, deterministic ordering, duplicate/unknown/path-traversal rejection, hash/metadata mismatch, attribution distinction, bootstrap/full grouping, and `/pianist/` URL construction.

**RED → GREEN → TRIANGULATE → REFACTOR evidence:**

- RED: add focused manifest/validator tests first and run `npm test -- src/adapters/web/audio/realPianoSamples.test.ts`; record failure against the absent manifest/inventory.
- GREEN: implement the pinned intake, checked-in manifest, attribution, validator, and accepted assets until the focused tests pass.
- TRIANGULATE: run the focused test again against the committed bytes and generated Vite output, then run `npm run validate:piano-assets`, `npm run typecheck`, and `npm run build`; record exact measured bootstrap/full bytes and manifest hash.
- REFACTOR: remove generator/validator duplication while retaining the failed-rights, changed-byte, deterministic-order, and packaged-path evidence; rerun the focused test and validator.

**Acceptance evidence and command set:**

- `npm test -- src/adapters/web/audio/realPianoSamples.test.ts` passes.
- `npm run validate:piano-assets` reports exactly 641 files and `90,413,373` bytes, including 480 attacks (`30 × 16`), 88 `rel*.mp3`, 69 `harm*.mp3`, and 4 pedal files, with stable ordering and matching hashes.
- `npm run typecheck` and `npm run build` pass; validator proves every accepted manifest path exists in the Vite output under `/pianist/`.
- No playback selection or composition-root default changes in this unit.

**Dependencies:** Source/provenance acceptance gate first; no other implementation unit. Unit 2 depends on the manifest identity and validator. Unit 4 depends on the measured package output.

**Rollback boundary:** Remove/quarantine only the newly accepted asset files, generated manifest, intake/validation scripts, and attribution additions if provenance or byte/hash evidence fails; retain the existing eight-file baseline and production behavior.

- [x] Implement and verify the behavior. <!-- sdd-owner: implementation -->

### Unit 2 — Progressive loader, provider, LRU cache, and legacy fallback

**Start state:** Unit 1 has supplied `PIANO_MANIFEST`, stable asset IDs/URLs, and validation commands; `realPianoSamples.ts` still uses all-or-nothing `Promise.all` loading.

**Likely files and surfaces:**

- Create `src/adapters/web/audio/progressivePianoLoader.ts` with `PianoLoader`, `PianoLoadState`, `PianoReadiness`, `PianoLoadFailure`, bounded scheduler, generation guards, deduplicated requests, cancellation/supersession, and immutable subscriptions.
- Replace or narrow `src/adapters/web/audio/realPianoSamples.ts` to expose the manifest/provider boundary while retaining a compatibility path for the legacy eight-file loader.
- Add provider/fallback seams in `src/adapters/web/audio/realPianoSamples.ts` or a focused adapter module; do not widen `src/ports/AudioEngine.ts`.
- Extend `src/adapters/web/audio/realPianoSamples.test.ts` (or add `progressivePianoLoader.test.ts`) with injectable fetch/decode fakes for max-two concurrency, shared pending promises, eight decoded bootstrap seeds, progress, partial failure, LRU limits, stale generations, disposal, and legacy fallback.

**RED → GREEN → TRIANGULATE → REFACTOR evidence:**

- RED: write loader tests before implementation and run `npm test -- src/adapters/web/audio/realPianoSamples.test.ts src/adapters/web/audio/progressivePianoLoader.test.ts`; record failures for scheduler/state/cache behavior.
- GREEN: implement the minimum typed loader/provider that makes bootstrap playback usable without waiting for the full bank and routes unavailable notes to the retained legacy path.
- TRIANGULATE: run focused tests with fetch failures, decode failures, duplicate consumers, supersession, cancellation, cache eviction, and no-compatible-asset cases; then run `npm test`, `npm run typecheck`, and `npm run build`.
- REFACTOR: isolate scheduling, LRU, state snapshots, and fallback policy without changing observable counters or failure semantics; rerun focused and full commands.

**Acceptance evidence and command set:**

- Focused loader tests prove no more than two simultaneous fetch/decode jobs, one operation per pending manifest identity, bootstrap readiness after eight seed decodes, continued full-bank progress, and deterministic failure entries.
- Tests prove a failed non-bootstrap asset does not reject usable audio, stale generations cannot publish, eviction respects 12 buffers/96 MiB estimates and pinning, and no-compatible-asset requests use legacy fallback with a diagnostic.
- `npm test`, `npm run typecheck`, and `npm run build` pass without changing the production default.

**Dependencies:** Unit 1 manifest and validator. Unit 3 consumes the provider contract. Unit 4 consumes readiness/generation/fallback state.

**Rollback boundary:** Revert only the progressive loader/provider modules and their tests, restoring calls to the existing eight-file loader; leave the verified manifest/assets intact and keep the legacy engine active.

- [x] Implement and verify the behavior. <!-- sdd-owner: implementation -->

### Unit 3 — Layered selection and independent-voice WebAudio engine

**Start state:** Unit 2 provides a typed provider with partial availability and deterministic fallback; `WebAudioEngine.ts` still tracks one active voice per MIDI note and connects directly to the destination.

**Likely files and surfaces:**

- Replace selection logic in `src/adapters/web/audio/sampleSelection.ts` with `selectAttack`, documented 30-anchor/two-semitone policy, endpoint handling, 16-layer velocity mapping, residual gain, and deterministic loaded-layer fallback; retain pure `playbackRateFor` compatibility where useful.
- Update `src/adapters/web/audio/WebAudioEngine.ts` with `PianoSampleProvider`, independent voice IDs/lifecycles, optional release/harmonic lookup, 64-voice deterministic stealing, idempotent handles, disposal, diagnostics, master gain, compressor, and safe unsupported-pedal behavior.
- Keep `src/ports/AudioEngine.ts` unchanged unless a test demonstrates the adapter contract cannot represent the approved behavior; if widening is unavoidable, stop for the human scope gate before editing it.
- Update `src/adapters/web/audio/sampleSelection.test.ts` and `src/adapters/web/audio/WebAudioEngine.test.ts` with fake buffers/nodes for selection boundaries, same-pitch overlap, release routing/fallback, harmonic routing, voice cap/steal, cleanup, and headroom/compressor settings.

**RED → GREEN → TRIANGULATE → REFACTOR evidence:**

- RED: add pure selection and fake-WebAudio tests first and run `npm test -- src/adapters/web/audio/sampleSelection.test.ts src/adapters/web/audio/WebAudioEngine.test.ts`; record failures for old nearest-sample and one-voice behavior.
- GREEN: implement the minimum selection and voice graph satisfying the tests, including the documented gain curve and release fallback; do not activate unverified pedal semantics.
- TRIANGULATE: run focused tests for exact layer boundaries, endpoint keys, missing anchors/layers, rapid retriggers, 64+ voices, release idempotence, unsupported ancillary assets, and dense-chord peak envelopes; then run `npm test`, `npm run typecheck`, and `npm run build`.
- REFACTOR: separate pure selection, provider lookup, voice lifecycle, and output graph while preserving diagnostics and fake-test evidence; rerun focused and full commands.

**Acceptance evidence and command set:**

- Selection tests prove every piano key can use an in-range anchor, eligible anchors stay within two semitones, lower-anchor/lower-layer ties are stable, velocity zero is non-sounding, and unavailable assets degrade with an explicit reason.
- Engine tests prove repeated same-pitch note-ons coexist and release independently, release samples are used only when manifest-supported, unsupported pedal behavior is observable and safe, voice pressure is bounded, and the graph uses master gain `0.70` plus the documented compressor settings.
- `npm test`, `npm run typecheck`, and `npm run build` pass; numeric headroom tests are not treated as listening evidence.

**Dependencies:** Unit 2 provider and readiness contract. Unit 4 owns composition-root selection and human A/B evidence.

**Rollback boundary:** Disable/remove only the new selection/engine adapter path and its tests, restoring the legacy `WebAudioEngine` construction; retain provider/assets for investigation and do not alter domain note schemas.

- [x] Implement and verify the behavior. <!-- sdd-owner: implementation -->

### Unit 4 — DEV-only composition-root A/B integration, packaging validation, and listening gate

**Start state:** Units 1–3 pass their focused checks; the legacy engine remains the production default and no deployment/publishing has occurred.

**Likely files and surfaces:**

- Update `src/main.ts` to create one context-scoped loader/provider shared by preview and performance, guard generations, preserve preview cancellation, recover from suspended audio contexts, and route unavailable sampler notes to legacy fallback.
- Add the injected `AudioPath = 'legacy' | 'sampler'` seam and DEV-only `?audio=legacy|sampler` override in `src/main.ts` or a small composition-root helper; production builds must ignore the query and remain `legacy`.
- Add or extend `src/main.test.ts` / composition-root tests with mocked `import.meta.env`, loader generations, shared requests, cancellation, autoplay recovery, path defaults, and production-query rejection.
- Extend `scripts/validate-piano-assets.cjs` or add a narrowly scoped packaging check to validate `public/piano-samples/` and `dist/piano-samples/`; document measured bootstrap/full sizes and manifest identity in the change evidence or an approved repository-facing validation artifact.
- Record human A/B results in a reviewable evidence file such as `openspec/changes/upgrade-piano-audio-realism/ab-listening.md` only after implementation validation; do not claim a pass without listener/date/device/browser/build/manifest/pass-fail fields.

**RED → GREEN → TRIANGULATE → REFACTOR evidence:**

- RED: add composition-root and package-presence tests first and run the focused command; record failures for shared-loader, cancellation, DEV-only selection, and packaged asset behavior.
- GREEN: implement the smallest integration that preserves legacy production selection, supports local DEV A/B selection, and keeps preview/performance playable during bootstrap and partial failure.
- TRIANGULATE: run focused integration tests, `npm test`, `npm run typecheck`, `npm run build`, and `npm run validate:piano-assets`; verify no runtime external audio URL and exact `/pianist/` paths.
- REFACTOR: simplify composition-root lifecycle/disposal and validation reporting while retaining the legacy-default assertion, then rerun all commands.

**Acceptance evidence and command set:**

- Tests prove preview and performance share one loader/context, cancellation cannot be won by stale promises, autoplay failure is observable and recoverable, DEV query selection works, and production builds remain legacy-default.
- Build/package validation proves manifest paths exist in `dist`, measured bytes match Unit 1, and no CDN/source-repository audio request is introduced.
- Human A/B listening is performed only after automated evidence: fixed opening chords, fast retriggers, loud dense chord, and release-focused passage; loudness normalization and browser/device/date/build/manifest identity are recorded, with explicit observations for timbre, coverage, layers, overlap, release/pedal, clipping, loading silence, and pumping.
- A failed, missing, or incomplete listening result leaves production selection and deployment blocked. A passing result is evidence for a separate human cutover decision, not authorization to cut over.

**Dependencies:** Units 1–3; review-budget/chaining decision before apply; provenance acceptance before assets; A/B acceptance before any cutover; separate publishing/deployment authorization.

**Rollback boundary:** Set the composition-root path back to `legacy`, dispose the sampler loader/engine, and retain assets/evidence for investigation. Do not delete unrelated gameplay or deploy a replacement.

- [x] Implement and verify the behavior. <!-- sdd-owner: implementation -->

## Final Verification and Explicit Non-Goals

The Unit 4 completion evidence must include the complete accepted validation surface: `npm test`, `npm run typecheck`, `npm run build`, `npm run validate:piano-assets`, and the documented manual A/B evidence review, without changing the production default or deploying.

The implementation must not add fabricated samples, runtime CDN dependencies, public pedal/CC64 events, unrelated UI/gameplay changes, production cutover, publishing, or GitHub Pages deployment. If source rights, package accounting, review budget, or A/B quality evidence fails, stop at that gate and retain the legacy path.
