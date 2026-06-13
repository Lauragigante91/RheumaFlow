/**
 * Parser Regression Tests — End-to-end
 *
 * Input reale: lettera clinica vasculite/porpora (visita 11/05/2026).
 * Ogni test corrisponde a un bug trovato in produzione durante test clinici reali.
 *
 * Come eseguire:
 *   cd frontend && npx esbuild src/lib/__tests__/parser_regression.js \
 *     --bundle --platform=node --outfile=/tmp/parser_reg.cjs --format=cjs \
 *     && node /tmp/parser_reg.cjs
 */

import { parseVisitText } from "../visitTextParser.js";
import { extractLabValues, extractLabValuesByDate, detectReportDate } from "../labValueExtractor.js";
import { LAB_PANELS } from "../labPanels.js";
import { parseInstrumentalFindings } from "../instrumentalParser.js";
import { parseRaccordoTimeline } from "../raccordoParser.js";
import { parseTherapyText } from "../therapyTextParser.js";

// ── Lettera reale (vasculite/porpora, paziente 21 anni, visita 11/05/2026) ────
// Formato "inline header": ANAMNESI FISIOLOGICA: testo sullo stesso rigo,
// senza riga vuota tra una sezione e l'altra → caso reale che ha triggerato i bug.
const LETTER_VASCULITE = `MOTIVO DELLA VISITA: porpora palpabile alle gambe, emorragia sottocongiuntivale, sospetta vasculite

Paziente di 21 anni.

ANAMNESI FISIOLOGICA: non fumatrice, non abitudine alcolica, mai gravidanze, studentessa.
ANAMNESI FAMILIARE: non familiarità per malattie reumatiche, psoriasi, IBD.
COMORBILITA'/APR: nessuna eccetto verosimile oculorinite allergica. Pregressa AN.
TERAPIA DOMICILIARE: Novadien (estroprogestinico, sospesa 3 gg fa)
Allergie: Nurofen.

RACCORDO ANAMNESTICO:
Ad agosto 2025 comparsa di lesioni purpuriche agli arti inferiori, con successivo coinvolgimento del tronco. Episodio di emorragia sottocongiuntivale bilaterale. Sintomatologia migliorata dopo FANS e poi dopo ciclo di steroidi (Deltacortene 25 mg/die per 4 settimane con successivo scalaggio).

VISITA ODIERNA:
Dopo iniziale ottima risposta alla terapia steroidea, ricomparsa di lesioni purpuriche agli arti inferiori nell'ultimo mese. In programma biopsia la prossima settimana.
Obiettivamente: non segni di artrite periferica, porpora palpabile agli arti inferiori, no edema, mucose integre, obiettività cardiopolmonare nella norma. ROT presenti e simmetrici. Non adenopatie.
Peso 60 kg. Altezza 160 cm.

In visione:
- EE 13/03/26: Hb 14.0 G/L WBC 9500 PLT 215.000
- EE 31/03/26: FR neg, ANA 1:160 (HEp-2), ANCA neg, Anticorpi antifosfolipidi neg, C3 non consumato, C4 non consumato, C1q non consumato, IgG nei limiti, IgA nei limiti, IgM nei limiti, crioglobuline neg
- EU 04/04/26: proteinuria 24h nn, microematuria neg
- EE 04/05/2026: Hb 14.2 G/L WBC 7800 PLT 198.000 VES 23 PCR 5.8

CONCLUSIONI:
Porpora palpabile + verosimile vasculite dei piccoli vasi. Sospendere estroprogestinico (già sospeso). Biopsia cute in programma.

INDICAZIONI:
- PROSEGUE scalaggio dello steroide come previsto: DELTACORTENE 25 mg 1 cp per altri 5 giorni, poi 3/4 cp per 2 settimane, poi 1/2 cp per 2 settimane, poi 1/4 cp con cui prosegue fino a controllo.
- Associa Colchicina 1 mg (dimezza dosaggio se diarrea).
- Esami ematici da ripetere prima della prossima visita
- Dibase 10.000 UI 40 gtt/settimana`;

// ── Utility: asserzioni e runner ─────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, message, details = null) {
  if (condition) {
    console.log(`  ✓  ${message}`);
    passed++;
  } else {
    console.error(`  ✗  FAIL: ${message}`);
    if (details !== null) console.error(`       got: ${JSON.stringify(details)}`);
    failed++;
  }
}

function runTest(name, fn) {
  console.log(`\n[${name}]`);
  fn();
}

// ── Parse una volta sola ──────────────────────────────────────────────────────
const { extracted } = parseVisitText(LETTER_VASCULITE);
const pg  = extracted.profilo_generale;
const vs  = extracted.visit_sections;
const th  = extracted.therapies ?? [];
const drugs = th.map(t => t.drug_name);

