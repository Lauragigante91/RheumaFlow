/**
 * SteroidTaperingModal.jsx
 *
 * Piano di scalaggio steroide — generatore calendarizzato.
 * Props:
 *   open, onClose
 *   initialDrug? — "prednisone" | "metilprednisolone" | "deflazacort"
 *   initialDose? — number (mg/die)
 *   visitDate?   — "YYYY-MM-DD"
 *   onAppendToPlan? — (text: string) => void
 *   onSavePlan?     — (planData: object) => void  (optional persist)
 */

import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Copy, ClipboardList, Plus, Trash2, AlertCircle,
  FileText, Printer, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  DRUG_FORMULATIONS, TAPERING_PRESETS,
  generateTaperingPlan, formatClinicalText, formatPatientSchedule,
  getSafetyReminders, formatDateIT,
} from "../../lib/steroidTapering";
import ItalianDatePicker from "../shared/ItalianDatePicker";

function localISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const TODAY = localISO(new Date());

function addWeeks(dateISO, weeks) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return localISO(d);
}

const DEFAULT_STEP_RULES = [
  { aboveDose: 20, reductionMg: 5,   intervalDays: 14 },
  { aboveDose: 10, reductionMg: 2.5, intervalDays: 28 },
  { aboveDose: 0,  reductionMg: 1,   intervalDays: 28 },
];

const PRIORITY_COLORS = {
  high:   "border-red-200 bg-red-50",
  medium: "border-amber-200 bg-amber-50",
  low:    "border-blue-200 bg-blue-50",
};
const PRIORITY_TEXT = {
  high:   "text-red-700",
  medium: "text-amber-700",
  low:    "text-blue-700",
};

