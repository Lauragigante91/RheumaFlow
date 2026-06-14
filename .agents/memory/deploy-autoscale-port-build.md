---
name: Deploy autoscale — porta 3000 + build frontend obbligatorio
description: Perché il publish fallisce (porta e build frontend mancante) e come configurare correttamente il deployment autoscale.
---

# Deploy autoscale RheumaFlow — porta e build frontend

Il deployment è **autoscale**. La porta primaria HTTP è quella mappata su `externalPort = 80` in `.replit [[ports]]`, cioè **localPort 3000**. Il deployer fa healthcheck su quella porta: se l'app non apre la 3000 il publish fallisce con "a port configuration was specified but the required port was never opened, expected port 3000".

- **Dev (start.sh):** un forwarder Node ascolta su 3000 → 5000 e il dev server CRA gira su 5000; per questo in dev funziona. In **produzione** quel forwarder NON esiste.
- **Prod (run command):** un solo processo FastAPI serve API + SPA. Deve bindare uvicorn su **`--port 3000`** (NON 5000), altrimenti healthcheck fallito → publish abortito.
- **Build frontend obbligatoria:** `frontend/build/` è gitignored (0 file tracciati). Senza un `build` command nel deployment, `frontend/build/index.html` non esiste in prod e `spa_fallback` (server.py) prende il ramo DEV proxando a `http://localhost:5000` → `/` risponde 502/500 e l'healthcheck fallisce comunque. Serve `build = cd frontend && yarn install --production=false && CI=false yarn build` (craco è in devDependencies → `--production=false`; `CI=false` evita warning-as-error di CRA).

**Why:** porta sbagliata e build frontend mancante sono due cause INDIPENDENTI dello stesso publish-fail; vanno corrette entrambe. La sezione `[[ports]]` non è editabile dall'agent, quindi si agisce solo via `deployConfig()` (sezione `[deployment]`): si binda l'app sulla porta già mappata (3000).

**How to apply:** `deployConfig({deploymentTarget:"autoscale", build:["bash","-c","cd /home/runner/workspace/frontend && yarn install --production=false && CI=false yarn build"], run:["bash","-c","... uvicorn server:app --host 0.0.0.0 --port 3000"]})`. Nota a parte: il run avvia un **mongod LOCALE** su `/tmp` (effimero, scorretto per autoscale multi-istanza); la prod dovrebbe usare Atlas via `MONGO_URL` — da verificare/decidere col proprietario, non bloccava il build.
