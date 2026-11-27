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
