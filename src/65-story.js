// The story of Lanternhold: the Hollowing (a creeping dark that wakes the dead), the Lanternkeeper who re-lights the
// beacons, and the ghost of the old keeper who guides them. Beats are short (two or three lines), pause the game while
// they show, and are shown once per keeper (META.story); the Codex replays them.
//
// Hooks: STORY.play(id) queues a beat; STORY.landStart() (from metaLandStart) queues the land's beat; STORY.ending()
// plays after the sixth land; boss lines play a moment after a boss enters (STORY.update watches G.mons).
// State for other code: STORY.cur is the beat on screen (or null); G.paused is held while it shows.
// Sounds (Echo): 'storyOpen' when a beat opens, 'storyLine' on each new line.

const SPEAKERS = {
  keeper: { name: 'The Lanternkeeper', col: '#ffd9a8' },
  ghost: { name: 'Old Keeper Aldric', col: '#bfe4ff' },
  hollow: { name: 'The Hollowing', col: '#c8a8ff' },
  giant: { name: 'Bone Giant', col: '#efe4cd' }, ogre: { name: 'Ogre', col: '#c8d890' }, jotun: { name: 'Frost Jotun', col: '#9fd4ff' },
  queen: { name: 'Brood Queen', col: '#e0a0e8' }, colossus: { name: 'Magma Colossus', col: '#ffa060' }, king: { name: 'The Buried King', col: '#f0d890' },
  leviathan: { name: 'The Drowned King', col: '#90e8d8' },
};
// Each beat: a title (for the Codex) and its lines as [speaker, text].
const BEATS = {
  intro: { title: 'The Waking', lines: [
    ['ghost', 'Wake, Keeper. The Hollowing has risen, and every beacon from here to the sea has gone dark.'],
    ['ghost', 'Where the dark spreads, the dead get up and walk. Only fire turns them back.'],
    ['keeper', 'Then I will light them again. All six.'],
  ] },
  'land:ashen': { title: 'Ashen Pass', lines: [
    ['ghost', 'The Ashen Pass. I kept this fire for forty winters, until the dark took me.'],
    ['ghost', 'Build on the old stones. They remember the light.'],
  ] },
  'land:frost': { title: 'Frostfall', lines: [
    ['keeper', 'Snow on the road, and footprints that never melt it.'],
    ['ghost', 'The frozen dead walk lightly. Fire walks heavier.'],
  ] },
  'land:fen': { title: 'Mirefen', lines: [
    ['ghost', 'Mirefen. The bog keeps what it drowns, and the Hollowing lends it all back.'],
    ['keeper', 'Then we burn the fog off the water.'],
  ] },
  'land:ember': { title: 'Emberscar', lines: [
    ['keeper', 'Even the ground burns here. What does the dark want with fire?'],
    ['ghost', 'Heat without light. That is all the Hollowing ever was.'],
  ] },
  'land:dunes': { title: 'Duskmesa', lines: [
    ['ghost', 'Duskmesa. Kings were buried here with their gold, and they want it back.'],
    ['keeper', 'They can have the gold. Not the beacon.'],
  ] },
  'land:storm': { title: 'Stormreach', lines: [
    ['ghost', 'The last beacon stands over the sea. The Hollowing began beneath it.'],
    ['keeper', 'Then that is where it ends.'],
  ] },
  'boss:giant': { title: 'The Bone Giant', lines: [['giant', 'Bones remember, little flame. Bones remember being tall.']] },
  'boss:ogre': { title: 'The Ogre', lines: [['ogre', 'I ate the last keeper\'s bread. Then I ate the last keeper.']] },
  'boss:jotun': { title: 'The Frost Jotun', lines: [['jotun', 'Every fire goes out in the end. I am the end of yours.']] },
  'boss:queen': { title: 'The Brood Queen', lines: [['queen', 'My children are so hungry, and your light is so warm.']] },
  'boss:colossus': { title: 'The Magma Colossus', lines: [['colossus', 'I was fire before your kind learned to fear it.']] },
  'boss:king': { title: 'The Buried King', lines: [['king', 'Kneel, torch-bearer. The dead are owed their tribute.']] },
  'boss:leviathan': { title: 'The Drowned King', lines: [['leviathan', 'The sea took every keeper before you. The sea is patient.']] },
  ending: { title: 'Six Fires', lines: [
    ['ghost', 'Six fires burn again. I could rest now, Keeper... almost.'],
    ['ghost', 'But the Hollowing has no bottom. Past the last beacon the night goes on, and the lands change shape in it.'],
    ['keeper', 'Then I carry the lantern into it. As far as it goes.'],
  ] },
  // The Long Night: an interlude every third land, from this pool (min: the first depth it can show at).
  'night:1': { title: 'Unmapped', min: 3, lines: [['ghost', 'These lands are on no map I ever kept. The Hollowing dreams them up as you walk.'], ['keeper', 'Then I will dream a fire into each one.']] },
  'night:2': { title: 'Forever', min: 3, lines: [['hollow', 'You light. I swallow. We could do this forever, little keeper.'], ['keeper', 'Good. I am not tired.']] },
  'night:3': { title: 'The Weight', min: 3, lines: [['keeper', 'The lantern is heavier tonight.'], ['ghost', 'That is the light you carry for the ones who fell. It is meant to be heavy.']] },
  'night:4': { title: 'Counting', min: 6, lines: [['ghost', 'I counted the beacons once. Six. Now I cannot stop counting.'], ['ghost', 'Every fire you leave behind pushes the dark back one more step.']] },
  'night:5': { title: 'Lanterns', min: 6, lines: [['hollow', 'Every keeper burns out. I have buried a thousand lanterns.'], ['keeper', 'Then you know what comes next. Another one.']] },
  'night:6': { title: 'Wrong Stars', min: 9, lines: [['ghost', 'Deeper than I ever went. The stars are wrong down here.'], ['keeper', 'The fire is not.']] },
  'night:7': { title: 'Quiet', min: 9, lines: [['hollow', 'Why fight the night? It is so quiet here.'], ['keeper', 'Quiet is what the dead want. I am not dead.']] },
  'night:8': { title: 'The Choir', min: 12, lines: [['ghost', 'I hear the old keepers in the wind down here. They are cheering, I think.'], ['keeper', 'Let them cheer. I will keep walking.']] },
};
const NIGHT_POOL = Object.keys(BEATS).filter(k => k.startsWith('night:'));
const BEAT_ORDER = ['intro', 'land:ashen', 'boss:giant', 'land:frost', 'boss:jotun', 'land:fen', 'boss:queen', 'land:ember', 'boss:colossus', 'land:dunes', 'boss:king', 'land:storm', 'boss:leviathan', 'ending', 'boss:ogre'].concat(NIGHT_POOL);

