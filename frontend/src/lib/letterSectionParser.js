/**
 * letterSectionParser.js
 *
 * Pass 1 of the two-pass visit-import pipeline.
 *
 * segmentLetterSections(text) → sections map
 *   Splits an Italian rheumatology letter into named blocks using strong
 *   structural headers as delimiters.  Each extractor in visitTextParser.js
 *   then receives only the relevant section text, preventing data from
 *   bleeding across sections.
 *
 * extractRequestedTests(sectionText) → string[] | null
 *   Parses the HO_RICHIESTO section into an array of test strings.
 */

// ── Section header definitions ─────────────────────────────────────────────────
// Order matters: more-specific patterns must come before shorter ones.
// Each regex is tested against the TRIMMED content of a line (^ = start of line).
const SECTION_DEFS = [
  // Narrative preamble headers
  { key: "MOTIVO_VISITA",       re: /^MOTIVO(?:\s+DELLA)?\s+VISITA\b/i },
  { key: "ANAMNESI_FISIOLOGICA",re: /^ANAMNESI\s+FISIOLOGICA\b/i },
  { key: "ANAMNESI_PATOLOGICA", re: /^(?:ANAMNESI\s+PATOLOGICA(?:\s+REMOTA)?|APR)\b/i },
  { key: "ANAMNESI_FAMILIARE",  re: /^ANAMNESI\s+FAMILIARE\b/i },

  // Comorbidities, concomitant conditions and surgical history
  // COMORBI + DIT/LIT + A|À — covers COMORBIDITA, COMORBIDITÀ, COMORBILITA, COMORBILITÀ
  // (?:\s*\/\s*APR)? optionally consumes the "/APR" suffix in "COMORBILITA'/APR:"
  // so that inlineContent starts cleanly at the actual patient data, not at "/APR:…"
  // (?=\W|$) instead of \b because À is non-ASCII and \b fails after it
  {
    key: "COMORBIDITA",
    re: /^(?:COMORBI(?:DIT[AÀ]|LIT[AÀ])'?(?:\s*\/\s*APR)?|PATOLOGIE\s+CONCOMITANTI|INTERVENTI\s+CHIRURGICI)(?=\W|$)/i,
  },

  // Therapy — baseline drugs the patient is already taking
  // TERAPIA\s*:?\s*$ catches standalone "TERAPIA" or "TERAPIA:" as a section header
  // TERAPIE (plural) + qualificatore completo (IN ATTO, IN CORSO, etc.) esplicitato
  // per evitare che "TERAPIE IN ATTO:" catturi solo "TERAPIE" e lasci "IN ATTO:" nel body
  {
    key: "TERAPIA_DOMICILIARE",
    re: /^(?:TERAPI[AE]\s+(?:DOMICILIARE|ATTUALE|PRATICATA|IN\s+ATTO|IN\s+CORSO|CORRENTE|ABITUALE)|FARMACI\s+(?:IN\s+CORSO|ASSUNTI)|ANAMNESI\s+FARMACOLOGICA|TERAPIE)\b|^TERAPIA\s*(?::|$)/i,
  },

  // Allergies and intolerances (colon optional)
  {
    key: "ALLERGIE",
    re: /^(?:ALLERGIE(?:\s+E\s+INTOLLERANZE)?(?:\s+A\s+FARMACI)?|INTOLLERANZE(?:\s+E\s+ALLERGIE)?|ALLERGIE\s+A\s+FARMACI|INTOLLERANZE\s+FARMACOLOGICHE)\s*:?/i,
  },

  // Rheumatologic history / raccordo anamnestico
  // Includes: clinical history, disease course, disease evolution
  {
    key: "RACCORDO",
    re: /^(?:ANAMNESI\s+REUMATOLOGICA(?:\s+REMOTA)?|RACCORDO(?:\s+(?:REUMATOLOGICO|ANAMNESTIC\w+(?:\s+REUMATOLOGICO)?)?)?|STORIA\s+(?:CLINICA|REUMATOLOGICA)|DECORSO\s+CLINICO|EVOLUZIONE\s+CLINICA)\b/i,
  },

  // Archive exam sections — exams already performed → patient archive
  // STORICO ESAMI and variants are treated the same as ESAMI PRECEDENTI DI RILIEVO
  // ACCERTAMENTI EFFETTUATI / ESEGUITI / ESITATI / REFERTATI are common equivalents
  {
    key: "ESAMI_PREGRESSI",
    re: /^(?:ESAMI\s+(?:PRECEDENTI(?:\s+(?:DI\s+RILIEVO|SIGNIFICATIVI))?|PREGRESSI|DI\s+RILIEVO|STRUMENTALI\s+PREGRESSI)|ACCERTAMENTI\s+(?:PRECEDENTI|PREGRESSI|EFFETTUATI|ESEGUITI|ESITATI|REFERTATI)|PER\s+RILEVANZA|STORICO\s+ESAMI)\b/i,
  },

  // Follow-up interval anamnesis — autonomous section, most common follow-up header
  { key: "ANAMNESI_INTERVALLARE", re: /^ANAMNESI\s+INTERVALLARE(?:\s+DI\s+MALATTIA)?\b/i },

  // Current visit narrative — review, re-evaluation, dated visits
  // RIVALUTAZIONE and CONTROLLO as standalone lines are safe (^ anchor prevents
  // inline matches like "prosegue terapia fino a nuova rivalutazione clinica").
  // VISITA DD/MM/YYYY captures dated visit headers (e.g. "VISITA 30/05/2026").
  // RIVALUTAZIONE and CONTROLLO require end-of-line or colon to avoid false positives
  // on sentences like "Rivalutazione clinica tra 3 mesi." that start with the word.
  // "IN DATA ODIERNA" / "ALLA VISITA ODIERNA" introducono il blocco anamnesi
  // intervallare quando manca un header esplicito (comune nelle lettere AUSL);
  // il [.:]? finale consuma il punto del marker ("IN DATA ODIERNA. Discreto...").
  {
    key: "VISITA_ODIERNA",
    re: /^(?:IN\s+DATA\s+ODIERNA|ALLA\s+VISITA\s+ODIERNA|VISITA\s+(?:ODIERNA|AMBULATORIALE|DI\s+CONTROLLO)(?:\s+\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})?|VISITA\s+\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|AGGIORNAMENTO\s+CLINICO|RIVALUTAZIONE(?=\s*:|\s*$)|CONTROLLO(?=\s*:|\s*$))\b[.:]?/i,
  },

  // Physical examination — all common Italian variants
  // "EO" as a standalone line is recognised; "Obiettivamente:" is handled by
  // stripping the colon in the inlineContent extraction step.
  // NOTE: use (?=\W|$) instead of \b because JS \b does not fire after non-ASCII
  // characters like À (OBIETTIVITÀ would silently fail with a trailing \b).
  {
    key: "ESAME_OBIETTIVO",
    re: /^(?:ESAME\s+(?:OBIETTIVO(?:\s+REUMATOLOGICO)?|FISICO|REUMATOLOGICO)|OBIETTIVIT[AÀ]'?(?:\s+REUMATOLOGICA)?|OBB?IETTIVAMENTE|REPERTO\s+OBIETTIVO|EO)(?=\W|$)/i,
  },

  // Exams brought to current visit → visit Esami/Imaging field (NOT archive)
  // ULTIMI ESAMI when used as a section header = exams carried to today's visit
  // NOTE: "In visione" (Italian: "brought in for review") uses (?:Porta\s+in|In)\s+visione
  //       NOT (?:In|Porta)\s+in\s+visione which would require "in" twice.
  {
    key: "RECA_IN_VISIONE",
    re: /^(?:RECA\s+IN\s+VISIONE|(?:Porta\s+in|In)\s+visione|ACCERTAMENTI\s+IN\s+VISIONE|ESAMI\s+(?:PORTATI|RECATI)\s+IN\s+VISIONE|PORTA\s+IN\s+VISITA|ULTIMI\s+ESAMI)\b/i,
  },

  // Final assessment / impression
  // NOTE: DIAGNOSI alone is NOT a header alias (too common in inline text)
  // CONCLUSIONI? makes the final I optional → matches "CONCLUSIONE" (singular) too
  { key: "CONCLUSIONI",    re: /^(?:CONCLUSIONI?|VALUTAZIONE(?:\s+CLINICA)?|ASSESSMENT|IMPRESSIONE\s+DIAGNOSTICA)\b/i },

  // Therapy prescribed at this visit (second therapy section, distinct from baseline)
  { key: "IN_TERAPIA",     re: /^IN\s+TERAPIA\b/i },

  // Recommendations / follow-up plan
  {
    key: "INDICAZIONI",
    re: /^(?:INDICAZIONI|SI\s+CONSIGLIA|FOLLOW[\s\-]?UP|PROGRAMMA|RACCOMANDAZIONI|PIANO\s+(?:TERAPEUTICO|DIAGNOSTICO))\b/i,
  },

  // Requested exams → requested_tests (excluded from the instrumental archive)
  { key: "HO_RICHIESTO",   re: /^(?:HO\s+(?:RICHIESTO|PRESCRITTO)|ACCERTAMENTI\s+RICHIESTI|ESAMI\s+RICHIESTI|RICHIEDO)\b/i },

  // Addendum / update note (must stay AFTER VISITA_ODIERNA to avoid collision)
  { key: "AGGIORNAMENTO",  re: /^AGGIORNAMENTO\s+DEL\b/i },
];

// ── ESAME_OBIETTIVO stop-header safety clipper ────────────────────────────────
//
// Even after the section splitter runs, a physical-exam section can "bleed"
// into subsequent content when:
//   a) A recognised header (e.g. "In visione:") has an unrecognised variant or
//      prefix ("- In visione:", indented without a blank line, etc.)
//   b) The author writes "In visione:" inline inside the EO paragraph.
//
// This regex is tested against each line of ESAME_OBIETTIVO content AFTER
// stripping any leading bullet/dash/arrow characters (so "- In visione:" and
// "In visione:" are treated identically).  The first matching line terminates
// the physical-exam section; everything from that line onwards is discarded
// (it has already been — or will be — captured by the correct section).
//
// Patterns are sorted from most-specific to least-specific.
// Short patterns (RX, TC, RM) are word-boundary anchored to avoid false
// positives inside sentences ("Indicata TC per...").
const EO_STOP_RE = /^(?:in\s+visione|reca\s+in\s+visione|porta\s+in\s+(?:visione|visita)|accertamenti(?:\s+in\s+visione)?|esami?\s+in\s+visione|esami?\s+di\s+laboratorio|esami?\s+strumentali?|laboratorio|conclusioni?|valutazione(?:\s+clinica)?|assessment|indicazioni|programma(?:\s+(?:terapeutico|diagnostico))?|terapia(?:\s+in\s+(?:corso|atto)|\s+domiciliare|\s+attuale|\s+prescritta)?|si\s+consiglia|follow[\s\-]?up|rx\b|ecografia|tc\b|rm\b|radiografia)\b/i;

/**
 * Clips ESAME_OBIETTIVO text at the first line that looks like a subsequent
 * section header, even when preceded by bullet/dash markers or unusual spacing.
 *
 * @param {string} text
 * @returns {string}
 */
function clipEsameObiettivo(text) {
  if (!text) return text;
  const lines = text.split("\n");
  const stopIdx = lines.findIndex((line) => {
    // Strip leading bullet / dash / arrow characters before testing
    const stripped = line.trim().replace(/^[-–—•·>*]+\s*/, "");
    return stripped.length > 0 && EO_STOP_RE.test(stripped);
  });
  if (stopIdx < 0) return text; // not found → keep as-is
  return lines.slice(0, stopIdx).join("\n").trim();
}

const INLINE_HEADER_SPLIT_RE = /[ \t]+(RACCORDO[ \t]+ANAMNESTICO|ANAMNESI[ \t]+REUMATOLOGICA|STORIA[ \t]+CLINICA|VISITA[ \t]+ODIERNA|CONCLUSIONI|INDICAZIONI|TERAPIA[ \t]+IN[ \t]+ATTO|TERAPIA[ \t]+DOMICILIARE)[ \t]*:/g;

/**
 * segmentLetterSections(text)
 *
 * Splits the full letter text into named sections.
 * Returns a plain object { PREAMBLE, COMORBIDITA, RACCORDO, … }.
 * Each value is the trimmed text of that section, header keyword excluded.
 * Section content that starts inline (on the same line as the header) is
 * preserved correctly.
 *
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function segmentLetterSections(text) {
  if (!text?.trim()) return { PREAMBLE: "" };

  text = text.replace(INLINE_HEADER_SPLIT_RE, "\n$1:");

  const lines = text.split(/\n/);
  const hits  = []; // { key, lineIndex, inlineContent }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const { key, re } of SECTION_DEFS) {
      const m = line.match(re);
      if (!m) continue;

      // Content on the same line as the header (after the keyword)
      const inlineContent = line
        .slice(m.index + m[0].length)
        .replace(/^[\s:–\-]+/, "")
        .trim();

      hits.push({ key, lineIndex: i, inlineContent });
      break; // first matching def wins per line
    }
  }

  const sections = {};

  // Text before the first detected header
  sections.PREAMBLE = hits.length > 0
    ? lines.slice(0, hits[0].lineIndex).join("\n").trim()
    : text.trim();

  // Each section: content from the line after the header to the next header
  for (let i = 0; i < hits.length; i++) {
    const { key, lineIndex, inlineContent } = hits[i];
    const nextLineIndex = i + 1 < hits.length ? hits[i + 1].lineIndex : lines.length;

    const body = lines
      .slice(lineIndex + 1, nextLineIndex)
      .join("\n")
      .trim();

    // Combine inline content (same line as header) + multiline body
    sections[key] = [inlineContent, body].filter(Boolean).join("\n").trim();
  }

  // Safety clip: prevent ESAME_OBIETTIVO from absorbing subsequent sections
  // when their headers are not at the start of a line or use unrecognised variants.
  if (sections.ESAME_OBIETTIVO) {
    sections.ESAME_OBIETTIVO = clipEsameObiettivo(sections.ESAME_OBIETTIVO);
  }

  return sections;
}

/**
 * extractRequestedTests(sectionText)
 *
 * Parses the HO_RICHIESTO section into an array of individual test strings.
 * Handles bullet lists (-, •, >) and plain lines.
 *
 * @param {string|undefined} sectionText
 * @returns {string[]|null}
 */
export function extractRequestedTests(sectionText) {
  if (!sectionText?.trim()) return null;

  const NOISE = /^(?:cordiali\s+saluti|si\s+ricorda|duplicato|per\s+ogni\s+info|in\s+caso\s+di|accertamenti\s+prescritti|accertamenti\s+prenotati|\d{1,2}\s+\w+\s+\d{4}|il\s+medico)/i;

  const tests = sectionText
    .split(/\n/)
    .map((l) => l.replace(/^[\s\-–•·>]+/, "").trim())
    .filter((l) => l.length > 3 && !NOISE.test(l));

  return tests.length ? tests : null;
}

// ── Regression tests ──────────────────────────────────────────────────────────
/**
 * runSectionParserRegressionTests()
 *
 * Validates that segmentLetterSections correctly scopes each section,
 * especially that ESAME_OBIETTIVO never bleeds into "In visione" blocks,
 * exam lists, conclusions, or indications.
 *
 * Call from browser console: import { runSectionParserRegressionTests } from './lib/letterSectionParser';
 */
export function runSectionParserRegressionTests() {
  const REAL_CASE = `Visita ambulatoriale del 04/06/2026.

ESAME OBIETTIVO
Non segni di artrite periferica attiva. Rachide lombare: discreta limitazione all'antiflessione. Nessun segno di sinovite alle articolazioni periferiche.

In visione:
- EE 04/05/2026: PCR 12 mg/L, VES 35 mm/h, Hb 13.2
- RX TORACE: nulla di rilevante
- ECOGRAFIA ADDOME: quadro nella norma

CONCLUSIONI
Spondilite anchilosante in fase attiva (ASDAS-CRP 2.8).

INDICAZIONI
Si consiglia proseguire terapia in corso. Follow-up tra 3 mesi con ASDAS.`;

  const DASH_PREFIX_CASE = `ESAME OBIETTIVO
Paziente in buone condizioni generali. Non artrite periferica.

- In visione:
- RX GINOCCHIO DX: negativo per erosioni

CONCLUSIONE
Artrite reattiva in remissione.`;

  const INLINE_CONCLUSIONI_CASE = `ESAME OBIETTIVO
Obiettivamente: buone condizioni generali.

Conclusioni
Artrite reumatoide stabile.`;

  const NO_BLEED_CASE = `ESAME OBIETTIVO
Obiettivamente: buone condizioni. Ginocchio: lieve versamento. Mani: nessuna sinovite.
EO invariato rispetto alla visita precedente.

CONCLUSIONI
Remissione clinica confermata.`;

  const tests = [
    {
      name: "Real case: EO stops before 'In visione' block (standalone header)",
      input: REAL_CASE,
      checks: [
        { label: "EO contains physical exam text",           fn: (S) => !!S.ESAME_OBIETTIVO?.includes("Non segni di artrite periferica") },
        { label: "EO does NOT contain 'In visione'",         fn: (S) => !S.ESAME_OBIETTIVO?.toLowerCase().includes("in visione") },
        { label: "EO does NOT contain lab values (EE)",      fn: (S) => !S.ESAME_OBIETTIVO?.includes("EE 04/05/2026") },
        { label: "EO does NOT contain RX TORACE",            fn: (S) => !S.ESAME_OBIETTIVO?.includes("RX TORACE") },
        { label: "EO does NOT contain ECOGRAFIA",            fn: (S) => !S.ESAME_OBIETTIVO?.toLowerCase().includes("ecografia") },
        { label: "RECA_IN_VISIONE captures exam block",      fn: (S) => !!S.RECA_IN_VISIONE?.includes("EE 04/05/2026") },
        { label: "RECA_IN_VISIONE contains RX TORACE",       fn: (S) => !!S.RECA_IN_VISIONE?.includes("RX TORACE") },
        { label: "CONCLUSIONI captured correctly",           fn: (S) => !!S.CONCLUSIONI?.includes("Spondilite") },
        { label: "INDICAZIONI captured correctly",           fn: (S) => !!S.INDICAZIONI?.includes("Si consiglia") },
      ],
    },
    {
      name: "Dash-prefix 'In visione': clipper catches bullet-prefixed stop-header",
      input: DASH_PREFIX_CASE,
      checks: [
        { label: "EO does NOT contain 'In visione'",         fn: (S) => !S.ESAME_OBIETTIVO?.toLowerCase().includes("in visione") },
        { label: "EO does NOT contain RX GINOCCHIO",         fn: (S) => !S.ESAME_OBIETTIVO?.includes("RX GINOCCHIO") },
        { label: "CONCLUSIONI? matches 'CONCLUSIONE' singular", fn: (S) => !!S.CONCLUSIONI?.includes("Artrite reattiva") },
      ],
    },
    {
      name: "Inline Conclusioni: section splitter + clipper together",
      input: INLINE_CONCLUSIONI_CASE,
      checks: [
        { label: "EO does NOT contain 'Conclusioni'",        fn: (S) => !S.ESAME_OBIETTIVO?.toLowerCase().includes("conclusioni") },
        { label: "CONCLUSIONI captured",                     fn: (S) => !!S.CONCLUSIONI?.includes("Artrite reumatoide") },
      ],
    },
    {
      name: "No bleed: EO content with 'EO' abbreviation stays intact",
      input: NO_BLEED_CASE,
      checks: [
        { label: "EO contains versamento text",              fn: (S) => !!S.ESAME_OBIETTIVO?.includes("versamento") },
        { label: "EO contains EO-abbreviation line",         fn: (S) => !!S.ESAME_OBIETTIVO?.includes("EO invariato") },
        { label: "CONCLUSIONI captured",                     fn: (S) => !!S.CONCLUSIONI?.includes("Remissione") },
      ],
    },

    // ── AUSL Bologna / Pelliconi-style patterns ───────────────────────────────
    {
      name: "AUSL Bologna: TERAPIA: inline header recognised as TERAPIA_DOMICILIARE",
      input: `ANAMNESI PATOLOGICA REMOTA: ipertensione arteriosa, discopatie.
TERAPIA: atenololo - colecalciferolo 5 gtt al die - urbason 4 mg : 1/2 cp al die
Nega allergie.
RACCORDO ANAMNESTICO: pz. con artrite reumatoide sieronegativa.
CONCLUSIONI: remissione clinica.`,
      checks: [
        { label: "TERAPIA_DOMICILIARE recognised",           fn: (S) => !!S.TERAPIA_DOMICILIARE },
        { label: "TERAPIA_DOMICILIARE contains atenololo",   fn: (S) => !!S.TERAPIA_DOMICILIARE?.includes("atenololo") },
        { label: "TERAPIA_DOMICILIARE contains urbason",     fn: (S) => !!S.TERAPIA_DOMICILIARE?.toLowerCase().includes("urbason") },
        { label: "RACCORDO recognised",                      fn: (S) => !!S.RACCORDO?.includes("artrite reumatoide") },
        { label: "ANAMNESI_PATOLOGICA does NOT contain TERAPIA body", fn: (S) => !S.ANAMNESI_PATOLOGICA?.toLowerCase().includes("urbason") },
      ],
    },
    {
      name: "AUSL Bologna: OBBIETTIVAMENTE (doppia B) recognised as ESAME_OBIETTIVO",
      input: `VISITA ODIERNA: peggioramento artralgie.
OBBIETTIVAMENTE : non segni di artrite periferica. Pes planus. Scrosci alle ginocchia.
CONCLUSIONI: artrite reumatoide non in fase attiva.
INDICAZIONI: proseguire Urbason 4 mg.`,
      checks: [
        { label: "ESAME_OBIETTIVO recognised",               fn: (S) => !!S.ESAME_OBIETTIVO },
        { label: "ESAME_OBIETTIVO contains Pes planus",      fn: (S) => !!S.ESAME_OBIETTIVO?.includes("Pes planus") },
        { label: "ESAME_OBIETTIVO does NOT contain CONCLUSIONI body", fn: (S) => !S.ESAME_OBIETTIVO?.includes("artrite reumatoide non") },
        { label: "CONCLUSIONI captured",                     fn: (S) => !!S.CONCLUSIONI?.includes("artrite reumatoide non in fase") },
      ],
    },
    {
      name: "AUSL Bologna: TERAPIA standalone (no colon) still recognised",
      input: `TERAPIA
- methotrexate 10 mg/sett
- acido folico 5 mg/sett
CONCLUSIONI: AR in remissione.`,
      checks: [
        { label: "TERAPIA_DOMICILIARE recognised (standalone)",  fn: (S) => !!S.TERAPIA_DOMICILIARE },
        { label: "TERAPIA_DOMICILIARE contains methotrexate",    fn: (S) => !!S.TERAPIA_DOMICILIARE?.toLowerCase().includes("methotrexate") },
      ],
    },
    {
      name: "AUSL Bologna: IN VISIONE absorbed EO does not bleed into lab scope",
      input: `IN VISIONE :
- EE agosto 2025: ves 22, pcr 0.88
OBBIETTIVAMENTE : non segni artrite periferica.
CONCLUSIONI: AR sieronegativa.`,
      checks: [
        { label: "RECA_IN_VISIONE captured",                 fn: (S) => !!S.RECA_IN_VISIONE?.includes("ves 22") },
        { label: "ESAME_OBIETTIVO captured (double-B)",      fn: (S) => !!S.ESAME_OBIETTIVO?.includes("non segni artrite") },
        { label: "RECA_IN_VISIONE does NOT contain EO text", fn: (S) => !S.RECA_IN_VISIONE?.includes("non segni artrite") },
      ],
    },
  ];

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const test of tests) {
    const S = segmentLetterSections(test.input);
    for (const check of test.checks) {
      if (check.fn(S)) {
        passed++;
      } else {
        failed++;
        failures.push(`  FAIL [${test.name}] — ${check.label}`);
        console.error(`[SectionParser] FAIL: [${test.name}] ${check.label}`, "\nSections:", S);
      }
    }
  }

  const summary = `[SectionParser] ${passed} passed, ${failed} failed`;
  if (failed === 0) {
    console.log(summary);
  } else {
    console.error(summary);
    failures.forEach((f) => console.error(f));
  }
  return { passed, failed, failures };
}
