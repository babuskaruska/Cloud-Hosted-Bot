# Handoff

**Read this first in every new session.** Then `CLAUDE.md` (how to build and test) and `ROADMAP.md` (the long plan).
Update the "Status" and "Next" sections before you stop.

## The team

| Name | Role | Owns (main files) |
| --- | --- | --- |
| **Forge** (lead, main session) | Programmer and QA lead | engine, performance, crowd limits, mechanics plumbing, `tools/`, merging, this file |
| **Ash** | GFX and asset designer | `10-gfx`, `20-post`, `31`–`33` scenery, `40-fx`, `41-weather`, `50-rig`, `51-bestiary`, camera shake in `90-main` |
| **Echo** | Sound developer | `80-audio.js` (plus one-line `sfx(...)` calls where events happen) |
| **Mira** | Game and UI designer | `62-game.js` (waves, economy, AI commander), stat tables `MON` / `TOWER`, `70-pixelfont`, `72-ui.js` |

Agents work in their own git worktree branches and commit there. Forge merges, rebuilds `index.html` (conflicts in `index.html` are always resolved by rebuilding), runs QA and pushes to `claude/sleepy-cannon-hu2caw`.

## Quality rule

Nothing merges unless `node tools/qa.js` passes: no page errors, no NaN, no early defeat, and the balance numbers are the same or better than `tools/qa-baseline.json` (or the change is intended and explained). Look at the screenshots in `tools/shots/qa-*.png` too. Fix any bug you find, even outside your own area, and note it here.

## Shared contracts (so parallel work fits together)

- `m.elite`: `undefined` or one of `'burning' | 'shielded' | 'hasted' | 'splitting'` on a monster. Mira sets it and owns the rules; Ash draws an aura from it; Echo plays `sfx('elite', x, z)` when one spawns.
- `G.horde`: `true` during a horde wave. Mira and Forge set it; Echo makes the music and crowd noise react; Mira's UI shows a warning.
- `FX.groundFire(x, z, r, seconds)`: Ash provides the look (burning patch on the ground). Forge's mechanics call it and apply the damage.
- `shake(amount)` (global, Ash): camera shake that decays; amount around 0.2 for a shell and 1 for a boss stomp. Safe to call often.
- New sound names (Echo implements, anyone may call `sfx(name, x, z, vol)`): `'horde'`, `'elite'`, `'chainBoom'`, `'burn'`, `'buyout'` (big purchase).
- Waves per battlefield and the boss wave index: Mira owns them; use `G.wavesPerLand` and `G.bossWave` rather than the number 5.

## Status

- **Live site (GitHub Pages, from `main`):** https://babuskaruska.github.io/Cloud-Hosted-Bot/. It installs as an offline home-screen app (`manifest.webmanifest`, `sw.js`, `icon-*.png`; the icons are written by `build.py`). Pushing `main` updates it. Bump `V` in `sw.js` only if cached files change name.

- **Playable build (private to the owner):** https://claude.ai/artifact/53H8ujm4JWWLAGVr5KhyHs. To update it, copy `index.html` to the scratchpad as `cinderwatch.html` and republish it with the Artifact tool (pass this URL as `url` from a new session).
- Phase 0 done: the game is imported, the tools run on Linux, and `tools/qa.js` plus a baseline exist.
- Round 1 merged:
  - **Forge:** `MAX_ALIVE` (260 desktop, 190 phone); `PartBatch` grows up to 4× its cap; crowd sim about 3× faster (sorted scan plus a grid); delayed sapper chain blasts (`G.chain`); max-level bombard leaves burning ground (`addGroundFire`, `G.burns`).
  - **Ash:** `shake(a)`, `hitStop(sec, flash)`, `FX.groundFire` (returns a handle), elite auras, `fxGore` death mayhem, its own fx random stream (visuals no longer change gameplay), a fix so ground-facing sprites are no longer culled.
  - **Mira:** `G.wavesPerLand = 8` (helpers `landWave()`, `isBossK()`, `isHordeK()`); new economy; overcharge (`t.oc` 0–3) and mend beacon (R key); elites (`makeElite`, `m.ward` shield, `G.fires` = elite fire that hurts footmen); horde waves.
- **Fire naming:** `G.burns` is the player's fire (hurts monsters); `G.fires` is elite fire (hurts footmen). Don't mix them.
- **Worktree gotcha:** agent worktrees start from the old `main`. First run `git merge --ff-only claude/sleepy-cannon-hu2caw` (or merge it).
- **QA after round 1:** no defeats; battlefield 1 now ends with 2–3 towers maxed (was 0); hordes reach about 145 alive.
- **Known:** `G.press` sits at its 2.2 cap for the AI most of the time, so the game is easy for the AI. Health bars clutter big crowds.
- **Echo** (round 1, merged): per-kind voice limits, a soft clipper (peak below -0.9 dBFS), reactive music with danger layers and six boss themes, a crowd bed, the new sounds, `AU.setVolume`, `AU.stats()`. Forge added `navigator.audioSession.type = 'playback'` so the iPhone silent switch doesn't mute the game.
- Long runs: 83 min of game time, 10 lands, no errors or defeats, up to 206 alive.

## Round 2 contracts

- **Tower branches.** A max-level tower (`t.lvl === 2`) can buy one of two branches, which sets `t.lvl = 3` and `t.branch`:
  - archer: `'longbow' | 'volley'`
  - bombard: `'mortar' | 'firebomb'`
  - spire: `'tempest' | 'frost'`
  - guard: `'knights' | 'pikes'`

  Mira owns the data (`TOWER[kind].branches`), the mechanics, the UI and the AI. Ash owns the look: `blueprint(kind, 3, branch)` returns the branch model. Until Ash's work lands, Mira's branch clamps `lvl > 2` to 2 at the top of `blueprint`. Overcharge (`t.oc`) works on top of a branch.
- **Spells.** Mana `G.mana` / `G.manaMax` fills from kills. Spells:
  - `castSpell('meteor', x, z)`: a big blast and burning ground
  - `castSpell('frost', x, z)`: freezes monsters in a radius
  - `castSpell('rally', x, z)`: temporary footmen

  Mira owns the rules, the UI, the keys and the AI. Ash provides the visuals: `FX.meteor(x, z, r)` (the fall, impact and crater) and `FX.frostNova(x, z, r)`; the gameplay side calls them if present. Echo provides the sounds `'meteor'`, `'frostNova'`, `'rally'` and `'spellReady'`.
- **Land events (Forge, done in `src/63-events.js`).** One per battlefield on a mid wave (`G.evWave`), 14–17 s. Effects: `G.rangeMul`, `m.evMul`, boulders, lava eruptions (`addGroundFire` plus tower stun), extra wisps or scarabs, mist and weather overlay through `eventLook()`. Test hook: `window.__cwEvents.startEvent(kind)`. Visual polish wanted: the rockslide and sandstorm are subtle.
- **Land events contract.** Forge owns them. `G.event` is `null` or `{ kind, t, ... }`, with kinds `'rockslide'` (ashen), `'blizzard'` (frost), `'bogfog'` (fen), `'lavaSurge'` (ember) and `'sandstorm'` (dunes). Echo provides a sound for each, named after its kind, plus `'eventEnd'`. Ash may add looks later.
- **Branch purchase sound:** `'branch'` (Echo).

## Round 2 results (merged)

