// The first-run tutorial: a few guided steps on a keeper's first ever Campaign run (build, upgrade, call a wave, cast a
// spell). Skippable, and never shown again once finished or skipped (META.tut). The steps wait for story beats and
// menu screens; while the first two run, the first wave holds back so there is time to read.
// TUT.step: null (off) or 'build' | 'upgrade' | 'call' | 'spell' | 'done'. TUT.target(): what the guide points at.
const TUT = {
  step: null, pending: false, t: 0, pad: null, spells0: 0,
  active() { return !!this.step || this.pending; },
  maybeStart() { this.step = null; this.pending = !META.tut && G.mode === 'campaign' && META.on; },
  stop() { this.step = null; this.pending = false; },
  finish() { this.stop(); META.tut = 1; saveMeta(); },
  skip() { sfx('uiClick', CAM.x, CAM.z, .6); this.finish(); },
  go(step) { this.step = step; this.t = 0; if (step !== 'done') sfx('storyLine', CAM.x, CAM.z, .6); },
  // The pad to suggest: a free one that covers a lot of road, near the middle of it.
  pickPad() {
    const B = G.B; let best = null, bs = -1;
    for (const p of B.pads) { if (p.tower) continue; const sc = padCoverage(p, TOWER.archer.range[0]) * (1.2 - Math.abs(p.s / B.L - .45)); if (sc > bs) { bs = sc; best = p; } }
    return best;
  },
  update(dt) {
    if (!this.active() || G.mode !== 'campaign') { if (this.step && G.mode !== 'campaign') this.stop(); return; }
    if (STORY.on() || UI.scr || G.phase !== 'play') return;
    if (this.pending) { this.pending = false; this.go('build'); this.pad = this.pickPad(); }
    this.t += dt;
    const hold = s => { if (!G.spawning && G.k === 0) G.nextIn = Math.max(G.nextIn, s); };
    const alive = G.towers.filter(t => t.alive && t.def);
    if (this.step === 'build') {
      hold(8); if (!this.pad || this.pad.tower) this.pad = this.pickPad();
      if (alive.length) this.go('upgrade');
    } else if (this.step === 'upgrade') {
      hold(8);
      if (alive.some(t => t.lvl >= 1)) { this.go('call'); if (!G.spawning && G.k === 0) G.nextIn = 20; }
    } else if (this.step === 'call') {
      if (G.k >= 1 || G.spawning) { this.go('spell'); this.spells0 = G.stats.spells || 0; }
    } else if (this.step === 'spell') {
      if ((G.stats.spells || 0) > this.spells0) this.go('done');
    } else if (this.step === 'done') {
      if (this.t > 4.5) this.finish();
    }
  },
  // [head, line] for the guide plate.
  text() {
    const tch = UI.touch, s = this.step;
    if (s === 'build') return ['Build a tower', (tch ? 'Tap' : 'Click') + ' the glowing pad, then pick a tower. Archers are a fine start.'];
    if (s === 'upgrade') return ['Make it stronger', (tch ? 'Tap' : 'Click') + ' your tower and choose Upgrade.'];
    if (s === 'call') return ['Call the wave', (tch ? 'Tap' : 'Click') + ' the wave plate at the top to call it early, for extra gold.'];
    if (s === 'spell') return anySpellReady() ? ['Cast a spell', (tch ? 'Tap a lit spell, then tap the road.' : 'Click a lit spell (or Q, E, T), then the road.')] : ['Spells', 'Kills fill the blue mana bar. When a spell lights up, cast it.'];
    if (s === 'done') return ['The beacon is yours', 'Hold the pass, Keeper. The old keeper is watching.'];
    return null;
  },
};
function anySpellReady() { return SPELL_KINDS.some(k => spellReady(k)); }
