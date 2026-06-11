/**
 * SelectableTextBlock
 *
 * A self-contained, read-only text block that supports the full
 * "Save selection as…" workflow without requiring the parent to manage
 * any modal state.
 *
 * Actions available when text is selected:
 *   • Nota clinica (problema / storia / comorbidità…)  → QuickClinicalNoteModal
 *   • Aggiorna profilo malattia                        → DiseaseProfileUpdateModal
 *     (shown only when patient has SSc or AR diagnosis)
 *   • Inserisci in una sezione del referto              → inline section-chip picker
 *     (requires onInsertToSection + insertSections props)
 *   • Inserisci nell'anamnesi intervallare              → legacy single-target insert
 *     (used when only onInsertToHistory is provided)
 *   • Copia negli appunti                               → clipboard
 *   • Archivia in Esami di laboratorio                  → LabImportDialog (AI parse)
 *   • Archivia in Esami strumentali                     → InstrumentalFindingModal
 *   • Archivia in Visite specialistiche                 → VisitModal
 *
 * Props:
 *   text               string    — the text to display (rendered as <p>)
 *   paragraphClass     string    — extra className for the <p> element
 *   patient            object    — full patient { id, diagnosi, diagnosi_secondarie }
 *                                  (needed for DiseaseProfileUpdateModal)
 *   patientId          string    — needed for QuickClinicalNoteModal (fallback if no patient)
 *   visitDate          string    — ISO date pre-fill for saving
 *   onInsertToSection  (text: string, sectionKey: string) => void
 *                                 Section-aware insert. When provided, shows chip picker.
 *   insertSections     [{key, label, color}]   — sections to pick from
 *   onInsertToHistory  (text: string) => void  — legacy single-target insert fallback
 */

import React, { useState } from "react";
import { FileText, ArrowDownToLine, Copy, Dna, ScanSearch, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import SelectableText            from "./SelectableText";
import QuickClinicalNoteModal    from "../visits/QuickClinicalNoteModal";
import DiseaseProfileUpdateModal from "../profiles/DiseaseProfileUpdateModal";
import InstrumentalFindingModal  from "../labs/InstrumentalFindingModal";

import { VisitModal }            from "../specialist/SpecialistVisitsSection";
import { isScleroDiagnosis }     from "../profiles/ScleroProfileSection";
import { isRaDiagnosis }         from "../../lib/diseaseDetection";

export default function SelectableTextBlock({
  text,
  paragraphClass = "text-xs text-gray-700 whitespace-pre-wrap leading-relaxed",
  patient,
  patientId,
  visitDate,
  onInsertToSection,
  insertSections = [],
  onInsertToHistory,
}) {
  const [clinicalModal,     setClinicalModal]     = useState({ open: false, src: "" });
  const [profileModal,      setProfileModal]      = useState({ open: false, src: "" });
  const [instrModal,        setInstrModal]        = useState({ open: false, src: "" });
  const [specialistModal,   setSpecialistModal]   = useState({ open: false, src: "" });

  // Resolve patientId from patient object if not explicitly provided
  const resolvedPatientId = patientId || patient?.id;

  // Show disease profile action only when patient has a supported diagnosis
  const hasProfileDisease = patient && (isScleroDiagnosis(patient) || isRaDiagnosis(patient));

  function makeActions(selectedText) {
    const hasSectionInsert = typeof onInsertToSection === "function" && insertSections.length > 0;
    const hasLegacyInsert  = typeof onInsertToHistory === "function" && !hasSectionInsert;

    return [
      // ── Save group ─────────────────────────────────────────────────────
      {
        key:     "clinical_note",
        label:   "Nota clinica (problema / storia / comorbidità…)",
        icon:    FileText,
        color:   "#7c3aed",
        bg:      "#faf5ff",
        group:   "save",
        handler: () => setClinicalModal({ open: true, src: selectedText }),
      },

      hasProfileDisease && {
        key:     "profile_import",
        label:   "Aggiorna profilo malattia",
        icon:    Dna,
        color:   "#be185d",
        bg:      "#fdf2f8",
        group:   "save",
        handler: () => setProfileModal({ open: true, src: selectedText }),
      },

      // ── Insert group: section-aware ────────────────────────────────────
      hasSectionInsert && {
        key:      "section_insert",
        type:     "section_picker",
        label:    "Sezione di destinazione",
        group:    "insert",
        sections: insertSections,
        handler:  (sectionKey) => {
          onInsertToSection(selectedText, sectionKey);
          const sec = insertSections.find(s => s.key === sectionKey);
          toast.success(`Testo inserito in: ${sec?.label || sectionKey}`);
        },
      },

      // ── Insert group: legacy single-target ─────────────────────────────
      hasLegacyInsert && {
        key:     "insert_history",
        label:   "Inserisci nell'anamnesi intervallare",
        icon:    ArrowDownToLine,
        color:   "#0284c7",
        bg:      "#f0f9ff",
        group:   "insert",
        handler: () => {
          onInsertToHistory(selectedText);
          toast.success("Testo aggiunto all'anamnesi intervallare");
        },
      },

      // ── Copy ───────────────────────────────────────────────────────────
      {
        key:     "copy",
        label:   "Copia negli appunti",
        icon:    Copy,
        color:   "#6b7280",
        bg:      "#f9fafb",
        group:   "insert",
        handler: () =>
          navigator.clipboard
            .writeText(selectedText)
            .then(() => toast.success("Copiato negli appunti"))
            .catch(() => toast.error("Impossibile copiare")),
      },

      // ── Archive group ───────────────────────────────────────────────────
      resolvedPatientId && {
        key:     "archive_strumentali",
        label:   "Esami strumentali",
        icon:    ScanSearch,
        color:   "#b45309",
        bg:      "#fffbeb",
        group:   "archive",
        handler: () => setInstrModal({ open: true, src: selectedText }),
      },

      resolvedPatientId && {
        key:     "archive_specialist",
        label:   "Visite specialistiche",
        icon:    Stethoscope,
        color:   "#7c3aed",
        bg:      "#f5f3ff",
        group:   "archive",
        handler: () => setSpecialistModal({ open: true, src: selectedText }),
      },
    ].filter(Boolean);
  }

  return (
    <>
      <SelectableText makeActions={makeActions}>
        <p className={paragraphClass}>{text}</p>
      </SelectableText>

      {/* ── Nota clinica ── */}
      <QuickClinicalNoteModal
        open={clinicalModal.open}
        onClose={() => setClinicalModal({ open: false, src: "" })}
        sourceText={clinicalModal.src}
        patientId={resolvedPatientId}
        visitDate={visitDate}
        onSaved={() => {}}
      />

      {/* ── Profilo malattia ── */}
      <DiseaseProfileUpdateModal
        open={profileModal.open}
        onClose={() => setProfileModal({ open: false, src: "" })}
        sourceText={profileModal.src}
        patient={patient}
      />

      {/* ── Esami strumentali ── */}
      <InstrumentalFindingModal
        open={instrModal.open}
        onClose={() => setInstrModal({ open: false, src: "" })}
        sourceText={instrModal.src}
        patientId={resolvedPatientId}
        patient={patient}
        visitDate={visitDate || new Date().toISOString().slice(0, 10)}
        onSaved={() => {}}
      />

      {/* ── Visite specialistiche ── */}
      <VisitModal
        open={specialistModal.open}
        visit={null}
        prefill={{ source_text: specialistModal.src }}
        patientId={resolvedPatientId}
        onClose={() => setSpecialistModal({ open: false, src: "" })}
        onSaved={() => setSpecialistModal({ open: false, src: "" })}
      />
    </>
  );
}