export default function SteroidTaperingModal({
  open,
  onClose,
  initialDrug = "prednisone",
  initialDose = "",
  visitDate,
  onAppendToPlan,
}) {
  const today = visitDate || TODAY;

  const [drug, setDrug] = useState(initialDrug || "prednisone");
  const [startDose, setStartDose] = useState(String(initialDose || ""));
  const [startDate, setStartDate] = useState(today);
  const [initialDurationDays, setInitialDurationDays] = useState(14);
  const [targets, setTargets] = useState([
    { dose: "", byDate: addWeeks(today, 12) },
  ]);
  const [stepRules, setStepRules] = useState(DEFAULT_STEP_RULES);
  const [generalNote, setGeneralNote] = useState("assumere al mattino dopo colazione");
  const [hasImmunosuppressants, setHasImmunosuppressants] = useState(false);
  const [showStepRules,   setShowStepRules]   = useState(false);
  const [appliedPreset,   setAppliedPreset]   = useState(null);


  const formulation = DRUG_FORMULATIONS[drug];

  const config = useMemo(() => ({
    drug,
    startDose: parseFloat(startDose) || 0,
    startDate,
    initialDurationDays: parseInt(initialDurationDays) || 0,
    targets: targets
      .filter(t => t.dose !== "" && t.byDate)
      .map(t => ({ dose: parseFloat(t.dose), byDate: t.byDate })),
    stepRules,
    generalNote,
    hasImmunosuppressants,
    standardDoseSequence: !appliedPreset,
  }), [drug, startDose, startDate, initialDurationDays, targets, stepRules, generalNote, hasImmunosuppressants, appliedPreset]);

  const plan = useMemo(() => {
    if (!config.startDose || !config.startDate || !config.targets.length) return null;
    return generateTaperingPlan(config);
  }, [config]);

  const clinicalText = useMemo(() => {
    if (!plan?.steps?.length) return "";
    return formatClinicalText(config, plan.steps);
  }, [config, plan]);

  const patientSchedule = useMemo(() => {
    if (!plan?.steps?.length) return "";
    return formatPatientSchedule(config, plan.steps);
  }, [config, plan]);

  const reminders = useMemo(() => {
    if (!plan?.steps?.length) return [];
    return getSafetyReminders(config, plan.steps);
  }, [config, plan]);


  function applyPreset(key) {
    const preset = TAPERING_PRESETS[key];
    if (!preset) return;
    setDrug(preset.drug);
    setStartDose(String(preset.startDose));
    setInitialDurationDays(preset.initialDurationDays);
    setStepRules(preset.stepRules);
    setGeneralNote(preset.generalNote || "");
    setAppliedPreset(key);
    const newTargets = preset.targets.map(t => ({
      dose: String(t.dose),
      byDate: addWeeks(today, t.byWeeks),
    }));
    setTargets(newTargets);
  }

  function addTarget() {
    const lastDate = targets[targets.length - 1]?.byDate || today;
    setTargets(prev => [...prev, { dose: "", byDate: addWeeks(lastDate, 12) }]);
  }

  function removeTarget(idx) {
    setTargets(prev => prev.filter((_, i) => i !== idx));
  }

  function updateTarget(idx, field, val) {
    setTargets(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  }

  function updateStepRule(idx, field, val) {
    setStepRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: parseFloat(val) || 0 } : r));
  }

  function copyClinical() {
    navigator.clipboard.writeText(clinicalText).then(
      () => toast.success("Testo clinico copiato"),
      () => toast.error("Copia non riuscita"),
    );
  }

  function printPatientCard() {
    if (!plan?.steps?.length) return;
    const formulation = DRUG_FORMULATIONS[drug];
    const brandName = formulation?.defaultBrand || drug;
    const drugLabel = (formulation?.label || drug).split("/")[0].trim();
    const firstStep = plan.steps[0];
    const lastStep  = plan.steps[plan.steps.length - 1];
    const period    = `${formatDateIT(firstStep.startDate)} – ${formatDateIT(lastStep.endDate)}`;
    const todayStr  = formatDateIT(localISO(new Date()));

    const rows = plan.steps.map(step => {
      const dal = formatDateIT(step.startDate);
      const al  = formatDateIT(step.endDate);
      const d   = step.dose;
      const tab = step.tabletText || (d + " mg");
      return `<tr>
      <td class="date" contenteditable="true">${dal}</td>
      <td class="date" contenteditable="true">${al}</td>
      <td class="dose" contenteditable="true">${d} mg/die</td>
      <td contenteditable="true">${tab}</td>
      <td class="check">&#9744;</td>
      <td class="no-print del-col"><button class="del-btn" onclick="this.closest('tr').remove()">&#x2715;</button></td>
    </tr>`;
    }).join("\n");

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>Piano di scalaggio cortisonico</title>
  <style>
    @page { size: A4 portrait; margin: 18mm 15mm 15mm 15mm; }
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #111; background: #fff; margin: 0; }
    .toolbar {
      display: flex; align-items: center; gap: 12px;
      background: #1e3a5f; color: #fff;
      padding: 10px 16px; margin-bottom: 20px;
      font-size: 13px;
    }
    .toolbar p { margin: 0; flex: 1; opacity: 0.88; line-height: 1.4; }
    .print-btn {
      background: #fff; color: #1e3a5f; border: none;
      border-radius: 6px; padding: 8px 20px;
      font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap;
    }
    .print-btn:hover { background: #dbeafe; }
    h1 {
      font-size: 20px; font-weight: 900; text-transform: uppercase;
      letter-spacing: 2px; margin: 0 0 4px 0;
      border-bottom: 3px solid #111; padding-bottom: 8px;
    }
    .subtitle { font-size: 12px; color: #666; margin-bottom: 18px; }
    .info-box {
      background: #f4f4f4; border-left: 5px solid #333;
      padding: 12px 14px; margin-bottom: 20px; border-radius: 0 4px 4px 0;
    }
    .info-row { margin-bottom: 6px; font-size: 14px; display: flex; align-items: baseline; gap: 6px; }
    .info-row strong { display: inline-block; min-width: 160px; flex-shrink: 0; }
    .patient-name-val { font-weight: 700; font-size: 15px; }
    /* Contenteditable: no display change — table cells must stay as table-cell */
    [contenteditable] { outline: none; border-radius: 3px; }
    [contenteditable]:hover { background: rgba(245, 158, 11, 0.09); }
    [contenteditable]:focus { background: rgba(245, 158, 11, 0.15); outline: 2px dashed #f59e0b; outline-offset: 2px; }
    /* Placeholder for empty span elements in info-box */
    .info-box span[contenteditable] { display: inline-block; min-width: 4px; }
    [contenteditable][data-ph]:empty::before { content: attr(data-ph); color: #bbb; font-style: italic; font-weight: normal; pointer-events: none; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 13px; table-layout: fixed; }
    thead tr { background: #222; color: #fff; }
    th { padding: 9px 10px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; }
    th.col-dal  { width: 92px; }
    th.col-al   { width: 92px; }
    th.col-dose { width: 110px; }
    th.col-cp   { width: auto; }
    th.col-fatto { width: 58px; text-align: center; }
    td { padding: 9px 10px; border-bottom: 1px solid #ddd; vertical-align: middle; overflow: hidden; }
    tr:nth-child(even) td { background: #f9f9f9; }
    td.dose { font-weight: 700; font-size: 14px; white-space: nowrap; }
    td.date { white-space: nowrap; font-size: 13px; }
    td.check { text-align: center; font-size: 18px; color: #aaa; }
    td.del-col { text-align: center; width: 38px; }
    .del-btn {
      background: none; border: 1px solid #e0e0e0; border-radius: 4px;
      color: #c00; cursor: pointer; font-size: 14px; padding: 2px 6px; line-height: 1;
    }
    .del-btn:hover { background: #fee2e2; border-color: #c00; }
    .warnings {
      border: 2.5px solid #c00; border-radius: 6px;
      padding: 14px 18px; margin-top: 4px; page-break-inside: avoid;
    }
    .warnings h3 { color: #c00; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px; }
    .warnings ul { margin: 0; padding: 0 0 0 20px; }
    .warnings li { margin-bottom: 7px; font-size: 14px; font-weight: 600; line-height: 1.4; }
    .footer { margin-top: 20px; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; text-align: center; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      [contenteditable]:hover, [contenteditable]:focus { background: transparent !important; outline: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <p>&#9998;&nbsp; Clicca su qualsiasi testo per modificarlo &nbsp;&#183;&nbsp; usa <strong>&#x2715;</strong> per eliminare righe &nbsp;&#183;&nbsp; inserisci il nome nel campo apposito &nbsp;&#183;&nbsp; non viene salvato nulla</p>
    <button class="print-btn" onclick="window.print()">&#128424;&nbsp; Stampa / Salva PDF</button>
  </div>

  <h1>Piano di scalaggio cortisonico</h1>
  <p class="subtitle">Schema da consegnare al paziente / caregiver &mdash; leggere attentamente</p>

  <div class="info-box">
    <div class="info-row">
      <strong>Paziente:</strong>
      <span class="patient-name-val" contenteditable="true" data-ph="&mdash; inserire nome o iniziali &mdash;"></span>
    </div>
    <div class="info-row"><strong>Farmaco:</strong> <span contenteditable="true">${drugLabel} (${brandName})</span></div>
    <div class="info-row"><strong>Data inizio:</strong> <span contenteditable="true">${formatDateIT(firstStep.startDate)}</span></div>
    <div class="info-row"><strong>Periodo coperto:</strong> <span contenteditable="true">${period}</span></div>
    <div class="info-row"><strong>Assunzione:</strong> <span contenteditable="true">${generalNote || "assumere al mattino dopo colazione"}</span></div>
    <div class="info-row">
      <strong>Note aggiuntive:</strong>
      <span contenteditable="true" data-ph="Clicca per aggiungere note specifiche per questo paziente&hellip;"></span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-dal">Dal</th>
        <th class="col-al">Al</th>
        <th class="col-dose">Dose al giorno</th>
        <th class="col-cp">Compresse da assumere</th>
        <th class="col-fatto">Fatto &#10003;</th>
        <th class="no-print del-col"></th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="warnings">
    <h3>&#9888; Avvertenze importanti</h3>
    <ul>
      <li contenteditable="true">Non interrompere lo steroide bruscamente, nemmeno se si sente meglio.</li>
      <li contenteditable="true">Assumere al mattino dopo colazione, salvo diversa indicazione del medico.</li>
      <li contenteditable="true">In caso di febbre, malattia, trauma, intervento chirurgico o qualsiasi dubbio: contattare il medico prima di modificare la dose.</li>
    </ul>
  </div>

  <div class="footer">Schema generato il ${todayStr} &mdash; RheumaFlow &middot; Documento ad uso del paziente</div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=960");
    if (!win) { toast.error("Popup bloccato dal browser — consenti i popup per questa pagina"); return; }
    win.document.write(html);
    win.document.close();
  }

  function appendToReport() {
    if (!clinicalText) return;
    onAppendToPlan?.(clinicalText);
    toast.success("Testo clinico aggiunto a §10 – Terapia del referto");
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0" style={{ maxHeight: "92vh" }}>
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-gray-100 bg-gray-50/60 flex-shrink-0">
          <DialogTitle className="font-heading font-bold text-base tracking-tight flex items-center gap-2">
            <span style={{ fontSize: "18px" }}>💊</span>
            Piano di scalaggio steroide
          </DialogTitle>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Generatore calendarizzato con date esplicite e numero di compresse
          </p>
        </DialogHeader>

        {/* Preset chips */}
        <div className="px-6 py-3 border-b border-gray-100 bg-white flex-shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-2">Preset clinici</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(TAPERING_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                title={preset.description}
                style={{
                  fontSize: "10px", fontWeight: 600,
                  padding: "3px 10px", borderRadius: "999px",
                  border: appliedPreset === key ? "1.5px solid #0A2540" : "1px solid #d1d5db",
                  background: appliedPreset === key ? "#0A2540" : "#f9fafb",
                  color: appliedPreset === key ? "#fff" : "#374151",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex overflow-hidden" style={{ height: "calc(92vh - 180px)" }}>

          {/* ── LEFT: Settings form ──────────────────────────────────────────── */}
          <div className="w-80 flex-shrink-0 border-r border-gray-100 overflow-y-auto p-5 space-y-4">

            {/* Farmaco */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Farmaco</Label>
              <select
                value={drug}
                onChange={e => { setDrug(e.target.value); setAppliedPreset(null); }}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                {Object.entries(DRUG_FORMULATIONS).map(([k, f]) => (
                  <option key={k} value={k}>{f.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400">
                Compresse disponibili: {formulation?.tablets.map(t => `${t} mg`).join(", ")}
              </p>
            </div>

            {/* Dose iniziale */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Dose iniziale (mg/die)</Label>
                <Input
                  type="number"
                  value={startDose}
                  onChange={e => { setStartDose(e.target.value); setAppliedPreset(null); }}
                  placeholder="es. 50"
                  className="text-xs h-8"
                  min="0" step="0.5"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Durata dose iniziale (gg)</Label>
                <Input
                  type="number"
                  value={initialDurationDays}
                  onChange={e => setInitialDurationDays(e.target.value)}
                  placeholder="es. 14"
                  className="text-xs h-8"
                  min="0" step="1"
                />
              </div>
            </div>

            {/* Data inizio */}
            <div className="space-y-1">
              <Label className="text-xs">Data inizio</Label>
              <ItalianDatePicker value={startDate} onChange={setStartDate} />
            </div>

            {/* Immunosoppressori */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasImmunosuppressants}
                onChange={e => setHasImmunosuppressants(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#0A2540]"
              />
              <span className="text-xs text-gray-700">Associato a immunosoppressore</span>
            </label>

            {/* Obiettivi */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 flex items-center justify-between">
                Obiettivi di dose
                <button type="button" onClick={addTarget} className="text-[#0A2540] hover:underline text-[10px] normal-case font-semibold flex items-center gap-0.5">
                  <Plus className="w-3 h-3" /> Aggiungi
                </button>
              </div>
              {targets.map((t, idx) => (
                <div key={idx} className="flex items-end gap-1.5">
                  <div className="space-y-0.5 flex-shrink-0 w-16">
                    <Label className="text-[10px] text-gray-500">Target (mg)</Label>
                    <Input
                      type="number"
                      value={t.dose}
                      onChange={e => updateTarget(idx, "dose", e.target.value)}
                      placeholder="5"
                      className="text-xs h-7 px-2"
                      min="0" step="0.5"
                    />
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <Label className="text-[10px] text-gray-500">Entro data</Label>
                    <ItalianDatePicker value={t.byDate} onChange={v => updateTarget(idx, "byDate", v)} />
                  </div>
                  {targets.length > 1 && (
                    <button type="button" onClick={() => removeTarget(idx)} className="mb-0.5 text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Step rules — collapsible */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowStepRules(v => !v)}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showStepRules ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Velocità riduzione
              </button>
              {showStepRules && (
                <div className="space-y-2 pl-1">
                  {stepRules.map((rule, idx) => (
                    <div key={idx} className="rounded-md bg-gray-50 border border-gray-200 p-2 text-[11px]">
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="space-y-0.5">
                          <Label className="text-[9px] text-gray-500 uppercase">Sopra (mg)</Label>
                          <Input type="number" value={rule.aboveDose} onChange={e => updateStepRule(idx, "aboveDose", e.target.value)} className="h-6 text-xs px-1.5" />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[9px] text-gray-500 uppercase">Riduzione (mg)</Label>
                          <Input type="number" value={rule.reductionMg} onChange={e => updateStepRule(idx, "reductionMg", e.target.value)} className="h-6 text-xs px-1.5" step="0.5" />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[9px] text-gray-500 uppercase">Ogni (gg)</Label>
                          <Input type="number" value={rule.intervalDays} onChange={e => updateStepRule(idx, "intervalDays", e.target.value)} className="h-6 text-xs px-1.5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Nota generale */}
            <div className="space-y-1">
              <Label className="text-xs">Nota per il paziente</Label>
              <Input
                value={generalNote}
                onChange={e => setGeneralNote(e.target.value)}
                placeholder="es. assumere al mattino dopo colazione"
                className="text-xs h-8"
              />
            </div>

          </div>

          {/* ── RIGHT: Preview ───────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gray-50/30">

            {!plan?.steps?.length && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">💊</div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Inserisci dose e obiettivo</p>
                  <p className="text-xs text-gray-500 mt-1">Il piano si genera automaticamente</p>
                </div>
              </div>
            )}

            {plan?.warnings?.length > 0 && (
              <div className="space-y-1">
                {plan.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700">{w}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Safety reminders */}
            {reminders.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Safety reminders</div>
                {reminders.map(rem => (
                  <div key={rem.id} className={`rounded-md border px-3 py-2 ${PRIORITY_COLORS[rem.priority]}`}>
                    <div className={`text-[11px] font-bold flex items-center gap-1.5 ${PRIORITY_TEXT[rem.priority]}`}>
                      <span>{rem.icon}</span>{rem.label}
                    </div>
                    <p className={`text-[10px] mt-0.5 leading-snug ${PRIORITY_TEXT[rem.priority]}`}>{rem.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Generated schedule table */}
            {plan?.steps?.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">
                  Schema generato — {plan.steps.length} periodi
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#0A2540] text-white">
                        <th className="px-3 py-2 text-left font-semibold text-[10px] tracking-wide">Dal</th>
                        <th className="px-3 py-2 text-left font-semibold text-[10px] tracking-wide">Al</th>
                        <th className="px-2 py-2 text-center font-semibold text-[10px] tracking-wide">Gg</th>
                        <th className="px-3 py-2 text-right font-semibold text-[10px] tracking-wide">Dose</th>
                        <th className="px-3 py-2 text-left font-semibold text-[10px] tracking-wide">Compresse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.steps.map((step, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"}>
                          <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{formatDateIT(step.startDate)}</td>
                          <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{formatDateIT(step.endDate)}</td>
                          <td className="px-2 py-1.5 text-center text-gray-500">{step.durationDays}</td>
                          <td className="px-3 py-1.5 text-right font-bold text-[#0A2540] whitespace-nowrap">{step.dose} mg</td>
                          <td className="px-3 py-1.5 text-gray-600 text-[10px] leading-snug">{step.tabletText}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Output A — testo clinico */}
            {clinicalText && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Output A — Testo per il referto
                </div>
                <div className="rounded-md border border-indigo-200 bg-indigo-50/50 px-3 py-2">
                  <p className="text-[11px] text-indigo-900 leading-snug italic">{clinicalText}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={copyClinical} className="h-7 text-[10px] gap-1">
                    <Copy className="w-3 h-3" /> Copia testo
                  </Button>
                  {onAppendToPlan && (
                    <Button size="sm" onClick={appendToReport} className="h-7 text-[10px] gap-1 bg-[#0A2540] hover:bg-[#051626] text-white">
                      <ClipboardList className="w-3 h-3" /> Aggiungi a §10 Terapia
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Output B — scheda paziente modificabile */}
            {plan?.steps?.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 flex items-center gap-1.5">
                  <Printer className="w-3 h-3" /> Scheda paziente
                </div>
                {/* Anteprima compatta */}
                <div className="rounded-md border border-green-200 bg-green-50/40 px-3 py-2 text-[11px] text-green-900 leading-snug space-y-0.5">
                  {plan.steps.map((step, i) => (
                    <div key={i} className="flex gap-3 font-mono">
                      <span className="w-32 flex-shrink-0 text-gray-500">
                        {formatDateIT(step.startDate)} – {formatDateIT(step.endDate)}
                      </span>
                      <span className="font-bold w-16 flex-shrink-0">{step.dose} mg</span>
                      <span className="text-gray-600">{step.tabletText}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={printPatientCard}
                    className="h-7 text-[10px] gap-1.5 bg-green-700 hover:bg-green-800 text-white"
                  >
                    <Printer className="w-3 h-3" /> Apri scheda paziente
                  </Button>
                  <span className="text-[9px] text-gray-400 leading-snug">
                    Si apre una scheda modificabile — testi, righe e avvertenze editabili prima di stampare
                  </span>
                </div>
              </div>
            )}

          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-gray-100 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
