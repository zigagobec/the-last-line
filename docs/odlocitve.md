# Dnevnik odločitev — The Last Line (prototip)

Tu so zbrane vse dileme, na katere sem naletel med načrtovanjem in implementacijo.
Za vsako so zapisani **vprašanje**, **odločitev** in **obrazložitev**. Odločitve,
ki si jih sprejel ti (Žiga), so označene z *(Žiga)*. Vse ostale sem sprejel sam
in jih lahko kadarkoli spremeniš.

Večino pravil lahko pred igro spremeniš v **Nastavitvah pravil**, zato je
privzeta vrednost samo izhodišče za igranje.

---

## A. Pravila igre

### A1. Kaj je »krog«? *(Žiga)*
- **Vprašanje:** PDF pravi, da se polja označijo na začetku kroga in izginejo na
  koncu. Ni pa jasno, ali je krog ena poteza ali poteza obeh igralcev.
- **Odločitev:** krog sestavljajo ena poteza vsakega igralca, nato pride erozija.
  Kdo začne, se menja vsak krog (1. krog modra, 2. krog rdeča …).
- **Obrazložitev:** vsak igralec ima tako natanko eno priložnost za odziv na
  oznake. Menjavanje začetnika odpravi stalno prednost enega igralca. Simulacija
  to potrjuje: zmage so razdeljene približno 50 : 50.

### A2. Kje lahko rišeš in radiraš? *(Žiga)*
- **Odločitev:** kjerkoli na plošči, brez omejitve števila. V nastavitvah sta na
  voljo še možnosti »do 2 polji« in »samo sosednja«.
- **Glej tudi B1:** simulacija kaže, da to pravilo vodi v vlečenje vrvi z risanjem
  in radiranjem.

### A3. Koliko polj izgine na krog? *(Žiga)*
- **Odločitev:** 2 robni + 1 naključno, po predlogu iz PDF-ja. V nastavitvah je
  oboje mogoče spreminjati od 0 do 4.

### A4. Kaj je »robno« polje?
- **Vprašanje:** PDF pravi, da se plošča krči proti notranjosti. Ali je tudi polje
  ob notranji luknji robno?
- **Odločitev:** robno je polje, ki meji na zunanjost plošče ali na vrzel, ki je
  preko drugih vrzeli povezana z zunanjostjo. Polja ob zaprti notranji luknji niso
  robna.
- **Obrazložitev:** tako se plošča res krči od zunaj navznoter, naključna notranja
  luknja pa ne pospeši erozije v sredini.

### A5. Začetna postavitev
- **Odločitev:** postavitev je naključna, a zrcalno simetrična glede na središče.
  Na 8×8 so 4 drevesa in 2 notranji vrzeli. Modra podgana začne na (1,3), rdeča na
  (6,4). Na začetnih poljih in poljih ob njih ni ovir. Seed postavitve je viden in
  ga lahko podaš tudi v URL-ju z `?seed=123`.
- **Obrazložitev:** simetrija pomeni pošteno izhodišče. Nekaj dreves in vrzeli
  že na začetku pokaže vse mehanike, seed pa omogoča, da zanimivo igro ponoviš.

### A6. Mostovi — kje in kako?
- **Odločitev:** most lahko narišeš na katerokoli vrzel, ki ima kopno na obeh
  nasprotnih straneh. Drevo na enem od koncev je dovoljeno; prečkanje je
  blokirano, dokler ga ne pobrišeš. Če sta možni obe smeri, jo izbereš s tipko
  `R` ali gumbom ⟲. Prečkanje je ena poteza: podgana skoči čez vrzel na drugo
  stran. Na mostu nikoli ne stoji.
- **Obrazložitev:** to se ujema s sliko iz PDF-ja (puščica čez most) in je
  najpreprostejše.

### A7. Kaj se zgodi z mostom, ko izgine polje na njegovem koncu?
- **Odločitev:** most se podre (izgine) v isti eroziji.
- **Obrazložitev:** most, ki vodi v prazno, nima smisla, igralcu pa bi samo
  zameglil sliko.