- **Mira:**
  - Branches: Longbow / Volley, Mortar / Firebomb, Tempest / Frost, Knights / Pikes. Overcharge comes only after a branch. `U` opens the branch menu; keys 1 and 2 buy.
  - Spells: Meteor (Q or 5), Frost (E or 6), Rally (T or 7), using mana and cooldowns.
  - Pressure cap 2.2 + 0.3 per land; the late game is harder.
  - Health bars hidden on unhurt monsters.
  - Test hook: `__cw.UI.game` exposes the game actions.
- **Ash:** `blueprint(kind, 3, branch)` builds 8 branch models; overcharge runes and embers; `FX.meteor(x, z, r, fall)` and `FX.frostNova(x, z, r, secs)`; `drawFrozen`; bombard crews.
- **Echo:** sounds for branches, spells and events; event swells; ambience for each land; boss stings; pause and hidden-page fades; mix spread between calm and battle.
- **Forge:** land events (`src/63-events.js`), QA checks for events, merges.
- **QA after round 2:** no defeats in 1500 s or 4000 s sims, lives drop to 7–18 under pressure, up to 260 alive, 15–20 branches and about 45 spells per sim. Playtests of the branch menu and spell arming on desktop and iPhone 13 worked. Build published as version 3.

## Round 3 results (all merged; build version 5)

- **Ash:** knight, pikeman and militia footmen; rockslide boulders and rubble, and sandstorm wind and tint; boss entrance (ground cracks, flare, a 1.6 s camera push); archer spotters and quivers; the Frost Jotun tint fixed.
- **Mira:**
  - Settings: gear button or `O` (volumes, sound switch, graphics Auto/Sharp/Fast, a How to play tab).
  - Run summary on defeat, with restart.
  - First-takeover gold reserve, a "Not enough gold yet" message, a "Building..." state, one-time help lines, a fix for taps passing through panels, README controls.
  - Human sims: battlefield 1 ends at 20/20 lives; doing nothing loses at wave 4.
- **Forge:** checks passed. Memory is flat over 6 battlefields, `record.js` replays are identical, and the game survives the strict sandbox (blocked storage, wake lock and fullscreen).
- **Echo:** stingers (land cleared, defeat, arrival, wave cleared) triggered by phase changes; menu sounds; music for each land (its own mode, kit and tempo); midrange for phone speakers; reverb follows the volume settings; a fix syncing the meteor whistle to game speed. There are no game-file hooks; everything is detected in the audio update. 23 min live at 3× with no errors or node growth.
- The build is published as version 5.

## Round 4 contracts: new monsters

Mira designs and Ash models four new monsters. Mira adds a `MON` entry with `rig: '<key>'` and the behaviour. Until Ash's model lands, Mira's branch maps the key to an existing rig in `rigMonster` (a fallback table). Ash adds `RIGS.<key>` and the kit. Keys and themes:
- `'ram'`: siege ram, a wheeled, armoured battering ram pushed by skeletons. Slow and tanky; it rams through footmen.
- `'shaman'`: goblin shaman with a staff. It wards nearby allies (uses the elite `m.ward` system).
- `'harpy'`: a flyer that swoops down and snatches a footman.
- `'hound'`: a hell hound, fast, that leaves short fire trails (uses `G.fires`).

## Round 4 results (merged; build version 6)

- **Mira:**
  - New monsters ram, shaman, harpy and hound, with behaviour, AI awareness and land preferences.
  - UI fixes: coins slide under the stats plate; boss labels sit below the plates; the desktop key hint shows on load.
- **Ash:** models for all four (`RIGS.ram`, `RIGS.shaman`, `RIGS.harpy`, `RIGS.hound`) with deaths through `RIG_DEATH` / `DEATH_FX`; fixed the unlit left wings on bats and gargoyles; ram `scale` set to 1.05.
- **Echo:** self-detecting monster sounds (watching `G.mons`), first-sighting cues, ember drums louder on phone speakers.
- **Forge:**
  - Removed the stand-in sounds that doubled Echo's.
  - With the machine quiet, the render-cost bench is the same as before round 3 (the apparent slowdown came from agents sharing the CPU).
  - Re-saved the baseline.
- **Perf note:** measure render cost only while no other agents are running (use `../bench2.js`-style A/B in one browser).

## Round 5 results (merged; build version 7)

- **Mira, save and continue:**
  - The save is `localStorage` key `cinderwatch.save`, version 1, written at each wave start, on land clear and on hide.
  - "Welcome back" offers continue or new game.
  - Test flags (`seed`, `manual`, `ff`, `biome`, `level`, `k`, `board`, `phase`, `nosave`) skip the offer and never write.
  - Test hook: `__cw.save`.
- **Ash, phone performance:**
  - Shadows limited per light; crowd shadow culling.
  - Off-screen monsters skip drawing (`drawMonsterQuiet` keeps the random calls, so results are identical with rendering on or off).
  - Fewer particles in big crowds; auto-resolution undoes a drop that didn't help.
  - Worst case: shadow triangles 604k → 354k, draw calls 316 → 287. Harpy polished.
- **Echo:** checked against the real monsters, with no double deaths (removed the `sfx` calls in `DEATH_FX`); detection every frame; limits tuned; 20 min live with no errors; mute and every slider at 0 verified silent.
- **Forge:** merged; balance identical to the baseline; rendering on and off give identical results; killed orphaned headless Chromium processes (35 of them, burning CPU). **Kill stray Chromium before measuring perf:** `pkill -f pw-browsers/chromium` when no tests are running.

## Round 6 contract: a sixth land, Stormreach (`key: 'storm'`)

A storm-lashed sea cliff at night: wet black rock, crashing surf below, rain, lightning flashes that light the whole board, a lighthouse-like beacon, wrecked ship timbers, kelp and driftwood.

- **Ash:** the `BIOMES` entry in `29-biome.js` (palette, light, mist, rain weather, water as surf), the terrain and props for this land, lightning flashes (a global flash plus `lightFlash`), and the boss model (`RIGS.leviathan`).
- **Mira:**
  - The boss `MON.leviathan` ("The Drowned King"), a sea giant that summons drowned skeletons and sometimes sweeps a wave across the road that pushes footmen back. Its theme and behaviour are Mira's.
  - The mob preferences for `storm` (harpies, wraiths, skeleton knights and so on).
  - The land event `'thunderstorm'` in `src/63-events.js`: lightning strikes random spots on the road, hurting monsters and sometimes stunning a tower, plus heavier rain through `eventLook`.
  - Making sure the land rotation, the AI and the QA tests include the new land.
- **Echo:** keyed on `G.B.bio.key === 'storm'`: rain, surf and thunder ambience (with thunder synced to lightning if Ash exposes a hook such as `FX.lightningAt` or a `G.flashT` value); the land's music mode (stormy, minor, with low strings and timpani feel); the boss theme for `leviathan`; and the `'thunderstorm'` event sound.

## Round 6 results (merged; build version 8)

- **Stormreach** (`storm`, the sixth land):
  - **Ash:** `42-storm.js` (sea, lighthouse beams, storm flashes; `G.flashT` counts up and resets on a flash; also `G.flashX` / `G.flashZ` / `G.flashD` and `FX.onFlash`), `34-coast.js` (wreck, masts, kelp, tide pools, lighthouse keep), `FX.lightningAt(x, z, power)`, `RIGS.leviathan`.
  - **Mira:** `MON.leviathan` (The Drowned King: summons `drowned`, tidal wave every 12 s, enrage), `MON.drowned`, the thunderstorm event in `63-events.js`, and `validSave` re-anchoring old 5-land saves by land key.
  - **Echo:** storm music in A Aeolian, rain, surf and thunder synced to `G.flashT`, the leviathan theme and sting, and the sounds `tidalWave`, `thunder` and `thunderstorm`.
