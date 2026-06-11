/**
 * pdfDeidentifier.js
 *
 * De-identificazione del testo estratto da PDF clinici italiani.
 *
 * PRINCIPIO ARCHITETTURALE:
 *   Il parser clinico deve ricevere SOLO testo de-identificato.
 *   Nessun dato anagrafico (nome, cognome, CF, data di nascita, residenza,
 *   email, telefono, numero cartella) deve propagarsi alla pipeline clinica,
 *   al review, alle API di salvataggio, ai log o agli export.
 *
 *   Il collegamento al paziente avviene ESCLUSIVAMENTE tramite patient_id
 *   interno, mai leggendo l'identità dal PDF.
 *
 * Dati rimossi:
 *   - Codice Fiscale (regex pattern 16 char + omocodia)
 *   - Indirizzi email
 *   - Campi labeled: Cognome, Nome, Nato/Nata (+ luogo + data + età),
 *     Codice Fiscale, Scheda Nr., Indirizzo, Residenza, Tel/Cell, Età
 *
 * Dati preservati:
 *   - Date cliniche (EE 13/03/26, Data refertazione ecc.)
 *   - Riferimenti all'età in prosa clinica ("paziente di 21 anni")
 *   - Nomi di medici e strutture (non sono dati del paziente)
 *   - Tutto il contenuto clinico
 *
 * @module pdfDeidentifier
 */

// ── Codice Fiscale italiano (include omocodia) ───────────────────────────────
// 6 lettere + 2 char (digits/omocodia) + mese (ABCDEHLMPRST) +
// 2 char + 1 lettera + 3 char + 1 lettera check
const CF_RE = /\b[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]\b/g;

// ── Email ─────────────────────────────────────────────────────────────────────
const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;

// ── Campi labeled inline ──────────────────────────────────────────────────────
// Applicati con replace globale su tutto il testo (non line-by-line) perché
// il layout coordinate-based di pdfjs può mescolare sidebar e contenuto.
// Ogni pattern rimuove SOLO la parte anagrafica, lasciando il resto della riga.
//
// NOTA: l'ordine conta — i pattern più specifici (multi-campo) precedono quelli
// singoli per evitare match parziali che lasciano frammenti.
const INLINE_PATTERNS = [
  // ── Cognome e Nome (campi labeled, tipicamente ALL-CAPS nei referti) ──────
  // Es: "Cognome:  CONTAVALLI  Nome:  ELENA"
  [
    /Cognome\s*:\s*[A-ZÀÈÌÒÙÁÉÍÓÚ]{2,}(?:\s+[A-ZÀÈÌÒÙÁÉÍÓÚ]{2,})*/g,
    "[ANAGRAFICA]",
  ],
  [
    /\bNome\s*:\s*[A-ZÀÈÌÒÙÁÉÍÓÚ]{2,}(?:\s+[A-ZÀÈÌÒÙÁÉÍÓÚ]{2,})*/g,
    "[ANAGRAFICA]",
  ],

  // ── Blocco DOB completo: "Nato\a: BOLOGNA  il: 11/08/2004  Età: 21" ──────
  // Gestisce la variante "Nato\a" usata nei referti AUSL emiliani
  [
    /Nat[oa]\\?[aA]?\s*:\s*\S+\s+il\s*:\s*[\d\/]+\s+Et[àa]\s*:\s*\d+/gi,
    "[ANAGRAFICA]",
  ],
  // Fallback parziale se il blocco è spezzato su più righe
  [/Nat[oa]\\?[aA]?\s*:\s*\S+/gi, "[ANAGRAFICA]"],
  // "il: 11/08/2004" (data di nascita, con colon — distinto da "il " in prosa)
  [/\bil\s*:\s*\d{1,2}\/\d{1,2}\/\d{4}/g, "[ANAGRAFICA]"],
  // "Età: 21" (solo campo labeled — non tocca "paziente di 21 anni")
  [/\bEt[àa]\s*:\s*\d{1,3}\b/gi, "[ANAGRAFICA]"],

  // ── Codice Fiscale con label ──────────────────────────────────────────────
  [/Codice\s+Fiscale\s*:\s*\S+/gi, "[ANAGRAFICA]"],
  [/\bC\.?\s*F\.?\s*:\s*[A-Z0-9]{10,}/gi, "[ANAGRAFICA]"],

  // ── Numero cartella / scheda admin ───────────────────────────────────────
  [/Scheda\s+Nr\.?\s*:\s*\d+/gi, "[ANAGRAFICA]"],
  [/N\.?\s*[Cc]artella\s*:\s*\d+/g, "[ANAGRAFICA]"],
  [/[Nn]umero\s+[Pp]renotazione\s*:\s*[\w\d]+/g, "[ANAGRAFICA]"],
  [/\b(?:NRE|NRO)\s*:\s*[\w\d]+/g, "[ANAGRAFICA]"],

  // ── Indirizzo / residenza ─────────────────────────────────────────────────
  [/\b(?:Indirizzo|Residenza|Domicilio)\s*:\s*[^\n]+/gi, "[ANAGRAFICA]"],

  // ── Telefono (solo se labeled — evita false positive su valori lab) ───────
  [/\b(?:Tel(?:efono)?|Cell(?:ulare)?|Fax)\s*:\s*[\d\s\-\+\/\(\)\.]{7,}/gi, "[ANAGRAFICA]"],

  // ── Tessera sanitaria ─────────────────────────────────────────────────────
  [/\b(?:Tessera|[Cc]od(?:ice)?\s+[Ee]senzione)\s*:\s*[\w\d]+/g, "[ANAGRAFICA]"],

  // ── Medico di base (solo labeled) ────────────────────────────────────────
  [/\b(?:Medico\s+(?:curante|di\s+base|MMG)|MMG)\s*:\s*[^\n]+/gi, "[ANAGRAFICA]"],
];

