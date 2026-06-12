/**
 * raccordoParser.js
 *
 * Rule-based parser for Italian rheumatology "raccordo anamnestico" text.
 * Extracts longitudinal clinical events with date, drug, confidence, provenance.
 *
 * Event types: disease_onset | manifestation_onset | therapy_start | therapy_stop
 *              | therapy_switch | dose_spacing | remission | flare
 *
 * Returns: Array of RaccordoEvent objects ready for the review UI.
 */

import { DRUG_ALIAS_MAP } from "./drugs";

export const RACCORDO_PARSER_VERSION = "raccordo-1.0";

// ── Drug lookup ───────────────────────────────────────────────────────────────
// Sort longest-first so longer aliases win over prefixes (e.g. "adalimumab biosimilare" > "adalimumab")
// Min length 3 to include common 3-letter abbreviations: MTX, LEF, AZA, MMF, RTX.
// All use \b word-boundary matching so single-letter false positives are not an issue.
const DRUG_ALIAS_SORTED = Object.entries(DRUG_ALIAS_MAP)
  .filter(([alias]) => alias.length >= 3)
  .sort((a, b) => b[0].length - a[0].length);

// Ancillary/supportive drugs: correct to detect clinically, but irrelevant for the
// longitudinal therapy timeline (they travel alongside DMARDs, not standalone events).
// Category "supportive" in drugs.js covers Acido folico, Calcio, Vitamina D, etc.
const ANCILLARY_CANONICALS = new Set(
  Object.values(DRUG_ALIAS_MAP)
    .filter(info => info.category === "supportive")
    .map(info => info.canonical)
);

function findDrugsInText(text) {
  const found = [];
  const norm = text.toLowerCase();
  for (const [alias, info] of DRUG_ALIAS_SORTED) {
    const cs = info.caseSensitive === true;
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, cs ? "g" : "gi");
    const hay = cs ? text : norm;
    let m;
    while ((m = re.exec(hay)) !== null) {
      if (!found.find(f => f.canonical === info.canonical)) {
        found.push({ canonical: info.canonical, name: info.canonical, category: info.category, pos: m.index });
      }
    }
  }
  return found.sort((a, b) => a.pos - b.pos);
}

// ── Date extraction ───────────────────────────────────────────────────────────
const MONTH_NAMES_MAP = {
  gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
  maggio: "05", giugno: "06", luglio: "07", agosto: "08",
  settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
};
const MONTH_NAMES_RE_STR = Object.keys(MONTH_NAMES_MAP).join("|");

function extractDate(text) {
  let m;

  // Month/year compact: "(09/22)" | "09/22" | "09/2022" | "12/2024" | "06/2025"
  m = /\(?(0?\d|1[012])\/((?:20)?\d{2})\)?/.exec(text);
  if (m) {
    const month = m[1].padStart(2, "0");
    const yearRaw = m[2];
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return { date_value: `${year}-${month}-01`, date_text: m[0].replace(/[()]/g, "").trim(), date_precision: "month_year", date_approximate: false };
  }

  // Month name + year: "settembre 2022" | "dicembre 2024"
  m = new RegExp(`\\b(${MONTH_NAMES_RE_STR})\\s+((19|20)\\d{2})\\b`, "i").exec(text);
  if (m) {
    const month = MONTH_NAMES_MAP[m[1].toLowerCase()];
    return { date_value: `${m[2]}-${month}-01`, date_text: m[0], date_precision: "month_year", date_approximate: false };
  }

  // "nel 2021" | "del 2021" | "agli inizi del 2009"
  m = /\b(?:nel|del)\s+((19|20)\d{2})\b/i.exec(text);
  if (m) {
    return { date_value: `${m[1]}-01-01`, date_text: m[0], date_precision: "year", date_approximate: false };
  }

  // "dal 2009" | "da 2019"
  m = /\bdal?\s+((19|20)\d{2})\b/i.exec(text);
  if (m) {
    return { date_value: `${m[1]}-01-01`, date_text: m[0], date_precision: "year", date_approximate: false };
  }

  // 3A-5: mese abbreviato + anno 2 o 4 cifre: "feb22" | "mar21" | "set 2022"
  // Gestisce sia "feb22" (compatto) sia "feb 22" (con spazio)
  const ABBREV_MONTH_MAP = {
    gen:"01", feb:"02", mar:"03", apr:"04", mag:"05", giu:"06",
    lug:"07", ago:"08", set:"09", ott:"10", nov:"11", dic:"12",
  };
  m = new RegExp(
    `\\b(${Object.keys(ABBREV_MONTH_MAP).join("|")})\\.?\\s*((20)?\\d{2})\\b`, "i"
  ).exec(text);
  if (m) {
    const month = ABBREV_MONTH_MAP[m[1].toLowerCase()];
    const rawY  = m[2];
    const year  = rawY.length === 2 ? `20${rawY}` : rawY;
    return { date_value: `${year}-${month}-01`, date_text: m[0].trim(), date_precision: "month_year", date_approximate: false };
  }

  // "metà 2016" | "inizio 2009" | "fine 2020" → mese derivato, data approssimativa
  m = /\b(met[àa]|inizi[oa]|fine)\s+((19|20)\d{2})\b/i.exec(text);
  if (m) {
    const w = m[1].toLowerCase();
    const month = w.startsWith("met") ? "06" : w.startsWith("ini") ? "01" : "12";
    return { date_value: `${m[2]}-${month}-01`, date_text: m[0], date_precision: "month_year", date_approximate: true };
  }

  // Bare year 19xx/20xx as last resort
  m = /\b((19|20)\d{2})\b/.exec(text);
  if (m) {
    return { date_value: `${m[1]}-01-01`, date_text: m[1], date_precision: "year", date_approximate: false };
  }

  return null;
}

