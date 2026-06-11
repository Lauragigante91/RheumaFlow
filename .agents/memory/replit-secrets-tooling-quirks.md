---
name: Replit secrets tooling quirks
description: Non-obvious behaviors of the agent secrets/env tooling (viewEnvVars/deleteEnvVars) and JWT_SECRET visibility.
---

# Replit secrets tooling quirks

Durable platform-behavior lessons (not code-derivable) observed when auditing/removing secrets.

## viewEnvVars `keys` filter is unreliable — echoes the requested keys
Calling `viewEnvVars({ type, keys: [...] })` returns the *requested* keys as if they exist, even for secrets that were just deleted. It echoes the filter, it does not filter the real store.
**How to apply:** Always trust the UNFILTERED `viewEnvVars({type:"all"})` `secrets` list as the source of truth. Never conclude a secret exists/was-removed from a `keys`-filtered call.

## deleteEnvVars cannot delete Secrets
`deleteEnvVars` operates only on environment-scoped env vars (shared/development/production). For global Secrets it returns a success-shaped result (`{environment:"shared", keys:[...]}`) but the secret remains. Verify with the unfiltered list afterward.
**How to apply:** The agent cannot remove a Secret. Ask the user to delete it from the Secrets pane (GUI), then verify read-only.

## JWT_SECRET present at runtime but absent from viewEnvVars
In RheumaFlow, `JWT_SECRET` is used by the backend (os.environ["JWT_SECRET"], login works, printenv shows PRESENTE) and is listed in the platform `<available_secrets>`, yet the unfiltered `viewEnvVars` `secrets` list does NOT include it.
**Why it matters:** You cannot enumerate JWT_SECRET's scopes or confirm value equality via the agent API. If the user sees two `JWT_SECRET` rows in the UI, that is the per-environment view (Development vs Production/Deployment) of the same logical secret — confirm in the GUI that BOTH hold the rotated (new) value; a leftover OLD value in the production/deployment scope would keep tokens forgeable there after a leak.
