import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, FlaskConical, Save, Plus,
  Trash2, Pencil, ClipboardList, Calendar, Check,
  ExternalLink, Stethoscope, FileText, Printer, X, Pill, CheckCircle2, Camera,
} from "lucide-react";
import SelectableTextBlock from "../components/shared/SelectableTextBlock";

import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import TemplatePickerDialog from "../components/visits/TemplatePickerDialog";
import PhysicalExamSection from "../components/clinical/PhysicalExamSection";
import SelectableTextArea from "../components/shared/SelectableTextArea";
import QuickTherapyModal  from "../components/therapy/QuickTherapyModal";
import { patientsApi, workupVisitsApi, diseaseProfileApi, therapiesApi } from "../lib/api";
import { parseTherapyText } from "../lib/therapyTextParser";
import { detectSafetyReminders, detectDrugsInText } from "../lib/safetyReminders";
import { isScleroDiagnosis, isSpaDiagnosis } from "../lib/diseaseDetection";
import PatientProfileStrip from "../components/layout/PatientProfileStrip";
import RheumatologicStatusStrip from "../components/layout/RheumatologicStatusStrip";
import WorkupReportModal from "../components/visits/WorkupReportModal";
import VisitDetailModal from "../components/visits/VisitDetailModal";
import ExamsDialog from "../components/labs/ExamsDialog";
import DiagnosisProfileOverlay from "../components/profiles/DiagnosisProfileOverlay";
import LabImportFromImageDialog from "../components/labs/LabImportFromImageDialog";

// ─── constants ────────────────────────────────────────────────────────────────

// Maps a diagnostic hypothesis chip label to a disease profile key
const HYPOTHESIS_TO_DISEASE = {
  "Artrite reumatoide":   "ra",
  "Artrite psoriasica":   "psa",
  "SpA assiale":          "spa",
  "SpA periferico":       "spa",
  "LES":                  "sle",
  "Sindrome di Sjögren":  "sjogren",
  "Sclerosi sistemica":   "sclero",
  "PMR / GCA":            "pmr",
};

// All diseases available for profile opening (shown as quick-access buttons)
const PROFILE_BUTTONS = [
  { key: "ra",       label: "Artrite Reumatoide",     color: "#1d4ed8" },
  { key: "spa",      label: "Spondiloartrite",         color: "#ea580c" },
  { key: "psa",      label: "Artrite Psoriasica",      color: "#16a34a" },
  { key: "sle",      label: "LES",                     color: "#7c3aed" },
  { key: "sclero",   label: "Sclerodermia",            color: "#db2777" },
  { key: "myositis", label: "Miosite",                 color: "#d97706" },
  { key: "sjogren",  label: "Sjögren",                 color: "#0891b2" },
  { key: "aav",      label: "Vasculite ANCA",          color: "#b91c1c" },
  { key: "pmr",      label: "PMR / GCA",               color: "#be185d" },
];

// Diagnoses available when closing the diagnostic path (single-select in Case A)
const DEFINITIVE_DIAGNOSES = [
  { label: "Artrite reumatoide",      profileKey: "ra" },
  { label: "Artrite psoriasica",      profileKey: "psa" },
  { label: "SpA assiale",             profileKey: "spa" },
  { label: "SpA periferico",          profileKey: "spa" },
  { label: "LES",                     profileKey: "sle" },
  { label: "Sindrome di Sjögren",     profileKey: "sjogren" },
  { label: "Sclerosi sistemica",      profileKey: "sclero" },
  { label: "PMR / GCA",              profileKey: "pmr" },
  { label: "Miosite",                 profileKey: "myositis" },
  { label: "Vasculite ANCA",          profileKey: "aav" },
  { label: "MCTD / Connettivite",     profileKey: null },
  { label: "UCTD",                    profileKey: null },
  { label: "Gotta / microcristalli",  profileKey: null },
  { label: "Artrosi",                 profileKey: null },
  { label: "Osteoporosi",             profileKey: null },
  { label: "Fibromialgia",            profileKey: null },
  { label: "Artrite indifferenziata", profileKey: null },
  { label: "Altra malattia reumatica",          profileKey: null },
  { label: "Nessuna malattia reumatologica",    profileKey: null },
];

const WORKUP_TESTS = [
  { key: "cbc",             label: "Emocromo (CBC)" },
  { key: "pcr_ves",         label: "PCR + VES" },
  { key: "creatinine",      label: "Creatinina + eGFR" },
  { key: "liver",           label: "AST / ALT / GGT" },
  { key: "cpk",             label: "CPK / Aldolasi" },
  { key: "vitd",            label: "25-OH Vitamina D" },
  { key: "rf_anti_ccp",     label: "FR + Anti-CCP" },
  { key: "ena",             label: "ENA panel" },
  { key: "anca",            label: "ANCA (P/C)" },
  { key: "ana",             label: "ANA / anti-dsDNA" },
  { key: "urine",           label: "Urine (proteinuria)" },
  { key: "quantiferon",     label: "Quantiferon / IGRA" },
  { key: "hbv_screen",      label: "HBV DNA / HBsAg" },
  { key: "lipids",          label: "Profilo lipidico" },
  { key: "glucose",         label: "Glicemia" },
  { key: "hrct",            label: "HRCT torace" },
  { key: "eco_msk",         label: "Ecografia MSK" },
  { key: "eco_vasc",        label: "Ecografia vascolare" },
  { key: "rx_mani",         label: "Rx mani / piedi" },
  { key: "rx_rachide",      label: "Rx rachide" },
  { key: "rmn_rachide",     label: "RMN rachide" },
  { key: "capillaroscopia", label: "Capillaroscopia" },
  { key: "pet_ct",          label: "PET/TC vascolare" },
  { key: "angio_ct",        label: "AngioCT / AngioMRI" },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function patientLabel(p) {
  if (!p) return "Paziente";
  const name = [p.cognome, p.nome].filter(Boolean).join(" ");
  return name || p.codice_paziente || "Paziente";
}

// ─── Stable-data formatters (for inline import buttons) ──────────────────────

const THERAPY_CAT_LABELS = {
  cardiovascular_drugs:  "Farmaci cardiovascolari",
  anticoagulants:        "Anticoagulanti / Antiaggreganti",
  diabetes_metabolic:    "Farmaci per diabete / metabolismo",
  gastroprotective:      "Gastroprotettori",
  psychiatric_drugs:     "Farmaci psichiatrici",
  respiratory_drugs:     "Farmaci respiratori",
  neurologic_drugs:      "Farmaci neurologici",
  oncologic_therapies:   "Terapie oncologiche",
  hormonal:              "Terapie ormonali",
  supplements:           "Integratori / Altro",
};

function fmtComorbForReport(data, firstVisitData) {
  if (!data) return null;
  const combs = data.comorbidities || {};
  const nonAllergy = Object.entries(combs)
    .filter(([cat]) => cat !== "allergologic")
    .flatMap(([, items]) => (Array.isArray(items) ? items : []));

  // Merge structured picker allergie + free-text allergie_testo (via drug_allergies),
  // deduplicando per confronto case-insensitive trimmed.
  const structuredItems = combs.allergologic || [];
  const freeText = firstVisitData?.drug_allergies?.trim() || "";
  const normalizedStructured = structuredItems.map((s) => s.toLowerCase().trim());
  const allergyItems = freeText && !normalizedStructured.includes(freeText.toLowerCase())
    ? [...structuredItems, freeText]
    : structuredItems;

  const frailty = data.frailty || [];
  const parts = [];
  if (nonAllergy.length) parts.push("Comorbidità: " + nonAllergy.join(", ") + ".");
  if (allergyItems.length) parts.push("Allergie note: " + allergyItems.join(", ") + ".");
  if (frailty.length) parts.push("Fattori di fragilità: " + frailty.join(", ") + ".");
  if (data.comorbidity_notes?.trim()) parts.push("Note: " + data.comorbidity_notes.trim());
  return parts.join("\n") || null;
}

function fmtTherapiesForReport(comorbData, firstVisitData) {
  const parts = [];
  const domText = firstVisitData?.current_therapies_text?.trim();
  if (domText) parts.push("Terapia domiciliare:\n" + domText);
  const therapies = comorbData?.therapies || {};
  const thLines = Object.entries(therapies)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => "  \u2022 " + (THERAPY_CAT_LABELS[k] || k) + ": " + v.trim());
  if (thLines.length) parts.push("Terapie concomitanti non reumatologiche:\n" + thLines.join("\n"));
  if (comorbData?.therapy_notes?.trim()) parts.push("Note terapeutiche: " + comorbData.therapy_notes.trim());
  if (comorbData?.previous_therapy_notes?.trim()) parts.push("Terapie pregresse: " + comorbData.previous_therapy_notes.trim());
  return parts.join("\n\n") || null;
}

