---
name: Atlas bad-auth (code 8000) diagnosis
description: How to read a MongoDB Atlas "bad auth" failure and safely debug a MONGO_URL secret without exposing it.
---

Atlas `OperationFailure: bad auth : authentication failed` with `code 8000` (`codeName: AtlasError`) means SCRAM
authentication was **rejected** — i.e. the cluster *was* reached (SRV resolved, network/IP allowlist OK); only the
username/password is wrong. Authorization / db-access problems surface *after* auth, not as 8000, and network/allowlist
problems surface as server-selection timeouts, not 8000. So 8000 = credential value mismatch, full stop.

**Why:** During a password rotation incident, two pasted `MONGO_URL` secrets failed with 8000. A structure-only probe
showed both were byte-for-byte the same shape (same total_len / username_len / password_len) — the old pre-rotation
string was being re-pasted. The fix is always on the Atlas/credential side, never in app code.

**How to apply (safe debugging — never print the secret):**
- Parse the URI with regex/urllib and report ONLY structure: scheme/is_srv, username_len, password_len,
  `password_needs_encoding` (any reserved char in `:/?#[]@!$&'()*+,;= "%`), `password_already_percent_encoded`
  (`%[0-9A-Fa-f]{2}`), host suffix (`mongodb.net`), db path, query keys. Compare lengths across attempts to detect a
  re-pasted identical value. Never emit username/password/host values.
- Sanitize every error/log line: `s#mongodb(\+srv)?://[^\s]*#<redacted-uri>#`.
- If `password_needs_encoding` is true, the rotated password has reserved chars that must be percent-encoded in the URI.

**Replit Secrets + dotenv precedence:**
- `load_dotenv(path, override=False)` (the default) does NOT overwrite vars already in `os.environ`, so a Replit Secret
  (injected into the process env) WINS over the `.env` file. Only `override=True` lets `.env` win. To make Secrets the
  source of truth: set the Secret + keep `override=False`.
- Replit Secrets are injected into both the app process AND the agent's bash env, so a read-only pymongo probe in bash
  can verify connectivity via `os.environ["MONGO_URL"]` without the value ever being printed.
