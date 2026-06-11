import { serializePhysicalExam } from "../components/clinical/PhysicalExamSection";
import { COMORBIDITY_CATEGORIES } from "./conditions";
import { REFERRAL_REASONS } from "./firstVisitData";

export const REPORT_SECTION_KEYS = [
  "anamnesi_extra","anamnesi_familiare","anamnesi_fisiologica",
  "anamnesi_reuma","esame_obiettivo","esami_imaging",
  "diagnosi","esami_richiesti","terapia","note_conclusive",
];

export const REPORT_SECTIONS = [
  { key: "anamnesi_extra",       label: "Anamnesi extra-reumatologica" },
  { key: "anamnesi_familiare",   label: "Anamnesi familiare" },
  { key: "anamnesi_fisiologica", label: "Anamnesi fisiologica" },
  { key: "anamnesi_reuma",       label: "Anamnesi reumatologica" },
  { key: "esame_obiettivo",      label: "Esame obiettivo" },
  { key: "esami_imaging",        label: "Esami" },
  { key: "diagnosi",             label: "Diagnosi" },
  { key: "esami_richiesti",      label: "Esami richiesti" },
  { key: "terapia",              label: "Terapia indicata" },
  { key: "note_conclusive",      label: "Indicazioni" },
];

export function generateCleanClinicalReport(patient, data, reportSections) {
  const rs = reportSections || new Set(REPORT_SECTION_KEYS);

  const reason = REFERRAL_REASONS.find((r) => r.key === data.referral_reason);
  const rheuHistory = data.referral_reason === "osteoporosi" ? data.bone_history : data.rheumatologic_history;
  const physExam = serializePhysicalExam({
    free_text: data.physical_exam,
    joint_exam: data.physical_exam_joint_exam,
    systems: data.physical_exam_systems,
    mrss: data.physical_exam_mrss,
    pasi: data.physical_exam_pasi,
    lei: data.physical_exam_lei,
  });

  const allComorbidities = COMORBIDITY_CATEGORIES.flatMap((cat) =>
    (data.comorbidities[cat.key] || []).map((item) => {
      const note = data.comorbidity_item_notes?.[item];
      return note ? `${item} (${note})` : item;
    })
  );

  const blocks = [];

  const motivoParts = [
    reason ? reason.label : (data.referral_reason || ""),
    data.clinical_question?.trim() || "",
  ].filter(Boolean);
  blocks.push(`MOTIVO DI INVIO: ${motivoParts.join(" — ")}`);

  if (rs.has("anamnesi_extra")) {
    const extraLines = [];
    const comorbParts = [
      ...allComorbidities,
      data.comorbidity_free_notes?.trim() || "",
    ].filter(Boolean);
    if (comorbParts.length) extraLines.push(`COMORBILITA': ${comorbParts.join("; ")}`);
    if (data.surgical_history?.trim())
      extraLines.push(`APR: ${data.surgical_history.trim().replace(/\n+/g, "; ")}`);
    if (rs.has("anamnesi_familiare") && data.family_history?.trim())
      extraLines.push(`ANAMNESI FAMILIARE: ${data.family_history.trim().replace(/\n+/g, " ")}`);
    if (rs.has("anamnesi_fisiologica") && data.physiologic_history?.trim())
      extraLines.push(`ANAMNESI FISIOLOGICA: ${data.physiologic_history.trim().replace(/\n+/g, " ")}`);
    if (data.current_therapies_text?.trim())
      extraLines.push(`TERAPIE CONCOMITANTI: ${data.current_therapies_text.trim().replace(/\n+/g, "; ")}`);
    if (data.drug_allergies?.trim())
      extraLines.push(`ALLERGIE: ${data.drug_allergies.trim()}`);
    if (extraLines.length) blocks.push(extraLines.join("\n"));
  }

  if (rs.has("anamnesi_reuma") && rheuHistory?.trim())
    blocks.push(rheuHistory.trim());

  if (rs.has("esame_obiettivo") && physExam?.trim())
    blocks.push(`ESAME OBIETTIVO\n${physExam.trim()}`);

  if (rs.has("esami_imaging") && data.labs_imaging?.trim())
    blocks.push(`ESAMI\n${data.labs_imaging.trim()}`);

  if (rs.has("diagnosi") && data.diagnostic_conclusion?.trim())
    blocks.push(`CONCLUSIONI\n${data.diagnostic_conclusion.trim()}`);

  if (rs.has("esami_richiesti") && (data.requested_tests?.length || data.requested_tests_notes?.trim())) {
    const lines = ["HO PRESCRITTO:"];
    (data.requested_tests || []).forEach((t) => lines.push(`- ${t}`));
    if (data.requested_tests_notes?.trim()) lines.push(data.requested_tests_notes.trim());
    blocks.push(lines.join("\n"));
  }

  if (rs.has("terapia") && data.therapy_modification?.trim())
    blocks.push(`TERAPIA\n${data.therapy_modification.trim()}`);

  if (rs.has("note_conclusive") && data.outcome_notes?.trim())
    blocks.push(`INDICAZIONI\n${data.outcome_notes.trim()}`);

  blocks.push("Cordiali saluti");

  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n");
}

export function openReport(patient, data, reportSections) {
  const text = generateCleanClinicalReport(patient, data, reportSections);
  const name = [patient?.cognome, patient?.nome].filter(Boolean).join(" ");
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Prima Visita — ${name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; color: #1a1a1a; background: white; }
  #toolbar { position: fixed; top: 0; left: 0; right: 0; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; padding: 8px 20px; display: flex; align-items: center; gap: 14px; font-family: system-ui, sans-serif; font-size: 12px; color: #475569; z-index: 1000; }
  #toolbar button { background: #0a2540; color: white; border: none; padding: 6px 16px; border-radius: 5px; cursor: pointer; font-size: 12px; font-family: system-ui; }
  #toolbar button:hover { background: #1e3a5f; }
  #report { padding: 2cm 2.5cm; padding-top: calc(2cm + 52px); outline: none; min-height: 100vh; white-space: pre-wrap; line-height: 1.7; font-size: 11pt; }
  @media print { #toolbar { display: none !important; } #report { padding-top: 2cm !important; } }
</style>
</head>
<body>
<div id="toolbar">
  <span>Modifica il testo &nbsp;&middot;&nbsp; poi</span>
  <button onclick="window.print()">Stampa / Salva PDF</button>
  <span style="margin-left: auto; font-size: 11px; color: #94a3b8;">${name} &middot; Prima Visita &middot; ${data.referral_date || ""}</span>
</div>
<div id="report" contenteditable="true" spellcheck="false">${escaped}</div>
</body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
}
