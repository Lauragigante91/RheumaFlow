import React from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { ArrowLeft, Plus, Download, FileText, ChevronDown, Sparkles, FileCheck2, ShieldCheck, Zap, Stethoscope, QrCode } from "lucide-react";
import { toast } from "sonner";
import VisitImportButton from "./VisitImportButton";
import PatientGuidelinesShortcut from "./PatientGuidelinesShortcut";
import RecallFlagControl from "./RecallFlagControl";
import { patientsApi } from "../lib/api";
import { INDEX_LABELS, INDEX_DISEASES } from "../lib/clinimetrics";
import { isRaDiagnosis, isSpaDiagnosis } from "../lib/diseaseDetection";
import { exportPatientCSV, exportPatientPDF, exportCriteriaPDF } from "../lib/export";

const Info = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500">{label}</div>
    <div className="font-medium">{value}</div>
  </div>
);

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
          <VisitImportButton patient={patient} onImported={onLoad} />
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
          <Link to={`/pazienti/${patient.id}/visita`}>
            <Button variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50" data-testid="quick-visit-btn">
              <Stethoscope className="w-4 h-4 mr-2" /> Visita rapida
            </Button>
          </Link>
          <Button
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={onOpenPRO}
            data-testid="pro-qr-btn"
          >
            <QrCode className="w-4 h-4 mr-2" /> QR per il paziente
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="new-assessment-btn">
                <Plus className="w-4 h-4 mr-2" /> Nuova valutazione <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-[80vh] overflow-y-auto">
              {(isRaDiagnosis(patient) || isSpaDiagnosis(patient)) && (
                <>
                  <DropdownMenuLabel className="flex items-center gap-1.5 text-amber-700">
                    <Zap className="w-3.5 h-3.5" />
                    Form unificati
                  </DropdownMenuLabel>
                  {isRaDiagnosis(patient) && (
                    <DropdownMenuItem onClick={() => onSetCompositeMode("ra")} data-testid="new-composite-ra" className="bg-amber-50/60">
                      <span className="font-medium">AR — DAS28-VES + DAS28-PCR + CDAI + SDAI</span>
                      <span className="ml-auto text-[10px] text-amber-800 uppercase font-bold">4 in 1</span>
                    </DropdownMenuItem>
                  )}
                  {isSpaDiagnosis(patient) && (
                    <DropdownMenuItem onClick={() => onSetCompositeMode("psa")} data-testid="new-composite-psa" className="bg-amber-50/60">
                      <span className="font-medium">AP — DAPSA + LEI + PASI</span>
                      <span className="ml-auto text-[10px] text-amber-800 uppercase font-bold">3 in 1</span>
                    </DropdownMenuItem>
                  )}
                  {(isSpaDiagnosis(patient)) && (
                    <DropdownMenuItem onClick={() => onSetCompositeMode("spa")} data-testid="new-composite-spa" className="bg-amber-50/60">
                      <span className="font-medium">SpA — BASDAI + ASDAS-PCR + BASFI</span>
                      <span className="ml-auto text-[10px] text-amber-800 uppercase font-bold">3 in 1</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              {suggestions.indices.length > 0 && (
                <>
                  <DropdownMenuLabel className="flex items-center gap-1.5 text-[#0A2540]">
                    <Sparkles className="w-3.5 h-3.5" />
                    Consigliati per diagnosi
                  </DropdownMenuLabel>
                  {suggestions.indices.map((k) => (
                    <DropdownMenuItem key={`sug-${k}`} onClick={() => onStartNew(k)} data-testid={`new-suggested-${k}`} className="bg-blue-50/50">
                      <span className="font-medium">{INDEX_LABELS[k]}</span>
                      <span className="ml-auto text-xs text-gray-500">{INDEX_DISEASES[k]}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => { e.preventDefault(); setShowAllIndices((v) => !v); }}
                    className="text-xs text-gray-600 italic justify-center"
                    data-testid="toggle-all-indices"
                  >
                    {showAllIndices ? "↑ Mostra solo i consigliati" : "↓ Mostra tutti gli indici (avanzato)"}
                  </DropdownMenuItem>
                </>
              )}
              {(suggestions.indices.length === 0 || showAllIndices) && (
                <>
                  {suggestions.indices.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel>Artrite Reumatoide</DropdownMenuLabel>
                  {["das28_esr", "das28_crp", "cdai", "sdai"].map((k) => (
                    <DropdownMenuItem key={k} onClick={() => onStartNew(k)} data-testid={`new-${k}`}>
                      {INDEX_LABELS[k]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Spondiloartrite</DropdownMenuLabel>
                  {["basdai", "asdas_crp", "basfi", "basmi", "schober", "lei"].map((k) => (
                    <DropdownMenuItem key={k} onClick={() => onStartNew(k)} data-testid={`new-${k}`}>
                      {INDEX_LABELS[k]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Sclerosi Sistemica</DropdownMenuLabel>
                  {["mrss", "capillaroscopy"].map((k) => (
                    <DropdownMenuItem key={k} onClick={() => onStartNew(k)} data-testid={`new-${k}`}>
                      {INDEX_LABELS[k]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Altri</DropdownMenuLabel>
                  {["dapsa", "sledai", "essdai", "esspri", "bvas", "mmt8", "fiqr", "haq", "pasi", "progetto_cuore"].map((k) => (
                    <DropdownMenuItem key={k} onClick={() => onStartNew(k)} data-testid={`new-${k}`}>
                      {INDEX_LABELS[k]} <span className="ml-auto text-xs text-gray-500">{INDEX_DISEASES[k]}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="export-btn">
                <Download className="w-4 h-4 mr-2" /> Esporta <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Clinimetria</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => exportPatientPDF(patient, assessments)} data-testid="export-pdf">
                <FileText className="w-4 h-4 mr-2" /> PDF clinimetria
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportPatientCSV(patient, assessments)} data-testid="export-csv">
                <FileText className="w-4 h-4 mr-2" /> CSV clinimetria
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Criteri</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => exportCriteriaPDF(patient, criteriaEvals)}
                disabled={criteriaEvals.length === 0}
                data-testid="export-criteria-pdf"
              >
                <FileCheck2 className="w-4 h-4 mr-2" /> PDF criteri classificativi
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}
