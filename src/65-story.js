// The story of Lanternhold: the Hollowing (a creeping dark that wakes the dead), the Lanternkeeper who re-lights the
// beacons, and the ghost of the old keeper who guides them. Beats are short (two or three lines), pause the game while
// they show, and are shown once per keeper (META.story); the Codex replays them.
//
// Hooks: STORY.play(id) queues a beat; STORY.landStart() (from metaLandStart) queues the land's beat; STORY.ending()
// plays after the sixth land; boss lines play a moment after a boss enters (STORY.update watches G.mons).
// State for other code: STORY.cur is the beat on screen (or null); G.paused is held while it shows.
// Sounds (Echo): 'storyOpen' when a beat opens, 'storyLine' on each new line.

const SPEAKERS = {
  keeper: { name: 'Laternahoidja', col: '#ffd9a8' },
  ghost: { name: 'Vana hoidja Aldrik', col: '#bfe4ff' },
  hollow: { name: 'Õõnsus', col: '#c8a8ff' },
  giant: { name: 'Luuhiid', col: '#efe4cd' }, ogre: { name: 'Inimsööja', col: '#c8d890' }, jotun: { name: 'Jäähiid', col: '#9fd4ff' },
  queen: { name: 'Ämblikkuninganna', col: '#e0a0e8' }, colossus: { name: 'Magmakolossus', col: '#ffa060' }, king: { name: 'Maetud kuningas', col: '#f0d890' },
  leviathan: { name: 'Uppunud kuningas', col: '#90e8d8' }, herald: { name: 'Õõnsuse kuulutaja', col: '#e8d8a0' },
};
// Each beat: a title (for the Codex) and its lines as [speaker, text].
const BEATS = {
  intro: { title: 'Ärkamine', lines: [
    ['ghost', 'Ärka, hoidja! Õõnsus on tõusnud ja kõik majakad siit mereni on kustunud.'],
    ['ghost', 'Kuhu pimedus jõuab, seal tõusevad surnud püsti. Ainult tuli ajab nad tagasi.'],
    ['keeper', 'Siis süütan ma need uuesti. Kõik kuus.'],
  ] },
  'land:ashen': { title: 'Tuhakuru', lines: [
    ['ghost', 'Tuhakuru. Ma hoidsin seda tuld nelikümmend talve, kuni pimedus mu endaga viis.'],
    ['ghost', 'Ehita vanadele kividele. Nad mäletavad valgust.'],
  ] },
  'land:frost': { title: 'Külmakosk', lines: [
    ['keeper', 'Teel on lumi ja jäljed, mis seda kunagi ei sulata.'],
    ['ghost', 'Külmunud surnud astuvad kergelt. Tuli astub raskemalt.'],
  ] },
  'land:fen': { title: 'Udusoo', lines: [
    ['ghost', 'Udusoo. Raba hoiab kõike, mis ta uputab, ja Õõnsus annab selle kõik tagasi.'],
    ['keeper', 'Siis põletame udu vee pealt ära.'],
  ] },
  'land:ember': { title: 'Tulearm', lines: [
    ['keeper', 'Siin põleb isegi maa. Mida tahab pimedus tulega peale hakata?'],
    ['ghost', 'Kuumus ilma valguseta. Seda Õõnsus alati oligi.'],
  ] },
  'land:dunes': { title: 'Hämarkõrb', lines: [
    ['ghost', 'Hämarkõrb. Siia maeti kuningad koos oma kullaga ja nüüd tahavad nad seda tagasi.'],
    ['keeper', 'Kulla võivad nad saada. Majakat mitte.'],
  ] },
  'land:storm': { title: 'Tormineem', lines: [
    ['ghost', 'Viimane majakas seisab mere kohal. Õõnsus sai alguse selle alt.'],
    ['keeper', 'Siis seal see ka lõpeb.'],
  ] },
  'boss:giant': { title: 'Luuhiid', lines: [['giant', 'Luud mäletavad, väike leek. Luud mäletavad, kuidas nad olid pikad.']] },
  'boss:ogre': { title: 'Inimsööja', lines: [['ogre', 'Ma sõin eelmise hoidja leiva ära. Siis sõin ma eelmise hoidja.']] },
  'boss:jotun': { title: 'Jäähiid', lines: [['jotun', 'Iga tuli kustub lõpuks. Mina olen sinu tule lõpp.']] },
  'boss:queen': { title: 'Ämblikkuninganna', lines: [['queen', 'Mu lapsed on nii näljased ja sinu valgus on nii soe.']] },
  'boss:colossus': { title: 'Magmakolossus', lines: [['colossus', 'Ma olin tuli juba siis, kui teie veel ei osanud seda karta.']] },
  'boss:king': { title: 'Maetud kuningas', lines: [['king', 'Põlvita, tõrvikukandja. Surnutele tuleb andam maksta.']] },
  'boss:leviathan': { title: 'Uppunud kuningas', lines: [['leviathan', 'Meri võttis iga hoidja enne sind. Meri on kannatlik.']] },
  'boss:herald': { title: 'Õõnsuse kuulutaja', lines: [
    ['herald', 'Tasa, väike leek. Ma kannan selles puuris sadat majakat. Sinust saab sada esimene.'],
    ['ghost', 'See valgus tema laternas oli kunagi meie oma. Lõhu puur, hoidja!'],
  ] },
  // The Long Night: the first land where the Herald walks (STORY.landStart, heraldLand in 62-game.js).
  herald: { title: 'Kuulutaja', lines: [
    ['ghost', 'Täna öösel kõnnib keegi pimeduse ees. Pikk olend, kes kannab laternat, mis ei põle.'],
    ['ghost', 'See on Õõnsuse kuulutaja. Ta varastab valgust. Ära ehita oma torne tema teele liiga tihedalt.'],
    ['keeper', 'Las ta proovib minu oma varastada.'],
  ] },
  ending: { title: 'Kuus tuld', lines: [
    ['ghost', 'Kuus tuld põlevad jälle. Ma võiksin nüüd puhata, hoidja... peaaegu.'],
    ['ghost', 'Aga Õõnsusel pole põhja. Viimase majaka taga jätkub öö ja maad muudavad seal oma kuju.'],
    ['keeper', 'Siis kannan ma laterna sinna. Nii kaugele, kui tee läheb.'],
  ] },
  // The Long Night: an interlude every third land, from this pool (min: the first depth it can show at).
  'night:1': { title: 'Kaardita', min: 3, lines: [['ghost', 'Neid maid pole üheski kaardis, mida ma kunagi hoidsin. Õõnsus unistab need välja, kui sa kõnnid.'], ['keeper', 'Siis unistan ma igasse ühe tule.']] },
  'night:2': { title: 'Igavesti', min: 3, lines: [['hollow', 'Sina süütad. Mina neelan. Me võiksime seda igavesti teha, väike hoidja.'], ['keeper', 'Hea. Ma ei ole väsinud.']] },
  'night:3': { title: 'Raskus', min: 3, lines: [['keeper', 'Latern on täna raskem.'], ['ghost', 'See on valgus, mida sa kannad langenute eest. See peabki raske olema.']] },
  'night:4': { title: 'Lugemine', min: 6, lines: [['ghost', 'Kunagi lugesin ma majakaid kokku. Kuus. Nüüd ei suuda ma lugemist lõpetada.'], ['ghost', 'Iga tuli, mille sa maha jätad, lükkab pimedust sammu võrra tagasi.']] },
  'night:5': { title: 'Laternad', min: 6, lines: [['hollow', 'Iga hoidja põleb läbi. Ma olen matnud tuhat laternat.'], ['keeper', 'Siis tead sa, mis tuleb järgmisena. Veel üks.']] },
  'night:6': { title: 'Valed tähed', min: 9, lines: [['ghost', 'Sügavamal, kui ma kunagi käisin. Tähed on siin all valed.'], ['keeper', 'Tuli ei ole.']] },
  'night:7': { title: 'Vaikus', min: 9, lines: [['hollow', 'Miks võidelda ööga? Siin on nii vaikne.'], ['keeper', 'Vaikust tahavad surnud. Mina ei ole surnud.']] },
  'night:8': { title: 'Koor', min: 12, lines: [['ghost', 'Ma kuulen siin all tuules vanu hoidjaid. Ma arvan, et nad hõiskavad.'], ['keeper', 'Las hõiskavad. Ma kõnnin edasi.']] },
  'night:9': { title: 'Nimed', min: 12, lines: [['hollow', 'Ma tean su nime, hoidja. Ma õppisin selle neilt, kes tulid enne sind.'], ['keeper', 'Siis ütle seda valjemini. See hoiab mind soojas.']] },
  'night:10': { title: 'Tuhk ja õli', min: 15, lines: [['keeper', 'Õli saab otsa. Latern põleb ikkagi.'], ['ghost', 'See pole kunagi õliga põlenud. See põleb jonniga. Ja sinu jonnil pole põhja.']] },
  'night:11': { title: 'Uks', min: 15, lines: [['hollow', 'Öö põhjas on uks. Kas tahaksid näha, mis selle taga on?'], ['ghost', 'Ära vasta, hoidja. Siin all avanevad uksed ainult ühte pidi.']] },
  'night:12': { title: 'Hommik', min: 18, lines: [['keeper', 'Aldrik. Kas kusagil kõige selle taga on hommik?'], ['ghost', 'Üks on sinu selja taga. Iga maa, mille sa süütasid, on väike koit.']] },
  'night:13': { title: 'Väsinud', min: 21, lines: [['hollow', 'Ma olen nii väsinud, väike hoidja. Miks sa ei lase mul puhata?'], ['keeper', 'Sa puhkad teiste peal. Otsi endale pehmem voodi.']] },
  'night:14': { title: 'Põhi', min: 24, lines: [['ghost', 'Ma arvan, et oleme nüüd põhjast möödas. Pimedus on siin lihtsalt... õhem.'], ['keeper', 'Õhuke pimedus põleb kiiresti. Hoia valgust kõrgel.']] },
  // More campaign beats.
  'clear:first': { title: 'Esimene valgus', lines: [
    ['ghost', 'Vaata, kuidas see põleb! Nelikümmend talve vaatasin ma seda tuld ega näinud seda kunagi nii eredana.'],
    ['keeper', 'Üks tehtud. Tee läheb edasi.'],
  ] },
  halfway: { title: 'Poolel teel', lines: [
    ['hollow', 'Kolm väikest tuld. Kas sa arvad, et ma ei näe neid, hoidja?'],
    ['ghost', 'See räägib. Hea. See tähendab, et sa teed talle haiget.'],
    ['keeper', 'Siis teen ma talle veel kolm korda haiget.'],
  ] },
  return: { title: 'Jälle', lines: [
    ['ghost', 'Tagasi Tuhakurule? Tuled, mis sa süütasid, on jälle kustunud.'],
    ['keeper', 'Õõnsus tuleb alati tagasi. Mina ka.'],
  ] },
  heat: { title: 'Kuumus', lines: [
    ['ghost', 'Pimedusel on pärast su viimast retke hambad kasvanud. Kas sa tunned seda?'],
    ['keeper', 'Ma ise palusin seda. Tuli vajab midagi, mida põletada.'],
  ] },
  'night:enter': { title: 'Otse pimedusse', lines: [
    ['ghost', 'Juba kuuendast majakast möödas? Enamik hoidjaid käib enne vana teed.'],
    ['keeper', 'Vana tee on valgustatud. Pimedus on siin all.'],
  ] },
  daily: { title: 'Tänane tee', lines: [
    ['ghost', 'Täna kõnnib iga hoidja sama ööd. Samad maad, samad needused.'],
    ['keeper', 'Vaatame siis, kes kannab valguse kõige kaugemale.'],
  ] },
};
const NIGHT_POOL = Object.keys(BEATS).filter(k => /^night:\d+$/.test(k));
const BEAT_ORDER = ['intro', 'land:ashen', 'boss:giant', 'clear:first', 'land:frost', 'boss:jotun', 'land:fen', 'boss:queen', 'halfway', 'land:ember', 'boss:colossus', 'land:dunes', 'boss:king', 'land:storm', 'boss:leviathan', 'ending', 'herald', 'boss:herald', 'boss:ogre', 'return', 'heat', 'night:enter', 'daily'].concat(NIGHT_POOL);

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
  herald: [
    '.....oooooo.....',
    '....okkkkkko....',
    '...okkKKKKkko...',
    '..okkKooooKkko..',
    '..okKoKKKKoKko..',
    '..okKoYKKYoKko..',
    '..okKoKKKKoKko..',
    '..okkKoKKoKkko..',
    '.okkkKKooKKkkko.',
    '.okSkkKKKKkkSko.',
    'okSSkkkKKkkkSSko',
    'okSoGGokkkkkSSko',
    'oSSoYEoSkkkSSSSo',
    'oSSoGGoSSkSSSSSo',
    'oSSSooSSSSSSSSSo',
    'oooooooooooooooo',
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
      // Ash's boss intro card (UI.bossCard, about 2.5 s) shows first; the line follows it.
      m._lineT = (m._lineT || 0) + dt; if (m._lineT > (typeof UI.bossCard === 'function' ? 3.1 : 1.3)) { m._lined = true; this.play('boss:' + m.type); }
    }
    // Nothing on screen: open the next beat, unless a menu screen is up.
    // Never over a cinematic (Ash's CINE).
    const cine = typeof CINE !== 'undefined' && CINE && typeof CINE.on === 'function' && CINE.on();
    if (this.queue.length && !cine && ((!UI.scr && !UI.sets) || this.queue[0].replay)) this.open(this.queue.shift());
  },
  landStart(restoring) {
    if (restoring || !inRun()) return;
    if (G.level < CAMPAIGN_LANDS) this.play('land:' + G.B.bio.key);
    else {
      if (heraldLand()) this.play('herald'); // once per keeper, the first land the Herald walks
      const d = nightDepth(), first = META.run && META.run.level0 === G.level;
      if (first && G.mode === 'daily') this.play('daily');
      else if (first && G.mode === 'night') this.play('night:enter');
      else if (G.mode === 'daily') return; // the daily keeps its interludes short: only the first
      if (d > 0 && d % 3 === 0) {
        // A Long Night interlude every third land: the first unseen one this deep, else nothing new to say.
        const pick = NIGHT_POOL.find(k => !META.story[k] && BEATS[k].min <= d);
        if (pick) { this.play(pick); META.night++; }
      }
    }
  },
  ending(onDone) { return this.play('ending', { onDone }); },
  // A land cleared: the first beacon re-lit, and the halfway mark of the campaign.
  landClear() {
    if (G.mode !== 'campaign') return;
    if (G.level === 0) this.play('clear:first'); else if (G.level === 2) this.play('halfway');
  },
  // A run's opening beat: the intro the first time, then a word on a return, or on the first run with Heat.
  runStart() {
    if (G.mode !== 'campaign') return;
    if (!META.story.intro) this.play('intro');
    else if (G.heat > 0 && !META.story.heat) this.play('heat');
    else if (META.stats.campaigns > 0) this.play('return');
  },
};
