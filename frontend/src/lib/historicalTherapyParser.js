import { DRUG_ALIAS_MAP } from "./drugs";

const YEAR_RANGE_RE = /\b((19|20)\d{2})\s*[-–al]+\s*((19|20)\d{2})\b/;
const YEAR_SINGLE_RE = /\b((19|20)\d{2})\b/;
const APPROX_RE = /\b(circa|all'?incirca|intorno|verso|pressappoco|ca\.?|dal?(?:\s+\d+)?)\b/i;
const DURATION_RE = /\b(?:per\s+)?(\d+)\s+(ann[io]|mes[ei]|settiman[ae])/i;

const DISCONTINUATION_REASONS_RE = /\b(?:per\s+)?(?:inefficacia\s+(?:secondaria|primaria)|perdita\s+d[i']\s+efficacia|intolleranza\s+(?:gastro\s*intestinale|GI)|intolleranz[ae]|epatotossicit[àa]|tossicit[àa]\s+epatica|rialzo\s+(?:delle?\s+)?transaminasi|transaminasi\s+elevate|reazion[ei]\s+cutane[ae]|reazion[ei]\s+avvers[ae]|effetti?\s+collateral[ei]|disturbi?\s+gastrointestinal[ei]|eruzione\s+cutanea|herpes\s+zoster|scarsa\s+aderenza|preferenza\s+(?:del\s+)?paziente|decision[ei]\s+(?:del\s+)?paziente|inefficac[ei]a|tossicit[àa]|miopatia|citopenia|leucopenia|neutropenia|piastrinopenia|diarrea|nausea|vomito|gastralgia|alopecia|rash|infezione|gravidanza|remission[ei]|guarigion[ei]|rifiuto|costo|switch|sospension[ei])\b/i;
const DISC_KEYWORD_RE = /\b(sospeso|sospesa|interrotto|interrotta|discontinuato|discontinuata|cessato|cessata|abbandonato|abbandonata|smesso|smessa)\b/i;
const RESUMPTION_RE = /\b(ripresa|ripreso|reintroduzione|reinizio|reintrodotto|riavviato|riavviata|ricominciato|ricominciata|proseguimento|continuazione|reintrodotta)\b/i;
const NEL_YEAR_RE = /\bnel\s+((19|20)\d{2})\b/i;
const DAL_YEAR_RE = /\bdal?\s+((19|20)\d{2})\b/i;

const INDICATION_RE = /\b(AR|artrite\s+reumatoide|PsA|artrite\s+psoriasica|SpA|spondilite|SA|LES|lupus|SSc|sclerosi\s+sistemica|Sjogren|sj[öo]gren|PMR|polimialgia|GCA|vasculite|miosite|gotta|osteoporosi)\b/i;

function normKey(str) {
  return str.toLowerCase().trim().replace(/\s+/g, " ");
}

// Sorted longest-first for word-level pass 2 (min alias length 5 to avoid noise)
const DRUG_ALIAS_SORTED = Object.entries(DRUG_ALIAS_MAP)
  .filter(([alias]) => alias.length >= 5)
  .sort((a, b) => b[0].length - a[0].length);

function lookupDrug(token) {
  const clean = normKey(token.replace(/\d+/g, "").replace(/[^a-zA-ZàèéìòùÀÈÉÌÒÙ\s\-']/g, "").trim());
  if (!clean || clean.length < 2) return null;

  // Pass 1: exact key or prefix match (drug name at start/end of phrase)
  const entry = DRUG_ALIAS_MAP[clean];
  if (entry) return { alias: clean, ...entry, _byInclusion: false };
  for (const [alias, info] of Object.entries(DRUG_ALIAS_MAP)) {
    if (clean.startsWith(alias) || alias.startsWith(clean)) {
      return { alias, ...info, _byInclusion: false };
    }
  }

  // Pass 2: word-level match — drug name embedded in longer phrase
  // e.g. "successiva ripresa del metotrexato nel 2018"
  const words = new Set(clean.split(/\s+/));
  for (const [alias, info] of DRUG_ALIAS_SORTED) {
    if (words.has(alias)) {
      return { alias, ...info, _byInclusion: true };
    }
  }

  return null;
}

function extractDose(token) {
  const m = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|g|ml|UI)?/i.exec(token);
  if (!m) return null;
  return `${m[1]} ${(m[2] || "mg").toLowerCase()}`;
}

function extractDates(sentence) {
  const approx = APPROX_RE.test(sentence);

  const rangeMatch = YEAR_RANGE_RE.exec(sentence);
  if (rangeMatch) {
    return { start_date: rangeMatch[1], end_date: rangeMatch[3], date_approximate: approx };
  }

  const nelMatch = NEL_YEAR_RE.exec(sentence);
  if (nelMatch && DISC_KEYWORD_RE.test(sentence)) {
    return { start_date: null, end_date: nelMatch[1], date_approximate: approx };
  }

  const dalMatch = DAL_YEAR_RE.exec(sentence);
  if (dalMatch) {
    return { start_date: dalMatch[1], end_date: null, date_approximate: approx };
  }

  const singleMatch = YEAR_SINGLE_RE.exec(sentence);
  if (singleMatch) {
    return { start_date: singleMatch[1], end_date: null, date_approximate: approx };
  }

  if (DURATION_RE.test(sentence)) {
    return { start_date: null, end_date: null, date_approximate: true };
  }
  return { start_date: null, end_date: null, date_approximate: false };
}

function extractDiscontinuationReason(sentence) {
  const m = DISCONTINUATION_REASONS_RE.exec(sentence);
  return m ? m[0].replace(/^per\s+/i, "").trim() : null;
}

function extractIndication(sentence) {
  const m = INDICATION_RE.exec(sentence);
  if (!m) return null;
  const raw = m[0].toLowerCase();
  if (raw === "ar" || raw.startsWith("artrite reum")) return "AR";
  if (raw === "psa" || raw.startsWith("artrite psoriasica")) return "PsA";
  if (raw === "spa" || raw.startsWith("spondilite") || raw === "sa") return "axSpA";
  if (raw === "les" || raw.startsWith("lupus")) return "SLE";
  if (raw === "ssc" || raw.startsWith("sclerosi sistemica")) return "SSc";
  if (raw.startsWith("sj")) return "Sjogren";
  if (raw === "pmr" || raw.startsWith("polimialgia")) return "PMR";
  if (raw === "gca" || raw.startsWith("vasculite")) return "GCA";
  if (raw.startsWith("miosite")) return "Myositis";
  if (raw.startsWith("gotta")) return "Gout";
  if (raw.startsWith("osteoporosi")) return "osteoporosis";
  return m[0];
}

/**
 * Parse free-text "Terapie pregresse rilevanti" into chip items for review.
 * Returns array of { canonical, drug_name, category, therapy_type, relevance,
 *   dose, start_date, end_date, date_approximate, discontinuation_reason,
 *   indication, event_type_override, status, source, _recognized, raw }.
 */
export function parseHistoricalTherapies(text) {
  if (!text || !text.trim()) return [];

  const sentences = text
    .split(/(?<=[.;!\n])\s*|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);

  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set();
  const items = [];

  for (const sentence of sentences) {
    const tokens = sentence.split(/[,]+/).map((t) => t.trim());
    for (const token of tokens) {
      const info = lookupDrug(token);
      if (!info) continue;

      const key = info.canonical.toLowerCase() + "|" + (YEAR_RANGE_RE.exec(sentence)?.[0] || "");
      if (seen.has(key)) continue;
      seen.add(key);

      const dates = extractDates(sentence);
      const discontinuation_reason = extractDiscontinuationReason(sentence);
      const indication = extractIndication(sentence);
      const dose = extractDose(token);
      const isDiscontinued = DISC_KEYWORD_RE.test(sentence) || discontinuation_reason || dates.end_date;

      items.push({
        raw: sentence,
        canonical: info.canonical,
        drug_name: info.canonical,
        drug_canonical: normKey(info.alias),
        category: info.category,
        therapy_type: info.therapy_type || null,
        relevance: info.relevance || "medium",
        dose: dose || null,
        start_date: dates.start_date,
        end_date: dates.end_date,
        date_approximate: dates.date_approximate,
        discontinuation_reason: discontinuation_reason || null,
        indication: indication || null,
        event_type_override: "historical_exposure",
        status: "discontinued",
        first_seen_date: today,
        source: "anamnesi_prima_visita",
        _recognized: true,
        _ambiguous: info._byInclusion === true && RESUMPTION_RE.test(sentence),
        _skip: false,
        _edit_start: dates.start_date || "",
        _edit_end: dates.end_date || "",
        _edit_reason: discontinuation_reason || "",
        _edit_approx: dates.date_approximate,
      });
    }
  }

  return items;
}
