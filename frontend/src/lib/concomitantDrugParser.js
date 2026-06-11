import { DRUG_ALIAS_MAP } from "./drugs";

const DOSE_RE = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|g|ml|UI|U|%)?(?:\s*\/\s*(?:die|d|settimana|sett|mese|mes|dose))?/i;
const ROUTE_RE = /\b(orale|os|sc|sottocute|im|intramuscolo|ev|endovena|transdermic[oa]|patch|cerotto|spray|inalatori[oa]|collirio)\b/i;

function extractDose(token) {
  const m = DOSE_RE.exec(token);
  if (!m) return null;
  const unit = m[2] ? m[2].toLowerCase() : "mg";
  return `${m[1]} ${unit}`;
}

function extractRoute(token) {
  const m = ROUTE_RE.exec(token);
  return m ? m[1].toLowerCase() : null;
}

const RHEUM_HIGH = new Set(["csDMARD", "bDMARD", "tsDMARD", "JAKi"]);
const RHEUM_MEDIUM = new Set(["glucocorticoid", "NSAID"]);

function deriveRelevance(info) {
  if (info.relevance) return info.relevance;
  if (RHEUM_HIGH.has(info.category)) return "high";
  if (RHEUM_MEDIUM.has(info.category)) return "medium";
  return "low";
}

function normKey(str) {
  return str.toLowerCase().trim()
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ");
}

function lookupDrug(token) {
  const clean = normKey(token.replace(DOSE_RE, "").replace(ROUTE_RE, "").trim());
  if (!clean || clean.length < 2) return null;
  const entry = DRUG_ALIAS_MAP[clean];
  if (entry) return { alias: clean, ...entry };
  for (const [alias, info] of Object.entries(DRUG_ALIAS_MAP)) {
    if (clean.startsWith(alias) || alias.startsWith(clean)) {
      return { alias, ...info };
    }
  }
  return null;
}

/**
 * Parse free-text "Terapie concomitanti attuali" into chip items for review.
 * Returns array of { canonical, drug_name, category, therapy_type, relevance,
 *   dose, route, event_type_override, status, source, _recognized, raw }.
 */
export function parseConcomitantDrugs(text) {
  if (!text || !text.trim()) return [];

  const tokens = text
    .split(/[,;|\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set();
  const items = [];

  for (const raw of tokens) {
    const info = lookupDrug(raw);
    const dose = extractDose(raw);
    const route = extractRoute(raw);

    if (info) {
      const key = info.canonical.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        raw,
        canonical: info.canonical,
        drug_name: info.canonical,
        drug_canonical: normKey(info.alias),
        category: info.category,
        therapy_type: info.therapy_type || null,
        relevance: deriveRelevance(info),
        dose: dose || null,
        route: route || "orale",
        event_type_override: "noted",
        status: "active",
        first_seen_date: today,
        start_date: null,
        source: "anamnesi_prima_visita",
        _recognized: true,
        _skip: false,
        _custom_start_date: "",
      });
    } else {
      const cleanRaw = raw.replace(/[^a-zA-ZàèéìòùÀÈÉÌÒÙ\s\-'/]/g, "").trim();
      if (!cleanRaw || cleanRaw.length < 2) continue;
      items.push({
        raw,
        canonical: null,
        drug_name: raw,
        drug_canonical: null,
        category: "other",
        therapy_type: "other",
        relevance: "low",
        dose: dose || null,
        route: route || null,
        event_type_override: "noted",
        status: "active",
        first_seen_date: today,
        start_date: null,
        source: "anamnesi_prima_visita",
        _recognized: false,
        _skip: false,
        _custom_start_date: "",
      });
    }
  }

  return items;
}
