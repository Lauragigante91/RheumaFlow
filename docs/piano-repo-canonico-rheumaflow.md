# Piano (read-only) — rendere `Lauragigante91/RheumaFlow` il repository canonico unico

Stato: SOLO PIANO. Nessuna operazione di scrittura su git, nessun push, nessun
history rewrite eseguito. I comandi marcati [DISTRUTTIVO] vanno eseguiti solo in
un task dedicato e approvato, con backup verificati, non come parte di questo piano.

---

## Stato verificato (read-only)

- `origin` e gia `https://github.com/Lauragigante91/RheumaFlow`: il repository
  canonico desiderato e gia il remoto principale del workspace.
- HEAD e pulito: nessuno dei path critici e nel working tree attuale; sono solo
  nello storico (history).
- `.gitignore` esiste e gia ignora `*.env` (riga 36), `data/` (riga 73),
  `attached_assets/` (riga 86). I path sono stati committati prima di queste
  regole o tramite i merge dei branch di recovery, non per regola mancante.
- File `.env` nello storico: solo `backend/.env` e `frontend/.env` (nessun `.env`
  di root).
- `attached_assets/` contiene PII reale di pazienti (es. PDF di referti) oltre a
  immagini.
- Nessun remoto `-RheumaFlow-clean` e configurato in questo workspace: Codex lo
  usa altrove; qui non e tracciato.

---

## A. Dati / commit da PRESERVARE

- Tutto il codice applicativo e la struttura: `backend/`, `frontend/`,
  `scripts/`, `.agents/` (memoria gia sanificata), `replit.md`, `README.md`,
  `.gitignore`, `start.sh`, configurazione Replit.
- La cronologia logica dei commit (messaggi e sequenza): il rewrite non cancella
  i commit, li riscrive senza i path incriminati. Cambiano gli SHA, restano
  autore, data e messaggio.
- Lo stato funzionante attuale (HEAD) come riferimento del contenuto buono.
- Fuori dal repo, quindi gia al sicuro: dati clinici su MongoDB Atlas e
  credenziali nei Secrets Replit. Non vanno nel git, restano come sono.
- Backup esistenti: branch `backup-replit-current` / `gitsafe-backup/main` e
  remoto `gitsafe-backup`, da conservare finche la bonifica non e validata.

---

## B. Path da RIMUOVERE dalla history (da tutti i branch destinati al push)

1. `backend/.env` — segreti
2. `frontend/.env` — segreti / configurazione
3. `data/mongodb/` — dump DB pesante (il DB vive su Atlas)
4. `data/mongodb_broken_20260610_040841/` — dump DB rotto
5. `attached_assets/` — PII paziente reale (PDF) + immagini

Nota: i path 1-3 sono presenti anche nel tree di `origin/main` (gia su GitHub);
i path 4-5 sono solo nei commit ahead. La rimozione va comunque applicata a tutta
la history, perche i path 1-3 sono gia stati pubblicati.

---

## C. Evitare il reinserimento di `.env`, `data/`, `attached_assets/`

- `.gitignore` gia copre i tre pattern (verificato con `git check-ignore`):
  mantenerli.
- Mai usare `git add -f` su quei path; in caso di dubbio verificare con
  `git check-ignore -v <path>`.
- Hook `pre-commit` che blocca lo staging di quei pattern e/o uno scanner di
  segreti (gitleaks o git-secrets) come hook locale e check CI.
- Non rimergiare i vecchi branch (monolite/backup/recovery) che ancora
  contengono quei path: dopo la bonifica vanno archiviati/eliminati o anch'essi
  riscritti, altrimenti reintroducono i blob.
- Tenere il dump DB fuori dal git: per i backup usare Atlas o storage esterno,
  non il repository.

---

## D. Riallineare Codex dopo la bonifica

- Il rewrite cambia tutti gli SHA: i cloni esistenti (incluso quello di Codex)
  non possono fare `git pull` perche divergerebbero. Serve re-clone pulito.
- Procedura consigliata:
  1. Far diventare `RheumaFlow` la sola sorgente: dopo il push della history
     bonificata, Codex esegue un clone fresco di
     `https://github.com/Lauragigante91/RheumaFlow`.
  2. Se Codex deve restare sul nome `-RheumaFlow-clean`, in alternativa:
     ripuntare il suo remoto a `RheumaFlow` (`git remote set-url origin ...`)
     e poi `fetch` + `reset --hard origin/main` in quel clone (operazione locale
     di Codex, non in questo workspace).
  3. Archiviare o eliminare `Lauragigante91/-RheumaFlow-clean`, oppure
     trasformarlo in mirror read-only, per avere un'unica fonte di verita ed
     evitare push divergenti futuri.
