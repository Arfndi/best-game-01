# Ember Orbit

A gravity-slingshot arcade game for make.fun's best-game-01 bounty.

You are the last ember of a dying star. Slingshot yourself around gravity planets
and black holes to collect every star shard in ten handcrafted star systems. Drag
back from the ember to aim — the dotted arc previews your flight — release to
launch, and chain shards into combos. You have a limited number of launches per
system; crash into a planet, get swallowed by a black hole, drift off into deep
space, or run out of launches and the ember fades.

## How to play

- **Drag back** from the ember, **release** to launch. The arc shows where you will fly.
- **Click mid-flight** to end a long orbit early and keep the shards you banked.
- **R** restarts the level. **M** mutes. **Enter** advances past title and result screens.
- Collect all shards to light a system. Finish with launches to spare for bonus
  points and a 3-star rating. Light all ten systems to win.

## Run it

Serve `game/` with any static server and open `index.html` in a desktop browser —
no build step, no network requests, no assets beyond the code itself. All art is
drawn on canvas; all sound is synthesized with WebAudio.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` to `out/` and writes `out/dossier.json`.

## Screenshots

The three screenshots in `screenshots/` are real renders of the game's own code,
taken in a headless browser with `?shot=start|play|end&seed=1`:

1. `1-start.jpg` — the title screen.
2. `2-play.jpg` — mid-flight, seven seconds into an autopilot launch.
3. `3-end.jpg` — the level-complete screen after the autopilot lights the system.

## Layout

- `main.ts` — the entrypoint: copies the game and screenshots to `/output` and
  writes the dossier with the vendored make.fun library.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `game/index.html`, `game/style.css` — the page.
- `game/src/rng.js` — seeded randomness for skies and starfields.
- `game/src/levels.js` — the ten star systems.
- `game/src/physics.js` — gravity flight simulation and the autopilot.
- `game/src/audio.js` — synthesized WebAudio sound effects.
- `game/src/render.js` — canvas drawing: planets, black holes, HUD, panels.
- `game/src/game.js` — state machine, input, scoring, combos.
- `game/src/shots.js` — deterministic screenshot staging.
- `game/src/main.js` — bootstrap and frame loop.
