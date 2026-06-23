/**
 * clinimetryTextParser.js
 *
 * Extracts already-calculated clinimetric scores from free clinical text.
 *
 * Features:
 *   1. LOCAL_PATTERNS — configurable compound patterns (e.g. CDAI/SDAI x/y).
 *      Add new compound abbreviations here without touching core logic.
 *   2. Comparative stripping — removes parenthetical "era / precedente / baseline / vs"
 *      values before parsing so they don't pollute the current-visit results.
 *   3. Arrow/trend collapse — "DAS28 3.5-->2.8-->2.1" → imports only 2.1.
 *
 * Returns:
 *   {
 *     items:        [{ index_type, label, score, raw_match, ambiguous }],
 *     comparatives: [{ raw_text }]   // stripped comparative snippets
 *   }
 */

// ── Score number pattern ─────────────────────────────────────────────────────
const NUM = "(?:[=:\\s]\\s*|\\s+)(\\d{1,3}(?:[.,]\\d{1,2})?)";
const NUM_OPT_UNIT = NUM + "(?:/\\d+|\\s*%)?";

// ── Standard single-value patterns ───────────────────────────────────────────
// Order matters: more specific (with subtype) MUST come before ambiguous ones.
const PATTERNS = [
  // DAS28 variants
  { re: new RegExp("DAS28\\s*[-–]?\\s*(?:PCR|CRP|C-?reactive)" + NUM, "i"), index_type: "das28_crp", label: "DAS28-CRP" },
  { re: new RegExp("DAS28\\s*[-–]?\\s*(?:VES|ESR|eritro)" + NUM, "i"),      index_type: "das28_esr", label: "DAS28-ESR" },
  { re: new RegExp("DAS28\\s*\\(\\s*(?:PCR|CRP)\\s*\\)" + NUM, "i"),        index_type: "das28_crp", label: "DAS28-CRP" },
  { re: new RegExp("DAS28\\s*\\(\\s*(?:VES|ESR)\\s*\\)" + NUM, "i"),        index_type: "das28_esr", label: "DAS28-ESR" },
  { re: new RegExp("\\bDAS28\\b" + NUM, "i"),                                index_type: "das28_crp", label: "DAS28-CRP", ambiguous: true },

  // RA composite
  { re: new RegExp("\\bCDAI\\b" + NUM, "i"),    index_type: "cdai",      label: "CDAI" },
  { re: new RegExp("\\bSDAI\\b" + NUM, "i"),    index_type: "sdai",      label: "SDAI" },
  { re: new RegExp("\\bHAQ(?:-DI)?\\b" + NUM, "i"), index_type: "haq",  label: "HAQ" },

  // SpA
  { re: new RegExp("\\bBASDAI\\b" + NUM, "i"),                           index_type: "basdai",    label: "BASDAI" },
  { re: new RegExp("ASDAS\\s*[-–]?\\s*(?:PCR|CRP)" + NUM, "i"),         index_type: "asdas_crp", label: "ASDAS-CRP" },
  { re: new RegExp("\\bASDAS\\b" + NUM, "i"),                            index_type: "asdas_crp", label: "ASDAS-CRP", ambiguous: true },
  { re: new RegExp("\\bBASFI\\b" + NUM, "i"),                            index_type: "basfi",     label: "BASFI" },
  { re: new RegExp("\\bBASMI\\b" + NUM, "i"),                            index_type: "basmi",     label: "BASMI" },

  // PsA
  { re: new RegExp("\\bDAPSA\\b" + NUM, "i"),                            index_type: "dapsa",     label: "DAPSA" },
  { re: new RegExp("\\bPASI\\b" + NUM_OPT_UNIT, "i"),                    index_type: "pasi",      label: "PASI" },
  { re: new RegExp("\\bLEI\\b" + NUM, "i"),                              index_type: "lei",       label: "LEI" },

  // Sjögren
  { re: new RegExp("\\bESSDAI\\b" + NUM, "i"),                           index_type: "essdai",    label: "ESSDAI" },
  { re: new RegExp("\\bESSPRI\\b" + NUM, "i"),                           index_type: "esspri",    label: "ESSPRI" },

  // LES
  { re: new RegExp("SLEDAI(?:-2K)?" + NUM, "i"),                         index_type: "sledai",    label: "SLEDAI-2K" },

  // Vasculiti
  { re: new RegExp("BVAS(?:\\s*v[23]?)?" + NUM, "i"),                    index_type: "bvas",      label: "BVAS v3" },
  { re: new RegExp("\\bPETVAS\\b" + NUM, "i"),                           index_type: "petvas",    label: "PETVAS" },

  // Miositi
  { re: new RegExp("MMT[-–]?8?" + NUM, "i"),                             index_type: "mmt8",      label: "MMT-8" },

  // SSc
  { re: new RegExp("\\bmRSS\\b" + NUM, "i"),                             index_type: "mrss",      label: "mRSS" },

  // Fibromialgia
  { re: new RegExp("\\bFIQR\\b" + NUM, "i"),                             index_type: "fiqr",      label: "FIQR" },

  // Generic VAS
  { re: new RegExp("(?:VAS|EVA)\\s+(?:dolore|pain|globale|global)?" + NUM, "i"), index_type: "haq", label: "VAS", ambiguous: true },

  // Joint counts (TJC/SJC) — integer only; used as override/fallback on the
  // computed counts from the joint-exam map (parseJointExam).
  { re: new RegExp("\\bTJC\\b\\s*(\\d+)", "i"), index_type: "tjc", label: "TJC" },
  { re: new RegExp("\\bSJC\\b\\s*(\\d+)", "i"), index_type: "sjc", label: "SJC" },
];

