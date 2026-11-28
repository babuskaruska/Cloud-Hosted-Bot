// Saarepagar data (Mira): chains, generators, villagers, orders, areas with tasks and story, shop, daily tasks.
// Keys are short English words so the art (ART.item(key, level, px)) can match them: see CHAINS and GENERATORS.

// kind: 'item' (merge chain), 'gen' (generator), 'energy' and 'coin' (tap to collect), 'chest' (tap to open).
const CHAINS = {
  bread:  { kind: 'item', name: 'Küpsetised', color: '#e0a356', names: ['Jahukott', 'Tainapall', 'Kukkel', 'Sai', 'Rukkileib', 'Palmik', 'Kringel', 'Kook', 'Tort', 'Pulmatort'] },
  berry:  { kind: 'item', name: 'Marjad', color: '#c8487a', names: ['Mustikas', 'Marjapeotäis', 'Marjakausike', 'Moosipurk', 'Moosisai', 'Marjapirukas', 'Mustikakook', 'Marjatort'] },
  flower: { kind: 'item', name: 'Lilled', color: '#78b852', names: ['Seeme', 'Idu', 'Taimeke', 'Rukkilill', 'Lillekimp', 'Lillevaas', 'Jaanipärg', 'Lillekorv'] },
  wood:   { kind: 'item', name: 'Puutöö', color: '#a8774a', names: ['Nael', 'Haamer', 'Laud', 'Lauavirn', 'Pink', 'Aknaraam', 'Uks', 'Tööpink'] },
  fish:   { kind: 'item', name: 'Kalad', color: '#5a9bc8', names: ['Kilu', 'Räim', 'Ahven', 'Lest', 'Suitsulest', 'Kilukarp', 'Kalapirukas', 'Kalapidu'] },
  tea:    { kind: 'item', name: 'Tee', color: '#8aa846', names: ['Teeleht', 'Kummelikimp', 'Teepakk', 'Teetass', 'Tass ja alustass', 'Teekomplekt', 'Samovar'] },
  dairy:  { kind: 'item', name: 'Piimatooted', color: '#8fbbe0', names: ['Piimapudel', 'Piimakann', 'Võinupp', 'Kohupiim', 'Kohuke', 'Juustuviil', 'Juustuketas', 'Juustuvaagen'] },
  apple:  { kind: 'item', name: 'Õunad', color: '#d95a3c', names: ['Õun', 'Õunapaar', 'Õunakorv', 'Õunamahl', 'Õunamoos', 'Õunakook', 'Õunapuu'] },
  wool:   { kind: 'item', name: 'Villane', color: '#b07ec8', names: ['Villatups', 'Lõngakera', 'Sokid', 'Kindad', 'Müts', 'Sall', 'Kampsun', 'Lapitekk'] },
  sea:    { kind: 'item', name: 'Mereaarded', color: '#3aaea4', names: ['Kivike', 'Teokarp', 'Merevaik', 'Merepudel', 'Pudelikiri', 'Vana kaart', 'Kompass', 'Retseptileht'] },
  coffee: { kind: 'energy', name: 'Kohv', color: '#7a5236', names: ['Kohvioad', 'Kohvitass', 'Kohvikann', 'Kohvimasin'], value: [3, 8, 20, 50] },
  coin:   { kind: 'coin', name: 'Mündid', color: '#e6b432', names: ['Münt', 'Mündihunnik', 'Rahakott', 'Kukkur'], value: [5, 15, 40, 100] },
  chest:  { kind: 'chest', name: 'Kirstud', color: '#8a5a2b', names: ['Väike kirst', 'Kirst', 'Suur kirst'], value: [3, 5, 8] },
};

