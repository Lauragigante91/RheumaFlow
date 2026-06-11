/**
 * instrumentalParser.js
 *
 * Rule-based (zero AI) detection of imaging / instrumental exam lines
 * from Italian rheumatology visit text.
 *
 * Architecture:
 *  1. Split the full text into named sections at well-known headers
 *  2. Only extract archive exams from "completed" sections
 *     (ESAMI PRECEDENTI DI RILIEVO, RECA IN VISIONE, preamble)
 *  3. Lines inside "requested" sections (Ho richiesto, RICHIESTE, …)
 *     are excluded from the archive entirely
 *  4. Within each archive section each bullet/line is one record;
 *     continuation stops at any new exam keyword, section header, or
 *     a line that begins with a date (new exam entry)
 */

// ── Keyword → exam type mapping (more specific patterns first) ────────────────
const PATTERNS = [
  // Vascular imaging
  { re: /\bpet(?:\/tc|[-\s]tc)?\b/i,                                   examType: "petvas",       examLabel: "PET/TC" },
  { re: /\bangio[-\s]?(?:tc|ct)\b/i,                                    examType: "angio_ct",     examLabel: "AngioCT" },
  { re: /\bangio[-\s]?(?:rm|rmn|mri)\b/i,                              examType: "angio_mri",    examLabel: "AngioRM" },
  // Cardiac
  // ECD cardiaco / eco-color-doppler cardiaco before generic ecodoppler
  { re: /\b(?:ECD\s+cardiaco|eco[-\s]?color[-\s]?doppler\b(?:\s+\w+)*\s+cardiaco)\b/i, examType: "echo_cardiac", examLabel: "Ecocardiografia" },
  // "Ecocardio" (short form) AND "Ecocardiografia/gramma" (full form)
  { re: /\becocardi\w*\b/i,                                              examType: "echo_cardiac", examLabel: "Ecocardiografia" },
  { re: /\bholter[-\s]?ecg\b/i,                                         examType: "other",        examLabel: "Holter ECG" },
  { re: /\becg\b/i,                                                      examType: "other",        examLabel: "ECG" },
  // Pulmonary
  { re: /\bhrct\b/i,                                                     examType: "hrct",         examLabel: "HRCT" },
  { re: /\b(?:spirometr\w+|pfr|plethysmogr\w*)\b/i,                    examType: "pft",          examLabel: "Spirometria/PFR" },
  // MSK imaging
  { re: /\beco[-\s]?(?:doppler|dop)\b/i,                               examType: "ecodoppler",   examLabel: "Eco Doppler" },
  { re: /\beco[-\s]?(?:msk|muscolo[-\s]?scheletr\w*|articol\w*)\b/i,  examType: "echo_msk",     examLabel: "Eco MSK" },
  { re: /\b(?:rm|rmn|risonanza\s+magnetica)\b/i,                       examType: "mri",          examLabel: "RM" },
  { re: /\b(?:tc|tac|tomografia\s+computerizzata)\b(?!\s*[-\s]?(?:torace|polmon\w*))/i, examType: "ct", examLabel: "TC" },
  { re: /\b(?:rx|radiogr\w+)\b/i,                                       examType: "xray",         examLabel: "Radiografia" },
  { re: /\b(?:tc|tac)\b/i,                                              examType: "ct",           examLabel: "TC" },
  // Other
  { re: /\becograf\w+\b/i,                                              examType: "other",        examLabel: "Ecografia" },
  { re: /\bcapillaroscopi\w+\b/i,                                       examType: "capillaroscopy", examLabel: "Capillaroscopia" },
  { re: /\b(?:dexa|moc|densitometr\w+)\b/i,                            examType: "other",        examLabel: "Densitometria" },
  { re: /\b(?:emg|elettromiogr\w+)\b/i,                                examType: "other",        examLabel: "EMG" },
  { re: /\bscintigr\w+\b/i,                                             examType: "other",        examLabel: "Scintigrafia" },
];

const NATIVE_TYPE = {
  ecodoppler: "ecodoppler",
  petvas:     "petvas",
  angio_ct:   "angio_ct",
  angio_mri:  "angio_mri",
  echo_msk:   "echo_msk",
};

// ── Date patterns ─────────────────────────────────────────────────────────────
const DATE_IT         = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/;
const DATE_IT_SHORT   = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})\b/;
const DATE_ISO        = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const DATE_MONTH_YEAR = /\b(\d{1,2})[\/\-](\d{4})\b/;  // MM/YYYY or M/YYYY