// ─────────────────────────────────────────────────────────────────────────────
// BUG-NORM-1: normalizeImportedText univa le righe "HEADER: contenuto" consecutive
// senza riga vuota, causando tutti i campi profilo_generale crammed in anamnesi_fisiologica.
// Fix: SECTION_HEADER_NORM_RE in isBlockStart.
// ─────────────────────────────────────────────────────────────────────────────
runTest("BUG-NORM-1 · profilo_generale split dal formato inline-header", () => {
  assert(pg !== null, "profilo_generale non deve essere null");

  assert(
    pg?.anamnesi_fisiologica != null,
    "anamnesi_fisiologica presente",
    pg?.anamnesi_fisiologica,
  );
  assert(
    pg?.anamnesi_fisiologica?.includes("non fumatrice"),
    "anamnesi_fisiologica contiene 'non fumatrice'",
    pg?.anamnesi_fisiologica,
  );

  assert(
    !pg?.anamnesi_fisiologica?.includes("ANAMNESI FAMILIARE"),
    "anamnesi_fisiologica NON deve contenere 'ANAMNESI FAMILIARE' (bug: tutto crammed in un campo)",
    pg?.anamnesi_fisiologica,
  );
  assert(
    !pg?.anamnesi_fisiologica?.includes("COMORBILITA"),
    "anamnesi_fisiologica NON deve contenere 'COMORBILITA'",
    pg?.anamnesi_fisiologica,
  );
  assert(
    !pg?.anamnesi_fisiologica?.includes("TERAPIA DOMICILIARE"),
    "anamnesi_fisiologica NON deve contenere 'TERAPIA DOMICILIARE'",
    pg?.anamnesi_fisiologica,
  );

  assert(
    pg?.anamnesi_familiare?.includes("familiarità per malattie reumatiche"),
    "anamnesi_familiare correttamente estratta",
    pg?.anamnesi_familiare,
  );

  assert(
    pg?.comorbidita_apr?.includes("oculorinite allergica"),
    "comorbidita_apr contiene 'oculorinite allergica'",
    pg?.comorbidita_apr,
  );
  assert(
    !pg?.comorbidita_apr?.startsWith("/APR"),
    "comorbidita_apr NON inizia con '/APR' (bug: prefisso non strippato)",
    pg?.comorbidita_apr,
  );

  assert(
    pg?.terapia_domiciliare?.includes("Novadien"),
    "terapia_domiciliare contiene 'Novadien'",
    pg?.terapia_domiciliare,
  );

  assert(
    pg?.allergie?.includes("Nurofen"),
    "allergie contiene 'Nurofen'",
    pg?.allergie,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-INDIC-1: la parola "programma" in "In programma biopsia..." matchava
// la regex INDICAZIONI in extractVisitSections, causando:
//   - indicazioni = "biopsia la prossima settimana." (falso positivo)
//   - esame_obj assorbiva il testo dell'INDICAZIONI reale
// Fix: rimosso PROGRAMMA dalla regex; ora solo INDICAZIONI header esplicito.
// ─────────────────────────────────────────────────────────────────────────────
runTest("BUG-INDIC-1 · indicazioni = sezione prescrittiva, non 'biopsia prossima settimana'", () => {
  assert(
    vs != null,
    "visit_sections presente",
  );
  assert(
    vs?.indicazioni != null,
    "visit_sections.indicazioni presente",
  );
  assert(
    !vs?.indicazioni?.toLowerCase().includes("biopsia la prossima settimana"),
    "indicazioni NON deve essere il falso positivo 'biopsia la prossima settimana'",
    vs?.indicazioni?.slice(0, 100),
  );
  assert(
    vs?.indicazioni?.toUpperCase().includes("DELTACORTENE") ||
      vs?.indicazioni?.toLowerCase().includes("scalaggio") ||
      vs?.indicazioni?.includes("Colchicina"),
    "indicazioni contiene contenuto prescrittivo reale (Deltacortene / scalaggio / Colchicina)",
    vs?.indicazioni?.slice(0, 120),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-EO-1: esame_obj non deve contenere testo dell'INDICAZIONI
// (conseguenza di BUG-INDIC-1: quando il falso positivo spostava 'indicazioni'
// prima di 'esame_obj', l'intera sezione INDICAZIONI finiva in esame_obj)
// ─────────────────────────────────────────────────────────────────────────────
runTest("BUG-EO-1 · esame_obj non assorbe la sezione INDICAZIONI", () => {
  assert(
    vs?.esame_obj != null,
    "visit_sections.esame_obj presente",
  );
  assert(
    !vs?.esame_obj?.toUpperCase().includes("INDICAZIONI"),
    "esame_obj NON deve contenere l'header 'INDICAZIONI'",
    vs?.esame_obj?.slice(-200),
  );
  assert(
    !vs?.esame_obj?.toUpperCase().includes("DELTACORTENE"),
    "esame_obj NON deve contenere 'DELTACORTENE' (è terapia, non esame obiettivo)",
    vs?.esame_obj?.slice(-200),
  );
  assert(
    !vs?.esame_obj?.toLowerCase().includes("colchicina"),
    "esame_obj NON deve contenere 'Colchicina'",
    vs?.esame_obj?.slice(-200),
  );
  assert(
    vs?.esame_obj?.toLowerCase().includes("porpora") ||
      vs?.esame_obj?.toLowerCase().includes("artrite periferica") ||
      vs?.esame_obj?.toLowerCase().includes("obiettiv"),
    "esame_obj contiene contenuto dell'esame obiettivo reale",
    vs?.esame_obj?.slice(0, 120),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-THERAPY-1: Colchicina non estratta
// Cause: (a) therapyScope non includeva S.INDICAZIONI; (b) categoria "other" filtrata.
// Fix: aggiunto S.INDICAZIONI a therapyScope; categoria Colchicina → "antiinflammatory".
// ─────────────────────────────────────────────────────────────────────────────
runTest("BUG-THERAPY-1 · Colchicina estratta da INDICAZIONI", () => {
  assert(
    drugs.includes("Colchicina"),
    `Colchicina presente in therapies (got: [${drugs.join(", ")}])`,
  );
  const colch = th.find(t => t.drug_name === "Colchicina");
  assert(
    colch?.status === "active",
    "Colchicina ha status 'active'",
    colch?.status,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-THERAPY-2: Prednisone estratto da INDICAZIONI (scalaggio steroide)
// ─────────────────────────────────────────────────────────────────────────────
runTest("BUG-THERAPY-2 · Prednisone/Deltacortene estratto da INDICAZIONI", () => {
  assert(
    drugs.includes("Prednisone"),
    `Prednisone presente in therapies (got: [${drugs.join(", ")}])`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-THERAPY-3: Ibuprofene (Nurofen) NON deve essere estratto come terapia
// Era un falso positivo perché: (a) therapyScope fallbackava al testo completo
// (bug normalizzazione); (b) "Allergie: Nurofen" era nel testo completo.
// Fix: con Bug-NORM-1 risolto, S.TERAPIA_DOMICILIARE è correttamente popolato
// e therapyScope non include la sezione ALLERGIE.
// ─────────────────────────────────────────────────────────────────────────────
runTest("BUG-THERAPY-3 · Ibuprofene/Nurofen NON estratto (è allergene, non terapia)", () => {
  assert(
    !drugs.includes("Ibuprofene"),
    `Ibuprofene NON presente in therapies (got: [${drugs.join(", ")}])`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-THERAPY-4: FANS NON deve comparire come terapia attiva
// "migliorata dopo FANS" nel raccordo è un riferimento storico, non una
// prescrizione attiva. Il raccordo non è in therapyScope.
// ─────────────────────────────────────────────────────────────────────────────
runTest("BUG-THERAPY-4 · FANS NON estratto come terapia attiva (menzione storica nel raccordo)", () => {
  const activeFans = th.find(t => t.drug_name === "FANS" && t.status === "active");
  assert(
    !activeFans,
    "FANS con status 'active' NON deve essere presente",
    activeFans,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-LAB-PROT-1: "proteinuria 24h nn" → valore 24 g/24h (CORRUZIONE DATI)
//
// Root cause (doppio):
//  (a) extractQualitativeResults: la regex ALIAS\s*(nn|...) non catturava "nn"
//      quando preceduto da "24h" (qualificatore temporale), quindi il parametro
//      NON entrava in qualKeys e il controllo "if (qualKeys.has(param.key)) continue"
//      non scattava.
//  (b) extractLabValues: il numero "24" in "24h" veniva estratto come valore
//      misurato; l'unità "h" non matchava nessuna knownUnit → defaultUnit="g/24h"
//      → falso risultato "24 g/24h".
//
// Fix:
//  (a) Regex qualitativa ampliata: ALIAS (?:\s+\d{1,3}\s*(?:h|ore))? [=:]? (nn|...)
//  (b) Time-qualifier guard: dopo il match numerico, se il testo immediatamente
//      successivo inizia con h/hr/hour/ore → skip (è periodo di raccolta, non valore).
//
// Regola clinica: meglio nessun dato che un dato falso.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// BUG-PCR-1: Regola locale RheumaFlow — PCR senza unità = mg/dL (non mg/L)
//
// Precedentemente: defaultUnit="mg/L" + normalize(mg/dL → mg/L via ×10)
//   "PCR 0.07" → 0.07 mg/dL → normalize → 0.7 mg/L (conversione implicita vietata)
//
// Fix:
//   defaultUnit="mg/dL". normalize rimosso. inferred_unit=true quando unità assente.
//   referenceHighByUnit: { "mg/dL": 0.5, "mg/L": 5 } per status corretto per unità.
//   Per parametri ad alto rischio (HIGH_RISK_KEYS): inferred_unit → confidence="low"
//   → va in lab_review_items, NON in lab_exams.
//
// Test diretti su extractLabValues (prima del confidence split in visitTextParser).
// ─────────────────────────────────────────────────────────────────────────────
runTest("BUG-PCR-1 · PCR senza unità → mg/dL (default locale), non mg/L", () => {
  const items = extractLabValues("PCR 0.07");
  const pcr   = items.find(i => i.key === "crp");
  assert(pcr != null, "PCR deve essere estratta", items.map(i => i.key));
  assert(pcr.unit === "mg/dL", `unit deve essere 'mg/dL' (got: '${pcr.unit}')`, pcr);
  assert(pcr.value === 0.07,   `value deve essere 0.07 (got: ${pcr.value})`,   pcr);
  assert(pcr.inferred_unit === true, "inferred_unit deve essere true (unità non specificata)", pcr);
});

runTest("BUG-PCR-1b · PCR 0.07 → status normal (< 0.5 mg/dL)", () => {
  const pcr = extractLabValues("PCR 0.07").find(i => i.key === "crp");
  assert(pcr?.status === "normal", `status deve essere 'normal' per 0.07 mg/dL (got: ${pcr?.status})`, pcr);
});

runTest("BUG-PCR-1c · PCR 1.03* → valore 1.03 mg/dL (inferred), status high, confidence low", () => {
  const items = extractLabValues("PCR 1.03*");
  const pcr   = items.find(i => i.key === "crp");
  assert(pcr != null, "PCR 1.03* deve essere estratta", items.map(i => i.key));
  assert(pcr.value === 1.03, `value deve essere 1.03 (got: ${pcr.value})`, pcr);
  assert(pcr.unit === "mg/dL", `unit deve essere 'mg/dL' (got: '${pcr.unit}')`, pcr);
  assert(pcr.inferred_unit === true, "inferred_unit = true", pcr);
  assert(pcr.confidence === "low", `confidence deve essere 'low' per HIGH_RISK senza unità (got: ${pcr.confidence})`, pcr);
  assert(pcr.status === "high", `status deve essere 'high' per 1.03 > 0.5 mg/dL (got: ${pcr.status})`, pcr);
});

runTest("BUG-PCR-1d · PCR 7 mg/L → unit=mg/L, status high (> 5 mg/L), inferred_unit=false", () => {
  const pcr = extractLabValues("PCR 7 mg/L").find(i => i.key === "crp");
  assert(pcr != null, "PCR 7 mg/L deve essere estratta");
  assert(pcr.unit === "mg/L",       `unit deve essere 'mg/L' (got: '${pcr.unit}')`, pcr);
  assert(pcr.value === 7,           `value deve essere 7 (got: ${pcr.value})`,       pcr);
  assert(pcr.status === "high",     `status deve essere 'high' per 7 > 5 mg/L (got: ${pcr.status})`, pcr);
  assert(pcr.inferred_unit === false, "inferred_unit deve essere false (unità esplicita)", pcr);
  // Con unità esplicita → inferred_unit=false → confidence="high" anche per HIGH_RISK
  assert(pcr.confidence === "high", `confidence deve essere 'high' quando unità è esplicita (got: ${pcr.confidence})`, pcr);
});

runTest("BUG-PCR-1e · PCR 0.7 mg/dL → unit=mg/dL, status high (> 0.5), inferred_unit=false", () => {
  const pcr = extractLabValues("PCR 0.7 mg/dL").find(i => i.key === "crp");
  assert(pcr != null, "PCR 0.7 mg/dL deve essere estratta");
  assert(pcr.unit === "mg/dL",      `unit deve essere 'mg/dL' (got: '${pcr.unit}')`, pcr);
  assert(pcr.value === 0.7,         `value deve essere 0.7 (got: ${pcr.value})`,       pcr);
  assert(pcr.status === "high",     `status deve essere 'high' per 0.7 > 0.5 mg/dL (got: ${pcr.status})`, pcr);
  assert(pcr.inferred_unit === false, "inferred_unit = false per unità esplicita", pcr);
});

runTest("BUG-PCR-1f · PCR 3 mg/L normale (< 5 mg/L) → status normal", () => {
  const pcr = extractLabValues("PCR 3 mg/L").find(i => i.key === "crp");
  assert(pcr?.status === "normal", `3 mg/L deve essere 'normal' (< 5 mg/L) (got: ${pcr?.status})`, pcr);
});

runTest("BUG-PCR-1g · nessuna conversione implicita mg/dL → mg/L", () => {
  const pcr = extractLabValues("PCR 0.5 mg/dL").find(i => i.key === "crp");
  assert(pcr != null, "PCR 0.5 mg/dL deve essere estratta");
  // Il valore NON deve essere moltiplicato per 10 (vecchio normalize)
  assert(pcr.value === 0.5,    `value deve restare 0.5 (non convertire a 5) (got: ${pcr.value})`, pcr);
  assert(pcr.unit === "mg/dL", `unit deve restare 'mg/dL' (got: '${pcr.unit}')`, pcr);
  assert(pcr.normalizedValue == null, `normalizedValue deve essere null (no conversione) (got: ${pcr.normalizedValue})`, pcr);
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-LAB-PROT-1: "proteinuria 24h nn" → valore 24 g/24h (CORRUZIONE DATI)
// (stessa famiglia, test separati per chiarezza)
// ─────────────────────────────────────────────────────────────────────────────
runTest("BUG-LAB-PROT-1 · 'proteinuria 24h nn' → null, non 24 g/24h", () => {
  const items = extractLabValues("proteinuria 24h nn, microematuria neg");

  const protItem = items.find(i => i.key === "proteinuria");

  assert(
    protItem == null || protItem.value === null,
    `proteinuria NON deve avere value numerico (valore: ${protItem?.value ?? "null"}, unità: ${protItem?.unit ?? "-"})`,
    protItem,
  );
  assert(
    protItem == null || protItem.status === "normal",
    `proteinuria deve avere status 'normal' quando trovato (got: ${protItem?.status ?? "null"})`,
    protItem,
  );
});

runTest("BUG-LAB-PROT-1b · varianti ortografiche del qualificatore temporale", () => {
  const cases = [
    "proteinuria 24 h nn",
    "proteinuria 24hr nn",
    "proteinuria 24ore nn",
    "proteinuria 24h nella norma",
    "proteinuria 24h negativa",
    "proteinuria 24h assente",
  ];
  for (const input of cases) {
    const items = extractLabValues(input);
    const prot = items.find(i => i.key === "proteinuria");
    assert(
      prot == null || prot.value === null,
      `"${input}" → proteinuria value deve essere null (got: ${prot?.value ?? "null"} ${prot?.unit ?? ""})`,
      prot,
    );
  }
});

runTest("BUG-LAB-PROT-1c · valore reale proteinuria NON viene bloccato", () => {
  const items = extractLabValues("proteinuria 1.2 g/24h");
  const prot = items.find(i => i.key === "proteinuria");
  assert(
    prot != null && prot.value === 1.2,
    `Valore reale "1.2 g/24h" deve essere estratto correttamente (got: ${prot?.value ?? "null"})`,
    prot,
  );
});

runTest("BUG-LAB-PROT-1d · EU 04/04/26 nella lettera clinica → no valore numerico per proteinuria", () => {
  const labs = extracted.lab_exams ?? [];
  const allItems = labs.flatMap(l => l.values ? Object.entries(l.values) : []);
  const protVal = allItems.find(([k]) => k === "proteinuria" || k === "proteinuria_24h");
  assert(
    protVal == null || protVal[1] == null || protVal[1] === "",
    `Nella lettera clinica, EU 04/04/26 'proteinuria 24h nn' NON deve produrre valore numerico (got: ${JSON.stringify(protVal?.[1])})`,
    protVal,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-URINE — pannello Urine / Proteinuria
// ─────────────────────────────────────────────────────────────────────────────

runTest("BUG-URINE-1 · '17 emazie/campo' → urine_rbc=17, non assorbito come numero libero", () => {
  const text = "EU 04/04/26: 17 emazie/campo, proteinuria 24h nn";
  const items = extractLabValues(text);

  const rbc = items.find(i => i.key === "urine_rbc");
  assert(rbc != null, "urine_rbc deve essere estratto da '17 emazie/campo'", items.map(i => i.key));
  assert(rbc.value === 17, `urine_rbc.value deve essere 17 (got ${rbc?.value})`, rbc);
  assert(rbc.unit === "/campo", `urine_rbc.unit deve essere '/campo' (got '${rbc?.unit}')`, rbc);

  const prot = items.find(i => i.key === "proteinuria");
  assert(prot != null, "'proteinuria 24h nn' deve produrre un item proteinuria", items.map(i => i.key));
  assert(
    prot.value == null && prot.qualitative === "nella norma",
    `proteinuria deve essere qualitativa 'nella norma', NON numerica (got value=${prot?.value}, qual=${prot?.qualitative})`,
    prot,
  );
});

runTest("BUG-URINE-2 · '5 leucociti/campo' → urine_wbc=5", () => {
  const text = "EU 12/03/26: 5 leucociti/campo, peso specifico 1015, pH urine 6.0";
  const items = extractLabValues(text);

  const wbc = items.find(i => i.key === "urine_wbc");
  assert(wbc != null, "urine_wbc deve essere estratto da '5 leucociti/campo'", items.map(i => i.key));
  assert(wbc.value === 5, `urine_wbc.value deve essere 5 (got ${wbc?.value})`, wbc);

  const sg = items.find(i => i.key === "urine_sg");
  assert(sg != null, "urine_sg deve essere estratto da 'peso specifico 1015'", items.map(i => i.key));
  assert(sg.value === 1015, `urine_sg.value deve essere 1015 (got ${sg?.value})`, sg);

  const ph = items.find(i => i.key === "urine_ph");
  assert(ph != null, "urine_ph deve essere estratto da 'pH urine 6.0'", items.map(i => i.key));
  assert(ph.value === 6.0, `urine_ph.value deve essere 6.0 (got ${ph?.value})`, ph);
});

runTest("BUG-URINE-3 · pannello ha chiave 'proteinuria' (non proteinuria_24h) allineata all'extractor", () => {
  const urinePanel = LAB_PANELS.urine;
  assert(urinePanel != null, "pannello 'urine' deve esistere");

  const hasProteuria24h = urinePanel.tests.some(t => t.key === "proteinuria_24h");
  assert(!hasProteuria24h, "pannello NON deve avere chiave 'proteinuria_24h' (usa 'proteinuria')", urinePanel.tests.map(t => t.key));

  const hasProteinuria = urinePanel.tests.some(t => t.key === "proteinuria");
  assert(hasProteinuria, "pannello deve avere chiave 'proteinuria' allineata all'extractor", urinePanel.tests.map(t => t.key));

  const hasAcr = urinePanel.tests.some(t => t.key === "acr");
  assert(hasAcr, "pannello deve avere chiave 'acr' per ACR", urinePanel.tests.map(t => t.key));

  assert(urinePanel.label === "Urine / Proteinuria", `label pannello deve essere 'Urine / Proteinuria' (got '${urinePanel.label}')`, urinePanel.label);
});

// ─────────────────────────────────────────────────────────────────────────────
// Sanity checks aggiuntivi
// ─────────────────────────────────────────────────────────────────────────────
runTest("SANITY · lab_exams estratti dalla sezione 'In visione'", () => {
  const labs = extracted.lab_exams ?? [];
  const dates = labs.map(l => l.date);
  assert(
    labs.length > 0,
    `lab_exams non vuoto (got ${labs.length} exam/i)`,
  );
  assert(
    dates.includes("2026-05-04"),
    "EE 04/05/2026 estratto con data 2026-05-04",
    dates,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// [BUG-LAB-FRAG-1] un prelievo = un record
// Parser non deve frammentare stessa data in più record (uno per pannello).
// ─────────────────────────────────────────────────────────────────────────────
runTest("[BUG-LAB-FRAG-1] · nessuna data duplicata in lab_exams (un prelievo = un record)", () => {
  const labs = extracted.lab_exams ?? [];
  const dateCounts = {};
  for (const ex of labs) {
    if (ex.date) dateCounts[ex.date] = (dateCounts[ex.date] || 0) + 1;
  }
  const duplicates = Object.entries(dateCounts).filter(([, n]) => n > 1);
  assert(
    duplicates.length === 0,
    `Nessuna data duplicata — una data deve avere un solo record`,
    duplicates,
  );
});

runTest("[BUG-LAB-FRAG-2] · multi-pannello stesso giorno → un solo record con tutti i risultati (tramite extractLabValuesByDate)", () => {
  // Test diretto sull'estrattore: stessa data, parametri di pannelli diversi → deve tornare 1 date-group
  const snippet = "EE 10/01/2025: Hb 12.5 g/dL, WBC 6200 cellule/uL, PLT 180 x10^9/L, VES 45 mm/h, PCR 1.8 mg/dL, Creatinina 0.9 mg/dL";
  const groups = extractLabValuesByDate(snippet);
  // L'estrattore deve tornare 1 date-group (10/01/2025)
  const grp = groups.find(g => g.date === "2025-01-10");
  assert(grp != null, "Date-group 2025-01-10 estratto dall'extractLabValuesByDate");
  if (!grp) return;
  const panels = new Set((grp.items || []).map(i => i.panel).filter(p => p && p !== "custom"));
  assert(
    panels.size >= 2,
    `Date-group 10/01/2025 deve avere parametri di ≥2 pannelli (got: ${[...panels].join(", ")})`,
    [...panels],
  );
  // Il parser finale non deve frammentare: un date-group → un lab_exam (assenza di duplicati garantita da BUG-LAB-FRAG-1)
});

runTest("SANITY · raccordo presente", () => {
  assert(
    vs?.raccordo?.toLowerCase().includes("porpur") ||
      vs?.raccordo?.toLowerCase().includes("agosto"),
    "visit_sections.raccordo contiene anamnesi clinica",
    vs?.raccordo?.slice(0, 120),
  );
});

// ════════════════════════════════════════════════════════════════════
// BUG-LAB-KEYS — chiavi canoniche nei lab_exams
// Root cause: groupLabValuesByDate usava lv.label come name;
//   toCanonicalLabKey("Hb / Emoglobina") → "hb_emoglobina" (slug del label)
//   non trovato in mappa → salvato as-is nel DB invece di "hb".
// Fix: VisitImportButton usa r.param_key || toCanonicalLabKey(r.name).
// ════════════════════════════════════════════════════════════════════

const SNIPPET_EE_0405 = `In visione:
- EE 04/05/2026: Hb 13.5 g/dL WBC 15800 N 9700 Ly 5500 PLT 361.000 VES 10 PCR 0.07 mg/dL Creatinina 0.81 mg/dL AST 14 ALT 11 GGT 14`;

const SNIPPET_EE_0331 = `In visione:
- EE 13/03/26: Hb 14.0 g/dL WBC 9500 PLT 215.000
- EE 31/03/26: FR neg, ANA neg, c-ANCA neg, p-ANCA neg, C3 120 mg/dL, C4 22 mg/dL, IgG 1100 mg/dL, IgA 180 mg/dL, IgM 85 mg/dL, crioglobuline neg, HBsAg neg, Anti-HCV neg, Anti-HIV neg`;

runTest("[BUG-LAB-KEYS-1] · param_key usato come chiave → no chiavi composte (hb, not hb_emoglobina)", () => {
  const groups = extractLabValuesByDate(SNIPPET_EE_0405);
  const grp = groups.find(g => g.date === "2026-05-04");
  assert(grp != null, "Date-group 2026-05-04 trovato");
  if (!grp) return;

  const keys = (grp.items || []).map(i => i.key);
  const expected = ["hb", "wbc", "neutrophils", "lymphocytes", "plt", "ves", "crp", "creatinine", "ast", "alt", "ggt"];
  for (const k of expected) {
    assert(keys.includes(k), `param_key "${k}" presente nel date-group (non forma composta)`, keys);
  }
  // Nessuna chiave composta con slash-slug
  const compound = keys.filter(k => k.includes("_emoglobina") || k.includes("_wbc") || k.includes("_piastrine") || k.includes("_esr") || k.includes("_crp") || k.includes("_got") || k.includes("_gpt"));
  assert(compound.length === 0, `Nessuna chiave composta (es. hb_emoglobina) — got: ${compound.join(", ")}`, compound);
});

runTest("[BUG-LAB-KEYS-2] · param_key usato come chiave nel record finale (groupLabValuesByDate)", () => {
  // Test diretto: verifica che param_key sia presente e sia la chiave corretta
  const groups = extractLabValuesByDate(SNIPPET_EE_0405);
  const grp = groups.find(g => g.date === "2026-05-04");
  if (!grp) { assert(false, "Date-group 2026-05-04 non trovato"); return; }

  const paramKeys = (grp.items || []).map(i => i.key).filter(Boolean);
  assert(paramKeys.includes("crp"),        'param_key "crp" presente (non "pcr" né "pcr_crp")',        paramKeys);
  assert(paramKeys.includes("creatinine"), 'param_key "creatinine" presente (non "creatinina")',        paramKeys);
  assert(paramKeys.includes("hb"),         'param_key "hb" presente (non "hb_emoglobina")',              paramKeys);
  assert(paramKeys.includes("wbc"),        'param_key "wbc" presente (non "gb_wbc")',                    paramKeys);
  assert(paramKeys.includes("plt"),        'param_key "plt" presente (non "plt_piastrine")',             paramKeys);
  assert(paramKeys.includes("ast"),        'param_key "ast" presente (non "ast_got")',                   paramKeys);
  assert(paramKeys.includes("alt"),        'param_key "alt" presente (non "alt_gpt")',                   paramKeys);
});

runTest("[BUG-LAB-KEYS-3] · prelievo 31/03 → autoimmunità + complemento + sierologie estratti", () => {
  const groups = extractLabValuesByDate(SNIPPET_EE_0331);
  const grp0331 = groups.find(g => g.date === "2026-03-31");
  assert(grp0331 != null, "Date-group 2026-03-31 trovato");
  if (!grp0331) return;

  const keys = (grp0331.items || []).map(i => i.key);
  // Complemento
  assert(keys.includes("c3"),  'C3 estratto', keys);
  assert(keys.includes("c4"),  'C4 estratto', keys);
  // Immunoglobuline
  assert(keys.includes("igg"), 'IgG estratto', keys);
  assert(keys.includes("iga"), 'IgA estratto', keys);
  assert(keys.includes("igm"), 'IgM estratto', keys);
  // Autoanticorpi qualitative
  const items = grp0331.items || [];
  const fr    = items.find(i => i.key === "fr");
  const ana   = items.find(i => i.key === "ana_titolo" || i.key === "ana_pattern");
  const anca  = items.find(i => i.key === "anca_pr3" || i.key === "anca_mpo");
  assert(fr != null,   'FR estratto',   keys);
  assert(ana != null,  'ANA estratto',  keys);
  assert(anca != null, 'ANCA estratto', keys);
});

runTest("[BUG-LAB-KEYS-4] · result.param_key sempre presente e mai nullo per parametri noti", () => {
  const groups = extractLabValuesByDate(SNIPPET_EE_0405);
  const grp = groups.find(g => g.date === "2026-05-04");
  if (!grp) { assert(false, "Date-group non trovato"); return; }

  const missingParamKey = (grp.items || []).filter(i => !i.key);
  assert(
    missingParamKey.length === 0,
    `Tutti i parametri hanno un key (param_key non nullo) — mancante su: ${missingParamKey.map(i => i.label).join(", ")}`,
    missingParamKey.map(i => i.label),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-INSTR — instrumental parser keyword merging
// ─────────────────────────────────────────────────────────────────────────────

runTest("BUG-INSTR-1 · RX TORACE + ECOGRAFIA ADDOME → 2 record separati (no merging)", () => {
  const text = `ESAMI PREGRESSI
RX TORACE 15/01/2026: negativo, no versamenti, silhouette cardiaca nei limiti
ECOGRAFIA ADDOME 20/02/2026: fegato nei limiti, reni nella norma, no litiasi`;
  const findings = parseInstrumentalFindings(text);

  assert(findings.length >= 2, `Attesi almeno 2 esami, trovati ${findings.length}`, findings.map(f => f.examLabel));

  const rx = findings.find(f => f.examType === "xray");
  assert(rx != null, "RX TORACE deve essere estratto come examType='xray'", findings.map(f => f.examType));
  assert(
    !(rx.reportText || "").toLowerCase().includes("fegato"),
    `RX TORACE NON deve assorbire il testo di ECOGRAFIA (got reportText: '${rx.reportText}')`,
    rx,
  );

  const eco = findings.find(f => f.examLabel === "Ecografia");
  assert(eco != null, "ECOGRAFIA ADDOME deve essere estratta come examLabel='Ecografia'", findings.map(f => f.examLabel));
  assert(
    (eco.reportText || eco.territory || "").toLowerCase().includes("fegato") ||
    (eco.territory || "").toLowerCase().includes("addome"),
    `ECOGRAFIA deve contenere riferimento a fegato/addome (got: territory='${eco.territory}' reportText='${eco.reportText}')`,
    eco,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BUG-LAB-QUAL — qualitative extraction: nei limiti, non consumato, negativo/a/e
// ─────────────────────────────────────────────────────────────────────────────

runTest("BUG-LAB-QUAL-1 · 31/03 → FR neg, ANCA generico, antifosfolipidi, C3/C4/C1q non consumati, IgG/IgA/IgM nei limiti, crioglobuline neg", () => {
  const groups = extractLabValuesByDate(LETTER_VASCULITE);
  const grp = groups.find(g => g.date === "2026-03-31");
  assert(grp != null, "date-group 2026-03-31 trovato in LETTER_VASCULITE");
  if (!grp) return;
  const items = grp.items || [];
  const keys  = items.map(i => i.key);

  const fr = items.find(i => i.key === "fr");
  assert(fr != null && (fr.status === "negative" || fr.qualitative === "negativo"),
    "FR neg estratto", { keys, fr });

  const anca = items.find(i => i.key === "anca");
  assert(anca != null && (anca.status === "negative" || anca.qualitative != null),
    "ANCA generico neg estratto (key='anca')", { keys, anca });

  const apls = items.find(i => i.key === "antifosfolipidi");
  assert(apls != null && (apls.status === "negative" || apls.qualitative != null),
    "Antifosfolipidi neg estratto (key='antifosfolipidi')", { keys, apls });

  const c3 = items.find(i => i.key === "c3");
  assert(c3 != null && c3.qualitative != null,
    "C3 qualitativo estratto (non consumato)", { keys, c3 });

  const c4 = items.find(i => i.key === "c4");
  assert(c4 != null && c4.qualitative != null,
    "C4 qualitativo estratto (non consumato)", { keys, c4 });

  const c1q = items.find(i => i.key === "c1q");
  assert(c1q != null && c1q.qualitative != null,
    "C1q qualitativo estratto (non consumato)", { keys, c1q });

  const igg = items.find(i => i.key === "igg");
  assert(igg != null && igg.qualitative != null,
    "IgG qualitativo estratto (nei limiti)", { keys, igg });

  const iga = items.find(i => i.key === "iga");
  assert(iga != null && iga.qualitative != null,
    "IgA qualitativo estratto (nei limiti)", { keys, iga });

  const igm = items.find(i => i.key === "igm");
  assert(igm != null && igm.qualitative != null,
    "IgM qualitativo estratto (nei limiti)", { keys, igm });

  const crio = items.find(i => i.key === "crioglobuline");
  assert(crio != null && (crio.status === "negative" || crio.qualitative != null),
    "Crioglobuline neg estratte", { keys, crio });
});

// ─────────────────────────────────────────────────────────────────────────────
// PELLICONI — lettera reale (AR sieronegativa, AUSL Bologna, formato inline)
// 9 asserzioni che coprono i bug corretti: terapia_domiciliare, allergie,
// Urbason attivo, no falso stop Medrol, MTX sospeso + motivo, lab con date
// parentesizzate/mesi italiani, anamnesi senza header duplicato.
// ─────────────────────────────────────────────────────────────────────────────

const LETTER_PELLICONI = `Gent.le collega
controllo in pz. con osteoartrosi e artrite reumatoide
ANAMNESI FISIOLOGICA: mai fumatrice, mai fratture, menopausa a 50 aa, in precedenza operaia in calzaturificio, OSS.
ANAMNESI PATOLOGICA REMOTA: quantiferon positivo riscontrato nel 2011  e profilassi con nicozid 300 mg per 9 mesi, ipertensione arteriosa, discopatie.
IC alluce valgo maggio 2020, isterectomia per fibromatosi.
TERAPIA: atenololo - colecalciferolo  5 gtt al die - vit K2 -  urbason 4 mg : 1/2 cp al die
Nega allergie.

RACCORDO ANAMNESTICO: pz. Affetta da artrite reumatoide acpa negativa  a scarsa attivita'. Sempre seguita a ferrara per artrite reumatoide sieronegativa in terapia dal 2011 con methotrexate 10 mg / settimana  e steroidi a basso dosaggio ( 4 mg al die ) , ultima visita di controllo effettuata nel mese di  giugno 2021 veniva  confermato  un quadro articolare in remissione sotto MTX e basso dosaggio di steroide (Medrol 4 mg mai sospeso dal 2011). Eseguite nel 2018 le radiografie ai piedi - mani : artrosi diffusa , entesopatia achillea , piccolo sperone calcaneare sx . artrosi alle mani.
Tentata prima sospensione di MTX a settembre 2022, poi ripreso dopo 3 mesi per ripresa delle artralgie, poi sospeso a metà 2023 per intolleranza GI. Valutata dalla mia collega Chiarini a agosto 2024 dopo 2 anni dall'ultimo controllo reumatologico: assumeva solo medrol 16 mg : 1/4 cp al die. Non artrite attiva al controllo, la sintomatologia riferita era principalmente meccanica localizzata ai piedi  e rachide cervicale, nega episodi di tumefazione articolare. Si prescrivevano ecografie articolari e si sospendeva steroide.

ACCERTAMENTI PRECEDENTI :
- Esami ( 4/1/22) : gb 17,42 * - gr 5,48 * - hb 14,7 - plt 332 - ves 5 - creatinina 0,97 - ast 16 - alt 13 - pcr 0,78 - urine nn
- Esami ( giugno 2022 )  : gb 12,55 - gr 5,33 hb 14,3 - plt 264 - creatinina 1 - calcio 9 - ast 17 - alt 15-  fa 102 - calciuria nn - tsh 5,43 * - pth nn - vit d 20 - urine nn - elettroforesi nn
- EE ( ottobre 2024 ) : alt 12 - pcr 0,58 - IVU - gb 11,75 - gr 5,25 - hb 14,2 - plt 291 - ves 14 - creatinina 1
- EE 28/12/24: Hb 13.9, MCV 83, WBC 10.1, N 5.1, LY 3.7, Plt 281, VES 12, PCR non in visione, cr 1.03, GOT/GPT/GGT 18/14/19, FR e ACPA neg, ANA neg, vit D 40, HBV reflex, HCV neg, ELF di norma.
- ECOGRAFIA MANI E PIEDI (11/2024): non segni di artrite attiva.

VISITA ODIERNA:
Peggioramento delle artralgie a livello dei piedi . Non riesce a sospendere l'Urbason che attualmente assume al dosaggio di 2 mg al die .Assenza di tumefazione articolare. Il dolore è peggiore nei movimenti, talora anche a riposo. Aveva sospeso palexia e passaggio a Targin , non tollerato . Sospeso l'alendronato su suggerimento del MMG .

IN VISIONE :
- EE ( agosto 2025 ) : emocromo nn - ves 22 - creatinina 1,16 - alt 12 - pcr 0,88 - IVU - elettroforesi nn

OBBIETTIVAMENTE : non segni di artrite periferica.  Pes planus. Scrosci alle ginocchia. Non limitazione alle spalle , anche .

CONCLUSIONI: Diagnosi di artrite reumatoide sieronegativa non in fase di attività.

INDICAZIONI:
- Urbason 4 mg  : 1/2  cp due giorni alla settimana , poi prova a sospendere
- Flogorest : 1 cp al die per 10 gg
- continua la vitamina D

Controllo programmato tra 9 mesi con esami.
Cordiali  saluti`;

const _pelliconiParsed  = parseVisitText(LETTER_PELLICONI, null);
const _pgP  = _pelliconiParsed.extracted.profilo_generale ?? {};
const _vsP  = _pelliconiParsed.extracted.visit_sections  ?? {};
const _thP  = _pelliconiParsed.extracted.therapies       ?? [];
const _labP = _pelliconiParsed.extracted.lab_exams       ?? [];
const _revP = _pelliconiParsed.extracted.lab_review_items ?? [];
const _allLabsP = [..._labP, ..._revP];

const _raccordoTextP = LETTER_PELLICONI.match(
  /RACCORDO ANAMNESTICO\s*:([\s\S]*?)(?=\nACCERTAMENTI|\nVISITA ODIERNA|\nIN VISIONE|\nOBBIETTIVAMENTE)/
)?.[1]?.trim() ?? "";
const _raccordoResultP = parseRaccordoTimeline(_raccordoTextP);
const _raccordoEventsP = _raccordoResultP?.events ?? _raccordoResultP ?? [];

runTest("PELLICONI-1 · terapia_domiciliare pulita (no 'Nega allergie')", () => {
  const td = _pgP.terapia_domiciliare ?? "";
  assert(
    td !== null && td.length > 0,
    `terapia_domiciliare non deve essere null (got: ${JSON.stringify(td)})`,
    td,
  );
  assert(
    !/\b(?:nega|nessuna?)\s+allergi/i.test(td),
    `terapia_domiciliare non deve contenere 'nega allergie' (got: '${td}')`,
    td,
  );
  assert(
    /atenololo/i.test(td) && /urbason|metilprednisolone/i.test(td),
    `terapia_domiciliare deve contenere atenololo e urbason (got: '${td}')`,
    td,
  );
});

runTest("PELLICONI-2 · allergie = 'Nega allergie' estratta dal testo terapia", () => {
  assert(
    !!_pgP.allergie,
    `allergie non deve essere null (got: ${JSON.stringify(_pgP.allergie)})`,
    _pgP.allergie,
  );
  assert(
    /nega|nessuna/i.test(_pgP.allergie ?? ""),
    `allergie deve riflettere la negazione (got: '${_pgP.allergie}')`,
    _pgP.allergie,
  );
});

runTest("PELLICONI-3 · Urbason/Metilprednisolone presente come terapia ACTIVE", () => {
  const urbason = _thP.find(t => /metilprednisolone|urbason/i.test(t.drug_name ?? ""));
  assert(
    urbason != null,
    `Metilprednisolone deve essere nella lista terapie (trovati: ${_thP.map(t => t.drug_name).join(", ")})`,
    _thP.map(t => ({ name: t.drug_name, status: t.status })),
  );
  assert(
    urbason?.status === "active",
    `Metilprednisolone deve essere ACTIVE (got: '${urbason?.status}')`,
    urbason,
  );
});

runTest("PELLICONI-4 · nessun falso therapy_stop per Medrol/Urbason nel raccordoParser", () => {
  const falsoStop = _raccordoEventsP.find(
    e => e.event_type === "therapy_stop" && /metilprednisolone|medrol|urbason/i.test(e.drug_name ?? ""),
  );
  assert(
    falsoStop == null,
    `Non devono esserci therapy_stop per Medrol/Urbason (trovato: ${JSON.stringify(falsoStop)})`,
    _raccordoEventsP.map(e => ({ type: e.event_type, drug: e.drug_name })),
  );
});

runTest("PELLICONI-5 · MTX presente come terapia discontinued con motivo 'intolleranza GI'", () => {
  const mtx = _thP.find(t => /methotrexate/i.test(t.drug_name ?? ""));
  assert(
    mtx != null,
    `Methotrexate deve essere nella lista terapie (trovati: ${_thP.map(t => t.drug_name).join(", ")})`,
    _thP.map(t => t.drug_name),
  );
  assert(
    mtx?.status !== "active",
    `Methotrexate deve essere discontinued/historical (got: '${mtx?.status}')`,
    mtx,
  );
  assert(
    /intolleranz/i.test(mtx?.discontinuation_reason ?? ""),
    `discontinuation_reason MTX deve contenere 'intolleranza' (got: '${mtx?.discontinuation_reason}')`,
    mtx?.discontinuation_reason,
  );
});

runTest("PELLICONI-6 · EE 28/12/2024 estratto con data corretta (parentesi nel testo)", () => {
  const grp = _allLabsP.find(l => l.date === "2024-12-28");
  assert(
    grp != null,
    "EE 28/12/24 deve essere estratto con date='2024-12-28'",
    _allLabsP.map(l => l.date),
  );
  const items = grp?.results ?? grp?.items ?? [];
  const keys = items.map(i => i.param_key ?? i.key ?? i.name ?? "");
  assert(
    keys.some(k => /^ast$|^alt$|^ggt$/i.test(k)),
    `EE 28/12 deve contenere almeno uno tra ast/alt/ggt (estratti alta-confidenza, keys: ${keys.join(", ")})`,
    keys,
  );
  assert(
    keys.some(k => /^acpa_anti_ccp$|^ana_titolo$|^hcv$/i.test(k)),
    `EE 28/12 deve contenere parametri autoimmuni (acpa/ana/hcv, keys: ${keys.join(", ")})`,
    keys,
  );
});

runTest("PELLICONI-7 · EE agosto 2025 estratto (mese italiano nel testo)", () => {
  const grp = _allLabsP.find(l => l.date === "2025-08-01");
  assert(
    grp != null,
    "EE agosto 2025 deve essere estratto con date='2025-08-01'",
    _allLabsP.map(l => l.date),
  );
});

runTest("PELLICONI-8 · visit_sections.anamnesi = VISITA ODIERNA (no raccordo troncato, no header duplicato)", () => {
  const anamnesi = _vsP.anamnesi ?? "";
  assert(
    !anamnesi.toLowerCase().startsWith("anamnesi intervallare"),
    `anamnesi non deve iniziare con l'header ridondante (inizio: '${anamnesi.slice(0, 60)}')`,
    anamnesi.slice(0, 80),
  );
  assert(
    !anamnesi.toLowerCase().includes("anamnesi intervallare"),
    `anamnesi non deve contenere il testo 'ANAMNESI INTERVALLARE' al suo interno`,
    anamnesi.slice(0, 200),
  );
  assert(
    /peggioramento delle artralgie/i.test(anamnesi),
    `anamnesi deve contenere il contenuto VISITA ODIERNA ('Peggioramento delle artralgie', inizio: '${anamnesi.slice(0, 80)}')`,
    anamnesi.slice(0, 120),
  );
});

runTest("PELLICONI-10 · visit_sections.raccordo completo (non troncato a 'ultima visita di controllo')", () => {
  const raccordo = _vsP.raccordo ?? "";
  assert(
    /effettuata nel mese di.*giugno 2021/i.test(raccordo),
    `raccordo deve contenere la continuazione dopo 'controllo' (inizio: '${raccordo.slice(0, 80)}')`,
    raccordo.slice(0, 200),
  );
  assert(
    /sospendeva steroide/i.test(raccordo),
    `raccordo deve contenere la fine del testo clinico ('si sospendeva steroide')`,
    raccordo.slice(-150),
  );
});

runTest("PELLICONI-9 · MTX discontinuation_reason non è l'intera frase trigger PAST_AFTER_RE", () => {
  const mtx = _thP.find(t => /methotrexate/i.test(t.drug_name ?? ""));
  const reason = mtx?.discontinuation_reason ?? "";
  assert(
    !reason.startsWith("sospeso a"),
    `discontinuation_reason non deve essere la frase trigger ('sospeso a …') ma solo il motivo (got: '${reason}')`,
    reason,
  );
  assert(
    reason.length < 40,
    `discontinuation_reason deve essere conciso (< 40 char), got: '${reason}'`,
    reason,
  );
});

// ════════════════════════════════════════════════════════════════════
// LAB-DATE — estrazione data referto (detectReportDate)
// Bug #1/#2: niente data odierna/visita forzata; data reale o null.
// ════════════════════════════════════════════════════════════════════

runTest("LAB-DATE-1 · detectReportDate: data prelievo prevale su data stampa", () => {
  const det = detectReportDate("Data prelievo 05/06/2025  -  Data di stampa 07/06/2025");
  assert(det != null, "detectReportDate deve trovare una data", det);
  assert(det?.date === "2025-06-05", `data deve essere il prelievo 2025-06-05 (got ${det?.date})`, det);
  assert(det?.source === "prelievo", `source deve essere 'prelievo' (got ${det?.source})`, det);
});

runTest("LAB-DATE-2 · detectReportDate: null quando nessun pattern esplicito", () => {
  const det = detectReportDate("Emocromo: Hb 13.5 g/dL, WBC 6.2, PLT 250. Paziente in buone condizioni.");
  assert(det === null, "detectReportDate deve tornare null senza date etichettate", det);
});

runTest("LAB-DATE-3 · multi-data (accettazione/prelievo/stampa) → vince prelievo", () => {
  const REPORT_MULTI = `LABORATORIO ANALISI
Data accettazione: 10/03/2024
Data prelievo: 09/03/2024
Data di stampa: 12/03/2024
Emocromo: Hb 13.5 g/dL, WBC 6.2`;
  const det = detectReportDate(REPORT_MULTI);
  assert(det?.date === "2024-03-09", `prelievo (2024-03-09) deve vincere su accettazione/stampa (got ${det?.date})`, det);
  assert(det?.source === "prelievo", `source deve essere 'prelievo' (got ${det?.source})`, det);
});

// ════════════════════════════════════════════════════════════════════
// LAB-NODATE — propagazione null in PATH A (parseVisitText)
// La data non riconosciuta NON deve diventare la data odierna/visita.
// ════════════════════════════════════════════════════════════════════

runTest("LAB-NODATE-1 · lab senza header data → lab_exams.date === null (mai oggi/visita)", () => {
  const LETTER_NODATE_LAB = `MOTIVO DELLA VISITA: controllo

In visione:
Hb 14.0 g/dL, WBC 7800, PLT 198.000, VES 23, PCR 5.8 mg/dL`;
  const { extracted: ex } = parseVisitText(LETTER_NODATE_LAB);
  const labs = ex.lab_exams ?? [];
  assert(labs.length >= 1, `lab_exams non vuoto (got ${labs.length})`, labs);
  assert(
    labs.every(l => l.date === null),
    "ogni lab_exam senza data esplicita deve avere date === null",
    labs.map(l => l.date),
  );
});

runTest("LAB-LABELDATE-1 · header 'Data prelievo:' in sezione lab → data rilevata (non null/oggi)", () => {
  const LETTER_LABEL_DATE = `MOTIVO DELLA VISITA: controllo

In visione:
Data prelievo: 09/03/2024
Hb 14.0 g/dL, WBC 7800, PLT 198.000, VES 23, PCR 5.8 mg/dL`;
  const { extracted: ex } = parseVisitText(LETTER_LABEL_DATE);
  const labs = ex.lab_exams ?? [];
  assert(labs.length >= 1, `lab_exams non vuoto (got ${labs.length})`, labs);
  assert(
    labs.every(l => l.date === "2024-03-09"),
    "lab_exam deve usare la data del prelievo 2024-03-09 (mai null/oggi)",
    labs.map(l => l.date),
  );
});

// ════════════════════════════════════════════════════════════════════
// LAB-URINE — sedimento urinario: niente falsi positivi da RBC ematici
// Bug #4: "Globuli rossi 4.52" (emocromo) NON deve popolare urine_rbc.
// ════════════════════════════════════════════════════════════════════

runTest("LAB-URINE-NOFP-1 · 'Globuli rossi 4.52 10^6/uL' (emocromo) → nessun urine_rbc", () => {
  const items = extractLabValues("Emocromo: Globuli rossi 4.52 10^6/uL, Hb 13.5, WBC 6.2");
  const rbc = items.find(i => i.key === "urine_rbc");
  assert(rbc == null, "RBC ematici non devono produrre urine_rbc (manca unità per-campo)", rbc);
});

runTest("LAB-URINE-NOFP-2 · 'globuli rossi 10.5' senza unità → nessun urine_rbc", () => {
  const items = extractLabValues("Sedimento urinario: globuli rossi 10.5");
  const rbc = items.find(i => i.key === "urine_rbc");
  assert(rbc == null, "'globuli rossi' senza unità per-campo non deve produrre urine_rbc", rbc);
});

runTest("LAB-URINE-NOFP-3 · 'Leucociti 12.4 K/μL' (emocromo) → nessun urine_wbc", () => {
  const items = extractLabValues("Emocromo: Leucociti 12.4 K/μL, Hb 14");
  const wbc = items.find(i => i.key === "urine_wbc");
  assert(wbc == null, "Leucociti ematici non devono produrre urine_wbc (manca unità per-campo)", wbc);
});

runTest("LAB-URINE-REAL-1 · formato compatto 'EU: emazie 22*' in contesto urine → urine_rbc=22", () => {
  const items = extractLabValues("EU: emazie 22*, leucociti 8/campo");
  const rbc = items.find(i => i.key === "urine_rbc");
  assert(rbc != null, "urine_rbc deve essere estratto in contesto urine (EU)", items.map(i => i.key));
  assert(rbc?.value === 22, `urine_rbc.value deve essere 22 (got ${rbc?.value})`, rbc);
  const wbc = items.find(i => i.key === "urine_wbc");
  assert(wbc?.value === 8, `urine_wbc.value deve essere 8 da 'leucociti 8/campo' (got ${wbc?.value})`, wbc);
});

runTest("LAB-HB-1 · solo emocromo 'Hb 14.2' → hb numerico 14.2", () => {
  const items = extractLabValues("Emocromo: GB 6.5, Hb 14.2 g/dL, PLT 250, MCV 88");
  const hb = items.find(i => i.key === "hb");
  assert(hb != null, "hb deve essere estratto", items.map(i => i.key));
  assert(hb?.value === 14.2, `hb.value deve essere 14.2 (got ${hb?.value})`, hb);
});

runTest("LAB-HB-2 · 'Hb 14.2' + urine 'emoglobina assente' → hb numerico 14.2, chiave hb non consumata", () => {
  const items = extractLabValues("Emocromo: Hb 14.2 g/dL, PLT 250, MCV 88. Esame urine: emoglobina assente, proteine assenti");
  const hbAll = items.filter(i => i.key === "hb");
  const hbNum = hbAll.find(i => i.value === 14.2);
  assert(hbNum != null, `hb numerico 14.2 non deve essere oscurato dall'emoglobina urinaria (got ${JSON.stringify(hbAll)})`, items.map(i => i.key));
  const hbQual = hbAll.filter(i => i.value == null);
  assert(hbQual.length === 0, "l'emoglobina urinaria non deve consumare la chiave hb (nessun hb qualitativo)", hbQual);
});

runTest("LAB-HB-3 · 'Emoglobina 14.2' + urine 'emoglobina negativa' → hb numerico 14.2", () => {
  const items = extractLabValues("Emocromo: Emoglobina 14.2 g/dL, PLT 250, MCV 88. Esame urine: emoglobina negativa, proteine assenti");
  const hbAll = items.filter(i => i.key === "hb");
  const hbNum = hbAll.find(i => i.value === 14.2);
  assert(hbNum != null, `hb numerico 14.2 (got ${JSON.stringify(hbAll)})`, items.map(i => i.key));
  const hbQual = hbAll.filter(i => i.value == null);
  assert(hbQual.length === 0, "nessun hb qualitativo da emoglobina urinaria", hbQual);
});

runTest("LAB-HB-4 · 'Hb 13.1' + urine 'emoglobina -' → hb numerico 13.1", () => {
  const items = extractLabValues("Emocromo: Hb 13.1 g/dL, PLT 230, MCV 90. EU: emoglobina -, leucociti assenti");
  const hb = items.find(i => i.key === "hb");
  assert(hb != null && hb.value === 13.1, `hb numerico 13.1 (got ${JSON.stringify(hb)})`, items.map(i => i.key));
});

// ════════════════════════════════════════════════════════════════════
// PSORIASI-ABBREV — caso clinico reale (artrite psoriasica, ETN→ADA-b)
// Bug import: (1) Adalimumab marcato discontinued + Arcoxia come cronico;
// (2) timeline raccordo senza date per ETN/ADA-b; (3) età letta da "20-25 anni".
// Le abbreviazioni biologiche (ETN/ADA-b) richiedono match case-sensitive con \b.
// ════════════════════════════════════════════════════════════════════

const RACCORDO_PSO = `In età infantile verosimile reumatismo articolare acuto trattato con penicillina i.m. Successivo benessere clinico fino ai 20-25 anni, quindi ricomparsa di artralgie etichettate come reumatismo palindromico.
Nel 1990 diagnosi di S. di Sjogren per cui utilizza sostituti lacrimali, trattato per anni con antimalarici sospeso per nms.
Successivamente alla comparsa di manifestazioni cutanee diagnosi di artrite psoriasica, trattata con DMARDs tutti sospesi per intolleranza, quindi adalimumab (2014-2016) sospeso per rialzo glicemico, e successivamente etanercept da metà 2016 con beneficio, tentata sospensione a maggio 2019 con riacutizzazione e ripresa della terapia.
A luglio 2025 sospeso ETN per colelitiasi complicata da sepsi, successive infezioni e colecistectomia parziale per Sd. di Mirizzi tipo II. In tale occasione switch ad ADA-b per precedente perdita di efficacia di ETN.
A marzo 2025 ha ricominciato ADA-b con netto beneficio.`;

const LETTER_PSO = `MOTIVO DELLA VISITA: controllo artrite psoriasica.

TERAPIA DOMICILIARE: Adalimumab, Lyrica 75 mg x2, atenololo, Jardiance, Palexia, Cardirene, Zyloric 150 mg/die, statina/ezetimibe, insulina, Laroxyl 5 gocce.

RACCORDO ANAMNESTICO
${RACCORDO_PSO}

VISITA ODIERNA:
Quadro articolare stabile.

CONCLUSIONI:
Artrite psoriasica in buon controllo con ADA-b.

INDICAZIONI:
- Adalimumab biosimilare/Hyrimoz 40 mg, 1 fiala ogni 15 giorni.
- Se dolore: Arcoxia 90 mg 1 cp al giorno dopo cena per 5-6 giorni, poi stop; ciclo ripetibile max 1 volta/mese; monitoraggio pressorio.
- Invariata la restante terapia.`;

const { extracted: _exPso } = parseVisitText(LETTER_PSO);
const _thPso = _exPso.therapies ?? [];
const _findPso = (re) => _thPso.find(t => re.test(t.drug_name ?? ""));
const _raccPso = parseRaccordoTimeline(RACCORDO_PSO);
const _evPso = _raccPso?.events ?? _raccPso ?? [];
const _evFind = (type, drugRe) =>
  _evPso.filter(e => e.event_type === type && drugRe.test(e.drug_canonical ?? e.drug_name ?? ""));

runTest("PSO-T001-1 · Adalimumab resta ATTIVO (non discontinued)", () => {
  const ada = _findPso(/adalimumab/i);
  assert(ada != null, "Adalimumab deve essere presente nelle therapies", _thPso.map(t => t.drug_name));
  assert(ada?.status === "active", `Adalimumab status deve essere 'active' (got '${ada?.status}')`, ada);
});

runTest("PSO-T001-2 · Arcoxia (Etoricoxib) classificato come PRN/al bisogno", () => {
  const arc = _findPso(/etoricoxib|arcoxia/i);
  assert(arc != null, "Etoricoxib (Arcoxia) deve essere presente", _thPso.map(t => t.drug_name));
  assert(
    arc?._prn === true || arc?.frequency === "al bisogno",
    `Etoricoxib deve essere PRN (freq 'al bisogno' / _prn true), got freq='${arc?.frequency}' _prn=${arc?._prn}`,
    arc,
  );
});

runTest("PSO-T001-3 · Zyloric (Allopurinolo) resta attivo", () => {
  const allo = _findPso(/allopurinolo|zyloric/i);
  assert(allo != null, "Allopurinolo (Zyloric) deve essere presente", _thPso.map(t => t.drug_name));
  assert(allo?.status === "active", `Allopurinolo deve restare 'active' (got '${allo?.status}')`, allo);
});

runTest("PSO-T002-1 · abbreviazioni biologiche: ETN→Etanercept, ADA-b→Adalimumab riconosciute", () => {
  const etn = _evPso.find(e => /etanercept/i.test(e.drug_canonical ?? ""));
  const ada = _evPso.find(e => /adalimumab/i.test(e.drug_canonical ?? ""));
  assert(etn != null, "ETN deve risolvere a Etanercept negli eventi timeline", _evPso.map(e => e.drug_canonical));
  assert(ada != null, "ADA-b deve risolvere a Adalimumab negli eventi timeline", _evPso.map(e => e.drug_canonical));
});

runTest("PSO-T002-2 · ETN start 'metà 2016' in timeline CON data (2016-06, approx)", () => {
  const starts = _evFind("therapy_start", /etanercept/i);
  const s = starts.find(e => e.date_value === "2016-06-01");
  assert(s != null, "deve esistere un therapy_start Etanercept datato 2016-06-01", starts.map(e => e.date_value));
  assert(s?.date_precision === "month_year", `precisione data deve essere month_year (got '${s?.date_precision}')`, s);
  assert(s?.date_approximate === true, "la data 'metà 2016' deve essere marcata approssimativa", s);
});

runTest("PSO-T002-3 · ETN stop 'luglio 2025' in timeline CON data (2025-07)", () => {
  const stops = _evFind("therapy_stop", /etanercept/i);
  const s = stops.find(e => e.date_value === "2025-07-01");
  assert(s != null, "deve esistere un therapy_stop Etanercept datato 2025-07-01", stops.map(e => e.date_value));
  assert(/colelitiasi/i.test(s?.reason ?? ""), `reason deve contenere 'colelitiasi' (got '${s?.reason}')`, s);
});

runTest("PSO-T002-4 · switch ETN→ADA-b: start Adalimumab 2025-07 (switch_verb)", () => {
  const sw = _evFind("therapy_start", /adalimumab/i).find(e => e.inferred_by === "switch_verb");
  assert(sw != null, "deve esistere un therapy_start Adalimumab da switch_verb", _evFind("therapy_start", /adalimumab/i));
  assert(sw?.date_value === "2025-07-01", `switch datato 2025-07-01 (got '${sw?.date_value}')`, sw);
});

runTest("PSO-T002-5 · restart ADA-b marzo 2025 (restart_verb)", () => {
  const rs = _evFind("therapy_start", /adalimumab/i).find(e => e.inferred_by === "restart_verb");
  assert(rs != null, "deve esistere un therapy_start Adalimumab da restart_verb", _evFind("therapy_start", /adalimumab/i));
  assert(rs?.date_value === "2025-03-01", `restart datato 2025-03-01 (got '${rs?.date_value}')`, rs);
});

runTest("PSO-T002-6 · range inline (2014-2016): Adalimumab start 2014 + stop 2016 'rialzo glicemico'", () => {
  const st = _evFind("therapy_start", /adalimumab/i).find(e => e.date_value === "2014-01-01");
  const sp = _evFind("therapy_stop", /adalimumab/i).find(e => e.date_value === "2016-01-01");
  assert(st != null, "start Adalimumab 2014 dal range (2014-2016)", _evFind("therapy_start", /adalimumab/i).map(e => e.date_value));
  assert(sp != null, "stop Adalimumab 2016 dal range (2014-2016)", _evFind("therapy_stop", /adalimumab/i).map(e => e.date_value));
  assert(/rialzo glicemico/i.test(sp?.reason ?? ""), `reason stop = 'rialzo glicemico' (got '${sp?.reason}')`, sp);
});

runTest("PSO-T002-7 · 'tentata sospensione maggio 2019' NON genera therapy_stop", () => {
  const stop2019 = _evPso.find(e => e.event_type === "therapy_stop" && /2019/.test(e.date_value ?? ""));
  assert(stop2019 == null, "la sospensione solo tentata (poi rientrata) non deve creare un therapy_stop", stop2019);
});

runTest("PSO-T002-8 · anti-collisione case-sensitive: 'sec' minuscolo non è Secukinumab", () => {
  const ev = parseRaccordoTimeline("Misurazione attesa circa 30 sec, poi ripetuta dal 2020.");
  const list = ev?.events ?? ev ?? [];
  const sec = list.find(e => /secukinumab/i.test(e.drug_canonical ?? ""));
  assert(sec == null, "'sec' minuscolo non deve risolvere a Secukinumab (match case-sensitive con \\b)", list.map(e => e.drug_canonical));
});

runTest("PSO-T002-9 · controprova abbreviazione: 'SEC' maiuscolo risolve a Secukinumab", () => {
  const ev = parseRaccordoTimeline("Iniziato SEC dal 2020 con beneficio clinico.");
  const list = ev?.events ?? ev ?? [];
  const sec = list.find(e => /secukinumab/i.test(e.drug_canonical ?? ""));
  assert(sec != null, "'SEC' maiuscolo deve risolvere a Secukinumab", list.map(e => e.drug_canonical));
});

runTest("PSO-T003-1 · età NON letta da '20-25 anni' (nessuna età demografica nel testo)", () => {
  const eta = _exPso.patient?.eta;
  assert(eta == null, `eta deve essere null/assente (mai 25 da '20-25 anni'), got ${eta}`, _exPso.patient);
});

// ════════════════════════════════════════════════════════════════════
// DOSE-BLEED (P0) — dose/frequenza non devono sanguinare da un farmaco
// adiacente sulla stessa riga (rischio: dose clinicamente errata).
// ════════════════════════════════════════════════════════════════════

const { extracted: _exDB1 } = parseVisitText(
  "MOTIVO DELLA VISITA: controllo.\n\nTERAPIA IN ATTO: Infliximab ogni 8 settimane, Prednisone 5 mg/die",
);
const _thDB1 = _exDB1.therapies ?? [];
const _findDB1 = (re) => _thDB1.find((t) => re.test(t.drug_name ?? ""));

runTest("DOSEBLEED-1 · Infliximab non eredita la dose di Prednisone (dose null, freq 'ogni 8 settimane')", () => {
  const ifx = _findDB1(/infliximab/i);
  assert(ifx != null, "Infliximab deve essere presente", _thDB1.map((t) => t.drug_name));
  assert(ifx?.dose == null, `Infliximab dose deve essere null (got '${ifx?.dose}')`, ifx);
  assert(/ogni\s+8\s+settimane/i.test(ifx?.frequency ?? ""), `Infliximab freq = 'ogni 8 settimane' (got '${ifx?.frequency}')`, ifx);
});

runTest("DOSEBLEED-2 · Prednisone mantiene la propria dose 5 mg", () => {
  const pre = _findDB1(/prednisone/i);
  assert(pre != null, "Prednisone deve essere presente", _thDB1.map((t) => t.drug_name));
  assert(/\b5\s*mg\b/i.test(pre?.dose ?? ""), `Prednisone dose = '5 mg' (got '${pre?.dose}')`, pre);
});

const { extracted: _exDB2 } = parseVisitText(
  "MOTIVO DELLA VISITA: controllo.\n\nTERAPIA IN ATTO: Methotrexate settimanale, Colecalciferolo 10000 UI ogni 15 giorni",
);
const _thDB2 = _exDB2.therapies ?? [];

runTest("DOSEBLEED-3 · Methotrexate non eredita '10000 UI' dal Colecalciferolo adiacente", () => {
  const mtx = _thDB2.find((t) => /methotrexate/i.test(t.drug_name ?? ""));
  assert(mtx != null, "Methotrexate deve essere presente", _thDB2.map((t) => t.drug_name));
  assert(!/10[.\s]?000|10000/i.test(mtx?.dose ?? ""), `Methotrexate dose NON deve contenere '10000 UI' (got '${mtx?.dose}')`, mtx);
});

// ════════════════════════════════════════════════════════════════════
// HEADER-SPLIT (P1) — segmentazione header inline / referto su riga singola
// non deve perdere il RACCORDO né far sanguinare CONCLUSIONI nel raccordo.
// ════════════════════════════════════════════════════════════════════

const _HS_MULTI = `RACCORDO ANAMNESTICO:
Malattia esordita nel 2013 con artrite. Iniziata terapia con Sulfasalazina a settembre 2023.
CONCLUSIONI:
Stabile.`;

const _HS_SINGLE =
  "RACCORDO ANAMNESTICO: Malattia esordita nel 2013 con artrite. Iniziata terapia con Sulfasalazina a settembre 2023. CONCLUSIONI: Stabile.";

const _HS_PREAMBLE =
  "Paziente di 50 anni. RACCORDO ANAMNESTICO: Malattia esordita nel 2013 con artrite. Iniziata terapia con Sulfasalazina a settembre 2023. CONCLUSIONI: Stabile.";

function _hsCheck(label, txt) {
  const { extracted } = parseVisitText(txt);
  const ev = extracted.raccordo_events ?? [];
  const racc = extracted.visit_sections?.raccordo ?? "";

  runTest(`HEADER-SPLIT · ${label} · almeno 2 raccordo_events`, () => {
    assert(ev.length >= 2, `attesi >= 2 eventi (got ${ev.length})`, ev.map((e) => e.event_type));
  });
  runTest(`HEADER-SPLIT · ${label} · disease_onset 2013`, () => {
    const onset = ev.find((e) => e.event_type === "disease_onset");
    assert(onset != null, "manca disease_onset", ev.map((e) => e.event_type));
    assert(/^2013/.test(onset?.date_value ?? ""), `disease_onset date_value 2013 (got '${onset?.date_value}')`, onset);
  });
  runTest(`HEADER-SPLIT · ${label} · therapy_start Sulfasalazina settembre 2023`, () => {
    const start = ev.find((e) => e.event_type === "therapy_start" && /sulfasalazina/i.test(e.drug_name ?? ""));
    assert(start != null, "manca therapy_start Sulfasalazina", ev.map((e) => `${e.event_type}:${e.drug_name}`));
    assert(start?.date_value === "2023-09-01", `therapy_start date_value 2023-09-01 (got '${start?.date_value}')`, start);
  });
  runTest(`HEADER-SPLIT · ${label} · CONCLUSIONI non nel source del raccordo`, () => {
    assert(!/conclusioni|stabile/i.test(racc), `raccordo non deve contenere CONCLUSIONI/Stabile (got '${racc}')`, racc);
  });
}

_hsCheck("multilinea", _HS_MULTI);
_hsCheck("riga-singola", _HS_SINGLE);
_hsCheck("header-inline-dopo-preambolo", _HS_PREAMBLE);

// ════════════════════════════════════════════════════════════════════
// PRN-AB (patch #1) — abbreviazioni "al bisogno": prn / a.b. / al bis. / ab
// con anti-collisione contro "Ab" (anticorpo, sierologia).
// ════════════════════════════════════════════════════════════════════

const LETTER_PRN_AB = `TERAPIA DOMICILIARE:
- Arcoxia 90 mg a.b.
- Brufen 600 mg al bis.
- Oki 80 mg ab
- Nimesulide 100 mg prn
- Adalimumab 40 mg ogni 2 settimane con controllo Ab anti-CCP negativo
- Diclofenac 50 mg 1 cp al giorno`;

const { extracted: _exPrnAb } = parseVisitText(LETTER_PRN_AB);
const _thPrnAb = _exPrnAb.therapies ?? [];
const _findPrnAb = (re) => _thPrnAb.find((t) => re.test(t.drug_name ?? ""));
const _isPrn = (t) => t?._prn === true || t?.frequency === "al bisogno";

runTest("PRN-AB-1 · 'a.b.' → Etoricoxib PRN", () => {
  const t = _findPrnAb(/etoricoxib|arcoxia/i);
  assert(t != null, "Etoricoxib deve essere presente", _thPrnAb.map((x) => x.drug_name));
  assert(_isPrn(t), `Etoricoxib (a.b.) deve essere PRN (freq='${t?.frequency}' _prn=${t?._prn})`, t);
});

runTest("PRN-AB-2 · 'al bis.' → Ibuprofene PRN", () => {
  const t = _findPrnAb(/ibuprofene/i);
  assert(t != null, "Ibuprofene deve essere presente", _thPrnAb.map((x) => x.drug_name));
  assert(_isPrn(t), `Ibuprofene (al bis.) deve essere PRN (freq='${t?.frequency}' _prn=${t?._prn})`, t);
});

runTest("PRN-AB-3 · 'ab' minuscolo isolato → Ketoprofene PRN", () => {
  const t = _findPrnAb(/ketoprofene/i);
  assert(t != null, "Ketoprofene deve essere presente", _thPrnAb.map((x) => x.drug_name));
  assert(_isPrn(t), `Ketoprofene (ab) deve essere PRN (freq='${t?.frequency}' _prn=${t?._prn})`, t);
});

runTest("PRN-AB-4 · 'prn' → Nimesulide PRN", () => {
  const t = _findPrnAb(/nimesulide/i);
  assert(t != null, "Nimesulide deve essere presente", _thPrnAb.map((x) => x.drug_name));
  assert(_isPrn(t), `Nimesulide (prn) deve essere PRN (freq='${t?.frequency}' _prn=${t?._prn})`, t);
});

runTest("PRN-AB-5 · anti-collisione: 'Ab' anticorpo NON rende PRN un farmaco cronico", () => {
  const t = _findPrnAb(/adalimumab/i);
  assert(t != null, "Adalimumab deve essere presente", _thPrnAb.map((x) => x.drug_name));
  assert(!_isPrn(t), `Adalimumab NON deve essere PRN nonostante 'Ab anti-CCP' (freq='${t?.frequency}' _prn=${t?._prn})`, t);
  assert(t?.status === "active", `Adalimumab deve restare 'active' (got '${t?.status}')`, t);
});

runTest("PRN-AB-6 · farmaco cronico senza abbreviazione resta NON PRN", () => {
  const t = _findPrnAb(/diclofenac/i);
  assert(t != null, "Diclofenac deve essere presente", _thPrnAb.map((x) => x.drug_name));
  assert(!_isPrn(t), `Diclofenac (1 cp al giorno) NON deve essere PRN (freq='${t?.frequency}' _prn=${t?._prn})`, t);
});

// ════════════════════════════════════════════════════════════════════
// RACC-CONT (patch raccordo) — "in corso / prosegue / in terapia con <farmaco>"
// → therapy_continue (date null, confidence medium). Negazioni e sospensioni
// NON devono generare terapia attiva/continue.
// ════════════════════════════════════════════════════════════════════

const _contRes = parseRaccordoTimeline("RACCORDO ANAMNESTICO:\nIn corso Infliximab ogni 8 settimane.");
const _contEvents = _contRes?.events ?? _contRes ?? [];
const _contActive = (list) =>
  (list ?? []).find((e) => /infliximab/i.test(e.drug_canonical ?? "") &&
    (e.event_type === "therapy_continue" || e.event_type === "therapy_start"));

runTest("RACC-CONT-1 · 'In corso Infliximab' → therapy_continue Infliximab", () => {
  const ev = _contActive(_contEvents);
  assert(ev != null, "deve esistere un evento di continuazione per Infliximab", _contEvents.map((e) => ({ t: e.event_type, d: e.drug_canonical })));
  assert(ev?.event_type === "therapy_continue", `event_type preferito therapy_continue (got '${ev?.event_type}')`, ev);
  assert(ev?.date_value == null, `date_value deve essere null (got '${ev?.date_value}')`, ev);
  assert(ev?.confidence === "medium", `confidence deve essere medium (got '${ev?.confidence}')`, ev);
  assert(typeof ev?.source_text === "string" && ev.source_text.length > 0, "source_text preservato", ev?.source_text);
});

runTest("RACC-CONT-2 · negativo 'non in corso Infliximab' → nessuna continuazione/attiva", () => {
  const r = parseRaccordoTimeline("RACCORDO ANAMNESTICO:\nNon in corso Infliximab.");
  const list = r?.events ?? r ?? [];
  assert(_contActive(list) == null, "non deve esistere therapy_continue/therapy_start per Infliximab", list.map((e) => ({ t: e.event_type, d: e.drug_canonical })));
});

runTest("RACC-CONT-3 · negativo 'non ha mai assunto Infliximab' → nessuna continuazione/attiva", () => {
  const r = parseRaccordoTimeline("RACCORDO ANAMNESTICO:\nNon ha mai assunto Infliximab.");
  const list = r?.events ?? r ?? [];
  assert(_contActive(list) == null, "non deve esistere therapy_continue/therapy_start per Infliximab", list.map((e) => ({ t: e.event_type, d: e.drug_canonical })));
});

runTest("RACC-CONT-4 · negativo 'Infliximab sospeso' → nessuna continuazione/attiva (stop ammesso)", () => {
  const r = parseRaccordoTimeline("RACCORDO ANAMNESTICO:\nInfliximab sospeso.");
  const list = r?.events ?? r ?? [];
  assert(_contActive(list) == null, "non deve esistere therapy_continue/therapy_start per Infliximab", list.map((e) => ({ t: e.event_type, d: e.drug_canonical })));
});

// ════════════════════════════════════════════════════════════════════
// ONSET-ETA (patch età da esordio) — l'età d'esordio NON deve diventare
// una data anagrafica né inventare un anno. event_type disease_onset,
// date_value null se non c'è una data assoluta, age phrase conservata.
// ════════════════════════════════════════════════════════════════════

const _onsetEvents = (txt) => {
  const r = parseRaccordoTimeline("RACCORDO ANAMNESTICO:\n" + txt);
  return r?.events ?? r ?? [];
};
const _findOnset = (list) => (list ?? []).find((e) => e.event_type === "disease_onset");

runTest("ONSET-ETA-1 · 'esordita all'età di 10 anni' → disease_onset, date null, età conservata", () => {
  const list = _onsetEvents("Malattia esordita all'età di 10 anni.");
  const ev = _findOnset(list);
  assert(ev != null, "deve esistere un evento disease_onset", list.map((e) => e.event_type));
  assert(ev?.date_value == null, `date_value deve essere null (no anno inventato), got '${ev?.date_value}'`, ev);
  assert(/10\s*anni/i.test((ev?.detail ?? "") + " " + (ev?.date_text ?? "")), "detail/date_text deve conservare 'all'età di 10 anni'", ev);
  assert(typeof ev?.source_text === "string" && ev.source_text.length > 0, "source_text preservato", ev?.source_text);
});

runTest("ONSET-ETA-2 · 'Esordio a 12 anni' → disease_onset, date null, età conservata", () => {
  const list = _onsetEvents("Esordio a 12 anni.");
  const ev = _findOnset(list);
  assert(ev != null, "deve esistere un evento disease_onset", list.map((e) => e.event_type));
  assert(ev?.date_value == null, `date_value deve essere null, got '${ev?.date_value}'`, ev);
  assert(/12\s*anni/i.test((ev?.detail ?? "") + " " + (ev?.date_text ?? "")), "detail/date_text deve conservare 'a 12 anni'", ev);
});

runTest("ONSET-ETA-3 · 'esordita in età infantile' → disease_onset, date null", () => {
  const list = _onsetEvents("Malattia esordita in età infantile.");
  const ev = _findOnset(list);
  assert(ev != null, "deve esistere un evento disease_onset", list.map((e) => e.event_type));
  assert(ev?.date_value == null, `date_value deve essere null, got '${ev?.date_value}'`, ev);
  assert(/et[àa]\s+infantile/i.test((ev?.detail ?? "") + " " + (ev?.date_text ?? "")), "detail/date_text deve conservare 'età infantile'", ev);
});

runTest("ONSET-ETA-4 · standalone 'In età infantile ...' senza 'esordi' → disease_onset (Rule 1b)", () => {
  const list = _onsetEvents("In età infantile poliartrite a piccole articolazioni.");
  const ev = _findOnset(list);
  assert(ev != null, "lo standalone 'in età infantile' deve generare disease_onset", list.map((e) => e.event_type));
  assert(ev?.date_value == null, `date_value deve essere null (no anno inventato), got '${ev?.date_value}'`, ev);
  assert(/et[àa]\s+infantile/i.test(ev?.detail ?? ""), "detail deve conservare 'età infantile'", ev);
});

runTest("ONSET-ETA-5 · negativo 'Paziente di 60 anni, esordita all'età di 10 anni' → età paziente NON diventa onset", () => {
  const list = _onsetEvents("Paziente di 60 anni, malattia esordita all'età di 10 anni.");
  const ev = _findOnset(list);
  assert(ev != null, "deve esistere un evento disease_onset", list.map((e) => e.event_type));
  assert(ev?.date_value == null, `date_value deve essere null (no anno inventato da '60'/'10'), got '${ev?.date_value}'`, ev);
  const blob = (ev?.detail ?? "") + " " + (ev?.date_text ?? "");
  assert(/10\s*anni/i.test(blob), "l'età d'esordio conservata deve essere '10 anni'", ev);
  assert(!/60/.test(blob), "l'età anagrafica (60) NON deve finire nell'onset", ev);
  assert(!list.some((e) => /^\d{4}/.test(String(e.date_value ?? ""))), "nessun evento deve avere una data inventata (es. 2010/2016)", list.map((e) => e.date_value));
});

// ════════════════════════════════════════════════════════════════════
// RACC-DATE-MY2 (Patch 1) — nome mese completo + anno a 2 cifre.
// "settembre 23" → 2023-09-01 (month_year, confidence high via Rule 2b).
// Guardia: numeri non-data (2 cifre senza mese) non diventano anni.
// ════════════════════════════════════════════════════════════════════

const _my2Events = (txt) => {
  const r = parseRaccordoTimeline("RACCORDO ANAMNESTICO:\n" + txt);
  return r?.events ?? r ?? [];
};
const _my2Start = (list, re) =>
  (list ?? []).find(
    (e) => e.event_type === "therapy_start" && re.test(e.drug_canonical ?? e.drug_name ?? ""),
  );

runTest("RACC-DATE-MY2-1 · 'settembre 23' → Sulfasalazina start 2023-09-01 month_year high", () => {
  const list = _my2Events("Iniziata SSZ a settembre 23, con miglioramento clinico.");
  const ev = _my2Start(list, /sulfasalazina/i);
  assert(ev != null, "deve esistere therapy_start Sulfasalazina", list.map((e) => `${e.event_type}:${e.drug_canonical}`));
  assert(ev?.date_value === "2023-09-01", `date_value 2023-09-01 (got '${ev?.date_value}')`, ev);
  assert(ev?.date_precision === "month_year", `date_precision month_year (got '${ev?.date_precision}')`, ev);
  assert(ev?.confidence === "high", `confidence high (got '${ev?.confidence}')`, ev);
});

runTest("RACC-DATE-MY2-2 · 'marzo 25' → Methotrexate start 2025-03-01 month_year", () => {
  const list = _my2Events("Iniziato MTX a marzo 25.");
  const ev = _my2Start(list, /methotrexate/i);
  assert(ev != null, "deve esistere therapy_start Methotrexate", list.map((e) => `${e.event_type}:${e.drug_canonical}`));
  assert(ev?.date_value === "2025-03-01", `date_value 2025-03-01 (got '${ev?.date_value}')`, ev);
  assert(ev?.date_precision === "month_year", `date_precision month_year (got '${ev?.date_precision}')`, ev);
});

runTest("RACC-DATE-MY2-3 · 4-cifre invariato 'settembre 2023' → 2023-09-01 (no regressione)", () => {
  const list = _my2Events("Iniziata Sulfasalazina a settembre 2023.");
  const ev = _my2Start(list, /sulfasalazina/i);
  assert(ev?.date_value === "2023-09-01", `date_value 2023-09-01 (got '${ev?.date_value}')`, ev);
});

runTest("RACC-DATE-MY2-4 · guardia: numero non-data ('25 mg') NON diventa un anno", () => {
  const list = _my2Events("Iniziato Methotrexate a 25 mg a settimane alterne.");
  const ev = _my2Start(list, /methotrexate/i);
  assert(ev != null, "deve esistere therapy_start Methotrexate", list.map((e) => `${e.event_type}:${e.drug_canonical}`));
  assert(ev?.date_value == null, `date_value deve essere null (no anno inventato da '25'), got '${ev?.date_value}'`, ev);
});

// ════════════════════════════════════════════════════════════════════
// RACC-START-NOSTOPDATE (Patch 2) — lo start non eredita la data dello
// stop nella stessa frase. "sospeso a <data>" appartiene allo stop.
// ════════════════════════════════════════════════════════════════════

const _my2Stop = (list, re) =>
  (list ?? []).find(
    (e) => e.event_type === "therapy_stop" && re.test(e.drug_canonical ?? e.drug_name ?? ""),
  );

runTest("RACC-START-NOSTOPDATE-1 · MTX 'assunto ... poi sospeso a gennaio 2022' → stop datato, start senza data", () => {
  const list = _my2Events("Già proposta in altre sede terapia con MTX che la paziente ha assunto per circa un anno poi sospeso a gennaio 2022.");
  const start = _my2Start(list, /methotrexate/i);
  const stop = _my2Stop(list, /methotrexate/i);
  assert(stop?.date_value === "2022-01-01", `therapy_stop MTX 2022-01-01 (got '${stop?.date_value}')`, stop);
  assert(start != null, "deve esistere therapy_start MTX", list.map((e) => `${e.event_type}:${e.drug_canonical}`));
  assert(start?.date_value !== "2022-01-01", `start NON deve ereditare 2022-01-01 (got '${start?.date_value}')`, start);
  assert(start?.date_value == null, `start date_value deve essere null (got '${start?.date_value}')`, start);
  assert(start?.confidence === "medium", `start confidence medium (got '${start?.confidence}')`, start);
});

runTest("RACC-START-NOSTOPDATE-2 · guardia: 'iniziato MTX a marzo 2020, sospeso a gennaio 2022' → start marzo 2020 + stop gennaio 2022", () => {
  const list = _my2Events("Iniziato MTX a marzo 2020, sospeso a gennaio 2022.");
  const start = _my2Start(list, /methotrexate/i);
  const stop = _my2Stop(list, /methotrexate/i);
  assert(start?.date_value === "2020-03-01", `start MTX 2020-03-01 (got '${start?.date_value}')`, start);
  assert(stop?.date_value === "2022-01-01", `stop MTX 2022-01-01 (got '${stop?.date_value}')`, stop);
});

runTest("RACC-START-NOSTOPDATE-3 · guardia: start semplice senza stop resta invariato (marzo 2020 high)", () => {
  const list = _my2Events("Iniziato MTX a marzo 2020.");
  const start = _my2Start(list, /methotrexate/i);
  assert(start?.date_value === "2020-03-01", `start MTX 2020-03-01 (got '${start?.date_value}')`, start);
  assert(start?.confidence === "high", `start confidence high (got '${start?.confidence}')`, start);
});

// ════════════════════════════════════════════════════════════════════
// FASE1 — emissione eventi diagnosis + disease_status (Rule 7 / Rule 8).
// La diagnosi senza data resta date null (nessun anno inventato); lo stato
// "buon controllo" è ancorato e non deve scattare su "visita di controllo".
// ════════════════════════════════════════════════════════════════════

runTest("FASE1-DX-1 · 'posta diagnosi di artrite psoriasica' → diagnosis, date null", () => {
  const list = _my2Events("Posta diagnosi di artrite psoriasica.");
  const ev = list.find((e) => e.event_type === "diagnosis");
  assert(ev != null, "deve esistere un evento diagnosis", list.map((e) => e.event_type));
  assert(ev?.date_value == null, `date_value deve essere null (data ignota), got '${ev?.date_value}'`, ev);
  assert(ev?.confidence === "low", `confidence deve essere 'low' senza data (got '${ev?.confidence}')`, ev);
  assert(/artrite psoriasica/i.test(ev?.detail ?? ""), "detail deve conservare la frase di diagnosi", ev);
});

runTest("FASE1-STATUS-1 · 'malattia giudicata in buon controllo' → disease_status", () => {
  const list = _my2Events("Ultimo controllo a settembre 2025, malattia giudicata in buon controllo.");
  const ev = list.find((e) => e.event_type === "disease_status");
  assert(ev != null, "deve esistere un evento disease_status", list.map((e) => e.event_type));
  assert(ev?.date_value === "2025-09-01", `date_value 2025-09-01 (got '${ev?.date_value}')`, ev);
  assert(ev?.confidence === "high", `confidence 'high' con data (got '${ev?.confidence}')`, ev);
});

runTest("FASE1-STATUS-2 · negativo: 'visita di controllo' NON genera disease_status", () => {
  const list = _my2Events("Eseguita ultima visita di controllo a giugno 2021.");
  const ev = list.find((e) => e.event_type === "disease_status");
  assert(ev == null, "'visita di controllo' non deve creare un disease_status", list.map((e) => e.event_type));
});

// ════════════════════════════════════════════════════════════════════
// FASE2 — date stagionali approssimate + manifestazione ricorrente (Rule 9).
// "primavera 2020" → 2020-04 approssimata; senza anno non si inventa una data.
// ════════════════════════════════════════════════════════════════════

const FASE2_TARGET = "Da primavera 2020 episodi di tumefazione dolente ginocchio dx recidivanti.";

runTest("FASE2-MANIF-1 · target → manifestation_onset con data approssimata 2020-04", () => {
  const list = _my2Events(FASE2_TARGET);
  const ev = list.find((e) => e.event_type === "manifestation_onset");
  assert(ev != null, "deve esistere un evento manifestation_onset", list.map((e) => e.event_type));
  assert(ev?.date_value === "2020-04-01", `date_value 2020-04-01 (got '${ev?.date_value}')`, ev);
  assert(ev?.date_approximate === true, `date_approximate deve essere true (got '${ev?.date_approximate}')`, ev);
  assert(ev?.confidence === "medium", `confidence 'medium' con data approssimata (got '${ev?.confidence}')`, ev);
});

runTest("FASE2-MANIF-2 · target → detail conserva 'recidivanti' e ginocchio dx", () => {
  const list = _my2Events(FASE2_TARGET);
  const ev = list.find((e) => e.event_type === "manifestation_onset");
  assert(ev != null, "deve esistere un evento manifestation_onset", list.map((e) => e.event_type));
  assert(/recidivant/i.test(ev?.detail ?? ""), "detail deve conservare 'episodi recidivanti'", ev);
  assert(/ginocchio/i.test(ev?.detail ?? ""), "detail deve conservare il contesto ginocchio dx", ev);
});

runTest("FASE2-SEASON-1 · 'primavera' senza anno NON inventa una data", () => {
  const list = _my2Events("Episodi di tumefazione recidivanti comparsi in primavera.");
  const ev = list.find((e) => e.event_type === "manifestation_onset");
  assert(ev != null, "deve esistere un evento manifestation_onset", list.map((e) => e.event_type));
  assert(ev?.date_value == null, `date_value deve essere null (nessun anno → nessuna data inventata), got '${ev?.date_value}'`, ev);
  assert(ev?.confidence === "low", `confidence 'low' senza data (got '${ev?.confidence}')`, ev);
});

runTest("RACC-STOP-PARENREASON-1 · reason dello stop dalla parentesi '(intolleranza/nausea)'", () => {
  const list = _my2Events("Methotrexate sospeso a gennaio 2022 (intolleranza/nausea).");
  const stop = _my2Stop(list, /methotrexate/i);
  assert(stop != null, "deve esistere therapy_stop MTX", list.map((e) => `${e.event_type}:${e.drug_canonical}`));
  assert(stop?.date_value === "2022-01-01", `stop MTX 2022-01-01 (got '${stop?.date_value}')`, stop);
  assert(/intolleranza\/nausea/i.test(stop?.reason ?? ""), `reason da parentesi 'intolleranza/nausea' (got '${stop?.reason}')`, stop);
});

runTest("RACC-STOP-PARENREASON-2 · 'per' esplicito ha priorita' sulla parentesi", () => {
  const list = _my2Events("Methotrexate sospeso a gennaio 2022 per intolleranza (nausea ricorrente).");
  const stop = _my2Stop(list, /methotrexate/i);
  assert(stop != null, "deve esistere therapy_stop MTX", list.map((e) => `${e.event_type}:${e.drug_canonical}`));
  assert(/intolleranza/i.test(stop?.reason ?? ""), `reason da 'per intolleranza' (got '${stop?.reason}')`, stop);
});

runTest("RACC-STOP-PARENREASON-3 · guardia: parentesi con cifre NON diventa reason", () => {
  const list = _my2Events("Methotrexate sospeso a marzo 2021 (15 mg).");
  const stop = _my2Stop(list, /methotrexate/i);
  assert(stop != null, "deve esistere therapy_stop MTX", list.map((e) => `${e.event_type}:${e.drug_canonical}`));
  assert(stop?.reason == null, `reason deve restare null (parentesi con cifre rifiutata), got '${stop?.reason}'`, stop);
});

runTest("RACC-STOP-PARENREASON-4 · guardia: parentesi di stato '(in corso)' NON diventa reason", () => {
  const list = _my2Events("Adalimumab sospeso a marzo 2021 (in corso il follow-up).");
  const stop = _my2Stop(list, /adalimumab/i);
  assert(stop != null, "deve esistere therapy_stop ADA", list.map((e) => `${e.event_type}:${e.drug_canonical}`));
  assert(stop?.reason == null, `reason deve restare null (parentesi di stato rifiutata), got '${stop?.reason}'`, stop);
});

runTest("RACC-STOP-PARENREASON-5 · guardia: parentesi di classe '(biosimilare)' NON diventa reason", () => {
  const list = _my2Events("Adalimumab sospeso a marzo 2021 (biosimilare).");
  const stop = _my2Stop(list, /adalimumab/i);
  assert(stop != null, "deve esistere therapy_stop ADA", list.map((e) => `${e.event_type}:${e.drug_canonical}`));
  assert(stop?.reason == null, `reason deve restare null (parentesi di classe rifiutata), got '${stop?.reason}'`, stop);
});

const _my2Spacing = (list, re) =>
  (list ?? []).find(
    (e) => e.event_type === "dose_spacing" && re.test(e.drug_canonical ?? e.drug_name ?? ""),
  );

runTest("RACC-ONSET-START-1 · TC03 reale: 'Nel 2017 esordio nefrite, aggiunto Micofenolato' → therapy_start MMF 2017", () => {
  const list = _my2Events(
    "Artrite reumatoide sieronegativa, esordio 2003 con poliartrite erosiva. Dal 2003 Methotrexate 15 mg/sett. + Idrossiclorochina. Nel 2007 aggiunto Infliximab 3 mg/kg per risposta insufficiente al cDMARD; sospeso nel 2010 per anticorpi anti-farmaco con perdita di efficacia. Nel 2017 esordio nefrite, aggiunto Micofenolato Mofetil 2g/die. Nel 2021 sospeso Micofenolato per gravidanza programmata.",
  );
  const starts = (list ?? []).filter(
    (e) => e.event_type === "therapy_start" && /micofenolato/i.test(e.drug_canonical ?? e.drug_name ?? ""),
  );
  assert(starts.length === 1, `deve esistere esattamente 1 therapy_start MMF (got ${starts.length})`, list.map((e) => `${e.event_type}:${e.drug_canonical}`));
  assert(starts[0]?.date_value === "2017-01-01", `start MMF 2017-01-01 (got '${starts[0]?.date_value}')`, starts[0]);
  const onset = (list ?? []).find((e) => e.event_type === "disease_onset" && e.date_value === "2017-01-01");
  assert(onset != null, "disease_onset 2017 deve restare presente (fall-through non sopprime l'esordio)", list.map((e) => `${e.event_type}:${e.date_value}`));
});

runTest("RACC-ONSET-START-2 · guardia: 'Nel 2017 esordio nefrite.' senza verbo → solo disease_onset, nessun therapy_start", () => {
  const list = _my2Events("Nel 2017 esordio nefrite.");
  const starts = (list ?? []).filter((e) => e.event_type === "therapy_start");
  assert(starts.length === 0, `nessun therapy_start atteso (got ${starts.length})`, starts.map((e) => e.drug_canonical));
});

runTest("RACC-SPACING-OGNI-1 · TC10 reale: 'spacing a ogni 8 settimane' → dose_spacing Ixekizumab 2024", () => {
  const list = _my2Events(
    "Artrite psoriasica con interessamento poliarticolare e assiale, diagnosi 2012. Methotrexate 15 mg/settimana dal 2012, senza beneficio sulla componente assiale. Nel 2014 iniziato Adalimumab 40 mg ogni 2 settimane; risposta inizialmente buona. Nel 2017 perdita di risposta; passato a Golimumab 50 mg mensile. Nel 2020 inefficacia Golimumab; sostituito con Ixekizumab 80 mg ogni 4 settimane. Ottima risposta cutanea e articolare. Nel 2024 spacing a ogni 8 settimane per remissione sostenuta.",
  );
  const spacing = _my2Spacing(list, /ixekizumab/i);
  assert(spacing != null, "deve esistere dose_spacing Ixekizumab", list.map((e) => `${e.event_type}:${e.drug_canonical}`));
  assert(spacing?.date_value === "2024-01-01", `dose_spacing 2024-01-01 (got '${spacing?.date_value}')`, spacing);
  assert(/8\s+settiman/i.test(spacing?.detail ?? ""), `detail deve contenere '8 settimane' (got '${spacing?.detail}')`, spacing);
});

runTest("RACC-SPACING-OGNI-2 · guardia: 'spacing a 10 settimane' (senza 'ogni') resta invariato", () => {
  const list = _my2Events("Avviato Secukinumab 150 mg mensile dal 2018. Nel 2021 spacing a 10 settimane per remissione prolungata.");
  const spacing = _my2Spacing(list, /secukinumab/i);
  assert(spacing != null, "deve esistere dose_spacing Secukinumab", list.map((e) => `${e.event_type}:${e.drug_canonical}`));
  assert(/10\s+settiman/i.test(spacing?.detail ?? ""), `detail deve contenere '10 settimane' (got '${spacing?.detail}')`, spacing);
});

// ─────────────────────────────────────────────────────────────────────────────
// P0 — Lettera di controllo "incipit motivo-visita" (sintetica, anonimizzata).
// Riproduce due bug osservati in produzione:
//   P0-DIAGNOSI: la diagnosi veniva presa da "Ecografia ginocchio dx: ..." perché
//     l'alias "Dx" (flag i) collideva con "dx" (destro) e la ricerca usava il
//     testo intero (incluso il referto strumentale).
//   P0-ANAMNESI: l'incipit "in paziente con <diagnosi>" finiva nell'anamnesi
//     intervallare, sporcando l'interval_history con la ripetizione della diagnosi.
// ─────────────────────────────────────────────────────────────────────────────
const LETTER_INCIPIT_P0 = `MOTIVO DELLA VISITA: visita di controllo in paziente con monoartrite sieronegativa di ginocchio di verosimile natura psoriasica.

ANAMNESI INTERVALLARE: Discreto benessere. Unico episodio di tumefazione indolente al ginocchio destro a settembre, risoltosi spontaneamente. Non ulteriori episodi nè artralgie infiammatorie. Mai necessità di assumere FANS.

ESAME OBIETTIVO: articolarità conservata, non sinovite clinicamente apprezzabile.

Ecografia ginocchio dx: minimo versamento a sede sfondato sottoquadricipitale con lieve ispessimento sinoviale.

CONCLUSIONI: quadro clinico stabile, prosegue follow-up.`;

const _p0 = parseVisitText(LETTER_INCIPIT_P0).extracted;
const _p0diag = (_p0.patient?.diagnosi ?? "").toLowerCase();
const _p0anam = (_p0.visit_sections?.anamnesi ?? "").toLowerCase();

runTest("P0-DIAGNOSI · la diagnosi NON viene presa dal referto ecografico ('ginocchio dx: ...')", () => {
  assert(
    !_p0diag.includes("versamento") && !_p0diag.includes("sottoquadricipitale"),
    "diagnosi non deve contenere testo dell'ecografia (versamento/sottoquadricipitale)",
    _p0.patient?.diagnosi,
  );
  assert(
    _p0diag.includes("psoriasica") || _p0diag.includes("monoartrite"),
    "diagnosi deve provenire dall'incipit clinico (monoartrite ... natura psoriasica)",
    _p0.patient?.diagnosi,
  );
});

runTest("P0-ANAMNESI · l'incipit motivo-visita NON inquina l'anamnesi intervallare", () => {
  assert(
    _p0anam.includes("discreto benessere"),
    "interval_history deve conservare l'anamnesi reale ('Discreto benessere ...')",
    _p0.visit_sections?.anamnesi,
  );
  assert(
    !_p0anam.includes("in paziente con") && !_p0anam.includes("natura psoriasica"),
    "interval_history non deve contenere l'incipit/diagnosi ripetuta",
    _p0.visit_sections?.anamnesi,
  );
  assert(
    !_p0anam.includes("versamento") && !_p0anam.includes("sottoquadricipitale"),
    "interval_history non deve contenere testo dell'ecografia",
    _p0.visit_sections?.anamnesi,
  );
});

// Guardie anti-falso-positivo (FP=0): le due fix non devono né inventare una
// diagnosi da un sintomo generico, né tagliare un'anamnesi reale che inizia con
// "Paziente con ...".
runTest("P0-DIAGNOSI-GUARD · sintomo nudo 'paziente con dolore' NON diventa diagnosi", () => {
  const ex = parseVisitText(`MOTIVO DELLA VISITA: paziente con dolore al ginocchio destro da una settimana.

ESAME OBIETTIVO: dolenzia alla palpazione, non sinovite.

Ecografia ginocchio dx: minimo versamento.

CONCLUSIONI: si consiglia riposo.`).extracted;
  const d = (ex.patient?.diagnosi ?? "").toLowerCase();
  assert(!d.includes("dolore"), `diagnosi non deve catturare il sintomo (got '${ex.patient?.diagnosi}')`, ex.patient?.diagnosi);
  assert(!d.includes("versamento"), `diagnosi non deve catturare l'ecografia (got '${ex.patient?.diagnosi}')`, ex.patient?.diagnosi);
});

runTest("P0-ANAMNESI-GUARD · anamnesi reale che inizia con 'Paziente con' NON viene tagliata", () => {
  const ex = parseVisitText(`MOTIVO DELLA VISITA: controllo periodico.

ANAMNESI INTERVALLARE: Paziente con discreto benessere clinico. Nessun nuovo sintomo articolare nell'intervallo.

CONCLUSIONI: quadro stabile.`).extracted;
  const a = (ex.visit_sections?.anamnesi ?? "").toLowerCase();
  assert(a.includes("discreto benessere clinico"), "interval_history deve conservare l'anamnesi reale", ex.visit_sections?.anamnesi);
  assert(a.includes("paziente con"), "il prefisso 'Paziente con' di un'anamnesi reale non va rimosso", ex.visit_sections?.anamnesi);
});

// ── P0-FACCHINI · "IN DATA ODIERNA" / "Alla visita odierna" come header anamnesi
// Bug reale (PDF Facchini): senza header esplicito "ANAMNESI INTERVALLARE", il
// blocco introdotto da "IN DATA ODIERNA." veniva unito all'incipit dal
// normalizzatore e l'anamnesi finiva per contenere "in paziente con <diagnosi>"
// invece del decorso reale. Fix: "IN DATA ODIERNA"/"ALLA VISITA ODIERNA"
// riconosciuti come header VISITA_ODIERNA + block-start nel normalizzatore.
runTest("P0-FACCHINI · 'IN DATA ODIERNA' su riga separata → anamnesi = decorso reale", () => {
  const ex = parseVisitText(`Gentile Collega,
Visita ambulatoriale di controllo in paziente con monoartrite sieronegativa di ginocchio di verosimile natura psoriasica.

IN DATA ODIERNA. Discreto benessere. Riferisce un unico episodio di tumefazione indolente. Non episodi infettivi intercorrenti. Mai necessita di assumere FANS.

ESAME OBIETTIVO: articolarita conservata, non sinovite clinicamente apprezzabile.

IN VISIONE: ecografia ginocchio dx: minimo versamento.

CONCLUSIONI: quadro clinico stabile.`).extracted;
  const a = (ex.visit_sections?.anamnesi ?? "");
  assert(a.includes("Discreto benessere"), "anamnesi deve contenere il decorso reale", a);
  assert(a.includes("Mai necessita di assumere FANS"), "anamnesi deve arrivare a fine blocco", a);
  assert(!/in paziente con/i.test(a), "anamnesi NON deve contenere l'incipit/diagnosi", a);
  assert(!/in data odierna/i.test(a), "il marker 'IN DATA ODIERNA' non deve restare nell'anamnesi", a);
});

runTest("P0-FACCHINI · 'IN DATA ODIERNA' dopo MOTIVO inline (no riga vuota)", () => {
  const ex = parseVisitText(`MOTIVO DELLA VISITA: visita ambulatoriale di controllo in paziente con monoartrite sieronegativa psoriasica.
IN DATA ODIERNA. Discreto benessere. Mai necessita di assumere FANS.
ESAME OBIETTIVO: articolarita conservata.
CONCLUSIONI: quadro clinico stabile.`).extracted;
  const a = (ex.visit_sections?.anamnesi ?? "");
  assert(a.includes("Discreto benessere"), "anamnesi deve contenere il decorso reale", a);
  assert(!/in paziente con/i.test(a), "anamnesi NON deve contenere l'incipit/diagnosi", a);
  assert(!/in data odierna/i.test(a), "il marker 'IN DATA ODIERNA' non deve restare nell'anamnesi", a);
});

runTest("P0-FACCHINI · 'Alla visita odierna' inline → header anamnesi", () => {
  const ex = parseVisitText(`Gentile Collega,
Visita di controllo in paziente con artrite psoriasica.
Alla visita odierna riferisce discreto benessere clinico. Non artralgie infiammatorie. Mai necessita di assumere FANS.
ESAME OBIETTIVO: nella norma.
CONCLUSIONI: stabile.`).extracted;
  const a = (ex.visit_sections?.anamnesi ?? "");
  assert(a.includes("discreto benessere clinico"), "anamnesi deve contenere il decorso reale", a);
  assert(!/in paziente con/i.test(a), "anamnesi NON deve contenere l'incipit/diagnosi", a);
  assert(!/alla visita odierna/i.test(a), "il marker 'Alla visita odierna' non deve restare nell'anamnesi", a);
});

runTest("THERAPY-DOSE-1 · dose totale giornaliera da mg × compresse", () => {
  const quick = parseTherapyText("Sulfasalazina 500 mg 5 cp die");
  assert(quick.dose === "2500 mg", `Quick parser: dose SSZ deve essere 2500 mg (got: ${quick.dose})`, quick);
  assert(/giornaliera/i.test(quick.frequency ?? ""), `Quick parser: frequenza SSZ deve essere giornaliera (got: ${quick.frequency})`, quick);

  const parsed = parseVisitText("INDICAZIONI:\n- Sulfasalazina 500 mg 5 cp die").extracted.therapies ?? [];
  const ssz = parsed.find(t => t.drug_name === "Sulfasalazina");
  assert(ssz?.dose === "2500 mg", `Visit parser: dose SSZ deve essere 2500 mg (got: ${ssz?.dose})`, parsed);
  assert(ssz?.frequency === "die", `Visit parser: frequenza SSZ deve essere die (got: ${ssz?.frequency})`, ssz);
});

runTest("THERAPY-DOSE-2 · dose totale da frazioni di compressa", () => {
  const medrol = parseVisitText("INDICAZIONI:\n- Medrol 16 mg 1/4 cp al die").extracted.therapies?.find(t => t.drug_name === "Metilprednisolone");
  assert(medrol?.dose === "4 mg", `Medrol 16 mg 1/4 cp deve diventare 4 mg (got: ${medrol?.dose})`, medrol);

  const colch = parseVisitText("INDICAZIONI:\n- Colchicina 1 mg 1/2 cp die").extracted.therapies?.find(t => t.drug_name === "Colchicina");
  assert(colch?.dose === "0.5 mg", `Colchicina 1 mg 1/2 cp deve diventare 0.5 mg (got: ${colch?.dose})`, colch);
});

runTest("THERAPY-DOSE-3 · quantità compresse per somministrazione × volte/die", () => {
  const parsed = parseVisitText("INDICAZIONI:\n- Salazopirina 500 mg 2 cp x 2/die").extracted.therapies ?? [];
  const ssz = parsed.find(t => t.drug_name === "Sulfasalazina");
  assert(ssz?.dose === "2000 mg", `Salazopirina 500 mg 2 cp x 2/die deve diventare 2000 mg (got: ${ssz?.dose})`, ssz);
  assert(ssz?.frequency === "die", `Frequenza deve restare die (got: ${ssz?.frequency})`, ssz);

  const morningEvening = parseVisitText("INDICAZIONI:\n- Salazopirina 500 mg: 2 cp la mattina e 2 cp la sera").extracted.therapies ?? [];
  const sszMe = morningEvening.find(t => t.drug_name === "Sulfasalazina");
  assert(sszMe?.dose === "2000 mg", `Salazopirina 500 mg 2 cp mattina + 2 cp sera deve diventare 2000 mg (got: ${sszMe?.dose})`, sszMe);
  assert(sszMe?.frequency === "die", `Salazopirina 500 mg mattina + sera deve avere frequenza die (got: ${sszMe?.frequency})`, sszMe);

  const quickMe = parseTherapyText("Salazopirina 500 mg: 2 cp la mattina e 2 cp la sera");
  assert(quickMe.dose === "2000 mg", `Quick parser: mattina/sera deve diventare 2000 mg (got: ${quickMe.dose})`, quickMe);
  assert(quickMe.frequency === "Giornaliera", `Quick parser: mattina/sera deve avere frequenza Giornaliera (got: ${quickMe.frequency})`, quickMe);

  const accented = parseVisitText("INDICAZIONI:\n- Salazopirina 1 g x 2 al dì").extracted.therapies ?? [];
  const sszAccented = accented.find(t => t.drug_name === "Sulfasalazina");
  assert(sszAccented?.dose === "2 g", `Salazopirina 1 g x 2 al dì deve diventare 2 g (got: ${sszAccented?.dose})`, sszAccented);
  assert(sszAccented?.frequency === "die", `Salazopirina 1 g x 2 al dì deve avere frequenza die (got: ${sszAccented?.frequency})`, sszAccented);
});

runTest("THERAPY-DOSE-4 · frequenza al bisogno preservata anche senza dose", () => {
  const quick = parseTherapyText("FANS al bisogno");
  assert(quick.frequency === "Al bisogno", `Quick parser: FANS al bisogno deve preservare frequenza (got: ${quick.frequency})`, quick);

  const parsed = parseVisitText("INDICAZIONI:\n- FANS al bisogno").extracted.therapies ?? [];
  const fans = parsed.find(t => t.drug_name === "FANS");
  assert(fans?.frequency === "al bisogno", `Visit parser: FANS al bisogno deve preservare frequenza (got: ${fans?.frequency})`, fans);
});

runTest("THERAPY-DOSE-5 · la dose non deve spillare sul farmaco successivo", () => {
  const parsed = parseVisitText("INDICAZIONI:\n- prosegue Methotrexate - prosegue Colecalciferolo 10.000 UI 6 gocce al dì").extracted.therapies ?? [];
  const mtx = parsed.find(t => t.drug_name === "Methotrexate");
  assert(mtx?.dose == null, `Methotrexate senza dose non deve ereditare 10.000 UI dal farmaco successivo (got: ${mtx?.dose})`, parsed);
});

runTest("THERAPY-GENERAL-1 · Methoter alias + route sc nuda", () => {
  const parsed = parseVisitText("IN TERAPIA\n- prosegue Methoter 7.5 mg 1 fl sc sempre un unico giorno alla settimana e Folina 5 mg").extracted.therapies ?? [];
  const mtx = parsed.find(t => t.drug_name === "Methotrexate");
  assert(!!mtx, `Methoter deve essere riconosciuto come Methotrexate (got: ${parsed.map(t => t.drug_name).join(", ")})`, parsed);
  assert(mtx?.dose === "7.5 mg", `Methoter 7.5 mg deve mantenere dose 7.5 mg (got: ${mtx?.dose})`, mtx);
  assert(mtx?.frequency === "settimanale", `Methoter un unico giorno alla settimana deve essere settimanale (got: ${mtx?.frequency})`, mtx);
  assert(mtx?.route === "s.c.", `Methoter sc deve avere route s.c. (got: ${mtx?.route})`, mtx);
});

runTest("THERAPY-GENERAL-2 · RIDUCE Deltacortene resta active, non discontinued", () => {
  const parsed = parseVisitText("TERAPIA\n- RIDUCE DELTACORTENE 25 mg 3/4 cp per 3 settimane, poi 1/2 cp alternata a 3/4 fino a controllo").extracted.therapies ?? [];
  const pdn = parsed.find(t => t.drug_name === "Prednisone");
  assert(pdn?.dose === "18.75 mg", `Deltacortene 25 mg 3/4 cp deve diventare 18.75 mg (got: ${pdn?.dose})`, pdn);
  assert(pdn?.status === "active", `RIDUCE Deltacortene deve restare active (got: ${pdn?.status})`, pdn);
  assert(!pdn?.discontinuation_reason, `RIDUCE Deltacortene non deve avere discontinuation_reason (got: ${pdn?.discontinuation_reason})`, pdn);
});

runTest("THERAPY-GENERAL-3 · stop Colchicina non sospende Prednisone successivo", () => {
  const parsed = parseVisitText(`
ANAMNESI INTERVALLARE
Ha sospeso la Colchicina dopo 2 giorni per dolore addominale severo e nausea/vomito.
CONCLUSIONI
Non tollerata Colchicina.
TERAPIA
- RIDUCE DELTACORTENE 25 mg 3/4 cp per 3 settimane, poi 1/2 cp alternata a 3/4 fino a controllo
`).extracted.therapies ?? [];
  const pdn = parsed.find(t => t.drug_name === "Prednisone");
  const colch = parsed.find(t => t.drug_name === "Colchicina");
  assert(pdn?.status === "active", `Stop Colchicina non deve marcare Prednisone discontinued (got: ${pdn?.status})`, parsed);
  assert(colch?.status === "discontinued", `Colchicina deve restare discontinued (got: ${colch?.status})`, parsed);
});

runTest("THERAPY-DOSE-6 · la preposizione 'di' non genera frequenza giornaliera (FP=0)", () => {
  const quick = parseTherapyText("Prednisone 5 mg di mantenimento");
  assert(quick.frequency == null, `Quick parser: 'mg di mantenimento' non deve diventare giornaliera (got: ${quick.frequency})`, quick);

  const parsed = parseVisitText("INDICAZIONI:\n- Prednisone 5 mg di mantenimento").extracted.therapies ?? [];
  const pdn = parsed.find(t => t.drug_name === "Prednisone");
  assert(pdn != null, `Prednisone deve essere estratto (got: ${parsed.map(t => t.drug_name).join(", ")})`, parsed);
  assert(pdn?.frequency == null, `Visit parser: 'di mantenimento' non deve generare frequenza (got: ${pdn?.frequency})`, pdn);
});

runTest("THERAPY-DOSE-7 · 'x N mesi/giorni' è durata, non moltiplica la dose (FP=0)", () => {
  const months = parseVisitText("INDICAZIONI:\n- Sulfasalazina 1 g x 2 mesi").extracted.therapies ?? [];
  const ssz = months.find(t => t.drug_name === "Sulfasalazina");
  assert(ssz?.dose === "1 g", `'1 g x 2 mesi' (durata) non deve diventare 2 g (got: ${ssz?.dose})`, ssz);

  const days = parseTherapyText("Sulfasalazina 500 mg 2 cp x 5 giorni");
  assert(days.dose === "1000 mg", `'2 cp x 5 giorni' moltiplica solo per le cp (2), non per la durata (got: ${days.dose})`, days);
});

const _isPrnFreq = (f) => /al\s+bisogno|se\s+necessario|secondo\s+necessit|\bprn\b/i.test(f ?? "");

runTest("THERAPY-PRN-1 · 'al bisogno' di farmaco vicino non contamina la Salazopirina (FP=0)", () => {
  const text = "Riduce Salazopirina 500 mg: 2 cp la mattina e 2 cp la sera fino al prossimo controllo. Toradol al bisogno";
  const th = (parseVisitText(text).extracted.therapies ?? []).find(t => /sulfasalazina/i.test(t.drug_name));
  assert(th != null, "Sulfasalazina deve essere estratta", th);
  assert(th?.dose === "2000 mg", `dose totale deve restare 2000 mg (got: ${th?.dose})`, th);
  assert(!_isPrnFreq(th?.frequency), `frequency NON deve essere un marcatore PRN (contaminazione da 'Toradol al bisogno') — got: ${th?.frequency}`, th);
});

runTest("THERAPY-PRN-2 · un vero PRN nella stessa frase resta PRN", () => {
  const vis = (parseVisitText("INDICAZIONI:\n- Arcoxia 90 mg al bisogno").extracted.therapies ?? []).find(t => /etoricoxib/i.test(t.drug_name));
  assert(vis != null, "Etoricoxib (Arcoxia) deve essere estratto", vis);
  assert(vis?.frequency === "al bisogno", `Arcoxia con PRN nella stessa frase deve restare 'al bisogno' (got: ${vis?.frequency})`, vis);

  const q = parseTherapyText("FANS al bisogno");
  assert(/al bisogno/i.test(q.frequency ?? ""), `Quick parser: 'FANS al bisogno' deve restare PRN (got: ${q.frequency})`, q);
});

runTest("THERAPY-PRN-3 · abbreviazioni PRN a valle non contaminano; via puntata non rompe il PRN legittimo", () => {
  const BASE = "Riduce Salazopirina 500 mg: 2 cp la mattina e 2 cp la sera fino al prossimo controllo";
  for (const tail of [". Toradol prn", ". Toradol a.b.", ". Toradol al bis."]) {
    const th = (parseVisitText(BASE + tail).extracted.therapies ?? []).find(t => /sulfasalazina/i.test(t.drug_name));
    assert(th != null, `Sulfasalazina deve essere estratta (tail='${tail}')`, th);
    assert(!_isPrnFreq(th?.frequency), `'${tail}' non deve rendere PRN la Salazopirina (got: ${th?.frequency})`, th);
  }
  for (const legit of ["Arcoxia 90 mg p.o. al bisogno", "Arcoxia 90 mg s.c. se necessario", "Arcoxia 90 mg a.b.", "Arcoxia 90 mg al bis."]) {
    const th = (parseVisitText("INDICAZIONI:\n- " + legit).extracted.therapies ?? []).find(t => /etoricoxib/i.test(t.drug_name));
    assert(th != null, `Etoricoxib deve essere estratto ('${legit}')`, th);
    assert(th?.frequency === "al bisogno", `'${legit}' deve restare PRN 'al bisogno' (got: ${th?.frequency})`, th);
  }
});

// ── Report finale ─────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`Totale: ${passed + failed} test | ✓ ${passed} passati | ✗ ${failed} falliti`);
if (failed > 0) {
  console.error("REGRESSIONE RILEVATA — correggere i test falliti prima del deploy.");
  process.exit(1);
} else {
  console.log("Tutti i test passati.");
  process.exit(0);
}