// Generators: tap to spawn. Merging two of the same level gives the next level (more chains, more charges, faster).
// spawn: [chain, weight, min generator level]. lv: per level [charges, cooldown seconds, chance of a level-2 item].
const GEN_LV = [[20, 60, 0], [26, 50, 0.06], [32, 40, 0.14], [40, 30, 0.24]];
const GENERATORS = {
  oven:    { names: ['Vana ahi', 'Kahhelahi', 'Leivaahi', 'Suur leivaahi'], color: '#c0603c', spawn: [['bread', 10, 1], ['dairy', 4, 2], ['coffee', 1, 3]] },
  basket:  { names: ['Pajukorv', 'Marjakorv', 'Turukorv', 'Vanaema korv'], color: '#b8864a', spawn: [['berry', 10, 1], ['apple', 6, 2], ['coffee', 1, 3]] },
  teapot:  { names: ['Plekk-kann', 'Teekann', 'Portselankann', 'Hõbekann'], color: '#5f9a6a', spawn: [['tea', 10, 1], ['dairy', 5, 2], ['coin', 1, 3]] },
  bed:     { names: ['Aiapeenar', 'Kõrgpeenar', 'Lillepeenar', 'Kasvuhoone'], color: '#6a8a3a', spawn: [['flower', 10, 1], ['apple', 4, 2], ['coffee', 1, 3]] },
  toolbox: { names: ['Tööriistakast', 'Puusepakast', 'Meistrikast', 'Tööriistakapp'], color: '#8a6040', spawn: [['wood', 10, 1], ['coin', 1, 2]] },
  net:     { names: ['Kalavõrk', 'Mõrd', 'Suur võrk', 'Kalapaat'], color: '#4a7aa8', spawn: [['fish', 10, 1], ['sea', 4, 2], ['coffee', 1, 3]] },
  wheel:   { names: ['Vokk', 'Suur vokk', 'Kangasteljed', 'Vanaema teljed'], color: '#9a6aa8', spawn: [['wool', 10, 1], ['sea', 2, 3], ['coin', 1, 2]] },
};
for (const k in GENERATORS) CHAINS[k] = { kind: 'gen', name: GENERATORS[k].names[0], color: GENERATORS[k].color, names: GENERATORS[k].names };

// Mystery box (Üllatuskast): tap to open one surprise. Dropped by lucky merges, every 5th order, level-ups and the festival.
CHAINS.mbox = { kind: 'mystery', name: 'Üllatuskast', color: '#9a5ad8', names: ['Üllatuskast'] };

const WHO = {
  maali: { name: 'Vanaema Maali', color: '#c46a8a' },
  liisa: { name: 'Liisa', color: '#e08a3a' },
  muri: { name: 'Muri', color: '#6a6a6a' },
  ants: { name: 'Ants', color: '#3a6a9a' },
  peeter: { name: 'Peeter', color: '#8a4a3a' },
  mina: { name: 'Mina', color: '#5a8a5a' },
};

// Villagers who place orders: favourite chains and thank-you lines.
const VILLAGERS = {
  liisa: { likes: ['bread', 'berry', 'dairy', 'apple', 'flower', 'tea'], from: 0,
    thanks: ['Aitäh! Teen kohe pildi ja panen saare gruppi üles.', 'Vau! See on nii ilus, et ma ei raatsi süüa. Söön ikka.', 'Täpselt see! Kuidas sa teadsid? Ahjaa, ma ütlesin ise.', 'Oi! Sa oled päris Maali moodi. Ainult vähem laulad.', '10/10, soovitan sõbrale. Ja kogu külale.'] },
  muri: { likes: ['fish', 'dairy', 'berry', 'bread'], from: 0, small: true,
    thanks: ['Mjäu. (Rahuldav. Võid jätkata.)', 'Nurr-nurr. (Ma ei ütle aitäh. Aga ma mõtlen seda.)', 'Mrr. (Panen selle oma salaladu. Diivani alla.)', 'Mjäu! (Sa oled peaaegu sama hea kui päikeselaik.)', 'Mrr. (Viis tähte. Üks käpp maha, sest see võttis aega.)'] },
  ants: { likes: ['fish', 'sea', 'wood', 'tea', 'bread', 'wool'], from: 0, after: 'b3',
    thanks: ['Hm. Hea. Väga hea isegi.', '👍 (Ants saatis sulle pöidla. See on tema kohta pikk kiri.)', 'Aitäh. Meri tänab ka.', 'Hm. ... Hm! (See oli Antsu kohta suur kiitus.)'] },
  peeter: { likes: ['sea', 'wood', 'wool', 'tea', 'flower', 'apple'], from: 2,
    thanks: ['Täpselt õigel ajal. Nagu majakatuli.', 'Räägin sellest oma podcastis! Kõigile kolmele kuulajale.', 'Aitäh, sõber. Majakas paistab täna heledam.', 'Selle eest kirjutan sulle luuletuse. Kaheksa salmi. Vähemalt.'] },
};

// First orders are scripted for a fast start (the first one is ready within half a minute); after that they are generated.
const ORDER_SCRIPT = [
  { who: 'liisa', items: [['bread', 2]], coins: 12, xp: 5, stars: 1 },
  { who: 'muri', items: [['berry', 2]], coins: 12, xp: 5, stars: 1 },
  { who: 'liisa', items: [['bread', 3]], coins: 18, xp: 6, stars: 1 },
  { who: 'muri', items: [['bread', 2], ['berry', 2]], coins: 18, xp: 6, stars: 1 },
];