// Matches a date at the very start of a line → new exam entry, stop continuation
const DATE_LINE_START_RE = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.](?:\d{2}|\d{4})|\d{1,2}[\/\-]\d{4})\b/;

// ── Section detection ─────────────────────────────────────────────────────────
/**
 * Matches a major structural header in a rheumatology letter.
 * Group 1 captures a canonical section name (used as key after .toUpperCase().trim()).
 * All alias variants for the same logical section must be listed here so that
 * the instrumental parser stops trying to extract exams once it enters them.
 */
// NOTE: (?=\W|$) replaces \b at the end because JavaScript's \b does not fire
// after non-ASCII characters like À (e.g. OBIETTIVITÀ would fail with \b).
// (?=\W|$) is equivalent to \b for the purpose of "end of word" detection here.
const MAJOR_SECTION_RE = /^(ESAMI\s+PREGRESSI|ESAMI\s+PRECEDENTI(?:\s+(?:DI\s+RILIEVO|SIGNIFICATIVI))?|ESAMI\s+DI\s+RILIEVO|ESAMI\s+STRUMENTALI\s+PREGRESSI|ACCERTAMENTI\s+(?:PRECEDENTI|PREGRESSI)|PER\s+RILEVANZA|STORICO\s+ESAMI|RECA\s+IN\s+VISIONE|PORTA\s+IN\s+VISIONE|IN\s+VISIONE|ACCERTAMENTI\s+IN\s+VISIONE|ESAMI\s+(?:PORTATI|RECATI)\s+IN\s+VISIONE|PORTA\s+IN\s+VISITA|ULTIMI\s+ESAMI|VISITA\s+(?:ODIERNA|AMBULATORIALE|DI\s+CONTROLLO)(?:\s+\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})?|VISITA\s+\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|ANAMNESI\s+INTERVALLARE(?:\s+DI\s+MALATTIA)?|AGGIORNAMENTO\s+CLINICO|RIVALUTAZIONE|CONTROLLO|ESAME\s+(?:OBIETTIVO(?:\s+REUMATOLOGICO)?|FISICO|REUMATOLOGICO)|OBIETTIVIT[AÀ]'?|OBIETTIVAMENTE|EO|CONCLUSIONI|IMPRESSIONE\s+DIAGNOSTICA|IN\s+TERAPIA|TERAPIA\s+(?:DOMICILIARE|IN\s+ATTO|IN\s+CORSO|CORRENTE)|ANAMNESI(?:\s+(?:INTERVALLARE|REUMATOLOGICA(?:\s+REMOTA)?|FISIOLOGICA|PATOLOGICA|FAMILIARE|FARMACOLOGICA))?|RACCORDO(?:\s+(?:REUMATOLOGICO|ANAMNESTIC\w*(?:\s+REUMATOLOGICO)?)?)?|STORIA\s+(?:CLINICA|REUMATOLOGICA)|DECORSO\s+CLINICO|EVOLUZIONE\s+CLINICA|INDICAZIONI|PIANO\s+(?:TERAPEUTICO|DIAGNOSTICO)|HO\s+RICHIESTO|RICHIESTE?|FARMACI\s+(?:IN\s+CORSO|ASSUNTI)|COMORBID[IÀA][TÀ]'?|COMORBIL[IÀA][TÀ]'?|PATOLOGIE\s+CONCOMITANTI|INTERVENTI\s+CHIRURGICI)(?=\W|$)/i;

/**
 * Sections where past exams are listed → go to the patient archive.
 * Keys are the canonical forms produced by hm[1].replace(/\s+/g," ").toUpperCase().trim().
 */
const ARCHIVE_SECTIONS = new Set([
  "__PREAMBLE__",
  // Original
  "ESAMI PRECEDENTI DI RILIEVO",
  "ESAMI PRECEDENTI",
  "ESAMI PREGRESSI",
  "ACCERTAMENTI PRECEDENTI",
  "PER RILEVANZA",
  // New aliases
  "ESAMI PRECEDENTI SIGNIFICATIVI",
  "ESAMI DI RILIEVO",
  "ESAMI STRUMENTALI PREGRESSI",
  "ACCERTAMENTI PREGRESSI",
  "STORICO ESAMI",
]);

/**
 * Sections where exams brought to the current visit are listed →
 * go to the visit's Esami/Imaging section (labs_imaging), NOT the archive.
 */
