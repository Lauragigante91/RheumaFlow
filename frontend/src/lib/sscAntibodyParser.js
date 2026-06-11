/**
 * sscAntibodyParser.js
 *
 * Qualitative parser for SSc (systemic sclerosis) specific antibodies.
 * Extracts antibody results from free-text clinical notes and maps them
 * to ScleroProfile antibody section keys (profileKey).
 *
 * Usage:
 *   extractSscAntibodies("Scl-70 +++ ACA neg")
 *   → [
 *       { profileKey: "scl70", label: "Anti-topoisomerasi I (Scl-70)", result: "pos", ... },
 *       { profileKey: "aca",   label: "Anti-centromero (ACA)",          result: "neg", ... },
 *     ]
 */

export const SSC_ANTIBODY_DEFS = [
  {
    profileKey: "scl70",
    label: "Anti-topoisomerasi I (Scl-70)",
    aliases: [
      "scl-?70",
      "anti-?scl-?70",
      "topoisomeras[ei]\\s+I",
      "anti[-\\s]+topoisomeras[ei]\\s+I",
    ],
  },
  {
    profileKey: "aca",
    label: "Anti-centromero (ACA)",
    aliases: [
      "anti-?centromero",
      "anti-?centromere",
      "ACA\\b",
    ],
  },
  {
    profileKey: "rnap3",
    label: "Anti-RNA polimerasi III",
    aliases: [
      "RNA\\s*pol(?:imerasi)?\\s*III",
      "anti-?RNA\\s*pol(?:imerasi)?\\s*III",
      "RNAP\\s*III",
      "RNAP-?3",
    ],
  },
  {
    profileKey: "u3rnp_fibrillarin",
    label: "Anti-U3-RNP / fibrillarina",
    aliases: [
      "U3-?RNP",
      "anti-?U3-?RNP",
      "fibrillarin[ae]?\\b",
      "anti-?fibrillarin[ae]?",
    ],
  },
  {
    profileKey: "th_to",
    label: "Anti-Th/To",
    aliases: [
      "Th\\/To",
      "anti-?Th\\/To",
    ],
  },
  {
    profileKey: "pm_scl",
    label: "Anti-PM/Scl",
    aliases: [
      "PM-?Scl(?:-?\\d+)?",
      "anti-?PM-?Scl(?:-?\\d+)?",
      "PM\\/Scl",
    ],
  },
  {
    profileKey: "ku",
    label: "Anti-Ku",
    aliases: [
      "anti-?Ku\\b",
    ],
  },
  {
    profileKey: "u1rnp",
    label: "Anti-U1-RNP",
    aliases: [
      "U1-?RNP",
      "anti-?U1-?RNP",
      "U1RNP",
    ],
  },
];

const RESULT_SUFFIX =
  "\\s*[:=]?\\s*(\\+{1,3}|\\+\\s*\\/\\s*-|[±]|-{1,3}|pos(?:itiv[oi])?|neg(?:ativ[oi])?|assente|presente|borderline|debole|equivoco|dubbio)";

function parseResult(token) {
  if (!token) return "pos";
  const t = token.trim().toLowerCase().replace(/\s+/g, " ");
  if (/^(-{1,3}|neg|negativo|negative|assente)/.test(t)) return "neg";
  if (/^(\+\s*\/\s*-|±|borderline|debole|dubbio|equivoco)/.test(t)) return "borderline";
  if (/^(\+{1,3}|pos|positivo|positive|presente)/.test(t)) return "pos";
  return "pos";
}

export function extractSscAntibodies(text) {
  if (!text?.trim()) return [];
  const results = [];
  const seen = new Set();

  for (const def of SSC_ANTIBODY_DEFS) {
    const namePattern = def.aliases.join("|");
    const re = new RegExp(`(?:${namePattern})(?:${RESULT_SUFFIX})?`, "gi");
    let match;
    while ((match = re.exec(text)) !== null) {
      if (seen.has(def.profileKey)) break;
      seen.add(def.profileKey);
      results.push({
        id: `ssc_${def.profileKey}_${Math.random().toString(36).slice(2, 7)}`,
        profileKey: def.profileKey,
        label: def.label,
        result: parseResult(match[1] || ""),
        sourceText: match[0].trim(),
      });
    }
  }
  return results;
}
