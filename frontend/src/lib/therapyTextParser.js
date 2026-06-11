/**
 * Parses a free-text fragment (e.g. "Celebrex 200 mg 1 cp al giorno")
 * into structured therapy fields for therapiesApi.create().
 *
 * Returns { drug_name, category, dose, frequency, route, raw_text, parsed }
 * If no known drug is matched, drug_name = first 1-3 words and parsed = false.
 */

import { DRUG_ALIAS_MAP as DRUG_MAP } from "./drugs";

const FREQ_PATTERNS = [
  [/\b(?:2|due)\s*(?:volte?|x)\s*(?:al\s+)?(?:giorno|die)\b/i,                       "2 volte/die"],
  [/\b(?:3|tre)\s*(?:volte?|x)\s*(?:al\s+)?(?:giorno|die)\b/i,                       "3 volte/die"],
  [/\b1\s*(?:volt[ae]|cp?r?|compressa|tab)?\s*[/x]\s*(?:al\s+)?(?:giorno|die|qd)\b/i, "Giornaliera"],
  [/\b(?:1\s*(?:cp?r?|compressa?|tab(?:letta)?|fiale?|iniezione?)\s+)?(?:al\s+)?(?:giorno|die|qd)\b/i, "Giornaliera"],
  [/\bonce\s+daily\b|\bsid\b|\bonce\s+a\s+day\b/i,                                    "Giornaliera"],
  [/\b1\s*volta?\s*(?:a|alla?)\s*settimana\b|\bonce\s+weekly\b/i,                     "Settimanale"],
  [/\bsettimanale\b|\bweekly\b|\b1\s*[/x]\s*settimana\b/i,                            "Settimanale"],
  [/\b(?:1|una?)\s*volta?\s*(?:al\s+)?mese\b|\bmensile\b|\bmonthly\b/i,              "Mensile"],
  [/\bogni\s+2\s+settimane?\b|\bevery\s+2\s+weeks?\b|\bbisettimanale\b/i,             "Ogni 2 settimane"],
  [/\bogni\s+4\s+settimane?\b|\bevery\s+4\s+weeks?\b/i,                               "Ogni 4 settimane"],
  [/\b(?:al\s+bisogno|prn|se\s+necessario|on\s+demand)\b/i,                           "Al bisogno"],
];

const ROUTE_PATTERNS = [
  [/\bs\.?c\.?\b|\bsottocute\b|\bsubcutane[ao]\b/i,                                   "s.c."],
  [/\bi\.?m\.?\b|\bintramuscolo?\b|\bintramuscolare\b/i,                               "i.m."],
  [/\bi\.?v\.?\b|\bendovena\b|\bintravenos[ao]\b/i,                                    "e.v."],
  [/\b(?:per\s+os|per\s+bocca|orale|oralmente|os)\b/i,                                "orale"],
  [/\btopic[oa]\b|\bcrema\b|\bunguento\b|\bgel\b|\bpatch\b|\bcerotto\b/i,             "topico"],
  [/\binalatori[oa]\b|\bspray\b|\baerosol\b/i,                                         "inalatorio"],
];

const DOSE_RE = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|g\b|UI|IU|mL?|µg|mg\/kg|mg\/m²)/i;

// ── Italian month abbreviations for date parsing ─────────────────────────────
const MONTHS_IT = {
  gen: "01", genn: "01", gennaio: "01",
  feb: "02", febbr: "02", febbraio: "02",
  mar: "03", marz: "03", marzo: "03",
  apr: "04", aprile: "04",
  mag: "05", maggio: "05",
  giu: "06", giugno: "06",
  lug: "07", luglio: "07",
  ago: "08", agosto: "08",
  set: "09", sett: "09", settembre: "09",
  ott: "10", ottobre: "10",
  nov: "11", novembre: "11",
  dic: "12", dicembre: "12",
};