const VISIONE_SECTIONS = new Set([
  // Original
  "RECA IN VISIONE",
  "PORTA IN VISIONE",
  "IN VISIONE",
  // New aliases
  "ACCERTAMENTI IN VISIONE",
  "ESAMI PORTATI IN VISIONE",
  "ESAMI RECATI IN VISIONE",
  "PORTA IN VISITA",
  "ULTIMI ESAMI",
]);

/**
 * Esame Obiettivo sections → exams performed during the current visit
 * (capillaroscopy, clinical exam findings) go to visione destination.
 */
const EO_SECTIONS = new Set([
  "ESAME OBIETTIVO",
  "ESAME OBIETTIVO REUMATOLOGICO",
  "ESAME FISICO",
  "ESAME REUMATOLOGICO",
  "OBIETTIVITÀ",
  "OBIETTIVITA",
  "OBIETTIVAMENTE",
  "EO",
]);

/** Union: all sections from which we extract instrumental exams. */
const ALL_EXAM_SECTIONS = new Set([...ARCHIVE_SECTIONS, ...VISIONE_SECTIONS, ...EO_SECTIONS]);

// ── Instrument keyword at start of a line → signals a new exam record ────────
const INSTRUMENT_KEYWORD_START =
  /^(?:HRCT|spirometr\w*|PFR\b|ecocardi\w*|ECD\b|capillaroscop\w*|ecodoppler\w*|ecograf\w*|angio[-\s]?(?:tc|ct|rm|rmn)\w*|densitometr\w*|scintigr\w*|EMG\b|elettromiogr\w*|holter\w*|ECG\b|rx\b|radiogr\w*|RM\b|RMN\b|risonanza\w*|TC\b|TAC\b|tomografia\w*|PET\b|DEXA\b|MOC\b)/i;

// ── Date parser ───────────────────────────────────────────────────────────────
function parseDate(line) {
  const m = line.match(DATE_IT);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = line.match(DATE_ISO);
  if (iso) return iso[0];
  const ms = line.match(DATE_IT_SHORT);
  if (ms) {
    const [, d, mo, yy] = ms;
    const century = parseInt(yy, 10) < 50 ? "20" : "19";
    const y = `${century}${yy.padStart(2, "0")}`;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const mmy = line.match(DATE_MONTH_YEAR);
  if (mmy) {
    const [, mo, y] = mmy;
    return `${y}-${mo.padStart(2, "0")}-01`;
  }
  const yearM = line.match(/\b((?:19|20)\d{2})\b/);
  if (yearM) {
    const y = parseInt(yearM[1], 10);
    if (y >= 1990 && y <= new Date().getFullYear() + 1) return `${yearM[1]}-01-01`;
  }
  return null;
}

function extractPftStructuredValues(line) {
  const sv = {};
  const fvcM  = line.match(/\bFVC\s*[=:]?\s*(\d+(?:[.,]\d+)?)\s*%/i);
  if (fvcM)  sv.fvc_percent  = parseFloat(fvcM[1].replace(",", "."));
  const dlcoM = line.match(/\bDLCO\s*[=:]?\s*(\d+(?:[.,]\d+)?)\s*%/i);
  if (dlcoM) sv.dlco_percent = parseFloat(dlcoM[1].replace(",", "."));
  return Object.keys(sv).length ? sv : null;
}

function cleanLine(raw) {
  return raw.replace(/^[\s\-–•·]+/, "").trim();
}

/**
 * Split a line at instrument keyword boundaries for exam-list lines.
 *
 * Applied to lines of any length that have been pre-split at >, ; separators.
 * Rules:
 *  - Requires 2+ instrument keyword positions in the line.
 *  - Keeps every sub-segment that starts with INSTRUMENT_KEYWORD_START.
 *  - Safety guard: only performs the split if at least one segment has a
 *    recognisable date within 60 chars — this prevents splitting clinical
 *    prose ("HRCT buono, spirometria ridotta") that lives in exam sections.
 *  - If conditions not met returns [line] unchanged.
 */
function splitAtKeywords(line) {
  const KW_RE =
    /\b(?:HRCT|spirometr\w+|PFR\b|ecocardi\w+|ECD\b|capillaroscop\w+|ecodoppler\w*|ecograf\w*|angio[-\s]?(?:tc|ct|rm|rmn)\w*|densitometr\w+|scintigr\w+|EMG\b|elettromiogr\w+|holter\w*|ECG\b|rx\b|radiogr\w+|RM\b|RMN\b|risonanza\w+|TC\b|TAC\b|tomografia\w+|PET\b|DEXA\b|MOC\b)/gi;

  const positions = [];
  let m;
  while ((m = KW_RE.exec(line)) !== null) positions.push(m.index);
  if (positions.length < 2) return [line]; // 0 or 1 keyword — nothing to split

  const DATE_NEARBY =
    /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\/\-]\d{4}|(?:19|20)\d{2})\b/;

  const segs = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end   = i + 1 < positions.length ? positions[i + 1] : line.length;
    const seg   = line.slice(start, end).trim();
    if (!seg || seg.length <= 2) continue;
    if (INSTRUMENT_KEYWORD_START.test(seg)) segs.push(seg);
  }

  if (segs.length < 2) return [line];

  // Guard: only split when at least one segment has an identifiable date
  const hasDate = segs.some((s) => DATE_NEARBY.test(s.slice(0, 60)));
  return hasDate ? segs : [line];
}

