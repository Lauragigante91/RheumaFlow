# ADR 0005 — Therapy state point-in-time e snapshot home_therapies_text

## Stato
Adottato

## Contesto
Serve conoscere quali farmaci (con dose/frequenza/via) erano attivi a una data arbitraria, sia per la UI sia per gli snapshot di visita e gli export di coorte.

## Decisione
`GET /patients/{id}/therapies/state?date=` ricostruisce dose/freq/route attive a una data camminando sugli eventi embedded degli episodi. La stessa logica alimenta `home_therapies_text` (snapshot immutabile generato alla creazione della visita) e l'export coorte. Gli helper canonici vivono in `helpers.py` (`_episode_state_at` / `_therapy_state_at`) e sono l'unica sorgente di verità.

## Conseguenze / Come si applica
- Non duplicare la logica di ricostruzione: usare gli helper in `helpers.py`.
- `home_therapies_text` è uno snapshot immutabile alla creazione visita; il fallback al testo manuale vale solo se non vengono trovate terapie.
