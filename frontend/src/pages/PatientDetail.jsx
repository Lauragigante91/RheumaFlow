import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  patientsApi, assessmentsApi, criteriaApi, therapiesApi, diseaseProfileApi, labExamsApi,
  workupVisitsApi, consultApi, instrumentalExamsApi,
} from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { FlaskConical, ChevronDown, ChevronUp, ClipboardList, Calendar, ChevronRight, Share2, Copy, Check, Trash2, Link2, Loader2 as SpinnerIcon, FileText, Plus, X } from "lucide-react";
import { toast } from "sonner";
import AssessmentForm from "../components/clinical/AssessmentForm";
import CompositeAssessmentDialog from "../components/clinical/CompositeAssessmentDialog";
import TherapySection from "../components/therapy/TherapySection";
import GestioneTerapiaModal from "../components/therapy/GestioneTerapiaModal";
import ExamsDialog from "../components/labs/ExamsDialog";
import RemindersSection from "../components/reminders/RemindersSection";
import VisitHistoryTable from "../components/visits/VisitHistoryTable";
import QuickTherapyModal from "../components/therapy/QuickTherapyModal";
import PROManagement from "../components/specialist/PROManagement";
import ScleroProfileSection, { isScleroDiagnosis } from "../components/profiles/ScleroProfileSection";
import RaProfileSection from "../components/profiles/RaProfileSection";
import SpaProfileSection from "../components/profiles/SpaProfileSection";
import SleProfileSection from "../components/profiles/SleProfileSection";
import AavProfileSection from "../components/profiles/AavProfileSection";
import AavSummaryHeader from "../components/profiles/AavSummaryHeader";
import IgaVProfileSection from "../components/profiles/IgaVProfileSection";
import CryoVasProfileSection from "../components/profiles/CryoVasProfileSection";
import UrticarialVasProfileSection from "../components/profiles/UrticarialVasProfileSection";
import BehcetProfileSection from "../components/profiles/BehcetProfileSection";
import PanProfileSection from "../components/profiles/PanProfileSection";
import CsvvProfileSection from "../components/profiles/CsvvProfileSection";
import AosdProfileSection from "../components/profiles/AosdProfileSection";
import ApsProfileSection from "../components/profiles/ApsProfileSection";
import GoutProfileSection from "../components/profiles/GoutProfileSection";
import MctdProfileSection from "../components/profiles/MctdProfileSection";
import Igg4RdProfileSection from "../components/profiles/Igg4RdProfileSection";
import RpcProfileSection from "../components/profiles/RpcProfileSection";
import SjogrenProfileSection from "../components/profiles/SjogrenProfileSection";
import MyositisProfileSection from "../components/profiles/MyositisProfileSection";
import PatientHeader from "../components/layout/PatientHeader";
import TrendChartCard, { buildDrugColorMap, getTherapiesActiveOn } from "../components/clinical/TrendChartCard";
import VisitDetailsDialog from "../components/visits/VisitDetailsDialog";
import ClinicalAlerts from "../components/patient/ClinicalAlerts";
import StickyPatientHeader from "../components/layout/StickyPatientHeader";
import TodayVisitSection from "../components/visits/TodayVisitSection";
// eslint-disable-next-line no-unused-vars
import ActiveProblemsCard from "../components/patient/ActiveProblemsCard";
import PlanSection from "../components/clinical/PlanSection";
import PatientProfileStrip from "../components/layout/PatientProfileStrip";
import RheumatologicStatusStrip from "../components/layout/RheumatologicStatusStrip";
import VisitReportDialog from "../components/visits/VisitReportDialog";
import HistoryExportDialog from "../components/labs/HistoryExportDialog";
import {
  isRaDiagnosis, isSpaDiagnosis, isSleDiagnosis, isAavDiagnosis,
  isIgaVDiagnosis, isCryoVasDiagnosis, isUrticarialVasDiagnosis, isBehcetDiagnosis,
  isPanDiagnosis, isCsvvDiagnosis,
  isAosdDiagnosis, isApsDiagnosis, isGoutDiagnosis,
  isMctdDiagnosis, isIgg4RdDiagnosis, isRpcDiagnosis,
  isSjogrenDiagnosis, isMyositisDiagnosis, isLvvDiagnosis, isPmrDiagnosis,
} from "../lib/diseaseDetection";
import PmrLvvTimeline from "../components/profiles/PmrLvvTimeline";
import VascularHomunculusDialog from "../components/imaging/VascularHomunculusDialog";
import EcodopplerDialog from "../components/imaging/EcodopplerDialog";
import AngioImagingDialog from "../components/imaging/AngioImagingDialog";
import EchoMskDialog from "../components/imaging/EchoMskDialog";
import PmrLvvProfileSection from "../components/profiles/PmrLvvProfileSection";
import ClassificationBadges from "../components/patient/ClassificationBadges";
import { COMORBIDITY_CATEGORIES } from "../lib/conditions";
import { INDEX_LABELS, eularResponseDAS28, cdaiResponse } from "../lib/clinimetrics";
import { suggestForDiagnosis } from "../lib/diagnosisSuggestions";
import { findPresetText } from "../lib/therapyPresets";
import { groupSidebarVisits } from "../lib/visitGrouping";
import ImportVisitPdfModal from "../components/visits/ImportVisitPdfModal";
import ExamUploadQRModal from "../components/visits/ExamUploadQRModal";
import ImportMultiPdfModal from "../components/visits/ImportMultiPdfModal";
import VisitImportButton from "../components/visits/VisitImportButton";
import ClinicalTimelineManager from "../components/clinical/ClinicalTimelineManager";
import CollapsibleSection from "../components/patient/CollapsibleSection";
import PatientDetailErrorBoundary from "../components/patient/PatientDetailErrorBoundary";
import {
  fmtVisitDate, VisitSection,
  PrimaVisitaCard, WorkupVisitCard, PreviousVisitCard,
} from "../components/patient/VisitHistoryCards";