// ── LOCAL_PATTERNS — compound / abbreviation patterns ────────────────────────
// Add entries here to support new compact notations without changing core logic.
// Each entry:
//   re       — RegExp with one capture group per index
//   indices  — [{ index_type, label, group }] where group is the capture group number (1-based)
//   ambiguous? — optional flag
const LOCAL_PATTERNS = [
  {
    // CDAI/SDAI x/y  or  CDAI-SDAI x/y
    re: /\bCDAI\s*[\/–-]\s*SDAI\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*[\/–-]\s*(\d{1,3}(?:[.,]\d{1,2})?)\b/i,
    indices: [
      { index_type: "cdai", label: "CDAI", group: 1 },
      { index_type: "sdai", label: "SDAI", group: 2 },
    ],
  },
  {
    // SDAI/CDAI x/y  (reversed order)
    re: /\bSDAI\s*[\/–-]\s*CDAI\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*[\/–-]\s*(\d{1,3}(?:[.,]\d{1,2})?)\b/i,
    indices: [
      { index_type: "sdai", label: "SDAI", group: 1 },
      { index_type: "cdai", label: "CDAI", group: 2 },
    ],
  },
  {
    // DAS28-CRP/ESR x/y  or  DAS28-PCR/VES x/y
    re: /\bDAS28\s*[-–]?\s*(?:PCR|CRP)\s*[\/–-]\s*(?:VES|ESR)\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*[\/–-]\s*(\d{1,3}(?:[.,]\d{1,2})?)\b/i,
    indices: [
      { index_type: "das28_crp", label: "DAS28-CRP", group: 1 },
      { index_type: "das28_esr", label: "DAS28-ESR", group: 2 },
    ],
  },
  {
    // DAS28-ESR/CRP x/y  (reversed)
    re: /\bDAS28\s*[-–]?\s*(?:VES|ESR)\s*[\/–-]\s*(?:PCR|CRP)\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*[\/–-]\s*(\d{1,3}(?:[.,]\d{1,2})?)\b/i,
    indices: [
      { index_type: "das28_esr", label: "DAS28-ESR", group: 1 },
      { index_type: "das28_crp", label: "DAS28-CRP", group: 2 },
    ],
  },
  {
    // ESSDAI/ESSPRI x/y
    re: /\bESSDAI\s*[\/–-]\s*ESSPRI\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*[\/–-]\s*(\d{1,3}(?:[.,]\d{1,2})?)\b/i,
    indices: [
      { index_type: "essdai", label: "ESSDAI", group: 1 },
      { index_type: "esspri", label: "ESSPRI", group: 2 },
    ],
  },
  {
    // BASFI/BASDAI x/y
    re: /\bBASFI\s*[\/–-]\s*BASDAI\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*[\/–-]\s*(\d{1,3}(?:[.,]\d{1,2})?)\b/i,
    indices: [
      { index_type: "basfi", label: "BASFI", group: 1 },
      { index_type: "basdai", label: "BASDAI", group: 2 },
    ],
  },
  {
    // BASDAI/BASFI x/y
    re: /\bBASD?AI\s*[\/–-]\s*BASFI\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*[\/–-]\s*(\d{1,3}(?:[.,]\d{1,2})?)\b/i,
    indices: [
      { index_type: "basdai", label: "BASDAI", group: 1 },
      { index_type: "basfi",  label: "BASFI",  group: 2 },
    ],
  },
];

