/**
 * labValueExtractor.js
 *
 * Regex-based parser for common rheumatology lab values written in Italian or
 * English free-text clinical notes.
 *
 * For each match the extractor also looks at the text immediately after the
 * matched token for an inline reference range in common Italian formats:
 *   (v.n. 0.4–4.0)  (rif. <5)  (8.5-17.0)  (n. > 60)  [0-20]  etc.
 * If a range is detected it overrides the built-in reference thresholds for
 * high/low/normal status inference.
 */

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Parse "2,4" or "2.4" → 2.4 */
function parseNum(str) {
  return parseFloat(String(str).replace(",", "."));
}

/**
 * Scan the 80 chars immediately after a match for an inline reference range.
 * Supports:
 *   (v.n. X–Y)  (rif. X-Y)  (X-Y)  [X-Y]
 *   (v.n. < X)  < X          (> X)
 *
 * Returns { low?, high? } or null.
 */
function findReferenceRange(text, matchEndIndex) {
  const snippet = text.substring(matchEndIndex, matchEndIndex + 80);
  let m;

  // Range: (v.n. X-Y) | (rif. X-Y) | (n. X-Y) | (X-Y) | [X-Y]
  m = /[\(\[]?\s*(?:v\.?n\.?|n\.?v\.?|n\.|rif\.?|ref\.?|normal[ei]?)?\s*(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)\s*[\)\]]?/i.exec(snippet);
  if (m) {
    const lo = parseNum(m[1]);
    const hi = parseNum(m[2]);
    if (!isNaN(lo) && !isNaN(hi) && lo < hi) {
      return { low: lo, high: hi };
    }
  }

  // Upper limit only: < X  or (v.n. < X)
  m = /[\(\[]?\s*(?:v\.?n\.?|n\.?v\.?|rif\.?|ref\.?)?\s*<\s*(\d+(?:[.,]\d+)?)/i.exec(snippet);
  if (m) return { high: parseNum(m[1]) };

  // Lower limit only: > X
  m = /[\(\[]?\s*(?:v\.?n\.?|n\.?v\.?|rif\.?|ref\.?)?\s*>\s*(\d+(?:[.,]\d+)?)/i.exec(snippet);
  if (m) return { low: parseNum(m[1]) };

  return null;
}

/**
 * Infer status for a single lab value.
 *
 * If detectedRange is absent, falls back to param.referenceHighByUnit /
 * param.referenceLowByUnit (unit-keyed maps, case-insensitive) and then to the
 * plain param.referenceHigh / param.referenceLow scalars.
 *
 * This allows CRP to have threshold 0.5 mg/dL and 5 mg/L without conversions.
 */
function inferStatus(param, value, detectedRange, unit) {
  let high = detectedRange?.high;
  let low  = detectedRange?.low;

  if (high == null) {
    if (unit && param.referenceHighByUnit) {
      const entry = Object.entries(param.referenceHighByUnit)
        .find(([k]) => new RegExp(`^${k}$`, "i").test(unit));
      high = entry != null ? entry[1] : param.referenceHigh;
    } else {
      high = param.referenceHigh;
    }
  }
  if (low == null) {
    if (unit && param.referenceLowByUnit) {
      const entry = Object.entries(param.referenceLowByUnit)
        .find(([k]) => new RegExp(`^${k}$`, "i").test(unit));
      low = entry != null ? entry[1] : param.referenceLow;
    } else {
      low = param.referenceLow;
    }
  }

  if (high != null && value > high) return "high";
  if (low  != null && value < low)  return "low";
  if (high != null || low != null)  return "normal";
  return undefined;
}

// ─── Parameter definitions ────────────────────────────────────────────────────

// ── Parametri ad alto rischio clinico ─────────────────────────────────────────
// Per questi parametri, se l'unità non è esplicitamente indicata nel testo
// il parser imposta confidence="low" e il dato va in lab_review_items
// (non nel dato strutturato definitivo) fino a conferma medica.
// Regola: meglio nessun dato che un dato falso (policy sicurezza clinica).
const HIGH_RISK_KEYS = new Set([
  "crp", "ves", "creatinine", "hb", "wbc", "plt", "alt", "ast", "proteinuria",
]);

export const LAB_REVIEW_TRUSTED_UNITS = {
  crp:        "mg/dL",
  ves:        "mm/h",
  hb:         "g/dL",
  wbc:        "K/μL",
  plt:        "K/μL",
  creatinine: "mg/dL",
  ast:        "U/L",
  alt:        "U/L",
  egfr:       "mL/min/1.73m²",
};

const PARAMS = [

  // ── Inflammation markers ──────────────────────────────────────────────────

  {
    key: "crp",
    label: "PCR / CRP",
    panel: "fase_acuta",
    aliases: ["(?<!DAS28[-–\\s])CRP", "(?<!DAS28[-–\\s])PCR", "C-reactive\\s+protein", "proteina\\s+C\\s+rea(?:ttiva)?"],
    knownUnits: ["mg/[Ll]", "mg/d[Ll]"],
    // ── Regola locale RheumaFlow ──────────────────────────────────────────────
    // Unità di default: mg/dL (il laboratorio di riferimento riporta in mg/dL).
    // Se il testo specifica mg/L → salva mg/L, se mg/dL → salva mg/dL.
    // Se il testo non ha unità → usa mg/dL (default), flag inferred_unit=true.
    // NON fare conversioni implicite: value + unit vanno sempre salvati as-is.
    defaultUnit: "mg/dL",
    // Soglie per unit: 0.5 mg/dL = 5 mg/L (stesso confine, scale diverse).
    referenceHighByUnit: { "mg/dL": 0.5, "mg/L": 5 },
    referenceHigh: 0.5,   // fallback quando l'unità non è specificata (default mg/dL)
  },
  {
    key: "ves",
    label: "VES / ESR",
    panel: "fase_acuta",
    aliases: ["VES", "ESR", "velocità\\s+di\\s+eritrosedimentazione", "erythrocyte\\s+sedimentation"],
    knownUnits: ["mm/h", "mm/ora", "mm/1h", "mm/hr", "\\bmm\\b"],
    defaultUnit: "mm/h",
    referenceHigh: 20,
    normalize(value, unit) {
      if (/^mm$/i.test(unit)) return { value, unit: "mm/h" };
      return null;
    },
  },
  {
    key: "ferritin",
    label: "Ferritina",
    panel: "fase_acuta",
    aliases: ["ferritina", "ferritin(?:e)?"],
    knownUnits: ["ng/m[Ll]", "μg/[Ll]", "ug/[Ll]", "pmol/[Ll]"],
    defaultUnit: "ng/mL",
    referenceHigh: 300,
  },
  {
    key: "ldh",
    label: "LDH",
    panel: "funzione",
    aliases: ["LDH", "lattato\\s+deidrogenasi", "lattico\\s+deidrogenasi", "lactate\\s+dehydrogenase"],
    knownUnits: ["U/[Ll]", "IU/[Ll]", "UI/[Ll]"],
    defaultUnit: "U/L",
    referenceHigh: 250,
  },
  {
    key: "aldolase",
    label: "Aldolasi",
    panel: "funzione",
    aliases: ["aldolasi", "aldolase"],
    knownUnits: ["U/[Ll]", "IU/[Ll]", "UI/[Ll]"],
    defaultUnit: "U/L",
    referenceHigh: 7.6,
  },

  // ── Complete blood count ──────────────────────────────────────────────────

  {
    key: "hb",
    label: "Hb / Emoglobina",
    panel: "emocromo",
    aliases: ["Hb", "Hgb", "emoglobina", "haemoglobin", "hemoglobin"],
    knownUnits: ["g/d[Ll]", "g/[Ll]"],
    defaultUnit: "g/dL",
    referenceLow: 12,
    referenceHigh: 17,
  },
  {
    key: "wbc",
    label: "GB / WBC",
    panel: "emocromo",
    aliases: ["WBC", "GB", "leucocit[io]", "globuli\\s+bianchi", "white\\s+blood\\s+cell"],
    knownUnits: ["[Kk]/[μuµ][Ll]", "[Kk]/mm[³3]", "x\\s*10[³3]/[μuµ][Ll]", "10\\^9/[Ll]"],
    defaultUnit: "K/μL",
    referenceLow: 4,
    referenceHigh: 10,
  },
  {
    key: "neutrophils",
    label: "Neutrofili",
    panel: "emocromo",
    aliases: ["neutrofil[io]", "neut(?:rophil)?s?(?:\\s+assolut[io])?", "PMN", "\\bN\\b"],
    knownUnits: ["%", "[Kk]/[μuµ][Ll]", "x\\s*10[³3]/[μuµ][Ll]", "[Kk]/mm[³3]", "10\\^9/[Ll]"],
    defaultUnit: "K/μL",
    excludeIfUnit: ["%"],
    referenceLow: 1.8,
    referenceHigh: 7.5,
  },
  {
    key: "lymphocytes",
    label: "Linfociti",
    panel: "emocromo",
    aliases: ["linfocit[io]", "lymphocytes?", "\\bLy\\b"],
    knownUnits: ["%", "[Kk]/[μuµ][Ll]", "x\\s*10[³3]/[μuµ][Ll]", "[Kk]/mm[³3]", "10\\^9/[Ll]"],
    defaultUnit: "K/μL",
    excludeIfUnit: ["%"],
    referenceLow: 1.0,
    referenceHigh: 4.0,
  },
  {
    key: "eosinophils",
    label: "Eosinofili",
    panel: "emocromo",
    aliases: ["eosinofil[io]", "eosinophils?"],
    knownUnits: ["%", "[Kk]/[μuµ][Ll]", "x\\s*10[³3]/[μuµ][Ll]", "[Kk]/mm[³3]", "10\\^9/[Ll]"],
    defaultUnit: "K/μL",
    excludeIfUnit: ["%"],
    referenceLow: 0.02,
    referenceHigh: 0.5,
  },
  {
    key: "plt",
    label: "PLT / Piastrine",
    panel: "emocromo",
    aliases: ["PLT", "piastrine", "piastrinocit[io]", "platelets?"],
    knownUnits: ["[Kk]/[μuµ][Ll]", "x\\s*10[³3]/[μuµ][Ll]", "[Kk]/mm[³3]", "10\\^9/[Ll]"],
    defaultUnit: "K/μL",
    referenceLow: 150,
    referenceHigh: 400,
  },

  // ── Complement ────────────────────────────────────────────────────────────

  {
    key: "c3",
    label: "Complemento C3",
    panel: "complemento",
    // Require "complemento" or "complement" prefix OR unit-anchored C3
    aliases: ["complement(?:o)?\\s+C3", "C3\\s+(?:complement(?:o)?)?"],
    knownUnits: ["mg/d[Ll]", "g/[Ll]"],
    defaultUnit: "mg/dL",
    referenceLow: 90,
    referenceHigh: 180,
  },
  {
    key: "c4",
    label: "Complemento C4",
    panel: "complemento",
    aliases: ["complement(?:o)?\\s+C4", "C4\\s+(?:complement(?:o)?)?"],
    knownUnits: ["mg/d[Ll]", "g/[Ll]"],
    defaultUnit: "mg/dL",
    referenceLow: 16,
    referenceHigh: 47,
  },
  {
    key: "c1q",
    label: "Complemento C1q",
    panel: "complemento",
    aliases: ["C1q\\b", "complement(?:o)?\\s+C1q"],
    knownUnits: ["mg/d[Ll]", "g/[Ll]"],
    defaultUnit: "mg/dL",
    referenceLow: 14,
    referenceHigh: 30,
  },

  // ── Immunoglobuline (standalone total serum Ig) ───────────────────────────
  // These aliases must NOT match the "anticardiolipina IgG" context; that is
  // handled separately in the autoab extraction pass.

  {
    key: "igg",
    label: "IgG (Immunoglobuline G)",
    panel: "immunoglobuline",
    // Require either explicit unit OR "immunoglobulina/e" prefix to avoid
    // false positive on "anticardiolipina IgG" and "β2GP1 IgG".
    aliases: [
      "immunoglobulin[ae]\\s+G\\b",
      "\\bIgG\\b(?=\\s+\\d)",
    ],
    knownUnits: ["mg/d[Ll]", "g/[Ll]"],
    defaultUnit: "mg/dL",
    referenceLow: 700,
    referenceHigh: 1600,
  },
  {
    key: "iga",
    label: "IgA (Immunoglobuline A)",
    panel: "immunoglobuline",
    aliases: [
      "immunoglobulin[ae]\\s+A\\b",
      "\\bIgA\\b(?=\\s+\\d)",
    ],
    knownUnits: ["mg/d[Ll]", "g/[Ll]"],
    defaultUnit: "mg/dL",
    referenceLow: 70,
    referenceHigh: 400,
  },
  {
    key: "igm",
    label: "IgM (Immunoglobuline M)",
    panel: "immunoglobuline",
    aliases: [
      "immunoglobulin[ae]\\s+M\\b",
      "\\bIgM\\b(?=\\s+\\d)",
    ],
    knownUnits: ["mg/d[Ll]", "g/[Ll]"],
    defaultUnit: "mg/dL",
    referenceLow: 40,
    referenceHigh: 230,
  },

  // ── Liver / metabolic function ────────────────────────────────────────────

  {
    key: "albumin",
    label: "Albumina",
    panel: "funzione",
    aliases: ["albumina", "albumin"],
    knownUnits: ["%", "g/d[Ll]", "g/[Ll]"],
    defaultUnit: "g/dL",
    excludeIfUnit: ["%"],
    referenceLow: 3.5,
    referenceHigh: 5.0,
  },
  {
    key: "alp",
    label: "Fosfatasi alcalina (ALP)",
    panel: "funzione",
    aliases: ["ALP", "\\bFA\\b", "fosfatasi\\s+alcalina", "alkaline\\s+phosphatase"],
    knownUnits: ["U/[Ll]", "IU/[Ll]", "UI/[Ll]"],
    defaultUnit: "U/L",
    referenceHigh: 120,
  },
  {
    key: "ggt",
    label: "GGT",
    panel: "funzione",
    aliases: ["GGT", "gamma\\s*-?GT", "gamma.?glutamil(?:(?:\\s+)?transferasi)?"],
    knownUnits: ["U/[Ll]", "IU/[Ll]", "UI/[Ll]"],
    defaultUnit: "U/L",
    referenceHigh: 60,
  },
  {
    key: "bilirubin",
    label: "Bilirubina",
    panel: "funzione",
    aliases: ["bilirubina(?:\\s+tot(?:ale)?)?", "bilirubin(?:\\s+tot(?:al)?)?"],
    knownUnits: ["mg/d[Ll]", "μmol/[Ll]", "umol/[Ll]"],
    defaultUnit: "mg/dL",
    referenceHigh: 1.2,
  },
  {
    key: "alt",
    label: "ALT / GPT",
    panel: "funzione",
    aliases: ["ALT", "GPT", "alanin[ao]\\s*(?:amino)?transferasi"],
    knownUnits: ["U/[Ll]", "IU/[Ll]", "UI/[Ll]"],
    defaultUnit: "U/L",
    referenceHigh: 40,
  },
  {
    key: "ast",
    label: "AST / GOT",
    panel: "funzione",
    aliases: ["AST", "GOT", "aspartat[ao]\\s*(?:amino)?transferasi"],
    knownUnits: ["U/[Ll]", "IU/[Ll]", "UI/[Ll]"],
    defaultUnit: "U/L",
    referenceHigh: 40,
  },
  {
    key: "cpk",
    label: "CPK / CK",
    panel: "funzione",
    aliases: ["CPK", "CK(?!D)(?!\\s*-EPI)", "creatinchinasi", "creatina(?:\\s+fosfo)?chinasi", "creatine\\s+kinase"],
    knownUnits: ["U/[Ll]", "IU/[Ll]", "UI/[Ll]"],
    defaultUnit: "U/L",
    referenceHigh: 200,
  },

  // ── Renal ─────────────────────────────────────────────────────────────────

  {
    key: "creatinine",
    label: "Creatinina",
    panel: "funzione",
    aliases: ["creatinin[ae]", "creat(?:inine)?", "\\bcr\\.?(?![a-zA-Z])"],
    knownUnits: ["mg/d[Ll]", "μmol/[Ll]", "umol/[Ll]"],
    defaultUnit: "mg/dL",
    referenceHigh: 1.2,
  },
  {
    key: "egfr",
    label: "eGFR / GFR",
    panel: "funzione",
    aliases: ["eGFR", "GFR", "filtrato\\s+glomerulare"],
    knownUnits: ["m[Ll]/min(?:/1\\.73\\s*m[²2])?"],
    defaultUnit: "mL/min/1.73m²",
    referenceLow: 60,
  },
  {
    key: "proteinuria",
    label: "Proteinuria",
    panel: "urine",
    aliases: ["proteinuria", "protein(?:e)?\\s+urine"],
    knownUnits: ["g/24h", "g/24\\s*ore", "mg/24h", "g/g", "mg/g", "mg/d[Ll]"],
    defaultUnit: "g/24h",
    normalize(value, unit) {
      if (/mg\/24h/i.test(unit)) {
        return { value: +(value / 1000).toFixed(3), unit: "g/24h" };
      }
      return null;
    },
    normalizedUnit: "g/24h",
  },
  {
    key: "upcr",
    label: "Rapporto proteine/creatinina urine (UPCR)",
    panel: "urine",
    aliases: [
      "UPCR",
      "rapporto\\s+prot(?:eine)?(?:\\s*/\\s*|\\s+)creat(?:inina)?",
      "rapporto\\s+P/C",
      "protein(?:/|\\s+)creatinine\\s+ratio",
      "urine\\s+protein(?:\\s+creatinine)\\s+ratio",
    ],
    knownUnits: ["mg/g", "g/g", "mg/mmol"],
    defaultUnit: "mg/g",
  },
  {
    key: "acr",
    label: "Rapporto albumina/creatinina (ACR)",
    panel: "urine",
    aliases: [
      "\\bACR\\b",
      "albumin(?:uria)?(?:\\s*/\\s*|\\s+)creat(?:inina)?(?:\\s+ratio)?",
      "rapporto\\s+albumina.?creatinina",
      "\\bUACR\\b",
    ],
    knownUnits: ["mg/g", "mg/mmol"],
    defaultUnit: "mg/g",
    referenceHigh: 30,
  },
  {
    key: "urine_sg",
    label: "Peso specifico urine",
    panel: "urine",
    aliases: ["peso\\s+specifico(?:\\s+urine)?", "densit[àa]\\s+urinaria", "specific\\s+gravity"],
    knownUnits: [],
    defaultUnit: "",
  },
  {
    key: "urine_ph",
    label: "pH urine",
    panel: "urine",
    aliases: ["pH\\s+urin(?:e|ario)?", "\\bpH\\b(?=\\s+\\d)"],
    knownUnits: [],
    defaultUnit: "",
    referenceLow: 5,
    referenceHigh: 8,
  },

  // ── Bone / mineral ────────────────────────────────────────────────────────

  {
    key: "vitd",
    label: "Vitamina D (25-OH)",
    panel: "funzione",
    aliases: ["vitamina\\s+D(?:\\s+25.?OH)?", "25.?OH.?D(?:3)?", "25-?OH-?colecalciferolo", "vit\\.?\\s*D"],
    knownUnits: ["ng/m[Ll]", "nmol/[Ll]"],
    defaultUnit: "ng/mL",
    normalize(value, unit) {
      if (/nmol\/[Ll]/i.test(unit)) {
        return { value: +(value / 2.496).toFixed(1), unit: "ng/mL" };
      }
      return null;
    },
    normalizedUnit: "ng/mL",
    referenceLow: 30,
  },
  {
    key: "calcium",
    label: "Calcemia",
    panel: "funzione",
    aliases: ["calcemia", "calcio\\s+sierico", "calcium"],
    knownUnits: ["mg/d[Ll]", "mmol/[Ll]"],
    defaultUnit: "mg/dL",
    referenceLow: 8.5,
    referenceHigh: 10.5,
  },
  {
    key: "phosphorus",
    label: "Fosforemia",
    panel: "funzione",
    aliases: ["fosforemia", "fosfat(?:o|emia)", "phosphor(?:us|ate)", "phosph(?:ate)?"],
    knownUnits: ["mg/d[Ll]", "mmol/[Ll]"],
    defaultUnit: "mg/dL",
    referenceLow: 2.5,
    referenceHigh: 4.5,
  },
  {
    key: "pth",
    label: "PTH / Paratormone",
    panel: "funzione",
    aliases: ["PTH", "paratormone", "parathyroid\\s+hormone"],
    knownUnits: ["pg/m[Ll]", "pmol/[Ll]", "ng/[Ll]"],
    defaultUnit: "pg/mL",
    normalize(value, unit) {
      if (/pmol\/[Ll]/i.test(unit)) {
        return { value: +(value * 9.43).toFixed(1), unit: "pg/mL" };
      }
      return null;
    },
    normalizedUnit: "pg/mL",
    referenceLow: 15,
    referenceHigh: 65,
  },

  // ── Thyroid ───────────────────────────────────────────────────────────────

  {
    key: "tsh",
    label: "TSH",
    panel: "funzione",
    aliases: ["TSH", "tireotropina", "thyroid.?stimulating\\s+hormone"],
    knownUnits: ["m[UI]U/[Ll]", "μ[UI]U/m[Ll]", "u[UI]U/m[Ll]", "mU/[Ll]"],
    defaultUnit: "mIU/L",
    referenceLow: 0.4,
    referenceHigh: 4.0,
  },

  // ── Hematology indices ────────────────────────────────────────────────────

  {
    key: "mcv",
    label: "MCV",
    panel: "emocromo",
    aliases: ["MCV", "volume\\s+corpuscolare\\s+medio"],
    knownUnits: ["fL", "fl"],
    defaultUnit: "fL",
    referenceLow: 80,
    referenceHigh: 100,
  },
  {
    key: "mch",
    label: "MCH",
    panel: "emocromo",
    aliases: ["MCH"],
    knownUnits: ["pg"],
    defaultUnit: "pg",
    referenceLow: 27,
    referenceHigh: 33,
  },
  {
    key: "mchc",
    label: "MCHC",
    panel: "emocromo",
    aliases: ["MCHC"],
    knownUnits: ["g/d[Ll]", "%"],
    defaultUnit: "g/dL",
    referenceLow: 32,
    referenceHigh: 36,
  },

  // ── Coagulation ───────────────────────────────────────────────────────────

  {
    key: "antithrombin",
    label: "Antitrombina III",
    panel: "funzione",
    aliases: ["antitrombina\\s+III\\b", "antitrombina\\s+3\\b", "anti.?trombina\\b", "AT\\s*III\\b", "antithrombin\\s+III\\b"],
    knownUnits: ["%", "UI/d[Ll]"],
    defaultUnit: "%",
    referenceLow: 80,
    referenceHigh: 120,
  },
  {
    key: "inr",
    label: "INR / PT",
    panel: "funzione",
    aliases: ["\\bINR\\b", "\\bPT\\b(?!\\s*H)", "international\\s+normalized\\s+ratio"],
    knownUnits: [],
    defaultUnit: "",
    referenceHigh: 1.2,
  },

  // ── Lipid profile ─────────────────────────────────────────────────────────

  {
    key: "cholesterol_total",
    label: "Colesterolo totale",
    panel: "funzione",
    aliases: ["colesterolo\\s+tot(?:ale)?", "col(?:\\.|esterolo)?\\s+tot(?:ale)?", "colesterol(?:o|e)?\\s+totale", "total\\s+cholesterol", "TC\\b(?!\\s*[A-Z])"],
    knownUnits: ["mg/d[Ll]", "mmol/[Ll]"],
    defaultUnit: "mg/dL",
    referenceHigh: 200,
  },
  {
    key: "hdl",
    label: "Colesterolo HDL",
    panel: "funzione",
    aliases: ["\\bHDL\\b", "colesterolo\\s+HDL", "HDL.?colesterol(?:o)?"],
    knownUnits: ["mg/d[Ll]", "mmol/[Ll]"],
    defaultUnit: "mg/dL",
    referenceLow: 40,
  },
  {
    key: "ldl",
    label: "Colesterolo LDL",
    panel: "funzione",
    aliases: ["\\bLDL\\b", "colesterolo\\s+LDL", "LDL.?colesterol(?:o)?"],
    knownUnits: ["mg/d[Ll]", "mmol/[Ll]"],
    defaultUnit: "mg/dL",
    referenceHigh: 130,
  },
  {
    key: "triglycerides",
    label: "Trigliceridi",
    panel: "funzione",
    aliases: ["trigliceridi", "triglycerides?", "\\bTG\\b"],
    knownUnits: ["mg/d[Ll]", "mmol/[Ll]"],
    defaultUnit: "mg/dL",
    referenceHigh: 150,
  },

  // ── Other ─────────────────────────────────────────────────────────────────

  {
    key: "uric_acid",
    label: "Uricemia",
    panel: "funzione",
    aliases: ["uricemi[ao]", "acido\\s+urico", "uric\\s+acid"],
    knownUnits: ["mg/d[Ll]", "μmol/[Ll]", "umol/[Ll]"],
    defaultUnit: "mg/dL",
    referenceHigh: 6.8,
  },
];

// ─── Urine count parser ───────────────────────────────────────────────────────
// Gestisce pattern con numero prima dell'alias: "17 emazie/campo", "5 leucociti/campo"
// Il formato italiano per il sedimento urinario è: VALORE TIPO/campo

const URINE_COUNT_PATTERNS = [
  {
    key:   "urine_rbc",
    label: "Emazie urine",
    panel: "urine",
    // Formato 1: "17 emazie/campo" — numero prima dell'alias
    // Formato 2: "emazie 22*"  — alias prima del numero (EU compatto italiano), asterisco opzionale
    re:    /\b(?:(?:(\d+(?:[.,]\d+)?)\s*\*?\s*(?:emazie|eritrociti|globuli\s+rossi)(?:\s*(?:\/\s*campo|\s+al\s+campo|\/HPF|\/μL|\/uL))?)|(?:(?:emazie|eritrociti|globuli\s+rossi)\s+(\d+(?:[.,]\d+)?)\s*\*?))\b/gi,
    unit:  "/campo",
    // Custom extract: cattura il gruppo 1 (formato num-prima) o il gruppo 2 (formato alias-prima)
    extractValue: (m) => m[1] || m[2],
  },
  {
    key:   "urine_wbc",
    label: "Leucociti urine",
    panel: "urine",
    re:    /\b(?:(?:(\d+(?:[.,]\d+)?)\s*\*?\s*(?:leucociti|piociti)(?:\s*(?:\/\s*campo|\s+al\s+campo|\/HPF|\/μL|\/uL))?)|(?:(?:leucociti|piociti)\s+(\d+(?:[.,]\d+)?)\s*\*?))\b/gi,
    unit:  "/campo",
    extractValue: (m) => m[1] || m[2],
  },
];

function extractUrineCountValues(text) {
  const results = [];
  for (const p of URINE_COUNT_PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      const rawStr = p.extractValue ? p.extractValue(m) : m[1];
      if (!rawStr) continue;
      const raw = rawStr.replace(",", ".");
      const val = parseFloat(raw);
      if (isNaN(val)) continue;
      results.push({
        id:             `${p.key}_uc_${Math.random().toString(36).slice(2, 7)}`,
        key:            p.key,
        label:          p.label,
        panel:          p.panel,
        value:          val,
        qualitative:    null,
        unit:           p.unit,
        normalizedValue: null,
        normalizedUnit:  null,
        status:         null,
        detectedRange:  null,
        sourceText:     m[0].trim(),
        param_key:      p.key,
        name:           p.label,
        confidence:     "high",
        inferred_unit:  false,
      });
    }
  }
  return results;
}

// ─── Slash-group parser ────────────────────────────────────────────────────────
// Gestisce pattern tipo: GOT/GPT/GGT = 21/25/21  oppure  AST/ALT 32/28

const SLASH_LABEL_MAP = {
  got: "ast",
  ast: "ast",
  gpt: "alt",
  alt: "alt",
  ggt: "ggt",
  ldh: "ldh",
  cpk: "cpk",
  ck:  "cpk",
  hb:  "hb",
  plt: "plt",
  wbc: "wbc",
  gb:  "wbc",
  crp: "crp",
  pcr: "crp",
  ves: "ves",
  esr: "ves",
  alp: "alp",
  fa:  "alp",
  mcv: "mcv",
  hdl: "hdl",
  ldl: "ldl",
  tg:  "triglycerides",
};

function extractSlashGroupValues(text) {
  const results = [];
  // Pattern: almeno due etichette separate da / seguite da valori separati da /
  // Es: GOT/GPT/GGT 21/25/21  oppure  GOT/GPT/GGT = 21/25/21
  const slashGroupRe = /([A-Za-z]{2,5}(?:\/[A-Za-z]{2,5})+)\s*[=:]?\s*([\d,.]+(?:\/[\d,.]+)+)/g;
  let match;
  while ((match = slashGroupRe.exec(text)) !== null) {
    const labelPart = match[1];
    const valuePart = match[2];
    const labels = labelPart.split("/").map((l) => l.toLowerCase().trim());
    const values = valuePart.split("/").map((v) => parseNum(v.trim()));
    const sourceText = match[0].trim();

    for (let i = 0; i < Math.min(labels.length, values.length); i++) {
      const paramKey = SLASH_LABEL_MAP[labels[i]];
      if (!paramKey || isNaN(values[i])) continue;
      const param = PARAMS.find((p) => p.key === paramKey);
      if (!param) continue;
      results.push({
        id:             `${paramKey}_sg_${i}_${Math.random().toString(36).slice(2, 7)}`,
        key:            paramKey,
        label:          param.label,
        panel:          param.panel,
        value:          values[i],
        unit:           param.defaultUnit,
        normalizedValue: null,
        normalizedUnit:  null,
        status:         inferStatus(param, values[i], null),
        detectedRange:  null,
        sourceText,
      });
    }
  }
  return results;
}

// ─── Qualitative result extractor ────────────────────────────────────────────
// Gestisce: PARAM nn → "nella norma", EU nn → esame urine nn, ELF nn → elettroforesi nn

const PANEL_QUAL_LABELS = [
  {
    key: "esame_urine",
    label: "Esame urine (EU)",
    panel: "urine",
    aliases: ["EU", "esame\\s+urine"],
  },
  {
    key: "hemoglobinuria",
    label: "Emoglobinuria",
    panel: "urine",
    aliases: ["emoglobinuria", "Hb\\s+urine", "hemoglobinuria", "emoglobina\\s+(?:nelle?\\s+)?urin[ae]?", "Hb\\s+stick"],
    // "emoglobinuria" senza qualitativo = presente/positiva (se non seguita da "neg" o "assente")
    positiveIfNoQual: true,
  },
  {
    key: "proteinuria_stick",
    label: "Proteinuria stick",
    panel: "urine",
    aliases: ["proteinuria\\s+stick", "proteine\\s+stick", "protein(?:e)?\\s+(?:urine\\s+)?(?:strip|dipstick)"],
  },
  {
    key: "urinary_casts",
    label: "Cilindri urinari",
    panel: "urine",
    aliases: ["cilindri\\s+(?:urinari|urine)?", "casts?\\s+urinari?"],
  },
  {
    key: "leucocituria",
    label: "Leucocituria",
    panel: "urine",
    aliases: ["leucocituria", "leucociti\\s+nelle\\s+urine", "piuria"],
  },
  {
    key: "hematuria",
    label: "Ematuria (qualitativa)",
    panel: "urine",
    aliases: ["microematuria\\b(?!\\s+quantitativa)", "macroematuria", "ematuria(?!\\s+\\d)"],
  },
  {
    key: "elettroforesi_referto",
    label: "Elettroforesi (ELF)",
    panel: "elettroforesi",
    aliases: ["ELF", "elettroforesi(?:\\s+sieroproteica)?"],
  },
  {
    key: "igg",
    label: "IgG (Immunoglobuline G)",
    panel: "immunoglobuline",
    aliases: ["\\bIgG\\b(?!\\s*\\d)"],
  },
  {
    key: "iga",
    label: "IgA (Immunoglobuline A)",
    panel: "immunoglobuline",
    aliases: ["\\bIgA\\b(?!\\s*\\d)"],
  },
  {
    key: "igm",
    label: "IgM (Immunoglobuline M)",
    panel: "immunoglobuline",
    aliases: ["\\bIgM\\b(?!\\s*\\d)"],
  },
  {
    key: "antithrombin",
    label: "Antitrombina III",
    panel: "funzione",
    aliases: ["antitrombina\\s+III\\b", "antitrombina\\s+3\\b", "anti.?trombina\\b", "AT\\s*III\\b"],
  },
  {
    key: "hb_qual",
    label: "Hb / Emoglobina (qualitativa)",
    panel: "emocromo",
    // Gestisce "emoglobina +" o "Hb +" usati come flag di anomalia nel sedimento urinario
    aliases: ["emoglobina", "\\bHb(?!\\s+urine|\\s+stick)\\b"],
  },
  {
    // "all'EP lieve elevazione beta 2" — l'alias include il qualificatore inline
    // positiveIfNoQual: il match stesso segnala l'alterazione → status positive
    key: "beta2_glob",
    label: "β2-globuline (ELP)",
    panel: "elettroforesi",
    aliases: ["(?:lieve\\s+)?(?:elevazione|aumento)\\s+(?:delle?\\s+)?beta[.\\-\\s]?2(?:\\s+glob(?:uline)?)?"],
    positiveIfNoQual: true,
  },
];

// ─── Lab catalog export ───────────────────────────────────────────────────────
// Compact representation used by ImportVisitFromTextModal to power the
// "Aggiungi esame non rilevato" inline search.
const PANEL_LABELS_MAP = {
  fase_acuta:    "Infiammazione",
  emocromo:      "Emocromo",
  complemento:   "Complemento",
  autoanticorpi: "Autoanticorpi",
  funzione:      "Funzione",
  urine:         "Urine",
  elettroforesi: "Elettroforesi",
  custom:        "Personalizzato",
};

export const LAB_CATALOG = [
  ...PARAMS.map(p => ({
    key:        p.key,
    label:      p.label,
    panel:      p.panel,
    panelLabel: PANEL_LABELS_MAP[p.panel] || p.panel,
    defaultUnit: p.defaultUnit || "",
  })),
  ...PANEL_QUAL_LABELS.map(p => ({
    key:        p.key,
    label:      p.label,
    panel:      p.panel,
    panelLabel: PANEL_LABELS_MAP[p.panel] || p.panel,
    defaultUnit: "",
  })),
];

// Qualificatori testuali di "normale" (case-insensitive)
const NN_PATTERN = /\bnn\b|\bnella\s+norma\b|\bneg(?:ativo)?\b|\bin\s+norma\b|\bnot?m(?:ale)?\b/i;

// Qualificatori accettati nelle regex qualitative (esteso)
const QUAL_NORM_RE = `nn|nella\\s+norma|nei\\s+limiti|neg(?:ativ[oaie]?)?|in\\s+norma|norm(?:ale)?|assente|non\\s+significativ[oaie]?|non\\s+consumat[oaie]?|ipoalbuminemia|iperalbuminemia`;

// ── Helper: costruisce un risultato qualitativo standard ─────────────────────
function makeQualResult(key, label, panel, qualitative, status, sourceText) {
  return {
    id:             `${key}_nn_${Math.random().toString(36).slice(2, 7)}`,
    key,
    label,
    panel,
    value:          null,
    qualitative,
    unit:           "",
    normalizedValue: null,
    normalizedUnit:  null,
    status,
    detectedRange:  null,
    sourceText:     sourceText.trim(),
  };
}

// ── Deferred-qualifier extractor ─────────────────────────────────────────────
// Gestisce: "IgG, IgA, IgM nei limiti" — qualitativo DOPO l'elenco virgolato.
// Gestisce: "c3, c4, c1q non consumato" — stessa logica per complemento.
// Pattern: due o più alias (separati da ", ") seguiti da un qualitativo.
const DEFERRED_QUAL_GROUPS = [
  {
    // IgG / IgA / IgM — possono comparire in qualsiasi ordine
    keys:    ["igg", "iga", "igm"],
    labels:  { igg: "IgG (Immunoglobuline G)", iga: "IgA (Immunoglobuline A)", igm: "IgM (Immunoglobuline M)" },
    panel:   "immunoglobuline",
    aliases: { igg: /\bIgG\b/i, iga: /\bIgA\b/i, igm: /\bIgM\b/i },
  },
  {
    // Complemento C3 / C4 / C1q
    keys:    ["c3", "c4", "c1q"],
    labels:  { c3: "Complemento C3", c4: "Complemento C4", c1q: "Complemento C1q" },
    panel:   "complemento",
    aliases: { c3: /\bC3\b/i, c4: /\bC4\b/i, c1q: /\bC1q\b/i },
  },
  {
    // Sierologie HBV/HCV/HIV — "sierologie per HBV, HCV, HIV negativi"
    keys:    ["hbv", "hcv", "hiv"],
    labels:  { hbv: "HBV (HBsAg)", hcv: "HCV (Anti-HCV)", hiv: "HIV" },
    panel:   "autoanticorpi",
    aliases: { hbv: /\bHBV\b|\bHBsAg\b/i, hcv: /\bHCV\b|\banti.?HCV\b/i, hiv: /\bHIV\b|\banti.?HIV\b/i },
  },
  {
    // ANA + ANCA — "ANA, ANCA negativi"
    keys:    ["ana_titolo", "anca"],
    labels:  { ana_titolo: "ANA - Titolo", anca: "ANCA (generico)" },
    panel:   "autoanticorpi",
    aliases: { ana_titolo: /\bANA\b/i, anca: /\bANCA\b/i },
  },
];

function extractDeferredQualResults(text) {
  const results = [];

  for (const group of DEFERRED_QUAL_GROUPS) {
    // Cerca segmenti come "IgG, IgA, IgM nei limiti" o "c3, c4, c1q non consumato"
    // Il segmento è: (alias)((?:,\s*alias)*)\s+qualitativo
    const aliasPatterns = group.keys.map(k => group.aliases[k].source).join("|");
    const listRe = new RegExp(
      `(?:${aliasPatterns})(?:(?:,\\s*|\\s*e\\s*)(?:${aliasPatterns}))+` +
      `\\s*[=:,]?\\s*(${QUAL_NORM_RE})(?![\\w\\d])`,
      "gi"
    );
    let m;
    while ((m = listRe.exec(text)) !== null) {
      const segmentText = m[0];
      const rawQ = (m[m.length - 1] || "").trim();
      const qualitative = "nella norma";
      const status = "normal";
      // Quali alias sono presenti nel segmento?
      for (const k of group.keys) {
        if (group.aliases[k].test(segmentText)) {
          results.push(makeQualResult(k, group.labels[k], group.panel, qualitative, status, segmentText));
        }
      }
    }
  }

  return results;
}

function extractQualitativeResults(text) {
  const results = [];

  // 0. Deferred-qualifier lists: "IgG, IgA, IgM nei limiti", "c3, c4, c1q non consumato"
  const deferredResults = extractDeferredQualResults(text);
  const deferredKeys = new Set(deferredResults.map(r => r.key));
  results.push(...deferredResults);

  // 1. PARAM nn — parametri noti con qualificatore testuale invece del numero
  for (const param of PARAMS) {
    if (deferredKeys.has(param.key)) continue;
    const aliasPattern = param.aliases.join("|");
    // Cerca: ALIAS [qualificatore-temporale-opzionale]? [=:]? (nn|nella norma|negativa|assente|…)
    //
    // Il qualificatore temporale (?:\s+\d{1,3}\s*(?:h(?:r|our)?|ore)\b)? gestisce il caso
    // "proteinuria 24h nn" dove "24h" è il tempo di raccolta, NON il valore misurato.
    // Senza questa parte la regex non trova "nn" e il numero 24 viene estratto come valore
    // producendo il risultato clinicamente falso "24 g/24h".
    //
    // Qualificatori normali ampliati per includere negativa, assente, non significativa
    // (regola: meglio nessun dato che un dato falso).
    const re = new RegExp(
      `(?:${aliasPattern})(?:\\s+\\d{1,3}\\s*(?:h(?:r|our)?|ore)(?:\\b|s\\b))?\\s*[=:]?\\s*(${QUAL_NORM_RE})(?!\\d)`,
      "gi"
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      results.push(makeQualResult(param.key, param.label, param.panel, "nella norma", "normal", m[0]));
    }
  }

  // 2. EU nn / ELF nn / emoglobinuria positiva — pannelli speciali
  for (const pql of PANEL_QUAL_LABELS) {
    if (deferredKeys.has(pql.key)) continue;
    const aliasPattern = pql.aliases.join("|");

    // positiveIfNoQual: "emoglobinuria" senza qualitativo = presente/positiva
    // (a meno che non sia seguita da "neg" o "assente")
    if (pql.positiveIfNoQual) {
      const noQualRe = new RegExp(
        `(?:${aliasPattern})(?:\\s+(?:ma\\b[^,;.\\n]*))?(?=\\s*[,;.\\n]|$)`,
        "gi"
      );
      let mq;
      while ((mq = noQualRe.exec(text)) !== null) {
        // Non matchare se c'è subito un qualificatore negativo/normale
        const after = text.slice(mq.index + mq[0].length, mq.index + mq[0].length + 40);
        if (/^\s*[=:,]?\s*(?:neg(?:ativ[oaie]?)?|assente|-|nn|nella\s+norma|nei\s+limiti)/i.test(after)) continue;
        results.push(makeQualResult(pql.key, pql.label, pql.panel, "positivo", "positive", mq[0]));
      }
      // Fall through: also try explicit qualitative match below
    }

    const re = new RegExp(
      `(?:${aliasPattern})\\s*[=:,]?\\s*(\\+|pos(?:itiv[oaie]?)?|${QUAL_NORM_RE}|-)(?![\\d])`,
      "gi"
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      const rawQ = (m[1] || "").trim();
      let qualitative, status;
      if (rawQ === "+" || /^pos(?:itiv[oaie]?)?$/i.test(rawQ)) {
        qualitative = "positivo"; status = "positive";
      } else if (/ipoalbuminemia|iperalbuminemia/i.test(rawQ)) {
        qualitative = rawQ.toLowerCase(); status = rawQ.toLowerCase().startsWith("ipo") ? "low" : "high";
      } else {
        qualitative = "nella norma"; status = "normal";
      }
      results.push(makeQualResult(pql.key, pql.label, pql.panel, qualitative, status, m[0]));
    }
  }

  return results;
}

// ─── Autoantibody extractor ───────────────────────────────────────────────────
// Gestisce sintassi +/−, titolo ANA, anticardiolipina composta,
// numeri con asterisco (* = fuori norma) e "restanti APL negativi".

function parseAbStatus(raw) {
  const s = (raw || "").trim();
  if (s === "+" || /^pos(?:itiv[oaie]?)?$/i.test(s)) return { qualitative: "positivo",    status: "positive" };
  if (s === "-" || /^neg(?:ativ[oaie]?)?$/i.test(s)) return { qualitative: "negativo",     status: "negative" };
  if (/^nn$|^nella\s+norma$|^in\s+norma$|^norm(?:ale)?$|^nei\s+limiti$|^non\s+consumat[oaie]?$/i.test(s)) return { qualitative: "nella norma", status: "normal" };
  return null;
}

const AUTOAB_QUAL = [
  { key: "fr",              label: "Fattore Reumatoide (FR)",    aliases: ["\\bFR\\b", "fattore\\s+reumatoide"] },
  { key: "acpa_anti_ccp",   label: "Anti-CCP (ACPA)",            aliases: ["\\bACPA\\b", "anti.?CCP\\b", "anticorpi\\s+anti.?CCP"] },
  { key: "anti_dsdna",      label: "Anti-dsDNA",                  aliases: ["(?:anti.?)?ds.?DNA\\b", "anti.?dsDNA\\b", "DNA\\s+nativ[oi]", "DNA\\s+ds"] },
  { key: "anti_sm",         label: "Anti-Sm",                     aliases: ["(?:anti.?)?\\bSm\\b(?!\\s*RNP)"] },
  { key: "anti_rnp",        label: "Anti-RNP/U1RNP",              aliases: ["(?:anti.?)?(?:U1.?)?RNP\\b", "anti.?RNP/Sm\\b", "anti.?Sm/RNP\\b"] },
  { key: "anti_ssa_ro",     label: "Anti-SSA/Ro",                 aliases: ["(?:anti.?)?\\bSSA\\b", "(?:anti.?)?\\bRo\\b(?!/SSA)", "anti.?Ro/SSA\\b", "anti.?SSA/Ro\\b"] },
  { key: "anti_ssb_la",     label: "Anti-SSB/La",                 aliases: ["(?:anti.?)?\\bSSB\\b", "(?:anti.?)?\\bLa\\b(?!/SSB)", "anti.?La/SSB\\b", "anti.?SSB/La\\b"] },
  { key: "anti_scl70",      label: "Anti-Scl-70",                  aliases: ["(?:anti.?)?Scl.?70\\b", "anti.?topoisomerasi\\s+I\\b", "anti.?topo\\s*I\\b"] },
  { key: "anti_centromero", label: "Anti-centromero (ACA)",       aliases: ["(?:anti.?)?centromero\\b", "\\bACA\\b", "anti.?CENP.?B\\b"] },
  { key: "anti_rnap3",      label: "Anti-RNA polimerasi III",      aliases: ["(?:anti.?)?RNA.?pol(?:imerasi)?\\s*III\\b", "(?:anti.?)?RNAP3\\b", "anti.?RNA\\s+pol(?:ymerase)?\\s*3\\b"] },
  { key: "anti_pmscl",      label: "Anti-PM/Scl",                  aliases: ["(?:anti.?)?PM.?Scl\\b", "(?:anti.?)?PM/Scl\\b"] },
  { key: "anti_ku",         label: "Anti-Ku",                      aliases: ["(?:anti.?)?\\bKu\\b"] },
  { key: "anti_jo1",        label: "Anti-Jo-1",                    aliases: ["(?:anti.?)?Jo.?1\\b"] },
  { key: "anti_mi2",        label: "Anti-Mi-2",                    aliases: ["(?:anti.?)?Mi.?2\\b"] },
  { key: "anti_mda5",       label: "Anti-MDA5",                    aliases: ["(?:anti.?)?MDA.?5\\b"] },
  { key: "anti_tif1g",      label: "Anti-TIF1γ",                   aliases: ["(?:anti.?)?TIF1.?(?:gamma|γ|g)\\b"] },
  { key: "anti_nxp2",       label: "Anti-NXP2",                    aliases: ["(?:anti.?)?NXP.?2\\b"] },
  { key: "anti_srp",        label: "Anti-SRP",                     aliases: ["(?:anti.?)?\\bSRP\\b"] },
  { key: "anti_hmgcr",      label: "Anti-HMGCR",                   aliases: ["(?:anti.?)?HMGCR\\b"] },
  { key: "lac",             label: "Lupus Anticoagulant (LAC)",    aliases: ["\\bLAC\\b", "lupus\\s+anticoagulant"] },
  { key: "anca_pr3",        label: "ANCA / Anti-PR3 (c-ANCA)",     aliases: ["c.?ANCA\\b", "anti.?PR.?3\\b", "ANCA.?PR3\\b"] },
  { key: "anca_mpo",        label: "ANCA / Anti-MPO (p-ANCA)",     aliases: ["p.?ANCA\\b", "anti.?MPO\\b", "ANCA.?MPO\\b"] },
  { key: "anca",            label: "ANCA (generico)",               aliases: ["(?<![cp]-)\\bANCA\\b(?![-/\\s]*(?:PR3|MPO)\\b)"] },
  { key: "antifosfolipidi", label: "Antifosfolipidi",               aliases: ["anticorpi\\s+antifosfolipidi\\b", "\\bantifosfolipidi\\b(?!\\s+(?:IgG|IgM|IgA)\\b)"] },
  { key: "crioglobuline",   label: "Crioglobuline",                 aliases: ["crioglobuline?\\b", "cryoglobulin[es]?\\b"] },
  { key: "hbv",             label: "HBV (HBsAg)",                   aliases: ["\\bHBV\\b(?:\\s+reflex\\b)?", "\\bHBsAg\\b", "epatite\\s+B"] },
  { key: "hcv",             label: "HCV (Anti-HCV)",                 aliases: ["\\bHCV\\b", "anti.?HCV\\b", "epatite\\s+C"] },
  { key: "hiv",             label: "HIV",                            aliases: ["\\bHIV\\b", "anti.?HIV\\b"] },
  { key: "tb_qft",          label: "Quantiferon (TB-QFT/IGRA)",      aliases: ["\\bQuantiferon\\b", "\\bQFT\\b(?![-\\d])", "\\bIGRA\\b"] },
];

const AUTOAB_NUMERIC = [
  { key: "fr",            label: "Fattore Reumatoide (FR)", aliases: ["\\bFR\\b", "fattore\\s+reumatoide"],                unit: "UI/mL",  refHigh: 14  },
  { key: "acpa_anti_ccp", label: "Anti-CCP (ACPA)",        aliases: ["\\bACPA\\b", "anti.?CCP\\b"],                       unit: "U/mL",   refHigh: 17  },
  { key: "anti_dsdna",    label: "Anti-dsDNA",              aliases: ["(?:anti.?)?ds.?DNA\\b", "anti.?dsDNA\\b"],          unit: "UI/mL",  refHigh: 100 },
  { key: "anca_pr3",      label: "ANCA / Anti-PR3",         aliases: ["c.?ANCA\\b", "anti.?PR.?3\\b"],                    unit: "UI/mL",  refHigh: 7   },
  { key: "anca_mpo",      label: "ANCA / Anti-MPO",         aliases: ["p.?ANCA\\b", "anti.?MPO\\b"],                      unit: "UI/mL",  refHigh: 7   },
];

function extractAutoantibodies(text) {
  if (!text?.trim()) return [];
  const results = [];
  const seen = new Set();

  function makeAbResult(key, label, qualitative, status, value, unit, sourceText) {
    return {
      id:             `${key}_ab_${Math.random().toString(36).slice(2, 7)}`,
      key,
      label,
      panel:          "autoanticorpi",
      value:          value ?? null,
      qualitative:    qualitative ?? null,
      unit:           unit || "",
      normalizedValue: null,
      normalizedUnit:  null,
      status,
      detectedRange:   null,
      sourceText:      sourceText || "",
    };
  }

  // ── 1. Qualitative +/− patterns ──────────────────────────────────────────
  const POS_NEG_PAT = `\\s*[=:]?\\s*(\\+|pos(?:itiv[oaie]?)?|neg(?:ativ[oaie]?)?|-|nn|nella\\s+norma|nei\\s+limiti|in\\s+norma|norm(?:ale)?|non\\s+consumat[oaie]?)(?![\\w\\d])`;
  for (const p of AUTOAB_QUAL) {
    if (seen.has(p.key)) continue;
    const re = new RegExp(`(?:${p.aliases.join("|")})${POS_NEG_PAT}`, "gi");
    let m;
    while ((m = re.exec(text)) !== null) {
      const raw = m[m.length - 1];
      const qs = parseAbStatus(raw);
      if (!qs) continue;
      seen.add(p.key);
      results.push(makeAbResult(p.key, p.label, qs.qualitative, qs.status, null, "", m[0].trim()));
      break;
    }
  }

  // ── 2. ANA titer/pattern: "ANA 1:160 nucleolare" ─────────────────────────
  if (!seen.has("ana_titolo")) {
    const anaRe = /\bANA\b\s*(?:titolo\s*)?[=:]?\s*(\d+:\d+)(?:\s+([a-zA-Z]\w*))?/gi;
    const m = anaRe.exec(text);
    if (m) {
      const titolo  = m[1].trim();
      const pattern = (m[2] || "").trim();
      seen.add("ana_titolo");
      results.push(makeAbResult("ana_titolo",  "ANA - Titolo",   titolo,  "positive", null, "1:n", m[0].trim()));
      if (pattern && !seen.has("ana_pattern")) {
        seen.add("ana_pattern");
        results.push(makeAbResult("ana_pattern", "ANA - Pattern", pattern, "positive", null, "", pattern));
      }
    }
  }
  // ANA qualitative without titer: "ANA +" or "ANA neg"
  if (!seen.has("ana_titolo")) {
    const anaQRe = /\bANA\b\s*[=:]?\s*(\+|pos(?:itiv[oaie]?)?|neg(?:ativ[oaie]?)?|-)/gi;
    const m = anaQRe.exec(text);
    if (m) {
      const qs = parseAbStatus(m[1]);
      if (qs) {
        seen.add("ana_titolo");
        results.push(makeAbResult("ana_titolo", "ANA - Titolo", qs.qualitative, qs.status, null, "", m[0].trim()));
      }
    }
  }

  // ── 3. anticardiolipina compound: "anticardiolipina IgG 150*, IgM neg" ───
  {
    const aclRe = /anti.?cardiolipina\b([^.;\n]{0,160})/gi;
    let aclM;
    while ((aclM = aclRe.exec(text)) !== null) {
      const ctx = aclM[1];

      if (!seen.has("acl_igg")) {
        const iggNum = /IgG\s*[=:]?\s*([\d]+(?:[.,]\d+)?)\s*(\*)?/i.exec(ctx);
        if (iggNum) {
          const val = parseNum(iggNum[1]);
          if (!isNaN(val)) {
            const pos = !!iggNum[2];
            const st  = pos ? "positive" : (val > 10 ? "high" : "normal");
            seen.add("acl_igg");
            results.push(makeAbResult("acl_igg", "Anti-cardiolipina IgG", null, st, val, "GPL/mL",
              ("anticardiolipina IgG " + iggNum[1] + (pos ? "*" : "")).trim()));
          }
        }
      }
      if (!seen.has("acl_igg")) {
        const iggQ = /IgG\s*[=:]?\s*(\+|pos(?:itiv[oa])?|neg(?:ativ[oa])?|-)/i.exec(ctx);
        if (iggQ) {
          const qs = parseAbStatus(iggQ[1]);
          if (qs) { seen.add("acl_igg"); results.push(makeAbResult("acl_igg", "Anti-cardiolipina IgG", qs.qualitative, qs.status, null, "GPL/mL", iggQ[0].trim())); }
        }
      }

      if (!seen.has("acl_igm")) {
        const igmNum = /IgM\s*[=:]?\s*([\d]+(?:[.,]\d+)?)\s*(\*)?/i.exec(ctx);
        if (igmNum) {
          const val = parseNum(igmNum[1]);
          if (!isNaN(val)) {
            const pos = !!igmNum[2];
            const st  = pos ? "positive" : (val > 10 ? "high" : "normal");
            seen.add("acl_igm");
            results.push(makeAbResult("acl_igm", "Anti-cardiolipina IgM", null, st, val, "MPL/mL",
              ("anticardiolipina IgM " + igmNum[1] + (pos ? "*" : "")).trim()));
          }
        }
      }
      if (!seen.has("acl_igm")) {
        const igmQ = /IgM\s*[=:]?\s*(\+|pos(?:itiv[oa])?|neg(?:ativ[oa])?|-)/i.exec(ctx);
        if (igmQ) {
          const qs = parseAbStatus(igmQ[1]);
          if (qs) { seen.add("acl_igm"); results.push(makeAbResult("acl_igm", "Anti-cardiolipina IgM", qs.qualitative, qs.status, null, "MPL/mL", igmQ[0].trim())); }
        }
      }
    }
  }

  // ── 4. Anti-β2GP1 compound: "β2GP1 IgG +, IgM neg" ──────────────────────
  {
    const b2Re = /(?:anti.?)?[Ββ]2.?GP1?\b([^.;\n]{0,120})/gi;
    let b2M;
    while ((b2M = b2Re.exec(text)) !== null) {
      const ctx = b2M[1];
      if (!seen.has("b2gp1_igg")) {
        const q = /IgG\s*[=:]?\s*(\+|pos(?:itiv[oa])?|neg(?:ativ[oa])?|-)/i.exec(ctx);
        if (q) { const qs = parseAbStatus(q[1]); if (qs) { seen.add("b2gp1_igg"); results.push(makeAbResult("b2gp1_igg", "Anti-β2GP1 IgG", qs.qualitative, qs.status, null, "U/mL", q[0].trim())); } }
      }
      if (!seen.has("b2gp1_igm")) {
        const q = /IgM\s*[=:]?\s*(\+|pos(?:itiv[oa])?|neg(?:ativ[oa])?|-)/i.exec(ctx);
        if (q) { const qs = parseAbStatus(q[1]); if (qs) { seen.add("b2gp1_igm"); results.push(makeAbResult("b2gp1_igm", "Anti-β2GP1 IgM", qs.qualitative, qs.status, null, "U/mL", q[0].trim())); } }
      }
    }
  }

  // ── 5. Numeric autoantibodies with optional * ─────────────────────────────
  for (const p of AUTOAB_NUMERIC) {
    if (seen.has(p.key)) continue;
    const re = new RegExp(`(?:${p.aliases.join("|")})[:\\s=]*([\\d]+(?:[.,][\\d]+)?)\\s*(\\*)?`, "gi");
    let m;
    while ((m = re.exec(text)) !== null) {
      if (seen.has(p.key)) continue;
      const val = parseNum(m[1]);
      if (isNaN(val)) continue;
      const pos = !!m[2];
      const st  = pos ? "positive" : inferStatus({ referenceHigh: p.refHigh }, val, null);
      seen.add(p.key);
      results.push(makeAbResult(p.key, p.label, null, st, val, p.unit, m[0].trim()));
      break;
    }
  }

  // ── 6. "Restanti APL negativi" — bulk negative for unlisted APL tests ─────
  if (/restant[ei]\s+APL\s+negativ[ei]/i.test(text)) {
    const aplFallback = [
      ["b2gp1_igg", "Anti-β2GP1 IgG"],
      ["b2gp1_igm", "Anti-β2GP1 IgM"],
      ["acl_igg",   "Anti-cardiolipina IgG"],
      ["acl_igm",   "Anti-cardiolipina IgM"],
    ];
    for (const [k, lbl] of aplFallback) {
      if (!seen.has(k)) {
        seen.add(k);
        results.push(makeAbResult(k, lbl, "negativo", "negative", null, "", "restanti APL negativi"));
      }
    }
  }

  return results;
}

// ─── Core extraction function ─────────────────────────────────────────────────

const NUM_RE = "([\\d]+(?:[.,][\\d]+)?)";

/**
 * Parse `text` and return an array of found lab value matches.
 *
 * Each match:
 * {
 *   id             — unique key for React
 *   key            — parameter key (e.g. "crp")
 *   label          — human label (e.g. "PCR / CRP")
 *   panel          — LabExam panel string
 *   value          — number (as parsed from text)
 *   unit           — string as found in text (or defaultUnit)
 *   normalizedValue — number | null
 *   normalizedUnit  — string | null
 *   status         — "high" | "low" | "normal" | undefined
 *   detectedRange  — { low?, high? } | null  (from inline ref-range if found)
 *   sourceText     — the matched substring
 * }
 */
export function extractLabValues(rawText) {
  if (!rawText?.trim()) return [];

  // Normalize Italian LIS "Conteggio [piastrine]  VALUE  10^9/L" → "PLT VALUE 10^9/L"
  const text = rawText.replace(
    /\bconteggio(?:\s+piastrine)?\b(\s+[\d,.]+\s+10\^9\/[Ll])/gi,
    'PLT$1'
  );

  // 1. Risultati qualitativi (nn, nella norma, EU nn, ELF nn…)
  const qualResults = extractQualitativeResults(text);
  // Deduplication: keep only first result per key in qualResults
  const qualResultsDeduped = [];
  const qualKeysSeen = new Set();
  for (const r of qualResults) {
    if (!qualKeysSeen.has(r.key)) { qualKeysSeen.add(r.key); qualResultsDeduped.push(r); }
  }
  const qualKeys = new Set(qualResultsDeduped.map((r) => r.key));

  // 2. Pattern slash-group (GOT/GPT/GGT = 21/25/21)
  const slashResults = extractSlashGroupValues(text);
  const slashKeys = new Set(slashResults.map((r) => `${r.key}::${r.value}`));
  // Also track slash keys by param key alone (to prevent re-extraction by numeric pass)
  const slashParamKeys = new Set(slashResults.map((r) => r.key));

  // 3. Autoanticorpi (+/−, ANA titolo/pattern, anticardiolipina composta…)
  const abResults = extractAutoantibodies(text);
  // De-duplicate with qualResults (deferred lists may have already captured some)
  const abResultsDeduped = abResults.filter(r => !qualKeys.has(r.key));
  const abKeys = new Set(abResultsDeduped.map((r) => r.key));

  // 4. Urine count values — numero PRIMA dell'alias ("17 emazie/campo")
  const urineCountResults = extractUrineCountValues(text);
  const urineCountKeys = new Set(urineCountResults.map((r) => r.key));

  const results = [...qualResultsDeduped, ...slashResults, ...abResultsDeduped, ...urineCountResults];

  for (const param of PARAMS) {
    const namePattern = param.aliases.join("|");
    const unitPattern = (param.knownUnits || []).join("|");

    const fullRegex = new RegExp(
      `(?:${namePattern})(?:\\s*\\([^)]*\\))?[:\\s=]*${NUM_RE}\\s*[<>*]?\\s*(?:(${unitPattern || "\\S+"}))?`,
      "gi"
    );

    let match;
    while ((match = fullRegex.exec(text)) !== null) {
      const rawValue = parseNum(match[1]);
      if (isNaN(rawValue)) continue;

      // ── Time-qualifier guard ────────────────────────────────────────────────
      // If the matched number is immediately followed by a time qualifier
      // (h, hr, hour, ore) the number is a COLLECTION PERIOD, not a measured value.
      // Example: "proteinuria 24h nn" — "24" = 24-hour collection window.
      // Without this guard, rawValue=24 with defaultUnit="g/24h" → false "24 g/24h".
      // Rule: better no data than wrong data (per clinical safety policy).
      const _afterNum = text.slice(match.index + match[0].length);
      if (/^(?:h(?:r|our)?|ore)(?:s\b|\b|$)/i.test(_afterNum)) continue;

      const foundUnit  = match[2]?.trim() || param.defaultUnit;
      const matchEnd   = match.index + match[0].length;
      const sourceText = match[0].trim();

      // Try to find an inline reference range right after the match
      const detectedRange = findReferenceRange(text, matchEnd);

      let normalizedValue = null;
      let normalizedUnit  = null;
      if (param.normalize) {
        const norm = param.normalize(rawValue, foundUnit);
        if (norm) {
          normalizedValue = norm.value;
          normalizedUnit  = norm.unit;
        }
      }

      const valueForStatus = normalizedValue ?? rawValue;

      // If the value was unit-converted, apply the same conversion to the detected
      // reference range so the comparison stays in the same scale.
      // Example: PCR 0.4 mg/dL (v.n. 0-0.5) → normalize value→4 mg/L AND
      //          range high 0.5 mg/dL → 5 mg/L, so 4 < 5 = NORMAL.
      let finalDetectedRange = detectedRange;
      if (param.normalize && normalizedValue !== null && detectedRange) {
        const tryNorm = (v) => {
          if (v == null) return v;
          const n = param.normalize(v, foundUnit);
          return n != null ? n.value : v;
        };
        finalDetectedRange = {
          ...(detectedRange.low  != null ? { low:  tryNorm(detectedRange.low)  } : {}),
          ...(detectedRange.high != null ? { high: tryNorm(detectedRange.high) } : {}),
        };
      }

      // Salta se l'unità trovata è nella lista di esclusione (es. % per formula leucocitaria)
      if (param.excludeIfUnit?.some(u => new RegExp(`^${u}$`, 'i').test(foundUnit))) continue;

      // Salta se già trovato come qualitativo, slash-group, autoanticorpo o urine-count
      if (qualKeys.has(param.key)) continue;
      if (slashParamKeys.has(param.key)) continue;
      if (abKeys.has(param.key)) continue;
      if (urineCountKeys.has(param.key)) continue;

      const unitInferred = !match[2]?.trim();
      const confidence   = (HIGH_RISK_KEYS.has(param.key) && unitInferred) ? "low" : "high";
      const reviewReason = confidence === "low"
        ? `Unità non specificata nel testo — assunta "${foundUnit}" (parametro ad alto rischio). Verifica obbligatoria prima del salvataggio.`
        : null;

      results.push({
        id:             `${param.key}_${results.length}_${Math.random().toString(36).slice(2, 7)}`,
        key:            param.key,
        label:          param.label,
        panel:          param.panel,
        value:          rawValue,
        unit:           foundUnit,
        normalizedValue,
        normalizedUnit: normalizedUnit || param.normalizedUnit || null,
        status:         inferStatus(param, valueForStatus, finalDetectedRange, foundUnit),
        detectedRange:  finalDetectedRange,
        sourceText,
        inferred_unit:  unitInferred,
        confidence,
        review_reason:  reviewReason,
      });
    }
  }

  return results;
}

/**
 * Splits text by date-header markers and extracts lab values per date group.
 *
 * A "date header" is a date that appears:
 *   - alone on its own line: "15/03/2024"
 *   - after Italian intro words: "del 15/03/2024", "Esami del 15/03/2024:"
 *
 * Returns:
 *   [{ date: "YYYY-MM-DD" | null, displayDate: "DD/MM/YYYY" | null, items: LabItem[] }]
 *
 * If no date markers are found, returns a single group with date = null
 * (identical to calling extractLabValues directly).
 */
export function extractLabValuesByDate(text) {
  if (!text?.trim()) return [];

  // Match a date that STARTS a line (^ with m flag) with an optional bullet
  // (-, *, •) and an optional intro prefix, which must be ONE of:
  //   a) known Italian multi-word phrases ("Esami del", "del", "in data", …)
  //   b) a short abbreviation (≤8 chars) + non-space separator ("EE=", "LAB:")
  //   c) a very short abbreviation (≤6 chars) + space ("EE ", "VES ")
  // The intro is capped to ONE word/phrase unit so clinical sentences like
  // "Visita del paziente … al 15/03/2024" are NOT treated as date headers.
  // Values may follow on the same line after the date ("EE 11/11/25: Hb 15").
  // Supports both 4-digit and 2-digit years (e.g. "esami ematici 7/9/21:").
  // Gestisce anche date tra parentesi: "- Esami ( 4/1/22) :" e "- EE (28/12/24):"
  // \(? rende opzionale la parentesi aperta; \s*\)? quella chiusa.
  const DATE_HEADER_RE =
    /^[ \t]*[-*•]?[ \t]*(?:(?:esami\s+(?:ematici\s+)?(?:del\s+)?|prelievo\s+del\s+|laboratorio\s+del\s+|referto\s+del\s+|in\s+data\s+|data[=:\s]+|del\s+)|(?:[A-Za-z\u00C0-\u024F]{1,8}[=:\-]+[ \t]*)|(?:[A-Za-z\u00C0-\u024F]{1,6}[ \t]+))?\(?[ \t]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})[ \t]*\)?[ \t]*[:\-]?[ \t]*/gim;

  const markers = [];
  let m;
  while ((m = DATE_HEADER_RE.exec(text)) !== null) {
    const d    = m[1].padStart(2, "0");
    const mo   = m[2].padStart(2, "0");
    const rawY = m[3];
    // Normalise 2-digit year: 00-49 → 20xx, 50-99 → 19xx
    const y = rawY.length === 2
      ? (parseInt(rawY, 10) < 50 ? `20${rawY.padStart(2, "0")}` : `19${rawY.padStart(2, "0")}`)
      : rawY;
    const year = parseInt(y, 10);
    if (year < 1990 || year > 2100) continue;
    markers.push({
      // where previous group ends (\n just before this date line, or 0)
      splitBefore:  m.index > 0 ? m.index - 1 : 0,
      // where this group's content begins (right after the date token + separator)
      contentStart: m.index + m[0].length,
      date:         `${y}-${mo}-${d}`,
      displayDate:  `${d}/${mo}/${y}`,
    });
  }

  // Secondary pass: MM/YYYY headers not captured by the 3-part regex above
  // e.g. "EE 03/2026:", "02/2026:", "5-2019 Hb 14"
  const DATE_HEADER_MY_RE =
    /^[ \t]*[-*•]?[ \t]*(?:(?:esami\s+(?:ematici\s+)?(?:del\s+)?|prelievo\s+del\s+|laboratorio\s+del\s+|referto\s+del\s+|in\s+data\s+|data[=:\s]+|del\s+)|(?:[A-Za-z\u00C0-\u024F]{1,8}[=:\-]+[ \t]*)|(?:[A-Za-z\u00C0-\u024F]{1,6}[ \t]+))?(\d{1,2})[\/\-](\d{4})[ \t]*[:\-]?[ \t]*/gim;
  let m2;
  while ((m2 = DATE_HEADER_MY_RE.exec(text)) !== null) {
    // Skip if this position is already covered by a full-date marker
    const alreadyCovered = markers.some(
      (mk) => mk.splitBefore <= m2.index && m2.index < mk.contentStart,
    );
    if (alreadyCovered) continue;
    const mo   = m2[1].padStart(2, "0");
    const y    = m2[2];
    const year = parseInt(y, 10);
    if (year < 1990 || year > 2100) continue;
    markers.push({
      splitBefore:  m2.index > 0 ? m2.index - 1 : 0,
      contentStart: m2.index + m2[0].length,
      date:         `${y}-${mo}-01`,
      displayDate:  `01/${mo}/${y}`,
    });
  }
  // Terzo pass: mesi italiani — "EE ( agosto 2025 ) :", "( giugno 2022 ) :"
  // Formato comune nelle lettere AUSL Bologna: "- Esami ( mese YYYY ) :"
  const IT_MONTH_MAP = {
    gennaio: "01", febbraio: "02", marzo: "03", aprile: "04",
    maggio: "05", giugno: "06", luglio: "07", agosto: "08",
    settembre: "09", ottobre: "10", novembre: "11", dicembre: "12",
  };
  const DATE_HEADER_IT_RE =
    /^[ \t]*[-*•]?[ \t]*(?:(?:[A-Za-z\u00C0-\u024F]{1,8}[=:\-]+[ \t]*)|(?:[A-Za-z\u00C0-\u024F]{1,6}[ \t]+))?\(?[ \t]*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)[ \t]+(\d{4})[ \t]*\)?[ \t]*[:\-]?[ \t]*/gim;
  let m3;
  while ((m3 = DATE_HEADER_IT_RE.exec(text)) !== null) {
    const alreadyCovered = markers.some(
      (mk) => mk.splitBefore <= m3.index && m3.index < mk.contentStart,
    );
    if (alreadyCovered) continue;
    const mo  = IT_MONTH_MAP[m3[1].toLowerCase()];
    const y   = m3[2];
    const year = parseInt(y, 10);
    if (!mo || year < 1990 || year > 2100) continue;
    markers.push({
      splitBefore:  m3.index > 0 ? m3.index - 1 : 0,
      contentStart: m3.index + m3[0].length,
      date:         `${y}-${mo}-01`,
      displayDate:  `01/${mo}/${y}`,
    });
  }

  // Keep markers in document order after all passes
  markers.sort((a, b) => a.splitBefore - b.splitBefore);

  if (markers.length === 0) {
    const items = extractLabValues(text);
    return items.length > 0 ? [{ date: null, displayDate: null, items }] : [];
  }

  const groups = [];

  // Content before the first date header (if any)
  const prefixText = text.slice(0, markers[0].splitBefore);
  if (prefixText.trim()) {
    const items = extractLabValues(prefixText);
    if (items.length > 0) groups.push({ date: null, displayDate: null, items });
  }

  // One group per date header
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].contentStart;
    const end   = i + 1 < markers.length ? markers[i + 1].splitBefore : text.length;
    const chunk = start <= text.length ? text.slice(start, Math.max(start, end)) : "";
    const items = extractLabValues(chunk);
    if (items.length > 0) {
      groups.push({ date: markers[i].date, displayDate: markers[i].displayDate, items });
    }
  }

  return groups.length > 0 ? groups : [];
}

