# Visual & UX overhaul (notes, background, menus, timing)

## Problem

Four related readability/aesthetic issues, confirmed by hands-on browser testing
(`Perform` on "Ode to Joy") and by reading the render/style code:

1. **Notes are hard to tell apart.** `THEME_COLORS` (`noteParticleLifecycle.ts`)
   maps each piece to one flat hex — every note in a piece is the same color.
   Pitch is only encoded via x-position. The upcoming-preview dot and the
   hit-particle dot for the *same* color also only differ by size (10px vs
   24px radius) and alpha (0.55 vs 1) — not enough to read apart at a glance.
   `darkenHex` (used to alternate consecutive chords in the preview) mixes
   *toward black*, which on a near-black background compresses rather than
   separates the two shades.
2. **The background is a flat `#111111`** (`PIXI.Application.init({ background:
   '#111111' })` in `main.ts`) — no depth, no target marker for where notes
   should be hit (`SPAWN_HEIGHT_FRACTION = 0.85` is implicit, never drawn).
3. **Menus are generic.** `src/ui/styles.ts` already has a small design-token
   system (`--bg`, `--surface`, `--accent`, etc.) and isn't literally
   unstyled, but it's one flat accent blue with no visual identity tied to
   the piano theme, and `.pause-menu` has no scrim — the gameplay canvas
   stays fully visible, undimmed, behind the pause card.
4. **Falling notes visually stack in fast passages.** `positionUpcoming()`
   (`PixiRenderer.ts`) maps each chord's `distanceMs` linearly onto a fixed
   3000ms window (`UPCOMING_LOOKAHEAD_MS`) — this is a direct, faithful
   encoding of the piece's authored rhythm (`screenDurationMs`), not a bug.
   But two chords 150ms apart in a fast run land ~23px apart on screen while
   the dots are 20px wide — they visually merge. Chords seconds apart, at the
   same scale, look artificially "slow" by comparison.

## Design

### 1. Pitch-aware color

Replace the flat per-theme hex with a per-theme HSL gradient definition:

```ts
interface ThemeGradient {
  readonly hueStart: number;   // degrees, 0-360
  readonly hueEnd: number;
  readonly saturation: number; // 0..1
  readonly lightness: number;  // 0..1 — floor value, see contrast note below
}
```

`colorThemeToHex(theme: ColorTheme): number` becomes
`colorForNote(theme: ColorTheme, midi: MidiNote): number`, interpolating hue
by `(midi - MIN_MIDI) / (MAX_MIDI - MIN_MIDI)` between `hueStart`/`hueEnd`,
then converting HSL → hex. Every call site that currently passes just
`colorTheme` (`spawnNoteVisual`, `showUpcoming`) threads `midi` through too —
`showUpcoming` already has each chord's `midis` in scope.

**Contrast floor:** each `ThemeGradient.lightness` is authored ≥ a documented
minimum (e.g. 0.4) so no theme (e.g. `silver`) can render too close to the
background's luminance.

### 2. Shape distinguishes upcoming vs. hit, not just size/alpha

- Upcoming dots: stroke-only circle (`.circle(...).stroke({...})`, no fill) —
  reads as "not yet played" independent of color perception.
- Hit particles: unchanged, filled circle.
- Size/alpha differences stay as secondary reinforcement.

### 3. Chord alternation lightens, not darkens

Replace the `darkenHex` step in `showUpcoming` with a lightness-shift function
(e.g. `shiftLightness(hex, amount)`, signed) that raises the alternate
chord's lightness instead of mixing toward black. Tuned so both shades stay
clearly separated from each other *and* from the background — darkening
toward black actively works against that on a dark canvas.

### 4. Minimum visual gap between upcoming notes

Add `MIN_UPCOMING_GAP_PX` (radius²-ish plus breathing room — tune against
`UPCOMING_RADIUS_PX = 10`, start around 26–28). In `positionUpcoming()`,
after computing each tracked chord's raw `y` (already implicitly ordered by
ascending `distanceMs`, nearest-due first), walk from nearest to farthest:
if `previousY - currentY < MIN_UPCOMING_GAP_PX`, clamp `currentY =
previousY - MIN_UPCOMING_GAP_PX`. The nearest-due note (`upcoming[0]`, about
to be hit) is never adjusted — accuracy matters most right at the hit line.
Only notes still far out in the 3s window absorb the compression, where the
timing distortion isn't perceptible. This keeps `screenDurationMs` fidelity
(per the earlier decision) while guaranteeing dots never visually merge.

