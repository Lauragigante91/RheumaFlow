import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { FileText, Copy, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { interpretDAS28, interpretCDAI, interpretSDAI, interpretASDAS } from "../../lib/clinimetrics";
import { detectDiseaseWorkflow } from "../../lib/diseaseWidgets";
import { buildInstrumentalText } from "../../lib/instrumentalFormatters";

// ─── Shared helpers ────────────────────────────────────────────────────────────
function patientName(patient) {
  return [patient?.cognome, patient?.nome].filter(Boolean).join(" ") || patient?.codice_paziente || "Paziente";
}

function todayFmt() {
  return new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

function activeTherapyText(therapies) {
  const active = (therapies || []).filter(t => t.status === "active");
  return active.length
    ? active.map(t => `${t.drug_name}${t.dose ? ` ${t.dose}` : ""}${t.frequency ? ` ${t.frequency}` : ""}`).join(", ")
    : "nessuna terapia in corso";
}

function latestLab(labExams, key) {
  for (const e of [...(labExams || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""))) {
    const v = (e.values || {})[key];
    if (v?.value != null) return v;
  }
  return null;
}

function latestAssessment(assessments, types) {
  return [...(assessments || [])]
    .filter(a => types.includes(a.index_type))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0] || null;
}

function symptomsLine(todayVisitData) {
  const s = todayVisitData?.symptoms || [];
  return s.length
    ? `Il/La paziente riferisce: ${s.join(", ")}.`
    : "Il/La paziente non riferisce peggioramento soggettivo rilevante.";
}

function intestazione(patient, diag, therapy) {
  const name = patientName(patient);
  return [
    "REFERTO VISITA REUMATOLOGICA AMBULATORIALE",
    todayFmt(),
    "",
    `Paziente: ${name}`,
    `Diagnosi: ${diag}`,
    `Terapia: ${therapy}`,
  ].join("\n");
}

// ─── Disease-specific draft builders ──────────────────────────────────────────

function buildRA({ patient, assessments, therapies, labExams, todayVisitData, planData, instrumentalExams }) {
  const name   = patientName(patient);
  const diag   = patient?.diagnosi || "Artrite Reumatoide";
  const therapy = activeTherapyText(therapies);
  const pcr    = latestLab(labExams, "crp");
  const ves    = latestLab(labExams, "ves");
  const lastDAS = latestAssessment(assessments, ["das28_crp", "das28_esr"]);
  const tv     = todayVisitData || {};

  const anamnesi = [
    `Si riceve in visita ambulatoriale il/la Sig./Sig.ra ${name}, affetto/a da ${diag} in trattamento con ${therapy}.`,
    symptomsLine(tv),
    tv.note || "",
  ].filter(Boolean).join("\n");

  const esame = [
    "All'esame obiettivo articolare:",
    tv.tjc != null ? `- Articolazioni dolenti (TJC/28): ${tv.tjc}` : "",
    tv.sjc != null ? `- Articolazioni tumefatte (SJC/28): ${tv.sjc}` : "",
    tv.gh  ? `- VAS globale paziente: ${tv.gh}/100 mm` : "",
    tv.ega ? `- EGA medico: ${tv.ega}/10` : "",
  ].filter(Boolean).join("\n");

  const esami = [
    "Esami di laboratorio recenti:",
    pcr ? `- PCR: ${pcr.value} ${pcr.unit || "mg/L"}` : "",
    ves ? `- VES: ${ves.value} mm/h` : "",
  ].filter(Boolean).join("\n");

  let valutazione = "";
  if (tv.das28crp != null) {
    valutazione = `Attività di malattia (DAS28-PCR): ${tv.das28crp} — ${interpretDAS28(tv.das28crp)}.`;
    if (tv.cdai != null) valutazione += `\nCDAI: ${tv.cdai} — ${interpretCDAI(tv.cdai)}.`;
    if (tv.sdai != null) valutazione += `\nSDAI: ${tv.sdai} — ${interpretSDAI(tv.sdai)}.`;
  } else if (tv.das28esr != null) {
    valutazione = `Attività di malattia (DAS28-VES): ${tv.das28esr} — ${interpretDAS28(tv.das28esr)}.`;
  } else if (lastDAS) {
    valutazione = `Attività di malattia (ultimo DAS28 del ${new Date(lastDAS.date).toLocaleDateString("it-IT")}): ${lastDAS.score} — ${lastDAS.interpretation}.`;
  } else {
    valutazione = "Attività di malattia: valutazione clinimetrica in allegato.";
  }

  const piano = planData?.note || "Si conferma il piano terapeutico in corso con la terapia in atto. Prossimo controllo da programmare con esami di laboratorio (emocromo, PCR, VES, transaminasi, creatinina).";

  const strumentali = buildInstrumentalText(instrumentalExams, ["echo_msk", "xray", "mri"]);
  return { intestazione: intestazione(patient, diag, therapy), anamnesi, esame, esami, valutazione, piano, strumentali };
}

function buildSpA({ patient, assessments, therapies, labExams, todayVisitData, planData, instrumentalExams }) {
  const name    = patientName(patient);
  const diag    = patient?.diagnosi || "Spondiloartrite";
  const therapy = activeTherapyText(therapies);
  const pcr     = latestLab(labExams, "crp");
  const ves     = latestLab(labExams, "ves");
  const lastASDAS = latestAssessment(assessments, ["asdas_crp", "basdai"]);
  const tv      = todayVisitData || {};

  const anamnesi = [
    `Si riceve in visita ambulatoriale il/la Sig./Sig.ra ${name}, affetto/a da ${diag} in trattamento con ${therapy}.`,
    symptomsLine(tv),
    tv.note || "",
  ].filter(Boolean).join("\n");

  const esame = [
    "All'esame obiettivo:",
    "- Mobilità rachide lombare:",
    "- Articolazioni periferiche:",
    "- Entesi:",
  ].join("\n");

  const esami = [
    "Esami di laboratorio recenti:",
    pcr ? `- PCR: ${pcr.value} ${pcr.unit || "mg/L"}` : "",
    ves ? `- VES: ${ves.value} mm/h` : "",
  ].filter(Boolean).join("\n");

  let valutazione = "";
  if (tv.asdas != null) {
    valutazione = `Attività di malattia (ASDAS-CRP): ${tv.asdas} — ${interpretASDAS(tv.asdas)}.`;
  } else if (lastASDAS) {
    const lbl = lastASDAS.index_type === "basdai" ? "BASDAI" : "ASDAS-CRP";
    valutazione = `Attività di malattia (${lbl} del ${new Date(lastASDAS.date).toLocaleDateString("it-IT")}): ${lastASDAS.score} — ${lastASDAS.interpretation}.`;
  } else {
    valutazione = "Attività di malattia: valutare clinicamente sintomi assiali e periferici.";
  }

  const piano = planData?.note || "Si conferma la terapia in corso. Prossimo controllo con esami di laboratorio (PCR, VES, emocromo, transaminasi). Valutare imaging se progressione clinica.";

  const strumentali = buildInstrumentalText(instrumentalExams, ["mri", "xray", "echo_msk", "ct"]);
  return { intestazione: intestazione(patient, diag, therapy), anamnesi, esame, esami, valutazione, piano, strumentali };
}

function buildPMR({ patient, assessments, therapies, labExams, todayVisitData, planData, instrumentalExams }) {
  const name    = patientName(patient);
  const diag    = patient?.diagnosi || "Polimialgia Reumatica / GCA";
  const therapy = activeTherapyText(therapies);
  const pcr     = latestLab(labExams, "crp");
  const ves     = latestLab(labExams, "ves");
  const tv      = todayVisitData || {};

  const anamnesi = [
    `Si riceve in visita il/la Sig./Sig.ra ${name}, affetto/a da ${diag} in trattamento steroideo con ${therapy}.`,
    symptomsLine(tv),
    tv.note || "",
    "Verificata assenza di sintomi di allarme GCA (cefalea, disturbi visivi, claudicatio mascellare).",
  ].filter(Boolean).join("\n");

  const esame = [
    "All'esame obiettivo:",
    "- Dolore cingolo scapolare e pelvico:",
    "- Mobilità delle spalle:",
    "- Arterie temporali: non dolenti, non ispessite",
  ].join("\n");

  const esami = [
    "Esami di laboratorio:",
    pcr ? `- PCR: ${pcr.value} ${pcr.unit || "mg/L"}` : "- PCR: n.d.",
    ves ? `- VES: ${ves.value} mm/h` : "- VES: n.d.",
    "- Glicemia (monitoraggio steroideo):",
    "- Densitometria ossea: aggiornare se >1 anno",
  ].filter(Boolean).join("\n");

  const valutazione = [
    "Risposta alla terapia steroidea: valutare.",
    "Schema di tapering: proseguire riduzione graduale dello steroide secondo protocollo.",
    "Supplementazione calcio + vitamina D: verificare aderenza.",
  ].join("\n");

  const piano = planData?.note || "Riduzione progressiva dello steroide secondo schema. Monitoraggio PCR/VES al prossimo controllo. Raccomandato: protezione gastrica, screening osteoporosi, monitoraggio glicemico.";

  const strumentali = buildInstrumentalText(instrumentalExams, ["petvas", "angio_ct", "angio_mri", "ecodoppler"]);

  return { intestazione: intestazione(patient, diag, therapy), anamnesi, esame, esami, valutazione, piano, strumentali };
}

function buildSLE({ patient, assessments, therapies, labExams, todayVisitData, planData, instrumentalExams }) {
  const name      = patientName(patient);
  const diag      = patient?.diagnosi || "LES";
  const therapy   = activeTherapyText(therapies);
  const pcr       = latestLab(labExams, "pcr");
  const ves       = latestLab(labExams, "ves");
  const lastSLEDAI = latestAssessment(assessments, ["sledai"]);
  const tv        = todayVisitData || {};

  const anamnesi = [
    `Si riceve in visita il/la Sig./Sig.ra ${name}, con diagnosi di ${diag}, in terapia con ${therapy}.`,
    symptomsLine(tv),
    tv.note || "",
  ].filter(Boolean).join("\n");

  const esame = [
    "All'esame obiettivo:",
    "- Cute e mucose:",
    "- Articolazioni:",
    "- Pressione arteriosa:",
  ].join("\n");

  const esami = [
    "Esami di laboratorio:",
    pcr ? `- PCR: ${pcr.value} ${pcr.unit || "mg/L"}` : "",
    ves ? `- VES: ${ves.value} mm/h` : "",
    "- Esame urine + sedimento:",
    "- Complemento (C3/C4) e anti-dsDNA:",
    "- Emocromo con formula:",
  ].filter(Boolean).join("\n");

  let valutazione = "";
  if (lastSLEDAI) {
    valutazione = `SLEDAI (${new Date(lastSLEDAI.date).toLocaleDateString("it-IT")}): ${lastSLEDAI.score} — ${lastSLEDAI.interpretation}.\n`;
  }
  valutazione += "Valutare coinvolgimento d'organo (renale, cutaneo, neurologico, ematologico).";

  const piano = planData?.note || "Monitoraggio clinico e laboratoristico stretto. Aggiornare SLEDAI-2K al prossimo accesso. Protezione solare raccomandata. Screening cardiovascolare e renale periodico.";

  const strumentali = buildInstrumentalText(instrumentalExams, ["echo_cardiac", "pft", "hrct"]);
  return { intestazione: intestazione(patient, diag, therapy), anamnesi, esame, esami, valutazione, piano, strumentali };
}

function buildVasculitis({ patient, assessments, therapies, labExams, todayVisitData, planData, instrumentalExams }) {
  const name    = patientName(patient);
  const diag    = patient?.diagnosi || "Vasculite ANCA-associata";
  const therapy = activeTherapyText(therapies);
  const pcr     = latestLab(labExams, "crp");
  const ves     = latestLab(labExams, "ves");
  const lastBVAS = latestAssessment(assessments, ["bvas"]);
  const tv      = todayVisitData || {};

  const anamnesi = [
    `Si riceve in visita il/la Sig./Sig.ra ${name}, affetto/a da ${diag}, in terapia con ${therapy}.`,
    symptomsLine(tv),
    tv.note || "",
    "Verificati: sintomi respiratori, stato renale, manifestazioni ORL, neuropatia periferica.",
  ].filter(Boolean).join("\n");

  const esame = [
    "All'esame obiettivo:",
    "- Cute (porpora, ulcere):",
    "- Seni paranasali e orecchie:",
    "- Esame obiettivo polmonare:",
  ].join("\n");

  const esami = [
    "Esami di laboratorio:",
    pcr ? `- PCR: ${pcr.value} ${pcr.unit || "mg/L"}` : "",
    ves ? `- VES: ${ves.value} mm/h` : "",
    "- Creatinina + esame urine (cilindri, ematuria):",
    "- ANCA (PR3/MPO):",
  ].filter(Boolean).join("\n");

  let valutazione = lastBVAS
    ? `BVAS (${new Date(lastBVAS.date).toLocaleDateString("it-IT")}): ${lastBVAS.score} — ${lastBVAS.interpretation}.\n`
    : "";
  valutazione += "Valutare coinvolgimento d'organo. Alert relapse: rialzo ANCA + sintomi respiratori/renali nuovi.";

  const piano = planData?.note || "Mantenimento terapia immunosoppressiva. Monitoraggio renale mensile. Profilassi PCP se in corso ciclofosfamide/rituximab.";

  const strumentali = buildInstrumentalText(instrumentalExams, ["petvas", "angio_ct", "angio_mri", "ecodoppler", "ct", "mri"]);
  return { intestazione: intestazione(patient, diag, therapy), anamnesi, esame, esami, valutazione, piano, strumentali };
}

function buildMyositis({ patient, assessments, therapies, labExams, todayVisitData, planData, instrumentalExams }) {
  const name    = patientName(patient);
  const diag    = patient?.diagnosi || "Miosite Infiammatoria";
  const therapy = activeTherapyText(therapies);
  const pcr     = latestLab(labExams, "crp");
  const ck      = latestLab(labExams, "ck");
  const lastMMT = latestAssessment(assessments, ["mmt8"]);
  const tv      = todayVisitData || {};

  const anamnesi = [
    `Si riceve in visita il/la Sig./Sig.ra ${name}, affetto/a da ${diag}, in terapia con ${therapy}.`,
    symptomsLine(tv),
    tv.note || "",
    tv.note?.includes("forza") ? "" : "Forza muscolare soggettiva valutata.",
  ].filter(Boolean).join("\n");

  const esame = [
    "All'esame obiettivo:",
    "- Forza muscolare prossimale (MMT-8 o soggettivo):",
    "- Cute (rash eliotropo, papule di Gottron, mani meccaniche):",
    "- Esame del respiro (ILD screening):",
  ].join("\n");

  const esami = [
    "Esami di laboratorio:",
    pcr ? `- PCR: ${pcr.value} ${pcr.unit || "mg/L"}` : "",
    ck  ? `- CK: ${ck.value} ${ck.unit || "IU/L"}` : "- CK: n.d.",
    "- LDH, aldolasi:",
    "- Anticorpi miosite-specifici: aggiornare se indicato",
  ].filter(Boolean).join("\n");

  let valutazione = "";
  if (lastMMT) {
    valutazione = `MMT-8 (${new Date(lastMMT.date).toLocaleDateString("it-IT")}): ${lastMMT.score} — ${lastMMT.interpretation}.\n`;
  }
  valutazione += "Valutare trend CK. Alert ILD: tosse secca, dispnea → HRCT se deterioramento.";

  const piano = planData?.note || "Proseguire terapia immunosoppressiva. Fisioterapia muscolare raccomandata. Monitoraggio polmonare con spirometria/DLCO periodica.";

  const strumentali = buildInstrumentalText(instrumentalExams, ["hrct", "pft", "echo_cardiac"]);
  return { intestazione: intestazione(patient, diag, therapy), anamnesi, esame, esami, valutazione, piano, strumentali };
}

function buildFibromyalgia({ patient, therapies, todayVisitData, planData }) {
  const name    = patientName(patient);
  const diag    = patient?.diagnosi || "Fibromialgia";
  const therapy = activeTherapyText(therapies);
  const tv      = todayVisitData || {};

  const anamnesi = [
    `Si riceve in visita il/la Sig./Sig.ra ${name}, affetto/a da ${diag}.`,
    symptomsLine(tv),
    tv.note || "",
    "Valutati: pattern del dolore, qualità del sonno, livello di affaticamento, funzione cognitiva.",
  ].filter(Boolean).join("\n");

  const esame = [
    "All'esame obiettivo:",
    "- Dolorabilità alla palpazione dei punti tipici:",
    "- Esclusione di sinovite attiva o deficit neurologici focali.",
    "- Indici di flogosi nella norma (natura non infiammatoria confermata).",
  ].join("\n");

  const esami = [
    "Esami di laboratorio:",
    "- Indici infiammatori (PCR, VES): nella norma — esclude processo infiammatorio attivo.",
    "- Funzione tiroidea, emocromo: nella norma.",
  ].join("\n");

  let valutazione = "Quadro compatibile con fibromialgia primaria. ";
  if (tv.note?.includes("dolore")) valutazione += "Persiste carico algico significativo. ";
  valutazione += "\nNatura NON infiammatoria della sindrome. Approccio multimodale raccomandato.";

  const piano = planData?.note || "Esercizio fisico aerobico graduale (prima linea). Igiene del sonno. Valutare supporto psicologico / terapia cognitivo-comportamentale. Farmaci sintomatici se necessario (duloxetina, pregabalin, ciclobenzaprina). Rivalutazione in 3 mesi.";

  return { intestazione: intestazione(patient, diag, therapy), anamnesi, esame, esami, valutazione, piano };
}

function buildOsteoporosis({ patient, therapies, labExams, todayVisitData, planData }) {
  const name    = patientName(patient);
  const diag    = patient?.diagnosi || "Osteoporosi";
  const therapy = activeTherapyText(therapies);
  const vitd    = latestLab(labExams, "vitd");
  const ca      = latestLab(labExams, "calcio");
  const tv      = todayVisitData || {};

  const anamnesi = [
    `Si riceve in visita il/la Sig./Sig.ra ${name}, con diagnosi di ${diag}, in terapia con ${therapy}.`,
    symptomsLine(tv),
    tv.note || "",
    "Verificata: aderenza alla terapia anti-fratturativa, assenza di nuovi episodi di frattura, supplementazione calcio/vitamina D.",
  ].filter(Boolean).join("\n");

  const esame = [
    "All'esame obiettivo:",
    "- Statura (variazione rispetto a ultima visita):",
    "- Colonna vertebrale: dolorabilità alla percussione:",
    "- Deambulazione e rischio cadute:",
  ].join("\n");

  const esami = [
    "Esami di laboratorio:",
    vitd ? `- Vitamina D (25-OH): ${vitd.value} ${vitd.unit || "ng/mL"}` : "- Vitamina D: n.d.",
    ca   ? `- Calcemia: ${ca.value} ${ca.unit || "mg/dL"}` : "- Calcemia: n.d.",
    "- Creatinina, fosfatasi alcalina:",
    "- Ultima DXA:",
  ].filter(Boolean).join("\n");

  const valutazione = [
    "Rischio fratturativo: valutare con score FRAX / DeFRA.",
    vitd && Number(vitd.value) < 30 ? `Vitamina D insufficiente (${vitd.value} ng/mL): integrare.` : "",
    "Aderenza terapia anti-fratturativa: verificata.",
  ].filter(Boolean).join("\n");

  const piano = planData?.note || "Proseguire terapia anti-fratturativa in corso. Supplementazione calcio (1000 mg/die) e vitamina D (800–2000 UI/die). DXA di controllo se non eseguita nell'ultimo anno. Esercizio fisico con componente di resistenza e propriocettiva.";

  return { intestazione: intestazione(patient, diag, therapy), anamnesi, esame, esami, valutazione, piano };
}

function buildGeneric({ patient, assessments, therapies, labExams, todayVisitData, planData, instrumentalExams }) {
  const name    = patientName(patient);
  const diag    = patient?.diagnosi || "diagnosi reumatologica";
  const therapy = activeTherapyText(therapies);
  const pcr     = latestLab(labExams, "crp");
  const ves     = latestLab(labExams, "ves");
  const tv      = todayVisitData || {};

  const anamnesi = [
    `Si riceve in visita ambulatoriale il/la Sig./Sig.ra ${name}, affetto/a da ${diag}, in trattamento con ${therapy}.`,
    symptomsLine(tv),
    tv.note || "",
  ].filter(Boolean).join("\n");

  const esame = [
    "All'esame obiettivo:",
    "- Articolazioni:",
    "- Cute e mucose:",
    "- Esame obiettivo generale:",
  ].join("\n");

  const esami = [
    "Esami di laboratorio:",
    pcr ? `- PCR: ${pcr.value} ${pcr.unit || "mg/L"}` : "",
    ves ? `- VES: ${ves.value} mm/h` : "",
  ].filter(Boolean).join("\n");

  const lastA = latestAssessment(assessments, ["das28_crp", "das28_esr", "sledai", "asdas_crp", "basdai"]);
  const valutazione = lastA
    ? `Ultimo indice disponibile (${lastA.index_type.toUpperCase()}, ${new Date(lastA.date).toLocaleDateString("it-IT")}): ${lastA.score} — ${lastA.interpretation}.`
    : "Attività di malattia: valutazione clinica in sede.";

  const piano = planData?.note || "Si conferma il piano terapeutico. Prossimo controllo da programmare.";

  const strumentali = buildInstrumentalText(instrumentalExams, null);
  return { intestazione: intestazione(patient, diag, therapy), anamnesi, esame, esami, valutazione, piano, strumentali };
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────
function buildDraft(props) {
  const { patient } = props;
  const workflow = detectDiseaseWorkflow(patient);
  switch (workflow.reportTemplate) {
    case "ra":           return buildRA(props);
    case "spa":          return buildSpA(props);
    case "pmr":          return buildPMR(props);
    case "sle":          return buildSLE(props);
    case "vasculitis":   return buildVasculitis(props);
    case "myositis":     return buildMyositis(props);
    case "fibromyalgia": return buildFibromyalgia(props);
    case "osteoporosis": return buildOsteoporosis(props);
    default:             return buildGeneric(props);
  }
}

// ─── Block editor ─────────────────────────────────────────────────────────────
function Block({ title, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-[0.15em] text-gray-500 font-semibold">{title}</div>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-sm font-mono min-h-[80px] resize-y"
      />
    </div>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────
export default function VisitReportDialog({
  open, onOpenChange, patient, assessments, therapies, labExams, todayVisitData, planData, instrumentalExams,
}) {
  const [blocks, setBlocks] = useState({});

  // Regenerate draft only when the dialog first opens — intentionally not re-running
  // on every prop change so the clinician can edit blocks without them being reset.
  useEffect(() => {
    if (open && patient) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setBlocks(buildDraft({ patient, assessments, therapies, labExams, todayVisitData, planData, instrumentalExams }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setBlock = (key, val) => setBlocks(prev => ({ ...prev, [key]: val }));

  const fullText = [
    blocks.intestazione,
    blocks.anamnesi     ? `\nANAMNESI\n${blocks.anamnesi}`               : "",
    blocks.esame        ? `\nESAME OBIETTIVO\n${blocks.esame}`           : "",
    blocks.esami        ? `\nESAMI DI LABORATORIO\n${blocks.esami}`      : "",
    blocks.strumentali  ? `\nESAMI STRUMENTALI\n${blocks.strumentali}`   : "",
    blocks.valutazione  ? `\nVALUTAZIONE\n${blocks.valutazione}`         : "",
    blocks.piano        ? `\nPIANO\n${blocks.piano}`                     : "",
  ].filter(Boolean).join("\n");

  const copyAll = () => {
    navigator.clipboard.writeText(fullText).then(() => toast.success("Referto copiato negli appunti"));
  };

  const print = () => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup bloccato dal browser"); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>Referto</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;max-width:720px;margin:0 auto;line-height:1.6}
      pre{white-space:pre-wrap;font-family:Arial,sans-serif}</style></head>
      <body><pre>${fullText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`);
    w.document.close();
    w.print();
  };

  const workflow = detectDiseaseWorkflow(patient);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="visit-report-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading font-black tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0A2540]" />
            Genera referto visita
            <Badge className="bg-violet-100 text-violet-800 border border-violet-200 text-[10px] hover:bg-violet-100">
              <Sparkles className="w-3 h-3 mr-1" /> Bozza automatica
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800">
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Bozza generata automaticamente per <strong>{workflow.label}</strong>. Ogni sezione è editabile prima di copiare o stampare.
            </span>
          </div>

          <Block title="Intestazione"          value={blocks.intestazione  || ""} onChange={v => setBlock("intestazione", v)} />
          <Block title="Anamnesi"              value={blocks.anamnesi      || ""} onChange={v => setBlock("anamnesi", v)} />
          <Block title="Esame obiettivo"       value={blocks.esame         || ""} onChange={v => setBlock("esame", v)} />
          <Block title="Esami di laboratorio"  value={blocks.esami         || ""} onChange={v => setBlock("esami", v)} />
          {blocks.strumentali != null && (
            <Block title="Esami strumentali"   value={blocks.strumentali   || ""} onChange={v => setBlock("strumentali", v)} />
          )}
          <Block title="Valutazione"           value={blocks.valutazione   || ""} onChange={v => setBlock("valutazione", v)} />
          <Block title="Piano"                 value={blocks.piano         || ""} onChange={v => setBlock("piano", v)} />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
          <Button variant="outline" onClick={print}>
            <Printer className="w-4 h-4 mr-2" /> Stampa
          </Button>
          <Button
            onClick={copyAll}
            className="bg-[#0A2540] text-white hover:bg-[#051626]"
            data-testid="report-copy-btn"
          >
            <Copy className="w-4 h-4 mr-2" /> Copia tutto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