- QA smoke-tests 6 lands. Sims: no defeats.

## Round 7 results: bug bash (merged; build version 9, the morning build)

- **Echo (7 fixes):** thunder now follows `G.flashD`; no lost or phantom thunder; the tidal-wave crash lands on time; no event chime over the defeat stinger; no double elite cue; the iPhone resume fades in instead of blasting; the unlock path is hardened.
- **Ash (6 fixes):** decals that never cleared; bosses washed out by the hit flash; the lightning strobe softened (and it follows `prefers-reduced-motion`); a real-looking tidal wave; no warm light on the storm back cliffs; surf and beams fade with the slab.
- **Mira (6 fixes):** iPad menus no longer let taps through to buttons; late boss escorts capped (no more 6-minute boss waves from land 9 on; starts on land 5); a land event after Play again; Esc no longer deletes a save; no panning behind panels; no tap-through on Continue.
- **Forge:** the coin sound uses `frnd()` (replay determinism).
- **Known minor, open:** number keys or R on the defeat screen switch to manual; during the post-defeat crumble the HUD shows stale lives and gold; on a phone the toast and spell bar slightly overlap the lower board; at 3× about half the thunderstorm strikes skip their own thunder (by design spacing); a frosted tidal wave keeps roaring.

## Phase 2 status: round 8 merged (build version 11)

- **Forge:** `src/64-endless.js` (11 mutators, `modMul` hooks, boss affixes).
- **Mira:**
  - The rename, the menu (`src/73-menu.js`, `UI.scr`), meta (`src/66-meta.js`, `META`, `startRun(mode, heat)`, `G.mode`, `G.heat`, 14 upgrades, Heat 0–10), story (`src/65-story.js`, `STORY.play`) and the tutorial (`src/67-tutorial.js`).
  - URL test flags (`TEST_SESSION`) skip the menu.
- **Ash:** `src/35-longnight.js` (`procBiome(seed, i)`, `key: 'proc'`, a unique `bio.id`, a generated name), per-land grade, glow, glints, edge haze, starry sky and aurora, title camera (`CAM.menuMode`, automatic with `UI.mainMenu`). QA smoke-tests `proc7` and `proc12`.
- **Echo:** the lantern motif and title theme, `AU.setScene`, story voices, meta sounds, and music generated from `bio.music`.
- **Known follow-ups:** on phones, the menu buttons cover most of the board. Echo should detect generated-land changes by `bio.id` (every generated land has key `'proc'`). At high Heat the AI needs upgrades.

## How Forge runs a round (for the next session)

1. Write the round's contracts into this file and push.
2. Spawn at most 3 agents (Mira: game/UI/story/meta; Ash: graphics/lands/models/perf; Echo: audio), each with `isolation: worktree`, `run_in_background: true`, and a brief that says:
   - start with `git merge --ff-only claude/sleepy-cannon-hu2caw`
   - read HANDOFF and CLAUDE
   - QA must pass
   - commit on the worktree branch with the attribution lines; don't push; don't edit HANDOFF
   - send a short report
3. Merge each branch as it reports. On conflicts keep both sides' intent, rebuild `index.html` and never hand-merge it. Then run `node tools/qa.js`. Relay hooks between agents with SendMessage.
4. Run `pkill -f pw-browsers/chromium` before perf measurements (orphaned browsers burn CPU).
5. Republish the playable build: copy `index.html` to the scratchpad and publish it with the Artifact tool, with `url` set to https://claude.ai/artifact/53H8ujm4JWWLAGVr5KhyHs (read it first from a new session).
6. Update this file and push.
7. The owner asked for `main` to carry the game: after each merged round, fast-forward it with `git push origin HEAD:main` (never force).
8. Run `node tools/menuqa.js` after merging (real clicks through the menus on desktop and iPhone 13).

## Round 9 plan (polish toward a shipped game)

- **Mira:**
  - The phone menu layout (buttons cover the board; try a compact bottom sheet).
  - A run-results screen with ember count-up and new-unlock fanfare.
  - Achievements (about 20) shown in the Codex.
  - Balance for high Heat with upgrades, so a well-upgraded player can push Heat 5+.
  - More story interludes.
  - A daily-seed Long Night with a local best.
- **Ash:**
  - A boss intro card with portrait art.
  - Better tower-placement feedback.
  - Victory and defeat cinematics (a beacon re-lighting, the dark swallowing the keep).
  - More prop variety for generated lands.
  - Polish the UI frame (panel borders, icons).
- **Echo:**
  - Detect generated-land changes by `bio.id` and crossfade between consecutive generated lands.
  - Achievement and unlock fanfares.
  - Results-screen music.
  - A listening-safe mix pass for the title.
- **Forge:**
  - More mutators (e.g. *Eclipse*, darker with fewer tower lights; *Siege*, rams every wave; *Echoes*, killed elites return once).
  - QA coverage for menu flows (Playwright clicks through title → campaign → results).
  - Merges.

## Second game: Saarepagar (merge game, `merge/`)

The owner asked for a merge-style game for his girlfriend. It is original (no copying of any existing game), fully Estonian and phone first. Design and team contracts are in **`merge/DESIGN.md`**. Build with `python3 tools/build-merge.py` (writes `merge/index.html` and icons). It is live at `https://babuskaruska.github.io/Cloud-Hosted-Bot/merge/` and installable on its own (`merge/manifest.webmanifest`, `merge/sw.js`). The same team works on it: Mira (game, UI, story), Ash (art, effects), Echo (audio) and Forge (QA, merges).

**Version 3 phase A (live):** the plan is in `merge/PLAN.md`.
- **Mira:**
  - `35-levels.js` (`LV`): endless deterministic levels on a 6×7 board, with goals, obstacles, boosters, 5 lives, win streaks, a boss every 10th level and a chapter every 50.
  - `55-map.js` (`ADV`): the map, the level screen, Õnneratas and Hoiupõrsas; plus a 7- and 30-day calendar.
  - QA: `node tools/mergelevels.js`. Bot win rates for levels 1–200: easy 96%, hard 77% (lowest 25%), boss 75%.
- **Ash:** `24-map.js` (6 themes), `25-level.js` (obstacles, boosters, wheel), plus the level effects.
- **Echo:** map and level music (`MUSIC.mood('tense')`) and the level sounds.
- **Next:** see phase B below.
- **Known:**
  - Some hard levels are too noisy (25%).
  - Leaving a level mid-way costs no life.
  - `drawItemIdle` is unused.
  - 360-wide screens are unchecked.

**Version 3 phase B (merged and live).**
- **Mira:**
  - `36-tour.js` (`TOUR`, 8 themes, task ids `t<i>_<n>`); `56-extra.js` with `PASS`, `WEEK` (replaces the weekend festival; tab "Nädal"), `LOOK` (Garderoob, pets Kutsu and Jänku), photo mode and the rest note (45 min, `?rest=`).
  - Style picks in `S.style`; save v3 with migration; the proofread and `merge/GLOSSARY.md`.
  - Test hook `__mg.extra`; `mergeqa` covers phase B.
