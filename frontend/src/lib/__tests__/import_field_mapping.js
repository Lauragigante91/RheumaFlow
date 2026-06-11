/**
 * Integration Tests — Import Field Mapping
 *
 * Testa il mapping completo: testo lettera → parseVisitText() → buildXxxPayload()
 * → verifica che ogni campo arrivi nel payload API corretto.
 *
 * Questi test intercettano i mapping bug silenti (es. indicazioni → campo sbagliato)
 * che sono invisibili ai test parser-only.
 *
 * Come eseguire:
 *   cd frontend && npx esbuild src/lib/__tests__/import_field_mapping.js \
 *     --bundle --platform=node --outfile=/tmp/import_mapping.cjs --format=cjs \
 *     && node /tmp/import_mapping.cjs
 */

import { parseVisitText } from "../visitTextParser.js";
import {
  buildWorkupVisitPayload,
  buildTherapyUpsertPayload,
  buildTherapyContinuityPayload,
  buildAssessmentPayload,
  buildLabExamPayload,
  buildInstrumentalExamPayload,
} from "../importPayloadBuilders.js";

// ── Lettere di test ───────────────────────────────────────────────────────────

const PATIENT_ID = "test-patient-uuid-001";

// Lettera AR follow-up con tutte le sezioni rilevanti (formato AUSL Bologna)
const LETTER_AR_FOLLOWUP = `Gent.le collega
controllo in pz. con osteoartrosi e artrite reumatoide
ANAMNESI FISIOLOGICA: mai fumatrice, mai fratture, menopausa a 50 aa, in precedenza operaia in calzaturificio, OSS.
ANAMNESI PATOLOGICA REMOTA: quantiferon positivo riscontrato nel 2011 e profilassi con nicozid 300 mg per 9 mesi, ipertensione arteriosa, discopatie.
TERAPIA: atenololo - colecalciferolo 5 gtt al die - urbason 4 mg : 1/2 cp al die
Nega allergie.

RACCORDO ANAMNESTICO: pz. Affetta da artrite reumatoide acpa negativa a scarsa attivita'. Sempre seguita a ferrara per artrite reumatoide sieronegativa in terapia dal 2011 con methotrexate 10 mg / settimana e steroidi a basso dosaggio ( 4 mg al die ), ultima visita di controllo effettuata nel mese di giugno 2021 veniva confermato un quadro articolare in remissione sotto MTX e basso dosaggio di steroide. Tentata prima sospensione di MTX a settembre 2022, poi ripreso dopo 3 mesi per ripresa delle artralgie, poi sospeso a metà 2023 per intolleranza GI.

ACCERTAMENTI PRECEDENTI:
- EE 28/12/24: Hb 13.9, WBC 10.1, Plt 281, VES 12, PCR 0.78, cr 1.03, GOT/GPT 18/14, FR neg, ANA neg.

VISITA ODIERNA:
Peggioramento delle artralgie a livello dei piedi. Non riesce a sospendere l'Urbason che attualmente assume al dosaggio di 2 mg al die. Assenza di tumefazione articolare.

IN VISIONE:
- EE ( agosto 2025 ) : emocromo nn - ves 22 - creatinina 1.16 - alt 12 - pcr 0.88

OBBIETTIVAMENTE: non segni di artrite periferica. Pes planus. Scrosci alle ginocchia. Non limitazione alle spalle.

CONCLUSIONI: Diagnosi di artrite reumatoide sieronegativa non in fase di attività.

INDICAZIONI:
- Urbason 4 mg : 1/2 cp due giorni alla settimana, poi prova a sospendere
- Flogorest : 1 cp al die per 10 gg
- continua la vitamina D

Controllo programmato tra 9 mesi con esami.`;

// Lettera minima per testare il comportamento con sezioni assenti
const LETTER_MINIMAL = `Visita ambulatoriale del 15/02/2026.
Paziente: Mario Rossi, 58 anni, M.
Diagnosi: Artrite reumatoide sieropositiva.

VISITA ODIERNA:
DAS28-CRP 4.2 (alta attività). VAS-PtGA 50/100.

CONCLUSIONI: Alta attività di malattia. Intensificare terapia.

INDICAZIONI:
- Aggiungere Methotrexate 10 mg/settimana s.c.`;

// Lettera LES con score clinimetrico esplicito
const LETTER_LES_SCORE = `Gent.le collega
controllo paziente con LES

VISITA ODIERNA:
SLEDAI-2K calcolato: 6. Lieve attività. Artralgie bilaterali, rash malare residuo.

OBBIETTIVAMENTE: rash malare lieve bilaterale, non artrite attiva, SNC integro.

CONCLUSIONI: LES con lieve attività. Ottimizzare idrossiclorochina.

INDICAZIONI:
- Idrossiclorochina 200 mg 1 cp al die
- Controllo tra 6 mesi con esami emato`;

