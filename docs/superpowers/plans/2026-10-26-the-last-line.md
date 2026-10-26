# The Last Line Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hot-seat, two-player browser prototype of *The Last Line* rendered in raw WebGPU with a doodle look, hosted on GitHub Pages.

**Architecture:** Pure, immutable game-rules module (`src/game/`) that turns `(state, action)` into `(state, events)`; a view layer that turns events into animations; a raw-WebGPU renderer (G-buffer pass → ink/paper composite → billboard sprite pass); DOM for HUD and menus. Bots + a headless sim reuse the rules module for balance numbers.

**Tech Stack:** TypeScript, Vite, Vitest (+ vite-node for the sim), `@webgpu/types`, Canvas2D for sprite generation, GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-26-the-last-line-design.md`

## Global Constraints

- No runtime dependencies; no rendering engine. Dev deps only: vite, typescript, vitest, @webgpu/types.
- UI copy in Slovenian (č š ž must render); code, comments, commits in English.
- Default rules: 8×8, erosion 2 edge + 1 random, draw/erase range `any`, 4 trees, 2 gaps, starter alternates per round.
- Point-symmetric initial layout; P1 `(1, ⌊(N-1)/2⌋)`, P2 mirrored.
- Every dilemma met while building → `docs/odlocitve.md` (Slovenian: vprašanje / odločitev / obrazložitev).
- Vite `base: './'` so the build works under `/the-last-line/`.

## Review Focus

1. Bridge whose endpoint erodes the same round a player wants to cross it — the bridge must vanish and the crossing must no longer be offered.
2. Erosion marks the tile a player stands on and all exits are blocked — that player must fall at resolution, not before, and the opponent must still get their action.
3. Both players fall in the same resolution → draw screen, not a win for whoever was checked first.
4. Clicking during an animation or after game over must not dispatch an action.
5. Window resize / device-pixel-ratio change / tab switch must not break the render targets or the camera.

---

### Task 1: Scaffold, core types, RNG, initial setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Create: `src/game/types.ts`, `src/game/rng.ts`, `src/game/board.ts`, `src/game/setup.ts`
- Test: `tests/game/setup.test.ts`

**Interfaces:**
- Produces:
  - `type PlayerId = 0 | 1`, `interface Pos { x: number; y: number }`, `type BridgeDir = 'H' | 'V'` (H spans `(x-1,y)`–`(x+1,y)`, V spans `(x,y-1)`–`(x,y+1)`)
  - `interface Cell { land: boolean; tree: boolean; bridge: BridgeDir | null; marked: boolean }`
  - `type Range = 'any' | 1 | 2`; `interface Rules { size: number; edgeErosion: number; randomErosion: number; range: Range; trees: number; gaps: number }`; `defaultRules(size = 8): Rules` (trees = size²/16 rounded to even, gaps = 2)
  - `interface GameState { rules; seed; rng: number; cells: Cell[]; players: [Pos, Pos]; fallen: [boolean, boolean]; round: number; starter: PlayerId; current: PlayerId; acted: number; over: boolean; winner: PlayerId | 'draw' | null }`
  - `type Action = {type:'move';to:Pos} | {type:'tree';at:Pos} | {type:'bridge';at:Pos;dir:BridgeDir} | {type:'erase';at:Pos} | {type:'skip'}`
  - `type GameEvent` union: `move{player,from,to,viaBridge}`, `tree{player,at}`, `bridge{player,at,dir}`, `erase{player,at,what}`, `skip{player}`, `erosion{removed,treesDestroyed,bridgesCollapsed,fell}`, `roundStart{round,starter,marked}`, `gameOver{winner}`
  - `class Rng { constructor(state: number); state: number; next(): number; int(n: number): number; pick<T>(a: T[]): T }` (mulberry32)
  - `board.ts`: `idx(s, p)`, `inBounds(s, p)`, `cell(s, p)`, `DIRS: Pos[]`, `add(a,b)`, `eq(a,b)`, `other(p: PlayerId)`, `mirror(s, p)`
  - `createGame(rules: Rules, seed: number): GameState` — round 1, starter 0, current 0, round-1 marks already selected (calls `selectMarks` from Task 3; until then marks empty)

- [ ] **Step 1:** `npm init`, install dev deps, `vite.config.ts` (`base: './'`, vitest config), scripts `dev`, `build`, `test`, `sim`, `typecheck`.
- [ ] **Step 2: Write failing tests** in `tests/game/setup.test.ts`:
  - `createGame(defaultRules(), 42)` → `players` = `[{x:1,y:3},{x:6,y:4}]`; exactly 4 trees, exactly 2 non-land cells; for every cell `c` at `p`, cell at `mirror(p)` has equal `land`/`tree`.
  - no tree/gap on or 4-adjacent to either start tile; no gap on the outer ring.
  - same seed → deep-equal state; different seed → different layout (seeds 1..20 not all equal).
  - sizes 6 and 10: start tiles `(1,2)/(4,3)` and `(1,4)/(8,5)`.
- [ ] **Step 3:** Run `npx vitest run tests/game/setup.test.ts` → FAIL.
- [ ] **Step 4:** Implement types, Rng, board helpers, `createGame` (place mirrored pairs by rejection sampling with the seeded Rng; give up after 500 tries and place fewer).
- [ ] **Step 5:** Run tests → PASS. `git init`, commit `feat: scaffold project and game setup`.

### Task 2: Action legality

**Files:**
- Create: `src/game/rules.ts`
- Test: `tests/game/rules.test.ts`

**Interfaces:**
- Consumes: Task 1 types and board helpers.
- Produces: `inRange(s, at): boolean` (Manhattan from current player's rat; `'any'` → true), `moveTargets(s): {to: Pos; viaBridge: boolean}[]`, `canTree(s, at)`, `bridgeDirs(s, at): BridgeDir[]`, `canErase(s, at)`, `isLegal(s, a: Action): boolean`, `legalActions(s): Action[]` (skip always included).

Tests build states by hand with a helper `makeState(ascii: string[])` in `tests/game/helpers.ts`: `.` land, `#` gap, `T` tree, `-`/`|` bridge H/V, `1`/`2` players, `!` marked land.