// ── Action patterns ───────────────────────────────────────────────────────────
const ONSET_RE = /\besordi\w*\b/i;
const MANIFESTATION_RE = /\b(manifestazion[ei])\b/i;
const ONSET_AGE_TRIGGER_RE = /\bin\s+et[àa]\s+(?:infantil[ei]|pediatric[ao]|neonatal[ei]|adolescenzial[ei]|giovanil[ei]|evolutiv[ao])\b/i;

const STOP_RE = /\b(sospeso|sospesa|sospesi|sospese|sospension[ei]|interrott[oa]|discontinuat[oa]|cessato|cessata|smesso|smessa|fermato|fermata)\b/i;
const PRONOUN_DRUG_RE = /\b(?:del|della)\s+(?:farmaco|terapia|biologico|bDMARD|cDMARD|biosimilare|trattamento|molecola)\b/i;

// "dal YEAR" position scanner — NON-consuming: find all occurrences independently
const DAL_YEAR_POS_RE = /\bdal?\s+((19|20)\d{2})\b/gi;

const SPACING_RE = /\bspacing\b.{0,80}a\s+(\d+)\s+settiman[ae]\b/i;

const START_VERB_RE = /\b(?:avviat[oa]|aggiunt[oa]|iniziat[oa]|introdott[oa]|intrapres[oa]|potenziato\s+con|trattati?\s+con|ha\s+assunto|assumeva|induzione\s+con|mantenimento\s+con)\b/i;

// ── Restart verbs (ripresa, ha ripreso, reintrodotto…) ────────────────────────
// Semantica distinta da START_VERB_RE: indicano una riesposizione dopo interruzione.
// inferred_by → "restart_verb" per distinguerli dagli avvii de-novo.
const RESTART_VERB_RE = /\b(?:ricominciat[oa]|ripres[ao]\s+(?:della\s+)?terapia(?:\s+(?:\w+\s+)?con)?|ha\s+ripreso\b|ripreso\s+(?:terapia\s+)?con\b|reintrodott[oa]\b|reintroduzione\s+di\b)\b/i;

const CONTINUE_VERB_RE = /\b(?:in\s+corso|prosegu\w+|in\s+terapia\s+con)\b/i;

const DAL_YEAR_EXT_SRC = String.raw`\bdal?\s+(?:(0?\d|1[012])\/|(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+|(met[àa]|inizi[oa]|fine)\s+)?((19|20)\d{2})\b`;

const REMISSION_RE = /\bremission[ei](?:\s+clinica)?\b/i;
const FLARE_RE = /\briacutizzazion[ei]\b/i;

const REASON_RE = /\bper\s+([^.,;:\n]{3,60})/i;
const APPROX_RE = /\bcirca\b|\bincirca\b|\bapprossimativament\b/i;

// ── P2A: Switch verbs ─────────────────────────────────────────────────────────
// "passato a X" | "sostituito con X" | "switch a X" | "convertito a X"
// Semantica: therapy_stop(fromDrug) + therapy_start(toDrug)
const SWITCH_VERB_RE = /\b(?:passato\s+(?:a|ad)|sostituit[oa]\s+con|switch(?:ato)?\s+(?:a|ad)|converiti?\s+(?:a|ad))\b/i;

// ── P2B: Bullet list lines ─────────────────────────────────────────────────────
// Matches: "- 2010-2012: Drug" | "2016: sospensione Drug" | "2019-oggi: Drug"
// Groups: [1]=startYear [2]=stopYear|"oggi"|undefined [3]=content after colon
const BULLET_LINE_RE = /^(?:[-•*]\s*)?(\d{4})(?:-(\d{4}|oggi))?\s*[:–]\s*(.+)/i;

// ── 0C: Structured History List constants ─────────────────────────────────────
// CLASS_LABEL_RE: etichette di classe terapeutica che introducono un elenco.
// HISTORY_VERB_RE: verbi storici che indicano trattamento passato con farmaci.
//   trattat[oiea] con  →  tutte le forme di genere/numero
//   (?:\s+\w+)?        →  ammette al più una parola intercalata (es. "anche")
//   poi con            →  "poi con bDMARDs: X, Y"
//   in terapia con     →  "in terapia con cDMARDs"
const CLASS_LABEL_RE = /\b(c?DMARDs?|biologici|bDMARDs?|tsDMARDs?|farmaci\s+di\s+fondo|terapie?\s+di\s+fondo|immunosoppressor[ei])\b/i;
const HISTORY_VERB_RE = /\btrattat[oiea](?:\s+\w+)?\s+con\b|\bpoi\s+con\b|\bin\s+terapia\s+con\b/i;

