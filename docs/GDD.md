# GDD — Dungeon-incremental

Version 0.4 · levende dokument · senest opdateret 29. august 2026

Dette dokument er projektets løbende **source of truth** for gameplayregler og tekniske løfter. Nye beslutninger skrives ind, når de aftales. Hvis to formuleringer er i konflikt, gælder den senest daterede **[LÅST]**-beslutning i beslutningsloggen, og det ældre afsnit skal rettes i samme ændring.

Statusmarkering:

- **[LÅST]** = besluttet
- **[RETNING]** = aftalt retning, detaljer kan ændres
- **[ÅBEN]** = uafklaret
- **[UDSKUDT]** = bevidst gemt til efter kerneloopet er bevist

## 0. Aktuelt regelgrundlag

### Player Level og træning [LÅST]

- Player Level XP kommer kun fra belønninger i Dungeon.
- Træning giver aldrig Player Level XP.
- Hvert Player Level efter level 1 giver ét skill point.
- Skill points kan frit og øjeblikkeligt flyttes mellem stats.
- Allokerede skill points bestemmer træningshastigheden for den valgte stat.
- ATK og HP har hver sin kontinuerlige progressbar. Når baren fyldes, stiger den pågældende stat direkte ét level.
- ATK- og HP-træning fortsætter, mens et Dungeon-run er aktivt.
- Reallokering påvirker kun fremtidig træningshastighed. Opnåede stat-levels og progress mistes aldrig.

### Training UI [LÅST]

- Stats navngives **ATK** og **HP**.
- Toppen viser kun Player Level og Deepest Floor.
- Unspent Skill Points vises i en separat boks.
- Hver stat vises som en kompakt række med navn, level, progressbar og `− / +`.
- Allokerede point, afledte kampværdier og træningshastighed skjules på den kompakte Training-skærm.
- `+` skal se disabled ud og være inaktiv, når spilleren ikke har unspent skill points.

### Beslutningslog

| Dato            | Status | Beslutning                                                           |
| --------------- | ------ | -------------------------------------------------------------------- |
| 29. august 2026 | [LÅST] | Player Level XP kommer fra Dungeon og aldrig fra træning.            |
| 29. august 2026 | [LÅST] | Stats hedder ATK og HP.                                              |
| 29. august 2026 | [LÅST] | Skill points kan frit reallokeres og styrer stat-træningshastighed.  |
| 29. august 2026 | [LÅST] | ATK og HP leveler direkte gennem hver sin kontinuerlige progressbar. |
| 29. august 2026 | [LÅST] | Training-skærmen bruger kompakte, skalerbare stat-rækker.            |

Arbejdstitlen er fortsat åben. Prototypen hedder "Dybet", men navnet kolliderer med _The Deep_. Kandidater: **Sækken**, **Nedstigning** eller en kombination. **[ÅBEN]**

---

## 1. Vision

Et klik/idle-incremental, hvor progressionen er bygget omkring ægte beslutninger. En kriger bevæger sig ned gennem en potentielt uendelig dungeon, samler loot i en synlig sæk og skal efter hver overvundet risikofyldt etage vælge mellem at gå dybere eller bære gevinsten hjem.

Spillets centrale fantasi er ikke at være en udødelig helt. Det er at være en stadig stærkere eventyrer med en stadig tungere sæk og én trappe for meget foran sig.

### Designsøjler [LÅST]

1. **Ægte beslutninger.** Når spilleren kan vælge mellem to handlinger, skal der eksistere et rimeligt argument for begge.
2. **Kendte odds, ukendt udfald.** Spilleren får ærlige ranges og komplette mekaniske oplysninger. Usikkerheden ligger i udfaldet, ikke i skjulte regler.
3. **Vis fakta, ikke facit.** UI'et må vise simple, deterministiske transformationer af kendte tal, men aldrig anbefalinger, risikofarver, forventede udfald eller samlede overlevelseschancer.
4. **Lyv aldrig om ranges.** Et deklareret udfaldsrum må aldrig brydes. Sjældne varianter og særregler skal stå i varedeklarationen.
5. **Tabet skal svie, men aldrig knække.** Død koster kun det aktuelle runs ubankede gevinst. Permanent power regredierer aldrig.
6. **Dybet skal være progressionens motor.** Idle-systemet må føre spilleren hen til den aktuelle mur, men må aldrig slå muren på spillerens vegne.

