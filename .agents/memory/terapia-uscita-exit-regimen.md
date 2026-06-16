---
name: Terapia in uscita (exit regimen)
description: How TERAPIA IN USCITA is derived, why it is compute-on-read, and why therapy_modification stays a separate report section.
---

TERAPIA IN USCITA = full post-visit regimen, one line per drug, annotated `(invariata)` / `(nuovo)` / `(modificata)` / `<drug> sospeso`. Derived deterministically from the therapy episode ledger (`compute_exit_therapies_text`), never fabricates events.

**Compute-on-read, not stored.** `exit_therapies_text` is computed in `list_workup_visits` and exposed only on the WorkupVisit *response* model.
**Why:** during import the visit doc is created BEFORE the therapy upserts run, so it cannot be snapshotted at create time; and the regimen is always reconstructable from the ledger for any past date, so a stored snapshot adds drift risk for no benefit.

**therapy_modification stays a SEPARATE report section** ("MODIFICHE TERAPEUTICHE"), never folded into TERAPIA IN USCITA. The exit fallback when the ledger has no episodes is `regime in corso + "(invariata)"`, NEVER the modifica text.
**Why:** task-23 contract — the original bug was that the section showed ONLY the manual modifica text, losing the full regimen snapshot. Keep the derived regimen and the manual note as distinct fields/sections.

**Boundary gates vs inclusive end_date.** `_episode_state_at` treats `end_date == target_date` as still active. Exit membership therefore uses separate gates: `_episode_active_before` (end >= visit excludes a stop-at-visit from the entry regimen path... actually keeps it in entry) and `_episode_active_after` (end > visit; so a drug stopped ON the visit date is excluded from exit → rendered `sospeso`). Entry values looked up at `visit_date - 1`, exit values at `visit_date`.

**Do NOT filter `deleted_at` in the exit fetch.** `db.therapies` is never filtered by `deleted_at` anywhere (incl. `generate_home_therapies_text`); adding a filter would make exit diverge from `home_therapies_text`.

**Same-canonical multi-episode determinism.** Episodes are sorted by `(start_date, end_date, id)` before the entry/exit dict-fill, so on stop+restart of the same drug the latest-start episode wins deterministically regardless of DB order.
