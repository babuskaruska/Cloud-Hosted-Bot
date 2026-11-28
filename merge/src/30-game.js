// Saarepagar game logic (Mira): board, merges, generators, energy, orders, tasks, XP, daily, bubbles, chests, bag.
// Game logic never draws; it reports what happened through UI.ev(kind, cell, data) and UI turns that into motion and sound.
const Game = (() => {
  const idx = (c, r) => r * COLS + c;
  const cr = i => [i % COLS, Math.floor(i / COLS)];
  // Rows 1..6 start open. The rest open three at a time on each level-up, from the middle outwards.
  const LOCK_ORDER = [];
  for (const r of [7, 0, 8]) for (const c of [3, 2, 4, 1, 5, 0, 6]) LOCK_ORDER.push(idx(c, r));
  const lockRank = new Array(NCELL).fill(-1);
  LOCK_ORDER.forEach((i, n) => { lockRank[i] = n; });
  const isOpen = i => i >= 0 && i < NCELL && (lockRank[i] < 0 || lockRank[i] < S.unl);
  const unlockLevel = i => lockRank[i] < 0 ? 0 : 2 + Math.floor(lockRank[i] / 3);

  const ch = k => CHAINS[k];
  const maxL = k => CHAINS[k].names.length;
  const nameOf = it => CHAINS[it.k].names[it.l - 1];
  const kindOf = it => CHAINS[it.k].kind;
  const ev = (kind, cell, data) => { if (typeof UI !== 'undefined' && UI.ev) UI.ev(kind, cell, data || {}); };

  function canMerge(A, B) { return !!(A && B && A !== B && A.k === B.k && A.l === B.l && A.l < maxL(A.k) && !A.b && !B.b); }

  function emptyCells(from) {
    const [fc, fr] = from >= 0 ? cr(from) : [3, 4], out = [];
    for (let i = 0; i < NCELL; i++) if (isOpen(i) && !S.board[i]) { const [c, r] = cr(i); out.push([i, (c - fc) * (c - fc) + (r - fr) * (r - fr) * 1.05]); }
    out.sort((a, b) => a[1] - b[1]);
    return out.map(x => x[0]);
  }
  const nearestEmpty = from => { const e = emptyCells(from); return e.length ? e[0] : -1; };

  function genItem(k, l) { const it = { k, l: l || 1 }; if (ch(k).kind === 'gen') { it.ch = GEN_LV[it.l - 1][0]; it.cd = 0; } return it; }

  // A new item level fills the collection album (the reward waits there) and shows a "UUS!" popup.
  let quiet = false;
  function discover(k, l) {
    const prev = S.disc[k] || 0;
    if (l > prev) {
      S.disc[k] = l;
      if (ch(k).kind === 'item' && !ch(k).ev) { if (!quiet) for (let j = prev + 1; j <= l; j++) ev('discover', -1, { k, l: j }); return true; }
    }
    return false;
  }
  // ---- collection album ----
  const albumHas = (k, l) => ((S.album[k] | 0) >> l & 1) === 1;
  function albumPending(k) { let n = 0; const d = S.disc[k] || 0; for (let l = 1; l <= d; l++) if (!albumHas(k, l)) n++; return n; }
  const chainFull = k => (S.disc[k] || 0) >= maxL(k) && albumPending(k) === 0;
  function albumCount() { let n = 0; for (const k of ALBUM_CHAINS) { n += albumPending(k); if (chainFull(k) && !S.albumDone[k]) n++; } return n; }
  function claimAlbum(k, l) {
    if (!CHAINS[k] || l > (S.disc[k] || 0) || albumHas(k, l)) return false;
    S.album[k] = (S.album[k] | 0) | (1 << l);
    const r = albumReward(l); give(Object.assign({ silent: true }, r)); addXp(1);
    ev('albumClaim', -1, { k, l, r }); after(); return true;
  }
  function claimChain(k) {
    if (S.albumDone[k] || !chainFull(k)) return false;
    S.albumDone[k] = true; give(Object.assign({ silent: true }, ALBUM_CHAIN));
    ev('albumChain', -1, { k, r: ALBUM_CHAIN }); after(); return true;
  }

  // ---- free energy every few hours ----
  const freeEnIn = () => Math.max(0, (S.freeEnAt || 0) - now());
  function claimFreeEnergy() {
    if (freeEnIn() > 0) return false;
    S.en += FREE_EN; S.freeEnAt = now() + FREE_EN_MS;
    ev('freeEnergy', -1, { n: FREE_EN }); after(); return true;
  }

  // Chains the player can currently make (from generators on the board and in the bag).
  function availChains() {
    const set = new Set();
    for (const it of S.board.concat(S.bag)) if (it && ch(it.k).kind === 'gen') for (const s of GENERATORS[it.k].spawn) if (s[2] <= it.l && ch(s[0]).kind === 'item') set.add(s[0]);
    return [...set];
  }

  // Energy over real time
  function tickEnergy() {
    const t = now();
    if (S.en >= MAXEN) { S.enT = t; return; }
    const k = Math.floor((t - S.enT) / EN_MS);
    if (k > 0) { S.en = Math.min(MAXEN, S.en + k); S.enT += k * EN_MS; if (S.en >= MAXEN) S.enT = t; }
  }
  const enNext = () => S.en >= MAXEN ? 0 : EN_MS - (now() - S.enT);

  function addCoins(n) { S.coins += n; if (n > 0) daily('coins', n); }
  function addXp(n) {
    S.xp += n;
    while (S.xp >= xpNeed(S.lvl)) {
      S.xp -= xpNeed(S.lvl); S.lvl++;
      const before = S.unl; S.unl = Math.min(LOCK_ORDER.length, S.unl + 3);
      const r = levelReward(S.lvl), got = { coins: r.coins, energy: Math.max(0, MAXEN - S.en), chest: r.chest, mbox: r.mbox || 0, gen: null };
      addCoins(r.coins); S.en = Math.max(S.en, MAXEN);
      giveItem('chest', r.chest, true);
      if (r.mbox) giveItem('mbox', 1, true);
      if (r.genCopy) { const k = spareGen(); if (k) { giveItem(k, 1, true); got.gen = k; } }
      ev('levelUp', -1, { lvl: S.lvl, cells: LOCK_ORDER.slice(before, S.unl), got });
    }
  }

  // Place a reward item on the board near the middle, or in the bag if the board is full.
  function giveItem(k, l, silent) {
    const it = genItem(k, l);
    if (ch(k).kind === 'gen') S.gensOwned[k] = true;
    discover(k, it.l);
    const e = nearestEmpty(idx(3, 4));
    if (e >= 0) { S.board[e] = it; ev('gift', e, { k, l: it.l, silent }); return e; }
    S.bag.push(it); ev('toBag', -1, { k, l: it.l });
    return -1;
  }
  // The owned generator kind with the fewest copies (a spare one lets her merge generators sooner).
  function spareGen() {
    const n = {};
    for (const k in S.gensOwned) n[k] = 0;
    for (const it of S.board.concat(S.bag)) if (it && ch(it.k).kind === 'gen' && it.k in n) n[it.k]++;
    const ks = Object.keys(n); if (!ks.length) return null;
    ks.sort((a, b) => n[a] - n[b] || a.localeCompare(b)); return ks[0];
  }
  function give(r) {
    if (!r) return;
    if (r.coins) addCoins(r.coins);
    if (r.energy) S.en += r.energy;
    if (r.stars) S.stars += r.stars;
    if (r.gen) giveItem(r.gen, 1);
    if (r.chest) giveItem('chest', r.chest);
    if (r.item) giveItem(r.item[0], r.item[1]);
    if (r.genUp) { const k = spareGen(); if (k) giveItem(k, 2); }
    if (r.boost) { const b = typeof r.boost === 'string' ? { [r.boost]: 1 } : r.boost; for (const k in b) if (k in S.adv.boost) S.adv.boost[k] += b[k]; }
    if (r.spins) S.wheel.extra += r.spins;
    if (r.hearts) S.adv.hearts = Math.max(S.adv.hearts, Math.min(HEART_MAX, S.adv.hearts + r.hearts));
    if (r.look && typeof r.look === 'string') LOOK.unlock(r.look);
    ev('reward', -1, r);
  }

  // ---- board actions ----
  function merge(a, b) {
    const A = S.board[a], B = S.board[b];
    if (a === b || !canMerge(A, B)) return false;
    const res = genItem(A.k, A.l + 1);
    S.board[a] = null; S.board[b] = res;
    const kind = ch(res.k).kind;
    // Lucky merge: jump one more level, a free twin, or a mystery box.
    let lucky = null;
    if (kind === 'item' && res.l >= 2 && (rnd() < LUCKY_P || (S.stats.lucky === 0 && S.stats.merges === 5))) {
      const r = rnd();
      if (res.l + 1 < maxL(res.k) && r < 0.4) { res.l++; lucky = 'jump'; }
      else if (r < 0.75 && nearestEmpty(b) >= 0) lucky = 'twin';
      else if (nearestEmpty(b) >= 0) lucky = 'mbox';
      if (lucky) S.stats.lucky++;
    }
    afterMerge(b, res, 1, a, { lucky });
    if (lucky === 'twin') { const e = nearestEmpty(b); if (e >= 0) { S.board[e] = { k: res.k, l: res.l }; ev('spawn', e, { from: b, k: res.k, l: res.l, quiet: true }); } }
    if (lucky === 'mbox') { const e = nearestEmpty(b); if (e >= 0) { S.board[e] = { k: 'mbox', l: 1 }; ev('spawn', e, { from: b, k: 'mbox', l: 1, quiet: true }); } }
    if (lucky) ev('lucky', b, { type: lucky, k: res.k, l: res.l });
    else if (kind === 'item' && res.l >= 3) {
      const r = rnd();
      if (r < MBOX_P) { const e = nearestEmpty(b); if (e >= 0) { S.board[e] = { k: 'mbox', l: 1 }; ev('spawn', e, { from: b, k: 'mbox', l: 1 }); } }
      else if (r < MBOX_P + 0.06) { const e = nearestEmpty(b); if (e >= 0) { S.board[e] = { k: res.k, l: res.l, b: now() + 60000 }; ev('bubble', e, { from: b }); } }
    }
    after(); return true;
  }
  // Shared bookkeeping for a merge that made n items at cell b: stats, daily, XP, combo, festival points, events.
  function afterMerge(b, res, n, from, extra) {
    S.stats.merges += n; daily('merge', n); piggyAdd(PIGGY_ADD.merge * n);
    const kind = ch(res.k).kind;
    if (kind === 'item' && res.l >= 5) daily('hi', n);
    ev('merge', b, Object.assign({ from, k: res.k, l: res.l, max: res.l === maxL(res.k) }, extra || {}));
    discover(res.k, res.l);
    // combo
    const t = now();
    S._combo = t - (S._comboT || 0) < COMBO_MS ? (S._combo || 0) + 1 : 1; S._comboT = t;
    if (S._combo > (S.stats.combo || 0)) S.stats.combo = S._combo;
    const cr = comboReward(S._combo);
    if (cr) { if (cr.coins) addCoins(cr.coins); if (cr.energy) S.en += cr.energy; }
    if (S._combo >= 2) ev('combo', b, { n: S._combo, r: cr });
    PASS.add(PASS_PTS.merge * n, b);
    if (ch(res.k).ev) WEEK.add(WEEK_CUR.merge(res.l) * n, b);
    addXp(n);
  }
  // Same items connected to cell b (4-neighbours), breadth first from b, skipping cell a (the dragged one).
  function group(b, a) {
    const B = S.board[b]; if (!B || B.b) return [];
    const out = [b], seen = new Set([b, a]);
    for (let q = 0; q < out.length; q++) {
      const [c, r] = cr(out[q]);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const j = idx(nc, nr), it = S.board[j];
        if (!seen.has(j) && it && !it.b && it.k === B.k && it.l === B.l) { seen.add(j); out.push(j); }
      }
    }
    return out;
  }
  // Merge 5: the dragged item plus four connected identical items give two of the next level.
  function merge5(a, b) {
    const A = S.board[a], B = S.board[b];
    if (!canMerge(A, B)) return false;
    const gr = group(b, a); if (gr.length < 4) return false;
    const used = gr.slice(0, 4), outs = [b, used[1]];
    const cells = [a].concat(used);
    for (const c of cells) S.board[c] = null;
    for (const c of outs) S.board[c] = genItem(A.k, A.l + 1);
    S.stats.merge5++;
    afterMerge(b, S.board[b], 2, a, { five: true, cells, outs });
    ev('merge5', b, { cells, outs, k: A.k, l: A.l + 1 });
    after(); return true;
  }
  function move(a, b) {
    if (a === b || !S.board[a] || S.board[b] || !isOpen(b)) return false;
    S.board[b] = S.board[a]; S.board[a] = null;
    ev('move', b, { from: a }); after(); return true;
  }
  function swap(a, b) {
    if (a === b || !S.board[a] || !S.board[b] || !isOpen(b)) return false;
    const t = S.board[a]; S.board[a] = S.board[b]; S.board[b] = t;
    ev('swap', b, { from: a }); after(); return true;
  }
  // Drop a dragged item from cell a onto cell b: merge, move or swap.
  function drop(a, b) {
    if (!isOpen(b) || a === b) return false;
    const A = S.board[a], B = S.board[b];
    if (!A) return false;
    if (!B) return move(a, b);
    if (canMerge(A, B)) return group(b, a).length >= 4 ? merge5(a, b) : merge(a, b);
    if (B.b) return false;
    return swap(a, b);
  }

  function refreshGen(it) { if (it.ch <= 0 && now() >= it.cd) { it.ch = GEN_LV[it.l - 1][0]; it.cd = 0; return true; } return false; }

  function tapGen(i) {
    const it = S.board[i];
    if (!it || ch(it.k).kind !== 'gen' || it.b) return false;
    refreshGen(it);
    if (it.ch <= 0) { ev('genWait', i, { ms: it.cd - now() }); return false; }
    tickEnergy();
    if (S.en < 1) { ev('noEnergy', i); return false; }
    const e = nearestEmpty(i);
    if (e < 0) { ev('full', i); return false; }
    const [, cd, p2] = GEN_LV[it.l - 1];
    const opts = GENERATORS[it.k].spawn.filter(s => s[2] <= it.l);
    let k = wpick(opts, s => s[1])[0];
    if (S.tut >= 5 && WEEK.open() && rnd() < WEEK_SPAWN_P) k = WEEK.info().chain;
    const l = ch(k).kind === 'item' && !ch(k).ev && rnd() < p2 ? 2 : 1;
    S.en--;
    it.ch--; if (it.ch <= 0) it.cd = now() + cd * 1000;
    S.board[e] = { k, l };
    discover(k, l);
    S.stats.taps++; daily('tap', 1);
    ev('spawn', e, { from: i, k, l });
    after(); return true;
  }
  const rushPrice = it => it && it.ch <= 0 ? 5 + Math.ceil(Math.max(0, it.cd - now()) / 12000) : 0;
  function rushGen(i) {
    const it = S.board[i]; if (!it || ch(it.k).kind !== 'gen' || it.ch > 0) return false;
    const p = rushPrice(it);
    if (S.coins < p) { ev('deny', i, { need: 'coins' }); return false; }
    S.coins -= p; it.ch = GEN_LV[it.l - 1][0]; it.cd = 0;
    ev('rush', i); after(); return true;
  }

  function collect(i) {
    const it = S.board[i]; if (!it || it.b) return false;
    const c = ch(it.k), n = c.value ? c.value[it.l - 1] : 0;
    if (c.kind === 'energy') S.en += n; else if (c.kind === 'coin') addCoins(n); else return false;
    S.board[i] = null;
    ev('collect', i, { kind: c.kind, n, k: it.k, l: it.l }); after(); return true;
  }

  function chestRoll(l) {
    const pool = availChains(); const r = rnd();
    if (r < 0.14) return { k: 'coffee', l: rnd() < 0.8 ? 1 : 2 };
    if (r < 0.26) return { k: 'coin', l: rnd() < 0.75 ? 1 : 2 };
    const k = pool.length ? pick(pool) : 'bread';
    const lo = l >= 3 ? 2 : 1, hi = Math.min(maxL(k) - 1, l + 1);
    return { k, l: ri(lo, hi) };
  }
  function openChest(i) {
    const it = S.board[i]; if (!it || ch(it.k).kind !== 'chest' || it.b) return false;
    const n = ch('chest').value[it.l - 1], empt = emptyCells(i);
    if (empt.length < n - 1) { ev('full', i, { need: n - 1 }); return false; }
    const cells = [i].concat(empt.slice(0, n - 1));
    S.board[i] = null;
    for (const c of cells) { const x = chestRoll(it.l); S.board[c] = x; discover(x.k, x.l); }
    ev('chest', i, { cells }); after(); return true;
  }

  const bubblePrice = it => 6 + it.l * 7;
  function popBubble(i) {
    const it = S.board[i]; if (!it || !it.b) return false;
    const p = bubblePrice(it);
    if (S.coins < p) { ev('deny', i, { need: 'coins' }); return false; }
    S.coins -= p; delete it.b; discover(it.k, it.l);
    ev('bubblePop', i, { k: it.k, l: it.l }); after(); return true;
  }

  function sellPrice(it) {
    if (!it || it.b) return 0;
    const k = ch(it.k).kind;
    if (k === 'item') return Math.max(1, Math.round(Math.pow(1.7, it.l - 1)));
    if (k === 'chest') return 5 * it.l;
    return 0;
  }
  function sell(i) {
    const it = S.board[i], p = sellPrice(it);
    if (!p) { ev('deny', i); return false; }
    S.board[i] = null; addCoins(p);
    ev('sell', i, { n: p, k: it.k, l: it.l }); after(); return true;
  }

  // Tap on a board item: generators spawn, coffee and coins are collected, chests open.
  function tapItem(i) {
    const it = S.board[i]; if (!it || it.b) return false;
    const k = ch(it.k).kind;
    if (k === 'gen') return tapGen(i);
    if (k === 'energy' || k === 'coin') return collect(i);
    if (k === 'chest') return openChest(i);
    if (k === 'mystery') return openMystery(i);
    if (ch(it.k).ev && it.l >= maxL(it.k)) return cashEvent(i);
    return false;
  }
  // The top level of an event chain is cashed in for event currency and a few coins.
  function cashEvent(i) {
    const it = S.board[i]; if (!it || !ch(it.k).ev || it.l < maxL(it.k)) return false;
    S.board[i] = null; addCoins(10);
    ev('cashEvent', i, { k: it.k, l: it.l, n: WEEK_CUR.top });
    WEEK.add(WEEK_CUR.top, i);
    after(); return true;
  }
  // Mystery box: one surprise, rolled when opened.
  function openMystery(i) {
    const it = S.board[i]; if (!it || ch(it.k).kind !== 'mystery' || it.b) return false;
    const pool = availChains(), r = rnd();
    let out;
    if (r < 0.3) out = { energy: ri(15, 30) };
    else if (r < 0.52) out = { coins: ri(20, 50) };
    else if (r < 0.8 && pool.length) { const k = pick(pool); out = { item: [k, Math.min(maxL(k) - 1, ri(3, 5))] }; }
    else if (r < 0.92) out = { item: ['chest', rnd() < 0.7 ? 1 : 2] };
    else { const k = spareGen(); out = k ? { item: [k, 1] } : { coins: 60 }; }
    S.board[i] = null; S.stats.mbox++;
    if (out.item) { const x = genItem(out.item[0], out.item[1]); if (ch(x.k).kind === 'gen') S.gensOwned[x.k] = true; S.board[i] = x; }
    if (out.energy) S.en += out.energy;
    if (out.coins) addCoins(out.coins);
    ev('mystery', i, { out });
    if (out.item) discover(out.item[0], out.item[1]);
    after(); return true;
  }

  // ---- bag ----
  function store(i) {
    const it = S.board[i];
    if (!it || it.b) return false;
    if (S.bag.length >= S.bagSlots) { ev('bagFull', i); return false; }
    S.board[i] = null; S.bag.push(it);
    ev('store', i, { k: it.k, l: it.l }); after(); return true;
  }
  function take(slot) {
    const it = S.bag[slot]; if (!it) return false;
    const e = nearestEmpty(idx(3, 4));
    if (e < 0) { ev('full', -1); return false; }
    S.bag.splice(slot, 1); S.board[e] = it;
    ev('take', e, { k: it.k, l: it.l }); after(); return true;
  }

  // ---- orders ----
  function villagersAvail() { return Object.keys(VILLAGERS).filter(w => VILLAGERS[w].from <= S.area && (!VILLAGERS[w].after || S.done[VILLAGERS[w].after])); }
  function maxOrders() { let n = S.lvl < 2 ? 2 : 3; if (S.area >= 2 && S.lvl >= 5) n = 4; return Math.min(n, villagersAvail().length); }
  function orderReward(items) {
    const value = items.reduce((s, x) => s + Math.pow(2, x[1] - 1), 0);
    return { coins: Math.round(value * 2.2 + 4), xp: Math.ceil(value * 0.8) + 2, stars: 1 + (value >= 10) + (value >= 40) + (value >= 120) };
  }
  function genOrder() {
    const busy = new Set(S.orders.map(o => o.who));
    if (S.oseq < ORDER_SCRIPT.length) {
      const sc = ORDER_SCRIPT[S.oseq];
      if (busy.has(sc.who)) return null;
      S.oseq++;
      return { id: 'o' + S.oseq, who: sc.who, items: sc.items.map(x => x.slice()), coins: sc.coins, xp: sc.xp, stars: sc.stars, t: now() };
    }
    const free = villagersAvail().filter(w => !busy.has(w));
    const chains = availChains();
    if (!free.length || !chains.length) return null;
    const who = pick(free), V = VILLAGERS[who];
    const liked = chains.filter(k => V.likes.includes(k));
    const src = liked.length ? liked : chains;
    const r = rnd();
    let n = V.small ? (r < 0.6 ? 1 : 2) : S.lvl < 3 ? (r < 0.55 ? 1 : 2) : (r < 0.3 ? 1 : r < 0.8 ? 2 : 3);
    const items = [];
    for (let j = 0; j < n; j++) {
      const k = pick(src);
      let cap = Math.min(maxL(k) - 1, 2 + Math.floor((S.lvl - 1) * 0.62) - (V.small ? 1 : 0));
      cap = Math.max(2, cap);
      // Lower levels are more common; one item per order may reach the cap.
      let l = Math.max(2, cap - Math.floor(Math.pow(rnd(), 0.8) * 3));
      if (items.some(x => x[1] >= cap - 0) && l >= cap) l = Math.max(2, cap - 1);
      const same = items.find(x => x[0] === k && x[1] === l);
      if (same && n > 1) l = Math.max(2, l - 1);
      items.push([k, l]);
    }
    items.sort((a, b) => b[1] - a[1]);
    S.oseq++;
    return Object.assign({ id: 'o' + S.oseq, who, items, t: now() }, orderReward(items));
  }
  // Per order: which of its items are on the board now (bubbles don't count).
  function orderStatus(o) {
    const avail = {};
    for (const it of S.board) if (it && !it.b) { const key = it.k + ':' + it.l; avail[key] = (avail[key] || 0) + 1; }
    const have = o.items.map(([k, l]) => { const key = k + ':' + l; if (avail[key] > 0) { avail[key]--; return true; } return false; });
    return { have, ready: have.every(Boolean) };
  }
  // Item keys ("k:l") the current orders still ask for (for the "Tellimus!" badges on the board).
  function orderNeeds() {
    const need = new Set();
    for (const o of S.orders) for (const [k, l] of o.items) need.add(k + ':' + l);
    return need;
  }
  function fulfill(oi) {
    const o = S.orders[oi]; if (!o) return false;
    if (!orderStatus(o).ready) { ev('deny', -1, { order: oi }); return false; }
    const cells = [];
    for (const [k, l] of o.items) {
      let best = -1;
      for (let i = 0; i < NCELL; i++) { const it = S.board[i]; if (it && !it.b && it.k === k && it.l === l && !cells.includes(i)) { best = i; break; } }
      cells.push(best);
    }
    const taken = cells.map(c => S.board[c]);
    cells.forEach(c => { S.board[c] = null; });
    S.orders.splice(oi, 1);
    addCoins(o.coins); S.stars += o.stars;
    S.stats.orders++; S.ordersDone++; daily('order', 1); piggyAdd(PIGGY_ADD.order);
    S.nextOrderAt = now() + 1400;
    ev('order', -1, { oi, o, cells, taken });
    PASS.add(PASS_PTS.order); WEEK.add(WEEK_CUR.order);
    if (S.ordersDone % MBOX_ORDER_EVERY === 0) giveItem('mbox', 1);
    addXp(o.xp);
    after(); return true;
  }
  function refillOrders() {
    if (S.title) return;
    if (S.orders.length < maxOrders() && now() >= S.nextOrderAt) {
      const o = genOrder();
      if (o) { S.orders.push(o); ev('newOrder', -1, { o }); }
      S.nextOrderAt = now() + 900;
    }
  }

  // ---- tasks and areas ----
  // The current area: a story area, or after the story (S.ended) the current tour island (TOUR.island(S.tour)).
  const curArea = () => S.ended ? TOUR.cur() : AREAS[Math.min(S.area, AREAS.length - 1)];
  function nextTask() { const a = S.ended ? TOUR.cur() : AREAS[S.area]; return a ? a.tasks.find(t => !S.done[t.id]) || null : null; }
  function doTask(id) {
    const t = nextTask();
    if (!t || t.id !== id || S.done[id]) return false;
    if (S.stars < t.cost) { ev('deny', -1, { need: 'stars' }); return false; }
    S.stars -= t.cost; S.done[id] = true; S.stats.tasks++;
    give(t.reward);
    PASS.add(PASS_PTS.task);
    let newArea = null, ended = false, island = null;
    if (S.ended) {
      if (TOUR.cur().tasks.every(x => S.done[x.id])) { S.tour++; island = TOUR.cur(); PASS.add(PASS_PTS.island); }
    } else if (AREAS[S.area].tasks.every(x => S.done[x.id])) {
      S.area++;
      if (S.area >= AREAS.length) { S.ended = true; ended = true; island = TOUR.cur(); }
      else { newArea = AREAS[S.area]; if (newArea.introReward) give(newArea.introReward); }
    }
    ev('task', -1, { t, newArea, ended, island });
    after(); return true;
  }
  // Design choice for a task with t.choices (also changed later from the task list).
  function setStyle(id, key) {
    const t = TOUR.task(id);
    if (!t || !t.choices || !t.choices.includes(key) || !S.done[id]) return false;
    const was = S.style[id]; S.style[id] = key;
    ev('style', -1, { id, key, was }); after(); return true;
  }

  // ---- daily gift and daily tasks ----
  function ensureDaily() {
    const d = dayKey();
    if (S.daily.day === d) return false;
    S.daily.day = d; S.daily.gift = false; S.daily.bonus = false;
    const r = mulberry(hashStr(d)), pool = DAILY_POOL.slice(), tier = Math.min(2, Math.floor((S.lvl - 1) / 4));
    S.daily.tasks = [];
    for (let j = 0; j < 3; j++) { const x = pool.splice(Math.floor(r() * pool.length), 1)[0]; S.daily.tasks.push({ id: x.id, goal: x.goals[Math.min(tier, x.goals.length - 1)], n: 0, claimed: false }); }
    return true;
  }
  function daily(id, n) {
    for (const t of S.daily.tasks) if (t.id === id && t.n < t.goal) { t.n = Math.min(t.goal, t.n + n); if (t.n >= t.goal) ev('dailyReady', -1, { t }); }
  }
  // Daily calendar: the 7-day streak (day 7 is the big prize, then it starts a new week) and the 30-day track
  // (counts every visit; a missed day does not reset it). Before today's claim it shows what today will give.
  function giftReward() {
    const D = S.daily, claimed = D.gift;
    const s = claimed ? D.streak : D.lastGift === dayKey(now() - 86400000) ? D.streak + 1 : 1;
    const d30 = claimed ? Math.max(1, D.d30) : (D.d30 >= 30 ? 1 : D.d30 + 1), day7 = (Math.max(1, s) - 1) % 7;
    const m = CAL30.find(x => x.day === d30);
    return { streak: s, day7, r: CAL7[day7], d30, m30: m ? m.r : null, claimed };
  }
  function claimGift() {
    ensureDaily(); if (S.daily.gift) return false;
    const g = giftReward();
    S.daily.gift = true; S.daily.streak = g.streak; S.daily.lastGift = S.daily.day; S.daily.d30 = g.d30;
    give(Object.assign({ silent: true }, g.r));
    if (g.m30) { S.daily.c30 = g.d30; give(Object.assign({ silent: true }, g.m30)); }
    ev('gift', -1, { daily: true, g }); after(); return true;
  }
  // ---- piggy bank: fills from play, opens free once a day ----
  function piggyAdd(n) { if (S.piggy.coins < PIGGY_MAX) S.piggy.coins = Math.min(PIGGY_MAX, S.piggy.coins + n); }
  const piggyReady = () => S.piggy.day !== dayKey() && S.piggy.coins >= PIGGY_MIN;
  function openPiggy() {
    if (!piggyReady()) return false;
    const n = S.piggy.coins; S.piggy.coins = 0; S.piggy.day = dayKey(); addCoins(n);
    ev('piggy', -1, { n }); after(); return true;
  }
  // ---- lucky wheel: one free spin a day, plus spins won in play ----
  const wheelFree = () => S.wheel.free !== dayKey();
  const wheelSpins = () => (wheelFree() ? 1 : 0) + S.wheel.extra;
  function spinWheel(force) {
    if (!wheelSpins() && force === undefined) return -1;
    if (wheelFree()) S.wheel.free = dayKey(); else if (S.wheel.extra > 0) S.wheel.extra--;
    const i = force !== undefined ? force : WHEEL.indexOf(wpick(WHEEL, x => x.w));
    S.wheel.n++;
    give(Object.assign({ silent: true }, WHEEL[i].r));
    ev('wheel', -1, { i }); after(); return i;
  }
  function claimDaily(ti) {
    const t = S.daily.tasks[ti]; if (!t || t.claimed || t.n < t.goal) return false;
    t.claimed = true; give(DAILY_REWARD); PASS.add(PASS_PTS.daily); ev('dailyClaim', -1, { ti }); after(); return true;
  }
  function claimBonus() {
    if (S.daily.bonus || !S.daily.tasks.length || !S.daily.tasks.every(t => t.claimed)) return false;
    S.daily.bonus = true; give(DAILY_BONUS); ev('dailyClaim', -1, { bonus: true }); after(); return true;
  }

  // ---- shop ----
  function shopList() {
    const list = SHOP.map(x => x.id === 'slot' ? Object.assign({}, x, { price: S.bagSlots >= 12 ? 0 : 60 * (S.bagSlots - 3), soldOut: S.bagSlots >= 12 }) : x);
    for (const k of Object.keys(GENERATORS)) if (S.gensOwned[k]) list.push({ id: 'gen:' + k, name: GENERATORS[k].names[0], desc: 'Uus generaator', price: GEN_PRICE, give: { gen: k }, icon: [k, 1] });
    return list;
  }
  function buy(id) {
    const x = shopList().find(s => s.id === id); if (!x || x.soldOut) return false;
    if (S.coins < x.price) { ev('deny', -1, { need: 'coins' }); return false; }
    if (x.give.item || x.give.gen) { if (nearestEmpty(-1) < 0 && S.bag.length >= S.bagSlots) { ev('full', -1); return false; } }
    S.coins -= x.price;
    if (x.give.slot) S.bagSlots++;
    else give(x.give);
    ev('buy', -1, { x }); after(); return true;
  }

  // ---- tutorial ----
  function tutCheck() {
    const before = S.tut;
    const count = (k, l) => S.board.filter(it => it && !it.b && it.k === k && it.l === l).length;
    if (S.tut === 1 && (count('bread', 1) >= 2 || count('bread', 2) > 0)) S.tut = 2;
    if (S.tut === 2 && (count('bread', 2) > 0 || S.stats.orders > 0)) S.tut = 3;
    if (S.tut === 3 && S.stats.orders > 0) S.tut = 4;
    if (S.tut === 4 && S.done.b1) S.tut = 5;
    if (S.tut !== before) ev('tut', -1, { from: before, to: S.tut });
  }

  function after() { tutCheck(); saveSoon(); }

  let lastSlow = 0;
  function tick() {
    if (!S) return;
    const t = now();
    if (t - lastSlow < 250) return;
    lastSlow = t;
    tickEnergy();
    for (let i = 0; i < NCELL; i++) {
      const it = S.board[i]; if (!it) continue;
      if (it.b && t > it.b) { S.board[i] = null; ev('bubbleGone', i, { k: it.k, l: it.l }); saveSoon(); continue; }
      if (ch(it.k).kind === 'gen' && refreshGen(it)) ev('genReady', i);
    }
    refillOrders();
    if (ensureDaily()) ev('newDay', -1);
    if (!S.title) { PASS.ensure(); WEEK.ensure(); LOOK.check(); }
    while (S.ended && TOUR.cur().tasks.every(x => S.done[x.id])) S.tour++; // safety: never stall on a finished island
  }

  function newGame() {
    S = newState();
    quiet = true;
    const put = (c, r, k, l) => { S.board[idx(c, r)] = genItem(k, l); discover(k, l || 1); if (ch(k).kind === 'gen') S.gensOwned[k] = true; };
    put(3, 3, 'oven'); put(1, 5, 'basket'); put(6, 1, 'coin', 1); put(0, 2, 'coffee', 1);
    quiet = false;
    S.tut = 0;
    ensureDaily(); PASS.ensure(); LOOK.check(true);
    return S;
  }

  return {
    idx, cr, isOpen, unlockLevel, LOCK_ORDER, maxL, nameOf, kindOf, xpNeed, canMerge, emptyCells, nearestEmpty, availChains,
    tickEnergy, enNext, merge, move, swap, drop, tapGen, rushGen, rushPrice, collect, openChest, popBubble, bubblePrice, sell, sellPrice,
    tapItem, store, take, maxOrders, orderStatus, fulfill, refillOrders, genOrder, villagersAvail, curArea, nextTask, doTask,
    ensureDaily, claimGift, claimDaily, claimBonus, giftReward, shopList, buy, tutCheck, tick, newGame, addXp, give, refreshGen,
    group, merge5, openMystery, albumHas, albumPending, albumCount, chainFull, claimAlbum, claimChain,
    freeEnIn, claimFreeEnergy, orderNeeds,
    piggyAdd, piggyReady, openPiggy, wheelFree, wheelSpins, spinWheel, addCoins, setStyle, cashEvent,
  };
})();