### 5. Background gradient + hit-line marker

- Swap the flat Pixi `background: '#111111'` for a subtle gradient (e.g. a
  very dark navy near the top fading to near-black at the hit line), drawn
  as a `PIXI.Graphics` rect. Pixi's `background:` init option only accepts a
  solid color, so this needs to be an actual display object.
- This graphic must never be touched by `tick()`/`showUpcoming()` — it's not
  a tracked particle or upcoming dot. Add it once, as the first child of
  `app.stage`, before `PixiRenderer` starts adding its own children (either
  in `main.ts` directly, or as a one-time draw in `PixiRenderer`'s
  constructor that lives outside `this.particles`/`this.upcoming`).
- Redraw it on `resize()` (currently `PixiRenderer.resize()` only updates
  `width`/`height` fields, doesn't touch any visuals).
- Add a thin, low-alpha (~0.15–0.2) horizontal hit-line at
  `y = height * SPAWN_HEIGHT_FRACTION`, redrawn on resize too — today
  `SPAWN_HEIGHT_FRACTION` only affects where particles spawn, it's never
  actually shown to the player. This is a real UX gap, not just polish: the
  player has no visual target for "where do I hit this."

### 6. Menu restyle + pause scrim

`src/ui/styles.ts` already has a token system (`--bg`, `--surface`,
`--accent`, etc.) — this is a restyle, not a from-scratch build:

- Broaden the flat single-accent look into something tied to the piano
  theme: subtle gradient/depth on `.main-menu__pack` cards (currently flat
  `var(--surface)`), refined type scale between pack title / composer
  subtitle / piece row (currently mostly font-size deltas only).
- Hover/active states already exist on buttons and rows — keep those,
  extend the same treatment to the pause menu (currently `.pause-menu
  button` only sets padding, inheriting the global `button` hover, which
  is fine — the gap is the missing scrim below).
- Add a scrim behind `.pause-menu`: a fixed, full-viewport
  `rgba(0,0,0,0.6)`-ish overlay so the paused game canvas stops being fully
  visible/legible behind the modal. Simplest implementation: a sibling
  `<div class="pause-menu__scrim">` created alongside `root` in
  `renderPauseMenu()`, torn down in the same `destroy()`.

## Other changes

- `noteParticleLifecycle.ts`: `THEME_COLORS` → `THEME_GRADIENTS`;
  `colorThemeToHex` → `colorForNote(theme, midi)`; `darkenHex` →
  `shiftLightness(hex, amount)` (signed, replaces the one call site in
  `showUpcoming`).
- `PixiRenderer.ts`: new background/hit-line graphics (constructor +
  `resize()`), `MIN_UPCOMING_GAP_PX` constant + gap-enforcement pass in
  `positionUpcoming()`, stroke-only upcoming dots in `showUpcoming()`.
- `main.ts`: pass `midi`/chord context through to color calls if the
  gradient math ends up living outside `PixiRenderer`; otherwise no change
  needed there.
- `styles.ts`: restyled `.main-menu__pack`, new `.pause-menu__scrim` rule,
  no changes to the token variable *names* (values/gradients can change).

## Non-goals

- No changes to gameplay mechanics (trigger/seek/pedal-hold logic).
- No new particle animation beyond the existing pop/fade lifecycle
  (`particleStateAt`) — this is a color/shape/background/layout pass, not a
  new animation system.
- No audio changes.

## Rejected alternatives

- **Constant fall speed** (ignore authored rhythm): rejected — explicitly
  want to keep `screenDurationMs` fidelity.
- **Dynamic lookahead window** (shrink/grow `UPCOMING_LOOKAHEAD_MS` by local
  note density): rejected in favor of the simpler min-gap compression pass —
  a moving window would make the hit-line's "due now" timing less stable and
  harder to reason about than a fixed 3000ms window with local
  compression.
- **Keep flat per-piece color, only raise contrast/size**: rejected — user
  explicitly wants individual notes distinguishable by pitch, not just
  higher contrast against the background.

## Open follow-ups for implementation

- `MIN_UPCOMING_GAP_PX` and the gradient's `lightness` floor are both
  empirical — tune against real dense passages (e.g. the Liszt/Chopin
  pieces) and against `silver`/`midnight` themes specifically, since those
  were the ones flagged as low-contrast.