### Tilladt og forbudt informationshjælp [LÅST]

Tilladt:

- `6 rå skade → 4 efter rustning`
- `ATK 35 → skade 5–15`
- `Regen 6/etage · nuværende loft 8`
- præcise eller sandfærdigt deklarerede værdiranges

Ikke tilladt:

- `72% chance for at overleve`
- `denne etage er farlig`
- grøn/gul/rød risikovurdering
- `du bør vende hjem`

Hovedregningen og den gradvist bedre mavefornemmelse er en del af gameplayet.

### Lommeregner-holdningen [LÅST]

Den matematisk optimale stopping-strategi er i princippet beregnelig, og community-værktøjer accepteres. Spillet konkurrerer ikke ved at skjule fakta. Det skaber i stedet værdier, som afhænger af spillerens aktuelle mål:

- sækkens konkrete materialer og gear
- spillerens aktuelle HP
- fundet gear, der kan bruges nu eller sikres til senere
- buildets forhold til den næste fjendekomposition

En forsigtig optimizer skal kunne spille succesfuldt, men langsommere end en spiller, der tager velovervejede risici.

---

## 2. Kerneloop [LÅST]

```text
        LEJREN (idle-lag)                    DYBET (aktivt lag)
  ┌──────────────────────────┐        ┌──────────────────────────────┐
  │ Træning gror stats       │  ned   │ Trygge etager passeres      │
  │ Fokus styrer vækst       │ ─────► │ Risikozonen giver loot      │
  │ Ekspeditioner giver      │        │ HP slides nedad              │
  │ gamle materialer         │ ◄───── │ Dybere eller hjem?           │
  │ Smedning laver gear      │ hjem/  │ Ubanket gear kan bruges      │
  └──────────────────────────┘  død   └──────────────────────────────┘
```

- Et run starter altid på etage 1.
- Etager, som beviseligt ikke kan skade spilleren, auto-resolves som en hurtig rejsemontage.
- Helt sikre auto-resolve-etager giver ikke almindeligt repeat-loot. **[LÅST]**
- Første etage, der kan skade spilleren, stopper montagen og bliver et aktivt beslutningspunkt.
- Efter en vundet kamp går loot direkte i sækken, hvorefter spilleren vælger mellem næste etage og hjemkomst.
- **Vend hjem:** Alt i sækken bankes permanent.
- **Død:** Alt ubanket indhold i sækken, inklusive fundet og midlertidigt udstyret gear, mistes.
- Stats, banket gear, bossmilepæle, opskrifter og bestiarieviden beholdes altid.

### Hvorfor sikre etager ikke giver repeat-loot

Hvis øjeblikkelige, risikofri etager producerer loot ved hvert run, bliver den optimale strategi at gentage korte sikre runs. Det ville gøre kliktempo vigtigere end risikovurdering og knække både økonomien og sækkens funktion.

Gamle områder bevarer deres værdi gennem lejrens ekspeditioner, ikke gennem gentagen manuel montage-farming.

### To lag, to tempi [LÅST]

- **Lejren er idle:** Sikker vækst, planlægning, træningsfokus, ekspeditioner og smedning.
- **Dybet er aktivt:** Korte runs med attrition, synlig indsats og stop/go-beslutninger.

### Feel-test [LÅST]

Kerneloopet består sin vigtigste test, hvis spilleren med lavt HP, et eftertragtet fund i sækken og en læsbar næste etage reelt tøver før valget.

Referenceøjeblik:

> 30% HP. En Flammerubin eller en ny økse i sækken. Trappen ned er åben. Spilleren holder pause.

Hvis spilleren konsekvent vælger øjeblikkeligt, skal belønningskurven, indsatsen eller mellemzonens varians rekalibreres.

---

## 3. Informationssystem [LÅST]

Begge sider af kampen beskrives med samme sprog: ranges og deklarerede regler.

### Etage-preview skal vise

- fjendetype og navn
- antal som range
- HP pr. fjende som præcis værdi eller range
- rå skade pr. slag som range
- effektiv skade efter spillerens rustning
- særregler, immuniteter og deklarerede sjældne varianter
- spillerens relevante skade-range i samme skærmbillede

Eksempel:

```text
ETAGE 9 — Kælderrotter
Antal: 3–5
HP pr. rotte: 8–12
Skade: 4–7 → 2–5 efter rustning
Din skade: 5–15
5% chance: Gravridder [vis detaljer]
```

En sjælden variant må ikke blot navngives. Dens fulde kendte ranges og særregler skal kunne åbnes, før spilleren committer.

### Stat sheet

Rå stats er det, spilleren træner. Afledte ranges er det, spilleren bruger i beslutningen. Formlen behøver ikke vises, men enhver ændring i den afledte range skal fremgå med det samme.

### De tre zoner

For enhver statline findes:

- **Tryg zone:** Selv værste relevante udfald kan ikke koste HP.
- **Mellemzone:** Både komfortable sejre og dødelige forløb er mulige.
- **Selvmordszone:** Selv bedste relevante udfald kan ikke føre til sejr.

Zonerne er et internt balanceværktøj, ikke labels i UI'et. Spillet skal holde spilleren omkring mellemzonen så ofte som muligt.

### Viden som progression [RETNING]

Første møde med en ny mekanik må gerne undervise gennem nederlag, hvis mekanikken derefter registreres permanent og er tilgængelig før næste forsøg.

Gentagne dødsfald til den samme skjulte regel accepteres ikke.

### Scouting [UDSKUDT]

Præcis information om det konkrete udfald inden for et deklareret range kan senere gøres købbar. Systemet designes først, efter kerneloopet er bevist.

---

## 4. Kamp [LÅST i model, tal er RETNING]

Rundebaseret auto-combat:

1. Spilleren angriber først og rammer én fjende.
2. Alle overlevende fjender angriber tilbage.
3. Runden gentages, indtil én side er død.

### Skade

Foreløbig spillerformel:

```text
DMG = [ATK/7 ; 3×ATK/7]
```

35 ATK giver dermed 5–15 skade.

### Rustning

Rustning reducerer hvert indkommende slag med et fladt beløb. Effektiv skade vises direkte i preview og kampafspilning.

Flad reduktion skaber læsbare breakpoints. Når alle relevante angreb reduceres til nul, bliver etagen en del af den risikofri montage.

### Varians

- Mange små fjender giver flere kast og mere statistisk jævne resultater.
- Få store fjender giver færre kast og mere swingy resultater.
- Fjendens HP er en nødvendig del af denne information, fordi den afgør antallet af svarslag.

### Kampafspilning

Motoren afgør kampen deterministisk ud fra seed og returnerer en event-liste.

UI'et afspiller resultatet på 1×, 2×, 4× eller øjeblikkeligt. Animation må aldrig ændre kampens udfald.

---

## 5. Dybet [RETNING]

Dybet er potentielt uendeligt og procedurelt skaleret.

- Hver 5. etage er en boss.
- Bossen er en tydelig milepæl og låser næste progressionstrin op.
- Tidlige etager har smallere ranges og underviser systemet.
- Dybere etager har bredere, men stadig ærligt deklarerede, udfaldsrum.
- Fjendekompositioner skal med tiden stille forskellige spørgsmål til forskellige builds.

### Bossmilepæle [LÅST i retning]