// Areas, tasks and story. Story lines: [who, text]. who 'maali' lines are her letters.
// The heroine ("mina") is a young woman who turns grandma's old seaside bakery into the island's coolest café.
const AREAS = [
  { key: 'bakery', name: 'Kohvik',
    intro: [
      ['maali', 'Kallis lapselaps! Kui sa seda loed, on mu vana pagarikoda mere ääres nüüd sinu oma.'],
      ['maali', 'Ta on veidi tolmune ja natuke katki. Nagu mina hommikuti. Aga tal on hea süda. Tee temast midagi ägedat!'],
      ['mina', 'Okei. Mul on üks kohver, kaks tühja kätt ja üks suur plaan: saare kõige mõnusam kohvik-pagarikoda.'],
      ['liisa', 'Tere-tere! Mina olen Liisa. Mul on pood üle tee ja ma olen saare Facebooki grupi admin. Ma tean kõike. Nüüd ka sind!'],
      ['muri', 'Mjäu. (Mina olen Muri. See on minu maja. Sina võid siin ka elada. Ja mulle süüa tuua.)'],
      ['liisa', 'Hakkame pihta? Küla ootab värsket saia ja mina ootan esimest postitust!'],
    ],
    tasks: [
      { id: 'b1', name: 'Pühi tolm välja', cost: 1, reward: { coins: 20 }, story: [
        ['liisa', 'Apsti! Oi, kui palju tolmu. Aevastasin kolm korda järjest. See toob õnne!'],
        ['mina', 'Või kevadnohu.'],
        ['muri', 'Mjäu. (Ämblik Endel kolis minu sahtlisse. Ma ei ole sellega rahul.)'] ] },
      { id: 'b2', name: 'Õlita kriuksuv uks', cost: 2, reward: { gen: 'teapot' }, story: [
        ['muri', 'Mrr. (Uks ei kriuksu enam. Lõpuks saab rahus lõunauinakut teha. Ja hommikuuinakut. Ja õhtuuinakut.)'],
        ['liisa', 'Võta see vana teekann. Ilma teeta pole kohvik päris kohvik.'],
        ['mina', 'Matcha-latte saarel? Liisa, sa oled geenius.'],
        ['liisa', 'Ma tean. Mis see matcha on?'] ] },
      { id: 'b3', name: 'Pese aknad särama', cost: 2, reward: { energy: 20 }, story: [
        ['mina', 'Vaata! Aknast paistab meri. See vaade on puhas kuld.'],
        ['liisa', 'Ja seal sõuab Ants. Jälle vastu tuult. Ta ütleb, et tuul peab temaga sammu pidama.'],
        ['ants', 'Hm. Tere. Kui sul juhtub saia olema, siis ma võtaksin.'] ] },
      { id: 'b4', name: 'Pane vana ahi käima', cost: 3, reward: { gen: 'oven' }, story: [
        ['maali', '(Ahju tagant leiad kirja.) Ära karda seda ahju. Ta pahandab ainult esimesed viis minutit. Täpselt nagu mina.'],
        ['maali', 'Kui sul on kaks ühesugust ahju, pane need kokku. Kaks vana teevad ühe parema. Inimestega see nii ei käi, aga ahjudega küll.'],
        ['mina', 'Vanaema, sa oled legend. Lohistan uue ahju vana peale!'] ] },
      { id: 'b5', name: 'Värvi uus silt', cost: 3, reward: { coins: 40 }, story: [
        ['liisa', 'Mis nimi sildile tuleb? „Liisa sõbranna kohvik“ on vaba.'],
        ['mina', 'Saarepagar!'],
        ['liisa', 'Lühike, lahe ja mahub hashtagiks. Kinnitan.'] ] },
      { id: 'b6', name: 'Täida vitriin', cost: 4, reward: { coins: 60, energy: 20 }, story: [
        ['muri', 'Mjäu? (Kas see sai on minu jaoks? Ma eeldan, et on.)'],
        ['mina', 'Muri! Käpad letilt maha! Meil on hügieen!'],
        ['muri', 'Mrr. (Käpad on all. Saba on veel üleval. Saba ei loe.)'] ] },
      { id: 'b7', name: 'Avapidu!', cost: 5, reward: { gen: 'bed', chest: 1 }, story: [
        ['liisa', 'Terve küla on ukse taga! Isegi postiljon, kes muidu ainult mööda sõidab. Mu postitus sai 47 laiki!'],
        ['maali', '(Leti alt leiad veel ühe kirja.) Kui uksed on lahti, otsi mu retseptiraamatut. Peitsin selle nii hästi ära, et ei leia isegi ise.'],
        ['maali', 'Vihjeid jätsin üle kogu saare. Alusta aiast. Seal kasvab rohkem kui ainult rabarber.'],
        ['mina', 'Vanaema saladus? Okei, nüüd ma olen päriselt konksu otsas. Aeda!'] ] },
    ] },
  { key: 'garden', name: 'Aed',
    intro: [
      ['liisa', 'Maali aed! Kunagi oli see saare ilusaim. Nüüd on see saare kõrgeim. Rohi ulatub põlvini.'],
      ['mina', 'Siia tuleb terrass. Lilled, tuled, kohv päikese käes. Ma juba näen seda.'],
      ['muri', 'Mjäu. (Siin elab hiir Helmut. Ma ei ole teda veel kätte saanud. Me oleme mõlemad sellega rahul.)'],
    ],
    tasks: [
      { id: 'g1', name: 'Niida džungel maha', cost: 3, reward: { coins: 40 }, story: [
        ['mina', 'Rohu alt tuli välja kaks peenart ja üks kummik.'],
        ['liisa', 'See on Antsu kummik! Ta otsib seda juba kolmandat suve.'] ] },
      { id: 'g2', name: 'Paranda aiavärav', cost: 3, reward: { gen: 'toolbox' }, story: [
        ['liisa', 'Võta mu isa tööriistakast. Ta ütles alati: hea nael peab kauem vastu kui halb idee.'],
        ['mina', 'Väga tark mees.'],
        ['liisa', 'Ta ehitas kuuri ilma ukseta. Aga naelad pidasid.'] ] },
      { id: 'g3', name: 'Istuta õunapuu', cost: 4, reward: { energy: 25 }, story: [
        ['mina', 'Väike õunapuu. Kunagi on ta suur ja meil on oma õunakook.'],
        ['muri', 'Mrr. (Kui ta suur on, ronin ma otsa ega tule enam alla. Siis peab keegi mind päästma. See on traditsioon.)'] ] },
      { id: 'g4', name: 'Ehita mesitaru', cost: 4, reward: { gen: 'basket' }, story: [
        ['liisa', 'Mesilased! Mett kooki, mett teesse, mett... ma ei tea veel kuhu, aga ma leian koha.'],
        ['liisa', 'Võta teine korv. Pane kaks korvi kokku, siis tuleb sealt ka õunu.'] ] },
      { id: 'g5', name: 'Riputa kiik', cost: 5, reward: { coins: 80 }, story: [
        ['mina', 'Vanaema kiik! Ta kiikus siin igal õhtul.'],
        ['liisa', 'Ja laulis. Valjult. Kogu küla teadis kõiki salme. Ka neid, mis ta ise välja mõtles.'] ] },
      { id: 'g6', name: 'Kaeva lahti salakarp', cost: 5, reward: { gen: 'bed', chest: 1 }, story: [
        ['mina', 'Õunapuu juurte all on plekist karp!'],
        ['maali', '(Karbis on kiri.) Tubli! Esimene vihje: retseptiraamat ei ole aias. Aga aed oli tore, eks?'],
        ['maali', 'Järgmine vihje on sadamas. Küsi Antsult. Kui ta vaikib, too talle kala. Kui ta siis ka vaikib, on ta magama jäänud.'] ] },
    ] },
  { key: 'harbour', name: 'Sadam', introReward: { gen: 'net' },
    intro: [
      ['ants', 'Hm. Sina oled Maali lapselaps. Sul on tema nina. Ja tema jonn, olen kuulnud.'],
      ['ants', 'Sadam on katki. Kai on katki. Paat on katki. Mina olen terve. Võta see võrk.'],
      ['mina', 'Ants, kas sa tead, et sa oled kogu saare kõige lahedam tüüp?'],
      ['ants', 'Hm. ... Jah.'],
    ],
    tasks: [
      { id: 'h1', name: 'Paranda kai', cost: 4, reward: { coins: 60 }, story: [
        ['ants', 'Varem kukkus siit vette üks inimene nädalas. Nüüd mitte ükski. Natuke igav.'] ] },
      { id: 'h2', name: 'Lapi Antsu paat', cost: 5, reward: { energy: 30 }, story: [
        ['ants', 'Selle paadiga püüdsin kunagi haugi, kes oli pikem kui paat.'],
        ['mina', 'Kuidas ta paati ära mahtus?'],
        ['ants', 'Ei mahtunudki. Ta ujus ise järel.'] ] },
      { id: 'h3', name: 'Riputa võrgud kuivama', cost: 5, reward: { gen: 'teapot' }, story: [
        ['peeter', 'Tere! Mina olen Peeter, majakavaht ja podcasti „Valgus pimeduses“ saatejuht. Mul on kolm kuulajat.'],
        ['peeter', 'Kingin sulle oma teekannu. Mul on neid kaks, aga ainult üks tass.'] ] },
      { id: 'h4', name: 'Ehita suitsuahi', cost: 6, reward: { coins: 90 }, story: [
        ['muri', 'MJÄU! (Suitsukala! See on parim päev mu elus. Eilne oli ka. Homne tuleb ka.)'] ] },
      { id: 'h5', name: 'Värvi paadikuur', cost: 6, reward: { energy: 30 }, story: [
        ['ants', 'Sinine? Hm. Maalile meeldis sinine. ... Hea küll. Sinine.'],
        ['liisa', 'Ants naeratas! Kas keegi filmis? Keegi pidi ju filmima!'] ] },
      { id: 'h6', name: 'Kalurite grilliõhtu', cost: 7, reward: { gen: 'wheel', chest: 2 }, story: [
        ['ants', 'Maali jättis mulle kunagi kirja. Ütles, et annaksin selle sulle siis, kui sadam jälle naerab.'],
        ['maali', 'Teine vihje: retseptiraamat on seal, kus tuul jahvatab. Võta kaasa mu vokk. Veskis on külm ja villased sokid kuluvad ära.'],
        ['mina', 'Tuuleveski! Roadtrip!'] ] },
    ] },
  { key: 'windmill', name: 'Tuuleveski',
    intro: [
      ['liisa', 'Tuuleveski on seisnud juba kakskümmend aastat. Tuul puhub, aga tiivad ei viitsi.'],
      ['peeter', 'Kui veski jälle käib, on saarel oma jahu. Ja oma jahust saab... kõike.'],
    ],
    tasks: [
      { id: 'w1', name: 'Korista veski ära', cost: 7, reward: { coins: 90 }, story: [
        ['muri', 'Mrr. (Helmut elab nüüd siin. Ma tulin ainult külla. Taga ei ajanud. Natuke ainult.)'] ] },
      { id: 'w2', name: 'Paranda tiivad', cost: 8, reward: { energy: 30 }, story: [
        ['ants', 'Vanasti aitasin Maalil tiibu parandada. Ta ütles, et ma olen hea redel.'],
        ['mina', 'Redel?'],
        ['ants', 'Ma olin pikk. Ja ma ei rääkinud palju.'] ] },
      { id: 'w3', name: 'Õlita veskikivid', cost: 8, reward: { gen: 'net' }, story: [
        ['peeter', 'Kuula! Kivid laulavad. Madalalt, nagu vana kannel. Salvestan selle podcasti jaoks.'],
        ['peeter', 'Võta minu teine võrk. Merepõhjast leiab muudki kui kala.'] ] },
      { id: 'w4', name: 'Jahvata esimene jahu', cost: 9, reward: { coins: 120 }, story: [
        ['liisa', 'Saare oma jahu! Ma teen sellest kringli. Või kaks. Või kõik.'],
        ['mina', 'Kohalik, käsitöö, meretuulega. Turistid lähevad hulluks.'] ] },
      { id: 'w5', name: 'Riputa tiibadele tulukesed', cost: 9, reward: { energy: 40 }, story: [
        ['mina', 'Õhtul helendab veski nagu suur tähekaart. Ilusam kui ükski filter.'],
        ['peeter', 'Majakast on see ilus vaade. Nüüd on mul kaks tuld, mida vaadata.'] ] },
      { id: 'w6', name: 'Tõsta vana veskikivi', cost: 10, reward: { gen: 'toolbox', chest: 2 }, story: [
        ['maali', '(Kivi all on kiri.) Kolmas vihje: retseptiraamatut valvab see, kes kunagi ei maga.'],
        ['peeter', 'See olen mina. Ma ei maga kunagi. Noh, päeval natuke.'],
        ['mina', 'Majakas!'] ] },
    ] },
  { key: 'lighthouse', name: 'Majakas',
    intro: [
      ['peeter', 'Tere tulemast minu majakasse. Sada kaksteist astet. Olen neid mitu korda lugenud. Iga kord tuleb isesugune arv.'],
    ],
    tasks: [
      { id: 'l1', name: 'Paranda keerdtrepp', cost: 10, reward: { coins: 120 }, story: [
        ['mina', 'Trepp kriuksub igal astmel ise noodis.'],
        ['peeter', 'Ma kutsun seda trepilauluks. Nüüd laulab ta puhtamalt.'] ] },
      { id: 'l2', name: 'Nühi lääts särama', cost: 11, reward: { energy: 40 }, story: [
        ['peeter', 'Läbi läätse paistab saar nagu mänguasi. Vaata, Liisa räägib kellegagi. Muidugi räägib.'] ] },
      { id: 'l3', name: 'Paranda vana lamp', cost: 11, reward: { gen: 'wheel' }, story: [
        ['liisa', 'Tõin sulle teise voki! See seisis mu poes nii kaua, et kliendid pidasid seda mööbliks.'] ] },
      { id: 'l4', name: 'Värvi majakale triibud', cost: 12, reward: { coins: 150 }, story: [
        ['ants', 'Punane ja valge. Nagu õngekork. Väga hea majakas.'] ] },
      { id: 'l5', name: 'Pane majakatuli põlema', cost: 14, reward: { chest: 3 }, story: [
        ['peeter', 'Maali palus mul hoida ühte kirstu. Ta ütles: anna see sellele, kes saare jälle valgeks teeb.'],
        ['peeter', 'See oled sina.'],
        ['mina', 'Retseptiraamat?!'],
        ['peeter', 'Võib-olla. Või vanad sokid. Maaliga ei tea kunagi.'] ] },
    ] },
  { key: 'secret', name: 'Vanaema saladus',
    intro: [
      ['maali', '(Kirstus on viimane kiri.) Kallis lapselaps! Raamatut enam ei ole. Rebisin selle lehtedeks ja peitsin lehed üle saare.'],
      ['maali', 'Sest retsept ei ole raamatus. Retsept on inimestes. Liisa jutus, Antsu vaikimises, Peetri tules ja Muri jonnis.'],
      ['mina', 'Vanaema... sa oled päriselt kõige parem. Okei, korjame lehed kokku!'],
    ],
    tasks: [
      { id: 's1', name: 'Korja retseptilehed kokku', cost: 12, reward: { coins: 150 }, story: [
        ['ants', 'Leidsin võrgust ühe lehe. „Lisa näpuotsaga soola ja natuke naeru.“ Hm.'] ] },
      { id: 's2', name: 'Köida raamat kokku', cost: 14, reward: { energy: 50 }, story: [
        ['liisa', 'Üks leht oli mu kassaaparaadi all! Kakskümmend aastat! Ma oleksin pidanud koristama.'] ] },
      { id: 's3', name: 'Küpseta vanaema kringel', cost: 17, reward: { coins: 200 }, story: [
        ['muri', 'Mjäu. (See lõhnab nagu Maali. Ma istun siin ja ootan. Mitte kringlit. Lihtsalt istun.)'] ] },
      { id: 's4', name: 'Suur saarepidu', cost: 18, reward: { coins: 500, chest: 3 }, story: [
        ['liisa', 'Terve saar on siin! Muusika, kringel ja tants! Teen otseülekande!'],
        ['ants', 'Ma ei tantsi. ... Hea küll, ühe korra.'],
        ['peeter', 'Majakas paistab täna ainult meile.'],
        ['maali', '(Kringli kõrvalt leiad veel ühe sedeli.) Ma teadsin, et sa saad hakkama. Aitäh, et hoiad mu saart soojas.'],
        ['mina', 'Aitäh, vanaema. Saarepagar on avatud. Igaveseks.'] ] },
    ] },
];
const TASKS = {};
AREAS.forEach((a, ai) => a.tasks.forEach(t => { t.area = ai; TASKS[t.id] = t; }));
const STORY = {
  tut1: 'Toksa ahju – sealt tuleb jahukott!',
  tut2: 'Lohista jahukott teise peale. Kaks ühesugust = üks parem!',
  tut3: 'Liisa tellimus on valmis. Vajuta „Anna!“',
  tut4: 'Said tähe! Vajuta „Remont“ ja hakka kohvikut korda tegema.',
  tutDone: 'Super! Täida tellimusi, kogu tähti ja tee saarest kõige ägedam koht.',
  ending: 'Kõik on korras! Aga saari on veel palju. Saareringreis algab!',
};