- [ ] **Step 1: Write failing tests:**
  - move: 4-neighbours only; not onto tree, gap, or other player; onto marked land allowed.
  - bridge crossing: `1-.` → target `(2,0)` with `viaBridge: true`; blocked if far side has tree or other player; `1|.` (wrong orientation) not offered.
  - tree: land, no tree, no player; marked OK; gap not OK.
  - bridge: `.#.` → `['H']`; gap with land on both axes → `['H','V']`; edge-of-board gap → `[]`; gap with existing bridge → `[]`; tree on endpoint still allowed.
  - erase: tree or bridge only.
  - range 1 / 2 / any filters tree, bridge, erase targets; moves unaffected.
  - `legalActions` always contains `{type:'skip'}`; `isLegal` rejects actions after `over`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: action legality rules`.

### Task 3: Erosion, round flow, win/draw

**Files:**
- Create: `src/game/erosion.ts`, `src/game/game.ts`, `src/game/index.ts` (re-exports)
- Modify: `src/game/setup.ts` (select round-1 marks)
- Test: `tests/game/erosion.test.ts`, `tests/game/game.test.ts`

**Interfaces:**
- Produces: `edgeTiles(s): Pos[]`, `selectMarks(s, rng: Rng): Pos[]`, `resolveErosion(s): {removed; treesDestroyed; bridgesCollapsed; fell: PlayerId[]}` (mutates the given clone), `applyAction(s, a): { state: GameState; events: GameEvent[] }` (throws `Error('Illegal action')`).

Outside = flood fill from a virtual ring around the board through non-land cells (gaps, bridges). Edge tile = land cell 4-adjacent to outside.

- [ ] **Step 1: Write failing tests:**
  - full 8×8 → `edgeTiles` = 28 ring cells; an interior hole not connected to outside doesn't add edges; a hole connected via a gap chain to the ring does.
  - `selectMarks` with defaults returns 3 distinct land cells, ≥2 of them edge tiles (when ≥2 exist); trees and player tiles can be marked; fewer candidates → returns what exists.
  - resolve: marked land → gap; marked tree → tree gone, land stays; player on marked land → `fell`; bridge with eroded endpoint → collapsed; all marks cleared.
  - `applyAction`: after first action `current` flips, no erosion; after second: erosion event, `round` 2, `starter` 1, `current` 1, new marks + `roundStart` event.
  - one falls → `gameOver{winner: other}`; both fall → `winner: 'draw'`; state immutability (input object unchanged).
  - Review Focus 1: endpoint erodes → next round `moveTargets` no longer offers crossing.
  - Review Focus 2: player boxed in on a marked tile survives the opponent's turn and falls only at resolution.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: erosion and round flow`.

