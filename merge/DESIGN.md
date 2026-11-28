# Saarepagar: design and team contracts

An original, cozy **merge game** in Estonian, made for the owner's girlfriend. It's phone first (portrait), one offline HTML file and plain 2D canvas (no three.js). It is installable from GitHub Pages at `…/Cloud-Hosted-Bot/merge/`. Don't copy any existing game's name, characters, art, items or story.

## Premise

Grandma Maali has left you her old seaside bakery on a small Estonian island. It is overgrown and broken. Bake, merge and help the villagers, and step by step restore the bakery, the harbour, the garden, the windmill and the lighthouse. The tone is warm and funny, with a little mystery: grandma's lost recipe book. It is kid- and adult-friendly. Characters are original (e.g. Maali's letters, fisherman Ants, the café cat Muri, the shopkeeper Liisa, the lighthouse keeper Peeter).

## Core loop

- **Board:** a grid, about 7 × 9 cells. You drag an item onto an identical item (same chain, same level) to merge them into the next level, with a juicy animation. Dropping an item on an empty cell moves it; dropping it on a different item swaps the two.
- **Generators:** board items you tap to spawn level-1 items of their chains into nearby empty cells. Each tap costs **energy**.
  - Examples: Ahi (oven), Korv (basket), Tööriistakast (toolbox), Aiapeenar (garden bed), Kalavõrk (fishing net), Teekann (teapot).
  - Generators have levels too: merging two generators gives a better one with more chains and less cooldown.
  - Some generators have a charge count, then a cooldown.
- **Chains:** about 10 chains of 7–12 levels each, e.g.
  - flour sack → dough → bun → bread → braided loaf → kringel → cake → wedding cake;
  - seed → sprout → flower → bouquet → flower basket;
  - nail → plank → toolbox → workbench;
  - fish → smoked fish → fish pie;
  - tea leaf → tea cup → teapot set;
  - berry → jam jar → pie.
- **Orders:** 2–4 villagers at the top ask for 1–3 items. Fulfilling an order (tap Anna when the items are on the board) pays coins, XP and sometimes **stars**.
- **Restoration:** stars are spent on **tasks** in a story list. Each task fixes something in the village scene above the board (a cozy 2D illustration that visibly changes) and advances dialogue. Areas unlock one after another:
  1. bakery;
  2. garden;
  3. harbour;
  4. windmill;
  5. lighthouse;
  6. grandma's secret.
- **Energy:** +1 every minute up to 100; gifts, coffee and the shop may fill it up to 150 (`EN_CAP`), never more. Plus energy items on the board (merge-able: small → big). There are **no purchases**. The coins shop sells energy, generators and board-space chests.
- **Extras:**
  - a daily gift and daily tasks;
  - bubbles: occasionally a merge produces a bonus copy in a bubble that you can pop for coins, or it vanishes after 60 s;
  - chests that open into random items;
  - a storage bag (inventory of a few slots);
  - sell an item for coins;
  - an XP level that unlocks more board cells and chains.
- **Saving:** `localStorage` key `saarepagar.save` (versioned, try/catch), written after every action and on hide. Energy is computed from real elapsed time.

## Files and owners

Build with `python3 tools/build-merge.py`, which concatenates `merge/src/*.js` in sorted order into `merge/index.html`. Commit `src` and `index.html`.

| File | Owner | Contents |
|---|---|---|
| `merge/src/00-core.js` | Mira | utils (`clamp`, `lerp`, `rnd` seeded, easing), save/load, `S` (global state) |
| `merge/src/10-data.js` | Mira | `CHAINS`, `GENERATORS`, `ORDERS` rules, `TASKS` and `STORY` (Estonian), `AREAS`, `SHOP` |
| `merge/src/30-game.js` | Mira | board logic, merges, generators, energy, orders, tasks, XP, daily, bubbles, chests |
| `merge/src/50-ui.js` | Mira | layout (portrait first; landscape and desktop centred), input (pointer drag, tap), screens (board, orders, tasks, story dialogue, shop, settings), all text |
| `merge/src/20-art.js` | Ash | all drawing helpers and art |
| `merge/src/40-fx.js` | Ash | effects |
| `merge/src/80-audio.js` | Echo | music and sounds |
| `merge/src/90-main.js` | Mira (Forge merges) | boot, the frame loop (`requestAnimationFrame`, 60/30 fps cap, pause when hidden) |

## Art API (Ash; Mira calls it, with plain placeholder shapes until it lands)