// ── Utility ───────────────────────────────────────────────────────────────────

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

// ── Parse lettere una volta sola ──────────────────────────────────────────────

const { extracted: extAR }  = parseVisitText(LETTER_AR_FOLLOWUP);
const { extracted: extMin } = parseVisitText(LETTER_MINIMAL);
const { extracted: extLes } = parseVisitText(LETTER_LES_SCORE);

const payloadAR  = buildWorkupVisitPayload(extAR,  PATIENT_ID, "follow_up",  false);
const payloadMin = buildWorkupVisitPayload(extMin, PATIENT_ID, "follow_up",  false);
const payloadLes = buildWorkupVisitPayload(extLes, PATIENT_ID, "follow_up",  false);

// ── GRUPPO 1: WorkupVisit — spec completa dei campi ──────────────────────────

runTest("MAP-01 · WorkupVisit — patient_id e visit_type passati correttamente", () => {
  assert(payloadAR.patient_id === PATIENT_ID,
    `patient_id deve essere '${PATIENT_ID}'`, payloadAR.patient_id);
  assert(payloadAR.visit_type === "follow_up",
    `visit_type deve essere 'follow_up'`, payloadAR.visit_type);
  assert(payloadAR.status === "completed",
    `status deve essere 'completed'`, payloadAR.status);
});

runTest("MAP-02 · WorkupVisit — interval_history ← visit_sections.anamnesi", () => {
  assert(payloadAR.interval_history !== null && payloadAR.interval_history !== undefined,
    "interval_history non deve essere null quando VISITA ODIERNA è presente",
    payloadAR.interval_history);
  assert(typeof payloadAR.interval_history === "string",
    "interval_history deve essere una stringa");
  assert(/urbason|artralgi|tumefazione/i.test(payloadAR.interval_history),
    `interval_history deve contenere il contenuto VISITA ODIERNA (got: '${payloadAR.interval_history?.substring(0,60)}...')`,
    payloadAR.interval_history?.substring(0, 80));
});

runTest("MAP-03 · WorkupVisit — rheumatologic_history_summary ← visit_sections.raccordo", () => {
  assert(payloadAR.rheumatologic_history_summary !== null,
    "rheumatologic_history_summary non deve essere null quando RACCORDO è presente",
    payloadAR.rheumatologic_history_summary);
  assert(/methotrexate|MTX|remissione|2011|2023/i.test(payloadAR.rheumatologic_history_summary),
    `rheumatologic_history_summary deve contenere il raccordo (got: '${payloadAR.rheumatologic_history_summary?.substring(0,80)}...')`,
    payloadAR.rheumatologic_history_summary?.substring(0, 80));
});

runTest("MAP-04 · WorkupVisit — physical_exam ← visit_sections.esame_obj (OBBIETTIVAMENTE)", () => {
  assert(payloadAR.physical_exam !== null,
    "physical_exam non deve essere null quando OBBIETTIVAMENTE è presente",
    payloadAR.physical_exam);
  assert(/artrite|pes planus|scrosci|spalle/i.test(payloadAR.physical_exam),
    `physical_exam deve contenere l'esame obiettivo (got: '${payloadAR.physical_exam?.substring(0,80)}')`,
    payloadAR.physical_exam?.substring(0, 80));
});

runTest("MAP-05 · WorkupVisit — conclusions ← visit_sections.conclusioni", () => {
  assert(payloadAR.conclusions !== null,
    "conclusions non deve essere null quando CONCLUSIONI è presente",
    payloadAR.conclusions);
  assert(/artrite reumatoide|attivit/i.test(payloadAR.conclusions),
    `conclusions deve contenere le conclusioni (got: '${payloadAR.conclusions?.substring(0,80)}')`,
    payloadAR.conclusions?.substring(0, 80));
});

runTest("MAP-06 · WorkupVisit — referral_note ← visit_sections.indicazioni (REGRESSIONE CRITICA)", () => {
  assert(payloadAR.referral_note !== null,
    "referral_note non deve essere null quando INDICAZIONI è presente",
    payloadAR.referral_note);
  assert(/urbason|flogorest|vitamina/i.test(payloadAR.referral_note),
    `referral_note deve contenere le INDICAZIONI (got: '${payloadAR.referral_note?.substring(0,100)}')`,
    payloadAR.referral_note?.substring(0, 100));
});