- **Ash:** `26-tour.js` (`ART.tourScene`), `27-sky.js` (`ART.sky`, tod and weather; scenes follow the clock unless `opts.noEnv`), `28-look.js` (`ART.heroine`, `ART.pet`), `29-extra.js` (`ART.postcard`, icons), event chain items, style variants; gallery modes in `tools/artgallery.js`.
- **Echo:** island-theme songs, event songs, `MUSIC.season`, the new sounds; `tools/mergeaudio.js` covers them.
- **QA:** `mergeqa` PASS on all three profiles; `mergelevels` unchanged.
- **Known:**
  - 6 bottom tabs only just fit at 360 px; "Seiklus" shrinks to an icon at 390 px and narrower; long island names are cut short.
  - The map HUD overlaps its "Täis" label with the coin icon at 390 px.
  - The night and weather tint costs 4–7 ms per frame headless at DPR 3 (only at `FX.quality` 2); untested on a real phone.
  - `drawItemIdle` is still unused; nobody has heard the new music on a phone.
- **Next:** phase C, done below.

**Version 3 phase C (merged and live).**
- **Mira:**
  - Layout fixes at 360, 390 and 440 px and on desktop.
  - Leaving a level, or reloading mid-level, costs a heart ("Lahkud? Kaotad ühe südame.").
  - Level difficulty: the lowest win rate is now 50%, up from 25%.
  - Economy:
    - Energy from gifts caps at 150; normal refill still stops at 100.
    - Coins are about 30% less generous.
    - The combo and level-up refill bugs are fixed.
  - Hash flags are read.
  - Idle wobble and sparkle (`drawItemIdle` is now used).
  - New tools: `tools/mergeecon.js` (economy sim) and `tools/mergeplay.js` (full playthrough on android 360×800, phone and Pro Max; over 10 min, so run it in the background).
- **Ash:**
  - `ART.perf` device budget: weak devices start at canvas scale 2 and FX quality 1, then step down automatically. This also fixes `FX.quality` always being 2.
  - Cached tints and level backgrounds; map tiles drawn at the canvas scale.
  - The modal backdrop is a snapshot taken every 1.5 s.
  - Idle frames drop to 10 fps, then 4 fps.
  - New tool: `tools/mergeperf.js`.
- **Echo:**
  - Each song has its own lite-mode gain; the scenes are recalibrated.
  - Loudness spread across scenes: full mode 2.2 → 1.8 LU; lite 2.2 → 1.6 LU; phone-speaker model 3.4 → 2.4 LU.
  - Sound bugs fixed:
    - Sources leaked when the audio was suspended; disconnects now follow the audio clock, and 0 sources are left after an 8-minute soak.
    - Noise bursts never ended; they now use start plus stop.
    - Idle sleep now waits for sound tails to end.
  - Results at 4× and 6× CPU throttle: 0 late notes; audio JS costs 4–25 ms per second.
  - `tools/mergeaudio.js` gained soak, lifecycle and throttle modes.
- **QA:** `mergeqa` PASS; `mergeplay` PASS on all three profiles (level 7, area 6, tour 1).
- **Known:**
  - Merge chains cost about 95 ms at 4× throttle on the weak path.
  - The map stays under 30 fps at DPR 3 on a 4×-throttled phone until the automatic step-down.
  - Coins pile up with little to spend them on.
  - At 360 px a two-line toast covers the bottom locked row.
  - "süda" vs "elud" for lives is undecided.
  - Pacing so far comes from a bot.
  - Nobody has played or listened on a real phone; iPhone `audioSession` is only tested through simulation.
- **Next:** owner playtest on real phones, then fix what it finds. Ideas: a coin sink (shop or decorations); lighter merge-chain effects on weak devices.

Phase B contracts (for reference). Base branch for agents: `claude/intelligent-cerf-23obgr`.
- **Island tour (Mira data and rules, Ash art):** after the 6 story areas (`S.ended`), `S.tour` counts generated islands from 0 forever.
  - `TOUR.island(i)` (Mira, `10-data.js` or a new `36-tour.js`) is deterministic and returns `{ i, theme, name, tasks:[{id, name, cost, reward, choices?}], intro }`. Task ids are `t<i>_<n>`, so `S.done` keeps working.
  - Themes (key → Estonian name): `flower` Lillepood, `spa` Spaa, `icecream` Jäätisekiosk, `fashion` Moebutiik, `wedding` Pulmaaed, `beach` Rannaklubi, `xmas` Jõuluturg, `orchard` Sügisene õunaaed. They cycle, and each cycle reshuffles names and tasks.
  - `ART.tourScene(ctx, island, progress, x, y, w, h, t)` (Ash, new `26-tour.js`): every task visibly changes the scene, like `ART.scene`. Until it lands Mira falls back to `ART.scene` with a story area.
- **Design choices (Mira rules and UI, Ash art):** a task can carry `choices: ['boho', 'minimal', 'romantic']` (the style keys). The pick is saved in `S.style[taskId]` and can be changed later from the scene. Ash draws the variant: `ART.scene` and `ART.tourScene` read `opts.style` (an object taskId → key) as an optional last argument.
- **Season pass "Hooaja rada" (Mira):** 30 steps per calendar month, filled by `PASS_PTS` from play, free only. `S.pass = { month, pts, got: {} }`.
- **Weekly events (Mira):** by ISO week, rotating `garden` Aiapidu, `fashion` Moenädal, `wedding` Pulmad, `beach` Rannafestival. Each has its own currency, a special chain (`CHAINS` keys `ev_garden`, `ev_fashion`, `ev_wedding`, `ev_beach`, 6 levels each; Ash draws them through `ART.item`), and a reward track. `S.week = { id, cur, got: {} }`. URL flag `week=<key>` for tests.
- **Wardrobe and pets (Mira unlocks, Ash draws):** `S.look = { outfit, hair, acc }` and `S.pets = { muri: { acc }, ... }`. `ART.heroine(px, look)` and `ART.pet(kind, px, acc)` with kinds `muri`, `kutsu` (puppy), `jänku` → key `janku` (bunny). Keys: outfits `casual, summer, chef, gala, cozy, beach`; hair `bun, long, bob, braid`; acc `none, glasses, hat, flower, scarf`; pet acc `none, bow, collar, hat`.
- **Weather and time of day (Ash):** `ART.sky(ctx, x, y, w, h, t, { tod, weather })` with `tod` in 0..1 from the local clock (`ART.todNow()`) and weather `'clear' | 'rain' | 'snow' | 'petals'`, chosen per day (snow in December–February). Scenes call it behind their art. URL flags `tod=`, `weather=`.
- **Photo mode (Mira UI, Ash frame):** `ART.postcard(ctx, w, h, drawScene)` draws a frame and a caption; Mira adds a button that shows it full screen for a screenshot.
- **Audio (Echo):** `MUSIC.scene('board', { area, tour: theme })` plays a theme variant per island theme; `MUSIC.scene('event', { week: key })` for each weekly event; seasonal colour (winter bells December–February, summer brightness June–August) through `MUSIC.season(key)`. New sounds `'passStep'`, `'styleSwap'`, `'wardrobe'`, `'pet'`, `'eventCur'`, `'photo'`, `'islandNew'`.
- **Language (Mira):** a full Estonian proofread of every string (old and new) and `merge/GLOSSARY.md`. Others write Estonian directly and follow the glossary once it lands.

