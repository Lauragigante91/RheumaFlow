import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ArrowLeft, FlaskConical, AlertTriangle, Pill, Share2, Download } from "lucide-react";
import { detectDiseaseWorkflow, getLatestPrimaryIndex } from "../../lib/diseaseWidgets";

function patientAge(patient) {
  if (patient?.data_nascita) {
    const d = new Date(patient.data_nascita);
    if (!isNaN(d.getTime()))
      return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  }
  if (patient?.anno_nascita) return new Date().getFullYear() - Number(patient.anno_nascita);
  return null;
}

// Colour map covers every interpretation string used across all disease indices
const ACTIVITY_COLORS = {
  "Remissione":           "bg-green-100 text-green-800 border-green-200",
  "Bassa attività":       "bg-blue-100 text-blue-800 border-blue-200",
  "Moderata attività":    "bg-amber-100 text-amber-800 border-amber-200",
  "Alta attività":        "bg-red-100 text-red-800 border-red-200",
  "Inattiva":             "bg-green-100 text-green-800 border-green-200",
  "Molto alta attività":  "bg-red-100 text-red-800 border-red-200",
  "Malattia attiva":      "bg-red-100 text-red-800 border-red-200",
  "Malattia non attiva":  "bg-green-100 text-green-800 border-green-200",
  "Nessuna attività":     "bg-green-100 text-green-800 border-green-200",
  "Attività lieve":       "bg-blue-100 text-blue-800 border-blue-200",
  "Attività moderata":    "bg-amber-100 text-amber-800 border-amber-200",
  "Attività alta":        "bg-red-100 text-red-800 border-red-200",
  "Attività molto alta":  "bg-red-100 text-red-800 border-red-200",
  "Funzione preservata":  "bg-green-100 text-green-800 border-green-200",
  "Moderata":             "bg-amber-100 text-amber-800 border-amber-200",
};

export default function StickyPatientHeader({
  patient, assessments, labExams, therapies, alertCount,
  onGenerateReport, onOpenExams, onOpenConsult, onExportHistory,
}) {
  if (!patient) return null;

  const workflow     = detectDiseaseWorkflow(patient);
  const primaryIndex = getLatestPrimaryIndex(workflow, assessments);

  // Latest PCR from labs (universally relevant)
  let latestPCR = null;
  for (const e of [...(labExams || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""))) {
    const v = (e.values || {}).pcr;
    if (v?.value != null) { latestPCR = { value: v.value, unit: v.unit || "mg/L" }; break; }
  }

  const activeTherapy = (therapies || []).find(t => t.status === "active");
  const age      = patientAge(patient);
  const fullName = [patient.cognome, patient.nome].filter(Boolean).join(" ") || patient.codice_paziente || "Paziente";
  const indexColor = primaryIndex
    ? (ACTIVITY_COLORS[primaryIndex.interp] || "bg-gray-100 text-gray-700 border-gray-200")
    : "";

  return (
    <div className="sticky top-0 z-40 bg-white/96 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      <div className="px-4 md:px-6 h-14 flex items-center gap-3">
        <Link to="/pazienti" className="text-gray-400 hover:text-[#0A2540] flex-shrink-0 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* Patient identity */}
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <span className="font-heading font-black text-[#0A2540] text-sm truncate">{fullName}</span>
          {(age || patient.sesso) && (
            <span className="text-xs text-gray-500 flex-shrink-0">
              {[age ? `${age}a` : "", patient.sesso].filter(Boolean).join(" · ")}
            </span>
          )}
          {patient.diagnosi && (
            <Badge variant="outline" className="text-[10px] flex-shrink-0 hidden sm:flex max-w-36 truncate">
              {patient.diagnosi}
            </Badge>
          )}
          {activeTherapy && (
            <span className="hidden md:flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0">
              <Pill className="w-3 h-3" />
              <span className="truncate max-w-28">
                {activeTherapy.drug_name}{activeTherapy.dose ? ` ${activeTherapy.dose}` : ""}
              </span>
            </span>
          )}
        </div>

        {/* Right-side: disease-specific primary index + alerts + actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {primaryIndex && (
            <span className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${indexColor}`}>
              {primaryIndex.label} {primaryIndex.score}
              {primaryIndex.interp ? ` · ${primaryIndex.interp}` : ""}
            </span>
          )}
          {latestPCR && (
            <span className="hidden lg:inline text-[11px] text-gray-500">
              PCR {latestPCR.value} {latestPCR.unit}
            </span>
          )}
          {alertCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              <AlertTriangle className="w-3 h-3" /> {alertCount}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={onOpenExams} className="h-7 text-xs px-2.5">
            <FlaskConical className="w-3.5 h-3.5 mr-1" /> Esami
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenConsult} className="h-7 text-xs px-2.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
            <Share2 className="w-3.5 h-3.5 mr-1" /> Condividi
          </Button>
          {onExportHistory && (
            <Button variant="outline" size="sm" onClick={onExportHistory} className="h-7 text-xs px-2.5 text-gray-600 border-gray-200 hover:bg-gray-50">
              <Download className="w-3.5 h-3.5 mr-1" /> Esporta
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