Permanente trænings- og regenlofter hæves ved bossmilepæle frem for ved hver enkelt etage.

Eksempel:

- Boss 5 besejret → træning tier 2
- Boss 10 besejret → træning tier 3
- Boss 15 besejret → træning tier 4

Det gør loftet forståeligt, giver bosser permanent betydning og reducerer uklare mikro-opgraderinger.

### Etagearketyper [UDSKUDT]

Glaskanoner, damage-svampe, sværme og andre specialiserede etager gemmes, indtil det grundlæggende stop/go-loop og de første builds er bevist.

### Etagehændelser og tilbud [UDSKUDT]

Etagehændelser indgår **ikke** i v2. Muligheden bevares som en senere udvidelse, men der designes eller implementeres ikke et eventkatalog under den aktuelle kernetest.

### Balanceintentioner

- Hvert progressionstrin skal flytte mellemzonen nedad uden at fjerne den.
- Attrition over flere etager skal være markant farligere end en isoleret frisk kamp.
- En frisk bosskamp omkring 66% winrate er foreløbig reference for en fristende gamble.
- De konkrete tal vedligeholdes i versionsstyrede balancebilag og må rekalibreres uden at ændre GDD'ens løfter.

---

## 6. Loot og sækken [LÅST]

Alt ubanket loot ligger i sækken og er permanent synligt under et run.

### Grundregler

- Sækken og dens konkrete indhold er på spil; permanent power er ikke.
- Sjældne fund afsløres, når de findes, ikke ved hjemkomst.
- Ualmindelig, Sjælden, Episk og Legendarisk er de foreløbige raritetstrin.
- Belønningskurven skal være stejl nok til, at mellemzonen frister.
- Helt sikre auto-resolve-etager giver ikke almindeligt repeat-loot.

### Værdiinformation [LÅST]

UI'et viser præcis kendt værdi. Hvis værdien reelt er tilfældig, vises et sandfærdigt range.

Eksempel:

```text
340 guld
Jernmalm ×3
Flammerubin ×1
Kendt salgspris: 500 guld
Bruges også til: Flammeklinge
```

Materialer behøver ikke reduceres til én samlet guldværdi. Deres værdi afhænger af spillerens opskrifter og mål, hvilket er en tilsigtet del af beslutningen.

### Gravsæk [UDSKUDT]

Ubanket loot kan senere eventuelt efterlades på dødsstedet og hentes i et nyt run.

Mekanikken implementeres ikke, før tabets nuværende styrke er testet.

---

## 7. Lejren

### 7.1 Træning [LÅST]

ATK og HP trænes kontinuerligt gennem hver sin progressbar. Skill points fra Player Level fordeles mellem stats og bestemmer deres træningshastighed.

- Træning giver stat-progress, ikke Player Level XP.
- Player Level XP kommer fra Dungeon.
- En fyldt stat-bar leveler den pågældende stat direkte.
- Skill points kan omfordeles gratis og øjeblikkeligt.
- Opnåede levels og eksisterende progress regredierer aldrig ved reallokering.
- Træningen fortsætter under aktive Dungeon-runs.

Den videre progressionsretning er:

1. Kontinuerlig træning af ATK og HP.
2. Fri fokusfordeling gennem skill points.
3. Bossbaserede træningslofter.
4. Multipliers inden for det aktuelle bossloft.
5. Nye stats og træningsspor.

### 7.2 Stats [RETNING]

| Stat     | Funktion                                                               |
| -------- | ---------------------------------------------------------------------- |
| ATK      | Hurtigere kills og dermed kortere eksponering                          |
| HP       | Buffer mod varians og samlet attrition                                 |
| Rustning | Flad reduktion og læsbare breakpoints                                  |
| Regen    | Heling mellem etager; bekæmper attrition uden at fjerne den            |
| Crit     | Overkill spilder videre; stærk mod sværme og mere swingy mod store mål |

### Regen-reglen [LÅST]

