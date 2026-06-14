# ADR 0001 — Parsing deterministico locale prima dell'AI

## Stato
Adottato

## Contesto
RheumaFlow estrae dati strutturati da testi di visita e referti italiani. I dati sono clinici e reali; servono riproducibilità, assenza di dipendenze cloud obbligatorie e controllo della privacy.

## Decisione
Tutto ciò che è estraibile via regex/logica deterministica viene estratto lato client (Clinical Engine in `frontend/src/lib/`). L'AI (Claude via LiteLLM/httpx, Gemini come fallback multimodale) è solo un fallback opzionale, abilitabile per singola organizzazione e attivo unicamente se sono presenti le chiavi. Non esiste un router `ai.py` dedicato: il parsing AI è sempre gated dietro la de-identificazione (`deidentify.py` lato server, `stripDemographics()` lato client).

## Conseguenze / Come si applica
- Ogni nuova capacità di estrazione va implementata prima come parser deterministico in `lib/`.
- L'AI non deve mai diventare il percorso primario né ricevere testo non de-identificato.
- Il razionale privacy del gating è dettagliato in `0002-privacy-by-design-layering.md`.
