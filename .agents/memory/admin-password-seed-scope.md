---
name: ADMIN_PASSWORD seed scope
description: ADMIN_PASSWORD env governs ONLY the seeded admin@clinimetria.it account; real user logins are independent bcrypt hashes in Mongo.
---

- The FastAPI startup handler (`server.py` `startup_event`, "Seed admin user") reads `ADMIN_EMAIL` (default `admin@clinimetria.it`) + `ADMIN_PASSWORD` and, every boot, realigns that ONE user's bcrypt hash to the current `ADMIN_PASSWORD` if it doesn't already verify.
- All other accounts (clinicians, incl. the owner's personal logins like `laura.gigante.91@gmail.com` / `laura@rheumaflow.it`, plus demo/test accounts) store their own bcrypt password hash only in MongoDB (`db.users.password_hash`).

**Why:** Rotating the `ADMIN_PASSWORD` secret changes ONLY `admin@clinimetria.it`. The owner normally logs in with a personal account, so after rotation the "old password" still works for that account — this is expected, NOT a failed rotation. Those personal passwords were never in `.env`/git, so they were never leaked and need no rotation. (Verification trick: with the app's resolved env, `bcrypt.checkpw(ADMIN_PASSWORD, stored_hash)` True for admin@clinimetria.it proves the seed rotation took.)

**How to apply:** When asked to "rotate the admin password" and verify by login, first confirm WHICH email the user logs in with. To change a personal account's password you must reset its `password_hash` in Mongo (or use an in-app change-password flow), not the env var.

**Prod data hygiene note:** prod Atlas DB `rheumaflow` `db.users` held ~16 accounts, almost all role `admin`, including ~10 `demo-*@clinimetria.demo` and `*@rheumaflow.test` / `*@example.com` test accounts — leftover test/demo pollution worth cleaning up (require explicit user consent before any deletion).
