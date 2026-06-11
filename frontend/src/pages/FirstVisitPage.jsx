import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { patientsApi, diseaseProfileApi, therapiesApi, conditionsApi } from "../lib/api";
import { buildConditionFromLabel, COMORBIDITY_CATEGORIES, FREQUENT_CONDITIONS, CONDITION_SYNONYMS } from "../lib/conditions";
import { isScleroDiagnosis, isSpaDiagnosis } from "../lib/diseaseDetection";
import DiagnosisProfileOverlay from "../components/profiles/DiagnosisProfileOverlay";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  ArrowLeft, ArrowRight, Save, Check,
  ClipboardList, FlaskConical, Lightbulb, FileText, Printer, FolderOpen,
  Search, ChevronDown, ChevronUp, X, Plus, Pill, Camera, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import TemplatePickerDialog from "../components/visits/TemplatePickerDialog";
import PhysicalExamSection from "../components/clinical/PhysicalExamSection";
import SelectableTextArea from "../components/shared/SelectableTextArea";
import LabImportFromImageDialog from "../components/labs/LabImportFromImageDialog";
import { parseConcomitantDrugs } from "../lib/concomitantDrugParser";
import { parseHistoricalTherapies } from "../lib/historicalTherapyParser";
import ConcomitantTherapyReview from "../components/therapy/ConcomitantTherapyReview";
import {
  REFERRAL_REASONS, FRAILTY_ITEMS, CHECKLISTS,
  RHEUM_TEMPLATES, BONE_TEMPLATE, EXAM_TEMPLATES,
  FOLLOW_UP_PRIORITY, HYPOTHESIS_TO_DISEASE, DEFINITIVE_DIAGNOSES,
  NEXT_STEP_OPTIONS, CERTAINTY_OPTIONS, REFERRAL_APPROPRIATENESS, EMPTY_DATA,
} from "../lib/firstVisitData";
import {
  generateCleanClinicalReport, openReport,
  REPORT_SECTION_KEYS, REPORT_SECTIONS,
} from "../lib/firstVisitReport";

// ─── Referral reason icons (UI-only, not in shared data) ──────────────────────

const REFERRAL_REASON_ICONS = {
  artralgie:     "🦴",
  fibromialgia:  "🌐",
  osteoporosi:   "🦷",
  autoanticorpi: "🔬",
  connettivite:  "💧",
  pmr_lvv:       "🔴",
  spa:           "🔗",
  altro:         "📋",
};

const matchesComorbiditySearch = (item, query) => {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  if (item.toLowerCase().includes(q)) return true;
  return (CONDITION_SYNONYMS[item] || []).some((s) => s.includes(q));
};

// ─── UI helpers ────────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{children}</p>;
}

function ToggleBtn({ label, selected, onToggle, variant = "default" }) {
  const base = "inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer";
  const styles = {
    default: selected ? "bg-[#0A2540] border-[#0A2540] text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400",
    lab:     selected ? "bg-teal-700 border-teal-700 text-white"   : "bg-white border-gray-200 text-gray-600 hover:border-teal-400",
    imaging: selected ? "bg-indigo-700 border-indigo-700 text-white": "bg-white border-gray-200 text-gray-600 hover:border-indigo-400",
  };
  return (
    <button type="button" onClick={onToggle} className={`${base} ${styles[variant] || styles.default}`}>
      {selected && <Check className="w-3 h-3 flex-shrink-0" />}
      {label}
    </button>
  );
}

function CheckRow({ label, checked, onToggle, isRed = false }) {
  return (
    <label className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer border transition-colors ${
      checked
        ? isRed ? "bg-red-50 border-red-200" : "bg-[#0A2540]/5 border-[#0A2540]/20"
        : isRed ? "bg-white border-gray-100 hover:border-red-200" : "bg-white border-gray-100 hover:border-gray-200"
    }`}>
      <div onClick={onToggle} className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
        checked
          ? isRed ? "bg-red-600 border-red-600" : "bg-[#0A2540] border-[#0A2540]"
          : "border-gray-300 bg-white"
      }`}>
        {checked && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      <span onClick={onToggle} className={`text-xs flex-1 ${isRed && checked ? "text-red-700 font-medium" : "text-gray-700"}`}>{label}</span>
    </label>
  );
}

