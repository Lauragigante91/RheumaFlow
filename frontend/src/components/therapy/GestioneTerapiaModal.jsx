/**
 * GestioneTerapiaModal
 * Full-screen overlay modal — 3-tab therapy management interface.
 * Tabs: Terapia in corso | Aggiungi nuova terapia | Storico terapie
 */
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { therapiesApi } from "../../lib/api";
import { Button }   from "../ui/button";
import { Input }    from "../ui/input";
import { Label }    from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Search, Info as InfoIcon, X, Sparkles, Check,
  ChevronDown, ChevronRight, ChevronUp, Edit, Download,
  ArrowRight, AlertCircle, AlertTriangle, CircleMinus,
  CirclePlus, ShieldCheck, Clock, ShieldAlert,
  History, TrendingUp, TrendingDown, Play, RefreshCw,
  Ban, PauseCircle, RotateCcw, MessageSquare, Layers, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import ItalianDatePicker from "../shared/ItalianDatePicker";
import BiologicCalendarModal from "./BiologicCalendarModal";
import SteroidTaperingModal  from "./SteroidTaperingModal";
import { THERAPY_CATEGORIES }      from "../../lib/therapySuggestions";
import { DRUGS, INDICATIONS, findDrug, categoryColor } from "../../lib/drugs";
import { detectInteractions, SEVERITY } from "../../lib/drugInteractions";
import { detectSafetyReminders, REMINDER_STYLE_INTERACTION_IDS } from "../../lib/safetyReminders";
import { getDrugTemplate, hasPrescriptionTemplate, buildPrescriptionExpansion, patientHasRenalImpairment } from "../../lib/prescriptionExpansion";
import { generateTimelineDates, formatScheduleForExport, phaseColor } from "../../lib/scheduleTimeline";
import { isSteroide, detectSteroide } from "../../lib/steroidTapering";

const TABS = [
  { key: "current",  label: "Terapia in corso",       sub: "All'ingresso della visita" },
  { key: "add",      label: "Aggiungi nuova terapia", sub: "Avvia una nuova terapia" },
  { key: "history",  label: "Storico terapie",         sub: "Farmaci sospesi / pregressi" },
  { key: "timeline", label: "Cronologia episodi",      sub: "Storia longitudinale" },
];

const SUSPEND_REASONS = [
  "Inefficacia primaria", "Inefficacia secondaria", "Intolleranza",
  "Effetti avversi", "Remissione", "Terapia ponte conclusa",
  "Non tollerata", "Perdita al follow-up", "Scelta del paziente", "Altro",
];
const START_REASONS = [
  "Prima linea", "Switch per inefficacia", "Switch per intolleranza",
  "Add-on", "Terapia ponte", "Altro",
];

const emptyAddForm = {
  drug_name: "", category: "csDMARD", indication: "",
  dose: "", frequency: "", route: "",
  start_date: "", reason_start: "", notes: "", selectedRegIdx: null,
};

function normDrugName(name) {
  return String(name || "").trim().toLowerCase();
}

function launcherActionKey(action) {
  if (!action) return "";
  return [action.action, action.drug_canonical || action.drug_name, action.dose, action.frequency, action.route, action.source_text].filter(Boolean).join("::");
}

function findActiveTherapyForAction(activeTherapies, action) {
  if (!action) return null;
  if (action.targetTherapy?.id) {
    const byId = activeTherapies.find(t => t.id === action.targetTherapy.id);
    if (byId) return byId;
    if (action.targetTherapy.status === "active") return action.targetTherapy;
  }
  const wanted = normDrugName(action.drug_canonical || action.drug_name);
  return activeTherapies.find(t => {
    const canonical = findDrug(t.drug_name)?.name || t.drug_name;
    return normDrugName(canonical) === wanted || normDrugName(t.drug_name) === wanted;
  }) || null;
}

function mapStartReason(reason = "") {
  const r = reason.toLowerCase();
  if (/ineffic/.test(r)) return "Switch per inefficacia";
  if (/intoller|toller|avvers|collateral/.test(r)) return "Switch per intolleranza";
  return "";
}

function mapStopReason(reason = "") {
  const r = reason.toLowerCase();
  if (/ineffic/.test(r)) return "Inefficacia primaria";
  if (/intoller|toller/.test(r)) return "Intolleranza";
  if (/avvers|collateral/.test(r)) return "Effetti avversi";
  if (/remission/.test(r)) return "Remissione";
  return "";
}

