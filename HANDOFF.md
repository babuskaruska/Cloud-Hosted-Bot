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

## Next

- Round 3: polish and bug bash.
  - **Mira:** settings panel (volume sliders through `AU.setVolume`, quality), a run summary on defeat, the human first-time experience, balance for a human player who starts manually.
  - **Ash:** knight and pike footman looks, frozen look, rockslide and sandstorm visual polish, boss entrance camera moments, archer crews.
  - **Echo:** victory and defeat jingles, UI sounds for the new menus, music for each land, an iPhone speaker mix pass.
  - **Forge:** phone performance and resolution scaling, a memory and long-run leak check, a determinism check with `record.js`, merges.
- Ideas after that: save and continue a run, an endless-mode scoreboard, more monster kinds per land.
