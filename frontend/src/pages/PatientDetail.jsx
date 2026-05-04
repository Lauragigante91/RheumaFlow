import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { patientsApi, assessmentsApi, criteriaApi, therapiesApi } from "../lib/api";
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
import { ArrowLeft, Plus, Download, FileText, Trash2, ChevronDown, Sparkles, FileCheck2, Edit, TrendingUp, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import AssessmentForm from "../components/AssessmentForm";
import TherapySection from "../components/TherapySection";
import ExamsSection from "../components/ExamsSection";
import RemindersSection from "../components/RemindersSection";
import ScleroProfileSection, { isScleroDiagnosis } from "../components/ScleroProfileSection";
import RaProfileSection from "../components/RaProfileSection";
import SpaProfileSection from "../components/SpaProfileSection";
import SleProfileSection from "../components/SleProfileSection";
import AavProfileSection from "../components/AavProfileSection";
import AavSummaryHeader from "../components/AavSummaryHeader";
import SjogrenProfileSection from "../components/SjogrenProfileSection";
import MyositisProfileSection from "../components/MyositisProfileSection";
import { isRaDiagnosis, isSpaDiagnosis, isSleDiagnosis, isAavDiagnosis, isSjogrenDiagnosis, isMyositisDiagnosis } from "../lib/diseaseDetection";
import VisitImportButton from "../components/VisitImportButton";
import { INDEX_LABELS, INDEX_DISEASES, eularResponseDAS28, cdaiResponse } from "../lib/clinimetrics";
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
  const [showTherapies, setShowTherapies] = useState(true);
  const [showAllIndices, setShowAllIndices] = useState(false);

  const load = async () => {
    const p = await patientsApi.get(id);
    setPatient(p);
    const a = await assessmentsApi.listByPatient(id);
    setAssessments(a);
    const ce = await criteriaApi.listByPatient(id).catch(() => []);
    setCriteriaEvals(ce);
    const th = await therapiesApi.listByPatient(id).catch(() => []);
    setTherapies(th);
  };
  useEffect(() => { load(); }, [id]);

  const suggestions = useMemo(() => suggestForDiagnosis(patient?.diagnosi), [patient?.diagnosi]);

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
    const filtered = selectedIndex === "all"
      ? assessments
      : assessments.filter((a) => a.index_type === selectedIndex);
    return [...filtered]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((a) => {
        const active = therapiesActiveOn(a.date);
        return {
          date: new Date(a.date).toLocaleDateString("it-IT"),
          rawDate: a.date,
          ts: Date.parse(a.date),
          score: a.score,
          type: INDEX_LABELS[a.index_type] || a.index_type,
          therapies: active.map((t) => ({
            name: t.drug_name,
            dose: t.dose,
            category: t.category,
          })),
          therapyLabel: active.length === 0
            ? "Nessuna terapia registrata"
            : active.map((t) => t.drug_name + (t.dose ? ` ${t.dose}` : "")).join(", "),
        };
      });
  }, [assessments, selectedIndex, therapies]);

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="new-assessment-btn">
                <Plus className="w-4 h-4 mr-2" /> Nuova valutazione <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 max-h-[80vh] overflow-y-auto">
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

      {/* Suggested indices/criteria */}
      {(suggestions.indices.length > 0 || suggestions.criteria.length > 0) && (
        <Card className="border-blue-200 bg-blue-50/30 p-5" data-testid="suggestions-card">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#0A2540] mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-heading font-bold text-base tracking-tight mb-1">
                Consigliati per <span className="text-[#0A2540]">{patient.diagnosi}</span>
              </h3>
              {suggestions.indices.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1">Indici clinimetrici</div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.indices.map((k) => (
                      <Button
                        key={k}
                        variant="outline"
                        size="sm"
                        className="bg-white border-gray-300"
                        onClick={() => startNew(k)}
                        data-testid={`suggested-${k}`}
                      >
                        {INDEX_LABELS[k]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {suggestions.criteria.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1">Criteri classificativi</div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.criteria.map((cid) => (
                      <Link key={cid} to={`/criteri?paziente=${id}&open=${cid}`}>
                        <Button variant="outline" size="sm" className="bg-white border-gray-300" data-testid={`suggested-crit-${cid}`}>
                          <FileCheck2 className="w-3.5 h-3.5 mr-1.5" /> {cid.split("_").slice(0, -1).join(" ").toUpperCase()}
                        </Button>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Vasculitis header summary (organs & diagnostic basis) */}
      {isAavDiagnosis(patient.diagnosi) && <AavSummaryHeader patient={patient} />}

      {/* Therapy section */}
      <TherapySection patient={patient} />

      {/* Rheumatoid Arthritis profile */}
      {isRaDiagnosis(patient.diagnosi) && <RaProfileSection patient={patient} />}

      {/* Spondyloarthritis profile (incl. PsA) */}
      {isSpaDiagnosis(patient.diagnosi) && <SpaProfileSection patient={patient} />}

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

      {/* Lab exams */}
      <ExamsSection patient={patient} />

      {/* Reminders */}
      <RemindersSection patient={patient} />

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
            <ResponsiveContainer width="100%" height={260}>
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
                <Legend verticalAlign="top" height={24} />
                <Line type="monotone" dataKey="score" stroke="#0A2540" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Punteggio" />
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

      {/* History table */}
      <Card className="border-gray-200 shadow-sm overflow-hidden" data-testid="assessment-history">
        <div className="p-6 border-b border-gray-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-heading font-bold text-xl tracking-tight">Storico valutazioni</h2>
            <span className="text-xs text-gray-500" data-testid="history-count">
              {filteredAssessments.length} su {assessments.length}
            </span>
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
                  <SelectItem value="score_desc">Score ↓</SelectItem>
                  <SelectItem value="score_asc">Score ↑</SelectItem>
                  <SelectItem value="index">Indice (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {assessments.length === 0 ? (
          <div className="p-10 text-center text-gray-500" data-testid="empty-assessments">
            Nessuna valutazione. Clicca "Nuova valutazione" per iniziare.
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="p-10 text-center text-gray-500">Nessun risultato per questi filtri.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] border-b border-gray-200">
                <tr className="text-left">
                  <Th>Data</Th>
                  <Th>Indice</Th>
                  <Th>Punteggio</Th>
                  <Th>Interpretazione</Th>
                  <Th>Risposta / Dettagli</Th>
                  <Th>Terapia in corso</Th>
                  <Th className="text-right">Azioni</Th>
                </tr>
              </thead>
              <tbody>
                {filteredAssessments.map((a) => {
                  const resp = responseByAssessmentId[a.id];
                  const isJointIdx = ["das28_esr", "das28_crp", "cdai", "sdai", "dapsa"].includes(a.index_type);
                  const activeTh = therapiesActiveOn(a.date);
                  return (
                  <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50" data-testid={`assessment-row-${a.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{new Date(a.date).toLocaleDateString("it-IT")}</div>
                      {a.created_by_name && <div className="text-[10px] text-gray-500 mt-0.5">da {a.created_by_name}</div>}
                    </td>
                    <td className="px-4 py-3">{INDEX_LABELS[a.index_type] || a.index_type}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#0A2540]">{a.score ?? "-"}</td>
                    <td className="px-4 py-3">{a.interpretation || "-"}</td>
                    <td className="px-4 py-3">
                      {isJointIdx ? (
                        <div className="flex flex-col gap-1">
                          {resp ? (
                            <Badge className={responseColor(resp.level)} data-testid={`eular-${a.id}`}>
                              <TrendingUp className="w-3 h-3 mr-1" /> {resp.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                          <span className="text-[11px] text-gray-600 font-mono">
                            TJC {a.tender_joints?.length ?? 0} · SJC {a.swollen_joints?.length ?? 0}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {activeTh.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">Nessuna</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[260px]" data-testid={`therapies-cell-${a.id}`}>
                          {activeTh.slice(0, 4).map((t) => (
                            <span
                              key={t.id}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-gray-100 border border-gray-200"
                              title={`${t.drug_name}${t.dose ? ` · ${t.dose}` : ""}${t.frequency ? ` · ${t.frequency}` : ""}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: categoryColor(t.category) }} />
                              <span className="font-medium">{t.drug_name}</span>
                              {t.dose && <span className="text-gray-500">{t.dose}</span>}
                            </span>
                          ))}
                          {activeTh.length > 4 && (
                            <span className="text-[10px] text-gray-500 self-center">+{activeTh.length - 4}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(a)} data-testid={`edit-assessment-${a.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeAssessment(a.id)} data-testid={`delete-assessment-${a.id}`}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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


// Category → color used for therapy pills in the history table
const CATEGORY_COLORS = {
  csDMARD: "#0A2540",
  bDMARD: "#0EA5E9",
  tsDMARD: "#8B5CF6",
  glucocorticoid: "#F59E0B",
  NSAID: "#10B981",
  analgesic: "#6B7280",
  supportive: "#9CA3AF",
  other: "#6B7280",
};

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || "#6B7280";
}

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
  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-lg p-3 text-xs max-w-xs">
      <div className="font-bold text-[#0A2540]">{d.date}</div>
      <div className="mt-1">
        <span className="text-gray-500">Score:</span>{" "}
        <span className="font-mono font-bold">{d.score ?? "—"}</span>
      </div>
      {d.type && <div className="mt-0.5 text-gray-500 text-[10px]">{d.type}</div>}
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