### A8. Dodana akcija »Preskoči«
- **Vprašanje:** PDF zahteva eno od štirih akcij. Kaj pa, ko je vsaka akcija
  škodljiva ali nobena ni možna?
- **Odločitev:** dodal sem akcijo »Preskoči« (ne narediš nič).
- **Obrazložitev:** igralec ni nikoli prisiljen v slabo potezo in ne obtiči.
  Ker lahko rišeš kjerkoli, je bila praktično enaka možnost že na voljo (drevo
  nekam daleč), zato to igre ne spremeni.

### A9. Omejitev črnila
- **Odločitev:** v prvi verziji števila risb ne omejujem.
- **Obrazložitev:** poteza je že sama po sebi strošek (ali rišeš ali se
  premakneš). Če se bo vlečenje vrvi (B1) izkazalo za dolgočasno, je omejitev
  črnila prvi kandidat za popravek.

### A10. Razveljavi potezo
- **Odločitev:** razveljavitve ni. Pred napačnim klikom varuje predogled ob
  prehodu z miško: preden klikneš, vidiš, kaj se bo zgodilo.

---

## B. Ugotovitve iz simulacije (bot proti botu)

Simulacijo poženeš z `npm run sim -- --games 300`. Bot je preprost in gleda eno
potezo naprej. Ceni preživetje, ubijanje nasprotnika in število dosegljivih varnih
polj (svojih minus nasprotnikovih). Rezultati veljajo za 300 iger na 8×8.

| Različica | Zmage modri / rdeči / neodločeno | Povprečno krogov | Mešanica akcij |
|---|---|---|---|
| **privzeto** (2 rob + 1 nakl., kjerkoli) | 50 / 48 / 2 % | 16,9 | drevo 47 %, radirka 34 %, premik 11 %, most 8 % |
| doseg 2 | 42 / 46 / 12 % | 19,0 | premik 28 %, radirka 24 %, drevo 23 %, most 18 %, preskoči 7 % |
| doseg 1 | 44 / 38 / 18 % | 20,6 | premik 37 %, preskoči 34 %, ostalo ~10 % |
| 3 rob + 0 nakl. | 43 / 49 / 8 % | 17,7 | podobno kot privzeto |
| 2 rob + 0 nakl. | 49 / 49 / 2 % | 26,3 | podobno kot privzeto |
| pameten bot proti naključnemu | 90 / 7 / 3 % | 13,9 | — |

### B1. Igra se pri pravilu »kjerkoli« sprevrže v vlečenje vrvi
- **Opažanje:** ko lahko rišeš kjerkoli, bota večino časa rišeta drevesa ob
  nasprotniku in radirata drevesa ob sebi (81 % akcij). Premiki so samo 11 %.
  Pri dosegu 2 se igra precej bolj premika (28 % premikov, 18 % mostov), igra pa
  je bolj prostorska.
- **Odločitev:** privzeto pustim pri »kjerkoli«, ker si tako izbral ti. Ko boste
  igrali, priporočam, da preizkusite tudi doseg 2 (Nastavitve pravil).
- **Obrazložitev:** bot je preprost in ljudje bodo igrali drugače, a vzorec je
  močan signal, da »kjerkoli« naredi premikanje manj pomembno.

### B2. Ravnotežje začetnika je dobro
- **Opažanje:** z izmenjevanjem začetnika so zmage razdeljene približno 50 : 50.
  Igra ni pristranska do nobenega igralca.

### B3. Dolžina igre
- **Opažanje:** privzeto traja igra ~17 krogov, kar je ~34 potez oziroma 5–10
  minut za dva človeka. To se zdi primerno za igro s prijatelji.

### B4. Naključnost
- **Opažanje:** v ~2/3 iger se konec zgodi tako, da je podgana na začetku kroga
  na označenem polju brez izhoda. Pogosto je tja prišla zaradi nasprotnikovih
  dreves, kar je v duhu »ujemi nasprotnika«. Pri »2 rob + 0 nakl.« je ta delež
  manjši (56 %), igra pa daljša (26 krogov). Če se vam bo zdelo preveč naključno,
  poskusite to različico.

