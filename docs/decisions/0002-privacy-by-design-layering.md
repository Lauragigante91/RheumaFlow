# ADR 0002 — Privacy by design (layering a 3 livelli)

## Stato
Adottato

## Contesto
Il sistema tratta PII e dati clinici reali di pazienti. La PII non deve uscire dal browser durante l'elaborazione e non deve mai raggiungere un LLM.

## Decisione
La protezione è stratificata su tre livelli:
1. **Client (sempre attivo)**: `stripDemographics()` rimuove l'anagrafica dal testo PDF prima di qualsiasi elaborazione; il parsing è interamente locale.
2. **Pre-LLM (solo se l'org abilita l'AI)**: `deidentify.py` applica ulteriori rimozioni PII (CF, email, telefono, date di nascita, intestazioni ospedaliere, firme) prima dell'invio a Claude/Gemini.
3. **Pseudonimizzazione paziente**: `POST /api/patients/:id/anonymize` e modalità org-wide `pseudonymized_mode`.

## Conseguenze / Come si applica
- Ogni nuovo flusso che tocca testo PDF deve passare da `stripDemographics()` prima dell'elaborazione.
- Ogni invio a un LLM deve passare da `deidentify.py`.
- I link di consulto esterni (`/c/:token`) sono read-only e pseudonimizzati.
