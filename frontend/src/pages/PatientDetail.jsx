import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { patientsApi, assessmentsApi, criteriaApi, therapiesApi, diseaseProfileApi, labExamsApi } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import AssessmentForm from "../components/AssessmentForm";
import CompositeAssessmentDialog from "../components/CompositeAssessmentDialog";
import TherapySection from "../components/TherapySection";
import ExamsDialog from "../components/ExamsDialog";
import RemindersSection from "../components/RemindersSection";
import VisitHistoryTable from "../components/VisitHistoryTable";
import PROManagement from "../components/PROManagement";
import ScleroProfileSection, { isScleroDiagnosis } from "../components/ScleroProfileSection";
import RaProfileSection from "../components/RaProfileSection";
import SpaProfileSection from "../components/SpaProfileSection";
import SleProfileSection from "../components/SleProfileSection";
import AavProfileSection from "../components/AavProfileSection";
import AavSummaryHeader from "../components/AavSummaryHeader";
import SjogrenProfileSection from "../components/SjogrenProfileSection";
import MyositisProfileSection from "../components/MyositisProfileSection";
import SpaJointsPanel from "../components/SpaJointsPanel";
import PatientHeader from "../components/PatientHeader";
import TrendChartCard, { buildDrugColorMap } from "../components/TrendChartCard";
import CriteriaHistorySection from "../components/CriteriaHistorySection";
import VisitDetailsDialog from "../components/VisitDetailsDialog";
import ClinicalAlerts from "../components/ClinicalAlerts";
import { isRaDiagnosis, isSpaDiagnosis, isSleDiagnosis, isAavDiagnosis, isSjogrenDiagnosis, isMyositisDiagnosis } from "../lib/diseaseDetection";
import { INDEX_LABELS, eularResponseDAS28, cdaiResponse } from "../lib/clinimetrics";
import { suggestForDiagnosis } from "../lib/diagnosisSuggestions";

