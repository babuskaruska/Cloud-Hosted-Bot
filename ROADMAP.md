# Roadmap: more mayhem, more detail, more depth

Each phase ships on its own and is checked the same way: `python3 tools/build.py`, then `node tools/cdp.js` screenshots and a deterministic `node tools/record.js scan <seed> <seconds>` to compare balance before and after.

## Phase 0: ready (done)

- Imported Cinderwatch (MIT, credit kept).
- `tools/chrome.js`: dev tools find Chrome on Linux as well as macOS, with software GL when there is no GPU.
- `CLAUDE.md`: how to build, test and where things live.

## Phase 1: Mayhem (crowd size and chaos)

The game is tuned for small crowds today: at most 84 monsters alive (`src/62-game.js`, `G.mons.length > 84`) and fixed instance caps per model in `src/50-rig.js` / `51-bestiary.js`.

1. **Bigger crowds.** Raise the live cap to about 250 and the matching `PartBatch` caps. Measure draw calls and frame time with `#fps=1`, and keep the existing automatic resolution scaling as the safety net.
2. **Horde waves.** A new wave type every few waves: a flood of cheap swarm monsters (rats, scarabs, spiders) with lower HP each. This goes in `buildWave`.
3. **Chain reactions.** Sapper explosions set off nearby sappers; bombard shells leave burning ground for a few seconds.
4. **Elite affixes.** Any monster can roll a trait from wave 10 on: *Burning* (leaves fire), *Splitting*, *Shielded*, *Hasted*. A colored aura and a name tag mark them.
5. **Mid-wave events.** A random event per land: a rockslide that blocks a lane for a while, a blizzard that slows everything, a lava surge, a sandstorm that shortens tower range.
6. **Juice.** Screen shake scaled to explosions, short hit-stop on boss hits, more debris and gibs, ragdoll-style bone scatter.

## Phase 2: Detail (how it looks and sounds)

1. **Wear on the battlefield.** Scorch marks, blood and goo decals that persist through a wave, footprints in snow and sand, broken props that stay broken.
2. **Living towers.** Visible crews (archers drawing, gunners loading), recoil, smoke from the bombard, sparks on the spire.
3. **More animation per monster.** Distinct attack and death animations for the bigger monsters; bosses get an entrance moment with the camera.
4. **Weather and time.** Rain with puddle reflections and lightning that lights the scene, plus a slow day-to-night cycle inside a land.
5. **Sound.** Layered crowd noise that grows with the horde, distinct boss themes, and music that rises in intensity with the danger.

## Phase 3: Depth (more complex play)

1. **Tower branches.** At level 3 each tower picks one of two paths, e.g. Archer → Longbow (range, pierce) or Volley (many arrows); Bombard → Mortar or Firebomb; Spire → Tempest or Frost; Guard → Knights or Pikemen.
2. **Two new towers.** A **Flame Thrower** (short-range cone, burning) and an **Arcane Obelisk** (marks enemies so they take more damage).
3. **Hero unit.** One commandable hero with a couple of abilities and a cooldown bar.
4. **Spells.** A meteor, a freeze, and reinforcements, paid for with a mana bar that fills from kills.
5. **Branching paths.** Some layouts get two roads that merge, so placement matters more.
6. **Run upgrades.** After each boss, pick one of three permanent boosts for the rest of the run.
7. **AI commander update.** Teach the commander every new system above, so the self-playing mode still plays well.

## Order and size

Phase 1 is the best first step: the biggest visible change for the least risk. Every phase is several sessions of work. Each item is built, screenshotted, scanned for balance, and committed on its own, so any change can be undone.

## Known limits

- This cloud machine has no GPU. Frame rate measured here uses software rendering, so speed should also be checked on a real device.
- Touch and gamepad still need testing on real hardware, as the original README notes.