function parseItalianDateStr(str) {
  if (!str) return "";
  const s = str.trim();
  let m;
  m = s.match(/^(\d{1,2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  m = s.match(/^([a-z]+)\.?\s+(\d{4})$/i);
  if (m) {
    const key = m[1].toLowerCase();
    const mon = MONTHS_IT[key] || MONTHS_IT[key.slice(0, 3)];
    if (mon) return `${m[2]}-${mon}-01`;
  }
  m = s.match(/^(20\d{2})$/);
  if (m) return `${m[1]}-01-01`;
  return "";
}

const MONTH_NAMES_RE =
  "(?:gen(?:n(?:aio)?)?|feb(?:b(?:raio)?)?|mar(?:zo?)?|apr(?:ile)?|mag(?:gio)?|giu(?:gno)?|lug(?:lio)?|ago(?:sto)?|set(?:t(?:embre)?)?|ott(?:obre)?|nov(?:embre)?|dic(?:embre)?)";

function extractFirstDate(text, prefixRe) {
  const datePatterns = [
    /\d{1,2}\/\d{2}\/\d{4}/,
    /\d{1,2}\/\d{4}/,
    new RegExp(MONTH_NAMES_RE + "\\.?\\s+20\\d{2}", "i"),
    /20\d{2}/,
  ];
  for (const datePat of datePatterns) {
    const combined = new RegExp(
      prefixRe.source + "\\s*(" + datePat.source + ")",
      "i"
    );
    const m = text.match(combined);
    if (m) return parseItalianDateStr(m[1]);
  }
  return "";
}

/**
 * Detects whether the selected text describes:
 *   "active"             — drug currently being taken
 *   "today_modification" — new decision made today
 *   "discontinued"       — past/stopped therapy
 *   "unknown"            — cannot determine
 */
function detectStatusHint(text) {
  const lc = text.toLowerCase();
  if (
    /inizia\b|avvia\b|si\s+prescrive\b|da\s+oggi\b|si\s+introduce\b|si\s+aggiunge\b|si\s+imposta\b|avviamo\b|iniziamo\b|prescriviamo\b|introduciamo\b/.test(lc)
  ) return "today_modification";
  if (
    /\bstop\b|sospen[sd]|interrott|ha\s+assunto|assumeva|ha\s+preso|assumendo\s+fino|pregresso|ex\s+terapia|già\s+assunt|in\s+passato|assunto\s+dal/.test(lc)
  ) return "discontinued";
  if (
    /attualmente\s+assume|in\s+corso\b|è\s+in\s+terapia|sta\s+assumendo|continua\s+con|prosegue\s+con/.test(lc)
  ) return "active";
  return "unknown";
}

function extractDiscontinuationReason(text) {
  const m = text.match(
    /(?:sospeso|sospesa|interrott[oa]|stop)\s+(?:per|a\s+causa\s+di)\s+([^.,;]{3,80})/i
  );
  if (m) return m[1].trim();
  const m2 = text.match(
    /(?:per\s+)?(intolleranza|effetti\s+collaterali|tossicità|inefficacia|allergia|costo|complicanza)\b/i
  );
  if (m2) return m2[0].replace(/^per\s+/i, "");
  return "";
}

/**
 * parseTherapyFromText — full parser for the QuickTherapyModal.
 *
 * Returns:
 *   drug_name, category, dose, frequency, route,
 *   start_date (ISO), end_date (ISO),
 *   status_hint: "active" | "today_modification" | "discontinued" | "unknown"
 *   discontinuation_reason,
 *   source_text
 */
export function parseTherapyFromText(rawText) {
  const base = parseTherapyText(rawText);

  const start_date =
    extractFirstDate(rawText, /dal?\s+(?:mese\s+di\s+)?/) ||
    extractFirstDate(rawText, /(?:iniziata?|avviata?|introdotta?)\s+(?:in\s+data\s+)?/);

  const end_date =
    extractFirstDate(rawText, /(?:fino\s+a[l]?\s+|al\s+)/) ||
    extractFirstDate(rawText, /(?:sospeso|sospesa|interrott[oa]|stop)\s+(?:in\s+data\s+)?(?:il\s+)?/);

  return {
    drug_name:              base.drug_name  || "",
    category:               base.category   || "other",
    dose:                   base.dose       || "",
    frequency:              base.frequency  || "",
    route:                  base.route      || "",
    start_date,
    end_date,
    status_hint:            detectStatusHint(rawText),
    discontinuation_reason: extractDiscontinuationReason(rawText),
    source_text:            rawText,
    parsed:                 base.parsed,
  };
}

export function parseTherapyText(rawText) {
  const text  = rawText.trim();
  const lower = text.toLowerCase();

  // 1 — find drug (longest match wins to avoid "calcio" matching before "calcio carbonato")
  let matchedKey = null;
  let entry      = null;
  for (const key of Object.keys(DRUG_MAP)) {
    const cs = DRUG_MAP[key].caseSensitive === true;
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, cs ? "" : "i");
    if (!re.test(cs ? text : lower)) continue;
    if (!matchedKey || key.length > matchedKey.length) {
      matchedKey = key;
      entry      = DRUG_MAP[key];
    }
  }

  // 2 — dose
  const doseM = text.match(DOSE_RE);
  const dose  = doseM ? `${doseM[1].replace(",", ".")} ${doseM[2]}` : null;

  // 3 — frequency
  let frequency = null;
  for (const [re, label] of FREQ_PATTERNS) {
    if (re.test(text)) { frequency = label; break; }
  }

  // 4 — route
  let route = null;
  for (const [re, label] of ROUTE_PATTERNS) {
    if (re.test(text)) { route = label; break; }
  }

  if (entry) {
    return {
      drug_name: entry.canonical,
      category:  entry.category,
      dose,
      frequency,
      route,
      raw_text: text,
      parsed: true,
    };
  }

  // Fallback — use first 1-3 non-numeric words as drug name
  const words = text.split(/\s+/).filter(w => !/^\d/.test(w)).slice(0, 3).join(" ");
  return {
    drug_name: words || text.slice(0, 40),
    category:  "other",
    dose,
    frequency,
    route,
    raw_text: text,
    parsed: false,
  };
}