Regen kan højst hele 50% af den forventede gennemsnitsskade på den aktuelle boss-tiers referencedybde.

Det konkrete loft beregnes i motoren, men vises altid direkte til spilleren.

Eksempel:

```text
Regen: 6 HP/etage
Nuværende loft: 8 HP/etage
Besejr bossen på etage 15 for at hæve loftet
```

Spilleren må ikke kunne investere i regen uden at kunne se, at loftet er nået.

### Crit-reglen [LÅST]

Crit-overkill spilder over på den næste fjende. Det gør crit til en naturlig sværm-stat.

Mod én stor fjende forbliver crit mere varianspræget.

### 7.3 Anti-ventemaskinen [LÅST]

Auto-træning må føre spilleren frem til det aktuelle bossloft, men aldrig gennem det. Nye tiers kræver en aktiv bosssejr i Dybet.

Kæden er:

```text
Træn til loftet → kæmp i Dybet → besejr boss → hæv loftet → træn videre
```

Fuld offline-rate er tilladt, fordi offline-progressionen stopper ved det aktuelle loft.

### 7.4 Ekspeditioner til gamle områder [LÅST i retning]

Gamle etager bevarer deres materialeværdi gennem en idle-aktivitet i lejren.

Spilleren vælger et erobret område og sender krigeren på ekspedition. Under ekspeditionen indsamles områdets materialer over reel tid, men krigeren kan ikke træne samtidig.

Eksempel:

```text
Jernminen — etage 6–9
Forventet udbytte: 8–12 jernmalm/time
Træning sat på pause under ekspeditionen
```

Ranges skal være ærlige. Ekspeditionen må ikke kunne accelereres gennem gentagne klik.

### 7.5 Materialer og smedning [RETNING]

Gear fremstilles af kendte opskrifter med bankede materialer og guld.

- Progressionskritisk gear er craftbart.
- Bossmaterialer kan fungere som nøgler til næste gear-tier.
- Sjældne unikke drops er supplement, ikke et krav for progression.
- Opskrifter viser altid fulde omkostninger.

### 7.6 Fundet gear midt i run [LÅST i retning — v2]

Fundet gear kan bruges med det samme, mens det stadig er ubanket.

- Udstyret bliver først permanent ved hjemkomst.
- Død ødelægger det ubankede fund.
- Spillerens tidligere permanente gear forbliver sikkert i lejren og genudstyres efter død.
- Det skal være tilladt at lade fundet blive i sækken og beholde sin stabile loadout.

Første proof of concept er ét våben med en tydelig variansprofil:

```text
Rusten krigsøkse
Nuværende skade: 5–15
Med øksen: 2–24

[UDSTYR UBANKET ØKSE]
[BEHOLD NUVÆRENDE VÅBEN]
```

Øksen skaber et konkret valg mellem sikker banking, øjeblikkelig kampkraft og større udfaldsvarians.

### 7.7 Elevator [UDSKUDT]

En betalt dyb-start kan senere udforskes. Den må have en reel loot- eller økonomiomkostning, så et fuldt maratonrun fortsat har en rolle.

---

## 8. Progressionsarkitektur [LÅST i struktur]

```text
TRÆNING                    GEAR                       DYBDE
Langsomt, sikkert gulv     Situationsbestemte spring Bossmilepæle hæver loftet
        ▲                         ▲                         │
        └────────── materialer og guld fra Dybet ─────────┘
```

- **Træning er gulvet:** Sikker vækst, som aldrig mistes.
- **Gear er springet:** Planlagte eller fundne ændringer i power og variansprofil.
- **Dybde er loftet:** Aktiv fremgang i Dybet låser næste idle-fase op.
- **Ekspeditioner er genbrug:** Gamle områder leverer målrettede materialer mod tab af træningstid.

### Offline-progression [LÅST]

Fuld offline-rate uden straf. Spilleren kan vente sig frem til det aktuelle bossloft, men ikke gennem det.