// ── Sentence splitting ────────────────────────────────────────────────────────
// Protect dots inside medical/Italian abbreviations so they don't trigger splits.
// Uses a §-placeholder that is restored after splitting.
// Only protect abbreviation dots when followed by whitespace + lowercase/digit/paren.
// "sett. dal" → protected (d lowercase); "mg. Nel" → NOT protected (N uppercase → sentence split).
// Flag 'i' rimosso: con 'i' il lookahead [a-z\d(] matchava anche maiuscole (case-insensitive),
// vanificando la guardia su "mg. Nel" / "bid. Nel". Le abbreviazioni sono già minuscole.
const ABBREV_DOT_RE = /\b(sett|die|bid|tid|qid|mg|mcg|tab|cpr|cps|fl|flac|kg|gr|dl|ml|ui|ie|ecc|es|vs|dr|dott|sig|prof|cp|sc|ev|os|im|min|max|sec|art|vol|pp|g)\.(?=\s+[a-z\d(])/g;

function splitSentences(text) {
  const guarded = text.replace(ABBREV_DOT_RE, (_, a) => a + "§");
  return guarded
    .split(/(?<=[.;!\n])\s+|\n+/)
    .map(s => s.replace(/§/g, ".").trim())
    .filter(s => s.length > 8);
}

// ── Source text helper ────────────────────────────────────────────────────────
function src(text) {
  return text.slice(0, 200).replace(/\s+/g, " ").trim();
}

// ── Reason extraction with cleanup ───────────────────────────────────────────
function extractReason(sentence) {
  const m = REASON_RE.exec(sentence);
  if (!m) return null;
  return m[1].trim()
    .split(/\s+e\s+dal?\s+|\s+con\s+|\s+e\s+riacutiz/i)[0]  // stop before "e dal 2009" / "con riacutiz"
    .trim()
    .slice(0, 60);
}

// ── Stop-specific date extraction (excludes "dal YEAR" which signals a START) ──
function extractStopDate(sentence, stopPos) {
  // Look only at text near or before the stop keyword (±60 chars)
  const window = sentence.slice(Math.max(0, stopPos - 30), stopPos + 60);
  let m;

  // Month/year compact: "(09/22)" | "09/2022"
  m = /\(?(0?\d|1[012])\/((?:20)?\d{2})\)?/.exec(window);
  if (m) {
    const month = m[1].padStart(2, "0");
    const yr = m[2].length === 2 ? `20${m[2]}` : m[2];
    return { date_value: `${yr}-${month}-01`, date_text: m[0].replace(/[()]/g, "").trim(), date_precision: "month_year", date_approximate: false };
  }

  // Month name + year: "luglio 2025" — data esplicita di sospensione
  m = new RegExp(`\\b(${MONTH_NAMES_RE_STR})\\s+((19|20)\\d{2})\\b`, "i").exec(window);
  if (m) {
    const month = MONTH_NAMES_MAP[m[1].toLowerCase()];
    return { date_value: `${m[2]}-${month}-01`, date_text: m[0], date_precision: "month_year", date_approximate: false };
  }

  // "nel YEAR" / "del YEAR" — unambiguously for the stop event
  m = /\b(?:nel|del)\s+((19|20)\d{2})\b/i.exec(window);
  if (m) return { date_value: `${m[1]}-01-01`, date_text: m[0], date_precision: "year", date_approximate: false };

  // No reliable stop date found — leave null (better than picking up a start date)
  return null;
}

// ── Event builder ─────────────────────────────────────────────────────────────
let _counter = 0;
function makeEvent(overrides) {
  const id = `raccordo_${++_counter}`;
  return {
    id,
    _id: id,
    _skip: false,
    event_type: null,
    date_value: null,
    date_text: null,
    date_precision: "year",
    date_approximate: false,
    drug_name: null,
    drug_canonical: null,
    drug_category: null,
    from_drug: null,
    to_drug: null,
    manifestation: null,
    body_system: null,
    detail: null,
    reason: null,
    source_text: null,
    confidence: "medium",
    inferred_by: null,
    parser_version: RACCORDO_PARSER_VERSION,
    ...overrides,
  };
}

// ── Body system inference ─────────────────────────────────────────────────────
function deriveBodySystem(text) {
  const lc = text.toLowerCase();
  if (/cutane|psoriasi|pell[ei]/.test(lc)) return "cutaneo";
  if (/articolar|oligoartrit|poliartrit|sinovit|artrit/.test(lc)) return "articolare";
  if (/renali?|proteinuria|glomerulo/.test(lc)) return "renale";
  if (/vascolar|vasculit/.test(lc)) return "vascolare";
  if (/neurolog/.test(lc)) return "neurologico";
  if (/cardio|pericardi|miocardi/.test(lc)) return "cardiologico";
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * parseRaccordoTimeline(text) → RaccordoEvent[]
 *
 * Parses the raccordo anamnestico text into structured clinical events.
 * Processes sentence by sentence, tracking the last drug for anaphora resolution.
 */
export function parseRaccordoTimeline(text) {
  if (!text?.trim()) return [];
  _counter = 0;

  const events = [];
  let lastDrug = null;
  let prevLastDrug = null;       // P2A: lastDrug della frase PRECEDENTE (prima dell'aggiornamento)
  let lastSentenceDrugs = [];
  let lastExtractedDate = null;  // P2A: carries date context across sentence boundaries
  const sentences = splitSentences(text);

  for (const sentence of sentences) {
    prevLastDrug = lastDrug;     // salva prima che la frase corrente lo aggiorni
    const _sentenceStartLen = events.length;
    const drugs = findDrugsInText(sentence);
    const rangeHandledStarts = new Set();
    const rangeHandledStops = new Set();
    if (drugs.length > 0) {
      lastSentenceDrugs = drugs;
      lastDrug = drugs[drugs.length - 1];
    }

    // P2A: aggiorna lastExtractedDate ad ogni frase (anche senza drug).
    // 3A-1: non aggiornare se la frase descrive esordio/diagnosi — l'anno diagnostico
    // non deve contaminare le date di avvio terapia delle frasi successive.
    const sentDate = extractDate(sentence);
    const isDiagnosisContext = /\bdiagnosticat[oa]\b|\besordio\b|\bdiagnosi\s+(?:di|nel|nel\s+)\b|\bprima\s+diagnosi\b/i.test(sentence);
    if (sentDate && !isDiagnosisContext) lastExtractedDate = sentDate;

    // ── 0. Bullet list lines (P2B) ────────────────────────────────────────────
    // Formato: "- 2010-2012: Drug (sospeso per X)" | "2016: sospensione Drug per Y"
    {
      const bm = BULLET_LINE_RE.exec(sentence);
      if (bm) {
        const startYear = bm[1];
        const rawStop   = bm[2];
        const stopYear  = rawStop && rawStop.toLowerCase() !== "oggi" ? rawStop : null;
        const content   = bm[3];

        const contentDrugs = findDrugsInText(content);

        const startDate = { date_value: `${startYear}-01-01`, date_text: startYear, date_precision: "year", date_approximate: false };

        // Caso A — keyword sospensione/sospeso PRINCIPALE all'inizio del contenuto
        // es. "sospensione Leflunomide per epatotossicità, proseguita HCQ"
        const mainStopM = /^(?:sospension[ei]|sospeso|sospesa|interrott[oa]|interruzione)\s+/i.exec(content.trim());
        if (mainStopM) {
          // Scope: solo drug prima della prima virgola (esclude "proseguita HCQ")
          const afterKw    = content.trim().slice(mainStopM[0].length);
          const commaIdx   = afterKw.indexOf(",");
          const stopScope  = commaIdx >= 0 ? afterKw.slice(0, commaIdx) : afterKw;
          const stopDrugs  = findDrugsInText(stopScope);
          const reason     = extractReason(content);
          for (const drug of stopDrugs) {
            if (ANCILLARY_CANONICALS.has(drug.canonical)) continue;
            events.push(makeEvent({ event_type: "therapy_stop", ...startDate, drug_name: drug.name, drug_canonical: drug.canonical, drug_category: drug.category, reason, confidence: "high", inferred_by: "bullet_list", source_text: src(sentence) }));
          }
          if (contentDrugs.length > 0) { lastSentenceDrugs = contentDrugs; lastDrug = contentDrugs[contentDrugs.length - 1]; }
          continue;
        }

        // Caso B — range di anni con opzionale "(sospeso per X)" tra parentesi
        // es. "2010-2012: MTX (sospeso per citopenia)" | "2012-2016: LEF + HCQ"
        const parenStopM  = /\(\s*sosp(?:eso|ensione|esa)\s+per\s+([^)]+)\)/i.exec(content);
        const parenReason = parenStopM ? parenStopM[1].trim().slice(0, 60) : null;

        for (const drug of contentDrugs) {
          if (ANCILLARY_CANONICALS.has(drug.canonical)) continue;
          events.push(makeEvent({ event_type: "therapy_start", ...startDate, drug_name: drug.name, drug_canonical: drug.canonical, drug_category: drug.category, confidence: "high", inferred_by: "bullet_list", source_text: src(sentence) }));
          // Stop solo se stopYear presente E c'è "(sospeso per X)" nella riga
          if (stopYear && parenStopM) {
            const stopDate = { date_value: `${stopYear}-01-01`, date_text: stopYear, date_precision: "year", date_approximate: false };
            events.push(makeEvent({ event_type: "therapy_stop", ...stopDate, drug_name: drug.name, drug_canonical: drug.canonical, drug_category: drug.category, reason: parenReason, confidence: "high", inferred_by: "bullet_list", source_text: src(sentence) }));
          }
        }

        if (contentDrugs.length > 0) { lastSentenceDrugs = contentDrugs; lastDrug = contentDrugs[contentDrugs.length - 1]; }
        continue;
      }
    }

    // ── 0C. Structured History List — Variante B ──────────────────────────────
    // Spara quando la frase contiene un'etichetta di classe (cDMARDs, bDMARDs…)
    // o un verbo storico (trattata/o con, poi con, in terapia con).
    // Emette therapy_start per ogni drug clinicamente rilevante trovato nella frase.
    // NON usa continue: Rule 3 (stop) può ancora sparare sulla stessa frase.
    //
    // Guard hasExplicitStart: se la frase ha già START_VERB_RE o DAL_YEAR, le Rule 2/2b
    // emettono start datati — Rule 0C è ridondante e genererebbe duplicati undated.
    //
    // Categorie escluse da Rule 0C (oltre a "supportive" già in ANCILLARY_CANONICALS):
    //   NSAID / analgesic — farmaci sintomatici non inclusi nella timeline reumatologica.
    {
      const isHistList =
        CLASS_LABEL_RE.test(sentence) ||
        HISTORY_VERB_RE.test(sentence);

      const hasExplicitStart =
        START_VERB_RE.test(sentence) ||
        RESTART_VERB_RE.test(sentence) ||
        new RegExp(DAL_YEAR_EXT_SRC, "i").test(sentence);

      if (isHistList && !hasExplicitStart && drugs.length > 0) {
        const used0c = new Set();
        for (const drug of drugs) {
          if (ANCILLARY_CANONICALS.has(drug.canonical)) continue;
          if (drug.category === "NSAID" || drug.category === "analgesic") continue;
          if (used0c.has(drug.canonical)) continue;
          used0c.add(drug.canonical);
          events.push(makeEvent({
            event_type: "therapy_start",
            drug_name: drug.name,
            drug_canonical: drug.canonical,
            drug_category: drug.category,
            confidence: "medium",
            inferred_by: "list_parse",
            source_text: src(sentence),
          }));
        }
      }
    }

    // ── 0D. Inline year range "(YYYY-YYYY)" → start (Y1) + stop (Y2) ───────────
    // Es. "adalimumab (2014-2016) sospeso per rialzo glicemico".
    // Il farmaco più vicino prima della parentesi riceve start su Y1 e stop su Y2.
    // Marca rangeHandledStarts/Stops così Rule 2/3 non duplicano l'evento.
    {
      const rangeRe = /\((\d{4})\s*[-–]\s*(\d{4})\)/g;
      let rm;
      while ((rm = rangeRe.exec(sentence)) !== null) {
        const y1 = rm[1];
        const y2 = rm[2];
        const parenPos = rm.index;
        const before = sentence.slice(Math.max(0, parenPos - 40), parenPos);
        const bDrugs = findDrugsInText(before);
        const drug = bDrugs.length ? bDrugs[bDrugs.length - 1] : null;
        if (!drug || ANCILLARY_CANONICALS.has(drug.canonical)) continue;
        const afterParen = sentence.slice(parenPos + rm[0].length, parenPos + rm[0].length + 80);
        const reason = extractReason(afterParen);
        events.push(makeEvent({
          event_type: "therapy_start",
          date_value: `${y1}-01-01`, date_text: y1, date_precision: "year",
          drug_name: drug.name, drug_canonical: drug.canonical, drug_category: drug.category,
          confidence: "high", inferred_by: "year_range", source_text: src(sentence),
        }));
        events.push(makeEvent({
          event_type: "therapy_stop",
          date_value: `${y2}-01-01`, date_text: y2, date_precision: "year",
          drug_name: drug.name, drug_canonical: drug.canonical, drug_category: drug.category,
          reason, confidence: "high", inferred_by: "year_range", source_text: src(sentence),
        }));
        rangeHandledStarts.add(drug.canonical);
        rangeHandledStops.add(drug.canonical);
      }
    }

    // ── 1. Disease / manifestation onset ─────────────────────────────────────
    if (ONSET_RE.test(sentence)) {
      const date = extractDate(sentence);
      const isManif = MANIFESTATION_RE.test(sentence);

      // Extract detail: text after the onset word, removing date phrases
      const onsetM = ONSET_RE.exec(sentence);
      const afterOnset = onsetM
        ? sentence.slice(onsetM.index + onsetM[0].length).replace(/\b(?:nel|del|dal?)\s+(19|20)\d{2}\b/gi, "").replace(/\s+/g, " ").trim()
        : sentence;

      const detail = afterOnset.replace(/^con\s+/i, "").trim().slice(0, 100);
      const manifText = isManif ? detail : null;

      events.push(makeEvent({
        event_type: isManif ? "manifestation_onset" : "disease_onset",
        ...(date || {}),
        manifestation: manifText,
        body_system: manifText ? deriveBodySystem(manifText) : null,
        detail,
        confidence: date ? "high" : "medium",
        source_text: src(sentence),
      }));

      continue; // onset sentences don't contain other events
    }

    // ── 1b. Esordio in età evolutiva senza la parola "esordi" ────────────────
    // "in età infantile/pediatrica/..." → disease_onset, date null (no continue).
    if (!ONSET_RE.test(sentence) && ONSET_AGE_TRIGGER_RE.test(sentence)) {
      const detail = sentence.replace(/\s+/g, " ").trim().slice(0, 100);
      events.push(makeEvent({
        event_type: "disease_onset",
        detail,
        confidence: "medium",
        source_text: src(sentence),
      }));
    }

    // ── 2. Therapy starts via "dal YEAR/MM/MONTH" — bidirectional scan ───────
    // Extended pattern handles: "dal 2006", "dal 01/2010", "dal luglio 2023"
    // Groups: m[1]=MM (numeric, e.g. "01"), m[2]=month_name, m[3]=full year
    {
      const usedByRule2 = new Set();
      const dalRe = new RegExp(DAL_YEAR_EXT_SRC, "gi");
      let m;
      while ((m = dalRe.exec(sentence)) !== null) {
        const mmNum   = m[1] ? m[1].padStart(2, "0") : null;
        const mmName  = m[2] ? MONTH_NAMES_MAP[m[2].toLowerCase()] : null;
        const approxW = m[3] ? m[3].toLowerCase() : null;
        const apprMon = approxW ? (approxW.startsWith("met") ? "06" : approxW.startsWith("ini") ? "01" : "12") : null;
        const yearStr = m[4];
        const month   = mmNum || mmName || apprMon || "01";
        const dateVal = `${yearStr}-${month}-01`;
        const datePrec = (mmNum || mmName || apprMon) ? "month_year" : "year";
        const isApprox = !!approxW;
        const dalPos  = m.index;

        const afterPos  = dalPos + m[0].length;
        const fwdDrugs  = findDrugsInText(sentence.slice(afterPos, afterPos + 130));
        const bwdDrugs  = findDrugsInText(sentence.slice(Math.max(0, dalPos - 100), dalPos));
        // Non usare il fallback lastSentenceDrugs se la frase parla di remissione/flare:
        // "Dal 2022 in remissione" non è un avvio di terapia.
        const isRemissionContext = REMISSION_RE.test(sentence) || FLARE_RE.test(sentence);
        const candidates = (fwdDrugs.length || bwdDrugs.length)
          ? [...fwdDrugs, ...bwdDrugs]
          : isRemissionContext ? [] : lastSentenceDrugs.slice(0, 1);

        for (const drug of candidates) {
          if (usedByRule2.has(drug.canonical)) continue;
          if (rangeHandledStarts.has(drug.canonical)) continue;
          if (ANCILLARY_CANONICALS.has(drug.canonical)) continue;
          usedByRule2.add(drug.canonical);
          events.push(makeEvent({
            event_type: "therapy_start",
            date_value: dateVal,
            date_text: m[0].trim(),
            date_precision: datePrec,
            date_approximate: isApprox,
            drug_name: drug.name,
            drug_canonical: drug.canonical,
            drug_category: drug.category,
            detail: sentence.slice(afterPos, afterPos + 100).replace(/[()]/g, "").trim(),
            confidence: "high",
            source_text: src(sentence),
          }));
        }
      }

      // ── 2b. Start verbs (avviato / aggiunto / iniziato / etc.) ─────────────
      {
        const svRe  = new RegExp(START_VERB_RE.source, "gi");
        const svUsed = new Set(usedByRule2);
        let vm;
        while ((vm = svRe.exec(sentence)) !== null) {
          const verbPos = vm.index;
          const wStart  = Math.max(0, verbPos - 30);
          const wEnd    = Math.min(sentence.length, verbPos + 130);
          const wDrugs  = findDrugsInText(sentence.slice(wStart, wEnd));
          const dateCtx = sentence.slice(Math.max(0, verbPos - 60), verbPos + 80);
          const date    = extractDate(dateCtx);

          // Pre-compute positions of "nonostante" in the sentence (concessive context).
          // Drugs appearing immediately after "nonostante" are background/contrast drugs,
          // NOT drugs being started (e.g. "avviato RTX nonostante Nintedanib" → RTX starts, not Nintedanib).
          const nonoConcRe = /\bnonostante\s+/gi;
          let nonom;
          const nonoEnds = [];
          while ((nonom = nonoConcRe.exec(sentence)) !== null) {
            nonoEnds.push(nonom.index + nonom[0].length);
          }
          const isConcessiveDrug = (sentencePos) =>
            nonoEnds.some(p => sentencePos >= p && sentencePos <= p + 60);

          for (const drug of wDrugs) {
            if (svUsed.has(drug.canonical)) continue;
            if (ANCILLARY_CANONICALS.has(drug.canonical)) continue;
            const sentPos = drug.pos + wStart;
            if (isConcessiveDrug(sentPos)) continue;
            // Se il drug è PRIMA del verbo, verifica che non sia in una clausola
            // separata da virgola (es. "aumentata frequenza RTX ..., aggiunto MMF").
            // Droga + virgola + verbo = clausola diversa → non è questa la terapia avviata.
            if (sentPos < verbPos) {
              const between = sentence.slice(sentPos + (drug.name || drug.canonical).length, verbPos);
              if (between.includes(",")) continue;
            }
            svUsed.add(drug.canonical);
            events.push(makeEvent({
              event_type: "therapy_start",
              ...(date || {}),
              drug_name: drug.name,
              drug_canonical: drug.canonical,
              drug_category: drug.category,
              confidence: date ? "high" : "medium",
              inferred_by: "start_verb",
              source_text: src(sentence),
            }));
          }
        }
      }
    }

    // ── 2b-restart. Restart verbs (ripresa, ha ripreso, reintrodotto…) ─────────
    // Semantica: il farmaco era già stato usato in passato e viene reintrodotto.
    // Stessa logica di window-search di Rule 2b; inferred_by distinto.
    {
      const rvRe  = new RegExp(RESTART_VERB_RE.source, "gi");
      const rvUsed = new Set();
      let rvm;
      while ((rvm = rvRe.exec(sentence)) !== null) {
        const verbPos = rvm.index;
        const wStart  = Math.max(0, verbPos - 30);
        const wEnd    = Math.min(sentence.length, verbPos + 130);
        const wDrugs  = findDrugsInText(sentence.slice(wStart, wEnd));
        const dateCtx = sentence.slice(Math.max(0, verbPos - 60), verbPos + 80);
        const date    = extractDate(dateCtx);

        for (const drug of wDrugs) {
          if (rvUsed.has(drug.canonical)) continue;
          if (ANCILLARY_CANONICALS.has(drug.canonical)) continue;
          rvUsed.add(drug.canonical);
          events.push(makeEvent({
            event_type: "therapy_start",
            ...(date || {}),
            drug_name: drug.name,
            drug_canonical: drug.canonical,
            drug_category: drug.category,
            confidence: date ? "high" : "medium",
            inferred_by: "restart_verb",
            source_text: src(sentence),
          }));
        }
      }
    }

    // ── 2c. Switch verbs (P2A) ───────────────────────────────────────────────
    // "passato a X" | "sostituito con X" | "switch a X" | "convertito a X"
    // → therapy_stop(fromDrug) + therapy_start(toDrug)
    // La data viene dalla frase corrente o da lastExtractedDate (contesto cross-sentence).
    if (SWITCH_VERB_RE.test(sentence)) {
      const swM    = SWITCH_VERB_RE.exec(sentence);
      const swPos  = swM.index;

      // Drug DOPO il verbo = toDrug (nuovo)
      const afterVerb = sentence.slice(swPos + swM[0].length, swPos + swM[0].length + 100);
      const toDrugs   = findDrugsInText(afterVerb);
      const toDrug    = toDrugs.find(d => !ANCILLARY_CANONICALS.has(d.canonical)) || null;

      if (toDrug) {
        // Drug PRIMA del verbo nella frase = fromDrug esplicito; altrimenti lastDrug
        const beforeVerb     = sentence.slice(Math.max(0, swPos - 80), swPos);
        const fromInSentence = findDrugsInText(beforeVerb).filter(d => !ANCILLARY_CANONICALS.has(d.canonical));
        // Fallback: usa prevLastDrug (drug dell'iterazione precedente), NON lastDrug che
        // include già i drug trovati nella frase corrente (es. "passato a Golimumab" →
        // lastDrug=Golimumab = toDrug, ma fromDrug dovrebbe essere Adalimumab di prima).
        const fromDrug       = fromInSentence.length > 0 ? fromInSentence[fromInSentence.length - 1] : prevLastDrug;

        // Cambio di formulazione/via (stesso canonical): non è un vero switch — salta
        if (fromDrug && fromDrug.canonical === toDrug.canonical) {
          lastDrug = toDrug;
          lastSentenceDrugs = [toDrug];
          continue;
        }

        // Data: frase corrente oppure ultima data vista (cross-sentence)
        const swDate = extractDate(sentence.slice(Math.max(0, swPos - 60), swPos + 80)) || lastExtractedDate;

        // Reason: cerca nella frase corrente (raramente presente; spesso è nella frase precedente)
        const reason = extractReason(sentence.slice(Math.max(0, swPos - 80), swPos + 20));

        if (fromDrug && fromDrug.canonical !== toDrug.canonical) {
          events.push(makeEvent({
            event_type: "therapy_stop",
            ...(swDate || {}),
            drug_name: fromDrug.name,
            drug_canonical: fromDrug.canonical,
            drug_category: fromDrug.category,
            reason,
            confidence: swDate ? "high" : "medium",
            inferred_by: fromInSentence.length === 0 ? "anaphora" : null,
            source_text: src(sentence),
          }));
        }
        events.push(makeEvent({
          event_type: "therapy_start",
          ...(swDate || {}),
          drug_name: toDrug.name,
          drug_canonical: toDrug.canonical,
          drug_category: toDrug.category,
          confidence: swDate ? "high" : "medium",
          inferred_by: "switch_verb",
          source_text: src(sentence),
        }));

        lastDrug = toDrug;
        lastSentenceDrugs = [toDrug];
        continue;
      }
    }

    // ── 3. Therapy stops — multi-stop loop ───────────────────────────────────
    // Ogni occorrenza di STOP_RE nella frase viene processata indipendentemente.
    // Per ciascuna: finestra [-80, +0] per il drug, finestra [0, +80] per la reason.
    // stopsEmitted previene lo stesso canonical da stop multipli nella stessa frase.
    {
      const stopReG = new RegExp(STOP_RE.source, "gi");
      let stopM;
      const stopsEmitted = new Set();

      while ((stopM = stopReG.exec(sentence)) !== null) {
        const stopPos = stopM.index;

        // Guard negazione per-occorrenza: "mai sospeso" / "non sospeso"
        const _stopPrePad = sentence.slice(Math.max(0, stopPos - 15), stopPos);
        if (/\b(?:mai|non)\s*$/i.test(_stopPrePad)) continue;
        // "tentata sospensione" = tentativo poi rientrato: non e' una sospensione reale
        if (/\btentat[ao]\s*$/i.test(_stopPrePad)) continue;

        // Data stop per-occorrenza (esclude "dal YEAR" che indica avvio)
        const stopDate = extractStopDate(sentence, stopPos);

        // Reason per-occorrenza: cerca "per ..." nel contesto subito dopo la stop keyword
        const reasonCtx = sentence.slice(stopPos, Math.min(sentence.length, stopPos + 80));
        const reason = extractReason(reasonCtx);

        // Drug attribution: finestra di 80 char PRIMA di questa specifica occorrenza
        const drugsInWindow = drugs.filter(d => d.pos < stopPos && d.pos >= stopPos - 80);

        let stoppedDrug = null;
        let isAnaphora = false;

        if (drugsInWindow.length > 0) {
          // Il drug più vicino prima della stop keyword
          const candidate = drugsInWindow[drugsInWindow.length - 1];
          if (!stopsEmitted.has(candidate.canonical)) stoppedDrug = candidate;
        } else {
          // Drug DOPO la stop keyword (es. "sospeso MTX")
          const afterStopText = sentence.slice(stopPos);
          const hasStartVerbAfterStop = START_VERB_RE.test(afterStopText);
          if (!hasStartVerbAfterStop) {
            const drugsAfterStop = drugs.filter(d => d.pos > stopPos && d.pos <= stopPos + 80);
            if (drugsAfterStop.length > 0 && !stopsEmitted.has(drugsAfterStop[0].canonical)) {
              stoppedDrug = drugsAfterStop[0];
            }
          }
          // Anaphora: solo se nessun'altra stop è stata emessa in questa frase
          if (!stoppedDrug && stopsEmitted.size === 0) {
            const hasProNoun = PRONOUN_DRUG_RE.test(sentence);
            isAnaphora = hasProNoun && !!lastDrug && !ANCILLARY_CANONICALS.has(lastDrug.canonical);
            stoppedDrug = isAnaphora ? lastDrug : null;
          }
        }

        if (!stoppedDrug) continue;
        if (rangeHandledStops.has(stoppedDrug.canonical)) continue;
        if (ANCILLARY_CANONICALS.has(stoppedDrug.canonical)) continue;

        stopsEmitted.add(stoppedDrug.canonical);
        events.push(makeEvent({
          event_type: "therapy_stop",
          ...(stopDate || {}),
          drug_name: stoppedDrug.name,
          drug_canonical: stoppedDrug.canonical,
          drug_category: stoppedDrug.category,
          reason,
          confidence: isAnaphora ? "medium" : (stopDate ? "high" : "medium"),
          inferred_by: isAnaphora ? "anaphora" : null,
          source_text: src(sentence),
        }));
      }
    }

    // ── 3b. Therapy continuation ("in corso" / "prosegue" / "in terapia con") ──
    // Frase con terapia ATTUALMENTE in corso senza data di avvio esplicita.
    // Emette therapy_continue (date null) solo se nessun'altra regola ha gia'
    // gestito quel farmaco nella stessa frase (evita doppioni con Rule 0C/2/3).
    {
      const cvRe = new RegExp(CONTINUE_VERB_RE.source, "gi");
      const handledThisSentence = new Set(
        events.slice(_sentenceStartLen).map(e => e.drug_canonical).filter(Boolean)
      );
      const continuedEmitted = new Set();
      let cvm;
      while ((cvm = cvRe.exec(sentence)) !== null) {
        const verbPos = cvm.index;
        const prePad = sentence.slice(Math.max(0, verbPos - 20), verbPos);
        if (/\b(?:non|mai|nessun\w*)(?:\s+\w+)?\s*$/i.test(prePad)) continue;
        const postPad = sentence.slice(verbPos + cvm[0].length, verbPos + cvm[0].length + 4);
        if (/^\s+di\b/i.test(postPad)) continue;

        const wStart = Math.max(0, verbPos - 25);
        const wEnd   = Math.min(sentence.length, verbPos + cvm[0].length + 100);
        const wDrugs = findDrugsInText(sentence.slice(wStart, wEnd));

        for (const drug of wDrugs) {
          if (ANCILLARY_CANONICALS.has(drug.canonical)) continue;
          if (drug.category === "NSAID" || drug.category === "analgesic") continue;
          if (handledThisSentence.has(drug.canonical)) continue;
          if (continuedEmitted.has(drug.canonical)) continue;
          continuedEmitted.add(drug.canonical);
          events.push(makeEvent({
            event_type: "therapy_continue",
            drug_name: drug.name,
            drug_canonical: drug.canonical,
            drug_category: drug.category,
            confidence: "medium",
            inferred_by: "continue_verb",
            source_text: src(sentence),
          }));
        }
      }
    }

    // ── 4. Dose spacing ───────────────────────────────────────────────────────
    if (SPACING_RE.test(sentence)) {
      const date = extractDate(sentence);
      const spacingM = SPACING_RE.exec(sentence);
      const weeks = spacingM?.[1];
      const drug = drugs[0] || lastDrug;
      const isAnaphora = !drugs[0] && !!lastDrug;

      events.push(makeEvent({
        event_type: "dose_spacing",
        ...(date || {}),
        drug_name: drug?.name || null,
        drug_canonical: drug?.canonical || null,
        drug_category: drug?.category || null,
        detail: weeks ? `spacing a ${weeks} settiman${weeks === "1" ? "a" : "e"}` : null,
        confidence: "high",
        inferred_by: isAnaphora ? "anaphora" : null,
        source_text: src(sentence),
      }));
    }

    // ── 5. Remission ─────────────────────────────────────────────────────────
    if (REMISSION_RE.test(sentence)) {
      const date = extractDate(sentence);
      events.push(makeEvent({
        event_type: "remission",
        ...(date || {}),
        detail: sentence.slice(0, 100),
        confidence: date ? "high" : "medium",
        source_text: src(sentence),
      }));
    }

    // ── 6. Flare (only in non-stop sentences to avoid double-counting) ────────
    if (FLARE_RE.test(sentence) && !STOP_RE.test(sentence)) {
      const date = extractDate(sentence);
      const approx = APPROX_RE.test(sentence);
      events.push(makeEvent({
        event_type: "flare",
        ...(date ? { ...date, date_approximate: date.date_approximate || approx } : { date_approximate: approx }),
        detail: sentence.slice(0, 100),
        confidence: date ? "medium" : "low",
        source_text: src(sentence),
      }));
    }
  }

  // ── Deduplicate: same event_type + drug_canonical + date_value ────────────
  const seen = new Set();
  return events.filter(ev => {
    const key = `${ev.event_type}::${ev.drug_canonical || ""}::${ev.date_value || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
