# The Last Line — prototype design

Source: `The last line.pdf` (4-page game design document, Slovenian). This
document turns it into something buildable. Decisions are tagged:
**[user]** = decided by Žiga, **[pdf]** = stated in the PDF,
**[builder]** = Claude's call (also logged in `docs/odlocitve.md`).

## 1. Intent

A playable browser prototype of *The Last Line*, a two-player turn-based
strategy game on a shrinking board. Žiga wants to show it to friends: two
people sit at **one device** and take turns (hot-seat) **[user]**. It must be
hosted at a public URL **[user]**.

Context **[user]**: this is one of several candidate ideas for a course
project (RGTI); the team hasn't picked one yet. The prototype exists to help
them **decide** — so what matters is how the game *plays* and roughly how it
*looks*, not course-rubric features (lighting models, 3D models, sound). Those
can come later if this idea wins.

The PDF itself says the rules are a first draft that will be tuned after
playtesting ("not too random"). So the prototype's job is (a) to be fun and
understandable on first contact, (b) to make rule variants easy to try, and
(c) to show the intended doodle look convincingly enough to judge the idea.

### Goals
- Complete, bug-free game loop: start screen → play → win/draw screen → rematch.
- Rendering in **raw WebGPU** — no engine (no three.js / Babylon / PlayCanvas)
  **[user]**. DOM/CSS is fine for HUD and menus; Canvas2D is fine for
  generating textures.
- "Doodly" hand-drawn look: 3D board you can orbit, everything on it looks
  hand-drawn and 2D **[pdf]**.
- Most intuitive controls possible **[user]**; works with mouse and touch.
- UI text in **Slovenian** **[user]**; code, comments, commits in English.
- Rules panel to tweak variants before a match **[builder]**.
- Hosted on GitHub Pages **[builder]** (see §8).

### Non-goals
- Online multiplayer, AI opponent for humans, accounts, persistence.
- Lore, power-ups, sound, a real easter egg (PDF lists these as future work).
- Supporting browsers without WebGPU (show a friendly message instead).

### Anti-goals (would be a failure even if it "works")
- Players can't tell whose turn it is, what an action will do, or which tiles
  are about to vanish.
- The game feels decided by dice: a player dies without a fair chance to react.
- Looks like generic flat-shaded 3D instead of a doodle.

## 2. Board and tile states

Square grid, default **8×8** **[pdf]**; selectable 6 / 8 / 10 in the rules
panel **[builder]**. Coordinates `(x, y)`, `0..N-1`.

Each cell is one of:
| State | Walkable | Notes |
|---|---|---|
| **Land** | yes | Normal tile. |
| **Tree** (land + tree) | no | Obstacle. If erosion hits it, the tree is destroyed and the tile stays land **[pdf]**. |
| **Gap** | no | Missing tile. Can be bridged. |
| **Bridge** (gap + bridge, orientation `H` or `V`) | crossed, never stood on | Spans exactly one gap tile between two land tiles **[pdf]**. |

Players occupy land tiles; two players never share a tile; a player never
stands on a tree tile.

### Initial layout [builder]
Generated from a seeded RNG, **point-symmetric** (cell `(x,y)` mirrors
`(N-1-x, N-1-y)`) so neither side is favoured:
- P1 (blue rat) starts at `(1, ⌊(N-1)/2⌋)`, P2 (red rat) at the mirror cell.
  For 8×8: `(1,3)` and `(6,4)`.
- `N²/16` trees (4 on 8×8), placed in mirrored pairs.
- 2 interior gaps (1 mirrored pair), not on the outer ring.
- Nothing placed on or 4-adjacent to a start tile.
- The seed is shown in the rules panel and accepted via `?seed=` URL param
  (reproducible bug reports).

## 3. Round structure [user]

A **round** = both players take exactly one action each, then erosion resolves.

1. **Mark.** Erosion selects K land tiles and marks them visibly (a doodle
   warning flag, as in the PDF sketch).
