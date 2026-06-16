---
name: Terapia in uscita (exit regimen)
description: Authoritative rule for the TERAPIA IN USCITA report section — it equals the imported referto's therapeutic text, never a ledger-reconstructed regimen.
---

**TERAPIA IN USCITA (report section #13) EQUALS the therapeutic text in the imported referto, verbatim. It is NOT reconstructed from the therapy episode ledger.**
**Why:** definitive product decision that overrides the earlier task-23 spec (which said the section "resta un valore derivato, non un campo libero" rebuilt per-drug from the ledger) AND the prior code review that enforced it. The doctor's exit plan must read exactly as written in the letter/PDF — full prose, taperings, posology, monitoring — not a normalized one-line-per-drug list.
**How to apply:** do NOT reintroduce any ledger-first display priority, any per-drug "(invariata)/(nuovo)/(modificata)" annotation, or any home-regimen "(invariata)" fallback. Those are the OLD behavior and are now wrong.

**Source priority (literal, never invert):** explicit exit headers `S.TERAPIA_USCITA` → else `S.IN_TERAPIA` → else the pharmacological part of `S.INDICAZIONI`. Built as `terapiaUscitaText` in `visitTextParser.parseVisitText` and emitted into `vsScope` as the `TERAPIA IN USCITA` block consumed by `extractVisitSections`.
- `S.*` come from `segmentLetterSections` (letterSectionParser). Duplicate headers are last-wins, which is the intended outgoing value; keep the literal priority, do not try to be clever.
- Pregresse (past therapies in the raccordo/anamnesi) are excluded unless they literally appear inside IN TERAPIA / INDICAZIONI.

**`pharmaPartOfIndicazioni(text)`** keeps only the therapeutic lines of INDICAZIONI (the rest is the referral note = `visit_sections.indicazioni` → referral_note). A line is kept if it has a known drug (`DRUG_PATTERNS`), a dose (`_THERAPY_DOSE_RE`), or a therapy verb (`_THERAPY_VERB_RE`). It is a deterministic best-effort heuristic, not perfect.
- `_THERAPY_DOSE_RE` has a negative lookahead `(?!\s*\/\s*d?l)` so concentration units (`mg/L`, `g/dL`) used in lab-monitoring lines do NOT count as a dose; `mg/die` still matches (the lookahead needs `/…l`, not `/die`).
- Verb stems are Italian present-tense (`riduc\w*`, `mantien\w*` …); infinitives like `ridurre`/`mantenere` deliberately don't match → fewer false positives. Don't broaden without regression tests.

**`extractVisitSections` length gate:** other sections require `content.length >= 16`, but `terapia_uscita` uses `minLen = 1` — a terse but valid exit therapy (`IN TERAPIA: MTX 10 mg`, `TERAPIA IN USCITA: Humira`) must NOT be discarded by the noise gate, or display silently falls back to the ledger.

**Display helper `buildTerapiaUscita({ refertoText, ricostruito })`** (single source consumed by every record builder): returns `refertoText.trim()` if present (verbatim, no marker); else `"(ricostruito)\n" + ricostruito` if present; else `null`. The ledger snapshot is ONLY a fallback when there is no referto text, and it is always explicitly marked `(ricostruito)`. It NEVER fabricates `(invariata)`.
- Workup/follow-up records pass `{ refertoText: visit.exit_therapy_text, ricostruito: visit.exit_therapies_text }`.
- prima-visita and previous-clinimetric records set `terapia_uscita: null` (they don't carry imported referto exit text).

**Persistence (unchanged):** import maps `visit_sections.terapia_uscita` → `WorkupVisit.exit_therapy_text`. The full-replace visit PUT must load+resend `exit_therapy_text` or an edit erases the imported text. `exit_therapies_text` (the ledger snapshot) stays a persisted immutable per-visit field, populated post-upsert; it is now only the labelled `(ricostruito)` fallback, no longer the primary value.

**therapy_modification stays a SEPARATE section** ("MODIFICHE TERAPEUTICHE"), never folded into TERAPIA IN USCITA.