export { PARAMS as LAB_PARAMS };

// ─── Canonical key lookup ─────────────────────────────────────────────────────
// Unica fonte di verità per normalizzare i nomi degli analiti → chiave canonica.
// Usata da VisitImportButton.apply() per salvare lab_exams con chiavi consistenti.
export const LAB_KEY_CANONICAL_MAP = (() => {
  const map = {};
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  // Auto-build from all three param arrays
  [...PARAMS, ...AUTOAB_QUAL, ...AUTOAB_NUMERIC].forEach((p) => {
    map[p.key] = p.key;
    p.label.split(/[/()+]+/).forEach((part) => {
      const n = slug(part.trim());
      if (n && n.length > 1) map[n] = p.key;
    });
  });

  // Explicit overrides for common Italian/English abbreviations in lab reports
  Object.assign(map, {
    // Inflammation
    pcr: "crp",  crp: "crp",  c_reactive_protein: "crp",  proteina_c_reattiva: "crp",
    ves: "ves",  esr: "ves",  velocita_eritrosedimentazione: "ves",
    ferritina: "ferritin",
    // CBC
    emoglobina: "hb",  hgb: "hb",  hb: "hb",
    gb: "wbc",  leucociti: "wbc",  globuli_bianchi: "wbc",
    neutrofili: "neutrophils",
    linfociti: "lymphocytes",
    eosinofili: "eosinophils",
    piastrine: "plt",
    // Complement
    complemento_c3: "c3",  complemento_c4: "c4",
    // Liver/metabolic
    albumina: "albumin",
    fosfatasi_alcalina: "alp",  fa: "alp",  alp: "alp",
    bilirubina: "bilirubin",
    alt: "alt",  gpt: "alt",
    ast: "ast",  got: "ast",
    cpk: "cpk",  ck: "cpk",  creatinchinasi: "cpk",
    // Renal
    creatinina: "creatinine",  creat: "creatinine",
    egfr: "egfr",  gfr: "egfr",  filtrato_glomerulare: "egfr",
    proteinuria: "proteinuria",
    // Misc
    vitamina_d: "vitd",  vit_d: "vitd",  "25_oh_d": "vitd",
    calcemia: "calcium",
    fosforemia: "phosphorus",
    paratormone: "pth",
    tsh: "tsh",
    uricemia: "uric_acid",  acido_urico: "uric_acid",
    // Autoantibodies qualitative
    fr: "fr",  fattore_reumatoide: "fr",  rf: "fr",
    acpa: "acpa_anti_ccp",  anti_ccp: "acpa_anti_ccp",
    dsdna: "anti_dsdna",
    anti_sm: "anti_sm",
    u1rnp: "anti_rnp",  anti_rnp: "anti_rnp",
    anti_ssa: "anti_ssa_ro",  anti_ro: "anti_ssa_ro",
    anti_ssb: "anti_ssb_la",  anti_la: "anti_ssb_la",
    scl_70: "anti_scl70",
    aca: "anti_centromero",  anti_centromero: "anti_centromero",
    anti_rnap3: "anti_rnap3",
    anti_pmscl: "anti_pmscl",
    anti_jo1: "anti_jo1",
    anti_mi2: "anti_mi2",
    anti_mda5: "anti_mda5",
    anti_tif1g: "anti_tif1g",
    anti_nxp2: "anti_nxp2",
    anti_srp: "anti_srp",
    anti_hmgcr: "anti_hmgcr",
    lac: "lac",
    c_anca: "anca_pr3",  anti_pr3: "anca_pr3",
    p_anca: "anca_mpo",  anti_mpo: "anca_mpo",
    crioglobuline: "crioglobuline",
  });

  return map;
})();

/**
 * Converte un nome di analita (da parser o import) nella chiave canonica ufficiale.
 * Fallback: slug sicuro se non trovato in mappa.
 * @param {string} name
 * @returns {string}
 */
export function toCanonicalLabKey(name) {
  if (!name) return "unknown";
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return LAB_KEY_CANONICAL_MAP[s] || s;
}
