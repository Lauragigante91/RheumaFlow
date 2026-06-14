import {
  resolveCanonical,
  findBestCanonical,
  isMultiInstance,
  getConditionFlags,
  extractConditionModifiers,
  CONDITION_SYNONYMS,
  CANONICAL_MAP,
} from "./conditions";

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

const NEG_TRIGGER_RE =
  /\b(?:nega|non\s+(?:riferisce|riporta|presenta|not[ao]|noti|note)|nessun[aoe]?|assenza\s+di|non)\b/i;

const AFFIRM_CUE_RE =
  /\b(?:present[ei]|in\s+(?:terapia|trattamento)|affett[oa]|not[oa]|noti|storia\s+di|riscontro\s+di|diagnosi\s+di)\b/i;

const STRIP_NEG_RE =
  /^\s*(?:nega|non\s+(?:riferisce|riporta|presenta|not[ao]|noti|note)|nessun[aoe]?|assenza\s+di|non)\s+/i;

const STRIP_AFFIRM_RE =
  /^\s*(?:present[ei]|in\s+(?:terapia|trattamento)\s+per|affett[oa]\s+da|not[oa]|storia\s+di|riscontro\s+di|diagnosi\s+di)\s+/i;

function reTest(re, value) {
  return new RegExp(re.source, re.flags.replace("g", "")).test(value);
}

function stripCues(value) {
  return (value || "").replace(STRIP_NEG_RE, "").replace(STRIP_AFFIRM_RE, "").trim();
}

function resolveExactOrSynonym(cleaned) {
  const t = (cleaned || "").toLowerCase().trim();
  if (!t) return { canonical: null, ambiguous: false };
  const exact = resolveCanonical(t);
  if (exact) return { canonical: exact, ambiguous: false };
  const canonicals = new Set();
  for (const [label, syns] of Object.entries(CONDITION_SYNONYMS)) {
    if (syns.some((s) => s === t)) {
      const c = resolveCanonical(label);
      if (c) canonicals.add(c);
    }
  }
  if (canonicals.size === 1) return { canonical: [...canonicals][0], ambiguous: false };
  if (canonicals.size > 1) return { canonical: null, ambiguous: true };
  return { canonical: null, ambiguous: false };
}

function resolveAny(cleaned) {
  const e = resolveExactOrSynonym(cleaned);
  if (e.canonical) return e.canonical;
  return findBestCanonical(cleaned);
}

function splitClauses(text) {
  const out = [];
  const sentences = text.split(/(?<=[.;\n])\s+/);
  for (const sentence of sentences) {
    const parts = sentence.split(/\s*,\s*|\s+e\s+|\s+ed\s+/i);
    let negated = false;
    for (const part of parts) {
      const p = (part || "").trim();
      if (!p) continue;
      if (reTest(AFFIRM_CUE_RE, p)) negated = false;
      if (reTest(NEG_TRIGGER_RE, p)) negated = true;
      out.push({ text: stripCues(p), negated });
    }
  }
  return out;
}

function uniqByKey(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(item);
  }
  return out;
}

export function analyzeComorbidityText(text) {
  const raw_text = normalizeText(text);
  const recognized_known = [];
  const review = [];
  const negated = [];
  const surgeries = [];

  if (!raw_text) {
    return { raw_text, recognized_known, review, negated, surgeries, confidence: "none" };
  }

  if (reTest(NEGATED_RELEVANT_ABSENCE_RE, raw_text)) {
    negated.push("comorbidità extrareumatologiche rilevanti");
  }

  for (const clause of splitClauses(raw_text)) {
    const t = clause.text;
    if (!t || t.length < 2) continue;

    if (clause.negated) {
      const canonical = resolveAny(t);
      if (canonical) negated.push(CANONICAL_MAP[canonical].label);
      continue;
    }

    if (reTest(SURGERY_RE, t)) {
      surgeries.push(t);
      continue;
    }

    const { cleanedText, status, onset_date } = extractConditionModifiers(t);
    const base = cleanedText || t;

    if (reTest(PRIOR_NEOPLASIA_RE, t)) {
      const r = resolveExactOrSynonym(base);
      review.push({
        kind: "neoplasia",
        label: r.canonical ? CANONICAL_MAP[r.canonical].label : base,
        canonical: r.canonical,
        status: status || "historical",
        onset_date: onset_date || null,
        _raw: t,
      });
      continue;
    }

    if (reTest(RELEVANT_INFECTION_RE, t)) {
      const r = resolveExactOrSynonym(base);
      review.push({
        kind: "infection",
        label: r.canonical ? CANONICAL_MAP[r.canonical].label : base,
        canonical: r.canonical,
        status: status || null,
        onset_date: onset_date || null,
        _raw: t,
      });
      continue;
    }

    const exact = resolveExactOrSynonym(base);
    if (exact.canonical) {
      const canonical = exact.canonical;
      if (status || isMultiInstance(canonical)) {
        review.push({
          kind: isMultiInstance(canonical) ? "multi" : "uncertain",
          label: CANONICAL_MAP[canonical].label,
          canonical,
          status: status || null,
          onset_date: onset_date || null,
          _raw: t,
        });
      } else {
        recognized_known.push({
          canonical,
          label: CANONICAL_MAP[canonical].label,
          flags: getConditionFlags(canonical),
          _raw: t,
        });
      }
      continue;
    }

    if (exact.ambiguous) {
      review.push({ kind: "ambiguous", label: base, canonical: null, status: status || null, onset_date: onset_date || null, _raw: t });
      continue;
    }

    const partial = findBestCanonical(base);
    if (partial) {
      review.push({ kind: "low_confidence", label: CANONICAL_MAP[partial].label, canonical: partial, status: status || null, onset_date: onset_date || null, _raw: t });
      continue;
    }

    review.push({ kind: "unrecognized", label: base, canonical: null, status: status || null, onset_date: onset_date || null, _raw: t });
  }

  const result = {
    raw_text,
    recognized_known: uniqByKey(recognized_known, (x) => x.canonical),
    review: uniqByKey(review, (x) => `${x.kind}:${x.canonical || x.label.toLowerCase()}`),
    negated: uniq(negated),
    surgeries: uniq(surgeries),
    confidence: "none",
  };
  result.confidence = result.recognized_known.length && !result.review.length
    ? "high"
    : (result.recognized_known.length || result.review.length) ? "medium" : "low";
  return result;
}

export default parseComorbidityAprText;
