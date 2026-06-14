# ADR 0009 — Unità lab: PCR mg/dL e nessuna conversione implicita

## Stato
Adottato

## Contesto
I valori di laboratorio arrivano da referti eterogenei con unità diverse; una conversione errata o una chiave non canonica può falsare la lettura clinica.

## Decisione
La chiave canonica lab è sempre `param_key` (fallback `toCanonicalLabKey()`); `name` è solo etichetta di display. La PCR ha default mg/dL (non mg/L) e non si applica nessuna conversione implicita di unità. Sulle chiavi ad alto rischio, quando l'unità è inferita, l'item viene marcato per review manuale (`lab_review_items`).

## Conseguenze / Come si applica
- L'estrazione lab usa `r.param_key || toCanonicalLabKey(r.name)`.
- Nessun parser deve convertire unità in automatico; in caso di ambiguità, generare un item di review invece di indovinare.