function makeEmptyForm() {
  return {
    visit_date:                    todayISO(),
    // ── report sections 1-3 (new) ──────────────────────────────────────────
    comorbidities_text:            "",
    home_therapies_text:           "",
    rheumatologic_history_summary: "",
    // ── report sections 4-9 ───────────────────────────────────────────────
    interval_history:              "",
    physical_exam:                 "",
    physical_exam_joint_exam:      {},
    physical_exam_systems:         {},
    physical_exam_mrss:            {},
    physical_exam_pasi:            {},
    physical_exam_lei:             {},
    labs_imaging:                  "",
    clinimetria_notes:             "",
    diagnostic_hypotheses:         "",
    conclusions:                   "",
    // ── workflow / plan ───────────────────────────────────────────────────
    clinical_decision:             "open",
    confirmed_diagnosis:           "",
    requested_tests:               [],
    requested_tests_notes:         "",
    followup_date:                 "",
    therapy_modification:          "",
    referred_to_gp:                false,
    referral_note:                 "",
    notes:                         "",
  };
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ number, title, subtitle, icon: Icon }) {
  return (
    <div className="flex items-start gap-2.5 mb-2">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0A2540]/8 flex items-center justify-center text-[11px] font-black text-[#0A2540]/60 mt-0.5">
        {number}
      </span>
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-600 flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-gray-400" />}
          {title}
        </div>
        {subtitle && <div className="text-[11px] text-gray-400 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

function SectionBlock({ number, title, subtitle, icon, children, sectionKey, reportChecked, onToggleReport }) {
  return (
    <div className="space-y-2">
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        {sectionKey ? (
          <label title="Includi nel referto" style={{ paddingTop: "3px", flexShrink: 0, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!reportChecked}
              onChange={() => onToggleReport?.(sectionKey)}
              style={{ width: "14px", height: "14px", accentColor: "#0A2540", cursor: "pointer" }}
            />
          </label>
        ) : (
          <div style={{ width: "14px", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <SectionHeader number={number} title={title} subtitle={subtitle} icon={icon} />
          {children}
        </div>
      </div>
    </div>
  );
}

const REFERRAL_LABELS = {
  artrite_reumatoide:    "Artrite Reumatoide",
  artrite_psoriasica:    "Artrite Psoriasica",
  spondilite:            "Spondilite Anchilosante / SpA",
  lupus:                 "Lupus eritematoso sistemico",
  sjogren:               "Sindrome di Sjögren",
  sclerosi_sistemica:    "Sclerosi Sistemica",
  miopatie_infiammatorie:"Miopatie Infiammatorie",
  vasculiti:             "Vasculiti",
  pmr_lvv:               "PMR / Vasculiti dei grossi vasi",
  artrosi:               "Artrosi",
  osteoporosi:           "Osteoporosi",
  gotta:                 "Gotta / Iperuricemia",
  fibromialgia:          "Fibromialgia",
  altro:                 "Altro",
};

// ─── Report sections for selective import ─────────────────────────────────────
// Used by SelectableTextBlock (section-picker) and PatientDataImportPanel

const WORKUP_REPORT_SECTIONS = [
  { key: "comorbidities_text",            label: "1 · Comorbidità",      color: "#b45309" },
  { key: "home_therapies_text",           label: "2 · Terapie dom.",     color: "#0f766e" },
  { key: "rheumatologic_history_summary", label: "3 · Raccordo anamn.", color: "#7c3aed" },
  { key: "interval_history",              label: "4 · Anamnesi",         color: "#0284c7" },
  { key: "physical_exam",                 label: "5 · Esame ob.",        color: "#475569" },
  { key: "labs_imaging",                  label: "6 · Esami",            color: "#6366f1" },
  { key: "diagnostic_hypotheses",         label: "7 · Assessment",       color: "#dc2626" },
  { key: "conclusions",                   label: "8 · Conclusioni",      color: "#be185d" },
  { key: "therapy_modification",          label: "9 · Piano",            color: "#15803d" },
];

function PastVisitCard({ visit, patient, onEdit, onDelete }) {
  const [modalOpen, setModalOpen] = useState(false);
  const isConverting = visit.clinical_decision === "converting";

  const testLabels = (visit.requested_tests || [])
    .map((k) => WORKUP_TESTS.find((t) => t.key === k)?.label)
    .filter(Boolean);
  const requestedTestsText = [
    testLabels.length > 0 ? "Esami richiesti: " + testLabels.join(", ") : null,
    visit.requested_tests_notes?.trim() || null,
  ].filter(Boolean).join("\n");

  const sections = [
    visit.comorbidities_text?.trim() && { color: "amber", number: "1", label: "COMORBIDITÀ", text: visit.comorbidities_text.trim() },
    visit.rheumatologic_history_summary?.trim() && { color: "amber", number: "3", label: "RACCORDO ANAMNESTICO REUMATOLOGICO", text: visit.rheumatologic_history_summary.trim() },
    visit.interval_history?.trim() && { color: "amber", number: "4", label: "ANAMNESI INTERVALLARE", text: visit.interval_history.trim() },
    visit.physical_exam?.trim() && { color: "amber", number: "5", label: "ESAME OBIETTIVO", text: visit.physical_exam.trim() },
    visit.labs_imaging?.trim() && { color: "amber", number: "6", label: "ESAMI / IMAGING", text: visit.labs_imaging.trim() },
    (visit.diagnostic_hypotheses || visit.conclusions) && {
      color: "amber", number: "7", label: "CONCLUSIONI",
      text: [
        visit.diagnostic_hypotheses ? "Ipotesi: " + visit.diagnostic_hypotheses : null,
        visit.conclusions?.trim() || null,
      ].filter(Boolean).join("\n"),
    },
    requestedTestsText && { color: "blue", number: "8", label: "ESAMI RICHIESTI", text: requestedTestsText },
    visit.therapy_modification?.trim() && { color: "blue", number: "9", label: "TERAPIA INDICATA", text: visit.therapy_modification.trim() },
    visit.referral_note?.trim() && { color: "blue", number: "10", label: "INDICAZIONI", text: visit.referral_note.trim() },
  ].filter(Boolean);

  const badge = isConverting ? (
    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] px-1.5">Diagnosi formulata</Badge>
  ) : (
    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5">Iter aperto</Badge>
  );

  const footerActions = (
    <>
      <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => { setModalOpen(false); onEdit(visit); }}>
        <Pencil className="w-3 h-3 mr-1" /> Modifica
      </Button>
      <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 text-red-600 border-red-200 hover:bg-red-50"
        onClick={() => { setModalOpen(false); onDelete(visit); }}>
        <Trash2 className="w-3 h-3 mr-1" /> Elimina
      </Button>
    </>
  );

  return (
    <>
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left rounded-lg border border-gray-200 bg-white hover:bg-amber-50 hover:border-amber-200 transition-colors group"
        onClick={() => setModalOpen(true)}
      >
        <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="font-medium text-sm text-gray-800 flex-1">{fmtDate(visit.visit_date)}</span>
        {visit.status === "draft" && (
          <Badge className="bg-gray-100 text-gray-500 border-gray-300 text-[10px] px-1.5">Bozza</Badge>
        )}
        {isConverting ? (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] px-1.5">Diagnosi formulata</Badge>
        ) : visit.status !== "draft" ? (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5">Iter aperto</Badge>
        ) : null}
        <span className="text-[10px] text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">Apri →</span>
      </button>
      {modalOpen && (
        <VisitDetailModal
          onClose={() => setModalOpen(false)}
          dateIso={visit.visit_date}
          patient={patient}
          sections={sections}
          badge={badge}
          extraFooterActions={footerActions}
        />
      )}
    </>
  );
}

function FirstVisitTimelineCard({ fv, patientId, patient, onInsertToSection, insertSections }) {
  const [modalOpen, setModalOpen] = useState(false);
  const d = fv.data || fv || {};
  const dateIso = d.referral_date || fv.created_at?.slice(0, 10);

  const sections = [
    d.clinical_question     && { number: "0", label: "QUESITO CLINICO",        text: d.clinical_question },
    d.rheumatologic_history && { number: "1", label: "ANAMNESI REUMATOLOGICA", text: d.rheumatologic_history },
    d.physical_exam         && { number: "2", label: "ESAME OBIETTIVO",        text: d.physical_exam },
    d.labs_imaging          && { number: "3", label: "ESAMI",                  text: d.labs_imaging },
    (d.suggested_diagnosis || d.diagnostic_conclusion) && {
      number: "4", label: "CONCLUSIONI",
      text: [d.suggested_diagnosis, d.diagnostic_conclusion].filter(Boolean).join("\n"),
      noSelect: true,
    },
    d.therapy_modification  && { number: "5", label: "TERAPIA INDICATA",       text: d.therapy_modification },
    d.outcome_notes         && { number: "6", label: "INDICAZIONI",            text: d.outcome_notes },
  ].filter(Boolean);

  const badge = (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
      Prima visita
    </span>
  );

  const extraFooterActions = (
    <Link to={`/pazienti/${patientId}/prima-visita`} onClick={() => setModalOpen(false)}>
      <Button size="sm" variant="outline" className="h-7 text-[11px] px-3 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
        <ExternalLink className="w-3 h-3 mr-1" /> Vedi / modifica
      </Button>
    </Link>
  );

  return (
    <>
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left rounded-lg border border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-300 transition-colors group"
        onClick={() => setModalOpen(true)}
      >
        <ClipboardList className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
        <span className="font-medium text-sm text-gray-800 flex-1">Prima visita · {fmtDate(dateIso)}</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200 whitespace-nowrap">
          Prima visita
        </span>
        <span className="text-[10px] text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">Apri →</span>
      </button>
      {modalOpen && (
        <VisitDetailModal
          onClose={() => setModalOpen(false)}
          dateIso={dateIso}
          patient={patient}
          sections={sections}
          badge={badge}
          extraFooterActions={extraFooterActions}
          renderSectionContent={(s) =>
            onInsertToSection && insertSections && !s.noSelect
              ? (
                <SelectableTextBlock
                  text={s.text}
                  paragraphClass="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
                  patientId={patientId}
                  onInsertToSection={onInsertToSection}
                  insertSections={insertSections}
                />
              )
              : <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{s.text}</p>
          }
        />
      )}
    </>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function WorkupVisitPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [patient, setPatient]           = useState(null);
  const [firstVisit, setFirstVisit]     = useState(null);
  const [comorbData, setComorbData]     = useState(null);
  const [pastVisits, setPastVisits]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [form, setForm]                 = useState(makeEmptyForm());
  const [labImportOpen, setLabImportOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [cockpitData, setCockpitData] = useState(null);
  const [reportSections, setReportSections] = useState(() => new Set([
    "cockpit_physiologic", "cockpit_family",
    "profile_comorbidities", "profile_therapy", "profile_allergies",
    "workup_motivo_ipotesi", "workup_esami_richiesti",
    "rheumatologic_history_summary", "interval_history", "physical_exam",
    "labs_imaging", "clinimetria_notes",
    "conclusions", "piano", "therapy_modification", "referral_note",
  ]));
  const [reportModalOpen,   setReportModalOpen]   = useState(false);
  const [examsDialogOpen,   setExamsDialogOpen]   = useState(false);
  const [profileDiseaseKey, setProfileDiseaseKey] = useState(null);
  const [therapyMenu, setTherapyMenu] = useState(null); // { x, y, text, selStart, selEnd } | null
  const [therapyQTM,  setTherapyQTM]  = useState({ open: false, src: "", selStart: 0, selEnd: 0 });
  const hasAutoImportedExam    = useRef(false);
  const hasAutoImportedTherapy = useRef(false);
  // Snapshot of pastVisits taken at page-load — frozen for the duration of the session
  // so that adding therapy in the plan does NOT immediately update the cockpit header.
  const frozenPastVisitsRef    = useRef(null);

  // Safety reminders from drug names typed in the therapy plan (real-time, before any early return)
  const planReminders = useMemo(
    () => detectSafetyReminders(detectDrugsInText(form.therapy_modification), patient),
    [form.therapy_modification, patient]
  );

  const load = useCallback(async () => {
    try {
      const [pat, fv, visits, comorb] = await Promise.all([
        patientsApi.get(id),
        diseaseProfileApi.get(id, "prima_visita").catch(() => null),
        workupVisitsApi.list(id),
        diseaseProfileApi.get(id, "comorbidities").catch(() => null),
      ]);
      setPatient(pat);
      setFirstVisit(fv);
      setPastVisits(visits);
      // Freeze once at first load — so the cockpit always shows pre-visit therapy snapshot
      if (frozenPastVisitsRef.current === null) frozenPastVisitsRef.current = visits;
      setComorbData(comorb?.data || {});
    } catch {
      toast.error("Errore nel caricamento dei dati");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-import physical exam from last workup visit (or first visit as fallback) when creating a new visit
  useEffect(() => {
    if (editingVisit) return;
    if (!hasAutoImportedExam.current) {
      let source = null;
      if (pastVisits.length > 0) {
        const completedVisits = pastVisits.filter(v => v.status === "completed" || v.report_generated);
        const pool = completedVisits.length > 0 ? completedVisits : pastVisits.filter(v => v.status !== "draft" || completedVisits.length === 0);
        source = [...pool].sort((a, b) => (b.visit_date || "").localeCompare(a.visit_date || ""))[0] || null;
      } else if (firstVisit) {
        source = firstVisit.data || firstVisit;
      }
      if (source && (source.physical_exam || source.physical_exam_joint_exam)) {
        setForm(f => ({
          ...f,
          physical_exam:            source.physical_exam            || f.physical_exam,
          physical_exam_joint_exam: source.physical_exam_joint_exam || f.physical_exam_joint_exam,
          physical_exam_systems:    source.physical_exam_systems    || f.physical_exam_systems,
          physical_exam_mrss:       source.physical_exam_mrss       || f.physical_exam_mrss,
          physical_exam_pasi:       source.physical_exam_pasi       || f.physical_exam_pasi,
          physical_exam_lei:        source.physical_exam_lei        || f.physical_exam_lei,
        }));
        hasAutoImportedExam.current = true;
      }
    }
    if (!hasAutoImportedTherapy.current && pastVisits.length > 0) {
      const completedForTherapy = pastVisits.filter(v => v.status === "completed" || v.report_generated);
      const therapyPool = completedForTherapy.length > 0 ? completedForTherapy : pastVisits;
      const sorted = [...therapyPool].sort((a, b) => (b.visit_date || "").localeCompare(a.visit_date || ""));
      const last = sorted[0];
      if (last?.therapy_modification) {
        setForm(f => ({ ...f, therapy_modification: last.therapy_modification }));
        hasAutoImportedTherapy.current = true;
      }
    }
  }, [pastVisits, firstVisit, editingVisit]);

  // Auto-open a specific visit for editing when arriving via ?editVisit=<id>
  const hasAutoEditedRef = useRef(false);
  useEffect(() => {
    if (hasAutoEditedRef.current || editingVisit) return;
    const targetId = searchParams.get("editVisit");
    if (!targetId || pastVisits.length === 0) return;
    const match = pastVisits.find((v) => v._id === targetId || v.id === targetId);
    if (match) {
      hasAutoEditedRef.current = true;
      startEdit(match);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pastVisits, searchParams]);

  const startEdit = (visit) => {
    setEditingVisit(visit);
    setForm({
      visit_date:                    visit.visit_date || todayISO(),
      comorbidities_text:            visit.comorbidities_text            || "",
      home_therapies_text:           visit.home_therapies_text           || "",
      rheumatologic_history_summary: visit.rheumatologic_history_summary || "",
      interval_history:              visit.interval_history              || "",
      physical_exam:                 visit.physical_exam                 || "",
      physical_exam_joint_exam:      visit.physical_exam_joint_exam      || {},
      physical_exam_systems:         visit.physical_exam_systems         || {},
      physical_exam_mrss:            visit.physical_exam_mrss            || {},
      physical_exam_pasi:            visit.physical_exam_pasi            || {},
      physical_exam_lei:             visit.physical_exam_lei             || {},
      labs_imaging:                  visit.labs_imaging                  || "",
      clinimetria_notes:             visit.clinimetria_notes             || "",
      diagnostic_hypotheses:         visit.diagnostic_hypotheses         || "",
      conclusions:                   visit.conclusions                   || "",
      clinical_decision:             visit.clinical_decision             || "open",
      confirmed_diagnosis:           visit.confirmed_diagnosis           || "",
      requested_tests:               visit.requested_tests               || [],
      requested_tests_notes:         visit.requested_tests_notes         || "",
      followup_date:                 visit.followup_date                 || "",
      therapy_modification:          visit.therapy_modification          || "",
      referred_to_gp:                visit.referred_to_gp               || false,
      referral_note:                 visit.referral_note                 || "",
      notes:                         visit.notes                         || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const insertToSection = useCallback((text, sectionKey) => {
    setForm(f => {
      const current = f[sectionKey] || "";
      return { ...f, [sectionKey]: current ? current + "\n\n" + text : text };
    });
  }, []);

  // legacy alias — keeps SelectableTextArea in labs_imaging working unchanged
  const insertToHistory = useCallback((text) => {
    insertToSection(text, "interval_history");
  }, [insertToSection]);

  const cancelEdit = () => {
    setEditingVisit(null);
    setForm(makeEmptyForm());
  };

  const toggleConverting = () => {
    const next = form.clinical_decision === "converting" ? "open" : "converting";
    setForm({ ...form, clinical_decision: next, confirmed_diagnosis: "" });
  };

  const toggleHypothesis = (label) => {
    setForm(f => {
      const current = f.diagnostic_hypotheses ? f.diagnostic_hypotheses.split(", ").filter(Boolean) : [];
      const next = current.includes(label) ? current.filter(h => h !== label) : [...current, label];
      return { ...f, diagnostic_hypotheses: next.join(", ") };
    });
  };

  // ── "Salva in Terapia" — text selection menu ─────────────────────────────
  const handleTherapyMouseUp = useCallback((e) => {
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    if (start === end) { setTherapyMenu(null); return; }
    const text = ta.value.substring(start, end).trim();
    if (!text) { setTherapyMenu(null); return; }
    setTherapyMenu({ x: e.clientX, y: e.clientY, text, selStart: start, selEnd: end });
  }, []);

  const handleTherapyContextMenu = useCallback((e) => {
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const text = ta.value.substring(start, end).trim();
    if (!text) return;
    e.preventDefault();
    setTherapyMenu({ x: e.clientX, y: e.clientY, text, selStart: start, selEnd: end });
  }, []);

  const saveSelectedAsTherapy = useCallback(async () => {
    if (!therapyMenu?.text) return;
    const parsed = parseTherapyText(therapyMenu.text);
    setTherapyMenu(null);
    try {
      await therapiesApi.create({
        patient_id: id,
        drug_name:  parsed.drug_name,
        category:   parsed.category,
        dose:       parsed.dose       || undefined,
        frequency:  parsed.frequency  || undefined,
        route:      parsed.route      || undefined,
        start_date: form.visit_date   || new Date().toISOString().slice(0, 10),
        status:     "active",
        notes:      parsed.parsed ? undefined : parsed.raw_text,
      });
      toast.success(
        parsed.parsed
          ? `Terapia salvata: ${parsed.drug_name}${parsed.dose ? " · " + parsed.dose : ""}`
          : `Terapia salvata (testo libero): ${parsed.drug_name}`,
        {
          action: { label: "modifica", onClick: () => navigate(`/pazienti/${id}`) },
          duration: 6000,
        }
      );
    } catch {
      toast.error("Errore nel salvataggio della terapia");
    }
  }, [therapyMenu, id, form.visit_date, navigate]);

  useEffect(() => {
    if (!therapyMenu) return;
    const close = (e) => {
      if (e.target?.closest?.("[data-therapy-menu]")) return;
      setTherapyMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [therapyMenu]);

  const toggleTest = (key) => {
    setForm((f) => ({
      ...f,
      requested_tests: f.requested_tests.includes(key)
        ? f.requested_tests.filter((k) => k !== key)
        : [...f.requested_tests, key],
    }));
  };

  const toggleReportSection = useCallback((key) => {
    setReportSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleDelete = async (visit) => {
    if (!window.confirm(`Eliminare la visita del ${fmtDate(visit.visit_date)}?`)) return;
    try {
      await workupVisitsApi.remove(visit.id);
      toast.success("Visita eliminata");
      load();
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  };

  const handleComplete = async () => {
    if (!editingVisit) return;
    if (!window.confirm("Contrassegnare questa visita come completata? Sarà usata come visita precedente per i futuri import.")) return;
    try {
      const updated = await workupVisitsApi.complete(editingVisit.id);
      setEditingVisit(updated);
      toast.success("Visita completata e confermata");
      load();
    } catch {
      toast.error("Errore nel completamento della visita");
    }
  };

  const save = async () => {
    if (!form.visit_date) { toast.error("Inserisci la data della visita"); return; }
    if (form.clinical_decision === "converting" && !form.confirmed_diagnosis.trim()) {
      toast.error("Inserisci la diagnosi confermata per completare la conversione in follow-up");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        patient_id:            id,
        visit_date:            form.visit_date,
        rheumatologic_history_summary: form.rheumatologic_history_summary || null,
        interval_history:      form.interval_history || null,
        physical_exam:              form.physical_exam || null,
        physical_exam_joint_exam:   Object.keys(form.physical_exam_joint_exam || {}).length > 0
          ? form.physical_exam_joint_exam
          : null,
        physical_exam_systems:      Object.values(form.physical_exam_systems || {}).some((v) => v?.trim())
          ? form.physical_exam_systems
          : null,
        physical_exam_mrss:         Object.values(form.physical_exam_mrss || {}).some((v) => v > 0)
          ? form.physical_exam_mrss
          : null,
        physical_exam_pasi:         Object.values(form.physical_exam_pasi || {}).some(Boolean)
          ? form.physical_exam_pasi
          : null,
        physical_exam_lei:          Object.values(form.physical_exam_lei || {}).some(Boolean)
          ? form.physical_exam_lei
          : null,
        labs_imaging:               form.labs_imaging || null,
        clinimetria_notes:     form.clinimetria_notes || null,
        diagnostic_hypotheses: form.diagnostic_hypotheses || null,
        conclusions:           form.conclusions || null,
        clinical_decision:     form.clinical_decision,
        confirmed_diagnosis:   form.clinical_decision === "converting"
          ? form.confirmed_diagnosis.trim()
          : null,
        requested_tests:       form.requested_tests.length > 0 ? form.requested_tests : null,
        requested_tests_notes: form.requested_tests_notes || null,
        followup_date:         form.followup_date || null,
        therapy_modification:  form.therapy_modification || null,
        referred_to_gp:        form.referred_to_gp || null,
        referral_note:         form.referral_note || null,
        comorbidities_text:    form.comorbidities_text    || null,
        home_therapies_text:   form.home_therapies_text   || null,
        notes:                 form.notes || null,
        status:                editingVisit?.status || "draft",
        report_generated:      editingVisit?.report_generated || false,
        visit_type:            editingVisit?.visit_type || "workup",
      };

      if (editingVisit) {
        await workupVisitsApi.update(editingVisit.id, payload);
        toast.success("Visita aggiornata");
      } else {
        await workupVisitsApi.create(id, payload);
        toast.success("Visita di workup salvata come bozza");
      }

      if (form.clinical_decision === "converting") {
        await patientsApi.update(id, {
          patient_state: "follow_up",
          diagnosi: form.confirmed_diagnosis.trim() || null,
        });
        toast.success("Paziente convertito in follow-up di malattia nota");
        navigate(`/pazienti/${id}`);
        return;
      }

      // Note: we intentionally do NOT update the cockpit's last_therapy_modification here.
      // The cockpit shows the therapy snapshot from the START of this visit.
      // The new therapy will appear in the cockpit only at the NEXT visit session.

      setEditingVisit(null);
      setForm(makeEmptyForm());
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  // SSOT: narrative fields live in patient doc (allergie_testo, terapia_domiciliare).
  // fvData bridges them into the shape expected by fmtComorbForReport / fmtTherapiesForReport.
  // Must be declared before any early returns to comply with React rules of hooks.
  const fvData = useMemo(() => patient ? {
    drug_allergies:         patient.allergie_testo      || null,
    current_therapies_text: patient.terapia_domiciliare || null,
  } : null, [patient]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 text-gray-400 text-sm">
        Caricamento...
      </div>
    );
  }

  const isEditing    = !!editingVisit;
  const isConverting = form.clinical_decision === "converting";

  return (
    <div className="space-y-5">

      {/* breadcrumb */}
      <div className="flex items-center gap-2">
        <Link to={`/pazienti/${id}`}>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-gray-500 hover:text-gray-800">
            <ArrowLeft className="w-4 h-4 mr-1" /> {patientLabel(patient)}
          </Button>
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-600 font-medium">Visita workup</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setExamsDialogOpen(true)} className="h-7 text-xs px-2.5">
          <FlaskConical className="w-3.5 h-3.5 mr-1" /> Esami
        </Button>
      </div>

      {/* page header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 mb-1.5 flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5" /> Iter diagnostico in corso
        </div>
        <h1 className="font-heading text-3xl md:text-4xl font-black tracking-tighter text-[#0A2540]">
          {patientLabel(patient)}
        </h1>
        {(patient?.diagnosi || firstVisit?.data?.provisional_diagnosis || firstVisit?.provisional_diagnosis || firstVisit?.suggested_diagnosis) && (
          <p className="mt-1 text-sm text-gray-500">
            Ipotesi corrente: {patient?.diagnosi || firstVisit?.data?.provisional_diagnosis || firstVisit?.provisional_diagnosis || firstVisit?.suggested_diagnosis}
          </p>
        )}
      </div>

      {/* Profilo generale del paziente */}
      <PatientProfileStrip
        patientId={id}
        firstVisit={firstVisit}
        onCockpitData={(data) => setCockpitData(prev => ({ ...(prev || {}), ...data }))}
        onFirstVisitChange={() => {
          diseaseProfileApi.get(id, "prima_visita")
            .then(fv => setFirstVisit(fv))
            .catch(() => {});
        }}
        reportSections={reportSections}
        toggleReportSection={toggleReportSection}
      />

      {/* Workup reumatologico attivo */}
      <RheumatologicStatusStrip
        patientId={id}
        firstVisit={firstVisit}
        pastVisits={frozenPastVisitsRef.current ?? pastVisits}
        reportSections={reportSections}
        toggleReportSection={toggleReportSection}
        onWorkupData={(data) => setCockpitData(prev => ({ ...(prev || {}), ...data }))}
      />

      {/* two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: timeline */}
        {(() => {
          const timelineItems = [
            ...(firstVisit ? [{
              _type:     "prima_visita",
              _sortDate: firstVisit.data?.referral_date || firstVisit.created_at?.slice(0, 10) || "0000-00-00",
              _fv:       firstVisit,
            }] : []),
            ...pastVisits.map((v) => ({
              _type:     "workup",
              _sortDate: v.visit_date || "0000-00-00",
              _visit:    v,
            })),
          ].sort((a, b) => b._sortDate.localeCompare(a._sortDate));

          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-bold text-sm text-gray-700 uppercase tracking-[0.12em]">
                  Visite precedenti
                </h2>
                <span className="text-[11px] text-gray-400 font-medium">{timelineItems.length}</span>
              </div>

              {timelineItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                  <FlaskConical className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Nessuna visita registrata.</p>
                  <p className="text-[11px] text-gray-300 mt-0.5">Compila il modulo per iniziare.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {timelineItems.map((item) =>
                    item._type === "prima_visita" ? (
                      <FirstVisitTimelineCard key="prima_visita" fv={item._fv} patientId={id} patient={patient} onInsertToSection={insertToSection} insertSections={WORKUP_REPORT_SECTIONS} />
                    ) : (
                      <PastVisitCard
                        key={item._visit.id}
                        visit={item._visit}
                        patient={patient}
                        onEdit={startEdit}
                        onDelete={handleDelete}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* RIGHT: form */}
        <div className="lg:col-span-2">
          <Card className="border-gray-200 shadow-sm">

            {/* form header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-sm text-[#0A2540]">
                  {isEditing
                    ? `Modifica visita · ${fmtDate(editingVisit.visit_date)}`
                    : "Nuova visita di workup diagnostico"}
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {isEditing
                    ? "Modifica i campi e salva le modifiche."
                    : "Rivalutazione intervallare. Puoi registrare quante visite servono prima di formulare la diagnosi."}
                </p>
              </div>
              {isEditing && (
                <Button variant="ghost" size="sm" className="h-7 text-[11px] text-gray-500" onClick={cancelEdit}>
                  <Plus className="w-3 h-3 mr-1 rotate-45" /> Nuova visita
                </Button>
              )}
            </div>

            <div className="px-5 py-5 space-y-7">

              {/* Data */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Data della visita</div>
                <Input
                  type="date"
                  value={form.visit_date}
                  onChange={(e) => setForm({ ...form, visit_date: e.target.value })}
                  className="max-w-[180px]"
                />
              </div>

              {/* ── Sezione 1: Comorbidità read-only dalla prima visita ── */}
              {fmtComorbForReport(comorbData, fvData) && (
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "10px" }}>
                    Dati dalla prima visita — solo lettura · ☐ = includi nel referto
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <label title="Includi nel referto" style={{ paddingTop: "1px", flexShrink: 0, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={reportSections.has("comorbidities")}
                        onChange={() => toggleReportSection("comorbidities")}
                        style={{ width: "14px", height: "14px", accentColor: "#0A2540", cursor: "pointer" }}
                      />
                    </label>
                    <div>
                      <div style={{ fontSize: "10px", color: "#b45309", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "3px" }}>
                        1 · Comorbidità e storia extra-reumatologica
                      </div>
                      <p style={{ fontSize: "12px", color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{fmtComorbForReport(comorbData, fvData)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 3 · Raccordo anamnestico reumatologico ── */}
              <SectionBlock
                number="3"
                title="Raccordo anamnestico reumatologico"
                subtitle="Sintesi della storia reumatologica. Costruita selezionando paragrafi rilevanti dalla prima visita o dalle visite precedenti nel pannello di sinistra."
                sectionKey="rheumatologic_history_summary"
                reportChecked={reportSections.has("rheumatologic_history_summary")}
                onToggleReport={toggleReportSection}
              >
                <Textarea
                  rows={5}
                  placeholder="Paziente con storia di… — prima valutazione reumatologica in data… — ha eseguito…"
                  value={form.rheumatologic_history_summary}
                  onChange={(e) => setForm({ ...form, rheumatologic_history_summary: e.target.value })}
                  className={form.rheumatologic_history_summary ? "border-violet-300 bg-violet-50/20" : ""}
                />
                <p className="text-[11px] text-violet-500 mt-1">
                  Seleziona un paragrafo dalla prima visita o da una visita precedente nel pannello di sinistra → <strong>3 · Raccordo anamn.</strong>
                </p>
              </SectionBlock>

              {/* ── 4 · Anamnesi intervallare ── */}
              <SectionBlock
                number="4"
                title="Anamnesi intervallare"
                subtitle="Evoluzione sintomi dall'ultima visita, nuovi disturbi, risposta a terapie."
                sectionKey="interval_history"
                reportChecked={reportSections.has("interval_history")}
                onToggleReport={toggleReportSection}
              >
                <div className="space-y-1">
                  <Textarea
                    rows={4}
                    placeholder="Dall'ultima visita il paziente riferisce…"
                    value={form.interval_history}
                    onChange={(e) => setForm({ ...form, interval_history: e.target.value })}
                  />
                  <TemplatePickerDialog
                    category="rheumatic_history"
                    onSelect={(text) => setForm((f) => ({
                      ...f,
                      interval_history: f.interval_history ? f.interval_history + "\n\n" + text : text,
                    }))}
                  />
                </div>
              </SectionBlock>

              {/* ── 5 · Esame obiettivo ── */}
              <SectionBlock
                number="5"
                title="Esame obiettivo"
                subtitle="Articolazioni, apparati, parametri vitali — espandi solo le sezioni pertinenti."
                sectionKey="physical_exam"
                reportChecked={reportSections.has("physical_exam")}
                onToggleReport={toggleReportSection}
              >
                <PhysicalExamSection
                  value={{
                    free_text:  form.physical_exam,
                    joint_exam: form.physical_exam_joint_exam || {},
                    systems:    form.physical_exam_systems    || {},
                    mrss:       form.physical_exam_mrss       || {},
                    pasi:       form.physical_exam_pasi       || {},
                    lei:        form.physical_exam_lei        || {},
                  }}
                  onChange={({ free_text, joint_exam, systems, mrss, pasi, lei }) => setForm((f) => ({
                    ...f,
                    physical_exam:            free_text,
                    physical_exam_joint_exam: joint_exam,
                    physical_exam_systems:    systems,
                    physical_exam_mrss:       mrss,
                    physical_exam_pasi:       pasi,
                    physical_exam_lei:        lei,
                  }))}
                  showLei={isSpaDiagnosis(patient)}
                  showMrss={isScleroDiagnosis(patient)}
                  showPasi={isSpaDiagnosis(patient)}
                />
              </SectionBlock>

              {/* ── 6 · Esami ── */}
              <SectionBlock
                number="6"
                title="Esami"
                subtitle="Risultati discussi in visita: laboratorio, radiologia, ecografia, RMN, TC."
                icon={FlaskConical}
                sectionKey="labs_imaging"
                reportChecked={reportSections.has("labs_imaging")}
                onToggleReport={toggleReportSection}
              >
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
                  rows={4}
                  placeholder="VES, PCR, emocromo, autoanticorpi, ecografia articolare, RMN rachide… — seleziona un valore per convertirlo in dato strutturato"
                  value={form.labs_imaging}
                  onChange={(e) => setForm({ ...form, labs_imaging: e.target.value })}
                  patientId={id}
                  patient={patient}
                  visitDate={form.visit_date}
                  onInsertToHistory={insertToHistory}
                />
              </SectionBlock>

              <LabImportFromImageDialog
                open={labImportOpen}
                onOpenChange={setLabImportOpen}
                patient={patient}
                onTextGenerated={(txt) => setForm(f => ({ ...f, labs_imaging: (f.labs_imaging ? f.labs_imaging + "\n" : "") + txt }))}
              />

              {/* ── Clinimetria (opzionale) ── */}
              <SectionBlock
                number="6b"
                title="Clinimetria"
                subtitle="Indici quantitativi se già disponibili. Non obbligatorio per salvare."
                icon={Stethoscope}
                sectionKey="clinimetria_notes"
                reportChecked={reportSections.has("clinimetria_notes")}
                onToggleReport={toggleReportSection}
              >
                <Textarea
                  rows={3}
                  placeholder="es. VAS dolore: 6/10 · VES: 45 mm/h · PCR: 12 mg/L · RF: positivo 1:80 — campo libero, non blocca il salvataggio."
                  value={form.clinimetria_notes}
                  onChange={(e) => setForm({ ...form, clinimetria_notes: e.target.value })}
                />
                <p className="text-[11px] text-gray-400">
                  La clinimetria strutturata (DAS28, ASDAS, ecc.) sarà disponibile una volta formulata la diagnosi definitiva e convertito il percorso in follow-up.
                </p>
              </SectionBlock>

              {/* ── 7 · Conclusioni ── */}
              <div className="border-t border-gray-100 pt-5 space-y-5">
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <label title="Includi nel referto" style={{ paddingTop: "3px", flexShrink: 0, cursor: "pointer" }}>
                    <input type="checkbox" checked={reportSections.has("conclusions")}
                      onChange={() => toggleReportSection("conclusions")}
                      style={{ width: "14px", height: "14px", accentColor: "#0A2540", cursor: "pointer" }} />
                  </label>
                  <div style={{ flex: 1 }}>
                    <SectionHeader number="7" title="Conclusioni" subtitle="Diagnosi raggiunta o iter ancora aperto?" />
                  </div>
                </div>

                {/* ── Domanda principale ── */}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, clinical_decision: "open", confirmed_diagnosis: "" }))}
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
                        Workup ancora aperto
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 ml-6 leading-snug">Iter diagnostico in corso — registra ipotesi</p>
                  </button>

                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, clinical_decision: "converting", diagnostic_hypotheses: "" }))}
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

                {/* ── CASO A: Workup aperto — ipotesi multi-select + profili opzionali ── */}
                {!isConverting && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Ipotesi diagnostiche attuali</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Artrite reumatoide","Artrite psoriasica","SpA assiale","SpA periferico","Connettivite sistemica","LES","Sindrome di Sjögren","Sclerosi sistemica","MCTD","UCTD","Gotta / microcristalli","Artrosi","Osteoporosi","PMR / GCA","Fibromialgia","Artrite indifferenziata","Altra malattia reumatica","Nessuna malattia reumatologica","Da definire"].map((label) => {
                        const active = (form.diagnostic_hypotheses || "").split(", ").filter(Boolean).includes(label);
                        return (
                          <button key={label} type="button" onClick={() => toggleHypothesis(label)}
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

                {/* ── CASO B: Diagnosi definitiva — singola scelta, apre profilo automaticamente ── */}
                {isConverting && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Seleziona la diagnosi</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DEFINITIVE_DIAGNOSES.map(({ label, profileKey }) => {
                        const active = form.confirmed_diagnosis === label;
                        return (
                          <button key={label} type="button"
                            onClick={() => {
                              setForm(f => ({ ...f, confirmed_diagnosis: active ? "" : label }));
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
                    {form.confirmed_diagnosis && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span className="text-sm font-semibold text-emerald-800">{form.confirmed_diagnosis}</span>
                        <span className="text-[11px] text-emerald-600 ml-auto">
                          {HYPOTHESIS_TO_DISEASE[form.confirmed_diagnosis] ? "→ profilo + clinimetrie aperto" : "→ diagnosi salvata in anagrafica"}
                        </span>
                      </div>
                    )}
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, clinical_decision: "open", confirmed_diagnosis: "" }))}
                      className="text-[11px] text-gray-400 underline decoration-dotted hover:no-underline hover:text-gray-600">
                      Annulla — mantieni iter aperto
                    </button>
                  </div>
                )}

                {/* ── Testo per referto (sempre visibile) ── */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Testo per referto</p>
                  <input type="text" value={form.conclusions}
                    onChange={(e) => setForm(f => ({ ...f, conclusions: e.target.value }))}
                    placeholder="Conclusione narrativa libera (es. Quadro compatibile con SpA assiale non-radiografica…)"
                    className="w-full h-8 text-xs px-3 border border-gray-200 rounded-md focus:outline-none focus:border-blue-300" />
                </div>
              </div>

              {/* ── 8 · Esami richiesti ── */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <label title="Includi nel referto" style={{ paddingTop: "3px", flexShrink: 0, cursor: "pointer" }}>
                    <input type="checkbox" checked={reportSections.has("piano")}
                      onChange={() => toggleReportSection("piano")}
                      style={{ width: "14px", height: "14px", accentColor: "#0A2540", cursor: "pointer" }} />
                  </label>
                  <SectionHeader number="8" title="Esami richiesti" subtitle="Laboratorio e strumentale richiesti in questa visita." icon={FlaskConical} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {WORKUP_TESTS.map((t) => {
                    const sel = form.requested_tests.includes(t.key);
                    return (
                      <button key={t.key} type="button" onClick={() => toggleTest(t.key)}
                        className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                          sel ? "bg-teal-700 border-teal-700 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-teal-400"
                        }`}>
                        {sel && <Check className="w-3 h-3 flex-shrink-0" />}
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <textarea rows={2}
                  placeholder="Altri esami richiesti non in lista…"
                  value={form.requested_tests_notes}
                  onChange={(e) => setForm({ ...form, requested_tests_notes: e.target.value })}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300" />
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Prossima rivalutazione</p>
                  <Input type="date" value={form.followup_date}
                    onChange={(e) => setForm({ ...form, followup_date: e.target.value })}
                    className="max-w-[180px]" />
                </div>
              </div>

              {/* ── 9 · Terapia indicata ── */}
              <div className="border-t border-gray-100 pt-5 space-y-2">
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <label title="Includi nel referto" style={{ paddingTop: "3px", flexShrink: 0, cursor: "pointer" }}>
                    <input type="checkbox" checked={reportSections.has("therapy_modification")}
                      onChange={() => toggleReportSection("therapy_modification")}
                      style={{ width: "14px", height: "14px", accentColor: "#0A2540", cursor: "pointer" }} />
                  </label>
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">9 · Terapia indicata</p>
                      <TemplatePickerDialog category="therapy"
                        currentText={form.therapy_modification}
                        onSelect={(text) => setForm(f => ({ ...f, therapy_modification: f.therapy_modification ? f.therapy_modification + "\n\n" + text : text }))} />
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Sarà mostrata in evidenza nella sintesi clinica della visita successiva.
                    </p>
                    <div className="relative">
                      <textarea rows={3}
                        placeholder="Nuova terapia avviata, indicazioni al MMG, terapia ponte, raccomandazioni al paziente…"
                        value={form.therapy_modification}
                        onChange={(e) => setForm({ ...form, therapy_modification: e.target.value })}
                        onMouseUp={handleTherapyMouseUp}
                        onContextMenu={handleTherapyContextMenu}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300" />
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Seleziona un farmaco nel testo e usa tasto destro → <span className="font-medium">Salva in Terapia</span>
                      </p>
                    </div>

                    {/* ── Safety reminders — triggered as drugs are typed in the plan ── */}
                    {planReminders.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                        <p style={{ fontSize: "10px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Promemoria di sicurezza
                        </p>
                        {planReminders.map(r => (
                          <div key={r.id} style={{
                            background: r.priority === "high" ? "#fef2f2" : "#fffbeb",
                            border: `1px solid ${r.priority === "high" ? "#fecaca" : "#fde68a"}`,
                            borderRadius: "8px",
                            padding: "8px 11px",
                          }}>
                            <p style={{ fontSize: "11px", fontWeight: 700, color: r.priority === "high" ? "#dc2626" : "#92400e", marginBottom: "3px" }}>
                              {r.priority === "high" ? "⚠ " : "· "}{r.label}
                            </p>
                            <p style={{ fontSize: "11px", color: "#6b7280", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
                              {r.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── 10 · Indicazioni ── */}
              <div className="border-t border-gray-100 pt-5 space-y-2">
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <label title="Includi nel referto" style={{ paddingTop: "3px", flexShrink: 0, cursor: "pointer" }}>
                    <input type="checkbox" checked={reportSections.has("referral_note")}
                      onChange={() => toggleReportSection("referral_note")}
                      style={{ width: "14px", height: "14px", accentColor: "#0A2540", cursor: "pointer" }} />
                  </label>
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">10 · Indicazioni</p>
                      <TemplatePickerDialog category="outcome_notes"
                        currentText={form.referral_note}
                        onSelect={(text) => setForm(f => ({ ...f, referral_note: f.referral_note ? f.referral_note + "\n\n" + text : text }))} />
                    </div>
                    <textarea rows={5}
                      placeholder="Sintesi della visita, indicazioni per il MMG, piano terapeutico, raccomandazioni…"
                      value={form.referral_note}
                      onChange={(e) => setForm({ ...form, referral_note: e.target.value })}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300" />
                  </div>
                </div>
              </div>

              {/* Footer / save */}
              <div className="flex items-center flex-wrap gap-3 pt-1 border-t border-gray-100">
                <Button
                  onClick={save}
                  disabled={saving}
                  className={
                    isConverting
                      ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                      : "bg-[#0A2540] hover:bg-[#051626] text-white"
                  }
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving
                    ? "Salvataggio…"
                    : isConverting
                    ? "Salva e converti in follow-up"
                    : isEditing
                    ? "Aggiorna visita"
                    : "Salva visita di workup"}
                </Button>
                {editingVisit && editingVisit.status !== "completed" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleComplete}
                    className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Completa visita
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReportModalOpen(true)}
                  className="border-[#0A2540]/40 text-[#0A2540] hover:bg-[#0A2540] hover:text-white"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Elabora referto
                </Button>
                <Link to={`/pazienti/${id}`}>
                  <Button variant="outline">Annulla</Button>
                </Link>
              </div>

            </div>
          </Card>
        </div>
      </div>
      <WorkupReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        form={form}
        patient={patient}
        reportSections={reportSections}
        workupTests={WORKUP_TESTS}
        comorbText={fmtComorbForReport(comorbData, fvData)}
        cockpitData={cockpitData}
      />
      <ExamsDialog
        open={examsDialogOpen}
        onOpenChange={setExamsDialogOpen}
        patient={patient}
      />

      {/* ── Disease profile + baseline clinimetrics overlay ── */}
      <DiagnosisProfileOverlay
        open={!!profileDiseaseKey}
        onClose={() => setProfileDiseaseKey(null)}
        patient={patient}
        diseaseKey={profileDiseaseKey}
        visitId={editingVisit?.id}
        visitType="workup"
        visitDate={form.visit_date}
        onClinimetrySaved={(indexTypes) => {
          if (indexTypes?.length) {
            const note = `Clinimetrie baseline registrate: ${indexTypes.join(", ")}`;
            setForm(f => ({
              ...f,
              clinimetria_notes: f.clinimetria_notes
                ? f.clinimetria_notes + "\n" + note
                : note,
            }));
          }
        }}
      />

      {/* ── Floating "Salva in Terapia" pill (fixed, appears on text selection) ── */}
      {therapyMenu && (
        <div
          data-therapy-menu
          onClick={() => {
            setTherapyQTM({ open: true, src: therapyMenu.text, selStart: therapyMenu.selStart, selEnd: therapyMenu.selEnd });
            setTherapyMenu(null);
          }}
          style={{
            position: "fixed",
            left: therapyMenu.x,
            top: therapyMenu.y - 10,
            transform: "translate(-50%, -100%)",
            zIndex: 99999,
          }}
          className="flex items-center gap-1.5 bg-[#0A2540] text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-xl cursor-pointer select-none whitespace-nowrap hover:bg-[#0d2e52] transition-colors"
        >
          <Pill className="w-3 h-3 flex-shrink-0" />
          Salva in Terapia
          <span className="text-[10px] opacity-60 font-normal ml-0.5 truncate max-w-[140px]">
            "{therapyMenu.text.slice(0, 30)}{therapyMenu.text.length > 30 ? "…" : ""}"
          </span>
        </div>
      )}

      <QuickTherapyModal
        open={therapyQTM.open}
        onClose={() => setTherapyQTM({ open: false, src: "", selStart: 0, selEnd: 0 })}
        sourceText={therapyQTM.src}
        patientId={id}
        patient={patient}
        visitDate={form.visit_date}
        onSaved={() => {}}
        onAppendToPlan={(text) => setForm(f => ({
          ...f,
          therapy_modification: f.therapy_modification ? f.therapy_modification + "\n\n" + text : text,
        }))}
        onExpand={(newText) => {
          const sel = therapyQTM;
          setForm(f => ({
            ...f,
            therapy_modification:
              f.therapy_modification.substring(0, sel.selStart) +
              newText +
              f.therapy_modification.substring(sel.selEnd),
          }));
        }}
      />
    </div>
  );
}
