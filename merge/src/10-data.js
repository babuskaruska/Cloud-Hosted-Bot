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
  teapot:  { names: ['Plekk-kann', 'Teekann', 'Lillkann', 'Hõbekann'], color: '#5f9a6a', spawn: [['tea', 10, 1], ['dairy', 5, 2], ['coin', 1, 3]] },
  bed:     { names: ['Aiapeenar', 'Kõrgpeenar', 'Lillepeenar', 'Kasvuhoone'], color: '#6a8a3a', spawn: [['flower', 10, 1], ['apple', 4, 2], ['coffee', 1, 3]] },
  toolbox: { names: ['Tööriistakast', 'Puusepakast', 'Meistrikast', 'Tööriistakapp'], color: '#8a6040', spawn: [['wood', 10, 1], ['coin', 1, 2]] },
  net:     { names: ['Kalavõrk', 'Mõrd', 'Suur võrk', 'Kalapaat'], color: '#4a7aa8', spawn: [['fish', 10, 1], ['sea', 4, 2], ['coffee', 1, 3]] },
  wheel:   { names: ['Vokk', 'Kedervokk', 'Kangasteljed', 'Vanaema teljed'], color: '#9a6aa8', spawn: [['wool', 10, 1], ['sea', 2, 3], ['coin', 1, 2]] },
};
for (const k in GENERATORS) CHAINS[k] = { kind: 'gen', name: GENERATORS[k].names[0], color: GENERATORS[k].color, names: GENERATORS[k].names };

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
    thanks: ['Aitäh! Nüüd on mul, millest terve küla räägib.', 'Imeline! Ma räägin sellest kõigile. Isegi neile, kes ei küsi.', 'Täpselt see! Kuidas sa teadsid? Ahjaa, ma ütlesin ise.', 'Oi! Sa oled päris Maali moodi. Ainult vähem laulad.'] },
  muri: { likes: ['fish', 'dairy', 'berry', 'bread'], from: 0, small: true,
    thanks: ['Mjäu. (Rahuldav. Võid jätkata.)', 'Nurr-nurr. (Ma ei ütle aitäh. Aga ma mõtlen seda.)', 'Mrr. (Panen selle oma salaladu. Diivani alla.)', 'Mjäu! (Sa oled peaaegu sama hea kui päikeselaik.)'] },
  ants: { likes: ['fish', 'sea', 'wood', 'tea', 'bread', 'wool'], from: 0, after: 'b3',
    thanks: ['Hm. Hea. Väga hea isegi.', 'Kunagi püüdsin kala, mis oli suurem kui mu paat. Aga see siin on parem.', 'Aitäh. Meri tänab ka.', 'Hm. ... Hm! (See oli Antsu kohta pikk kiitus.)'] },
  peeter: { likes: ['sea', 'wood', 'wool', 'tea', 'flower', 'apple'], from: 2,
    thanks: ['Nagu tuli pimedal ööl: täpselt õigel ajal.', 'Tähed ütlesid, et sa tuled. Või oli see Liisa.', 'Aitäh, sõber. Majakas paistab täna heledam.', 'Selle eest kirjutan sulle luuletuse. Kaheksa salmi. Vähemalt.'] },
};

// First orders are scripted for the tutorial; after that they are generated.
const ORDER_SCRIPT = [
  { who: 'liisa', items: [['bread', 2]], coins: 10, xp: 4, stars: 1 },
  { who: 'muri', items: [['berry', 2]], coins: 10, xp: 4, stars: 1 },
  { who: 'liisa', items: [['bread', 3]], coins: 15, xp: 5, stars: 1 },
  { who: 'muri', items: [['bread', 2], ['berry', 2]], coins: 15, xp: 6, stars: 1 },
];

