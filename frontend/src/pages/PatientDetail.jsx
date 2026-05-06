import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { patientsApi, assessmentsApi, criteriaApi, therapiesApi, diseaseProfileApi, labExamsApi } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { ArrowLeft, Plus, Download, FileText, Trash2, ChevronDown, ChevronRight, Sparkles, FileCheck2, Edit, TrendingUp, ShieldCheck, Zap, FlaskConical, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import AssessmentForm from "../components/AssessmentForm";
import CompositeAssessmentDialog from "../components/CompositeAssessmentDialog";
import TherapySection from "../components/TherapySection";
import ExamsDialog from "../components/ExamsDialog";
import RemindersSection from "../components/RemindersSection";
import VisitHistoryTable from "../components/VisitHistoryTable";
import ScleroProfileSection, { isScleroDiagnosis } from "../components/ScleroProfileSection";
import RaProfileSection from "../components/RaProfileSection";
import SpaProfileSection from "../components/SpaProfileSection";
import SleProfileSection from "../components/SleProfileSection";
import AavProfileSection from "../components/AavProfileSection";
import AavSummaryHeader from "../components/AavSummaryHeader";
import SjogrenProfileSection from "../components/SjogrenProfileSection";
import MyositisProfileSection from "../components/MyositisProfileSection";
import SpaJointsPanel from "../components/SpaJointsPanel";
import { isRaDiagnosis, isSpaDiagnosis, isSleDiagnosis, isAavDiagnosis, isSjogrenDiagnosis, isMyositisDiagnosis } from "../lib/diseaseDetection";
import VisitImportButton from "../components/VisitImportButton";
import { INDEX_LABELS, INDEX_DISEASES, eularResponseDAS28, cdaiResponse } from "../lib/clinimetrics";
import { categoryColor } from "../lib/drugs";
import { exportPatientCSV, exportPatientPDF, exportCriteriaPDF } from "../lib/export";
import { suggestForDiagnosis } from "../lib/diagnosisSuggestions";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [criteriaEvals, setCriteriaEvals] = useState([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newType, setNewType] = useState("das28_esr");
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState("all");
  const [histFilterType, setHistFilterType] = useState("all");
  const [histDateFrom, setHistDateFrom] = useState("");
  const [histDateTo, setHistDateTo] = useState("");
  const [histSort, setHistSort] = useState("date_desc");
  const [therapies, setTherapies] = useState([]);
  const [labExams, setLabExams] = useState([]);
  const [examsDialogOpen, setExamsDialogOpen] = useState(false);
  const [showTherapies, setShowTherapies] = useState(true);
  const [showAllIndices, setShowAllIndices] = useState(false);
  const [compositeMode, setCompositeMode] = useState(null); // null | "ra" | "spa"
  const [spaProfile, setSpaProfile] = useState(null);

  const load = useCallback(async () => {
    const p = await patientsApi.get(id);
    setPatient(p);
    const a = await assessmentsApi.listByPatient(id);
    setAssessments(a);
    const ce = await criteriaApi.listByPatient(id).catch(() => []);
    setCriteriaEvals(ce);
    const th = await therapiesApi.listByPatient(id).catch(() => []);
    setTherapies(th);
    const lx = await labExamsApi.listByPatient(id).catch(() => []);
    setLabExams(lx);
    // SpA profile (for axial_involvement flag → enables ASDAS/BASDAI/BASFI in PsA)
    if (p && isSpaDiagnosis(p.diagnosi)) {
      const sp = await diseaseProfileApi.get(id, "spa").catch(() => null);
      setSpaProfile(sp?.data || null);
    } else {
      setSpaProfile(null);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Diagnosi + flag assiale da profilo SpA per suggerire ASDAS/BASDAI/BASFI anche nell'AP con impegno assiale
  const suggestions = useMemo(() => {
    const base = suggestForDiagnosis(patient?.diagnosi);
    if (patient && isSpaDiagnosis(patient.diagnosi) && spaProfile?.axial_involvement) {
      const axialIdx = ["asdas_crp", "basdai", "basfi"];
      const merged = Array.from(new Set([...(base.indices || []), ...axialIdx]));
      return { ...base, indices: merged };
    }
    return base;
  }, [patient, spaProfile]);

  const removeCriteriaEval = async (cid) => {
    if (!window.confirm("Eliminare questa valutazione di criteri?")) return;
    await criteriaApi.remove(cid);
    toast.success("Eliminata");
    load();
  };

  const startNew = (type) => {
    setNewType(type);
    setEditingAssessment(null);
    setNewOpen(true);
  };

  const startEdit = (assessment) => {
    setNewType(assessment.index_type);
    setEditingAssessment(assessment);
    setNewOpen(true);
  };

  const saveAssessment = async (payload) => {
    try {
      if (editingAssessment) {
        await assessmentsApi.update(editingAssessment.id, { ...payload, patient_id: id });
        toast.success("Valutazione aggiornata");
      } else {
        await assessmentsApi.create({ ...payload, patient_id: id });
        toast.success("Valutazione salvata");
      }
      setNewOpen(false);
      setEditingAssessment(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore nel salvataggio");
    }
  };

  const removeAssessment = async (aid) => {
    if (!window.confirm("Eliminare questa valutazione?")) return;
    await assessmentsApi.remove(aid);
    toast.success("Eliminata");
    load();
  };

  // Pre-compute EULAR response for each DAS28/CDAI/SDAI assessment vs previous same-type
  const responseByAssessmentId = useMemo(() => {
    const out = {};
    const sortedAsc = [...assessments].sort((a, b) => new Date(a.date) - new Date(b.date));
    const lastSameType = {};
    for (const a of sortedAsc) {
      const prev = lastSameType[a.index_type];
      if (prev && a.score != null && prev.score != null) {
        if (a.index_type === "das28_esr" || a.index_type === "das28_crp") {
          out[a.id] = eularResponseDAS28(prev.score, a.score);
        } else if (a.index_type === "cdai" || a.index_type === "sdai") {
          out[a.id] = cdaiResponse(prev.score, a.score);
        }
      }
      lastSameType[a.index_type] = a;
    }
    return out;
  }, [assessments]);

  const responseColor = (level) => {
    if (level === "good") return "bg-green-700 hover:bg-green-700 text-white";
    if (level === "moderate") return "bg-amber-500 hover:bg-amber-500 text-white";
    if (level === "none") return "bg-gray-300 hover:bg-gray-300 text-gray-800";
    return "";
  };

  // Returns list of therapies active on a given ISO date
  const therapiesActiveOn = (isoDate) => {
    if (!isoDate || !therapies || therapies.length === 0) return [];
    return therapies.filter((t) => {
      const start = t.start_date || null;
      const end = t.end_date || null;
      if (start && isoDate < start) return false;
      if (end && isoDate > end) return false;
      return true;
    });
  };

  const chartData = useMemo(() => {
    // Format wide: una riga per data visita, colonne per ogni indice presente.
    const filtered = selectedIndex === "all"
      ? assessments
      : assessments.filter((a) => a.index_type === selectedIndex);
    if (filtered.length === 0) return [];
    const byDate = new Map();
    for (const a of [...filtered].sort((x, y) => new Date(x.date) - new Date(y.date))) {
      const k = a.date;
      if (!byDate.has(k)) {
        byDate.set(k, {
          date: new Date(a.date).toLocaleDateString("it-IT"),
          rawDate: a.date,
          ts: Date.parse(a.date),
          indices: {},
          therapies: therapiesActiveOn(a.date).map((t) => ({ name: t.drug_name, dose: t.dose, category: t.category })),
        });
      }
      const row = byDate.get(k);
      // `score_{index_type}` per Recharts dataKey, + metadata
      row[`score_${a.index_type}`] = a.score;
      row.indices[a.index_type] = { score: a.score, interpretation: a.interpretation, type: INDEX_LABELS[a.index_type] || a.index_type };
    }
    for (const row of byDate.values()) {
      row.therapyLabel = row.therapies.length === 0
        ? "Nessuna terapia registrata"
        : row.therapies.map((t) => t.name + (t.dose ? ` ${t.dose}` : "")).join(", ");
    }
    return [...byDate.values()];
  }, [assessments, selectedIndex, therapies]);

  // Indici unici presenti nel chart corrente (per renderizzare una Line ciascuno)
  const chartIndexTypes = useMemo(() => {
    const set = new Set();
    for (const row of chartData) {
      Object.keys(row.indices || {}).forEach((k) => set.add(k));
    }
    return [...set];
  }, [chartData]);

  const drugColorMap = useMemo(() => buildDrugColorMap(chartData), [chartData]);

  // Time domain comune per chart e timeline terapie (allineati orizzontalmente)
  const timelineDomain = useMemo(() => {
    const tsList = [];
    chartData.forEach((d) => { if (d.rawDate) tsList.push(Date.parse(d.rawDate)); });
    therapies.forEach((t) => {
      if (t.start_date) tsList.push(Date.parse(t.start_date));
      if (t.end_date) tsList.push(Date.parse(t.end_date));
    });
    if (tsList.length === 0) return null;
    let min = Math.min(...tsList);
    let max = Math.max(...tsList);
    // Estendi a "oggi" se ci sono terapie attive
    const hasActive = therapies.some((t) => t.status === "active");
    if (hasActive) max = Math.max(max, Date.now());
    // Padding ±2.5% per leggibilità
    const span = max - min || 86400000;
    return { min: min - span * 0.025, max: max + span * 0.025 };
  }, [chartData, therapies]);

  const historyIndexOptions = useMemo(() => {
    const set = new Set();
    assessments.forEach((a) => set.add(a.index_type));
    return Array.from(set);
  }, [assessments]);

  const filteredAssessments = useMemo(() => {
    let result = assessments.filter((a) => {
      if (histFilterType !== "all" && a.index_type !== histFilterType) return false;
      if (histDateFrom && a.date < histDateFrom) return false;
      if (histDateTo && a.date > histDateTo) return false;
      return true;
    });
    result.sort((a, b) => {
      switch (histSort) {
        case "date_asc":
          return (a.date || "").localeCompare(b.date || "");
        case "date_desc":
          return (b.date || "").localeCompare(a.date || "");
        case "score_asc":
          return (a.score ?? -Infinity) - (b.score ?? -Infinity);
        case "score_desc":
          return (b.score ?? -Infinity) - (a.score ?? -Infinity);
        case "index":
          return (INDEX_LABELS[a.index_type] || a.index_type).localeCompare(
            INDEX_LABELS[b.index_type] || b.index_type, "it"
          );
        default:
          return 0;
      }
    });
    return result;
  }, [assessments, histFilterType, histDateFrom, histDateTo, histSort]);

  // Determine the distinct index types present in the patient's history (or the
  // single one selected via filter) — these become the columns of the table.
  const historyColumns = useMemo(() => {
    const set = new Set();
    for (const a of filteredAssessments) {
      if (a.index_type) set.add(a.index_type);
    }
    // Stable, clinically-meaningful ordering: composite RA → SpA → PsA → others
    const order = [
      "das28_esr", "das28_crp", "cdai", "sdai", "dapsa",
      "basdai", "asdas_crp", "asdas_esr", "basfi", "basmi",
      "haq", "haq_di", "raid", "psaid", "fiqr",
      "sledai", "sledai_2k", "bilag", "essdai", "ess_pri",
      "bvas", "vdi", "ahi", "iga_vasculitis_score",
      "mrss", "schober", "lei", "spades", "pasi",
    ];
    const present = [...set];
    return present.sort((a, b) => {
      const ai = order.indexOf(a); const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return (INDEX_LABELS[a] || a).localeCompare(INDEX_LABELS[b] || b, "it");
    });
  }, [filteredAssessments]);

  // Group lab exams by date (first 10 chars) for fast lookup in history table
  const examsByDate = useMemo(() => {
    const m = new Map();
    for (const e of labExams) {
      const k = (e.date || "").slice(0, 10);
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return m;
  }, [labExams]);

  // Group assessments by date for the new "synthesis-per-visit" history table.
  // Each entry: { date, assessments[], therapies[], exams[], indexCount }
  const groupedHistory = useMemo(() => {
    const m = new Map();
    for (const a of filteredAssessments) {
      const k = (a.date || "").slice(0, 10);
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a);
    }
    const groups = [...m.entries()].map(([date, ass]) => ({
      date,
      assessments: ass,
      therapies: therapiesActiveOn(date),
      exams: examsByDate.get(date) || [],
    }));
    groups.sort((g1, g2) => {
      if (histSort === "date_asc") return (g1.date || "").localeCompare(g2.date || "");
      return (g2.date || "").localeCompare(g1.date || "");
    });
    return groups;
  }, [filteredAssessments, therapies, examsByDate, histSort]);

  if (!patient) {
    return <div className="p-10 text-gray-500">Caricamento...</div>;
  }

  return (
    <div className="space-y-6 fade-in" data-testid="patient-detail-page">
      <Link to="/pazienti" className="inline-flex items-center text-sm text-gray-600 hover:text-[#0A2540]">
        <ArrowLeft className="w-4 h-4 mr-1" /> Torna ai pazienti
      </Link>

      {/* Patient header */}
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
          {patient.note && (
            <div className="mt-3 text-sm text-gray-600 max-w-3xl">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">Note: </span>
              {patient.note}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <VisitImportButton patient={patient} onImported={load} />
          {(patient.nome || patient.cognome || patient.codice_fiscale || patient.data_nascita) && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!window.confirm(
                  "Conferma anonimizzazione?\n\nVerranno RIMOSSI definitivamente: nome, cognome, codice fiscale, data di nascita.\n\nResteranno: codice paziente, anno di nascita, sesso, diagnosi, tutti i dati clinici.\n\nOperazione NON reversibile."
                )) return;
                try {
                  await patientsApi.anonymize(patient.id);
                  await load();
                  toast.success("Paziente anonimizzato");
                } catch (e) {
                  toast.error(e.response?.data?.detail || "Errore");
                }
              }}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="new-assessment-btn">
                <Plus className="w-4 h-4 mr-2" /> Nuova valutazione <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-[80vh] overflow-y-auto">
              {/* Form compositi: priorità massima per le diagnosi pertinenti */}
              {(isRaDiagnosis(patient.diagnosi) || isSpaDiagnosis(patient.diagnosi)) && (
                <>
                  <DropdownMenuLabel className="flex items-center gap-1.5 text-amber-700">
                    <Zap className="w-3.5 h-3.5" />
                    Form unificati
                  </DropdownMenuLabel>
                  {isRaDiagnosis(patient.diagnosi) && (
                    <DropdownMenuItem onClick={() => setCompositeMode("ra")} data-testid="new-composite-ra" className="bg-amber-50/60">
                      <span className="font-medium">AR — DAS28-VES + DAS28-PCR + CDAI + SDAI</span>
                      <span className="ml-auto text-[10px] text-amber-800 uppercase font-bold">4 in 1</span>
                    </DropdownMenuItem>
                  )}
                  {isSpaDiagnosis(patient.diagnosi) && (
                    <DropdownMenuItem onClick={() => setCompositeMode("psa")} data-testid="new-composite-psa" className="bg-amber-50/60">
                      <span className="font-medium">AP — DAPSA + LEI + PASI</span>
                      <span className="ml-auto text-[10px] text-amber-800 uppercase font-bold">3 in 1</span>
                    </DropdownMenuItem>
                  )}
                  {(isSpaDiagnosis(patient.diagnosi)) && (
                    <DropdownMenuItem onClick={() => setCompositeMode("spa")} data-testid="new-composite-spa" className="bg-amber-50/60">
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
                    <DropdownMenuItem key={`sug-${k}`} onClick={() => startNew(k)} data-testid={`new-suggested-${k}`} className="bg-blue-50/50">
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
                    <DropdownMenuItem key={k} onClick={() => startNew(k)} data-testid={`new-${k}`}>
                      {INDEX_LABELS[k]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Spondiloartrite</DropdownMenuLabel>
                  {["basdai", "asdas_crp", "basfi", "basmi", "schober", "lei"].map((k) => (
                    <DropdownMenuItem key={k} onClick={() => startNew(k)} data-testid={`new-${k}`}>
                      {INDEX_LABELS[k]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Sclerosi Sistemica</DropdownMenuLabel>
                  {["mrss", "capillaroscopy"].map((k) => (
                    <DropdownMenuItem key={k} onClick={() => startNew(k)} data-testid={`new-${k}`}>
                      {INDEX_LABELS[k]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Altri</DropdownMenuLabel>
                  {["dapsa", "sledai", "essdai", "esspri", "bvas", "mmt8", "fiqr", "haq", "pasi"].map((k) => (
                    <DropdownMenuItem key={k} onClick={() => startNew(k)} data-testid={`new-${k}`}>
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

      {/* Vasculitis header summary (organs & diagnostic basis) */}
      {isAavDiagnosis(patient.diagnosi) && <AavSummaryHeader patient={patient} />}

      {/* CLINICAL PROFILES — visualizzati subito dopo l'intestazione paziente */}
      {/* Rheumatoid Arthritis profile */}
      {isRaDiagnosis(patient.diagnosi) && <RaProfileSection patient={patient} />}

      {/* Spondyloarthritis profile (incl. PsA) */}
      {isSpaDiagnosis(patient.diagnosi) && <SpaProfileSection patient={patient} onUpdated={(d) => setSpaProfile(d)} />}

      {/* SLE profile */}
      {isSleDiagnosis(patient.diagnosi) && <SleProfileSection patient={patient} />}

      {/* ANCA Vasculitis profile */}
      {isAavDiagnosis(patient.diagnosi) && <AavProfileSection patient={patient} />}

      {/* Sjögren profile */}
      {isSjogrenDiagnosis(patient.diagnosi) && <SjogrenProfileSection patient={patient} />}

      {/* Myositis profile */}
      {isMyositisDiagnosis(patient.diagnosi) && <MyositisProfileSection patient={patient} />}

      {/* Scleroderma profile - only if SSc diagnosis */}
      {isScleroDiagnosis(patient.diagnosi) && <ScleroProfileSection patient={patient} />}

      {/* SpA peripheral involvement: homunculus 66/68 + LEI body chart sempre visibili */}
      {isSpaDiagnosis(patient.diagnosi) && spaProfile?.peripheral_involvement && (
        <SpaJointsPanel patient={patient} assessments={assessments} />
      )}

      {/* Therapy section */}
      <TherapySection patient={patient} />

      {/* Trend chart */}
      <Card className="border-gray-200 shadow-sm p-6" data-testid="trend-card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-heading font-bold text-xl tracking-tight">Andamento nel tempo</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
              <input
                type="checkbox"
                checked={showTherapies}
                onChange={(e) => setShowTherapies(e.target.checked)}
                className="w-4 h-4 accent-[#0A2540]"
                data-testid="show-therapies-toggle"
              />
              <span className="font-medium text-gray-700">Mostra terapie</span>
            </label>
            <Select value={selectedIndex} onValueChange={setSelectedIndex}>
              <SelectTrigger className="w-56" data-testid="trend-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli indici</SelectItem>
                {Object.entries(INDEX_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500 border border-dashed border-gray-200 rounded-md">
            Nessun dato per questo indice
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(260, 220 + chartIndexTypes.length * 6)}>
              <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  dataKey="ts"
                  scale="time"
                  domain={timelineDomain ? [timelineDomain.min, timelineDomain.max] : ["dataMin", "dataMax"]}
                  tickFormatter={fmtTickDate}
                  fontSize={11}
                  stroke="#6B7280"
                  height={28}
                />
                <YAxis fontSize={11} stroke="#6B7280" width={CHART_LEFT_AXIS_W} />
                <Tooltip content={<TrendTooltip showTherapies={showTherapies} drugColorMap={drugColorMap} />} />
                <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
                {chartIndexTypes.map((idxType, i) => {
                  const style = INDEX_LINE_STYLE[i % INDEX_LINE_STYLE.length];
                  return (
                    <Line
                      key={idxType}
                      type="monotone"
                      dataKey={`score_${idxType}`}
                      name={INDEX_LABELS[idxType] || idxType}
                      stroke={style.color}
                      strokeWidth={2}
                      strokeDasharray={style.dash}
                      dot={{ r: 4, fill: style.color, strokeWidth: 0, shape: style.shape }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
            {showTherapies && timelineDomain && (
              <TherapyGantt
                therapies={therapies}
                domain={timelineDomain}
                drugColorMap={drugColorMap}
                leftAxisWidth={CHART_LEFT_AXIS_W}
                rightMargin={24}
              />
            )}
          </>
        )}
      </Card>

      {/* History table - grouped per visit date */}
      <Card className="border-gray-200 shadow-sm overflow-hidden" data-testid="assessment-history">
        <div className="p-6 border-b border-gray-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-heading font-bold text-xl tracking-tight">Storico valutazioni</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Una colonna per ogni indice clinimetrico, una riga per data: per ogni indice puoi seguire l'andamento scorrendo verticalmente.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExamsDialogOpen(true)}
                data-testid="open-exams-btn"
              >
                <FlaskConical className="w-4 h-4 mr-1.5" /> Esami di laboratorio
              </Button>
              <span className="text-xs text-gray-500" data-testid="history-count">
                {groupedHistory.length} visite · {filteredAssessments.length} valutazioni
              </span>
            </div>
          </div>
          {assessments.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Select value={histFilterType} onValueChange={setHistFilterType}>
                <SelectTrigger className="h-8 text-xs" data-testid="history-filter-type"><SelectValue placeholder="Indice" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli indici</SelectItem>
                  {historyIndexOptions.map((it) => (
                    <SelectItem key={it} value={it}>{INDEX_LABELS[it] || it}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="date"
                value={histDateFrom}
                onChange={(e) => setHistDateFrom(e.target.value)}
                className="h-8 text-xs px-2 border border-gray-200 rounded-md bg-white"
                placeholder="Da"
                data-testid="history-from"
              />
              <input
                type="date"
                value={histDateTo}
                onChange={(e) => setHistDateTo(e.target.value)}
                className="h-8 text-xs px-2 border border-gray-200 rounded-md bg-white"
                placeholder="A"
                data-testid="history-to"
              />
              <Select value={histSort} onValueChange={setHistSort}>
                <SelectTrigger className="h-8 text-xs" data-testid="history-sort"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Data ↓ (recenti)</SelectItem>
                  <SelectItem value="date_asc">Data ↑ (vecchi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {assessments.length === 0 ? (
          <div className="p-10 text-center text-gray-500" data-testid="empty-assessments">
            Nessuna valutazione. Clicca "Nuova valutazione" per iniziare.
          </div>
        ) : groupedHistory.length === 0 ? (
          <div className="p-10 text-center text-gray-500">Nessun risultato per questi filtri.</div>
        ) : (
          <VisitHistoryTable
            columns={historyColumns}
            groupedHistory={groupedHistory}
            responseByAssessmentId={responseByAssessmentId}
            responseColor={responseColor}
            startEdit={startEdit}
            removeAssessment={removeAssessment}
            onAddExam={() => setExamsDialogOpen(true)}
          />
        )}
      </Card>

      {/* Criteria evaluations history */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-heading font-bold text-xl tracking-tight">Storico criteri classificativi</h2>
          <Link to={`/criteri?paziente=${id}`}>
            <Button variant="outline" size="sm" data-testid="goto-criteria-btn">
              <FileCheck2 className="w-4 h-4 mr-2" /> Applica criteri
            </Button>
          </Link>
        </div>
        {criteriaEvals.length === 0 ? (
          <div className="p-10 text-center text-gray-500" data-testid="empty-criteria">
            Nessun criterio applicato. Vai a "Criteri" per valutare il paziente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] border-b border-gray-200">
                <tr className="text-left">
                  <Th>Data</Th>
                  <Th>Criteri</Th>
                  <Th>Sorgente</Th>
                  <Th>Score</Th>
                  <Th>Esito</Th>
                  <Th className="text-right">Azioni</Th>
                </tr>
              </thead>
              <tbody>
                {criteriaEvals.map((ce) => (
                  <tr key={ce.id} className="border-b border-gray-100 hover:bg-gray-50" data-testid={`criteria-row-${ce.id}`}>
                    <td className="px-4 py-3 font-medium">{new Date(ce.date).toLocaleDateString("it-IT")}</td>
                    <td className="px-4 py-3">{ce.criteria_name}</td>
                    <td className="px-4 py-3 text-gray-600">{ce.source}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#0A2540]">{ce.score} / ≥{ce.threshold}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ce.meets ? "default" : "outline"} className={ce.meets ? "bg-green-700 hover:bg-green-700 text-white" : ""}>
                        {ce.meets ? "Soddisfatti" : "Non raggiunti"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeCriteriaEval(ce.id)} data-testid={`delete-criteria-${ce.id}`}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Reminders & richieste — in fondo, dopo storico criteri */}
      <RemindersSection patient={patient} />

      {/* Lab exams modal — accessible from history rows or the "Esami di laboratorio" button */}
      <ExamsDialog open={examsDialogOpen} onOpenChange={setExamsDialogOpen} patient={patient} />

      {/* New assessment dialog */}
      <Dialog open={newOpen} onOpenChange={(v) => { setNewOpen(v); if (!v) setEditingAssessment(null); }}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">{editingAssessment ? "Modifica valutazione" : "Nuova valutazione"}</DialogTitle>
          </DialogHeader>
          <AssessmentForm
            indexType={newType}
            onSubmit={saveAssessment}
            onCancel={() => { setNewOpen(false); setEditingAssessment(null); }}
            previousAssessments={assessments.filter((a) => a.index_type === newType && a.id !== editingAssessment?.id)}
            initial={editingAssessment}
          />
        </DialogContent>
      </Dialog>

      {/* Composite assessment dialog (RA or SpA) */}
      <CompositeAssessmentDialog
        open={!!compositeMode}
        mode={compositeMode}
        patient={patient}
        onClose={() => setCompositeMode(null)}
        onSaved={() => load()}
      />
    </div>
  );
}

const Th = ({ children, className = "" }) => (
  <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500 ${className}`}>{children}</th>
);

const Info = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500">{label}</div>
    <div className="font-medium">{value}</div>
  </div>
);


// Category colors moved to /app/frontend/src/lib/drugs.js — imported above.

// Palette per singolo farmaco (usata nel grafico/asse/tooltip/legenda)
const DRUG_PALETTE = [
  "#0A2540", "#0EA5E9", "#8B5CF6", "#F59E0B", "#10B981",
  "#EF4444", "#EC4899", "#14B8A6", "#F97316", "#6366F1",
  "#84CC16", "#06B6D4", "#D946EF", "#E11D48", "#65A30D",
  "#7C3AED", "#0369A1", "#B45309",
];

// Deriva una mappa farmaco→colore stabile in base all'ordine di comparsa
function buildDrugColorMap(chartData) {
  const map = {};
  let idx = 0;
  (chartData || []).forEach((d) => {
    (d.therapies || []).forEach((t) => {
      const name = t.name;
      if (name && !(name in map)) {
        map[name] = DRUG_PALETTE[idx % DRUG_PALETTE.length];
        idx += 1;
      }
    });
  });
  return map;
}

// Costanti chart
const CHART_LEFT_AXIS_W = 60;

// Palette colori + dash patterns + shapes per le linee dei diversi indici clinimetrici
const INDEX_LINE_STYLE = [
  { color: "#0A2540", dash: "0",     shape: "circle" },
  { color: "#0EA5E9", dash: "4 3",   shape: "square" },
  { color: "#8B5CF6", dash: "0",     shape: "diamond" },
  { color: "#F59E0B", dash: "6 3",   shape: "triangle" },
  { color: "#10B981", dash: "0",     shape: "circle" },
  { color: "#EF4444", dash: "3 3",   shape: "square" },
  { color: "#EC4899", dash: "0",     shape: "diamond" },
  { color: "#14B8A6", dash: "5 3",   shape: "triangle" },
  { color: "#F97316", dash: "0",     shape: "circle" },
  { color: "#6366F1", dash: "4 4",   shape: "square" },
];

function fmtTickDate(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  // gg/mm/aa breve
  return d.toLocaleDateString("it-IT", { month: "2-digit", year: "2-digit", day: "2-digit" });
}

function fmtFullDate(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT");
}

function TrendTooltip({ active, payload, showTherapies, drugColorMap }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const indices = d.indices || {};
  const indexEntries = Object.entries(indices);
  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-lg p-3 text-xs max-w-xs">
      <div className="font-bold text-[#0A2540]">{d.date}</div>
      {indexEntries.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {indexEntries.map(([k, v]) => (
            <li key={k} className="flex items-center gap-2">
              <span className="text-gray-600">{v.type}:</span>
              <span className="font-mono font-bold">{v.score ?? "—"}</span>
              {v.interpretation && <span className="text-[10px] text-gray-500">{v.interpretation}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-gray-500 italic mt-1">Nessun punteggio</div>
      )}
      {showTherapies && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-1">
            Terapia in corso
          </div>
          {d.therapies && d.therapies.length > 0 ? (
            <ul className="space-y-0.5">
              {d.therapies.map((t, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: (drugColorMap && drugColorMap[t.name]) || "#6B7280" }}
                  />
                  <span className="font-medium">{t.name}</span>
                  {t.dose && <span className="text-gray-500">{t.dose}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <span className="italic text-gray-400">{d.therapyLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Gantt-style timeline of therapies ============
// Rendered immediately below the line chart, sharing the same horizontal time domain.
function TherapyGantt({ therapies, domain, drugColorMap, leftAxisWidth, rightMargin }) {
  const [hover, setHover] = useState(null); // {therapy, x, y}

  // Sort by start_date ascending; group overlapping therapies into stacked rows
  const rows = useMemo(() => {
    const ts = (s) => Date.parse(s);
    const valid = (therapies || []).filter((t) => t.drug_name && t.start_date);
    return [...valid].sort((a, b) => ts(a.start_date) - ts(b.start_date));
  }, [therapies]);

  if (rows.length === 0) {
    return (
      <div
        className="text-[11px] text-gray-500 italic mt-2"
        style={{ paddingLeft: leftAxisWidth + 4 }}
      >
        Nessuna terapia registrata.
      </div>
    );
  }

  const ROW_H = 22;
  const ROW_GAP = 2;
  const HEADER_H = 18;
  const totalH = HEADER_H + rows.length * (ROW_H + ROW_GAP) + 4;
  const span = domain.max - domain.min;
  const pct = (ts) => Math.max(0, Math.min(100, ((ts - domain.min) / span) * 100));

  const today = Date.now();

  return (
    <div className="mt-1 select-none" data-testid="therapy-gantt">
      {/* Header label row */}
      <div className="flex items-center" style={{ paddingLeft: leftAxisWidth, paddingRight: rightMargin }}>
        <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold">
          Linea del tempo terapie
        </div>
      </div>
      <div
        className="relative"
        style={{ height: totalH, paddingLeft: leftAxisWidth, paddingRight: rightMargin }}
      >
        {/* Plot area background with light grid (vertical lines reuse chart's grid spacing pattern) */}
        <div className="absolute inset-y-0 border-l border-r border-gray-100 bg-gray-50/40" style={{ left: leftAxisWidth, right: rightMargin }}>
          {/* "Today" marker */}
          {today >= domain.min && today <= domain.max && (
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-gray-400"
              style={{ left: `${pct(today)}%` }}
              title="Oggi"
            />
          )}
        </div>

        {/* Therapy bars */}
        {rows.map((t, idx) => {
          const startTs = Date.parse(t.start_date);
          const endTs = t.end_date ? Date.parse(t.end_date) : today;
          const left = pct(startTs);
          const width = Math.max(0.4, pct(endTs) - left);
          const color = drugColorMap?.[t.drug_name] || "#6B7280";
          const isActive = t.status === "active";
          const top = HEADER_H + idx * (ROW_H + ROW_GAP);
          const drugLabel = `${t.drug_name}${t.dose ? ` ${t.dose}` : ""}`;
          return (
            <React.Fragment key={t.id || idx}>
              {/* Drug name on the left, fixed-width label */}
              <div
                className="absolute text-[11px] font-medium text-gray-700 truncate text-right pr-2"
                style={{
                  left: 0,
                  top: top + (ROW_H - 14) / 2,
                  height: 14,
                  width: leftAxisWidth - 4,
                }}
                title={drugLabel}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: color }} />
                {t.drug_name}
              </div>
              {/* Bar */}
              <div
                className="absolute rounded-sm border cursor-pointer"
                style={{
                  left: `calc(${leftAxisWidth}px + (100% - ${leftAxisWidth + rightMargin}px) * ${left / 100})`,
                  width: `calc((100% - ${leftAxisWidth + rightMargin}px) * ${width / 100})`,
                  top: top,
                  height: ROW_H,
                  background: color,
                  borderColor: color,
                  opacity: isActive ? 1 : 0.65,
                }}
                data-testid={`gantt-bar-${t.id || idx}`}
                onMouseEnter={(e) => setHover({ t, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setHover({ t, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
              >
                {width > 6 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white px-1.5 truncate">
                    {drugLabel}
                  </span>
                )}
                {!isActive && (
                  <span className="absolute -right-1 top-0 bottom-0 w-1 bg-gray-700 rounded-r-sm" title="Sospesa" />
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Floating tooltip */}
      {hover && (
        <div
          className="fixed z-50 pointer-events-none bg-white border border-gray-200 rounded-md shadow-lg p-2 text-xs max-w-xs"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="font-bold text-[#0A2540]">{hover.t.drug_name}{hover.t.dose ? ` · ${hover.t.dose}` : ""}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {hover.t.category}
            {hover.t.frequency ? ` · ${hover.t.frequency}` : ""}
          </div>
          <div className="mt-1 text-gray-700">
            {fmtFullDate(Date.parse(hover.t.start_date))} → {hover.t.end_date ? fmtFullDate(Date.parse(hover.t.end_date)) : "in corso"}
          </div>
          {hover.t.status !== "active" && (
            <div className="text-[10px] text-amber-700 italic mt-0.5">
              Sospesa{hover.t.discontinuation_reason ? ` — ${hover.t.discontinuation_reason}` : hover.t.auto_discontinued ? " automaticamente (nuovo biologico)" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
