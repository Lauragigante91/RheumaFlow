---
name: Debug parse-trace privacy gating
description: The /api/debug/parse-trace endpoint must stay dev-only and metadata-only
---

The visit parser builds a `_PARSE_TRACE` array (visitTextParser.js `_trace`)
that can be POSTed to `/api/debug/parse-trace` for server-side debugging.

Privacy constraints (clinical app; manual-paste text can contain patient
name/CF):
- The trace must carry **metadata only**: positions, counts, regex.source,
  _dateSource, year integers, si/no booleans. Never verbatim source text
  (slice / match[0] / context / snippet) nor extracted clinical values
  (dose/frequency/date literals).
- The POST is gated client-side with `process.env.NODE_ENV !== "production"`.
- The backend endpoint is disabled in production via the
  `frontend/build/index.html` presence check (same SPA-fallback signal used by
  _FRONTEND_BUILD) and is auth-protected.

**Why:** defense in depth so no clinical text reaches workflow logs in prod.

**How to apply:** if you add new _D/_T trace lines, log only non-clinical
metadata. drugName (a canonical DRUG_ALIAS_MAP key) is acceptable as a debug
label; do not add patient-derived strings.