runTest("MAP-07 · WorkupVisit — therapy_modification NON presente nel payload (REGRESSIONE CRITICA)", () => {
  assert(!("therapy_modification" in payloadAR),
    "therapy_modification NON deve essere una chiave del payload WorkupVisit (bug corretto)");
  assert(!("therapy_modification" in payloadMin),
    "therapy_modification NON deve essere presente nemmeno su lettera minimale");
});

runTest("MAP-08 · WorkupVisit — nessuna contaminazione raccordo→interval_history", () => {
  const raccordoMarkers = /terapia dal 2011|metà 2023|intolleranza GI/i;
  assert(!raccordoMarkers.test(payloadAR.interval_history ?? ""),
    `interval_history NON deve contenere contenuto del raccordo — indica confusione di sezioni`,
    payloadAR.interval_history?.substring(0, 120));
});

runTest("MAP-09 · WorkupVisit — sezioni null quando assenti nella lettera", () => {
  assert(payloadMin.rheumatologic_history_summary === null,
    "rheumatologic_history_summary deve essere null se RACCORDO assente",
    payloadMin.rheumatologic_history_summary);
  assert(payloadMin.physical_exam === null,
    "physical_exam deve essere null se OBBIETTIVAMENTE assente",
    payloadMin.physical_exam);
});

runTest("MAP-10 · WorkupVisit — home_therapies_text ← profilo_generale.terapia_domiciliare", () => {
  assert(payloadAR.home_therapies_text !== null,
    "home_therapies_text non deve essere null quando TERAPIA DOMICILIARE è presente",
    payloadAR.home_therapies_text);
  assert(/atenololo|urbason|colecalciferolo/i.test(payloadAR.home_therapies_text),
    `home_therapies_text deve rispecchiare la terapia domiciliare (got: '${payloadAR.home_therapies_text}')`,
    payloadAR.home_therapies_text);
});

runTest("MAP-11 · WorkupVisit — visit_date è una stringa ISO-10 valida", () => {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  assert(dateRe.test(payloadAR.visit_date),
    `visit_date deve essere ISO-10 (got: '${payloadAR.visit_date}')`, payloadAR.visit_date);
  assert(dateRe.test(payloadMin.visit_date),
    `visit_date deve essere ISO-10 su lettera minimale (got: '${payloadMin.visit_date}')`, payloadMin.visit_date);
});

// ── GRUPPO 2: Therapy payload ─────────────────────────────────────────────────

runTest("MAP-12 · Therapy — campi obbligatori presenti", () => {
  const therapies = extAR.therapies ?? [];
  assert(therapies.length > 0, `lettera AR deve produrre almeno 1 terapia (got: ${therapies.length})`);

  const t = therapies[0];
  const payload = buildTherapyUpsertPayload(t, PATIENT_ID, "visit-uuid-999");

  assert(payload.patient_id === PATIENT_ID,
    "patient_id corretto nel payload terapia", payload.patient_id);
  assert(typeof payload.drug_name === "string" && payload.drug_name.length > 0,
    `drug_name deve essere una stringa non vuota (got: '${payload.drug_name}')`, payload.drug_name);
  assert(["active", "discontinued", "noted", "historical"].includes(payload.status),
    `status deve essere un valore valido (got: '${payload.status}')`, payload.status);
  assert(typeof payload.category === "string" && payload.category.length > 0,
    `category deve essere una stringa non vuota (got: '${payload.category}')`, payload.category);
  assert(payload.visit_id === "visit-uuid-999",
    "visit_id deve essere propagato al payload", payload.visit_id);
});

runTest("MAP-13 · Therapy — Methotrexate sospeso riconosciuto con motivo", () => {
  const therapies = extAR.therapies ?? [];
  const mtx = therapies.find(t => /methotrexate|MTX/i.test(t.drug_name));
  assert(!!mtx, `Methotrexate deve essere estratto dalla lettera AR`, therapies.map(t => t.drug_name));
  if (mtx) {
    const payload = buildTherapyUpsertPayload(mtx, PATIENT_ID, null);
    assert(payload.status === "discontinued",
      `Methotrexate deve avere status='discontinued' (got: '${payload.status}')`, payload.status);
    assert(payload.discontinuation_reason !== null && payload.discontinuation_reason !== undefined,
      `discontinuation_reason non deve essere null per MTX sospeso (got: '${payload.discontinuation_reason}')`,
      payload.discontinuation_reason);
    assert(/intolleranza|GI/i.test(payload.discontinuation_reason),
      `discontinuation_reason deve contenere 'intolleranza GI' (got: '${payload.discontinuation_reason}')`,
      payload.discontinuation_reason);
  }
});

