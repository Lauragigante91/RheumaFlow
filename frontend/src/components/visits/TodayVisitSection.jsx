import React, { useState, useMemo, useEffect, useRef } from "react";
import { assessmentsApi, workupVisitsApi, therapiesApi } from "../../lib/api";
import { parseExitTherapyChanges } from "../../lib/visitTextParser";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Stethoscope, Copy, Save, Crosshair, FlaskConical, ClipboardList, Printer, Camera } from "lucide-react";
import { toast } from "sonner";
import TemplatePickerDialog from "./TemplatePickerDialog";
import PhysicalExamSection, { serializePhysicalExam } from "../clinical/PhysicalExamSection";
import { countTender, countSwollen } from "../imaging/Homunculus";
import SelectableTextArea from "../shared/SelectableTextArea";
import {
  calcDAS28_CRP, calcDAS28_ESR, calcCDAI, calcSDAI,
  interpretDAS28, interpretCDAI, interpretSDAI,
  calcASDAS_CRP, interpretASDAS,
  calcDAPSA, interpretDAPSA,
} from "../../lib/clinimetrics";
import { detectDiseaseWorkflow, getSymptomDefs } from "../../lib/diseaseWidgets";
import { isLvvDiagnosis, isPmrDiagnosis, isScleroDiagnosis, isSpaDiagnosis, isSpaAxialOnly } from "../../lib/diseaseDetection";
import VascularImagingSection from "../imaging/VascularImagingSection";
import LabImportFromImageDialog from "../labs/LabImportFromImageDialog";
import ItalianDatePicker from "../shared/ItalianDatePicker";
import FollowUpReportModal from "./FollowUpReportModal";

const SCORE_COLORS = {
  "Remissione":           "text-green-700 bg-green-50 border-green-200",
  "Bassa attività":       "text-blue-700 bg-blue-50 border-blue-200",
  "Moderata attività":    "text-amber-700 bg-amber-50 border-amber-200",
  "Alta attività":        "text-red-700 bg-red-50 border-red-200",
  "Inattiva":             "text-green-700 bg-green-50 border-green-200",
  "Molto alta attività":  "text-red-700 bg-red-50 border-red-200",
  "Malattia attiva":      "text-red-700 bg-red-50 border-red-200",
  "Malattia non attiva":  "text-green-700 bg-green-50 border-green-200",
};

function safe(v) { return v === "" || v == null ? 0 : Number(v) || 0; }
function hasVal(v) { return v !== "" && v != null && v !== undefined; }

