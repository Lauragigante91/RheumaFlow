---
name: Dev bare-domain 502 (externalPort 80 orphan)
description: Why the root dev URL can 502 while the app is healthy, and the start.sh TCP-forwarder workaround.
---

# Dev bare-domain 502 — externalPort 80 orphan

The public dev root URL (`https://$REPLIT_DEV_DOMAIN/`, externalPort 80) can return HTTP 502 even though the app is fully working. Cause: in `.replit`, externalPort 80 is mapped to a localPort where nothing listens (seen mapped to `localPort 3000`). The real services are the React frontend on 5000 (webview) and FastAPI on 8000 — both healthy, reachable at `:5000` / `:8000` and via the Replit preview pane.

**Why this recurs:** the externalPort 80 mapping keeps getting reshuffled by the "recovery"/merge commits that rebuilt this repo (history shows 80 -> 8000, then 80 -> 3000). Future "root URL gives errore/502" reports most likely have this same cause — check `.replit` `[[ports]]` for which localPort owns externalPort 80 and whether anything listens there.

**Agent constraint:** direct edits to `.replit` are blocked, and there is NO agent tool that remaps or removes an orphaned externalPort entry. `configureWorkflow({waitForPort})` only declares the workflow's own port (kept `5000 -> 5000`); it does not claim externalPort 80 nor delete the orphan.

**Workaround in `start.sh`:** a dependency-free Node raw-TCP forwarder `0.0.0.0:3000 -> 127.0.0.1:5000`, backgrounded before `yarn start`, plus a matching cleanup line. Because the frontend dev server has `allowedHosts = "all"`, the bare-domain Host header is accepted; raw TCP is protocol-transparent so HTTP and WebSocket/HMR pass through. The forwarder process carries a `TAG="PORTFWD35"` constant purely as a `pkill -f "PORTFWD35"` handle.

**How to apply:** if the root URL 502s, confirm 5000/8000 are 200 first; if so it is the port map, not the app. The forwarder only works while the workflow runs. Permanent correct fix is user-side: in the Ports pane remap externalPort 80 to internal port 5000 (or remove the dead entry) — after that the forwarder is just an idle local listener and can be removed.
