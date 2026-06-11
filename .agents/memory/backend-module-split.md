---
name: Backend module split
description: server.py refactored into domain-specific modules; import patterns and constraints.
---

## Architecture

```
backend/
  database.py          # AsyncIOMotorClient + db object (5 lines)
  auth_utils.py        # JWT/bcrypt helpers + get_current_user + set_auth_cookies (77 lines)
  models.py            # All 38 Pydantic models + PRO_INSTRUMENTS_ALLOWED constant (392 lines)
  deidentify.py        # GDPR PII-removal engine; exports deidentify_text() (100 lines)
  routers/
    __init__.py
    export.py          # /export/* routes (json, csv-zip, cohort-xlsx, diagnoses, drugs) (510 lines)
    ai_parsing.py      # /ai/parse-visit + /ai/parse-lab routes (652 lines)
  server.py            # app + api_router + remaining 72 routes (1793 lines)
```

## Import rules

- **Uvicorn runs from `backend/`** — all imports are absolute (no dot-prefix), e.g. `from database import db`.
- `database.py` exports: `db`, `_client` (alias as `client` in server.py for shutdown).
- `auth_utils.py` exports: `JWT_ALGORITHM`, `get_jwt_secret`, `hash_password`, `verify_password`, `create_access_token`, `create_refresh_token`, `get_current_user`, `set_auth_cookies`.
- `deidentify.py` exports: `deidentify_text()` (was `_deidentify_text` in server.py — imported with alias in server.py and routers).
- `models.py` uses `from models import *` in server.py; inline models that remain in server.py (VisitTemplateBase, WorkupVisitBase, RecallFlagPayload, DiseaseProfileBase) coexist — Python uses the later definition.
- Routers are included with `prefix="/api"` to match the existing `api_router` prefix.

## Why

server.py was 3,500 lines (76 routes, 38 models). Too large for safe maintenance. Split preserves all existing API contracts — no route paths changed.

## How to apply

When adding new domain routes, create or extend the appropriate router file rather than adding to server.py. For new shared utilities, add to the relevant shared module.
