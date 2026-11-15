# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Arfndi/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Arfndi/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Ember Orbit — an original gravity-slingshot arcade game for make.fun's best-game-01 bounty. You are the last ember of a dying star: drag back to aim with a dotted trajectory preview, release to launch, and slingshot around gravity planets and black holes to collect every star shard across 10 handcrafted systems. The HUD tracks your level, score, launches left, shards, and combo; each cleared system earns a star rating, and the run ends in a game-over or victory screen. Restart with R, mute with M, and chase your best score — saved in localStorage. All art is drawn on canvas and all sound is synthesized with WebAudio: no libraries, no assets, no network requests.

## Run it

Serve `game/` with any static server and open `index.html` in a desktop browser — no build step, no network requests.

The entrypoint hands the game in:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` to `out/` and writes `out/dossier.json`.

## How to play

- **Drag back** from the ember, **release** to launch. The dotted arc previews your flight.
- **Click mid-flight** to bank the shards you collected and end a long orbit early.
- **R** restarts the level. **M** mutes. **Enter** advances past title and result screens.
- Collect all shards to light a system. Finish with launches to spare for bonus points and a 3-star rating. Light all ten systems to win.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
