import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { ArrowLeft, ChevronDown, ShieldCheck, QrCode, FlaskConical, CheckCircle2, ClipboardList, FileUp, FileSearch, Files } from "lucide-react";
import { toast } from "sonner";

import PatientGuidelinesShortcut from "../patient/PatientGuidelinesShortcut";
import RecallFlagControl from "../patient/RecallFlagControl";
import { patientsApi } from "../../lib/api";

// ─── Patient state config ─────────────────────────────────────────────────────

export const PATIENT_STATES = {
  first_visit: {
    label: "Prima visita",
    sublabel: "Valutazione iniziale",
    icon: ClipboardList,
    badge: "bg-blue-50 text-blue-800 border-blue-300",
    dot: "bg-blue-500",
  },
  workup_in_progress: {
    label: "Iter diagnostico",
    sublabel: "Workup in corso",
    icon: FlaskConical,
    badge: "bg-amber-50 text-amber-800 border-amber-300",
    dot: "bg-amber-400",
  },
  follow_up: {
    label: "Follow-up",
    sublabel: "Malattia nota",
    icon: CheckCircle2,
    badge: "bg-emerald-50 text-emerald-800 border-emerald-300",
    dot: "bg-emerald-500",
  },
};

const ALL_STATE_OPTIONS = [
  { value: "first_visit",         label: "Prima visita",              description: "Valutazione diagnostica iniziale" },
  { value: "workup_in_progress",  label: "Iter diagnostico in corso", description: "Workup pre-diagnostico, diagnosi ancora aperta" },
  { value: "follow_up",           label: "Follow-up di malattia nota", description: "Diagnosi definitiva, monitoraggio attività" },
];

const Info = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500">{label}</div>
    <div className="font-medium">{value}</div>
  </div>
);

const MONTHS_IT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

function formatOnset(patient) {
  if (!patient?.onset_year) return null;
  if (patient.onset_month) {
    return `${String(patient.onset_month).padStart(2, "0")}/${patient.onset_year}`;
  }
  return String(patient.onset_year);
}

function calcDiseaseDurationYears(patient) {
  if (!patient?.onset_year) return null;
  const now = new Date();
  const month = patient.onset_month || 6; // if month unknown default to mid-year
  const onset = new Date(patient.onset_year, month - 1, 1);
  const diffMs = now - onset;
  if (diffMs < 0) return null;
  const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 1) {
    const months = Math.round(years * 12);
    return months <= 1 ? "< 1 mese" : `${months} mesi`;
  }
  const rounded = Math.floor(years);
  return rounded === 1 ? "1 anno" : `${rounded} anni`;
}

