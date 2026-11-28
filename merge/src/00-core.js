// Saarepagar core (Mira): utilities, seeded random, easing, URL flags, global state S, save and load.
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const now = () => Date.now();
const QS = (() => { const o = {}; try { new URLSearchParams(location.search).forEach((v, k) => { o[k] = v; }); } catch (e) {} return o; })();

function mulberry(seed) {
  return function () {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let rnd = mulberry(QS.seed ? (+QS.seed | 0) : ((Date.now() ^ 0x5eed1234) >>> 0));
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
function wpick(list, wf) {
  let tot = 0; for (const x of list) tot += wf(x);
  let r = rnd() * tot; for (const x of list) { r -= wf(x); if (r <= 0) return x; }
  return list[list.length - 1];
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outElastic: t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
};

function dayKey(ts) { const d = new Date(ts || now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function fmtTime(ms) { const s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ':' + String(s % 60).padStart(2, '0'); }
function fmtNum(n) { n = Math.floor(n); return n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.', ',') + ' k' : String(n); }

// Board geometry
const COLS = 7, ROWS = 9, NCELL = COLS * ROWS;
const MAXEN = 100, EN_MS = 60000;  // +1 energy every minute (generous)
const FREE_EN = 30, FREE_EN_MS = 4 * 3600000;  // free energy every 4 hours

// Global state. Keys starting with "_" are view-only and never saved.
let S = null;
const SAVE_KEY = 'saarepagar.save', SAVE_VER = 2;

function newState() {
  const t = now();
  return {
    v: SAVE_VER, created: t, saved: t,
    board: new Array(NCELL).fill(null), unl: 0,
    en: MAXEN, enT: t, coins: 40, stars: 0, xp: 0, lvl: 1,
    orders: [], oseq: 0, nextOrderAt: 0, ordersDone: 0,
    done: {}, area: 0, areaSeen: {}, ended: false,
    bag: [], bagSlots: 4,
    disc: {}, gensOwned: {},
    album: {}, albumDone: {}, event: { id: '', pts: 0, got: 0 }, freeEnAt: 0,
    tut: 0, title: true,
    daily: { day: '', gift: false, streak: 0, lastGift: '', tasks: [], bonus: false },
    stats: { merges: 0, orders: 0, taps: 0, tasks: 0, lucky: 0, merge5: 0, combo: 0, mbox: 0 },
    set: { music: 0.7, sfx: 0.9, muted: false },
  };
}

let saveTimer = 0;
function save() {
  if (!S || QS.nosave) return;
  try { S.saved = now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S, (k, v) => k[0] === '_' ? undefined : v)); } catch (e) {}
}
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 250); }
function load() {
  try {
    if (QS.fresh) { localStorage.removeItem(SAVE_KEY); return null; }
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object' || !Array.isArray(d.board) || d.board.length !== NCELL) return null;
    // Fill any missing keys from a fresh state (forward-compatible saves).
    const base = newState();
    for (const k in base) if (!(k in d)) d[k] = base[k];
    for (const k in base.daily) if (!(k in d.daily)) d.daily[k] = base.daily[k];
    for (const k in base.stats) if (!(k in d.stats)) d.stats[k] = base.stats[k];
    if (!d.event || typeof d.event !== 'object') d.event = base.event;
    // v1 -> v2: the album starts empty, so earlier discoveries wait there as rewards to collect.
    d.v = SAVE_VER;
    return d;
  } catch (e) { return null; }
}
