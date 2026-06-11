---
name: Git reset vs .replit guard + tracked DB
description: Pitfalls when switching the working tree to a different lineage in this repl
---
Two traps when moving `main` to a different tree/lineage in this environment:

1. **.replit / replit.nix are platform-guarded.** Any on-disk write to them is blocked,
   so `git reset --hard <tree>` aborts mid-way if the target differs. Instead:
   `git reset --soft <tree>` then `git checkout <tree> -- . ':!.replit' ':!replit.nix'`,
   remove tree-only-in-old files with `git rm`, and commit the preserved .replit/.replit.nix
   diff on top.

2. **data/mongodb may be tracked in one lineage and gitignored in another.** If tracked
   in HEAD but absent in target, `reset --hard`/checkout DELETES the live DB. Stop mongod,
   `cp -a data /tmp/backup` first, do the switch, restore, then `git rm -r --cached
   data/mongodb` so it becomes ignored.

3. **A recovery merge can leave exactly ONE file as a hybrid.** When a task branch
   replaces a heavily-modified file (e.g. `backend/server.py`: monolith→modular), the
   platform merge into `main` may conflict-resolve THAT file into a hybrid (monolith body
   + the backup's appended router-includes = 3610 lines instead of 220), even though every
   other file merges clean. After any recovery merge, diff the working tree against the
   backup commit file-by-file
   (`git diff --name-only <backup> -- backend frontend/src`) and restore each divergent
   file from the backup blob (`git show <backup>:path > path`).

4. **Never push this lineage to the public GitHub repo without sanitizing.** Intermediate
   Replit checkpoint commits embed `backend/.env` (JWT_SECRET / ADMIN_PASSWORD / LLM key)
   and the live `data/mongodb`; even a clean HEAD tree still TRACKS ~277 real patient files
   under `attached_assets/` (PII). A safe canonical push must squash to a single commit of a
   sanitized tree (no `.env`, no `data/`, no patient PII), force-push to `origin/main`, and
   rotate the embedded credentials. History rewrite + force-push are destructive git → route
   via a project task or the user's shell, never the main agent.

**Why:** lost-data / aborted-reset incidents during the modular recovery; secrets + patient
PII sit in unpushed history and would leak on a naive push to the canonical GitHub repo.