### Task 4: Bots and balance simulation

**Files:**
- Create: `src/sim/bot.ts`, `src/sim/run.ts`; `docs/odlocitve.md`
- Test: `tests/sim/bot.test.ts`

**Interfaces:**
- Produces: `chooseAction(s: GameState, rng: Rng, level?: 'random' | 'greedy'): Action`; `runMatch(rules, seed, bots): {winner; rounds}`.

Greedy bot: 1-ply over `legalActions`, score = (own tile safe after action ? big : 0) + own reachable safe area (BFS ≤ 3 steps over non-marked land) − opponent reachable safe area; small random tiebreak.

- [ ] **Step 1:** Test: 200 random-vs-random games all terminate within `size²` rounds; greedy beats random > 70% over 200 games.
- [ ] **Step 2:** Implement; `npm run sim -- --games 2000` prints win rate P1/P2/draw, mean/median rounds, for default rules and variants (range 2, range 1, 3 edge + 0 random).
- [ ] **Step 3:** Record numbers and conclusions in `docs/odlocitve.md`. Commit `feat: bots and balance sim`.

### Task 5: WebGPU renderer — board with ink outlines on paper

**Files:**
- Create: `src/render/gpu.ts`, `src/render/math.ts`, `src/render/camera.ts`, `src/render/meshes.ts`, `src/render/renderer.ts`, `src/render/shaders/scene.wgsl`, `src/render/shaders/composite.wgsl`, `src/view/scene.ts`, `src/main.ts`
- Test: `tests/render/math.test.ts`, `tests/render/camera.test.ts`

**Interfaces:**
- Produces:
  - `initGpu(canvas): Promise<Gpu | null>`
  - `OrbitCamera { yaw; pitch; distance; target; viewProj(aspect): Float32Array; eye(): Vec3; ray(ndcX, ndcY, aspect): {o: Vec3; d: Vec3}; orbit(dx, dy); zoom(f); snap(dir: 1 | -1); update(dt) }`
  - `pickTile(cam, ndcX, ndcY, aspect, size): Pos | null` (ray ∩ plane y = 0, the tile tops)
  - `SceneView { size; tiles: TileView[]; bridges: BridgeView[]; sprites: SpriteView[]; time }` with `TileView { x; y; drop: number; flags: number; tint: [r,g,b,a]; variant }`
  - `Renderer.create(gpu, atlas?)`, `renderer.render(view: SceneView, cam: OrbitCamera)`, `renderer.resize()`

Passes: (1) G-buffer: instanced tile boxes + bridge boxes → `albedo rgba8`, `normalId rgba16float`, `depth24plus`; (2) composite fullscreen → swapchain: paper where depth = 1, shaded albedo elsewhere, wobbly ink from depth/normal/id discontinuities (offsets jittered by noise re-seeded ~8×/s); (3) sprite pass (Task 6) with depth test against pass-1 depth.

Tile shading: tops = paper with grass-fringe border + doodle decal variant; sides = vertical hatching; marked tops get red hatching; highlight tint hatched in player colour.

- [ ] **Step 1:** Tests: `mat4` invert∘multiply ≈ identity; `pickTile` from default camera at screen centre → `(3|4, 3|4)` on 8×8; ray at a corner far off-board → `null`.
- [ ] **Step 2:** Implement; dev page shows a static 8×8 board from `createGame`.
- [ ] **Step 3:** Verify in browser (Playwright screenshot): outlined tiles, gaps visible, paper background, no console errors; resize window → no errors.
- [ ] **Step 4:** Commit `feat: webgpu board renderer with ink outlines`.

### Task 6: Sprites — PDF cut-outs and procedural doodles

**Files:**
- Create: `public/sprites/tree.png`, `public/sprites/sign.png`, `public/sprites/doodle-*.png` (cut from the PDF with a one-off script kept in `tools/extract-sprites.py`)
- Create: `src/render/atlas.ts`, `src/render/draw/rat.ts`, `src/render/draw/bridge.ts`, `src/render/draw/sketch.ts` (jittered-stroke helpers), `src/render/shaders/sprite.wgsl`
- Modify: `src/render/renderer.ts` (sprite pass), `src/view/scene.ts`