**Version 2 (live), after the girlfriend's feedback** ("too old-fashioned, not addictive, icons too small" on an iPhone 16 Pro Max):
- **Ash:** modern glossy restyle (sky gradient, frosted tiles, pill buttons, `ART.theme`, new `FX` effects `combo`, `lucky`, `discover`, `levelUp`, `hint`, `text`).
- **Mira:** items fill 92% of a cell, bigger UI, tabs Remont/Album/Festival/Pood/Kott.
  - Merge 5→2, lucky merge, combo, album, mystery box, weekend festival (`?event=1`), free energy, hints, order badges.
  - Save v2 (v1 migrates).
- **Echo:** modern chill-pop and lo-fi music, plus new sounds `combo`, `merge5`, `lucky`, `discover`, `mystery`, `claim`, `event`, `hint`, `album`.
- **QA:** `tools/mergeqa.js` has a `promax` profile (440×956 DPR 3); all three profiles pass.
- **Known:**
  - The scene strip is short on a real Pro Max.
  - Coins may be too generous.
  - Energy can exceed 100.
  - Nobody has listened to the music on a phone yet.

**Status (version 1):**
- **Mira:** the full loop.
  - 7×9 board; 10 chains (bread, berry, flower, wood, fish, tea, dairy, apple, wool, sea) plus coffee (energy), coin and chest; 7 generators (oven, basket, teapot, bed, toolbox, net, wheel) with 4 levels each.
  - Orders; 36 tasks (b1–s4) over 6 areas (bakery, garden, harbour, windmill, lighthouse, secret); story and an ending.
  - Energy over real time, shop, bag, bubbles, chests, daily gift and tasks, tutorial, save `saarepagar.save`.
  - Hook `window.__mg`; URL flags `fresh=1`, `seed=`, `nosave=1`.
- **Ash:** `20-art.js`, `21-items.js`, `22-scenes.js`, `23-people.js`, `40-fx.js`, `icon.py`; gallery `node tools/artgallery.js`.
- **Echo:** `80-audio.js` (folk theme per area, sound effects, talk blips); measure with `node tools/mergeaudio.js`.
- **Forge:** `node tools/mergeqa.js` (real drags on desktop and iPhone 13, save reload) passes.
- **Known:**
  - Toasts sit over the scene strip.
  - The scene is short on phones.
  - The merge glow ring is faint.
  - Pacing after the garden is untested.

## Round 14 results (merged; build version 20, live)

- **Mira:**
  - Kids' onboarding on Kerge or narrow touch screens (big buttons, icon hints, an `abi` help button that glows after 20 s idle; Kerge's first land is gentler).
  - The AI builds mines in waves 1–3.
  - The Long Night after Act II counts depth fresh (`nightLv()`, `G.postAct2`, story beat `night:dawn`).
  - "Hoidja tase" (keeper level), XP and perks, plus a daily gift with a 7-day streak, in `src/67-keeper.js` (`__cwKeeper`).
  - Weekly challenge: button `mweek`, ISO week, 5 rule sets, `G.weekly`.
  - 5 achievements. Fixes: countdown over the tower menu; Codex tips cut off.
- **Ash:**
  - Act II night look in `src/36-night.js` (`nightBiome`, `bio.night`, per-land skies and moons, ghost lanterns; test flag `night=1`).
  - Ultra extras (4096 shadows, anisotropy, denser foliage, glassier water).
  - Low trims for the round 13 effects. The mine faces the camera.
- **QA:** PASS (min lives 18/20/20, better), so the baseline was re-saved. menuqa PASS. Phone shots at 390×844 and 360×800 look right.
- **Known:**
  - Ultra memory on a real iPhone is untested.
  - Ultra nights have no fog.
  - The headless victory cinematic runs in real time.
- **Next ideas:**
  - Wait for the owner's report from the Poco and on the music.
  - A boss rush mode.
  - Hero units.
  - More tower types.
  - Seasonal events.
  - An Echo pass on the stingers for keeper level-ups and the daily gift (`sfx` names to add).

## Round 13 results (merged; build version 19, live)

- **Mira:**
  - Difficulty `G.diff` (Kerge, Tavaline, Raske, Õudne; embers ×0.5/1/1.5/2.2; `#diff=` for tests).
  - Stars `META.stars` and a campaign map (`UI.scr === 'map'`).
  - Act II: levels 6–11, `G.act === 2`, `act2Land()`, 8 beats, `ending2`.
  - Economy in `src/69-economy.js`: interest, early-call bonus, combo gold, `MON.kullakott`, `TOWER.mine` (at most 3, no branch; `BUILD_KINDS`).
  - The AI handles all of it. 10 achievements.
- **Ash:**
  - `src/44-juice.js`: `FX.goldBurst`, `FX.pop`, `FX.combo`, `FX.crit`, `FX.mineTick`, `UI.drawStars`.
  - `blueprint('mine', 0..2)`, `RIGS.goblinSack`.
  - `drawCountBig` countdown; low-tier bloom fixed; bigger explosions on high and ultra.
- **Echo:**
  - Sounds `combo`, `interest`, `goldBurst`, `star`, `mineTick`, `sackRun` (self-detected), and a real `heraldCall`.
  - Map theme; darker Act II variants of the land music.
  - Chip scheduling survives 4–6× CPU throttling (`tools/audiothrottle.js`).
- **QA:** PASS; the baseline was re-saved after the intended economy and balance change (seed 3 min lives 15, mines take tower levels). menuqa PASS.
- **Known:**
  - Act II has no distinct night look (only via its eclipse curse); Ash should add one.
  - The AI builds mines late.
  - Long Night after Act II starts at depth 7.
  - The classic-style map music is quieter.

## Round 14 ideas

- **Ash:** an Act II night look per land; mine and goblin polish; Ultra extras.
- **Mira:** onboarding for kids (bigger tap targets on Kerge, a simpler first land); the AI builds mines earlier; Long Night depth after Act II; more achievements and rewards; a weekly event.
- **Echo:** a listening pass once the owner reports; boss and Act II stingers.
- **Forge:** a real-device check report from the owner (the Poco); performance follow-ups.

## Round 12 results (merged; build version 18, live on Pages)

- **Mira:**
  - The game is **Laternalinnus**, fully Estonian ("sina" forms). Main terms: boss "Pealik", embers "söed", Heat "Kuumus", Campaign "Seiklus", Long Night "Pikk Öö", daily "Päeva väljakutse", Codex "Raamat", the Hollowing "Õõnsus".
  - The font has Õ Ä Ö Ü Š Ž é and quotes.
  - Countdown: `G.count` 6→0 "Alusta!", real seconds, holds the first wave. Skip by tap or Space. Not in the demo, the tutorial or `TEST_SESSION`.
  - Settings rows: Graafika, Kaadrisagedus, Muusikastiil (`SET.gfx`, `SET.fps`, `SET.style`).
- **Ash:**
  - `src/11-tiers.js` `GFX` (low, mid, high, ultra, auto; detection by GPU, memory and cores; adaptive step-down; URL `gfx=`, `cap=`).
  - Frame cap and pacing; 20 fps when idle in menus or paused; nothing drawn when hidden.
  - Monster objects have one shape (fewer deopts, about half the garbage).
