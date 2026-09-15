# Explore: Upgrade piano audio realism

## Result

The change should replace the current eight-file, single-layer Salamander subset with a deterministic, locally hosted progressive sampler for the full Salamander Yamaha C5 bank. The safest path is to preserve the `AudioEngine` port, evolve the web adapter and composition-root loading boundary, and stage the work behind an explicit A/B listening checkpoint before replacing production playback.

**Scope constraint:** this phase records exploration only. It does not add samples, alter configuration, or implement behavior.

## Repository facts

| Area | Current evidence | Impact |
| --- | --- | --- |
| Architecture | Hexagonal TypeScript app; domain audio boundary is `src/ports/AudioEngine.ts`; Web Audio implementation is `src/adapters/web/audio/WebAudioEngine.ts`. | Keep MIDI/velocity concerns out of domain code; most behavior belongs in web audio adapters. |
| Composition root | `src/main.ts` creates one `AudioContext`, starts `loadRealPianoSamples` using `import.meta.env.BASE_URL + piano-samples`, and constructs engines for preview and performance. | Loader state and graceful degradation will affect both preview and play paths. Preserve `/pianist/` base handling. |
| Current manifest/loader | `src/adapters/web/audio/realPianoSamples.ts` exports `REAL_PIANO_SAMPLE_FILES` with eight v8 FLAC anchors and uses `Promise.all`; any fetch/decode failure rejects the entire load. | Replace all-or-nothing loading with manifest-driven progress and failure policy. |
| Current selection | `sampleSelection.ts` chooses the nearest available MIDI anchor and computes equal-temperament playback rate; current tests explicitly encode endpoint clamping and large pitch gaps. | Selection tests and assumptions must be revised for 30 minor-third anchors and layer selection. |
| Current voice model | `WebAudioEngine.ts` stores one active voice per MIDI pitch in `Map<MidiNote, ActiveNote>`, cutting same-pitch retriggers. It uses gain-only velocity, a 0.9-second key-release fade, and direct output connection. | Independent overlapping voices, natural releases, pedal behavior, and limiting require a new voice lifecycle and output graph. |
| Input/piece flow | `main.ts` retains `NoteHandle`s for current presses and simulates sustain by delaying release while any input remains down. `DomInputSource` exposes press/release/blur; `PieceEngine` emits authored note velocity. | Existing hold/release behavior is a useful integration seam, but true pedal semantics and release samples need explicit design. |
| Tests | Focused Vitest coverage exists in `WebAudioEngine.test.ts`, `realPianoSamples.test.ts`, and `sampleSelection.test.ts`; fakes record Web Audio calls. | Strict TDD can extend these fakes and add loader/voice integration tests before production changes. |
| Assets/licensing | `public/piano-samples/ATTRIBUTION.md` identifies Salamander Grand Piano V3, Alexander Holm, Yamaha C5, and CC BY 3.0; it states that only 8 of 641 files are currently present. | Expanded assets need verified attribution, source identity, hashes, deterministic paths, and a checked-in manifest. |
| Deployment | `.github/workflows/deploy.yml` runs typecheck, tests, build, and Pages artifact upload; deployment occurs only on a push to `master`. `vite.config.ts` exists and project context specifies base `/pianist/`. | No direct deployment is part of this change; CI/build must prove the bank is packaged under the Pages base path. |
| Tooling | `package.json` provides `npm test`, `npm run typecheck`, and `npm run build`; TypeScript is strict with `noUncheckedIndexedAccess`. | Test seams and manifest typing must remain strict and browser-compatible. |

## Confirmed product and source constraints

These are confirmed decisions/evidence supplied for this change, not assumptions to reopen during exploration:

- The target is maximum feasible web audio quality, using the full Salamander Yamaha C5 timbre.
- The bank target is 16 velocity layers and 30 pitch anchors every minor third, with progressive loading.
- Hosting is local GitHub Pages content with no external CDN runtime dependency and the `/pianist/` base path preserved.
- The source is SalamanderGrandPiano (48 kHz/24-bit, 16 layers, minor thirds, release/resonance/pedal material, CC BY 3.0); the browser MP3 adaptation in `tambien/Piano` is evidence for 641 MP3 files, measured 86.2 MiB total, 30 anchors, and configurable 1–16 layers.
- The source/asset manifest must be deterministic and redistribution attribution must be verified. Piano in 162 redistribution is unproven; premium desktop instruments are out of scope.
- The approved direction includes an approximately 5.4 MiB v8 bootstrap, up to approximately 86.2 MiB full MP3 bank, velocity-based timbre selection, natural release/keybed/harmonics/pedal behavior, independent overlapping voices, output headroom/limiting, graceful loading degradation, and an A/B listening checkpoint before production replacement/deploy.

