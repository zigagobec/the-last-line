# The Last Line

A two-player, hot-seat strategy prototype rendered with raw WebGPU in a hand-drawn doodle style.
Two rats — armed with a pencil and an eraser — fight for the last bits of a world that erodes a
little more every round.

**Play:** https://zigagobec.github.io/the-last-line/ (needs a WebGPU browser: desktop Chrome/Edge,
Android Chrome, Safari 26+).

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # rules, camera and animation unit tests
npm run sim        # bot-vs-bot balance numbers for several rule variants
npm run build
```

- `src/game/` — pure game rules (no rendering)
- `src/render/` — WebGPU renderer: G-buffer → ink/paper composite → billboard sprites
- `src/view/`, `src/ui/` — animation, HUD, menus, input
- `docs/odlocitve.md` — design decisions, balance and playtest notes (Slovenian)
- `tools/` — Playwright scripts that play the game headlessly through the real UI
  (`play.mjs`, `scenario-ui.mjs`, `menus.mjs`, `mobile-checks.mjs`, `resize.mjs`);
  they use `chromium-headless-shell` with SwiftShader WebGPU flags