// Areas, tasks and story. Story lines: [who, text]. who 'maali' lines are her letters.
const AREAS = [
  { key: 'bakery', name: 'Pagarikoda',
    intro: [
      ['maali', 'Kallis lapselaps! Kui sa seda kirja loed, on minu vana pagarikoda nüüd sinu oma.'],
      ['maali', 'Ta on veidi tolmune ja natuke katki. Nagu mina hommikuti. Aga tal on hea süda.'],
      ['maali', 'Küpseta, aita naabreid ja ära lase kassil laual magada. Ta teeb seda niikuinii. Kallistustega, vanaema Maali.'],
      ['liisa', 'Tere-tere! Mina olen Liisa, poest üle tee. Ma tean saarel kõike ja kõiki. Ja nüüd ka sind!'],
      ['muri', 'Mjäu. (Mina olen Muri. See on minu pagarikoda. Sina võid siin ka elada.)'],
      ['liisa', 'Hakkame pihta? Küla ootab värsket saia ja mina ootan ka!'],
    ],
    tasks: [
      { id: 'b1', name: 'Pühi tolm ja ämblikuvõrgud', cost: 1, reward: { coins: 20 }, story: [
        ['liisa', 'Apsti! Oi, kui palju tolmu. Ma aevastasin kolm korda järjest. See toob õnne!'],
        ['mina', 'Või kevadise nohu.'],
        ['muri', 'Mjäu. (Ämblik Endel kolis nüüd minu sahtlisse. Ma ei ole sellega rahul.)'] ] },
      { id: 'b2', name: 'Õlita kriuksuv uks', cost: 2, reward: { gen: 'teapot' }, story: [
        ['muri', 'Mrr. (Uks ei kriuksu enam. Lõpuks saab rahus lõunauinakut teha. Ja hommikuuinakut. Ja õhtuuinakut.)'],
        ['liisa', 'Võta see vana teekann. Ilma teeta pole pagarikoda päris pagarikoda.'],
        ['liisa', 'Ja ilma jututa pole tee päris tee. Seda osa teen mina.'] ] },
      { id: 'b3', name: 'Pese aknad puhtaks', cost: 2, reward: { energy: 20 }, story: [
        ['mina', 'Vaata! Aknast paistab meri.'],
        ['liisa', 'Ja seal sõuab Ants. Jälle vastu tuult. Ta ütleb, et tuul peab temaga sammu pidama.'],
        ['ants', 'Hm. Tere. Kui sul juhtub saia olema, siis ma võtaksin.'] ] },
      { id: 'b4', name: 'Süüta vana ahi', cost: 3, reward: { gen: 'oven' }, story: [
        ['maali', '(Ahju tagant leiad kirja.) Ära karda seda ahju. Ta pahandab ainult esimesed viis minutit. Täpselt nagu mina.'],
        ['maali', 'Kui sul on kaks ahju, pane need kokku. Kaks vana ahju teevad ühe parema. Inimestega see nii ei käi, aga ahjudega küll.'],
        ['mina', 'Uus ahi on laual. Lohistan selle vana ahju peale!'] ] },
      { id: 'b5', name: 'Värvi uus silt', cost: 3, reward: { coins: 40 }, story: [
        ['liisa', 'Mis nimi siltile tuleb?'],
        ['mina', 'Saarepagar!'],
        ['liisa', 'Ilus. Lühike. Mahub isegi minu poe kuulutustahvlile ära.'] ] },
      { id: 'b6', name: 'Täida lett värske saiaga', cost: 4, reward: { coins: 60, energy: 20 }, story: [
        ['muri', 'Mjäu? (Kas see sai on minu jaoks? Ma eeldan, et on.)'],
        ['mina', 'Muri! Käpad letilt maha!'],
        ['muri', 'Mrr. (Käpad on all. Saba on veel üleval. Saba ei loe.)'] ] },
      { id: 'b7', name: 'Ava pagarikoja uksed', cost: 5, reward: { gen: 'bed', chest: 1 }, story: [
        ['liisa', 'Kogu küla on ukse taga! Isegi postiljon, kes muidu ainult mööda sõidab.'],
        ['maali', '(Leti alt leiad veel ühe kirja.) Kui uksed on lahti, otsi mu retseptiraamatut. Peitsin selle nii hästi ära, et ei leia isegi ise.'],
        ['maali', 'Vihjeid jätsin üle kogu saare. Alusta aiast. Seal kasvab rohkem kui ainult rabarber.'],
        ['mina', 'Vanaema saladused! Lähen aeda.'] ] },
    ] },
  { key: 'garden', name: 'Aed',
    intro: [
      ['liisa', 'Maali aed! Kunagi oli see saare ilusaim. Nüüd on see saare kõrgeim. Rohi ulatub põlvini.'],
      ['muri', 'Mjäu. (Siin elab hiir Helmut. Ma ei ole teda veel kätte saanud. Me oleme mõlemad sellega rahul.)'],
    ],
    tasks: [
      { id: 'g1', name: 'Niida kõrge rohi', cost: 3, reward: { coins: 40 }, story: [
        ['mina', 'Rohu alt tuli välja kaks peenart ja üks kummik.'],
        ['liisa', 'See on Antsu kummik! Ta otsib seda juba kolmandat suve.'] ] },
      { id: 'g2', name: 'Paranda aiavärav', cost: 3, reward: { gen: 'toolbox' }, story: [
        ['liisa', 'Võta mu isa tööriistakast. Ta ütles alati: hea nael peab kauem kui halb idee.'],
        ['mina', 'Väga tark mees.'],
        ['liisa', 'Ta ehitas kuuri ilma ukseta. Aga nael pidas.'] ] },
      { id: 'g3', name: 'Istuta õunapuu', cost: 4, reward: { energy: 25 }, story: [
        ['mina', 'Väike õunapuu. Kunagi on ta suur.'],
        ['muri', 'Mrr. (Kui ta suur on, ronin ma sinna otsa ega tule enam alla. Siis peab keegi mind päästma. See on traditsioon.)'] ] },
      { id: 'g4', name: 'Ehita mesitaru', cost: 4, reward: { gen: 'basket' }, story: [
        ['liisa', 'Mesilased! Mesi kooki, mesi teesse, mesi... ma ei tea veel kuhu, aga ma leian koha.'],
        ['liisa', 'Siin, võta teine korv. Kahe korvi kokku pannes leiad ka õunu.'] ] },
      { id: 'g5', name: 'Pane püsti kiik', cost: 5, reward: { coins: 80 }, story: [
        ['mina', 'Vanaema kiik! Ta kiikus siin igal õhtul.'],
        ['liisa', 'Ja laulis. Valjult. Kogu küla teadis kõiki salme. Ka neid, mis ta ise välja mõtles.'] ] },
      { id: 'g6', name: 'Kaeva lahti vana karp', cost: 5, reward: { gen: 'bed', chest: 1 }, story: [
        ['mina', 'Õunapuu juurte all on plekist karp!'],
        ['maali', '(Karbis on kiri.) Tubli! Esimene vihje: retseptiraamat ei ole aias. Aga aed oli tore, eks?'],
        ['maali', 'Järgmine vihje on sadamas. Küsi Antsult. Kui ta vaikib, too talle kala. Kui ta siis ka vaikib, on ta magama jäänud.'] ] },
    ] },
  { key: 'harbour', name: 'Sadam', introReward: { gen: 'net' },
    intro: [
      ['ants', 'Hm. Sina oled Maali lapselaps. Sul on tema nina. Ja tema jonn, olen kuulnud.'],
      ['ants', 'Sadam on katki. Kai on katki. Paat on katki. Mina olen terve. Võta see võrk.'],
    ],
    tasks: [
      { id: 'h1', name: 'Paranda kai lauad', cost: 4, reward: { coins: 60 }, story: [
        ['ants', 'Varem kukkus siit vette üks inimene nädalas. Nüüd mitte ükski. Natuke igav.'] ] },
      { id: 'h2', name: 'Lapi Antsu paat', cost: 5, reward: { energy: 30 }, story: [
        ['ants', 'Selle paadiga püüdsin kunagi haugi, kes oli pikem kui paat.'],
        ['mina', 'Kuidas ta paati ära mahtus?'],
        ['ants', 'Ei mahtunudki. Ta ujus ise järel.'] ] },
      { id: 'h3', name: 'Riputa võrgud kuivama', cost: 5, reward: { gen: 'teapot' }, story: [
        ['peeter', 'Tere. Mina olen Peeter, majakavaht. Ma nägin sind majakast. Ma näen majakast kõike.'],
        ['peeter', 'Kingin sulle oma teekannu. Mul on neid kaks, aga ainult üks tass.'] ] },
      { id: 'h4', name: 'Ehita suitsuahi', cost: 6, reward: { coins: 90 }, story: [
        ['muri', 'MJÄU! (Suitsukala! See on parim päev mu elus. Eilne oli ka. Homne tuleb ka.)'] ] },
      { id: 'h5', name: 'Värvi paadikuur', cost: 6, reward: { energy: 30 }, story: [
        ['ants', 'Sinine? Hm. Maalile meeldis sinine. ... Hea küll. Sinine.'],
        ['liisa', 'Ants naeratas! Kas keegi nägi? Keegi pidi ju nägema!'] ] },
      { id: 'h6', name: 'Kalurite õhtusöök', cost: 7, reward: { gen: 'wheel', chest: 2 }, story: [
        ['ants', 'Maali jättis mulle kunagi kirja. Ütles, et annaksin selle sulle siis, kui sadam jälle naerab.'],
        ['maali', 'Teine vihje: retseptiraamat on seal, kus tuul jahvatab. Võta kaasa mu vokk. Veskis on külm.'],
        ['mina', 'Tuuleveski!'] ] },
    ] },
  { key: 'windmill', name: 'Tuuleveski',
    intro: [
      ['liisa', 'Tuuleveski seisab juba kakskümmend aastat. Tuul puhub, aga tiivad ei viitsi.'],
      ['peeter', 'Kui veski jälle käib, on saarel oma jahu. Ja jahust saab... kõike.'],
    ],
    tasks: [
      { id: 'w1', name: 'Korista veskikamber', cost: 6, reward: { coins: 90 }, story: [
        ['muri', 'Mrr. (Helmut elab nüüd siin. Ma tulin ainult külla. Taga ei ajanud. Natuke ainult.)'] ] },
      { id: 'w2', name: 'Paranda veskitiivad', cost: 7, reward: { energy: 30 }, story: [
        ['ants', 'Vanasti aitasin Maalil tiibu parandada. Ta ütles, et ma olen hea redel.'],
        ['mina', 'Redel?'],
        ['ants', 'Ma olin pikk. Ja ma ei rääkinud palju.'] ] },
      { id: 'w3', name: 'Õlita veskikivid', cost: 7, reward: { gen: 'net' }, story: [
        ['peeter', 'Kuula! Kivid laulavad. Madalalt, nagu vana kannel.'],
        ['peeter', 'Võta minu teine võrk. Merepõhjast leiab muudki kui kala.'] ] },
      { id: 'w4', name: 'Jahvata esimene jahu', cost: 8, reward: { coins: 120 }, story: [
        ['liisa', 'Saare oma jahu! Ma teen sellest kringli. Või kaks. Või kõik.'] ] },
      { id: 'w5', name: 'Riputa tiibadele laternad', cost: 8, reward: { energy: 40 }, story: [
        ['mina', 'Õhtul hõõgub veski nagu suur tähekaart.'],
        ['peeter', 'Majakast on see ilus vaade. Nüüd on mul kaks tuld, mida vaadata.'] ] },
      { id: 'w6', name: 'Tõsta vana veskikivi', cost: 9, reward: { gen: 'toolbox', chest: 2 }, story: [
        ['maali', '(Kivi all on kiri.) Kolmas vihje: retseptiraamatut valvab see, kes kunagi ei maga.'],
        ['peeter', 'See olen mina. Ma ei maga kunagi. Noh, päeval natuke.'],
        ['mina', 'Majakas!'] ] },
    ] },
  { key: 'lighthouse', name: 'Majakas',
    intro: [
      ['peeter', 'Tere tulemast minu majakasse. Sada kaksteist astet. Ma olen neid mitu korda lugenud. Iga kord tuleb erinev arv.'],
    ],
    tasks: [
      { id: 'l1', name: 'Paranda keerdtrepp', cost: 8, reward: { coins: 120 }, story: [
        ['mina', 'Trepp kriuksub igal astmel ise noodiga.'],
        ['peeter', 'Ma kutsun seda trepilauluks. Nüüd laulab ta puhtamalt.'] ] },
      { id: 'l2', name: 'Puhasta suur lääts', cost: 9, reward: { energy: 40 }, story: [
        ['peeter', 'Läbi läätse paistab saar nagu mänguasi. Vaata, Liisa räägib kellegagi. Muidugi räägib.'] ] },
      { id: 'l3', name: 'Paranda vana lamp', cost: 9, reward: { gen: 'wheel' }, story: [
        ['liisa', 'Ma tõin sulle teise voki! See seisis mu poes nii kaua, et kliendid arvasid, et see on mööbel.'] ] },
      { id: 'l4', name: 'Värvi majakas triibuliseks', cost: 10, reward: { coins: 150 }, story: [
        ['ants', 'Punane ja valge. Nagu õngekork. Väga hea majakas.'] ] },
      { id: 'l5', name: 'Süüta majakatuli', cost: 12, reward: { chest: 3 }, story: [
        ['peeter', 'Maali palus mul hoida ühte kirstu. Ta ütles: anna see sellele, kes saare jälle valgeks teeb.'],
        ['peeter', 'See oled sina.'],
        ['mina', 'Retseptiraamat?'],
        ['peeter', 'Võib-olla. Või vanad sokid. Maaliga ei tea kunagi.'] ] },
    ] },
  { key: 'secret', name: 'Vanaema saladus',
    intro: [
      ['maali', '(Kirstus on viimane kiri.) Kallis lapselaps! Raamatut enam ei ole. Ma rebisin selle lehtedeks ja peitsin lehed üle saare.'],
      ['maali', 'Sest retsept ei ole raamatus. Retsept on inimestes. Liisa jutus, Antsu vaikimises, Peetri tules ja Muri jonnis.'],
      ['mina', 'Aga lehed? Korjame need kokku!'],
    ],
    tasks: [
      { id: 's1', name: 'Korja retseptilehed kokku', cost: 10, reward: { coins: 150 }, story: [
        ['ants', 'Leidsin võrgust ühe lehe. „Lisa näpuotsaga soola ja natuke naeru.“ Hm.'] ] },
      { id: 's2', name: 'Köida raamat uuesti kokku', cost: 12, reward: { energy: 50 }, story: [
        ['liisa', 'Üks leht oli mu kassaaparaadi all! Kakskümmend aastat! Ma oleksin pidanud koristama.'] ] },
      { id: 's3', name: 'Küpseta vanaema kringel', cost: 14, reward: { coins: 200 }, story: [
        ['muri', 'Mjäu. (See lõhnab nagu Maali. Ma istun siin ja ootan. Mitte kringlit. Lihtsalt istun.)'] ] },
      { id: 's4', name: 'Suur saarepidu', cost: 15, reward: { coins: 500, chest: 3 }, story: [
        ['liisa', 'Kogu saar on siin! Muusika, kringel ja tants!'],
        ['ants', 'Ma ei tantsi. ... Hea küll, ühe korra.'],
        ['peeter', 'Majakas paistab täna ainult meile.'],
        ['maali', '(Kringli kõrvalt leiad veel ühe sedeli.) Ma teadsin, et sa saad hakkama. Aitäh, et hoiad mu saart soojas.'],
        ['mina', 'Aitäh, vanaema.'] ] },
    ] },
];
const TASKS = {};
AREAS.forEach((a, ai) => a.tasks.forEach(t => { t.area = ai; TASKS[t.id] = t; }));
const STORY = {
  tut1: 'Puuduta ahju, et küpsetada.',
  tut2: 'Lohista jahukott teise jahukoti peale. Ühesugused asjad ühinevad!',
  tut3: 'Liisa tellimus on valmis. Puuduta „Anna“!',
  tut4: 'Said tähe! Ava „Ülesanded“ ja tee pagarikoda korda.',
  tutDone: 'Tubli! Täida tellimusi, kogu tähti ja taasta küla.',
  ending: 'Kõik on taastatud! Küla tellib edasi. Küpseta nii palju, kui süda lustib.',
};

