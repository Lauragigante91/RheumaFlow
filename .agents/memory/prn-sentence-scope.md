---
name: PRN frequency sentence-scoping
description: How PRN ("al bisogno") detection must be bounded in the visit parser to avoid contamination, and why a bare period is not a sentence boundary in IT clinical text.
---

PRN frequency detection in the visit parser must be bounded to the CURRENT instruction/sentence, not the full drug context window. The context window is cut only at the next RECOGNIZED drug; a downstream PRN marker that belongs to a different instruction — or to a drug NOT in DRUG_ALIAS_MAP (e.g. "Toradol al bisogno") — otherwise bleeds onto the preceding drug and wrongly tags it PRN.

**Boundary rule:** a bare `.` is NOT a sentence boundary in Italian clinical text, which is full of dotted abbreviations (`p.o.`, `s.c.`, `i.m.`, `e.v.`, `a.b.`, `al bis.`). A reliable boundary is: `;` OR newline OR `.` + whitespace + UPPERCASE letter (a real new clause/drug name like "Toradol"). Cutting on every period both fails to fix the abbreviation spillover AND breaks legitimate PRN after a dotted route ("p.o. al bisogno" → loses the PRN).

**Consistency rule:** ALL PRN scopes must share the same boundary helper — the literal/word path (FREQ_PRN_RE in extractDoseAndFrequency), the phrase path (PRN_AFTER_RE), and the abbreviation paths (PRN_ABBREV_RE, PRN_AB_BARE_RE). If even one path stays unbounded, it reintroduces the false positive. The abbreviation scope should be `boundedScope(doseScope).slice(match[0].length)` so it respects both the next-drug cut and the sentence cut.

**Why:** regression originally introduced when PRN detection was widened during the therapy-dose work; the project invariant is FP=0 ("nessuna data/diagnosi inventata"), so a contaminated frequency is a hard failure.

**How to apply:** when adding or widening any PRN/"al bisogno" detector, route it through the shared sentence-scope helper; never test a PRN regex against the raw 200-char context or a newline-only slice. Assert FP in tests as "frequency is not ANY PRN marker" (covers literal leaks like "prn"/"se necessario"), not just `!== "al bisogno"`.
