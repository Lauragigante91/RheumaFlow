---
name: DB config — Atlas (prod) vs local test_database
description: Where RheumaFlow's real data lives and why resets/recovery silently swap it for an empty demo DB, breaking login.
---

RheumaFlow's REAL data lives on a MongoDB **Atlas** cluster (DB name
`rheumaflow`): real users (including an admin-role account), dozens of patients,
hundreds of assessments/labs/therapies. The connection is configured ONLY in the
gitignored `backend/.env` (`MONGO_URL` + `DB_NAME`). There are NO Replit
Secrets/env vars set — `load_dotenv(backend/.env)` (override=False) supplies
everything.

**Trap (root cause of "Credenziali non valide" after recovery):** git resets and
backup-content recovery restore TRACKED files only, so `.env` is NOT restored.
If the on-disk `.env` has been switched to the local dev config
(`mongodb://localhost:27017`, `DB_NAME=test_database`), the app silently connects
to a near-empty LOCAL demo DB (a handful of `DEMO-*` patients across "Demo UO"
orgs + seeded admin only). Real users vanish; login fails at the `if not user`
branch in routers/auth.py — bcrypt/JWT are fine, the DB pointer is wrong.

**Diagnose:** read `DB_NAME` in `backend/.env`. `test_database` = demo,
`rheumaflow` = prod. Confirm by counting users/patients in the live DB.

**Fix:** repoint `backend/.env` `MONGO_URL`+`DB_NAME` to the Atlas cluster,
restart. CAUTION: server.py `startup_event` then runs against prod — it can
INSERT a default org (DEFAULT_ORG_NAME "UO Reumatologia") if absent, reset the
seeded default admin account password to the `.env` ADMIN_PASSWORD when it doesn't
verify, and `update_many` to stamp missing `organization_id`. The real admin
user's own record is untouched. Pointing DEV at Atlas means dev reads/writes LIVE
patient data.

**Security:** an Atlas DB user password sits committed in git history and is
extremely weak and exposed — rotate it; move all config into Replit Secrets
rather than a tracked-adjacent file.
