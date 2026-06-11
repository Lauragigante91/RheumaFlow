---
name: raccordoParser ABBREV_DOT_RE flag-i bug
description: ABBREV_DOT_RE aveva flag 'i' che rendeva il lookahead [a-z\d(] case-insensitive, vanificando la guardia su "mg. Nel"/"bid. Nel". Fix: rimuovere 'i'.
---

## Regola

ABBREV_DOT_RE deve avere SOLO il flag `g`, mai `gi`. Con il flag `i`, il character class `[a-z\d(]` nel lookahead matcha anche maiuscole, rendendo inutile la guardia sulle sentence boundary.

**Why:** "200 mg. Nel 2012" — lookahead `(?=\s+[a-z\d(])` con flag `i` matchava "N" maiuscolo → "mg." veniva protetto → le due frasi non venivano splittate → FP (drug sbagliato nella sospensione).

**How to apply:** Ogni volta che si modifica ABBREV_DOT_RE, verificare che il flag sia `g` e non `gi`. Le abbreviazioni nel pattern sono già tutte minuscole; il flag `i` non serve.
