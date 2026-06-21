---
name: IN_TERAPIA false section capture on "in terapia con"
description: Il regex IN_TERAPIA con flag /i cattura "In terapia con X" nel corpo raccordo come sezione, svuotando S.RACCORDO e iniettando il farmaco come attivo in _domScope.
---

## Regola

`IN_TERAPIA` regex in `letterSectionParser.js` deve usare un negative lookahead `(?!\s+con\b)` per escludere la frase narrativa italiana "in terapia con X".

**Regex corretta:** `/^IN\s+TERAPIA(?!\s+con\b)\b/i`

**Why:** Il normalizzatore (`normalizeImportedText`) tratta "In terapia con X" come block-start perché `SECTION_HEADER_NORM_RE` include `IN\s+TERAPIA`. La riga viene quindi separata e il section parser la riconosce come header `IN_TERAPIA`, assegnando il testo raccordo a `S.IN_TERAPIA` invece di `S.RACCORDO`. Questo porta `_domScope` a includere il farmaco raccordo come attivo, con `status: "active"` errato in `extracted.therapies`.

**How to apply:** Qualsiasi modifica al regex `IN_TERAPIA` in `letterSectionParser.js` deve mantenere il negative lookahead `(?!\s+con\b)`. Aggiungere altri connettivi italiani (`dal`, `per`, `da`) se compaiono nuovi falsi positivi.