// Portraits, 16x16, drawn in code. One letter per pixel; '.' is clear.
const PORTRAIT_PAL = {
  o: '#0b0d14', R: '#8a3418', r: '#52200f', F: '#e8b48a', f: '#a8744a', Y: '#ffe2a0', G: '#e8b04a', g: '#a8742a', E: '#ff8a3c', W: '#ffffff',
  C: '#cfeaff', c: '#7fb0dc', d: '#38608c', K: '#1a1428', k: '#33284c', P: '#c8a8ff', p: '#7a58c0',
  B: '#e9dfc8', b: '#a89e88', n: '#5a5244', X: '#ff4a2a', V: '#9cb070', v: '#5e6e3c', I: '#a8dcff', i: '#5a8ec8', S: '#4a3a50', s: '#2a2030',
  L: '#ff9a3c', l: '#c8481e', M: '#3a3030', m: '#5a4a44', T: '#d8c8a0', t: '#9a8a6a', A: '#70d8c8', a: '#2f8a80', Q: '#1e4e50',
};
const PORTRAITS = {
  keeper: [
    '.....oooooo.....',
    '....oRRRRRRo....',
    '...oRRRRRRRRo...',
    '..oRRrrrrrrRRo..',
    '..oRroooooorRo..',
    '.oRRofFFFFfoRRo.',
    '.oRrofoFFofofRo.',
    '.oRroFFFFFForRo.',
    '.oRrofFffFfoRRo.',
    '.oRRrofFFforRRo.',
    'oRRRRroooorRRRRo',
    'oRrRRRRRRRRRoGGo',
    'oRrRRRRRRRRoGYYG',
    'oRrRRrRRRRRoGYYG',
    'oRrRRrRRRRRRoGGo',
    'oooooooooooooooo',
  ],
  ghost: [
    '....oooooooo....',
    '...odddddddddo..',
    '..oddcccccccddo.',
    '..odcCCCCCCCcdo.',
    '.oddCooCCCooCddo',
    '.odcCoWCCCWoCcdo',
    '.odcCCCCCCCCCcdo',
    '.odcCCCCdCCCCcdo',
    '.odcCddCCCddCcdo',
    '.odcCCCCCCCCCcdo',
    'oddcCCCCCCCCCcdo',
    'odccCCCCCCCCCcdo',
    'odcccCCCCCCCccdo',
    'odccccCCCCCcccdo',
    'oddcccdCCCdcccdo',
    'oooooooooooooooo',
  ],
  hollow: [
    '................',
    '....kkkkkkkk....',
    '...kKKKKKKKKk...',
    '..kKKKKKKKKKKk..',
    '.kKKKKKKKKKKKKk.',
    '.kKKpPKKKKPpKKk.',
    'kKKKPWPKKPWPKKKk',
    'kKKKKpKKKKpKKKKk',
    'kKKKKKKKKKKKKKKk',
    'kKKKKKoooooKKKKk',
    '.kKKKoPpPpPoKKk.',
    '.kKKKKoooooKKKk.',
    '..kKKKKKKKKKKk..',
    '.k.kKKKKKKKKk.k.',
    'k..k.kKKKKk.k..k',
    '....k..kk..k....',
  ],
  giant: [
    '....oooooooo....',
    '...oBBBBBBBBo...',
    '..oBBBBBBBBBBo..',
    '.oBBBBBBBBBBBBo.',
    '.oBBooobboooBBo.',
    '.oBoXXobboXXoBo.',
    '.oBoXEobboEXoBo.',
    '.oBbooobbooobBo.',
    '..oBBBbooBBBBo..',
    '..obBBBBBBBBbo..',
    '...oBoBoBoBoo...',
    '...onononononn..',
    '...oBoBoBoBoBo..',
    '....oBBBBBBBo...',
    '.....ooooooo....',
    '................',
  ],
  ogre: [
    '....oooooooo....',
    '...oVVVVVVVVo...',
    '..oVVVVVVVVVVo..',
    '.oVVvvvVVvvvVVo.',
    '.oVoooVVVVoooVo.',
    '.oVoXoVVVVoXoVo.',
    '.oVVVVvVVvVVVVo.',
    'ooVVVVvvvvVVVVoo',
    'oVVVVVVVVVVVVVVo',
    'oVVoBooooooBoVVo',
    '.oVoBVVVVVVBoVo.',
    '.oVVoVVVVVVoVVo.',
    '..oVVvvvvvvVVo..',
    '...ooVVVVVVoo...',
    '.....oooooo.....',
    '................',
  ],
  jotun: [
    '.oo..........oo.',
    'oIio.oooooo.oiIo',
    'oIIioIIIIIIoiIIo',
    '.oIiIIIIIIIIiIo.',
    '..oIIIIIIIIIIo..',
    '..oIooIIIIooIo..',
    '..oIoWoIIoWoIo..',
    '..oIIIIiiIIIIo..',
    '..oiCCCCCCCCio..',
    '..oCCCooooCCCo..',
    '..oCCCCCCCCCCo..',
    '...oCCCCCCCCo...',
    '...ocCCCCCCco...',
    '....ocCCCCco....',
    '.....occcco.....',
    '......oooo......',
  ],
  queen: [
    '..o..........o..',
    '..So........oS..',
    '...So.oooo.oS...',
    '....oSSSSSSo....',
    '..ooSSSSSSSSoo..',
    '.oSSXSSXXSSXSSo.',
    '.oSSSSXSSXSSSSo.',
    'oSSXSSSSSSSSXSSo',
    'oSSSSSSssSSSSSSo',
    'oSSSSSssssSSSSSo',
    '.oSSSSSSSSSSSSo.',
    '..oSSoBSSBoSSo..',
    '...ooBoSSoBoo...',
    '....oBo..oBo....',
    '.....o....o.....',
    '................',
  ],
  colossus: [
    '...oooooooooo...',
    '..oMMMmMMMMMMo..',
    '.oMMmMMMlMMmMMo.',
    '.oMMMMMLlMMMMMo.',
    'oMMooMMlMMMooMMo',
    'oMMoLLoMMMoLLoMo',
    'oMmoLYoMMMoYLoMo',
    'oMMMooMMlMMooMMo',
    'oMMMMMMlLMMMMMMo',
    '.oMMMlLLLLlMMMo.',
    '.oMMoLYYYYLoMMo.',
    '.oMMMoLLLLoMMMo.',
    '..oMMMooooMMMo..',
    '..oMmMMMMMMmMo..',
    '...oooooooooo...',
    '................',
  ],
  king: [
    '...G.G.GG.G.G...',
    '...GoGoGGoGoG...',
    '...GGGGGGGGGG...',
    '...oggggggggo...',
    '..oTTTTTTTTTTo..',
    '..otTTtTTtTTto..',
    '..oTooTTTTooTo..',
    '..oToAoTToAoTo..',
    '..otTTTttTTTto..',
    '..oTTtTTTTtTTo..',
    '..oTTTooooTTTo..',
    '...otTTTTTTto...',
    '...oTTtTTtTTo...',
    '....oTTTTTTo....',
    '.....oooooo.....',
    '................',
  ],
  leviathan: [
    '..G..G.GG.G..G..',
    '..GooGoGGoGooG..',
    '..oGGGGGGGGGGo..',
    '..oaaaaaaaaaao..',
    '.oaAAAAAAAAAAao.',
    '.oaAooAAAAooAao.',
    '.oaAoWoAAoWoAao.',
    '.oaAAAAaaAAAAao.',
    '.oaAAAAAAAAAAao.',
    '..oaQaQaaQaQao..',
    '..oQaQaQQaQaQo..',
    '..oaoaoaaoaoao..',
    '..oQ.Q.aa.Q.Qo..',
    '..o..a.QQ.a..o..',
    '.....Q.a..Q.....',
    '......o..o......',
  ],
};
const _portCache = {};
function portraitCanvas(key) {
  if (_portCache[key]) return _portCache[key];
  const rows = PORTRAITS[key] || PORTRAITS.ghost, cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
  const c = cv.getContext('2d');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const col = PORTRAIT_PAL[(rows[y] || '')[x]]; if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); } }
  return (_portCache[key] = cv);
}

