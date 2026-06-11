---
name: Militello permanent regression test
description: Intentional red TDD test for the Militello visit letter; encodes target parser behavior, not current behavior.
---

The Militello case has a permanent Jest regression test (`frontend/src/__tests__/militelloCase.test.js`) that asserts the *correct* expected parse of `_MILITELLO_LETTER`. It is intentionally RED until the parser is fixed.

**Why:** the user wanted a failing-first regression test captured before any parser change ("Non modificare ancora il parser. Il test deve fallire col parser attuale"). Do NOT "fix" the test to match current parser output — that defeats its purpose.

**How to apply:**
- Two assertions already pass (proctite ulcerosa comorbidity; clinimetria DAS28-PCR 3.1 / CDAI 15 / SDAI 15.06 / DAPSA 16) — these guard against regression.
- Three assertions are intentionally failing gaps the parser must eventually satisfy:
  1. `patient.diagnosi` must come from CONCLUSIONI ("artrite enteropatica"), not from MOTIVO DELLA VISITA.
  2. therapy start_date must be extracted from "(da gennaio 2026)" / "Avviata terapia con MTX da gennaio 2026" — parser currently hardcodes `start_date: null`.
  3. NEW contract `extracted.therapy_decision` = `{ action: /switch|upgrade|escalat/, target_class: /anti-?tnf/ }` for "upgrade terapeutico ad antiTNF" in CONCLUSIONI. Class only, no specific drug (user chose: do not name CTZ/certolizumab in the letter).
- The letter text is duplicated in the test (the parser's `_MILITELLO_LETTER` is not exported, and the parser file must stay untouched).
