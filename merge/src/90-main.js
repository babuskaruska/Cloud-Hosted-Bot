// Saarepagar boot (Mira): load or start a game, the frame loop (rAF, 60 fps or 30 on weak devices,
// redraw only when needed, paused while hidden), saving on hide, and the test hook window.__mg.
(function () {
  S = load() || Game.newGame();
  S.title = true;
  Game.tickEnergy(); Game.ensureDaily();
  const cap = (navigator.hardwareConcurrency || 8) <= 4 ? 30 : 60;
  try { if (typeof FX !== 'undefined' && FX && FX.quality === undefined) FX.quality = cap === 30 ? 1 : 2; } catch (e) {}
  UI.layout();
  addEventListener('resize', () => UI.layout());
  addEventListener('orientationchange', () => setTimeout(() => UI.layout(), 120));

  let raf = 0, last = 0, running = false;
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    if (ms - last < 1000 / cap - 2) return;
    const dt = Math.min(0.1, (ms - last) / 1000); last = ms;
    try {
      Game.tick();
      UI.update(dt);
      if (UI.needsDraw(ms)) UI.draw(ms);
    } catch (e) { console.error(e); }
  }
  function run() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); UI.markDirty(); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stop(); save(); try { if (typeof AU !== 'undefined' && AU && AU.suspend) AU.suspend(); } catch (e) {} }
    else { Game.tickEnergy(); run(); try { if (typeof AU !== 'undefined' && AU && AU.resume) AU.resume(); } catch (e) {} }
  });
  addEventListener('pagehide', save);
  run();
  const l = document.getElementById('load'); if (l) l.remove();
  try { if (typeof MUSIC !== 'undefined' && MUSIC && MUSIC.scene) MUSIC.scene('title'); } catch (e) {}

  // Test hook for QA (tools/mergeqa.js). act.* run game actions directly; UI exposes layout and screen coordinates.
  const act = {
    start: () => UI.start(),
    tapGen: i => Game.tapGen(i), tap: i => Game.tapItem(i), merge: (a, b) => Game.merge(a, b), move: (a, b) => Game.move(a, b),
    swap: (a, b) => Game.swap(a, b), drop: (a, b) => Game.drop(a, b), fulfill: oi => Game.fulfill(oi), doTask: id => Game.doTask(id),
    sell: i => Game.sell(i), store: i => Game.store(i), take: s => Game.take(s), buy: id => Game.buy(id), popBubble: i => Game.popBubble(i),
    openChest: i => Game.openChest(i), collect: i => Game.collect(i), rush: i => Game.rushGen(i),
    claimGift: () => Game.claimGift(), claimDaily: j => Game.claimDaily(j), claimBonus: () => Game.claimBonus(),
    skipDialog: () => { let n = 0; while (UI.modal && UI.modal.kind === 'dialog' && n++ < 200) UI.dialogNext(); },
    closeModal: () => UI.closeModal(), open: kind => UI.openModal({ kind }),
    find: (k, l) => { const out = []; S.board.forEach((it, i) => { if (it && !it.b && it.k === k && (l === undefined || it.l === l)) out.push(i); }); return out; },
    // Merge pairs of identical items until nothing pairs up (handy to reach an order quickly).
    autoMerge: () => { let did = true, n = 0; while (did && n < 500) { did = false; for (let a = 0; a < NCELL && !did; a++) for (let b = a + 1; b < NCELL && !did; b++) if (Game.canMerge(S.board[a], S.board[b])) { Game.merge(a, b); did = true; n++; } } return n; },
    reset: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} Game.newGame(); UI.resetView(); },
    save: () => save(),
  };
  window.__mg = {
    get S() { return S; }, act, UI, Game, CHAINS, GENERATORS, AREAS, TASKS,
    cell: i => UI.cellCenter(i),
    // Adventure levels for QA: gen(n) is deterministic; start(n) opens level n (skips the start screen);
    // state is the current try; win() finishes it as won; cell(i) / cellRect(i) are level-board screen positions.
    levels: {
      LV, ADV, gen: n => LV.gen(n), botTest: (a, b, t) => LV.botTest(a, b, t),
      map: () => { if (UI.onTitle) UI.startAdv(); else UI.goScreen('map'); },
      start: n => { if (UI.onTitle) UI.startAdv(); UI.closeModal(true); S.adv.top = Math.max(S.adv.top, n || 1); ADV.play(n || S.adv.top); return LV.cur; },
      get state() { return LV.cur; },
      drop: (a, b) => LV.cur ? LV.drop(LV.cur, a, b) : null,
      boost: (k, i) => LV.boost(k, i),
      botStep: () => LV.cur ? LV.botStep(LV.cur, 'careful') : false,
      win: () => { const r = LV.cur; if (!r || r.over) return false; for (const g of r.goals) g.got = g.n; r.won = r.over = true; if (r.on) r.on('win', -1, {}); return true; },
      lose: () => { const r = LV.cur; if (!r || r.over) return false; r.moves = 0; r.over = true; if (r.on) r.on('out', -1, {}); return true; },
      cell: i => ADV.cellCenter(i),
      cellRect: i => { const v = ADV.view; if (!v || !v.G) return null; return { x: v.G.bx + (i % LV.LC) * v.G.cs, y: v.G.by + Math.floor(i / LV.LC) * v.G.cs, s: v.G.cs }; },
      spinWheel: () => { ADV.openWheel(); },
    },
    cellRect: i => { const L = UI.L; return { x: L.bx + (i % COLS) * L.cs, y: L.by + Math.floor(i / COLS) * L.cs, s: L.cs }; },
  };
})();
