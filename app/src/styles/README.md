# Styles

One entry, `index.css`, imported once from `src/main.tsx`. It `@import`s the files below in a **fixed order** (later files win ties):

| Order | File | Owns |
|---|---|---|
| 1 | `tokens.css` | Every custom property: surface, text, accent, state/hazard, map, cost categories, difficulty, type scale, 4-pt space, radii, elevation, motion, fonts. Light (`:root`), dark (`:root[data-theme='dark']` and the `prefers-color-scheme` fallback), then the legacy aliases. The only file with raw colour values. |
| 2 | `base.css` | `@font-face` (self-hosted, latin, metric-matched fallbacks), reset, body, type roles (`h1`..`h3`, `.t-*`, `.num-*`), links, buttons (`.go`, `.back`, `.icon-btn`), form controls, focus ring, skeleton, banner, `.sr-only`, reduced motion. |
| 3 | `explore.css` | The Explore screen: the left rail (brand row, quarter chips, filters, sliders, ranked list, difficulty dots), every overlay on the map (count, 2D\|3D control, tip, guide card, preview tile, legend) and the phone layout at the end (bottom sheet, filters sheet, compact legend). |
| 4 | `hike.css` | The hike page: header, facts, quarter cards, cost controls and bars, popover detail. |
| 5 | `map.css` | Only the map pane, its canvas, the zoom controls, the unblur filter and the MapLibre overrides. Keep the `#mapPane .us-map` id selector (MapLibre's CSS loads after ours). |
| 6 | `view3d.css` | Only the 3D scene and its dashboard (and the legend lift above the dashboard). |

`fonts/` holds the WOFF2 files (Inter, Fraunces, Archivo; SIL OFL, licences included). Vite hashes them and respects the Pages base path.

## Rules
1. **Tokens only.** No raw hex or `rgb()` in any CSS file except `tokens.css`, and none in `.tsx`. The one allowed exception for TypeScript is `lib/difficulty.ts` (canvas code cannot use `var()`); `difficulty.test.ts` fails if its values differ from `--diff-*` here. Canvas code reads other tokens with `readToken('--map-land')` from `lib/theme.ts`.
2. **No new font sizes.** Use `--fs-micro 11`, `--fs-small 12`, `--fs-body 14`, `--fs-body-l 16`, `--fs-h3 18`, `--fs-h2 22`, `--fs-h1`, and the numbers `--fs-num-s/m/l 15/20/32` (condensed face, tabular). Serif (`--font-display`) for h1/h2 and verdict/headline text, Inter for the rest, `--font-num` for big numbers. Weights: 400/500/600 only.
3. **Space and radius from the scale.** `--space-1..12` (4-pt), `--radius-1..4`; `--radius-pill` only for toggles.
4. **Flat.** Hairline borders by default, one overlay shadow (`--shadow-overlay`) for cards floating over the map. No gradients, glows, blur or backdrop-filter in tokens or base.
5. **Contrast is tested.** `lib/contrast.test.ts` reads `tokens.css` for both themes. Change a colour, run `npm test`.
6. **Keep the order.** New rules go in the file that owns the screen; do not rely on a rule in another file winning, and do not restyle another file's rule with a higher-specificity prefix: edit it where it lives. `npm run design:check` fails on raw hex and glyph icons in TypeScript.
7. Legacy names (`--ink`, `--panel`, `--panel2`, `--muted`, `--body-text`, `--accent-halo`, `--font-head`) are aliases at the end of `tokens.css`. Do not use them in new code; delete one when nothing references it.

## Adding a theme
1. Copy the `:root[data-theme='dark']` block in `tokens.css`, rename the selector (`:root[data-theme='sepia']`), change the values.
2. If it should follow a system setting, add the media block (keep it identical to the data-theme block; the test compares the two for dark).
3. Add the name to `Theme` and `parseTheme` in `lib/theme.ts`, to `DIFFICULTY_BY_THEME` in `lib/difficulty.ts`, and to the inline script in `index.html`.
4. Add it to `themes` in `src/test/tokens.ts` and the `describe.each` in `contrast.test.ts`. Tests must pass before it ships.

Canvas code (MapLibre, three.js) cannot read CSS directly: use `useMapColors()` / `resolveMapColors` in `app/src/lib/themeColors.ts` so it follows the theme live.
