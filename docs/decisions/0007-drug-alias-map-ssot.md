# ADR 0007 — DRUG_ALIAS_MAP unica sorgente di verità per i farmaci

## Stato
Adottato

## Contesto
Più parser (visita, raccordo, terapie quick, storiche, concomitanti) devono riconoscere gli stessi farmaci e alias in modo coerente, senza drift né collisioni con parole italiane comuni.

## Decisione
`drugs.js` esporta `DRUG_ALIAS_MAP`: è l'unico posto dove aggiungere farmaci e alias. Tutti i parser ne derivano. Gli alias usano word boundary `\b`; le abbreviazioni biologiche (es. ETN, ADA, IFX) sono case-sensitive per evitare collisioni con parole italiane minuscole (sec/ada/ris).

## Conseguenze / Come si applica
- Aggiungere un farmaco o un alias **solo** in `drugs.js`; mai duplicare liste in singoli parser.
- Ogni nuovo alias deve avere `\b` e, se ambiguo, vincolo di case.
