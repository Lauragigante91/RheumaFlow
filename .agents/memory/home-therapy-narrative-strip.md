---
name: Home-therapy narrative contamination
description: Why terapia_domiciliare (home therapy / TERAPIE IN CORSO) swallows clinical narrative and how the output field is cleaned without touching drug parsing.
---

# Home-therapy text swallows unheadered narrative

`segmentLetterSections` assigns each section all the text up to the NEXT recognized
header. When a referto has TERAPIA DOMICILIARE followed directly by free clinical
narrative (raccordo / anamnesi) with NO explicit "RACCORDO ANAMNESTICO" header, that
narrative is absorbed into `S.TERAPIA_DOMICILIARE`, contaminating the home-therapy
output ("TERAPIE IN CORSO ALLA DATA DELLA VISITA" / `home_therapies_text` /
`current_therapies_text`).

**Fix location matters.** Clean the OUTPUT field only (the `terapia_domiciliare`
assignment in `profilo_generale`). The drug-parsing `therapyScope` consumes the raw
`S.TERAPIA_DOMICILIARE` separately and must stay untouched — narrative there is
harmless to the drug extractor and may carry useful context.

**Why:** narrative frequently runs on with no period before the cue
("...3/4 cp Circa 1 mese fa comparsa..."), so a sentence-boundary split alone misses
it; cues must be searched anywhere in the text.

**How to apply (strong vs weak cues):**
- Strong cues (definitively narrative, never inside a drug list) cut anywhere:
  `circa N <unit> fa`, `N <unit> fa`, `compars*`, `esordi*`, `insorg*`,
  `riferisce/va/to/ta`, `lamenta*`, `accusa*`, `scarsa rispost*`,
  `ha assunt*/present*/sviluppat*/lamentat*/accusat*`, `in seguito`,
  `successivamente`, `in anamnesi`.
- Weak/ambiguous cues (`da <mese>`, `al controllo`, `a/alla visita`) only cut when
  BOTH: at a sentence/line boundary AND the ~60 chars after the cue contain no
  drug/dose. This prevents wrongly truncating legitimate
  "Medrol 4 mg. Da aprile Metotrexato 15 mg" (therapy-with-start-date) and
  "Medrol 16 mg fino al controllo" (tapering instruction).
- After choosing the earliest valid cut, keep the head ONLY if it is pharma
  (`_unitIsPharma`); otherwise return the original text (avoid nuking on a stray
  cue at position 0). Common cardiovascular drugs (perindopril, amlodipina) ARE in
  `DRUG_ALIAS_MAP`, so the pharma guard passes on real cardio-only home lists.
