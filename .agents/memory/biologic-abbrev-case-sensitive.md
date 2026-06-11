---
name: Biologic abbreviation aliases must be case-sensitive
description: UPPERCASE biologic short-codes (ETN/ADA/SEC...) need caseSensitive+\b or they collide with lowercase Italian words
---

## Regola

Le abbreviazioni biologiche reumatologiche (ETN, ADA, ADA-b, IFX, GOL, CZP, UPA, TOFA, BARI, SEC, IXE, GUS, RIS, ABA, RTX) in `drugs.js` devono essere marcate `caseSensitive: true` con confini di parola `\b`. I tre consumer derivano dal flag: `raccordoParser.findDrugsInText` usa testo originale + flag `g` quando `caseSensitive`, altrimenti testo normalizzato + `gi`; `therapyEventParser`/`therapyTextParser` lasciano cadere le forme minuscole delle chiavi solo-maiuscole.

**Why:** Codici di 3 lettere collidono con parole italiane comuni in minuscolo: "sec" (secondi), "ada"/"ris" come frammenti. Senza case-sensitivity, "atteso 30 sec" diventerebbe Secukinumab. Le abbreviazioni nelle lettere cliniche sono sempre in MAIUSCOLO.

**How to apply:** verifica in entrambe le direzioni con test di regressione — minuscolo NON deve risolvere, MAIUSCOLO deve risolvere (vedi PSO-T002-8 / PSO-T002-9 in parser_regression.js). Rischio residuo: sezioni di lettera interamente in maiuscolo possono ancora collidere; `\b` + chiavi exact-case mitiga ma non elimina.
