---
name: Section header gaps — EFFETTUATI + TERAPIE plural
description: Real-world Italian letters use ACCERTAMENTI EFFETTUATI and TERAPIE IN ATTO (plural) — both were missing from letterSectionParser.js regex definitions.
---

# Section header gaps found in TS01 import

## ESAMI_PREGRESSI — missing EFFETTUATI variants

`letterSectionParser.js` ESAMI_PREGRESSI regex only had PRECEDENTI and PREGRESSI after ACCERTAMENTI.
Real letters (AUSL Bologna) use "ACCERTAMENTI EFFETTUATI".

**Fix:** Add `EFFETTUATI|ESEGUITI|ESITATI|REFERTATI` to the alternation.

**Impact when missing:** Entire ACCERTAMENTI section absorbed into S.RACCORDO as free text → lab exams AND instrumental findings (RX, RM) never parsed.

**SECTION_HEADER_NORM_RE** (visitTextParser.js) must mirror the same variants so normalizeImportedText doesn't join those lines.

## TERAPIA_DOMICILIARE — singular/plural

Change `TERAPIA` → `TERAPI[AE]` in the leading position so "TERAPIE IN ATTO" / "TERAPIE IN CORSO" fully consume the header (not just "TERAPIE" with "IN ATTO:" left in body).

## How to apply
When a new letter type fails to capture a section, first check `SECTION_DEFS` in letterSectionParser.js. Add the missing header variant to the appropriate key's regex. Always mirror in SECTION_HEADER_NORM_RE if the header may appear with inline content on the same line.