- **Echo:**
  - Chiptune style is the default (`AU.setStyle`, `AU.style`, `lanternhold.music`). Every scene and boss has a theme, plus chip SFX and countdown sounds.
  - `AU.setLite` is on with 4 or fewer cores. Chip music creates about 0 nodes per second.
- **Forge:**
  - `tools/perfphone.js`.
  - Removed the tap debug and the credit line; the MIT notice is in `LICENSE` and a source comment.
  - The Low tier render scale went from 0.66 to 0.9 CSS px (0.66 looked blocky).
  - Low tier at 4× CPU throttle, 175 alive: about 11 ms of JS per frame.
- **QA:** `qa.js` PASS (20/20/20, perf better than the baseline); `menuqa` PASS on desktop and iPhone.
- **Known:**
  - Low-tier bloom makes a square glow around the beacon.
  - The countdown digits are thin.
  - The first tutorial land has no countdown.
  - The settings panel overlaps the phone menu sheet.
  - Nobody has listened to the chip music.
  - Poco detection is unverified on hardware.

## Round 13 contracts (depth, economy, difficulty, effects)

All text is in Estonian.
- **Difficulty (Mira):** `G.diff` is one of `'kerge' | 'tavaline' | 'raske' | 'oudne'` (shown as Kerge, Tavaline, Raske, Õudne), chosen at run start. It sits alongside Heat. Kerge is for the youngest kids (forgiving: more lives, more gold), Õudne is brutal. Saved with the run; embers are scaled by difficulty.
- **Stars and campaign depth (Mira):**
  - Each campaign land is rated 1–3 stars (lives left, difficulty) in `META.stars[landKey]`.
  - A campaign map / land select replays cleared lands for stars.
  - The campaign grows to two acts: Act II replays the 6 lands as harder "night" versions with new waves, mutators and story.
  - New achievements for stars.
- **Economy (Mira):**
  - Interest: a share of banked gold paid at wave end, capped.
  - Early-call bonus (call the next wave early for gold).
  - Treasure carriers: a goblin with a sack (`MON.kullakott`, rig key `'goblinSack'`) runs fast and drops a big gold burst when killed. Ash models it; until then it maps to an existing rig.
  - Kill-streak combo gold.
  - A new tower `TOWER.mine` (Kullakaevandus): makes gold each wave and can be upgraded.
  - Teach all of it to `aiThink`.
- **Effects (Ash):**
  - Combo and crit popups, a gold burst `FX.goldBurst(x, z, n)`, chest-carrier sparkle.
  - Bigger impact effects on high and ultra.
  - The mine tower model (`blueprint('mine', lvl)`) and the goblin sack rig.
  - Star-rating and land-select visuals as drawing helpers.
  - Fix the low-tier square bloom; thicker, juicier countdown digits.
- **Sound (Echo):** sounds `'combo'` (pitch rising with the streak; arg = streak), `'interest'`, `'goldBurst'`, `'star'` (arg = 1–3), `'mineTick'`, `'sackRun'` (loop while a carrier runs), and a proper `'heraldCall'`. Music for the land select. Re-measure after the round 12 trims.

## Owner wishes (after round 11, big push)

The owner's kids play it; the youngest plays on a Poco M7 Pro (about 200 EUR Android), where it lags. Wishes:
- Fully Estonian, with all old text gone, including credits. The MIT notice stays only in `LICENSE` and a hidden source comment, as the license requires.
- A 6 → 0 countdown before a round starts.
- Optimized from low-end Android to high-end phones, including battery.
- An Ultra graphics setting with no haze: everything super clear.
- More depth, progress, harder levels and good ways to earn gold.
- Awesome effects and 8-bit music.
- A deeper campaign.

## Round 12 contracts (language, countdown, graphics tiers, performance, chiptune)

- **Language: Estonian only (Mira).** Every player-visible string (menus, HUD, help, story, Codex, achievements, tips, banners, monster, tower, boss and land names, generated land names in `35-longnight.js` and mutator names in `64-endless.js`) is in Estonian. Agents who add strings write them in Estonian directly. The pixel font (`70-pixelfont.js`, Mira) gets Õ õ Ä ä Ö ö Ü ü Š š Ž ž. Use informal "sina" forms, suited to kids. Code identifiers stay English.
- **Countdown (Mira, with Echo):** before the first wave of every land, big pixel numbers count 6, 5, 4, 3, 2, 1, 0 ("Alusta!"), one per second. It is skippable with a tap. While it runs, `G.count` holds the seconds left (null otherwise). Echo plays `sfx('countTick', 0, 0, 1)` on each number and `sfx('countGo')` at 0. The demo behind the menu skips it.
- **Graphics tiers (Ash; Mira draws the settings rows):**
  - `GFX.tiers` is `['low', 'mid', 'high', 'ultra']`, with Estonian labels in `GFX.label[key]`.
  - `GFX.set(key)`, `GFX.tier` (current), plus `'auto'`, which picks from device memory, cores, GPU string and measured frame time.
  - Low (for low-end Android): render scale cap about 0.6–0.75, no or minimal shadows, fewer particles and lights, simpler post.
  - Ultra: no haze, mist or fog in the post and atmosphere, full resolution and sharp.
  - `GFX.fpsCap` is 30, 60 or 0 (uncapped), set with `GFX.setFps(n)`. Default on phones: 60 on high, 30 on low.
  - Battery: render less (or skip frames) while paused or on a static menu, and stop when hidden.
- **Chiptune (Echo):** an 8-bit soundtrack style (pulse, triangle and noise channels; arpeggios) for all scenes, the default for this game. `AU.setStyle('chip' | 'classic')`, with `AU.style`. Mira adds the settings row; the label is Estonian.
- **Performance harness (Forge):** `tools/perfphone.js` runs the game in a phone profile with CPU throttling (4×–6×). It reports JS time per frame (sim, UI, draw submit) in big crowds so the low-end budget can be tracked.

## Round 11 results (merged; build version 14)

- **Mira:**
  - AI anti-air: `aiAir()` looks ahead at flyers and builds or upgrades spires and archers. It casts frost on flyer packs near the beacon and saves frost mana while gargoyles are out. QA seeds end at 20 lives again; seeds 5, 8, 19 and 42 also end at 20.
  - `MON.herald` (Hollow Herald, Long Night only): every 11 s it snuffs towers within 4.2 (`tower.snuff`, 1.8 s dark and idle, `FX.snuff`, `sfx('snuff')`). Every 13 s it calls 2 echo ghosts (`heraldCall`, at most 8 calls). It has a story beat, a boss line and `heraldLand()`.
  - A first-sighting tip for Echo ghosts. `G.dailyFresh` (true only on a fresh daily start).
  - Fixes:
    - Continuing a save rerolled that land's mutators; they are now saved.
    - Continuing yesterday's daily overwrote today's best.
    - Boss affix names now read "The Undying Drowned King".
    - The Continue button says "Night land N".
- **Ash:** `RIGS.herald` with death and portrait ("Thief of Lanterns"). The herald is in the generated boss pool (about 1 land in 3 from land 8, its own seeded stream). `FX.snuff(x, z, r, secs)`, `snuffMul(x, z)`. Brighter siege banner (`clothPanel` `emis`). The boss card slides from the right under Eclipse. Echo ghosts dither only on desktop when not Fast (`CW_DITHER`, URL `dither=0/1`).
- **Echo:**
  - `tools/audiomix.js` (per-scene LUFS, peak and bands) and `tools/audiosoak.js` (menu-to-results loop).
  - Herald theme, entrance sting, `snuff`, and death (the lights return).
  - Eclipse shimmer.
  - The daily sting respects `G.dailyFresh`.
  - The scenes measure from -25 LUFS (title and results) to -20.6 LUFS (horde), with true peak at or below -2.6 dBFS.
