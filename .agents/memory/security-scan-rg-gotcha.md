---
name: Security/PHI scan gotchas in this repo
description: How to run PHI/secret greps safely so a scan never reports "clean" when it actually errored
---

When auditing for PHI/PII/secrets (e.g. under `poc/`, `attached_assets/`, tracked files), avoid two traps that produce a false "clean" verdict:

1. **ripgrep `-E` is `--encoding`, NOT extended-regex.** ripgrep uses regex by default. Passing `-E '<pattern>'` consumes the pattern as an encoding name and the command errors with "unknown encoding". Just use `rg '<pattern>'` (add `-i` for case-insensitive, `-l` for filenames).

2. **Never wrap a scan in `2>/dev/null || echo "(none)"`.** If the command errors (e.g. the `-E` mistake), stderr is hidden and `||` fires the "(none)" branch — so an *errored* scan looks like a *passed* scan. For audits, let stderr show and check exit codes explicitly (rg exit 1 = genuine no-match; other = error).

**Why:** during a `poc/` PHI audit both traps fired together and the first pass falsely reported no fiscal codes / surnames / secrets. Re-running correctly confirmed `poc/` is all synthetic, but the masked errors nearly produced a wrong "safe" sign-off on a privacy-critical task.

**How to apply:** for any privacy/security scan, run scans without `-E`, without `2>/dev/null`, and treat any non-(no-match) exit as "must investigate", not "clean".
