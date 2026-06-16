---
name: Terapia in uscita derivation
description: How "TERAPIA IN USCITA" (visit record section 13) is populated and why it is NOT therapy_modification
---

"TERAPIA IN USCITA" (VisitFullRecordModal section 13, record key `terapia_uscita`)
is derived display-only via `buildTerapiaUscita({regimen, modifica})` in
`frontend/src/lib/terapiaUscita.js`, wired in the 3 record builders of
`VisitHistoryCards.jsx`.

Rule: if `modifica` (therapy_modification) present -> show it as-is; else if a
per-visit regimen is present -> show it marked literally `(invariata)`; else null.
Regimen source per builder: prima visita = patient.terapia_domiciliare;
workup/follow-up = visit.home_therapies_text (immutable snapshot);
valutazioni = formatted therapies list.

**Why:** `therapy_modification` is the manual "modifiche terapeutiche"
(start/stop/switch/up/down) field and must stay OUT of the import payload
(enforced by MAP-07). So imported visits have it empty and previously showed an
empty exit therapy. The exit therapy when unchanged equals the persisted regimen
snapshot, shown with `(invariata)`. Two concepts stay distinct: terapia in uscita
(full final regimen) vs modifiche terapeutiche (explicit changes only).

**How to apply:** Do NOT "fix" empty exit therapy by importing
therapy_modification (breaks MAP-07) and do NOT drop the `(invariata)` fallback.
Open question (not implemented): for visits WITH explicit modifications, section 13
shows the modification text, not a reconstructed full post-change regimen.
