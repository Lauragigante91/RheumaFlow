---
name: DAPSA sync — score corretto nel referto
description: Bug dove DAPSA nel referto mostrava 2/Remissione invece del valore calcolato dal Form unificato AP (CompositeAssessmentDialog mode=psa).
---

**Regola:** Il `dapsa` useMemo in TodayVisitSection deve leggere prima il score salvato
da `assessments` (prop) per la data corrente, prima di ricalcolare dagli input inline.

**Why:** CompositeAssessmentDialog (mode="psa") salva l'assessment DAPSA nel DB con il
score corretto (tutti gli input completi). Ma i campi inline di TodayVisitSection
(spaPga, spaPeriph, spaPcr) non vengono popolati da quel salvataggio — il sync di
PatientDetail gestisce solo ASDAS/BASDAI (SPA_TYPES). Quindi l'useMemo ricalcola con
campi parziali e ottiene tjc+sjc+0+0+0.

**Approccio sbagliato tentato:** aggiungere "dapsa" a SPA_TYPES in PatientDetail →
causa regressione perché spaPga viene popolato dal pga DAPSA, attivando il calcolo
ASDAS con backPain=0/stiffness=0/crp=0 → ASDAS=0 → Inattiva falso positivo.
(DAPSA e ASDAS condividono i campi spaPga/spaPeriph/spaPcr.)

**Fix corretto (TodayVisitSection.jsx, dapsa useMemo):**
```js
const savedDapsa = [...(assessments || [])]
  .filter(a => a.index_type === "dapsa" && (a.date || "").slice(0, 10) === date && a.score != null)
  .sort((a, b) => (b.id || "").localeCompare(a.id || ""))[0];
if (savedDapsa) return savedDapsa.score;
// poi fallback inline...
```

**How to apply:** Lo stesso pattern (leggi il score salvato da assessments prima del
ricalcolo inline) va applicato ad altri index_type che possono essere salvati da
CompositeAssessmentDialog ma non sincronizzati al form inline (es. futuri nuovi indici).
Non toccare SPA_TYPES in PatientDetail per tipi che condividono campi con ASDAS.