const STORY = {
  queue: [], cur: null, line: 0, chars: 0, t: 0, wasPaused: false, replay: false, onDone: null, bossWait: [],
  on() { return !!this.cur; },
  // Queue a beat. Unless it is a replay (the Codex), a beat already seen by this keeper is skipped.
  play(id, o = {}) {
    const B = BEATS[id]; if (!B) return false;
    if (!o.replay && (META.story[id] || !inRun())) return false;
    if (this.queue.some(q => q.id === id) || (this.cur && this.cur.id === id)) return false;
    this.queue.push({ id, replay: !!o.replay, onDone: o.onDone || null });
    return true;
  },
  clear() { if (this.cur) this.close(true); this.queue.length = 0; this.bossWait.length = 0; },
  open(q) {
    this.cur = q; this.line = 0; this.chars = 0; this.t = 0; this.wasPaused = G.paused; G.paused = true;
    if (!q.replay) { META.story[q.id] = 1; saveMeta(); }
    sfx('storyOpen', CAM.x, CAM.z, 1); UI.closeMenu();
  },
  close(silent) {
    const q = this.cur; if (!q) return; this.cur = null; G.paused = this.wasPaused && !silent ? this.wasPaused : false;
    if (q.onDone) q.onDone();
  },
  lines() { return this.cur ? BEATS[this.cur.id].lines : []; },
  // Tap, Space or Enter: finish the line being written, else go to the next line, else close.
  advance() {
    if (!this.cur) return; const L = this.lines(), ln = L[this.line];
    if (this.chars < ln[1].length) { this.chars = ln[1].length; return; }
    if (this.line < L.length - 1) { this.line++; this.chars = 0; this.t = 0; return; } // Echo voices each line from UI.story
    sfx('uiClick', CAM.x, CAM.z, .6); this.close();
  },
  skip() { if (!this.cur) return; sfx('uiClick', CAM.x, CAM.z, .6); this.close(); },
  update(dt) {
    if (this.cur) {
      this.t += dt; const ln = this.lines()[this.line]; this.chars = Math.min(ln[1].length, this.chars + dt * 55);
      // For Echo's audio: the line on screen (a new object on each new line).
      if (!UI.story || UI.story.i !== this.line || UI.story.id !== this.cur.id) UI.story = { id: this.cur.id, speaker: ln[0], i: this.line, text: ln[1] };
      return;
    }
    UI.story = null;
    // Boss lines: a moment after a boss steps into view (its entrance plays first).
    if (inRun() && G.phase === 'play') for (const m of G.mons) {
      if (!m.def.boss || m.dead || !m.entered || m._lined) continue;
      m._lineT = (m._lineT || 0) + dt; if (m._lineT > 1.3) { m._lined = true; this.play('boss:' + m.type); }
    }
    // Nothing on screen: open the next beat, unless a menu screen is up.
    if (this.queue.length && ((!UI.scr && !UI.sets) || this.queue[0].replay)) this.open(this.queue.shift());
  },
  landStart(restoring) {
    if (restoring || !inRun()) return;
    if (G.level < CAMPAIGN_LANDS) this.play('land:' + G.B.bio.key);
    else {
      const d = nightDepth();
      if (d > 0 && d % 3 === 0) {
        // A Long Night interlude every third land: the first unseen one this deep, else nothing new to say.
        const pick = NIGHT_POOL.find(k => !META.story[k] && BEATS[k].min <= d);
        if (pick) { this.play(pick); META.night++; }
      }
    }
  },
  ending() { this.play('ending'); },
};