// Coins shop. Generator offers are added for every generator kind you have owned.
const SHOP = [
  { id: 'en25', name: 'Kohvitass', desc: '+25 energiat', price: 60, give: { energy: 25 }, icon: ['coffee', 2] },
  { id: 'en60', name: 'Kohvikann', desc: '+60 energiat', price: 140, give: { energy: 60 }, icon: ['coffee', 3] },
  { id: 'mbox', name: 'Üllatuskast', desc: '1 üllatus', price: 35, give: { item: ['mbox', 1] }, icon: ['mbox', 1] },
  { id: 'chest1', name: 'Väike kirst', desc: '3 asja', price: 45, give: { item: ['chest', 1] }, icon: ['chest', 1] },
  { id: 'chest2', name: 'Kirst', desc: '5 asja', price: 110, give: { item: ['chest', 2] }, icon: ['chest', 2] },
  { id: 'slot', name: 'Kotitasku', desc: '+1 koht', price: 0, give: { slot: 1 }, icon: null },
];
const GEN_PRICE = 180;

const DAILY_POOL = [
  { id: 'merge', text: 'Ühenda {n} korda', goals: [15, 25, 35] },
  { id: 'order', text: 'Täida {n} tellimust', goals: [3, 4, 6] },
  { id: 'tap', text: 'Võta generaatoritest {n} asja', goals: [25, 40, 60] },
  { id: 'coins', text: 'Teeni {n} münti', goals: [60, 100, 150] },
  { id: 'hi', text: 'Valmista {n} asja 5. või kõrgemal tasemel', goals: [1, 2, 3] },
];
const DAILY_REWARD = { coins: 15, energy: 10 }, DAILY_BONUS = { stars: 2, chest: 1 };

