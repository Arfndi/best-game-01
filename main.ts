// Ember Orbit — a gravity-slingshot arcade game for best-game-01 (Node 22, stdlib only).
// The game lives in this directory as plain static files (game/index.html and its ES
// modules, no libraries, no network requests), and this program hands it in: it copies
// game/ and screenshots/ from beside this file into /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Preflight: every screenshot must fit the scorer's cap (at most 256 KiB each).
// Fail loudly here, with the offending name, instead of letting buildDossier
// reject the whole entry with a bare count.
const shotDir = join(out, 'screenshots');
for (const name of readdirSync(shotDir).sort()) {
  const size = statSync(join(shotDir, name)).size;
  console.log(`Ember Orbit: screenshot ${name} is ${size} bytes`);
  if (size > 262144) throw new Error(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
