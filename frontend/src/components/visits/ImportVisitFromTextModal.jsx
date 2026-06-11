/**
 * ImportVisitFromTextModal.jsx
 *
 * Paste-and-parse modal for importing historical visits from free text / PDF.
 * Runs four parsers: clinimetry · lab values · joint exam · therapy events.
 * All results are shown with checkboxes + edit fields before any save happens.
 */

import React, { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import {
  FileText, FlaskConical, ClipboardList, CheckSquare, Square,
  Loader2, ChevronRight, AlertTriangle, Activity, Pill,
  Search, Plus, X, PenLine, ScanSearch, ChevronDown, Calendar as CalendarIcon,
} from "lucide-react";
import { parseClinimetryFromText, IMPORTABLE_INDICES } from "../../lib/clinimetryTextParser";
import { extractLabValues, extractLabValuesByDate, LAB_CATALOG } from "../../lib/labValueExtractor";
import { parseJointExam } from "../../lib/jointExamParser";
import { parseTherapyEvents, ACTION_COLORS } from "../../lib/therapyEventParser";
import { parseInstrumentalFindings } from "../../lib/instrumentalParser";
import { assessmentsApi, instrumentalExamsApi, labExamsApi, therapiesApi } from "../../lib/api";
import SelectableTextBlock from "../shared/SelectableTextBlock";
import Homunculus, { countTender, countSwollen, getTenderKeys, getSwollenKeys } from "../imaging/Homunculus";
import {
  interpretDAS28, interpretCDAI, interpretSDAI,
  interpretBASDAI, interpretASDAS, interpretDAPSA, interpretSLEDAI,
  interpretHAQ, interpretPASI, interpretBASFI, interpretBASMI,
  interpretESSDAI, interpretESSPRI, interpretBVAS, interpretMMT8,
  interpretFIQR, interpretMRSS,
} from "../../lib/clinimetrics";

// ── Interpretation router ─────────────────────────────────────────────────────
const INTERPRET_MAP = {
  das28_crp: interpretDAS28, das28_esr: interpretDAS28,
  cdai: interpretCDAI,       sdai: interpretSDAI,
  basdai: interpretBASDAI,   asdas_crp: interpretASDAS,
  basfi: interpretBASFI,     basmi: interpretBASMI,
  dapsa: interpretDAPSA,     pasi: interpretPASI,
  sledai: interpretSLEDAI,   haq: interpretHAQ,
  essdai: interpretESSDAI,   esspri: interpretESSPRI,
  bvas: interpretBVAS,       mmt8: interpretMMT8,
  fiqr: interpretFIQR,       mrss: interpretMRSS,
};
function interpretFor(type, score) {
  const fn = INTERPRET_MAP[type];
  if (!fn || score == null) return null;
  try { return fn(score); } catch { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const colors = { high: "bg-red-400", low: "bg-blue-400", normal: "bg-green-400" };
  if (!status) return null;
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[status] || "bg-gray-300"}`} />;
}

function SectionHeader({ icon: Icon, color, title, count }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <span className={`text-xs font-bold uppercase tracking-widest ${color.replace("text-", "text-").replace("-500", "-700").replace("-400", "-700")}`}>
        {title} — {count} {count === 1 ? "elemento" : "elementi"} rilevati
      </span>
    </div>
  );
}

// ── Category label helper ────────────────────────────────────────────────────
const CAT_LABELS = {
  csDMARD: "csDMARD", bDMARD: "bDMARD", tsDMARD: "tsDMARD",
  glucocorticoid: "GC", NSAID: "FANS", supportive: "Sup.", other: "Altro",
};

// ── Main component ────────────────────────────────────────────────────────────
export default function ImportVisitFromTextModal({ open, onClose, patientId, patient, onSaved, initialText, initialDate }) {
  const [text, setText]     = useState("");
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));

  const [notes, setNotes]   = useState("");
  const [phase, setPhase]   = useState("input");
  const [saving, setSaving] = useState(false);

  // Clinimetria + lab (existing)
  const [clinItems, setClinItems] = useState([]);
  const [clinComps, setClinComps] = useState([]); // comparative snippets, informational only
  const [labItems,  setLabItems]  = useState([]);
  // Date groups for multi-date lab import: [{date, displayDate, editDate}]
  const [labGroups, setLabGroups] = useState([]);

  // Joint exam
  const [jointData,    setJointData]    = useState(null);   // { joints, tjc, sjc }
  const [jointEnabled, setJointEnabled] = useState(false);

  // Therapy events
  const [therapyEvents, setTherapyEvents] = useState([]);

  // Instrumental findings
  const [instrItems, setInstrItems] = useState([]);
  const [showOriginalText, setShowOriginalText] = useState(false);

  // Lab manual-add search
  const [labSearchOpen, setLabSearchOpen] = useState(false);
  const [labQuery,      setLabQuery]      = useState("");

  // Quando aperto con testo pre-caricato da PDF, pre-compila testo e data
  useEffect(() => {
    if (open && initialText) {
      // ── LOG ④ valorizzazione initialText/initialDate ─────────────────────
      console.log("[PDF-IMPORT] ④ ImportVisitFromTextModal useEffect →", {
        textLength: initialText.length,
        initialDate,
        textPreview: initialText.slice(0, 200),
      });
      setText(initialText);
      setDate(initialDate || new Date().toISOString().slice(0, 10));
      setPhase("input");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    setText(""); setDate(new Date().toISOString().slice(0, 10));
    setNotes(""); setPhase("input"); setSaving(false);
    setClinItems([]); setClinComps([]); setLabItems([]); setLabGroups([]);
    setJointData(null); setJointEnabled(false);
    setTherapyEvents([]);
    setInstrItems([]); setShowOriginalText(false);
    setLabSearchOpen(false); setLabQuery("");
    onClose();
  };

  // ── Analyse ───────────────────────────────────────────────────────────────
  const handleAnalyse = useCallback(() => {
    if (!text.trim()) { toast.error("Incolla prima il testo della visita"); return; }

    const { items: parsedClin, comparatives: parsedComps } = parseClinimetryFromText(text);
    const clin = parsedClin.map(item => ({
      ...item, selected: true, editScore: String(item.score), editType: item.index_type,
    }));
    const rawGroups = extractLabValuesByDate(text);
    const grps = rawGroups.map(g => ({ date: g.date, displayDate: g.displayDate, editDate: g.date || date }));
    const labs = [];
    rawGroups.forEach((g, gi) => {
      g.items.forEach(item => {
        labs.push({ ...item, selected: true, editValue: String(item.normalizedValue ?? item.value), groupIdx: gi });
      });
    });
    setLabGroups(grps);

    // Joint exam
    const joint = parseJointExam(text);

    // Therapy events
    const rawTherapy = parseTherapyEvents(text);
    const therapy = rawTherapy.map(ev => ({
      ...ev,
      selected: true,
      editDrug:   ev.drug_name,
      editDose:   ev.dose || "",
      editFreq:   ev.frequency || "",
      editRoute:  ev.route || "",
      editReason: ev.reason || "",
    }));

    // Instrumental findings
    const instrRaw = parseInstrumentalFindings(text);
    const instr = instrRaw.map(it => ({
      ...it,
      selected: true,
      editExamType:  it.examType,
      editTerritory: it.territory || "",
      editReport:    it.reportText || "",
      editDate:      it.date || date,
    }));

    const totalFound = clin.length + labs.length + (joint.found ? 1 : 0) + therapy.length + instr.length;
    if (totalFound === 0) {
      toast.info("Nessun valore riconosciuto nel testo.");
      return;
    }

    // ── LOG ⑤ payload handleAnalyse ─────────────────────────────────────────
    console.log("[PDF-IMPORT] ⑤ handleAnalyse payload →", {
      clinimetria:  clin.map(c  => ({ type: c.index_type, score: c.score })),
      laboratorio:  labs.map(l  => ({ key: l.key || l.param_key, value: l.normalizedValue ?? l.value, unit: l.normalizedUnit || l.unit, group: l.groupIdx })),
      farmaci:      therapy.map(t => ({ drug: t.drug_name, event: t.event_type, dose: t.dose })),
      strumentali:  instr.map(i => ({ examType: i.examType, territory: i.territory, date: i.date })),
      joint:        joint.found ? { tjc: joint.tjc, sjc: joint.sjc } : null,
      totalFound,
    });
    setClinItems(clin);
    setClinComps(parsedComps);
    setLabItems(labs);
    setJointData(joint.found ? joint : null);
    setJointEnabled(joint.found);
    setTherapyEvents(therapy);
    setInstrItems(instr);
    setPhase("review");
  }, [text, date]);

  // ── Patch helpers ─────────────────────────────────────────────────────────
  const toggleClin   = (i) => setClinItems(p => p.map((it, idx) => idx === i ? { ...it, selected: !it.selected } : it));
  const patchClin    = (i, f, v) => setClinItems(p => p.map((it, idx) => idx === i ? { ...it, [f]: v } : it));
  const toggleLab    = (i) => setLabItems(p => p.map((it, idx) => idx === i ? { ...it, selected: !it.selected } : it));
  const patchLab     = (i, f, v) => setLabItems(p => p.map((it, idx) => idx === i ? { ...it, [f]: v } : it));
  const removeLabItem = (i) => setLabItems(p => p.filter((_, idx) => idx !== i));

  const addLabItem = (param) => {
    const groupIdx = Math.max(0, labGroups.length - 1);
    setLabItems(p => [...p, {
      key:             param.key,
      label:           param.label,
      panel:           param.panel,
      unit:            param.defaultUnit,
      normalizedUnit:  param.defaultUnit,
      value:           null,
      normalizedValue: null,
      status:          null,
      sourceText:      "",
      selected:        true,
      editValue:       "",
      editUnit:        param.defaultUnit,
      editLabel:       param.label,
      manual:          true,
      custom:          false,
      groupIdx,
    }]);
    setLabQuery("");
  };

  const addCustomLabItem = (name) => {
    const groupIdx = Math.max(0, labGroups.length - 1);
    setLabItems(p => [...p, {
      key:             `custom_${Date.now()}`,
      label:           name,
      panel:           "custom",
      unit:            "",
      normalizedUnit:  "",
      value:           null,
      normalizedValue: null,
      status:          null,
      sourceText:      "",
      selected:        true,
      editValue:       "",
      editUnit:        "",
      editLabel:       name,
      manual:          true,
      custom:          true,
      groupIdx,
    }]);
    setLabQuery("");
  };
  const toggleTherapy = (i) => setTherapyEvents(p => p.map((it, idx) => idx === i ? { ...it, selected: !it.selected } : it));
  const patchTherapy  = (i, f, v) => setTherapyEvents(p => p.map((it, idx) => idx === i ? { ...it, [f]: v } : it));
  const toggleInstr   = (i) => setInstrItems(p => p.map((it, idx) => idx === i ? { ...it, selected: !it.selected } : it));
  const patchInstr    = (i, f, v) => setInstrItems(p => p.map((it, idx) => idx === i ? { ...it, [f]: v } : it));

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!patientId) return;
    // ── LOG ⑥ payload handleSave (Conferma importazione) ────────────────────
    console.log("[PDF-IMPORT] ⑥ handleSave → items selezionati:", {
      clinimetria:  clinItems.filter(it => it.selected).map(it => ({ type: it.editType, score: it.editScore })),
      laboratorio:  labItems.filter(it => it.selected).map(it => ({ key: it.key, value: it.editValue, unit: it.normalizedUnit || it.unit, date: labGroups[it.groupIdx]?.editDate })),
      farmaci:      therapyEvents.filter(it => it.selected).map(it => ({ drug: it.editDrug, event: it.event_type, dose: it.editDose })),
      strumentali:  instrItems.filter(it => it.selected).map(it => ({ examType: it.editExamType, territory: it.editTerritory, date: it.editDate })),
      visitDate: date,
      patientId,
    });
    setSaving(true);
    let saved = 0;
    try {
      // Clinimetria
      for (const it of clinItems.filter(it => it.selected)) {
        const score = parseFloat(it.editScore);
        if (isNaN(score)) continue;
        await assessmentsApi.create({
          patient_id:     patientId,
          index_type:     it.editType,
          date,
          score,
          interpretation: interpretFor(it.editType, score),
          inputs:         { imported: true, source_text: it.raw_match },
          notes:          notes || `Importato da testo — "${it.raw_match}"`,
        });
        saved++;
      }

      // Laboratorio — usa la data del gruppo se presente, altrimenti la data visita
      const showGrouped = labGroups.length > 1 || (labGroups.length === 1 && labGroups[0].date !== null);
      for (const it of labItems.filter(it => it.selected)) {
        const val = parseFloat(it.editValue);
        if (isNaN(val)) continue;
        const resolvedLabel = it.custom ? (it.editLabel?.trim() || it.label) : it.label;
        const resolvedUnit  = it.manual  ? (it.editUnit  ?? it.normalizedUnit ?? it.unit)
                                         : (it.normalizedUnit || it.unit);
        const resolvedKey   = it.custom  ? resolvedLabel.toLowerCase().replace(/\s+/g, "_").slice(0, 40)
                                         : it.key;
        const saveDate = showGrouped
          ? (labGroups[it.groupIdx]?.editDate || date)
          : date;
        await labExamsApi.create({
          patient_id: patientId,
          date: saveDate,
          panel:  it.panel || "custom",
          values: {
            [resolvedKey]: {
              value:  val,
              unit:   resolvedUnit,
              status: it.status || "normal",
              notes:  it.manual ? "Aggiunto manualmente" : `Importato da testo: "${it.sourceText}"`,
            },
          },
          notes: notes || (it.manual ? `Aggiunto manualmente — ${resolvedLabel}` : `Importato da testo — ${resolvedLabel}`),
        });
        saved++;
      }

      // Esame articolare
      if (jointEnabled && jointData) {
        const j = jointData.joints;
        const tjc = countTender(j);
        const sjc = countSwollen(j);
        await assessmentsApi.create({
          patient_id:    patientId,
          index_type:    "joint_exam",
          date,
          score:         tjc,
          interpretation: `TJ ${tjc} · SJ ${sjc}`,
          tender_joints: getTenderKeys(j),
          swollen_joints: getSwollenKeys(j),
          inputs:        { tjc, sjc, imported: true },
          notes:         notes || `Esame articolare importato da testo`,
        });
        saved++;
      }

      // Modifiche terapeutiche
      for (const it of therapyEvents.filter(it => it.selected)) {
        const payload = {
          patient_id:              patientId,
          drug_name:               it.editDrug || it.drug_name,
          category:                it.category || "other",
          dose:                    it.editDose || "",
          frequency:               it.editFreq || "",
          route:                   it.editRoute || "",
          start_date:              date,
          status:                  it.status,
          notes:                   notes
            ? `${notes} | ${it.source_text}`
            : `Importato da testo (${it.label}): "${it.source_text}"`,
        };
        if (it.status === "discontinued") {
          payload.end_date = date;
          payload.discontinuation_reason = it.editReason || "";
        }
        await therapiesApi.create(payload);
        saved++;
      }

      // Esami strumentali
      for (const it of instrItems.filter(it => it.selected)) {
        await instrumentalExamsApi.create({
          patient_id:        patientId,
          exam_date:         it.editDate || date,
          exam_type:         it.editExamType || "imaging_report",
          territory:         it.editTerritory || null,
          result:            null,
          summary:           it.editReport || "",
          source_text:       it.editReport || it.raw || null,
          structured_values: null,
        });
        saved++;
      }

      toast.success(`${saved} ${saved === 1 ? "elemento salvato" : "elementi salvati"} per il ${date.split("-").reverse().join("/")}`);
      onSaved?.();
      handleClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  // ── Computed totals ───────────────────────────────────────────────────────
  const selectedCount =
    clinItems.filter(i => i.selected).length +
    labItems.filter(i => i.selected).length +
    (jointEnabled && jointData ? 1 : 0) +
    therapyEvents.filter(i => i.selected).length +
    instrItems.filter(i => i.selected).length;

  // Catalog filtered by search query (used by the lab manual-add widget)
  const filteredCatalog = labQuery.trim().length < 2
    ? LAB_CATALOG
    : LAB_CATALOG.filter(p => {
        const q = labQuery.trim().toLowerCase();
        return p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q);
      });

  const showGroupedLabs =
    labGroups.length > 1 ||
    (labGroups.length === 1 && labGroups[0]?.date !== null);

  const renderLabRow = (it, i) => (
    <div
      key={`${it.key}_${i}`}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
        it.selected
          ? it.manual ? "border-teal-300 bg-teal-50/80" : "border-teal-200 bg-teal-50"
          : "border-gray-100 bg-gray-50 opacity-60"
      }`}
    >
      <button type="button" onClick={() => toggleLab(i)} className="flex-shrink-0 text-teal-600">
        {it.selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-gray-400" />}
      </button>
      {it.custom ? (
        <input type="text" value={it.editLabel} onChange={e => patchLab(i, "editLabel", e.target.value)}
          placeholder="Nome esame…" className="w-32 flex-shrink-0 font-semibold text-teal-700 border border-teal-200 rounded px-1 py-0.5 bg-white text-xs" />
      ) : (
        <span className="w-32 flex-shrink-0 font-semibold text-teal-700 truncate" title={it.label}>
          {it.label}
          {it.manual && <PenLine className="inline w-2.5 h-2.5 ml-1 text-teal-400 opacity-70" />}
        </span>
      )}
      <StatusDot status={it.status} />
      <div className="flex items-center gap-1 ml-auto">
        <input type="number" step="any" value={it.editValue}
          onChange={e => patchLab(i, "editValue", e.target.value)}
          className="w-20 text-right text-xs font-mono border border-teal-200 rounded px-1 py-0.5 bg-white" />
        {it.manual ? (
          <input type="text" value={it.editUnit} onChange={e => patchLab(i, "editUnit", e.target.value)}
            placeholder="unità" className="w-16 text-xs font-mono border border-teal-200 rounded px-1 py-0.5 bg-white text-gray-600" />
        ) : (
          <span className="w-14 text-[11px] text-gray-400">{it.normalizedUnit || it.unit}</span>
        )}
      </div>
      {it.manual ? (
        <button type="button" onClick={() => removeLabItem(i)}
          className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors" title="Rimuovi">
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        <span className="text-[10px] text-gray-400 italic truncate max-w-[120px]" title={it.sourceText}>
          "{it.sourceText}"
        </span>
      )}
    </div>
  );

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-lg tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Importa visita da testo
          </DialogTitle>
        </DialogHeader>

        {/* ── INPUT PHASE ─────────────────────────────────────────────── */}
        {phase === "input" && (
          <div className="space-y-4 pt-1">
            <p className="text-xs text-gray-500">
              Incolla il testo della visita (da PDF, referto, cartella precedente).
              Il sistema rileva indici clinimetrici, valori di laboratorio,
              esame articolare e modifiche terapeutiche.
            </p>

            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-gray-600 w-28 flex-shrink-0">Data visita</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-8 text-xs px-2 border border-gray-200 rounded-md bg-white"
              />
            </div>

            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={
                "Esempio:\n" +
                "DAS28-PCR 3.2 — CDAI 8 — VES 42 mm/h — PCR 18 mg/L\n" +
                "Dolorabilità: polso dx, MCP 2-3 dx. Sinovite: MCP 2 dx.\n" +
                "Si avvia Baricitinib 4 mg/die per risposta inadeguata a MTX.\n" +
                "Si riduce Prednisone a 5 mg/die. Prosecuzione MTX 15 mg/sett."
              }
              rows={12}
              className="text-sm font-mono resize-y"
            />

            <div className="flex items-start gap-3">
              <label className="text-xs font-semibold text-gray-600 w-28 flex-shrink-0 mt-1.5">Note (opz.)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Es: visita pre-ricovero, valutazione di consulenza…"
                className="flex-1 h-8 text-xs px-2 border border-gray-200 rounded-md bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={handleClose} className="text-xs h-8">Annulla</Button>
              <Button onClick={handleAnalyse} className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white">
                <ChevronRight className="w-3.5 h-3.5 mr-1" /> Analizza testo
              </Button>
            </div>
          </div>
        )}

        {/* ── REVIEW PHASE ────────────────────────────────────────────── */}
        {phase === "review" && (
          <div className="space-y-5 pt-1">
            {/* Sub-header */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Data: <span className="font-semibold text-gray-700">{date.split("-").reverse().join("/")}</span>
                {notes && <span className="ml-2 italic">— {notes}</span>}
              </div>
              <button type="button" onClick={() => setPhase("input")} className="text-xs text-blue-600 hover:underline">
                ← Modifica testo
              </button>
            </div>

            {/* ── Clinimetria ─────────────────────────────────────────── */}
            {clinItems.length > 0 && (
              <div>
                <SectionHeader icon={ClipboardList} color="text-indigo-500" title="Clinimetria" count={clinItems.length} />
                <div className="space-y-1.5">
                  {clinItems.map((it, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors ${
                        it.selected ? "border-indigo-200 bg-indigo-50" : "border-gray-100 bg-gray-50 opacity-60"
                      }`}
                    >
                      <button type="button" onClick={() => toggleClin(i)} className="flex-shrink-0 text-indigo-600">
                        {it.selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-gray-400" />}
                      </button>
                      <select
                        value={it.editType}
                        onChange={e => patchClin(i, "editType", e.target.value)}
                        className="text-xs font-semibold bg-transparent border-none focus:outline-none text-indigo-700 cursor-pointer"
                      >
                        {IMPORTABLE_INDICES.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1 ml-auto">
                        <input
                          type="number" step="0.01" value={it.editScore}
                          onChange={e => patchClin(i, "editScore", e.target.value)}
                          className="w-16 text-right text-xs font-mono border border-indigo-200 rounded px-1 py-0.5 bg-white"
                        />
                        {interpretFor(it.editType, parseFloat(it.editScore)) && (
                          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
                            {interpretFor(it.editType, parseFloat(it.editScore))}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 italic truncate max-w-[140px]" title={it.raw_match}>
                        "{it.raw_match}"
                      </span>
                      {it.ambiguous && (
                        <span title="Tipo ambiguo — verifica l'indice">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Valori comparativi ignorati ─────────────────────────── */}
            {clinComps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">
                    Valori comparativi ignorati ({clinComps.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {clinComps.map((c, i) => (
                    <span
                      key={i}
                      title="Valore storico/comparativo — non verrà importato"
                      className="text-[10px] italic text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5"
                    >
                      {c.raw_text}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Questi valori erano tra parentesi con indicatore comparativo (era / precedente / baseline / vs) e non verranno importati.
                </p>
              </div>
            )}

            {/* ── Laboratorio ─────────────────────────────────────────── */}
            <div>
              <SectionHeader icon={FlaskConical} color="text-teal-500" title="Laboratorio" count={labItems.length} />

              {labItems.length === 0 && !labSearchOpen && (
                <p className="text-xs text-gray-400 italic py-2 px-1">
                  Nessun esame rilevato automaticamente. Puoi aggiungerne uno qui sotto.
                </p>
              )}

              {labItems.length > 0 && showGroupedLabs && (
                <div className="space-y-3 mb-2">
                  {labGroups.map((group, gi) => {
                    const groupItems = labItems
                      .map((it, fi) => ({ ...it, _fi: fi }))
                      .filter(it => it.groupIdx === gi);
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={gi} className="border border-teal-200 rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 border-b border-teal-100">
                          <CalendarIcon className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                          <span className="text-[10px] font-semibold text-teal-600 mr-1">Data:</span>
                          <input
                            type="date"
                            value={group.editDate}
                            onChange={e => setLabGroups(prev => prev.map((g, idx) => idx === gi ? { ...g, editDate: e.target.value } : g))}
                            className="text-xs font-semibold text-teal-700 bg-transparent border-none focus:outline-none cursor-pointer"
                          />
                          <span className="text-[10px] text-teal-400 ml-1">— {groupItems.length} esam{groupItems.length === 1 ? "e" : "i"}</span>
                        </div>
                        <div className="space-y-1.5 p-2">
                          {groupItems.map(it => renderLabRow(it, it._fi))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {labItems.length > 0 && !showGroupedLabs && (
                <div className="space-y-1.5 mb-2">
                  {labItems.map((it, i) => renderLabRow(it, i))}
                </div>
              )}

              {/* ── Aggiungi esami non rilevati ─────────────────────────── */}
              <div className="mt-1">
                {!labSearchOpen ? (
                  <button
                    type="button"
                    onClick={() => setLabSearchOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-medium py-1 px-2 rounded hover:bg-teal-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi esame non rilevato
                  </button>
                ) : (
                  <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                      <input
                        type="text"
                        value={labQuery}
                        onChange={e => setLabQuery(e.target.value)}
                        placeholder="Cerca esame… (VES, creatinina, emoglobina, TSH…)"
                        autoFocus
                        className="flex-1 text-xs border border-teal-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-teal-400"
                      />
                      <button
                        type="button"
                        onClick={() => { setLabSearchOpen(false); setLabQuery(""); }}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="max-h-44 overflow-y-auto space-y-0.5">
                      {filteredCatalog.map(p => {
                        const alreadyAdded = labItems.some(it => it.key === p.key && !it.custom);
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => !alreadyAdded && addLabItem(p)}
                            className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs text-left transition-colors ${
                              alreadyAdded
                                ? "opacity-40 cursor-not-allowed text-gray-500"
                                : "hover:bg-teal-100 text-gray-700 cursor-pointer"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium truncate">{p.label}</span>
                              <span className="text-[10px] text-gray-400 bg-white border border-gray-200 px-1 rounded flex-shrink-0">
                                {p.panelLabel}
                              </span>
                              {alreadyAdded && (
                                <span className="text-[10px] text-teal-600 flex-shrink-0">✓ già aggiunto</span>
                              )}
                            </div>
                            <span className="text-gray-400 text-[10px] ml-2 flex-shrink-0">{p.defaultUnit}</span>
                          </button>
                        );
                      })}

                      {/* Freeform custom entry */}
                      {labQuery.trim().length >= 2 && (
                        <button
                          type="button"
                          onClick={() => addCustomLabItem(labQuery.trim())}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-amber-700 hover:bg-amber-50 border-t border-teal-100 mt-1 pt-2 text-left transition-colors"
                        >
                          <Plus className="w-3 h-3 text-amber-500 flex-shrink-0" />
                          <span>Aggiungi "<strong>{labQuery.trim()}</strong>" come esame personalizzato</span>
                        </button>
                      )}

                      {filteredCatalog.length === 0 && labQuery.trim().length < 2 && (
                        <p className="text-[10px] text-center text-gray-400 py-3">
                          Digita per cercare nel catalogo esami
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Esame articolare ────────────────────────────────────── */}
            {jointData && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setJointEnabled(v => !v)}
                    className={`flex-shrink-0 ${jointEnabled ? "text-rose-600" : "text-gray-400"}`}
                  >
                    {jointEnabled ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                  <Activity className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-rose-700">
                    Esame articolare — TJ {countTender(jointData.joints)} · SJ {countSwollen(jointData.joints)}
                  </span>
                </div>

                <div className={`rounded-xl border p-4 transition-opacity ${jointEnabled ? "border-rose-200 bg-rose-50" : "border-gray-100 bg-gray-50 opacity-50 pointer-events-none"}`}>
                  <p className="text-[10px] text-rose-600 mb-3">
                    Clicca sulle articolazioni per correggere il risultato del parser prima di salvare.
                    <span className="ml-2 font-semibold">Blu = dolente · Rosso = tumefatta · Viola = entrambe</span>
                  </p>
                  <Homunculus
                    mode="66_68"
                    joints={jointData.joints}
                    onChange={newJoints => setJointData(prev => ({ ...prev, joints: newJoints }))}
                  />
                </div>

                {jointData.rawSegments && (
                  <div className="mt-2 flex gap-4 text-[10px] text-gray-400 italic">
                    {jointData.rawSegments.tender.length > 0 && (
                      <span>Dolore: {jointData.rawSegments.tender.join("; ")}</span>
                    )}
                    {jointData.rawSegments.swollen.length > 0 && (
                      <span>Tumefazione: {jointData.rawSegments.swollen.join("; ")}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Modifiche terapeutiche ──────────────────────────────── */}
            {therapyEvents.length > 0 && (
              <div>
                <SectionHeader icon={Pill} color="text-violet-500" title="Modifiche terapeutiche" count={therapyEvents.length} />
                <div className="space-y-2">
                  {therapyEvents.map((ev, i) => {
                    const c = ACTION_COLORS[ev.action] || ACTION_COLORS.continue;
                    return (
                      <div
                        key={ev.id}
                        className={`rounded-lg border p-3 text-xs transition-colors ${
                          ev.selected ? `${c.bg} ${c.border}` : "border-gray-100 bg-gray-50 opacity-50"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button type="button" onClick={() => toggleTherapy(i)} className={`flex-shrink-0 mt-0.5 ${ev.selected ? c.text : "text-gray-400"}`}>
                            {ev.selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          </button>

                          {/* Action badge */}
                          <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge} ${c.text} uppercase tracking-wide`}>
                            {ev.label}
                          </span>

                          {/* Category badge */}
                          <span className="flex-shrink-0 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                            {CAT_LABELS[ev.category] || ev.category}
                          </span>

                          <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1.5 mt-0.5">
                            {/* Drug name */}
                            <div className="col-span-2 flex items-center gap-1.5">
                              <label className="text-[10px] text-gray-500 w-14 flex-shrink-0">Farmaco</label>
                              <input
                                type="text"
                                value={ev.editDrug}
                                onChange={e => patchTherapy(i, "editDrug", e.target.value)}
                                className={`flex-1 h-6 text-xs font-semibold ${c.text} border ${c.border} rounded px-1.5 bg-white`}
                              />
                            </div>

                            {/* Dose */}
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] text-gray-500 w-14 flex-shrink-0">Dose</label>
                              <input
                                type="text"
                                value={ev.editDose}
                                placeholder="es. 15 mg"
                                onChange={e => patchTherapy(i, "editDose", e.target.value)}
                                className="flex-1 h-6 text-xs border border-gray-200 rounded px-1.5 bg-white"
                              />
                            </div>

                            {/* Frequency */}
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] text-gray-500 w-14 flex-shrink-0">Freq.</label>
                              <input
                                type="text"
                                value={ev.editFreq}
                                placeholder="es. settimanale"
                                onChange={e => patchTherapy(i, "editFreq", e.target.value)}
                                className="flex-1 h-6 text-xs border border-gray-200 rounded px-1.5 bg-white"
                              />
                            </div>

                            {/* Reason (shown for stop / increase / decrease) */}
                            {(ev.action === "stop" || ev.action === "increase" || ev.action === "decrease" || ev.editReason) && (
                              <div className="col-span-2 flex items-center gap-1.5">
                                <label className="text-[10px] text-gray-500 w-14 flex-shrink-0">Motivo</label>
                                <input
                                  type="text"
                                  value={ev.editReason}
                                  placeholder="es. tossicità epatica, risposta inadeguata…"
                                  onChange={e => patchTherapy(i, "editReason", e.target.value)}
                                  className="flex-1 h-6 text-xs border border-gray-200 rounded px-1.5 bg-white"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Source text */}
                        <p className="mt-1.5 ml-10 text-[10px] text-gray-400 italic truncate" title={ev.source_text}>
                          "{ev.source_text}"
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Esami strumentali ───────────────────────────────────── */}
            {instrItems.length > 0 && (
              <div>
                <SectionHeader icon={ScanSearch} color="text-sky-500" title="Esami strumentali" count={instrItems.length} />
                <div className="space-y-2">
                  {instrItems.map((it, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 text-xs transition-colors ${
                        it.selected ? "border-sky-200 bg-sky-50" : "border-gray-100 bg-gray-50 opacity-50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button type="button" onClick={() => toggleInstr(i)} className={`flex-shrink-0 mt-0.5 ${it.selected ? "text-sky-600" : "text-gray-400"}`}>
                          {it.selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                        <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1.5">
                          {/* Tipo esame */}
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-gray-500 w-16 flex-shrink-0">Tipo esame</label>
                            <input
                              type="text"
                              value={it.editExamType}
                              onChange={e => patchInstr(i, "editExamType", e.target.value)}
                              className="flex-1 h-6 text-xs font-semibold text-sky-700 border border-sky-200 rounded px-1.5 bg-white"
                            />
                          </div>
                          {/* Data */}
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] text-gray-500 w-16 flex-shrink-0">Data esame</label>
                            <input
                              type="date"
                              value={it.editDate}
                              onChange={e => patchInstr(i, "editDate", e.target.value)}
                              className="flex-1 h-6 text-xs border border-gray-200 rounded px-1.5 bg-white"
                            />
                          </div>
                          {/* Sede */}
                          <div className="col-span-2 flex items-center gap-1.5">
                            <label className="text-[10px] text-gray-500 w-16 flex-shrink-0">Sede</label>
                            <input
                              type="text"
                              value={it.editTerritory}
                              onChange={e => patchInstr(i, "editTerritory", e.target.value)}
                              placeholder="es. polmone, colonna, mani…"
                              className="flex-1 h-6 text-xs border border-gray-200 rounded px-1.5 bg-white"
                            />
                          </div>
                          {/* Referto */}
                          <div className="col-span-2 flex items-start gap-1.5">
                            <label className="text-[10px] text-gray-500 w-16 flex-shrink-0 mt-1">Referto</label>
                            <textarea
                              value={it.editReport}
                              onChange={e => patchInstr(i, "editReport", e.target.value)}
                              rows={2}
                              className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 bg-white resize-y"
                            />
                          </div>
                        </div>
                      </div>
                      {it.raw && (
                        <p className="mt-1.5 ml-6 text-[10px] text-gray-400 italic truncate" title={it.raw}>
                          "{it.raw}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Testo originale (selezione manuale) ─────────────────── */}
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowOriginalText(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOriginalText ? "rotate-180" : ""}`} />
                <ScanSearch className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-medium text-gray-600">Testo originale — seleziona per archiviare direttamente</span>
                <span className="ml-auto text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">manuale</span>
              </button>
              {showOriginalText && text && (
                <div className="p-3">
                  <SelectableTextBlock
                    text={text}
                    patient={patient}
                    patientId={patientId}
                    onSaved={() => onSaved?.()}
                  />
                </div>
              )}
            </div>

            {/* Nothing found */}
            {clinItems.length === 0 && labItems.length === 0 && !jointData && therapyEvents.length === 0 && instrItems.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">Nessun valore estratto.</div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                {selectedCount} {selectedCount === 1 ? "elemento selezionato" : "elementi selezionati"}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="text-xs h-8">Annulla</Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || selectedCount === 0}
                  className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {saving
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Salvataggio…</>
                    : `Salva ${selectedCount > 0 ? selectedCount : ""} selezionati`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