// ---- reward loops ----
// Combo: merges less than COMBO_MS apart build a combo. Every merge from x3 on pays a coin; milestones pay more.
const COMBO_MS = 2600;
// The milestone pay is capped (fast players used to earn more per merge the longer they kept the combo going).
const comboReward = n => n % 5 === 0 ? { coins: 4 + 2 * Math.min(4, n / 5), energy: n <= 10 ? 2 : 1 } : n >= 3 && n <= 20 ? { coins: 1 } : null;
// Lucky merge chance (the 6th merge of a new game is always lucky, so she meets it early).
const LUCKY_P = 0.06;
// Mystery box drop chance on merges (result level 3+), and every Nth order pays one.
const MBOX_P = 0.035, MBOX_ORDER_EVERY = 5;
// Level-up rewards: coins, a full energy refill, a chest, now and then a mystery box or a spare generator.
// XP comes from merges (1 each) and orders, so it tracks energy spent (about 1.8 XP per energy). From level 4 on a
// level costs more energy than the refill it pays, so level-ups are a treat, not an endless energy loop.
const xpNeed = L => L <= 1 ? 10 : L === 2 ? 25 : L === 3 ? 45 : Math.round(40 + 30 * (L - 3) + 4 * (L - 3) * (L - 3));
function levelReward(L) {
  const r = { coins: 10 + 4 * L, refill: true, chest: L % 5 === 0 ? 2 : 1 };
  if (L === 2 || L % 4 === 0) r.mbox = 1;
  if (L % 3 === 0) r.genCopy = true;
  return r;
}
// Collection album: each discovered item pays once when collected; a full chain pays a bonus.
const albumReward = l => ({ coins: 2 + l * 2 });
const ALBUM_CHAIN = { stars: 2, chest: 2 };
const ALBUM_CHAINS = Object.keys(CHAINS).filter(k => CHAINS[k].kind === 'item');

