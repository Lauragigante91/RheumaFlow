import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { consultApi } from "../lib/api";
import {
  Activity, Lock, User, Calendar, Pill, FlaskConical, ClipboardList,
  ChevronDown, ChevronUp, AlertCircle, Loader2, Clock,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("it-IT", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return dateStr; }
}

function fmtShort(dateStr) {
  if (!dateStr) return "—";
  try { return new Date(dateStr).toLocaleDateString("it-IT"); }
  catch { return dateStr; }
}

function Badge({ children, color = "gray" }) {
  const colors = {
    gray:   "bg-gray-100 text-gray-600",
    indigo: "bg-indigo-100 text-indigo-700",
    green:  "bg-green-100 text-green-700",
    red:    "bg-red-100 text-red-700",
    amber:  "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

function Section({ icon: Icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="w-4 h-4 text-indigo-500" />}
          <span className="font-semibold text-sm text-gray-800">{title}</span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  );
}

// ── Assessment table ──────────────────────────────────────────────────────────
const INDEX_LABELS = {
  das28_crp: "DAS28-CRP",
  das28_esr: "DAS28-ESR",
  cdai: "CDAI",
  sdai: "SDAI",
  basdai: "BASDAI",
  basfi: "BASFI",
  asdas_crp: "ASDAS-CRP",
  asdas_esr: "ASDAS-ESR",
  sledai: "SLEDAI",
  bvas: "BVAS",
  vdi: "VDI",
  fiq: "FIQ",
  haq: "HAQ",
  sf36: "SF-36",
  mhaq: "mHAQ",
  psarc: "PsARC",
  dapsa: "DAPSA",
  pasi: "PASI",
  dlqi: "DLQI",
  itas2010: "ITAS2010",
  pet_vas_score: "PET-VAS",
  eco_doppler_score: "Eco-Doppler",
};

function scoreLabel(indexType, score) {
  if (score == null || score === undefined) return "—";
  const n = parseFloat(score);
  if (isNaN(n)) return String(score);
  return n.toFixed(1);
}

function AssessmentsSection({ assessments }) {
  const [showAll, setShowAll] = useState(false);
  if (!assessments?.length) return <p className="text-sm text-gray-400 italic">Nessuna valutazione registrata.</p>;

  // Group by index type → latest first within each type
  const byType = {};
  assessments.forEach(a => {
    if (!byType[a.index_type]) byType[a.index_type] = [];
    byType[a.index_type].push(a);
  });

  // Sort each group by date desc
  Object.values(byType).forEach(arr => arr.sort((a, b) => (b.date || "").localeCompare(a.date || "")));

  const displayed = showAll ? assessments : assessments.slice(0, 30);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 pr-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Data</th>
              <th className="text-left py-2 pr-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Indice</th>
              <th className="text-right py-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Score</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((a) => (
              <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="py-1.5 pr-3 text-gray-500">{fmtShort(a.date)}</td>
                <td className="py-1.5 pr-3 text-gray-700 font-medium">
                  {INDEX_LABELS[a.index_type] || a.index_type}
                </td>
                <td className="py-1.5 text-right font-semibold text-indigo-700">
                  {scoreLabel(a.index_type, a.score)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {assessments.length > 30 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-3 text-xs text-indigo-600 hover:underline"
        >
          {showAll ? "Mostra meno" : `Mostra tutte le ${assessments.length} valutazioni`}
        </button>
      )}
    </div>
  );
}

