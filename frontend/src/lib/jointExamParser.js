/**
 * jointExamParser.js
 *
 * Rule-based parser for Italian rheumatology joint examination text.
 * Recognises dolorabilità / tumefazione / sinovite / artrite + joint names + laterality.
 * Returns a joint map compatible with the Homunculus component plus TJC / SJC.
 *
 * Abbreviations recognised:
 *   dolor / dol       → dolente (tender)
 *   tumor / tum       → tumefatto (swollen)
 *   MCF               → metacarpo-falangea (MCP)
 *   ds / dx           → destra
 *   sn / sin          → sinistra
 *   II-III-IV MCF     → finger list before joint keyword, reordered automatically
 *
 * Output:
 *   {
 *     joints: { [homunculusKey]: "tender" | "swollen" | "both" },
 *     tjc: number,
 *     sjc: number,
 *     found: boolean,
 *     rawSegments: { tender: string[], swollen: string[] }
 *   }
 */

// ── Roman numeral helper ──────────────────────────────────────────────────────
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
function fromRoman(s) { return ROMAN[s.toUpperCase()] ?? null; }
function parseNum(s) {
  const r = fromRoman(s.trim());
  if (r) return r;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

// Given "II-IV", "II-III-IV", "2,3,4", or "III" immediately after a joint keyword,
// return [2,3,4] etc.
// Rules:
//   • Chain joined by dashes/commas/plus with 3+ tokens → explicit list  (II-III-IV → [2,3,4])
//   • Exactly 2 tokens joined by a dash/en-dash          → range          (II-IV     → [2,3,4])
//   • Single token                                        → single value   (III       → [3])
function extractNumbers(text, maxN = 5) {
  const t = text.trimStart();
  // Match a chain: "II-III-IV", "2,3,4", "II, III, IV", "II-IV" etc.
  const chainM = t.match(/^((?:[IVX]+|\d)(?:\s*[-–,+]\s*(?:[IVX]+|\d))+)/i);
  if (chainM) {
    const tokens = chainM[1].split(/\s*[-–,+]\s*/).map(s => parseNum(s.trim())).filter(n => n && n >= 1 && n <= maxN);
    if (tokens.length >= 2) {
      if (tokens.length === 2) {
        // Two endpoints — expand as range
        const [a, b] = tokens;
        if (a <= b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }
      }
      // Three or more explicitly listed — return as-is (deduplicated, sorted)
      return [...new Set(tokens)].sort((a, b) => a - b);
    }
  }
  // Single Roman numeral or digit
  const singleM = t.match(/^([IVX]+|\d)\b/i);
  if (singleM) {
    const n = parseNum(singleM[1]);
    if (n && n >= 1 && n <= maxN) return [n];
  }
  return null; // means "all" for that family
}

// ── Abbreviation expansion ────────────────────────────────────────────────────
// Called before any parsing. Expands clinical shorthand to full Italian words
// so downstream regexes don't need to duplicate abbreviation logic.
function expandAbbreviations(text) {
  return text
    // ── Status abbreviations ──
    // "dolor" standalone → dolente (must not match "dolorabilità", "dolore", etc.)
    .replace(/\bdolor\b/gi, "dolente")
    // "tumor" standalone → tumefatto
    .replace(/\btumor\b/gi, "tumefatto")
    // ── Laterality ──
    // "ds" → destra (careful: only when isolated; "ds" is never part of longer Italian words here)
    .replace(/\bds\b/gi, "destra")
    // "sn" → sinistra
    .replace(/\bsn\b/gi, "sinistra")
    // ── Number-before-joint reordering ──
    // e.g. "II-III-IV MCF" → "MCF II-III-IV"
    // e.g. "II, III MCF"   → "MCF II, III"
    // e.g. "IV MTP"         → "MTP IV"
    // Covers MCF, MCP, PIP, IFP, DIP, MTP written with numbers/Roman numerals before them.
    .replace(
      /\b((?:[IVX]+|\d)(?:\s*[-–,]\s*(?:[IVX]+|\d))*)\s+(MCF|MCP|PIP|IFP|DIP|MTP)\b/gi,
      "$2 $1"
    )
    // ── MCF → MCP (unified internal alias) ──
    .replace(/\bMCF\b/gi, "MCP");
}

// ── Laterality resolver ───────────────────────────────────────────────────────
function parseSides(fragment) {
  const f = fragment.toLowerCase();
  const hasDx = /\b(dx|ds|destra|d\.\s|dex)\b/.test(f);
  const hasSn = /\b(sn|sinistra|sin\.?|s\.\s)\b/.test(f);
  const hasBi = /\b(bilateralmente?|bilat\.?|bilatera\w*|entramb[ei])\b/.test(f);
  if (hasBi || (hasDx && hasSn)) return ["_r", "_l"];
  if (hasDx) return ["_r"];
  if (hasSn) return ["_l"];
  return null;
}

// ── Joint definition table ────────────────────────────────────────────────────
const JOINT_DEFS = [
  // Large / medium joints — order matters (more specific first)
  { re: /\bacromioclavicol\w+\b/i,                             base: "ac"        },
  { re: /\bsternoclavicol\w+\b/i,                              base: "sc"        },
  { re: /\b(?:tmj|atm|temporomandibolar\w+)\b/i,              base: "tmj"       },
  { re: /\bspall[ae]\b/i,                                      base: "shoulder", plural: /\bspalle\b/i },
  { re: /\bgomit[oi]\b/i,                                      base: "elbow",    plural: /\bgomiti\b/i },
  { re: /\bpolsi?\b/i,                                         base: "wrist",    plural: /\bpolsi\b/i  },
  { re: /\banch[ae]\b/i,                                       base: "hip",      plural: /\banche\b/i  },
  { re: /\bginocchi[ao]?\b/i,                                  base: "knee",     plural: /\bginocchia\b/i },
  { re: /\bcavigli[ae]\b/i,                                    base: "ankle",    plural: /\bcaviglie\b/i  },
  // subtalar merged into midtarsal (standard 66/68 counts 1 Tarsus/Midfoot per foot)
  { re: /\bsottastragal\w+|subtalar\b/i,                       base: "midtarsal" },
  { re: /\bmediotars\w+|midtarsal\b|tarso\b/i,                 base: "midtarsal" },
];

// Numbered joint families (MCP, PIP, DIP, MTP)
// MCF is normalised to MCP by expandAbbreviations before this table is used.
const NUMBERED_DEFS = [
  { re: /\b(?:MCP|MCF)\b/i,                                          prefix: "mcp",     range: [1, 5] },
  // PIP fingers — matched only when NOT preceded by "piede/toe" (handled below as toe_pip)
  { re: /\bPIP\b(?!\s+(?:dita?\s+(?:del\s+)?piede|toe))/i,           prefix: "pip",     range: [1, 5] },
  { re: /\bDIP\b/i,                                                   prefix: "dip",     range: [2, 5] },
  { re: /\bMTP\b/i,                                                   prefix: "mtp",     range: [1, 5] },
  // IFP dita del piede / toe PIP → toe_pip prefix
  { re: /\bIFP\s+(?:dita?\s+(?:del\s+)?piede|delle\s+dita\s+piede|alluce|toe)\b/i, prefix: "toe_pip", range: [1, 5] },
  // IFP standalone (fingers)
  { re: /\bIFP\b/i,                                                   prefix: "pip",     range: [1, 5] },
  { re: /\bmeta[ck]arpofalang\w+\b/i,                                 prefix: "mcp",     range: [1, 5] },
  { re: /\binterfalang\w+\s+prossim\w+\b/i,                           prefix: "pip",     range: [1, 5] },
  { re: /\bmetatarsofalang\w+\b/i,                                     prefix: "mtp",     range: [1, 5] },
  // Toe PIP verbose: "interfalangea prossimale dita piede" / "IFP piede"
  { re: /\bIFP\s+piede\b/i,                                           prefix: "toe_pip", range: [1, 5] },
];

// ── Parse a joint list segment → Set of Homunculus keys ──────────────────────
function resolveJoints(segment, fallbackSides) {
  const keys = new Set();
  const sides = parseSides(segment) ?? fallbackSides ?? ["_r", "_l"];

  // Large joints
  for (const jd of JOINT_DEFS) {
    if (!jd.re.test(segment)) continue;
    const isPluralForm = jd.plural && jd.plural.test(segment);
    const useSides = isPluralForm ? ["_r", "_l"] : sides;
    for (const s of useSides) keys.add(jd.base + s);
  }

  // Numbered joints
  for (const nd of NUMBERED_DEFS) {
    let match;
    const clone = new RegExp(nd.re.source, "ig");
    while ((match = clone.exec(segment)) !== null) {
      const afterText = segment.slice(match.index + match[0].length);
      const nums = extractNumbers(afterText, nd.range[1]) ??
        Array.from({ length: nd.range[1] - nd.range[0] + 1 }, (_, i) => i + nd.range[0]);
      // Laterality: read from the text around the match
      const window = segment.slice(Math.max(0, match.index - 4), match.index + match[0].length + 40);
      const jSides = parseSides(window) ?? sides;
      for (const n of nums) {
        for (const s of jSides) keys.add(`${nd.prefix}${n}${s}`);
      }
    }
  }

  return keys;
}

// ── Marker regexes ────────────────────────────────────────────────────────────
const TENDER_RE  = /\b(dolorabilità|dolente[/i]?|dolore|doloranti?|dolorosa\s+palpazione|positività\s+(?:algica|dolorosa)|FTP)\b/i;
const SWOLLEN_RE = /\b(tumefazion[ei]|tumefatt[oai]|tumefatte?|sinovite|artrit[ei]|(?:ipertrofia|versamento)\s+(?:sinoviale|articolare)?|gonfiore\s+(?:articolare)?)\b/i;
const NEG_RE     = /\b(non\s+(?:si\s+rileva|si\s+rilevano|present[ei]|evidenz\w+)|assenz[ae]\s+di|senza\s+(?:artrit\w+|sinovit\w+|tumefazion\w+|dolorabilità)|negativo|negativa)\b/i;
// Segni di artrosi (OA) — scrosci = crepitio articolare → artrosi, NON artrite.
// Una articolazione descritta solo con scrosci NON va conteggiata come dolente/tumefatta
// e NON deve ricevere status carry-forward da articolazioni precedenti.
const OA_SIGN_RE = /\bscrosci\w*\b/i;

// ── Split text into clauses (on ; . \n) ──────────────────────────────────────
function splitClauses(text) {
  return text
    .split(/[;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// ── Strip dermatological / skin-manifestation phrases ─────────────────────────
// These mention body-part names but are NOT joint-examination findings.
// Removing them before parsing prevents false-positive joint hits.
// Examples:  "placche psoriasiche ai gomiti"
//            "lesioni cutanee alle ginocchia"
//            "eritema psoriasico ai gomiti"
//            "psoriasi cutanea a gomiti e ginocchia"
function stripDermContext(text) {
  const loc = "(?:\\s+(?:a[il]?|su[il]?|alle?|de[il]|dei|degli|della|delle)\\s+[\\w\\s,eéàèì]{1,40})?";
  return text
    .replace(new RegExp(`\\bplacch[ei]\\s+(?:psoriasich\\w+|eritematose?\\w*|cutane\\w*)${loc}`, "gi"), " ")
    .replace(new RegExp(`\\blesion[ei]\\s+(?:psoriasich\\w+|cutane\\w+)${loc}`, "gi"), " ")
    .replace(new RegExp(`\\bpsoriasi\\s+(?:cutane\\w+|vulgar\\w+|a\\s+placc\\w+)${loc}`, "gi"), " ")
    .replace(new RegExp(`\\beritema\\s+(?:psoriasich\\w+|cutane\\w+|\\w+\\s+cutane\\w+)${loc}`, "gi"), " ")
    .replace(/\bmanifestazion[ei]\s+cutane\w+(?:\s+\w+){0,5}/gi, " ")
    .replace(/\bonicolisi\b|\bonicostrofia\b/gi, " ");
}

// ── Main export ───────────────────────────────────────────────────────────────
export function parseJointExam(text) {
  if (!text?.trim()) return { joints: {}, tjc: 0, sjc: 0, found: false, rawSegments: { tender: [], swollen: [] } };

  // Step 1: expand clinical abbreviations (dolor/tumor/ds/sn/MCF + number reordering)
  const expanded = expandAbbreviations(text);

  // Step 2: remove dermatological phrases so skin findings don't produce false joint hits
  const cleanText = stripDermContext(expanded);

  // Result accumulator: key → "tender" | "swollen" | "both"
  const result = {};
  const rawSegments = { tender: [], swollen: [] };

  function markTender(keys) { for (const k of keys) { const c = result[k]; result[k] = (c === "swollen" || c === "both") ? "both" : "tender"; } }
  function markSwollen(keys) { for (const k of keys) { const c = result[k]; result[k] = (c === "tender" || c === "both") ? "both" : "swollen"; } }

  // ── Pass 1: look for explicit labeled blocks ──
  // e.g. "Dolorabilità: polso dx, MCP II-III dx\nSinovite: MCP II dx"
  // also handles abbreviated labels after expansion ("dolente: ..." / "tumefatto: ...")
  const labeledBlocks = [
    { re: /(?:dolorabilità|dolent[ei]|dolore)[\s:]+(.+?)(?=\n|(?:tumefazion[ei]|sinovite|artrit[ei]|tumefatt\w+)|$)/gi, type: "tender" },
    { re: /(?:tumefazion[ei]|sinovite|artrit[ei]|tumefatt\w+)[\s:]+(.+?)(?=\n|(?:dolorabilità|dolent[ei]|dolore)|$)/gi, type: "swollen" },
  ];
  for (const lb of labeledBlocks) {
    let m;
    while ((m = lb.re.exec(cleanText)) !== null) {
      const seg = m[1].trim();
      if (NEG_RE.test(m[0])) continue;
      rawSegments[lb.type].push(seg);
      const keys = resolveJoints(seg, null);
      if (lb.type === "tender") markTender(keys);
      else markSwollen(keys);
    }
  }

  // ── Pass 2: sentence-level scan for inline mentions ──
  // "si rileva tumefazione del polso dx e dolorabilità delle MCP 2-3 bilateralmente"
  // Also handles compact forms after expansion:
  //   "dolente e tumefatto polsi, dolente MCP II-III-IV destra e sinistra"
  //
  // Split on status-marker boundaries (lookahead).
  // Then apply a "pending status carry-forward": if a sub-part has a status marker
  // but no joints, the status is carried into the next sub-part.
  for (const clause of splitClauses(cleanText)) {
    if (NEG_RE.test(clause)) continue;

    const hasTender  = TENDER_RE.test(clause);
    const hasSwollen = SWOLLEN_RE.test(clause);
    if (!hasTender && !hasSwollen) continue;

    // Split the clause on tender/swollen keywords to get sub-segments
    const parts = clause.split(/(?=\b(?:dolorabilità|dolent[ei]|dolore|tumefazion[ei]|tumefatt[oai]\w*|sinovite|artrit[ei])\b)/i);

    // Carry-forward: a sub-part with status but no joints passes its status onward
    let pendingTender  = false;
    let pendingSwollen = false;

    for (const part of parts) {
      if (NEG_RE.test(part)) { pendingTender = pendingSwollen = false; continue; }

      const isTender  = TENDER_RE.test(part);
      const isSwollen = SWOLLEN_RE.test(part);
      const joints    = resolveJoints(part, null);

      if (!joints.size) {
        // No joints in this sub-part — accumulate status for next sub-part
        if (isTender)  pendingTender  = true;
        if (isSwollen) pendingSwollen = true;
        continue;
      }

      // OA sign (scrosci) present with joints but NO explicit tender/swollen marker →
      // questa articolazione è affetta da artrosi, non artrite.
      // Annulliamo il carry-forward invece di applicarlo: la joint NON viene marcata.
      if (OA_SIGN_RE.test(part) && !isTender && !isSwollen) {
        pendingTender = pendingSwollen = false;
        continue;
      }

      // Effective status = this part's status OR carried-forward status
      const effectiveTender  = isTender  || pendingTender;
      const effectiveSwollen = isSwollen || pendingSwollen;
      pendingTender = pendingSwollen = false; // reset after consuming

      if (effectiveTender && effectiveSwollen) { markTender(joints); markSwollen(joints); }
      else if (effectiveTender)  markTender(joints);
      else if (effectiveSwollen) markSwollen(joints);
    }
  }

  // ── Pass 3: joint-first clauses  ("polso dx: dolorabilità e sinovite") ──
  const jointFirst = /\b([^:]+?):\s*(dolorabilità|tumefazion[ei]|sinovite|artrit[ei]|dolent[ei]|tumefatt\w+)\b/gi;
  let m3;
  while ((m3 = jointFirst.exec(cleanText)) !== null) {
    if (NEG_RE.test(m3[0])) continue;
    const jointPart  = m3[1].trim();
    const statusPart = m3[2].toLowerCase();
    const joints = resolveJoints(jointPart, null);
    if (!joints.size) continue;
    const isTender  = TENDER_RE.test(statusPart);
    const isSwollen = SWOLLEN_RE.test(statusPart);
    // Read the rest of the clause for additional descriptors
    const restStart = m3.index + m3[0].length;
    const rest = cleanText.slice(restStart, restStart + 60);
    const alsoSwollen = SWOLLEN_RE.test(m3[2] + " " + rest);
    const alsoTender  = TENDER_RE.test(m3[2] + " " + rest);
    if (alsoTender && alsoSwollen) { markTender(joints); markSwollen(joints); }
    else if (alsoSwollen || isSwollen) markSwollen(joints);
    else if (alsoTender || isTender)  markTender(joints);
  }

  const found = Object.keys(result).length > 0;

  // TJC68 / SJC66 — full 66/68-joint count
  // TJC68: all joints (including hips, assessed for tenderness only)
  // SJC66: all joints EXCEPT hips (hips not formally assessed for swelling)
  const HIP_KEYS = new Set(["hip_l", "hip_r"]);

  let tjc = 0, sjc = 0;
  for (const [key, val] of Object.entries(result)) {
    if (val === "tender" || val === "both") tjc++;
    if ((val === "swollen" || val === "both") && !HIP_KEYS.has(key)) sjc++;
  }

  return { joints: result, tjc, sjc, found, rawSegments };
}
