---
name: DAPSA sync — score corretto nel referto
description: Bug dove DAPSA nel referto mostrava 2/Remissione invece del valore calcolato dal Form unificato AP (CompositeAssessmentDialog mode=psa).
---

**Causa radice:** TodayVisitSection.save() crea un assessment DAPSA inline (inputs.tjc/sjc,
score=2 da campi parziali) DOPO quello salvato da CompositeAssessmentDialog (inputs.tjc68/sjc66,
score completo). Il sort per ID decrescente prendeva il più recente → score=2.

**Distinzione stabile tra i due tipi di assessment DAPSA:**
- CompositeAssessmentDialog: `inputs.tjc68` e `inputs.sjc66` (field names con suffisso 68/66)
- TodayVisitSection inline: `inputs.tjc` e `inputs.sjc` (senza suffisso)
Nessuna collisione possibile.

**Fix 1 — dapsa useMemo (TodayVisitSection.jsx):** sort a due livelli:
1. Preferisce assessment con `inputs.tjc68 != null` (CompositeAssessmentDialog)
2. Poi ID decrescente come tiebreaker

**Fix 2 — TodayVisitSection.save():** non crea un nuovo DAPSA inline se esiste già
per oggi un assessment con `inputs.tjc68 != null`. Evita duplicati che sovrascrivono
il valore corretto ad ogni salvataggio della visita.

**Primo approccio sbagliato:** aggiungere "dapsa" a SPA_TYPES in PatientDetail → spaPga
viene popolato dal pga DAPSA (null→0) → ASDAS calcolato con tutti-zero → ASDAS=0 →
Inattiva (falso positivo). DAPSA e ASDAS condividono spaPga/spaPeriph/spaPcr.

**Secondo approccio incompleto:** leggere solo il savedDapsa per ID decrescente → il
save() successivo creava un secondo assessment con score=2 che diventava il più recente.

**How to apply:** lo stesso pattern (priorità per field name in inputs, guard anti-duplicato
nel save) va applicato ad altri indici salvabili sia da CompositeAssessmentDialog che da
salvataggio inline, se mai ne vengono aggiunti.

**Nota sui residui nel DB:** se il paziente ha già assessment DAPSA con score=2 (creati
da save() con state parziale), quelli rimangono nel DB ma vengono ignorati dal sort (la
priorità va a inputs.tjc68). Un reload della pagina ripulisce la stale React state da
eventuali fix precedenti (spaBack/spaPga="0").