## Existing diagnosis

The current behavior explains the plastic sound: eight v8 FLAC anchors cover only sparse notes, nearest-anchor selection creates 9–12 semitone gaps and endpoint clamping, velocity only changes gain, same-pitch voices are tracked as one, release is generic, and there is no pedal/release/resonance/round-robin/limiter path. Loading is eager and all-or-nothing, so it cannot provide useful sound while the bank is arriving.

## Likely change surface and blast radius

1. **`src/adapters/web/audio/realPianoSamples.ts`** — replace the hardcoded map with a typed deterministic manifest and progressive loader; likely expose readiness/progress/failure state and priority loading.
2. **`src/adapters/web/audio/realPianoSamples.test.ts`** — verify manifest cardinality/naming/order, URL construction under the base path, bootstrap/full loading, progress, cache/deduplication, and partial failure behavior.
3. **`src/adapters/web/audio/sampleSelection.ts`** — select pitch anchor plus velocity layer (and possibly release/resonance variants), with deterministic tie-breaking and graceful fallback to loaded layers.
4. **`src/adapters/web/audio/sampleSelection.test.ts`** — replace sparse-anchor assumptions with layer and anchor selection scenarios, including missing-layer fallback.
5. **`src/adapters/web/audio/WebAudioEngine.ts`** — manage per-note independent voice instances, sampled release/pedal behavior, optional round robin, headroom, and a limiter/compressor output chain while retaining testable Web Audio seams.
6. **`src/adapters/web/audio/WebAudioEngine.test.ts`** — assert graph wiring, voice overlap, velocity layer choice, release scheduling, pedal transitions, limiter/headroom, and safe degradation.
7. **`src/ports/AudioEngine.ts`** — likely only if the engine needs lifecycle/status or pedal operations not representable by `noteOn`/`NoteHandle`; avoid widening the domain port unless the behavior cannot remain adapter/composition-root owned.
8. **`src/main.ts`** — coordinate progressive bank readiness for preview and performance, loading UI/status or fallback policy, and the A/B checkpoint; preserve one context and current preview cancellation generation.
9. **`public/piano-samples/`** — add only verified source files and attribution/manifest artifacts during implementation; this is the dominant storage/review risk and is intentionally untouched in explore.
10. **Build/deployment verification** — likely `vite.config.ts`, workflow checks, or a manifest validation script only if needed to prove local asset packaging; no deployment action is planned.

## Performance, storage, and review risks

- **Storage/download:** the stated full bank is about 86.2 MiB, below the cited GitHub Pages 1 GB site/repository recommendation but significant for first visit, clone size, CI artifact upload, and mobile data. A 5.4 MiB v8 bootstrap is a useful fast path; exact accounting must be verified from committed files rather than inferred.
- **Decode/memory:** decoded PCM is much larger than compressed MP3. Loading all layers concurrently could spike memory and main-thread decode time. Progressive scheduling, bounded concurrency, and a policy for retaining decoded buffers are required hypotheses to validate.
- **Playback quality:** MP3 loop/encoder artifacts, pitch-shift distance, layer boundaries, abrupt release substitution, and limiter pumping can undermine the realism goal. Listening tests are necessary; unit tests cannot establish timbre quality.
- **Concurrency:** rapid piece changes, preview cancellation, duplicate loads, partial failures, and notes arriving while layers are unavailable can expose races in `main.ts` and the loader.
- **Voice pressure:** dense chords and overlapping retriggers can create many Web Audio nodes. A bounded voice policy must not violate the approved independent-overlap behavior; any stealing/degradation rule needs explicit acceptance.
- **Asset/license review:** source provenance, CC BY 3.0 attribution, filename mapping, checksums, and any MP3 conversion/adaptation rights must be reviewable. Do not fabricate files or rely on an unproven redistribution.
- **Review budget:** code can likely remain within the 400 changed-line review budget when split, but an 86 MiB asset addition is not cognitively reviewable as ordinary diff content. Separate asset provenance/manifest review from engine behavior, and ask before crossing any review-budget or publishing gate.