runTest("MAP-14 · Therapy continuity — payload ridotto senza discontinuation_reason", () => {
  const t = { drug_name: "Methotrexate", category: "dmard_cs", dose: "10 mg", start_date: null };
  const today = "2026-06-04";
  const payload = buildTherapyContinuityPayload(t, PATIENT_ID, "visit-id", today);

  assert(payload.status === "active",
    "terapia continuità deve avere status='active'", payload.status);
  assert(payload.drug_name === "Methotrexate",
    "drug_name passato correttamente", payload.drug_name);
  assert(!("discontinuation_reason" in payload),
    "discontinuation_reason NON deve essere nel payload di continuità");
  assert(!("frequency" in payload),
    "frequency NON deve essere nel payload di continuità");
});

// ── GRUPPO 3: Assessment payload ─────────────────────────────────────────────

runTest("MAP-15 · Assessment — campi obbligatori e mappatura corretta", () => {
  const assessments = extMin.assessments ?? [];
  assert(assessments.length > 0,
    `lettera minimale con DAS28 deve estrarre almeno 1 assessment (got: ${assessments.length})`,
    extMin);

  if (assessments.length > 0) {
    const a = assessments[0];
    const payload = buildAssessmentPayload(a, PATIENT_ID, "2026-02-15", "visit-id", "follow_up", "test.pdf");

    assert(payload.patient_id === PATIENT_ID,
      "patient_id corretto nel payload assessment", payload.patient_id);
    assert(typeof payload.index_type === "string" && payload.index_type.length > 0,
      `index_type deve essere una stringa (got: '${payload.index_type}')`, payload.index_type);
    assert(typeof payload.visit_category === "string",
      `visit_category deve essere una stringa (got: '${payload.visit_category}')`, payload.visit_category);
    assert(Array.isArray(payload.tender_joints),
      "tender_joints deve essere un array", payload.tender_joints);
    assert(Array.isArray(payload.swollen_joints),
      "swollen_joints deve essere un array", payload.swollen_joints);
    assert(payload.source_filename === "test.pdf",
      "source_filename propagato correttamente", payload.source_filename);
    assert(payload.visit_id === "visit-id",
      "visit_id propagato quando presente", payload.visit_id);
    assert(payload.visit_type === "follow_up",
      "visit_type propagato quando presente", payload.visit_type);
  }
});

runTest("MAP-16 · Assessment — no visit_id nel payload se non passato", () => {
  const a = { index_type: "das28_crp", score: 4.2, date: "2026-02-15" };
  const payload = buildAssessmentPayload(a, PATIENT_ID, "2026-02-15", null, null, null);

  assert(!("visit_id" in payload),
    "visit_id NON deve essere nel payload quando importedVisitId è null");
  assert(!("visit_type" in payload),
    "visit_type NON deve essere nel payload quando importedVisitId è null");
  assert(payload.source_filename === null,
    "source_filename deve essere null quando non passato", payload.source_filename);
});

// ── GRUPPO 4: Lab exam payload ────────────────────────────────────────────────

runTest("MAP-17 · LabExam — values è un dizionario (non array)", () => {
  const labExams = extAR.lab_exams ?? [];
  assert(labExams.length > 0,
    `lettera AR deve estrarre almeno 1 pannello lab (got: ${labExams.length})`);

  if (labExams.length > 0) {
    const ex = labExams[0];
    const payload = buildLabExamPayload(ex, PATIENT_ID, "fonte.pdf");

    assert(payload.patient_id === PATIENT_ID,
      "patient_id corretto nel payload lab", payload.patient_id);
    assert(typeof payload.values === "object" && !Array.isArray(payload.values),
      "values deve essere un oggetto dizionario (non array)", typeof payload.values);
    assert(typeof payload.date === "string",
      `date deve essere una stringa (got: '${payload.date}')`, payload.date);
    assert(payload.source_filename === "fonte.pdf",
      "source_filename propagato correttamente", payload.source_filename);
  }
});

runTest("MAP-18 · LabExam — le chiavi values sono chiavi canoniche (non display names)", () => {
  const labExams = extAR.lab_exams ?? [];
  if (labExams.length > 0) {
    const payload = buildLabExamPayload(labExams[0], PATIENT_ID, null);
    const keys = Object.keys(payload.values);
    assert(keys.length > 0,
      `values non deve essere vuoto per un pannello lab reale (got: ${keys.length} chiavi)`);

    const hasDisplayNames = keys.some(k =>
      /emocromo completo|conta globuli|velocità|globuli bianchi/i.test(k)
    );
    assert(!hasDisplayNames,
      `values NON deve contenere display names come chiavi (got: ${keys.join(", ")})`,
      keys);
  }
});