- Allineare eventuali automazioni / CI / integrazioni che puntano a
  `-RheumaFlow-clean` facendole puntare a `RheumaFlow`.

---

## E. Sequenza operativa (alto livello)

1. Backup verificati (branch + bundle offline).
2. Rewrite history su un clone mirror dedicato.
3. Validazione del risultato (build, test, assenza dei path).
4. Force-push a `RheumaFlow`.
5. Rotazione dei segreti esposti.
6. Re-clone / riallineo Codex.
7. Dismissione di `-RheumaFlow-clean` e dei branch sporchi.

---

## F. Comandi che servirebbero — DA NON ESEGUIRE ORA

I blocchi marcati [DISTRUTTIVO] comportano history rewrite e/o force push: vanno
fatti solo in un task dedicato, approvato, con backup, non in questa sessione.

### 1) Pre-flight (read-only, sicuri)

```bash
git remote -v
git rev-list --left-right --count origin/main...HEAD
for p in backend/.env frontend/.env data/ attached_assets/; do git check-ignore -v "$p"; done
git log --oneline -- backend/.env frontend/.env data/ attached_assets/
```

### 2) Backup di sicurezza (consigliato prima di tutto)

```bash
git branch backup/pre-purge-$(date +%Y%m%d)
git bundle create ../rheumaflow-pre-purge.bundle --all
# remoto di backup gia presente: gitsafe-backup
```

### 3) Bonifica history — [DISTRUTTIVO]

Richiede git-filter-repo (da installare: `pip install git-filter-repo`).

```bash
# su un CLONE MIRROR dedicato, non sul workspace:
git clone --mirror https://github.com/Lauragigante91/RheumaFlow rheumaflow-mirror.git
cd rheumaflow-mirror.git
git filter-repo \
  --path backend/.env \
  --path frontend/.env \
  --path data/mongodb/ \
  --path data/mongodb_broken_20260610_040841/ \
  --path attached_assets/ \
  --invert-paths
```

### 4) Verifica post-rewrite (read-only)

```bash
git log --all --oneline -- backend/.env frontend/.env data/ attached_assets/   # atteso: vuoto
git count-objects -vH
```

### 5) Safeguard anti-reinserimento

```bash
git check-ignore -v backend/.env frontend/.env data/mongodb/ attached_assets/  # tutti ignorati
# opzionale: hook locale gitleaks/pre-commit (da aggiungere in un task di build)
```

### 6) Push canonico — [DISTRUTTIVO / NETWORK]

```bash
git push --force --mirror https://github.com/Lauragigante91/RheumaFlow
```

### 7) Rotazione segreti — OBBLIGATORIA (i `.env` erano gia su GitHub)

- Rigenerare e aggiornare nei Secrets Replit: `MONGO_URL` (nuova password utente
  Atlas), `JWT_SECRET`, `PLATFORM_ACCESS_CODE`, ed eventuali `ANTHROPIC_API_KEY`
  e `GOOGLE_API_KEY`.
- Revocare le credenziali vecchie su Atlas e sui provider.

### 8) Riallineo Codex — lato Codex, non in questo workspace

```bash
# clone fresco (preferito)
git clone https://github.com/Lauragigante91/RheumaFlow
# oppure su clone esistente di Codex:
git remote set-url origin https://github.com/Lauragigante91/RheumaFlow
git fetch origin && git reset --hard origin/main
# poi archiviare/eliminare Lauragigante91/-RheumaFlow-clean
```

---

## G. Avvertenze chiave

- Il force-push non basta: i segreti in `.env` sono gia stati pubblicati su
  GitHub, quindi la rotazione delle credenziali (passo 7) e la vera remediation.
  Il rewrite riduce l'esposizione futura ma non garantisce che nessuno abbia gia
  clonato o messo in cache.
- PII: `attached_assets/` contiene referti reali di pazienti, quindi la rimozione
  dalla history e anche un requisito di privacy, non solo di peso.
- Gli SHA cambiano: tutti i cloni e i branch esistenti vanno re-clonati o
  riallineati con `reset --hard`, mai con `pull`.
- Esecuzione: i passi 3, 6, 7, 8 sono distruttivi o irreversibili e vanno svolti
  come task dedicato approvato, non ora.
