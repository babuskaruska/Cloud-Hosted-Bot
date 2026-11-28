// Saarepagar version 3 phase B (Mira): data and rules for
//   TOUR   the endless island tour "Saareringreis" after the six story areas (S.tour, TOUR.island(i))
//   STYLES design choices on decor tasks (S.style[taskId] = 'boho' | 'minimal' | 'romantic')
//   PASS   the free monthly season pass "Hooaja rada" (S.pass)
//   WEEK   the weekly event by ISO week (S.week), with its own currency, chain ev_<key> and reward track
//   LOOK   wardrobe and pets (S.look, S.pets, S.petOn), unlocked through play
// Game logic never draws: everything is reported through UI.ev(kind, cell, data).
const xev = (kind, cell, data) => { if (typeof UI !== 'undefined' && UI.ev) UI.ev(kind, cell === undefined ? -1 : cell, data || {}); };

// ---------------------------------------------------------------- design choices
const STYLES = {
  boho: { name: 'Boho', desc: 'Mõnus, vaba ja värviline', cols: ['#d9895b', '#e8c27a', '#7aa874'] },
  minimal: { name: 'Minimalistlik', desc: 'Hele, puhas ja rahulik', cols: ['#f4f1ea', '#c9d3d6', '#8a9aa0'] },
  romantic: { name: 'Romantiline', desc: 'Roosa, pitsiline ja pehme', cols: ['#f6b6c8', '#fde4ec', '#c97a9a'] },
};
const STYLE_KEYS = ['boho', 'minimal', 'romantic'];
// Story tasks that offer a style choice (Ash draws the variants in ART.scene from opts.style).
for (const id of ['b5', 'b6', 'g5', 'h5', 'w5']) if (TASKS[id]) TASKS[id].choices = STYLE_KEYS.slice();