export default function GestioneTerapiaModal({
  open, onClose,
  patient, visitDate: visitDateProp,
  visitStartTherapies,
  initialAction,
  onAcceptReminder, onAppendToPlan, onTherapySaved,
}) {
  const today     = new Date().toISOString().slice(0, 10);
  const visitDate = visitDateProp || today;

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("current");

  // ── Therapies ─────────────────────────────────────────────────────────────
  const [therapies, setTherapies] = useState([]);

  const load = useCallback(async () => {
    if (!patient?.id) return;
    const data = await therapiesApi.listByPatient(patient.id);
    setTherapies(data);
  }, [patient?.id]); // eslint-disable-line

  useEffect(() => { if (open) load(); }, [open, patient?.id]); // eslint-disable-line

  // ── Derived ───────────────────────────────────────────────────────────────
  const active = useMemo(() => therapies.filter(t => t.status === "active"), [therapies]);
  const past   = useMemo(() => therapies.filter(t => t.status !== "active"), [therapies]);

  const snapshotIds    = visitStartTherapies
    ? new Set(visitStartTherapies.filter(t => t.status === "active").map(t => t.id))
    : null;
  const snapshotActive = snapshotIds ? active.filter(t =>  snapshotIds.has(t.id)) : active;
  const addedThisVisit = snapshotIds ? active.filter(t => !snapshotIds.has(t.id)) : [];
  const stoppedToday   = past.filter(t =>
    snapshotIds?.has(t.id) && t.end_date?.slice(0, 10) === visitDate
  );

  const allInteractions = useMemo(
    () => detectInteractions(active.map(t => t.drug_name).filter(Boolean)),
    [active]
  );
  const interactions = useMemo(
    () => allInteractions.filter(i => !REMINDER_STYLE_INTERACTION_IDS.has(i.id)),
    [allInteractions]
  );
  const reminders = useMemo(() => detectSafetyReminders(active, patient), [active, patient]);

  // ── Notes / changes tracking ───────────────────────────────────────────────
  const [visitNotes,       setVisitNotes]       = useState("");
  const [doseChangesToday, setDoseChangesToday] = useState([]);

  // ── Add form (Tab 2) ──────────────────────────────────────────────────────
  const [addForm, setAddForm]   = useState({ ...emptyAddForm, start_date: visitDate });
  const [drugQuery, setDrugQuery] = useState("");
  const [drugDDOpen, setDrugDDOpen] = useState(false);
  const drugRef = useRef(null);
  const appliedInitialActionRef = useRef("");

  // Prescription expansion
  const [expandEnabled,      setExpandEnabled]      = useState(false);
  const [expandWeekday,      setExpandWeekday]      = useState("");
  const [exFlags,            setExFlags]            = useState({});
  const [prescExpanded,      setPrescExpanded]      = useState(false);

  // Calendar modals
  const [bioCal, setBioCal]   = useState({ open: false, drug: "", date: "" });
  const [tapering, setTapering] = useState({ open: false, drug: "", date: "" });

  // Suspend / modify mini-modals
  const [suspendModal, setSuspendModal] = useState({ open: false, therapy: null });
  const [suspendForm,  setSuspendForm]  = useState({ date: visitDate, reason: "", notes: "" });
  const [modifyModal,  setModifyModal]  = useState({ open: false, therapy: null });
  const [modifyForm,   setModifyForm]   = useState({ dose: "", frequency: "", route: "", notes: "" });

  // Preview text modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState("");

  // Tab 3 filters
  const [histSearch,    setHistSearch]    = useState("");
  const [histInd,       setHistInd]       = useState("all");
  const [histCause,     setHistCause]     = useState("all");
  const [histExpanded,  setHistExpanded]  = useState(new Set());

  // Tab 4: timeline
  const [tlSearch, setTlSearch] = useState("");

  // ── Drug search ────────────────────────────────────────────────────────────
  const drugSuggestions = useMemo(() => {
    if (drugQuery.length < 3) return [];
    const q = drugQuery.toLowerCase();
    return DRUGS.filter(d => d.name.toLowerCase().includes(q)).slice(0, 10);
  }, [drugQuery]);

  const selectedDrugEntry = useMemo(() => findDrug(addForm.drug_name), [addForm.drug_name]);
  const drugRegimens      = selectedDrugEntry?.regimens || [];

  useEffect(() => {
    setExpandEnabled(false); setExpandWeekday("");
    const template = getDrugTemplate(addForm.drug_name);
    if (!template) { setExFlags({}); return; }
    const defaults = {};
    template.flags.forEach(f => { defaults[f.key] = f.defaultOn; });
    if (template.renalFlagKey && patientHasRenalImpairment(patient || {})) {
      defaults[template.renalFlagKey] = true;
    }
    setExFlags(defaults);
  }, [addForm.drug_name]); // eslint-disable-line

  const selectedRegimen = addForm.selectedRegIdx !== null ? drugRegimens[addForm.selectedRegIdx] : null;
  const timelineDates   = useMemo(() => {
    if (!selectedRegimen?.schedule || !addForm.start_date) return [];
    return generateTimelineDates(selectedRegimen.schedule, addForm.start_date);
  }, [selectedRegimen, addForm.start_date]);

  const expandPreview = useMemo(() => {
    if (!expandEnabled || !hasPrescriptionTemplate(addForm.drug_name)) return null;
    return buildPrescriptionExpansion({
      drugName: addForm.drug_name.trim(), dose: addForm.dose,
      frequency: addForm.frequency, route: addForm.route,
      weekday: expandWeekday, exFlags,
    });
  }, [expandEnabled, addForm.drug_name, addForm.dose, addForm.frequency, addForm.route, expandWeekday, exFlags]);

  const addFormReminders = useMemo(() => {
    if (!addForm.drug_name?.trim()) return [];
    return detectSafetyReminders([{ drug_name: addForm.drug_name, status: "active" }], patient || {});
  }, [addForm.drug_name, patient]);

  useEffect(() => {
    if (!open) {
      appliedInitialActionRef.current = "";
      return;
    }
    if (!initialAction) return;
    const key = launcherActionKey(initialAction);
    if (!key || appliedInitialActionRef.current === key) return;

    const drugName = initialAction.drug_canonical || initialAction.drug_name;
    const drug = findDrug(drugName);
    if (!drug) {
      toast.info("Farmaco non gestito nel modulo terapia");
      appliedInitialActionRef.current = key;
      return;
    }

    if (initialAction.action === "start") {
      setActiveTab("add");
      setAddForm({
        ...emptyAddForm,
        drug_name: drug.name,
        category: drug.category || initialAction.category || "other",
        dose: initialAction.dose || "",
        frequency: initialAction.frequency || "",
        route: initialAction.route || "",
        start_date: visitDate,
        reason_start: mapStartReason(initialAction.reason),
        notes: initialAction.source_text || "",
        selectedRegIdx: null,
      });
      setDrugQuery(drug.name);
      setDrugDDOpen(false);
      appliedInitialActionRef.current = key;
      return;
    }

    const target = findActiveTherapyForAction(active, initialAction);
    if (!target) {
      toast.info(`${drug.name} non risulta tra le terapie attive`);
      appliedInitialActionRef.current = key;
      return;
    }

    setActiveTab("current");
    if (initialAction.action === "stop") {
      setSuspendForm({
        date: visitDate,
        reason: mapStopReason(initialAction.reason),
        notes: initialAction.source_text || "",
      });
      setSuspendModal({ open: true, therapy: target });
    } else if (initialAction.action === "increase" || initialAction.action === "decrease") {
      setModifyForm({
        dose: initialAction.dose || target.dose || "",
        frequency: initialAction.frequency || target.frequency || "",
        route: initialAction.route || target.route || "",
        notes: initialAction.reason || initialAction.source_text || "",
      });
      setModifyModal({ open: true, therapy: target });
    }
    appliedInitialActionRef.current = key;
  }, [open, initialAction, active, visitDate]);

  // ── Tab 3 filtered history ─────────────────────────────────────────────────
  const filteredHistory = useMemo(() => past.filter(t => {
    if (histSearch && !t.drug_name.toLowerCase().includes(histSearch.toLowerCase())) return false;
    if (histInd   !== "all" && t.indication !== histInd) return false;
    if (histCause !== "all" && !t.discontinuation_reason?.toLowerCase().includes(histCause.toLowerCase())) return false;
    return true;
  }), [past, histSearch, histInd, histCause]);

  const histIndOptions   = useMemo(() => [...new Set(past.map(t => t.indication).filter(Boolean))], [past]);
  const histCauseOptions = useMemo(() => [...new Set(past.map(t => t.discontinuation_reason).filter(Boolean))], [past]);

  // ── Counts ────────────────────────────────────────────────────────────────
  const stopCount       = stoppedToday.length;
  const startCount      = addedThisVisit.length;
  const doseChangeCount = doseChangesToday.length;

  // ── Save new therapy ───────────────────────────────────────────────────────
  const saveNew = async () => {
    if (!addForm.drug_name.trim()) { toast.error("Specifica il nome del farmaco"); return; }
    try {
      await therapiesApi.create({
        patient_id: patient.id,
        drug_name:  addForm.drug_name.trim(),
        category:   addForm.category || "other",
        indication: addForm.indication || "",
        dose:       addForm.dose || "",
        frequency:  addForm.frequency || "",
        route:      addForm.route || "",
        start_date: addForm.start_date || visitDate,
        status:     "active",
        notes: [
          addForm.reason_start ? `Motivo avvio: ${addForm.reason_start}` : "",
          addForm.notes || "",
        ].filter(Boolean).join("\n"),
      });
      if (expandEnabled && expandPreview && onAppendToPlan) onAppendToPlan(expandPreview);
      if (timelineDates.length > 0 && onAppendToPlan) onAppendToPlan(formatScheduleForExport(timelineDates, addForm.drug_name));
      toast.success(`${addForm.drug_name} aggiunto alla terapia`);
      setAddForm({ ...emptyAddForm, start_date: visitDate });
      setDrugQuery("");
      setActiveTab("current");
      load();
      onTherapySaved?.(addForm.drug_name, addForm.dose, addForm.route);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore nel salvataggio");
    }
  };

  // ── Suspend ────────────────────────────────────────────────────────────────
  const openSuspend = (therapy) => {
    setSuspendForm({ date: visitDate, reason: "", notes: "" });
    setSuspendModal({ open: true, therapy });
  };
  const confirmSuspend = async () => {
    if (!suspendForm.reason.trim()) { toast.error("Specifica il motivo"); return; }
    try {
      await therapiesApi.update(suspendModal.therapy.id, {
        status: "discontinued",
        end_date: suspendForm.date,
        discontinuation_reason: suspendForm.reason,
        notes: suspendForm.notes
          ? `${suspendModal.therapy.notes ? suspendModal.therapy.notes + "\n" : ""}${suspendForm.notes}`
          : suspendModal.therapy.notes || "",
      });
      toast.success(`${suspendModal.therapy.drug_name} sospesa`);
      setSuspendModal({ open: false, therapy: null });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
  };

  // ── Modify dose ────────────────────────────────────────────────────────────
  const openModify = (therapy) => {
    setModifyForm({ dose: therapy.dose || "", frequency: therapy.frequency || "", route: therapy.route || "", notes: "" });
    setModifyModal({ open: true, therapy });
  };
  const confirmModify = async () => {
    try {
      await therapiesApi.update(modifyModal.therapy.id, {
        dose: modifyForm.dose, frequency: modifyForm.frequency, route: modifyForm.route,
        notes: modifyForm.notes
          ? `${modifyModal.therapy.notes ? modifyModal.therapy.notes + "\n" : ""}Modifica ${visitDate}: ${modifyForm.notes}`
          : modifyModal.therapy.notes || "",
      });
      setDoseChangesToday(prev => [...prev, { id: modifyModal.therapy.id, drugName: modifyModal.therapy.drug_name }]);
      toast.success(`Posologia di ${modifyModal.therapy.drug_name} aggiornata`);
      setModifyModal({ open: false, therapy: null });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
  };

  // ── Generate §10 text ──────────────────────────────────────────────────────
  const buildTherapyText = () => {
    const parts = [];
    const confirmed = snapshotActive
      .filter(t => !doseChangesToday.some(d => d.id === t.id))
      .map(t => `${t.drug_name}${t.dose ? " " + t.dose : ""}${t.frequency ? " " + t.frequency : ""}${t.route ? " (" + t.route + ")" : ""}`.trim())
      .filter(Boolean);
    if (confirmed.length > 0) parts.push("Si conferma " + confirmed.join(", ") + ".");
    stoppedToday.forEach(t => parts.push(`Si sospende ${t.drug_name}${t.discontinuation_reason ? " per " + t.discontinuation_reason.toLowerCase() : ""}.`));
    doseChangesToday.forEach(d => {
      const t = therapies.find(x => x.id === d.id);
      if (t) parts.push(`Si modifica posologia di ${t.drug_name}: ${[t.dose, t.frequency].filter(Boolean).join(" ")}.`);
    });
    addedThisVisit.forEach(t => parts.push(`Si avvia ${t.drug_name} ${[t.dose, t.route ? `(${t.route})` : "", t.frequency].filter(Boolean).join(" ")}.`.replace(/  +/g, " ").trim()));
    if (visitNotes.trim()) parts.push(visitNotes.trim());
    return parts.join("\n");
  };

  const handlePreview = () => { setPreviewText(buildTherapyText()); setPreviewOpen(true); };
  const handleGenerate = () => {
    const text = buildTherapyText();
    if (!text.trim()) { toast.info("Nessuna modifica terapeutica da riportare"); return; }
    onAppendToPlan?.(text);
    toast.success("Testo aggiunto a §10 – Terapia");
  };

  // Reset state when modal closes
  const handleClose = () => {
    setActiveTab("current");
    setAddForm({ ...emptyAddForm, start_date: visitDate });
    setDrugQuery("");
    setVisitNotes("");
    setDoseChangesToday([]);
    onClose?.();
  };

  if (!open) return null;

  const anySubOpen = suspendModal.open || modifyModal.open || previewOpen || bioCal.open || tapering.open;

  return (
    <>
      {/* Fullscreen overlay — don't close while a sub-modal is open */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={anySubOpen ? undefined : handleClose} />
      <div className="fixed inset-4 z-50 rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="font-heading font-bold text-xl tracking-tight">Gestione terapia</h2>
          <span className="text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
            Visita del {new Date(visitDate).toLocaleDateString("it-IT")}
          </span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePreview}>
            <InfoIcon className="w-3.5 h-3.5" /> Anteprima testo per 10 - Terapia
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs bg-[#0A2540] text-white hover:bg-[#051626]"
            onClick={handleGenerate}
          >
            <Sparkles className="w-3.5 h-3.5" /> Genera testo per 10 - Terapia
          </Button>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0 px-6">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-left transition-colors border-b-2 -mb-px mr-1 ${
                activeTab === tab.key
                  ? "border-[#0A2540] text-[#0A2540]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <div className={`text-sm font-semibold ${activeTab === tab.key ? "text-[#0A2540]" : "text-gray-600"}`}>{tab.label}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{tab.sub}</div>
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">

            {/* ── TAB 1: TERAPIA IN CORSO ─────────────────────────────── */}
            {activeTab === "current" && (
              <div className="flex gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 mb-5">
                    <InfoIcon className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Questa è la terapia assunta dal paziente all'ingresso della visita.</p>
                      <p className="text-xs text-blue-700 mt-0.5">Le modifiche decise oggi saranno applicate dalla prossima visita.</p>
                    </div>
                  </div>

                  <SafetyPanel
                    reminders={reminders}
                    interactions={interactions}
                    patientId={patient?.id}
                    onAcceptReminder={onAcceptReminder}
                  />

                  <h3 className="text-sm font-semibold text-gray-700 mt-5 mb-3">
                    Farmaci attivi ({snapshotActive.length + addedThisVisit.length})
                  </h3>

                  {(snapshotActive.length + addedThisVisit.length + stoppedToday.length) === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center text-gray-400 text-sm">
                      Nessuna terapia registrata per questo paziente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {snapshotActive.map(t => (
                        <ActiveTherapyRow key={t.id} t={t} onModify={openModify} onSuspend={openSuspend} />
                      ))}
                      {stoppedToday.map(t => (
                        <StoppedTodayRow key={t.id} t={t} />
                      ))}
                      {addedThisVisit.map(t => (
                        <ActiveTherapyRow key={t.id} t={t} onModify={openModify} onSuspend={openSuspend} addedToday />
                      ))}
                    </div>
                  )}

                  {/* Quick add */}
                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Aggiungi nuova terapia</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Cerca farmaco (es. Adalimumab, Etanercept...)"
                          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                          onFocus={() => setActiveTab("add")}
                          readOnly
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {["Adalimumab", "Etanercept", "Golimumab", "Secukinumab", "Tofacitinib"].map(name => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            const d = findDrug(name);
                            setAddForm({ ...emptyAddForm, start_date: visitDate, drug_name: name, category: d?.category || "bDMARD" });
                            setDrugQuery(name);
                            setActiveTab("add");
                          }}
                          className="px-3 py-1 text-xs rounded-full border border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          {name}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setActiveTab("add")}
                        className="px-3 py-1 text-xs rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                      >
                        + Altri farmaci
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right panel */}
                <div className="w-64 flex-shrink-0 space-y-4">
                  <NotePanel visitNotes={visitNotes} setVisitNotes={setVisitNotes} />
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h4 className="text-xs font-semibold text-gray-700 mb-3">Riepilogo modifiche odierne</h4>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <CircleMinus className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <span className="text-lg font-bold text-gray-900 w-6">{stopCount}</span>
                        <span className="text-sm text-gray-600">Sospensione{stopCount !== 1 ? "i" : ""}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <CirclePlus className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-lg font-bold text-gray-900 w-6">{startCount}</span>
                        <span className="text-sm text-gray-600">Nuova terapia</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Edit className="w-4 h-4 text-blue-500 flex-shrink-0 ml-0.5" />
                        <span className="text-lg font-bold text-gray-900 w-6">{doseChangeCount}</span>
                        <span className="text-sm text-gray-600">Modifiche posologiche</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h4 className="text-xs font-semibold text-gray-700 mb-0.5">Prossimo stato terapeutico</h4>
                    <p className="text-[10px] text-gray-400 mb-2">(sarà attivo dalla prossima visita)</p>
                    {active.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Nessuna terapia attiva</p>
                    ) : (
                      <div className="space-y-1">
                        {active.map(t => (
                          <div key={t.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                            <span className="font-medium">{t.drug_name}</span>
                            {t.dose && <span className="text-gray-400">{t.dose}</span>}
                            {t.route && <span className="text-gray-400">({t.route})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: AGGIUNGI NUOVA TERAPIA ───────────────────────── */}
            {activeTab === "add" && (
              <div className="flex gap-6">
                <div className="flex-1 min-w-0 space-y-4">
                  {/* 1. Drug search */}
                  <section className="rounded-lg border border-gray-200 bg-white p-5">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">1. Seleziona il farmaco</h3>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        ref={drugRef}
                        type="text"
                        placeholder="Cerca farmaco (es. Adalimumab, Etanercept, Abatacept...)"
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                        value={drugQuery}
                        onChange={e => {
                          setDrugQuery(e.target.value);
                          setDrugDDOpen(true);
                          if (!e.target.value.trim()) setAddForm(f => ({ ...f, drug_name: "", indication: "", dose: "", frequency: "", route: "", selectedRegIdx: null }));
                        }}
                        onFocus={() => setDrugDDOpen(true)}
                        onBlur={() => setTimeout(() => setDrugDDOpen(false), 150)}
                        autoComplete="off"
                      />
                      {drugDDOpen && drugSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-52 overflow-y-auto">
                          {drugSuggestions.map(d => (
                            <button
                              key={d.name}
                              type="button"
                              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center gap-2 border-b border-gray-50 last:border-0"
                              onMouseDown={() => {
                                setDrugQuery(d.name);
                                const defaultReg = d.regimens?.length === 1 ? d.regimens[0] : null;
                                setAddForm(f => ({
                                  ...f, drug_name: d.name, category: d.category || "other",
                                  indication: defaultReg?.indication || "",
                                  dose: defaultReg?.dose || "",
                                  frequency: defaultReg?.frequency || "",
                                  route: defaultReg?.route || "",
                                  selectedRegIdx: d.regimens?.length === 1 ? 0 : null,
                                }));
                                setDrugDDOpen(false);
                              }}
                            >
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: categoryColor(d.category) }} />
                              <span className="font-medium text-gray-800">{d.name}</span>
                              <span className="text-xs text-gray-400 ml-auto">{THERAPY_CATEGORIES[d.category] || d.category}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {drugQuery.length < 3 && !addForm.drug_name && (
                      <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                        <InfoIcon className="w-3.5 h-3.5" /> Digita almeno 3 caratteri per visualizzare i suggerimenti
                      </p>
                    )}
                    {selectedDrugEntry?.notes && (
                      <div className="mt-2.5 flex items-start gap-2 text-xs text-amber-700 italic bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>{selectedDrugEntry.notes}</span>
                      </div>
                    )}
                    {addFormReminders.slice(0, 3).map(r => (
                      <div key={r.id} className={`mt-1.5 flex items-start gap-2 text-xs rounded-lg px-3 py-1.5 border ${r.priority === "high" ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>{r.label}</span>
                      </div>
                    ))}
                    {isSteroide(addForm.drug_name) && (
                      <button type="button" onClick={() => setTapering({ open: true, drug: addForm.drug_name, date: addForm.start_date })}
                        className="mt-2.5 flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition">
                        📉 Imposta piano di scalaggio steroide
                      </button>
                    )}
                    {(addForm.category === "bDMARD" || addForm.category === "tsDMARD") && addForm.drug_name && (
                      <button type="button" onClick={() => setBioCal({ open: true, drug: addForm.drug_name, date: addForm.start_date })}
                        className="mt-2.5 flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-sky-300 bg-sky-50 text-sky-800 text-xs font-semibold hover:bg-sky-100 transition">
                        💉 Vedi calendario somministrazioni completo
                      </button>
                    )}
                  </section>

                  {/* 2. Schema chips */}
                  {drugRegimens.length > 0 && (
                    <section className="rounded-lg border border-gray-200 bg-white p-5">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold text-gray-800">2. Scegli lo schema suggerito per l'indicazione</h3>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">Gli schemi sono basati su linee guida e indicazioni registrate.</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {drugRegimens.slice(0, 4).map((reg, idx) => {
                          const isSelected = addForm.selectedRegIdx === idx;
                          return (
                            <button key={idx} type="button"
                              onClick={() => setAddForm(f => ({ ...f, indication: reg.indication, dose: reg.dose || f.dose, frequency: reg.frequency || f.frequency, route: reg.route || f.route, selectedRegIdx: idx }))}
                              className={`relative flex flex-col items-start px-3 py-2 rounded-lg border-2 text-left transition-all min-w-[90px] ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
                            >
                              {isSelected && <span className="absolute top-1.5 right-1.5"><Check className="w-3 h-3 text-blue-500" /></span>}
                              <span className={`text-xs font-bold ${isSelected ? "text-blue-700" : "text-gray-700"}`}>{reg.indication}</span>
                              <span className="text-[11px] text-gray-500 mt-0.5">{reg.dose}</span>
                              <span className="text-[10px] text-gray-400">{reg.frequency}</span>
                            </button>
                          );
                        })}
                        {drugRegimens.length > 4 && (
                          <div className="relative">
                            <select
                              className="h-full px-2 pr-7 text-xs border-2 border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none appearance-none cursor-pointer"
                              value={addForm.selectedRegIdx !== null && addForm.selectedRegIdx >= 4 ? addForm.selectedRegIdx : ""}
                              onChange={e => {
                                const idx = parseInt(e.target.value, 10);
                                if (!isNaN(idx)) {
                                  const reg = drugRegimens[idx];
                                  setAddForm(f => ({ ...f, indication: reg.indication, dose: reg.dose || f.dose, frequency: reg.frequency || f.frequency, route: reg.route || f.route, selectedRegIdx: idx }));
                                }
                              }}
                            >
                              <option value="">Altre indicazioni</option>
                              {drugRegimens.slice(4).map((reg, i) => <option key={i + 4} value={i + 4}>{reg.indication}</option>)}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                          </div>
                        )}
                      </div>
                      {addForm.selectedRegIdx !== null && (
                        <p className="text-xs text-gray-500 italic">Lo schema selezionato compilerà automaticamente i campi sottostanti. Modifiche manuali consentite.</p>
                      )}
                    </section>
                  )}

                  {/* 3. Editable fields */}
                  <section className="rounded-lg border border-gray-200 bg-white p-5">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">
                      {drugRegimens.length > 0 ? "3." : "2."} Campi modificabili
                    </h3>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Dose</Label>
                        <Input value={addForm.dose} onChange={e => setAddForm(f => ({ ...f, dose: e.target.value }))} placeholder="es. 160 mg" className="h-9 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Frequenza</Label>
                        <Input value={addForm.frequency} onChange={e => setAddForm(f => ({ ...f, frequency: e.target.value }))} placeholder="es. Ogni 4 settimane" className="h-9 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Via</Label>
                        <Input value={addForm.route} onChange={e => setAddForm(f => ({ ...f, route: e.target.value }))} placeholder="es. s.c." className="h-9 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Data inizio terapia</Label>
                        <ItalianDatePicker value={addForm.start_date} onChange={v => setAddForm(f => ({ ...f, start_date: v }))} testid="add-therapy-start-date" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Motivo dell'inizio</Label>
                        <select
                          className="w-full h-9 px-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                          value={addForm.reason_start}
                          onChange={e => setAddForm(f => ({ ...f, reason_start: e.target.value }))}
                        >
                          <option value="">Seleziona motivo</option>
                          {START_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">Note (opzionali)</Label>
                        <Input value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} placeholder="Aggiungi una nota..." className="h-9 text-sm" />
                      </div>
                    </div>
                  </section>

                  {/* 3/4. Calendar preview */}
                  {timelineDates.length > 0 && (
                    <section className="rounded-lg border border-gray-200 bg-white p-5">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3">
                        {drugRegimens.length > 0 ? "3." : "3."} Calendario somministrazioni <span className="text-xs font-normal text-gray-400">(anteprima)</span>
                      </h3>
                      <div className="flex gap-4 overflow-x-auto pb-1">
                        {timelineDates.slice(0, 5).map((item, i) => (
                          <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1 min-w-[80px]">
                            <div className="w-2 h-2 rounded-full" style={{ background: phaseColor(item.type) }} />
                            <span className="text-xs font-medium text-gray-700">{new Date(item.date).toLocaleDateString("it-IT")}</span>
                            <span className="text-[11px] text-gray-500">{item.dose || addForm.dose}</span>
                            {i === 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">Inizio</span>}
                          </div>
                        ))}
                        {timelineDates.length > 5 && <div className="flex-shrink-0 flex items-center text-gray-400"><ArrowRight className="w-4 h-4" /></div>}
                      </div>
                      <button type="button" onClick={() => setBioCal({ open: true, drug: addForm.drug_name, date: addForm.start_date })}
                        className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                        Vedi calendario completo <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </section>
                  )}

                  {/* Prescription expansion */}
                  {hasPrescriptionTemplate(addForm.drug_name) && (
                    <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                      <button type="button"
                        className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                        onClick={() => setPrescExpanded(v => !v)}>
                        <span className="font-medium">Espansione prescrittiva <span className="text-gray-400 font-normal">(opzionale)</span></span>
                        {prescExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </button>
                      {prescExpanded && (() => {
                        const template = getDrugTemplate(addForm.drug_name);
                        if (!template) return null;
                        return (
                          <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={expandEnabled} onChange={e => setExpandEnabled(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                              <span className="text-sm text-gray-700">Genera testo prescrittivo espanso</span>
                            </label>
                            {expandEnabled && (
                              <>
                                {template.weekdayLabel && (
                                  <div>
                                    <Label className="text-xs text-gray-500 mb-1 block">{template.weekdayLabel}</Label>
                                    <Input value={expandWeekday} onChange={e => setExpandWeekday(e.target.value)} placeholder="es. Lunedì" className="h-8 text-sm max-w-xs" />
                                  </div>
                                )}
                                <div className="space-y-1.5">
                                  {template.flags.map(f => (
                                    <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                                      <input type="checkbox" checked={!!exFlags[f.key]} onChange={e => setExFlags(prev => ({ ...prev, [f.key]: e.target.checked }))} className="w-3.5 h-3.5 rounded border-gray-300" />
                                      <span className="text-xs text-gray-600">{f.label}</span>
                                    </label>
                                  ))}
                                </div>
                                {expandPreview && (
                                  <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{expandPreview}</div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </section>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={() => { setAddForm({ ...emptyAddForm, start_date: visitDate }); setDrugQuery(""); setActiveTab("current"); }}>
                      Annulla
                    </Button>
                    <Button className="bg-[#0A2540] text-white hover:bg-[#051626] px-6" onClick={saveNew} disabled={!addForm.drug_name.trim()}>
                      Aggiungi terapia in questa visita
                    </Button>
                  </div>
                </div>

                {/* Right panel */}
                <div className="w-64 flex-shrink-0 space-y-4">
                  <NotePanel visitNotes={visitNotes} setVisitNotes={setVisitNotes} />
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h4 className="text-xs font-semibold text-gray-700 mb-3">Anteprima terapia da aggiungere</h4>
                    <div className={`rounded-md px-3 py-2 text-xs mb-3 ${addForm.drug_name ? "bg-green-50 border border-green-200 text-green-700" : "bg-gray-50 border border-gray-200 text-gray-400"}`}>
                      {addForm.drug_name ? "● Nuova terapia" : "Nessun farmaco selezionato"}
                    </div>
                    {addForm.drug_name && (
                      <div className="space-y-1.5 text-xs">
                        <div><span className="text-gray-400">Farmaco</span><div className="font-semibold text-gray-800 mt-0.5">{addForm.drug_name}</div></div>
                        {addForm.indication && <div><span className="text-gray-400">Indicazione</span><div className="font-semibold text-gray-800 mt-0.5">{addForm.indication}</div></div>}
                        {(addForm.dose || addForm.frequency || addForm.route) && (
                          <div><span className="text-gray-400">Schema selezionato</span>
                            <div className="font-semibold text-gray-800 mt-0.5">{[addForm.dose, addForm.frequency, addForm.route ? `(${addForm.route})` : ""].filter(Boolean).join(" ")}</div>
                          </div>
                        )}
                        {addForm.start_date && <div><span className="text-gray-400">Data inizio</span><div className="font-semibold text-gray-800 mt-0.5">{new Date(addForm.start_date).toLocaleDateString("it-IT")}</div></div>}
                        {timelineDates.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <span className="text-gray-400">Prossimi eventi</span>
                            <div className="mt-1 space-y-1">
                              {timelineDates.slice(0, 4).map((item, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: phaseColor(item.type) }} />
                                  <span className="text-gray-600">{new Date(item.date).toLocaleDateString("it-IT")}</span>
                                  <span className="text-gray-500">{item.dose || addForm.dose}</span>
                                  {i === 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded font-semibold">Inizio</span>}
                                </div>
                              ))}
                              {timelineDates.length > 4 && <div className="text-gray-400">...</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: STORICO TERAPIE ──────────────────────────────── */}
            {activeTab === "history" && (
              <div className="flex gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 mb-4">
                    <InfoIcon className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Qui trovi l'elenco delle terapie sospese o concluse prima dell'ingresso della visita corrente.</p>
                      <p className="text-xs text-blue-700 mt-0.5">Per consultare il dettaglio di una terapia clicca sulla riga corrispondente.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input placeholder="Cerca farmaco..." className="pl-9 h-9 text-sm" value={histSearch} onChange={e => setHistSearch(e.target.value)} />
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-shrink-0">
                      <Download className="w-3.5 h-3.5" /> Esporta elenco
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <div className="relative">
                      <select className="h-9 pl-3 pr-8 text-sm border border-gray-200 rounded-md bg-white focus:outline-none appearance-none cursor-pointer" value={histInd} onChange={e => setHistInd(e.target.value)}>
                        <option value="all">Tutte le indicazioni</option>
                        {histIndOptions.map(ind => <option key={ind} value={ind}>{INDICATIONS[ind] || ind}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select className="h-9 pl-3 pr-8 text-sm border border-gray-200 rounded-md bg-white focus:outline-none appearance-none cursor-pointer" value={histCause} onChange={e => setHistCause(e.target.value)}>
                        <option value="all">Tutte le cause di sospensione</option>
                        {histCauseOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mb-2">Terapie trovate: {filteredHistory.length}</p>

                  {filteredHistory.length > 0 && (
                    <div className="grid grid-cols-[110px_1fr_130px_1fr_24px] gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                      <span>Periodo</span><span>Terapia</span><span>Indicazione</span><span>Motivo della sospensione</span><span />
                    </div>
                  )}

                  {filteredHistory.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center text-gray-400 text-sm">Nessuna terapia storica registrata.</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {filteredHistory.map(t => {
                        const isExp = histExpanded.has(t.id);
                        const startY  = t.start_date ? new Date(t.start_date).toLocaleDateString("it-IT", { month: "2-digit", year: "numeric" }) : null;
                        const endY    = t.end_date   ? new Date(t.end_date).toLocaleDateString("it-IT",   { month: "2-digit", year: "numeric" }) : null;
                        const months  = (t.start_date && t.end_date)
                          ? Math.round((new Date(t.end_date) - new Date(t.start_date)) / (1000 * 60 * 60 * 24 * 30.4)) : null;
                        return (
                          <div key={t.id}>
                            <button type="button"
                              className="w-full grid grid-cols-[110px_1fr_130px_1fr_24px] gap-2 px-3 py-3.5 text-left hover:bg-gray-50/60 transition items-start"
                              onClick={() => setHistExpanded(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}>
                              <div className="flex items-start gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0 mt-1.5" />
                                <div>
                                  {startY && <div className="text-xs text-gray-500">{startY}</div>}
                                  {endY   && <div className="text-xs text-gray-400">{endY}</div>}
                                  {months !== null && <div className="text-[10px] text-gray-400">({months} mes{months === 1 ? "e" : "i"})</div>}
                                </div>
                              </div>
                              <div>
                                <span className="font-semibold text-sm text-gray-800">{t.drug_name}</span>
                                {t.route && <span className="ml-1.5 text-xs text-gray-400">{t.route}</span>}
                                {t.dose && <div className="text-xs text-gray-500 mt-0.5">{t.dose}</div>}
                              </div>
                              <div>
                                {t.indication
                                  ? <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">{t.indication}</span>
                                  : <span className="text-gray-300">—</span>}
                              </div>
                              <div>
                                {t.discontinuation_reason
                                  ? <>
                                      <div className="text-sm text-gray-700">{t.discontinuation_reason}</div>
                                      {t.notes && <div className="text-xs text-gray-400 mt-0.5">{t.notes.split("\n")[0]}</div>}
                                    </>
                                  : <span className="text-gray-300">—</span>}
                              </div>
                              <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${isExp ? "rotate-90" : ""}`} />
                            </button>
                            {isExp && (
                              <div className="bg-gray-50/60 px-8 py-3 border-t border-gray-100 text-xs text-gray-600 grid grid-cols-2 gap-3">
                                {t.dose && <div><span className="text-gray-400">Dose:</span> {t.dose}</div>}
                                {t.frequency && <div><span className="text-gray-400">Frequenza:</span> {t.frequency}</div>}
                                {t.route && <div><span className="text-gray-400">Via:</span> {t.route}</div>}
                                {t.start_date && <div><span className="text-gray-400">Inizio:</span> {new Date(t.start_date).toLocaleDateString("it-IT")}</div>}
                                {t.end_date && <div><span className="text-gray-400">Fine:</span> {new Date(t.end_date).toLocaleDateString("it-IT")}</div>}
                                {t.notes && <div className="col-span-2"><span className="text-gray-400">Note:</span> {t.notes}</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right panel history */}
                <div className="w-64 flex-shrink-0 space-y-4">
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h4 className="text-xs font-semibold text-gray-700 mb-3">Riepilogo storico terapie</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Terapie pregresse totali</span>
                        <span className="font-bold text-gray-900">{past.length}</span>
                      </div>
                      {past.length > 0 && (() => {
                        const withDates = past.filter(t => t.start_date && t.end_date);
                        if (!withDates.length) return null;
                        const avg = Math.round(withDates.reduce((acc, t) => acc + Math.round((new Date(t.end_date) - new Date(t.start_date)) / (1000 * 60 * 60 * 24 * 30.4)), 0) / withDates.length);
                        return (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Durata media terapie</span>
                            <span className="font-bold text-gray-900">{avg} mesi</span>
                          </div>
                        );
                      })()}
                    </div>
                    {past.length > 0 && (() => {
                      const counts = {};
                      past.forEach(t => { const r = t.discontinuation_reason; if (!r) return; const k = r.length > 20 ? r.slice(0, 20) + "…" : r; counts[k] = (counts[k] || 0) + 1; });
                      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
                      if (!sorted.length) return null;
                      return (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="text-xs font-semibold text-gray-600 mb-2">Motivi principali di sospensione</div>
                          {sorted.map(([reason, count]) => (
                            <div key={reason} className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>{reason}</span>
                              <span className="text-gray-400">{count} ({Math.round(count / past.length * 100)}%)</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {past.length > 0 && (() => {
                    const last = [...past].sort((a, b) => (b.end_date || "").localeCompare(a.end_date || ""))[0];
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <h4 className="text-xs font-semibold text-gray-700 mb-2">Ultima terapia precedente</h4>
                        <div className="text-sm font-semibold text-gray-800">{last.drug_name}</div>
                        {last.route && <span className="text-xs text-gray-400 ml-1">{last.route}</span>}
                        {last.dose && <div className="text-xs text-gray-500 mt-0.5">{last.dose}</div>}
                        {last.end_date && <div className="text-xs text-gray-500 mt-1">Sospesa il {new Date(last.end_date).toLocaleDateString("it-IT")}</div>}
                        {last.discontinuation_reason && <div className="text-xs text-gray-500">Motivo: {last.discontinuation_reason}</div>}
                      </div>
                    );
                  })()}

                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h4 className="text-xs font-semibold text-gray-600 mb-2">Nota</h4>
                    <div className="flex items-start gap-2 text-[11px] text-gray-500">
                      <InfoIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
                      <span>Le terapie elencate sono state sospese prima dell'ingresso della visita del {new Date(visitDate).toLocaleDateString("it-IT")}.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 4: CRONOLOGIA EPISODI ──────────────────────────── */}
            {activeTab === "timeline" && (
              <TherapyEpisodeTimeline
                therapies={therapies}
                search={tlSearch}
                setSearch={setTlSearch}
              />
            )}

          </div>
        </div>

        {/* Footer note Tab 1 */}
        {activeTab === "current" && (
          <div className="px-6 py-2 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400 flex-shrink-0">
            <InfoIcon className="w-3.5 h-3.5 flex-shrink-0" />
            Le modifiche saranno registrate e rese effettive dalla prossima visita.
          </div>
        )}
      </div>

      {/* ── Suspend mini-modal (plain div, no Portal) ───────────────────── */}
      {suspendModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setSuspendModal({ open: false, therapy: null })}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-[61] bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base">Sospendi farmaco</h3>
              <button type="button" onClick={() => setSuspendModal({ open: false, therapy: null })} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            {suspendModal.therapy && (
              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
                  <div className="text-sm font-semibold text-gray-800">{suspendModal.therapy.drug_name}</div>
                  {suspendModal.therapy.dose && <div className="text-xs text-gray-500 mt-0.5">{suspendModal.therapy.dose} {suspendModal.therapy.route || ""}</div>}
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Data sospensione</Label>
                  <ItalianDatePicker value={suspendForm.date} onChange={v => setSuspendForm(f => ({ ...f, date: v }))} testid="suspend-date" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Motivo *</Label>
                  <select className="w-full h-9 px-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" value={suspendForm.reason} onChange={e => setSuspendForm(f => ({ ...f, reason: e.target.value }))}>
                    <option value="">Seleziona motivo</option>
                    {SUSPEND_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Note (opzionali)</Label>
                  <Textarea rows={2} placeholder="Dettagli aggiuntivi..." className="text-sm resize-none" value={suspendForm.notes} onChange={e => setSuspendForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setSuspendModal({ open: false, therapy: null })}>Annulla</Button>
              <Button className="bg-red-600 text-white hover:bg-red-700" onClick={confirmSuspend}>Sospendi</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modify dose mini-modal (plain div, no Portal) ────────────────── */}
      {modifyModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setModifyModal({ open: false, therapy: null })}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-[61] bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base">Modifica posologia</h3>
              <button type="button" onClick={() => setModifyModal({ open: false, therapy: null })} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            {modifyModal.therapy && (
              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
                  <div className="text-sm font-semibold text-gray-800">{modifyModal.therapy.drug_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Posologia attuale: {[modifyModal.therapy.dose, modifyModal.therapy.frequency, modifyModal.therapy.route].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs text-gray-500 mb-1 block">Nuova dose</Label><Input value={modifyForm.dose} onChange={e => setModifyForm(f => ({ ...f, dose: e.target.value }))} className="h-9 text-sm" /></div>
                  <div><Label className="text-xs text-gray-500 mb-1 block">Frequenza</Label><Input value={modifyForm.frequency} onChange={e => setModifyForm(f => ({ ...f, frequency: e.target.value }))} className="h-9 text-sm" /></div>
                  <div><Label className="text-xs text-gray-500 mb-1 block">Via</Label><Input value={modifyForm.route} onChange={e => setModifyForm(f => ({ ...f, route: e.target.value }))} className="h-9 text-sm" /></div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Note (opzionali)</Label>
                  <Textarea rows={2} placeholder="Motivo della modifica..." className="text-sm resize-none" value={modifyForm.notes} onChange={e => setModifyForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setModifyModal({ open: false, therapy: null })}>Annulla</Button>
              <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" onClick={confirmModify}>Salva modifica</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview text modal (plain div, no Portal) ────────────────────── */}
      {previewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setPreviewOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-[61] bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base">Anteprima §10 – Terapia</h3>
              <button type="button" onClick={() => setPreviewOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[80px]">
              {previewText || <span className="text-gray-400 italic">Nessuna modifica terapeutica da riportare.</span>}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Chiudi</Button>
              <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" onClick={() => { if (previewText) { onAppendToPlan?.(previewText); toast.success("Testo aggiunto a §10 – Terapia"); } setPreviewOpen(false); }}>
                <Sparkles className="w-4 h-4 mr-1.5" /> Inserisci nel referto
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Biologic calendar ──────────────────────────────────────────── */}
      <BiologicCalendarModal open={bioCal.open} onClose={() => setBioCal(b => ({ ...b, open: false }))} initialDrug={bioCal.drug} initialDate={bioCal.date} patientId={patient?.id} onAppendToPlan={onAppendToPlan} />

      {/* ── Steroid tapering ────────────────────────────────────────────── */}
      <SteroidTaperingModal open={tapering.open} onClose={() => setTapering(b => ({ ...b, open: false }))} initialDrug={detectSteroide(tapering.drug)} initialDate={tapering.date} patientId={patient?.id} onAppendToPlan={onAppendToPlan} />
    </>
  );
}

// ── Small shared components ────────────────────────────────────────────────────
function NotePanel({ visitNotes, setVisitNotes }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">Note generali <span className="text-gray-400 font-normal">(opzionali)</span></h4>
      <Textarea rows={4} placeholder="Aggiungi note sulle decisioni terapeutiche di questa visita..." className="text-xs resize-none border-gray-200" value={visitNotes} onChange={e => setVisitNotes(e.target.value)} />
    </div>
  );
}

function ActiveTherapyRow({ t, onModify, onSuspend, addedToday }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${addedToday ? "bg-green-500" : "bg-green-600"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base text-gray-900">{t.drug_name}</span>
            {t.dose && <span className="text-sm text-gray-600">{t.dose}</span>}
            {t.frequency && <span className="text-sm text-gray-600">{t.frequency}</span>}
            {t.route && <span className="text-xs px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-500">{t.route}</span>}
            {addedToday && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium border border-green-200">Iniziato oggi</span>}
          </div>
          {t.start_date && <div className="text-xs text-gray-400 mt-0.5">Inizio: {new Date(t.start_date).toLocaleDateString("it-IT")}</div>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button type="button" onClick={() => onModify(t)} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition border border-transparent hover:border-blue-200">
            <Edit className="w-3.5 h-3.5" /> Modifica
          </button>
          <button type="button" onClick={() => onSuspend(t)} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition border border-transparent hover:border-red-200">
            <CircleMinus className="w-3.5 h-3.5" /> Sospendi
          </button>
          <button type="button" onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-5 pb-3 pt-1 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50/50">
          {t.category && <div><span className="text-gray-400">Categoria:</span> {THERAPY_CATEGORIES[t.category] || t.category}</div>}
          {t.indication && <div><span className="text-gray-400">Indicazione:</span> {INDICATIONS[t.indication] || t.indication}</div>}
          {t.notes && <div className="col-span-2"><span className="text-gray-400">Note:</span> {t.notes}</div>}
        </div>
      )}
    </div>
  );
}

function StoppedTodayRow({ t }) {
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50/30">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-orange-400" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base text-gray-600 line-through">{t.drug_name}</span>
            {t.dose && <span className="text-sm text-gray-400 line-through">{t.dose}</span>}
            {t.route && <span className="text-xs px-1.5 py-0.5 rounded border border-orange-200 bg-orange-50 text-orange-600">{t.route}</span>}
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium border border-orange-200">Sospeso oggi</span>
          </div>
          {t.start_date && <div className="text-xs text-gray-400 mt-0.5">Inizio: {new Date(t.start_date).toLocaleDateString("it-IT")}</div>}
          {t.discontinuation_reason && <div className="text-xs text-orange-700 mt-0.5">Motivo: {t.discontinuation_reason}</div>}
        </div>
      </div>
    </div>
  );
}

// ── SafetyPanel ───────────────────────────────────────────────────────────────
function SafetyPanel({ reminders = [], interactions = [], patientId, onAcceptReminder }) {
  const [open, setOpen] = useState(false);
  const [expandedRem, setExpandedRem] = useState(new Set());
  const [expandedInt, setExpandedInt] = useState(new Set());
  const [snoozed,  setSnoozed]  = useState(new Set());
  const [checked,  setChecked]  = useState(new Set());
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`rhf_dismissed_${patientId}`) || "[]")); } catch { return new Set(); }
  });

  useEffect(() => {
    try { setDismissed(new Set(JSON.parse(localStorage.getItem(`rhf_dismissed_${patientId}`) || "[]"))); } catch { setDismissed(new Set()); }
    setSnoozed(new Set());
  }, [patientId]);

  const persistDismiss = (id) => {
    const key = `rhf_dismissed_${patientId}`;
    setDismissed(prev => { const n = new Set(prev); n.add(id); try { localStorage.setItem(key, JSON.stringify([...n])); } catch {} return n; });
  };

  const handleAccept  = (r) => { persistDismiss(r.id); onAcceptReminder?.(`• ${r.label} — verificato/prescritto`); toast.success(`"${r.label}" accettato`); };
  const handleDismiss = (r) => { persistDismiss(r.id); toast.info(`"${r.label}" rimosso`); };
  const handleSnooze  = (r) => { setSnoozed(p => { const n = new Set(p); n.add(r.id); return n; }); toast.info(`Rimandato`); };
  const handleInsert  = (r) => { if (!r.insertionText) return; onAcceptReminder?.(r.insertionText); toast.success("Testo inserito"); };
  const handleCheck   = (r) => { setChecked(p => { const n = new Set(p); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; }); };
  const handleExportChecked = () => {
    const items = [...checked].map(id => visReminders.find(r => r.id === id)).filter(Boolean);
    if (!items.length) return;
    onAcceptReminder?.(items.map(r => `• ${r.label}`).join("\n"));
    items.forEach(r => persistDismiss(r.id));
    setChecked(new Set()); toast.success(`${items.length} reminder esportati`);
  };

  const visReminders     = reminders.filter(r => !dismissed.has(r.id) && !snoozed.has(r.id));
  const highReminders    = visReminders.filter(r => r.priority === "high");
  const routineReminders = visReminders.filter(r => r.priority === "routine");
  const lowReminders     = visReminders.filter(r => r.priority === "low");
  const majorInter       = interactions.filter(i => i.severity === "major");
  const hasHighAlert     = highReminders.length > 0 || majorInter.length > 0;
  const toggleRem = (id) => setExpandedRem(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleInt = (id) => setExpandedInt(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (visReminders.length === 0 && interactions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-3 flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <p className="text-[11px] font-medium text-gray-400">Nessuna interazione farmacologica rilevata</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border overflow-hidden shadow-sm ${hasHighAlert ? "border-orange-300 bg-orange-50/50" : "border-amber-200 bg-amber-50/40"}`}>
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/40 transition">
        <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${hasHighAlert ? "text-orange-600" : "text-amber-600"}`} />
        <span className={`text-sm font-semibold ${hasHighAlert ? "text-orange-800" : "text-amber-800"}`}>Safety reminders</span>
        <div className="flex items-center gap-1.5 ml-1">
          {highReminders.length > 0 && <span className="text-[10px] font-bold bg-orange-500 text-white px-2 py-0.5 rounded-full">{highReminders.length} urgente{highReminders.length > 1 ? "i" : ""}</span>}
          {majorInter.length > 0 && <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">{majorInter.length} int. maggiore{majorInter.length > 1 ? "i" : ""}</span>}
          {routineReminders.length > 0 && <span className="text-[10px] font-semibold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">{routineReminders.length} da verificare</span>}
        </div>
        <span className="ml-auto flex-shrink-0">{open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}</span>
      </button>
      {open && (
        <div className="border-t border-amber-100 px-4 pb-4 pt-3 space-y-4">
          {highReminders.length > 0 && <ReminderGroup title="Priorità alta" items={highReminders} expanded={expandedRem} onToggle={toggleRem} accent="orange" checked={checked} onCheck={handleCheck} onDismiss={handleDismiss} onSnooze={handleSnooze} onInsert={handleInsert} />}
          {majorInter.length > 0 && <InteractionGroup title="Interazioni maggiori" items={majorInter} expanded={expandedInt} onToggle={toggleInt} />}
          {routineReminders.length > 0 && [...new Set(routineReminders.map(r => r.category))].map(cat => (
            <ReminderGroup key={cat} title={cat} accent="amber" expanded={expandedRem} onToggle={toggleRem} items={routineReminders.filter(r => r.category === cat)} checked={checked} onCheck={handleCheck} onDismiss={handleDismiss} onSnooze={handleSnooze} onInsert={handleInsert} />
          ))}
          {lowReminders.length > 0 && (
            <div className="border-t border-gray-100 pt-2 space-y-1">
              {lowReminders.map(r => <div key={r.id} className="flex items-start gap-2 text-[10.5px] text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0 mt-[4px]" /><span>{r.label}</span></div>)}
            </div>
          )}
          {interactions.filter(i => i.severity !== "major").length > 0 && <InteractionGroup title="Altre interazioni farmacologiche" items={interactions.filter(i => i.severity !== "major")} expanded={expandedInt} onToggle={toggleInt} />}
          <div className="flex items-center justify-between pt-1 border-t border-amber-100">
            <p className="text-[10px] text-gray-400 italic">I suggerimenti sono informativi e non sostituiscono il giudizio clinico.</p>
            {checked.size > 0 && (
              <button type="button" onClick={handleExportChecked} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0A2540] hover:bg-[#051626] px-3 py-1.5 rounded-lg flex-shrink-0 ml-3">
                <Check className="w-3 h-3" /> Esporta {checked.size} verificat{checked.size === 1 ? "o" : "i"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReminderActions({ r, checked, onCheck, onDismiss, onSnooze }) {
  const isChecked = checked?.has(r.id);
  return (
    <div style={{ display: "flex", gap: "3px", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <button type="button" onClick={() => onCheck(r)} style={{ width: "22px", height: "22px", borderRadius: "5px", background: isChecked ? "#dcfce7" : "#f9fafb", border: isChecked ? "1.5px solid #86efac" : "1.5px solid #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        {isChecked && <Check size={11} color="#15803d" strokeWidth={2.5} />}
      </button>
      <button type="button" onClick={() => onDismiss(r)} style={{ width: "22px", height: "22px", borderRadius: "5px", background: "#fee2e2", border: "1px solid #fca5a5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        <X size={11} color="#dc2626" strokeWidth={2.5} />
      </button>
      <button type="button" onClick={() => onSnooze(r)} style={{ width: "22px", height: "22px", borderRadius: "5px", background: "#eff6ff", border: "1px solid #93c5fd", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        <Clock size={11} color="#2563eb" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function ReminderGroup({ title, items, expanded, onToggle, accent = "amber", checked, onCheck, onDismiss, onSnooze, onInsert }) {
  const accentTitle  = accent === "orange" ? "text-orange-700" : "text-amber-700";
  const accentBorder = accent === "orange" ? "border-orange-200" : "border-amber-200";
  const accentBg     = accent === "orange" ? "bg-orange-50"     : "bg-amber-50/60";
  const dotColor     = accent === "orange" ? "bg-orange-400"    : "bg-amber-400";
  if (!items?.length) return null;
  return (
    <div>
      {title && <div className={`text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5 ${accentTitle}`}>{title}</div>}
      <div className="space-y-1">
        {items.map(r => {
          const isOpen = expanded.has(r.id);
          const isChecked = checked?.has(r.id);
          return (
            <div key={r.id} className={`rounded-lg border overflow-hidden ${accentBorder} ${isChecked ? "bg-green-50/40" : ""}`}>
              <div className="flex items-center gap-2 px-3 py-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                <button type="button" onClick={() => onToggle(r.id)} className="flex-1 text-left flex items-center gap-1.5 min-w-0">
                  <span className={`text-xs font-semibold truncate ${isChecked ? "line-through text-gray-400" : "text-gray-800"}`}>{r.label}</span>
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                </button>
                <ReminderActions r={r} checked={checked} onCheck={onCheck} onDismiss={onDismiss} onSnooze={onSnooze} />
              </div>
              {isOpen && (
                <div className={`px-3 pb-2.5 pt-1 text-[11px] text-gray-600 leading-relaxed border-t ${accentBorder} ${accentBg} whitespace-pre-line`}>
                  {r.detail}
                  {r.insertionText && onInsert && (
                    <div className="mt-2 pt-1.5 border-t border-gray-200/70">
                      <button type="button" onClick={e => { e.stopPropagation(); onInsert(r); }} className="text-[10px] font-semibold text-[#0A2540] underline underline-offset-2 hover:text-blue-700">
                        ↳ Inserisci in indicazioni
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InteractionGroup({ title, items, expanded, onToggle }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5 text-gray-500">{title}</div>
      <div className="space-y-1">
        {items.map(i => {
          const sev = SEVERITY[i.severity];
          const isOpen = expanded.has(i.id);
          return (
            <div key={i.id} className="rounded-lg border overflow-hidden" style={{ borderColor: sev.border }}>
              <button type="button" onClick={() => onToggle(i.id)} className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-white/60 transition" style={{ background: sev.bg }}>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ background: sev.color, color: "white" }}>{sev.label}</span>
                <span className="flex-1 text-xs font-semibold text-gray-800">{i.title}</span>
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />}
              </button>
              {isOpen && <div className="px-3 pb-2.5 pt-1 text-[11px] text-gray-600 leading-relaxed border-t bg-white">{i.note}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Therapy Episode Timeline (Tab 4) ──────────────────────────────────────────

const EVENT_CFG = {
  started:              { label: "Avviata",                    dot: "#22c55e", Icon: Play },
  continued:            { label: "Confermata in visita",       dot: "#60a5fa", Icon: RefreshCw },
  dose_increased:       { label: "Dose aumentata",             dot: "#f97316", Icon: TrendingUp },
  dose_reduced:         { label: "Dose ridotta",               dot: "#eab308", Icon: TrendingDown },
  discontinued:         { label: "Sospesa",                    dot: "#ef4444", Icon: Ban },
  paused:               { label: "In pausa",                   dot: "#f59e0b", Icon: PauseCircle },
  resumed_within:       { label: "Ripresa (stesso ep.)",       dot: "#10b981", Icon: RotateCcw },
  noted:                { label: "Presente alla prima visita", dot: "#94a3b8", Icon: ClipboardList },
  historical_exposure:  { label: "Esposizione pregressa",      dot: "#c084fc", Icon: History },
};

const EP_STATUS = {
  active:       { label: "Attivo",   cls: "bg-green-100 text-green-700 border-green-200" },
  discontinued: { label: "Sospeso",  cls: "bg-red-100 text-red-700 border-red-200" },
  paused:       { label: "In pausa", cls: "bg-amber-100 text-amber-700 border-amber-200" },
};

function fmtDate(d) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString("it-IT"); } catch { return d; }
}

// Classifica una terapia come "reumatologica" (da mostrare nella sezione principale)
// vs "altra" (da collassare in fondo).
// Gerarchia: 1. campo `relevance` se presente; 2. `therapy_type`; 3. `category` legacy.
const RHEUM_CATEGORIES = new Set(["csDMARD", "bDMARD", "tsDMARD", "glucocorticoid", "nsaid"]);
const RHEUM_TYPES      = new Set(["rheum_dmard", "glucocorticoid", "nsaid"]);

function isRheumRelevant(t) {
  if (t.relevance === "high" || t.relevance === "medium") return true;
  if (t.relevance === "low") return false;
  if (t.therapy_type) return RHEUM_TYPES.has(t.therapy_type);
  return RHEUM_CATEGORIES.has(t.category);
}

function buildGroups(therapies) {
  const map = {};
  for (const t of therapies) {
    const key = (t.drug_canonical || t.drug_name?.toLowerCase().trim() || "?");
    if (!map[key]) map[key] = { key, displayName: t.drug_name, episodes: [], rheum: isRheumRelevant(t) };
    map[key].episodes.push(t);
    // If any episode is rheumatologic, the whole group is rheumatologic
    if (isRheumRelevant(t)) map[key].rheum = true;
  }
  for (const g of Object.values(map)) {
    g.episodes.sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;
      return (b.start_date || "").localeCompare(a.start_date || "");
    });
    g.displayName = g.episodes[0].drug_name;
    g.hasActive   = g.episodes.some(e => e.status === "active");
    g.totalEvents = g.episodes.reduce((n, e) => n + (e.events?.length || 0), 0);
  }
  const sorted = Object.values(map).sort((a, b) => {
    if (a.hasActive && !b.hasActive) return -1;
    if (!a.hasActive && b.hasActive) return 1;
    return a.displayName.localeCompare(b.displayName);
  });
  return {
    rheum: sorted.filter(g => g.rheum),
    other: sorted.filter(g => !g.rheum),
  };
}

function applySearch(groups, search) {
  if (!search.trim()) return groups;
  const q = search.toLowerCase();
  return groups.filter(g =>
    g.displayName.toLowerCase().includes(q) ||
    g.episodes.some(e => e.indication?.toLowerCase().includes(q) || e.drug_name?.toLowerCase().includes(q))
  );
}

function TherapyEpisodeTimeline({ therapies, search, setSearch }) {
  const { rheum: rheumGroups, other: otherGroups } = useMemo(
    () => buildGroups(therapies),
    [therapies]
  );

  const filteredRheum = useMemo(() => applySearch(rheumGroups, search), [rheumGroups, search]);
  const filteredOther = useMemo(() => applySearch(otherGroups, search), [otherGroups, search]);

  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [otherOpen, setOtherOpen] = useState(false);

  useEffect(() => {
    const allGroups = [...rheumGroups, ...otherGroups];
    setExpandedGroups(new Set(allGroups.filter(g => g.hasActive && g.rheum).map(g => g.key)));
  }, [rheumGroups.length, otherGroups.length]); // eslint-disable-line

  const toggleGroup = (key) => setExpandedGroups(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  if (therapies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <History className="w-10 h-10 mb-3 opacity-20" />
        <p className="text-sm">Nessuna terapia registrata per questo paziente.</p>
      </div>
    );
  }

  const rheumActive = rheumGroups.filter(g => g.hasActive).length;
  const rheumEps    = rheumGroups.reduce((n, g) => n + g.episodes.length, 0);
  const noResults   = filteredRheum.length === 0 && filteredOther.length === 0;

  return (
    <div className="space-y-3 max-w-3xl">
      {/* Summary bar */}
      <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
        <History className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex items-center gap-5 flex-1 min-w-0 flex-wrap text-xs text-gray-600">
          <span><span className="font-bold text-gray-900">{rheumGroups.length}</span> farmaci reum.</span>
          <span><span className="font-bold text-green-600">{rheumActive}</span> attivi</span>
          <span><span className="font-bold text-gray-700">{rheumEps}</span> episodi</span>
          {otherGroups.length > 0 && (
            <span className="text-gray-400">+ {otherGroups.length} altra/e terapia/e</span>
          )}
        </div>
        <div className="relative flex-shrink-0 w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca farmaco o indicazione..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
          />
        </div>
      </div>

      {noResults && (
        <p className="text-center text-sm text-gray-400 py-12">Nessun risultato per &ldquo;{search}&rdquo;</p>
      )}

      {/* ── Sezione reumatologica ── */}
      {filteredRheum.length === 0 && !search.trim() ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400 text-sm">
          Nessuna terapia reumatologica registrata.
        </div>
      ) : (
        filteredRheum.map(group => (
          <DrugGroupCard
            key={group.key}
            group={group}
            expanded={expandedGroups.has(group.key)}
            onToggle={() => toggleGroup(group.key)}
          />
        ))
      )}

      {/* ── Sezione "Altre terapie" (low relevance) ── */}
      {filteredOther.length > 0 && (
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <button
            type="button"
            onClick={() => setOtherOpen(o => !o)}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left bg-gray-50/80 hover:bg-gray-100/60 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-gray-500">
              Altre terapie del paziente
            </span>
            <span className="text-[10px] text-gray-400 ml-1">
              ({filteredOther.length} farmaco{filteredOther.length !== 1 ? "i" : ""} — cardiovascolare, metabolica, ecc.)
            </span>
            <span className="ml-auto text-gray-400 flex-shrink-0">
              {otherOpen
                ? <ChevronUp className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5" />
              }
            </span>
          </button>
          {otherOpen && (
            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {filteredOther.map(group => (
                <DrugGroupCard
                  key={group.key}
                  group={group}
                  expanded={expandedGroups.has(group.key)}
                  onToggle={() => toggleGroup(group.key)}
                  muted
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DrugGroupCard({ group, expanded, onToggle, muted = false }) {
  return (
    <div className={`rounded-xl border overflow-hidden transition-shadow ${
      muted ? "border-gray-100" : group.hasActive ? "border-gray-200 shadow-sm" : "border-gray-100"
    }`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${muted ? "bg-gray-50/60 hover:bg-gray-100/60" : "bg-white hover:bg-gray-50"}`}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${muted ? "bg-gray-300" : group.hasActive ? "bg-green-500" : "bg-gray-300"}`} />
        <span className={`font-semibold text-sm ${muted ? "text-gray-400" : group.hasActive ? "text-gray-900" : "text-gray-500"}`}>
          {group.displayName}
        </span>
        <div className="flex items-center gap-1.5 ml-1">
          {group.hasActive && (
            <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
              attivo
            </span>
          )}
          <span className="text-[10px] text-gray-400">
            {group.episodes.length} episodio{group.episodes.length !== 1 ? "i" : ""}
            {group.totalEvents > 0 && ` · ${group.totalEvents} eventi`}
          </span>
        </div>
        <span className="ml-auto text-gray-400 flex-shrink-0">
          {expanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          }
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {group.episodes.map((ep, idx) => (
            <EpisodeCard
              key={ep.id}
              ep={ep}
              episodeLabel={
                group.episodes.length === 1
                  ? null
                  : `Episodio ${group.episodes.length - idx}`
              }
              defaultOpen={ep.status === "active"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EpisodeCard({ ep, episodeLabel, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  const events = useMemo(
    () => [...(ep.events || [])].sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [ep.events]
  );

  const sc = EP_STATUS[ep.status] || { label: ep.status, cls: "bg-gray-100 text-gray-600 border-gray-200" };

  return (
    <div className={`px-4 py-3 ${ep.status !== "active" ? "bg-gray-50/40" : "bg-white"}`}>
      {/* Episode summary row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Status + label */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.cls}`}>
              {sc.label}
            </span>
            {episodeLabel && (
              <span className="text-[10px] text-gray-400">{episodeLabel}</span>
            )}
          </div>

          {/* Core fields */}
          <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-xs">
            <span className="text-gray-500">
              <span className="text-gray-400">Inizio: </span>
              {fmtDate(ep.start_date) || "—"}
            </span>
            {ep.end_date && (
              <span className="text-gray-500">
                <span className="text-gray-400">Fine: </span>
                {fmtDate(ep.end_date)}
              </span>
            )}
            {ep.dose && (
              <span className="text-gray-700 font-medium">
                <span className="text-gray-400 font-normal">Dose: </span>
                {ep.dose}
                {ep.frequency && <span className="text-gray-400 font-normal ml-1">{ep.frequency}</span>}
                {ep.route && <span className="text-gray-400 font-normal ml-1">({ep.route})</span>}
              </span>
            )}
            {ep.indication && (
              <span className="text-gray-500">
                <span className="text-gray-400">Indicazione: </span>
                {INDICATIONS?.[ep.indication] || ep.indication}
              </span>
            )}
          </div>

          {/* Discontinuation reason */}
          {ep.discontinuation_reason && (
            <div className="mt-1 text-[11px] text-red-600">
              <span className="text-red-400">Motivo sospensione: </span>
              {ep.discontinuation_reason}
            </div>
          )}
        </div>

        {/* Toggle events */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5 transition-colors"
        >
          {events.length > 0
            ? <>{events.length} event{events.length !== 1 ? "i" : "o"}</>
            : <span className="italic">nessun evento</span>
          }
          {open
            ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
            : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
          }
        </button>
      </div>

      {/* Events vertical timeline */}
      {open && (
        <div className="mt-3 ml-2 border-l-2 border-gray-200 pl-4 space-y-1.5">
          {events.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic py-1">Nessun evento registrato.</p>
          ) : events.map((ev, idx) => {
            const cfg = EVENT_CFG[ev.type] || { label: ev.type || "—", dot: "#94a3b8", Icon: null };
            const Ico = cfg.Icon;
            return (
              <div key={idx} className="relative flex items-start gap-2.5 group">
                {/* Timeline dot — positioned on the left border */}
                <span
                  className="absolute -left-[21px] top-[5px] w-3 h-3 rounded-full border-2 border-white flex-shrink-0"
                  style={{ backgroundColor: cfg.dot }}
                />

                <div className="flex-1 min-w-0 rounded-lg border border-gray-100 bg-white px-3 py-2 group-hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-2 flex-wrap">
                    {Ico && (
                      <Ico className="w-3 h-3 flex-shrink-0" style={{ color: cfg.dot }} />
                    )}
                    <span className="text-[11px] font-semibold text-gray-800">{cfg.label}</span>
                    {ev.date && (
                      <span className="text-[11px] text-gray-400">{fmtDate(ev.date)}</span>
                    )}

                    {/* Dose change: before → after */}
                    {ev.dose_before && ev.dose_after ? (
                      <span className="flex items-center gap-1 text-[11px]">
                        <span className="text-gray-400 line-through">{ev.dose_before}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="font-semibold text-gray-700">{ev.dose_after}</span>
                      </span>
                    ) : ev.dose ? (
                      <span className="text-[11px] font-medium text-gray-600">{ev.dose}</span>
                    ) : null}
                  </div>

                  {/* Reason / notes */}
                  {ev.reason && (
                    <div className="mt-0.5 text-[10.5px] text-gray-500">
                      <span className="text-gray-400">Motivo: </span>{ev.reason}
                    </div>
                  )}
                  {ev.notes && (
                    <div className="mt-0.5 text-[10.5px] text-gray-400 italic">{ev.notes}</div>
                  )}
                  {ev.visit_id && (
                    <div className="mt-0.5 text-[10px] text-gray-300">
                      Visita {ev.visit_id.slice(0, 8)}…
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