runTest("MAP-19 · LabExam — ogni value entry ha almeno il campo value o qualitative", () => {
  const labExams = extAR.lab_exams ?? [];
  if (labExams.length > 0) {
    const payload = buildLabExamPayload(labExams[0], PATIENT_ID, null);
    const entries = Object.entries(payload.values);
    let allValid = true;
    for (const [k, v] of entries) {
      const hasContent = "value" in v || "qualitative" in v;
      if (!hasContent) {
        console.error(`       chiave '${k}' ha entry vuota: ${JSON.stringify(v)}`);
        allValid = false;
      }
    }
    assert(allValid,
      "ogni entry in values deve avere almeno 'value' o 'qualitative'");
  }
});

// ── GRUPPO 5: Regressioni specifiche ─────────────────────────────────────────

runTest("MAP-20 · REGRESSIONE — interval_history e raccordo NON si scambiano", () => {
  const vs = extAR.visit_sections ?? {};
  const payload = buildWorkupVisitPayload(extAR, PATIENT_ID, "follow_up", false);

  const anamnesiSource = vs.anamnesi ?? "";
  const raccordoSource = vs.raccordo ?? "";

  if (anamnesiSource && raccordoSource) {
    const firstWordAnamnesi = anamnesiSource.trim().substring(0, 20);
    const firstWordRaccordo = raccordoSource.trim().substring(0, 20);

    assert(
      payload.interval_history?.includes(firstWordAnamnesi.substring(0, 10)),
      `interval_history deve iniziare con il contenuto di visit_sections.anamnesi`,
      `payload: '${payload.interval_history?.substring(0,40)}' vs source: '${firstWordAnamnesi}'`
    );
    assert(
      payload.rheumatologic_history_summary?.includes(firstWordRaccordo.substring(0, 10)),
      `rheumatologic_history_summary deve iniziare con il contenuto di visit_sections.raccordo`,
      `payload: '${payload.rheumatologic_history_summary?.substring(0,40)}' vs source: '${firstWordRaccordo}'`
    );
    assert(
      !payload.interval_history?.includes(firstWordRaccordo.substring(0, 10)) ||
      firstWordAnamnesi.substring(0, 10) === firstWordRaccordo.substring(0, 10),
      "interval_history NON deve contenere contenuto del raccordo (campi invertiti!)"
    );
  }
});

runTest("MAP-21 · REGRESSIONE — referral_note vs therapy_modification (bug storico)", () => {
  assert("referral_note" in payloadAR,
    "referral_note deve essere una chiave del payload");
  assert(!("therapy_modification" in payloadAR),
    "therapy_modification NON deve essere una chiave del payload (era il bug)");

  const indicazioniSource = (extAR.visit_sections ?? {}).indicazioni ?? "";
  if (indicazioniSource) {
    assert(
      payloadAR.referral_note === indicazioniSource,
      `referral_note deve essere identico a visit_sections.indicazioni`,
      {
        referral_note: payloadAR.referral_note?.substring(0, 60),
        indicazioni:   indicazioniSource.substring(0, 60),
      }
    );
  }
});

runTest("MAP-22 · REGRESSIONE — labs_imaging null quando non ci sono exam_imaging", () => {
  assert(payloadAR.labs_imaging === null || typeof payloadAR.labs_imaging === "string",
    `labs_imaging deve essere null o stringa (got: ${typeof payloadAR.labs_imaging})`,
    payloadAR.labs_imaging);
});

runTest("MAP-23 · Schema completo — nessun campo undefined nel payload WorkupVisit", () => {
  const undefinedKeys = Object.entries(payloadAR)
    .filter(([, v]) => v === undefined)
    .map(([k]) => k);
  assert(undefinedKeys.length === 0,
    `nessun campo deve essere undefined nel payload (trovati: ${undefinedKeys.join(", ")})`,
    undefinedKeys);
});

runTest("MAP-24 · Schema completo — tutte le chiavi WorkupVisit attese sono presenti", () => {
  const REQUIRED_KEYS = [
    "patient_id", "visit_date", "visit_type", "status",
    "rheumatologic_history_summary", "interval_history",
    "physical_exam", "conclusions", "referral_note",
    "labs_imaging", "requested_tests", "home_therapies_text",
  ];
  const missing = REQUIRED_KEYS.filter(k => !(k in payloadAR));
  assert(missing.length === 0,
    `tutte le chiavi obbligatorie devono essere nel payload (mancanti: ${missing.join(", ")})`,
    missing);
});

// ── Risultato finale ──────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Import Field Mapping: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