- **Forge:** a `heraldCall` sound entry (reuses `echoRise`; Echo may voice it properly). No duplicate affix banner under the boss card. QA PASS with lives 20/20/20, so the baseline was re-saved (better). menuqa PASS on desktop and iPhone 13.
- **Known:**
  - From the high camera the herald's hood reads as a dark mass.
  - The heraldDie scene is sub-heavy.
  - One "wip" commit of Mira's lacks attribution lines (history is not rewritten).

## Round 12 plan

- **Mira:** weekly challenge or shareable seed code; Keeper's Tree late-game nodes (fun, not just numbers); a herald counterplay hint (spread towers); Codex lore pages for each boss.
- **Ash:** herald readability (rim light on the hood, a lantern glow on the ground); title screen polish (logo animation); land-arrival title card art.
- **Echo:** a proper `heraldCall` voice; trim heraldDie sub; menu UI sound pass (hover/tap consistency).
- **Forge:** a leak-per-type report in `qa.js`; run `tools/audiosoak.js` in the round routine; merges and publish.

## Round 10 results (merged; build version 13)

- **Mira:**
  - The daily is deterministic: `rnd.reseed`; `dailyReseed(level, k)` runs at each land and wave start and resets `G.t` at land start.
  - UI coin flights now use the fx stream (they were consuming the gameplay stream).
  - The results screen has no blank unlock lines. Depth embers count only lands past the run's first.
  - Echo ghosts get labels (`ECHO_COL`, "Echo of X") and are counted in `G.mix.echo` for `aiThink`.
  - Echoes tuned (0.45 health; none rise past 80% of `MAX_ALIVE`).
  - Help tips for placement tints, Heat, mutators and the daily.
  - Fixed an exploit: abandoning during the crumble banked the demo's waves.
- **Ash:**
  - Eclipse sky (black sun and corona in `20-post.js`); the boss card goes cold under Eclipse.
  - Echo ghost look (dither, rim, motes).
  - 16 Long Night set pieces in shuffled 8-land cycles, with `dropBig` placement.
  - Siege rams carry a banner and horns.
  - Perf A/B: round 9 and round 10 match round 8 within noise (about 10%).
- **Echo:**
  - `AU.meter` reports LUFS and band shares.
  - Phone high-pass at 100 Hz (36 Hz on desktop).
  - Results music +3.5 dB; trimmed boss sub.
  - Sounds `echoRise`, `siegeHorn`, an eclipse drone and cold mix, `dailySting`.
  - Soak runs flat. The measurement scripts were not committed.
- **Forge:** QA PASS, menuqa PASS (desktop and iPhone 13).
  - The baseline was re-saved: lives went 20 → 18 on all 3 seeds. The cause is the shifted gameplay stream from the coin fix (bisected: Ash's build equals the old baseline; Mira's commit makes the change and has no rule changes that touch lives).
  - Live runs show gargoyle packs on land 4 leaking several lives at once: an AI anti-air weakness exposed by the new rolls.
- **Known:**
  - The daily sting also plays when a saved daily is continued.
  - The siege banner reads dark in shadow.
  - The boss card briefly covers the eclipse disc on desktop.
  - Echo ghosts have no first-sighting tip.
  - The `discard` in the monster shader is unmeasured on real phones.

## Round 11 plan

- **Mira:** AI anti-air (gargoyle packs on land 4: build or upgrade archers/spires earlier when flyers show up; check `G.leakTypes`); a first-sighting tip for Echo ghosts; no daily sting on continue (coordinate with Echo); a pass over balance after the stream shift; maybe weekly challenges or a seeded "share code".
- **Ash:** siege banner lighting; the boss card position against the eclipse disc; a cheaper path for echo ghosts if needed; new monster or boss for the Long Night (a Hollow herald) with Mira.
- **Echo:** commit the mix and soak harnesses under `tools/` (`tools/audiomix.js`); a brighter eclipse layer; voice for the new boss.
- **Forge:** an AI leak report in `qa.js` (leaks per type per land); merges; publish.

## Round 9 results (merged; build version 12)

- **Mira:**
  - Phone bottom-sheet menu (short side under 700 CSS px).
  - Results screen with ember count-up and unlock fanfare. Defeat → `CINE.play('defeat')` → results. A campaign win → victory cinematic → ending → results ("Into the Long Night").
  - 23 achievements (`src/68-achieve.js`, `ACH`, `achUnlock`, `META.ach`, a Codex tab).
  - Daily Long Night (`G.mode === 'daily'`, `dailySeed()`, `META.daily`; button `mdaily`).
  - Six Long Night interludes plus six beats. The HUD hides while `CINE.on()`.
  - High-Heat balance: Heat 5 with a half tree reaches land 11, Heat 10 with a full tree survives. `aiThink` knows siege and echoes and rerolls lands with 2+ curses.
  - Hooks: `G.holdClear`, `MENU.victory`, `MENU.cineOn()`, `MENU.skipCount()`, `nightMode()`, `abandonRun(how)`.
- **Ash:**
  - `src/52-portraits.js` (`bossPortrait`, `UI.bossCard` from `bossEntrance`).
  - `src/43-cine.js` (`CINE.play/on/skip`, URL flag `cine=victory|defeat`, `__cw.cineRun`), one composite-shader branch.
  - Placement tints (gold = affordable, red = not).
  - 7 Long Night set pieces; `plate()` has a bevel, rivets and a shadow.
- **Echo:**
  - Generated lands crossfade by `bio.id`.
  - Sounds `achievement`, `unlock` (p=1 for Heat), `emberTick`, `cineVictory`, `cineDefeat`.
  - Results music (win, defeat or rest). The title is 4 dB softer with varied loops.
  - Fixed the sting duck never lifting while paused. `AU.meter(true)`.
