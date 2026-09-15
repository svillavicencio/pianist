# Upgrade piano audio realism

## Intent

Replace the current eight-file, single-velocity piano subset with a deterministic, locally hosted, progressive Salamander Grand Piano Yamaha C5 sampler that provides the maximum feasible browser realism for the public GitHub Pages app. The change preserves the hexagonal audio boundary, keeps the `/pianist/` base path, and does not switch production playback or deploy until automated verification and human A/B listening approve the result.

The approved target is the full 16-velocity-layer, 30-anchor bank, with an approximately 5.4 MiB v8 bootstrap and an approximately 86.2 MiB complete bank. The canonical source/adaptation, redistribution rights, hashes, and attribution must be verified before assets are accepted.

## Product outcome

Users should hear a less plastic piano: velocity should alter timbre as well as loudness; pitch gaps should be substantially reduced; retriggers should overlap naturally; and release, keybed, harmonic, and pedal behavior should be used when the verified source assets support those behaviors. While the bank loads or a subset fails, the app should remain playable through a deterministic fallback rather than becoming silent or rejecting the entire load.

## Scope

### In scope

- A verified, deterministic local asset manifest for the Salamander Yamaha C5 source/adaptation, including canonical paths, ordering, hashes, format/size metadata, attribution, and bootstrap/full groups.
- Progressive, deduplicated, bounded-concurrency loading with observable readiness/progress/failure state and graceful fallback.
- Selection of pitch anchors and velocity layers with deterministic tie-breaking and fallback to the best loaded compatible sample.
- Independent overlapping voice lifecycles, sampled or source-supported release/keybed/harmonic/pedal behavior, and safe handling of rapid retriggers.
- Output headroom and limiting/compression appropriate to dense chords without allowing the limiter to conceal unacceptable clipping or pumping.
- Integration for preview and performance paths while retaining current context ownership and preview cancellation behavior.
- Automated asset, manifest, loader, selection, engine, integration, typecheck, test, and build verification.
- A human A/B listening checkpoint with a documented acceptance result before production playback replacement or deployment.

### Explicitly out of scope

- Piano in 162 or any source whose redistribution rights are not verified.
- Premium desktop instruments, fabricated samples, or runtime CDN dependencies.
- Unrelated gameplay, content, or visual changes.
- Immediate production replacement, GitHub Pages deployment, or bypassing publishing/review gates.
- Treating unit tests as proof of timbral realism.

## Bounded implementation slices

1. **Provenance and manifest**
   - Verify the exact redistributable source/adaptation and CC BY 3.0 attribution obligations.
   - Define deterministic naming, ordering, hashes, metadata, bootstrap/full groups, and validation tests.
   - Do not switch playback.

2. **Progressive loader and fallback**
   - Add typed loading state, priority scheduling, bounded concurrency, deduplication, cancellation/supersession handling, and partial-failure policy.
   - Preserve base-path URL construction and v8-only or otherwise approved bootstrap playback.
   - Prove useful fallback behavior while the full bank is unavailable.

3. **Layered engine**
   - Add anchor/layer selection, independent voices, and source-supported release/resonance/pedal behavior.
   - Add output headroom/limiting and retain a selectable old/new path for A/B comparison.
   - Keep domain ports unchanged unless adapter/composition-root ownership cannot represent an approved behavior.

4. **Integration and release gate**
   - Coordinate readiness and fallback for preview and performance in `main.ts`.
   - Verify packaged assets, exact size/accounting, deterministic manifests, strict validation, and deployment-path correctness.
   - Record human A/B listening evidence and require an explicit production replacement/deploy decision.

## Affected areas

| Area | Expected impact |
| --- | --- |
| `src/adapters/web/audio/realPianoSamples.ts` | Manifest model, progressive loader, readiness, progress, failure, deduplication, and priority policy. |
| `src/adapters/web/audio/sampleSelection.ts` | Anchor plus velocity-layer selection, loaded-layer fallback, and deterministic tie-breaking. |
| `src/adapters/web/audio/WebAudioEngine.ts` | Per-voice lifecycle, overlap, release/pedal routing, velocity timbre, output graph, and degradation behavior. |
| `src/main.ts` | One-context loading coordination for preview/performance, readiness/fallback integration, and A/B selection boundary. |
| `src/ports/AudioEngine.ts` | Only if approved lifecycle/pedal behavior cannot remain adapter-owned; avoid widening the domain API by default. |
| `public/piano-samples/` | Verified audio assets, attribution, deterministic manifest, and provenance metadata; largest storage and review impact. |
| Focused audio tests | Fakes and tests for manifest cardinality, URL/base path, loading progress/failures, selection, voice overlap, release/pedal, limiting, and fallback. |
| Build/CI validation | Asset packaging and manifest checks may be added; existing `npm test`, `npm run typecheck`, and `npm run build` remain required. |

## Business and operational impact

- The full compressed bank is expected to be about 86.2 MiB, below the cited GitHub Pages 1 GB site/repository recommendation but material for clones, CI artifacts, first visits, and mobile data.
- A roughly 5.4 MiB bootstrap improves time-to-first-use, but decoded PCM can greatly exceed compressed size; loading must bound concurrency and memory pressure.
- Preview and performance both depend on loader state, so partial failure, cancellation, duplicate requests, and notes played during loading must remain safe.
- Dense chords and overlapping retriggers increase Web Audio node pressure; any voice degradation policy must preserve the approved overlap behavior as far as practical and be explicit when limits are reached.
- Provenance, attribution, hashes, and conversion details become review-critical repository artifacts, not informal implementation notes.
- Review workload is dominated by assets and provenance rather than code. Asset/provenance review must remain a separately identifiable work unit from engine behavior, and the 400 changed-line review budget must not be crossed silently.

