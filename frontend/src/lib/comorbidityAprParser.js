const NEGATED_RELEVANT_ABSENCE_RE =
  /\b(?:non|nessun[aoe]?|nega|assenza\s+di|non\s+(?:riferisce|riporta|presenta))\s+(?:\w+\s+){0,4}(?:comorbidit[aà]|patolog(?:ie|ia)\s+(?:extrareumatologiche|rilevanti)|condizioni\s+rilevanti)(?=\s|[.,;:]|$)/i;

const NEGATED_SPECIFIC_RE =
  /\b(?:nega|non\s+(?:riferisce|riporta|presenta)|nessun[aoe]?|assenza\s+di)\s+([^.;\n]+)/gi;

const SURGERY_RE =
  /\b(?:pregress[aoei]\s+)?(?:intervento\s+di\s+|intervento\s+chirurgico\s+di\s+)?((?:colecistectomia|appendicectomia|isterectomia|tiroidectomia|tonsillectomia|protesi\s+(?:anca|ginocchio)|by[-\s]?pass|angioplastica|mastectomia|quadrantectomia|laparotomia|laparoscopia|artroprotesi)[^.;\n]*)/gi;

const PRIOR_NEOPLASIA_RE =
  /\b(?:pregress[aoei]\s+)?((?:neoplasia|tumore|carcinoma|melanoma|linfoma|leucemia|mieloma)[^.;\n]*)/gi;

const RELEVANT_INFECTION_RE =
  /\b((?:tbc\s+latente|tubercolosi\s+latente|epatite\s+[bc]|hbv|hcv|hiv|herpes\s+zoster|sepsi)[^.;\n]*)/gi;

const ACTIVE_COMORBIDITY_PATTERNS = [
  { label: "Diabete tipo 2", re: /\b(?:diabete(?:\s+(?:mellito\s+)?tipo\s*2)?|dmt2|dm2)\b/i },
  { label: "Ipertensione arteriosa", re: /\b(?:ipertensione\s+arteriosa|ipertensione|ipa)\b/i },
  { label: "Dislipidemia", re: /\b(?:dislipidemia|ipercolesterolemia|iperlipidemia)\b/i },
  { label: "BPCO", re: /\b(?:bpco|broncopneumopatia\s+cronica\s+ostruttiva)\b/i },
  { label: "Asma bronchiale", re: /\basma\b/i },
  { label: "Fibrillazione atriale", re: /\b(?:fibrillazione\s+atriale|fa)\b/i },
  { label: "Insufficienza renale cronica", re: /\b(?:insufficienza\s+renale\s+cronica|irc|ckd)\b/i },
  { label: "Osteoporosi", re: /\bosteoporosi\b/i },
];

function uniq(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function collectMatches(text, re) {
  const out = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    const value = normalizeText(m[1] || m[0]);
    if (value) out.push(value);
  }
  return uniq(out);
}

function extractNegatedAbsences(text) {
  const out = [];
  if (NEGATED_RELEVANT_ABSENCE_RE.test(text)) {
    out.push("comorbidita extrareumatologiche rilevanti negate");
  }

  let m;
  NEGATED_SPECIFIC_RE.lastIndex = 0;
  while ((m = NEGATED_SPECIFIC_RE.exec(text)) !== null) {
    const fragment = normalizeText(m[1] || "");
    for (const { label, re } of ACTIVE_COMORBIDITY_PATTERNS) {
      if (re.test(fragment)) out.push(`${label} negata`);
    }
  }

  return uniq(out);
}

function stripNegatedClauses(text) {
  return text
    .split(/(?<=[.;\n])\s+/)
    .filter((sentence) => {
      const s = sentence.trim();
      if (!s) return false;
      return !NEGATED_RELEVANT_ABSENCE_RE.test(s) && !/^(?:nega|non\s+(?:riferisce|riporta|presenta)|nessun[aoe]?|assenza\s+di)\b/i.test(s);
    })
    .join(" ");
}

function extractActiveComorbidities(text) {
  const scanText = stripNegatedClauses(text);
  const out = [];
  for (const { label, re } of ACTIVE_COMORBIDITY_PATTERNS) {
    if (re.test(scanText)) out.push(label);
  }
  return uniq(out);
}

function extractOtherApr(text, knownItems) {
  const known = knownItems.map((item) => item.toLowerCase());
  return text
    .split(/[.;\n]+/)
    .map(normalizeText)
    .filter((sentence) => sentence.length > 2)
    .filter((sentence) => !NEGATED_RELEVANT_ABSENCE_RE.test(sentence))
    .filter((sentence) => !/^(?:nega|non\s+(?:riferisce|riporta|presenta)|nessun[aoe]?|assenza\s+di)\b/i.test(sentence))
    .filter((sentence) => !known.some((item) => sentence.toLowerCase().includes(item)))
    .filter((sentence) => !ACTIVE_COMORBIDITY_PATTERNS.some(({ re }) => re.test(sentence)));
}

function confidenceFor(result) {
  const extractedCount = [
    result.active_comorbidities,
    result.negated_relevant_absences,
    result.surgeries,
    result.prior_neoplasia,
    result.relevant_infections,
    result.other_apr,
  ].reduce((sum, arr) => sum + arr.length, 0);

  if (!result.raw_text) return "none";
  if (extractedCount === 0) return "low";
  return result.other_apr.length > 0 ? "medium" : "high";
}

export function parseComorbidityAprText(text) {
  const raw_text = normalizeText(text);
  const negated_relevant_absences = extractNegatedAbsences(raw_text);
  const surgeries = collectMatches(raw_text, SURGERY_RE);
  const prior_neoplasia = collectMatches(raw_text, PRIOR_NEOPLASIA_RE);
  const relevant_infections = collectMatches(raw_text, RELEVANT_INFECTION_RE);
  const active_comorbidities = extractActiveComorbidities(raw_text);
  const other_apr = extractOtherApr(raw_text, [
    ...active_comorbidities,
    ...negated_relevant_absences,
    ...surgeries,
    ...prior_neoplasia,
    ...relevant_infections,
  ]);

  const result = {
    raw_text,
    active_comorbidities,
    negated_relevant_absences,
    surgeries,
    prior_neoplasia,
    relevant_infections,
    other_apr,
    confidence: "none",
  };
  result.confidence = confidenceFor(result);
  return result;
}

export default parseComorbidityAprText;
