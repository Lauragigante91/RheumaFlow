# ADR 0004 — Modello a episodi per le terapie

## Stato
Adottato

## Contesto
Le terapie hanno una storia (avvio, variazioni di dose, sospensioni, riprese) che deve essere ricostruibile a qualsiasi data, non solo nello stato corrente.

## Decisione
Nella collezione `db.therapies` un documento = un episodio. La sospensione (`discontinued`) chiude sempre l'episodio; un riavvio crea un nuovo documento. Gli eventi sono embedded in `events[]` (tipi: `started`, `dose_increased/decreased`, `discontinued`, `noted`, `historical_exposure`, `regimen_changed`). `POST /therapies/upsert` gestisce continuità, dose-change e switch.

## Conseguenze / Come si applica
- Tutte le scritture longitudinali passano dal projection helper / dall'endpoint `upsert`; mai update in place che falsifica il ledger eventi.
- La ricostruzione point-in-time dello stato è descritta in `0005-therapy-state-point-in-time.md`.
- Eventi `historical_exposure` non toccano mai lo stato attivo.
