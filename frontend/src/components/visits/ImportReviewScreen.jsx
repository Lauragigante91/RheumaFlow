import React, { useState } from "react";
import {
  Check, Loader2, X, AlertTriangle, Calendar,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowRight,
  Plus, Pencil, Trash2, Clock, RotateCcw,
} from "lucide-react";
import { Button } from "../ui/button";
import VisitFacsimile from "./VisitFacsimile";
import { STATUS_META, LONGIT_STATUS, LONGIT_STATUS_META } from "../../lib/visitReconciler";

function fmtIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function fmtEventDate(v) {
  if (!v) return null;
  const parts = (v || "").split("-");
  if (parts.length === 3) return fmtIso(v);
  if (parts.length === 2) return `${parts[1].padStart(2,"0")}/${parts[0]}`;
  return parts[0];
}

function VisitSidebarItem({ item, active, confirmed, onClick }) {
  const conflicts = item.stats?.conflicts || 0;
  const date = item.date || item.draft?.visit_date;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex flex-col gap-0.5 ${
        active
          ? "border-[#0A2540] bg-[#0A2540] text-white"
          : confirmed
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold">
        {confirmed && <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
        <Calendar className={`w-3 h-3 flex-shrink-0 ${active ? "text-teal-300" : confirmed ? "text-emerald-500" : "text-gray-400"}`} />
        {date ? fmtIso(date) : <span className="italic">data assente</span>}
      </span>
      <span className={`text-[10px] ${active ? "text-gray-300" : "text-gray-400"}`}>
        {item.visitType === "prima_visita" ? "Prima visita" : item.visitType === "workup" ? "Workup" : item.visitType === "teleconsulto" ? "Teleconsulto" : "Follow-up"}
        {item.stats?.toSave != null && <span> · {item.stats.toSave} elem.</span>}
      </span>
      {conflicts > 0 && (
        <span className="flex items-center gap-1 text-[9px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded px-1 py-0.5 w-fit">
          <AlertTriangle className="w-2.5 h-2.5" /> {conflicts} conflitto{conflicts > 1 ? "i" : ""}
        </span>
      )}
      {confirmed && (
        <span className="text-[9px] font-medium text-emerald-700">Importata</span>
      )}
    </button>
  );
}

function ItemStatusLegend({ visitResults }) {
  const counts = {};
  for (const v of visitResults) {
    const d = v.draft;
    for (const item of [...(d.therapies || []), ...(d.assessments || []), ...(d.lab_exams || [])]) {
      if (item._status) counts[item._status] = (counts[item._status] || 0) + 1;
    }
  }
  const active = Object.entries(counts).filter(([, n]) => n > 0);
  if (active.length === 0) return null;
  const colorMap = {
    teal:   "bg-teal-50 text-teal-700 border-teal-200",
    gray:   "bg-gray-100 text-gray-500 border-gray-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
      {active.map(([status, n]) => {
        const meta = STATUS_META[status];
        if (!meta) return null;
        const cls = colorMap[meta.color] || "bg-gray-100 text-gray-500 border-gray-200";
        return (
          <span key={status} className="flex items-center gap-1">
            <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.dot, display: "inline-block", flexShrink: 0 }} />
              {meta.label}
            </span>
            <span className="text-[10px] text-gray-500">×{n}</span>
          </span>
        );
      })}
    </div>
  );
}

function hasWarning(item) {
  if ((item.stats?.conflicts || 0) > 0) return true;
  if ((item.draft?.lab_review_items?.length || 0) > 0) return true;
  if ((item.draft?._parse_review?.unresolved?.length || 0) > 0) return true;
  return false;
}

const FIELD_LABEL_IT = {
  diagnosi:            "Diagnosi",
  anamnesi_fisiologica:"Anamnesi fisiologica",
  anamnesi_familiare:  "Anamnesi familiare",
  comorbidita_apr:     "Comorbidità",
  allergie_testo:      "Allergie / Intolleranze",
  terapia_domiciliare: "Terapia domiciliare",
};