**Interfaces:**
- Produces: `buildAtlas(): Promise<Atlas>`; `Atlas { texture; frames: Record<SpriteName, Frame> }`, `SpriteName = 'tree' | 'sign' | 'rat0' | 'rat1' | 'bridge' | 'doodle0'..'doodle3' | 'poof' | 'shadow'`; `SpriteView { name; pos: Vec3; scale; alpha; flip }` (cylindrical billboard anchored at bottom centre).

- [ ] **Step 1:** Extract and trim PDF drawings (tree above its tile, sign, top doodles) to transparent PNGs.
- [ ] **Step 2:** Draw rats (upright, player-coloured scarf, pencil + eraser), bridge planks, poof, shadow procedurally; atlas loader prefers `public/sprites/<name>.png` when present.
- [ ] **Step 3:** Render trees, signs on marked tiles, rats, bridges; verify by screenshot from 4 camera yaws.
- [ ] **Step 4:** Commit `feat: sprite atlas and billboard pass`.

### Task 7: Playable game — input, HUD, toolbar, animations

**Files:**
- Create: `src/app.ts`, `src/ui/input.ts`, `src/ui/hud.ts`, `src/ui/strings.ts`, `src/view/animator.ts`, `src/ui/style.css`
- Modify: `src/main.ts`, `index.html`
- Test: `tests/view/animator.test.ts`

**Interfaces:**
- Consumes: `applyAction`, `legalActions`, `moveTargets`, `bridgeDirs`, renderer, camera, `pickTile`.
- Produces: `Animator { push(events: GameEvent[]); busy(): boolean; update(dt); apply(view: SceneView) }`; `App { start(rules, seed); dispatch(a: Action) }`; `window.__game = { state(), dispatch(a), busy() }`.

- [ ] **Step 1:** Animator test: after pushing an `erosion` event, `busy()` is true until `update` has advanced ≥ total duration, then false; Review Focus 4: `App.dispatch` ignores actions while `busy()` or `over`.
- [ ] **Step 2:** Implement toolbar (Premik/Drevo/Most/Radirka/Preskoči, keys 1–5, R rotates bridge), hover highlights + ghost preview, click-vs-drag (6 px), Q/E snap, wheel/pinch zoom, turn banner, round counter, hint line, shake on illegal click.
- [ ] **Step 3:** Animations: hop (move), sketch-in (tree/bridge), rub-out (erase), crumble+drop (erosion), tumble (fall), marks sketched in on `roundStart`.
- [ ] **Step 4:** Verify in browser: play a full game by clicking; Review Focus 5: resize mid-game and switch tab, no errors.
- [ ] **Step 5:** Commit `feat: playable hot-seat game`.

### Task 8: Menus, rules panel, end screen, WebGPU fallback

**Files:**
- Create: `src/ui/menu.ts`
- Modify: `src/app.ts`, `src/ui/strings.ts`, `src/ui/style.css`, `index.html`

- [ ] **Step 1:** Start screen (title, Igraj, Pravila igre, Nastavitve pravil: size 6/8/10, edge 0–4, random 0–3, range any/2/1, seed; `?seed=` param), how-to-play overlay, end screen (ZMAGA!/Neodločeno + random message + Še enkrat / Meni), no-WebGPU message.
- [ ] **Step 2:** Verify: both end screens reachable (Review Focus 3 via `__game`), rules panel changes take effect, fallback shown when `navigator.gpu` is stubbed out.
- [ ] **Step 3:** Commit `feat: menus, rules panel, end screen`.

### Task 9: Deploy to GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1:** `gh repo create zigagobec/the-last-line --public --source . --push`; enable Pages with source "GitHub Actions".
- [ ] **Step 2:** Workflow: checkout → setup-node 22 → `npm ci` → `npm test` → `npm run build` → upload-pages-artifact `dist` → deploy-pages.
- [ ] **Step 3:** Verify `https://zigagobec.github.io/the-last-line/` loads and renders.
- [ ] **Step 4:** Commit `ci: deploy to github pages`.

### Task 10: Playtest and bug-fix loop

- [ ] **Step 1:** Play ≥ 3 full games on the deployed URL via Playwright (mix of clicking and `__game.dispatch`), deliberately hitting: bridge crossing, saving a marked tile with a tree, trap via trees, both-fall draw, rules variants.
- [ ] **Step 2:** For each bug: failing test (if logic) → fix → redeploy. Repeat until a full pass finds nothing.
- [ ] **Step 3:** Gameplay assessment + any rule tweaks → `docs/odlocitve.md`. Final commit and push.