### B5. Ročno igranje (kot oba igralca)
- **Opažanje:** prvih ~4–5 krogov je mirnih, ker sta obe podgani daleč od roba in
  ju erozija ne ogroža. Napetost nastane, ko se plošča skrči in so podgane blizu
  robov ali v »žepih« med vrzelmi in drevesi.
- **Kako deluje past:** nasprotnika ujameš, ko stoji na označenem polju in ima
  največ en prost izhod. Če si na vrsti pred njim, mu zadnji izhod zapreš z
  drevesom. Radiranje mu ne pomaga, ker porabi potezo in se nato ne more več
  premakniti. To je zanimiv »tempo« trenutek, podoben šahu, in mehanika deluje.
- **Past za samega sebe:** most, ki vodi na polje z drevesom, je neuporaben. V
  testni igri sem z napačnim mostom sam zaprl svojo podgano v žep. Igra to
  dobro kaznuje, kar je v redu.
- **Ideje za naslednjo iteracijo** (če izberete to idejo): erozija, ki z vsakim
  krogom narašča, da je začetek hitrejši, omejena zaloga črnila, doseg 2 kot
  privzeto pravilo in plošča 6×6 za hitro igro.

---

## C. Odločitve pri implementaciji

### C1. Preskok zahteva potrditev
- **Odločitev:** »Preskoči« je treba klikniti dvakrat (ali dvakrat pritisniti 5).
  Držanje tipke ne šteje.
- **Obrazložitev:** preskok je edina poteza brez klika na ploščo, zato bi ga bilo
  prelahko sprožiti po nesreči.

### C2. Ko zmanjka robnih polj
- **Vprašanje:** kaj, če je robnih polj manj, kot jih zahteva pravilo?
- **Odločitev:** manjkajoča se izberejo naključno med preostalimi polji, tako da
  skupno število izginulih polj ostane enako.
- **Obrazložitev:** to se zgodi le čisto na koncu, ko polj skoraj ni več. Tako se
  igra zanesljivo konča.

### C3. Vsaj eno polje na krog
- **Odločitev:** če v nastavitvah izbereš 0 robnih in 0 naključnih polj, se robno
  nastavi na 1.
- **Obrazložitev:** brez erozije se igra nikoli ne bi končala.

### C4. Črte s črnilom
- **Odločitev:** obrobe rišem samo tam, kjer se stikata različna predmeta (polje
  ob polju, polje ob ozadju). Travnati rob na vrhu polj je narisan v »teksturi«
  (shaderju), ne iz geometrije.
- **Obrazložitev:** risbe v PDF-ju imajo valovit travnat rob namesto ravne črte
  med vrhom in stranico. Z zaznavanjem normal bi dobili dvojne ravne črte.

### C5. Mostovi so tanke 3D deske
- **Odločitev:** most je tanka deska iz desk, ne ploščata 2D slika.
- **Obrazložitev:** tako dobi enako obrobo s črnilom kot polja in je viden iz
  vseh kotov kamere.

### C6. Zamenjava sličic s PNG-ji
- **Odločitev:** PNG v `public/sprites/` zamenja generirano sličico, če je njegovo
  ime našteto v `PNG_SPRITES` (`src/render/atlas.ts`). Trenutno sta to `tree` in
  `sign` iz PDF-ja.
- **Obrazložitev:** statično gostovanje (GitHub Pages) ne zna izpisati vsebine
  mape. Preizkušanje vseh imen bi v konzoli pustilo kup napak 404.

### C7. Klik na drevo, podgano ali tablo
- **Odločitev:** klik na narisano drevo, podgano ali tablo pomeni polje, na katerem
  stoji, s pikselsko natančnim preverjanjem prosojnosti. Pri orodjih Premik in Most
  gre klik skozi drevesa, ker drevo tam ni nikoli veljaven cilj.
