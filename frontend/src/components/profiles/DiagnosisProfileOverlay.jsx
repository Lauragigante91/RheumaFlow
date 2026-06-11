/**
 * DiagnosisProfileOverlay
 *
 * Fullscreen overlay that opens FROM the workup visit to let the physician:
 *   1. Fill the disease profile (SpA, RA, LES…) — stays associated with the patient
 *   2. Record baseline clinimetrics (BASDAI, DAS28, DAPSA…) for the current visit
 *
 * The workup visit itself is NOT converted — it stays as "workup diagnostico".
 * On close the parent is notified (onClose) and optionally informed that clinimetrics
 * were saved (onClinimetrySaved) so it can reflect that in the visit form.
 *
 * Props:
 *   open             boolean
 *   onClose          () => void
 *   patient          object  { id, diagnosi, … }
 *   diseaseKey       "ra" | "spa" | "psa" | "sle" | "sclero" | "myositis" | "sjogren" | "aav" | "pmr"
 *   onClinimetrySaved (indexTypes: string[]) => void  — called after saving clinimetrics
 */

import React, { useState, useEffect } from "react";
import { X, Activity, Check, ClipboardList, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";

import SpaProfileSection     from "./SpaProfileSection";
import RaProfileSection      from "./RaProfileSection";
import SleProfileSection     from "./SleProfileSection";
import ScleroProfileSection  from "./ScleroProfileSection";
import MyositisProfileSection from "./MyositisProfileSection";
import SjogrenProfileSection from "./SjogrenProfileSection";
import AavProfileSection     from "./AavProfileSection";
import PmrLvvProfileSection  from "./PmrLvvProfileSection";
import CompositeAssessmentDialog from "../clinical/CompositeAssessmentDialog";

// ─── Disease configuration ────────────────────────────────────────────────────

const DISEASE_CONFIG = {
  ra: {
    label:        "Artrite Reumatoide",
    color:        "#1d4ed8",
    Section:      RaProfileSection,
    compositeMode: "ra",
    indicesLabel: "DAS28-CRP · DAS28-ESR · CDAI · SDAI",
    indicesHint:  "Indici di attività AR — conteggio articolare, PCR/VES, PGA",
  },
  spa: {
    label:        "Spondiloartrite",
    color:        "#ea580c",
    Section:      SpaProfileSection,
    compositeMode: "spa",
    indicesLabel: "BASDAI · ASDAS-CRP · BASFI",
    indicesHint:  "Attività e funzionalità SpA assiale / periferica",
  },
  psa: {
    label:        "Artrite Psoriasica",
    color:        "#16a34a",
    Section:      SpaProfileSection,
    compositeMode: "psa",
    indicesLabel: "DAPSA · LEI · PASI",
    indicesHint:  "Attività PsA — dominio articolare periferico, entesite e cute",
  },
  sle: {
    label:        "LES",
    color:        "#7c3aed",
    Section:      SleProfileSection,
    compositeMode: null,
    indicesLabel: null,
    indicesHint:  null,
  },
  sclero: {
    label:        "Sclerodermia (SSc)",
    color:        "#db2777",
    Section:      ScleroProfileSection,
    compositeMode: null,
    indicesLabel: null,
    indicesHint:  null,
  },
  myositis: {
    label:        "Miosite infiammatoria",
    color:        "#d97706",
    Section:      MyositisProfileSection,
    compositeMode: null,
    indicesLabel: null,
    indicesHint:  null,
  },
  sjogren: {
    label:        "Sindrome di Sjögren",
    color:        "#0891b2",
    Section:      SjogrenProfileSection,
    compositeMode: null,
    indicesLabel: null,
    indicesHint:  null,
  },
  aav: {
    label:        "Vasculite ANCA (AAV)",
    color:        "#b91c1c",
    Section:      AavProfileSection,
    compositeMode: null,
    indicesLabel: null,
    indicesHint:  null,
  },
  pmr: {
    label:        "PMR / GCA",
    color:        "#be185d",
    Section:      PmrLvvProfileSection,
    compositeMode: null,
    indicesLabel: null,
    indicesHint:  null,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiagnosisProfileOverlay({
  open,
  onClose,
  patient,
  diseaseKey,
  visitId,
  visitType,
  visitDate,
  onClinimetrySaved,
  context = "workup",
  initialJoints,
}) {
  const [clinOpen, setClinOpen]   = useState(false);
  const [clinSaved, setClinSaved] = useState(false);

  // Reset clinSaved when a different disease is opened
  useEffect(() => { setClinSaved(false); }, [diseaseKey]);

  // Lock body scroll while overlay is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const cfg = DISEASE_CONFIG[diseaseKey];
  if (!cfg) return null;

  const { label, color, Section, compositeMode, indicesLabel, indicesHint } = cfg;

  const handleClinSaved = (savedIndexTypes) => {
    setClinSaved(true);
    setClinOpen(false);
    onClinimetrySaved?.(savedIndexTypes);
  };

  return (
    <>
      {/* ── Fullscreen overlay (z-5000, below Radix Dialog portals at z-10000) ── */}
      <div
        className="fixed inset-0 flex flex-col bg-white"
        style={{ zIndex: 5000 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0 text-white"
          style={{ background: color }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <ClipboardList className="w-5 h-5 shrink-0" />
            <span className="font-bold text-base tracking-tight">Profilo di malattia</span>
            <ChevronRight className="w-4 h-4 opacity-60 shrink-0" />
            <span className="font-semibold text-sm opacity-90 truncate">{label}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="hidden sm:block text-xs opacity-70 font-medium">
              {context === "prima_visita"
                ? "Diagnosi definitiva — il paziente passerà in follow-up"
                : "La visita resta in workup — nessuna conversione"}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/20 transition-colors"
              title="Chiudi overlay"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

              {/* ── Left: disease profile section ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-4">
                  Caratterizzazione clinica · {label}
                </p>
                <Section patient={patient} onUpdated={() => {}} />
              </div>

              {/* ── Right: clinimetrie baseline + close CTA ── */}
              <div className="space-y-4">
                {/* Clinimetrie panel */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-3">
                    Clinimetrie baseline
                  </p>

                  {compositeMode ? (
                    <div
                      className="rounded-xl border p-4 space-y-3"
                      style={{
                        borderColor: color + "44",
                        background:  color + "0d",
                      }}
                    >
                      <p className="text-xs font-semibold" style={{ color }}>
                        {indicesLabel}
                      </p>
                      <p className="text-[11px] text-gray-600">{indicesHint}</p>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        I valori salvati saranno usati come <strong>baseline</strong> nelle
                        visite di follow-up successive come riferimento di confronto.
                      </p>

                      {clinSaved && (
                        <div className="flex items-center gap-2 text-emerald-700 font-medium text-xs pt-1">
                          <Check className="w-4 h-4" />
                          Clinimetrie salvate — verranno usate come baseline
                        </div>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-1"
                        style={{ borderColor: color + "66", color }}
                        onClick={() => setClinOpen(true)}
                      >
                        <Activity className="w-4 h-4 mr-1.5" />
                        {clinSaved ? "Modifica clinimetrie" : "Compila clinimetrie baseline"}
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-[11px] text-gray-500">
                        Nessuna clinimetria strutturata disponibile per questa patologia.
                      </p>
                    </div>
                  )}
                </div>

                {/* Divider + CTA */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <Button
                    type="button"
                    className="w-full"
                    style={{ background: color }}
                    onClick={onClose}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Salva e torna alla visita
                  </Button>
                  <p className="text-center text-[10px] text-gray-400">
                    {context === "prima_visita"
                      ? "Profilo e clinimetrie baseline salvati — il percorso passerà a follow-up"
                      : "Profilo e clinimetrie vengono salvati automaticamente — la visita rimane in workup"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CompositeAssessmentDialog renders via Radix portal at z-10000 ── */}
      {compositeMode && (
        <CompositeAssessmentDialog
          open={clinOpen}
          onClose={() => setClinOpen(false)}
          mode={compositeMode}
          patient={patient}
          onSaved={handleClinSaved}
          visitId={visitId}
          visitType={visitType || "workup"}
          visitDate={visitDate}
          initialJoints={initialJoints}
        />
      )}
    </>
  );
}