// ─────────────────────────────────────────────────────────────────────────────
export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [instrumentalExams, setInstrumentalExams] = useState([]);
  const [criteriaEvals, setCriteriaEvals] = useState([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newType, setNewType] = useState("das28_esr");
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [histFilterType, setHistFilterType] = useState("all");
  const [histDateFrom, setHistDateFrom] = useState("");
  const [histDateTo, setHistDateTo] = useState("");
  const [histSort, setHistSort] = useState("date_desc");
  const [therapies, setTherapies] = useState([]);
  const [labExams, setLabExams] = useState([]);
  const [examsDialogOpen, setExamsDialogOpen] = useState(false);
  const [examsInitialTab, setExamsInitialTab] = useState("lab");
  const openExamsTab = (tab) => { setExamsInitialTab(tab); setExamsDialogOpen(true); };
  const [proDialogOpen, setProDialogOpen] = useState(false);
  const [examQROpen, setExamQROpen] = useState(false);
  const [showAllIndices, setShowAllIndices] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState("all");
  const [showTherapies, setShowTherapies] = useState(true);
  const [compositeMode, setCompositeMode] = useState(null);
  const [compositeInitialJoints, setCompositeInitialJoints] = useState({});
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [compositeInitialLei, setCompositeInitialLei] = useState({});
  const [spaProfile, setSpaProfile] = useState(null);
  const [pmrLvvProfile, setPmrLvvProfile] = useState(null);
  const [visitDetailsGroup, setVisitDetailsGroup] = useState(null);
  // New state for clinical workstation features
  const [todayVisitData, setTodayVisitData] = useState(null);
  const [planData, setPlanData] = useState(null);
  const [appendPlanText, setAppendPlanText] = useState(null);
  const planHandle = useRef(null);
  const therapyHandle = useRef(null);
  const todayVisitHandle = useRef(null);
  const [followupVisitDate, setFollowupVisitDate] = useState(new Date().toISOString().slice(0, 10));
  // Visit-session snapshots — frozen once at page load to decouple live edits
  // from the "terapia in corso all'apertura della visita" display.
  const frozenTherapiesRef    = useRef(null);
  const frozenWorkupVisitsRef = useRef(null);
  const handleAcceptReminder = useCallback((text) => {
    setAppendPlanText({ text, ts: Date.now() });
  }, []);
  const handleAppendToPlan = useCallback((text) => {
    setAppendPlanText({ text, ts: Date.now() });
  }, []);
  const [secDiagOpen,    setSecDiagOpen]    = useState(false);
  const [secDiagList,    setSecDiagList]    = useState([]);
  const [secDiagInput,   setSecDiagInput]   = useState("");
  const [secDiagSaving,  setSecDiagSaving]  = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [historyExportOpen, setHistoryExportOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [importTextOpen,       setImportTextOpen]        = useState(false);
  const [importPdfOpen,        setImportPdfOpen]        = useState(false);
  const [importPdfInitialText, setImportPdfInitialText] = useState("");
  const [importPdfInitialDate, setImportPdfInitialDate] = useState("");
  const [importMultiPdfOpen,   setImportMultiPdfOpen]   = useState(false);
  const [multiPdfInitialBlocks, setMultiPdfInitialBlocks] = useState([]);
  const [quickTherapyHistOpen, setQuickTherapyHistOpen] = useState(false);
  const [quickTherapyHistDate, setQuickTherapyHistDate] = useState(null);
  const [gestioneOpen, setGestioneOpen] = useState(false);
  const [therapyLauncherAction, setTherapyLauncherAction] = useState(null);
  const openTherapyManager = useCallback((initialAction = null) => {
    setTherapyLauncherAction(initialAction || null);
    setGestioneOpen(true);
  }, []);
  const navigate = useNavigate();
  const handlePromoteToWorkup = useCallback(async (date) => {
    try {
      const newVisit = await workupVisitsApi.create(id, {
        visit_date: date,
        visit_type: "follow_up",
        status: "draft",
      });
      navigate(`/pazienti/${id}/visita-workup?editVisit=${newVisit._id || newVisit.id}`);
    } catch {
      toast.error("Impossibile creare la visita strutturata");
    }
  }, [id, navigate]);
  const [petvasDialogOpen, setPetvasDialogOpen] = useState(false);
  const [editingPetvas, setEditingPetvas] = useState(null);
  const [petvasInitialTab, setPetvasInitialTab] = useState("score");
  const [echodopplerDialogOpen, setEchodopplerDialogOpen] = useState(false);
  const [editingEchodoppler, setEditingEchodoppler] = useState(null);
  const [angioDialogOpen, setAngioDialogOpen] = useState(false);
  const [editingAngio, setEditingAngio] = useState(null);
  const [angioInitialModality, setAngioInitialModality] = useState("angio_ct");
  const [echoMskDialogOpen, setEchoMskDialogOpen] = useState(false);
  const [editingEchoMsk, setEditingEchoMsk] = useState(null);
  const [firstVisit, setFirstVisit] = useState(null);
  const [workupVisits, setWorkupVisits] = useState([]);
  const [cockpitData, setCockpitData] = useState(null);
  const [workupReportData, setWorkupReportData] = useState({});
  const [cockpitReportSections, setCockpitReportSections] = useState(new Set());
  const [consultOpen, setConsultOpen] = useState(false);
  const [consultTokens, setConsultTokens] = useState([]);
  const [consultLoading, setConsultLoading] = useState(false);
  const [consultExpiry, setConsultExpiry] = useState("168");
  const [consultCreating, setConsultCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const toggleCockpitSection = (key) =>
    setCockpitReportSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // ── Unified visit session sync state ─────────────────────────────────────
  // Any module that saves data for today's date pushes values here.
  // TodayVisitSection watches syncKey and merges non-null values into its fields.
  const [visitSyncData, setVisitSyncData] = useState({
    tjc: null, sjc: null, gh: null, ega: null, pcr: null, ves: null,
    backPain: null, morningStiffness: null, peripheralPain: null, pga: null,
    syncKey: 0,
  });
  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = useCallback(async () => {
    const p = await patientsApi.get(id);
    setPatient(p);
    const a = await assessmentsApi.listByPatient(id);
    setAssessments(a);
    const ie = await instrumentalExamsApi.list(id).catch(() => []);
    setInstrumentalExams(ie);
    const ce = await criteriaApi.listByPatient(id).catch(() => []);
    setCriteriaEvals(ce);
    const th = await therapiesApi.listByPatient(id).catch(() => []);
    setTherapies(th);
    if (frozenTherapiesRef.current === null) frozenTherapiesRef.current = th;
    const lx = await labExamsApi.listByPatient(id).catch(() => []);
    setLabExams(lx);
    if (p && isSpaDiagnosis(p)) {
      const sp = await diseaseProfileApi.get(id, "spa").catch(() => null);
      setSpaProfile(sp?.data || null);
    } else {
      setSpaProfile(null);
    }
    if (p && (isPmrDiagnosis(p) || isLvvDiagnosis(p))) {
      const pm = await diseaseProfileApi.get(id, "pmr_lvv").catch(() => null);
      setPmrLvvProfile(pm?.data || null);
    } else {
      setPmrLvvProfile(null);
    }
    const fv = await diseaseProfileApi.get(id, "prima_visita").catch(() => null);
    setFirstVisit(fv?.data || null);
    if (p?.patient_state === "follow_up") {
      const wv = await workupVisitsApi.list(id).catch(() => []);
      const wvArr = Array.isArray(wv) ? wv : [];
      setWorkupVisits(wvArr);
      if (frozenWorkupVisitsRef.current === null) frozenWorkupVisitsRef.current = wvArr;
    } else {
      setWorkupVisits([]);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (e) => { if (e.detail?.patientId === id) load(); };
    window.addEventListener("rheumaflow:patient-patched", handler);
    return () => window.removeEventListener("rheumaflow:patient-patched", handler);
  }, [id, load]);

  // ── Sync: Homunculus / CompositeAssessmentDialog → TodayVisitSection fields ──
  // Fires when any assessment changes. Finds the most recent RA-type assessment
  // for today and pushes its inputs (TJC, SJC, GH, EGA, PCR, VES) into the
  // shared visit session so TodayVisitSection can auto-populate its fields.
  useEffect(() => {
    const RA_TYPES = ["das28_crp", "das28_esr", "cdai", "sdai"];
    const SPA_TYPES = ["asdas_crp", "asdas_esr", "basdai"];
    const todayRa = [...assessments]
      .filter((a) => (a.date || "").slice(0, 10) === todayDate && RA_TYPES.includes(a.index_type) && a.inputs)
      .sort((a, b) => (b.id || "").localeCompare(a.id || ""))[0];
    const todaySpa = [...assessments]
      .filter((a) => (a.date || "").slice(0, 10) === todayDate && SPA_TYPES.includes(a.index_type) && a.inputs)
      .sort((a, b) => (b.id || "").localeCompare(a.id || ""))[0];
    if (!todayRa && !todaySpa) return;
    const inp = todayRa?.inputs || {};
    const spaInp = todaySpa?.inputs || {};
    const next = {
      tjc:              inp.tjc  ?? inp.tjc28  ?? (todayRa?.tender_joints?.length ?? null),
      sjc:              inp.sjc  ?? inp.sjc28  ?? (todayRa?.swollen_joints?.length ?? null),
      gh:               inp.gh   ?? null,
      ega:              inp.ega  ?? null,
      pcr:              inp.crp  ?? inp.pcr    ?? null,
      ves:              inp.esr  ?? inp.ves    ?? null,
      backPain:         spaInp.backPain         ?? null,
      morningStiffness: spaInp.morningStiffness ?? null,
      peripheralPain:   spaInp.peripheralPain   ?? null,
      pga:              spaInp.pga              ?? null,
    };
    setVisitSyncData((prev) => ({ ...next, syncKey: prev.syncKey + 1 }));
  }, [assessments, todayDate]);

  // ── Sync: Lab import → TodayVisitSection PCR / VES fields ────────────────
  // Fires when lab exams reload. Finds any exam for today that contains PCR or
  // VES values and pushes them into the shared visit session.
  useEffect(() => {
    const todayLabs = labExams.filter((e) => (e.date || "").slice(0, 10) === todayDate);
    if (todayLabs.length === 0) return;
    let syncPcr = null, syncVes = null;
    for (const exam of todayLabs) {
      for (const [k, v] of Object.entries(exam.values || {})) {
        const lk = k.toLowerCase().replace(/[^a-z]/g, "");
        if ((lk === "pcr" || lk === "crp") && v?.value != null && syncPcr == null) {
          syncPcr = Number(v.value);
        }
        if ((lk === "ves" || lk === "esr") && v?.value != null && syncVes == null) {
          syncVes = Number(v.value);
        }
      }
    }
    if (syncPcr == null && syncVes == null) return;
    setVisitSyncData((prev) => ({
      ...prev,
      ...(syncPcr != null ? { pcr: syncPcr } : {}),
      ...(syncVes != null ? { ves: syncVes } : {}),
      syncKey: prev.syncKey + 1,
    }));
  }, [labExams, todayDate]);

  const suggestions = useMemo(() => {
    const base = suggestForDiagnosis(patient?.diagnosi);
    if (patient && isSpaDiagnosis(patient) && spaProfile?.axial_involvement) {
      const axialIdx = ["asdas_crp", "basdai", "basfi"];
      const merged = Array.from(new Set([...(base.indices || []), ...axialIdx]));
      return { ...base, indices: merged };
    }
    return base;
  }, [patient, spaProfile]);


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

  const loadConsultTokens = useCallback(async () => {
    if (!id) return;
    setConsultLoading(true);
    try {
      const tokens = await consultApi.list(id);
      setConsultTokens(tokens);
    } catch {
      setConsultTokens([]);
    } finally {
      setConsultLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (consultOpen) loadConsultTokens();
  }, [consultOpen, loadConsultTokens]);

  const createConsultToken = async () => {
    setConsultCreating(true);
    try {
      await consultApi.create(id, { expires_in_hours: parseInt(consultExpiry, 10) });
      await loadConsultTokens();
      toast.success("Link consulto generato");
    } catch {
      toast.error("Errore nella generazione del link");
    } finally {
      setConsultCreating(false);
    }
  };

  const revokeConsultToken = async (tokenId) => {
    try {
      await consultApi.remove(tokenId);
      setConsultTokens(prev => prev.filter(t => t.id !== tokenId));
      toast.success("Link revocato");
    } catch {
      toast.error("Errore nella revoca del link");
    }
  };

  const copyConsultLink = (token) => {
    const url = `${window.location.origin}/c/${token.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(token.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
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

  const updateAssessmentInputs = useCallback(async (assessmentId, saveKey, rawValue) => {
    const a = assessments.find(x => x.id === assessmentId);
    if (!a) return;
    const numVal = parseFloat(String(rawValue).replace(",", "."));
    if (isNaN(numVal)) return;
    try {
      const updated = await assessmentsApi.update(assessmentId, {
        inputs: { ...(a.inputs || {}), [saveKey]: numVal },
      });
      setAssessments(prev => prev.map(x => x.id === assessmentId ? { ...x, ...updated } : x));
      toast.success("Valore aggiornato");
    } catch {
      toast.error("Errore nel salvataggio");
      throw new Error("save failed");
    }
  }, [assessments]);

  const deletePrimaVisita = useCallback(async () => {
    if (!window.confirm("Eliminare la prima visita? Tutti i dati anamnestici raccolti verranno persi. L'operazione è irreversibile.")) return;
    try {
      await diseaseProfileApi.remove(id, "prima_visita");
      setFirstVisit(null);
      toast.success("Prima visita eliminata");
    } catch {
      toast.error("Errore nell'eliminazione della prima visita");
    }
  }, [id]);

  const deleteWorkupVisit = useCallback(async (visitId) => {
    if (!window.confirm("Eliminare questa visita di workup? L'operazione è irreversibile.")) return;
    try {
      await workupVisitsApi.remove(visitId);
      toast.success("Visita eliminata");
      load();
    } catch {
      toast.error("Errore nell'eliminazione della visita");
    }
  }, [load]);

  const deleteFollowupGroup = useCallback(async (group) => {
    const dateStr = fmtVisitDate(group.date);
    const n = group.assessments.length;
    if (!window.confirm(`Eliminare la visita del ${dateStr}?\nVerranno eliminate ${n} valutazione${n !== 1 ? "i" : "e"}.`)) return;
    try {
      await Promise.all(group.assessments.map(a => assessmentsApi.remove(a.id)));
      toast.success("Visita eliminata");
      load();
    } catch {
      toast.error("Errore nell'eliminazione della visita");
    }
  }, [load]);

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

  const therapiesActiveOn = useCallback(
    (isoDate) => getTherapiesActiveOn(therapies, isoDate),
    [therapies]
  );

  const chartData = useMemo(() => {
    const filtered = selectedIndex === "all"
      ? assessments
      : assessments.filter((a) => a.index_type === selectedIndex);
    if (filtered.length === 0) return [];
    const byDate = new Map();
    for (const a of [...filtered].sort((x, y) => {
      const dateDiff = new Date(x.date) - new Date(y.date);
      if (dateDiff !== 0) return dateDiff;
      // imported assessments come last so they overwrite calculated ones for same date+type
      return (!!(x.inputs?.imported) ? 1 : 0) - (!!(y.inputs?.imported) ? 1 : 0);
    })) {
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
      // imported assessment wins: don't overwrite imported with a calculated one
      const alreadyImported = row[`imported_${a.index_type}`];
      if (!alreadyImported || a.inputs?.imported) {
        row[`score_${a.index_type}`] = a.score;
        row[`imported_${a.index_type}`] = !!(a.inputs?.imported);
        row.indices[a.index_type] = { score: a.score, interpretation: a.interpretation, type: INDEX_LABELS[a.index_type] || a.index_type, imported: !!(a.inputs?.imported) };
      }
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
        case "date_asc":  return (a.date || "").localeCompare(b.date || "");
        case "date_desc": return (b.date || "").localeCompare(a.date || "");
        case "score_asc": return (a.score ?? -Infinity) - (b.score ?? -Infinity);
        case "score_desc":return (b.score ?? -Infinity) - (a.score ?? -Infinity);
        case "index":
          return (INDEX_LABELS[a.index_type] || a.index_type).localeCompare(
            INDEX_LABELS[b.index_type] || b.index_type, "it"
          );
        default: return 0;
      }
    });
    return result;
  }, [assessments, histFilterType, histDateFrom, histDateTo, histSort]);

  // Extra input-derived columns for RA arthritis patients
  const histInputColumns = useMemo(() => {
    const RA_TYPES = ["das28_crp", "das28_esr", "cdai", "sdai"];
    if (!(isRaDiagnosis(patient) || isSpaDiagnosis(patient))) return [];
    if (!assessments.some(a => RA_TYPES.includes(a.index_type))) return [];
    return [
      { key: "tjc", saveKey: "tjc",  label: "TJC",      indexTypes: RA_TYPES, extract: (inp) => inp?.tjc  ?? inp?.tjc28 },
      { key: "sjc", saveKey: "sjc",  label: "SJC",      indexTypes: RA_TYPES, extract: (inp) => inp?.sjc  ?? inp?.sjc28 },
      { key: "gh",  saveKey: "gh",   label: "VAS paz.", indexTypes: RA_TYPES, extract: (inp) => inp?.gh },
      { key: "ega", saveKey: "ega",  label: "EGA med.", indexTypes: RA_TYPES, extract: (inp) => inp?.ega },
      { key: "pcr", saveKey: "crp",  label: "PCR mg/L", indexTypes: RA_TYPES, extract: (inp) => inp?.crp  ?? inp?.pcr },
      { key: "ves", saveKey: "esr",  label: "VES mm/h", indexTypes: RA_TYPES, extract: (inp) => inp?.esr  ?? inp?.ves },
    ];
  }, [patient, assessments]);

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
      "petvas",
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
      if (!m.has(k)) m.set(k, new Map());
      const byType = m.get(k);
      const existing = byType.get(a.index_type);
      // imported wins over calculated for same (date, index_type)
      if (!existing || a.inputs?.imported) {
        byType.set(a.index_type, a);
      }
    }
    const groups = [...m.entries()].map(([date, byType]) => ({
      date,
      assessments: [...byType.values()],
      therapies: therapiesActiveOn(date),
      exams: examsByDate.get(date) || [],
    }));
    groups.sort((g1, g2) => {
      if (histSort === "date_asc") return (g1.date || "").localeCompare(g2.date || "");
      return (g2.date || "").localeCompare(g1.date || "");
    });
    return groups;
  }, [filteredAssessments, examsByDate, histSort, therapiesActiveOn]);

  const sidebarUnifiedVisits = useMemo(
    () => groupSidebarVisits({ firstVisit, workupVisits, assessments, therapiesActiveOn, examsByDate }),
    [firstVisit, workupVisits, assessments, therapiesActiveOn, examsByDate]
  );

  // §10 Terapia: testo base per la visita corrente.
  // Priorità: (1) testo già salvato per oggi, (2) exit_therapy_text dell'ultima
  // visita confermata precedente, (3) null → PlanSection usa formatActiveTherapies.
  const currentVisitId = useMemo(() => {
    const sorted = [...workupVisits].sort((a, b) => (b.visit_date || "").localeCompare(a.visit_date || ""));
    return sorted[0]?.id || null;
  }, [workupVisits]);

  const planInitialTherapyText = useMemo(() => {
    const fuVisits = workupVisits
      .filter(v => v.visit_type === "follow_up")
      .sort((a, b) => (b.visit_date || "").localeCompare(a.visit_date || ""));
    const todayVisit = fuVisits.find(v => v.visit_date?.slice(0, 10) === followupVisitDate);
    if (todayVisit?.exit_therapy_text) return todayVisit.exit_therapy_text;
    const prevVisit = fuVisits.find(
      v => (v.visit_date || "").slice(0, 10) < followupVisitDate && v.exit_therapy_text,
    );
    return prevVisit?.exit_therapy_text || null;
  }, [workupVisits, followupVisitDate]);

  const hasProfiles = (
    isRaDiagnosis(patient) || isSpaDiagnosis(patient) || isSleDiagnosis(patient) ||
    isAavDiagnosis(patient) || isIgaVDiagnosis(patient) ||
    isCryoVasDiagnosis(patient) || isUrticarialVasDiagnosis(patient) || isBehcetDiagnosis(patient) ||
    isPanDiagnosis(patient) || isCsvvDiagnosis(patient) ||
    isAosdDiagnosis(patient) || isApsDiagnosis(patient) || isGoutDiagnosis(patient) ||
    isMctdDiagnosis(patient) || isIgg4RdDiagnosis(patient) || isRpcDiagnosis(patient) ||
    isSjogrenDiagnosis(patient) || isMyositisDiagnosis(patient) ||
    isScleroDiagnosis(patient?.diagnosi) || isPmrDiagnosis(patient) || isLvvDiagnosis(patient)
  );

  const isPmrLvvPatient = isPmrDiagnosis(patient) || isLvvDiagnosis(patient);

  // True when patient is in "prima visita" state AND the first visit has not yet been documented.
  // In this state only the CTA and Reminders are shown — all clinical sections are hidden.
  const isFirstVisitPending = patient?.patient_state === "first_visit" && !firstVisit;

  // True for ALL patients still in the diagnostic workup pipeline (first_visit OR workup_in_progress).
  // These patients get a simplified view: prima visita card, workup entry, reminders only.
  // The full chronic-disease management interface is reserved for follow_up patients.
  const isWorkupMode = patient?.patient_state === "first_visit" || patient?.patient_state === "workup_in_progress";

  if (!patient) {
    return <div className="p-10 text-gray-500">Caricamento...</div>;
  }

  return (
    <PatientDetailErrorBoundary key={id}>
    <>
      {/* ── Sticky compact header — negative margins to escape layout padding ── */}
      <div className="-mx-6 md:-mx-8 lg:-mx-10 -mt-6 md:-mt-8 lg:-mt-10 mb-6 sticky top-0 z-40">
        <StickyPatientHeader
          patient={patient}
          assessments={assessments}
          labExams={labExams}
          therapies={therapies}
          alertCount={0}
          onGenerateReport={() => setReportDialogOpen(true)}
          onOpenExams={() => setExamsDialogOpen(true)}
          onOpenConsult={() => setConsultOpen(true)}
          onExportHistory={() => setHistoryExportOpen(true)}
        />
      </div>

      <div className="space-y-6 fade-in" data-testid="patient-detail-page">
        {/* ── Full patient header ── */}
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
          onOpenExamUploadQR={currentVisitId ? () => setExamQROpen(true) : undefined}
          onLoad={load}
          onImportText={() => setImportTextOpen(true)}
          onImportPdf={() => setImportPdfOpen(true)}
          onImportMultiPdf={() => setImportMultiPdfOpen(true)}
        />

        {/* ── Condividi consulto ── */}
        <div className="flex justify-end -mt-3 mb-1">
          <button
            onClick={() => setConsultOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors px-2.5 py-1.5 rounded-md hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200"
          >
            <Share2 className="w-3.5 h-3.5" />
            Condividi consulto
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            FOLLOW-UP — linear layout (come Visita di Workup Diagnostico)
            LEFT  = sidebar consultazione (tutto collassato di default)
            RIGHT = flusso clinico lineare per la visita di oggi
            ══════════════════════════════════════════════════════════════════ */}
        {!isWorkupMode ? (
          <>
          {/* ── PROFILO GENERALE DEL PAZIENTE ─── */}
          <PatientProfileStrip
            patientId={id}
            patient={patient}
            firstVisit={firstVisit}
            onCockpitData={(data) => setCockpitData(prev => ({ ...(prev || {}), ...data }))}
            onFirstVisitChange={() => {
              // Re-fetch both the patient doc (narrative fields may have changed)
              // and prima_visita structural data after any profile section save.
              Promise.all([
                patientsApi.get(id).then(p => setPatient(p)).catch(() => {}),
                diseaseProfileApi.get(id, "prima_visita")
                  .then(fv => setFirstVisit(fv?.data || null))
                  .catch(() => {}),
              ]);
            }}
            reportSections={cockpitReportSections}
            toggleReportSection={toggleCockpitSection}
          />

          {/* ── WORKUP / MONITORAGGI ─── */}
          <RheumatologicStatusStrip
            patientId={id}
            firstVisit={firstVisit}
            pastVisits={frozenWorkupVisitsRef.current ?? workupVisits}
            reportSections={cockpitReportSections}
            toggleReportSection={toggleCockpitSection}
            onWorkupData={(data) => setWorkupReportData(data)}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left font-normal">

            {/* ── LEFT: sidebar consultazione ────────────────────────────── */}
            <div className="space-y-3">

              {/* 1 · VISITE — lista unificata cronologica */}
              {(() => {
                const INSERT_SECTIONS = [
                  { key: "raccordo",         label: "Raccordo",              color: "#b45309" },
                  { key: "interval_history", label: "Anamnesi intervallare", color: "#b45309" },
                  { key: "physical_exam",    label: "Esame obiettivo",       color: "#b45309" },
                  { key: "labs_imaging",     label: "Esami / Imaging",       color: "#b45309" },
                ];
                const insertToSection = (text, key) => {
                  const h = todayVisitHandle.current;
                  if (!h) return;
                  const map = {
                    raccordo:         h.appendRaccordo,
                    interval_history: h.appendIntervalHistory,
                    physical_exam:    h.appendPhysicalExam,
                    labs_imaging:     h.appendLabsImaging,
                  };
                  map[key]?.(text);
                };
                const totalCount = sidebarUnifiedVisits.length;
                const hasAny = totalCount > 0;

                return (
                  <div>
                    <div className="flex items-center justify-between mb-2 px-0.5">
                      <h2 className="font-heading font-bold text-sm text-gray-700 uppercase tracking-[0.12em]">
                        Visite precedenti
                      </h2>
                      <span className="text-[11px] text-gray-400 font-medium">{totalCount}</span>
                    </div>
                    {!hasAny ? (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                        <p className="text-xs text-gray-400">Nessuna visita registrata.</p>
                        <p className="text-[11px] text-gray-300 mt-0.5">Salva la prima valutazione per iniziare.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sidebarUnifiedVisits.map((item) => {
                          if (item.type === "prima_visita") {
                            return (
                              <PrimaVisitaCard
                                key="prima_visita"
                                firstVisit={item.data}
                                patient={patient}
                                patientId={id}
                                onDelete={deletePrimaVisita}
                                onInsertToSection={insertToSection}
                                insertSections={INSERT_SECTIONS}
                                linkedAssessments={item.linkedAssessments}
                              />
                            );
                          }
                          if (item.type === "workup") {
                            const wv = item.data;
                            const wvDateKey = (wv.visit_date || "").slice(0, 10);
                            return (
                              <WorkupVisitCard
                                key={wv._id || wv.visit_date}
                                visit={wv}
                                patientId={id}
                                patient={patient}
                                onDelete={() => deleteWorkupVisit(wv._id || wv.id)}
                                onInsertToSection={insertToSection}
                                insertSections={INSERT_SECTIONS}
                                linkedAssessments={item.linkedAssessments}
                                onOpenExams={() => { setExamsInitialTab("lab"); setExamsDialogOpen(true); }}
                                onOpenClinica={() => setVisitDetailsGroup({
                                  date: wvDateKey,
                                  assessments: item.linkedAssessments || [],
                                  therapies: therapiesActiveOn(wvDateKey),
                                  exams: examsByDate.get(wvDateKey) || [],
                                })}
                                onRefresh={load}
                              />
                            );
                          }
                          if (item.type === "followup") {
                            const group = item.data;
                            return (
                              <PreviousVisitCard
                                key={group.date}
                                group={group}
                                patient={patient}
                                onOpenDetail={() => setVisitDetailsGroup(group)}
                                onDelete={() => deleteFollowupGroup(group)}
                                onInsertToSection={insertToSection}
                                insertSections={INSERT_SECTIONS}
                              />
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 2 · STORICO VALUTAZIONI button */}
              <button
                type="button"
                onClick={() => setHistoryDialogOpen(true)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-left"
              >
                <ClipboardList className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700">Storico valutazioni</div>
                  <div className="text-[11px] text-gray-400">Andamento nel tempo · indici clinimetrici</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>



            </div>

            {/* ── RIGHT: flusso clinico lineare ──────────────────────────── */}
            <div className="lg:col-span-2 space-y-5">

              {/* DIAGNOSI */}
              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 mb-0.5">Diagnosi principale</div>
                      <div className="font-heading font-bold text-base text-[#0A2540] leading-tight">
                        {patient.diagnosi || <span className="text-gray-400 font-normal text-sm italic">Non specificata</span>}
                      </div>
                      {criteriaEvals.length > 0 && (
                        <div className="mt-2">
                          <ClassificationBadges criteriaEvals={criteriaEvals} patientId={id} />
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm" variant="outline"
                      className="text-[11px] h-7 px-2.5 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 flex-shrink-0"
                      onClick={() => {
                        setSecDiagList(patient.diagnosi_secondarie || []);
                        setSecDiagInput("");
                        setSecDiagOpen(v => !v);
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Diagnosi secondarie
                    </Button>
                  </div>

                  {/* Secondary diagnoses tags (read-only view) */}
                  {!secDiagOpen && (patient.diagnosi_secondarie || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {(patient.diagnosi_secondarie || []).map((d) => (
                        <span key={d} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1", fontWeight: 500 }}>
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Inline editor */}
                  {secDiagOpen && (
                    <div style={{ marginTop: 14, padding: "14px", background: "#f8faff", borderRadius: 10, border: "1.5px solid #bfdbfe" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                        Diagnosi secondarie / overlap
                      </div>

                      {/* Current list */}
                      {secDiagList.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                          {secDiagList.map((d) => (
                            <span key={d} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "3px 10px 3px 10px", borderRadius: 20, background: "#eff6ff", border: "1.5px solid #bfdbfe", color: "#1e40af", fontWeight: 500 }}>
                              {d}
                              <button type="button" onClick={() => setSecDiagList(l => l.filter(x => x !== d))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "#93c5fd" }}>
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Suggestions */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                        {["Fibromialgia", "Osteoporosi", "Osteoartrosi", "Sindrome sicca", "Diabete mellito", "Ipertensione", "Dislipidemia", "Ipotiroidismo", "Depressione / ansia", "GERD"].filter(s => !secDiagList.includes(s)).map((s) => (
                          <button key={s} type="button" onClick={() => setSecDiagList(l => [...l, s])}
                            style={{ fontSize: 11, padding: "3px 9px", borderRadius: 12, border: "1px dashed #93c5fd", background: "#fff", color: "#3b82f6", cursor: "pointer", fontWeight: 500 }}>
                            + {s}
                          </button>
                        ))}
                      </div>

                      {/* Free input */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                        <input
                          type="text"
                          value={secDiagInput}
                          onChange={e => setSecDiagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && secDiagInput.trim() && !secDiagList.includes(secDiagInput.trim())) {
                              setSecDiagList(l => [...l, secDiagInput.trim()]);
                              setSecDiagInput("");
                            }
                          }}
                          placeholder="Altra diagnosi… (Invio per aggiungere)"
                          style={{ flex: 1, border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12, outline: "none" }}
                        />
                        <button type="button"
                          disabled={!secDiagInput.trim() || secDiagList.includes(secDiagInput.trim())}
                          onClick={() => { if (secDiagInput.trim() && !secDiagList.includes(secDiagInput.trim())) { setSecDiagList(l => [...l, secDiagInput.trim()]); setSecDiagInput(""); } }}
                          style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          Aggiungi
                        </button>
                      </div>

                      {/* Save / Cancel */}
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button type="button" onClick={() => setSecDiagOpen(false)}
                          style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
                          Annulla
                        </button>
                        <button type="button"
                          disabled={secDiagSaving}
                          onClick={async () => {
                            setSecDiagSaving(true);
                            try {
                              await patientsApi.update(id, { diagnosi_secondarie: secDiagList });
                              await load();
                              setSecDiagOpen(false);
                              toast.success("Diagnosi secondarie aggiornate");
                            } catch {
                              toast.error("Errore nel salvataggio");
                            } finally {
                              setSecDiagSaving(false);
                            }
                          }}
                          style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: secDiagSaving ? "#d1d5db" : "#0A2540", color: "#fff", fontSize: 12, fontWeight: 700, cursor: secDiagSaving ? "not-allowed" : "pointer" }}>
                          {secDiagSaving ? "Salvataggio…" : "Salva"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* TERAPIA REUMATOLOGICA IN CORSO */}
              <CollapsibleSection title="Terapia reumatologica in corso" defaultOpen={true}>
                <TherapySection
                  patient={patient}
                  visitStartTherapies={frozenTherapiesRef.current}
                  visitDate={followupVisitDate}
                  onAcceptReminder={handleAcceptReminder}
                  onRegisterHandle={(h) => { therapyHandle.current = h; }}
                  onAppendToPlan={handleAppendToPlan}
                  onTherapySaved={(name, dose, route, therapyEvent) => {
                    if (therapyEvent === "pre_existing") return;
                    const text = findPresetText(name, dose, route);
                    if (text) planHandle.current?.appendIndicazioni(text);
                  }}
                />
              </CollapsibleSection>

              {/* PROFILO DI MALATTIA */}
              {(hasProfiles || criteriaEvals.length > 0) && (
                <CollapsibleSection title="Profilo di malattia" defaultOpen={false}>
                  <div className="space-y-4">
                    <ClassificationBadges criteriaEvals={criteriaEvals} patientId={id} />
                    {isPmrLvvPatient && <PmrLvvProfileSection key={`pmrlvv-${profileRefreshKey}`} patient={patient} />}
                    {isRaDiagnosis(patient) && <RaProfileSection key={`ra-${profileRefreshKey}`} patient={patient} />}
                    {isSpaDiagnosis(patient) && <SpaProfileSection key={`spa-${profileRefreshKey}`} patient={patient} onUpdated={(d) => setSpaProfile(d)} />}
                    {isSleDiagnosis(patient) && <SleProfileSection key={`sle-${profileRefreshKey}`} patient={patient} />}
                    {isAavDiagnosis(patient) && <AavProfileSection key={`aav-${profileRefreshKey}`} patient={patient} />}
                    {isIgaVDiagnosis(patient) && <IgaVProfileSection key={`igav-${profileRefreshKey}`} patient={patient} />}
                    {isCryoVasDiagnosis(patient) && <CryoVasProfileSection key={`cryo-${profileRefreshKey}`} patient={patient} />}
                    {isUrticarialVasDiagnosis(patient) && <UrticarialVasProfileSection key={`urticarial-${profileRefreshKey}`} patient={patient} />}
                    {isBehcetDiagnosis(patient) && <BehcetProfileSection key={`behcet-${profileRefreshKey}`} patient={patient} />}
                    {isPanDiagnosis(patient) && <PanProfileSection key={`pan-${profileRefreshKey}`} patient={patient} />}
                    {isCsvvDiagnosis(patient) && <CsvvProfileSection key={`csvv-${profileRefreshKey}`} patient={patient} />}
                    {isAosdDiagnosis(patient) && <AosdProfileSection key={`aosd-${profileRefreshKey}`} patient={patient} />}
                    {isApsDiagnosis(patient) && <ApsProfileSection key={`aps-${profileRefreshKey}`} patient={patient} />}
                    {isGoutDiagnosis(patient) && <GoutProfileSection key={`gout-${profileRefreshKey}`} patient={patient} />}
                    {isMctdDiagnosis(patient) && <MctdProfileSection key={`mctd-${profileRefreshKey}`} patient={patient} />}
                    {isIgg4RdDiagnosis(patient) && <Igg4RdProfileSection key={`igg4rd-${profileRefreshKey}`} patient={patient} />}
                    {isRpcDiagnosis(patient) && <RpcProfileSection key={`rpc-${profileRefreshKey}`} patient={patient} />}
                    {isSjogrenDiagnosis(patient) && <SjogrenProfileSection key={`sjogren-${profileRefreshKey}`} patient={patient} />}
                    {isMyositisDiagnosis(patient) && <MyositisProfileSection key={`myositis-${profileRefreshKey}`} patient={patient} />}
                    {isScleroDiagnosis(patient.diagnosi) && <ScleroProfileSection key={`ssc-${profileRefreshKey}`} patient={patient} />}
                  </div>
                </CollapsibleSection>
              )}

              {/* Clinical alerts */}
              <ClinicalAlerts patient={patient} therapies={therapies} />

              {/* AAV summary */}
              {isAavDiagnosis(patient) && <AavSummaryHeader patient={patient} />}


              {/* VISITA DI OGGI + PIANO — un unico frame */}
              <Card className="border-gray-200 shadow-sm overflow-hidden" data-testid="followup-visit-card">
              <TodayVisitSection
                patient={patient}
                assessments={assessments}
                instrumentalExams={instrumentalExams}
                labExams={labExams}
                firstVisit={firstVisit}
                workupVisits={workupVisits}
                therapies={therapies}
                spaProfile={spaProfile}
                cockpitData={{ ...(cockpitData || {}), ...workupReportData }}
                cockpitReportSections={cockpitReportSections}
                planData={planData}
                onRegisterSaveHandle={(h) => { todayVisitHandle.current = h; }}
                onDateChange={setFollowupVisitDate}
                onSaved={(data) => { load(); if (data) setTodayVisitData(data); }}
                onOpenJointCount={() => {
                  setCompositeInitialJoints(todayVisitHandle.current?.getExamJoints?.() || {});
                  setCompositeMode("ra");
                }}
                onOpenPeripheralForm={() => {
                  setCompositeInitialJoints(todayVisitHandle.current?.getExamJoints?.() || {});
                  setCompositeInitialLei(todayVisitHandle.current?.getExamLei?.() || {});
                  setCompositeMode("psa");
                }}
                onOpenAxialForm={() => setCompositeMode("spa")}
                onOpenPetvas={(tab) => { setEditingPetvas(null); setPetvasInitialTab(tab || "score"); setPetvasDialogOpen(true); }}
                onOpenVascularImaging={(type) => {
                  if (type === "petvas") {
                    setEditingPetvas(null); setPetvasInitialTab("score"); setPetvasDialogOpen(true);
                  } else if (type === "ecodoppler") {
                    setEditingEchodoppler(null); setEchodopplerDialogOpen(true);
                  } else if (type === "angio_ct" || type === "angio_mri") {
                    setEditingAngio(null); setAngioInitialModality(type); setAngioDialogOpen(true);
                  } else if (type === "echo_msk") {
                    setEditingEchoMsk(null); setEchoMskDialogOpen(true);
                  }
                }}
                syncData={visitSyncData}
                onTherapySaved={() => { therapyHandle.current?.reload?.(); }}
                onClinimetrySaved={() => { load(); }}
                onAppendToPlan={handleAppendToPlan}
              />

              {/* PIANO */}
              <PlanSection
                patient={patient}
                patientId={id}
                therapies={therapies}
                onPlanChange={setPlanData}
                onRegisterHandle={(h) => { planHandle.current = h; }}
                appendPlanText={appendPlanText}
                initialTherapyText={planInitialTherapyText}
                onSaveVisit={(txt) => todayVisitHandle.current?.save(txt)}
                onOpenReport={() => todayVisitHandle.current?.openReport()}
                onDuplicatePrevious={() => todayVisitHandle.current?.duplicatePrevious()}
                onAddTherapy={openTherapyManager}
                onTherapySaved={() => { therapyHandle.current?.reload?.(); }}
                onClinimetrySaved={() => { load(); }}
              />
              </Card>

              {/* PROMEMORIA */}
              <RemindersSection patient={patient} />

            </div>
          </div>
          </>

        ) : (

          /* ══════════════════════════════════════════════════════════════════
             WORKUP MODE — vista semplificata (prima visita / iter workup)
             ══════════════════════════════════════════════════════════════════ */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">

              {firstVisit ? (
                <Card className="border-indigo-100 bg-indigo-50/40 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-indigo-900">Prima visita documentata</p>
                      <p className="text-[11px] text-indigo-600 truncate">
                        {firstVisit.referral_date && <span>{firstVisit.referral_date} · </span>}
                        {firstVisit.diagnostic_conclusion || firstVisit.suggested_diagnosis || "Nessuna conclusione"}
                        {firstVisit.diagnostic_certainty && <span className="ml-1 text-indigo-400">({firstVisit.diagnostic_certainty})</span>}
                      </p>
                    </div>
                    <Link to={`/pazienti/${id}/prima-visita`}>
                      <Button size="sm" variant="outline" className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 text-[11px] h-7 px-2.5">
                        Modifica
                      </Button>
                    </Link>
                  </div>
                </Card>
              ) : isFirstVisitPending ? (
                <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-sm overflow-hidden">
                  <div className="px-6 py-10 flex flex-col items-center text-center gap-5">
                    <div className="w-16 h-16 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center">
                      <ClipboardList className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="font-heading font-black text-2xl text-indigo-900 tracking-tight">
                        Prima visita non ancora documentata
                      </h2>
                      <p className="text-sm text-indigo-700 max-w-md leading-relaxed">
                        Documenta la prima visita reumatologica per raccogliere anamnesi, esame obiettivo, comorbidità e ipotesi diagnostica. Le sezioni cliniche si attiveranno al completamento.
                      </p>
                    </div>
                    <Link to={`/pazienti/${id}/prima-visita`}>
                      <Button className="bg-indigo-700 hover:bg-indigo-800 text-white px-8 h-11 text-sm font-semibold">
                        <ClipboardList className="w-4 h-4 mr-2" />
                        Avvia prima visita
                      </Button>
                    </Link>
                  </div>
                </Card>
              ) : (
                <Card className="border-dashed border-gray-200 bg-gray-50/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Prima visita non ancora documentata</p>
                    </div>
                    <Link to={`/pazienti/${id}/prima-visita`}>
                      <Button size="sm" className="bg-[#0A2540] text-white hover:bg-[#051626] text-[11px] h-7 px-2.5">
                        <ClipboardList className="w-3 h-3 mr-1" /> Avvia prima visita
                      </Button>
                    </Link>
                  </div>
                </Card>
              )}

              {patient?.patient_state === "workup_in_progress" && (
                <Card className="border-amber-200 bg-amber-50/40 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FlaskConical className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-900">Iter diagnostico in corso</p>
                      <p className="text-[11px] text-amber-700">
                        Registra una rivalutazione intervallare: anamnesi, esame obiettivo, esami, ipotesi diagnostiche.
                      </p>
                    </div>
                    <Link to={`/pazienti/${id}/visita-workup`}>
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] h-7 px-2.5">
                        <FlaskConical className="w-3 h-3 mr-1" /> Visita workup
                      </Button>
                    </Link>
                  </div>
                </Card>
              )}

              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FlaskConical className="w-4 h-4 text-teal-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Archivio Esami</p>
                      <p className="text-[11px] text-gray-500">Esami di laboratorio e referti strumentali del paziente.</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExamsDialogOpen(true)}
                    className="text-teal-700 border-teal-200 hover:bg-teal-50 text-[11px] h-7 px-2.5 flex-shrink-0"
                  >
                    <FlaskConical className="w-3 h-3 mr-1" /> Apri archivio
                  </Button>
                </div>
              </Card>

              <RemindersSection patient={patient} />
            </div>
            <div className="lg:col-span-4" />
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}

      {/* Storico valutazioni + Andamento nel tempo (aperto dal bottone sidebar) */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="font-heading font-bold text-lg tracking-tight">
                Storico valutazioni e andamento nel tempo
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setHistoryDialogOpen(false); setImportPdfInitialText(""); setImportPdfInitialDate(""); setImportTextOpen(true); }}
                className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 text-[11px] h-7 px-2.5 flex-shrink-0 whitespace-nowrap"
              >
                <FileText className="w-3 h-3 mr-1" /> Importa da testo
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <div className="border border-gray-100 rounded-lg p-4">
              <h3 className="font-heading font-bold text-sm text-gray-700 uppercase tracking-[0.12em] mb-3">
                Timeline clinica
              </h3>
              <ClinicalTimelineManager patientId={id} />
            </div>
            {isPmrLvvPatient ? (
              <div className="p-2">
                <PmrLvvTimeline
                  assessments={assessments}
                  instrumentalExams={instrumentalExams}
                  therapies={therapies}
                  labExams={labExams}
                  onEditImaging={(a) => {
                    setHistoryDialogOpen(false);
                    const examType = a.exam_type || a.index_type;
                    if (examType === "petvas") {
                      setEditingPetvas(a); setPetvasDialogOpen(true);
                    } else if (examType === "ecodoppler") {
                      setEditingEchodoppler(a); setEchodopplerDialogOpen(true);
                    } else if (examType === "angio_ct" || examType === "angio_mri") {
                      setEditingAngio(a); setAngioInitialModality(examType); setAngioDialogOpen(true);
                    } else if (examType === "echo_msk") {
                      setEditingEchoMsk(a); setEchoMskDialogOpen(true);
                    }
                  }}
                />
              </div>
            ) : (
              <>
                {/* Filtri */}
                {assessments.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Select value={histFilterType} onValueChange={setHistFilterType}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Indice" />
                      </SelectTrigger>
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
                    />
                    <input
                      type="date"
                      value={histDateTo}
                      onChange={(e) => setHistDateTo(e.target.value)}
                      className="h-8 text-xs px-2 border border-gray-200 rounded-md bg-white"
                    />
                    <Select value={histSort} onValueChange={setHistSort}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date_desc">Data ↓ (recenti)</SelectItem>
                        <SelectItem value="date_asc">Data ↑ (vecchi)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Tabella storico */}
                <Card className="border-gray-200 shadow-sm overflow-hidden" data-testid="assessment-history">
                  {assessments.length === 0 ? (
                    <div className="p-10 text-center text-gray-500" data-testid="empty-assessments">
                      Nessuna valutazione registrata. Salva la prima valutazione dalla scheda paziente.
                    </div>
                  ) : groupedHistory.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">Nessun risultato per questi filtri.</div>
                  ) : (
                    <VisitHistoryTable
                      columns={historyColumns}
                      inputCols={histInputColumns}
                      groupedHistory={groupedHistory}
                      responseByAssessmentId={responseByAssessmentId}
                      responseColor={responseColor}
                      startEdit={(a) => { setHistoryDialogOpen(false); startEdit(a); }}
                      removeAssessment={(aid) => { setHistoryDialogOpen(false); removeAssessment(aid); }}
                      onAddExam={() => { setHistoryDialogOpen(false); setExamsDialogOpen(true); }}
                      onDateClick={(g) => { setHistoryDialogOpen(false); setVisitDetailsGroup(g); }}
                      onUpdateInputs={updateAssessmentInputs}
                      onAddTherapy={(date) => { setQuickTherapyHistDate(date); setQuickTherapyHistOpen(true); }}
                    />
                  )}
                </Card>

                {/* Andamento nel tempo */}
                {!isPmrLvvPatient && chartData.length > 0 && (
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
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lab exams modal */}
      <ExamsDialog
        open={examsDialogOpen}
        onOpenChange={(v) => { setExamsDialogOpen(v); if (!v) { load(); setProfileRefreshKey((k) => k + 1); } }}
        patient={patient}
        initialTab={examsInitialTab}
      />

      {/* PRO management dialog */}
      <PROManagement
        patient={patient}
        open={proDialogOpen}
        onOpenChange={setProDialogOpen}
        onConverted={load}
      />

      {examQROpen && currentVisitId && (
        <ExamUploadQRModal
          visitId={currentVisitId}
          onClose={() => setExamQROpen(false)}
        />
      )}

      {/* New / edit assessment dialog */}
      <Dialog open={newOpen} onOpenChange={(v) => { setNewOpen(v); if (!v) setEditingAssessment(null); }}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">
              {editingAssessment ? "Modifica valutazione" : "Nuova valutazione"}
            </DialogTitle>
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
        visitDate={followupVisitDate}
        initialJoints={compositeInitialJoints}
        initialLeiSites={compositeInitialLei}
        onJointsSaved={(joints, leiSites) => {
          setVisitSyncData((prev) => ({
            ...prev,
            joint_exam: joints,
            lei: leiSites,
            syncKey: prev.syncKey + 1,
          }));
        }}
      />

      {/* Visit details dialog — opens when the user clicks a date in the history */}
      <VisitDetailsDialog
        open={!!visitDetailsGroup}
        group={visitDetailsGroup}
        patient={patient}
        onClose={() => setVisitDetailsGroup(null)}
        onEdit={(a) => { setVisitDetailsGroup(null); startEdit(a); }}
        onRemove={(aid) => { setVisitDetailsGroup(null); removeAssessment(aid); }}
        onOpenExams={() => { setVisitDetailsGroup(null); setExamsInitialTab("lab"); setExamsDialogOpen(true); }}
        onOpenTherapies={() => { setVisitDetailsGroup(null); openTherapyManager(); }}
        onPromoteToWorkup={handlePromoteToWorkup}
      />

      {/* Full history export dialog */}
      <HistoryExportDialog
        open={historyExportOpen}
        onOpenChange={setHistoryExportOpen}
        patient={patient}
        firstVisit={firstVisit}
        workupVisits={workupVisits}
        assessments={assessments}
        instrumentalExams={instrumentalExams}
      />

      {/* Visit report generation dialog */}
      <VisitReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        patient={patient}
        assessments={assessments}
        therapies={therapies}
        labExams={labExams}
        todayVisitData={todayVisitData}
        planData={planData}
        instrumentalExams={instrumentalExams}
      />

      {/* PETVAS / Vascular Homunculus dialog (PMR/LVV/GCA/Takayasu) */}
      {isPmrLvvPatient && (
        <VascularHomunculusDialog
          open={petvasDialogOpen}
          onClose={() => { setPetvasDialogOpen(false); setEditingPetvas(null); }}
          patient={patient}
          prefillAssessment={editingPetvas}
          initialTab={petvasInitialTab}
          visitDate={editingPetvas ? undefined : followupVisitDate}
          onSaved={load}
        />
      )}

      {/* Ecodoppler vascolare dialog */}
      {isPmrLvvPatient && (
        <EcodopplerDialog
          open={echodopplerDialogOpen}
          onClose={() => { setEchodopplerDialogOpen(false); setEditingEchodoppler(null); }}
          patient={patient}
          prefillAssessment={editingEchodoppler}
          visitDate={editingEchodoppler ? undefined : followupVisitDate}
          onSaved={load}
        />
      )}

      {/* AngioCT / AngioMRI dialog */}
      {isPmrLvvPatient && (
        <AngioImagingDialog
          open={angioDialogOpen}
          onClose={() => { setAngioDialogOpen(false); setEditingAngio(null); }}
          patient={patient}
          prefillAssessment={editingAngio}
          initialModality={angioInitialModality}
          visitDate={editingAngio ? undefined : followupVisitDate}
          onSaved={load}
        />
      )}

      {/* Eco MSK (musculoskeletal ultrasound for PMR) */}
      {isPmrLvvPatient && (
        <EchoMskDialog
          open={echoMskDialogOpen}
          onClose={() => { setEchoMskDialogOpen(false); setEditingEchoMsk(null); }}
          patient={patient}
          prefillAssessment={editingEchoMsk}
          visitDate={editingEchoMsk ? undefined : followupVisitDate}
          onSaved={load}
        />
      )}

      {/* ── Condividi consulto dialog ── */}
      <Dialog open={consultOpen} onOpenChange={setConsultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-indigo-500" />
              Condividi consulto
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            <p className="text-sm text-gray-500">
              Genera un link temporaneo per condividere la storia clinica del paziente
              in sola lettura con un collega esterno. I dati personali sono pseudonimizzati.
            </p>

            {/* ── Genera nuovo link ── */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <select
                  value={consultExpiry}
                  onChange={e => setConsultExpiry(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="168">Scade tra 7 giorni</option>
                  <option value="720">Scade tra 30 giorni</option>
                  <option value="2160">Scade tra 90 giorni</option>
                  <option value="8760">Scade tra 1 anno</option>
                </select>
              </div>
              <button
                onClick={createConsultToken}
                disabled={consultCreating}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {consultCreating
                  ? <SpinnerIcon className="w-4 h-4 animate-spin" />
                  : <Link2 className="w-4 h-4" />}
                Genera link
              </button>
            </div>

            {/* ── Link attivi ── */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Link attivi
              </p>
              {consultLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                  Caricamento…
                </div>
              ) : consultTokens.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-2">Nessun link generato per questo paziente.</p>
              ) : (
                <div className="space-y-2">
                  {consultTokens.map(t => {
                    const url = `${window.location.origin}/c/${t.token}`;
                    const expired = t.expires_at < new Date().toISOString();
                    const expDate = new Date(t.expires_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
                    return (
                      <div key={t.id} className={`flex items-center gap-2 p-3 rounded-lg border ${expired ? "border-gray-100 bg-gray-50 opacity-60" : "border-gray-200 bg-white"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono text-gray-600 truncate">{url}</div>
                          <div className={`text-xs mt-0.5 ${expired ? "text-red-400" : "text-gray-400"}`}>
                            {expired ? `Scaduto il ${expDate}` : `Scade il ${expDate}`}
                            {t.views > 0 && <span className="ml-2 text-gray-400">· {t.views} visualizzaz.</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => copyConsultLink(t)}
                          disabled={expired}
                          className="flex-shrink-0 p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Copia link"
                        >
                          {copiedId === t.id
                            ? <Check className="w-4 h-4 text-green-500" />
                            : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => revokeConsultToken(t.id)}
                          className="flex-shrink-0 p-1.5 rounded-md hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
                          title="Revoca link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Importa da lettera — parser avanzato (visitTextParser + reconciler) */}
      {patient && (
        <VisitImportButton
          patient={patient}
          onImported={() => { load(); setProfileRefreshKey((k) => k + 1); therapyHandle.current?.reload?.(); }}
          open={importTextOpen}
          onOpenChange={(v) => {
            setImportTextOpen(v);
            if (!v) {
              setImportPdfInitialText("");
              setImportPdfInitialDate("");
              setMultiPdfInitialBlocks([]);
            }
          }}
          initialText={importPdfInitialText}
          initialDate={importPdfInitialDate}
          initialMultiBlocks={multiPdfInitialBlocks}
        />
      )}


      {/* Importa più PDF — multi-documento, ogni PDF è un blocco separato */}
      <ImportMultiPdfModal
        open={importMultiPdfOpen}
        onClose={() => setImportMultiPdfOpen(false)}
        onMultiExtracted={(docs) => {
          setMultiPdfInitialBlocks(docs);
          setImportMultiPdfOpen(false);
          setImportTextOpen(true);
        }}
      />

      {/* Importa da PDF — thin bridge: estrae testo e passa a ImportVisitFromTextModal */}
      <ImportVisitPdfModal
        open={importPdfOpen}
        onClose={() => setImportPdfOpen(false)}
        onTextExtracted={({ text, detectedDate }) => {
          // ── LOG ③ handoff PDF → ImportVisitFromTextModal ──────────────────
          console.log("[PDF-IMPORT] ③ onTextExtracted →", {
            textLength: text.length,
            detectedDate,
            textPreview: text.slice(0, 200),
          });
          setImportPdfInitialText(text);
          setImportPdfInitialDate(detectedDate || "");
          setImportPdfOpen(false);
          setImportTextOpen(true);
        }}
      />

      {/* Aggiungi farmaco da Storico valutazioni */}
      <QuickTherapyModal
        open={quickTherapyHistOpen}
        onClose={() => { setQuickTherapyHistOpen(false); setQuickTherapyHistDate(null); }}
        sourceText=""
        patientId={id}
        visitDate={quickTherapyHistDate || undefined}
        onSaved={() => { load(); setQuickTherapyHistOpen(false); setQuickTherapyHistDate(null); }}
      />

      {/* Gestione terapia — 3-tab modal */}
      <GestioneTerapiaModal
        open={gestioneOpen}
        onClose={() => { setGestioneOpen(false); setTherapyLauncherAction(null); }}
        patient={patient}
        visitDate={followupVisitDate}
        visitStartTherapies={frozenTherapiesRef.current}
        initialAction={therapyLauncherAction}
        onAcceptReminder={handleAcceptReminder}
        onAppendToPlan={handleAppendToPlan}
        onTherapySaved={(name, dose, route, therapyEvent) => {
          therapyHandle.current?.reload?.();
          if (therapyEvent === "pre_existing") return;
          const text = findPresetText?.(name, dose, route);
          if (text) planHandle.current?.appendIndicazioni(text);
        }}
      />
    </>
    </PatientDetailErrorBoundary>
  );
}
