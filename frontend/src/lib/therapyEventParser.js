/**
 * therapyEventParser.js
 *
 * Rule-based parser for Italian rheumatology therapy modification text.
 * Recognises start / stop / increase / decrease / switch / continue actions,
 * extracts drug name, dose, route, and reason from each clause.
 *
 * Returns: Array of {
 *   id, action, label, color,
 *   drug_name, drug_canonical, category,
 *   dose, frequency, route,
 *   reason, source_text
 * }
 */

import { DRUG_ALIAS_MAP } from "./drugs";

// ── Drug lookup — derived from shared DRUG_ALIAS_MAP in drugs.js ───────────────
// Build a combined regex from all known aliases (longest first for greedy match)
const _DRUG_RE = (() => {
  const parts = Object.keys(DRUG_ALIAS_MAP)
    .map(a => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  return new RegExp(`\\b(${parts.join("|")})\\b`, "gi");
})();

function findDrug(segment) {
  const matches = [];
  const re = new RegExp(_DRUG_RE.source, "gi");
  let m;
  while ((m = re.exec(segment)) !== null) {
    const raw = m[1].trim();
    const info = DRUG_ALIAS_MAP[raw] || DRUG_ALIAS_MAP[raw.toLowerCase()];
    if (info && !matches.find(x => x.name === info.canonical)) {
      matches.push({ name: info.canonical, category: info.category, pos: m.index });
    }
  }
  return matches;
}

// ── Action patterns ───────────────────────────────────────────────────────────
const ACTION_DEFS = [
  {
    action: "start", label: "Avvio", color: "green",
    status: "active",
    re: /\b(si\s+avvia|avvio\s+(?:di\s+)?|si\s+inizia|inizi[oa]\s+(?:di\s+)?|iniziato[/a]?|avviat[oa]|si\s+introduce|introduc\w+|introdott[oa]|si\s+aggiunge|aggiunt[oa]|viene?\s+avviat[oa]|è\s+stat[oa]\s+avviat[oa]|prescritt[oa]|si\s+prescrive|inizia\s+(?:la\s+)?terapia)\b/i,
  },
  {
    action: "stop", label: "Sospensione", color: "red",
    status: "discontinued",
    re: /\b(si\s+sospende|sospensione\s+(?:di\s+)?|sospes[ao]|si\s+interrompe|interruzione\s+(?:di\s+)?|interrott[oa]|discontinuat[oa]|si\s+toglie|viene?\s+sosp\w+|è\s+stat[oa]\s+sosp\w+|stop\s+(?:di\s+)?|si\s+elimina)\b/i,
  },
  {
    action: "increase", label: "Incremento dose", color: "orange",
    status: "active",
    re: /\b(si\s+increment[ae]|incremento\s+(?:della\s+dose\s+(?:di\s+)?)?|increment[oa]\s+(?:a\s+)?|si\s+aument[ae]|aument[oa]|dose\s+increment\w+|portato\s+a|si\s+porta\s+a|up.?titration|uptitration|si\s+escal[ae]|dose\s+escal\w+)\b/i,
  },
  {
    action: "decrease", label: "Riduzione dose", color: "blue",
    status: "active",
    re: /\b(si\s+riduce|riduzione\s+(?:della\s+dose\s+(?:di\s+)?)?|ridott[oa]|si\s+scala|scal[ao]\s+(?:a\s+)?|si\s+abbassa|abbassato|tapering|dose\s+ridott[oa]|down.?titration)\b/i,
  },
  {
    action: "switch", label: "Switch", color: "purple",
    status: "active",
    re: /\b(switch\s+(?:[da]+\s+)?|si\s+passa\s+a|si\s+sostituisce\s+(?:con\s+)?|sostituzione\s+(?:con\s+)?|si\s+cambia\s+(?:con|a)\s+|cambio\s+(?:[da]+|di\s+farmaco)\s+)\b/i,
  },
  {
    action: "continue", label: "Prosecuzione", color: "gray",
    status: "active",
    re: /\b(si\s+continua|si\s+mantiene|si\s+conferma|prosegu\w+|in\s+continuazione|continua\s+(?:la\s+)?terapia|confermato|mantenut[oa]|protr\w+)\b/i,
  },
];

// ── Dose extraction ───────────────────────────────────────────────────────────
const DOSE_RE = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|μg|g|UI|U\.I\.|IU|ml)\b/gi;
const FREQ_RE = /\b((?:ogni\s+\d+\s+(?:settiman[ae]|giorni|mesi))|(?:\d+\s*x?\s*)?(?:die|al\s+giorno|giornaliero|sett\.?|settimanal[ei]|bisettimanal[ei]|mensil[ei]|mensile|ogni\s+(?:mese|2|4|6|8)\s+settiman[ae]?|trimestral[ei]|semestral[ei]|annual[ei]))\b/gi;
const ROUTE_RE = /\b(per\s+os|os|oral[ei]|s\.c\.|sc|sottocute|e\.v\.|ev|endovena|i\.m\.|im|intramuscolo?|s\.l\.|sublinguale)\b/gi;
const REASON_RE = /\b(?:per|a causa di|in quanto|per\s+(?:risposta\s+)?(?:inad\w+|tossis\w+|effetti?\s+coll\w+|intoll\w+|fatt\w+|scar\w+|incremento|riduzione|miglior\w+|peggiora\w+)|a seguito di)\s+([^.;:\n]{3,60})/gi;

