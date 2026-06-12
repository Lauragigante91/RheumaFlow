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

## Fase 2 — seasonal dates + recurrent manifestation (Rule 9)

- **Seasonal date helper is SEPARATE from extractDate (Patch 1).** `extractSeasonalDate` maps primavera→04, estate→07, autunno→10, inverno→01 with `date_approximate=true`, and returns null when there is no 4-digit year. Any rule that wants seasons must call `extractSeasonalDate(x) || extractDate(x)` — seasonal FIRST.
  **Why:** if extractDate runs first on "primavera 2020", its bare-year last-resort returns 2020-01-01 (precision year) = a forbidden invented certain date. The "non inventare date certe" rule applies to seasons too: a season must resolve to an approx month, never a naked year, and a season without a year must stay date-null.

- **Rule 9 (manifestation_onset) requires BOTH a manifestation noun AND a recurrence qualifier** (`MANIF_NOUN_RE && RECURRENCE_RE`) before emitting, to avoid false positives — e.g. "artrite reumatoide" (noun, no recurrence) must not emit. `RECURRENCE_RE` uses `ripetut[ei]` (ripetute/ripetuti), deliberately NOT "ripetuta", so unrelated "misurazione ripetuta" never triggers.
  **How to apply:** keep the two-signal gate when broadening triggers; loosening to a single common noun reintroduces FPs across fixtures.

- Rule 1 (esordi/manifestazione) `continue`s, so Rule 1 and Rule 9 never both fire on one sentence; a recurrent-episode sentence with no esordi/drug falls through to Rule 9. The existing `manifestation_onset` type is reused (no new event type, no UI registration in scope).