## Requirements and acceptance criteria

### Functional requirements

1. The manifest contains the approved 16 layers and 30 anchors, with deterministic order, canonical local URLs, provenance, hashes, and verified redistribution attribution.
2. Loading is progressive and deduplicated; bootstrap assets can become usable before the full bank completes; individual failures do not reject all usable audio.
3. Selection is deterministic across available anchors/layers and falls back to a compatible loaded sample when the preferred asset is unavailable.
4. Velocity changes sampled timbre/layer as well as gain according to a documented mapping.
5. Same-pitch retriggers and different notes can coexist as independent voices without the current one-voice replacement behavior.
6. Release, keybed, harmonic, and pedal behavior is implemented only where the verified asset provenance and routing contract support it; unsupported behavior degrades safely and is documented.
7. Output maintains headroom and a tested limiter/compressor path without audible or measurable runaway clipping under representative dense chords.
8. Preview and performance remain playable during loading, cancellation, and partial failure, with no runtime CDN dependency and correct `/pianist/` URLs.

### Verification requirements

- Add failing focused tests before implementation in each slice, then run `npm test`, `npm run typecheck`, and `npm run build`.
- Validate asset count, names, hashes, byte/format metadata, attribution, manifest determinism, bootstrap/full grouping, and packaged build presence.
- Test loader progress, bounded scheduling, cache/deduplication, cancellation/supersession, partial failure, and fallback.
- Test selection, voice overlap, release scheduling, pedal transitions, output graph, headroom, and safe degradation with Web Audio fakes.
- Perform human A/B listening using agreed target passages, loudness-normalized comparison, and representative desktop/mobile browser conditions where feasible. Record the listener, date, build/asset manifest identity, observations, and pass/fail decision.

### Measurable success criteria

- All automated checks pass with the exact committed manifest and packaged assets.
- The loader can play the approved bootstrap before full-bank completion and remains usable when a non-bootstrap asset fails.
- The manifest proves 16 layers × 30 anchors and deterministic local packaging; measured compressed size is reported rather than inferred.
- A/B listeners consistently judge the new path more natural than the current eight-sample path on the agreed passages, with no blocking clipping, loading silence, broken release, or unacceptable limiter pumping.
- Production replacement remains off until the A/B evidence, provenance review, and explicit delivery gate are approved.

## Migration and rollback

Migration is staged rather than an in-place cutover. The existing eight-sample engine remains available as the fallback and A/B baseline while the manifest, loader, and new engine are validated. The integration slice should make the new path selectable without deleting the old path.

Rollback is therefore:

1. Disable the new production selection at the composition root.
2. Restore the existing eight-sample loader/engine path and retain the verified assets for investigation.
3. If asset provenance, build size, browser memory, or listening quality fails acceptance, remove or quarantine the unapproved asset set without changing unrelated gameplay.
4. Do not deploy or publish a replacement until the failure is understood and a new explicit approval is obtained.

## Risks and mitigations

| Risk | Mitigation / gate |
| --- | --- |
| Redistribution or conversion rights are incomplete | Require source evidence, attribution, hashes, and adaptation terms before asset acceptance; reject unproven sources. |
| 86.2 MiB download and decoded memory harm mobile users | Bootstrap priority, bounded decode concurrency, measured memory/load timing, and graceful fallback. |
| MP3 artifacts, layer transitions, pitch gaps, or release mismatch reduce realism | Automated routing checks plus loudness-normalized human A/B listening; do not infer quality from tests. |
| Limiter pumping or clipping hides engine problems | Test representative dense chords, preserve headroom, and include audible A/B review. |
| Rapid loading/cancellation causes races or silence | Explicit loader state machine, deduplication, supersession tests, and old-path fallback. |
| Voice count grows without bound | Define and test a bounded degradation policy; preserve independent overlap where resources allow and document tradeoffs. |
| UI/status scope expands unexpectedly | Keep first slice to readiness/fallback unless a user-visible progress contract is required by implementation evidence. |
| Asset diff exceeds review capacity | Separate provenance/manifest review from behavior, report changed bytes/files, and ask before any review-budget exception or publishing action. |

## Delivery gates

The proposal authorizes planning and implementation of the four slices, not production deployment. Human-controlled gates remain required for:

- accepting a source/adaptation whose redistribution or conversion rights are ambiguous;
- accepting a design that materially changes pedal semantics, public UI, or domain ports beyond the stated scope;
- approving an asset/review surface beyond the 400-line budget or any size exception;
- accepting the A/B listening result as sufficient for production replacement;
- publishing or deploying to GitHub Pages.

## Next step

Create the delta specifications next, defining the testable loading, fallback, selection, voice, pedal/release, headroom, provenance, and A/B-gate requirements. Follow the specifications with design work for the four bounded slices. Do not create implementation tasks or an implementation plan yet; preserve strict TDD and the provenance/A-B gates without reopening the confirmed source, timbre, layer-count, local-hosting, or non-goal decisions.
