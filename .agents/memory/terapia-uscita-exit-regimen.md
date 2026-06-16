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

**Ledger-derived fallback (only when no original text and no manual regimen).** Reconstructed deterministically from the therapy episode ledger: one line per active drug, annotated (invariata)/(nuovo)/(modificata)/sospeso; never fabricates events.
- Entry regimen looked up at visit_date - 1, exit at visit_date; a drug stopped ON the visit date is excluded from exit and rendered "sospeso".
- Do NOT filter deleted_at in the exit fetch — the home-regimen path never does, and filtering would make the two diverge.
- Episodes are sorted by (start_date, end_date, id) before fill so stop+restart of the same drug resolves to the latest-start episode regardless of DB order.
