# ADR 0003 — Multi-tenancy via organization_id

## Stato
Adottato

## Contesto
Ogni unità operativa (UO) deve vedere esclusivamente i propri pazienti; nessun dato deve essere visibile cross-organizzazione.

## Decisione
Ogni documento contiene `organization_id`. Ogni richiesta (tranne le rotte pubbliche a token) è autenticata via `get_current_user`, che estrae `organization_id` dal JWT. Ogni endpoint che tocca dati paziente passa da `verify_patient_in_org(patient_id, org_id)` (`helpers.py`): se il paziente non appartiene all'org → 403.

Ruoli: `admin` (primo utente che crea l'org con `PLATFORM_ACCESS_CODE`; gestisce impostazioni org) e `member` (si unisce con l'invite code; accesso clinico completo).

## Conseguenze / Come si applica
- Ogni nuovo endpoint paziente deve chiamare `verify_patient_in_org` prima di leggere/scrivere.
- Ogni nuova collezione con dati paziente deve includere e filtrare per `organization_id`.
