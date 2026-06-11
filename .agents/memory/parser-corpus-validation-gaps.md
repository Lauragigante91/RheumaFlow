---
name: Parser corpus validation — harness + known gaps
description: Reusable before/after parser-diff harness technique and the clinical-correctness gaps surfaced by validating parseVisitText on a 10-letter real anonymized corpus.
---

## Before/after parser-diff harness (reusable: "did patch X regress the parser?")
- `cp -r frontend/src/lib /tmp/lib_before`, then `git show HEAD~1:frontend/src/lib/<file>` to overwrite ONLY the changed file(s); verify md5 of the *unchanged* files matches between current and copy.
- `esbuild --bundle --platform=node --format=cjs` two identical entry files importing `parseVisitText` from the current lib vs `/tmp/lib_before`; run both on a shared `/tmp/corpus`; diff the JSON.
- The parser subgraph bundles cleanly for node (no browser globals); the regression suite already relies on this.
- **Wording:** report "empirically identical on the corpus", NOT "identical by construction" — `visitTextParser` imports from the patched lab module, so a byte-identical caller can still change output if the callee changes.
- **Limitation:** comparing `lab_review_items` by COUNT misses same-count content changes; for lab-path patches also diff `lab_exams` content.

**Why:** lets a future agent prove (or disprove) regression quickly and state the conclusion precisely.

## Known parser gaps (as of this validation; deterministic parser — may be fixed later, re-verify before relying)
- **Età from onset context:** "esordito all'età di N anni" is NOT rejected -> eta=N wrongly. Range "20-25 anni" IS rejected.
- **PRN "ab":** the abbreviation "ab" (= al bisogno) is NOT flagged `_prn`; spelled-out "al bisogno"/"in caso di dolore" work.
- **Narrative-only letter (no "TERAPIA IN ATTO" header):** active therapies come back empty AND the raccordo timeline is empty; a drug stopped earlier then resumed ("ripresa ... prosegue") stays wrongly discontinued.
- **Single-line format sensitivity:** the same content on one unsegmented line loses "(inefficace)" discontinuation and yields 0 raccordo events vs the full-text version.
- **Dose-bleed:** dose can bleed from an adjacent drug on the same line (MTX <- Colecalciferolo "10.000 UI"; Etoricoxib <- Plaquenil "200 mg").

**Why:** emergent behaviors on real anonymized letters, not visible from reading the regex code; avoids re-discovery and helps scope future parser work.
