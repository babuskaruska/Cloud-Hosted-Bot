# Cinderwatch

New session? Read `HANDOFF.md` first.

A self-playing 3D isometric tower defense in one HTML file (three.js r170, everything generated in code). Imported from kevintngo/cinderwatch (MIT). The plan for future work is in `ROADMAP.md`.

## Build and test

- Edit `src/*.js` (and `src/shell.html`), never `index.html` directly. Then run `python3 tools/build.py`, which writes `index.html`. Commit both.
- Screenshot / inspect: `node tools/cdp.js "seed=4&ff=30" wait:3000 shot:name eval:"__cw.G.lives"`. Shots go to `tools/shots/` (ignored by git).
- Full regression check: `node tools/qa.js` (about 90 s; `--quick` for faster, `--save` to update the baseline after an intended change).
- Deterministic run log: `node tools/record.js scan <seed> <seconds>`. Use the same seed before and after a balance change and compare.
- `tools/chrome.js` picks the browser (set `CHROME` to override). On Linux it uses software GL, so frame-rate numbers here are pessimistic.
- URL flags (`seed`, `biome`, `level`, `k`, `ff`, `fps`, ...) are listed in `README.md`.

## Where things live

- Balance: `ROSTER` and `buildWave` in `src/62-game.js`; monster stats in `MON` (`src/61-monsters.js`); tower stats in `TOWER` (`src/60-towers.js`).
- AI commander: `aiThink` in `src/62-game.js`. Any new mechanic needs teaching here too.
- Global state: `G` (`src/60-towers.js`), exposed to tests as `window.__cw`.
- Lands: `src/29-biome.js`. Effects: `src/40-fx.js`. Models: `src/50-rig.js`, `src/51-bestiary.js`. UI: `src/72-ui.js`. Audio: `src/80-audio.js`.
- Crowd limits: live monster cap in `updateWaves` (`src/62-game.js`); per-model instance caps in the `PartBatch` constructors.

## Rules

- Keep it one offline file: no asset files, no network, no new dependencies.
- Keep a phone working: check `MOBILE=1 DPR=3 node tools/cdp.js "seed=4" 390,844 wait:2000 shot:phone` after UI changes.
