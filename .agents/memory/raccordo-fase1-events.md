---
name: raccordo Fase 1 events (diagnosis + disease_status)
description: Design constraints for the additive diagnosis/disease_status timeline rules and the roadmap gotchas the next phases must respect.
---

The raccordo-evolution roadmap adds richer event types in phases. Fase 1 landed `diagnosis` (Rule 7) and `disease_status` (Rule 8) only; seasonal/approx dates, manifestation recurrence, and treatment_response are explicitly deferred to Fase 2/3.

Durable design rules (honor these in later phases):

- **Append-only after Rule 6.** New rules must not use `continue` and must not mutate `lastDrug`/`lastSentenceDrugs`/`lastExtractedDate`, so prior-event output stays bit-identical. Consequence: new rules are unreachable for sentences consumed by an earlier `continue` (bullet Rule 0, onset Rule 1, switch Rule 2c) — e.g. a bullet "2016: diagnosi di AR" emits no diagnosis event. This is intentional.
  **Why:** the 282→290-assert harness uses `find()`/`>=` counts; additive-only guarantees green without re-tuning existing asserts.

- **Diagnosis date must come from a TIGHT window around the keyword**, not the whole sentence (`sentence.slice(idx-30, idx+50)`). A compound sentence ("...diagnosi di artrite psoriasica ... sospensione a maggio 2019...") would otherwise borrow a far-away date and invent a certain date.
  **Why:** hard constraint "non inventare date certe"; a clean "Posta diagnosi di X." must yield date null / confidence low.
  **How to apply:** any keyword-anchored emission (treatment_response etc.) should window the date the same way.

- **disease_status (CONTROL_RE) must stay anchored** on `buon controllo | ben controllat[ao] | malattia (ben) controllat[ao]` — never bare "controllo", or "visita di controllo" / "ultima visita di controllo" false-positive (these appear in real letters, e.g. PELLICONI). Distinct from REMISSION_RE.

- **Dedup-key collision (known limitation).** Key is `event_type::drug_canonical::date_value`. Two UNDATED same-type events (two undated diagnoses, or treatment_response with null drug+date) collide on e.g. `diagnosis::::` and the 2nd is silently dropped. Not triggered by current fixtures. Fase 2/3 (multiple undated events) must refine the key (e.g. add `drug_name`/a detail discriminator) before relying on it.

- **No backend change needed:** `ClinicalEventBase.event_type` is a free string and `categoria` already includes "diagnosi"; Pydantic `extra="ignore"` drops any custom flag, so encode outcome/recurrence in `detail`/`reason`, never a new field.