- `ART.item(chain, level, px)` returns a cached canvas, `px × px`, of that item. Cute, readable, bold outline, soft shading, consistent palette. Every level is visibly "more" than the last. Generators use `ART.item(genKey, level, px)` too.
- `ART.cell(ctx, x, y, s, state)` draws a board cell. `state` is `'empty' | 'locked' | 'hint' | 'target'`.
- `ART.scene(ctx, area, progress, x, y, w, h, t)` draws the village illustration for an area. `progress` is the set of completed task ids, and each task visibly changes the scene: a repaired roof, flowers, lights.
- `ART.portrait(who, px)` returns a character portrait for dialogue (`'maali' | 'ants' | 'muri' | 'liisa' | 'peeter' | 'mina'`).
- `ART.icon(name, px)` returns an icon: `'energy' | 'coin' | 'star' | 'xp' | 'gift' | 'bag' | 'shop' | 'settings' | 'check' | 'lock' | 'chest' | 'bubble'`.
- `ART.panel(ctx, x, y, w, h, style)` draws rounded cozy panels and buttons. `style` is `'paper' | 'wood' | 'button' | 'buttonHot' | 'ribbon'`.
- `ART.logo(ctx, x, y, w, t)` draws the title logo.
- `ART.bg(ctx, w, h, t)` draws the background behind the board (warm tablecloth or wood).
- **Version 3, level map (`24-map.js`, `25-level.js`):**
  - `ART.mapBg(ctx, chapter, x, y, w, h, t, scroll)`: the chapter scenery (cached seamless tile plus a light animated layer). `scroll` is the world y of the rect's top. Chapter 0 is levels 1–50 (`ART.mapChapterOf(level)`). Six themes cycle (`ART.mapTheme(ch)` gives `{name, path, accent}`), and each cycle reshuffles the decor.
  - `ART.mapDivider(ctx, chapter, x, y, w, t)`: a mist band with a "Peatükk n · nimi" ribbon that hides the seam between chapters.
  - `ART.mapPath(ctx, points, t, {done, width})`: the candy path; dots up to point index `done` are coloured.
  - `ART.mapNode(ctx, x, y, r, state, stars, n, t)`: `'locked' | 'open' | 'current' | 'done'`. Every 10th level is a boss (drawn larger, with a crown).
  - `ART.wheel(ctx, x, y, r, slices, angle, t)` and `ART.wheelIndex(angle, n)`. Slice i sits under the pointer at `angle = -i·2π/n`.
  - `ART.obstacle(kind, px, state)`: `ice | box | cobweb | lockedCrate | sand | bubble`, state 0..2. Ice and cobweb are see-through, so draw the item first.
  - `ART.booster(kind, px, badge)`: `wand | scissors | shuffle | moves5`.
  - `ART.item('key', 1, px)`. Unknown item keys draw as a gem or a gift whose look grows with the level.
  - Icons `piggy, calendar, heart, wheel, map, crown, moves, trophy, rest, key, streak`.
  - Idle: `ART.itemIdle(seed, t)` returns `{sx, sy, rot, dy}` (pivot at the item's bottom centre). `ART.drawItemIdle(ctx, img, cx, cy, s, seed, t)` applies it.

## Effects API (Ash; Mira calls it)

- `FX.merge(x, y, chain, level)`: the merge burst. It includes a pop and squash of the new item, sparkles and a glow ring. It is bigger for high levels, with a special burst at a chain's max level.
- `FX.spawn(fromX, fromY, toX, toY, img)`: an item flies out of a generator with an arc and a bounce.
- `FX.coins(x, y, n)`, `FX.stars(x, y, n)`, `FX.energy(x, y, n)`: they fly to the HUD counters. Positions come from `UI.hudPos(name)`.
- `FX.confetti()`: celebration when a task completes or the player levels up.
- `FX.update(dt)`, `FX.draw(ctx)`.
- **Version 3:**
  - `FX.levelWin({stars})` ("Tubli!", fireworks, star rain) and `FX.levelFail()` (a soft "Peaaegu!").
  - Obstacles: `FX.iceCrack(x, y, s)`, `FX.boxBreak(x, y, s)` and `FX.obstacleClear(kind, x, y, s)`.
  - `FX.boosterUse(kind, x, y)`. For shuffle, x, y is the board centre.
  - Chained merges: `FX.rainbowLink(x0, y0, x1, y1)` between them and `FX.trail(x, y)` while dragging.
  - `FX.idle(ctx, x, y, s, seed, t)`: an occasional sparkle on an idle item.
- Everything is cheap on low-end Android: pooled particles, no `shadowBlur` in hot paths, and a cap. `FX.quality` is 0, 1 or 2.

## Audio API (Echo; Mira calls `sfx(name, opts)` and `MUSIC.scene(name)`)

- **Sounds:**
  - board actions: `'pick'`, `'drop'`, `'swap'`, `'merge'` (`opts.level` raises the pitch), `'mergeMax'`, `'spawn'`, `'noEnergy'`, `'bubble'`, `'bubblePop'`, `'chest'`;
  - orders and progress: `'order'`, `'orderDone'`, `'coins'`, `'stars'`, `'taskDone'`, `'levelUp'`, `'daily'`;
  - UI: `'tap'`, `'open'`, `'close'`, `'sell'`, `'deny'`, `'talk'` (dialogue blip).
- **Music:** modern chill-pop and lo-fi (electric piano, plucks, side-chained pads, soft drums, vocal-chop hooks); the earlier folk style was replaced after player feedback. Scenes are `'title'`, `'board'` (one calm loop per area) and `'story'`. It must be long-listenable, with variation, and have no harsh highs.
- `AU.unlock()` on the first gesture, `AU.setVolume(kind, v)` (kind `'music'` or `'sfx'`), `AU.muted`. iPhone: `navigator.audioSession.type = 'playback'`.
- **Battery (phase C):** the audio sleeps by itself (the context is suspended) when the page is hidden, when muted or both volumes are 0, after 4 minutes without a touch (`AU.setIdle(ms)`; the music fades out and restarts from its intro on the next touch) and after 15 s with no music and no sound. The game needs no calls for this; `AU.poke()` counts as activity if something other than a touch should keep the music awake.
- **Checks:** `node tools/mergeaudio.js --mix` (loudness of every song, full and lite, phone speaker model), `--sfxmix` (sound levels against the music, variety of repeated sounds), `--throttle` (cheap-Android timing), `--soak10` (10-minute soak), `--life` (sleep, wake, mute, volume 0, interruptions).

## Quality bar

- **Phones:** smooth at 60 fps on an iPhone and at 30+ on a cheap Android (Poco M7 Pro class).
- **Tap targets:** at least 44 px.
- **Screens:** readable at 360 × 800.
- **Language:** every word is Estonian.
- **Testing:** `node tools/mergeqa.js` (Forge) clicks through the core loop on desktop and an iPhone 13 profile and fails on page errors.
