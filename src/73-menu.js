// Lanternhold's screens, drawn on the HUD canvas in the pixel font: the main menu over the AI demo, Heat choice, the
// Keeper's Tree, the Codex, the in-game menu, confirmations, the results screen, the land arrival card, plus the story
// dialogue panel, the tutorial guide and the HUD row of mutator icons.
//
// UI.scr is the open screen: null | 'title' | 'heat' | 'tree' | 'codex' | 'pause' | 'confirm' | 'results' | 'arrival'.
// The results screen follows a defeat (after Ash's CINE.play('defeat') when the build has it), an abandoned run, and the
// campaign's victory (CINE.play('victory'), then the ending beat, then results with "Into the Long Night"). While it is
// open the audio scene is 'results'. Its embers count up (sfx 'emberTick', throttled) and each new unlock rings
// (sfx 'unlock'): upgrades that became affordable, a new Heat tier, the run's achievements and a daily best.
// On phones (touch, short side under 700 CSS px) the main menu is a compact bottom sheet so the demo shows above it.
// Every control goes into UI.btns (so taps find it) and into MENU.items (so keys and the gamepad can walk it).
// Input: touch and mouse (tap a button), keys (arrows or WASD move, Enter or Space picks, Esc goes back) and a gamepad
// (stick or D-pad, A picks, B goes back, Start opens the in-game menu).
const MENU = (() => {
  const M = { sel: 0, items: [], t: 0, kb: false, save: null, heatPick: 0, heatMode: 'campaign', diffPick: null, startLevel: 0, mapAct: 1, starCard: null, treeSel: 0, tab: 'beasts', page: 0, res: null, conf: null, from: null, wasPaused: false, arrivalLv: -99, sparks: [], hudTip: null };
  const C = () => UI.COLR;
  M.modal = () => !!UI.scr || STORY.on();
  // A cinematic (Ash's CINE) hides the HUD, banners and toasts as well: only its letterbox and caption show.
  const cineOn = () => typeof CINE !== 'undefined' && CINE && typeof CINE.on === 'function' && CINE.on();
  M.cineOn = cineOn;
  M.hideHud = () => !!UI.scr || cineOn();
  M.open = (scr, o = {}) => {
    const prev = UI.scr;
    if (scr && !prev && (scr === 'pause' || scr === 'arrival' || scr === 'confirm' || scr === 'results')) { M.wasPaused = G.paused; G.paused = true; }
    if (o.from !== undefined) M.from = o.from;
    UI.scr = scr; M.sel = o.sel || 0; M.t = 0; UI.closeMenu(); UI.keys.clear();
    if (scr === 'title') { M.save = continueOffer(); M.res = null; }
    if (scr === 'tree') M.treeSel = clamp(M.treeSel, 0, UPGRADES.length - 1);
    sfx(scr ? 'menuOpen' : 'uiClick', CAM.x, CAM.z, .6);
  };
  M.close = () => { UI.scr = null; G.paused = false; M.wasPaused = false; };
  M.back = () => {
    const s = UI.scr;
    if (s === 'heat' && M.heatMode === 'campaign' && anyStars()) M.open('map', { sel: 0 });
    else if (s === 'heat' || s === 'codex' || s === 'map' || s === 'keeper') M.open('title');
    else if (s === 'tree') M.open(M.from === 'results' ? 'results' : 'title', { sel: 0 });
    else if (s === 'pause') M.close();
    else if (s === 'confirm') { const cf = M.conf; if (cf && cf.no) cf.no(); else M.open(cf && cf.back || 'title'); }
    else if (s === 'arrival') M.close();
    sfx('menuBack', CAM.x, CAM.z, .7);
  };
  // ---- starting things ----
  function pickMode(mode) {
    M.heatMode = mode;
    if (mode === 'night' && !META.stats.campaigns) return confirm('Pikk Öö', ['Lõputud maad kuuenda majaka taga. Need on hoidjatele, kes on seikluse läbi teinud.', 'Kas lähed ikkagi?'], 'Mine öösse', () => afterWarn(mode), 'title');
    afterWarn(mode);
  }
  function afterWarn(mode) {
    const S = continueOffer();
    if (S) { const r = embersForSave(S); return confirm('Alustad uut mängu?', ['Su salvestatud mäng lõpeb siin' + (r && r.total ? ' ja annab ' + r.total + ' sütt.' : '.')], 'Alusta uuesti', () => toHeat(mode), 'title'); }
    toHeat(mode);
  }
  // Round 13: a campaign with a cleared land opens the land map first; every run but the daily then opens the setup
  // screen ('heat': difficulty, Heat and where the run starts), whose Alusta (hgo) starts it.
  function toHeat(mode) {
    if (mode === 'daily') return begin('daily', 0);
    M.startLevel = 0; M.diffPick = DIFF[M.diffPick] ? M.diffPick : diffKey(META.diff);
    if (mode === 'campaign' && anyStars()) { M.mapAct = M.mapAct === 2 && act2Open() ? 2 : 1; return M.open('map'); }
    toSetup();
  }
  // Round 14: the weekly challenge (67-keeper.js): its rules and reward, then a one-land campaign run.
  function pickWeek() {
    const W = weekNow(), D = DIFF[diffKey(META.diff)];
    const lines = [W.R.name + ': ' + W.R.tip, 'Maa: ' + BIOMES[W.land].name + ' · Raskus: ' + D.name, W.done ? 'Selle nädala auhind on käes. Võid ikka mängida!' : 'Auhind: +' + WEEK_EMBERS + ' sütt ja ' + WEEK_XP + ' kogemust.'];
    confirm('Nädala katse', lines, 'Alusta', () => {
      const S = continueOffer(), go = () => { UI.scr = null; M.wasPaused = false; startRun('campaign', 0, { diff: META.diff, level: W.land, weekly: W.rule }); };
      if (S) { const r = embersForSave(S); return confirm('Alustad uut mängu?', ['Su salvestatud mäng lõpeb siin' + (r && r.total ? ' ja annab ' + r.total + ' sütt.' : '.')], 'Alusta uuesti', go, 'title'); }
      go();
    }, 'title');
  }
  function toSetup() { M.heatPick = clamp(M.heatPick || META.heatMax, 0, META.heatMax); M.open('heat'); }
  function begin(mode, heat) { UI.scr = null; M.wasPaused = false; startRun(mode, heat, { diff: M.diffPick || META.diff, level: mode === 'campaign' ? M.startLevel : 0 }); }
  function confirm(title, lines, yes, fn, back, no) { M.conf = { title, lines, yes, fn, back, no }; M.open('confirm'); }
  function doContinue() {
    const S = continueOffer(); if (!S) { M.save = null; return; }
    UI.scr = null; M.wasPaused = false; buzz(12);
    try { if (!restoreRun(S)) { clearSave(); M.open('title'); } } catch (e) { clearSave(); setTimeout(() => location.reload(), 30); throw e; }
  }
  function toMenu() { M.res = null; M.victory = null; startDemo(); M.open('title'); }
  // ---- results: the cinematic first (Ash's CINE, if the build has it), then the screen ----
  const cineOk = () => typeof CINE !== 'undefined' && CINE && typeof CINE.play === 'function';
  function playCine(kind, done) { let called = false; const fin = () => { if (!called) { called = true; done(); } }; try { CINE.play(kind, fin); } catch (e) { fin(); } }
  function openResults() {
    const r = M.res || META.last; M.rc = { t: 0, tickT: -1, shown: -1, fanAt: 0, fan: r ? fanfare(r) : [] };
    M.open('results');
  }
  // What the run opened up, rung one by one after the count: newly affordable upgrades, Heat tiers and other notes,
  // the run's achievements, a daily best.
  function fanfare(r) {
    const c = C(), out = [], before = r.before || 0, after = r.after || 0;
    for (const n of r.notes || []) out.push({ text: n, col: c.ember, heat: /^Kuumus/.test(n) });
    if (r.daily && r.daily.newBest) out.push({ text: 'Tänane uus rekord: ' + r.daily.waves + ' lainet', col: c.amber });
    for (const id of r.ach || []) if (ACH_BY[id]) out.push({ text: 'Saavutus: ' + ACH_BY[id].name, col: c.amber, icon: ACH_BY[id].icon });
    const ups = UPGRADES.filter(u => { const k = upCost(u.key); return k && k <= after && k > before; });
    if (ups.length) out.push({ text: (ups.length > 2 ? ups.length + ' oskust' : ups.map(u => u.name).join(' ja ')) + ' nüüd käeulatuses', col: c.ok, icon: 'ember' });
    if (out.length > 5) { const n = out.length - 4; out.length = 4; out.push({ text: 'ja veel ' + n, col: c.dim }); }
    return out;
  }
  // The ember rows of a result, in the order they count up.
  function emberRows(r) {
    const rows = [['Söed lainete eest', r.waves], ['Söed pealike eest', r.boss]];
    if (r.depth) rows.push(['Pikk Öö', r.depth]); if (r.story) rows.push(['Lugu', r.story]);
    return rows;
  }
  const RC = { row: .28, lead: .35, total: 1.1, fan: .55 };
  const rcTimes = r => { const n = emberRows(r).length, t0 = RC.lead + n * RC.row; return { t0, end: t0 + RC.total }; };
  function resultsTick(dt) {
    const rc = M.rc, r = M.res || META.last; if (!rc || !r) return;
    rc.t += dt; const T = rcTimes(r), rows = emberRows(r);
    // The sum on screen (rows, then the total): a tick whenever it moves, at most every 60 ms.
    let shown = 0; rows.forEach(([, v], i) => { shown += Math.round(v * sat((rc.t - RC.lead - i * RC.row) / RC.row)); });
    shown += Math.round(r.total * sat((rc.t - T.t0) / RC.total));
    if (shown !== rc.shown && rc.t - rc.tickT > .06 && rc.t < T.end + .1) { rc.tickT = rc.t; sfx('emberTick', CAM.x, CAM.z, .7, clamp((rc.t - RC.lead) / (T.end - RC.lead), 0, 1)); }
    rc.shown = shown;
    while (rc.fanAt < rc.fan.length && rc.t > T.end + .3 + rc.fanAt * RC.fan) { sfx('unlock', CAM.x, CAM.z, 1, rc.fan[rc.fanAt].heat ? 1 : .5 * rc.fanAt / Math.max(1, rc.fan.length - 1)); rc.fanAt++; } // p = 1: a Heat tier
  }
  // A tap, Enter or Space while the count runs: jump to the end of it.
  function skipCount() {
    const rc = M.rc, r = M.res || META.last; if (!rc || !r) return false;
    const T = rcTimes(r), end = T.end + .3 + rc.fan.length * RC.fan; if (rc.t >= end) return false;
    if (rc.t < T.end) { rc.t = T.end + .29; rc.tickT = rc.t; sfx('emberTick', CAM.x, CAM.z, .7, 1); } else rc.t = end;
    return true;
  }
  M.skipCount = skipCount;
  // The campaign's victory: the run so far, not banked (the run goes on into the Long Night unless the keeper rests).
  function victoryResult() {
    const run = META.run || { level0: 0, notes: [], ach: [] }, sm = runSummary() || {};
    const r = embersFor({ waves: sm.waves, bosses: sm.lands, level: G.level, level0: run.level0, heat: G.heat, diff: G.diff, ending: run.ending && !run.endingPaid, ending2: run.ending2 && !run.ending2Paid });
    return Object.assign(r, { how: 'victory', act: (M.victory && M.victory.act) || 1, weekly: G.weekly, sum: sm, mode: 'campaign', land: landNo(), landName: G.B ? G.B.bio.name : '', notes: (run.notes || []).slice(), ach: (run.ach || []).slice(), before: META.embers, after: META.embers + r.total });
  }
  function intoNight() { M.victory = null; G.holdClear = false; M.res = null; M.rc = null; M.close(); sfx('uiClick', CAM.x, CAM.z, 1); }
  function restRun() { M.victory = null; M.res = abandonRun('rest'); openResults(); }
  function buzz(p) { if (UI.touch && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }

  // ---- update: results after a defeat, the arrival card, the tutorial, story ----
  M.update = dt => {
    M.t += dt; metaTick(dt); STORY.update(dt); TUT.update(dt); achTick(dt); if (!cineOn()) achToastTick(dt);
    if (UI.scr === 'results') resultsTick(dt);
    // Echo's audio scene: the main menu (the demo behind it), a story beat, the results screen, or the game.
    const scene = STORY.on() ? 'story' : UI.scr === 'results' ? 'results' : UI.scr && G.mode === 'demo' ? 'menu' : 'game';
    UI.mainMenu = scene === 'menu'; G.scene = scene;
    if (scene !== M.scene) { M.scene = scene; if (typeof AU.setScene === 'function') try { const r = M.res || META.last; AU.setScene(scene, scene === 'results' ? (r && r.how === 'victory' ? 'win' : 'defeat') : undefined); } catch (e) {} }
    if (UI.mx !== M.lmx || UI.my !== M.lmy) { if (M.lmx !== undefined) M.kb = false; M.lmx = UI.mx; M.lmy = UI.my; } // the mouse took over from the keys
    // A defeat: the dark swallows the keep (Ash's cinematic), then the results.
    if (inRun() && G.phase === 'defeat' && !UI.scr && !STORY.on()) {
      const cine = cineOk();
      if (cine && M.cineRun !== G.run && G.phaseT > .4) { M.cineRun = G.run; M.cineDone = false; const run = G.run; playCine('defeat', () => { if (M.cineRun === run) M.cineDone = true; }); }
      if (cine ? M.cineRun === G.run && (M.cineDone || G.phaseT > 12) : G.phaseT > SUMMARY_AT) { M.res = META.last; openResults(); }
    }
    // The campaign won: the beacon re-lights (cinematic), the ending beat, then the results. The land holds meanwhile.
    const V = M.victory;
    if (V && inRun() && G.phase === 'clear' && !UI.scr && !STORY.on()) {
      if (V.stage === 'pending' && G.phaseT > .5) { V.stage = 'cine'; V.t0 = M.t; if (cineOk()) playCine('victory', () => { if (V.stage === 'cine') V.stage = 'story'; }); else V.stage = 'story'; }
      if (V.stage === 'cine' && M.t - V.t0 > 12) V.stage = 'story';
      if (V.stage === 'story') { V.stage = 'wait'; if (!STORY.ending(() => { V.stage = 'results'; }, V.act)) V.stage = 'results'; }
      if (V.stage === 'results') { V.stage = 'shown'; M.res = victoryResult(); openResults(); }
    } else if (V && (!inRun() || G.phase !== 'clear')) { M.victory = null; G.holdClear = false; }
    if (inRun() && G.phase === 'play' && M.arrivalLv !== G.level && G.modLevel === G.level && !STORY.on() && !STORY.queue.length && !UI.scr) {
      M.arrivalLv = G.level; if (activeMods().length || weekRule()) M.open('arrival');
    }
    if (M.hudTip) { M.hudTip.t += dt; if (M.hudTip.t > 5) M.hudTip = null; }
    if (M.starCard) { if (!cineOn()) M.starCard.t += dt; if (M.starCard.t > 4.5 || !inRun()) M.starCard = null; }
    for (let i = M.sparks.length - 1; i >= 0; i--) { const p = M.sparks[i]; p.t += dt; p.y -= p.v * dt; p.x += Math.sin(p.t * 3 + p.ph) * dt * 8; if (p.t > p.life) M.sparks.splice(i, 1); }
  };

  // ---- input ----
  const NAV = { ArrowUp: -1, ArrowLeft: -1, KeyW: -1, KeyA: -1, ArrowDown: 1, ArrowRight: 1, KeyS: 1, KeyD: 1 };
  M.key = e => {
    const k = e.key;
    if (STORY.on()) { if (k === 'Escape') STORY.skip(); else if (k !== 'm' && k !== 'M' && k !== 'Tab') STORY.advance(); return k !== 'm' && k !== 'M'; }
    if (!UI.scr) {
      if (k === 'Escape' && inRun() && !UI.menu && !UI.spell && !UI.armed && G.phase === 'play') { M.open('pause'); return true; }
      return false;
    }
    M.kb = true;
    if (k === 'm' || k === 'M') return false;
    const d = NAV[e.code];
    if (d && UI.scr === 'heat' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD')) { if (META.heatMax > 0 && !e.shiftKey) heatStep(d); else diffStep(d); return true; }
    if (d && UI.scr === 'tree' && M.sel < UPGRADES.length) {
      const cols = M.treeCols || 1, horiz = e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD';
      const n = clamp(M.sel + (horiz ? d : d * cols), 0, UPGRADES.length); M.sel = n; if (n < UPGRADES.length) M.treeSel = n; sfx('menuMove', CAM.x, CAM.z, .6); return true;
    }
    if (d && UI.scr === 'codex' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { pageStep(d); return true; }
    if (d) { const n = M.items.length || 1; M.sel = ((M.sel + d) % n + n) % n; sfx('menuMove', CAM.x, CAM.z, .6); return true; }
    if ((k === 'Enter' || k === ' ') && UI.scr === 'results' && skipCount()) return true;
    if (k === 'Enter' || k === ' ') { const it = M.items[M.sel]; if (it) { sfx('menuSelect', CAM.x, CAM.z, .8); it.fn(); } return true; }
    if (k === 'Escape' || k === 'Backspace') { M.back(); return true; }
    return true;
  };
  M.pad = (ax, ay, hit) => {
    if (STORY.on()) { if (hit(0)) STORY.advance(); else if (hit(1)) STORY.skip(); return; }
    if (!UI.scr) { if (hit(9) && inRun() && G.phase === 'play') M.open('pause'); return; }
    M.kb = true;
    const d = ay || ax;
    if (d && M.padT <= 0) {
      M.padT = .22;
      if (UI.scr === 'heat' && ax) { if (META.heatMax > 0) heatStep(ax); else diffStep(ax); }
      else if (UI.scr === 'tree' && M.sel < UPGRADES.length) { const cols = M.treeCols || 1, n = clamp(M.sel + (ax ? ax : ay * cols), 0, UPGRADES.length); M.sel = n; if (n < UPGRADES.length) M.treeSel = n; }
      else if (UI.scr === 'codex' && ax) pageStep(ax);
      else { const n = M.items.length || 1; M.sel = ((M.sel + d) % n + n) % n; }
      sfx('menuMove', CAM.x, CAM.z, .6);
    }
    if (!d) M.padT = 0; else M.padT -= 1 / 60;
    if (hit(0) && UI.scr === 'results' && skipCount()) return;
    if (hit(0)) { const it = M.items[M.sel]; if (it) { sfx('menuSelect', CAM.x, CAM.z, .8); it.fn(); } }
    if (hit(1)) M.back();
  };
  M.padT = 0;
  // A tap that hit no control: the story advances; the arrival card begins; other screens ignore it.
  M.tapOutside = () => { if (STORY.on()) STORY.advance(); else if (UI.scr === 'arrival') M.close(); else if (UI.scr === 'results') skipCount(); };
  function heatStep(d) { M.heatPick = clamp(M.heatPick + d, 0, META.heatMax); sfx('heatSelect', CAM.x, CAM.z, .8, M.heatPick / HEAT_MAX); }
  function pageStep(d) { M.page = Math.max(0, Math.min((M.pages || 1) - 1, M.page + d)); sfx('uiHover', CAM.x, CAM.z, .6); }

  // ---- drawing helpers ----
  let E = null, ctx = null; // the frame's environment from UI.draw
  const tx = (str, x, y, ps, col, o) => PX.text(ctx, str, x, y, ps, col, o);
  const mw = (str, ps) => PX.measure(str) * ps;
  function wrap(str, maxW, ps) { const out = []; let cur = ''; for (const wd of String(str).split(' ')) { const t = cur ? cur + ' ' + wd : wd; if (cur && mw(t, ps) > maxW) { out.push(cur); cur = wd; } else cur = t; } if (cur) out.push(cur); return out; }
  // A button: registered for taps (UI.btns) and for keys (M.items). o: { on, col, sub, off (disabled look), icon, nav: false, bd }
  function button(id, x, y, w, h, label, ps, fn, o = {}) {
    const hot = E.over(x, y, w, h), down = UI.press === id, idx = o.nav === false ? -1 : M.items.length;
    const focus = M.kb && idx === M.sel && idx >= 0;
    const b = { id, x, y, w, h, fn: () => { if (!o.off || o.offOk) { buzz(10); if (!/back$|^cno$/.test(id)) sfx('menuSelect', CAM.x, CAM.z, .7); fn(); } else { sfx('uiDeny', CAM.x, CAM.z, .6); } }, hud: true };
    UI.btns.push(b); if (idx >= 0) M.items.push(b); if (hot) { UI.hudHot = true; if (!M.kb) M.hov = id; }
    const lit = hot || down || focus, dy = down ? E.s > 2 ? Math.round(ps / 2) || 1 : 1 : 0, c = C();
    UI.plate(x, y + dy, w, h, lit ? { bd: c.bdHi, bg: c.bg2, hi: 'rgba(232,176,74,0.18)' } : o.on ? { bd: c.bdHi, bg: 'rgba(60,44,22,0.95)' } : { bd: o.bd || (o.off ? '#3a342c' : c.bd), bg: 'rgba(16,18,27,0.96)' });
    const L = PX.LINE * ps, sub = o.sub;
    let lx = x + w / 2, al = 'c';
    if (o.icon) { const [iw, ih] = PX.iconSize(o.icon), k = ps; const tw0 = iw * k + 3 * ps + mw(label, ps); lx = Math.round(x + w / 2 - tw0 / 2); PX.icon(ctx, o.icon, lx, y + dy + Math.round((h - (sub ? L * 2 : L)) / 2 + (L - ih * k) / 2), k, o.off ? .45 : 1); lx += iw * k + 3 * ps; al = 'l'; }
    const ty = y + dy + Math.round((h - (sub ? L * 2 + ps : L)) / 2) + ps;
    tx(label, lx, ty, ps, o.off ? c.dim : (o.col || (lit || o.on ? '#ffd9a8' : c.tx)), al === 'c' ? { align: 'c' } : undefined);
    if (sub) tx(sub, x + w / 2, ty + L + ps, ps, c.dim, { align: 'c' });
    return b;
  }
  const dim = (a = .5) => { ctx.fillStyle = 'rgba(4,5,10,' + a + ')'; ctx.fillRect(0, 0, E.W, E.H); };
  const touchH = (ps, lines = 1) => Math.max(PX.LINE * ps * lines + 2 * 5 * ps - ps + (lines - 1) * ps, E.tch ? Math.round((lines > 1 ? 54 : 46) * E.dpr) : Math.round(PX.LINE * ps * (lines + .9)));

  // A generic modal panel built from items, shrunk (ps) until it fits:
  // { t: 'title', text } { t: 'text', text, col, c (centred) } { t: 'row', l, r, col, rc } { t: 'gap' } { t: 'big', text, col }
  // { t: 'btns', list: [{ id, label, fn, col, on, off, sub, icon }] } (side by side when they fit, else stacked)
  // { t: 'mod', icon, name, tip } { t: 'sep' }
  // o.ghost: items still to come (the results screen's unlock lines). They count for the size and the place of the panel
  // (so nothing moves when they arrive) but the plate is only as tall as what is drawn, and grows downwards.
  function panel(items, o = {}) {
    const c = C(), avW = E.Wr - E.iL - 8 * E.s, avH = E.Hb - E.iT - 8 * E.s, shown = items;
    if (o.ghost && o.ghost.length) items = items.concat(o.ghost);
    const lay = ps => {
      const p = 5 * ps, L = PX.LINE * ps, gap = 3 * ps, cap = (o.cap || 220) * ps;
      let nat = o.minW ? o.minW * ps : 0;
      for (const it of items) {
        if (it.t === 'title') nat = Math.max(nat, mw(it.text, ps + 1));
        else if (it.t === 'big') nat = Math.max(nat, mw(it.text, ps + 2));
        else if (it.t === 'text') nat = Math.max(nat, Math.min(cap, mw(it.text, ps)));
        else if (it.t === 'row') nat = Math.max(nat, mw(it.l, ps) + 8 * ps + mw(it.r, ps));
        else if (it.t === 'mod') nat = Math.max(nat, Math.min(cap, Math.max(mw(it.name, ps) + 12 * ps, mw(it.tip, ps) + 12 * ps)));
        else if (it.t === 'btns') { let s = 0, mx = 0; for (const b of it.list) { const bw = mw(b.label, ps) + 4 * p + (b.icon ? PX.iconSize(b.icon)[0] * ps + 3 * ps : 0); s += bw; mx = Math.max(mx, bw, b.sub ? mw(b.sub, ps) + 2 * p : 0); } nat = Math.max(nat, it.stack ? mx : Math.max(mx, s + gap * (it.list.length - 1))); it._mx = mx; }
      }
      const w = Math.min(avW, nat + 2 * p), inner = w - 2 * p;
      let h = p, ok = true;
      for (const it of items) {
        if (it.t === 'title') { h += PX.LINE * (ps + 1) + gap * 2; if (mw(it.text, ps + 1) > inner) ok = false; }
        else if (it.t === 'big') { h += PX.LINE * (ps + 2) + gap; if (mw(it.text, ps + 2) > inner) ok = false; }
        else if (it.t === 'text') { it._l = wrap(it.text, inner, ps); h += it._l.length * L + ps; }
        else if (it.t === 'row') { h += L + ps; if (mw(it.l, ps) + 4 * ps + mw(it.r, ps) > inner) ok = false; }
        else if (it.t === 'gap') h += gap * 2;
        else if (it.t === 'sep') h += gap * 3;
        else if (it.t === 'mod') { it._l = wrap(it.tip, inner - 12 * ps, ps); h += L * (1 + it._l.length) + gap; }
        else if (it.t === 'btns') {
          const bh = touchH(ps, it.list.some(b => b.sub) ? 2 : 1); let s = 0; for (const b of it.list) s += mw(b.label, ps) + 4 * p; s += gap * (it.list.length - 1);
          it._side = !it.stack && s <= inner && it._mx * it.list.length + gap * (it.list.length - 1) <= inner; it._bh = bh;
          h += it._side ? bh + gap : it.list.length * (bh + gap); if (it._mx > inner + 2 * p) ok = false;
        }
      }
      h += p - gap;
      return { ps, p, L, gap, w, h, inner, ok };
    };
    let Ly = lay(o.ps || E.s); while (Ly.ps > 2 && (Ly.h > avH || !Ly.ok)) Ly = lay(Ly.ps - 1);
    const hAll = Ly.h; if (items !== shown) { items = shown; Ly = Object.assign({}, Ly, { h: lay(Ly.ps).h }); }
    const { ps, p, L, gap, w, h, inner } = Ly, x = Math.round((E.iL + E.Wr) / 2 - w / 2);
    const y = Math.round(o.top !== undefined ? clamp(o.top, E.iT + 4 * E.s, Math.max(E.iT + 4 * E.s, E.Hb - hAll)) : clamp((E.H - hAll) / 2, E.iT + 4 * E.s, Math.max(E.iT + 4 * E.s, E.Hb - hAll)));
    UI.panelRect = { x, y, w, h };
    ctx.globalAlpha = sat(M.t * 6 + .25);
    UI.plate(x, y, w, h, { bd: o.bd || c.bdHi });
    let yy = y + p;
    for (const it of items) {
      if (it.t === 'title') { tx(it.text, x + w / 2, yy, ps + 1, it.col || '#ffd9a8', { align: 'c' }); yy += PX.LINE * (ps + 1) + gap * 2; }
      else if (it.t === 'big') { tx(it.text, x + w / 2, yy, ps + 2, it.col || c.amber, { align: 'c' }); yy += PX.LINE * (ps + 2) + gap; }
      else if (it.t === 'text') { if (it.a !== undefined) ctx.globalAlpha = sat(M.t * 6 + .25) * sat(it.a); for (const l of it._l) { tx(l, it.c === false ? x + p : x + w / 2, yy, ps, it.col || c.tx, it.c === false ? undefined : { align: 'c' }); yy += L; } yy += ps; if (it.a !== undefined) ctx.globalAlpha = sat(M.t * 6 + .25); }
      else if (it.t === 'row') { tx(it.l, x + p, yy, ps, it.col || c.dim); tx(it.r, x + w - p, yy, ps, it.rc || c.tx, { align: 'r' }); yy += L + ps; }
      else if (it.t === 'gap') yy += gap * 2;
      else if (it.t === 'sep') { ctx.fillStyle = 'rgba(232,176,74,0.25)'; ctx.fillRect(x + p, yy + gap, inner, Math.max(1, ps >> 1)); yy += gap * 3; }
      else if (it.t === 'mod') {
        const ic = it.icon && PX.iconSize(it.icon)[0] ? it.icon : 'heat'; PX.icon(ctx, ic, x + p, yy, ps, 1);
        tx(it.name, x + p + 12 * ps, yy, ps, it.col || c.amber); yy += L;
        for (const l of it._l) { tx(l, x + p + 12 * ps, yy, ps, c.tx); yy += L; } yy += gap;
      }
      else if (it.t === 'btns') {
        const n = it.list.length, bh = it._bh;
        if (it._side) { const bw = Math.floor((inner - gap * (n - 1)) / n); it.list.forEach((b, i) => button(b.id, x + p + i * (bw + gap), yy, bw, bh, b.label, ps, b.fn, b)); yy += bh + gap; }
        else for (const b of it.list) { button(b.id, x + p, yy, inner, bh, b.label, ps, b.fn, b); yy += bh + gap; }
      }
    }
    ctx.globalAlpha = 1;
    return { x, y, w, h, ps };
  }

  // ---- the screens ----
  function titleList() {
    const c = C(), S = M.save, list = [];
    if (S) { const mins = Math.max(0, (Date.now() - S.t) / 6e4), ago = mins < 1 ? 'just praegu' : mins < 60 ? Math.round(mins) + ' min tagasi' : mins < 2880 ? Math.round(mins / 60) + ' h tagasi' : Math.round(mins / 1440) + ' päeva tagasi';
      list.push({ id: 'mcont', label: 'Jätka', sub: (S.weekly ? 'Nädala katse · ' : '') + (S.mode === 'daily' ? 'Päev · Öömaa ' + (S.level - CAMPAIGN_LANDS + 1) : S.mode === 'campaign' && S.level >= CAMPAIGN_LANDS ? 'II vaatus · Maa ' + (S.level - CAMPAIGN_LANDS + 1) : S.level >= CAMPAIGN_LANDS ? 'Öömaa ' + (S.level - CAMPAIGN_LANDS + 1) : 'Maa ' + (S.level + 1)) + ' · Laine ' + S.k + (S.heat ? ' · Kuumus ' + S.heat : '') + (DIFF[S.diff] && S.diff !== 'tavaline' ? ' · ' + DIFF[S.diff].name : '') + ' · ' + ago, fn: doContinue, col: c.amber }); }
    list.push({ id: 'mcamp', label: 'Seiklus', sub: anyStars() ? 'Tähti ' + (starTotal(1) + starTotal(2)) + '/' + (ACT_LANDS * 6) + (act2Open() ? ' · kaks vaatust' : '') : 'Kuus maad. Süüta majakad!', fn: () => pickMode('campaign'), col: S ? null : c.amber });
    list.push({ id: 'mnight', label: 'Pikk Öö', short: 'Pikk Öö', sub: META.stats.campaigns ? (META.stats.bestNight ? 'Sügavaim: öömaa ' + META.stats.bestNight : 'Lõputud maad') : 'Lõputud maad · pärast seiklust', fn: () => pickMode('night') });
    const db = dailyBest();
    list.push({ id: 'mdaily', label: 'Päeva väljakutse', short: 'Päevane', sub: db ? 'Tänane parim: ' + db + ' lainet' : 'Täna on kõigil sama tee', fn: () => pickMode('daily') });
    { const W = weekNow(); list.push({ id: 'mweek', label: 'Nädala katse', short: 'Nädal', sub: W.R.name + (W.done ? ' · tehtud' : ' · +' + WEEK_EMBERS + ' sütt'), fn: pickWeek, icon: W.done ? null : 'crown' }); }
    list.push({ id: 'mtree', label: 'Hoidja puu', short: 'Puu ' + META.embers, sub: META.embers + ' sütt', fn: () => M.open('tree', { from: 'title' }), icon: 'ember' });
    list.push({ id: 'mcodex', label: 'Raamat', sub: 'Koletised, lugu, saavutused, rekordid', fn: () => { M.page = 0; M.open('codex'); } });
    list.push({ id: 'mset', label: 'Seaded', fn: () => UI.openSettings(true), nosub: true });
    return list;
  }
  // Phones: a compact bottom sheet (and a small logo up top), so the commander's demo shows in between.
  const compactMenu = () => E.tch && Math.min(E.W, E.H) < 700 * E.dpr;
  function drawTitle() {
    const c = C(), s = E.s, W = E.W, H = E.H, avW = E.Wr - E.iL - 8 * s, list = titleList();
    if (compactMenu()) return drawTitleCompact(list);
    // A dark wash over the demo, darker at the edges.
    dim(.32); const g = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .2, W / 2, H * .45, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const wide = W > H * 1.25 && H < 560 * E.dpr;
    // Fit: logo scale k and button font ps.
    const lw0 = PX.measure('LATERNALINNUS');
    const fit = ps => {
      const L = PX.LINE * ps, p = 5 * ps, gap = 3 * ps, bh2 = touchH(ps, 2), bh1 = touchH(ps, 1);
      let bw = 0; for (const it of list) bw = Math.max(bw, mw(it.label, ps) + (it.icon ? 12 * ps : 0) + 4 * p, it.sub ? mw(it.sub, ps) + 2 * p : 0);
      const colW = wide ? Math.min(avW * .5, Math.max(bw, 150 * ps)) : Math.min(avW, Math.max(bw, 170 * ps));
      const listH = list.reduce((a, it) => a + (it.sub ? bh2 : bh1) + gap, 0) - gap + (wide ? 0 : bh2 + 3 * gap);
      const logoW = wide ? avW * .46 : avW * .92, k = Math.max(2, Math.floor(Math.min(logoW / lw0, (wide ? E.H * .16 : E.H * .085) / PX.LINE)));
      const logoH = PX.LINE * k + 14 * ps + L + (wide ? bh2 + 10 * ps : 0);
      return { ps, L, p, gap, bh1, bh2, colW, listH, k, logoH, bw, ok: bw <= colW + 1 && (wide ? Math.max(listH, logoH) : listH + logoH + 16 * ps) <= E.Hb - E.iT - 10 * s };
    };
    let F = fit(s); while (F.ps > 2 && !F.ok) F = fit(F.ps - 1);
    const { ps, L, gap, bh1, bh2, colW, listH, k, logoH } = F;
    let lx, ly, bx, by;
    if (wide) { lx = E.iL + (E.Wr - E.iL) * .27; ly = Math.round((E.iT + E.Hb) / 2 - logoH / 2); bx = Math.round(E.iL + (E.Wr - E.iL) * .73 - colW / 2); by = Math.round((E.iT + E.Hb) / 2 - listH / 2); }
    else { const tot = logoH + 18 * ps + listH, top = Math.max(E.iT + 8 * s, Math.round((E.iT + E.Hb) / 2 - tot / 2 - (E.Hb - E.iT) * .04)); lx = W / 2; ly = top; bx = Math.round(W / 2 - colW / 2); by = top + logoH + 18 * ps; }
    drawLogo(lx, ly, k, ps);
    let y = by;
    for (const it of list) { const h = it.sub ? bh2 : bh1; button(it.id, bx, y, colW, h, it.label, ps, it.fn, { sub: it.sub, col: it.col, icon: it.icon }); y += h + gap; }
    // Round 14: the keeper's level and the daily gift, under the logo (wide) or under the buttons.
    const bwB = Math.min(colW, Math.max(150 * ps, colW));
    if (wide) drawBadge(Math.round(lx - bwB / 2), ly + logoH - bh2, bwB, bh2, ps); else drawBadge(bx, y + 2 * gap, colW, bh2, ps);
    // Footer: credit to the original.
    const fs = Math.max(1, ps - 1), ft = '';
    if (mw(ft, fs) < avW) tx(ft, W / 2, E.Hb - PX.LINE * fs - 3 * s, fs, 'rgba(167,158,138,0.7)', { align: 'c' });
  }
  function drawTitleCompact(list) {
    const c = C(), s = E.s, W = E.W, H = E.H, port = H > W, cols = port ? 3 : 4, span = port ? 3 : 2;
    const sheetW = Math.min(E.Wr - E.iL - 8 * s, port ? 1e9 : 560 * E.dpr), avH = E.Hb - E.iT;
    // The primary entry (Continue, else Campaign) spans the first row with its sub line; the rest are short buttons.
    const prim = list[0], rest = list.slice(1);
    const fit = ps => {
      const p = 4 * ps, gap = 3 * ps, cw = Math.floor((sheetW - 2 * p - (cols - 1) * gap) / cols), bh1 = touchH(ps, 1), bh2 = touchH(ps, 2);
      const pw = cw * span + gap * (span - 1);
      let ok = mw(prim.label, ps) + 2 * p <= pw && mw(prim.sub || '', ps) + 2 * p <= pw;
      for (const it of rest) { const l = it.short || it.label; if (mw(l, ps) + (it.icon ? 12 * ps : 0) + 2 * p > cw) ok = false; }
      const slots = span + rest.length, rows = Math.ceil(slots / cols), h = 2 * p + bh2 + (rows - 1) * (bh1 + gap);
      return { ps, p, gap, cw, pw, bh1, bh2, rows, h, ok: ok && h < avH * (port ? .3 : .45) };
    };
    let F = fit(s); while (F.ps > 2 && !F.ok) F = fit(F.ps - 1);
    const { ps, p, gap, cw, pw, bh1, bh2, h } = F, sx = Math.round((E.iL + E.Wr) / 2 - sheetW / 2), sy = E.Hb - h - 4 * s;
    // Light washes: the top behind the logo and the bottom behind the sheet; the middle stays clear for the demo.
    const gt = ctx.createLinearGradient(0, 0, 0, H * .3); gt.addColorStop(0, 'rgba(4,5,10,0.7)'); gt.addColorStop(1, 'rgba(4,5,10,0)'); ctx.fillStyle = gt; ctx.fillRect(0, 0, W, H * .3);
    const gb = ctx.createLinearGradient(0, sy - 40 * s, 0, H); gb.addColorStop(0, 'rgba(4,5,10,0)'); gb.addColorStop(1, 'rgba(4,5,10,0.75)'); ctx.fillStyle = gb; ctx.fillRect(0, sy - 40 * s, W, H - sy + 40 * s);
    // Round 14: the keeper's level and the daily gift, just above the sheet.
    { const bw = Math.min(sheetW, Math.max(170 * ps, Math.round(sheetW * .7))); drawBadge(Math.round((E.iL + E.Wr) / 2 - bw / 2), sy - bh2 - 4 * s, bw, bh2, ps); }
    // The logo, small, up top.
    const lw0 = PX.measure('LATERNALINNUS'), k = Math.max(2, Math.floor(Math.min((port ? .8 : .5) * (E.Wr - E.iL) / lw0, (port ? .045 : .09) * H / PX.LINE)));
    drawLogo(W / 2, E.iT + (port ? 14 : 6) * s, k, ps);
    // The sheet.
    ctx.globalAlpha = sat(M.t * 5 + .3);
    UI.plate(sx, sy, sheetW, h, { bd: c.bdHi, bg: 'rgba(10,11,18,0.9)' });
    button(prim.id, sx + p, sy + p, pw, bh2, prim.label, ps, prim.fn, { sub: prim.sub, col: prim.col || c.amber });
    let slot = span;
    for (const it of rest) {
      const col = slot % cols, row = Math.floor(slot / cols);
      const bx = sx + p + col * (cw + gap), by = row === 0 ? sy + p : sy + p + bh2 + gap + (row - 1) * (bh1 + gap), bhh = row === 0 ? bh2 : bh1;
      const last = it === rest[rest.length - 1], bw = last ? (cols - col) * (cw + gap) - gap : cw; // the last one fills its row
      button(it.id, bx, by, bw, bhh, it.short || it.label, ps, it.fn, { col: it.col, icon: it.icon });
      slot++;
    }
    ctx.globalAlpha = 1;
    // The credit, small, just above the sheet.
    const fs = Math.max(1, ps - 1), ft = '';
    if (mw(ft, fs) < E.Wr - E.iL - 8 * s) tx(ft, W / 2, sy - PX.LINE * fs - 3 * s, fs, 'rgba(167,158,138,0.6)', { align: 'c' });
  }
  // Round 14: the keeper badge (67-keeper.js): level, an XP bar and the daily gift. Tapping it opens the keeper screen;
  // the gift button (mgift) claims the day's embers with a little burst.
  function drawBadge(x, y, w, h, ps) {
    const c = C(), K = keeperLevel(), gift = giftReady(), p = 4 * ps, L = PX.LINE * ps;
    const gw = gift ? Math.max(mw('Kingitus!', ps) + 14 * ps, 64 * ps) : 0;
    if (gift) {
      const gx = x + w - gw, pulse = .5 + .5 * Math.sin(M.t * 5);
      button('mgift', gx, y, gw, h, 'Kingitus!', ps, () => { const n = claimGift(); if (n) { M.giftFx = { n, t: 0, x: gx + gw / 2, y }; buzz([12, 30, 20]); for (let i = 0; i < 18; i++) M.sparks.push({ x: gx + Math.random() * gw, y: y + Math.random() * h, v: (30 + Math.random() * 50) * E.dpr, t: 0, life: .8 + Math.random(), ph: Math.random() * 6, sz: Math.max(1, ps) }); } }, { col: pulse > .5 ? '#fff0c8' : c.amber, icon: 'gift', bd: c.amber });
    }
    const bw = w - (gift ? gw + 3 * ps : 0), b = button('mkeeper', x, y, bw, h, '', ps, () => M.open('keeper'), {});
    const dy = UI.press === b.id ? (E.s > 2 ? Math.round(ps / 2) || 1 : 1) : 0, [iw, ih] = PX.iconSize('lantern');
    const lk = Math.max(ps, Math.floor(h * .55 / ih)); PX.icon(ctx, 'lantern', x + p, y + dy + Math.round((h - ih * lk) / 2), lk, 1);
    const tx0 = x + p + iw * lk + 3 * ps, inner = bw - (tx0 - x) - p, t1 = 'Hoidja tase ' + K.lv, top = y + dy + Math.round((h - (L * 2 + ps)) / 2) + ps;
    tx(t1, tx0, top, ps, '#ffd9a8');
    const np = nextPerk(), t2 = np ? 'Tase ' + np.lv + ': ' + np.name : 'Kõik avatud';
    if (mw(t1, ps) + 6 * ps + mw(t2, ps) <= inner) tx(t2, x + bw - p, top, ps, c.dim, { align: 'r' });
    // The XP bar.
    const by = top + L + ps, bh = Math.max(2, Math.round(L * .55)); ctx.fillStyle = c.dark; ctx.fillRect(tx0, by, inner, bh); ctx.fillStyle = '#3a342c'; ctx.fillRect(tx0 + 1, by + 1, inner - 2, bh - 2);
    ctx.fillStyle = c.amber; ctx.fillRect(tx0 + 1, by + 1, Math.round((inner - 2) * sat(K.frac)), bh - 2);
    // The gift just claimed: "+N sütt" floats up from where the button was.
    const q = M.giftFx; if (q) { q.t += 1 / 60; const a = sat(2 - q.t); if (a <= 0) M.giftFx = null; else { ctx.globalAlpha = a; tx('+' + q.n + ' sütt!', q.x, q.y - q.t * 30 * E.dpr - L, ps + 1, '#ffe2a0', { align: 'c', outline: c.dark }); ctx.globalAlpha = 1; } }
  }
  // The keeper screen (screen 'keeper'): level and XP, the perks (lit once reached), the banner colour, the gift streak.
  function drawKeeper() {
    dim(.5); const c = C(), K = keeperLevel(), cur = META.banner | 0;
    const items = [{ t: 'title', text: 'Hoidja tase ' + K.lv }, { t: 'text', text: K.lv >= KEEPER_MAX ? 'Kõrgeim tase!' : 'Kogemust ' + Math.floor(K.into) + '/' + K.need + ' · Kogemust saad igast mängust.', col: c.dim }, { t: 'sep' }];
    for (const pk of KEEPER_PERKS) { const got = K.lv >= pk.lv; items.push({ t: 'row', l: 'Tase ' + pk.lv + ': ' + pk.name, r: got ? pk.short : 'lukus', col: got ? c.ok : c.dim, rc: got ? c.tx : '#6a6252' }); }
    items.push({ t: 'sep' }, { t: 'text', text: 'Tornide lipu värv', col: c.amber });
    const banBtns = BANNERS.map((b, i) => ({ id: 'kban' + i, label: bannerOpen(i) ? b.name : '?', fn: () => { if (!bannerOpen(i)) return; META.banner = i; saveMeta(); sfx('uiClick', CAM.x, CAM.z, .7); }, on: cur === i, off: !bannerOpen(i), col: bannerOpen(i) ? b.sw === '#7c2c24' ? null : b.sw : null }));
    items.push({ t: 'btns', list: banBtns.slice(0, 3) }, { t: 'btns', list: banBtns.slice(3) });
    const st = META.gift.streak | 0;
    items.push({ t: 'text', text: giftReady() ? 'Tänane kingitus ootab sind!' : 'Kingitus: ' + st + ' päev' + (st === 1 ? '' : 'a') + ' järjest. Homme +' + giftAmount(Math.min(7, st + 1)) + ' sütt.', col: '#ffd9a8' });
    items.push({ t: 'btns', list: [{ id: 'kback', label: 'Tagasi', fn: () => M.back(), icon: 'back' }] });
    panel(items, { cap: 210 });
  }
  // The logo: LATERNALINNUS (Lanternhold) in the pixel font, big, with an ember glow and sparks rising from it.
  function drawLogo(cx, y, k, ps) {
    const t = 'LATERNALINNUS', w = PX.measure(t) * k, x = Math.round(cx - w / 2), pulse = .75 + .25 * Math.sin(M.t * 2.2), c = C();
    // The lantern above the word.
    const [lw, lh] = PX.iconSize('lantern'), lk = Math.max(2, Math.round(k * .6));
    ctx.save(); ctx.shadowColor = 'rgba(255,170,80,' + (.7 * pulse) + ')'; ctx.shadowBlur = lk * 6; PX.icon(ctx, 'lantern', Math.round(cx - lw * lk / 2), y, lk, 1); ctx.restore();
    const wy = y + lh * lk + 3 * ps;
    ctx.save();
    ctx.shadowColor = 'rgba(255,120,40,' + (.85 * pulse) + ')'; ctx.shadowBlur = k * 5;
    PX.text(ctx, t, x, wy, k, '#ff8a3c', { outline: '#2a0c04' });
    ctx.shadowBlur = k * 2; ctx.shadowColor = 'rgba(255,200,120,' + (.5 * pulse) + ')';
    PX.text(ctx, t, x, wy, k, '#ffc870');
    ctx.restore();
    // The top rows lighter: an ember-gold face.
    ctx.save(); ctx.beginPath(); ctx.rect(x - k, wy, w + 2 * k, Math.round(PX.LINE * k * .38)); ctx.clip(); PX.text(ctx, t, x, wy, k, '#fff0c8'); ctx.restore();
    // Sparks.
    if (M.sparks.length < 26 && Math.random() < .5) M.sparks.push({ x: x + Math.random() * w, y: wy + PX.LINE * k * .4, v: (20 + Math.random() * 40) * E.dpr, t: 0, life: 1 + Math.random() * 1.6, ph: Math.random() * 6, sz: Math.max(1, Math.round(k * (.3 + Math.random() * .4))) });
    for (const p of M.sparks) { const a = 1 - p.t / p.life; ctx.fillStyle = 'rgba(255,' + Math.round(140 + 90 * a) + ',60,' + a.toFixed(2) + ')'; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz); }
    const tag = 'Õõnsus tõuseb. Hoia valgust!';
    tx(tag, cx, wy + PX.LINE * k + 5 * ps, ps, c.dim, { align: 'c' });
  }
  // The run setup (screen 'heat'): difficulty (G.diff), Heat when a tier is open, and for the campaign the land it
  // starts from (picked on the map). Alusta (hgo) starts the run.
  function drawHeat() {
    dim(.45);
    const h = M.heatPick, c = C(), dk = diffKey(M.diffPick), D = DIFF[dk], camp = M.heatMode === 'campaign', L = M.startLevel | 0;
    const items = [{ t: 'title', text: M.heatMode === 'night' ? 'Pikk Öö' : L >= CAMPAIGN_LANDS ? 'Teine vaatus' : 'Seiklus' }];
    if (camp) items.push({ t: 'text', text: BIOMES[L % ACT_LANDS].name + ' · Maa ' + (L % ACT_LANDS + 1) + '/' + ACT_LANDS + (landStars(L) ? ' · parim ' + landStars(L) + ' tähte' : ''), col: c.dim });
    items.push({ t: 'sep' }, { t: 'text', text: 'Raskus', col: c.amber });
    items.push({ t: 'btns', list: DIFF_KEYS.map(k => ({ id: 'd' + k, label: DIFF[k].name, fn: () => diffSet(k), on: k === dk, col: k === dk ? DIFF[k].col : null })) });
    items.push({ t: 'text', text: D.tip + (camp ? ' Tähti kuni ' + D.stars + '.' : ''), col: '#ffd9a8' });
    if (META.heatMax > 0) {
      items.push({ t: 'sep' });
      items.push({ t: 'btns', list: [{ id: 'hdn', label: '<', fn: () => heatStep(-1), off: h <= 0 }, { id: 'hcur', label: 'Kuumus ' + h, fn: () => {}, on: true, nav: false, col: h ? c.ember : c.amber }, { id: 'hup', label: '>', fn: () => heatStep(1), off: h >= META.heatMax }] });
      items.push({ t: 'text', text: h ? HEAT[h].name + ': ' + HEAT[h].tip : HEAT[0].tip, col: '#ffd9a8' });
      if (h > 1) for (let i = 1; i < h; i++) items.push({ t: 'text', text: HEAT[i].name + ': ' + HEAT[i].tip, col: c.dim, c: false });
      if (META.heatMax < HEAT_MAX) items.push({ t: 'text', text: 'Jõua Kuumusel ' + META.heatMax + ' maale ' + HEAT_UNLOCK_LAND + ', et avada Kuumus ' + (META.heatMax + 1) + '.', col: c.dim });
    }
    items.push({ t: 'gap' });
    items.push({ t: 'row', l: 'Söed', r: '×' + (Math.round(heatMul(h) * D.embers * 100) / 100).toFixed(2), rc: c.amber });
    items.push({ t: 'btns', list: [{ id: 'hgo', label: 'Alusta', fn: () => begin(M.heatMode, h), col: c.amber }, { id: 'hback', label: 'Tagasi', fn: () => M.back() }] });
    panel(items, { cap: 220 });
  }
  function diffSet(k) { if (!DIFF[k] || M.diffPick === k) return; M.diffPick = k; sfx('heatSelect', CAM.x, CAM.z, .8, DIFF_KEYS.indexOf(k) / 3); }
  function diffStep(d) { const i = clamp(DIFF_KEYS.indexOf(diffKey(M.diffPick)) + d, 0, DIFF_KEYS.length - 1); diffSet(DIFF_KEYS[i]); }
  // The campaign map (screen 'map'): the six lands of an act as cards with their stars; Act II behind its tab once Act I
  // is done. A land opens when the one before it has a star; picking one goes on to the setup.
  function drawMap() {
    dim(.5);
    const c = C(), s = E.s, avW = E.Wr - E.iL - 8 * s, avH = E.Hb - E.iT - 8 * s, a2 = M.mapAct === 2 && act2Open(), base = a2 ? CAMPAIGN_LANDS : 0;
    const [sw] = PX.iconSize('star');
    const lay = ps => {
      const p = 5 * ps, L = PX.LINE * ps, gap = 3 * ps, bh = touchH(ps), ch = Math.max(L * 2 + 3 * ps + 2 * p, E.tch ? Math.round(58 * E.dpr) : 0);
      let cw = 0; for (let i = 0; i < ACT_LANDS; i++) cw = Math.max(cw, mw(BIOMES[i].name, ps) + 2 * p, 3 * (sw + 2) * ps + 2 * p);
      cw = Math.max(cw, 76 * ps);
      const cols = avW >= 3 * cw + 2 * gap + 2 * p && E.W > E.H ? 3 : 2, rows = Math.ceil(ACT_LANDS / cols);
      const w = Math.min(avW, Math.max(cols * cw + (cols - 1) * gap, mw('II vaatus', ps) * 2 + 12 * p, mw('Seiklus', ps + 1)) + 2 * p);
      const h = p + PX.LINE * (ps + 1) + gap * 2 + bh + gap * 2 + L + gap + rows * (ch + gap) + gap + bh + p;
      return { ps, p, L, gap, bh, ch, cols, rows, w, h, cw: Math.floor((w - 2 * p - (cols - 1) * gap) / cols), ok: h <= avH && cols * cw + (cols - 1) * gap + 2 * p <= avW + 1 };
    };
    let Ly = lay(s); while (Ly.ps > 2 && !Ly.ok) Ly = lay(Ly.ps - 1);
    const { ps, p, L, gap, bh, ch, cols, w, h, cw } = Ly, x = Math.round((E.iL + E.Wr) / 2 - w / 2), y = Math.round(clamp((E.H - h) / 2, E.iT + 4 * s, Math.max(E.iT + 4 * s, E.Hb - h)));
    UI.panelRect = { x, y, w, h };
    ctx.globalAlpha = sat(M.t * 6 + .25);
    UI.plate(x, y, w, h, { bd: c.bdHi });
    tx('Seiklus', x + w / 2, y + p, ps + 1, '#ffd9a8', { align: 'c' });
    let yy = y + p + PX.LINE * (ps + 1) + gap * 2;
    const tw2 = Math.floor((w - 2 * p - gap) / 2);
    button('mact1', x + p, yy, tw2, bh, 'I vaatus', ps, () => { M.mapAct = 1; }, { on: !a2 });
    button('mact2', x + p + tw2 + gap, yy, tw2, bh, 'II vaatus', ps, () => { if (act2Open()) M.mapAct = 2; }, { on: a2, off: !act2Open() });
    yy += bh + gap * 2;
    tx(act2Open() || !a2 ? 'Tähti: ' + starTotal(a2 ? 2 : 1) + '/' + ACT_LANDS * 3 + (a2 ? ' · öised maad' : '') : '', x + w / 2, yy, ps, c.dim, { align: 'c' });
    if (!act2Open()) tx('II vaatus avaneb, kui esimene on läbi.', x + w / 2, yy, ps, c.dim, { align: 'c' });
    yy += L + gap;
    for (let i = 0; i < ACT_LANDS; i++) {
      const Lv = base + i, open = landOpen(Lv), st = landStars(Lv), col = i % cols, row = Math.floor(i / cols), bx = x + p + col * (cw + gap), by = yy + row * (ch + gap);
      const b = button('mland' + i, bx, by, cw, ch, open ? BIOMES[i].name : '???', ps, () => { if (!open) return; M.startLevel = Lv; toSetup(); }, { off: !open, sub: ' ', col: open ? (st ? '#ffd9a8' : c.amber) : null });
      // The stars under the name: lit for the best result, dim for the rest ("Lukus" on a closed land).
      const ty = by + (UI.press === b.id ? (E.s > 2 ? Math.round(ps / 2) || 1 : 1) : 0) + Math.round((ch - (L * 2 + ps)) / 2) + ps + L + ps, k = ps, sx = bx + Math.round(cw / 2 - (3 * (sw + 2) - 2) * k / 2);
      if (open && typeof drawStars === 'function') drawStars(ctx, bx + cw / 2, ty - ps, st, Math.max(1, Math.round(ps * .8)), { align: 'c', t: M.t });
      else if (open) for (let j = 0; j < 3; j++) PX.icon(ctx, j < st ? 'star' : 'starEmpty', sx + j * (sw + 2) * k, ty - ps, k, j < st ? 1 : .6);
      else tx('Lukus', bx + cw / 2, ty, ps, '#5a5448', { align: 'c' });
    }
    const fy = y + h - p - bh;
    button('mback', x + p, fy, w - 2 * p, bh, 'Tagasi', ps, () => M.back(), { icon: 'back' });
    ctx.globalAlpha = 1;
  }
  // The stars a cleared campaign land gave (M.starCard from metaLandClear): big stars popping in one by one.
  function drawStarCard() {
    const q = M.starCard; if (!q || !inRun() || (G.phase !== 'clear' && G.phase !== 'crumble') || q.t > 4.2) return;
    const c = C(), s = E.s, [sw, sh] = PX.iconSize('star'), k = Math.max(3, Math.round(s * 2.2)), gap = 3 * k, ps = Math.max(2, s);
    const head = q.best && q.was ? 'Uus rekord!' : 'Tähed', sub = q.n < 3 ? (diffKey(G.diff) === 'kerge' && q.n >= 2 ? 'Kerge annab kuni 2 tähte' : 'Hoia rohkem elusid, et saada rohkem tähti') : 'Täiuslik!';
    const w = Math.max(3 * sw * k + 2 * gap, mw(sub, ps)) + 10 * s, hh = PX.LINE * (ps + 1) + sh * k + PX.LINE * ps + 16 * s;
    const x = Math.round((E.iL + E.Wr) / 2 - w / 2), y = Math.round(E.iT + (E.Hb - E.iT) * .26), a = sat(Math.min(q.t * 4, (4.2 - q.t) * 2));
    ctx.globalAlpha = a; UI.plate(x, y, w, hh, { bd: c.amber, bg: 'rgba(30,22,12,0.94)' });
    tx(head, x + w / 2, y + 4 * s, ps + 1, q.best && q.was ? '#fff0c8' : c.amber, { align: 'c' });
    const y0 = y + 4 * s + PX.LINE * (ps + 1) + 3 * s, x0 = Math.round(x + w / 2 - (3 * sw * k + 2 * gap) / 2);
    // Ash's pixel stars (44-juice.js) where the build has them: each pops in on its own beat.
    if (typeof drawStars === 'function') drawStars(ctx, x + w / 2, y0, q.n, Math.max(2, Math.round(k * .75)), { align: 'c', t: M.t, pop: [0, 1, 2].map(j => { const ti = q.t - .35 - j * .35; return j >= q.n ? 1 : ti < 0 ? 0 : 1 + .5 * Math.max(0, 1 - ti * 5); }) });
    else for (let j = 0; j < 3; j++) {
      const on = j < q.n, ti = q.t - .35 - j * .35, sx = x0 + j * (sw * k + gap);
      if (!on || ti < 0) { PX.icon(ctx, 'starEmpty', sx, y0, k, .5); continue; }
      const kk = Math.max(1, Math.round(k * (1 + .5 * Math.max(0, 1 - ti * 5)))), cx = sx + sw * k / 2, cy = y0 + sh * k / 2;
      ctx.save(); ctx.shadowColor = 'rgba(255,200,90,0.9)'; ctx.shadowBlur = 4 * k;
      PX.icon(ctx, 'star', Math.round(cx - sw * kk / 2), Math.round(cy - sh * kk / 2), kk, 1); ctx.restore();
    }
    tx(sub, x + w / 2, y0 + sh * k + 4 * s, ps, c.tx, { align: 'c' });
    ctx.globalAlpha = 1;
  }
  function drawConfirm() {
    dim(.45); const cf = M.conf || { title: '?', lines: [] }, c = C();
    panel([{ t: 'title', text: cf.title }].concat(cf.lines.map(l => ({ t: 'text', text: l }))).concat([{ t: 'gap' }, { t: 'btns', list: [{ id: 'cyes', label: cf.yes, fn: cf.fn, col: c.amber }, { id: 'cno', label: 'Tagasi', fn: () => M.back() }] }]), { cap: 190 });
  }
  function drawPause() {
    dim(.4); const c = C(), mods = activeMods();
    const items = [{ t: 'title', text: 'Paus' }, { t: 'text', text: G.B.bio.name + ' · ' + (act2Land() ? 'II vaatus · Maa ' + (G.level - CAMPAIGN_LANDS + 1) : 'Maa ' + landNo()) + ' · Laine ' + Math.max(1, landWave()) + '/' + G.wavesPerLand, col: c.tx }];
    items.push({ t: 'text', text: 'Raskus: ' + DIFF[diffKey(G.diff)].name, col: DIFF[diffKey(G.diff)].col });
    if (weekRule()) items.push({ t: 'text', text: 'Nädala katse: ' + weekRule().name, col: c.amber });
    if (G.heat || mods.length) items.push({ t: 'text', text: (G.heat ? 'Kuumus ' + G.heat : '') + (G.heat && mods.length ? ' · ' : '') + mods.map(m => m.name).join(', '), col: c.dim });
    items.push({ t: 'gap' }, { t: 'btns', stack: true, list: [
      { id: 'presume', label: 'Jätka', fn: () => M.close(), col: c.amber },
      { id: 'pset', label: 'Seaded', fn: () => UI.openSettings(true) },
      { id: 'pquit', label: 'Loobu mängust', fn: () => { const n = runEmbersNow(); confirm('Loobud mängust?', ['Teenitud söed jäävad sulle: ' + n + '.'], 'Loobu', () => { M.res = abandonRun(); openResults(); }, 'pause', () => { M.open('pause'); }); }, col: c.ember },
    ] });
    panel(items, { cap: 200, minW: 150 });
  }
  function runEmbersNow() { const run = META.run; if (!run) return 0; const sm = runSummary() || {}; return embersFor({ waves: sm.waves, bosses: sm.lands, level: G.level, level0: run.level0, heat: G.heat, diff: G.diff, ending: run.ending && !run.endingPaid, ending2: run.ending2 && !run.ending2Paid }).total; }
  function drawResults() {
    dim(.35); const c = C(), r = M.res || META.last;
    if (!r) { panel([{ t: 'title', text: 'Majakas kustus' }, { t: 'btns', list: [{ id: 'rmenu', label: 'Peamenüü', fn: toMenu }] }]); return; }
    const rc = M.rc || { t: 99, fan: [], fanAt: 0 }, T = rcTimes(r), win = r.how === 'victory';
    const sm = r.sum || {}, title = win ? (r.act === 'week' ? 'Katse läbitud!' : r.act === 2 ? 'Koit on käes' : 'Kuus tuld põleb') : r.how === 'abandon' ? 'Mängust loobutud' : r.how === 'rest' ? 'Hoidja puhkab' : 'Majakas kustus';
    const where = r.weekly && WEEK_RULES[r.weekly] ? WEEK_RULES[r.weekly].name + (r.landName ? ' · ' + r.landName : '') : r.mode === 'daily' ? 'Päeva väljakutse' + (r.daily ? ' · ' + r.daily.day : '') : (r.landName ? r.landName + ' · ' : '') + 'Maa ' + r.land + (r.heat ? ' · Kuumus ' + r.heat : '') + (r.diff && r.diff !== 'tavaline' ? ' · ' + DIFF[r.diff].name : '');
    const items = [{ t: 'title', text: title, col: win ? c.amber : '#ffd9a8' }, { t: 'text', text: where, col: c.dim }];
    items.push({ t: 'row', l: 'Läbitud laineid', r: '' + (sm.waves || 0) }, { t: 'row', l: 'Kaitstud maid', r: '' + (sm.lands || 0) }, { t: 'row', l: 'Võidetud koletisi', r: '' + (sm.slain || 0) });
    if (sm.tower) items.push({ t: 'row', l: 'Parim torn', r: sm.tower.name + ' · ' + sm.tower.kills });
    if (r.daily) items.push({ t: 'row', l: 'Tänane parim', r: r.daily.best + ' lainet', rc: r.daily.newBest ? c.amber : c.tx });
    if (r.xp) items.push({ t: 'row', l: 'Kogemust', r: '+' + r.xp + ' · tase ' + keeperLevel().lv, rc: c.ok });
    items.push({ t: 'sep' });
    // The ember sources count up one after another, then the total.
    emberRows(r).forEach(([l, v], i) => { const k = sat((rc.t - RC.lead - i * RC.row) / RC.row); items.push({ t: 'row', l, r: '' + Math.round(v * k), rc: k >= 1 ? c.tx : c.amber }); });
    if (r.heat) items.push({ t: 'row', l: 'Kuumus ' + r.heat, r: '×' + (r.heatMul || r.mul).toFixed(2), rc: c.ember });
    if (r.diffMul && r.diffMul !== 1) items.push({ t: 'row', l: DIFF[r.diff].name, r: '×' + r.diffMul.toFixed(2), rc: DIFF[r.diff].col });
    const kt = sat((rc.t - T.t0) / RC.total), tot = Math.round(r.total * (1 - Math.pow(1 - kt, 2)));
    items.push({ t: 'big', text: '+' + tot + ' sütt' + (win ? ' seni' : ''), col: kt >= 1 && (rc.t - T.end) < .25 ? '#fff0c8' : c.amber });
    items.push({ t: 'text', text: win ? 'Lähevad kirja, kui mäng lõpeb. Sul on ' + META.embers + '.' : 'Sul on ' + Math.round((r.before || 0) + (r.after - (r.before || 0)) * (1 - Math.pow(1 - kt, 2))) + ' sütt.', col: c.tx });
    const port = E.H > E.W * 1.1;
    const list = win && r.act === 'week' ? [
      { id: 'rrest', label: 'Kogu söed', fn: restRun, col: c.amber },
      { id: 'rtree', label: 'Hoidja puu', fn: () => M.open('tree', { from: 'results' }), icon: 'ember' },
    ] : win ? [
      r.act === 2 ? { id: 'rnight', label: 'Pikka Öösse', fn: intoNight, col: c.amber } : { id: 'ract2', label: 'Teise vaatusse', fn: intoNight, col: c.amber },
      { id: 'rtree', label: 'Hoidja puu', fn: () => M.open('tree', { from: 'results' }), icon: 'ember' },
      { id: 'rrest', label: 'Kogu söed ja puhka', fn: restRun },
    ] : [
      { id: 'ragain', label: 'Mängi uuesti', fn: () => { const h = r.heat || 0, md = r.mode, lv = META.run && md === 'campaign' ? META.run.level0 : 0; UI.scr = null; M.wasPaused = false; startRun(md, h, { diff: r.diff, level: lv, weekly: r.weekly }); }, col: c.amber },
      { id: 'rtree', label: 'Hoidja puu', fn: () => M.open('tree', { from: 'results' }), icon: 'ember' },
      { id: 'rmenu', label: 'Peamenüü', fn: toMenu },
    ];
    items.push({ t: 'btns', stack: port, list });
    // The unlocks ring one by one under the buttons, each line fading in as it rings. The panel keeps their room below
    // (o.ghost) and grows into it, so neither the panel nor its buttons move, and no blank lines wait for them.
    const fan = rc.fan.map((f, i) => ({ t: 'text', text: f.text, col: f.col, a: i < rc.fanAt ? (rc.t - (T.end + .3 + i * RC.fan)) / .3 : 0 }));
    const rung = fan.filter((f, i) => i < rc.fanAt), ghost = fan.slice(rung.length);
    if (fan.length) { if (rung.length) items.push({ t: 'sep' }, ...rung); else ghost.unshift({ t: 'sep' }); }
    panel(items, { cap: 200, minW: 150, bd: win ? c.amber : c.ember, ghost });
  }
  function drawArrival() {
    dim(.25); const c = C(), mods = activeMods();
    const items = [{ t: 'title', text: G.B.bio.name }, { t: 'text', text: G.mode === 'daily' ? 'Päeva väljakutse · Maa ' + nightDepth() + ' · ' + ((META.run && META.run.day) || dailyDate()) : act2Land() ? 'Teine vaatus · Maa ' + (G.level - CAMPAIGN_LANDS + 1) + '/' + CAMPAIGN_LANDS : G.level >= CAMPAIGN_LANDS ? 'Pikk Öö · Maa ' + landNo() : 'Maa ' + landNo() + '/' + CAMPAIGN_LANDS, col: c.dim }];
    if (G.heat) items.push({ t: 'text', text: 'Kuumus ' + G.heat + ' · ' + HEAT[G.heat].name, col: c.ember });
    items.push({ t: 'sep' });
    const WR = weekRule(); if (WR) items.push({ t: 'mod', icon: WR.icon, name: 'Nädala katse: ' + WR.name, tip: WR.tip, col: c.amber });
    for (const m of mods) items.push({ t: 'mod', icon: m.icon, name: m.name, tip: m.tip, col: MUTATORS[m.key] && MUTATORS[m.key].boon ? c.ok : c.amber });
    const list = [{ id: 'abegin', label: 'Alusta', fn: () => M.close(), col: c.amber }];
    if (G.rerolls > 0 && !G.weekly && typeof rollMods === 'function') list.push({ id: 'areroll', label: 'Uus loos (' + G.rerolls + ')', fn: () => { if (rerollMods()) M.t = .1; }, icon: 'lantern' });
    items.push({ t: 'gap' }, { t: 'btns', list });
    panel(items, { cap: 200 });
  }
  function drawTree() {
    dim(.5);
    const c = C(), s = E.s, avW = E.Wr - E.iL - 8 * s, avH = E.Hb - E.iT - 8 * s, N = UPGRADES.length;
    const icw = Math.max(...UPGRADES.map(u => PX.iconSize(u.icon)[0])) + 3;
    const lay = ps => {
      const p = 4 * ps, L = PX.LINE * ps, gap = 3 * ps;
      let cw = 0; for (const u of UPGRADES) { const l = META.up[u.key] || 0; cw = Math.max(cw, icw * ps + mw(u.name, ps) + 6 * ps + u.max * 5 * ps, icw * ps + mw(u.fmt(u.v(Math.max(1, l))), ps) + 6 * ps + mw('000', ps) + 10 * ps); }
      cw += 2 * p; const ch = Math.max(L * 2 + 2 * p, E.tch ? Math.round(44 * E.dpr) : 0);
      let cols = Math.max(1, Math.min(3, Math.floor((avW - 2 * p + gap) / (cw + gap))));
      // Prefer fewer, wider columns when the rows still fit.
      const head = PX.LINE * (ps + 1) + gap * 2, foot = L * 3 + 2 * p + touchH(ps) + gap * 2;
      while (cols > 1 && Math.ceil(N / (cols - 1)) * (ch + gap) + head + foot + 2 * p <= avH) cols--;
      const rows = Math.ceil(N / cols), w = Math.min(avW, cols * cw + (cols - 1) * gap + 2 * p), h = 2 * p + head + rows * (ch + gap) + foot;
      return { ps, p, L, gap, cw: Math.floor((w - 2 * p - (cols - 1) * gap) / cols), ch, cols, rows, w, h, head, ok: h <= avH && cw * cols + (cols - 1) * gap + 2 * p <= avW + 1 };
    };
    let Ly = lay(s); while (Ly.ps > 2 && !Ly.ok) Ly = lay(Ly.ps - 1);
    const { ps, p, L, gap, cw, ch, cols, w, h, head } = Ly, x = Math.round((E.iL + E.Wr) / 2 - w / 2), y = Math.round(clamp((E.H - h) / 2, E.iT + 4 * s, Math.max(E.iT + 4 * s, E.Hb - h)));
    M.treeCols = cols; UI.panelRect = { x, y, w, h };
    ctx.globalAlpha = sat(M.t * 6 + .25);
    UI.plate(x, y, w, h, { bd: c.bdHi });
    tx('Hoidja puu', x + p, y + p, ps + 1, '#ffd9a8');
    const et = '' + META.embers, ew = mw(et, ps + 1); tx(et, x + w - p, y + p, ps + 1, c.amber, { align: 'r' }); PX.icon(ctx, 'ember', x + w - p - ew - 11 * (ps + 1) / 1.2, y + p, ps + 1, 1);
    const y0 = y + p + head;
    UPGRADES.forEach((u, i) => {
      const col = i % cols, row = Math.floor(i / cols), bx = x + p + col * (cw + gap), by = y0 + row * (ch + gap), lv = META.up[u.key] || 0, cost = upCost(u.key), can = cost && META.embers >= cost, sel = M.treeSel === i;
      const hot = E.over(bx, by, cw, ch), down = UI.press === 'u' + u.key, focus = M.kb && M.sel === i;
      const b = { id: 'u' + u.key, x: bx, y: by, w: cw, h: ch, fn: () => { if (M.treeSel === i && !UI.touch && !M.kb) tryBuy(i); M.treeSel = i; M.sel = i; sfx('uiHover', CAM.x, CAM.z, .7); }, hud: true };
      UI.btns.push(b); M.items.push({ fn: () => tryBuy(i) }); if (hot) UI.hudHot = true;
      UI.plate(bx, by + (down ? 1 : 0), cw, ch, sel || focus ? { bd: c.bdHi, bg: c.bg2, hi: 'rgba(232,176,74,0.18)' } : hot ? { bd: '#8a6a3a', bg: c.bg2 } : lv >= u.max ? { bd: '#6a5a30', bg: 'rgba(40,32,18,0.95)' } : { bg: 'rgba(16,18,27,0.96)' });
      const iy = by + Math.round(ch / 2 - PX.iconSize(u.icon)[1] * ps / 2);
      PX.icon(ctx, u.icon, bx + p + Math.round((icw - 3 - PX.iconSize(u.icon)[0]) * ps / 2), iy, ps, lv ? 1 : .55);
      const ty = by + Math.round((ch - L * 2) / 2) + ps;
      tx(u.name, bx + p + icw * ps, ty, ps, lv ? '#ffd9a8' : c.tx);
      for (let k = 0; k < u.max; k++) { const px = bx + cw - p - (u.max - k) * 5 * ps + ps, q = Math.max(1, ps >> 1); ctx.fillStyle = c.dark; ctx.fillRect(px, ty + ps, 4 * ps, 4 * ps); ctx.fillStyle = k < lv ? c.amber : '#3a342c'; ctx.fillRect(px + q, ty + ps + q, 4 * ps - 2 * q, 4 * ps - 2 * q); }
      tx(lv ? u.fmt(u.v(lv)) : 'Õppimata', bx + p + icw * ps, ty + L, ps, lv ? c.ok : c.dim);
      if (cost) { const ct = '' + cost; tx(ct, bx + cw - p, ty + L, ps, can ? c.amber : c.red, { align: 'r' }); PX.icon(ctx, 'ember', bx + cw - p - mw(ct, ps) - 10 * ps, ty + L, ps, can ? 1 : .5); }
      else tx('Täis', bx + cw - p, ty + L, ps, c.amber, { align: 'r' });
    });
    // The chosen upgrade: what it does now and next, and Buy.
    const u = UPGRADES[M.treeSel], lv = META.up[u.key] || 0, cost = upCost(u.key), can = cost && META.embers >= cost, fy = y0 + Ly.rows * (ch + gap) + gap;
    tx(u.name + ': ' + u.desc, x + p, fy, ps, c.tx);
    tx((lv ? 'Nüüd ' + u.fmt(u.v(lv)) : 'Veel õppimata') + (cost ? ' · Järgmine ' + u.fmt(u.v(lv + 1)) : ' · täiesti õpitud'), x + p, fy + L + ps, ps, cost ? c.ok : c.dim);
    const bh = touchH(ps), bw = Math.floor((w - 2 * p - gap) / 2), by = y + h - p - bh;
    button('tbuy', x + p, by, bw, bh, cost ? 'Õpi · ' + cost : 'Õpitud', ps, () => tryBuy(M.treeSel), { off: !can, col: can ? c.amber : null, icon: cost ? 'ember' : null });
    button('tback', x + p + bw + gap, by, bw, bh, 'Tagasi', ps, () => M.back(), { icon: 'back' });
    ctx.globalAlpha = 1;
  }
  function tryBuy(i) {
    const u = UPGRADES[i]; M.treeSel = i;
    if (buyUpgrade(u.key)) { buzz([12, 30, 20]); M.flash = 1; } else sfx('uiDeny', CAM.x, CAM.z, .6);
  }
  function drawCodex() {
    dim(.5);
    const c = C(), s = E.s, avW = E.Wr - E.iL - 8 * s, avH = E.Hb - E.iT - 8 * s, tab = M.tab;
    let ps = s; const p0 = ps => 5 * ps;
    // Width first: about 230 font pixels where the screen allows.
    while (ps > 2 && (mw('Koletised', ps) + mw('Lugu', ps) + mw('Trofeed', ps) + mw('Rekordid', ps) + 16 * p0(ps) + 9 * ps > avW || PX.LINE * ps * 14 > avH)) ps--;
    const p = p0(ps), L = PX.LINE * ps, gap = 3 * ps, w = Math.min(avW, Math.max(230 * ps, mw('Koletised', ps) * 4)), inner = w - 2 * p, bh = touchH(ps);
    const h = Math.min(avH, Math.max(L * 16, Math.round(avH * .9))), x = Math.round((E.iL + E.Wr) / 2 - w / 2), y = Math.round(clamp((E.H - h) / 2, E.iT + 4 * s, E.Hb - h));
    UI.panelRect = { x, y, w, h };
    ctx.globalAlpha = sat(M.t * 6 + .25);
    UI.plate(x, y, w, h, { bd: c.bdHi });
    // Tabs.
    const tw = Math.floor((inner - 3 * gap) / 4), tabs = [['beasts', 'Koletised'], ['story', 'Lugu'], ['feats', mw('Saavutused', ps) + 2 * p <= tw ? 'Saavutused' : 'Trofeed'], ['records', 'Rekordid']];
    tabs.forEach(([k, l], i) => button('ct' + k, x + p + i * (tw + gap), y + p, tw, bh, l, ps, () => { M.tab = k; M.page = 0; }, { on: tab === k }));
    const y0 = y + p + bh + gap * 2, foot = bh + gap, avail = y + h - p - foot - y0;
    let rows = [];
    if (tab === 'beasts') {
      const keys = Object.keys(MON).filter(k => k !== 'slimelet'), seen = keys.filter(k => META.seen[k]).length;
      tx('Kohatud: ' + seen + '/' + keys.length, x + p, y0, ps, c.dim);
      const rh = L * 3 + gap, per = Math.max(1, Math.floor((avail - L - gap) / rh)); M.pages = Math.ceil(keys.length / per); M.page = Math.min(M.page, M.pages - 1);
      keys.slice(M.page * per, M.page * per + per).forEach((k, i) => {
        const d = MON[k], yy = y0 + L + gap + i * rh, known = META.seen[k];
        tx(known ? (d.boss ? 'Pealik: ' : '') + d.name : '???', x + p, yy, ps, known ? (d.boss ? c.ember : c.amber) : '#5a5448');
        if (known) wrap(d.tip || 'Luud ja viha. Kõige tavalisem surnu.', inner, ps).slice(0, 2).forEach((l, j) => tx(l, x + p, yy + L * (j + 1), ps, c.tx));
      });
    } else if (tab === 'story') {
      const ids = BEAT_ORDER.filter(k => BEATS[k]), rh = Math.max(bh, L + 2 * p) + gap, per = Math.max(1, Math.floor(avail / rh)); M.pages = Math.ceil(ids.length / per); M.page = Math.min(M.page, M.pages - 1);
      ids.slice(M.page * per, M.page * per + per).forEach((k, i) => {
        const yy = y0 + i * rh, known = META.story[k];
        button('cs' + k, x + p, yy, inner, rh - gap, known ? BEATS[k].title : '???', ps, () => { if (known) STORY.play(k, { replay: true }); }, { off: !known, offOk: false });
      });
    } else if (tab === 'feats') {
      // Achievements: earned ones lit, the rest dim with the way to earn them.
      tx('Teenitud: ' + achCount() + '/' + ACH.length, x + p, y0, ps, c.dim);
      // Round 14 fix: a tip that wraps showed only its first line (cut mid-sentence on phones); now up to two lines.
      const two = ACH.some(a => wrap(a.tip, inner - 13 * ps, ps).length > 1), rh = L * (two ? 3 : 2) + gap * 2, per = Math.max(1, Math.floor((avail - L - gap) / rh)); M.pages = Math.ceil(ACH.length / per); M.page = Math.min(M.page, M.pages - 1);
      ACH.slice(M.page * per, M.page * per + per).forEach((a, i) => {
        const yy = y0 + L + gap + i * rh, got = !!META.ach[a.id], ic = PX.iconSize(a.icon)[0] ? a.icon : 'star', [iw, ih] = PX.iconSize(ic);
        PX.icon(ctx, ic, x + p + Math.round((10 - iw) * ps / 2), yy + Math.round((L * 2 - ih * ps) / 2), ps, got ? 1 : .3);
        tx(a.name, x + p + 13 * ps, yy, ps, got ? c.amber : '#7a7262');
        wrap(a.tip, inner - 13 * ps, ps).slice(0, 2).forEach((tl, j) => tx(tl, x + p + 13 * ps, yy + L * (j + 1), ps, got ? c.tx : c.dim));
      });
      tx((M.page + 1) + '/' + M.pages, x + w - p, y0, ps, c.dim, { align: 'r' });
    } else {
      const S = META.stats, tm = Math.round(S.time / 60);
      rows = [['Mänge', S.runs], ['Teenitud sütt', META.earned], ['Sütt praegu', META.embers], ['Parim laine', S.bestWave], ['Sügavaim maa', S.bestLand], ['Sügavaim öömaa', S.bestNight], ['Läbitud seiklusi', S.campaigns], ['Avatud Kuumus', META.heatMax], ['Võidetud koletisi', S.slain], ['Võidetud pealikke', S.bosses], ['Mänguaeg', (tm >= 60 ? Math.floor(tm / 60) + ' h ' : '') + (tm % 60) + ' min'], ['Pooleli jäetud', S.abandons], ['Võidetud eliite', S.elites], ['Saavutusi', achCount() + '/' + ACH.length], ['Päeva väljakutseid', S.dailies], ['Tänane parim', dailyBest() + ' lainet'], ['Tähti: I vaatus', starTotal(1) + '/' + ACT_LANDS * 3], ['Tähti: II vaatus', starTotal(2) + '/' + ACT_LANDS * 3], ['Läbitud II vaatusi', S.act2 || 0], ['Püütud kullakotte', S.sacks || 0]];
      const rh = L + ps, per = Math.max(1, Math.floor(avail / rh)); M.pages = Math.ceil(rows.length / per); M.page = Math.min(M.page, M.pages - 1);
      rows.slice(M.page * per, M.page * per + per).forEach((r, i) => { const yy = y0 + i * rh; tx(r[0], x + p, yy, ps, c.dim); tx('' + r[1], x + w - p, yy, ps, c.tx, { align: 'r' }); });
    }
    // Pager and Back.
    const fy = y + h - p - bh, nb = M.pages > 1, bw3 = Math.floor((inner - 2 * gap) / 3);
    if (nb) {
      button('cprev', x + p, fy, bw3, bh, '<', ps, () => pageStep(-1), { off: M.page <= 0 });
      button('cnext', x + w - p - bw3, fy, bw3, bh, '>', ps, () => pageStep(1), { off: M.page >= M.pages - 1 });
      if (tab === 'beasts') tx((M.page + 1) + '/' + M.pages, x + w - p, y0, ps, c.dim, { align: 'r' });
    }
    button('cback', nb ? x + p + bw3 + gap : x + p, fy, nb ? bw3 : inner, bh, 'Tagasi', ps, () => M.back(), { icon: 'back' });
    ctx.globalAlpha = 1;
  }

  // ---- the story panel ----
  function drawStory() {
    const q = STORY.cur, lines = STORY.lines(), ln = lines[STORY.line], who = SPEAKERS[ln[0]] || SPEAKERS.ghost, c = C(), s = E.s;
    const avW = E.Wr - E.iL - 8 * s, avH = E.Hb - E.iT - 8 * s;
    dim(.22);
    const lay = ps => {
      const p = 5 * ps, L = PX.LINE * ps, pk = Math.max(2, Math.round(L * 4.6 / 16)), PP = pk * 16;
      const w = Math.min(avW, 300 * ps), tw = w - PP - 3 * p;
      let mx = 1; for (const l of lines) mx = Math.max(mx, wrap(l[1], tw, ps).length);
      const h = Math.max(PP + 2 * p, p + L + gap(ps) + mx * L + gap(ps) + L + p);
      return { ps, p, L, pk, PP, w, tw, h, ok: h <= avH * .55 && tw >= 90 * ps };
    };
    const gap = ps => 3 * ps;
    let Ly = lay(s); while (Ly.ps > 2 && !Ly.ok) Ly = lay(Ly.ps - 1);
    const { ps, p, L, pk, PP, w, tw, h } = Ly, x = Math.round((E.iL + E.Wr) / 2 - w / 2), y = Math.round(E.Hb - h - 6 * s);
    UI.panelRect = { x, y, w, h };
    const a = sat(STORY.t * 6 + (STORY.line ? 1 : .2));
    ctx.globalAlpha = a;
    UI.plate(x, y, w, h, { bd: who.col === SPEAKERS.keeper.col ? c.bdHi : '#5a7a9a' });
    // Portrait in a dark frame, with a faint glow for the ghost.
    const px = x + p, py = y + p;
    ctx.fillStyle = '#05060a'; ctx.fillRect(px - pk, py - pk, PP + 2 * pk, PP + 2 * pk);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (ln[0] === 'ghost') { ctx.globalAlpha = a * (.8 + .15 * Math.sin(M.t * 3)); ctx.shadowColor = 'rgba(160,210,255,0.8)'; ctx.shadowBlur = pk * 3; }
    if (ln[0] === 'hollow') { ctx.shadowColor = 'rgba(160,110,255,0.7)'; ctx.shadowBlur = pk * 3; }
    ctx.drawImage(portraitCanvas(ln[0]), px, py, PP, PP); ctx.restore(); ctx.globalAlpha = a;
    const tx0 = px + PP + 2 * p;
    tx(who.name, tx0, y + p, ps, who.col);
    const wl = wrap(ln[1], tw, ps); let left = Math.floor(STORY.chars);
    wl.forEach((l, i) => { if (left <= 0) return; const part = l.slice(0, left); left -= l.length + 1; tx(part, tx0, y + p + L + gap(ps) + i * L, ps, c.tx); });
    // Continue hint and Skip.
    const done = STORY.chars >= ln[1].length, hint = (STORY.line < lines.length - 1 ? (E.tch ? 'Puuduta' : 'Tühik') + ' →' : (E.tch ? 'Puuduta, et sulgeda' : 'Tühik sulgeb')) + '  ' + (STORY.line + 1) + '/' + lines.length;
    if (done) tx(hint, x + w - p, y + h - p - L + ps, ps, (M.t * 2) % 2 < 1.4 ? c.amber : c.dim, { align: 'r' });
    const sk = 'Jäta vahele', sw = mw(sk, ps) + 2 * p, sh = Math.max(L + p, E.tch ? Math.round(32 * E.dpr) : 0);
    button('stskip', x + w - sw - ps, y - sh - 2 * ps, sw, sh, sk, ps, () => STORY.skip(), { nav: false });
    ctx.globalAlpha = 1;
  }

  // ---- the tutorial guide ----
  function drawTutorial() {
    const tt = TUT.text(); if (!tt) return;
    const c = C(), s = E.s, avW = E.Wr - E.iL - 8 * s, ps = Math.max(2, s - (E.tch ? 0 : 0)), p = 5 * ps, L = PX.LINE * ps;
    // Round 14: the step's icon, big, on the left (TUT.text()[2]).
    const ic = tt[2] && PX.iconSize(tt[2])[0] ? tt[2] : null, ik = ps * 2, icw = ic ? PX.iconSize(ic)[0] * ik + 4 * ps : 0;
    const w = Math.min(avW, Math.max(mw(tt[0], ps) + 60 * ps + icw, Math.min(avW, 200 * ps))), lines = wrap(tt[1], w - 2 * p - icw, ps);
    const sk = 'Jäta õpetus vahele', skw = mw(sk, Math.max(2, ps - 1)) + 2 * p, skh = Math.max(L + p, E.tch ? Math.round(30 * E.dpr) : 0);
    const h = Math.max(p + L + lines.length * L + p, ic ? PX.iconSize(ic)[1] * ik + 2 * p : 0), x = Math.round((E.iL + E.Wr) / 2 - w / 2), y = Math.round(Math.max((R.hudTop || E.iT) + 30 * s, (UI.yUp || E.Hb) - h - 3 * s));
    const a = TUT.step === 'done' ? sat((4.5 - TUT.t) * 2) : sat(TUT.t * 3);
    ctx.globalAlpha = a;
    UI.plate(x, y, w, h, { bd: c.ember });
    if (ic) PX.icon(ctx, ic, x + p, y + Math.round((h - PX.iconSize(ic)[1] * ik) / 2), ik, 1);
    tx(tt[0], x + p + icw, y + p - ps, ps, c.amber);
    lines.forEach((l, i) => tx(l, x + p + icw, y + p - ps + L * (i + 1), ps, c.tx));
    if (TUT.step !== 'done') button('tutskip', x + w - skw, y - skh - ps, skw, skh, sk, Math.max(2, ps - 1), () => TUT.skip(), { nav: false });
    // Point at the thing to use.
    let ax = null, ay = null;
    if (TUT.step === 'build' && TUT.pad && !TUT.pad.tower && !UI.menu) { const q = UI.proj(TUT.pad.x, TUT.pad.y + 1.6, TUT.pad.z); ax = q.x; ay = q.y; }
    else if (TUT.step === 'upgrade' && !UI.menu) { const t = G.towers.find(t => t.alive && t.def && t.lvl === 0 && t.state === 'active'); if (t) { const q = UI.proj(t.x, t.y + Math.min(3.6, t.mounts ? t.mounts.top : 2.5) + .8, t.z); ax = q.x; ay = q.y; } }
    else if (TUT.step === 'call' && UI.waveRect) { ax = UI.waveRect.x + UI.waveRect.w / 2; ay = UI.waveRect.y + UI.waveRect.h + 12 * s; }
    else if (TUT.step === 'spell' && !UI.spell) { const k = SPELL_KINDS.find(k => spellReady(k)), b = k && UI.hud.find(h => h.id === 'sp' + k); if (b) { ax = b.x + b.w / 2; ay = b.y - 14 * s; } }
    if (ax !== null) {
      const up = TUT.step === 'call', bob = Math.sin(M.t * 6) * 3 * s, k = Math.max(4, s * 2), g = up ? '↑' : '↓';
      tx(g, ax, ay + (up ? -bob : bob) - (up ? 0 : PX.LINE * k), k, '#ffc870', { align: 'c', outline: '#2a0c04' });
    }
    ctx.globalAlpha = 1;
  }

  // ---- HUD: Heat badge and mutator icons under the top plates ----
  function drawModHud() {
    if (!inRun() || G.phase !== 'play' || UI.scr) return;
    const mods = activeMods(); if (!mods.length && !G.heat) return;
    const c = C(), s = E.s, ps = Math.max(2, s - 1), p = 2 * ps, sz = 10 * ps + 2 * p, gap = 2 * ps, ents = [];
    if (G.heat) ents.push({ id: 'hudheat', icon: 'heat', label: '' + G.heat, head: 'Kuumus ' + G.heat + ' · ' + HEAT[G.heat].name, tip: HEAT.slice(1, G.heat + 1).map(h => h.tip).join(' ') });
    for (const m of mods) ents.push({ id: 'hudmod' + m.key, icon: m.icon && PX.iconSize(m.icon)[0] ? m.icon : 'heat', head: m.name, tip: m.tip, boon: MUTATORS[m.key] && MUTATORS[m.key].boon });
    let tw = 0; for (const e of ents) tw += sz + (e.label ? mw(e.label, ps) + ps : 0) + gap; tw -= gap;
    let x = Math.round((E.iL + E.Wr) / 2 - tw / 2); const y = Math.round((R.hudTop || E.iT) + 3 * s);
    for (const e of ents) {
      const w = sz + (e.label ? mw(e.label, ps) + ps : 0), hot = E.over(x, y, w, sz);
      UI.hud.push({ id: e.id, x, y, w, h: sz, hud: true, fn: () => { M.hudTip = { head: e.head, tip: e.tip, t: 0 }; sfx('uiHover', CAM.x, CAM.z, .6); } }); if (hot) { UI.hudHot = true; if (!M.hudTip || M.hudTip.head !== e.head) M.hudTip = { head: e.head, tip: e.tip, t: 3.5 }; }
      UI.plate(x, y, w, sz, { bd: hot ? c.bdHi : e.boon ? '#5f8a50' : e.id === 'hudheat' ? c.ember : '#6a4a3a', bg: 'rgba(9,11,17,0.8)' });
      const [iw, ih] = PX.iconSize(e.icon); PX.icon(ctx, e.icon, x + p + Math.round((10 * ps - iw * ps) / 2), y + Math.round((sz - ih * ps) / 2), ps, 1);
      if (e.label) tx(e.label, x + sz, y + Math.round((sz - PX.LINE * ps) / 2) + ps, ps, c.ember);
      x += w + gap;
    }
    if (M.hudTip) {
      const t = M.hudTip, a = sat((5 - t.t) * 2), lines = wrap(t.tip, Math.min(E.Wr - E.iL - 20 * s, 180 * ps), ps), pp = 4 * ps, L = PX.LINE * ps;
      let w = mw(t.head, ps); for (const l of lines) w = Math.max(w, mw(l, ps)); w += 2 * pp; const h = L * (lines.length + 1) + 2 * pp - ps, xx = Math.round((E.iL + E.Wr) / 2 - w / 2), yy = y + sz + 2 * s;
      ctx.globalAlpha = a; UI.plate(xx, yy, w, h, { bd: c.bdHi }); tx(t.head, xx + pp, yy + pp - ps, ps, c.amber); lines.forEach((l, i) => tx(l, xx + pp, yy + pp - ps + L * (i + 1), ps, c.tx)); ctx.globalAlpha = 1;
    }
  }

  // ---- the countdown before a land's first wave (G.count, 62-game.js): big pixel numbers, then "Alusta!" ----
  // Each number pops in and settles; a tap on it (or Space, Enter) starts the wave at once.
  function drawCount() {
    const n = G.count; if (n === null || n === undefined || !inRun() || G.phase !== 'play' || STORY.on()) return;
    const c = C(), s = E.s, txt = n > 0 ? '' + n : 'Alusta!', f = Math.max(0, G.countT - Math.floor(G.countT));
    const k0 = Math.max(4, Math.floor(Math.min(E.W, E.H) * (n > 0 ? .2 : .1) / PX.LINE));
    let k = Math.round(k0 * (1 + .3 * Math.max(0, 1 - f * 5)));
    while (k > 2 && PX.measure(txt) * k > (E.Wr - E.iL) * .9) k--;
    // Round 14 fix: an open tower or build menu sits over the numbers (they faded over its buttons and text before).
    const a = (UI.menu ? .18 : 1) * (n > 0 ? .65 + .35 * sat((1 - f) * 2) : sat((COUNT_FROM + .9 - G.countT) * 3));
    const w = PX.measure(txt) * k, h = PX.LINE * k, cx = Math.round((E.iL + E.Wr) / 2), cy = Math.round((E.iT + E.Hb) / 2 - h * .8);
    // Ash (round 13): chunky bevelled digits with a glow, a pop and sparks each second, a burst on "Alusta!" (44-juice.js).
    if (typeof drawCountBig === 'function') drawCountBig(ctx, n, f, cx, cy, k, a);
    else {
      ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = n > 0 ? 'rgba(255,150,60,0.8)' : 'rgba(255,215,130,0.9)'; ctx.shadowBlur = k * 4;
      PX.text(ctx, txt, cx, cy, k, n > 0 ? '#ffc870' : '#ffe2a0', { align: 'c', outline: '#2a0c04' });
      ctx.restore();
    }
    if (n > 0 && !UI.menu) {
      const hs = Math.max(2, s - 1), hint = E.tch ? 'Puuduta, et kohe alustada' : 'Tühik alustab kohe';
      ctx.globalAlpha = .85; tx(hint, cx, cy + h + 4 * s, hs, c.tx, { align: 'c', outline: c.dark }); ctx.globalAlpha = 1;
      const bw = Math.max(w, PX.measure(hint) * hs) + 16 * s;
      UI.hud.push({ id: 'cntskip', x: cx - bw / 2, y: cy - 8 * s, w: bw, h: h + 16 * s + PX.LINE * hs, hud: true, fn: () => { if (countSkip()) buzz(10); } });
    }
  }

  // Called from UI.draw. hidden: the HUD was skipped (a screen is up). Returns nothing; registers controls.
  M.draw = (c, env) => {
    E = env; ctx = c; M.items.length = 0;
    const s = UI.scr;
    if (!s) { drawModHud(); if (TUT.step && !STORY.on()) drawTutorial(); if (!cineOn()) { drawCount(); drawStarCard(); } }
    // Settings open over a screen (the gear on the title, Seaded in the pause menu): the screen under it is not drawn,
    // only a dark wash, so the settings panel never overlaps its buttons (on phones the title's bottom sheet) and taps
    // cannot reach them.
    if (s && UI.sets) dim(s === 'title' ? .5 : .55);
    else if (s === 'title') drawTitle(); else if (s === 'heat') drawHeat(); else if (s === 'tree') drawTree(); else if (s === 'codex') drawCodex(); else if (s === 'map') drawMap(); else if (s === 'keeper') drawKeeper();
    else if (s === 'pause') drawPause(); else if (s === 'confirm') drawConfirm(); else if (s === 'results') drawResults(); else if (s === 'arrival') drawArrival();
    // A story beat (a Codex replay too) sits over everything: the controls under it stop taking taps.
    if (STORY.on()) { M.items.length = 0; UI.btns.length = 0; drawStory(); }
    if (!cineOn()) achDraw(ctx, E); // an achievement toast sits over everything (but waits out a cinematic)
    if (M.sel >= M.items.length) M.sel = Math.max(0, M.items.length - 1);
  };
  return M;
})();
