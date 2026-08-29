# GDD — Dungeon Incremental

Version 0.1 · levende dokument · startet 29. august 2026

Dette er spillets nye, løbende source of truth. Dokumentet indeholder kun regler, vi har besluttet sammen fra denne version og frem. Tidligere GDD-indhold er slettet og gælder ikke længere.

## Statusmarkering

- **[LÅST]** — besluttet og gældende.
- **[ÅBEN]** — skal diskuteres, før det bygges.
- **[UDSKUDT]** — bevidst taget ud af den nuværende version.

## 1. Nuværende kerneloop [LÅST]

```text
Training → Dungeon floor 1 → Automatisk kamp → Næste floor → Død
                                                            ↓
                                             Resultat: floor + XP
                                                            ↓
                                                        Training
```

- Der findes ingen separat Dungeon-lobby eller floor-vælger.
- Når spilleren går i Dungeon, starter et nyt run direkte i combat på floor 1.
- Kampen afvikles automatisk.
- Efter en sejr fortsætter runnet automatisk til næste floor.
- Spilleren fortsætter med sin resterende HP mellem floors. Der er ingen gratis healing.
- Runnet fortsætter, indtil spilleren dør.
- Der findes ikke loot, sæk, banking eller et stop/go-valg i den nuværende version.
- En besejret floor giver XP til runnets samlede XP-pulje.
- Run-XP overføres til Player Level, når spilleren dør.
- Efter døden vises et resultat med nået floor, optjent XP og eventuelle Player Levels og skill points.

## 2. Combat-skærm [LÅST]

- Monster-information vises øverst.
- Player-information vises nederst.
- Begge sider viser kun navn, nuværende/maksimal HP, HP-bar og ATK-range.
- Floor-nummeret vises øverst på skærmen.
- HP-tal og HP-bars opdateres under kampafspilningen.
- ATK vises som det faktiske minimum og maksimum, der bruges af den aktuelle kamp.
- Der vises ingen win chance, anbefalinger, power score, loot-information eller floor-preview.

## 3. Player Level og træning [LÅST]

- Player Level XP kommer kun fra Dungeon.
- Træning giver aldrig Player Level XP.
- Hvert Player Level efter level 1 giver ét skill point.
- Skill points kan frit og øjeblikkeligt flyttes mellem ATK og HP.
- Allokerede skill points bestemmer træningshastigheden for den valgte stat.
- ATK og HP har hver sin kontinuerlige progressbar.
- Når en stat-bar fyldes, stiger den pågældende stat direkte ét level.
- ATK- og HP-træning fortsætter under et aktivt Dungeon-run.
- Reallokering påvirker kun fremtidig træningshastighed. Opnåede levels og progress mistes aldrig.

## 4. Training-skærm [LÅST]

- Toppen viser Player Level og Deepest Floor.
- Unspent Skill Points vises i en separat boks.
- Stats hedder **ATK** og **HP**.
- Hver stat vises som en kompakt række med navn, level, progressbar og `− / +`.
- `+` er disabled og visuelt inaktiv, når spilleren ikke har unspent skill points.

## 5. Teknisk grundlag [LÅST]

- Stack: Next.js 16, React og TypeScript.
- Kampmotoren er ren TypeScript og seedbar.
- En kamp afgøres på forhånd som en deterministisk event-liste og afspilles derefter i UI'et.
- Save-formatet er versioneret og migrerer permanente Player-, ATK-, HP- og floor-data fra ældre saves.

## 6. Bevidst udsat [UDSKUDT]

- Loot og loot tables.
- Sæk og banking.
- Frivillig hjemkomst fra et run.
- Floor-vælger og Dungeon-lobby.
- Gear, crafting og materialer.
- Bossmilepæle, prestige og øvrige meta-systemer.

De udsatte systemer har ingen gældende designregler. De skal diskuteres på ny, før de eventuelt tilføjes.

## 7. Åbne spørgsmål [ÅBEN]

Ingen endnu. Nye retninger tilføjes her, når kerneloopet ovenfor er afprøvet.

## 8. Beslutningslog

| Dato            | Status | Beslutning                                                             |
| --------------- | ------ | ---------------------------------------------------------------------- |
| 29. august 2026 | [LÅST] | Den tidligere GDD blev nulstillet; kun dette dokument gælder fremover. |
| 29. august 2026 | [LÅST] | Dungeon starter direkte på floor 1 uden lobby eller floor-vælger.      |
| 29. august 2026 | [LÅST] | Runs fortsætter automatisk med resterende HP, indtil spilleren dør.    |
| 29. august 2026 | [LÅST] | Loot, sæk og banking er fjernet fra den nuværende version.             |
| 29. august 2026 | [LÅST] | Dungeon-XP opsamles under runnet og tildeles ved død.                  |
| 29. august 2026 | [LÅST] | Combat viser kun floor, navn, HP, HP-bar og ATK-range.                 |