// Coins shop. Generator offers are added for every generator kind you have owned.
const SHOP = [
  { id: 'en25', name: 'Kohvitass', desc: '+25 energiat', price: 60, give: { energy: 25 }, icon: ['coffee', 2] },
  { id: 'en60', name: 'Kohvikann', desc: '+60 energiat', price: 130, give: { energy: 60 }, icon: ['coffee', 3] },
  { id: 'chest1', name: 'Väike kirst', desc: '3 üllatust', price: 45, give: { item: ['chest', 1] }, icon: ['chest', 1] },
  { id: 'chest2', name: 'Kirst', desc: '5 üllatust', price: 110, give: { item: ['chest', 2] }, icon: ['chest', 2] },
  { id: 'slot', name: 'Kotitasku', desc: '+1 koha kotti', price: 0, give: { slot: 1 }, icon: null },
];
const GEN_PRICE = 180;

const DAILY_POOL = [
  { id: 'merge', text: 'Ühenda {n} korda', goals: [15, 25, 35] },
  { id: 'order', text: 'Täida {n} tellimust', goals: [3, 4, 6] },
  { id: 'tap', text: 'Too generaatoritest {n} asja', goals: [25, 40, 60] },
  { id: 'coins', text: 'Teeni {n} münti', goals: [60, 100, 150] },
  { id: 'hi', text: 'Tee {n} asja vähemalt 5. tasemel', goals: [1, 2, 3] },
];
const DAILY_REWARD = { coins: 25, energy: 10 }, DAILY_BONUS = { stars: 2, chest: 1 };
