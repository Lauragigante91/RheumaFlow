/**
 * BiologicCalendarModal
 *
 * Generates a biologic injection calendar (induction + maintenance).
 * Output A: short synthetic text for the medical report.
 * Output B: editable print-ready patient card (same pattern as SteroidTaperingModal).
 *
 * Props:
 *   open           boolean
 *   onClose        () => void
 *   initialDrug    string  — pre-filled drug name
 *   visitDate      string  — ISO (default: today)
 *   onAppendToPlan (text) => void
 */

import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Printer, Copy, ClipboardList, Calendar } from "lucide-react";
import { toast } from "sonner";
import ItalianDatePicker from "../shared/ItalianDatePicker";
import {
  generateBiologicCalendar,
  formatBiologicSyntheticText,
  formatDateIT,
  formatIntervalShort,
  formatIntervalLabel,
  parseWeeks,
  extractBiologicDefaults,
} from "../../lib/biologicCalendar";
import { findDrug, INDICATIONS } from "../../lib/drugs";

const ROUTES = ["s.c.", "e.v.", "i.m.", "orale"];

const DURATION_OPTIONS = [
  { value: "3",      label: "3 mesi" },
  { value: "6",      label: "6 mesi" },
  { value: "12",     label: "12 mesi" },
  { value: "custom", label: "Data fine personalizzata" },
];

const INTERVAL_PRESETS = [
  { days: 7,  label: "7 gg – settimanale" },
  { days: 14, label: "14 gg – ogni 2 sett." },
  { days: 21, label: "21 gg – ogni 3 sett." },
  { days: 28, label: "28 gg – ogni 4 sett." },
  { days: 42, label: "42 gg – ogni 6 sett." },
  { days: 56, label: "56 gg – ogni 8 sett." },
];