const LONGIT_COLOR = {
  gray:  { bg: "bg-gray-50",   border: "border-gray-200",  text: "text-gray-600",  badge: "bg-gray-100 text-gray-500 border-gray-200"  },
  teal:  { bg: "bg-teal-50",   border: "border-teal-200",  text: "text-teal-700",  badge: "bg-teal-50 text-teal-700 border-teal-200"   },
  red:   { bg: "bg-red-50",    border: "border-red-200",   text: "text-red-700",   badge: "bg-red-50 text-red-700 border-red-200"       },
  amber: { bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-50 text-amber-700 border-amber-200" },
};

function sentenceSplit(text) {
  if (!text) return [];
  return text.replace(/([.;])\s+/g, "$1\n").split(/\n+/).map(s => s.trim()).filter(Boolean);
}

function buildDiff(prev, curr) {
  const a = sentenceSplit(prev || "");
  const b = sentenceSplit(curr || "");
  if (!a.length && !b.length) return [];
  if (!a.length) return b.map(s => ({ t: "a", s }));
  if (!b.length) return a.map(s => ({ t: "r", s }));
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
  const segs = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) { segs.unshift({ t: "s", s: a[i-1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { segs.unshift({ t: "a", s: b[j-1] }); j--; }
    else { segs.unshift({ t: "r", s: a[i-1] }); i--; }
  }
  return segs;
}

function DiffView({ previous, current, status }) {
  if (status === LONGIT_STATUS.NUOVO_DATO || !previous) {
    return (
      <p className="text-[11px] leading-relaxed font-sans whitespace-pre-wrap break-words bg-emerald-50 rounded px-2 py-1 text-emerald-800">
        {current || "—"}
      </p>
    );
  }
  if (!current) {
    return (
      <p className="text-[11px] leading-relaxed font-sans bg-red-50 rounded px-2 py-1 text-red-700 line-through">
        {previous}
      </p>
    );
  }
  const segs = buildDiff(previous, current);
  return (
    <p className="text-[11px] leading-relaxed font-sans break-words whitespace-pre-wrap">
      {segs.map((seg, idx) => {
        if (seg.t === "s") return <span key={idx}>{seg.s}{" "}</span>;
        if (seg.t === "a") return <span key={idx} className="bg-emerald-100 text-emerald-800 rounded px-0.5">{seg.s}{" "}</span>;
        if (seg.t === "r") return <span key={idx} className="bg-red-100 text-red-700 line-through rounded px-0.5">{seg.s}{" "}</span>;
        return null;
      })}
    </p>
  );
}

function BatchFieldConflictsPanel({ conflicts, overrides, onFieldOverride }) {
  const [open, setOpen] = useState(true);
  if (!conflicts || conflicts.length === 0) return null;
  return (
    <div className="px-4 py-2 border-b border-amber-200 bg-amber-50 flex-shrink-0">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setOpen(v => !v)}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        <span className="text-xs font-semibold text-amber-800">
          {conflicts.length} campo{conflicts.length !== 1 ? " in conflitto" : " in conflitto"} tra le visite — scegli quale valore salvare
        </span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-amber-500 ml-auto" />
          : <ChevronDown className="w-3.5 h-3.5 text-amber-500 ml-auto" />}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {conflicts.map((c) => {
            const activeVal = overrides?.[c.field] !== undefined ? overrides[c.field] : c.selected.value;
            const allOptions = [c.selected, ...c.conflicts];
            return (
              <div key={c.field} className="rounded-lg border border-amber-200 bg-white p-2.5 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  {FIELD_LABEL_IT[c.field] || c.field}
                </span>
                <div className={`grid gap-2 ${allOptions.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {allOptions.map((opt, oi) => {
                    const isActive = activeVal === opt.value;
                    return (
                      <div
                        key={oi}
                        role="button"
                        tabIndex={0}
                        onClick={() => onFieldOverride(c.field, opt.value)}
                        onKeyDown={(e) => e.key === "Enter" && onFieldOverride(c.field, opt.value)}
                        className={`rounded p-2 text-xs cursor-pointer border transition-all ${
                          isActive
                            ? "border-teal-400 bg-teal-50 ring-1 ring-teal-400"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="text-[9px] font-semibold text-gray-400 mb-1 flex items-center gap-1">
                          {oi === 0 ? "Proposta dal sistema" : "Alternativa"}
                          {opt.source_visit_date && <span className="text-gray-300">· {opt.source_visit_date}</span>}
                          {isActive && <span className="text-teal-600 ml-1">selezionata</span>}
                        </div>
                        <pre className="whitespace-pre-wrap font-sans text-gray-700 text-[11px] leading-relaxed">{opt.value}</pre>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const EVENT_TYPE_LABELS = {
  disease_onset:       "Esordio malattia",
  diagnosis:           "Diagnosi",
  disease_status:      "Stato di malattia",
  remission:           "Remissione",
  flare:               "Riacutizzazione",
  therapy_start:       "Inizio terapia",
  therapy_stop:        "Sospensione",
  therapy_change:      "Modifica terapia",
  historical_exposure: "Esposizione pregressa",
  pre_existing:        "Terapia preesist.",
  hospitalization:     "Ricovero",
  manifestation:       "Manifestazione",
  complication:        "Complicanza",
  procedure:           "Procedura",
};

const EVENT_TYPE_OPTIONS = [
  "disease_onset","diagnosis","disease_status","remission","flare",
  "therapy_start","therapy_stop","therapy_change","historical_exposure",
  "hospitalization","manifestation","complication","procedure",
];

function EventEditForm({ event, onSave, onCancel }) {
  const [form, setForm] = useState({
    event_type: event.event_type || "disease_onset",
    date_value: event.date_value || "",
    drug_name:  event.drug_name || event.drug_canonical || "",
    notes:      event.notes || "",
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="p-1.5 bg-blue-50 rounded border border-blue-200 mb-1 space-y-1">
      <select value={form.event_type} onChange={set("event_type")}
        className="w-full text-[9px] border border-gray-300 rounded px-1 py-0.5 bg-white">
        {EVENT_TYPE_OPTIONS.map(t => (
          <option key={t} value={t}>{EVENT_TYPE_LABELS[t] || t}</option>
        ))}
      </select>
      <input type="text" placeholder="Data (es. 2023-06)" value={form.date_value}
        onChange={set("date_value")}
        className="w-full text-[9px] border border-gray-300 rounded px-1 py-0.5" />
      <input type="text" placeholder="Farmaco (opzionale)" value={form.drug_name}
        onChange={set("drug_name")}
        className="w-full text-[9px] border border-gray-300 rounded px-1 py-0.5" />
      <textarea placeholder="Note" value={form.notes} onChange={set("notes")} rows={2}
        className="w-full text-[9px] border border-gray-300 rounded px-1 py-0.5 resize-none" />
      <div className="flex gap-1">
        <button type="button" onClick={() => onSave(form)}
          className="flex-1 text-[9px] bg-blue-500 text-white rounded py-0.5 hover:bg-blue-600 font-medium">
          Salva
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 text-[9px] bg-white border border-gray-300 text-gray-600 rounded py-0.5 hover:bg-gray-50">
          Annulla
        </button>
      </div>
    </div>
  );
}

function ProposedEventRow({ event, onEdit, onRemove }) {
  const label = EVENT_TYPE_LABELS[event.event_type] || event.event_type;
  const date  = fmtEventDate(event.date_value);
  const drug  = event.drug_name || event.drug_canonical;
  return (
    <div className="group py-1 border-l-2 border-emerald-300 pl-1.5 mb-0.5">
      <div className="text-[10px] font-semibold text-emerald-800 leading-snug">{label}</div>
      {drug && <div className="text-[9px] text-gray-600 leading-tight truncate">{drug}</div>}
      {date && <div className="text-[9px] text-gray-400">{date}</div>}
      {event.notes && (
        <div className="text-[9px] text-gray-500 leading-snug line-clamp-2">{event.notes}</div>
      )}
      <div className="flex gap-2 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={onEdit}
          className="text-[9px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5">
          <Pencil className="w-2.5 h-2.5" />modifica
        </button>
        <button type="button" onClick={onRemove}
          className="text-[9px] text-red-400 hover:text-red-600 font-medium flex items-center gap-0.5">
          <Trash2 className="w-2.5 h-2.5" />rimuovi
        </button>
      </div>
    </div>
  );
}

function StoricoEventRow({ event }) {
  const label = EVENT_TYPE_LABELS[event.event_type] || event.event_type;
  const date  = fmtEventDate(event.date_value);
  const drug  = event.drug_name || event.drug_canonical;
  return (
    <div className="py-1 border-l-2 border-gray-200 pl-1.5 mb-0.5 opacity-55">
      <div className="text-[10px] font-medium text-gray-500 leading-snug">{label}</div>
      {drug && <div className="text-[9px] text-gray-400 leading-tight truncate">{drug}</div>}
      {date && <div className="text-[9px] text-gray-400">{date}</div>}
    </div>
  );
}

function ClinicalTimelineColumn({ current, onUpdateDraft }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [addingNew,  setAddingNew]  = useState(false);

  const raccordoEvents = current.draft?.raccordo_events || [];
  const indexed   = raccordoEvents.map((e, i) => ({ ...e, _idx: i }));
  const storici   = indexed.filter(e => e._status === "duplicate");
  const proposti  = indexed.filter(e => !e._skip && e._status !== "duplicate");
  const rimossi   = indexed.filter(e => e._skip  && e._status !== "duplicate");

  const newTherapies  = (current.draft?.therapies   || []).filter(t => !t._skip && t._status !== "duplicate").length;
  const newComorbidita= (current.draft?.comorbidita  || []).filter(c => !c._skip).length;
  const newAssessments= (current.draft?.assessments  || []).filter(a => !a._skip && a._status !== "duplicate").length;

  const handleRemove  = (idx) => {
    const updated = raccordoEvents.map((e, i) => i === idx ? { ...e, _skip: true }  : e);
    onUpdateDraft({ ...current.draft, raccordo_events: updated });
  };
  const handleRestore = (idx) => {
    const updated = raccordoEvents.map((e, i) => i === idx ? { ...e, _skip: false } : e);
    onUpdateDraft({ ...current.draft, raccordo_events: updated });
  };
  const handleEditSave = (idx, form) => {
    const updated = raccordoEvents.map((e, i) => i === idx ? { ...e, ...form } : e);
    onUpdateDraft({ ...current.draft, raccordo_events: updated });
    setEditingIdx(null);
  };
  const handleAddNew = (form) => {
    const ev = {
      event_type:  form.event_type,
      date_value:  form.date_value  || null,
      drug_name:   form.drug_name   || null,
      notes:       form.notes       || null,
      inferred_by: "manual",
      _status:     "new",
      _skip:       false,
    };
    onUpdateDraft({ ...current.draft, raccordo_events: [...raccordoEvents, ev] });
    setAddingNew(false);
  };

  const summaryBadges = [
    newTherapies   > 0 && `${newTherapies} terapia/e`,
    newComorbidita > 0 && `${newComorbidita} comorbidità`,
    newAssessments > 0 && `${newAssessments} score`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      <div className="px-2 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Timeline clinica</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-2 pt-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 mb-1">
            Da questa visita
          </div>

          {summaryBadges.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {summaryBadges.map(b => (
                <span key={b} className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1 py-0.5 font-medium">
                  {b}
                </span>
              ))}
            </div>
          )}

          {proposti.length === 0 && summaryBadges.length === 0 && (
            <div className="text-[9px] text-gray-400 italic py-1">Nessun evento estratto</div>
          )}

          {proposti.map(ev => (
            editingIdx === ev._idx
              ? <EventEditForm
                  key={ev._idx}
                  event={ev}
                  onSave={(form) => handleEditSave(ev._idx, form)}
                  onCancel={() => setEditingIdx(null)}
                />
              : <ProposedEventRow
                  key={ev._idx}
                  event={ev}
                  onEdit={() => setEditingIdx(ev._idx)}
                  onRemove={() => handleRemove(ev._idx)}
                />
          ))}

          {rimossi.length > 0 && (
            <div className="mt-1 pt-1 border-t border-dashed border-gray-200">
              <div className="text-[9px] text-gray-400 mb-0.5">Rimossi ({rimossi.length})</div>
              {rimossi.map(ev => (
                <div key={ev._idx} className="flex items-center justify-between py-0.5 opacity-40">
                  <span className="text-[9px] line-through text-gray-400 truncate">
                    {EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}
                  </span>
                  <button type="button" onClick={() => handleRestore(ev._idx)}
                    className="flex-shrink-0 ml-1 text-[9px] text-blue-400 hover:text-blue-600 flex items-center gap-0.5">
                    <RotateCcw className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mx-2 my-2 border-t border-dashed border-gray-300" />

        <div className="px-2 pb-16">
          <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Storico
          </div>
          {storici.length === 0 && (
            <div className="text-[9px] text-gray-300 italic py-1">
              Nessun evento in archivio trovato in questa lettera
            </div>
          )}
          {storici.map(ev => (
            <StoricoEventRow key={ev._idx} event={ev} />
          ))}
        </div>
      </div>

      <div className="px-2 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        {addingNew ? (
          <EventEditForm
            event={{ event_type: "disease_onset" }}
            onSave={handleAddNew}
            onCancel={() => setAddingNew(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingNew(true)}
            className="w-full flex items-center justify-center gap-1 text-[9px] text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded py-1.5 hover:border-gray-400 transition-colors bg-white"
          >
            <Plus className="w-3 h-3" /> evento manuale
          </button>
        )}
      </div>
    </div>
  );
}

export default function ImportReviewScreen({
  visitResults,
  onUpdate,
  onConfirmOne,
  onConfirmAll,
  onCancel,
  applying,
  applyProgress,
  batchFieldConflicts,
  fieldOverrides,
  onFieldOverride,
  onLongitudinalToggle,
}) {
  const isMulti = visitResults.length > 1;
  const [currentIdx,    setCurrentIdx]    = useState(0);
  const [confirmingIdx, setConfirmingIdx] = useState(null);
  const [timelineOpen,  setTimelineOpen]  = useState(false);

  const sortedOrder = [...visitResults]
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const da = a.v.date || a.v.draft?.visit_date || "";
      const db = b.v.date || b.v.draft?.visit_date || "";
      return da.localeCompare(db);
    })
    .map(({ i }) => i);

  const current = visitResults[currentIdx];
  if (!current) return null;

  const allConfirmed   = visitResults.every(v => !!v._confirmed);
  const confirmedCount = visitResults.filter(v => !!v._confirmed).length;
  const pendingCount   = visitResults.length - confirmedCount;
  const warnFreeCount  = visitResults.filter(v => !v._confirmed && !hasWarning(v)).length;

  const handleConfirmOne = async (idx) => {
    setConfirmingIdx(idx);
    try {
      await onConfirmOne(idx);
      const nextPending = visitResults.findIndex((v, i) => i !== idx && !v._confirmed && i > idx);
      if (nextPending !== -1) setCurrentIdx(nextPending);
      else {
        const anyPending = visitResults.findIndex((v, i) => !v._confirmed && i !== idx);
        if (anyPending !== -1) setCurrentIdx(anyPending);
      }
    } finally {
      setConfirmingIdx(null);
    }
  };

  const handleConfirmAll = async () => {
    try { await onConfirmAll(); } catch (_) {}
  };

  const updateCurrentDraft = (draft) => {
    const updated = [...visitResults];
    updated[currentIdx] = { ...updated[currentIdx], draft };
    onUpdate(updated);
  };

  const isConfirmingCurrent = confirmingIdx === currentIdx;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors px-2 py-1 rounded hover:bg-gray-100">
            <X className="w-3.5 h-3.5" /> Annulla
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <h2 className="text-sm font-bold text-[#0A2540]">
            {isMulti
              ? `Revisione import — ${visitResults.length} visite`
              : "Revisione import"}
          </h2>
          {isMulti && (
            <span className="text-xs text-gray-400">
              {confirmedCount > 0 && `${confirmedCount} importate · `}{pendingCount} da confermare
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTimelineOpen(v => !v)}
            className={`xl:hidden flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded border ${
              timelineOpen
                ? "border-[#0A2540] bg-[#0A2540] text-white"
                : "border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Timeline
          </button>
          {isMulti ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfirmOne(currentIdx)}
                disabled={applying || isConfirmingCurrent || !!current._confirmed}
                className="text-xs"
              >
                {isConfirmingCurrent
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Importazione...</>
                  : current._confirmed
                  ? <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Importata</>
                  : <><Check className="w-3.5 h-3.5 mr-1.5" /> Conferma visita</>}
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmAll}
                disabled={applying || allConfirmed || warnFreeCount === 0}
                className="bg-[#0A2540] hover:bg-[#051626] text-white text-xs"
              >
                {applying
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {applyProgress ? `${applyProgress.current}/${applyProgress.total}` : "Importazione..."}
                    </>
                  : <><Check className="w-3.5 h-3.5 mr-1.5" /> Conferma tutte senza warning ({warnFreeCount})</>}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => handleConfirmOne(0)}
              disabled={applying || isConfirmingCurrent || !!visitResults[0]?._confirmed}
              className="bg-[#0A2540] hover:bg-[#051626] text-white text-xs"
            >
              {isConfirmingCurrent
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvataggio...</>
                : visitResults[0]?._confirmed
                ? <><Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Importata</>
                : <><Check className="w-3.5 h-3.5 mr-1.5" /> Conferma importazione</>}
            </Button>
          )}
        </div>
      </div>

      {isMulti && visitResults.length > 1 && (
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <ItemStatusLegend visitResults={visitResults} />
        </div>
      )}

      {isMulti && (
        <BatchFieldConflictsPanel
          conflicts={batchFieldConflicts}
          overrides={fieldOverrides}
          onFieldOverride={onFieldOverride}
        />
      )}

      <div className="flex flex-1 min-h-0 relative">
        {isMulti && (
          <div className="w-52 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
            <div className="px-3 py-2 border-b border-gray-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Visite</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {[...visitResults]
                .map((v, i) => ({ v, i }))
                .sort((a, b) => {
                  const da = a.v.date || a.v.draft?.visit_date || "";
                  const db = b.v.date || b.v.draft?.visit_date || "";
                  return da.localeCompare(db);
                })
                .map(({ v, i }) => (
                  <VisitSidebarItem
                    key={v.id ?? i}
                    item={v}
                    active={i === currentIdx}
                    confirmed={!!v._confirmed}
                    onClick={() => setCurrentIdx(i)}
                  />
                ))}
            </div>
            <div className="px-2 py-2 border-t border-gray-200 flex gap-1">
              <button type="button"
                onClick={() => {
                  const pos = sortedOrder.indexOf(currentIdx);
                  if (pos > 0) setCurrentIdx(sortedOrder[pos - 1]);
                }}
                disabled={sortedOrder.indexOf(currentIdx) === 0}
                className="flex-1 flex items-center justify-center py-1 rounded border border-gray-200 bg-white text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button type="button"
                onClick={() => {
                  const pos = sortedOrder.indexOf(currentIdx);
                  if (pos < sortedOrder.length - 1) setCurrentIdx(sortedOrder[pos + 1]);
                }}
                disabled={sortedOrder.indexOf(currentIdx) === sortedOrder.length - 1}
                className="flex-1 flex items-center justify-center py-1 rounded border border-gray-200 bg-white text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-1 min-h-0 min-w-0">
          <div className="flex-1 min-w-0 overflow-y-auto border-r border-gray-200 bg-gray-50">
            <div className="px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0 sticky top-0 z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Testo originale</span>
            </div>
            <div className="px-4 py-4">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono break-words">
                {current.sourceText || "(testo non disponibile)"}
              </pre>
            </div>
          </div>

          <div className="flex-1 min-w-0 overflow-y-auto bg-white flex flex-col border-r border-gray-200">
            <div className="px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0 sticky top-0 z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Dati strutturati</span>
            </div>
            <div className="px-4 py-4">
              <VisitFacsimile
                key={currentIdx}
                draft={current.draft}
                onUpdate={updateCurrentDraft}
                longitudinal={current.draft?._longitudinal}
                onLongitudinalToggle={(fieldKey, skip) => onLongitudinalToggle?.(currentIdx, fieldKey, skip)}
              />
            </div>
          </div>
        </div>

        <div className="hidden xl:flex flex-col w-36 flex-shrink-0 border-l border-gray-200 min-h-0">
          <ClinicalTimelineColumn
            current={current}
            onUpdateDraft={updateCurrentDraft}
          />
        </div>

        {timelineOpen && (
          <div className="xl:hidden absolute right-0 top-0 bottom-0 w-64 bg-white shadow-2xl border-l border-gray-200 z-20 flex flex-col">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 bg-gray-50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Timeline</span>
              <button type="button" onClick={() => setTimelineOpen(false)}
                className="text-gray-400 hover:text-gray-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <ClinicalTimelineColumn
                current={current}
                onUpdateDraft={updateCurrentDraft}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