// ---------------------------------------------------------------- island tour
// Each theme: Estonian name, island names, two intros ({name} = the island), regular tasks and a finale.
// A task: [name, line, choices?]. A line is [who, text]. Six tasks per island: five shuffled regular ones and the finale.
const TOUR_THEMES = {
  flower: { name: 'Lillepood', area: 'garden',
    names: ['Roosisaar', 'Moonilaid', 'Sirelisaar', 'Tulbirahu', 'Kannikeselaid', 'Kullerkupusaar'],
    intro: [
      [['liisa', '{name}! Siin on vana kasvuhoone ja tühi lillepood. Lõhn on tasuta!'], ['mina', 'Lillepood mere ääres? Teeme sellest saare kõige lõhnavama koha.'], ['muri', 'Mjäu. (Lilled on ilusad. Aga lillepotis on veel parem magada.)']],
      [['peeter', 'Tere tulemast saarele {name}! Lilli on siin nii palju, et mesilased töötavad graafiku järgi.'], ['mina', 'Siis avame lillepoe. Mesilased saavad esimese kliendikaardi.']],
    ],
    tasks: [
      ['Pese kasvuhoone klaasid', ['liisa', 'Nüüd paistab päike sisse ja lilled hakkavad kohe poseerima.']],
      ['Värvi letid', ['mina', 'Valisin värvi, mis sobib iga lillega. Ka nendega, mida veel ei ole.'], 1],
      ['Paranda kastekann', ['ants', 'Hm. Kann enam ei leki. Kannikesed on tänulikud.']],
      ['Istuta roosipeenar', ['muri', 'Mjäu. (Roosidel on okkad. Ma tean seda nüüd. Ära küsi.)']],
      ['Riputa lillekorvid', ['liisa', 'Iga korv on nagu väike pidu. Panen kõik pildid üles!'], 1],
      ['Ehita lillevitriin', ['peeter', 'Vitriinis on lilled nagu luuletus. Kirjutan sellest neli salmi.']],
      ['Seo esimesed kimbud', ['mina', 'Üks kimp Liisale, üks Antsule ja üks lihtsalt niisama, rõõmuks.']],
      ['Pane uksele lillepärg', ['liisa', 'Pärg uksel tähendab: siin elavad toredad inimesed. Ja üks kass.'], 1],
      ['Kasvata hiidpäevalill', ['ants', 'Hm. Päevalill on pikem kui mina. Ma ei ole kade.']],
    ],
    finale: ['Lillepoe avamine', [['liisa', 'Rahvast on nii palju, et lilled peavad järjekorras ootama!'], ['mina', 'Saar lõhnab nüüd nagu suvi. Järgmine saar, me tuleme!']]],
  },
  spa: { name: 'Spaa', area: 'secret',
    names: ['Mullisaar', 'Vahulaid', 'Aurusaar', 'Mudalaid', 'Rahusaar', 'Soojarahu'],
    intro: [
      [['liisa', '{name} on kuulus oma sooja allika poolest. Ja mudaga, mis teeb naha siidiseks!'], ['mina', 'Spaa! Mullivann, saun ja rahu. Olen täiesti poolt.'], ['muri', 'Mjäu. (Vesi? Ei, aitäh. Mina lõõgastun kuivalt.)']],
      [['ants', 'Hm. Saun on vana. Leil on hea. Kõik muu on katki.'], ['mina', 'Siis teeme kõik muu korda. Leil jääb, nagu on.']],
    ],
    tasks: [
      ['Küta saun soojaks', ['ants', 'Hm. Hea leil. Väga hea leil. ... Hm.']],
      ['Paranda mullivann', ['liisa', 'Mullid on tagasi! Ma ei tule siit enam kunagi välja.']],
      ['Vali käterätikud', ['mina', 'Pehmed rätikud on pool puhkusest. Teine pool on uni.'], 1],
      ['Sisusta massaažituba', ['peeter', 'Pärast massaaži hõljun nagu pilv. Väga aeglane pilv.'], 1],
      ['Täida mudavannid', ['muri', 'Mjäu. (Keegi pani mulle mudamaski. See olin mina ise. Kogemata.)']],
      ['Istuta lavendlit', ['liisa', 'Lavendel lõhnab nii rahulikult, et isegi mu telefon läks lennukirežiimi.']],
      ['Lao kividest jalarada', ['mina', 'Paljajalu kividel kõndides ununevad kõik kirjad ja kõned.']],
      ['Riputa küünlalaternad', ['peeter', 'Küünlavalgus on nagu väike majakas. Ainult sooja vee jaoks.'], 1],
      ['Keeda taimeteed', ['liisa', 'Kummel, piparmünt ja natuke saladust. Retsepti ma ei ütle.']],
    ],
    finale: ['Spaa avapäev', [['liisa', 'Terve küla on rätikutes! See on parim pilt, mis ma eales teinud olen.'], ['ants', 'Hm. Ma jään siia. Natukeseks. Paariks aastaks.']]],
  },
  icecream: { name: 'Jäätisekiosk', area: 'harbour',
    names: ['Vahvlisaar', 'Jäätiselaid', 'Pähklisaar', 'Maasikarahu', 'Vanillilaid', 'Šokolaadisaar'],
    intro: [
      [['liisa', '{name}! Siin seisab vana jäätisekiosk. Uks on lukus, aga vahvlilõhn on alles!'], ['mina', 'Jäätis mere ääres. Kas on üldse midagi paremat?'], ['muri', 'Mjäu. (Vanillijäätis on kassidele lubatud. Ma otsustasin nii.)']],
      [['peeter', 'Lapsena ostsin siit iga päev jäätist. Isegi talvel.'], ['mina', 'Siis avame kioski uuesti. Talvel ka, Peetri pärast.']],
    ],
    tasks: [
      ['Värvi kiosk triibuliseks', ['liisa', 'Triibud! Nüüd näeb kiosk välja nagu kommipaber.'], 1],
      ['Paranda külmkapp', ['ants', 'Hm. Külm on. Külm on hea. Kalale ka.']],
      ['Küpseta vahvlitopsid', ['mina', 'Esimene vahvel läks katki. Teise sõin ära. Kolmas on täiuslik.']],
      ['Vali päikesevarjud', ['peeter', 'Iga vari on nagu väike katus. Ja iga katus on luuletust väärt.'], 1],
      ['Korja maasikad', ['muri', 'Mjäu. (Ma ei söönud ühtegi. See punane täpp on mu loomulik värv.)']],
      ['Kujunda jäätisemenüü', ['liisa', 'Uus maitse: meresoolakaramell! Olen sellest juba kolm postitust teinud.'], 1],
      ['Too pingid', ['ants', 'Hm. Pink. Istun. Söön jäätist. Ei räägi.']],
      ['Riputa vahvlituled', ['mina', 'Õhtul helendab kiosk nagu suur jäätisepall.']],
      ['Keeda šokolaadikaste', ['liisa', 'Šokolaadi on igal pool. Ka mu ninaotsas. Ära kellelegi ütle.']],
    ],
    finale: ['Jäätisepäev', [['liisa', 'Järjekord ulatub sadamani! Isegi kajakad ootavad viisakalt.'], ['mina', 'Kaks palli igaühele. Muri saab kolm, ta palus väga kenasti.']]],
  },
  fashion: { name: 'Moebutiik', area: 'bakery',
    names: ['Siidisaar', 'Pitsilaid', 'Nööbisaar', 'Sametirahu', 'Litrilaid', 'Moesaar'],
    intro: [
      [['liisa', '{name}! Siin on vana rätsepatöökoda. Täis kangaid, nööpe ja unistusi!'], ['mina', 'Moebutiik saarel? Saarestiil! Kudumid, linane ja natuke sära.'], ['muri', 'Mjäu. (Kangarullid on mu uued voodid. Neid ei tohi müüa.)']],
      [['peeter', 'Mu vanaema õmbles siin kleite kogu saarele. Ka minu ristimiskleidi.'], ['mina', 'Peeter kleidis? Seda pilti tahan näha. Aga enne teeme butiigi korda.']],
    ],
    tasks: [
      ['Puhasta õmblusmasinad', ['liisa', 'Masin surises ja õmbles ise ühe õmbluse. Ta igatses tööd!']],
      ['Kujunda vaateaken', ['mina', 'Vaateaken on butiigi nägu. Nüüd ta naeratab.'], 1],
      ['Õmble linased kleidid', ['liisa', 'Linane, mugav ja ilus. Nagu suvepäev, mida saab selga panna.']],
      ['Sisusta proovikabiin', ['muri', 'Mjäu. (Kabiinis on peegel. Seal elab teine kass. Ta on väga ilus.)'], 1],
      ['Koo meremehekampsunid', ['ants', 'Hm. Soe. Väga soe. Võtan kaks.']],
      ['Riputa riidepuud', ['mina', 'Iga riidepuu on nagu väike lava. Kleidid ootavad aplausi.']],
      ['Vali vaip ja tugitoolid', ['peeter', 'Siin on nii mõnus, et salvestan siin oma podcasti. Kohe praegu.'], 1],
      ['Sorteeri nööbid', ['liisa', 'Nööbid värvide järgi! See on mu elu parim päev. Tänaseni.']],
      ['Korralda kangamüük', ['mina', 'Kõik kangad läksid. Peaaegu. Muri magab viimase peal.']],
    ],
    finale: ['Moeetendus kai peal', [['liisa', 'Kai on poodium! Ka Ants kõndis. Väga tõsiselt.'], ['ants', 'Hm. Ma olin hea. Ma tean.']]],
  },
  wedding: { name: 'Pulmaaed', area: 'garden',
    names: ['Sõrmusesaar', 'Loorilaid', 'Kimbusaar', 'Tordirahu', 'Südamelaid', 'Armusaar'],
    intro: [
      [['liisa', '{name}! Siin on aed, kus peeti kõik saare pulmad. Enne kui see võssa kasvas.'], ['mina', 'Pulmaaed! Lilled, tuled ja pikk laud. Ma juba nutan ja me pole veel alustanudki.'], ['muri', 'Mjäu. (Pulmades on tort. Olen pulmade suur austaja.)']],
      [['peeter', 'Selle tamme all tegin kunagi abieluettepaneku. Ta ütles: „Ma mõtlen.“ Mõtleb siiani.'], ['mina', 'Oi, Peeter! Teeme aia nii ilusaks, et vastus tuleb iseenesest.']],
    ],
    tasks: [
      ['Niida aed', ['mina', 'Rohu alt tuli välja vana pink ja üks kadunud kingake.']],
      ['Ehita lillekaar', ['liisa', 'Kaare all tuleb iga pilt nagu ajakirjast. Proovisin. Kolmkümmend korda.'], 1],
      ['Pane püsti pikk laud', ['ants', 'Hm. Pikk laud. Palju toole. Palju inimesi. Hm.']],
      ['Vali laudlinad ja küünlad', ['mina', 'Küünlad, linad ja lillevaasid. Nüüd on laud peoks valmis.'], 1],
      ['Riputa tuledeketid', ['peeter', 'Tuled puude vahel. Nagu tähed, kes tulid lähemale vaatama.']],
      ['Küpseta pulmatort', ['muri', 'Mjäu. (Ma ei puutunud torti. Ma ainult nuusutasin. Põhjalikult.)']],
      ['Ehita tantsupõrand', ['liisa', 'Tantsupõrand on valmis! Ants, sina tantsid esimesena.'], 1],
      ['Seo pruudikimbud', ['mina', 'Kimbud on nii ilusad, et mesilased lendavad kohale lihtsalt vaatama.']],
      ['Kutsu kokku külaorkester', ['peeter', 'Orkestris on kannel, akordion ja Ants trummi taga. Ants veel ei tea.']],
    ],
    finale: ['Suur pulmapidu', [['liisa', 'Terve saar tantsib! Isegi Ants. Kaks korda!'], ['ants', 'Hm. Kolm korda. Aga ära kellelegi ütle.']]],
  },
  beach: { name: 'Rannaklubi', area: 'harbour',
    names: ['Liivasaar', 'Päikeselaid', 'Lainerahu', 'Karbisaar', 'Rannalaid', 'Tuulesaar'],
    intro: [
      [['liisa', '{name}! Valge liiv, soe meri ja üks väga üksik rannabaar.'], ['mina', 'Rannaklubi! Lamamistoolid, smuutid ja päikeseloojang.'], ['muri', 'Mjäu. (Liiv on hiiglaslik liivakast. Olen vaimustuses.)']],
      [['ants', 'Hm. Siin õppisin ujuma. Või õppis meri mind kandma.'], ['mina', 'Teeme sellest ranna, kus kõik tahavad ujuma õppida.']],
    ],
    tasks: [
      ['Korista rand', ['mina', 'Liivast tuli välja kolm kühvlit, üks kummik ja Antsu päikeseprillid.']],
      ['Ehita rannabaar', ['liisa', 'Baar on valmis! Esimene smuuti on minu oma. Broneerisin.'], 1],
      ['Too lamamistoolid', ['peeter', 'Päike, lained ja lamamistool. Kirjutan sellest luuletuse. Hiljem.'], 1],
      ['Paranda vetelpäästetorn', ['ants', 'Hm. Torn on kõrge. Näen kõike. Ka Liisat, kes jälle telefoniga räägib.']],
      ['Tõmba üles võrkpallivõrk', ['liisa', 'Võrkpallis olen ma meister! Peaaegu. Natuke. Pall on mu vaenlane.']],
      ['Riputa laternad', ['mina', 'Õhtul on rand nagu muinasjutt. Isegi lained sosistavad vaiksemalt.'], 1],
      ['Koosta smuutimenüü', ['muri', 'Mjäu. (Kalasmuutit menüüs ei ole. Ma kaeban.)']],
      ['Too välja aerulauad', ['ants', 'Hm. Laud. Aer. Seisad püsti. Kukud. Proovid uuesti. Hea sport.']],
      ['Ehita liivaloss', ['mina', 'Liivalossil on neli torni ja vallikraav. Muri arvab, et see on tema oma.']],
    ],
    finale: ['Rannapidu', [['liisa', 'DJ Peeter! Ma ei teadnudki, et sa oskad!'], ['peeter', 'Ei oskagi. Aga nupud on ilusad.']]],
  },
  xmas: { name: 'Jõuluturg', area: 'windmill',
    names: ['Piparkoogisaar', 'Kuuselaid', 'Lumesaar', 'Kingirahu', 'Tähelaid', 'Küünlasaar'],
    intro: [
      [['liisa', '{name}! Siin on vana turuplats. Kunagi oli siin saare kõige ilusam jõuluturg.'], ['mina', 'Jõuluturg! Piparkoogid, kuum mahl ja tuled igal pool.'], ['muri', 'Mjäu. (Jõulukuusk on kassidele ronimiseks. Seda teavad kõik.)']],
      [['peeter', 'Jõuluvana elab kuskil siin lähedal. Ma pole teda näinud, aga keegi sõi mu piparkoogid ära.'], ['muri', 'Mjäu. (Ma ei tea midagi.)']],
    ],
    tasks: [
      ['Lükka lumi platsilt', ['ants', 'Hm. Lumi. Labidas. Lumi. Labidas. Hea.']],
      ['Ehita turuputkad', ['liisa', 'Iga putka on nagu piparkoogimaja! Tahan kõigisse korraga.'], 1],
      ['Küpseta piparkoogid', ['mina', 'Esimene plaat kõrbes. Teise sõi keegi ära. Muri, mis sul vurrude peal on?']],
      ['Too jõulukuusk', ['peeter', 'Kuusk lõhnab nagu metsatuul ja lapsepõlv korraga.'], 1],
      ['Riputa jõulutuled', ['liisa', 'Tuled põlevad! Nüüd paistab saar vist ka kosmosesse.']],
      ['Keeda kuuma mahla', ['ants', 'Hm. Kuum. Magus. Võtan veel.']],
      ['Koo villased sokid', ['mina', 'Sokid müüdi tunniga läbi. Antsul on nüüd kolm paari.']],
      ['Sea üles kingiletti', ['liisa', 'Pakid on nii ilusad, et keegi ei raatsi neid avada. Mina raatsin.'], 1],
      ['Tee uisuväljak', ['muri', 'Mjäu. (Jää on libe. Ma kõnnin väga väärikalt. Ja aeglaselt.)']],
    ],
    finale: ['Jõuluturu avamine', [['peeter', 'Kuuse otsas särab täht ja kõik laulavad. Isegi Ants ümiseb.'], ['ants', 'Hm. Hmm-hmm-hmm. ... See oli laul.']]],
  },
  orchard: { name: 'Sügisene õunaaed', area: 'garden',
    names: ['Õunasaar', 'Pirnilaid', 'Ploomisaar', 'Mahlarahu', 'Korvilaid', 'Sügisesaar'],
    intro: [
      [['liisa', '{name}! Siin on vana õunaaed. Õunu on nii palju, et puud on väsinud.'], ['mina', 'Sügisene õunaaed! Õunamahl, õunakook ja õunapidu.'], ['muri', 'Mjäu. (Kukkuvad õunad on ohtlikud. Ma valvan neid magades.)']],
      [['ants', 'Hm. Maali korjas siit õunu. Alati kõige kõrgemalt oksalt.'], ['mina', 'Siis korjame meie ka. Redeliga. Ja Antsuga.']],
    ],
    tasks: [
      ['Riisu lehed kokku', ['mina', 'Lehehunnik on nii suur, et Muri kadus sinna ära. Kaks korda.']],
      ['Paranda vana mahlapress', ['ants', 'Hm. Press töötab. Mahl on hea. Väga hea.']],
      ['Korja õunad', ['liisa', 'Kolmkümmend korvi! Tegin igast korvist pildi. Igast õunast ka.']],
      ['Ehita aiakohvik', ['mina', 'Kohv, õunakook ja sügisvärvid. Mis võiks veel parem olla?'], 1],
      ['Vali padjad ja pleedid', ['peeter', 'Siin on nii hubane, et tahaks terve talve istuda.'], 1],
      ['Küpseta õunakook', ['muri', 'Mjäu. (Kook on soe. Istun selle kõrval. Valvan.)']],
      ['Riputa kõrvitsalaternad', ['liisa', 'Kõrvitsad naeratavad! Üks näeb välja täpselt nagu Ants.'], 1],
      ['Keeda õunamoosi', ['ants', 'Hm. Moos. Leivale. Kalale ei pane.']],
      ['Pane üles õunapuukiik', ['mina', 'Kiik õunapuu all. Vanaemale oleks see väga meeldinud.']],
    ],
    finale: ['Õunapidu', [['liisa', 'Kõik on siin! Õunamahl voolab ja muusika mängib!'], ['peeter', 'Sügis on nagu hea luuletus: soe, kuldne ja natuke kurb. Aga peamiselt soe.']]],
  },
};
const TOUR_KEYS = ['flower', 'spa', 'icecream', 'fashion', 'wedding', 'beach', 'xmas', 'orchard'];
const TOUR_SIZE = 6;

