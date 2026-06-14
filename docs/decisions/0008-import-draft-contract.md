# ADR 0008 — Contratto draft di importazione (un documento per PDF)

## Stato
Adottato

## Contesto
L'import da testo/PDF deve essere revisionabile dal medico prima di scrivere sul DB, con un contratto stabile tra parser e UI di review e con piena tracciabilità.

## Decisione
`buildEditableDraft()` stampa `_id` e `_skip:false` su ogni item; `_applyOneDraft()` filtra `!_skip` e chiama le API. Ogni importazione tratta **un documento per PDF/lettera** (mai concatenati). In multi-PDF, `parseMulti()` fa fetch dello storico (via `allSettled`) e `reconcileDrafts()` annota `_status` (new/duplicate/continued/conflict/update) usando sempre `.listByPatient()` (mai `.list()`, che restituirebbe silenziosamente `[]` rompendo la continuità). Ogni entità importata porta `source_filename`.

## Conseguenze / Come si applica
- I parser devono restituire item compatibili con il contratto `_skip`/`_id`.
- Il reconciler usa esclusivamente `.listByPatient()`.
- La tracciabilità (`source_filename`, e per gli eventi `source_origin`/`source_section`) va sempre popolata.
