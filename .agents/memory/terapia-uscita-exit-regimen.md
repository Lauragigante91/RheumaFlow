---
name: Terapia in uscita (exit regimen)
description: Display priority for the TERAPIA IN USCITA report section, why the original report text is preserved verbatim, and the rules for the ledger-derived fallback.
---

TERAPIA IN USCITA (report section #13) has a strict display priority:
**original report text (persisted) > ledger-derived regimen > current regimen + "(invariata)".**

**Original report text wins and is verbatim.** When a visit was imported from a letter/PDF, the exit-therapy section of the original report (schema, taperings, warnings, lab monitoring, follow-up timing) is captured and persisted as its own field, and rendered as-is.
**Why:** the section must preserve the doctor's full prose plan, not a normalized one-line-per-drug list. The earlier bug reduced it to a drug list and lost the clinical nuance.
**How to apply:** the priority lives in the single display helper consumed by every record builder (first visit, workup/follow-up, timeline). The verbatim original is NEVER annotated "(invariata)"; only the regimen fallback is.

**Capture is header-scoped, not drug-parsed.** Exit-specific headers (TERAPIA IN USCITA / CONSIGLIATA / ALLA DIMISSIONE / PRESCRITTA / PROPOSTA / DOMICILIARE CONSIGLIATA, INDICAZIONI TERAPEUTICHE, PRESCRIZIONE TERAPEUTICA|FARMACOLOGICA) route to the exit section. Bare TERAPIA = home therapy; bare INDICAZIONI = referral note — both excluded. The exit section def must sit BEFORE home-therapy and indicazioni in the ordered section list, and exit-header variants must also be mirrored in the inline-header split so same-line headers are caught.
**Why:** ordering and the bare-vs-qualified distinction are the whole correctness story; a misorder silently misroutes the section.

**Persistence: the full-replace PUT will wipe it.** The workup-visit update replaces the whole document from the request body, so any editor form that saves a visit must load AND resend the exit-therapy field, or an edit erases the imported text.

**therapy_modification stays a SEPARATE section** ("MODIFICHE TERAPEUTICHE"), never folded into TERAPIA IN USCITA. The modifica is the doctor's manual note about what changed; the exit section is the full resulting plan.

**Ledger-derived fallback (only when no original text).** Reconstructed deterministically from the therapy episode ledger: one line per active drug, annotated (invariata)/(nuovo)/(modificata)/sospeso; never fabricates events.
- Entry regimen looked up at visit_date - 1, exit at visit_date; a drug stopped ON the visit date is excluded from exit and rendered "sospeso".
- Do NOT filter deleted_at in the exit fetch — the home-regimen path never does, and filtering would make the two diverge.
- Episodes are sorted by (start_date, end_date, id) before fill so stop+restart of the same drug resolves to the latest-start episode regardless of DB order.

**An episode's activity is NOT decided from start/end dates alone — status and founding event matter.**
**Why:** pregresse imported from anamnesi land as episodes with no end_date and founding event `historical_exposure` (or status `discontinued`), and a discontinuation can live as a dated event rather than as `end_date`. Reconstructing activity from dates only made these unbounded episodes look perpetually active, so the exit/home regimen rendered already-stopped drugs (Golimumab, Leflunomide) as "(invariata)".
**How to apply:** compute an *effective end* = end_date, else the date of the last `discontinued`/`paused` lifecycle event, cleared if a later `resumed_within` reopens it. Then: an episode with effective_end None is active ONLY if its last lifecycle event isn't a closure AND its status isn't `discontinued` AND its founding event isn't `historical_exposure`; otherwise treat it as not assertable → hide it. Regimen reconstruction must walk *non-voided* events sorted by (date, created_at), never the raw events list.

**The exit display must never fall back to the stored home-regimen snapshot.**
**Why:** `home_therapies_text` is an immutable snapshot computed at visit-create time; snapshots written before this fix can still contain pregresse. If the corrected ledger is empty (patient has only pregresse), falling back to that stale snapshot reintroduces the exact bug in TERAPIA IN USCITA.
**How to apply:** the exit chain is original prose > compute-on-read ledger only. When both are empty the section shows nothing — the regimen still appears in the separate "terapie in corso" field. NOTE: that "terapie in corso" field still reads the stored snapshot, so old visits can show stale pregresse there until re-imported or the snapshot is recomputed; not changed here to preserve the immutable-snapshot decision.