2. **Turn A.** The starting player takes one action.
3. **Turn B.** The other player takes one action.
4. **Resolve.** Each marked tile: if it has a tree → tree destroyed, tile
   stays land; otherwise → tile becomes a gap. A player standing on a tile
   that becomes a gap **falls** (is eliminated). Any bridge whose endpoint
   became a gap collapses (removed) **[builder]**.
5. **Check end.** Exactly one fell → the other wins. Both fell → draw **[pdf]**.
   Otherwise the next round starts.

The starting player **alternates** each round (round 1: P1, round 2: P2, …)
**[user]**.

### Erosion selection [pdf + user]
Default per round: **2 edge tiles + 1 random tile** (both counts adjustable
in the rules panel, 0–4 each).
- *Candidates* are land tiles, including tree tiles and tiles a player stands
  on (erosion may target a player's tile **[pdf]**).
- *Edge tile* **[builder]**: a land tile 4-adjacent to the "outside" — the
  area beyond the board plus every gap/bridge cell connected to it through
  gaps (flood fill). Internal holes not connected to the outside don't make
  their neighbours "edge". This keeps the board shrinking from the outside
  in **[pdf]**.
- Pick `edgeCount` distinct edge tiles uniformly at random, then `randomCount`
  distinct tiles uniformly from all remaining land. If too few candidates
  exist, take what's available.

## 4. Actions

On their turn a player does exactly one of the following **[pdf]**. Range
for drawing/erasing is **anywhere on the board** by default **[user]**; the
rules panel also offers "within 2" and "adjacent" (Manhattan distance from
own rat) **[builder]**.

- **Move (Premik).** To a 4-adjacent land tile without a tree or the other
  player. Moving onto a marked tile is allowed (it's usually a mistake).
- **Move across bridge.** If the 4-adjacent cell in direction *d* is a bridge
  oriented along *d*, and the cell beyond it is free land, the rat moves
  there (2 cells) in one action **[pdf]**.
- **Draw tree (Drevo).** On any land tile with no tree and no player.
  Allowed on marked tiles — that's how you save a tile **[pdf]**.
- **Draw bridge (Most).** On a gap cell whose two opposite neighbours along
  an axis are both land (tree on an endpoint is OK — the tree just blocks
  crossing until erased). If both axes qualify, the player picks the
  orientation **[builder]**. Bridges only span 1×1 gaps **[pdf]**.
- **Erase (Radirka).** Remove any tree or bridge **[pdf]**.
- **Skip (Preskoči).** Do nothing **[builder]** — added so a player is never
  forced into a harmful action, and as the automatic action when nothing else
  is legal.

No ink/resource limit in v1 **[builder]**; revisit after playtesting.

Losing: the PDF's "can't avoid erosion" condition is covered naturally — a
player who stays on a marked tile, or has no choice but to step onto one,
falls at resolution.

## 5. Controls and UX [builder, guided by "most intuitive"]

- **Toolbar** at the bottom: Premik · Drevo · Most · Radirka · Preskoči, with
  keys `1`–`5`. Defaults back to *Premik* at the start of each turn. Each
  button uses the active player's colour.
- Hovering the board highlights all tiles where the selected action is legal
  (scribbled hatch in the player's colour) and shows a ghost preview on the
  hovered tile. **Click = perform.** Illegal tile → nothing happens plus a
  small "shake".
- Clicking your own rat selects *Premik*.
- Bridge orientation: if both are possible, the preview shows one; `R` or the
  ⟲ button on the toolbar toggles it.
- **Camera:** left-drag (or one-finger drag) orbits, wheel/pinch zooms, `Q`/`E`
  snap-rotate by 90°. A drag beyond ~6 px is not a click. Pitch is clamped
  so the board never flips.
- **HUD:** "Krog 3", a big "Na potezi: Modra podgana" banner that animates on
  turn change, and a small hint line describing the selected action.
- **Pacing:** after turn B the erosion plays out as an animation (marked tiles
  crumble and drop, trees poof, a rat on a falling tile tumbles), then new
  marks are sketched in, then the next turn banner. Input is blocked during
  animations (~1.5 s total).
- **End screen:** big "ZMAGA!" (Wii-style, as in the PDF reference) with the
  winner's rat and a short random message; "Neodločeno" for a draw. Buttons:
  *Še enkrat* (same rules, new seed) and *Meni*.
- **Start screen:** title, *Igraj*, *Pravila igre* (short how-to-play in
  Slovenian), *Nastavitve pravil* (board size, erosion edge/random counts,
  draw range, seed).
- No undo in v1 **[builder]**: the hover preview is the misclick guard.

## 6. Art direction [pdf + builder]

Target: a page from a sketchbook. Reference: the PDF illustrations
(isometric grid paper, cream tiles with little ink doodles on top, hatched
sides, round fluffy trees, plank bridges, warning flag).

- **Background:** procedural paper (warm off-white, fibre noise) with a faint
  grid, drawn in a fullscreen pass.
- **Tiles:** 3D boxes (~0.35 tall) with slightly irregular per-tile height and
  rotation jitter. Top faces: paper white with small doodle marks (swirls,
  grass ticks) from a texture atlas. Sides: hatching.
- **Ink outlines:** post-process edge detection on depth + normals + object
  ID, with noise-jittered sample offsets so lines wobble. Lines "boil"
  (jitter re-seeded ~8×/s) like hand-drawn animation.
- **2D elements:** rats, trees, flags as camera-facing billboards; bridges and
  highlights as flat quads on the board.
- **Reuse the PDF drawings [user]:** the team's own illustrations in the PDF
  may be cut out and used. They are isometric, so only parts that work as
  upright billboards or decals are usable: the **tree** (cut above the tile),
  the **warning sign** (erosion marker), and the small **top-face doodles**
  (swirl, flower, grass tufts) as decals. The grass-fringe tile edges and
  hatched sides are reproduced in the tile textures/shader to match.
  Everything else (rats with pencil/eraser, bridge planks, highlights, end
  screen art) is drawn procedurally with Canvas2D in the same style.
  Extracted assets live in `public/sprites/`; any PNG there overrides a
  generated sprite of the same name, so new drawings can be dropped in.
- **Players:** two rats [pdf "podgani"], blue and red ink, each carrying a
  pencil and an eraser **[pdf]**.
- Font: a handwritten Google Font with Slovenian glyphs (č š ž).

## 7. Tech constraints [builder]

- TypeScript + Vite (dev server and bundling only) + `@webgpu/types`.
  No runtime dependencies. Own small vec/mat math module.
- Game rules in a pure, rendering-free module (`src/game/`) with unit tests
  (Vitest). Renderer and input only read state and dispatch actions.
- Headless simulation script (`npm run sim`): two heuristic bots play many
  games to get balance numbers (game length, first-mover advantage, draw rate).
- Debug hooks: `window.__game` exposes state/actions for automated tests.
- If `navigator.gpu` is missing or the adapter request fails: a friendly
  Slovenian message listing supported browsers (desktop Chrome/Edge, Android
  Chrome, Safari 26+).
- Must run at 60 fps on an average laptop; must handle resize and high-DPI.

## 8. Hosting [builder]

Public GitHub repo `zigagobec/the-last-line` (the `gh` CLI is already logged
in). A GitHub Actions workflow builds and deploys to GitHub Pages on push to
`main`. Expected URL: `https://zigagobec.github.io/the-last-line/`. Free Pages
requires the repo to be public. No Google login needed.

## 9. Verification

- Unit tests for every rule in §2–§4 (moves, bridge crossing, placement
  validity, erosion selection and resolution, win/draw, symmetry of setup).
- Simulation stats reviewed for balance; findings logged.
- Browser playtests via Playwright on the deployed URL: several full games,
  including deliberate edge cases (bridge crossing, saving a tile with a
  tree, both players falling, all tiles gone).
- All dilemmas found during implementation go into `docs/odlocitve.md`
  (question / answer / reasoning), in Slovenian.

## 10. Left to the builder
Exact visual tuning, animation timings, shader structure, file layout, bot
heuristics, the random end-screen messages.
