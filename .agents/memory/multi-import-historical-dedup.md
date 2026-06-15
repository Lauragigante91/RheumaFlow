---
name: Multi-import historical dedup
description: How RheumaFlow prevents N-fold duplication of historical/longitudinal data when importing N PDFs for the same patient.
---

# Multi-import: dati storici importati una volta, dati per-visita N volte

Importare N lettere/PDF dello stesso paziente NON deve duplicare i dati STORICI/longitudinali
(diagnosi, comorbidità, allergie, terapie pregresse/sospese, eventi timeline). I dati per-visita
(visita odierna/EO/clinimetrie/esami/decisioni) restano N (uno per lettera).

**Identità terapia pregressa (cross-batch e backend):** farmaco(canonical) + anno + motivo
(token-set normalizzato). Confronto lenient sui campi mancanti, MA il guardrail backend richiede
almeno UN segnale positivo (anno o motivo che combaciano, e nessun segnale in conflitto) prima di
dichiarare duplicato — altrimenti due esposizioni distinte verrebbero fuse.

**Why:** il bug fondeva/duplicava. Il principio del progetto è "in dubbio → conservazione":
duplicare è male, ma fondere esposizioni distinte (perdita di dati clinici) è peggio. Quindi il
dedup deve essere prudente: se non c'è evidenza positiva che sia lo stesso episodio, NON saltarlo.

**How to apply:**
- Free-text (diagnosi/comorbidità/allergie/profilo): firma TOKEN-SET (lowercase, NFD accent-strip,
  punteggiatura→spazio, token unici ordinati). NESSUNA rimozione stopword: le negazioni ("non")
  devono restare, "fumatore" ≠ "non fumatore". Varianti di ordine/accenti/punteggiatura non
  ri-concatenano la stessa diagnosi.
- Reconciler (cross-batch): tracker seenActiveDrugs + seenDisc; registra l'identità a TUTTI i siti
  di scheduling (recordSchedule), non solo al primo. Pregressa identica già vista → DUPLICATE/skip;
  pregressa distinta (anno/motivo diversi) → NEW/new_episode.
- **Remote-stop guard (data-integrity, severo):** se una sospensione "storica" ha un anno
  PRECEDENTE all'inizio dell'episodio attivo (in batch o in DB), NON chiude l'attiva — è una
  esposizione storica → NEW/new_episode. Chiudere un episodio attivo/riavviato per una sospensione
  remota è distruttivo. Vale sia per seenActiveDrugs (batch) sia per existing.status active (DB).
- eventKey timeline: data a livello ANNO quando date_precision=="year" o anno-nudo (len 4); testo
  normalizzato token-set. La firma frontend (eventKey) e backend (_clinical_event_sig) devono
  restare coerenti.
- Payload: event_type_override "historical_exposure" SOLO quando status=="discontinued" &&
  _action=="new_episode" (più end_date). Niente override per _action "discontinue" o import singolo
  (senza _action) → quei casi seguono il path standard.
- Ordine: parseMulti deve ordinare le lettere per data crescente PRIMA della riconciliazione, così
  reconcile e applyMulti vedono lo stesso ordine (l'allineamento per indice resta valido).
- Backend = guardrail idempotente (non l'unica difesa): _find_duplicate_discontinued (therapies) e
  dedup per-firma in clinical-events/batch (vs eventi esistenti non cancellati + entro payload).
  Entrambi filtrano deleted_at:None per non trattare soft-deleted come duplicati.
