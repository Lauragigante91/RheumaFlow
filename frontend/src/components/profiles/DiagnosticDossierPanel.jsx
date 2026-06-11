import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import {
  ChevronDown, ChevronUp, FolderOpen, Calendar, FlaskConical,
  Pill, CheckCircle2, FileText, Save, Edit2, ClipboardList,
} from "lucide-react";
import { diseaseProfileApi } from "../../lib/api";
import { toast } from "sonner";
import { COMORBIDITY_CATEGORIES } from "../../lib/conditions";

// ─── Constants ────────────────────────────────────────────────────────────────

const REFERRAL_REASON_LABELS = {
  artralgie:     "🦴 Artralgie / sospetta artrite infiammatoria",
  fibromialgia:  "🌐 Dolore diffuso / sospetta fibromialgia",
  osteoporosi:   "🦷 Osteoporosi / frattura da fragilità / MOC",
  autoanticorpi: "🔬 Autoanticorpi positivi isolati",
  connettivite:  "💧 Sospetta connettivite / malattia sistemica",
  pmr_lvv:       "🔴 Sospetta PMR / GCA / LVV",
  spa:           "🔗 Lombalgia infiammatoria / sospetta SpA",
  altro:         "📋 Altro / motivo non specificato",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SubSection({ number, title, icon: Icon, children }) {
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-amber-700/80 font-semibold flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {number && <span className="text-amber-600/60 font-black">{number} ·</span>}
        {title}
      </div>
      {children}
    </div>
  );
}

