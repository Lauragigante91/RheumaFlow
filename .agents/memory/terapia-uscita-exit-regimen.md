---
name: Terapia in uscita (exit regimen)
description: Authoritative rule for the TERAPIA IN USCITA report section — it equals the imported referto's therapeutic text, never a ledger-reconstructed regimen.
---

**TERAPIA IN USCITA (report section #13) EQUALS the therapeutic text in the imported referto, verbatim. It is NOT reconstructed from the therapy episode ledger.**
**Why:** definitive product decision that overrides an earlier spec which had made the section a derived value rebuilt per-drug from the ledger (and a code review that enforced that earlier spec). The doctor's exit plan must read exactly as written in the letter/PDF — full prose, taperings, posology, monitoring — not a normalized one-line-per-drug list. An automated code review may still flag this as "inverted" because it compares against the older registered objective; the verbatim-referto rule is the current, authoritative one.
**How to apply:** do NOT reintroduce any ledger-first display priority, any per-drug "(invariata)/(nuovo)/(modificata)" annotation, or any home-regimen "(invariata)" fallback. Those are the OLD behavior and are now wrong.

**Source priority (literal, never invert):** explicit exit headers `S.TERAPIA_USCITA` → else `S.IN_TERAPIA` → else the pharmacological part of `S.INDICAZIONI`. Built as `terapiaUscitaText` in `visitTextParser.parseVisitText` and emitted into `vsScope` as the `TERAPIA IN USCITA` block consumed by `extractVisitSections`.
- `S.*` come from `segmentLetterSections` (letterSectionParser). Duplicate headers are last-wins, which is the intended outgoing value; keep the literal priority, do not try to be clever.
- Pregresse (past therapies in the raccordo/anamnesi) are excluded unless they literally appear inside IN TERAPIA / INDICAZIONI.

**`pharmaPartOfIndicazioni(text)` uses PREFIX-TRUNCATION, not per-line drug filtering.** It keeps the INDICAZIONI text VERBATIM from the start and cuts at the first non-pharmacological "unit" boundary (`_PHARMA_STOP_RE`: accertamenti / esami / si prescrivono / controllo / rivalutazione / prossimo / visita / appuntamento / saluti / restando a disposizione …). A "unit" starts at text start, after a newline, or after `". "`/`"; "` before a capital. The drug block is contiguous and comes first in real referti, so this keeps the whole pharma plan (including in-line monitoring like "Monitoraggio mensile degli esami" that belongs to a drug instruction) and drops the trailing exams/visits/closing.
**Why:** the earlier per-line filter (keep only lines with a drug/dose/verb) both DROPPED legitimate continuation text (a monitoring sentence with no drug/dose) and CONTAMINATED the output (kept stray non-pharma fragments / fell back to the ledger), producing an artificial exit therapy. The doctor wants the referto's therapeutic prose verbatim, just cut before the non-therapy tail.
**How to apply:** truncation applies ONLY to the INDICAZIONI fallback. `S.TERAPIA_USCITA` and `S.IN_TERAPIA` (explicit exit/therapy headers) are taken verbatim with NO truncation (a "Controllo emocromo…" line inside IN TERAPIA stays). `_PHARMA_STOP_RE` is matched only against a unit's LEAD (after stripping bullet chars), so mid-sentence words like "…degli esami" or "fino a controllo…" never trigger a cut. After truncation, a guard requires the kept block to contain a drug/dose/verb, else returns null → ledger `(ricostruito)` fallback. `_THERAPY_DOSE_RE` keeps the `(?!\s*\/\s*d?l)` guard so `mg/L`/`g/dL` aren't doses (`mg/die` still is).

**`extractVisitSections` length gate:** other sections require `content.length >= 16`, but `terapia_uscita` uses `minLen = 1` — a terse but valid exit therapy (`IN TERAPIA: MTX 10 mg`, `TERAPIA IN USCITA: Humira`) must NOT be discarded by the noise gate, or display silently falls back to the ledger.

**Display helper `buildTerapiaUscita({ refertoText, ricostruito })`** (single source consumed by every record builder): returns `refertoText.trim()` if present (verbatim, no marker); else `"(ricostruito)\n" + ricostruito` if present; else `null`. The ledger snapshot is ONLY a fallback when there is no referto text, and it is always explicitly marked `(ricostruito)`. It NEVER fabricates `(invariata)`.
- Workup/follow-up records pass `{ refertoText: visit.exit_therapy_text, ricostruito: visit.exit_therapies_text }`.
- prima-visita and previous-clinimetric records set `terapia_uscita: null` (they don't carry imported referto exit text).

**Persistence (unchanged):** import maps `visit_sections.terapia_uscita` → `WorkupVisit.exit_therapy_text`. The full-replace visit PUT must load+resend `exit_therapy_text` or an edit erases the imported text. `exit_therapies_text` (the ledger snapshot) stays a persisted immutable per-visit field, populated post-upsert; it is now only the labelled `(ricostruito)` fallback, no longer the primary value.

**therapy_modification stays a SEPARATE section** ("MODIFICHE TERAPEUTICHE"), never folded into TERAPIA IN USCITA.