/**
 * Splits a single very long line (>280 chars) at instrument keyword boundaries.
 * Only keeps segments that start with a keyword AND have a date within 80 chars.
 */
function segmentsFromLongLine(line) {
  const KW_RE =
    /\b(?:HRCT|spirometr\w+|PFR\b|ecocardi\w+|ECD\b|capillaroscop\w+|ecodoppler\w*|ecograf\w*|angio[-\s]?(?:tc|ct|rm|rmn)\w*|densitometr\w+|scintigr\w+|EMG\b|elettromiogr\w+|holter\w*|ECG\b|rx\b|radiogr\w+|RM\b|RMN\b|risonanza\w+|TC\b|TAC\b|tomografia\w+|PET\b|DEXA\b|MOC\b)|(?:esami\s+ematici\b|VISITA\s+(?:ODIERNA|AMBULATORIALE|DI\s+CONTROLLO)\b|ANAMNESI(?:\s+INTERVALLARE)?\b|ESAME\s+OBIETTIVO\b|RACCORDO(?:\s+ANAMNESTIC\w*)?\b|INDICAZIONI\b|HO\s+RICHIESTO\b|RECA\s+IN\s+VISIONE\b)/gi;

  const positions = [];
  let m;
  while ((m = KW_RE.exec(line)) !== null) positions.push(m.index);
  if (positions.length === 0) return [line];

  const DATE_NEARBY = /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\/\-]\d{4}|(?:19|20)\d{2})\b/;
  const segs = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end   = i + 1 < positions.length ? positions[i + 1] : line.length;
    const seg   = line.slice(start, end).trim();
    if (seg.length <= 3) continue;
    if (INSTRUMENT_KEYWORD_START.test(seg) && DATE_NEARBY.test(seg.slice(0, 80))) {
      segs.push(seg);
    }
  }
  return segs.length ? segs : [line];
}

/**
 * parseInstrumentalFindings(text)
 *
 * @param {string} text — raw visit text
 * @returns {Array} findings — only exams with a date from completed-exam sections
 */
