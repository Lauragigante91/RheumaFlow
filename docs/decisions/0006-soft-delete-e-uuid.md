# ADR 0006 — Soft delete e UUID come ID applicativo

## Stato
Adottato

## Contesto
I dati clinici non devono essere persi e devono restare tracciabili; gli ID applicativi devono essere indipendenti dall'`_id` interno di MongoDB.

## Decisione
La chiave applicativa è `id` (UUID stringa); l'`_id` di Mongo non viene mai esposto (escluso con `{"_id": 0}`). Tutti i `DELETE` sono soft (`deleted_at`); le liste filtrano `deleted_at: None`.

## Conseguenze / Come si applica
- Ogni nuovo modello usa `id` UUID come chiave applicativa.
- Le cancellazioni impostano `deleted_at`; nessuna rimozione fisica dei dati clinici.
- Ogni query di lista deve filtrare `deleted_at: None`.
