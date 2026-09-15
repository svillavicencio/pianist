# A/B listening gate

Status: **FAIL — human listener rejected the sampler path.**

- Listener(s): Sergio Villavicencio (project owner)
- Date/time: 2026-09-15, local dev session
- Device/browser: not recorded (local `npm run dev`, browser unspecified)
- Build: local dev server (`vite`, unbuilt/HMR), commit `8d55169`
- Manifest SHA-256: `064a4b5ab6153ae446260ffa1eb00ccb33663e4ce57e142945ad52c7e6e0081d`
- Loudness normalization: not performed — direct A/B via `?audio=legacy` vs `?audio=sampler`, no level-matching step
- Pass/fail decision: **FAIL**

## Observation

Listener's own words: "no me gusta para nada, siento que es mas de plastico
todavia las notas" — does not like it at all, notes feel even more
"plasticky"/artificial than the legacy path, not less. This is the opposite
of the intended outcome (the whole point of the sampler upgrade was to sound
*more* realistic than the legacy 8-sample baseline).

No structured per-passage breakdown (opening chords / fast retriggers / loud
dense chord / release-focused passage) was collected — this was a quick
informal comparison, not the full structured protocol the spec calls for.

## Decision

**The sampler path is rejected as-is.** Production remains legacy-default
(unchanged — the sampler was never reachable in production anyway). This
gate does not authorize promoting the sampler to production default, and the
implementation should not be considered validated for its intended purpose
despite all automated checks passing. Root cause is not yet diagnosed —
possible culprits include velocity-layer mapping, attack-sample selection
per note, harmonic-resonance mixing, or the "screaming" high-velocity
attacks in the Salamander library needing gain/EQ treatment. This needs
either further tuning or reconsideration of the approach before any future
attempt to make the sampler the default.
