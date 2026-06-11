/**
 * SelectableTextArea
 *
 * Drop-in Textarea wrapper that detects text selection and shows a
 * "Save selection as…" action menu (SelectionActionMenu) with the following
 * options:
 *
 *   Save group:
 *     • Valore di laboratorio          → TextToDataModal
 *     • Reperto strumentale            → InstrumentalFindingModal
 *     • Nota clinica (problema / …)    → QuickClinicalNoteModal
 *
 *   Insert group:
 *     • Inserisci nell'anamnesi        → onInsertToHistory callback
 *     • Inserisci nel referto          → onInsertToReport callback
 *     • Copia negli appunti            → clipboard
 *
 * Props (plus all standard <textarea> props forwarded):
 *   patientId          string
 *   patient            object    — full patient (for disease detection in InstrumentalFindingModal)
 *   visitDate          string    — ISO date
 *   enableLab          boolean   — show lab extraction (default true)
 *   enableInstrumental boolean   — show instrumental finding (default true)
 *   onDataSaved        (count) => void
 *   onFindingSaved     (assessment) => void
 *   onInsertToHistory  (text) => void  — appends to anamnesi intervallare
 *   onInsertToReport   (text) => void  — appends to today's report
 */

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Textarea } from "../ui/textarea";
import {
  Database, ScanSearch, FileText, ArrowDownToLine, Copy, ClipboardPaste, Dna, Stethoscope, Pill, BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import { extractLabValues } from "../../lib/labValueExtractor";
import { extractSscAntibodies } from "../../lib/sscAntibodyParser";
import TextToDataModal             from "./TextToDataModal";
import InstrumentalFindingModal    from "../labs/InstrumentalFindingModal";
import QuickClinicalNoteModal      from "../visits/QuickClinicalNoteModal";
import QuickSpecialistVisitModal   from "../specialist/QuickSpecialistVisitModal";
import QuickTherapyModal           from "../therapy/QuickTherapyModal";
import QuickClinimetryImportModal  from "./QuickClinimetryImportModal";
import DiseaseProfileUpdateModal   from "../profiles/DiseaseProfileUpdateModal";
import SelectionActionMenu         from "./SelectionActionMenu";
import { isScleroDiagnosis }     from "../profiles/ScleroProfileSection";
import { isRaDiagnosis }         from "../../lib/diseaseDetection";
import { isSteroide, detectSteroide } from "../../lib/steroidTapering";
import SteroidTaperingModal      from "../therapy/SteroidTaperingModal";

export default function SelectableTextArea({
  patientId,
  patient,
  visitDate,
  enableLab          = true,
  enableInstrumental = true,
  enableTherapy      = true,
  onDataSaved,
  onFindingSaved,
  onInsertToHistory,
  onInsertToReport,
  onTherapySaved,
  onClinimetrySaved,
  onAppendToPlan,
  ...textareaProps
}) {
  const textareaRef   = useRef(null);
  const containerRef  = useRef(null);

  const [sel,            setSel]           = useState({ text: "", active: false, selStart: 0, selEnd: 0 });
  const [labModal,       setLabModal]      = useState({ open: false, matches: [], sscMatches: [] });
  const [instrModal,     setInstrModal]    = useState({ open: false, src: "" });
  const [clinicalModal,  setClinicalModal] = useState({ open: false, src: "" });
  const [profileModal,   setProfileModal]  = useState({ open: false, src: "" });
  const [specialistModal,setSpecialistModal] = useState({ open: false, src: "" });
  const [therapyModal,       setTherapyModal]      = useState({ open: false, src: "" });
  const [clinimetryModal,    setClinimetryModal]   = useState({ open: false, src: "" });
  const [taperingModal,      setTaperingModal]     = useState({ open: false, drug: "prednisone" });

  // Determine if this patient has a disease profile that can be quick-updated
  const hasProfileDisease = patient && (isScleroDiagnosis(patient) || isRaDiagnosis(patient));

  // ── Selection detection ──────────────────────────────────────────────────────

  const checkSelection = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd, value } = ta;
    if (selectionEnd > selectionStart) {
      // Compute fixed-position coords anchored below-right of the textarea
      const rect = ta.getBoundingClientRect();
      const menuW = 340;
      const menuH = 320;
      let left = rect.right - menuW;
      if (left < 8) left = 8;
      let top = rect.bottom + 6;
      if (top + menuH > window.innerHeight - 8) {
        top = rect.top - menuH - 6;
        if (top < 8) top = 8;
      }
      setSel({ text: value.substring(selectionStart, selectionEnd).trim(), active: true, pos: { top, left }, selStart: selectionStart, selEnd: selectionEnd });
    } else {
      setSel({ text: "", active: false, pos: null, selStart: 0, selEnd: 0 });
    }
  }, []);

  // Close menu on outside click — also exclude portal (.sam-portal) clicks
  useEffect(() => {
    if (!sel.active) return;
    const handler = (e) => {
      if (
        !containerRef.current?.contains(e.target) &&
        !e.target.closest?.(".sam-portal")
      ) {
        setSel({ text: "", active: false });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sel.active]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  function handleLab() {
    const sscMatches = isScleroDiagnosis(patient)
      ? extractSscAntibodies(sel.text)
      : [];
    setLabModal({ open: true, matches: extractLabValues(sel.text), sscMatches });
  }
  function closeLabModal() {
    setLabModal({ open: false, matches: [], sscMatches: [] });
    setSel({ text: "", active: false });
  }

  function handleInstrumental() { setInstrModal({ open: true, src: sel.text }); }
  function closeInstrModal() {
    setInstrModal({ open: false, src: "" });
    setSel({ text: "", active: false });
  }

  function handleClinicalNote() { setClinicalModal({ open: true, src: sel.text }); }
  function closeClinicalModal() {
    setClinicalModal({ open: false, src: "" });
    setSel({ text: "", active: false });
  }

  function handleInsertToHistory() {
    if (!sel.text || !onInsertToHistory) return;
    onInsertToHistory(sel.text);
    toast.success("Testo aggiunto all'anamnesi intervallare");
    setSel({ text: "", active: false });
  }

  function handleInsertToReport() {
    if (!sel.text || !onInsertToReport) return;
    onInsertToReport(sel.text);
    toast.success("Testo aggiunto al referto");
    setSel({ text: "", active: false });
  }

  function handleCopy() {
    if (!sel.text) return;
    navigator.clipboard.writeText(sel.text)
      .then(() => toast.success("Copiato negli appunti"))
      .catch(() => toast.error("Impossibile copiare"));
    setSel({ text: "", active: false });
  }

  function handleProfileUpdate() {
    setProfileModal({ open: true, src: sel.text });
  }
  function closeProfileModal() {
    setProfileModal({ open: false, src: "" });
    setSel({ text: "", active: false });
  }

  function handleSpecialistVisit() { setSpecialistModal({ open: true, src: sel.text }); }
  function closeSpecialistModal() {
    setSpecialistModal({ open: false, src: "" });
    setSel({ text: "", active: false });
  }

  function handleTherapy() { setTherapyModal({ open: true, src: sel.text }); }
  function closeTherapyModal() {
    setTherapyModal({ open: false, src: "" });
    setSel({ text: "", active: false });
  }

  function handleTapering() {
    setTaperingModal({ open: true, drug: detectSteroide(sel.text) || "prednisone" });
    setSel({ text: "", active: false });
  }
  function closeTaperingModal() { setTaperingModal({ open: false, drug: "prednisone" }); }

  function handleClinimetryImport() { setClinimetryModal({ open: true, src: sel.text }); }
  function closeClinimetryModal() {
    setClinimetryModal({ open: false, src: "" });
    setSel({ text: "", active: false });
  }

  // ── Build action list ────────────────────────────────────────────────────────

  const actions = [
    enableLab && {
      key: "lab", label: "Valore di laboratorio",
      icon: Database, color: "#4f46e5", bg: "#f5f3ff", group: "save",
      handler: handleLab,
    },
    enableInstrumental && {
      key: "instrumental", label: "Reperto strumentale",
      icon: ScanSearch, color: "#0f766e", bg: "#f0fdfa", group: "save",
      handler: handleInstrumental,
    },
    {
      key: "clinical_note", label: "Nota clinica (problema / storia / comorbidità…)",
      icon: FileText, color: "#7c3aed", bg: "#faf5ff", group: "save",
      handler: handleClinicalNote,
    },
    enableTherapy && {
      key: "therapy", label: "Terapia (in corso / modifica / storico)",
      icon: Pill, color: "#16a34a", bg: "#f0fdf4", group: "save",
      handler: handleTherapy,
    },
    enableTherapy && isSteroide(sel.text) && {
      key: "tapering", label: "Piano di scalaggio steroide",
      icon: Pill, color: "#d97706", bg: "#fffbeb", group: "save",
      handler: handleTapering,
    },
    {
      key: "clinimetry_import", label: "Importa valore clinimetria (DAS28, BASDAI, DAPSA…)",
      icon: BarChart2, color: "#0891b2", bg: "#ecfeff", group: "save",
      handler: handleClinimetryImport,
    },
    {
      key: "specialist_visit", label: "Visita specialistica",
      icon: Stethoscope, color: "#0f766e", bg: "#f0fdfa", group: "save",
      handler: handleSpecialistVisit,
    },
    hasProfileDisease && {
      key: "profile_import", label: "Aggiorna profilo malattia",
      icon: Dna, color: "#be185d", bg: "#fdf2f8", group: "save",
      handler: handleProfileUpdate,
    },
    onInsertToHistory && {
      key: "insert_history", label: "Inserisci nell'anamnesi intervallare",
      icon: ArrowDownToLine, color: "#0284c7", bg: "#f0f9ff", group: "insert",
      handler: handleInsertToHistory,
    },
    onInsertToReport && {
      key: "insert_report", label: "Inserisci nel referto odierno",
      icon: ClipboardPaste, color: "#0891b2", bg: "#ecfeff", group: "insert",
      handler: handleInsertToReport,
    },
    {
      key: "copy", label: "Copia negli appunti",
      icon: Copy, color: "#6b7280", bg: "#f9fafb", group: "insert",
      handler: handleCopy,
    },
  ].filter(Boolean);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <Textarea
        ref={textareaRef}
        onMouseUp={checkSelection}
        onKeyUp={checkSelection}
        onSelect={checkSelection}
        {...textareaProps}
      />

      {/* ── Floating action menu ─────────────────────────────────────────── */}
      {sel.active && sel.text && sel.pos && (
        <SelectionActionMenu
          actions={actions}
          onClose={() => setSel({ text: "", active: false, pos: null })}
          style={sel.pos}
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <TextToDataModal
        open={labModal.open}
        onClose={closeLabModal}
        matches={labModal.matches}
        sscMatches={labModal.sscMatches}
        patientId={patientId}
        patient={patient}
        visitDate={visitDate}
        onSaved={count => onDataSaved?.(count)}
      />

      <InstrumentalFindingModal
        open={instrModal.open}
        onClose={closeInstrModal}
        sourceText={instrModal.src}
        patientId={patientId}
        patient={patient}
        visitDate={visitDate}
        onSaved={a => onFindingSaved?.(a)}
      />

      <QuickClinicalNoteModal
        open={clinicalModal.open}
        onClose={closeClinicalModal}
        sourceText={clinicalModal.src}
        patientId={patientId}
        visitDate={visitDate}
        onSaved={() => {}}
      />

      <DiseaseProfileUpdateModal
        open={profileModal.open}
        onClose={closeProfileModal}
        sourceText={profileModal.src}
        patient={patient}
      />

      <QuickSpecialistVisitModal
        open={specialistModal.open}
        onClose={closeSpecialistModal}
        sourceText={specialistModal.src}
        patientId={patientId}
        visitDate={visitDate}
        onSaved={() => {}}
      />

      <QuickTherapyModal
        open={therapyModal.open}
        onClose={closeTherapyModal}
        sourceText={therapyModal.src}
        patientId={patientId}
        patient={patient}
        visitDate={visitDate}
        onAppendToPlan={onAppendToPlan}
        onSaved={(name) => { onTherapySaved?.(name); }}
        onExpand={(newText) => {
          const ta = textareaRef.current;
          if (!ta || !textareaProps.onChange) return;
          const oldVal = ta.value;
          const newVal = oldVal.substring(0, sel.selStart) + newText + oldVal.substring(sel.selEnd);
          textareaProps.onChange({ target: { value: newVal } });
          setSel({ text: "", active: false, selStart: 0, selEnd: 0, pos: null });
        }}
      />

      <QuickClinimetryImportModal
        open={clinimetryModal.open}
        onClose={closeClinimetryModal}
        sourceText={clinimetryModal.src}
        patientId={patientId}
        visitDate={visitDate}
        onSaved={() => {
          onClinimetrySaved?.();
        }}
      />

      <SteroidTaperingModal
        open={taperingModal.open}
        onClose={closeTaperingModal}
        initialDrug={taperingModal.drug}
        visitDate={visitDate}
        onAppendToPlan={onAppendToPlan}
      />
    </div>
  );
}