const TOUR = (() => {
  // Seeded Fisher-Yates (does not touch the gameplay stream rnd).
  function shuffle(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const orderCache = new Map();
  // Theme order of one cycle of 8 islands: reshuffled per cycle, never the same theme twice in a row.
  function cycleOrder(c) {
    let o = orderCache.get(c); if (o) return o;
    o = c === 0 ? TOUR_KEYS.slice() : shuffle(TOUR_KEYS, mulberry(hashStr('tour-cycle-' + c)));
    if (c > 0) { const prev = cycleOrder(c - 1); if (o[0] === prev[prev.length - 1]) { const t = o[0]; o[0] = o[1]; o[1] = t; } }
    orderCache.set(c, o); return o;
  }
  const themeOf = i => cycleOrder(Math.floor(i / TOUR_KEYS.length))[i % TOUR_KEYS.length];
  const fill = (s, name) => s.replace('{name}', name);
  const cache = new Map();
  // Rewards and costs grow slowly and stay friendly (stars come from orders, 1–4 each).
  function taskReward(i, n, last) {
    const c = Math.min(300, 80 + i * 10);
    if (last) return { coins: c * 2, chest: 2, spins: 1 };
    switch ((n + i) % 5) {
      case 0: return { coins: c };
      case 1: return { energy: Math.min(60, 30 + i * 2) };
      case 2: return { coins: Math.round(c * 0.6), item: ['mbox', 1] };
      case 3: return { chest: 1, energy: 20 };
      default: return { coins: Math.round(c * 0.8), spins: 1 };
    }
  }
  function island(i) {
    i = Math.max(0, i | 0);
    let o = cache.get(i); if (o) return o;
    const key = themeOf(i), T = TOUR_THEMES[key], cyc = Math.floor(i / TOUR_KEYS.length), r = mulberry(hashStr('tour-island-' + i));
    const round = Math.floor(cyc / T.names.length);
    const name = T.names[cyc % T.names.length] + (round > 0 ? ' ' + (round + 1) : '');
    // five regular tasks (at least one with a style choice), then the finale
    let pick = shuffle(T.tasks.map((x, j) => j), r).slice(0, TOUR_SIZE - 1);
    if (!pick.some(j => T.tasks[j][2])) { const c = T.tasks.findIndex(x => x[2]); pick[pick.length - 1] = c; }
    pick = pick.sort((a, b) => a - b);
    const base = Math.min(20, 10 + Math.floor(i * 0.7));
    const tasks = pick.map((j, n) => {
      const d = T.tasks[j], t = { id: 't' + i + '_' + n, name: d[0], cost: base + n, reward: taskReward(i, n, false), story: [d[1].slice()], tour: i };
      if (d[2]) t.choices = STYLE_KEYS.slice();
      return t;
    });
    tasks.push({ id: 't' + i + '_' + (TOUR_SIZE - 1), name: T.finale[0], cost: base + TOUR_SIZE + 1, reward: taskReward(i, TOUR_SIZE - 1, true), story: T.finale[1].map(l => [l[0], fill(l[1], name)]), tour: i, finale: true });
    const intro = T.intro[cyc % T.intro.length].map(l => [l[0], fill(l[1], name)]);
    o = { i, theme: key, themeName: T.name, name, key: 'tour', area: T.area, tasks, intro };
    if (cache.size > 12) cache.delete(cache.keys().next().value);
    cache.set(i, o); return o;
  }
  // Task lookup by id: story TASKS or a tour task "t<i>_<n>".
  function task(id) {
    if (TASKS[id]) return TASKS[id];
    const m = /^t(\d+)_(\d+)$/.exec(id || ''); if (!m) return null;
    return island(+m[1]).tasks[+m[2]] || null;
  }
  // The story area whose art stands in until ART.tourScene exists, with a share of its tasks marked done.
  function fallbackProgress(isl, done) {
    const a = AREAS.find(x => x.key === isl.area) || AREAS[0], n = isl.tasks.filter(t => done[t.id]).length;
    const k = Math.round(n / isl.tasks.length * a.tasks.length), set = new Set();
    a.tasks.slice(0, k).forEach(t => set.add(t.id));
    return { area: a.key, set };
  }
  const on = () => !!(S && S.ended);
  const cur = () => island(S.tour || 0);
  return { island, task, themeOf, cur, on, fallbackProgress, THEMES: TOUR_THEMES, KEYS: TOUR_KEYS };
})();

// ---------------------------------------------------------------- season pass "Hooaja rada"
const PASS_STEPS = 30;
const PASS_PTS = { merge: 1, order: 3, task: 6, level: 5, daily: 4, island: 15, week: 2 };
const PASS_MERGES = 3;  // one pass point per 3 merges (merges are by far the most common action)
const MONTHS = ['jaanuar', 'veebruar', 'märts', 'aprill', 'mai', 'juuni', 'juuli', 'august', 'september', 'oktoober', 'november', 'detsember'];
const PASS = (() => {
  const need = s => 30 + 4 * s;                // points for step s (1-based); 2760 for all 30 (about 3 weeks at 25 min a day)
  const cum = s => { let t = 0; for (let j = 1; j <= s; j++) t += need(j); return t; };
  const CUM = []; for (let s = 0; s <= PASS_STEPS; s++) CUM.push(cum(s));
  // Wardrobe pieces on the track: unlocked for good the first time the step is claimed.
  const LOOK_AT = { 5: 'hair:braid', 15: 'outfit:cozy', 25: 'acc:hat', 30: 'petAcc:hat' };
  function reward(s) {
    let r;
    if (s % 10 === 0) r = { coins: 60 * s / 10 + 40, chest: 2, spins: 1 };
    else if (s % 5 === 0) r = { coins: 40, boost: 'wand' };
    else if (s % 3 === 0) r = { spins: 1, coins: 15 };
    else if (s % 2 === 0) r = { energy: 15 + s };
    else r = { coins: 20 + 2 * s };
    if (s === 7 || s === 22) r = { item: ['mbox', 1], coins: 25 };
    if (s === 12 || s === 27) r = { boost: s === 12 ? 'scissors' : 'shuffle', energy: 20 };
    if (LOOK_AT[s]) r = Object.assign({ look: LOOK_AT[s] }, r);
    return r;
  }
  function monthKey(t) { const d = new Date(t || now()); return d.getFullYear() + '-' + (d.getMonth() + 1); }
  function monthName(t) { return MONTHS[new Date(t || now()).getMonth()]; }
  function left(t) { t = t || now(); const d = new Date(t); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - t; }
  const reached = () => { let s = 0; while (s < PASS_STEPS && S.pass.pts >= CUM[s + 1]) s++; return s; };
  const ready = () => { const n = reached(); for (let s = 1; s <= n; s++) if (!S.pass.got[s]) return s; return 0; };
  // A new month: rewards reached but not taken are given right away (nothing is lost), then a fresh track.
  function ensure() {
    const m = monthKey();
    if (S.pass.month === m) return false;
    const old = S.pass.month ? reached() : 0, late = {};
    for (let s = 1; s <= old; s++) if (!S.pass.got[s]) { const r = reward(s); for (const k in r) late[k] = typeof r[k] === 'number' ? (late[k] || 0) + r[k] : r[k]; }
    const had = !!S.pass.month;
    S.pass = { month: m, pts: 0, got: {} };
    if (Object.keys(late).length) { Game.give(Object.assign({ silent: true }, late)); xev('passLate', -1, { r: late }); }
    if (had) xev('passNew', -1, {});
    return true;
  }
  function add(n, cell) {
    if (!S || !n) return;
    ensure();
    if (n === 'merge') { S.pass.mc = (S.pass.mc | 0) + 1; if (S.pass.mc < PASS_MERGES) return; S.pass.mc = 0; n = PASS_PTS.merge; }
    const before = reached(); S.pass.pts += n;
    const after = reached();
    if (after > before) xev('passStep', cell, { s: after });
  }
  function claim(s) {
    if (!s || s > reached() || S.pass.got[s]) return false;
    S.pass.got[s] = 1; const r = reward(s);
    Game.give(Object.assign({ silent: true }, r));
    xev('passClaim', -1, { s, r }); saveSoon(); return true;
  }
  return { need, CUM, reward, reached, ready, ensure, add, claim, monthKey, monthName, left, LOOK_AT };
})();

// ---------------------------------------------------------------- weekly events
// ev_<key> chains: 6 levels each. Tap the top level to cash it in for event currency.
const WEEK_EVENTS = {
  garden: { name: 'Aiapidu', cur: ['õied', 'õit'], color: '#6fc25a', chain: ['Seemnepakk', 'Lilleidu', 'Pottlill', 'Lillekast', 'Roosipõõsas', 'Aiapaviljon'] },
  fashion: { name: 'Moenädal', cur: ['nööbid', 'nööpi'], color: '#b07cff', chain: ['Nööp', 'Niidirull', 'Kangarull', 'Kleidilõige', 'Suvekleit', 'Moeetenduse kleit'] },
  wedding: { name: 'Pulmad', cur: ['kellukesed', 'kellukest'], color: '#ff8ab8', chain: ['Pits', 'Pulmakutse', 'Pruudikimp', 'Sõrmusekarp', 'Pulmakleit', 'Pulmakaar'] },
  beach: { name: 'Rannafestival', cur: ['karbid', 'karpi'], color: '#3db8ff', chain: ['Liivakühvel', 'Liivaämber', 'Rannapall', 'Päikesevari', 'Lamamistool', 'Liivaloss'] },
};
const WEEK_KEYS = ['garden', 'fashion', 'wedding', 'beach'];
for (const k of WEEK_KEYS) CHAINS['ev_' + k] = { kind: 'item', ev: k, name: WEEK_EVENTS[k].name, color: WEEK_EVENTS[k].color, names: WEEK_EVENTS[k].chain.slice() };
const WEEK_MIN_LVL = 3;        // the event opens at XP level 3 (the first minutes stay simple)
const WEEK_SPAWN_P = 0.06;     // share of generator taps that give an event item instead
const WEEK_CUR = { merge: l => 2 * l, top: 30, order: 1, level: 3 };  // about 5 days for the full track at 25 min a day
// Each event's track; the 8th prize is a wardrobe piece of its own.
const WEEK_TRACK = [
  { need: 10, r: { coins: 30 } },
  { need: 25, r: { energy: 30 } },
  { need: 45, r: { item: ['mbox', 1] } },
  { need: 70, r: { coins: 80, spins: 1 } },
  { need: 100, r: { item: ['chest', 2] } },
  { need: 140, r: { energy: 60 } },
  { need: 190, r: { stars: 3 } },
  { need: 250, r: { look: true, coins: 100 } },
  { need: 320, r: { item: ['chest', 3], boost: 'wand' } },
  { need: 400, r: { genUp: true, stars: 5 } },
];
const WEEK_LOOK = { garden: 'acc:flower', fashion: 'outfit:gala', wedding: 'petAcc:bow', beach: 'outfit:beach' };
const WEEK = (() => {
  function isoWeek(t) {
    const d = new Date(t || now()), u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = u.getUTCDay() || 7; u.setUTCDate(u.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
    return { year: u.getUTCFullYear(), week: Math.ceil(((u - y0) / 86400000 + 1) / 7) };
  }
  function info(t) {
    t = t || now();
    const w = isoWeek(t), forced = QS.week && WEEK_EVENTS[QS.week] ? QS.week : null;
    const key = forced || WEEK_KEYS[(w.year * 53 + w.week) % WEEK_KEYS.length];
    const d = new Date(t), dow = (d.getDay() + 6) % 7; // 0 = Monday
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 7).getTime();
    return { id: w.year + '-W' + w.week + (forced ? ':' + forced : ''), key, E: WEEK_EVENTS[key], left: end - t, weekend: dow >= 5, chain: 'ev_' + key };
  }
  const open = () => !!S && S.lvl >= WEEK_MIN_LVL;
  // A new week: event items of the old week on the board and in the bag turn into coins.
  function ensure() {
    const e = info();
    if (S.week.id === e.id) return false;
    let coins = 0;
    const old = k => CHAINS[k] && CHAINS[k].ev && k !== e.chain;
    for (let i = 0; i < NCELL; i++) { const it = S.board[i]; if (it && old(it.k)) { coins += 5 * it.l; S.board[i] = null; } }
    for (let j = S.bag.length - 1; j >= 0; j--) if (old(S.bag[j].k)) { coins += 5 * S.bag[j].l; S.bag.splice(j, 1); }
    const had = !!S.week.id;
    S.week = { id: e.id, key: e.key, cur: 0, got: {} };
    if (coins) Game.addCoins(coins);
    if (had || open()) xev('weekStart', -1, { e, coins });
    return true;
  }
  function add(n, cell) {
    if (!S || !open() || !n) return;
    ensure();
    const e = info(); if (e.weekend) n *= 2;
    const before = S.week.cur; S.week.cur += n;
    const nx = WEEK_TRACK.find((x, j) => !S.week.got[j] && x.need > before);
    xev('weekCur', cell, { n, ready: !!(nx && S.week.cur >= nx.need) });
  }
  function reward(j) {
    const r = Object.assign({}, WEEK_TRACK[j].r);
    if (r.look) r.look = WEEK_LOOK[info().key];
    return r;
  }
  const readyIdx = () => { for (let j = 0; j < WEEK_TRACK.length; j++) if (!S.week.got[j] && S.week.cur >= WEEK_TRACK[j].need) return j; return -1; };
  function claim(j) {
    if (!open() || S.week.got[j] || S.week.cur < WEEK_TRACK[j].need) return false;
    S.week.got[j] = 1; const r = reward(j);
    Game.give(Object.assign({ silent: true }, r));
    xev('weekClaim', -1, { j, r }); saveSoon(); return true;
  }
  return { info, isoWeek, open, ensure, add, reward, claim, readyIdx };
})();

// ---------------------------------------------------------------- wardrobe and pets
// how: a check on S (unlocked while true), or 'pass' / 'week' (unlocked once by a prize). why: the hint on a locked piece.
const LOOKS = {
  outfit: {
    casual: { name: 'Igapäevane' },
    summer: { name: 'Suvekleit', how: () => S.lvl >= 4, why: 'Tase 4' },
    chef: { name: 'Pagari põll', how: () => !!S.done.b7, why: 'Kohvik korda' },
    cozy: { name: 'Kudumikomplekt', why: 'Hooaja raja 15. samm' },
    beach: { name: 'Rannariided', why: 'Rannafestivali auhind' },
    gala: { name: 'Peokleit', why: 'Moenädala auhind' },
  },
  hair: {
    bun: { name: 'Nuts' },
    long: { name: 'Pikad juuksed', how: () => S.lvl >= 3, why: 'Tase 3' },
    bob: { name: 'Bobisoeng', how: () => S.adv.top > 15, why: 'Seikluse 15. tase' },
    braid: { name: 'Pats', why: 'Hooaja raja 5. samm' },
  },
  acc: {
    none: { name: 'Ilma' },
    glasses: { name: 'Prillid', how: () => S.stats.orders >= 25, why: '25 tellimust' },
    hat: { name: 'Kübar', why: 'Hooaja raja 25. samm' },
    flower: { name: 'Lill juustes', why: 'Aiapeo auhind' },
    scarf: { name: 'Sall', how: () => (S.tour || 0) >= 2, why: 'Saareringreisi 2 saart' },
  },
  petAcc: {
    none: { name: 'Ilma' },
    collar: { name: 'Kaelarihm', how: () => S.stats.orders >= 50, why: '50 tellimust' },
    bow: { name: 'Lips', why: 'Pulmade auhind' },
    hat: { name: 'Mütsike', why: 'Hooaja raja 30. samm' },
  },
};
const LOOK_KINDS = ['outfit', 'hair', 'acc'];
const PETS = {
  muri: { name: 'Muri', desc: 'Kohviku kass. Arvab, et kohvik on tema oma.' },
  kutsu: { name: 'Kutsu', desc: 'Sadama kutsikas. Toob kõike, ka seda, mida ei paluta.', how: () => !!S.done.h6, why: 'Sadam korda' },
  janku: { name: 'Jänku', desc: 'Aia jänes. Sööb porgandeid ja kuulab saladusi.', how: () => S.adv.top > 20, why: 'Seikluse 20. tase' },
};
const LOOK = (() => {
  const keyOf = (kind, k) => kind + ':' + k;
  function has(kind, k) {
    const d = kind === 'pet' ? PETS[k] : LOOKS[kind] && LOOKS[kind][k];
    if (!d) return false;
    if (S.owned[keyOf(kind, k)]) return true;
    if (!d.why) return true;
    try { return !!(d.how && d.how()); } catch (e) { return false; }
  }
  function all() { const out = []; for (const kind in LOOKS) for (const k in LOOKS[kind]) out.push([kind, k]); for (const k in PETS) out.push(['pet', k]); return out; }
  function unlock(key) { if (!key || S.owned[key]) return false; S.owned[key] = 1; check(); return true; }
  // New pieces: announced once; the wardrobe button shows a dot until the wardrobe is opened.
  function check(silent) {
    const fresh = [];
    for (const [kind, k] of all()) {
      const key = keyOf(kind, k);
      if (S.lookKnown[key] || !has(kind, k)) continue;
      S.lookKnown[key] = 1;
      if (kind === 'pet' && !S.pets[k]) S.pets[k] = { acc: 'none' };
      if (LOOKS[kind] && !LOOKS[kind][k].why) continue; // the starting pieces are not news
      if (kind === 'pet' && !PETS[k].why) continue;
      fresh.push([kind, k]);
    }
    if (fresh.length && !silent) xev('lookNew', -1, { list: fresh });
    return fresh;
  }
  const unseen = () => Object.keys(S.lookKnown).filter(k => !S.lookSeen[k]).length;
  function seeAll() { for (const k in S.lookKnown) S.lookSeen[k] = 1; }
  function wear(kind, k) {
    if (!has(kind, k)) return false;
    if (kind === 'pet') { S.petOn = k; if (!S.pets[k]) S.pets[k] = { acc: 'none' }; xev('pet', -1, { k }); }
    else if (kind === 'petAcc') { const p = S.pets[S.petOn] || (S.pets[S.petOn] = { acc: 'none' }); p.acc = k; xev('wear', -1, { kind, k }); }
    else { S.look[kind] = k; xev('wear', -1, { kind, k }); }
    saveSoon(); return true;
  }
  const name = (kind, k) => kind === 'pet' ? PETS[k].name : LOOKS[kind][k].name;
  const why = (kind, k) => kind === 'pet' ? PETS[k].why : LOOKS[kind][k].why;
  return { has, all, unlock, check, unseen, seeAll, wear, name, why, keyOf };
})();

// ---------------------------------------------------------------- rest reminder
const REST_MIN = 45;   // minutes of active play before a gentle "take a break?" note