## Staging options

### Recommended: four bounded slices with checkpoint

1. **Provenance and manifest slice:** verify the exact redistributable source and adaptation, define canonical file naming, hashes, byte/format metadata, and bootstrap/full groups; add manifest validation tests without switching playback.
2. **Progressive loader and fallback slice:** implement typed loading state, priority/bounded concurrency, deduplication, cancellation/supersession handling, and v8-only playback fallback; test loading under failures and the Pages base path.
3. **Layered engine slice:** add velocity-layer/anchor selection, independent voice objects, sampled/natural release and resonance/pedal handling where source assets support it, and headroom/limiting; keep old playback selectable for A/B.
4. **Integration and release slice:** wire preview/performance readiness and graceful degradation in `main.ts`, expose the A/B listening checkpoint, verify manifest/build/package size, run strict validation, then require an explicit production replacement/deploy decision.

### Alternative: engine-first

Refactor `WebAudioEngine` against synthetic test buffers before asset provenance and loader work. This reduces early asset churn but risks designing around incorrect file names, formats, release semantics, or redistribution rights. Not recommended for this source-sensitive change.

### Alternative: asset-first

Commit the complete bank and manifest before engine changes. This makes storage and licensing concrete but creates a large review surface and leaves the app on the old behavior while assets land. Useful only as a separately approved provenance work unit, not as a production switch.

## Open technical questions

1. What exact canonical asset set is redistributable: original FLAC, the `tambien/Piano` MP3 adaptation, or a newly generated MP3 derivative with documented rights? What are the authoritative hashes and conversion parameters?
2. Does the chosen bank contain separately usable key-release, pedal/resonance, keybed, and harmonic samples, and what is their naming/routing contract? “Natural behavior” cannot be implemented from velocity attacks alone.
3. What velocity-to-layer mapping is desired: 16 discrete bands, calibrated thresholds, interpolation/crossfade, or a hybrid? How should unavailable layers fall back while loading?
4. What is the bootstrap selection and priority policy for a note range, current piece, preview, and full 16-layer completion? Is v8 guaranteed available before interaction or merely preferred?
5. What bounded decode concurrency and decoded-memory ceiling are acceptable across desktop and mobile browsers, and should compressed files be retained after decode?
6. What pedal input is product-valid today? Current DOM input treats held keys/pointers as a simulated sustain group; a real pedal control or MIDI CC 64 path is not evidenced in the repository.
7. How should a limiter be calibrated to preserve headroom without hiding clipping or pumping in dense chords, and what browser support/fallback is required?
8. What measurable A/B acceptance rubric and listener checkpoint gate production replacement (blind comparison, target passages, devices, loudness normalization, and sign-off owner)?
9. Should the loader expose a user-visible progress/status surface, or only a ready/fallback state? The current menu and game UI have no audio-loading status contract.
10. How will GitHub Pages artifact size, cache behavior, and bandwidth be verified in CI without performing deployment during this change?

## Proposed verification shape

Strict TDD remains the project contract: each slice starts with failing focused tests, then the minimum implementation. Expected final checks are `npm test`, `npm run typecheck`, and `npm run build`. Add deterministic manifest/asset validation and browser/manual listening evidence as separate checks; do not treat unit tests or `go test`-style unrelated commands as proof of audio realism.

## Facts versus hypotheses

- **Facts:** current files, symbols, eight v8 FLAC map, all-or-nothing `Promise.all` loader, one-voice-per-MIDI map, 0.9-second release, current base-path construction, existing attribution text, CI commands, and the source/size figures explicitly supplied for this change.
- **Hypotheses requiring specification/design:** exact asset/adaptation rights, release/resonance routing, layer thresholds, loader scheduling and cancellation API, decoded-memory limits, limiter parameters, pedal control semantics, UI progress, and A/B acceptance criteria.

## Explore handoff

Specification should define externally observable loading, fallback, selection, voice, pedal/release, headroom, attribution/manifest, and A/B-gate requirements before planning. Planning should preserve the four bounded slices, keep assets/provenance separately reviewable, and avoid any production asset switch or deployment until the listening checkpoint and human-controlled delivery gates pass.