### Prestige [UDSKUDT]

Hvis endgame senere kræver prestige, foretrækkes parallelle krigere eller delte unlocks frem for reset.

Permanent power må fortsat ikke regrediere.

### Onboarding [RETNING]

- Minut 1: ATK, HP, én dummy, én nedstigning.
- Første mur: Lær stop/go og banking.
- Første boss: Introducer bossloftet.
- Derefter: Auto-træning og fokus.
- Senere: Fundet ubanket gear.
- Efter kernetesten: Rustning, smedning, regen, crit og ekspeditioner i passende rækkefølge.

Hvert system skal ankomme som svar på et problem, spilleren allerede har oplevet.

---

## 9. Teknisk arkitektur [LÅST i retning]

Aktuel stack: Next.js 16, React og TypeScript. Lokal state håndteres foreløbigt med en reducer og et versioneret localStorage-save. Et separat state-bibliotek indføres kun, hvis kompleksiteten kræver det.

Motoren er ren TypeScript uden React eller DOM:

```text
app/
  page.tsx
  globals.css
lib/
  game.ts
  engine/
    rng.ts
    combat.ts
    floors.ts
    loot.ts
    types.ts
```

### Tekniske krav

- Seedbar RNG til replay, tests og reproducerbare fejl.
- `resolveCombat` returnerer en deterministisk event-liste.
- Simulationen genbruger den samme kampkode som spillet.
- Save-formatet er versioneret og understøtter migrations.
- Alle balancetal bor i konfiguration, ikke i UI-komponenter.
- Combat kan afspilles i flere hastigheder eller springes over uden at ændre udfaldet.

### Telemetri til feel-test

Hver stop/go-beslutning logges lokalt med:

- etage og boss-tier
- nuværende og maksimalt HP
- sækkens konkrete indhold og kendte værdi
- næste fjendekomposition og deklarerede ranges
- valgt handling
- betænkningstid
- om fundet ubanket gear var udstyret
- runnets efterfølgende udfald

Formålet er ikke at optimere spilleren, men at se, om mellemzonen faktisk producerer tøven og varierede valg.

---

## 10. Byggerækkefølge

### v2 — kernetesten [LÅST i retning]

1. Seedbar kampmotor og sim-verifikation.
2. Fjende-HP og komplette særregler i previewet.
3. Ingen almindeligt repeat-loot fra helt sikre montage-etager.
4. Præcise sækværdier eller ærlige værdiranges.
5. Stop/go-flow, banking, død og lokal beslutningstelemetri.
6. Ét fundet mid-run-våben med stabil/swingy tradeoff.
7. Feel-test og rekalibrering.

### v2.5 — lejrens udvidede idle-loop

1. Bossbaserede træningslofter.
2. Offline-progression.
3. Simple ekspeditioner til gamle materialer.

### v3 — builds og smedning

1. Materialer og craftbare opskrifter.
2. Flere våbenprofiler.
3. Rustning som breakpoint-stat.
4. Regen med synligt bossbaseret loft.
5. Crit med overkill-spillover.

### Senere, kun efter bevist kerneloop

- etagearketyper
- etagehændelser og tilbud
- scouting
- elevator
- gravsæk
- flere karakterer eller prestige

---

## 11. Åbne spørgsmål

1. Endelig titel.
2. Den præcise lootkurve omkring spillerens aktuelle mur.
3. Hvor hurtigt sikre etager skal passere i montagen.
4. Om alle bossmilepæle eller kun udvalgte bosser hæver bestemte lofter.
5. Ekspeditionernes præcise tids- og udbyttekurve.
6. Hvor tidligt den første ubankede økse skal introduceres.
7. Om fundet gear altid viser sin fulde endelige crafting-/salgsværdi med det samme.
8. Hvornår rustning, regen og crit introduceres i onboarding.
9. Om unikke ikke-craftbare drops skal eksistere i den første fulde version.