function extractDose(seg) {
  const doses = [];
  const re = new RegExp(DOSE_RE.source, "gi");
  let m;
  while ((m = re.exec(seg)) !== null) doses.push(`${m[1]} ${m[2]}`);
  return doses.length ? doses.join(" + ") : "";
}

function extractFrequency(seg) {
  const re = new RegExp(FREQ_RE.source, "gi");
  const m = re.exec(seg);
  return m ? m[0].trim() : "";
}

function extractRoute(seg) {
  const re = new RegExp(ROUTE_RE.source, "gi");
  const m = re.exec(seg);
  return m ? m[1].trim() : "";
}

function extractReason(seg) {
  const re = new RegExp(REASON_RE.source, "gi");
  const m = re.exec(seg);
  return m ? m[1].trim() : "";
}

// ── Split text into sentences ─────────────────────────────────────────────────
function splitSentences(text) {
  return text
    .split(/(?<=[.;!?\n])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);
}

// ── Main export ───────────────────────────────────────────────────────────────
export function parseTherapyEvents(text) {
  if (!text?.trim()) return [];

  const events = [];
  let idCounter = 0;

  const sentences = splitSentences(text);

  for (const sentence of sentences) {
    // Find which action(s) this sentence contains
    const matchedActions = ACTION_DEFS.filter(a => a.re.test(sentence));
    if (!matchedActions.length) continue;

    // Find all drug mentions
    const drugs = findDrug(sentence);
    if (!drugs.length) continue;

    for (const actionDef of matchedActions) {
      // For "switch" with multiple drugs, first = from, rest = to
      if (actionDef.action === "switch" && drugs.length >= 2) {
        // Emit one "stop" for the first drug and one "start" for the second
        events.push({
          id: `ev_${idCounter++}`,
          action: "stop",
          label: ACTION_DEFS.find(a => a.action === "stop").label,
          color: "red",
          status: "discontinued",
          drug_name: drugs[0].name,
          category: drugs[0].category,
          dose: extractDose(sentence),
          frequency: extractFrequency(sentence),
          route: extractRoute(sentence),
          reason: extractReason(sentence),
          source_text: sentence.slice(0, 120),
        });
        events.push({
          id: `ev_${idCounter++}`,
          action: "start",
          label: ACTION_DEFS.find(a => a.action === "start").label,
          color: "green",
          status: "active",
          drug_name: drugs[1].name,
          category: drugs[1].category,
          dose: extractDose(sentence),
          frequency: extractFrequency(sentence),
          route: extractRoute(sentence),
          reason: extractReason(sentence),
          source_text: sentence.slice(0, 120),
        });
      } else {
        // For each drug found in this sentence
        for (const drug of drugs) {
          // Check for duplicates (same action + drug)
          if (events.some(e => e.action === actionDef.action && e.drug_name === drug.name && e.source_text === sentence.slice(0, 120))) continue;
          events.push({
            id: `ev_${idCounter++}`,
            action: actionDef.action,
            label: actionDef.label,
            color: actionDef.color,
            status: actionDef.status,
            drug_name: drug.name,
            category: drug.category,
            dose: extractDose(sentence),
            frequency: extractFrequency(sentence),
            route: extractRoute(sentence),
            reason: extractReason(sentence),
            source_text: sentence.slice(0, 120),
          });
        }
      }
    }
  }

  // Deduplicate: same action + drug → keep first
  const seen = new Set();
  return events.filter(ev => {
    const key = `${ev.action}::${ev.drug_name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Action colour helper ──────────────────────────────────────────────────────
export const ACTION_COLORS = {
  start:    { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  badge: "bg-green-100"  },
  stop:     { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    badge: "bg-red-100"    },
  increase: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", badge: "bg-orange-100" },
  decrease: { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   badge: "bg-blue-100"   },
  switch:   { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", badge: "bg-purple-100" },
  continue: { bg: "bg-gray-50",   border: "border-gray-200",   text: "text-gray-600",   badge: "bg-gray-100"   },
};