function StepDot({ step, current, label, onJump }) {
  const done = step < current;
  const active = step === current;
  const clickable = done && onJump;
  return (
    <div
      className={`flex flex-col items-center gap-1 ${clickable ? "cursor-pointer group" : ""}`}
      onClick={clickable ? onJump : undefined}
      title={clickable ? `Torna a: ${label}` : undefined}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
        done ? "bg-[#0A2540] border-[#0A2540] text-white group-hover:bg-[#1e3a5f] group-hover:border-[#1e3a5f]" :
        active ? "border-[#0A2540] text-[#0A2540] bg-white" :
        "border-gray-200 text-gray-300 bg-white"
      }`}>
        {done ? <Check className="w-3.5 h-3.5" /> : step}
      </div>
      <span className={`text-[9px] font-medium text-center leading-tight hidden sm:block ${active ? "text-[#0A2540]" : done ? "text-gray-500 group-hover:text-[#0A2540]" : "text-gray-300"}`}>{label}</span>
    </div>
  );
}

function NavButtons({ onBack, onNext, onNextLabel = "Avanti", saving = false }) {
  return (
    <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-4">
      {onBack
        ? <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Indietro</Button>
        : <div />}
      {onNext && (
        <Button onClick={onNext} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]">
          {onNextLabel} <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      )}
    </div>
  );
}

const STEPS = ["Motivo invio","Anamnesi extra-reuma","Anamnesi reuma","Esami in visione","Esame obiettivo","Conclusione"];

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function FirstVisitPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [step, setStep] = useState(1);
  const [data, setData] = useState(EMPTY_DATA);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileDiseaseKey, setProfileDiseaseKey] = useState(null);
  const [labImportOpen, setLabImportOpen] = useState(false);
  const [tplDialog, setTplDialog] = useState({ open: false, category: null, onLoad: null });
  const [therapyDlg, setTherapyDlg] = useState({ open: false, drug_name: "", dose: "", route: "orale", category: "csDMARD", start_date: "", saving: false });
  const [concomitantItems, setConcomitantItems] = useState(null);
  const [historicalItems, setHistoricalItems] = useState(null);
  const [concomitantConfirmed, setConcomitantConfirmed] = useState(false);
  const [historicalConfirmed, setHistoricalConfirmed] = useState(false);
  const autoTemplateUsed = useRef(new Set());
  const [pendingTherapiesModal, setPendingTherapiesModal] = useState(false);
  const openTherapyDlg = () => {
    const firstLine = (data.therapy_modification || "").split("\n").find(l => l.trim()) || "";
    setTherapyDlg({ open: true, drug_name: firstLine.trim(), dose: "", route: "orale", category: "csDMARD", start_date: new Date().toISOString().slice(0, 10), saving: false });
  };
  const saveTherapy = async () => {
    if (!therapyDlg.drug_name.trim()) { toast.error("Inserisci il nome del farmaco"); return; }
    setTherapyDlg(d => ({ ...d, saving: true }));
    try {
      await therapiesApi.create({
        patient_id: patient?.id,
        drug_name: therapyDlg.drug_name.trim(),
        dose: therapyDlg.dose.trim(),
        route: therapyDlg.route,
        category: therapyDlg.category,
        start_date: therapyDlg.start_date,
        status: "active",
        indication: data.diagnostic_conclusion?.trim() || data.confirmed_diagnosis?.trim() || "",
        notes: "",
      });
      toast.success("Terapia aggiunta a «Terapia in corso»");
      setTherapyDlg(d => ({ ...d, open: false, saving: false }));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore nel salvataggio");
      setTherapyDlg(d => ({ ...d, saving: false }));
    }
  };
  const runConcomitantParse = (text) => {
    if (!text?.trim()) return;
    const items = parseConcomitantDrugs(text);
    setConcomitantItems(items.length > 0 ? items : []);
    setConcomitantConfirmed(false);
  };

  const runHistoricalParse = (text) => {
    if (!text?.trim()) return;
    const items = parseHistoricalTherapies(text);
    setHistoricalItems(items.length > 0 ? items : []);
    setHistoricalConfirmed(false);
  };

  const savePendingTherapies = async () => {
    const groups = [];
    if (concomitantItems?.length) groups.push({ items: concomitantItems, mode: "noted" });
    if (historicalItems?.length)  groups.push({ items: historicalItems,  mode: "historical" });
    for (const { items, mode } of groups) {
      const toSave = items.filter(it => !it._skip && !it._duplicate);
      for (const item of toSave) {
        try {
          await therapiesApi.upsert({
            patient_id: patient?.id,
            drug_name: item.drug_name || item.canonical,
            drug_canonical: item.drug_canonical || null,
            category: item.category || "other",
            therapy_type: item.therapy_type || null,
            relevance: item.relevance || "low",
            dose: item.dose || null,
            route: item.route || null,
            indication: item.indication || null,
            status: item.status || (mode === "historical" ? "discontinued" : "active"),
            event_type_override: item.event_type_override,
            start_date: (mode === "noted" ? item._custom_start_date || null : item.start_date) || null,
            end_date: item.end_date || null,
            first_seen_date: item.first_seen_date,
            date_approximate: item.date_approximate || item._edit_approx || false,
            discontinuation_reason: item.discontinuation_reason || item._edit_reason || null,
            source: item.source || "anamnesi_prima_visita",
          });
        } catch { /* silently skip individual failures */ }
      }
    }
    const total = groups.reduce((s, g) => s + g.items.filter(it => !it._skip && !it._duplicate).length, 0);
    if (total > 0) toast.success(`${total} ${total === 1 ? "terapia salvata" : "terapie salvate"} nel profilo paziente`);
    setConcomitantItems(null);
    setHistoricalItems(null);
    setConcomitantConfirmed(true);
    setHistoricalConfirmed(true);
  };

  const [reportSections, setReportSections] = useState(() => new Set(REPORT_SECTION_KEYS));
  const toggleReportSection = (key) => setReportSections((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const load = useCallback(async () => {
    const p = await patientsApi.get(id);
    setPatient(p);
    const doc = await diseaseProfileApi.get(id, "prima_visita").catch(() => null);
    const fvData = doc?.data ? { ...EMPTY_DATA, ...doc.data } : { ...EMPTY_DATA };
    // Phase 2A: prefer flat patient fields; fall back to prima_visita if empty
    const merged = {
      ...fvData,
      physiologic_history:    p.anamnesi_fisiologica    || fvData.physiologic_history,
      family_history:         p.anamnesi_familiare       || fvData.family_history,
      comorbidity_free_notes: p.comorbidita_apr          || fvData.comorbidity_free_notes,
      current_therapies_text: p.terapia_domiciliare      || fvData.current_therapies_text,
      drug_allergies:         p.allergie_testo           || fvData.drug_allergies,
    };
    setData(merged);
    if (doc?.data) setSaved(true);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const patch = (updater) => setData((prev) => typeof updater === "function" ? updater(prev) : { ...prev, ...updater });

  const toggleArr = (field, val) => patch((p) => ({
    ...p, [field]: p[field].includes(val) ? p[field].filter((x) => x !== val) : [...p[field], val],
  }));

  const [comorbiditiesSearch, setComorbiditiesSearch] = useState("");
  const [openCategories, setOpenCategories] = useState({});

  const toggleComorbidity = (catKey, item) => patch((p) => {
    const cur = p.comorbidities[catKey] || [];
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    return { ...p, comorbidities: { ...p.comorbidities, [catKey]: next } };
  });

  const toggleCategoryOpen = (catKey) =>
    setOpenCategories((prev) => ({ ...prev, [catKey]: !isCatOpen(catKey, prev) }));

  const isCatOpen = (catKey, overrides = openCategories) => {
    if (overrides[catKey] !== undefined) return overrides[catKey];
    return (data.comorbidities[catKey] || []).length > 0;
  };

  const setComorbidityNote = (item, note) => patch((p) => ({
    ...p, comorbidity_item_notes: { ...p.comorbidity_item_notes, [item]: note },
  }));

  const toggleClinical = (key) => patch((p) => ({
    ...p, clinical_features: { ...p.clinical_features, [key]: !p.clinical_features[key] },
  }));

  const isConverting = data.clinical_decision === "converting";

  const toggleHypothesis = (label) => patch((p) => {
    const current = p.suggested_diagnosis ? p.suggested_diagnosis.split(", ").filter(Boolean) : [];
    const next = current.includes(label) ? current.filter(h => h !== label) : [...current, label];
    return { ...p, suggested_diagnosis: next.join(", ") };
  });

  const hasPendingConcomitant = concomitantItems !== null && !concomitantConfirmed &&
    concomitantItems.some(it => !it._skip && !it._duplicate);
  const hasPendingHistorical  = historicalItems  !== null && !historicalConfirmed  &&
    historicalItems.some(it => !it._skip && !it._duplicate);

  const save = async (quiet = false) => {
    if (!data.referral_reason) { toast.error("Seleziona il motivo di invio."); return false; }
    if (isConverting && !data.confirmed_diagnosis?.trim()) {
      toast.error("Seleziona la diagnosi definitiva per completare la conversione in follow-up");
      return false;
    }
    if (!quiet && (hasPendingConcomitant || hasPendingHistorical)) {
      setPendingTherapiesModal(true);
      return false;
    }
    setSaving(true);
    try {
      // Phase 2B: strip narrative fields from prima_visita — they live in patients
      const {
        physiologic_history, family_history, comorbidity_free_notes,
        current_therapies_text, drug_allergies,
        ...fvOnly
      } = data;
      await diseaseProfileApi.upsert(id, "prima_visita", fvOnly);
      const newState = (isConverting || data.diagnostic_certainty === "definita") ? "follow_up" : "workup_in_progress";
      const updates = {
        patient_state:        newState,
        anamnesi_fisiologica: physiologic_history    || null,
        anamnesi_familiare:   family_history          || null,
        comorbidita_apr:      comorbidity_free_notes  || null,
        terapia_domiciliare:  current_therapies_text  || null,
        allergie_testo:       drug_allergies          || null,
      };
      if (isConverting && data.confirmed_diagnosis?.trim()) {
        updates.diagnosi = data.confirmed_diagnosis.trim();
      }
      await patientsApi.update(id, updates).catch(() => {});

      // Phase 4c: write structured conditions to db.conditions in parallel.
      // Fire-and-forget — does not block or affect the main save.
      // disease_profiles.prima_visita.comorbidities is still written above
      // for referto compatibility (Phase 5 will migrate buildReferto to read
      // from db.conditions and remove the legacy write).
      const _conditionLabels = COMORBIDITY_CATEGORIES.flatMap(
        (cat) => (data.comorbidities?.[cat.key] || [])
      );
      if (_conditionLabels.length > 0) {
        Promise.allSettled(
          _conditionLabels.map((label) =>
            conditionsApi.upsert(buildConditionFromLabel(label, id, "prima_visita"))
          )
        ).catch(() => {});
      }

      setSaved(true);
      if (!quiet) toast.success("Prima visita salvata.");
      return true;
    } catch { toast.error("Errore nel salvataggio."); return false; }
    finally { setSaving(false); }
  };

  const goNext = async (nextStep) => { await save(true); setStep(nextStep); };

  const cl = data.referral_reason ? CHECKLISTS[data.referral_reason] : null;
  const isOsteo = data.referral_reason === "osteoporosi";

  if (!patient) return <div className="p-10 text-gray-500">Caricamento...</div>;

  return (
    <div className="space-y-4 max-w-3xl mx-auto fade-in">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3">
        <Link to={`/pazienti/${id}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Torna al paziente
        </Link>
        <span className="text-gray-200">|</span>
        <span className="text-xs text-gray-500 font-semibold">{patient.nome} {patient.cognome}</span>
        {saved && <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 text-[10px]"><Check className="w-2.5 h-2.5 mr-1" />Salvata</Badge>}
      </div>

      {/* ── Step indicator ── */}
      <Card className="px-5 py-3 border-gray-200">
        <div className="flex items-start gap-1">
          {STEPS.map((label, i) => (
            <React.Fragment key={i}>
              <StepDot
                step={i + 1}
                current={step}
                label={label}
                onJump={i + 1 < step ? () => setStep(i + 1) : undefined}
              />
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mt-3.5 ${step > i + 1 ? "bg-[#0A2540]" : "bg-gray-200"}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* ══════════════ STEP 1: Referral ══════════════ */}
      {step === 1 && (
        <Card className="p-5 space-y-5 border-gray-200">
          <div>
            <h2 className="font-heading font-bold text-xl tracking-tight flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#0A2540]" /> Motivo di invio
            </h2>
          </div>

          <div>
            <SectionLabel>Categoria di invio</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {REFERRAL_REASONS.map((r) => (
                <button key={r.key} type="button"
                  onClick={() => patch({ referral_reason: r.key })}
                  className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all flex items-center gap-2 ${
                    data.referral_reason === r.key ? "border-[#0A2540] bg-[#0A2540]/5" : "border-gray-100 hover:border-gray-300 bg-white"
                  }`}>
                  <span className="text-lg">{REFERRAL_REASON_ICONS[r.key]}</span>
                  <span className={`text-xs font-semibold flex-1 leading-tight ${data.referral_reason === r.key ? "text-[#0A2540]" : "text-gray-700"}`}>{r.label}</span>
                  {data.referral_reason === r.key && <Check className="w-4 h-4 text-[#0A2540] flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Quesito clinico / motivo di invio dettagliato <span className="text-red-400">*</span></SectionLabel>
            <textarea value={data.clinical_question}
              onChange={(e) => patch({ clinical_question: e.target.value })}
              rows={3} placeholder="Es. Artralgie alle mani da 3 mesi con rigidità mattutina, valori infiammatori elevati. Escludere artrite reumatoide."
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <SectionLabel>Data visita</SectionLabel>
              <input type="date" value={data.referral_date}
                onChange={(e) => patch({ referral_date: e.target.value })}
                className="w-full h-8 text-xs px-3 border border-gray-200 rounded-md focus:outline-none focus:border-blue-300" />
            </div>
            <div>
              <SectionLabel>Medico / fonte di invio</SectionLabel>
              <input type="text" value={data.referral_source}
                onChange={(e) => patch({ referral_source: e.target.value })}
                placeholder="Es. MMG Dr. Rossi, PS, autoindotto…"
                className="w-full h-8 text-xs px-3 border border-gray-200 rounded-md focus:outline-none focus:border-blue-300" />
            </div>
          </div>

          <NavButtons onNext={() => {
            if (!data.referral_reason) { toast.error("Seleziona un motivo di invio."); return; }
            if (!data.clinical_question.trim()) { toast.error("Inserisci il quesito clinico."); return; }
            setStep(2);
          }} onNextLabel="Avanti: anamnesi extra-reumatologica" />
        </Card>
      )}

      {/* ══════════════ STEP 2: Extra-rheumatologic history ══════════════ */}
      {step === 2 && (
        <Card className="p-5 space-y-6 border-gray-200">
          <div>
            <h2 className="font-heading font-bold text-xl tracking-tight">Anamnesi extra-reumatologica</h2>
            <p className="text-xs text-gray-500 mt-0.5">Comorbidità, fattori di fragilità e terapie concomitanti.</p>
          </div>

          {/* ── ALLERGIE A FARMACI — sempre visibile, in evidenza ── */}
          <div className="p-3.5 rounded-xl border-2 border-[#e0d1d1] bg-[#ffffff80]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600 mb-1.5">
              ⚠ Allergie a farmaci
            </p>
            <textarea value={data.drug_allergies}
              onChange={(e) => patch({ drug_allergies: e.target.value })}
              rows={2}
              placeholder="Es. Penicillina (orticaria), FANS (broncospasmo), Sulfamidici (esantema)…"
              className="w-full text-xs border border-rose-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-rose-400 bg-white" />
          </div>

          {/* ── Comorbidità ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-[#0A2540]">Comorbidità</h3>
              {(() => {
                const tot = COMORBIDITY_CATEGORIES.reduce((n, c) => n + (data.comorbidities[c.key] || []).length, 0);
                return tot > 0 ? (
                  <span className="text-[10px] bg-[#0A2540] text-white rounded-full px-2 py-0.5 font-semibold">
                    {tot} selezionate
                  </span>
                ) : null;
              })()}
            </div>

            {/* Search bar */}
            <div className="relative mb-4">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={comorbiditiesSearch}
                onChange={(e) => setComorbiditiesSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const term = comorbiditiesSearch.trim();
                    if (!term) return;
                    const hasMatch = COMORBIDITY_CATEGORIES.some((cat) =>
                      cat.items?.some((item) =>
                        item.toLowerCase().includes(term.toLowerCase())
                      )
                    );
                    if (!hasMatch) {
                      toggleComorbidity("altro", term);
                      setComorbiditiesSearch("");
                    }
                  }
                }}
                placeholder="Cerca comorbidità… (es. FA, BPCO, ILD, IRC, HBV, TIA, TVP, neoplasia…)"
                className="w-full h-8 pl-8 pr-8 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300"
              />
              {comorbiditiesSearch && (
                <button
                  type="button"
                  onClick={() => setComorbiditiesSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Search results — flat list from all categories */}
            {comorbiditiesSearch && (() => {
              const matches = COMORBIDITY_CATEGORIES.flatMap((cat) =>
                cat.items
                  .filter((item) => matchesComorbiditySearch(item, comorbiditiesSearch))
                  .map((item) => ({ item, catKey: cat.key }))
              );
              if (matches.length === 0) return (
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-gray-400 italic">Nessun risultato per "{comorbiditiesSearch}"</p>
                  <button
                    type="button"
                    onClick={() => {
                      toggleComorbidity("altro", comorbiditiesSearch.trim());
                      setComorbiditiesSearch("");
                    }}
                    className="text-[11px] text-blue-600 font-medium bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5 hover:bg-blue-100 transition-colors flex items-center gap-1"
                  >
                    <span>↵</span> Aggiungi come "altro"
                  </button>
                </div>
              );
              return (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {matches.map(({ item, catKey }) => (
                    <ToggleBtn key={item} label={item}
                      selected={(data.comorbidities[catKey] || []).includes(item)}
                      onToggle={() => toggleComorbidity(catKey, item)} />
                  ))}
                </div>
              );
            })()}

            {/* Selected items panel — always visible so selected items are never hidden */}
            {(() => {
              const allSel = COMORBIDITY_CATEGORIES.flatMap((c) =>
                (data.comorbidities[c.key] || []).map((item) => ({ item, catKey: c.key }))
              );
              if (allSel.length === 0) return null;
              return (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">Selezionate</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {allSel.map(({ item, catKey }) => (
                      <ToggleBtn key={item} label={item} selected={true}
                        onToggle={() => toggleComorbidity(catKey, item)} />
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {allSel.map(({ item }) => (
                      <div key={item} className="flex items-center gap-2">
                        <span className="text-[11px] text-[#0A2540] font-medium min-w-[140px] shrink-0">{item}:</span>
                        <input type="text"
                          value={data.comorbidity_item_notes?.[item] || ""}
                          onChange={(e) => setComorbidityNote(item, e.target.value)}
                          placeholder="Nota opzionale (es. stent coronarico 2021, in terapia…)"
                          className="flex-1 h-7 text-xs px-2.5 border border-blue-200 rounded-md focus:outline-none focus:border-blue-400 bg-white" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Frequent comorbidities (hidden during search) */}
            {!comorbiditiesSearch && (
              <div className="mb-4 p-3 border border-amber-100 rounded-xl bg-amber-50/40">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">Comorbidità frequenti</p>
                <div className="flex flex-wrap gap-1.5">
                  {FREQUENT_CONDITIONS.map(({ label, catKey }) => (
                    <ToggleBtn key={label} label={label}
                      selected={(data.comorbidities[catKey] || []).includes(label)}
                      onToggle={() => toggleComorbidity(catKey, label)} />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-1">
              <SectionLabel>ALTRO</SectionLabel>
              <textarea value={data.comorbidity_free_notes}
                onChange={(e) => patch({ comorbidity_free_notes: e.target.value })}
                rows={2} placeholder="Comorbidità non in lista o note cliniche aggiuntive…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300" />
            </div>
          </div>

          {/* ── Interventi chirurgici ── */}
          <div>
            <h3 className="font-semibold text-sm text-[#0A2540] mb-1.5">Interventi chirurgici</h3>
            <textarea value={data.surgical_history}
              onChange={(e) => patch({ surgical_history: e.target.value })}
              rows={3}
              placeholder="Es. Artroprotesi anca destra (2018), appendicectomia (2005), bypass aorto-coronarico (2020)…"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300" />
          </div>

          {/* Frailty */}
          <div>
            <h3 className="font-semibold text-sm text-[#0A2540] mb-2">Fattori di fragilità</h3>
            <div className="flex flex-wrap gap-1.5">
              {FRAILTY_ITEMS.map((item) => (
                <ToggleBtn key={item} label={item}
                  selected={data.frailty.includes(item)}
                  onToggle={() => toggleArr("frailty", item)} />
              ))}
            </div>
          </div>

          {/* Therapies — free text */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-[#0A2540]">Terapie non reumatologiche</h3>

            {/* Terapie concomitanti attuali */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <SectionLabel>Terapie concomitanti attuali</SectionLabel>
                <div className="flex items-center gap-2">
                  {concomitantConfirmed && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-green-600 font-medium">
                      <Check className="w-3 h-3" /> Salvate
                    </span>
                  )}
                  {hasPendingConcomitant && !concomitantConfirmed && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                      <Sparkles className="w-3 h-3" />
                      {concomitantItems.filter(it => !it._skip && !it._duplicate).length} riconosciuti
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => runConcomitantParse(data.current_therapies_text)}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700"
                  >
                    <Sparkles className="w-3 h-3" /> Analizza
                  </button>
                </div>
              </div>
              <textarea
                value={data.current_therapies_text}
                onChange={(e) => { patch({ current_therapies_text: e.target.value }); setConcomitantItems(null); setConcomitantConfirmed(false); }}
                onBlur={(e) => runConcomitantParse(e.target.value)}
                rows={3}
                placeholder="Es. Metformina 1000 mg/die, ASA 100 mg/die, Pantoprazolo 40 mg/die, Triatec 5 mg…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300"
              />
              {concomitantItems !== null && patient?.id && (
                <ConcomitantTherapyReview
                  mode="noted"
                  items={concomitantItems}
                  patientId={patient.id}
                  onConfirmed={() => { setConcomitantItems(null); setConcomitantConfirmed(true); }}
                  onCancel={() => setConcomitantItems(null)}
                />
              )}
            </div>

            {/* Terapie pregresse rilevanti */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <SectionLabel>Terapie pregresse rilevanti</SectionLabel>
                <div className="flex items-center gap-2">
                  {historicalConfirmed && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-green-600 font-medium">
                      <Check className="w-3 h-3" /> Salvate
                    </span>
                  )}
                  {hasPendingHistorical && !historicalConfirmed && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                      <Sparkles className="w-3 h-3" />
                      {historicalItems.filter(it => !it._skip && !it._duplicate).length} riconosciute
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => runHistoricalParse(data.previous_therapies_text)}
                    className="inline-flex items-center gap-1 text-[11px] text-purple-500 hover:text-purple-700"
                  >
                    <Sparkles className="w-3 h-3" /> Analizza
                  </button>
                </div>
              </div>
              <textarea
                value={data.previous_therapies_text}
                onChange={(e) => { patch({ previous_therapies_text: e.target.value }); setHistoricalItems(null); setHistoricalConfirmed(false); }}
                onBlur={(e) => runHistoricalParse(e.target.value)}
                rows={2}
                placeholder="Es. Pregresso MTX circa 2015–2016 sospeso per intolleranza. Statina interrotta per miopatia nel 2019."
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300"
              />
              {historicalItems !== null && patient?.id && (
                <ConcomitantTherapyReview
                  mode="historical"
                  items={historicalItems}
                  patientId={patient.id}
                  onConfirmed={() => { setHistoricalItems(null); setHistoricalConfirmed(true); }}
                  onCancel={() => setHistoricalItems(null)}
                />
              )}
            </div>
          </div>

          {/* Anamnesi familiare */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-semibold text-sm text-[#0A2540]">Anamnesi familiare</h3>
              <button type="button"
                onClick={() => setTplDialog({ open: true, category: "family_history", onLoad: (c) => patch({ family_history: data.family_history ? data.family_history.trimEnd() + "\n\n" + c : c }) })}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                <FolderOpen className="w-3.5 h-3.5" /> Carica template
              </button>
            </div>
            <textarea value={data.family_history}
              onChange={(e) => patch({ family_history: e.target.value })}
              rows={3} placeholder="Familiarità per malattie reumatologiche, autoimmuni, osteoporosi, neoplasie…"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300" />
          </div>

          {/* Anamnesi fisiologica */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-semibold text-sm text-[#0A2540]">Anamnesi fisiologica</h3>
              <button type="button"
                onClick={() => setTplDialog({ open: true, category: "physiologic_history", onLoad: (c) => patch({ physiologic_history: data.physiologic_history ? data.physiologic_history.trimEnd() + "\n\n" + c : c }) })}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                <FolderOpen className="w-3.5 h-3.5" /> Carica template
              </button>
            </div>
            <textarea value={data.physiologic_history}
              onChange={(e) => patch({ physiologic_history: e.target.value })}
              rows={3} placeholder="Fumo (quantità, anni), alcol, sport/attività fisica, gravidanze, menopausa, professione…"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300" />
          </div>

          <NavButtons onBack={() => setStep(1)} onNext={() => goNext(3)} onNextLabel="Avanti: anamnesi reumatologica" />
        </Card>
      )}

      {/* ══════════════ STEP 3: Clinical history ══════════════ */}
      {step === 3 && (
        <Card className="p-5 space-y-5 border-gray-200">
          <div>
            <h2 className="font-heading font-bold text-xl tracking-tight">
              {isOsteo ? "Anamnesi osseo-metabolica" : "Anamnesi reumatologica"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Il testo è pre-compilato con un template modificabile.</p>
          </div>

          {isOsteo ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <SectionLabel>Anamnesi osseo-metabolica</SectionLabel>
                <button type="button"
                  onClick={() => setTplDialog({ open: true, category: "rheumatic_history", onLoad: (c) => patch({ bone_history: data.bone_history ? data.bone_history.trimEnd() + "\n\n" + c : c }) })}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                  <FolderOpen className="w-3.5 h-3.5" /> Carica template
                </button>
              </div>
              <textarea
                value={data.bone_history || ""}
                onChange={(e) => patch({ bone_history: e.target.value })}
                onFocus={() => {
                  if (!data.bone_history && !autoTemplateUsed.current.has("bone")) {
                    autoTemplateUsed.current.add("bone");
                    patch({ bone_history: BONE_TEMPLATE });
                  }
                }}
                rows={10} placeholder="Clicca per caricare il template…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300 leading-relaxed" />
              <button type="button" onClick={() => patch({ bone_history: data.bone_history ? data.bone_history.trimEnd() + "\n\n" + BONE_TEMPLATE : BONE_TEMPLATE })}
                className="mt-1 text-[10px] text-blue-500 hover:text-blue-700">↩ Inserisci template</button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <SectionLabel>Anamnesi reumatologica</SectionLabel>
                <button type="button"
                  onClick={() => setTplDialog({ open: true, category: "rheumatic_history", onLoad: (c) => patch({ rheumatologic_history: data.rheumatologic_history ? data.rheumatologic_history.trimEnd() + "\n\n" + c : c }) })}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                  <FolderOpen className="w-3.5 h-3.5" /> Carica template
                </button>
              </div>
              <textarea
                value={data.rheumatologic_history}
                onChange={(e) => patch({ rheumatologic_history: e.target.value })}
                onFocus={() => {
                  if (!data.rheumatologic_history && data.referral_reason && !autoTemplateUsed.current.has("rheum")) {
                    autoTemplateUsed.current.add("rheum");
                    patch({ rheumatologic_history: RHEUM_TEMPLATES[data.referral_reason] || RHEUM_TEMPLATES.altro });
                  }
                }}
                rows={10} placeholder="Clicca per caricare il template basato sul motivo di invio…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300 leading-relaxed" />
              <button type="button" onClick={() => patch({ rheumatologic_history: data.rheumatologic_history ? data.rheumatologic_history.trimEnd() + "\n\n" + (RHEUM_TEMPLATES[data.referral_reason] || RHEUM_TEMPLATES.altro) : (RHEUM_TEMPLATES[data.referral_reason] || RHEUM_TEMPLATES.altro) })}
                className="mt-1 text-[10px] text-blue-500 hover:text-blue-700">↩ Inserisci template</button>
            </div>
          )}

          <NavButtons onBack={() => setStep(2)} onNext={() => goNext(4)} onNextLabel="Avanti: esami in visione" />
        </Card>
      )}

      {/* ══════════════ STEP 5: Physical examination ══════════════ */}
      {step === 5 && (
        <Card className="p-5 space-y-5 border-gray-200">
          <div>
            <h2 className="font-heading font-bold text-xl tracking-tight">Esame obiettivo</h2>
            <p className="text-xs text-gray-500 mt-0.5">Template modificabile basato sul motivo di invio.</p>
          </div>

          <div className="space-y-2">
            <PhysicalExamSection
              value={{
                free_text:  data.physical_exam,
                joint_exam: data.physical_exam_joint_exam || {},
                systems:    data.physical_exam_systems || {},
                mrss:       data.physical_exam_mrss || {},
                pasi:       data.physical_exam_pasi || {},
                lei:        data.physical_exam_lei  || {},
              }}
              onChange={({ free_text, joint_exam, systems, mrss, pasi, lei }) => patch({
                physical_exam:            free_text,
                physical_exam_joint_exam: joint_exam,
                physical_exam_systems:    systems,
                physical_exam_mrss:       mrss,
                physical_exam_pasi:       pasi,
                physical_exam_lei:        lei,
              })}
              showLei={isSpaDiagnosis(patient)}
              showMrss={isScleroDiagnosis(patient)}
              showPasi={isSpaDiagnosis(patient)}
              patientId={id}
              patient={patient}
              visitDate={data.referral_date || new Date().toISOString().slice(0, 10)}
              onClinimetrySaved={() => {}}
            />
            <div className="flex items-center gap-4 flex-wrap">
              {data.referral_reason && (
                <button type="button"
                  onClick={() => patch({ physical_exam: data.physical_exam ? data.physical_exam.trimEnd() + "\n\n" + (EXAM_TEMPLATES[data.referral_reason] || EXAM_TEMPLATES.altro) : (EXAM_TEMPLATES[data.referral_reason] || EXAM_TEMPLATES.altro) })}
                  className="text-[10px] text-blue-500 hover:text-blue-700 underline">
                  ↩ Inserisci template EO basato sul motivo di invio
                </button>
              )}
              <button type="button"
                onClick={() => setTplDialog({ open: true, category: "physical_exam", onLoad: (c) => patch({ physical_exam: data.physical_exam ? data.physical_exam.trimEnd() + "\n\n" + c : c }) })}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                <FolderOpen className="w-3.5 h-3.5" /> Carica template personalizzato
              </button>
            </div>
          </div>

          <NavButtons onBack={() => setStep(4)} onNext={() => goNext(6)} onNextLabel="Avanti: conclusioni" />
        </Card>
      )}

      {/* ══════════════ STEP 4: Esami / Imaging in visione ══════════════ */}
      {step === 4 && (
        <Card className="p-5 space-y-5 border-gray-200">
          <div>
            <h2 className="font-heading font-bold text-xl tracking-tight flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-[#0A2540]" /> Esami
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 font-bold">
              Seleziona un testo per salvarlo come valore di laboratorio o referto strumentale.
            </p>
          </div>

          <div className="flex justify-end mb-1">
            <button
              type="button"
              onClick={() => setLabImportOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Camera className="w-3.5 h-3.5" /> Importa da foto / PDF
            </button>
          </div>

          <SelectableTextArea
            rows={7}
            placeholder="VES, PCR, emocromo, autoanticorpi, ecografia articolare, RMN rachide… — seleziona un valore per convertirlo in dato strutturato"
            value={data.labs_imaging}
            onChange={(e) => patch({ labs_imaging: e.target.value })}
            patientId={id}
            patient={patient}
            visitDate={data.referral_date || new Date().toISOString().slice(0, 10)}
          />

          <LabImportFromImageDialog
            open={labImportOpen}
            onOpenChange={setLabImportOpen}
            patient={patient}
            onTextGenerated={(txt) => patch({ labs_imaging: (data.labs_imaging ? data.labs_imaging + "\n" : "") + txt })}
          />

          <NavButtons onBack={() => setStep(3)} onNext={() => goNext(5)} onNextLabel="Avanti: esame obiettivo" />
        </Card>
      )}

      {/* ══════════════ STEP 6: Diagnostic conclusion + PDF ══════════════ */}
      {step === 6 && (
        <Card className="p-5 border-gray-200">
          {/* Header */}
          <h2 className="font-heading font-bold text-xl tracking-tight flex items-center gap-2 mb-5">
            <Lightbulb className="w-5 h-5 text-[#0A2540]" /> Conclusioni
          </h2>

          {/* ═══════════════════════════════════════════════════════════
              BLOCCO 1 — Conclusione diagnostica
          ═══════════════════════════════════════════════════════════ */}
          <div className="rounded-xl border border-[#0A2540]/20 overflow-hidden mb-4">
            <div className="px-4 py-2.5 bg-[#0A2540]/5 border-b border-[#0A2540]/10 flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#0A2540] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
              <span className="text-xs font-bold uppercase tracking-widest text-[#0A2540]">Conclusione diagnostica</span>
            </div>
            <div className="p-4 space-y-4">

              {/* Stato diagnostico */}
              <div className="grid grid-cols-2 gap-3">
                <button type="button"
                  onClick={() => patch({ clinical_decision: "open", confirmed_diagnosis: "" })}
                  className={`flex flex-col items-start gap-1.5 p-3.5 rounded-xl border-2 text-left transition-all ${
                    !isConverting ? "border-[#0A2540] bg-[#0A2540]/5" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      !isConverting ? "border-[#0A2540]" : "border-gray-300"
                    }`}>
                      {!isConverting && <span className="w-2 h-2 rounded-full bg-[#0A2540] block" />}
                    </span>
                    <span className={`text-sm font-semibold ${!isConverting ? "text-[#0A2540]" : "text-gray-500"}`}>
                      Iter diagnostico aperto
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 ml-6 leading-snug">Percorso in corso — registra ipotesi</p>
                </button>

                <button type="button"
                  onClick={() => patch({ clinical_decision: "converting", suggested_diagnosis: "" })}
                  className={`flex flex-col items-start gap-1.5 p-3.5 rounded-xl border-2 text-left transition-all ${
                    isConverting ? "border-emerald-500 bg-emerald-50" : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isConverting ? "border-emerald-500" : "border-gray-300"
                    }`}>
                      {isConverting && <span className="w-2 h-2 rounded-full bg-emerald-500 block" />}
                    </span>
                    <span className={`text-sm font-semibold ${isConverting ? "text-emerald-800" : "text-gray-500"}`}>
                      Diagnosi definitiva raggiunta
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 ml-6 leading-snug">Paziente → follow-up di malattia nota</p>
                </button>
              </div>

              {/* CASO A: Iter aperto — ipotesi multiple */}
              {!isConverting && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Ipotesi diagnostiche <span className="font-normal normal-case tracking-normal text-gray-400">· doppio click per aprire criteri/classificazione</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Artrite reumatoide","Artrite psoriasica","SpA assiale","SpA periferico","Connettivite sistemica","LES","Sindrome di Sjögren","Sclerosi sistemica","MCTD","UCTD","Gotta / microcristalli","Artrosi","Osteoporosi","PMR / GCA","Fibromialgia","Artrite indifferenziata","Altra malattia reumatica","Nessuna malattia reumatologica","Da definire"].map((label) => {
                      const active = (data.suggested_diagnosis || "").split(", ").filter(Boolean).includes(label);
                      return (
                        <button key={label} type="button"
                          onClick={() => toggleHypothesis(label)}
                          className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                            active ? "bg-[#0A2540] border-[#0A2540] text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
                          }`}>
                          {active && <Check className="w-3 h-3 flex-shrink-0" />}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CASO B: Diagnosi definitiva */}
              {isConverting && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Seleziona la diagnosi</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFINITIVE_DIAGNOSES.map(({ label, profileKey }) => {
                      const active = data.confirmed_diagnosis === label;
                      return (
                        <button key={label} type="button"
                          onClick={() => {
                            patch({ confirmed_diagnosis: active ? "" : label });
                            if (!active && profileKey) setProfileDiseaseKey(profileKey);
                          }}
                          className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border-2 transition-all cursor-pointer font-medium ${
                            active
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                              : "bg-white border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-800"
                          }`}>
                          {active && <Check className="w-3 h-3 flex-shrink-0" />}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {data.confirmed_diagnosis && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-sm font-semibold text-emerald-800">{data.confirmed_diagnosis}</span>
                      <span className="text-[11px] text-emerald-600 ml-auto">
                        {HYPOTHESIS_TO_DISEASE[data.confirmed_diagnosis] ? "→ profilo + clinimetrie aperto" : "→ diagnosi salvata in anagrafica"}
                      </span>
                    </div>
                  )}
                  <button type="button"
                    onClick={() => patch({ clinical_decision: "open", confirmed_diagnosis: "" })}
                    className="text-[11px] text-gray-400 underline decoration-dotted hover:no-underline hover:text-gray-600">
                    Annulla — mantieni iter aperto
                  </button>
                </div>
              )}

              {/* Testo per referto — textarea ampia */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Testo per referto</p>
                  <TemplatePickerDialog
                    category="diagnostic_conclusion"
                    currentText={data.diagnostic_conclusion}
                    onSelect={(text) => patch({ diagnostic_conclusion: data.diagnostic_conclusion ? data.diagnostic_conclusion.trimEnd() + "\n\n" + text : text })}
                  />
                </div>
                <textarea
                  value={data.diagnostic_conclusion}
                  onChange={(e) => patch({ diagnostic_conclusion: e.target.value })}
                  rows={4}
                  placeholder="Conclusione narrativa libera (es. Quadro compatibile con AR sieropositiva in fase iniziale — avviare iter diagnostico con FR, anti-CCP, ecografia articolare…)"
                  className="w-full text-xs px-3 py-2.5 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-blue-300 leading-relaxed"
                />
              </div>

            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              BLOCCO 2 — Appropriatezza e triage
          ═══════════════════════════════════════════════════════════ */}
          <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-gray-400 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Appropriatezza e triage</span>
            </div>
            <div className="p-4 space-y-4">

              {/* Appropriatezza — segmented control compatto */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Appropriatezza dell'invio</p>
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                  {REFERRAL_APPROPRIATENESS.map((opt) => (
                    <button key={opt.key} type="button"
                      onClick={() => patch({ referral_appropriateness: data.referral_appropriateness === opt.key ? null : opt.key })}
                      className={`px-3.5 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 first:border-l-0 ${
                        data.referral_appropriateness === opt.key
                          ? opt.key === "appropriate"   ? "bg-emerald-600 text-white"
                          : opt.key === "borderline"    ? "bg-amber-500 text-white"
                          :                               "bg-red-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Passo successivo — select compatto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Passo successivo</p>
                  <select
                    value={data.next_step || ""}
                    onChange={(e) => patch({ next_step: e.target.value || null })}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-300 text-gray-700">
                    <option value="">— Seleziona —</option>
                    {NEXT_STEP_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Data rivalutazione — solo se follow-up reumatologico */}
                {data.next_step === "rheumatology" && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Data rivalutazione</p>
                    <input type="date"
                      value={data.follow_up_date || ""}
                      onChange={(e) => patch({ follow_up_date: e.target.value })}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-300 text-gray-700" />
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              BLOCCO 3 — Esami richiesti
          ═══════════════════════════════════════════════════════════ */}
          <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-gray-400 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Esami richiesti</span>
            </div>
            <div className="p-4 space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {(cl?.labs || []).map((lab) => (
                  <ToggleBtn key={lab} label={lab} variant="lab"
                    selected={data.requested_tests.includes(lab)}
                    onToggle={() => toggleArr("requested_tests", lab)} />
                ))}
                {(cl?.imaging || []).map((img) => (
                  <ToggleBtn key={img} label={img} variant="imaging"
                    selected={data.requested_tests.includes(img)}
                    onToggle={() => toggleArr("requested_tests", img)} />
                ))}
              </div>
              <textarea value={data.requested_tests_notes} onChange={(e) => patch({ requested_tests_notes: e.target.value })}
                rows={2} placeholder="Altri esami richiesti non in lista…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300" />
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              BLOCCO 4 — Terapia e indicazioni
          ═══════════════════════════════════════════════════════════ */}
          <div className="rounded-xl border border-gray-200 overflow-hidden mb-5">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-gray-400 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">4</span>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Terapia e indicazioni</span>
            </div>
            <div className="p-4 space-y-5">

              {/* Terapia indicata */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Terapia indicata</p>
                  <TemplatePickerDialog
                    category="therapy"
                    currentText={data.therapy_modification}
                    onSelect={(text) => patch({ therapy_modification: data.therapy_modification ? data.therapy_modification + "\n\n" + text : text })}
                  />
                </div>
                <div className="flex items-start gap-1.5 mb-2 px-2.5 py-1.5 bg-amber-50 border border-amber-100 rounded-lg">
                  <span className="text-amber-600 mt-0.5 flex-shrink-0">⚠</span>
                  <p className="text-[11px] text-amber-700 leading-snug">
                    La terapia indicata qui diventa <strong>«terapia in corso»</strong> a partire dalla visita successiva — comparirà nello storico terapie e nella timeline.
                  </p>
                </div>
                <textarea value={data.therapy_modification} onChange={(e) => patch({ therapy_modification: e.target.value })}
                  rows={5} placeholder="Nuova terapia avviata, farmaco, dose, indicazioni al MMG, terapia ponte, raccomandazioni al paziente…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300 leading-relaxed" />
                <button
                  type="button"
                  onClick={openTherapyDlg}
                  className="mt-1.5 flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors border border-blue-100 hover:border-blue-200"
                >
                  <Plus className="w-3 h-3" />
                  Aggiungi a Terapia in corso
                </button>
              </div>

              {/* Indicazioni */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Indicazioni</p>
                  <TemplatePickerDialog
                    category="outcome_notes"
                    currentText={data.outcome_notes}
                    onSelect={(text) => patch({ outcome_notes: data.outcome_notes ? data.outcome_notes + "\n\n" + text : text })}
                  />
                </div>
                <textarea value={data.outcome_notes} onChange={(e) => patch({ outcome_notes: e.target.value })}
                  rows={5} placeholder="Raccomandazioni, indicazioni al MMG, controlli, istruzioni al paziente, note per il referto…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300 leading-relaxed" />
              </div>

            </div>
          </div>

          {/* Sezioni referto */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-4">
            <SectionLabel>Sezioni da includere nel referto</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 mt-1">
              {REPORT_SECTIONS.map((s) => (
                <label key={s.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={reportSections.has(s.key)}
                    onChange={() => toggleReportSection(s.key)}
                    className="w-3.5 h-3.5 accent-[#0A2540] flex-shrink-0" />
                  <span className="text-xs text-gray-700">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <Button variant="outline" onClick={() => setStep(5)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Indietro
            </Button>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button variant="outline"
                onClick={() => {
                  const text = generateCleanClinicalReport(patient, data, reportSections);
                  navigator.clipboard.writeText(text)
                    .then(() => toast.success("Referto copiato negli appunti"))
                    .catch(() => toast.error("Impossibile copiare negli appunti"));
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-50">
                <ClipboardList className="w-4 h-4 mr-1.5" /> Copia referto
              </Button>
              <Button variant="outline" onClick={() => openReport(patient, data, reportSections)}
                className="border-gray-300 text-gray-700 hover:bg-gray-50">
                <Printer className="w-4 h-4 mr-1.5" /> Stampa / Salva PDF
              </Button>
              <Button onClick={() => save(false)} disabled={saving}
                className="bg-[#0A2540] text-white hover:bg-[#051626]">
                <Save className="w-4 h-4 mr-1.5" />
                {saving ? "Salvataggio…" : "Salva prima visita"}
              </Button>
              <Button variant="outline" onClick={() => navigate(`/pazienti/${id}`)}>
                Vai al paziente
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Diagnosis profile overlay (opens automatically on definitive diagnosis selection) ── */}
      {profileDiseaseKey && (
        <DiagnosisProfileOverlay
          open={!!profileDiseaseKey}
          onClose={() => setProfileDiseaseKey(null)}
          patient={patient}
          diseaseKey={profileDiseaseKey}
          context="prima_visita"
          visitDate={data.referral_date}
          initialJoints={data.physical_exam_joint_exam || {}}
        />
      )}

      {/* ── Quick add therapy dialog ── */}
      {therapyDlg.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Pill className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-sm text-gray-900">Aggiungi a Terapia in corso</h3>
              <button type="button" onClick={() => setTherapyDlg(d => ({ ...d, open: false }))}
                className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Farmaco *</label>
                <input
                  type="text"
                  value={therapyDlg.drug_name}
                  onChange={(e) => setTherapyDlg(d => ({ ...d, drug_name: e.target.value }))}
                  placeholder="es. Metotressato, Idrossiclorochina…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-300"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Dose</label>
                  <input
                    type="text"
                    value={therapyDlg.dose}
                    onChange={(e) => setTherapyDlg(d => ({ ...d, dose: e.target.value }))}
                    placeholder="es. 10 mg"
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-300"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Via</label>
                  <select
                    value={therapyDlg.route}
                    onChange={(e) => setTherapyDlg(d => ({ ...d, route: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-300 bg-white"
                  >
                    <option value="orale">Orale</option>
                    <option value="s.c.">S.C.</option>
                    <option value="i.m.">I.M.</option>
                    <option value="i.v.">I.V.</option>
                    <option value="topica">Topica</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Categoria</label>
                  <select
                    value={therapyDlg.category}
                    onChange={(e) => setTherapyDlg(d => ({ ...d, category: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-300 bg-white"
                  >
                    <option value="csDMARD">csDMARD</option>
                    <option value="bDMARD">bDMARD</option>
                    <option value="tsDMARD">tsDMARD</option>
                    <option value="Corticosteroid">Corticosteroide</option>
                    <option value="NSAID">FANS</option>
                    <option value="Supplement">Supplemento</option>
                    <option value="Other">Altro</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Data inizio</label>
                  <input
                    type="date"
                    value={therapyDlg.start_date}
                    onChange={(e) => setTherapyDlg(d => ({ ...d, start_date: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-300"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
              <button type="button" onClick={() => setTherapyDlg(d => ({ ...d, open: false }))}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                Annulla
              </button>
              <button type="button" onClick={saveTherapy} disabled={therapyDlg.saving}
                className="text-xs px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                <Plus className="w-3 h-3" />
                {therapyDlg.saving ? "Salvataggio…" : "Aggiungi terapia"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Template picker dialog ── */}
      <TemplatePickerDialog
        open={tplDialog.open}
        onClose={() => setTplDialog({ open: false, category: null, onLoad: null })}
        category={tplDialog.category}
        currentText={
          tplDialog.category === "physical_exam"
            ? data.physical_exam
            : tplDialog.category === "diagnostic_conclusion"
            ? data.diagnostic_conclusion
            : tplDialog.category === "family_history"
            ? data.family_history
            : tplDialog.category === "physiologic_history"
            ? data.physiologic_history
            : isOsteo ? data.bone_history : data.rheumatologic_history
        }
        onLoad={(content) => {
          tplDialog.onLoad?.(content);
          setTplDialog({ open: false, category: null, onLoad: null });
        }}
      />

      {/* ── Pending therapies pre-save modal ── */}
      {pendingTherapiesModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Terapie non ancora salvate nel profilo</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Il parser ha riconosciuto{" "}
                  {[
                    hasPendingConcomitant && `${concomitantItems.filter(it => !it._skip && !it._duplicate).length} terapia/e concomitanti`,
                    hasPendingHistorical  && `${historicalItems.filter(it => !it._skip && !it._duplicate).length} terapia/e pregresse`,
                  ].filter(Boolean).join(" e ")}{" "}
                  che non hai ancora confermato. Vuoi salvarle adesso?
                </p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              {hasPendingConcomitant && concomitantItems.filter(it => !it._skip && !it._duplicate).map((it, i) => (
                <div key={i} className="text-xs text-gray-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  {it.drug_name || it.canonical}
                  {it.dose && <span className="text-gray-400">{it.dose}</span>}
                </div>
              ))}
              {hasPendingHistorical && historicalItems.filter(it => !it._skip && !it._duplicate).map((it, i) => (
                <div key={`h${i}`} className="text-xs text-gray-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                  {it.drug_name || it.canonical}
                  {it.start_date && <span className="text-gray-400">dal {it.start_date}</span>}
                  <span className="text-gray-400 italic">pregressa</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={async () => {
                  setPendingTherapiesModal(false);
                  await savePendingTherapies();
                  save(true);
                }}
                className="flex-1 text-sm font-semibold bg-[#0A2540] text-white px-4 py-2.5 rounded-xl hover:bg-[#0d2f52] transition-colors"
              >
                Sì, salva terapie e visita
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingTherapiesModal(false);
                  setConcomitantItems(null);
                  setHistoricalItems(null);
                  setConcomitantConfirmed(true);
                  setHistoricalConfirmed(true);
                  save(true);
                }}
                className="flex-1 text-sm text-gray-600 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                No, salva solo la visita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