function ScoreCard({ label, value, interp, missingFields }) {
  if (missingFields && missingFields.length > 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-0.5">{label}</div>
        <div className="text-xs font-semibold text-gray-400 mt-1">Dati incompleti</div>
        <div className="text-[10px] text-gray-400 mt-0.5">Mancano: {missingFields.join(", ")}</div>
      </div>
    );
  }
  if (value == null) return null;
  const color = SCORE_COLORS[interp] || "text-gray-700 bg-gray-50 border-gray-200";
  return (
    <div className={`rounded-lg border p-3 text-center ${color}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-60 mb-0.5">{label}</div>
      <div className="text-2xl font-black tracking-tight">{value}</div>
      <div className="text-[11px] font-semibold mt-0.5 leading-tight">{interp}</div>
    </div>
  );
}

function FieldInput({ label, sub, val, set, max, step, hint, testid }) {
  return (
    <div>
      <label className="text-xs text-gray-600 mb-1 flex items-center gap-1">
        <span className="font-medium">{label}</span>
        {hint ? (
          <button onClick={hint} className="text-blue-600 hover:underline text-[10px] ml-0.5" title="Usa ultimo valore noto">
            ({sub})
          </button>
        ) : (
          <span className="text-gray-400 text-[10px]">({sub})</span>
        )}
      </label>
      <Input
        type="number" min="0" max={max} step={step || "1"} value={val}
        onChange={e => set(e.target.value)}
        className="h-9 text-center font-mono" placeholder="—" data-testid={testid}
      />
    </div>
  );
}

function SectionLabel({ number, text }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {number && (
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0A2540]/8 flex items-center justify-center text-[10px] font-black text-[#0A2540]/60">
          {number}
        </span>
      )}
      <div className="text-[11px] uppercase tracking-[0.15em] text-gray-500 font-semibold">{text}</div>
    </div>
  );
}

function ClinimetryNote({ text }) {
  return <p className="text-[11px] text-gray-400 mt-2 italic">{text}</p>;
}

function InheritedFieldWrapper({ fieldKey, inheritedFields, onMarkReviewed, children }) {
  const isInherited = inheritedFields?.has(fieldKey);
  return (
    <div onFocus={isInherited ? () => onMarkReviewed(fieldKey) : undefined}>
      {isInherited && (
        <div className="flex items-center gap-1.5 text-[9px] text-gray-400 italic mb-1 select-none pointer-events-none">
          <span>↩</span> Importato dalla visita precedente — clicca per rivalutare
        </div>
      )}
      <div className={isInherited ? "opacity-45" : ""}>
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ number, title, subtitle, icon: Icon }) {
  return (
    <div className="flex items-start gap-2.5 mb-2">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0A2540]/8 flex items-center justify-center text-[11px] font-black text-[#0A2540]/60 mt-0.5">
        {number}
      </span>
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-600 flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-gray-400" />}
          {title}
        </div>
        {subtitle && <div className="text-[11px] text-gray-400 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

function SectionBlock({ number, title, subtitle, icon, children, sectionKey, reportChecked, onToggleReport }) {
  return (
    <div className="space-y-2">
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        {sectionKey ? (
          <label title="Includi nel referto" style={{ paddingTop: "3px", flexShrink: 0, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!reportChecked}
              onChange={() => onToggleReport?.(sectionKey)}
              style={{ width: "14px", height: "14px", accentColor: "#0A2540", cursor: "pointer" }}
            />
          </label>
        ) : (
          <div style={{ width: "14px", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <SectionHeader number={number} title={title} subtitle={subtitle} icon={icon} />
          {children}
        </div>
      </div>
    </div>
  );
}

export default function TodayVisitSection({
  patient, assessments, instrumentalExams, labExams, onSaved, onOpenJointCount,
  onOpenPeripheralForm, onOpenAxialForm, syncData, spaProfile,
  onOpenPetvas, onOpenVascularImaging,
  cockpitData, cockpitReportSections,
  planData,
  onRegisterSaveHandle,
  firstVisit,
  workupVisits,
  onTherapySaved,
  onClinimetrySaved,
  onAppendToPlan,
  onDateChange,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const draftKey = `rheumaflow_visit_draft_${patient?.id}_${today}`;
  const [date, setDate]         = useState(today);

  // ── §0: Raccordo anamnestico reumatologico ────────────────────────────────
  const [raccordoText, setRaccordoText] = useState("");

  // ── §1-3: Structured text sections ────────────────────────────────────────
  const [intervalHistory, setIntervalHistory] = useState("");
  const [physicalExam,    setPhysicalExam]    = useState("");
  const [examJoints,      setExamJoints]      = useState({});
  const [examSystems,     setExamSystems]     = useState({});
  const [examMrss,        setExamMrss]        = useState({});
  const [examPasi,        setExamPasi]        = useState({});
  const [examLei,         setExamLei]         = useState({});
  const [labsImaging,     setLabsImaging]     = useState("");
  const [labImportOpen,   setLabImportOpen]   = useState(false);

  // ── Inherited-field tracking ───────────────────────────────────────────────
  // Set of field keys that were auto-imported from the previous visit and have
  // not yet been reviewed (focused / modified) by the clinician.
  const [inheritedFields, setInheritedFields] = useState(new Set());
  const markReviewed = (key) => setInheritedFields(prev => {
    if (!prev.has(key)) return prev;
    const next = new Set(prev);
    next.delete(key);
    return next;
  });

  // Auto-import physical exam from the most recent previous visit (assessment notes OR workup structured field)
  const hasInitExam              = useRef(false);
  const hasInitIntervalHistory   = useRef(false);
  const hasInitLabsImaging       = useRef(false);
  const hasInitNote              = useRef(false);

  useEffect(() => {
    if (hasInitExam.current) return;
    if ((!assessments || assessments.length === 0) && (!workupVisits || workupVisits.length === 0)) return;
    const pool = [];
    (assessments || []).forEach(a => {
      const m = (a.notes || "").match(/\[Esame obiettivo\]\n([\s\S]*?)(?=\n\n\[|$)/);
      if (m?.[1]?.trim()) pool.push({ text: m[1].trim(), date: a.date || "" });
    });
    (workupVisits || []).filter(v => !v.status || v.status !== "draft").forEach(v => {
      if (typeof v.physical_exam === "string" && v.physical_exam.trim())
        pool.push({ text: v.physical_exam.trim(), date: v.visit_date || "" });
      else if (v.physical_exam?.free_text?.trim())
        pool.push({ text: v.physical_exam.free_text.trim(), date: v.visit_date || "" });
    });
    pool.sort((a, b) => b.date.localeCompare(a.date));
    if (pool.length > 0) {
      setPhysicalExam(pool[0].text);
      setInheritedFields(prev => new Set([...prev, 'physicalExam']));
      hasInitExam.current = true;
    }
  }, [assessments, workupVisits]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── §5: Assessment ─────────────────────────────────────────────────────────
  const [symptoms, setSymptoms]       = useState(new Set());
  const [note, setNote]               = useState("");
  const [saving, setSaving]           = useState(false);
  const [reportSections, setReportSections] = useState(new Set());
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const toggleReportSection = (key) => {
    setReportSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // RA fields
  const [tjc, setTjc] = useState("");
  const [sjc, setSjc] = useState("");
  const [gh,  setGh]  = useState("");
  const [ega, setEga] = useState("");
  const [pcr, setPcr] = useState("");
  const [ves, setVes] = useState("");

  // SpA / PsA — axial fields
  const [spaBack,       setSpaBack]       = useState("");
  const [spaStiff,      setSpaStiff]      = useState("");
  const [spaPeriph,     setSpaPeriph]     = useState("");
  const [spaPga,        setSpaPga]        = useState("");
  const [spaPcr,        setSpaPcr]        = useState("");
  // SpA / PsA — peripheral fields
  const [spaTjc,        setSpaTjc]        = useState("");
  const [spaSjc,        setSpaSjc]        = useState("");
  const [spaDactylitis, setSpaDactylitis] = useState("");
  const [spaEnthesitis, setSpaEnthesitis] = useState("");

  // PMR / GCA fields
  const [pmrPain,          setPmrPain]          = useState("");
  const [pmrStiff,         setPmrStiff]         = useState("");
  const [pmrSteroid,       setPmrSteroid]       = useState("");
  const [pmrEsr,           setPmrEsr]           = useState("");
  const [pmrPcr,           setPmrPcr]           = useState("");
  const [pmrActivityLevel, setPmrActivityLevel] = useState("");

  // Fibromyalgia
  const [fibroPain,    setFibroPain]    = useState("");
  const [fibroFatigue, setFibroFatigue] = useState("");
  const [fibroSleep,   setFibroSleep]   = useState("");

  // Myositis
  const [myoStrength, setMyoStrength] = useState("");
  const [myoCk,       setMyoCk]       = useState("");

  // Osteoporosis
  const [osteoAdherence, setOsteoAdherence] = useState("");

  // ── Draft: ripristina bozza da sessionStorage (una sola volta per paziente/giorno) ──
  const hasRestoredDraft = useRef(false);
  const raccordoFromDraft = useRef(false);
  useEffect(() => {
    if (hasRestoredDraft.current || !patient?.id) return;
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.raccordoText) { setRaccordoText(d.raccordoText); raccordoFromDraft.current = true; }
      if (d.intervalHistory) { setIntervalHistory(d.intervalHistory); hasInitIntervalHistory.current = true; }
      if (d.physicalExam)    { setPhysicalExam(d.physicalExam);       hasInitExam.current = true; }
      if (d.examJoints && Object.keys(d.examJoints).length > 0)   setExamJoints(d.examJoints);
      if (d.examLei    && Object.keys(d.examLei).length > 0)       setExamLei(d.examLei);
      if (d.examSystems && Object.keys(d.examSystems).length > 0)  setExamSystems(d.examSystems);
      if (d.examMrss   && Object.keys(d.examMrss).length > 0)      setExamMrss(d.examMrss);
      if (d.examPasi   && Object.keys(d.examPasi).length > 0)      setExamPasi(d.examPasi);
      if (d.labsImaging)  { setLabsImaging(d.labsImaging);  hasInitLabsImaging.current = true; }
      if (d.note)         { setNote(d.note);                hasInitNote.current = true; }
      if (Array.isArray(d.symptoms) && d.symptoms.length > 0) setSymptoms(new Set(d.symptoms));
      if (d.tjc  != null) setTjc(d.tjc);    if (d.sjc  != null) setSjc(d.sjc);
      if (d.gh   != null) setGh(d.gh);      if (d.ega  != null) setEga(d.ega);
      if (d.pcr  != null) setPcr(d.pcr);    if (d.ves  != null) setVes(d.ves);
      if (d.spaBack   != null) setSpaBack(d.spaBack);
      if (d.spaStiff  != null) setSpaStiff(d.spaStiff);
      if (d.spaPeriph != null) setSpaPeriph(d.spaPeriph);
      if (d.spaPga    != null) setSpaPga(d.spaPga);
      if (d.spaPcr    != null) setSpaPcr(d.spaPcr);
      if (d.spaTjc    != null) setSpaTjc(d.spaTjc);
      if (d.spaSjc    != null) setSpaSjc(d.spaSjc);
      if (d.spaDactylitis != null) setSpaDactylitis(d.spaDactylitis);
      if (d.spaEnthesitis != null) setSpaEnthesitis(d.spaEnthesitis);
      if (d.pmrEsr     != null) setPmrEsr(d.pmrEsr);
      if (d.pmrPcr     != null) setPmrPcr(d.pmrPcr);
      if (d.pmrSteroid != null) setPmrSteroid(d.pmrSteroid);
      if (d.pmrPain    != null) setPmrPain(d.pmrPain);
      if (d.pmrStiff   != null) setPmrStiff(d.pmrStiff);
      if (d.pmrActivityLevel)   setPmrActivityLevel(d.pmrActivityLevel);
      if (d.fibroPain    != null) setFibroPain(d.fibroPain);
      if (d.fibroFatigue != null) setFibroFatigue(d.fibroFatigue);
      if (d.fibroSleep   != null) setFibroSleep(d.fibroSleep);
      if (d.myoStrength  != null) setMyoStrength(d.myoStrength);
      if (d.myoCk        != null) setMyoCk(d.myoCk);
      if (d.osteoAdherence)       setOsteoAdherence(d.osteoAdherence);
      hasRestoredDraft.current = true;
      toast.info("Bozza della visita ripristinata", { duration: 3000 });
    } catch { /* sessionStorage non disponibile o dato corrotto */ }
  }, [patient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-import raccordo dall'ULTIMA visita disponibile (non dalla prima) ───
  const hasInitRaccordo = useRef(false);
  useEffect(() => {
    if (hasInitRaccordo.current || raccordoFromDraft.current) return;
    const pool = [];
    // Workup visits: campo strutturato rheumatologic_history_summary (solo visite completate)
    (workupVisits || []).filter(v => !v.status || v.status !== "draft").forEach(v => {
      if (v.rheumatologic_history_summary?.trim())
        pool.push({ text: v.rheumatologic_history_summary.trim(), date: v.visit_date || "" });
    });
    // Visite di rivalutazione: raccordo salvato nel campo notes come [Raccordo]\n{testo}
    (assessments || []).forEach(a => {
      const m = (a.notes || "").match(/\[Raccordo\]\n([\s\S]*?)(?=\n\n\[|$)/);
      if (m?.[1]?.trim()) pool.push({ text: m[1].trim(), date: a.date || "" });
    });
    pool.sort((a, b) => b.date.localeCompare(a.date));
    if (pool.length > 0) {
      setRaccordoText(pool[0].text);
      setInheritedFields(prev => new Set([...prev, 'raccordoText']));
      hasInitRaccordo.current = true;
      return;
    }
    // Ultima risorsa: storia reumatologica dalla prima visita
    if (firstVisit?.rheumatologic_history?.trim()) {
      setRaccordoText(firstVisit.rheumatologic_history.trim());
      setInheritedFields(prev => new Set([...prev, 'raccordoText']));
      hasInitRaccordo.current = true;
    }
  }, [workupVisits, firstVisit, assessments]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-import: Anamnesi intervallare dall'ultima visita precedente ────────
  useEffect(() => {
    if (hasInitIntervalHistory.current) return;
    if (!assessments?.length && !workupVisits?.length) return;
    const pool = [];
    (workupVisits || [])
      .filter(v => v.visit_type === "follow_up" && v.interval_history?.trim())
      .forEach(v => pool.push({ text: v.interval_history.trim(), date: v.visit_date || "" }));
    (assessments || []).forEach(a => {
      const m = (a.notes || "").match(/\[Anamnesi intervallare\]\n([\s\S]*?)(?=\n\n\[|\n\nSintomi:|$)/);
      if (m?.[1]?.trim()) pool.push({ text: m[1].trim(), date: a.date || "" });
    });
    pool.sort((a, b) => b.date.localeCompare(a.date));
    if (pool.length > 0) {
      setIntervalHistory(pool[0].text);
      setInheritedFields(prev => new Set([...prev, 'intervalHistory']));
      hasInitIntervalHistory.current = true;
    }
  }, [assessments, workupVisits]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-import: Esami / imaging dall'ultima visita precedente ───────────
  useEffect(() => {
    if (hasInitLabsImaging.current) return;
    if (!assessments?.length && !workupVisits?.length) return;
    const pool = [];
    (workupVisits || [])
      .filter(v => v.visit_type === "follow_up" && v.labs_imaging?.trim())
      .forEach(v => pool.push({ text: v.labs_imaging.trim(), date: v.visit_date || "" }));
    (assessments || []).forEach(a => {
      const m = (a.notes || "").match(/\[Esami \/ imaging\]\n([\s\S]*?)(?=\n\n\[|\n\nSintomi:|$)/);
      if (m?.[1]?.trim()) pool.push({ text: m[1].trim(), date: a.date || "" });
    });
    pool.sort((a, b) => b.date.localeCompare(a.date));
    if (pool.length > 0) {
      setLabsImaging(pool[0].text);
      setInheritedFields(prev => new Set([...prev, 'labsImaging']));
      hasInitLabsImaging.current = true;
    }
  }, [assessments, workupVisits]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-import: nota clinica (conclusioni) dall'ultima visita precedente ──
  // Funziona SOLO su note salvate col nuovo formato [Conclusioni]: questo
  // garantisce che non vengano mai catturati testi di sezioni adiacenti.
  useEffect(() => {
    if (hasInitNote.current) return;
    if (!assessments?.length && !workupVisits?.length) return;
    const pool = [];
    (workupVisits || [])
      .filter(v => v.visit_type === "follow_up" && v.conclusions?.trim())
      .forEach(v => pool.push({ text: v.conclusions.trim(), date: v.visit_date || "" }));
    (assessments || []).forEach(a => {
      const m = (a.notes || "").match(/\[Conclusioni\]\n([\s\S]*?)(?=\n\n\[|$)/);
      if (m?.[1]?.trim()) pool.push({ text: m[1].trim(), date: a.date || "" });
    });
    pool.sort((a, b) => b.date.localeCompare(a.date));
    if (pool.length > 0) {
      setNote(pool[0].text);
      setInheritedFields(prev => new Set([...prev, 'note']));
      hasInitNote.current = true;
    }
  }, [assessments, workupVisits]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draft: salvataggio automatico in sessionStorage (debounced 600 ms) ────
  const _draftTimer = useRef(null);
  useEffect(() => {
    if (!patient?.id) return;
    clearTimeout(_draftTimer.current);
    _draftTimer.current = setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({
          raccordoText, intervalHistory, physicalExam,
          examJoints, examLei, examSystems, examMrss, examPasi,
          labsImaging, note, symptoms: [...symptoms],
          tjc, sjc, gh, ega, pcr, ves,
          spaBack, spaStiff, spaPeriph, spaPga, spaPcr, spaTjc, spaSjc,
          spaDactylitis, spaEnthesitis,
          pmrEsr, pmrPcr, pmrSteroid, pmrPain, pmrStiff, pmrActivityLevel,
          fibroPain, fibroFatigue, fibroSleep, myoStrength, myoCk, osteoAdherence,
        }));
      } catch { /* sessionStorage piena o non disponibile */ }
    }, 600);
    return () => clearTimeout(_draftTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raccordoText, intervalHistory, physicalExam, examJoints, examLei, examSystems,
      examMrss, examPasi, labsImaging, note, symptoms,
      tjc, sjc, gh, ega, pcr, ves,
      spaBack, spaStiff, spaPeriph, spaPga, spaPcr, spaTjc, spaSjc,
      spaDactylitis, spaEnthesitis,
      pmrEsr, pmrPcr, pmrSteroid, pmrPain, pmrStiff, pmrActivityLevel,
      fibroPain, fibroFatigue, fibroSleep, myoStrength, myoCk, osteoAdherence]);

  const workflow    = useMemo(() => detectDiseaseWorkflow(patient), [patient]);
  const symptomDefs = useMemo(() => getSymptomDefs(workflow), [workflow]);

  // ── Sync TJC/SJC live from Homunculus ─────────────────────────────────────
  useEffect(() => {
    if (Object.keys(examJoints).length === 0) return;
    const t = countTender(examJoints);
    const s = countSwollen(examJoints);
    setTjc(String(t));
    setSjc(String(s));
    setSpaTjc(String(t));
    setSpaSjc(String(s));
  }, [examJoints]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync from external sources (lab import, composite dialog) ─────────────
  const [syncedKey, setSyncedKey] = useState(0);
  useEffect(() => {
    if (!syncData || syncData.syncKey === 0 || syncData.syncKey === syncedKey) return;
    setSyncedKey(syncData.syncKey);
    if (syncData.tjc  != null) setTjc((prev) => prev === "" ? String(syncData.tjc)  : prev);
    if (syncData.sjc  != null) setSjc((prev) => prev === "" ? String(syncData.sjc)  : prev);
    if (syncData.gh   != null) setGh( (prev) => prev === "" ? String(syncData.gh)   : prev);
    if (syncData.ega  != null) setEga((prev) => prev === "" ? String(syncData.ega)  : prev);
    if (syncData.pcr  != null) setPcr(String(syncData.pcr));
    if (syncData.ves  != null) setVes(String(syncData.ves));
    if (syncData.pcr  != null) setPmrPcr(String(syncData.pcr));
    if (syncData.ves  != null) setPmrEsr(String(syncData.ves));
    if (syncData.backPain         != null) setSpaBack(  (prev) => prev === "" ? String(syncData.backPain)         : prev);
    if (syncData.morningStiffness != null) setSpaStiff( (prev) => prev === "" ? String(syncData.morningStiffness) : prev);
    if (syncData.peripheralPain   != null) setSpaPeriph((prev) => prev === "" ? String(syncData.peripheralPain)   : prev);
    if (syncData.pga              != null) setSpaPga(   (prev) => prev === "" ? String(syncData.pga)              : prev);
    if (syncData.pcr  != null) setSpaPcr(String(syncData.pcr));
    if (syncData.joint_exam != null) setExamJoints(syncData.joint_exam);
    if (syncData.lei        != null) setExamLei(syncData.lei);
    if (syncData.raccordoText    != null) setRaccordoText(prev => prev || syncData.raccordoText);
    if (syncData.intervalHistory != null) setIntervalHistory(prev => prev || syncData.intervalHistory);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncData?.syncKey]);

  // ── Lab hints ─────────────────────────────────────────────────────────────
  const latestLabs = useMemo(() => {
    const sorted = [...(labExams || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    let pcrV = null, vesV = null, ckV = null, vitdV = null;
    for (const e of sorted) {
      const v = e.values || {};
      if (!pcrV  && v.pcr?.value  != null) pcrV  = { value: v.pcr.value,  unit: v.pcr.unit  || "mg/L" };
      if (!vesV  && v.ves?.value  != null) vesV  = { value: v.ves.value };
      if (!ckV   && v.ck?.value   != null) ckV   = { value: v.ck.value,   unit: v.ck.unit   || "IU/L" };
      if (!vitdV && v.vit_d?.value != null) vitdV = { value: v.vit_d.value, unit: v.vit_d.unit || "ng/mL" };
      if (pcrV && vesV && ckV && vitdV) break;
    }
    return { pcr: pcrV, ves: vesV, ck: ckV, vit_d: vitdV };
  }, [labExams]);

  // ─── RA scores ────────────────────────────────────────────────────────────
  // gh  = PtGA (Patient Global Assessment, 0–100 mm) — usata come GH nel DAS28
  // ega = PhGA (Physician Global Assessment, 0–10 cm VAS) — usata in CDAI/SDAI
  const t = safe(tjc), s = safe(sjc), g = safe(gh), e = safe(ega), p = safe(pcr), v = safe(ves);
  // DAS28-CRP (4 variabili): richiede TJC, SJC, PCR e PtGA
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const das28crp = useMemo(() => (hasVal(tjc) && hasVal(sjc) && hasVal(pcr) && hasVal(gh)) ? calcDAS28_CRP({ tjc: t, sjc: s, crp: p, gh: g }) : null, [t, s, p, g, tjc, sjc, pcr, gh]);
  // DAS28-VES (4 variabili): richiede TJC, SJC, VES e PtGA
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const das28esr = useMemo(() => (hasVal(tjc) && hasVal(sjc) && hasVal(ves) && hasVal(gh)) ? calcDAS28_ESR({ tjc: t, sjc: s, esr: Math.max(v, 1), gh: g }) : null, [t, s, v, g, tjc, sjc, ves, gh]);
  // CDAI: richiede TJC, SJC, PtGA e PhGA — nessun lab
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cdai = useMemo(() => (hasVal(tjc) && hasVal(sjc) && hasVal(gh) && hasVal(ega)) ? calcCDAI({ tjc28: t, sjc28: s, pga: g / 10, ega: e }) : null, [t, s, g, e, tjc, sjc, gh, ega]);
  // SDAI: richiede TJC, SJC, PtGA, PhGA e PCR
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sdai = useMemo(() => (hasVal(tjc) && hasVal(sjc) && hasVal(gh) && hasVal(ega) && hasVal(pcr)) ? calcSDAI({ tjc28: t, sjc28: s, pga: g / 10, ega: e, crp: p / 10 }) : null, [t, s, g, e, p, tjc, sjc, gh, ega, pcr]);

  // Campi mancanti (mostrati solo se articolari inseriti)
  const jointsEntered = hasVal(tjc) || hasVal(sjc);
  const das28crpMissing = jointsEntered ? [
    ...(!hasVal(pcr) ? ["PCR"]  : []),
    ...(!hasVal(gh)  ? ["PtGA"] : []),
  ] : [];
  const das28esrMissing = jointsEntered ? [
    ...(!hasVal(ves) ? ["VES"]  : []),
    ...(!hasVal(gh)  ? ["PtGA"] : []),
  ] : [];
  const cdaiMissing = jointsEntered ? [
    ...(!hasVal(gh)  ? ["PtGA"] : []),
    ...(!hasVal(ega) ? ["PhGA"] : []),
  ] : [];
  const sdaiMissing = jointsEntered ? [
    ...(!hasVal(gh)  ? ["PtGA"] : []),
    ...(!hasVal(ega) ? ["PhGA"] : []),
    ...(!hasVal(pcr) ? ["PCR"]  : []),
  ] : [];
  const raHasScores = das28crp != null || das28esr != null || cdai != null || sdai != null
    || das28crpMissing.length > 0 || das28esrMissing.length > 0
    || cdaiMissing.length > 0 || sdaiMissing.length > 0;

  // ─── Dati visita precedente per import articolare (tutte le diagnosi) ───────
  const prevJointsData = useMemo(() => {
    const isFilledMap = (map) => map && Object.values(map).some((v) => v && v !== "none");
    const candidates = [];

    // 1. Workup visits: physical_exam_joint_exam
    (workupVisits || []).forEach((v) => {
      if (isFilledMap(v.physical_exam_joint_exam))
        candidates.push({ joints: v.physical_exam_joint_exam, date: v.visit_date });
    });

    // 2. Prima visita: physical_exam_joint_exam
    if (firstVisit && isFilledMap(firstVisit.physical_exam_joint_exam))
      candidates.push({ joints: firstVisit.physical_exam_joint_exam, date: firstVisit.referral_date || "" });

    // 3. Assessments with tender/swollen arrays (SpA & RA style)
    const articularTypes = ["dapsa", "das28_esr", "das28_crp", "cdai", "sdai"];
    (assessments || [])
      .filter((a) => articularTypes.includes(a.index_type)
        && (a.tender_joints?.length > 0 || a.swollen_joints?.length > 0)
        && (a.date || "").slice(0, 10) < today)
      .forEach((a) => {
        const m = {};
        (a.tender_joints || []).forEach((k) => { m[k] = "tender"; });
        (a.swollen_joints || []).forEach((k) => { m[k] = m[k] === "tender" ? "both" : "swollen"; });
        candidates.push({ joints: m, date: a.date });
      });

    if (!candidates.length) return null;
    candidates.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return candidates[0];
  }, [assessments, firstVisit, workupVisits, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevLeiData = useMemo(() => {
    if (!isSpaDiagnosis(patient)) return null;
    const sorted = [...(assessments || [])]
      .filter((a) => a.index_type === "lei" && a.inputs?.sites
        && (a.date || "").slice(0, 10) < today)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const prev = sorted[0];
    if (!prev) return null;
    return { sites: prev.inputs.sites, date: prev.date };
  }, [assessments, patient, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── SpA phenotype flags ──────────────────────────────────────────────────
  const spaHasPeripheral = spaProfile?.peripheral_involvement === true;
  const spaHasAxial      = spaProfile?.axial_involvement      === true;
  const spaIsAxialOnly   = isSpaAxialOnly(spaProfile);
  const spaProfileKnown  = spaProfile != null;

  // ─── SpA scores ───────────────────────────────────────────────────────────
  const asdas = useMemo(() => {
    if (!hasVal(spaBack) && !hasVal(spaPga)) return null;
    return calcASDAS_CRP({
      backPain: safe(spaBack), morningStiffness: safe(spaStiff),
      pga: safe(spaPga), peripheralPain: safe(spaPeriph), crp: safe(spaPcr),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaBack, spaStiff, spaPga, spaPeriph, spaPcr]);

  const spaTjcN = safe(spaTjc);
  const spaSjcN = safe(spaSjc);
  const dapsa = useMemo(() => {
    const savedDapsa = [...(assessments || [])]
      .filter(a => a.index_type === "dapsa" && (a.date || "").slice(0, 10) === date && a.score != null)
      .sort((a, b) => (b.id || "").localeCompare(a.id || ""))[0];
    if (savedDapsa) return savedDapsa.score;
    if (!hasVal(spaTjc) && !hasVal(spaSjc)) return null;
    return calcDAPSA({
      tjc68: spaTjcN, sjc66: spaSjcN,
      pga: safe(spaPga), patientPain: safe(spaPeriph),
      crp: safe(spaPcr) / 10,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaTjcN, spaSjcN, spaPga, spaPeriph, spaPcr, assessments, date]);

  const toggleSymptom = (key) => {
    setSymptoms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const duplicatePrevious = () => {
    const types = workflow.primaryIndexTypes;
    const relevant = [...(assessments || [])]
      .filter(a => !types.length || types.includes(a.index_type))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (!relevant.length) { toast.info("Nessuna visita precedente trovata"); return; }
    const last = relevant[0];
    const inp = last.inputs || {};
    if (inp.tjc  != null) setTjc(String(inp.tjc));
    if (inp.sjc  != null) setSjc(String(inp.sjc));
    if (inp.gh   != null) setGh(String(inp.gh));
    if (inp.ega  != null) setEga(String(inp.ega));
    if (inp.crp  != null) setPcr(String(inp.crp));
    if (inp.esr  != null) setVes(String(inp.esr));
    if (inp.backPain         != null) setSpaBack(String(inp.backPain));
    if (inp.morningStiffness != null) setSpaStiff(String(inp.morningStiffness));
    if (inp.peripheralPain   != null) setSpaPeriph(String(inp.peripheralPain));
    if (inp.pga              != null) setSpaPga(String(inp.pga));
    if (inp.tjc              != null) setSpaTjc(String(inp.tjc));
    if (inp.sjc              != null) setSpaSjc(String(inp.sjc));
    if (inp.dactylitis       != null) setSpaDactylitis(String(inp.dactylitis));
    if (inp.enthesitis       != null) setSpaEnthesitis(String(inp.enthesitis));
    if (inp.esr != null) setPmrEsr(String(inp.esr));
    if (inp.crp != null) setPmrPcr(String(inp.crp));
    if (inp.disease_activity != null) setPmrActivityLevel(inp.disease_activity);
    if (last.notes) setNote(last.notes);
    toast.success(`Duplicata visita del ${new Date(last.date).toLocaleDateString("it-IT")}`);
  };

  // ── Build structured note prefix from text sections ─────────────────────
  function buildTextPrefix() {
    const parts = [];
    if (raccordoText.trim())   parts.push(`[Raccordo]\n${raccordoText.trim()}`);
    if (intervalHistory.trim()) parts.push(`[Anamnesi intervallare]\n${intervalHistory.trim()}`);
    const examSerialized = serializePhysicalExam({
      free_text:  physicalExam,
      joint_exam: examJoints,
      systems:    examSystems,
      mrss:       examMrss,
      pasi:       examPasi,
      lei:        examLei,
    });
    if (examSerialized.trim()) parts.push(`[Esame obiettivo]\n${examSerialized.trim()}`);
    if (labsImaging.trim())    parts.push(`[Esami / imaging]\n${labsImaging.trim()}`);
    return parts.join("\n\n");
  }

  // Avvolge la nota clinica in una sezione esplicita [Conclusioni] così il
  // parser delle visite future può estrarre le sezioni senza ambiguità.
  function wrapNote(rawNote) {
    return rawNote.trim() ? `[Conclusioni]\n${rawNote.trim()}` : "";
  }

  const save = async (exitTherapyText) => {
    setSaving(true);
    let _savedOk = false;
    try {
      const symptomLabels = [...symptoms]
        .map(k => symptomDefs.find(sd => sd.key === k)?.label)
        .filter(Boolean);

      // ── Pre-flight validation (must run BEFORE creating workup_visit) ─────────
      if (workflow.key === "ra") {
        if (!raHasScores) {
          toast.error("Usa il Form unificato AR per inserire la conta articolare e calcolare i punteggi");
          setSaving(false); return;
        }
        if (das28crp == null && das28esr == null && cdai == null && sdai == null) {
          toast.error("Dati incompleti — completa VES, PCR o PhGA nel Form unificato AR per calcolare uno score");
          setSaving(false); return;
        }
      } else if (workflow.key === "spa") {
        const _needsAxial = !spaHasPeripheral || (spaHasAxial && !spaHasPeripheral);
        if (_needsAxial && asdas == null && dapsa == null) {
          toast.error("Inserisci i valori clinici per calcolare ASDAS-CRP o DAPSA");
          setSaving(false); return;
        }
        if (!_needsAxial && dapsa == null && asdas == null) {
          toast.error("Inserisci TJC/SJC (periferica) o lombalgia/PGA (assiale) per salvare");
          setSaving(false); return;
        }
      } else if (workflow.key === "pmr") {
        const _hasPmrData = hasVal(pmrEsr) || hasVal(pmrPcr) || hasVal(pmrSteroid) || hasVal(pmrPain) || hasVal(pmrStiff);
        if (!_hasPmrData && symptoms.size === 0 && !note.trim()) {
          toast.info("Aggiungi almeno un valore clinico o un sintomo per salvare");
          setSaving(false); return;
        }
      } else {
        const _hasGenericData =
          symptoms.size > 0 || !!note.trim() ||
          (workflow.key === "fibromyalgia" && (hasVal(fibroPain) || hasVal(fibroFatigue) || hasVal(fibroSleep))) ||
          (workflow.key === "myositis"     && (hasVal(myoStrength) || hasVal(myoCk))) ||
          (workflow.key === "osteoporosis" && hasVal(osteoAdherence));
        if (!_hasGenericData) {
          toast.info("Aggiungi almeno un sintomo o una nota per salvare");
          setSaving(false); return;
        }
      }

      // ── Find-or-create the follow_up workup_visit for this date ──────────────
      const existingFu = (workupVisits || []).find(
        v => v.visit_type === "follow_up" && (v.visit_date || "").slice(0, 10) === date
      );
      const examSerialized = serializePhysicalExam({
        free_text: physicalExam, joint_exam: examJoints, systems: examSystems,
        mrss: examMrss, pasi: examPasi, lei: examLei,
      });
      const narrativePayload = {
        patient_id:                    patient.id,
        visit_type:                    "follow_up",
        visit_date:                    date,
        rheumatologic_history_summary: raccordoText.trim()    || null,
        interval_history:              intervalHistory.trim() || null,
        physical_exam:                 examSerialized.trim()  || null,
        physical_exam_joint_exam:      Object.keys(examJoints).length  ? examJoints  : null,
        physical_exam_systems:         Object.keys(examSystems).length ? examSystems : null,
        physical_exam_mrss:            Object.keys(examMrss).length    ? examMrss    : null,
        physical_exam_pasi:            Object.keys(examPasi).length    ? examPasi    : null,
        physical_exam_lei:             Object.keys(examLei).length     ? examLei     : null,
        labs_imaging:                  labsImaging.trim()    || null,
        conclusions:                   note.trim()           || null,
        exit_therapy_text:             (typeof exitTherapyText === "string" ? exitTherapyText : "").trim() || null,
        status:                        "completed",
      };
      const fuVisit = existingFu
        ? await workupVisitsApi.patch(existingFu.id, narrativePayload)
        : await workupVisitsApi.create(patient.id, narrativePayload);
      const visitId = fuVisit.id;

      // ── Aggiorna il ledger terapie dai cambi espliciti nella terapia in uscita ──
      // "aumenta/riduce/modifica X a Y mg" → evento dose_increased/dose_reduced nel ledger.
      // Il backend standard pathway confronta vs episodio attivo esistente e genera
      // l'evento appropriato; non tocca le terapie non menzionate.
      if (narrativePayload.exit_therapy_text) {
        const changes = parseExitTherapyChanges(narrativePayload.exit_therapy_text, date);
        console.log(
          "[TodayVisitSection] dose changes found:",
          changes.length,
          changes.map((t) => ({ drug_name: t.drug_name, dose: t.dose, frequency: t.frequency, _visit_event: t._visit_event })),
        );
        if (changes.length > 0) {
          await Promise.allSettled(
            changes.map((t) =>
              therapiesApi.upsert({
                patient_id: patient.id,
                drug_name:  t.drug_name,
                category:   t.category || "other",
                dose:       t.dose     || null,
                frequency:  t.frequency || null,
                route:      t.route    || null,
                status:     "active",
                visit_id:   visitId,
                source:     "visita",
              }),
            ),
          );
        }
      }

      if (workflow.key === "ra") {
        const baseInputs = {
          tjc: t, sjc: s, gh: g,
          ...(hasVal(ega) ? { ega: e } : {}),
          ...(hasVal(pcr) ? { crp: p } : {}),
          ...(hasVal(ves) ? { esr: v } : {}),
        };
        const basePayload = {
          patient_id: patient.id, date,
          inputs: baseInputs, tender_joints: [], swollen_joints: [],
          visit_id: visitId, visit_type: "follow_up",
        };
        const raSaves = [];
        if (das28crp != null) raSaves.push(assessmentsApi.create({
          ...basePayload, index_type: "das28_crp",
          score: das28crp, interpretation: interpretDAS28(das28crp),
        }));
        if (das28esr != null) raSaves.push(assessmentsApi.create({
          ...basePayload, index_type: "das28_esr",
          score: das28esr, interpretation: interpretDAS28(das28esr),
        }));
        if (cdai != null) raSaves.push(assessmentsApi.create({
          ...basePayload, index_type: "cdai",
          score: cdai, interpretation: interpretCDAI(cdai),
        }));
        if (sdai != null) raSaves.push(assessmentsApi.create({
          ...basePayload, index_type: "sdai",
          score: sdai, interpretation: interpretSDAI(sdai),
        }));
        await Promise.all(raSaves);
        onSaved?.({ symptoms: symptomLabels, note, tjc: t, sjc: s, gh: g, ega: e, das28crp, das28esr, cdai, sdai });
        _savedOk = true;
        const savedLabels = [
          das28crp != null ? `DAS28-PCR ${das28crp}` : null,
          das28esr != null ? `DAS28-VES ${das28esr}` : null,
          cdai     != null ? `CDAI ${cdai}`          : null,
          sdai     != null ? `SDAI ${sdai}`          : null,
        ].filter(Boolean).join(" · ");
        toast.success(`Visita AR salvata — ${savedLabels}`);

      } else if (workflow.key === "spa") {
        const saves = [];
        if (asdas != null) {
          saves.push(assessmentsApi.create({
            patient_id: patient.id, index_type: "asdas_crp", date,
            inputs: {
              backPain: safe(spaBack), morningStiffness: safe(spaStiff),
              peripheralPain: safe(spaPeriph), pga: safe(spaPga), crp: safe(spaPcr),
            },
            score: asdas, interpretation: interpretASDAS(asdas),
            visit_id: visitId, visit_type: "follow_up",
          }));
        }
        if (dapsa != null && (hasVal(spaTjc) || hasVal(spaSjc))) {
          saves.push(assessmentsApi.create({
            patient_id: patient.id, index_type: "dapsa", date,
            inputs: {
              tjc: spaTjcN, sjc: spaSjcN,
              pga: safe(spaPga), patientPain: safe(spaPeriph), crp: safe(spaPcr) / 10,
              ...(hasVal(spaDactylitis) ? { dactylitis: safe(spaDactylitis) } : {}),
              ...(hasVal(spaEnthesitis) ? { enthesitis: safe(spaEnthesitis) } : {}),
            },
            score: dapsa, interpretation: interpretDAPSA(dapsa),
            visit_id: visitId, visit_type: "follow_up",
          }));
        }
        await Promise.all(saves);
        onSaved?.({ symptoms: symptomLabels, note, asdas, dapsa });
        _savedOk = true;
        const savedLabels = [
          asdas != null ? `ASDAS ${asdas}` : null,
          dapsa != null ? `DAPSA ${dapsa}` : null,
        ].filter(Boolean).join(" · ");
        toast.success(`Visita SpA/PsA salvata${savedLabels ? ` — ${savedLabels}` : ""}`);

      } else if (workflow.key === "pmr") {
        const hasPmrData = hasVal(pmrEsr) || hasVal(pmrPcr) || hasVal(pmrSteroid) || hasVal(pmrPain) || hasVal(pmrStiff);
        if (hasPmrData) {
          await assessmentsApi.create({
            patient_id: patient.id, index_type: "pmr_activity", date,
            inputs: {
              ...(hasVal(pmrEsr)     ? { esr: safe(pmrEsr) }            : {}),
              ...(hasVal(pmrPcr)     ? { crp: safe(pmrPcr) }            : {}),
              ...(hasVal(pmrSteroid) ? { steroid_mg: safe(pmrSteroid) } : {}),
              ...(hasVal(pmrPain)    ? { pain_vas: safe(pmrPain) }       : {}),
              ...(hasVal(pmrStiff)   ? { stiffness_min: safe(pmrStiff) } : {}),
              symptoms: [...symptoms],
              ...(pmrActivityLevel   ? { disease_activity: pmrActivityLevel } : {}),
            },
            score: hasVal(pmrSteroid) ? safe(pmrSteroid) : null,
            visit_id: visitId, visit_type: "follow_up",
          });
        }
        onSaved?.({ symptoms: symptomLabels, note });
        _savedOk = true;
        toast.success("Visita PMR/GCA salvata");

      } else {
        const quickLines = [];
        if (workflow.key === "fibromyalgia") {
          if (hasVal(fibroPain))    quickLines.push(`Dolore VAS: ${fibroPain}/10`);
          if (hasVal(fibroFatigue)) quickLines.push(`Affaticamento VAS: ${fibroFatigue}/10`);
          if (hasVal(fibroSleep))   quickLines.push(`Sonno VAS: ${fibroSleep}/10`);
        } else if (workflow.key === "myositis") {
          if (hasVal(myoStrength)) quickLines.push(`Forza muscolare sogg.: ${myoStrength}/10`);
          if (hasVal(myoCk))       quickLines.push(`CK: ${myoCk} IU/L`);
        } else if (workflow.key === "osteoporosis") {
          if (hasVal(osteoAdherence)) quickLines.push(`Aderenza terapia: ${osteoAdherence}`);
        }
        await assessmentsApi.create({
          patient_id: patient.id,
          index_type: "clinical_note",
          date,
          visit_id: visitId, visit_type: "follow_up",
          inputs: {
            symptoms: [...symptoms],
            ...(quickLines.length ? { quick_data: quickLines } : {}),
          },
          score: null,
          notes: note.trim() || null,
        });
        onSaved?.({ symptoms: symptomLabels, note });
        _savedOk = true;
        toast.success("Nota visita registrata");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore nel salvataggio");
    } finally {
      setSaving(false);
      if (_savedOk) {
        try { sessionStorage.removeItem(draftKey); } catch { /* ignorare */ }
      }
    }
  };

  const assessmentSectionNum = workflow.clinimetryType != null ? "5" : "4";

  // ── Expose save handle to parent (for PlanSection footer) ─────────────────
  const _saveHandleRef = useRef(null);
  const _examRef       = useRef({ joints: {}, lei: {} });
  useEffect(() => { _saveHandleRef.current = { save, duplicatePrevious }; });
  useEffect(() => { _examRef.current = { joints: examJoints, lei: examLei }; });
  useEffect(() => { onDateChange?.(date); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    onRegisterSaveHandle?.({
      save: (exitTherapyText) => _saveHandleRef.current?.save(exitTherapyText),
      openReport: () => setReportModalOpen(true),
      duplicatePrevious: () => _saveHandleRef.current?.duplicatePrevious(),
      appendRaccordo:       (text) => setRaccordoText    ((prev) => prev ? `${prev}\n\n${text}` : text),
      appendIntervalHistory:(text) => setIntervalHistory ((prev) => prev ? `${prev}\n\n${text}` : text),
      appendPhysicalExam:   (text) => setPhysicalExam    ((prev) => prev ? `${prev}\n\n${text}` : text),
      appendLabsImaging:    (text) => setLabsImaging     ((prev) => prev ? `${prev}\n\n${text}` : text),
      getExamJoints: () => _examRef.current.joints,
      getExamLei:    () => _examRef.current.lei,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div className="overflow-hidden" data-testid="today-visit-section">

      {/* ─── Header — identical style to WorkupVisitPage form header ─── */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading text-[#0A2540] text-[20px] font-bold">Visita di oggi</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{workflow.label} · Rivalutazione intervallare</p>
        </div>
        <ItalianDatePicker
          value={date}
          onChange={setDate}
          testid="today-visit-date"
        />
      </div>

      <div className="px-5 py-5 space-y-7">

        {/* hint riga checkbox */}
        <p className="text-[10px] text-gray-400 ml-[22px]">☐ = includi sezione nel referto</p>

        {/* ── 0 · Raccordo anamnestico reumatologico ── */}
        <SectionBlock
          number="0"
          title="Raccordo anamnestico reumatologico"
          subtitle="Sintesi della storia reumatologica del paziente — aggiornabile ad ogni visita."
          sectionKey="raccordo"
          reportChecked={reportSections.has("raccordo")}
          onToggleReport={toggleReportSection}
        >
          <InheritedFieldWrapper fieldKey="raccordoText" inheritedFields={inheritedFields} onMarkReviewed={markReviewed}>
            <SelectableTextArea
              value={raccordoText}
              onChange={e => { setRaccordoText(e.target.value); markReviewed('raccordoText'); }}
              placeholder="Paziente con storia di… — segue follow-up per…"
              rows={3}
              data-testid="today-raccordo-text"
              patientId={patient?.id}
              patient={patient}
              visitDate={date}
              enableLab={false}
              enableInstrumental={false}
              onTherapySaved={onTherapySaved}
              onClinimetrySaved={onClinimetrySaved}
              onAppendToPlan={onAppendToPlan}
            />
          </InheritedFieldWrapper>
        </SectionBlock>

        {/* ── 1 · Anamnesi intervallare ── */}
        <SectionBlock
          number="1"
          title="Anamnesi intervallare"
          subtitle="Evoluzione sintomi dall'ultima visita, nuovi disturbi, risposta a terapie."
          sectionKey="interval_history"
          reportChecked={reportSections.has("interval_history")}
          onToggleReport={toggleReportSection}
        >
          <div className="space-y-1">
            <InheritedFieldWrapper fieldKey="intervalHistory" inheritedFields={inheritedFields} onMarkReviewed={markReviewed}>
              <SelectableTextArea
                value={intervalHistory}
                onChange={e => { setIntervalHistory(e.target.value); markReviewed('intervalHistory'); }}
                placeholder="Dall'ultima visita il paziente riferisce…"
                rows={4}
                data-testid="today-interval-history"
                patientId={patient?.id}
                patient={patient}
                visitDate={date}
                enableLab={false}
                enableInstrumental={false}
                onTherapySaved={onTherapySaved}
                onClinimetrySaved={onClinimetrySaved}
                onAppendToPlan={onAppendToPlan}
              />
            </InheritedFieldWrapper>
            <TemplatePickerDialog
              category="rheumatic_history"
              currentText={intervalHistory}
              onSelect={(text) => { setIntervalHistory(prev => prev ? prev + "\n\n" + text : text); markReviewed('intervalHistory'); }}
            />
          </div>
        </SectionBlock>

        {/* ── 2 · Esame obiettivo ── */}
        <SectionBlock
          number="2"
          title="Esame obiettivo"
          subtitle="Articolazioni, apparati, parametri vitali — espandi solo le sezioni pertinenti."
          icon={Stethoscope}
          sectionKey="physical_exam"
          reportChecked={reportSections.has("physical_exam")}
          onToggleReport={toggleReportSection}
        >
          <PhysicalExamSection
            value={{ free_text: physicalExam, joint_exam: examJoints, systems: examSystems, mrss: examMrss, pasi: examPasi, lei: examLei }}
            onChange={({ free_text, joint_exam, systems, mrss, pasi, lei }) => {
              setPhysicalExam(free_text);
              setExamJoints(joint_exam);
              setExamSystems(systems);
              setExamMrss(mrss || {});
              setExamPasi(pasi || {});
              setExamLei(lei  || {});
            }}
            showLei={isSpaDiagnosis(patient)}
            showMrss={isScleroDiagnosis(patient)}
            showPasi={isSpaDiagnosis(patient)}
            data-testid="today-physical-exam"
            prevJointsData={prevJointsData}
            prevLeiData={prevLeiData}
          />
        </SectionBlock>

        {/* ── 3 · Esami / imaging ── */}
        <SectionBlock
          number="3"
          title="Esami / Imaging"
          subtitle="Risultati discussi in visita: laboratorio, radiologia, ecografia, RMN, TC."
          icon={FlaskConical}
          sectionKey="labs_imaging"
          reportChecked={reportSections.has("labs_imaging")}
          onToggleReport={toggleReportSection}
        >
          <div className="flex justify-end mb-1">
            <button
              type="button"
              onClick={() => setLabImportOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Camera className="w-3.5 h-3.5" /> Importa da foto / PDF
            </button>
          </div>
          <InheritedFieldWrapper fieldKey="labsImaging" inheritedFields={inheritedFields} onMarkReviewed={markReviewed}>
            <SelectableTextArea
              value={labsImaging}
              onChange={e => { setLabsImaging(e.target.value); markReviewed('labsImaging'); }}
              placeholder="VES, PCR, emocromo, ecografia articolare… — seleziona un valore per convertirlo in dato strutturato"
              rows={4}
              data-testid="today-labs-imaging"
              patientId={patient?.id}
              patient={patient}
              visitDate={date}
              onInsertToHistory={(text) =>
                setIntervalHistory(prev => prev ? prev + "\n\n" + text : text)
              }
              onTherapySaved={onTherapySaved}
              onClinimetrySaved={onClinimetrySaved}
              onAppendToPlan={onAppendToPlan}
            />
          </InheritedFieldWrapper>
        </SectionBlock>

        <LabImportFromImageDialog
          open={labImportOpen}
          onOpenChange={setLabImportOpen}
          patient={patient}
          onTextGenerated={(txt) => {
            setLabsImaging(prev => (prev ? prev + "\n" : "") + txt);
            markReviewed('labsImaging');
          }}
        />

        {/* ── 4 · Clinimetria — disease-specific scoring ── */}
        {workflow.clinimetryType != null && (
          <SectionBlock
            number="4"
            title={`Clinimetria — ${workflow.label}`}
            subtitle="Indici quantitativi di attività di malattia. Calcolo in tempo reale."
            icon={ClipboardList}
            sectionKey="clinimetria"
            reportChecked={reportSections.has("clinimetria")}
            onToggleReport={toggleReportSection}
          >
            {/* RA: accesso al Form unificato */}
            {workflow.clinimetryType === "ra_das28" && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-gray-400">
                  Inserisci TJC28/SJC28, VES/PCR e calcola DAS28/CDAI/SDAI tramite il Form unificato.
                </p>
                {onOpenJointCount && (
                  <Button type="button" variant="default" size="sm"
                    onClick={onOpenJointCount}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                    data-testid="open-ra-form-btn"
                  >
                    <Crosshair className="w-3.5 h-3.5 mr-1.5" /> Form unificato AR
                  </Button>
                )}
              </div>
            )}

            {/* SpA / PsA */}
            {workflow.clinimetryType === "spa_asdas" && (
              <div className="space-y-4">
                {!spaIsAxialOnly && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.12em]">Articolare periferico</span>
                        {spaHasPeripheral && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">PsA / SpA periferica</span>
                        )}
                      </div>
                      {onOpenPeripheralForm && (
                        <Button type="button" variant="default" size="sm"
                          onClick={onOpenPeripheralForm}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                          data-testid="open-peripheral-form-btn"
                        >
                          <Crosshair className="w-3.5 h-3.5 mr-1.5" /> Form unificato AP
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <FieldInput label="TJC" sub="0–68 art." val={spaTjc} set={setSpaTjc} max={68} testid="spa-tjc" />
                      <FieldInput label="SJC" sub="0–66 art." val={spaSjc} set={setSpaSjc} max={66} testid="spa-sjc" />
                      <FieldInput label="Dattiliti" sub="n. dita" val={spaDactylitis} set={setSpaDactylitis} max={20} testid="spa-dactylitis" />
                      <FieldInput label="Entesiti"  sub="n. sedi" val={spaEnthesitis} set={setSpaEnthesitis} max={13} testid="spa-enthesitis" />
                    </div>
                    <ClinimetryNote text="Inserimento rapido. Per valutazione completa con Homunculus usa 'Form unificato AP'." />
                  </div>
                )}

                {(!spaProfileKnown || spaHasAxial || !spaHasPeripheral) && (
                  <div className={!spaIsAxialOnly ? "border-t border-gray-100 pt-3" : ""}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.12em]">Componente assiale</span>
                        {spaIsAxialOnly && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">SpA assiale</span>
                        )}
                      </div>
                      {onOpenAxialForm && (
                        <Button type="button" variant="outline" size="sm"
                          onClick={onOpenAxialForm}
                          className="text-xs border-orange-300 text-orange-700 hover:bg-orange-50 flex-shrink-0"
                          data-testid="open-axial-form-btn"
                        >
                          <Crosshair className="w-3.5 h-3.5 mr-1.5" /> Form unificato SpA
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <FieldInput label="Lombalgia NRS"      sub="0–10" step="0.1" val={spaBack}   set={setSpaBack}   max={10} testid="spa-back" />
                      <FieldInput label="Rigidità mattutina" sub="0–10" step="0.1" val={spaStiff}  set={setSpaStiff}  max={10} testid="spa-stiff" />
                      <FieldInput label="Dolore periferico"  sub="0–10" step="0.1" val={spaPeriph} set={setSpaPeriph} max={10} testid="spa-periph" />
                      <FieldInput label="PGA paziente"       sub="0–10" step="0.1" val={spaPga}    set={setSpaPga}    max={10} testid="spa-pga" />
                      <FieldInput label="PCR"
                        sub={latestLabs.pcr ? `ultimo: ${latestLabs.pcr.value} ${latestLabs.pcr.unit}` : "mg/L"}
                        val={spaPcr} set={setSpaPcr} step="0.1"
                        hint={latestLabs.pcr ? () => setSpaPcr(String(latestLabs.pcr.value)) : null}
                        testid="spa-pcr" />
                    </div>
                    <ClinimetryNote text="Inserimento rapido. Per BASDAI + BASFI completi usa 'Form unificato SpA'." />
                    {asdas != null && (
                      <div className="mt-3 grid grid-cols-2 gap-3" data-testid="spa-scores">
                        <ScoreCard label="ASDAS-CRP" value={asdas} interp={interpretASDAS(asdas)} />
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex flex-col justify-center text-center">
                          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Soglie ASDAS</div>
                          <div className="text-[11px] text-gray-600 leading-snug">&lt;1.3 Inattiva · 1.3–2.1 Bassa<br />2.1–3.5 Alta · &gt;3.5 Molto alta</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PMR / GCA */}
            {workflow.clinimetryType === "pmr_quick" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <FieldInput
                    label="VES / ESR"
                    sub={latestLabs.ves ? `ultimo: ${latestLabs.ves.value} mm/h` : "mm/h"}
                    val={pmrEsr} set={setPmrEsr} step="1" max={150}
                    hint={latestLabs.ves ? () => setPmrEsr(String(latestLabs.ves.value)) : null}
                    testid="pmr-esr"
                  />
                  <FieldInput
                    label="PCR / CRP"
                    sub={latestLabs.pcr ? `ultimo: ${latestLabs.pcr.value} ${latestLabs.pcr.unit}` : "mg/L"}
                    val={pmrPcr} set={setPmrPcr} step="0.1"
                    hint={latestLabs.pcr ? () => setPmrPcr(String(latestLabs.pcr.value)) : null}
                    testid="pmr-pcr"
                  />
                  <FieldInput label="Dose steroide" sub="mg/die" step="0.5" val={pmrSteroid} set={setPmrSteroid} max={60} testid="pmr-steroid" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput label="Dolore VAS"         sub="0–10" step="0.1" val={pmrPain}  set={setPmrPain}  max={10}  testid="pmr-pain" />
                  <FieldInput label="Rigidità mattutina" sub="minuti"           val={pmrStiff} set={setPmrStiff} max={300} testid="pmr-stiff" />
                </div>
                {(hasVal(pmrEsr) || hasVal(pmrPcr)) && (
                  <div className="flex flex-wrap gap-2">
                    {hasVal(pmrEsr) && (
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                        safe(pmrEsr) > 40 ? "bg-red-50 border-red-200 text-red-700"
                          : safe(pmrEsr) > 20 ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "bg-green-50 border-green-200 text-green-700"
                      }`}>
                        VES {pmrEsr} mm/h {safe(pmrEsr) > 40 ? "↑" : safe(pmrEsr) > 20 ? "↗" : "✓"}
                      </span>
                    )}
                    {hasVal(pmrPcr) && (
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                        safe(pmrPcr) > 10 ? "bg-red-50 border-red-200 text-red-700"
                          : safe(pmrPcr) > 5 ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "bg-green-50 border-green-200 text-green-700"
                      }`}>
                        PCR {pmrPcr} mg/L {safe(pmrPcr) > 10 ? "↑" : safe(pmrPcr) > 5 ? "↗" : "✓"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Fibromyalgia */}
            {workflow.clinimetryType === "fibro_quick" && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-3">
                  <FieldInput label="Dolore"        sub="0–10 VAS" step="0.1" val={fibroPain}    set={setFibroPain}    max={10} testid="fibro-pain" />
                  <FieldInput label="Affaticamento" sub="0–10 VAS" step="0.1" val={fibroFatigue} set={setFibroFatigue} max={10} testid="fibro-fatigue" />
                  <FieldInput label="Qualità sonno" sub="0–10 VAS" step="0.1" val={fibroSleep}   set={setFibroSleep}   max={10} testid="fibro-sleep" />
                </div>
                <ClinimetryNote text="Per FIQR completo (19 item) usa 'Nuova valutazione'. Ricordare la natura non infiammatoria nel referto." />
              </div>
            )}

            {/* Myositis */}
            {workflow.clinimetryType === "myositis_quick" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput label="Forza muscolare sogg." sub="0–10 (10=normale)" step="0.1" val={myoStrength} set={setMyoStrength} max={10} testid="myo-strength" />
                  <FieldInput label="CK"
                    sub={latestLabs.ck ? `ultimo: ${latestLabs.ck.value} ${latestLabs.ck.unit}` : "IU/L"}
                    val={myoCk} set={setMyoCk} step="1"
                    hint={latestLabs.ck ? () => setMyoCk(String(latestLabs.ck.value)) : null}
                    testid="myo-ck" />
                </div>
                <ClinimetryNote text="Per MMT-8 completo usa 'Nuova valutazione'. Alert: disfagia, dispnea (ILD) → monitoraggio stretto." />
              </div>
            )}

            {/* Osteoporosis */}
            {workflow.clinimetryType === "osteo_quick" && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {[
                    "Aderenza terapia anti-fratturativa",
                    "Effetti collaterali bifosfonati / denosumab",
                    "Supplementazione calcio e vitamina D",
                    "Ultima DXA registrata",
                    "Rischio cadute valutato",
                  ].map(item => (
                    <label key={item} className="flex items-center gap-2 text-gray-700 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
                {latestLabs.vit_d && (
                  <p className="text-[11px] text-gray-500 mt-2">
                    Ultima vitamina D: {latestLabs.vit_d.value} {latestLabs.vit_d.unit}
                  </p>
                )}
              </div>
            )}
          </SectionBlock>
        )}

        {/* ── LVV / GCA: vascular imaging (standalone) ── */}
        {(isLvvDiagnosis(patient) || isPmrDiagnosis(patient)) && (onOpenVascularImaging || onOpenPetvas) && (
          <SectionBlock
            number="4b"
            title="Imaging vascolare"
            subtitle="PET/TC · Ecodoppler · AngioCT · AngioMRI — confluiscono nella stessa timeline longitudinale."
          >
            <VascularImagingSection
              instrumentalExams={instrumentalExams}
              onOpenVascularImaging={onOpenVascularImaging ?? ((type) => type === "petvas" && onOpenPetvas?.())}
            />
          </SectionBlock>
        )}

        {/* ── 5 (or 4) · Assessment / Note di visita ── */}
        <SectionBlock
          number={assessmentSectionNum}
          title="Conclusioni"
          subtitle="Impressione clinica, sintomi attuali, note per il referto."
          sectionKey="assessment"
          reportChecked={reportSections.has("assessment")}
          onToggleReport={toggleReportSection}
        >
          <div className="space-y-3">
            {/* PMR/GCA activity level */}
            {workflow.clinimetryType === "pmr_quick" && (
              <div>
                <p className="text-[11px] text-gray-500 font-medium mb-2">Valutazione attività di malattia — impressione clinica</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { v: "clinical_remission",     l: "Remissione clinica",                      cls: "text-green-700  border-green-300  bg-green-50" },
                    { v: "suspected_pmr_activity", l: "Sospetta attività PMR",                   cls: "text-amber-700  border-amber-300  bg-amber-50" },
                    { v: "suspected_cranial_gca",  l: "Sospetta GCA cranica attiva",             cls: "text-red-700    border-red-300    bg-red-50"   },
                    { v: "suspected_lvv_activity", l: "Sospetta LVV extracranica attiva",        cls: "text-purple-700 border-purple-300 bg-purple-50" },
                    { v: "damage_no_activity",     l: "Danno/sequele — malattia non attiva",     cls: "text-gray-700   border-gray-300   bg-gray-50"  },
                    { v: "alternative_cause",      l: "Causa alternativa / infezione più prob.", cls: "text-orange-700 border-orange-300 bg-orange-50" },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setPmrActivityLevel(v => v === opt.v ? "" : opt.v)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                        pmrActivityLevel === opt.v
                          ? opt.cls + " ring-2 ring-offset-1 ring-current shadow-sm"
                          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100"
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
                <ClinimetryNote text="Alert GCA: cefalea nuova, claudicatio mascellare, disturbi visivi, diplopia → derivazione urgente." />
              </div>
            )}

            {/* Note cliniche */}
            <InheritedFieldWrapper fieldKey="note" inheritedFields={inheritedFields} onMarkReviewed={markReviewed}>
              <Textarea
                value={note}
                onChange={e => { setNote(e.target.value); markReviewed('note'); }}
                onFocus={() => markReviewed('note')}
                placeholder="Impressione complessiva, variazioni significative, confronto con visita precedente…"
                rows={4}
                data-testid="today-visit-note"
              />
            </InheritedFieldWrapper>
          </div>
        </SectionBlock>

        {/* ── No structured clinimetry notice ── */}
        {workflow.clinimetryType == null && (
          <p className="text-[11px] text-gray-400 italic text-center">
            Usa <strong>Nuova valutazione</strong> per aggiungere indici di attività specifici per {workflow.label}.
          </p>
        )}


      </div>
    </div>

    {reportModalOpen && <FollowUpReportModal
      open={reportModalOpen}
      onClose={() => setReportModalOpen(false)}
      patient={patient}
      date={date}
      workflow={workflow}
      reportSections={reportSections}
      raccordoText={raccordoText}
      cockpitData={cockpitData}
      cockpitReportSections={cockpitReportSections}
      intervalHistory={intervalHistory}
      physicalExam={physicalExam}
      examJoints={examJoints}
      examSystems={examSystems}
      examMrss={examMrss}
      examPasi={examPasi}
      examLei={examLei}
      labsImaging={labsImaging}
      note={note}
      symptoms={symptoms}
      symptomDefs={symptomDefs}
      das28crp={das28crp}
      das28esr={das28esr}
      cdai={cdai}
      sdai={sdai}
      asdas={asdas}
      dapsa={dapsa}
      tjc={tjc} sjc={sjc} gh={gh} ega={ega} pcr={pcr} ves={ves}
      spaBack={spaBack} spaStiff={spaStiff} spaPeriph={spaPeriph}
      spaPga={spaPga} spaPcr={spaPcr} spaTjc={spaTjc} spaSjc={spaSjc}
      spaDactylitis={spaDactylitis} spaEnthesitis={spaEnthesitis}
      pmrEsr={pmrEsr} pmrPcr={pmrPcr} pmrSteroid={pmrSteroid}
      pmrPain={pmrPain} pmrStiff={pmrStiff} pmrActivityLevel={pmrActivityLevel}
      fibroPain={fibroPain} fibroFatigue={fibroFatigue} fibroSleep={fibroSleep}
      myoStrength={myoStrength} myoCk={myoCk}
      planIndicazioni={planData?.indicazioni}
      planFurtherIndications={planData?.furtherIndications}
      planReportSections={planData?.planReportSections || new Set()}
    />}
    </>
  );
}