function PatientStateBadge({ patient, onLoad }) {
  const [changing, setChanging] = useState(false);
  const state = patient?.patient_state;
  const cfg = state ? PATIENT_STATES[state] : null;

  const changeState = async (newState) => {
    setChanging(true);
    try {
      await patientsApi.update(patient.id, { patient_state: newState });
      toast.success("Percorso aggiornato");
      onLoad?.();
    } catch {
      toast.error("Errore nell'aggiornamento del percorso");
    } finally {
      setChanging(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={changing}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-opacity ${
            cfg ? cfg.badge : "bg-gray-50 text-gray-500 border-gray-200"
          } hover:opacity-80`}
          data-testid="patient-state-badge"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg ? cfg.dot : "bg-gray-300"}`} />
          {cfg ? cfg.label : "Percorso non impostato"}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
          Stato del percorso clinico
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ALL_STATE_OPTIONS.map((opt) => {
          const oc = PATIENT_STATES[opt.value];
          const Icon = oc?.icon;
          const isActive = state === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => changeState(opt.value)}
              className={isActive ? "bg-gray-50 font-semibold" : ""}
              data-testid={`state-option-${opt.value}`}
            >
              <div className="flex items-start gap-2 w-full">
                {Icon && <Icon className="w-4 h-4 mt-0.5 shrink-0 text-gray-500" />}
                <div>
                  <div className="text-sm">{opt.label}</div>
                  <div className="text-[11px] text-gray-400">{opt.description}</div>
                </div>
                {isActive && <CheckCircle2 className="w-3.5 h-3.5 ml-auto mt-0.5 text-emerald-600 shrink-0" />}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function PatientHeader({
  patient,
  assessments,
  criteriaEvals,
  suggestions,
  showAllIndices,
  setShowAllIndices,
  onStartNew,
  onSetCompositeMode,
  onOpenPRO,
  onLoad,
  onImportPdf,
  onImportMultiPdf,
  onImportText,
}) {
  const handleAnonymize = async () => {
    if (!window.confirm(
      "Conferma anonimizzazione?\n\nVerranno RIMOSSI definitivamente: nome, cognome, codice fiscale, data di nascita.\n\nResteranno: codice paziente, anno di nascita, sesso, diagnosi, tutti i dati clinici.\n\nOperazione NON reversibile."
    )) return;
    try {
      await patientsApi.anonymize(patient.id);
      await onLoad();
      toast.success("Paziente anonimizzato");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore");
    }
  };

  return (
    <>
      <Link to="/pazienti" className="inline-flex items-center text-sm text-gray-600 hover:text-[#0A2540]">
        <ArrowLeft className="w-4 h-4 mr-1" /> Torna ai pazienti
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Paziente</div>
          <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tighter text-[#0A2540]">
            {(patient.cognome || patient.nome) ? `${patient.cognome || ""} ${patient.nome || ""}`.trim() : (patient.codice_paziente || "Paziente")}
          </h1>
          <div className="mt-3 flex flex-wrap gap-6 text-sm text-gray-700">
            {patient.codice_paziente && <Info label="Codice" value={patient.codice_paziente} />}
            {patient.data_nascita && <Info label="Nato il" value={new Date(patient.data_nascita).toLocaleDateString("it-IT")} />}
            {!patient.data_nascita && patient.anno_nascita && <Info label="Nato nel" value={String(patient.anno_nascita)} />}
            {patient.sesso && <Info label="Sesso" value={patient.sesso} />}
            {patient.codice_fiscale && <Info label="CF" value={patient.codice_fiscale} />}
            {patient.diagnosi && <Info label="Diagnosi" value={patient.diagnosi} />}
            {formatOnset(patient) && (
              <Info
                label="Esordio malattia"
                value={`${formatOnset(patient)}${calcDiseaseDurationYears(patient) ? ` · ${calcDiseaseDurationYears(patient)}` : ""}`}
              />
            )}
          </div>
          <div className="mt-2.5">
            <PatientStateBadge patient={patient} onLoad={onLoad} />
          </div>

          {Array.isArray(patient.diagnosi_secondarie) && patient.diagnosi_secondarie.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5" data-testid="diagnosi-secondarie">
              <span className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mr-1">
                Overlap / secondarie:
              </span>
              {patient.diagnosi_secondarie.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-50 text-violet-800 border border-violet-200"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2.5">
            <PatientGuidelinesShortcut patient={patient} />
          </div>
          {patient.note && (
            <div className="mt-3 text-sm text-gray-600 max-w-3xl">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Note: </span>
              {patient.note}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <RecallFlagControl patient={patient} onChanged={onLoad} />
          {(patient.nome || patient.cognome || patient.codice_fiscale || patient.data_nascita) && (
            <Button
              variant="outline"
              onClick={handleAnonymize}
              className="border-amber-400 text-amber-700 hover:bg-amber-50"
              data-testid="anonymize-btn"
            >
              <ShieldCheck className="w-4 h-4 mr-2" /> Anonimizza
            </Button>
          )}
          {patient.patient_state === "workup_in_progress" && (
            <Link to={`/pazienti/${patient.id}/visita-workup`}>
              <Button variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50" data-testid="workup-visit-btn">
                <FlaskConical className="w-4 h-4 mr-2" /> Visita workup
              </Button>
            </Link>
          )}
          {onImportText && patient?.patient_state === "follow_up" && (
            <Button
              variant="outline"
              className="border-teal-300 text-teal-700 hover:bg-teal-50"
              onClick={onImportText}
              data-testid="import-text-btn"
            >
              <FileSearch className="w-4 h-4 mr-2" /> Importa da lettera
            </Button>
          )}
          {onImportPdf && patient?.patient_state === "follow_up" && (
            <Button
              variant="outline"
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              onClick={onImportPdf}
              data-testid="import-pdf-btn"
            >
              <FileUp className="w-4 h-4 mr-2" /> Importa da referto PDF
            </Button>
          )}
          {onImportMultiPdf && patient?.patient_state === "follow_up" && (
            <Button
              variant="outline"
              className="border-violet-300 text-violet-700 hover:bg-violet-50"
              onClick={onImportMultiPdf}
              data-testid="import-multi-pdf-btn"
            >
              <Files className="w-4 h-4 mr-2" /> Importa PDF multipli
            </Button>
          )}
          <Button
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={onOpenPRO}
            data-testid="pro-qr-btn"
          >
            <QrCode className="w-4 h-4 mr-2" /> QR per il paziente
          </Button>

        </div>
      </div>
    </>
  );
}
