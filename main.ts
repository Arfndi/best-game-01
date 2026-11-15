// Ember Orbit — a gravity-slingshot arcade game for best-game-01 (Node 22, stdlib only).
// The game lives in this directory as plain static files (game/index.html and its ES
// modules, no libraries, no network requests), and this program hands it in: it copies
// game/ and screenshots/ from beside this file into /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library. The copy is byte for byte, so two runs of this program always write the
// same bytes. Put your 3 or 4 screenshots in screenshots/ (the first by name is the
// cover) and run it:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the game locally with any static server pointed at game/ and open
// http://localhost:8080 — drag back from the ember to aim, release to launch.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight: refuse to hand in a half-built directory instead of writing a dossier
// over missing files. The game and its screenshots are the entry; both must be here.
for (const needed of ['game', 'game/index.html', 'screenshots']) {
  if (!existsSync(join(here, needed))) {
    throw new Error(`Ember Orbit is missing ${needed} beside main.ts`);
  }
}
const gameEntries = readdirSync(join(here, 'game'), { recursive: true });
const shotNames = readdirSync(join(here, 'screenshots'), { recursive: true })
  .map((name) => String(name))
  .filter((name) => !name.startsWith('.'));
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shotNames.length}`);
}
// The scorer refuses any screenshot over 256 KiB, so catch an oversized one here
// instead of handing in an entry that is dead on arrival.
for (const shot of shotNames) {
  const bytes = statSync(join(here, 'screenshots', shot)).size;
  if (bytes > 262144) {
    throw new Error(`screenshot ${shot} is ${bytes} bytes, over the 256 KiB cap`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the dossier's bytes; the rest
// refuse an entry the scorer would refuse (more than 4 screenshots or one over
// 256 KiB; more than 993 files in game/ or 48 MiB of game files in all; a path
// under game/ over 1000 bytes). game/ counts beside /output's own 1000-entry cap.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// A short summary on stdout, so a run's log shows what was handed in.
const dossierBytes = Buffer.byteLength(dossier, 'utf8');
const gameBytes = gameEntries.reduce((sum, name) => sum + statSync(join(here, 'game', String(name))).size, 0);
console.log(`Ember Orbit: ${gameEntries.length} game files (${gameBytes} bytes), ${shotNames.length} screenshots, dossier ${dossierBytes} bytes -> ${out}`);