export default function PatientDetail() {
  const { id } = useParams();
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
  const [proDialogOpen, setProDialogOpen] = useState(false);
  const [showTherapies, setShowTherapies] = useState(true);
  const [showAllIndices, setShowAllIndices] = useState(false);
  const [compositeMode, setCompositeMode] = useState(null);
  const [spaProfile, setSpaProfile] = useState(null);
  const [visitDetailsGroup, setVisitDetailsGroup] = useState(null);

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
    if (p && isSpaDiagnosis(p)) {
      const sp = await diseaseProfileApi.get(id, "spa").catch(() => null);
      setSpaProfile(sp?.data || null);
    } else {
      setSpaProfile(null);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const suggestions = useMemo(() => {
    const base = suggestForDiagnosis(patient?.diagnosi);
    if (patient && isSpaDiagnosis(patient) && spaProfile?.axial_involvement) {
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

  const therapiesActiveOn = useCallback((isoDate) => {
    if (!isoDate || !therapies || therapies.length === 0) return [];
    return therapies.filter((t) => {
      const start = t.start_date || null;
      const end = t.end_date || null;
      if (start && isoDate < start) return false;
      if (end && isoDate > end) return false;
      return true;
    });
  }, [therapies]);

  const chartData = useMemo(() => {
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
      row[`score_${a.index_type}`] = a.score;
      row.indices[a.index_type] = { score: a.score, interpretation: a.interpretation, type: INDEX_LABELS[a.index_type] || a.index_type };
    }
    for (const row of byDate.values()) {
      row.therapyLabel = row.therapies.length === 0
        ? "Nessuna terapia registrata"
        : row.therapies.map((t) => t.name + (t.dose ? ` ${t.dose}` : "")).join(", ");
    }
    return [...byDate.values()];
  }, [assessments, selectedIndex, therapiesActiveOn]);

  const chartIndexTypes = useMemo(() => {
    const set = new Set();
    for (const row of chartData) {
      Object.keys(row.indices || {}).forEach((k) => set.add(k));
    }
    return [...set];
  }, [chartData]);

  const drugColorMap = useMemo(() => buildDrugColorMap(chartData), [chartData]);

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
    const hasActive = therapies.some((t) => t.status === "active");
    if (hasActive) max = Math.max(max, Date.now());
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

  const historyColumns = useMemo(() => {
    const set = new Set();
    for (const a of filteredAssessments) {
      if (a.index_type) set.add(a.index_type);
    }
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
  }, [filteredAssessments, examsByDate, histSort, therapiesActiveOn]);

  if (!patient) {
    return <div className="p-10 text-gray-500">Caricamento...</div>;
  }

  return (
    <div className="space-y-6 fade-in" data-testid="patient-detail-page">
      <PatientHeader
        patient={patient}
        assessments={assessments}
        criteriaEvals={criteriaEvals}
        suggestions={suggestions}
        showAllIndices={showAllIndices}
        setShowAllIndices={setShowAllIndices}
        onStartNew={startNew}
        onSetCompositeMode={setCompositeMode}
        onOpenPRO={() => setProDialogOpen(true)}
        onLoad={load}
      />

      {/* Vasculitis header summary (organs & diagnostic basis) */}
      {isAavDiagnosis(patient) && <AavSummaryHeader patient={patient} />}

      {/* Clinical alerts — ILD screening / GIOP / PJP prophylaxis */}
      <ClinicalAlerts patient={patient} therapies={therapies} />

      {/* CLINICAL PROFILES */}
      {isRaDiagnosis(patient) && <RaProfileSection patient={patient} />}
      {isSpaDiagnosis(patient) && <SpaProfileSection patient={patient} onUpdated={(d) => setSpaProfile(d)} />}
      {isSleDiagnosis(patient) && <SleProfileSection patient={patient} />}
      {isAavDiagnosis(patient) && <AavProfileSection patient={patient} />}
      {isSjogrenDiagnosis(patient) && <SjogrenProfileSection patient={patient} />}
      {isMyositisDiagnosis(patient) && <MyositisProfileSection patient={patient} />}
      {isScleroDiagnosis(patient.diagnosi) && <ScleroProfileSection patient={patient} />}

      {/* SpA peripheral involvement: homunculus 66/68 + LEI body chart */}
      {isSpaDiagnosis(patient) && spaProfile?.peripheral_involvement && (
        <SpaJointsPanel patient={patient} assessments={assessments} />
      )}

      {/* Therapy section */}
      <TherapySection patient={patient} />

      {/* Trend chart */}
      <TrendChartCard
        chartData={chartData}
        chartIndexTypes={chartIndexTypes}
        drugColorMap={drugColorMap}
        timelineDomain={timelineDomain}
        therapies={therapies}
        selectedIndex={selectedIndex}
        setSelectedIndex={setSelectedIndex}
        showTherapies={showTherapies}
        setShowTherapies={setShowTherapies}
      />

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
            onDateClick={setVisitDetailsGroup}
          />
        )}
      </Card>

      {/* Criteria evaluations history */}
      <CriteriaHistorySection
        patientId={id}
        criteriaEvals={criteriaEvals}
        onRemove={removeCriteriaEval}
      />

      {/* Reminders & richieste */}
      <RemindersSection patient={patient} />

      {/* Lab exams modal */}
      <ExamsDialog open={examsDialogOpen} onOpenChange={setExamsDialogOpen} patient={patient} />

      {/* PRO management dialog */}
      <PROManagement
        patient={patient}
        open={proDialogOpen}
        onOpenChange={setProDialogOpen}
        onConverted={load}
      />

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

      {/* Visit details dialog — opens when the user clicks on a date in the history */}
      <VisitDetailsDialog
        open={!!visitDetailsGroup}
        group={visitDetailsGroup}
        onClose={() => setVisitDetailsGroup(null)}
        onEdit={(a) => { setVisitDetailsGroup(null); startEdit(a); }}
        onRemove={(aid) => { setVisitDetailsGroup(null); removeAssessment(aid); }}
      />
    </div>
  );
}
