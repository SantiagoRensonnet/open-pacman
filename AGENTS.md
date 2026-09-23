# AGENTS.md

## Project

Vanilla JS + HTML + CSS Pac-Man clone (28×31-cell maze, canvas-rendered, `requestAnimationFrame` loop). No framework, no build step, no package.json, no npm scripts, no tests, no linter. Run it by serving `src/` with any static server (e.g. `python3 -m http.server`) and opening `src/index.html`.

## Language

The whole repo (README, code comments, spec workflow) is in Spanish. Write comments and specs in Spanish, and reply to the user in the language they use.

## Architecture

Plain `<script>` tags share state via `window` globals — no ES modules. Load order in `src/index.html` is mandatory: `maze.js → game.js → render.js → main.js`. A new JS file must be added as a `<script>` tag in the correct position (after its dependencies).

Global contract between files:
- `maze.js` exposes `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`.
- `game.js` exposes `createGame`, `update`, `DIRS` (depends on maze.js globals).
- `render.js` exposes `draw` (depends on `DIRS` from game.js).
- `main.js` owns the game loop, keyboard input, and start/win/lose overlays.

## Maze data model

`MAZE` is the pristine grid (never mutated). Each game calls `createGame()` which copies it into `game.grid` so eating dots resets cleanly on restart. Tile chars in `maze.js`: `#` wall (1), `.` dot (2), space empty/walkable (0), `-` ghost-house door (3). Door blocks Pac-Man only; ghosts pass through. Row 14 is the wrap-around tunnel. The maze is defined as 31 strings of exactly 28 chars, symmetric about the center column pair — keep rows 28 chars when editing.

Canvas math: cell `(x,y)`, origin top-left, `TILE = 20px`, canvas 560×620. Movement is fractional cells/frame (Pac-Man 0.125, ghosts 0.1) with `aligned()` snapping.

## Spec-driven workflow

This repo exists to practice spec-driven development (see README). The `/spec` and `/spec-impl` skills are installed in `.agents/skills/` (pinned in `skills-lock.json`) — do not recreate them.

- Specs live in `specs/NN-slug.md`, numbered sequentially (`01-`, `02-`, …). No `specs/` folder exists yet; `/spec` creates it and seeds `specs/.spec-config.yml`.
- `/spec` never writes code, only the spec file, and leaves it in `Draft` state.
- `/spec-impl` only proceeds when the spec state means "Approved" (any language), creates/switches to branch `spec-NN-slug`, and implements step-by-step with pauses for diff review. It never commits automatically. `/spec-impl` refuses to run if the working tree is dirty.

## Style

JS uses spaces inside parens/brackets (`( x, y )`, `[ 0 ]`), single quotes, semicolons, 2-space indent. Match this — it differs from standard formatters.

## Git

Single branch `master`, no remote configured. Feature work happens on `spec-NN-slug` branches per the spec workflow.