// ---- version 3: adventure levels ("Seiklus"), lucky wheel, daily calendar, piggy bank ----
// Keys: a small chain that only the adventure levels use. Drop a key on a locked chest of the same level or lower.
CHAINS.key = { kind: 'key', name: 'Võtmed', color: '#d8a227', names: ['Väike võti', 'Võti', 'Kuldvõti'] };

// A new chapter every 50 levels; each has its own favourite chains (the chapters repeat with a number after 8).
// The six themes match Ash's map scenery (ART.mapTheme); they cycle forever.
const CHAPTERS = [
  { name: 'Kommirand', chains: ['bread', 'berry', 'fish', 'sea', 'dairy'] },
  { name: 'Lilleaas', chains: ['flower', 'apple', 'berry', 'tea', 'bread'] },
  { name: 'Marjamets', chains: ['berry', 'apple', 'wood', 'tea', 'wool'] },
  { name: 'Tuletorni kaljud', chains: ['fish', 'sea', 'wood', 'wool', 'tea'] },
  { name: 'Talveküla', chains: ['wool', 'tea', 'bread', 'dairy', 'berry'] },
  { name: 'Lavendliväljad', chains: ['flower', 'tea', 'dairy', 'apple', 'sea'] },
];
const chapterTitle = c => CHAPTERS[c % CHAPTERS.length].name;
const chapterName = c => 'Peatükk ' + (c + 1) + ' · ' + chapterTitle(c);