// ── 1. Collapse arrow/trend sequences ────────────────────────────────────────
// "DAS28 3.5-->2.8-->2.1" → "DAS28 2.1"
// Supported arrows: -> --> → ⇒ --
const ARROW_CHARS = String.raw`(?:-->?|→|⇒|--)`;
const TREND_NUM   = String.raw`\d+(?:[.,]\d+)?`;
const INDEX_NAMES_TREND = [
  "DAS28(?:[-\\s]?(?:PCR|CRP|VES|ESR|\\([^)]+\\)))?",
  "CDAI","SDAI","BASDAI",
  "ASDAS(?:[-\\s]?(?:PCR|CRP))?",
  "DAPSA","PASI","SLEDAI(?:-2K)?","HAQ(?:-DI)?",
  "BVAS(?:\\s*v[23]?)?","ESSDAI","ESSPRI","FIQR",
  "mRSS","BASFI","BASMI","MMT[-–]?8?","PETVAS","LEI"
].join("|");

const TREND_RE = new RegExp(
  `(\\b(?:${INDEX_NAMES_TREND}))([  \\t]+)(${TREND_NUM}(?:[  \\t]*${ARROW_CHARS}[  \\t]*${TREND_NUM})+)`,
  "gi"
);

function collapseArrows(text) {
  return text.replace(TREND_RE, (_match, indexName, space, numSeq) => {
    const nums = numSeq.match(/\d+(?:[.,]\d+)?/g);
    if (!nums || nums.length < 2) return _match;
    return `${indexName}${space}${nums[nums.length - 1]}`;
  });
}

// ── 2. Strip comparative parentheticals ──────────────────────────────────────
// Removes "(era 25/26)", "(precedente 3.2)", "(baseline 4)", etc.
// Returns { cleanedText, comparativeSnippets }
const COMPARATIVE_INTRO = String.raw`(?:era|precedente|prima|pre[-\s]?terapia|baseline|da\s+\d|vs\.?)`;
const COMPARATIVE_RE = new RegExp(
  `\\([\\s]*(?:${COMPARATIVE_INTRO})[^)]{0,120}\\)`,
  "gi"
);

