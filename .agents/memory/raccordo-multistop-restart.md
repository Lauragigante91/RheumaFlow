---
name: raccordoParser multi-stop + restart verbs
description: Rule 3 rewrite for multiple stops in one sentence; RESTART_VERB_RE for ripresa/ha ripreso/reintrodotto
---

## Regola

**Multi-stop (Rule 3):** usa `new RegExp(STOP_RE.source, "gi")` in un while-loop; per ogni occorrenza cerca il drug nella finestra [-80, 0] rispetto al match; `stopsEmitted` Set previene lo stesso canonical da stop doppi. La reason viene estratta dalla finestra [0, +80] dopo ogni stop keyword (non da `sentence` intera). Negation guard per-occorrenza.

**Restart verbs (Rule 2b-restart):** `RESTART_VERB_RE` separato da `START_VERB_RE`; `inferred_by:"restart_verb"` per distinguere de-novo da riesposizione. Pattern: `ripresa(?:\s+della)?\s+terapia\s+(?:\w+\s+)?con | ha\s+ripreso | ripreso\s+(?:terapia\s+)?con | reintrodott[oa] | reintroduzione\s+di`. Anche `hasExplicitStart` in Rule 0C aggiornato per includerlo.

**Why:** Frasi SpA con più farmaci sospesi nella stessa parentetica ("Infliximab sospeso per gravidanza, Adalimumab sospeso per evento avverso") producevano solo il primo stop. Le riprese post-washout (chirurgia, gravidanza) sono clinicamente distinte dagli avvii de-novo.

**How to apply:** RESTART_VERB_RE è globale; la finestra window per i drug è verbPos-30…verbPos+130 per catturare "ha ripreso regolare terapia infusiva con X". Evitare di aggiungere restart verbs a START_VERB_RE: l'inferred_by distinto è dati clinicamente utili.

## Risultati post-sprint (TC audit)

- Baseline Sprint 3A: TP=76 FP=0 FN=15 Macro-F1=0.895 Precision=1.000
- Post Sprint 3B (multi-stop + restart): TP=76 FP=0 FN=15 Macro-F1=0.895 — invariato sulle TC sintetiche
- SpA enteropatica: +2 restart_verb (Infliximab 2019-05, 2020-08) + stop Infliximab + stop Adalimumab ora separati

FP=0 mantenuto. I nuovi eventi non interferiscono con i TC esistenti.