export default function BiologicCalendarModal({
  open,
  onClose,
  initialDrug = "",
  initialRegimen = null,
  visitDate,
  onAppendToPlan,
}) {
  const [drugName,          setDrugName]          = useState(initialDrug || "");
  const [route,             setRoute]             = useState("s.c.");
  const [firstDoseDate,     setFirstDoseDate]     = useState(visitDate || new Date().toISOString().slice(0, 10));
  const [hasInduction,      setHasInduction]      = useState(false);
  const [inductionWeeksRaw, setInductionWeeksRaw] = useState("");
  const [inductionDose,     setInductionDose]     = useState("");
  const [maintenanceDays,   setMaintenanceDays]   = useState("28");
  const [maintenanceDose,   setMaintenanceDose]   = useState("");
  const [duration,          setDuration]          = useState("6");
  const [customEndDate,     setCustomEndDate]     = useState("");
  const [patientNote,       setPatientNote]       = useState("");
  const [activeRegimenIdx,  setActiveRegimenIdx]  = useState(null);

  // Apply defaults from a single regimen object
  function applyRegimenDefaults(regimen, entry) {
    const defs = extractBiologicDefaults(entry, regimen);
    if (defs) {
      setRoute(defs.route);
      setHasInduction(defs.hasInduction);
      setInductionWeeksRaw(defs.inductionWeeksRaw);
      setInductionDose(defs.inductionDose);
      setMaintenanceDays(defs.maintenanceDays);
      setMaintenanceDose(defs.maintenanceDose);
    }
  }

  React.useEffect(() => {
    if (open) {
      const name = initialDrug || "";
      setDrugName(name);
      setFirstDoseDate(visitDate || new Date().toISOString().slice(0, 10));
      setPatientNote("");
      setDuration("6");
      setCustomEndDate("");

      const entry = name ? findDrug(name) : null;

      // Determine which regimen to use (prefer the one already selected in QuickTherapyModal)
      let targetRegimen = null;
      let targetIdx = null;

      if (initialRegimen && entry?.regimens) {
        // Find the matching index by reference or by indication+dose
        const idx = entry.regimens.findIndex(r =>
          r === initialRegimen ||
          (r.indication === initialRegimen.indication && r.dose === initialRegimen.dose && r.route === initialRegimen.route),
        );
        if (idx !== -1) {
          targetIdx = idx;
          targetRegimen = entry.regimens[idx];
        }
      }

      if (!targetRegimen && entry?.regimens) {
        // Fall back to first regimen with a schedule
        const idx = entry.regimens.findIndex(r => r.schedule?.phases?.length > 0);
        targetIdx = idx !== -1 ? idx : 0;
        targetRegimen = entry.regimens[targetIdx] || null;
      }

      setActiveRegimenIdx(targetIdx);
      applyRegimenDefaults(targetRegimen, entry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDrug, initialRegimen, visitDate]);

  const inductionWeeks = useMemo(() => parseWeeks(inductionWeeksRaw), [inductionWeeksRaw]);

  const config = useMemo(() => ({
    drugName,
    route,
    firstDoseDate,
    hasInduction,
    inductionWeeks,
    inductionDose,
    maintenanceIntervalDays: parseInt(maintenanceDays) || 14,
    maintenanceDose,
    durationMonths: duration !== "custom" ? parseInt(duration) : null,
    customEndDate:  duration === "custom" ? customEndDate : null,
    patientNote,
  }), [drugName, route, firstDoseDate, hasInduction, inductionWeeks, inductionDose,
      maintenanceDays, maintenanceDose, duration, customEndDate, patientNote]);

  const entries = useMemo(() => {
    if (!config.firstDoseDate) return [];
    if (config.durationMonths === null && !config.customEndDate) return [];
    return generateBiologicCalendar(config);
  }, [config]);

  const syntheticText = useMemo(() => {
    if (!config.drugName?.trim()) return "";
    return formatBiologicSyntheticText(config);
  }, [config]);

  function copySynthetic() {
    if (!syntheticText) return;
    navigator.clipboard.writeText(syntheticText).then(
      () => toast.success("Testo copiato"),
      () => toast.error("Copia non riuscita"),
    );
  }

  function appendToReport() {
    if (!syntheticText) return;
    onAppendToPlan?.(syntheticText);
    toast.success("Testo aggiunto a §10 – Terapia del referto");
  }

  function printPatientCard() {
    if (!entries.length) return;
    const todayStr = formatDateIT(new Date().toISOString().slice(0, 10));
    const firstDate = formatDateIT(firstDoseDate);
    const lastDate  = entries.length ? formatDateIT(entries[entries.length - 1].date) : "";
    const intLabel  = formatIntervalShort(parseInt(maintenanceDays) || 14);

    const rows = entries.map(e => {
      const dow = new Date(e.date + "T00:00:00").toLocaleDateString("it-IT", { weekday: "short" });
      return `<tr>
      <td class="date" contenteditable="true">${formatDateIT(e.date)}</td>
      <td class="date-dow no-print-col">${dow}</td>
      <td class="phase ${e.phase === "Induzione" ? "ind" : "mnt"}" contenteditable="true">${e.phase}</td>
      <td contenteditable="true">${e.dose}</td>
      <td class="check">&#9744;</td>
      <td class="no-print del-col"><button class="del-btn" onclick="this.closest('tr').remove()">&#x2715;</button></td>
    </tr>`;
    }).join("\n");

    const inductionSummary = (hasInduction && inductionWeeks.length > 0)
      ? `Induzione: ${inductionDose} alle settimane ${inductionWeeks.join(", ")}` : "";
    const maintenanceSummary = `Mantenimento: ${maintenanceDose} ogni ${intLabel}`;

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>Calendario somministrazioni — ${drugName}</title>
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
    h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 4px 0; border-bottom: 3px solid #111; padding-bottom: 8px; }
    .subtitle { font-size: 12px; color: #666; margin-bottom: 18px; }
    .info-box { background: #f4f4f4; border-left: 5px solid #333; padding: 12px 14px; margin-bottom: 20px; border-radius: 0 4px 4px 0; }
    .info-row { margin-bottom: 6px; font-size: 14px; display: flex; align-items: baseline; gap: 6px; }
    .info-row strong { display: inline-block; min-width: 160px; flex-shrink: 0; }
    .patient-name-val { font-weight: 700; font-size: 15px; }
    [contenteditable] { outline: none; border-radius: 3px; }
    [contenteditable]:hover { background: rgba(245, 158, 11, 0.09); }
    [contenteditable]:focus { background: rgba(245, 158, 11, 0.15); outline: 2px dashed #f59e0b; outline-offset: 2px; }
    .info-box span[contenteditable] { display: inline-block; min-width: 4px; }
    [contenteditable][data-ph]:empty::before { content: attr(data-ph); color: #bbb; font-style: italic; font-weight: normal; pointer-events: none; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 13px; table-layout: fixed; }
    thead tr { background: #222; color: #fff; }
    th { padding: 9px 10px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; }
    th.col-date  { width: 92px; }
    th.col-dow   { width: 42px; font-size: 10px; }
    th.col-phase { width: 110px; }
    th.col-dose  { width: auto; }
    th.col-fatto { width: 58px; text-align: center; }
    td { padding: 9px 10px; border-bottom: 1px solid #ddd; vertical-align: middle; overflow: hidden; }
    tr:nth-child(even) td { background: #f9f9f9; }
    td.date { white-space: nowrap; font-size: 13px; }
    td.date-dow { font-size: 11px; color: #888; white-space: nowrap; }
    td.phase { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
    td.phase.ind { color: #c2410c; }
    td.phase.mnt { color: #166534; }
    td.check { text-align: center; font-size: 18px; color: #aaa; }
    td.del-col { text-align: center; width: 38px; }
    .del-btn { background: none; border: 1px solid #e0e0e0; border-radius: 4px; color: #c00; cursor: pointer; font-size: 14px; padding: 2px 6px; line-height: 1; }
    .del-btn:hover { background: #fee2e2; border-color: #c00; }
    .warnings { border: 2.5px solid #c00; border-radius: 6px; padding: 14px 18px; margin-top: 4px; page-break-inside: avoid; }
    .warnings h3 { color: #c00; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px; }
    .warnings ul { margin: 0; padding: 0 0 0 20px; }
    .warnings li { margin-bottom: 7px; font-size: 14px; font-weight: 600; line-height: 1.4; }
    .footer { margin-top: 20px; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; text-align: center; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .no-print-col { display: none !important; }
      [contenteditable]:hover, [contenteditable]:focus { background: transparent !important; outline: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <p>&#9998;&nbsp; Clicca su qualsiasi testo per modificarlo &nbsp;&#183;&nbsp; usa <strong>&#x2715;</strong> per eliminare righe &nbsp;&#183;&nbsp; inserisci il nome del paziente nel campo apposito</p>
    <button class="print-btn" onclick="window.print()">&#128424;&nbsp; Stampa / Salva PDF</button>
  </div>

  <h1>Calendario somministrazioni</h1>
  <p class="subtitle">Schema da consegnare al paziente / caregiver &mdash; leggere attentamente</p>

  <div class="info-box">
    <div class="info-row">
      <strong>Paziente:</strong>
      <span class="patient-name-val" contenteditable="true" data-ph="&mdash; inserire nome o iniziali &mdash;"></span>
    </div>
    <div class="info-row"><strong>Farmaco:</strong> <span contenteditable="true">${drugName}</span></div>
    <div class="info-row"><strong>Via:</strong> <span contenteditable="true">${route}</span></div>
    <div class="info-row"><strong>Prima somministrazione:</strong> <span contenteditable="true">${firstDate}</span></div>
    ${inductionSummary ? `<div class="info-row"><strong>Induzione:</strong> <span contenteditable="true">${inductionSummary}</span></div>` : ""}
    <div class="info-row"><strong>Mantenimento:</strong> <span contenteditable="true">${maintenanceSummary}</span></div>
    <div class="info-row"><strong>Periodo coperto:</strong> <span contenteditable="true">${firstDate} &ndash; ${lastDate}</span></div>
    <div class="info-row">
      <strong>Note aggiuntive:</strong>
      <span contenteditable="true" data-ph="Clicca per aggiungere note specifiche per questo paziente&hellip;">${patientNote || ""}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-date">Data</th>
        <th class="col-dow no-print-col">Gg</th>
        <th class="col-phase">Fase</th>
        <th class="col-dose">Dose</th>
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
      <li contenteditable="true">Non saltare le somministrazioni senza consultare il medico.</li>
      <li contenteditable="true">In caso di febbre, infezione, intervento chirurgico o procedure invasive: contattare il medico prima di procedere con la somministrazione.</li>
      <li contenteditable="true">Conservare il farmaco in frigorifero (2&ndash;8 &deg;C) salvo diversa indicazione del foglietto illustrativo.</li>
      <li contenteditable="true">Portare sempre con sé il foglio delle somministrazioni alle visite di controllo.</li>
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

  if (!open) return null;

  const hasValidPlan = entries.length > 0 && !!drugName.trim();

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0" style={{ maxHeight: "92vh" }}>
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-gray-100 bg-gray-50/60 flex-shrink-0">
          <DialogTitle className="font-heading font-bold text-base tracking-tight flex items-center gap-2">
            <span style={{ fontSize: "18px" }}>💉</span>
            Calendario somministrazioni biologico
          </DialogTitle>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Genera il calendario di induzione e mantenimento con scheda stampabile per il paziente
          </p>
        </DialogHeader>

        <div className="flex overflow-hidden" style={{ maxHeight: "calc(92vh - 90px)" }}>

          {/* ─── Left panel: form ────────────────────────────────────────── */}
          <div className="w-[360px] flex-shrink-0 overflow-y-auto border-r border-gray-100 px-5 py-4 space-y-4">

            {/* Farmaco + via */}
            <div className="space-y-1">
              <Label className="text-xs">Farmaco *</Label>
              <Input
                value={drugName}
                onChange={e => setDrugName(e.target.value)}
                placeholder="es. Certolizumab pegol"
                className="text-xs h-8"
                autoFocus
              />
            </div>

            {/* Regimen / indication selector — only when drug has multiple regimens */}
            {(() => {
              const entry = drugName.trim() ? findDrug(drugName.trim()) : null;
              if (!entry?.regimens || entry.regimens.length < 2) return null;
              return (
                <div className="space-y-1.5">
                  <Label className="text-xs">Indicazione / schema</Label>
                  <div className="flex flex-col gap-1">
                    {entry.regimens.map((reg, idx) => {
                      const indLabel = INDICATIONS[reg.indication] || reg.indication;
                      const isActive = activeRegimenIdx === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setActiveRegimenIdx(idx);
                            applyRegimenDefaults(reg, entry);
                          }}
                          style={{
                            textAlign: "left",
                            padding: "5px 10px",
                            borderRadius: "7px",
                            fontSize: "11px",
                            fontWeight: isActive ? 700 : 500,
                            border: isActive ? "2px solid #0A2540" : "1.5px solid #e5e7eb",
                            background: isActive ? "#0A2540" : "#fff",
                            color: isActive ? "#fff" : "#374151",
                            cursor: "pointer",
                            transition: "all 0.12s",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span style={{ flex: 1 }}>{indLabel}</span>
                          <span style={{
                            fontSize: "9px",
                            fontWeight: 600,
                            opacity: 0.7,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}>
                            {reg.dose} · {reg.route?.split(/[,\s]+o\s+/)[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Via</Label>
                <select
                  value={route}
                  onChange={e => setRoute(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data prima dose</Label>
                <ItalianDatePicker value={firstDoseDate} onChange={setFirstDoseDate} />
              </div>
            </div>

            {/* Induction */}
            <div className="rounded-md border border-orange-200 bg-orange-50/50 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-orange-800">
                  Schema di induzione
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasInduction}
                    onChange={e => setHasInduction(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-[11px] text-orange-800">{hasInduction ? "attivo" : "nessuna induzione"}</span>
                </label>
              </div>

              {hasInduction && (
                <>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-orange-800">Settimane somministrazione</Label>
                    <Input
                      value={inductionWeeksRaw}
                      onChange={e => setInductionWeeksRaw(e.target.value)}
                      placeholder="es. 0, 2, 4"
                      className="text-xs h-7 bg-white"
                    />
                    {inductionWeeks.length > 0 && (
                      <p className="text-[10px] text-orange-700">
                        {inductionWeeks.length} somministrazioni: settimane {inductionWeeks.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-orange-800">Dose induzione</Label>
                    <Input
                      value={inductionDose}
                      onChange={e => setInductionDose(e.target.value)}
                      placeholder="es. 400 mg"
                      className="text-xs h-7 bg-white"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Maintenance */}
            <div className="rounded-md border border-green-200 bg-green-50/50 p-3 space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-green-800">
                Schema di mantenimento
              </span>
              <div className="space-y-1">
                <Label className="text-[10px] text-green-800">Intervallo (giorni)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={maintenanceDays}
                    onChange={e => setMaintenanceDays(e.target.value)}
                    className="text-xs h-7 bg-white w-20"
                  />
                  <span className="text-[10px] text-green-700 flex-1">
                    {formatIntervalLabel(parseInt(maintenanceDays) || 14)}
                  </span>
                </div>
                {/* Quick presets */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {INTERVAL_PRESETS.map(p => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setMaintenanceDays(String(p.days))}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                        parseInt(maintenanceDays) === p.days
                          ? "bg-green-700 text-white border-green-700"
                          : "bg-white text-green-800 border-green-300 hover:bg-green-100"
                      }`}
                    >
                      {p.days}gg
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-green-800">Dose mantenimento</Label>
                <Input
                  value={maintenanceDose}
                  onChange={e => setMaintenanceDose(e.target.value)}
                  placeholder="es. 200 mg"
                  className="text-xs h-7 bg-white"
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <Label className="text-xs">Durata piano terapeutico</Label>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDuration(opt.value)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                      duration === opt.value
                        ? "bg-[#0A2540] text-white border-[#0A2540]"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {duration === "custom" && (
                <ItalianDatePicker value={customEndDate} onChange={setCustomEndDate} />
              )}
            </div>

            {/* Patient note */}
            <div className="space-y-1">
              <Label className="text-xs">Note per il paziente (opzionale)</Label>
              <Textarea
                value={patientNote}
                onChange={e => setPatientNote(e.target.value)}
                placeholder="es. Conservare in frigorifero. Portare ad ogni visita."
                rows={2}
                className="text-xs resize-none"
              />
            </div>

          </div>

          {/* ─── Right panel: output ─────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-gray-50/40">

            {!hasValidPlan && (
              <div className="flex items-center justify-center h-40 text-[12px] text-gray-400 text-center leading-relaxed">
                Compila i campi a sinistra —<br/>il calendario si aggiorna in automatico
              </div>
            )}

            {hasValidPlan && (
              <>
                {/* Output A: synthetic text */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 flex items-center gap-1.5">
                    <ClipboardList className="w-3 h-3" /> Testo per referto
                  </div>
                  <div className="rounded-md border border-blue-200 bg-blue-50/40 px-3 py-2.5 text-[12px] text-blue-900 leading-relaxed">
                    {syntheticText}
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={copySynthetic} className="h-7 text-[10px] gap-1">
                      <Copy className="w-3 h-3" /> Copia testo
                    </Button>
                    {onAppendToPlan && (
                      <Button size="sm" onClick={appendToReport} className="h-7 text-[10px] gap-1 bg-[#0A2540] hover:bg-[#051626] text-white">
                        <ClipboardList className="w-3 h-3" /> Aggiungi a §10 Terapia
                      </Button>
                    )}
                  </div>
                </div>

                {/* Output B: calendar preview + print */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Calendario ({entries.length} somministrazioni)
                  </div>

                  {/* Compact preview */}
                  <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-[11px] leading-snug space-y-0.5 max-h-72 overflow-y-auto">
                    {entries.map((e, i) => (
                      <div key={i} className="flex gap-3 font-mono">
                        <span className="w-20 flex-shrink-0 text-gray-500">{formatDateIT(e.date)}</span>
                        <span
                          className={`w-24 flex-shrink-0 font-bold text-[10px] uppercase tracking-wide ${
                            e.phase === "Induzione" ? "text-orange-700" : "text-green-700"
                          }`}
                        >
                          {e.phase}
                        </span>
                        <span className="text-gray-700">{e.dose}</span>
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
                      Scheda modificabile — testi e righe editabili prima di stampare
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