// Boosters. price: coins when bought inside a level.
const BOOSTERS = {
  wand: { name: 'Võlukepp', desc: 'Teeb ühe asja taseme võrra paremaks.', price: 80, target: true, prompt: 'Toksa asja, mida tahad võluda.' },
  scissors: { name: 'Käärid', desc: 'Lõikab asja kaheks väiksemaks.', price: 50, target: true, prompt: 'Toksa asja, mida tahad pooleks lõigata.' },
  shuffle: { name: 'Segamine', desc: 'Leiab üksikutele asjadele paarilised.', price: 40 },
  moves: { name: '+5 käiku', desc: 'Annab viis lisakäiku.', price: 60 },
};
const BOOST_KEYS = ['wand', 'scissors', 'shuffle', 'moves'];

// Lives: generous, 5 with one back every 15 minutes. Only a lost level costs a life.
const HEART_MAX = 5, HEART_MS = 15 * 60000, HEART_REFILL_PRICE = 50;
// +5 moves after running out: the price grows within one try.
const MORE_MOVES_PRICE = [30, 60, 90];

// Tips, shown the first time each goal or obstacle appears.
const ADV_TIPS = {
  make: 'Lohista kaks ühesugust asja kokku. Iga ühendamine on üks käik. Tõstmine ja vahetamine on tasuta!',
  ice: 'Jää! Ühenda asju jää peal, siis see praguneb ja puruneb.',
  box: 'Kastid! Ühenda midagi kasti kõrval, siis kast avaneb.',
  order: 'Külalised ootavad! Tee tellitud asjad valmis, need lähevad ise teele.',
  web: 'Ämblikuvõrk hoiab asja kinni. Ühenda selle kõrval, siis võrk kaob.',
  sand: 'Liivale uusi asju ei tule. Sinna võib ise asju tõsta.',
  crate: 'Lukus kirst avaneb võtmega. Ühenda võtmeid ja lohista võti kirstule.',
  bubble: 'Mullid levivad! Ühenda nende kõrval, siis need lõhkevad.',
  boss: 'Suur tellimus! Seekord ootab terve küla. Võta aega ja mõtle enne.',
};
const OBST_NAME = { ice: 'Jää', box: 'Kast', web: 'Ämblikuvõrk', sand: 'Liiv', crate: 'Lukus kirst', bubble: 'Mullid' };

