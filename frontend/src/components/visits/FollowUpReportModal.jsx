import React, { useRef } from "react";
import { X, Printer, Copy } from "lucide-react";
import { Button } from "../ui/button";
import { serializePhysicalExam } from "../clinical/PhysicalExamSection";
import { toast } from "sonner";
import {
  interpretDAS28, interpretCDAI, interpretSDAI,
  interpretASDAS, interpretDAPSA,
} from "../../lib/clinimetrics";

function patientLabel(p) {
  if (!p) return "Paziente";
  return [p.cognome, p.nome].filter(Boolean).join(" ") || p.codice_paziente || "Paziente";
}

function calcAge(p) {
  if (p?.data_nascita) {
    const dob = new Date(p.data_nascita);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }
  if (p?.anno_nascita) return new Date().getFullYear() - Number(p.anno_nascita);
  return null;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const PMR_ACTIVITY_LABELS = {
  clinical_remission:     "Remissione clinica",
  suspected_pmr_activity: "Sospetta attività PMR",
  suspected_cranial_gca:  "Sospetta GCA cranica attiva",
  suspected_lvv_activity: "Sospetta LVV extracranica attiva",
  damage_no_activity:     "Danno/sequele — malattia non attiva",
  alternative_cause:      "Causa alternativa / infezione più probabile",
};

export default function FollowUpReportModal({
  open, onClose,
  patient, date, workflow, reportSections,
  raccordoText,
  cockpitData, cockpitReportSections,
  intervalHistory,
  physicalExam, examJoints, examSystems, examMrss, examPasi, examLei,
  labsImaging,
  note, symptoms, symptomDefs,
  das28crp, das28esr, cdai, sdai,
  asdas, dapsa,
  spaHasAxial, spaProfileKnown,
  tjc, sjc, gh, ega, pcr, ves,
  spaBack, spaStiff, spaPeriph, spaPga, spaPcr, spaTjc, spaSjc,
  spaDactylitis, spaEnthesitis,
  pmrEsr, pmrPcr, pmrSteroid, pmrPain, pmrStiff, pmrActivityLevel,
  fibroPain, fibroFatigue, fibroSleep,
  myoStrength, myoCk,
  planIndicazioni, planFurtherIndications, planReportSections,
}) {
  const bodyRef = useRef(null);
  if (!open) return null;

  function buildClinimetriaText() {
    const lines = [];

    if (das28crp != null) lines.push(`DAS28-PCR: ${das28crp}  →  ${interpretDAS28(das28crp)}`);
    if (das28esr != null) lines.push(`DAS28-VES: ${das28esr}  →  ${interpretDAS28(das28esr)}`);
    if (cdai     != null) lines.push(`CDAI: ${cdai}  →  ${interpretCDAI(cdai)}`);
    if (sdai     != null) lines.push(`SDAI: ${sdai}  →  ${interpretSDAI(sdai)}`);
    const raInputs = [];
    if (tjc !== "" && tjc != null) raInputs.push(`TJC: ${tjc}`);
    if (sjc !== "" && sjc != null) raInputs.push(`SJC: ${sjc}`);
    if (gh  !== "" && gh  != null) raInputs.push(`VAS-GH: ${gh}`);
    if (ega !== "" && ega != null) raInputs.push(`EGA: ${ega}`);
    if (pcr !== "" && pcr != null) raInputs.push(`PCR: ${pcr} mg/L`);
    if (ves !== "" && ves != null) raInputs.push(`VES: ${ves} mm/h`);
    if (raInputs.length) lines.push("Input AR: " + raInputs.join(" · "));

    const showAxial = !spaProfileKnown || spaHasAxial;
    if (asdas != null && showAxial) lines.push(`ASDAS-CRP: ${asdas}  →  ${interpretASDAS(asdas)}`);
    if (dapsa != null) lines.push(`DAPSA: ${dapsa}  →  ${interpretDAPSA(dapsa)}`);
    const spaInputs = [];
    if (showAxial && spaBack  !== "" && spaBack  != null) spaInputs.push(`Lombalgia: ${spaBack}`);
    if (showAxial && spaStiff !== "" && spaStiff != null) spaInputs.push(`Rigidità: ${spaStiff}`);
    if (spaPeriph    !== "" && spaPeriph    != null) spaInputs.push(`Dolore periferico: ${spaPeriph}`);
    if (spaPga       !== "" && spaPga       != null) spaInputs.push(`PGA: ${spaPga}`);
    if (spaPcr       !== "" && spaPcr       != null) spaInputs.push(`PCR: ${spaPcr} mg/L`);
    if (spaTjc       !== "" && spaTjc       != null) spaInputs.push(`TJC: ${spaTjc}`);
    if (spaSjc       !== "" && spaSjc       != null) spaInputs.push(`SJC: ${spaSjc}`);
    if (spaDactylitis !== "" && spaDactylitis != null) spaInputs.push(`Dattiliti: ${spaDactylitis}`);
    if (spaEnthesitis !== "" && spaEnthesitis != null) spaInputs.push(`Entesiti: ${spaEnthesitis}`);
    if (spaInputs.length) lines.push("Input SpA: " + spaInputs.join(" · "));

    if (pmrEsr     !== "" && pmrEsr     != null) lines.push(`VES: ${pmrEsr} mm/h`);
    if (pmrPcr     !== "" && pmrPcr     != null) lines.push(`PCR: ${pmrPcr} mg/L`);
    if (pmrSteroid !== "" && pmrSteroid != null) lines.push(`Prednisone: ${pmrSteroid} mg/die`);
    if (pmrPain    !== "" && pmrPain    != null) lines.push(`VAS dolore: ${pmrPain}/10`);
    if (pmrStiff   !== "" && pmrStiff   != null) lines.push(`Rigidità mattutina: ${pmrStiff} min`);
    if (pmrActivityLevel) lines.push(`Assessment: ${PMR_ACTIVITY_LABELS[pmrActivityLevel] || pmrActivityLevel}`);

    if (fibroPain    !== "" && fibroPain    != null) lines.push(`VAS dolore: ${fibroPain}/10`);
    if (fibroFatigue !== "" && fibroFatigue != null) lines.push(`VAS affaticamento: ${fibroFatigue}/10`);
    if (fibroSleep   !== "" && fibroSleep   != null) lines.push(`VAS qualità sonno: ${fibroSleep}/10`);

    if (myoStrength !== "" && myoStrength != null) lines.push(`Forza muscolare sogg.: ${myoStrength}/10`);
    if (myoCk       !== "" && myoCk       != null) lines.push(`CK: ${myoCk} IU/L`);

    return lines.join("\n");
  }

  function buildExamText() {
    return serializePhysicalExam({
      free_text:  physicalExam,
      joint_exam: examJoints  || {},
      systems:    examSystems  || {},
      mrss:       examMrss     || {},
      pasi:       examPasi     || {},
      lei:        examLei      || {},
    });
  }

  function buildAssessmentText() {
    const parts = [];
    const symptomLabels = [...(symptoms || new Set())]
      .map(k => symptomDefs?.find(s => s.key === k)?.label)
      .filter(Boolean);
    if (symptomLabels.length) parts.push("Sintomi riferiti: " + symptomLabels.join(", ") + ".");
    if (note?.trim()) parts.push(note.trim());
    return parts.join("\n");
  }

  const cockpit = cockpitData || {};
  const crs = cockpitReportSections || new Set();

  const COCKPIT_DEFS = [
    { key: "cockpit_therapy",         label: "TERAPIA CONSIGLIATA / MODIFICATA ALLA VISITA PRECEDENTE", getText: () => cockpit.last_therapy_modification?.trim() },
    { key: "cockpit_referral",        label: "MOTIVO DI INVIO",                                          getText: () => cockpit.referral_reason_text?.trim() },
    { key: "cockpit_diagnostic",      label: "IPOTESI DIAGNOSTICA / STATO CORRENTE",                     getText: () => cockpit.diagnostic_status?.trim() },
    { key: "cockpit_extra",           label: "ANAMNESI EXTRA-REUMATOLOGICA",                             getText: () => cockpit.extra_rheumatologic_history?.trim() },
    { key: "cockpit_physiologic",     label: "ANAMNESI FISIOLOGICA",                                     getText: () => cockpit.physiologic_history?.trim() },
    { key: "cockpit_family",          label: "ANAMNESI FAMILIARE",                                       getText: () => cockpit.family_history?.trim() },
    { key: "cockpit_pending",         label: "ESAMI PENDENTI / RICHIESTE",                               getText: () => cockpit.pending_items?.trim() },
    { key: "profile_comorbidities",   label: "COMORBIDITÀ",                                              getText: () => cockpit.comorbidities_text?.trim() },
    { key: "profile_therapy",         label: "TERAPIA DOMICILIARE",                                      getText: () => cockpit.therapy_dom_text?.trim() },
    { key: "profile_allergies",       label: "ALLERGIE / INTOLLERANZE",                                  getText: () => cockpit.allergies_text?.trim() },
    { key: "profile_other",           label: "ALTRO (STORIA CLINICA)",                                   getText: () => cockpit.other_text?.trim() },
    { key: "workup_motivo_ipotesi",   label: "WORKUP — MOTIVO DI INVIO E IPOTESI DIAGNOSTICHE",          getText: () => cockpit.workup_motivo_text?.trim() },
    { key: "workup_esami_richiesti",  label: "WORKUP — ESAMI RICHIESTI",                                 getText: () => cockpit.workup_esami_text?.trim() },
  ];

  const activeCockpit = COCKPIT_DEFS
    .filter(s => crs.has(s.key))
    .map(s => ({ ...s, text: s.getText() }))
    .filter(s => s.text);

  const SECTION_DEFS = [
    { key: "raccordo",         label: "RACCORDO ANAMNESTICO", getText: () => raccordoText?.trim() },
    { key: "interval_history", label: "ANAMNESI INTERVALLARE", getText: () => intervalHistory?.trim() },
    { key: "physical_exam",    label: "ESAME OBIETTIVO",       getText: buildExamText },
    { key: "labs_imaging",     label: "ESAMI",                 getText: () => labsImaging?.trim() },
    { key: "clinimetria",      label: "CLINIMETRIA",           getText: buildClinimetriaText },
    { key: "assessment",       label: "CONCLUSIONI",           getText: buildAssessmentText },
  ];

  const PLAN_SECTION_DEFS = [
    { key: "therapy_plan",        label: "TERAPIA",     getText: () => planIndicazioni?.trim() },
    { key: "further_indications", label: "INDICAZIONI", getText: () => planFurtherIndications?.trim() },
  ];

  const activeSections = SECTION_DEFS
    .filter(s => reportSections.has(s.key))
    .map(s => ({ ...s, text: s.getText() }))
    .filter(s => s.text);

  const prs = planReportSections || new Set();
  const activePlanSections = PLAN_SECTION_DEFS
    .filter(s => prs.has(s.key))
    .map(s => ({ ...s, text: s.getText() }))
    .filter(s => s.text);

  const allActive = [...activeCockpit, ...activeSections, ...activePlanSections];

  const pLabel    = patientLabel(patient);
  const dateLabel = fmtDate(date);
  const diagLabel = patient?.diagnosi ? ` · ${patient.diagnosi}` : "";
  const wfLabel   = workflow?.label   ? ` · ${workflow.label}`  : "";

  const age           = calcAge(patient);
  const ageLabel      = age != null ? `${age}` : "—";
  const sesso         = (patient?.sesso || "").toUpperCase();
  const affettoLabel  = sesso === "F" ? "affetta" : sesso === "M" ? "affetto" : "affetto/a";
  const diagnosiLabel = patient?.diagnosi || "patologia non specificata";
  const introText     = `visita ambulatoriale di controllo in paziente di ${ageLabel} anni ${affettoLabel} da ${diagnosiLabel}.`;

  const fullPlainText = [
    `Gentile Collega,\n\n${introText}`,
    "",
    ...(activeCockpit.length ? [activeCockpit.map(s => `${s.label}  ${s.text}`).join("\n")] : []),
    ...activeSections.map(s => `${s.label}\n${s.text}`),
    ...activePlanSections.map(s => `${s.label}\n${s.text}`),
  ].join("\n\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(fullPlainText)
      .then(() => toast.success("Testo copiato negli appunti"))
      .catch(() => toast.error("Copia non riuscita"));
  };

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup bloccato — abilita i popup per stampare"); return; }
    const escape = (s) => s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    w.document.write(`<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8">
<title>Referto – ${pLabel} – ${dateLabel}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #111; line-height: 1.7; font-size: 13px; }
  .header { border-bottom: 2px solid #0A2540; padding-bottom: 14px; margin-bottom: 24px; }
  .header .salutation { font-size: 14px; font-weight: 700; color: #0A2540; margin-bottom: 8px; }
  .header .intro { font-size: 13px; color: #111; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #b45309; margin-bottom: 6px; }
  .section-body { white-space: pre-wrap; color: #222; }
  .compact-block { margin-bottom: 22px; }
  .compact-item { line-height: 1.65; }
  .compact-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #b45309; margin-right: 5px; }
  .compact-text { font-size: 13px; color: #222; white-space: pre-wrap; }
  .footer-note { margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 10px; color: #9ca3af; }
  @media print { button { display: none !important; } }
</style>
</head><body>
<div class="header">
  <p class="salutation">Gentile Collega,</p>
  <p class="intro">${escape(introText)}</p>
</div>
${activeCockpit.length ? `<div class="compact-block">${activeCockpit.map(s => `<div class="compact-item"><span class="compact-label">${escape(s.label)}</span><span class="compact-text">${escape(s.text)}</span></div>`).join("")}</div>` : ""}
${activeSections.map(s => `<div class="section">
  <div class="section-title">${escape(s.label)}</div>
  <div class="section-body">${escape(s.text)}</div>
</div>`).join("")}
${activePlanSections.map(s => `<div class="section">
  <div class="section-title">${escape(s.label)}</div>
  <div class="section-body">${escape(s.text)}</div>
</div>`).join("")}
<div class="footer-note">Documento generato da RheumaFlow — ${new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">

        {/* ── Modal header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-heading font-bold text-[#0A2540]">Elabora referto</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {pLabel} · Visita del {dateLabel}{diagLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Hint sezioni ── */}
        <div className="px-6 pt-4 pb-0">
          <p className="text-[11px] text-gray-400">
            Sono incluse le sezioni spuntate con ☑ nel form. Chiudi e modifica le spunte per cambiare il contenuto.
          </p>
        </div>

        {/* ── Corpo referto ── */}
        <div className="px-6 py-5 min-h-[160px]" ref={bodyRef}>
          {allActive.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Printer className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Nessuna sezione selezionata</p>
              <p className="text-[11px] mt-1">
                Usa le checkbox ☐ nel profilo paziente e nelle sezioni del form visita per includere il contenuto.
              </p>
            </div>
          ) : (
            <div className="space-y-5 font-serif text-sm text-gray-800 leading-relaxed">
              <div className="border-b border-gray-200 pb-3">
                <div className="text-sm font-bold text-[#0A2540] mb-1">Gentile Collega,</div>
                <div className="text-sm text-gray-800">{introText}</div>
              </div>
              {activeCockpit.length > 0 && (
                <div className="space-y-1">
                  {activeCockpit.map(s => (
                    <div key={s.key} className="leading-snug">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 mr-1">{s.label}</span>
                      <span className="text-sm text-gray-800 whitespace-pre-wrap">{s.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {activeSections.map(s => (
                <div key={s.key}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 mb-1.5">
                    {s.label}
                  </div>
                  <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">{s.text}</p>
                </div>
              ))}
              {activePlanSections.map(s => (
                <div key={s.key}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 mb-1.5">
                    {s.label}
                  </div>
                  <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-xl">
          <Button
            onClick={handlePrint}
            disabled={allActive.length === 0}
            className="bg-[#0A2540] hover:bg-[#051626] text-white"
          >
            <Printer className="w-4 h-4 mr-2" /> Stampa / PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleCopy}
            disabled={allActive.length === 0}
          >
            <Copy className="w-4 h-4 mr-2" /> Copia testo
          </Button>
          <Button variant="ghost" onClick={onClose} className="ml-auto text-gray-500">
            Chiudi
          </Button>
        </div>

      </div>
    </div>
  );
}