- **Obrazložitev:** brez tega je klik na krošnjo zadel polje za drevesom. To sem
  odkril pri avtomatskem igranju, ko se klikom za podgano ni zgodilo nič.

### C8. Orodje Drevo ne pobarva vseh polj
- **Odločitev:** pri dosegu »kjerkoli« orodje Drevo ne obarva vseh dovoljenih
  polj, ampak pokaže samo predogled drevesa pod miško. Nedovoljeno polje dobi
  sivi križ. Pri omejenem dosegu se obarva območje dosega.
- **Obrazložitev:** sicer bi bila pobarvana cela plošča, kar ne pove nič.

### C9. Drevesa pred podgano postanejo prosojna
- **Odločitev:** drevo, ki zakriva vsaj ~30 % podgane, se izriše prosojno.
- **Obrazložitev:** obkrožena podgana se je za drevesi popolnoma skrila, kar
  krši cilj »igralec mora vedno videti, kaj se dogaja«.

### C10. Opozorilo za nevarno polje
- **Odločitev:** ko igralec stoji na polju, ki bo izginilo, HUD to pokaže v
  rdečem.

### C11. Kamera na telefonu
- **Odločitev:** na pokončnih zaslonih kamera gleda bolj od zgoraj in skoraj
  vzdolž plošče. Na širokih zaslonih ostane klasičen diagonalni »izometrični«
  pogled. Plošča se vedno točno prilega prostoru med zgornjo in spodnjo vrstico.
- **Obrazložitev:** na telefonu so bila polja pri diagonalnem pogledu premajhna
  za prst (~35 px). Zdaj merijo ~45 px.

### C12. Testni vmesnik `window.__game`
- **Odločitev:** ostane tudi v objavljeni različici.
- **Obrazložitev:** prek njega avtomatski testi igrajo celo igro s pravimi kliki.
  Pri igri za dva na isti napravi goljufanje prek konzole ni problem.

### C13. PDF ni v javnem repozitoriju
- **Odločitev:** v javni repozitorij gre samo igra in iz PDF-ja izrezani risbi
  (drevo, tabla). Sam PDF z vašim dizajnom ostane lokalno.
- **Obrazložitev:** objaviti si me prosil igro, za objavo celotnega dokumenta
  nisem imel dovoljenja.

### C14. Dotik: risanje v dveh tapih
- **Odločitev:** na telefonu prvi tap z orodjem Drevo, Most ali Radirka pokaže
  predogled. Drugi tap na isto polje potezo izvede. Premik gre še vedno z enim
  tapom, ker so dovoljena polja že obarvana.
- **Obrazložitev:** na zaslonu na dotik ni prehoda z miško, zato brez tega ne bi
  bilo predogleda in bi vsak nenamerni dotik takoj narisal drevo.

### C15. Združljivost shaderjev
- **Odločitev:** shaderji ne uporabljajo direktive `diagnostic(off, …)`.
  Vse derivacije se izračunajo na začetku fragment shaderja.
- **Obrazložitev:** podpora te direktive v Safariju (iPhone) in Firefoxu ni
  zanesljiva. Če je ne bi bilo, bi se igra na teh napravah sploh ne izrisala.

### C16. Postavitev na majhnih in ležečih zaslonih
- **Odločitev:** prostor za ploščo se izmeri iz dejanskih elementov HUD-a, ne
  iz fiksnih odstotkov. Na ozkih telefonih (≤ 380 px) je orodna vrstica bolj
  kompaktna, da ostane v eni vrsti. Na nizkih ležečih zaslonih se skrijeta
  namig in podrobnosti kroga, ostane samo »Na potezi«. Opozorilo za nevarno
  polje ostane vidno.
- **Obrazložitev:** na telefonu, obrnjenem na bok, je plošča prej zlezla pod
  orodno vrstico, na majhnem telefonu pa se je orodna vrstica razlomila v dve
  vrstici.