// Lucky wheel (Õnneratas): 8 slices, w = weight. One free spin a day; more from levels and the calendar.
const WHEEL = [
  { r: { coins: 15 }, w: 20, color: '#ffd23f', label: '15' },
  { r: { boost: 'wand' }, w: 10, color: '#b07cff', label: 'Võlukepp' },
  { r: { energy: 20 }, w: 18, color: '#5ad1ff', label: '+20' },
  { r: { boost: 'scissors' }, w: 10, color: '#ff8ab8', label: 'Käärid' },
  { r: { coins: 40 }, w: 12, color: '#ffb02e', label: '40' },
  { r: { boost: 'shuffle' }, w: 12, color: '#6fe0a0', label: 'Segamine' },
  { r: { item: ['chest', 1], boost: 'moves' }, w: 14, color: '#ff9a6b', label: 'Kirst' },
  { r: { coins: 150, item: ['mbox', 1], boost: 'wand', spins: 1 }, w: 3, color: '#ff4f9a', label: 'Suur auhind', big: true },
];

// Daily calendar: a 7-day streak with growing prizes (day 7 is the big one), and a 30-day track that counts
// every day you come by (a missed day does not reset it).
const CAL7 = [
  { coins: 10, energy: 10 },
  { coins: 15, energy: 15 },
  { coins: 15, boost: 'shuffle' },
  { coins: 20, energy: 20 },
  { coins: 20, boost: 'scissors', spins: 1 },
  { coins: 30, energy: 25, chest: 1 },
  { coins: 60, boost: 'wand', chest: 2, spins: 1 },
];
const CAL30 = [
  { day: 3, r: { spins: 1, coins: 30 } },
  { day: 7, r: { chest: 2, coins: 60 } },
  { day: 14, r: { boost: 'wand', spins: 1, coins: 80 } },
  { day: 21, r: { item: ['mbox', 1], boost: 'moves', coins: 100 } },
  { day: 30, r: { coins: 300, spins: 2, chest: 3, boost: 'wand' } },
];

// Piggy bank (Hoiupõrsas): fills from play, opens free once a day.
const PIGGY_MAX = 60, PIGGY_MIN = 10;
const PIGGY_ADD = { merge: 1, order: 4, level: 12 };