// ── Therapies ─────────────────────────────────────────────────────────────────
function TherapiesSection({ therapies }) {
  if (!therapies?.length) return <p className="text-sm text-gray-400 italic">Nessuna terapia registrata.</p>;

  const active = therapies.filter(t => !t.end_date || t.end_date > new Date().toISOString().slice(0, 10));
  const stopped = therapies.filter(t => t.end_date && t.end_date <= new Date().toISOString().slice(0, 10));

  const TherapyRow = ({ t }) => (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-800">{t.drug || t.nome || "—"}</span>
          {t.dosage && <span className="text-xs text-gray-500">{t.dosage}</span>}
        </div>
        {t.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.note}</p>}
      </div>
      <div className="text-right flex-shrink-0 text-xs text-gray-400">
        <div>Inizio: {fmtShort(t.start_date)}</div>
        {t.end_date && <div className="text-red-400">Fine: {fmtShort(t.end_date)}</div>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge color="green">In corso — {active.length}</Badge>
          </div>
          {active.map(t => <TherapyRow key={t.id} t={t} />)}
        </div>
      )}
      {stopped.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge color="gray">Sospese — {stopped.length}</Badge>
          </div>
          {stopped.map(t => <TherapyRow key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}

// ── Lab Exams ─────────────────────────────────────────────────────────────────
function LabExamsSection({ labExams }) {
  const [showAll, setShowAll] = useState(false);
  if (!labExams?.length) return <p className="text-sm text-gray-400 italic">Nessun esame di laboratorio registrato.</p>;

  const displayed = showAll ? labExams : labExams.slice(0, 15);

  return (
    <div>
      <div className="space-y-3">
        {displayed.map((exam) => {
          const values = exam.values || exam.results || {};
          const hasValues = Object.keys(values).length > 0;
          return (
            <div key={exam.id} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600">{fmtShort(exam.date)}</span>
                {exam.note && <span className="text-xs text-gray-400 truncate max-w-[200px]">{exam.note}</span>}
              </div>
              {hasValues ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(values).map(([k, v]) => (
                    <span key={k} className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-100 rounded px-2 py-0.5">
                      <span className="text-gray-500">{k}:</span>
                      <span className="font-medium text-gray-800">{v}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Valori non specificati</p>
              )}
            </div>
          );
        })}
      </div>
      {labExams.length > 15 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-3 text-xs text-indigo-600 hover:underline"
        >
          {showAll ? "Mostra meno" : `Mostra tutti gli ${labExams.length} esami`}
        </button>
      )}
    </div>
  );
}

// ── Criteria Evaluations ──────────────────────────────────────────────────────
function CriteriaSection({ criteriaEvals }) {
  if (!criteriaEvals?.length) return <p className="text-sm text-gray-400 italic">Nessuna valutazione criteri registrata.</p>;
  return (
    <div className="space-y-2">
      {criteriaEvals.map((e) => (
        <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
          <div>
            <span className="text-sm font-medium text-gray-700">{e.criteria_set || e.criteria_type || "—"}</span>
            {e.date && <span className="ml-2 text-xs text-gray-400">{fmtShort(e.date)}</span>}
          </div>
          <div className="flex items-center gap-2">
            {e.met != null && (
              <Badge color={e.met ? "green" : "red"}>
                {e.met ? "Criteri soddisfatti" : "Criteri non soddisfatti"}
              </Badge>
            )}
            {e.score != null && (
              <span className="text-xs font-semibold text-indigo-700">{e.score} pt</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ConsultPage ──────────────────────────────────────────────────────────
export default function ConsultPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    consultApi.publicGet(token)
      .then(setBundle)
      .catch((e) => {
        const msg = e.response?.data?.detail || "Link non valido o scaduto.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm">Caricamento in corso…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Link non disponibile</h2>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const { patient, assessments, lab_exams, therapies, criteria_evaluations, expires_at, organization_name } = bundle;

  const sexLabel = patient.sesso === "M" ? "Maschio" : patient.sesso === "F" ? "Femmina" : patient.sesso;
  const diagnosi = [patient.diagnosi, ...(patient.diagnosi_secondarie || [])].filter(Boolean).join(" · ");
  const durataMalattia = patient.onset_year ? `${new Date().getFullYear() - patient.onset_year} anni` : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-sm">RheumaFlow</span>
            <span className="ml-2 text-xs text-gray-400">{organization_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-medium">
            <Lock className="w-3 h-3" />
            Sola lettura
          </div>
          {expires_at && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              Scade {fmt(expires_at)}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* ── Patient card ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-lg font-bold text-gray-900">
                  {patient.codice_paziente || "Paziente"}
                </h1>
                <Badge color="indigo">Consulto</Badge>
              </div>
              {diagnosi && (
                <p className="text-sm font-medium text-gray-700 mb-2">{diagnosi}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                {patient.anno_nascita && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Nato/a nel {patient.anno_nascita}
                  </div>
                )}
                {sexLabel && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    {sexLabel}
                  </div>
                )}
                {patient.onset_year && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Esordio {patient.onset_year}
                    {durataMalattia && <span className="text-gray-400">({durataMalattia})</span>}
                  </div>
                )}
              </div>
              {patient.note && (
                <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                  {patient.note}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Criteri ── */}
        {criteria_evaluations?.length > 0 && (
          <Section icon={ClipboardList} title="Criteri di classificazione">
            <CriteriaSection criteriaEvals={criteria_evaluations} />
          </Section>
        )}

        {/* ── Terapie ── */}
        <Section icon={Pill} title={`Terapie (${therapies?.length || 0})`}>
          <TherapiesSection therapies={therapies} />
        </Section>

        {/* ── Valutazioni ── */}
        <Section icon={Activity} title={`Valutazioni cliniche (${assessments?.length || 0})`}>
          <AssessmentsSection assessments={assessments} />
        </Section>

        {/* ── Esami ── */}
        <Section icon={FlaskConical} title={`Esami di laboratorio (${lab_exams?.length || 0})`} defaultOpen={false}>
          <LabExamsSection labExams={lab_exams} />
        </Section>

        {/* ── Footer ── */}
        <div className="text-center py-6 text-xs text-gray-400 space-y-1">
          <p>Documento generato da <strong className="text-gray-500">RheumaFlow</strong> — uso esclusivamente clinico</p>
          <p>Questo link è temporaneo e scade il {fmt(expires_at)}. I dati del paziente sono pseudonimizzati.</p>
        </div>
      </div>
    </div>
  );
}
