// Saarepagar adventure levels, "Seiklus" (Mira): a deterministic level generator, the level rules, lives,
// rewards and win streaks, and two bots (a careful one that calibrates each level's move limit and a sloppier
// "sampler" that QA uses to measure win rates). Rules never draw: a run reports through run.on(kind, cell, data).
//
// A level is a small board (6 x 7) with a goal and a move limit. Every merge is one move; picking items up,
// moving and swapping are free. After each merge one new item appears in an empty cell (never on sand).
// Goals: make N of an item, break the ice on N cells, open N boxes, fill N orders (orders go out by themselves).
// Obstacles: ice (merge on it), boxes (merge next to them), cobwebs (lock an item until a merge next to it),
// locked chests (drop a key of that level on them; they give +2 moves), sand (nothing appears there) and
// bubbles (they spread every second merge unless one was popped by a merge next to it).
// Difficulty comes in waves within every ten levels (breather, easy, easy, hard, breather, easy, easy, hard,
// easy, boss); every 10th level is the boss "Suur tellimus"; every 50 levels starts a new chapter.
const LV = (() => {
  const LC = 6, LR = 7, LN = LC * LR;
  const NB = [];
  for (let i = 0; i < LN; i++) { const c = i % LC, r = (i / LC) | 0, o = []; if (r > 0) o.push(i - LC); if (c > 0) o.push(i - 1); if (c < LC - 1) o.push(i + 1); if (r < LR - 1) o.push(i + LC); NB.push(o); }
  const maxL = k => CHAINS[k].names.length;
  const FIRST = { ice: 2, box: 4, order: 6, web: 8, sand: 12, crate: 15, bubble: 20 };
  // Move limit: the sampler bot (a sloppy, casual player) plays the level 16 times with no limit; the limit is the
  // move count that this share of its tries managed (plus a little), so a casual player wins about that often.
  const PCT = { easy: 0.9, breather: 0.97, hard: 0.68, boss: 0.72 };
  const EXTRA = { easy: 2, breather: 3, hard: 0, boss: 1 };
  const CAL_TRIES = 16;
  const KMUL = { easy: 1, breather: 0.75, hard: 1.15, boss: 1.25 };
  const CRATE_MOVES = 2, WHO_ORDER = ['liisa', 'muri', 'ants', 'peeter'];

  function kindOf(n) {
    const p = n % 10;
    if (p === 0) return 'boss';
    if (n <= 7) return n === 5 ? 'breather' : 'easy';
    return p === 1 || p === 5 ? 'breather' : p === 4 || p === 8 ? 'hard' : 'easy';
  }
  const chapterOf = n => Math.floor((n - 1) / 50);

  // ---------- generator ----------
  function shuffled(a, R) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const SHAPES = [
    [[0, 0], [5, 0], [0, 6], [5, 6]],
    [[0, 0], [1, 0], [4, 0], [5, 0]],
    [[0, 6], [1, 6], [4, 6], [5, 6]],
    [[2, 3], [3, 3]],
    [[0, 3], [5, 3]],
    [[0, 0], [5, 0], [0, 1], [5, 1], [0, 6], [5, 6]],
    [[2, 0], [3, 0], [2, 6], [3, 6]],
  ];
  function wpickR(list, R) { let tot = 0; for (const x of list) tot += x[1]; let r = R() * tot; for (const x of list) { r -= x[1]; if (r <= 0) return x[0]; } return list[list.length - 1][0]; }

  function build(n, R, f) {
    const kind = kindOf(n), d = Math.min(1, (n - 1) / 160), ch = chapterOf(n), km = KMUL[kind] * f;
    const pool = shuffled(CHAPTERS[ch % CHAPTERS.length].chains, R);
    if (n <= 3 && pool.includes('bread')) { pool.splice(pool.indexOf('bread'), 1); pool.unshift('bread'); } // the first levels start with buns, like the café
    let nch = n <= 2 ? 1 : n <= 9 ? 2 : 2 + (R() < 0.3 + d * 0.45 ? 1 : 0) + (kind === 'hard' && d > 0.3 && R() < 0.45 ? 1 : 0);
    if (kind === 'breather') nch = Math.min(nch, 2);
    if (kind === 'boss') nch = Math.max(2, Math.min(nch, 3));
    const chains = pool.slice(0, clamp(nch, 1, 4));
    const vd = new Array(LN).fill(false);
    if (n >= 11 && R() < 0.45) { const sh = SHAPES[Math.floor(R() * SHAPES.length)]; for (const [c, r] of sh) vd[r * LC + c] = true; }
    // goals
    const can = ['make']; for (const k of ['ice', 'box', 'order']) if (n >= FIRST[k]) can.push(k);
    let main;
    if (n === FIRST.ice) main = 'ice'; else if (n === FIRST.box) main = 'box'; else if (n === FIRST.order) main = 'order';
    else if (kind === 'boss') main = 'order';
    else if (n <= 3) main = 'make';
    else main = can[Math.floor(R() * can.length)];
    const types = [main];
    if (n >= 25 && kind !== 'breather' && R() < 0.22 + d * 0.25) { const o = can.filter(t => t !== main && !(t === 'order' && main === 'make') && !(t === 'make' && main === 'order')); if (o.length) types.push(o[Math.floor(R() * o.length)]); }
    // extra obstacles
    const obs = {};
    let nObs = 0; const maxObs = kind === 'breather' ? 1 : 2;
    for (const k of ['web', 'sand', 'crate', 'bubble']) {
      if (n < FIRST[k]) continue;
      if (n === FIRST[k] || (nObs < maxObs && R() < 0.22 + d * 0.18)) { obs[k] = true; nObs++; }
    }
    const def = { n, kind, chapter: ch, chains, vd, goals: [], items: new Array(LN).fill(null), ice: new Array(LN).fill(0), box: new Array(LN).fill(0), boxItem: new Array(LN).fill(null), web: new Array(LN).fill(false), crate: new Array(LN).fill(0), sand: new Array(LN).fill(false), bub: new Array(LN).fill(false), orders: [], obs: Object.keys(obs), spawn: [] };
    let free = shuffled([...Array(LN).keys()].filter(i => !vd[i]), R);
    const take = (cnt, ok) => { const out = []; for (let j = 0; j < free.length && out.length < cnt; j++) if (!ok || ok(free[j])) { out.push(free[j]); } for (const i of out) free.splice(free.indexOf(i), 1); return out; };
    const sc = (v, lo, hi) => clamp(Math.round(v), lo, hi);
    let makeCap = {};
    for (const t of types) {
      if (t === 'make') {
        const k = chains[0];
        let tl = n <= 2 ? 3 : 3 + (d > 0.12 ? 1 : 0) + (kind === 'hard' && d > 0.5 && R() < 0.5 ? 1 : 0);
        tl = Math.min(tl, maxL(k) - 1);
        const cnt = n <= 2 ? 2 : sc((2.5 + d * 2.5) * km / (tl >= 5 ? 1.8 : 1), 1, 7);
        def.goals.push({ type: 'make', k, l: tl, n: cnt }); makeCap[k] = tl - 1;
      } else if (t === 'ice') {
        def.goals.push({ type: 'ice', n: 0, layers: n >= 18 ? 0.2 + d * 0.3 : 0, want: sc((7 + d * 12) * km, 4, 24) });
      } else if (t === 'box') {
        def.goals.push({ type: 'box', n: 0, hp2: n >= 25 ? 0.18 + d * 0.3 : 0, want: sc((5 + d * 7) * km, 3, 14) });
      } else if (t === 'order') {
        const boss = kind === 'boss';
        const cnt = boss ? sc((3 + d * 2) * f, 2, 6) : sc((3 + d * 3) * km, 2, 8);
        const hiL = boss ? 3 + (d > 0.25 ? 1 : 0) : 2 + (d > 0.2 ? 1 : 0) + (d > 0.7 && R() < 0.4 ? 1 : 0);
        for (let j = 0; j < cnt; j++) {
          const ni = boss ? (R() < 0.5 ? 2 : 3) : (R() < 0.6 ? 1 : 2), items = [];
          for (let q = 0; q < ni; q++) { const k = chains[Math.floor(R() * chains.length)]; const l = Math.max(2, hiL - Math.floor(R() * (boss ? 2 : 2))); items.push([k, Math.min(l, maxL(k) - 1)]); }
          items.sort((a, b) => b[1] - a[1]);
          def.orders.push({ who: WHO_ORDER[Math.floor(R() * WHO_ORDER.length)], items });
        }
        def.goals.push({ type: 'order', n: cnt });
      }
    }
    // blockers first (boxes, locked chests, bubbles), then items, then ice, cobwebs and sand
    for (const g of def.goals) if (g.type === 'box') {
      for (const i of take(g.want)) { def.box[i] = R() < g.hp2 ? 2 : 1; if (R() < 0.4) def.boxItem[i] = { k: chains[Math.floor(R() * chains.length)], l: 2 }; }
      g.n = def.box.filter(x => x > 0).length; delete g.want; delete g.hp2;
    }
    let keyUnits = 0;
    if (obs.crate) {
      const cnt = 1 + (d > 0.4 ? 1 : 0) + (R() < 0.3 ? 1 : 0);
      for (const i of take(cnt)) { const lv = n >= 30 && R() < 0.5 ? 2 : 1; def.crate[i] = lv; keyUnits += lv === 2 ? 2 : 1; }
    }
    if (obs.bubble) for (const i of take(2 + Math.round(d * 2))) def.bub[i] = true;
    const spawnW = chains.map((k, j) => [k, (def.goals.some(g => g.type === 'make' && g.k === k) ? 2.2 : 1) + (j === 0 && kind === 'boss' ? 0.3 : 0)]);
    def.spawn = spawnW;
    const nItems = Math.round(free.length * (0.56 + R() * 0.1));
    const itemCells = take(nItems);
    for (const i of itemCells) {
      const k = wpickR(spawnW, R), r = R();
      let l = r < 0.6 ? 1 : r < 0.9 ? 2 : 3;
      if (makeCap[k] || def.orders.length) l = r < 0.85 ? 1 : 2;
      def.items[i] = { k, l };
    }
    // keys (the exact units needed plus one spare) go into empty cells, or replace items if the board is full
    for (let j = 0; j < keyUnits + (keyUnits ? 1 : 0); j++) {
      const e = take(1)[0]; const at = e !== undefined ? e : itemCells.find(i => def.items[i] && def.items[i].k !== 'key');
      if (at !== undefined) def.items[at] = { k: 'key', l: 1 };
    }
    for (const g of def.goals) if (g.type === 'ice') {
      const cells = shuffled([...Array(LN).keys()].filter(i => !vd[i] && !def.box[i] && !def.crate[i] && !def.bub[i]), R).slice(0, g.want);
      for (const i of cells) def.ice[i] = R() < g.layers ? 2 : 1;
      g.n = cells.length; delete g.want; delete g.layers;
    }
    if (obs.web) {
      const cand = shuffled([...Array(LN).keys()].filter(i => def.items[i] && def.items[i].k !== 'key'), R);
      for (const i of cand.slice(0, 2 + Math.round(d * 4))) def.web[i] = true;
    }
    if (obs.sand) {
      const cand = shuffled([...Array(LN).keys()].filter(i => !vd[i] && !def.box[i] && !def.crate[i] && !def.bub[i] && !def.ice[i]), R);
      for (const i of cand.slice(0, 3 + Math.round(d * 5))) def.sand[i] = true;
    }
    return def;
  }

  // Each level is calibrated once: the careful bot plays it with three spawn sequences; the median number of
  // merges it needed, times the slack for the level's kind, is the move limit. Stars: 3 when you need about
  // as few moves as the careful bot, 2 a bit more, 1 for any win.
  const cache = new Map();
  function gen(n) {
    n = Math.max(1, n | 0);
    if (cache.has(n)) return cache.get(n);
    // Aim the careful bot's median at a band that grows with the level number (short early levels, longer later).
    const kind = kindOf(n), lo = kind === 'boss' ? Math.min(28, 14 + n * 0.1) : n <= 3 ? 5 : Math.min(22, 7 + n * 0.1) * (kind === 'breather' ? 0.75 : 1);
    const hi = kind === 'boss' ? lo + 22 : lo + (n <= 3 ? 6 : 14);
    let def = null, best = null, f = 1;
    for (let attempt = 0; attempt < 8; attempt++) {
      const R = mulberry(hashStr('saarepagar-level-' + n + '-' + attempt));
      const d = build(n, R, f);
      const res = [];
      for (let s = 0; s < 3; s++) { const r = newRun(d, hashStr('cal' + n + ':' + s), 200); play(r, 'careful', null); res.push(r.won ? r.used : 1e9); }
      res.sort((a, b) => a - b);
      const need = res[1];
      if (need >= 1e9) { f *= 0.75; continue; }
      const miss = need < lo ? lo - need : need > hi ? need - hi : 0;
      if (!best || miss < best.miss) best = { d, need, miss };
      if (!miss) break;
      f *= need < lo ? Math.min(2, Math.max(1.15, lo / Math.max(1, need))) : 0.78;
    }
    if (best) {
      const d = best.d, need = best.need;
      d.need = need;
      const us = [];
      for (let s = 0; s < CAL_TRIES; s++) { const r = newRun(d, hashStr('samp' + n + ':' + s), 300); play(r, 'sampler', mulberry(hashStr('sbot' + n + ':' + s))); us.push(r.won ? r.used : 999); }
      us.sort((a, b) => a - b);
      const pct = us[Math.min(CAL_TRIES - 1, Math.ceil(PCT[d.kind] * CAL_TRIES) - 1)];
      d.moves = Math.max(8, need + 2, Math.min(pct, Math.ceil(need * 2.2)) + EXTRA[d.kind] + (n <= 10 ? 2 : 0));
      d.s3 = Math.ceil(need * 1.08);
      d.s2 = Math.ceil(need + (d.moves - need) * 0.5);
      d.seed = hashStr('saarepagar-play-' + n);
      def = d;
    }
    if (!def) { // fallback: a simple, always solvable make level
      const R = mulberry(n);
      def = build(Math.min(n, 3), R, 1); def.n = n; def.kind = kindOf(n); def.chapter = chapterOf(n);
      def.need = 12; def.moves = 22; def.s3 = 14; def.s2 = 18; def.seed = n;
    }
    if (cache.size > 80) cache.delete(cache.keys().next().value);
    cache.set(n, def);
    return def;
  }

  // ---------- one try at a level ----------
  function newRun(def, seed, moves) {
    const r = {
      def, n: def.n, it: def.items.map(x => x ? { k: x.k, l: x.l } : null), ice: def.ice.slice(), box: def.box.slice(), web: def.web.slice(),
      crate: def.crate.slice(), sand: def.sand, bub: def.bub.slice(), vd: def.vd, moves: moves || def.moves, used: 0,
      goals: def.goals.map(g => Object.assign({}, g, { got: 0 })), orders: [], oq: 0, R: mulberry(seed >>> 0), bubT: 0, popped: false,
      over: false, won: false, on: null, priceIx: 0, streakBonus: 0,
    };
    if (def.orders.length) { while (r.orders.length < 2 && r.oq < def.orders.length) r.orders.push(def.orders[r.oq++]); }
    fixPairs(r);
    return r;
  }
  const emit = (r, kind, cell, d) => { if (r.on) { try { r.on(kind, cell, d || {}); } catch (e) { console.error(e); } } };
  const blocked = (r, i) => r.vd[i] || r.box[i] > 0 || r.crate[i] > 0 || r.bub[i];
  const pickable = (r, i) => i >= 0 && i < LN && !!r.it[i] && !r.web[i] && !r.vd[i];
  const canMergeIt = (A, B) => !!(A && B && A.k === B.k && A.l === B.l && A.l < maxL(A.k));

  function canDrop(r, a, b) {
    if (r.over || a === b || !pickable(r, a) || b < 0 || b >= LN || r.vd[b]) return null;
    const A = r.it[a];
    if (r.crate[b] > 0) return A.k === 'key' && A.l >= r.crate[b] ? 'crate' : null;
    if (r.box[b] > 0 || r.bub[b]) return null;
    const B = r.it[b];
    if (!B) return 'move';
    if (r.web[b]) return null;
    return canMergeIt(A, B) ? 'merge' : 'swap';
  }
  function drop(r, a, b) {
    const k = canDrop(r, a, b); if (!k) return null;
    if (k === 'move') { r.it[b] = r.it[a]; r.it[a] = null; emit(r, 'move', b, { from: a }); }
    else if (k === 'swap') { const t = r.it[a]; r.it[a] = r.it[b]; r.it[b] = t; emit(r, 'swap', b, { from: a }); }
    else if (k === 'crate') { const A = r.it[a]; r.it[a] = null; r.crate[b] = 0; r.moves += CRATE_MOVES; emit(r, 'crate', b, { from: a, k: A.k, l: A.l, moves: CRATE_MOVES }); after(r, false); }
    else merge(r, a, b);
    return k;
  }
  function merge(r, a, b) {
    const A = r.it[a], res = { k: A.k, l: A.l + 1 };
    r.it[a] = null; r.it[b] = res; r.moves--; r.used++; r.popped = false;
    emit(r, 'merge', b, { from: a, k: res.k, l: res.l });
    landed(r, b);
    after(r, true);
  }
  function goal(r, type, cell, extra) {
    const g = r.goals.find(x => x.type === type && x.got < x.n); if (!g) return;
    g.got++; emit(r, 'goal', cell, Object.assign({ gi: r.goals.indexOf(g), type }, extra || {}));
  }
  // A merge (or the magic wand) finished at cell b: crack the ice under it, hit what is next to it, collect goal items.
  function landed(r, b) {
    if (r.ice[b] > 0) { r.ice[b]--; emit(r, 'ice', b, { left: r.ice[b] }); if (!r.ice[b]) goal(r, 'ice', b); }
    for (const j of NB[b]) {
      if (r.box[j] > 0) {
        r.box[j]--; emit(r, 'box', j, { left: r.box[j] });
        if (!r.box[j]) { goal(r, 'box', j); const bi = r.def.boxItem[j]; if (bi && !r.it[j]) { r.it[j] = { k: bi.k, l: bi.l }; emit(r, 'reveal', j, { k: bi.k, l: bi.l }); } }
      }
      if (r.web[j]) { r.web[j] = false; emit(r, 'web', j, {}); }
      if (r.bub[j]) { r.bub[j] = false; r.popped = true; emit(r, 'bubble', j, {}); }
    }
    const res = r.it[b];
    if (res) for (const g of r.goals) if (g.type === 'make' && g.got < g.n && res.k === g.k && res.l === g.l) { r.it[b] = null; goal(r, 'make', b, { k: res.k, l: res.l }); break; }
  }
  function findItems(r, items) {
    const used = [];
    for (const [k, l] of items) {
      let at = -1;
      for (let i = 0; i < LN; i++) if (pickable(r, i) && r.it[i].k === k && r.it[i].l === l && !used.includes(i)) { at = i; break; }
      if (at < 0) return null; used.push(at);
    }
    return used;
  }
  function checkOrders(r) {
    let any = false;
    for (let oi = 0; oi < r.orders.length; oi++) {
      const o = r.orders[oi]; if (!o) continue;
      const cells = findItems(r, o.items); if (!cells) continue;
      const taken = cells.map(c => r.it[c]);
      cells.forEach(c => { r.it[c] = null; });
      goal(r, 'order', -1);
      emit(r, 'order', -1, { oi, o, cells, taken });
      r.orders[oi] = r.oq < r.def.orders.length ? r.def.orders[r.oq++] : null; any = true;
    }
    if (any) r.orders = r.orders.filter(Boolean);
  }
  function spawn(r) {
    const cand = []; for (let i = 0; i < LN; i++) if (!blocked(r, i) && !r.it[i] && !r.sand[i]) cand.push(i);
    if (!cand.length) return;
    const i = cand[Math.floor(r.R() * cand.length)], k = wpickR(r.def.spawn, r.R);
    let l = r.R() < 0.12 ? 2 : 1;
    for (const g of r.goals) if (g.type === 'make' && g.k === k) l = Math.min(l, g.l - 1);
    r.it[i] = { k, l }; emit(r, 'spawn', i, { k, l });
  }
  function spread(r) {
    if (!r.bub.some(Boolean)) return;
    if (r.popped) { r.bubT = 0; return; }
    if (++r.bubT < 2) return;
    const cand = [];
    for (let i = 0; i < LN; i++) if (r.bub[i]) for (const j of NB[i]) if (!blocked(r, j) && !r.it[j] && !cand.includes(j)) cand.push(j);
    if (!cand.length) return;
    const j = cand[Math.floor(r.R() * cand.length)];
    r.bub[j] = true; r.bubT = 0; emit(r, 'spread', j, {});
  }
  function hasMove(r) {
    const seen = new Set(), crates = r.crate.filter(x => x > 0);
    for (let i = 0; i < LN; i++) {
      if (!pickable(r, i)) continue; const it = r.it[i];
      if (it.k === 'key' && crates.some(c => c <= it.l)) return true;
      if (it.l >= maxL(it.k)) continue;
      const key = it.k + ':' + it.l; if (seen.has(key)) return true; seen.add(key);
    }
    return false;
  }
  // No merge left: quietly turn one item into a twin of another (or add two new items if the board is almost empty).
  function fixPairs(r) {
    if (r.over || hasMove(r)) return;
    const loose = []; for (let i = 0; i < LN; i++) if (pickable(r, i) && r.it[i].k !== 'key' && r.it[i].l < maxL(r.it[i].k)) loose.push(i);
    if (loose.length >= 2) {
      loose.sort((a, b) => r.it[a].l - r.it[b].l);
      const a = loose[0], b = loose[1]; r.it[b] = { k: r.it[a].k, l: r.it[a].l }; emit(r, 'twin', b, { k: r.it[b].k, l: 1 });
    } else {
      const k = r.def.spawn[0][0];
      for (let q = 0; q < 2; q++) { let e = -1; for (let i = 0; i < LN; i++) if (!blocked(r, i) && !r.it[i]) { e = i; break; } if (e < 0) break; r.it[e] = { k, l: 1 }; emit(r, 'spawn', e, { k, l: 1 }); }
    }
  }
  const done = r => r.goals.every(g => g.got >= g.n);
  function after(r, moved) {
    if (moved) { spawn(r); spread(r); }
    checkOrders(r);
    if (done(r)) { r.won = true; r.over = true; emit(r, 'win', -1, {}); return; }
    fixPairs(r);
    if (r.moves <= 0) { r.over = true; emit(r, 'out', -1, {}); }
  }
  // What is still missing (for the fail screen), and a rough number of merges it would take.
  function remaining(r) {
    const out = []; let est = 0;
    for (const g of r.goals) {
      const left = g.n - g.got; if (left <= 0) continue;
      out.push({ type: g.type, k: g.k, l: g.l, left });
      if (g.type === 'make') {
        let best = 0; for (const it of r.it) if (it && it.k === g.k && it.l < g.l) best = Math.max(best, it.l);
        est += Math.max(1, (left - 1) * ((1 << (g.l - 1)) - 1) + (g.l - (best || 1)));
      } else if (g.type === 'order') est += left * 2;
      else if (g.type === 'ice') { let n = 0; for (let i = 0; i < LN; i++) n += r.ice[i]; est += n; }
      else est += left;
    }
    return { list: out, est };
  }
  const starsFor = r => r.used <= r.def.s3 ? 3 : r.used <= r.def.s2 ? 2 : 1;

  // ---------- boosters ----------
  function nearestFree(r, from) {
    let best = -1, bd = 1e9; const fc = from % LC, fr = (from / LC) | 0;
    for (let i = 0; i < LN; i++) if (!blocked(r, i) && !r.it[i]) { const dd = (i % LC - fc) ** 2 + (((i / LC) | 0) - fr) ** 2; if (dd < bd) { bd = dd; best = i; } }
    return best;
  }
  // Can booster `kind` be used on cell (or at all, for shuffle and moves)? Returns a reason string when not.
  function boostCheck(r, kind, cell) {
    if (kind === 'moves') return r.won ? 'done' : '';
    if (r.over) return 'done';
    if (kind === 'shuffle') return singles(r).length >= 2 ? '' : 'none';
    const it = r.it[cell]; if (!it || r.vd[cell]) return 'empty';
    if (kind === 'wand') return it.l >= maxL(it.k) ? 'max' : '';
    if (kind === 'scissors') return r.web[cell] ? 'web' : it.l < 2 ? 'small' : nearestFree(r, cell) < 0 ? 'full' : '';
    return 'bad';
  }
  function singles(r) {
    const by = {}; for (let i = 0; i < LN; i++) if (pickable(r, i) && r.it[i].k !== 'key' && r.it[i].l < maxL(r.it[i].k)) { const key = r.it[i].k + ':' + r.it[i].l; (by[key] = by[key] || []).push(i); }
    return Object.values(by).filter(x => x.length === 1).map(x => x[0]);
  }
  function useBoost(r, kind, cell) {
    if (boostCheck(r, kind, cell)) return false;
    if (kind === 'moves') { r.moves += 5; r.over = false; emit(r, 'boost', -1, { kind }); return true; }
    if (kind === 'shuffle') {
      const s = singles(r).sort((a, b) => r.it[b].l - r.it[a].l), cells = [];
      for (let j = 0; j + 1 < s.length; j += 2) { const a = s[j], b = s[j + 1]; r.it[b] = { k: r.it[a].k, l: r.it[a].l }; cells.push(b); }
      emit(r, 'boost', -1, { kind, cells }); after(r, false); return true;
    }
    if (kind === 'wand') {
      const it = r.it[cell]; r.it[cell] = { k: it.k, l: it.l + 1 };
      emit(r, 'boost', cell, { kind, k: it.k, l: it.l + 1 }); landed(r, cell); after(r, false); return true;
    }
    if (kind === 'scissors') {
      const it = r.it[cell], e = nearestFree(r, cell);
      r.it[cell] = { k: it.k, l: it.l - 1 }; r.it[e] = { k: it.k, l: it.l - 1 };
      emit(r, 'boost', cell, { kind, to: e, k: it.k, l: it.l - 1 }); after(r, false); return true;
    }
    return false;
  }

  // ---------- bots ----------
  // Candidate merges: for every pair of equal items, the best cell to finish the merge on (moving is free, so a
  // merge can end on any open cell). Each candidate gets a score from the goals; the careful bot takes the best.
  function goalOn(r, type) { return r.goals.some(g => g.type === type && g.got < g.n); }
  function value(r, A, res, cnt) {
    let v = 1 - res.l * 0.1;
    for (const g of r.goals) {
      if (g.got >= g.n) continue;
      if (g.type === 'make' && res.k === g.k) v += res.l === g.l ? 100 : res.l < g.l ? 8 + res.l * 4 : 0;
    }
    if (r.orders.length) {
      const need = {}; for (const o of r.orders) for (const [k, l] of o.items) need[k + ':' + l] = (need[k + ':' + l] || 0) + 1;
      const have = {}; for (let i = 0; i < LN; i++) if (pickable(r, i)) { const key = r.it[i].k + ':' + r.it[i].l; have[key] = (have[key] || 0) + 1; }
      const rk = res.k + ':' + res.l, ak = A.k + ':' + A.l;
      if ((need[rk] || 0) > (have[rk] || 0)) v += 80;
      else for (const key in need) { const [k, l] = key.split(':'); if (k === res.k && +l > res.l && need[key] > (have[key] || 0)) { v += 6 + res.l * 4; break; } }
      if (need[ak] && cnt - 2 < need[ak]) v -= 60;
    }
    if (A.k === 'key') v += r.crate.some(c => c > A.l) ? 20 : -0.5;
    return v;
  }
  function cellScore(r, c, ice, box) {
    let s = 0;
    if (ice && r.ice[c] > 0) s += 30;
    for (const j of NB[c]) {
      if (r.box[j] > 0) s += box ? 25 : 2;
      if (r.web[j]) s += 10;
      if (r.bub[j]) s += 16;
    }
    return s;
  }
  function candidates(r) {
    const groups = new Map();
    for (let i = 0; i < LN; i++) { if (!pickable(r, i)) continue; const it = r.it[i]; if (it.l >= maxL(it.k)) continue; const key = it.k + ':' + it.l; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(i); }
    const ice = goalOn(r, 'ice'), box = goalOn(r, 'box'), out = [];
    let cellBest = -1, cellBestS = -1;
    const cs = new Array(LN);
    for (let c = 0; c < LN; c++) { cs[c] = blocked(r, c) || (r.it[c] && r.web[c]) ? -1 : cellScore(r, c, ice, box); if (cs[c] > cellBestS) { cellBestS = cs[c]; cellBest = c; } }
    for (const [, g] of groups) {
      if (g.length < 2) continue;
      const A = r.it[g[0]], res = { k: A.k, l: A.l + 1 }, v = value(r, A, res, g.length);
      out.push({ a: g[0], b: g[1], c: cellBest, s: v + cellBestS, natural: v + Math.max(cs[g[1]], 0) });
    }
    return out;
  }
  function exec(r, a, b, c) {
    if (c === a) { const t = a; a = b; b = t; }
    if (c !== b) {
      const C = r.it[c];
      if (C && canMergeIt(C, r.it[a])) return drop(r, a, c);
      drop(r, b, c);
    }
    return drop(r, a, c);
  }
  // mode 'careful': always the best candidate. 'sampler': like a casual player: 30% of the time a random merge
  // where the items already are, otherwise one of the good ones (softmax), and it opens chests when it can.
  function botStep(r, mode, R) {
    if (r.over) return false;
    for (let i = 0; i < LN; i++) if (r.crate[i] > 0) for (let j = 0; j < LN; j++) if (pickable(r, j) && r.it[j].k === 'key' && r.it[j].l >= r.crate[i]) { drop(r, j, i); return true; }
    const cand = candidates(r);
    if (!cand.length) return false;
    let pickC;
    if (mode === 'careful') { pickC = cand[0]; for (const x of cand) if (x.s > pickC.s) pickC = x; return !!exec(r, pickC.a, pickC.b, pickC.c); }
    if (R() < 0.2) { const x = cand[Math.floor(R() * cand.length)]; return !!exec(r, x.a, x.b, x.b); }
    let mx = -1e9; for (const x of cand) mx = Math.max(mx, x.s);
    let tot = 0; const w = cand.map(x => { const v = Math.exp((x.s - mx) / 14); tot += v; return v; });
    let q = R() * tot, j = 0; for (; j < cand.length - 1; j++) { q -= w[j]; if (q <= 0) break; }
    const x = cand[j]; return !!exec(r, x.a, x.b, R() < 0.8 ? x.c : x.b);
  }
  function play(r, mode, R) { let n = 0; while (!r.over && n++ < 600) if (!botStep(r, mode, R)) break; return r; }
  // Win rates of the sampler bot over a range of levels (QA): { rows: [{n, kind, moves, need, win}], byKind }.
  function botTest(from, to, tries) {
    tries = tries || 10; const rows = [], byKind = {};
    for (let n = from; n <= to; n++) {
      const def = gen(n); let w = 0;
      for (let t = 0; t < tries; t++) { const r = newRun(def, hashStr('try' + n + ':' + t)); play(r, 'sampler', mulberry(hashStr('bot' + n + ':' + t))); if (r.won) w++; }
      rows.push({ n, kind: def.kind, moves: def.moves, need: def.need, win: w / tries, goals: def.goals.map(g => g.type).join('+'), obs: def.obs.join('+') });
      const b = byKind[def.kind] = byKind[def.kind] || { n: 0, win: 0, min: 1 }; b.n++; b.win += w / tries; b.min = Math.min(b.min, w / tries);
    }
    for (const k in byKind) byKind[k].win = Math.round(byKind[k].win / byKind[k].n * 1000) / 1000;
    return { rows, byKind };
  }

  // ---------- meta: lives, starting, winning and losing, boosters ----------
  function tickHearts() {
    const A = S.adv, t = now();
    if (A.hearts >= HEART_MAX) { A.heartT = t; return; }
    const k = Math.floor((t - A.heartT) / HEART_MS);
    if (k > 0) { A.hearts = Math.min(HEART_MAX, A.hearts + k); A.heartT += k * HEART_MS; if (A.hearts >= HEART_MAX) A.heartT = t; }
  }
  const heartNext = () => S.adv.hearts >= HEART_MAX ? 0 : HEART_MS - (now() - S.adv.heartT);
  function loseHeart() { tickHearts(); if (S.adv.hearts >= HEART_MAX) S.adv.heartT = now(); S.adv.hearts = Math.max(0, S.adv.hearts - 1); }
  function refillHearts() {
    tickHearts(); if (S.adv.hearts >= HEART_MAX) return false;
    if (S.coins < HEART_REFILL_PRICE) return false;
    S.coins -= HEART_REFILL_PRICE; S.adv.hearts = HEART_MAX; S.adv.heartT = now(); saveSoon(); return true;
  }
  let cur = null;
  function start(n) {
    tickHearts();
    n = n || S.adv.top;
    if (n < 1 || n > S.adv.top || S.adv.hearts <= 0) return null;
    const def = gen(n);
    S.adv.plays++;
    cur = newRun(def, (def.seed ^ Math.imul(S.adv.plays, 2654435761)) >>> 0);
    cur.streakBonus = Math.min(3, S.adv.streak); cur.moves += cur.streakBonus;
    saveSoon();
    return cur;
  }
  function winReward(r, first, stars) {
    const n = r.n, rew = {};
    if (first) {
      rew.coins = 10 + Math.min(25, Math.floor(n / 6)) + 3 * stars + Math.min(12, r.moves) + 2 * Math.min(5, S.adv.streak);
      if (n % 5 === 0) rew.spins = 1;
      if (r.def.kind === 'boss') rew.boost = BOOST_KEYS[(n / 10) % 4 | 0];
      if (n % 3 === 0) rew.energy = 10;
    } else rew.coins = 3 + stars;
    return rew;
  }
  function win() {
    const r = cur; if (!r || !r.won || r.paid) return null;
    r.paid = true;
    const n = r.n, A = S.adv, first = n === A.top, stars = starsFor(r), prev = A.stars[n] || 0;
    if (stars > prev) A.stars[n] = stars;
    if (first) A.top = n + 1;
    A.wins++; A.streak++; A.best = Math.max(A.best, A.streak);
    const rew = winReward(r, first, stars);
    Game.give(Object.assign({ silent: true }, rew));
    Game.piggyAdd(PIGGY_ADD.level);
    saveSoon();
    return { n, stars, prev, first, rew, streak: A.streak };
  }
  // Losing (or leaving after the first move) costs one life and ends the win streak.
  function lose() {
    const r = cur; if (!r || r.won) return false;
    loseHeart(); S.adv.streak = 0; cur = null; saveSoon(); return true;
  }
  function quit() {
    const r = cur; if (!r) return false;
    if (r.won) { cur = null; return true; }
    if (r.used === 0 && !r.over) { cur = null; return true; }
    return lose();
  }
  const movesPrice = () => MORE_MOVES_PRICE[Math.min(MORE_MOVES_PRICE.length - 1, cur ? cur.priceIx : 0)];
  function buyMoves() {
    const r = cur; if (!r || r.won) return false;
    const p = movesPrice(); if (S.coins < p) return false;
    S.coins -= p; r.priceIx++; useBoost(r, 'moves'); saveSoon(); return true;
  }
  function boost(kind, cell) {
    const r = cur; if (!r || !(S.adv.boost[kind] > 0)) return false;
    if (!useBoost(r, kind, cell)) return false;
    S.adv.boost[kind]--; saveSoon(); return true;
  }
  function buyBoost(kind) {
    const B = BOOSTERS[kind]; if (!B || S.coins < B.price) return false;
    S.coins -= B.price; S.adv.boost[kind]++; saveSoon(); return true;
  }

  return {
    LC, LR, LN, NB, FIRST, kindOf, chapterOf, gen, newRun, canDrop, drop, remaining, starsFor, boostCheck, useBoost, pickable, blocked,
    candidates, botStep, play, botTest, tickHearts, heartNext, refillHearts, start, win, lose, quit, movesPrice, buyMoves, boost, buyBoost,
    get cur() { return cur; }, set cur(v) { cur = v; }, hasMove, CRATE_MOVES,
  };
})();