// ── Sezioni cliniche riconosciute ─────────────────────────────────────────────
// Specchio delle sezioni che visitTextParser.js riconosce.
const CLINICAL_SECTIONS = [
  {
    key: "raccordo",
    label: "Raccordo / Storia clinica",
    re: /\b(?:RACCORDO|STORIA\s+CLINICA|ANAMNESI\s+REUMATOLOGICA|DECORSO\s+CLINICO)\b/i,
  },
  {
    key: "terapia_domiciliare",
    label: "Terapia domiciliare",
    re: /\b(?:TERAPIA\s+(?:DOMICILIARE|IN\s+ATTO|ATTUALE|IN\s+CORSO|CORRENTE|PRATICATA|ABITUALE)|FARMACI\s+IN\s+CORSO|IN\s+TERAPIA)\b/i,
  },
  {
    key: "esami_pregressi",
    label: "Esami pregressi",
    re: /\b(?:ESAMI\s+PREGRESSI|RECA\s+IN\s+VISIONE|PORTA\s+IN\s+VISIONE|IN\s+VISIONE)\b/i,
  },
  {
    key: "laboratorio",
    label: "Laboratorio",
    re: /\bLABORATORIO\b/i,
  },
  {
    key: "anamnesi_fisiologica",
    label: "Anamnesi fisiologica",
    re: /\bANAMNESI\s+FISIOLOGICA\b/i,
  },
  {
    key: "anamnesi_familiare",
    label: "Anamnesi familiare",
    re: /\bANAMNESI\s+FAMILIARE\b/i,
  },
  {
    key: "anamnesi_intervallare",
    label: "Anamnesi intervallare",
    re: /\b(?:ANAMNESI\s+INTERVALLARE|MOTIVO\s+DELLA?\s+VISITA|AGGIORNAMENTO\s+CLINICO|RIVALUTAZIONE)\b/i,
  },
  {
    key: "visita_odierna",
    label: "Visita odierna",
    re: /\b(?:VISITA\s+ODIERNA|ESAME\s+OBIETTIVO|OBIETTIVIT[AÀ])\b/i,
  },
  {
    key: "comorbidita",
    label: "Comorbidità / APR",
    re: /\b(?:COMORBILIT[AÀ]|COMORBIDIT[AÀ]|APR|ANAMNESI\s+PATOLOGICA)\b/i,
  },
  {
    key: "allergie",
    label: "Allergie / Intolleranze",
    re: /\b(?:ALLERGIE?|INTOLLERANZE?)\b/i,
  },
  {
    key: "conclusioni",
    label: "Conclusioni / Diagnosi",
    re: /\b(?:CONCLUSIONI|CONCLUSIONI\/DIAGNOSI|DIAGNOSI)\b/i,
  },
  {
    key: "indicazioni",
    label: "Indicazioni terapeutiche",
    re: /\bINDICAZIONI\b/i,
  },
  {
    key: "ho_richiesto",
    label: "Esami richiesti",
    re: /\b(?:HO\s+RICHIESTO|ACCERTAMENTI\s+PRESCRITTI|ESAMI\s+PRESCRITTI)\b/i,
  },
  {
    key: "strumentali",
    label: "Esami strumentali",
    re: /\b(?:ESAMI\s+STRUMENTALI|ACCERTAMENTI\s+STRUMENTALI)\b/i,
  },
];