function EntryCard({ label, date, children }) {
  return (
    <div className="rounded-md bg-white border border-amber-100 px-3 py-2 space-y-0.5">
      <div className="flex items-center gap-2">
        {date && (
          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {fmtDate(date)}
          </span>
        )}
        {label && (
          <span className="text-[10px] uppercase tracking-[0.1em] text-gray-400 font-medium">{label}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyNote({ text }) {
  return <p className="text-xs text-gray-400 italic">{text}</p>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiagnosticDossierPanel({ patient, firstVisit, workupVisits, patientId }) {
  const [open, setOpen]                     = useState(false);
  const [rationale, setRationale]           = useState("");
  const [editing, setEditing]               = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [profileLoaded, setProfileLoaded]   = useState(false);

  // ── Load editable rationale when panel first opens ───────────────────────
  useEffect(() => {
    if (!open || profileLoaded || !patientId) return;
    diseaseProfileApi.get(patientId, "dossier_diagnostico")
      .then((doc) => {
        if (doc?.data?.final_rationale) {
          setRationale(doc.data.final_rationale);
        } else {
          // Prefill from conversion data if nothing saved yet
          const convVisit = (workupVisits || []).find((v) => v.clinical_decision === "converting");
          const lines = [];
          if (patient?.diagnosi) lines.push(`Diagnosi: ${patient.diagnosi}`);
          if (convVisit?.diagnostic_hypotheses) lines.push(`\nRazionale diagnostico:\n${convVisit.diagnostic_hypotheses}`);
          if (firstVisit?.suggested_diagnosis && !patient?.diagnosi) {
            lines.push(`Ipotesi iniziale: ${firstVisit.suggested_diagnosis}`);
          }
          setRationale(lines.join(""));
        }
        setProfileLoaded(true);
      })
      .catch(() => {
        if (patient?.diagnosi) setRationale(`Diagnosi: ${patient.diagnosi}`);
        setProfileLoaded(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patientId, profileLoaded]);

  const saveRationale = async () => {
    setSaving(true);
    try {
      const existing = await diseaseProfileApi.get(patientId, "dossier_diagnostico").catch(() => null);
      await diseaseProfileApi.upsert(patientId, "dossier_diagnostico", {
        ...(existing?.data || {}),
        final_rationale: rationale,
      });
      toast.success("Diagnosi finale e razionale salvati");
      setEditing(false);
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  // ── Build timeline ────────────────────────────────────────────────────────
  const sortedWorkup = [...(workupVisits || [])].sort((a, b) =>
    (a.visit_date || "").localeCompare(b.visit_date || "")
  );

  const timelineEvents = [];
  if (firstVisit) {
    timelineEvents.push({
      date:       firstVisit.referral_date,
      type:       "prima_visita",
      label:      "Prima visita",
      hypothesis: firstVisit.suggested_diagnosis || firstVisit.diagnostic_conclusion || null,
      certainty:  firstVisit.diagnostic_certainty || null,
    });
  }
  for (const v of sortedWorkup) {
    timelineEvents.push({
      date:       v.visit_date,
      type:       v.clinical_decision === "converting" ? "diagnosis" : "workup",
      label:      v.clinical_decision === "converting" ? "Diagnosi formulata" : "Visita workup",
      hypothesis: v.clinical_decision === "converting"
        ? v.confirmed_diagnosis
        : v.diagnostic_hypotheses,
      labs:       v.labs_imaging,
    });
  }

  // ── Aggregate esami / imaging ─────────────────────────────────────────────
  const labsEntries = [];
  if (firstVisit?.requested_tests?.length > 0) {
    labsEntries.push({
      date:    firstVisit.referral_date,
      label:   "Esami richiesti — prima visita",
      content: Array.isArray(firstVisit.requested_tests)
        ? firstVisit.requested_tests.join(" · ")
        : firstVisit.requested_tests,
    });
  }
  if (firstVisit?.requested_tests_notes) {
    labsEntries.push({
      date:    firstVisit.referral_date,
      label:   "Note esami — prima visita",
      content: firstVisit.requested_tests_notes,
    });
  }
  for (const v of sortedWorkup) {
    if (v.labs_imaging?.trim()) {
      labsEntries.push({
        date:    v.visit_date,
        label:   "Esami / imaging in visione",
        content: v.labs_imaging,
      });
    }
  }

  // ── Aggregate terapie / indicazioni ──────────────────────────────────────
  const therapyEntries = [];
  if (firstVisit?.current_therapies_text) {
    therapyEntries.push({
      date:    firstVisit.referral_date,
      label:   "Terapie domiciliari all'invio",
      content: firstVisit.current_therapies_text,
    });
  }
  for (const v of sortedWorkup) {
    if (v.therapy_modification?.trim()) {
      therapyEntries.push({
        date:    v.visit_date,
        label:   "Modifica terapeutica / indicazioni",
        content: v.therapy_modification,
      });
    }
  }

  // ── Comorbidities ─────────────────────────────────────────────────────────
  const allComorbidities = COMORBIDITY_CATEGORIES.flatMap((cat) =>
    (firstVisit?.comorbidities?.[cat.key] || []).map((item) => ({
      item,
      note: firstVisit?.comorbidity_item_notes?.[item] || "",
    }))
  );

  const hasWorkup    = sortedWorkup.length > 0;
  const totalEvents  = timelineEvents.length;

  if (!firstVisit && !hasWorkup) return null;

  return (
    <Card className="border-amber-200 shadow-sm overflow-hidden" data-testid="diagnostic-dossier-panel">

      {/* ── Collapsible header ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-amber-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <div className="font-heading font-bold text-sm text-[#0A2540]">
              Dossier diagnostico / Sintesi pre-follow-up
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-2 flex-wrap">
              {firstVisit && <span>Prima visita documentata</span>}
              {hasWorkup && (
                <span className="flex items-center gap-1">
                  <span className="text-amber-400">·</span>
                  {sortedWorkup.length} {sortedWorkup.length === 1 ? "visita" : "visite"} di workup
                </span>
              )}
              {!open && patient?.diagnosi && (
                <>
                  <span className="text-amber-400">·</span>
                  <span className="font-semibold text-emerald-700">{patient.diagnosi}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {totalEvents > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
              {totalEvents} eventi
            </span>
          )}
          {open
            ? <ChevronUp className="w-4 h-4 text-amber-500" />
            : <ChevronDown className="w-4 h-4 text-amber-500" />
          }
        </div>
      </button>

      {/* ── Expanded body ── */}
      {open && (
        <div className="border-t border-amber-100 px-5 py-5 space-y-7">

          {/* §1 Motivo invio iniziale */}
          <SubSection number="1" title="Motivo invio iniziale" icon={ClipboardList}>
            {firstVisit?.referral_reason ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-800 font-semibold">
                    {REFERRAL_REASON_LABELS[firstVisit.referral_reason] || firstVisit.referral_reason}
                  </span>
                  {firstVisit.referral_date && (
                    <span className="text-[10px] text-gray-400">— {fmtDate(firstVisit.referral_date)}</span>
                  )}
                </div>
                {firstVisit.rheumatologic_history && (
                  <div className="rounded-md bg-white border border-amber-100 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-gray-400 mb-1">Anamnesi reumatologica</div>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{firstVisit.rheumatologic_history}</p>
                  </div>
                )}
                {firstVisit.physical_exam && (
                  <div className="rounded-md bg-white border border-amber-100 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-gray-400 mb-1">Esame obiettivo — prima visita</div>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{firstVisit.physical_exam}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyNote text="Motivo di invio non documentato nella prima visita." />
            )}
          </SubSection>

          {/* §2 Anamnesi rilevante consolidata */}
          <SubSection number="2" title="Anamnesi rilevante consolidata" icon={FileText}>
            <div className="space-y-3">
              {allComorbidities.length > 0 ? (
                <div>
                  <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-[0.1em] mb-1.5">Comorbidità</div>
                  <div className="flex flex-wrap gap-1.5">
                    {allComorbidities.map(({ item, note }) => (
                      <span key={item} className="inline-flex items-baseline gap-1 text-[11px] bg-white border border-gray-200 rounded-full px-2.5 py-0.5">
                        <span className="text-gray-700">{item}</span>
                        {note && <span className="text-gray-400 italic">({note})</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {(firstVisit?.frailty || []).length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-[0.1em] mb-1">Fragilità</div>
                  <p className="text-xs text-amber-700">{firstVisit.frailty.join(" · ")}</p>
                </div>
              )}

              {firstVisit?.current_therapies_text && (
                <div>
                  <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-[0.1em] mb-1">Terapie domiciliari (all'invio)</div>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{firstVisit.current_therapies_text}</p>
                </div>
              )}

              {!allComorbidities.length && !(firstVisit?.frailty?.length) && !firstVisit?.current_therapies_text && (
                <EmptyNote text="Nessuna comorbidità, fragilità o terapia domiciliare documentata." />
              )}
            </div>
          </SubSection>

          {/* §3 Timeline diagnostica */}
          <SubSection number="3" title="Timeline diagnostica" icon={Calendar}>
            {timelineEvents.length === 0 ? (
              <EmptyNote text="Nessun evento documentato nel percorso diagnostico." />
            ) : (
              <div className="relative space-y-0">
                {timelineEvents.map((ev, i) => {
                  const isFirst    = ev.type === "prima_visita";
                  const isDiagnosis = ev.type === "diagnosis";
                  const dotColor   = isDiagnosis ? "bg-emerald-500" : isFirst ? "bg-indigo-500" : "bg-amber-400";
                  const lineColor  = isDiagnosis ? "border-emerald-300" : isFirst ? "border-indigo-300" : "border-amber-200";
                  const badgeCls   = isDiagnosis
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : isFirst
                    ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                    : "bg-amber-100 text-amber-800 border-amber-200";
                  return (
                    <div
                      key={i}
                      className={`relative pl-5 pb-4 last:pb-0 ${i < timelineEvents.length - 1 ? `border-l-2 ${lineColor}` : ""}`}
                    >
                      <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${dotColor}`} />
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="text-[11px] font-black text-gray-600 leading-tight mt-0.5">{fmtDate(ev.date)}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeCls} leading-tight`}>
                          {ev.label}
                        </span>
                      </div>
                      {ev.hypothesis && (
                        <p className="text-xs text-gray-700 mt-1 leading-snug">{ev.hypothesis}</p>
                      )}
                      {ev.certainty && (
                        <p className="text-[11px] text-gray-400 mt-0.5">Certezza: {ev.certainty}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SubSection>

          {/* §4 Esami / imaging */}
          <SubSection number="4" title="Esami / imaging rilevanti durante il workup" icon={FlaskConical}>
            {labsEntries.length === 0 ? (
              <EmptyNote text="Nessun esame o imaging documentato durante il workup." />
            ) : (
              <div className="space-y-2">
                {labsEntries.map((entry, i) => (
                  <EntryCard key={i} date={entry.date} label={entry.label}>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                  </EntryCard>
                ))}
              </div>
            )}
          </SubSection>

          {/* §5 Terapie / indicazioni */}
          <SubSection number="5" title="Terapie / indicazioni durante il workup" icon={Pill}>
            {therapyEntries.length === 0 ? (
              <EmptyNote text="Nessuna modifica terapeutica o indicazione documentata durante il workup." />
            ) : (
              <div className="space-y-2">
                {therapyEntries.map((entry, i) => (
                  <EntryCard key={i} date={entry.date} label={entry.label}>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                  </EntryCard>
                ))}
              </div>
            )}
          </SubSection>

          {/* §6 Diagnosi finale e razionale (editable) */}
          <SubSection number="6" title="Diagnosi finale e razionale" icon={CheckCircle2}>
            <div className="space-y-3">
              {patient?.diagnosi && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {patient.diagnosi}
                </div>
              )}

              {/* Editable rationale */}
              {editing ? (
                <div className="space-y-2">
                  <Textarea
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="text-xs min-h-[110px] resize-y bg-white border-gray-300 focus-visible:ring-[#0A2540]/30"
                    placeholder="Descrivi il razionale diagnostico: iter clinico, criteri soddisfatti, diagnosi differenziale esclusa, risposta alla terapia iniziale…"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={saveRationale}
                      disabled={saving}
                      className="bg-[#0A2540] hover:bg-[#051626] text-white"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      {saving ? "Salvataggio…" : "Salva"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                      Annulla
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-md bg-white border border-gray-200 hover:border-amber-300 px-3 py-2.5 cursor-pointer group transition-colors min-h-[48px]"
                  onClick={() => setEditing(true)}
                >
                  {rationale ? (
                    <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{rationale}</p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      Clicca per aggiungere il razionale diagnostico — iter clinico, criteri soddisfatti, diagnosi differenziale esclusa…
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit2 className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] text-gray-400">{rationale ? "Modifica" : "Aggiungi razionale"}</span>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-gray-400">
                Il razionale è editabile liberamente e viene salvato nel dossier del paziente. Non viene generato automaticamente.
              </p>
            </div>
          </SubSection>

        </div>
      )}
    </Card>
  );
}