export function parseInstrumentalFindings(text) {
  if (!text?.trim()) return [];

  const findings = [];
  const seen = new Set();

  // ─── Step 1: split into lines, expand multi-exam lines ────────────────────
  const rawLines = [];
  for (const raw of text.split(/\n+/)) {
    const cl = cleanLine(raw);
    if (!cl) continue;
    // Pre-split at explicit exam-list separators (>, ;) used in Italian letters
    // e.g. "HRCT 2024 > PFR 02/2026 > ECD cardiaco 01/2026 > Capillaroscopia"
    for (const part of cl.split(/\s*[>;]\s*/)) {
      const s = part.trim();
      if (!s) continue;
      if (s.length > 280) {
        // Very long lines: use section-aware splitter
        rawLines.push(...segmentsFromLongLine(s));
      } else {
        // Shorter lines: split at instrument keyword boundaries when multiple
        // keywords are present on the same line (e.g. "HRCT 2024 PFR 02/2026")
        rawLines.push(...splitAtKeywords(s));
      }
    }
  }

  // ─── Step 2: tag each line with its section context ────────────────────────
  let currentSection = "__PREAMBLE__";
  const taggedLines = rawLines.map((line) => {
    const hm = MAJOR_SECTION_RE.exec(line);
    if (hm) {
      // Normalise to a canonical key (upper, single spaces, no trailing apostrophe)
      currentSection = hm[1].replace(/\s+/g, " ").toUpperCase().trim().replace(/'+$/, "");
    }
    return { line, section: currentSection, isHeader: !!hm };
  });

  // ─── Step 3: parse exams only from archive sections ────────────────────────
  for (let li = 0; li < taggedLines.length; li++) {
    const { line, section, isHeader } = taggedLines[li];

    if (isHeader) continue;
    if (!ALL_EXAM_SECTIONS.has(section)) continue;
    if (seen.has(line)) continue;

    for (const pat of PATTERNS) {
      const match = line.match(pat.re);
      if (!match) continue;

      seen.add(line);

      const afterKeyword = line.slice(match.index + match[0].length);
      const colonIdx     = afterKeyword.indexOf(":");
      let territory      = "";
      let reportText     = "";

      if (colonIdx > -1) {
        territory  = afterKeyword
          .slice(0, colonIdx)
          .replace(DATE_IT, "").replace(DATE_IT_SHORT, "")
          .replace(DATE_ISO, "").replace(DATE_MONTH_YEAR, "")
          .replace(/\b(?:19|20)\d{2}\b/g, "")
          .trim();
        reportText = afterKeyword.slice(colonIdx + 1).trim();
      } else {
        territory = afterKeyword
          .replace(DATE_IT, "").replace(DATE_IT_SHORT, "")
          .replace(DATE_ISO, "").replace(DATE_MONTH_YEAR, "")
          .replace(/\b(?:19|20)\d{2}\b/g, "")
          .trim();
      }

      // ── Continuation: only within the same section ──────────────────────
      // Stop at: section change, section header, new exam keyword, date-start,
      // or any of the explicit stop patterns.

      // Matches a line that looks like a series of blood-test values:
      // e.g. "PCR 15 mg/L, VES 45 mm/h" or "Hb 12.3 g/dL PLT 189000"
      const LAB_VALUE_LINE_RE =
        /(?:\b(?:PCR|CRP|VES|ESR|Hb|Hgb|WBC|RBC|PLT|INR|PTT|ferritina|creatinina|ALT|AST|GGT|ALP|LDH|TSH|complemento|C3\b|C4\b|ematocrito|linfociti|neutrofili|MCH|MCV|MCHC|fibrinogeno|procalcitonina|troponina|BNP|NT-proBNP|D-dimero|proteine\s+totali|albumina|bilirubina|uricemia|glicemia|colesterol\w*|trigliceridi)\b.{0,50}\d|\b\d{1,3}(?:[.,]\d{1,2})?\s*(?:mg\/[dDlL]|g\/[lL]|U\/[lL]|UI\/[lL]|mm\/h|mg\/L|mEq\/L|mmol\/L|nmol\/L|%|fL|pg)\b.{0,80}\d)/i;

      let sourceText = line;
      let j = li + 1;
      while (j < taggedLines.length) {
        const next = taggedLines[j];
        if (next.section !== section)            break; // entered new section
        if (next.isHeader)                        break; // section header line
        const cont = next.line.trim();
        if (!cont)                                break;
        if (INSTRUMENT_KEYWORD_START.test(cont))  break; // new exam starts
        if (DATE_LINE_START_RE.test(cont))        break; // new dated entry
        // Also stop at "esami ematici" (lab block), "Ho richiesto", etc.
        if (/^(?:esami\s+ematici|esami\s+(?:del\s+)?sangue|ho\s+richiesto|richieste?)\b/i.test(cont)) break;
        // Stop at lines that look like blood-test value rows (prevent lab values
        // from being absorbed into an instrumental exam's reportText)
        if (LAB_VALUE_LINE_RE.test(cont)) break;
        seen.add(next.line);
        sourceText += " " + cont;
        reportText  += (reportText ? " " : "") + cont;
        j++;
      }
      li = j - 1;

      const date      = parseDate(line);
      const indexType = NATIVE_TYPE[pat.examType] || "imaging_report";

      const summaryParts = [pat.examLabel];
      if (territory)  summaryParts.push(`(${territory})`);
      if (date)       summaryParts.push(date);
      if (reportText) {
        const short = reportText.length > 120
          ? reportText.slice(0, 117) + "…"
          : reportText;
        summaryParts.push(`: ${short}`);
      }
      const summary = summaryParts.join(" ");

      const structured_values =
        pat.examType === "pft" ? extractPftStructuredValues(line) : null;

      findings.push({
        examType:          pat.examType,
        examLabel:         pat.examLabel,
        territory:         territory || null,
        reportText:        reportText || null,
        date,
        sourceText,
        indexType,
        summary,
        structured_values,
        destination:       (VISIONE_SECTIONS.has(section) || EO_SECTIONS.has(section)) ? "visione" : "archive",
      });

      break; // first matching pattern wins per line
    }
  }

  return findings;
}