// ── Boilerplate istituzionale da rimuovere ────────────────────────────────────
//
// Righe che compaiono nell'intestazione di ogni pagina del referto AUSL Bologna
// (e analoghi referti ospedalieri italiani) e nel footer legale.
// Nessuna di queste righe ha contenuto clinico.
//
// NOTA: "Data e ora di refertazione:" è PRESERVATA perché serve al rilevamento
// automatico della data di visita (detectVisitDate in ImportVisitPdfModal).
//
const BOILERPLATE_LINE_RE = [
  // ── Intestazione istituzionale (si ripete a ogni pagina) ──────────────────
  /^STRUTTURA COMPLESSA DI MEDICINA INTERNA\s*$/i,
  /^AD INDIRIZZO REUMATOLOGICO\s*$/i,
  /^DIRETTORE\s+DR\.?\s*\S.+$/i,
  /^DIPARTIMENTO\s*$/i,
  /^MEDICO\s*$/i,
  /^REFERTO\s*$/i,
  /^Ambulatorio di\b.+$/i,
  /^OSPEDALE\s+\S.+(?:AMB(?:ULATORIO)?\.?|POLIAMBULATORIO).+$/i,
  /^DIPARTIMENTO\s+MEDICO\s*$/i,
  // ── Blocco amministrativo in cima al referto ──────────────────────────────
  // Linee con solo placeholder [ANAGRAFICA] (eventuale label "Patologia:" o simili)
  /^\s*(?:\[ANAGRAFICA\]\s*)+(?:Patologia\s*:)?\s*$/i,
  // "[ANAGRAFICA]  del:DD/MM/YYYY" — data scheda / prenotazione (non clinica)
  /^\s*\[ANAGRAFICA\]\s+del\s*:\s*\d{1,2}\/\d{1,2}\/\d{4}\s*$/i,
  /^Regime di Erogazione\s*:.+$/i,
  /^Prestazione\s*:.+$/i,
  // Label strutturale PDF — non è testo clinico utile al parser
  /^Conclusioni\/Diagnosi\s*$/i,
  // ── Footer legale (ultima pagina) ─────────────────────────────────────────
  /^Per ogni informazione o chiarimenti.+$/i,
  /^Duplicato informatico del referto.+$/i,
  /^In caso di stampa.+$/i,
  /^sensi dell'art\.?\s*\d+.+$/i,
  // Frammento di fine riga "Romagna." dal blocco ParER multi-riga
  /^Romagna\.\s*$/i,
];

// Pattern multi-riga: "IL MEDICO\n<nome del medico firmatario>"
const SIGNATURE_BLOCK_RE = /^.{0,40}IL MEDICO[ \t]*\n[^\n]*$/gmi;

/**
 * Rimuove il boilerplate istituzionale dal testo già de-identificato.
 * Non tocca le righe con contenuto clinico.
 */
function stripBoilerplate(text) {
  // 1. Blocco firma (IL MEDICO + riga successiva con il nome del medico)
  text = text.replace(SIGNATURE_BLOCK_RE, "");

  // 2. Righe boilerplate riga per riga
  const lines = text.split("\n");
  const cleaned = lines.filter(
    (line) => !BOILERPLATE_LINE_RE.some((re) => re.test(line.trim()))
  );

  // 3. Collassa sequenze di più righe vuote consecutive in una sola
  const collapsed = [];
  let prevEmpty = false;
  for (const line of cleaned) {
    const isEmpty = line.trim() === "";
    if (isEmpty && prevEmpty) continue;
    collapsed.push(line);
    prevEmpty = isEmpty;
  }

  return collapsed.join("\n");
}

// ── Funzione principale ───────────────────────────────────────────────────────

/**
 * Rimuove i blocchi anagrafici dal testo estratto da PDF.
 *
 * @param {string} rawText  — testo grezzo estratto da pdfLabExtractor
 * @returns {{
 *   cleanText:    string,    — testo de-identificato (mai dati anagrafici)
 *   removedCount: number,    — quanti elementi anagrafici sono stati rimossi
 *   sectionsFound: Array<{key: string, label: string}>  — sezioni cliniche riconosciute
 * }}
 */
export function stripDemographics(rawText) {
  if (!rawText) return { cleanText: "", removedCount: 0, sectionsFound: [] };

  let text = rawText;
  let removedCount = 0;

  // 1. Codice Fiscale (regex molto specifica — bassissimo rischio di falsi positivi)
  text = text.replace(CF_RE, () => { removedCount++; return "[ANAGRAFICA]"; });

  // 2. Email
  text = text.replace(EMAIL_RE, () => { removedCount++; return "[ANAGRAFICA]"; });

  // 3. Campi labeled inline
  //    Ricrea ogni RegExp per resettare lastIndex (flag /g ha lastIndex stateful)
  for (const [re, replacement] of INLINE_PATTERNS) {
    const freshRe = new RegExp(re.source, re.flags);
    text = text.replace(freshRe, () => { removedCount++; return replacement; });
  }

  // 4. Boilerplate istituzionale (intestazione pagina, blocco admin, footer legale)
  text = stripBoilerplate(text);

  // 5. Rileva sezioni cliniche nel testo de-identificato
  const sectionsFound = CLINICAL_SECTIONS.filter((s) => s.re.test(text));

  return {
    cleanText: text.trim(),
    removedCount,
    sectionsFound,
  };
}
