---
name: Tesseract.js v7 + Replit CSP — workerPath locale
description: Tesseract.js v7 usa workerBlobURL:true per default; in Replit il blob Worker è bloccato dalla CSP dell'iframe proxy. Fix: worker locale in public/ + workerBlobURL:false.
---

## Regola

Tesseract.js v7 (package.json: `"^7.0.0"`) usa `workerBlobURL: true` per default. Il browser worker crea un Blob con `importScripts("https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js")` e lo esegue come Web Worker. In Replit (iframe proxied con CSP), `importScripts()` cross-origin da `blob:null` viene bloccato silenziosamente — nessuna richiesta network visibile nel DevTools del frame principale, nessun errore in console (il reject in createWorker.js è swallowed da `.catch(() => {})`).

**Why:** la CSP del proxy Replit blocca importScripts() da CDN in un Worker che ha origin blob:null; fetch() cross-origin da Worker con origin reale è invece permesso.

**How to apply:** ogni volta che si usa Tesseract.js in questo progetto CRA:
1. `worker.min.js` è in `frontend/public/tesseract/worker.min.js` (copiato da `node_modules/tesseract.js/dist/`).
2. Usare `createWorker` (named export) — NON `Tesseract.recognize()` — con queste opzioni:
   ```js
   const { createWorker } = await import("tesseract.js");
   const worker = await createWorker("ita+eng", 1, {
     workerPath: `${window.location.origin}/tesseract/worker.min.js`,
     workerBlobURL: false,
     logger: (m) => { ... },
   });
   const { data } = await worker.recognize(image);
   await worker.terminate();
   ```
3. Se si aggiorna tesseract.js, ricopiare `dist/worker.min.js` → `public/tesseract/worker.min.js`.
4. Il worker.min.js carica WASM e lang data dalla CDN jsDelivr via `fetch()` — questo funziona perché i Web Worker caricati da same-origin possono fare fetch cross-origin senza restrizioni CSP.