- **Forge:**
  - Mutators `eclipse` (`G.eclipse`, `G.eclA` darken the look in `eventLook`; tower light distance shrinks), `siege` (rams spread into every wave's queue) and `echoes` (a slain ground elite returns once as a pale ghost, `m.echo`, half bounty).
  - `tools/menuqa.js` (real clicks and taps; desktop and iPhone 13; abandon path and defeat path, confirms the cinematic).
- **QA:** `node tools/qa.js` PASS (balance equals the baseline). `node tools/menuqa.js` PASS on both profiles. Perf 419 ms/frame against a 353 baseline in the QA run (software GL; earlier runs on the old build measured 407 under load, so most of it is noise). Re-measure on a quiet machine with `__cw.bench()` A/B.
- **Known:**
  - Daily wave rolls use the shared stream.
  - The results panel reserves blank lines for unlocks.
  - A first-land daily death still pays 3 embers.
  - The Long Night set-piece cycle repeats after 3–4 lands.
  - The boss card shows no Eclipse look; Eclipse ghosts have no label.

## Round 10 plan

- **Mira:** fix the known results and daily issues (seeded wave stream for daily); a label for Echo ghosts; a tutorial pass for the new placement tints; balance of the new mutators in sims.
- **Ash:** a perf pass (A/B bench of round 9 against round 8 on a quiet machine); an Eclipse look for the sky and moon; ghost shader for `m.echo`; more set pieces so the cycle doesn't repeat.
- **Echo:** listen-proofing by analysis (spectra and loudness per scene); a sound for an echo rising; a siege-ram horn on waves with Siege.
- **Forge:** add menuqa to the QA routine; a daily-run determinism check; merges; publish.

## Round 9 contracts

- **Achievements (Mira):** `ACH` (about 20 entries `{ id, name, tip, icon }`) in `src/68-achieve.js`, saved inside `META` (`META.ach[id] = true`). `achUnlock(id)` is idempotent; it shows a toast and calls `sfx('achievement')`. The Codex gets an Achievements tab.
- **Results screen (Mira):** `UI.scr === 'results'` after a defeat or a campaign win, with an ember count-up (call `sfx('emberTick')` per step, throttled) and `sfx('unlock')` for each newly affordable upgrade or new Heat tier. While it is open the menu calls `AU.setScene('results')`.
- **Cinematics (Ash):** `CINE.play(kind, done)` with `kind` `'victory'` (the beacon re-lights) or `'defeat'` (the dark swallows the keep), in a new `src/43-cine.js`. It drives the camera and fx for 2.5–4 s and then calls `done()`. `CINE.on()` is true while one plays. Mira calls it (if `typeof CINE !== 'undefined'`) before opening results; it must be skippable by tap or key.
- **Boss intro card (Ash draws, Mira triggers):** `bossPortrait(kind, size)` in `src/52-portraits.js` returns a canvas with pixel portrait art for each boss key in `MON` (fallback: a silhouette). Ash also owns `UI.bossCard(kind, name, title)`, which draws the card for about 2.5 s when a boss spawns (called from the existing boss entrance). Echo's existing boss sting plays as it is.
- **Placement feedback (Ash):** pad highlight, range ring preview and a valid/invalid tint while a build is armed; in `72-ui.js` drawing code only, coordinated by small additions (Mira owns the rest of that file).
- **Daily Long Night (Mira):** `G.mode === 'daily'`, seed from the UTC date (`dailySeed()`), local best kept in `META.daily = { date, best }`. Same rules as Long Night at Heat 0 with fixed mutators from the seed.
- **New mutators (Forge):** `eclipse` (darker; tower light radius down; `G.eclipse` for Ash to read), `siege` (rams join every wave), `echoes` (a killed elite returns once as a ghost, `m.echo = true`).
- **Echo:** generated-land changes detected by `bio.id`; a crossfade between consecutive generated lands; the sounds `'achievement'`, `'unlock'`, `'emberTick'`; results music for scene `'results'`; a softer, listening-safe title mix.
- **Menu-flow QA (Forge):** `tools/menuqa.js` clicks title → campaign → play a little → defeat → results → title on desktop and on an iPhone 13 profile.

## Phase 2: Lanternhold (a full game). Round 8 contracts

The owner's ask: a new name, story, procedural endless rounds that never end, carry-over points between runs, harder levels, more mayhem, a polished real-game feel, and better visuals even on phones.

- **Name:** **Lanternhold**. The hero is the Lanternkeeper; the enemy is the Hollowing, a creeping dark that wakes the dead. Keep the MIT credit to the original Cinderwatch in README and LICENSE.
- **Run structure:**
  - The **Campaign** is the 6 hand-made lands in a fixed order (ashen, frost, fen, ember, dunes, storm), with story beats.
  - Then **The Long Night** follows: endless procedural lands.
  - The AI demo behind the menu stays as it is now (random land).
  - Land index `G.level`: below 6 means `BIOMES[(BIOME.start + i) % 6]`, with `BIOME.start = 0` in the campaign. At 6 and above, it is `procBiome(G.runSeed, i)`.
- **Ash: `procBiome(seed, i)`.** Returns a full `BIOMES`-shaped entry (palette, light, mist, weather, water, props mix, trees, mobs/early tables and the boss list), generated by blending and mutating the 6 hand-made lands. Pick a base land plus a donor and shift hue, time of day, fog and weather. It must also return a generated `name` (e.g. "The Weeping Marsh of Kael"), and it must be deterministic for the seed. `biomeFor()` uses it for `i >= 6`. `BIOME_DRESS` and the land event need a key: use the base land's key in `bio.dress` and `bio.eventKind`.
- **Forge: `src/64-endless.js`.**
  - `MUTATORS` (keyed modifiers, e.g. `bloodmoon` doubles elites, `swarm`, `ironhide` armours everything, `fog`, `haste`, `volatile` makes deaths explode, `famine` cuts gold, `titan` gives a bigger boss with affixes) and `G.mods` (the active keys for the current land), rolled from depth, heat and seed.
  - The boss gets affixes from depth (reusing elite kinds plus a scale).
  - API: `modOn(key)`, `rollMods(level)`, `MUTATORS[key] = { name, tip, icon }`.
- **Mira: `META` (meta progression) in `src/66-meta.js`.**
  - `localStorage` key `'lanternhold.meta'` (try/catch) holding embers, upgrade levels, `heatMax`, lifetime stats and story flags.
  - Embers are earned at the end of each run (by waves, bosses and depth × heat multiplier).
  - The **Keeper's upgrade tree:** about 12–16 upgrades such as starting gold, tower damage, starting lives, mana, a free first tower, unlocking branches early, spell cooldown and bounty, each with several levels and rising costs.
  - `applyMeta()` at the start of a run.
  - `G.heat` is chosen at run start (0 to `heatMax`); each Heat adds a fixed modifier and pays more embers. Beating a tier (the campaign's 6 lands, or reaching a depth) unlocks the next.
- **Mira: story in `src/65-story.js` plus the UI.**
  - Story beats keyed by land index (intro, after each boss), boss lines, an ending after land 6, and Long Night interludes every few lands.
  - A dialogue panel with a pixel portrait (the Keeper, plus a few characters such as a ghostly old keeper).
  - A **main menu**: Continue / Campaign / The Long Night (unlocked after the campaign, or always, with a warning) / Keeper's Tree / Codex (monsters seen) / Settings, over the AI demo.
  - A guided first run (a short tutorial).
  - All strings say Lanternhold.
- **Echo:** the Lanternhold title theme; story stingers (`storyOpen`, `storyLine`); upgrade-purchase and ember sounds; and procedural music for generated lands (mode, tempo, kit and lead derived from `bio` and the seed). Read `bio.music` if Ash provides a seed or base key there.

## Next


- Round 5 ideas: save and continue a run (phones lose progress when the tab is closed), phone performance with LOD or fewer shadows in big crowds, a sound check with the real new monsters, harpy close-up polish.

- Round 3: polish and bug bash.
  - **Mira:** settings panel (volume sliders through `AU.setVolume`, quality), a run summary on defeat, the human first-time experience, balance for a human player who starts manually.
  - **Ash:** knight and pike footman looks, frozen look, rockslide and sandstorm visual polish, boss entrance camera moments, archer crews.
  - **Echo:** victory and defeat jingles, UI sounds for the new menus, music for each land, an iPhone speaker mix pass.
  - **Forge:** phone performance and resolution scaling, a memory and long-run leak check, a determinism check with `record.js`, merges.
- Ideas after that: save and continue a run, an endless-mode scoreboard, more monster kinds per land.