function stripComparatives(text) {
  const snippets = [];
  const cleaned = text.replace(COMPARATIVE_RE, (match) => {
    snippets.push({ raw_text: match.trim() });
    return " ";
  });
  return { cleanedText: cleaned, comparativeSnippets: snippets };
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * parseClinimetryFromText(rawText)
 *
 * Returns { items, comparatives }
 *   items        — current-visit scores, ready to import (selected by default)
 *   comparatives — stripped historical snippets (not imported, shown as info)
 */
export function parseClinimetryFromText(rawText) {
  if (!rawText?.trim()) return { items: [], comparatives: [] };

  // Step 1 — strip comparative parentheticals
  const { cleanedText, comparativeSnippets } = stripComparatives(rawText);

  // Step 2 — collapse arrow sequences (keep last value only)
  let text = collapseArrows(cleanedText);

  const seen    = new Set();
  const items   = [];

  // Step 3 — LOCAL_PATTERNS (compound / abbreviation)
  for (const lp of LOCAL_PATTERNS) {
    const m = text.match(lp.re);
    if (!m) continue;

    const raw = m[0].trim();
    const toAdd = [];
    let ok = true;

    for (const idx of lp.indices) {
      if (seen.has(idx.index_type)) { ok = false; break; }
      const scoreStr = (m[idx.group] || "").replace(",", ".");
      const score    = parseFloat(scoreStr);
      if (isNaN(score)) { ok = false; break; }
      toAdd.push({
        index_type: idx.index_type,
        label:      idx.label,
        score:      Math.round(score * 100) / 100,
        raw_match:  raw,
        ambiguous:  lp.ambiguous || false,
      });
    }

    if (ok) {
      for (const item of toAdd) {
        seen.add(item.index_type);
        items.push(item);
      }
      // Blank out the matched span so PATTERNS don't double-match
      text = text.slice(0, m.index) + " ".repeat(m[0].length) + text.slice(m.index + m[0].length);
    }
  }

  // Step 4 — standard PATTERNS (single-value)
  for (const pat of PATTERNS) {
    const m = text.match(pat.re);
    if (!m) continue;

    const raw      = m[0].trim();
    const scoreStr = (m[1] || "").replace(",", ".");
    const score    = parseFloat(scoreStr);
    if (isNaN(score)) continue;
    if (seen.has(pat.index_type)) continue;

    seen.add(pat.index_type);
    items.push({
      index_type: pat.index_type,
      label:      pat.label,
      score:      Math.round(score * 100) / 100,
      raw_match:  raw,
      ambiguous:  pat.ambiguous || false,
    });
  }

  return { items, comparatives: comparativeSnippets };
}

// ── All available index types for manual selection dropdown ──────────────────
export const IMPORTABLE_INDICES = [
  { value: "das28_crp",  label: "DAS28-CRP",    disease: "AR" },
  { value: "das28_esr",  label: "DAS28-ESR",    disease: "AR" },
  { value: "cdai",       label: "CDAI",          disease: "AR" },
  { value: "sdai",       label: "SDAI",          disease: "AR" },
  { value: "haq",        label: "HAQ",           disease: "AR / QoL" },
  { value: "basdai",     label: "BASDAI",        disease: "SpA" },
  { value: "asdas_crp",  label: "ASDAS-CRP",    disease: "SpA" },
  { value: "basfi",      label: "BASFI",         disease: "SpA" },
  { value: "basmi",      label: "BASMI",         disease: "SpA" },
  { value: "dapsa",      label: "DAPSA",         disease: "AP" },
  { value: "pasi",       label: "PASI",          disease: "AP / Psoriasi" },
  { value: "lei",        label: "LEI",           disease: "SpA / AP" },
  { value: "essdai",     label: "ESSDAI",        disease: "Sjögren" },
  { value: "esspri",     label: "ESSPRI",        disease: "Sjögren" },
  { value: "sledai",     label: "SLEDAI-2K",     disease: "LES" },
  { value: "bvas",       label: "BVAS v3",       disease: "Vasculiti" },
  { value: "petvas",     label: "PETVAS",        disease: "LVV / GCA" },
  { value: "mmt8",       label: "MMT-8",         disease: "Miositi" },
  { value: "mrss",       label: "mRSS",          disease: "SSc" },
  { value: "fiqr",       label: "FIQR",          disease: "Fibromialgia" },
];
