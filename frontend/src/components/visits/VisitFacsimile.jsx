import React, { useState, useMemo } from "react";
import { Trash2, RotateCcw, Plus, Pencil, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import LabValueReviewPanel from "./LabValueReviewPanel";
import { LAB_REVIEW_TRUSTED_UNITS } from "../../lib/labValueExtractor";
import { parseJointExam } from "../../lib/jointExamParser";
import Homunculus from "../imaging/Homunculus";

function fmtIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const VISIT_TYPE_OPTIONS = [
  { value: "follow_up",    label: "Follow-up" },
  { value: "workup",       label: "Workup / valutazione" },
  { value: "prima_visita", label: "Prima visita" },
  { value: "teleconsulto", label: "Teleconsulto" },
];

function TherapyItemRow({ therapy, onChange, onSkip, conflicts }) {
  const [editing, setEditing] = useState(false);
  const hasConflict = conflicts && conflicts.some(
    c => (c.drug_name || "").toLowerCase() === (therapy.drug_name || "").toLowerCase()
  );

  if (therapy._skip) {
    return (
      <li className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-red-100 bg-red-50/60">
        <span className="line-through text-[11px] text-gray-400 flex-1 truncate">{therapy.drug_name}</span>
        <button type="button" onClick={() => onChange({ ...therapy, _skip: false })}
          className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 flex-shrink-0">
          <RotateCcw className="w-2.5 h-2.5" /> Ripristina
        </button>
      </li>
    );
  }

  return (
    <li className={`rounded border px-2.5 py-2 ${hasConflict ? "border-amber-300 bg-amber-50/50" : "border-gray-100 bg-white"}`}>
      {hasConflict && (
        <div className="flex items-center gap-1 mb-1.5 text-[10px] text-amber-700">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          {conflicts.find(c => (c.drug_name || "").toLowerCase() === (therapy.drug_name || "").toLowerCase())?.reason || "Conflitto rilevato"}
        </div>
      )}
      {editing ? (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input autoFocus
              className="flex-1 text-xs border border-teal-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400"
              value={therapy.drug_name}
              onChange={e => onChange({ ...therapy, drug_name: e.target.value })}
              placeholder="Nome farmaco" />
            <input
              className="w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
              value={therapy.dose || ""}
              onChange={e => onChange({ ...therapy, dose: e.target.value || null })}
              placeholder="Dose" />
          </div>
          <div className="flex gap-1.5 items-center">
            <input
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
              value={therapy.frequency || ""}
              onChange={e => onChange({ ...therapy, frequency: e.target.value || null })}
              placeholder="Frequenza" />
            <select
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none"
              value={therapy.status}
              onChange={e => onChange({ ...therapy, status: e.target.value })}>
              <option value="active">Terapia attiva</option>
              <option value="discontinued">Pregressa / sospesa</option>
            </select>
            <button type="button" onClick={() => setEditing(false)}
              className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 px-2 py-1 rounded bg-teal-50 border border-teal-200 flex-shrink-0">
              Fatto
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-teal-700 text-[11px]">{therapy.drug_name}</span>
              {therapy.dose && <span className="text-gray-600 text-[11px]">{therapy.dose}</span>}
              {therapy.frequency && <span className="text-gray-400 text-[10px]">· {therapy.frequency}</span>}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                therapy.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
              }`}>
                {therapy.status === "active" ? "attiva" : "pregressa"}
              </span>
              {therapy._status && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                  {therapy._status}
                </span>
              )}
            </div>
            {therapy.source_fragment && (
              <div className="text-[10px] text-gray-400 italic mt-0.5 truncate">«{therapy.source_fragment}»</div>
            )}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
            <button type="button" onClick={() => setEditing(true)} title="Modifica"
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-[#0A2540] transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
            <button type="button" onClick={onSkip} title="Escludi"
              className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function TherapyEditor({ therapies, onChange, conflicts }) {
  return (
    <ul className="space-y-1.5">
      {therapies.map((t, i) => (
        <TherapyItemRow
          key={t._id ?? i}
          therapy={t}
          conflicts={conflicts}
          onChange={updated => onChange(therapies.map((x, j) => j === i ? updated : x))}
          onSkip={() => onChange(therapies.map((x, j) => j === i ? { ...x, _skip: true } : x))}
        />
      ))}
    </ul>
  );
}

const VS_LABELS = {
  raccordo:    "Raccordo anamnestico",
  anamnesi:    "Anamnesi intervallare",
  esame_obj:   "Esame obiettivo",
  conclusioni: "Conclusioni",
  indicazioni: "Indicazioni",
  labs_text:   "Esami / Imaging (testo)",
};

function VisitSectionsEditor({ sections, onChange }) {
  return (
    <div className="space-y-3">
      {Object.entries(VS_LABELS).map(([k, label]) => {
        const isLabsText = k === "labs_text";
        if (!isLabsText && !sections[k] && sections[k] !== "") return null;
        return (
          <div key={k}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#0A2540] mb-1">{label}</div>
            <textarea
              className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 min-h-[58px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-teal-400 resize-y bg-white"
              value={sections[k] || ""}
              placeholder={isLabsText ? "Esami portati in visione" : undefined}
              onChange={e => onChange({ ...sections, [k]: e.target.value })}
            />
          </div>
        );
      })}
    </div>
  );
}

function DeletableList({ items, getLabel, onChange }) {
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={item._id ?? i}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-[11px] ${
            item._skip ? "border-red-100 bg-red-50/60 opacity-60" : "border-gray-100 bg-white"
          }`}>
          <span className={`flex-1 ${item._skip ? "line-through text-gray-400" : "text-gray-700"}`}>
            {getLabel(item)}
          </span>
          {item._skip ? (
            <button type="button" onClick={() => onChange(items.map((x, j) => j === i ? { ...x, _skip: false } : x))}
              className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 flex-shrink-0">
              <RotateCcw className="w-2.5 h-2.5" /> Ripristina
            </button>
          ) : (
            <button type="button" onClick={() => onChange(items.map((x, j) => j === i ? { ...x, _skip: true } : x))}
              title="Escludi" className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors flex-shrink-0">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function LabExamExpander({ exams, onChange }) {
  const [expanded, setExpanded] = useState({});
  if (!exams || exams.length === 0) return <p className="text-xs text-gray-400 italic">Nessun esame rilevato</p>;
  return (
    <div className="space-y-2">
      {exams.map((exam, i) => {
        const isOpen = !!expanded[i];
        const results = exam.results || [];
        const activeResults = results.filter(r => !r._skip);
        const category = exam.category || exam.panel || "Lab";
        const date = exam.date ? fmtIso(exam.date) : null;
        const toggleResult = (ri, skip) => {
          const updated = [...exams];
          updated[i] = { ...exam, results: results.map((r, j) => j === ri ? { ...r, _skip: skip } : r) };
          updated[i]._skip = updated[i].results.every(r => r._skip);
          onChange(updated);
        };
        return (
          <div key={exam._id ?? i} className={`rounded border text-[11px] ${exam._skip ? "border-red-100 bg-red-50/60 opacity-60" : "border-gray-100 bg-white"}`}>
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <button type="button"
                className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                onClick={() => setExpanded(prev => ({ ...prev, [i]: !isOpen }))}>
                <span className={`transition-transform text-gray-400 text-[10px] ${isOpen ? "rotate-90" : ""}`}>▶</span>
                <span className={`font-semibold ${exam._skip ? "line-through text-gray-400" : "text-[#0A2540]"}`}>{category}</span>
                {date && <span className="text-gray-400">· {date}</span>}
                <span className="ml-auto text-gray-400 font-normal">{activeResults.length}/{results.length} valori</span>
              </button>
              {exam._skip ? (
                <button type="button" onClick={() => onChange(exams.map((x, j) => j === i ? { ...x, _skip: false, results: (x.results||[]).map(r=>({...r,_skip:false})) } : x))}
                  className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 flex-shrink-0">
                  <RotateCcw className="w-2.5 h-2.5" /> Ripristina
                </button>
              ) : (
                <button type="button" onClick={() => onChange(exams.map((x, j) => j === i ? { ...x, _skip: true } : x))}
                  title="Escludi pannello" className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors flex-shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            {isOpen && (
              <ul className="border-t border-gray-100 divide-y divide-gray-50">
                {results.map((r, ri) => (
                  <li key={ri} className={`flex items-center gap-2 px-3 py-1 ${r._skip ? "opacity-50" : ""}`}>
                    <span className={`flex-1 min-w-0 ${r._skip ? "line-through text-gray-400" : "text-gray-700"}`}>
                      <span className="font-medium">{r.name}</span>
                      {r.value != null && <span className="text-gray-500"> {r.value}{r.unit ? ` ${r.unit}` : ""}</span>}
                      {r.qualitative && <span className="text-gray-400"> ({r.qualitative})</span>}
                    </span>
                    {r._skip ? (
                      <button type="button" onClick={() => toggleResult(ri, false)}
                        className="text-[10px] text-blue-500 hover:underline flex-shrink-0"><RotateCcw className="w-2.5 h-2.5" /></button>
                    ) : (
                      <button type="button" onClick={() => toggleResult(ri, true)}
                        className="p-0.5 text-gray-400 hover:text-red-500 rounded flex-shrink-0"><Trash2 className="w-2.5 h-2.5" /></button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

const RACCORDO_EVENT_CONFIG = {
  disease_onset:       { label: "Esordio malattia",   cls: "bg-blue-100 text-blue-800 border-blue-200" },
  manifestation_onset: { label: "Manifestazione",      cls: "bg-purple-100 text-purple-800 border-purple-200" },
  therapy_start:       { label: "Inizio terapia",      cls: "bg-green-100 text-green-800 border-green-200" },
  therapy_stop:        { label: "Sospensione",         cls: "bg-red-100 text-red-800 border-red-200" },
  therapy_switch:      { label: "Switch terapia",      cls: "bg-orange-100 text-orange-800 border-orange-200" },
  dose_spacing:        { label: "Spacing",             cls: "bg-teal-100 text-teal-800 border-teal-200" },
  remission:           { label: "Remissione",          cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  flare:               { label: "Riacutizzazione",     cls: "bg-amber-100 text-amber-800 border-amber-200" },
};

const CONFIDENCE_CONFIG = {
  high:   { label: "alta",  cls: "bg-green-50 text-green-700 border-green-200" },
  medium: { label: "media", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  low:    { label: "bassa", cls: "bg-red-50 text-red-700 border-red-200" },
};

function fmtRaccordoDate(ev) {
  if (!ev.date_value) return "data sconosciuta";
  const d = new Date(ev.date_value + "T00:00:00Z");
  if (ev.date_precision === "year") return String(d.getUTCFullYear());
  if (ev.date_precision === "month_year") return d.toLocaleDateString("it-IT", { month: "short", year: "numeric", timeZone: "UTC" });
  return d.toLocaleDateString("it-IT", { timeZone: "UTC" });
}

const EVENT_TYPES_OPTIONS = [
  { value: "disease_onset",       label: "Esordio malattia" },
  { value: "manifestation_onset", label: "Esordio manifestazione" },
  { value: "therapy_start",       label: "Inizio terapia" },
  { value: "therapy_stop",        label: "Sospensione terapia" },
  { value: "therapy_switch",      label: "Switch terapia" },
  { value: "dose_spacing",        label: "Spacing dose" },
  { value: "dose_reduction",      label: "Riduzione dose" },
  { value: "remission",           label: "Remissione" },
  { value: "flare",               label: "Riacutizzazione" },
  { value: "comorbidity_onset",   label: "Comorbidità" },
  { value: "adverse_event",       label: "Evento avverso" },
];

const DATE_PRECISION_OPTIONS = [
  { value: "year",       label: "Anno" },
  { value: "month_year", label: "Mese/Anno" },
  { value: "exact",      label: "Data esatta" },
];

function RaccordoEventItemEditor({ ev, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const update = (field, value) => onChange({ ...ev, [field]: value });
  const cfg  = RACCORDO_EVENT_CONFIG[ev.event_type] || { label: ev.event_type || "—", cls: "bg-gray-100 text-gray-700 border-gray-200" };
  const conf = CONFIDENCE_CONFIG[ev.confidence]    || CONFIDENCE_CONFIG.medium;

  return (
    <div className={`rounded border text-xs transition-all ${ev._skip ? "opacity-50 border-red-100 bg-red-50/30" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center gap-2 p-2">
        <input type="checkbox" checked={!ev._skip} onChange={() => update("_skip", !ev._skip)} className="accent-blue-600 flex-shrink-0" />
        <span className={`inline-block border rounded px-1.5 py-0.5 font-medium text-[10px] flex-shrink-0 ${cfg.cls}`}>{cfg.label}</span>
        <span className="text-gray-600 font-medium flex-shrink-0">{fmtRaccordoDate(ev)}</span>
        {ev.drug_name && <span className="text-gray-800 font-semibold truncate">{ev.drug_name}</span>}
        <span className={`border rounded px-1 py-0.5 text-[9px] flex-shrink-0 ${conf.cls}`}>{conf.label}</span>
        <button type="button" onClick={() => setExpanded(x => !x)} className="ml-auto p-0.5 text-gray-400 hover:text-gray-700 flex-shrink-0">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 p-2.5 space-y-2 bg-gray-50/60">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Tipo evento</label>
              <select value={ev.event_type || ""} onChange={e => update("event_type", e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white">
                {EVENT_TYPES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Confidenza</label>
              <select value={ev.confidence || "medium"} onChange={e => update("confidence", e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white">
                <option value="high">Alta</option><option value="medium">Media</option><option value="low">Bassa</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Data (ISO)</label>
              <input type="date" value={ev.date_value || ""} onChange={e => update("date_value", e.target.value || null)}
                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white" />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Precisione data</label>
              <select value={ev.date_precision || "year"} onChange={e => update("date_precision", e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white">
                {DATE_PRECISION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Farmaco</label>
              <input type="text" value={ev.drug_name || ""} onChange={e => update("drug_name", e.target.value || null)}
                placeholder="es. Adalimumab" className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white" />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Dettaglio</label>
              <input type="text" value={ev.detail || ""} onChange={e => update("detail", e.target.value || null)}
                placeholder="es. in monoterapia" className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 bg-white" />
            </div>
          </div>
          {ev.source_text && (
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Testo sorgente</label>
              <p className="text-[10px] text-gray-500 italic bg-white border border-gray-100 rounded px-2 py-1 whitespace-pre-wrap">{ev.source_text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RaccordoEventsEditor({ events, onChange }) {
  const addNew = () => onChange([...events, {
    _id: Date.now(), _skip: false, event_type: "disease_onset", date_value: null,
    date_text: null, date_precision: "year", date_approximate: false,
    drug_name: null, drug_canonical: null, drug_category: null,
    manifestation: null, detail: null, reason: null, source_text: null,
    confidence: "medium", inferred_by: null, parser_version: "manual", source_section: "raccordo",
  }]);

  if (events.length === 0) return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 italic">Nessun evento rilevato nel raccordo.</p>
      <button type="button" onClick={addNew} className="text-xs text-green-600 hover:underline">+ Aggiungi evento</button>
    </div>
  );

  const dated   = events.map((e, i) => ({ ev: e, i })).filter(({ ev }) =>  ev.date_value);
  const undated = events.map((e, i) => ({ ev: e, i })).filter(({ ev }) => !ev.date_value);
  dated.sort((a, b) => a.ev.date_value.localeCompare(b.ev.date_value));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-500">{events.filter(e => !e._skip).length}/{events.length} selezionati</span>
        <button type="button" onClick={() => onChange(events.map(e => ({ ...e, _skip: false })))} className="text-xs text-blue-600 hover:underline">Seleziona tutti</button>
        <span className="text-gray-300">·</span>
        <button type="button" onClick={() => onChange(events.map(e => ({ ...e, _skip: true })))} className="text-xs text-gray-500 hover:underline">Deseleziona tutti</button>
        <span className="text-gray-300">·</span>
        <button type="button" onClick={addNew} className="text-xs text-green-600 hover:underline">+ Aggiungi</button>
      </div>
      {dated.map(({ ev, i }) => (
        <RaccordoEventItemEditor key={ev._id ?? i} ev={ev}
          onChange={updated => onChange(events.map((e, j) => j === i ? updated : e))} />
      ))}
      {undated.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Eventi senza data ({undated.length})</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          {undated.map(({ ev, i }) => (
            <RaccordoEventItemEditor key={ev._id ?? i} ev={ev}
              onChange={updated => onChange(events.map((e, j) => j === i ? updated : e))} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComorbidityEditor({ items, onChange }) {
  const [newText, setNewText] = useState("");
  const addItem = () => {
    if (!newText.trim()) return;
    onChange([...items, { _id: Date.now(), _skip: false, text: newText.trim() }]);
    setNewText("");
  };
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-gray-500">{items.filter(x => !x._skip).length}/{items.length} selezionate</span>
      {items.map((item, i) => (
        <div key={item._id ?? i}
          className={`flex items-center gap-2 p-1.5 rounded border text-xs ${item._skip ? "opacity-50 border-red-100 bg-red-50/30" : "border-gray-200 bg-white"}`}>
          <input type="checkbox" checked={!item._skip}
            onChange={() => onChange(items.map((x, j) => j === i ? { ...x, _skip: !x._skip } : x))}
            className="accent-blue-600 flex-shrink-0" />
          <input type="text" value={item.text}
            onChange={e => onChange(items.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
            disabled={item._skip}
            className={`flex-1 min-w-0 text-xs bg-transparent border-0 outline-none ${item._skip ? "line-through text-gray-400" : "text-gray-700"}`} />
          <button type="button" onClick={() => onChange(items.map((x, j) => j === i ? { ...x, _skip: !x._skip } : x))}
            className={`flex-shrink-0 text-[10px] ${item._skip ? "text-blue-600 hover:underline" : "text-gray-400 hover:text-red-500"}`}>
            {item._skip ? "ripristina" : "escludi"}
          </button>
        </div>
      ))}
      <div className="flex gap-1 mt-1.5">
        <input type="text" value={newText} onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addItem()}
          placeholder="Aggiungi comorbidità…"
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white" />
        <button type="button" onClick={addItem}
          className="text-xs px-2 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600">+</button>
      </div>
    </div>
  );
}

function IntolleranzeEditor({ items, onChange }) {
  const [newDrug, setNewDrug]     = useState("");
  const [newReason, setNewReason] = useState("");
  const addItem = () => {
    if (!newDrug.trim()) return;
    onChange([...items, { _id: Date.now(), _skip: false, drug: newDrug.trim(), reason: newReason.trim() || null }]);
    setNewDrug("");
    setNewReason("");
  };
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-gray-500">{items.filter(x => !x._skip).length}/{items.length} selezionate</span>
      {items.map((item, i) => (
        <div key={item._id ?? i}
          className={`flex items-start gap-2 p-1.5 rounded border text-xs ${item._skip ? "opacity-50 border-red-100 bg-red-50/30" : "border-gray-200 bg-white"}`}>
          <input type="checkbox" checked={!item._skip}
            onChange={() => onChange(items.map((x, j) => j === i ? { ...x, _skip: !x._skip } : x))}
            className="accent-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 grid grid-cols-2 gap-1">
            <input type="text" value={item.drug || ""}
              onChange={e => onChange(items.map((x, j) => j === i ? { ...x, drug: e.target.value } : x))}
              disabled={item._skip} placeholder="Farmaco"
              className={`text-xs border border-gray-100 rounded px-1.5 py-0.5 ${item._skip ? "line-through text-gray-400 bg-gray-50" : "text-gray-800 font-medium bg-white"}`} />
            <input type="text" value={item.reason || ""}
              onChange={e => onChange(items.map((x, j) => j === i ? { ...x, reason: e.target.value || null } : x))}
              disabled={item._skip} placeholder="Motivo (opz.)"
              className={`text-xs border border-gray-100 rounded px-1.5 py-0.5 ${item._skip ? "text-gray-400 bg-gray-50" : "text-gray-600 bg-white"}`} />
          </div>
          <button type="button" onClick={() => onChange(items.map((x, j) => j === i ? { ...x, _skip: !x._skip } : x))}
            className={`flex-shrink-0 text-[10px] mt-0.5 ${item._skip ? "text-blue-600 hover:underline" : "text-gray-400 hover:text-red-500"}`}>
            {item._skip ? "ripristina" : "escludi"}
          </button>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-1 mt-1.5">
        <input type="text" value={newDrug} onChange={e => setNewDrug(e.target.value)} placeholder="Nuovo farmaco…"
          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white" />
        <div className="flex gap-1">
          <input type="text" value={newReason} onChange={e => setNewReason(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()} placeholder="Motivo (opz.)"
            className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white" />
          <button type="button" onClick={addItem}
            className="text-xs px-2 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600">+</button>
        </div>
      </div>
    </div>
  );
}

function RequestedTestsEditor({ tests, onChange }) {
  const [newTest, setNewTest] = useState("");
  return (
    <div className="space-y-1.5">
      <ul className="space-y-1">
        {tests.map((t, i) => (
          <li key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-gray-100 bg-white text-[11px]">
            <span className="flex-1">{t}</span>
            <button type="button" onClick={() => onChange(tests.filter((_, j) => j !== i))}
              className="p-0.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-3 h-3" /></button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5 pt-0.5">
        <input className="flex-1 text-xs border border-gray-200 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400"
          value={newTest} onChange={e => setNewTest(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && newTest.trim()) { onChange([...tests, newTest.trim()]); setNewTest(""); } }}
          placeholder="Aggiungi esame richiesto…" />
        <button type="button" onClick={() => { if (newTest.trim()) { onChange([...tests, newTest.trim()]); setNewTest(""); } }}
          className="text-xs px-2 py-1 rounded bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100">
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function TextSection({ value, onChange, placeholder, minH }) {
  return (
    <textarea
      className={`w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 leading-relaxed focus:outline-none focus:ring-1 focus:ring-teal-400 resize-y bg-white ${minH || "min-h-[52px]"}`}
      value={value || ""}
      placeholder={placeholder || "Non riportato nel testo"}
      onChange={e => onChange(e.target.value || null)}
    />
  );
}

function AssessmentsEditor({ items, onChange }) {
  const [newType, setNewType] = useState("");
  const updateItem = (i, patch) => onChange(items.map((x, j) => j === i ? { ...x, ...patch } : x));
  const addItem = () => {
    if (!newType.trim()) return;
    onChange([...items, { _id: Date.now(), _skip: false, index_type: newType.trim(), score: null, interpretation: null, date: null, inputs: {} }]);
    setNewType("");
  };
  return (
    <div className="space-y-1.5">
      {items.length === 0 && (
        <p className="text-xs text-gray-400 italic mb-1">Nessuno score clinimetrico estratto.</p>
      )}
      {items.map((item, i) => (
        <div key={item._id ?? i}
          className={`flex items-center gap-1.5 p-1.5 rounded border text-xs flex-wrap ${item._skip ? "opacity-50 border-red-100 bg-red-50/30" : "border-gray-200 bg-white"}`}>
          <input type="checkbox" checked={!item._skip}
            onChange={() => updateItem(i, { _skip: !item._skip })}
            className="accent-blue-600 flex-shrink-0" />
          <input type="text" value={item.index_type || ""}
            onChange={e => updateItem(i, { index_type: e.target.value })}
            disabled={item._skip} placeholder="Indice"
            className="w-24 text-xs border border-gray-100 rounded px-1.5 py-0.5 font-semibold bg-white text-[#0A2540] disabled:text-gray-400 disabled:bg-gray-50 focus:outline-none" />
          <span className="text-gray-300 text-xs">=</span>
          <input type="number" step="0.01" value={item.score ?? ""}
            onChange={e => updateItem(i, { score: e.target.value !== "" ? parseFloat(e.target.value) : null })}
            disabled={item._skip} placeholder="Score"
            className="w-16 text-xs border border-gray-100 rounded px-1.5 py-0.5 text-right bg-white disabled:bg-gray-50 focus:outline-none" />
          <input type="text" value={item.interpretation || ""}
            onChange={e => updateItem(i, { interpretation: e.target.value || null })}
            disabled={item._skip} placeholder="Interpretazione"
            className="flex-1 min-w-[80px] text-xs border border-gray-100 rounded px-1.5 py-0.5 text-gray-600 bg-white disabled:bg-gray-50 focus:outline-none" />
          <input type="date" value={item.date || ""}
            onChange={e => updateItem(i, { date: e.target.value || null })}
            disabled={item._skip}
            className="w-28 text-xs border border-gray-100 rounded px-1.5 py-0.5 bg-white disabled:bg-gray-50 focus:outline-none" />
          <button type="button" onClick={() => updateItem(i, { _skip: !item._skip })}
            className={`flex-shrink-0 text-[10px] ${item._skip ? "text-blue-600 hover:underline" : "text-gray-400 hover:text-red-500"}`}>
            {item._skip ? "ripristina" : "escludi"}
          </button>
        </div>
      ))}
      <div className="flex gap-1.5 pt-0.5">
        <input type="text" value={newType} onChange={e => setNewType(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addItem()}
          placeholder="Aggiungi indice (es. DAS28)…"
          className="flex-1 text-xs border border-gray-200 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white" />
        <button type="button" onClick={addItem}
          className="text-xs px-2 py-1 rounded bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100">
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

const HIP_KEYS = new Set(["hip_l", "hip_r"]);

function EsameObiettivoEditor({ text, jointMap, onTextChange, onJointChange }) {
  const derived = useMemo(() => parseJointExam(text || ""), [text]);
  const hasManualOverride = jointMap != null;
  const displayJoints     = hasManualOverride ? jointMap : (derived.found ? derived.joints : {});
  const hasJointData      = Object.values(displayJoints).some(v => v && v !== "none");

  const [tjc, sjc] = useMemo(() => {
    let t = 0, s = 0;
    for (const [k, v] of Object.entries(displayJoints)) {
      if (v === "tender" || v === "both") t++;
      if ((v === "swollen" || v === "both") && !HIP_KEYS.has(k)) s++;
    }
    return [t, s];
  }, [displayJoints]);

  return (
    <div className="space-y-3">
      <TextSection value={text} onChange={onTextChange} minH="min-h-[72px]" />
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A2540]">
            Mappa articolare
            {hasJointData && (
              <span className="font-normal text-gray-500 ml-1.5">· TJC {tjc} · SJC {sjc}</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {hasManualOverride && (
              <button type="button" onClick={() => onJointChange(null)}
                className="text-[10px] text-blue-500 hover:underline">
                Ricalcola da testo
              </button>
            )}
            {!hasManualOverride && hasJointData && (
              <span className="text-[10px] text-gray-400 italic">Da testo · clicca per correggere</span>
            )}
          </div>
        </div>
        {hasJointData ? (
          <div className="flex justify-center overflow-auto max-h-72">
            <Homunculus
              mode="28"
              joints={displayJoints}
              onChange={newJoints => onJointChange(newJoints)}
            />
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            {text ? "Nessuna articolazione rilevata nel testo." : "Nessun testo EO presente."}
          </p>
        )}
      </div>
    </div>
  );
}

function SectionBlock({ title, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
        <span className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0A2540]">{title}</span>
          {badge}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {open && <div className="px-3 py-3">{children}</div>}
    </div>
  );
}

export default function VisitFacsimile({ draft, onUpdate }) {
  if (!draft) return null;

  const today       = new Date().toISOString().slice(0, 10);
  const visitDateIso = draft.visit_date || today;
  const dateIsToday  = visitDateIso === today;
  const vs  = draft.visit_sections   || {};
  const pg  = draft.profilo_generale  || {};

  const conflicts    = draft._parse_review?.therapy_conflicts || [];
  const unresolved   = draft._parse_review?.unresolved        || [];
  const lowConf      = draft._parse_review?.low_confidence    || [];
  const labReviewCnt = (draft.lab_review_items || []).length;
  const warningCount = unresolved.length + lowConf.length;

  const upd   = patch => onUpdate({ ...draft, ...patch });
  const updVS = patch => upd({ visit_sections:   { ...vs,  ...patch } });
  const updPG = patch => upd({ profilo_generale:  { ...pg, ...patch } });

  const labConfirmHandlers = {
    onConfirm: (item, { value, unit } = {}) => {
      const newReview  = (draft.lab_review_items || []).filter(r => !(r.key === item.key && r.date === item.date));
      let   newExams   = [...(draft.lab_exams || [])];
      const finalValue = value != null ? value : item.proposed_value;
      const finalUnit  = unit  != null ? unit  : (item.proposed_unit || "");
      if (finalValue != null || item.qualitative) {
        const idx = newExams.findIndex(e => e.date === item.date);
        const r = { name: item.label, param_key: item.key, panel: item.panel || "custom" };
        if (finalValue != null) { r.value = String(finalValue); r.unit = finalUnit; }
        if (item.qualitative) r.qualitative = item.qualitative;
        if (item.status)      r.status      = item.status;
        if (idx >= 0) newExams[idx] = { ...newExams[idx], results: [...(newExams[idx].results || []), r] };
        else newExams.push({ _id: newExams.length, _skip: false, date: item.date, results: [r] });
      }
      upd({ lab_review_items: newReview, lab_exams: newExams });
    },
    onConfirmMany: (itemsToConfirm) => {
      if (!itemsToConfirm?.length) return;
      const keyDate   = new Set(itemsToConfirm.map(it => `${it.key}|${it.date}`));
      const newReview = (draft.lab_review_items || []).filter(r => !keyDate.has(`${r.key}|${r.date}`));
      const newExams  = (draft.lab_exams || []).map(e => ({ ...e, results: [...(e.results || [])] }));
      for (const item of itemsToConfirm) {
        const finalValue = item.proposed_value;
        const finalUnit  = item.proposed_unit || LAB_REVIEW_TRUSTED_UNITS[item.key] || "";
        if (finalValue == null && !item.qualitative) continue;
        const r = { name: item.label, param_key: item.key, panel: item.panel || "custom" };
        if (finalValue != null) { r.value = String(finalValue); r.unit = finalUnit; }
        if (item.qualitative) r.qualitative = item.qualitative;
        if (item.status)      r.status      = item.status;
        const idx = newExams.findIndex(e => e.date === item.date);
        if (idx >= 0) newExams[idx].results.push(r);
        else newExams.push({ _id: newExams.length, _skip: false, date: item.date, results: [r] });
      }
      upd({ lab_review_items: newReview, lab_exams: newExams });
    },
    onIgnore: (item) => upd({
      lab_review_items: (draft.lab_review_items || []).filter(r => !(r.key === item.key && r.date === item.date)),
    }),
  };

  const hasLabContent  = (draft.lab_exams || []).length > 0 || labReviewCnt > 0 ||
                         (draft.instrumental_findings || []).length > 0 ||
                         (draft.exam_imaging || []).length > 0 || !!vs.labs_text;

  return (
    <div className="space-y-2.5">

      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${dateIsToday ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex-shrink-0">Data visita</span>
          <input type="date" value={visitDateIso}
            onChange={e => upd({ visit_date: e.target.value || today })}
            className="text-xs border border-gray-300 rounded px-2 py-0.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          {dateIsToday && <span className="text-xs text-amber-600">(data odierna — non trovata nel testo)</span>}
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex-shrink-0 ml-2">Tipo</span>
          <select value={draft.visit_type || "follow_up"}
            onChange={e => upd({ visit_type: e.target.value })}
            className="text-xs border border-gray-300 rounded px-2 py-0.5 bg-white text-gray-800 focus:outline-none cursor-pointer">
            {VISIT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <SectionBlock title="1) Diagnosi">
        <TextSection value={pg.diagnosi} onChange={v => updPG({ diagnosi: v })} />
      </SectionBlock>

      <SectionBlock title="2) Anamnesi fisiologica">
        <TextSection value={pg.anamnesi_fisiologica} onChange={v => updPG({ anamnesi_fisiologica: v })} />
      </SectionBlock>

      <SectionBlock title="3) Anamnesi familiare">
        <TextSection value={pg.anamnesi_familiare} onChange={v => updPG({ anamnesi_familiare: v })} />
      </SectionBlock>

      <SectionBlock title="4) Comorbilità / APR">
        {(draft.comorbidita || []).length > 0 ? (
          <div className="space-y-2">
            <ComorbidityEditor
              items={draft.comorbidita}
              onChange={items => upd({ comorbidita: items })}
            />
            {pg.comorbidita_apr && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Testo APR originale</div>
                <TextSection value={pg.comorbidita_apr} onChange={v => updPG({ comorbidita_apr: v })} />
              </div>
            )}
          </div>
        ) : (
          <TextSection value={pg.comorbidita_apr} onChange={v => updPG({ comorbidita_apr: v })} />
        )}
      </SectionBlock>

      <SectionBlock title="5) Terapia domiciliare (ingresso visita)">
        <TextSection value={pg.terapia_domiciliare} onChange={v => updPG({ terapia_domiciliare: v })} minH="min-h-[64px]" />
      </SectionBlock>

      <SectionBlock title="6) Allergie">
        {(draft.intolleranze || []).length > 0 ? (
          <div className="space-y-2">
            <IntolleranzeEditor
              items={draft.intolleranze}
              onChange={items => upd({ intolleranze: items })}
            />
            {pg.allergie && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Testo allergie originale</div>
                <TextSection value={pg.allergie} onChange={v => updPG({ allergie: v })} />
              </div>
            )}
          </div>
        ) : (
          <TextSection value={pg.allergie} onChange={v => updPG({ allergie: v })} />
        )}
      </SectionBlock>

      <SectionBlock title="7) Raccordo anamnestico reumatologico">
        <RaccordoEventsEditor
          events={draft.raccordo_events || []}
          onChange={evs => upd({ raccordo_events: evs })}
        />
      </SectionBlock>

      <SectionBlock title="8) Anamnesi intervallare">
        <TextSection value={vs.anamnesi} onChange={v => updVS({ anamnesi: v })} minH="min-h-[72px]" />
      </SectionBlock>

      <SectionBlock title="9) Esame obiettivo">
        <EsameObiettivoEditor
          text={vs.esame_obj || ""}
          jointMap={draft.physical_exam_joint_exam ?? null}
          onTextChange={v  => updVS({ esame_obj: v || null })}
          onJointChange={m => upd({ physical_exam_joint_exam: m })}
        />
      </SectionBlock>

      <SectionBlock title="10) Clinimetria">
        <AssessmentsEditor
          items={draft.assessments || []}
          onChange={items => upd({ assessments: items })}
        />
      </SectionBlock>

      <SectionBlock
        title="11) Esami / imaging esibiti"
        badge={labReviewCnt > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">
            {labReviewCnt} da verificare
          </span>
        )}
      >
        {labReviewCnt > 0 && (
          <div className="mb-3">
            <LabValueReviewPanel
              items={draft.lab_review_items || []}
              trustedUnits={LAB_REVIEW_TRUSTED_UNITS}
              {...labConfirmHandlers}
            />
          </div>
        )}
        <LabExamExpander exams={draft.lab_exams || []} onChange={items => upd({ lab_exams: items })} />
        {(draft.instrumental_findings || []).length > 0 && (
          <div className="mt-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Strumentali (archivio)</div>
            <DeletableList
              items={draft.instrumental_findings}
              getLabel={f => `${f.examLabel || f.examType || "Esame"}${f.date ? ` — ${fmtIso(f.date)}` : ""}${f.summary ? `: ${f.summary.slice(0, 60)}` : ""}`}
              onChange={items => upd({ instrumental_findings: items })}
            />
          </div>
        )}
        {(draft.exam_imaging || []).length > 0 && (
          <div className="mt-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Imaging portato in visione</div>
            <DeletableList
              items={draft.exam_imaging}
              getLabel={f => `${f.examLabel || "Imaging"}${f.territory ? ` (${f.territory})` : ""}${f.date ? ` [${f.date}]` : ""}`}
              onChange={items => upd({ exam_imaging: items })}
            />
          </div>
        )}
        {vs.labs_text && (
          <div className="mt-2">
            <TextSection value={vs.labs_text} onChange={v => updVS({ labs_text: v })} />
          </div>
        )}
        {!hasLabContent && (
          <p className="text-xs text-gray-400 italic">Nessun esame o imaging rilevato nel testo.</p>
        )}
      </SectionBlock>

      <SectionBlock title="12) Conclusioni">
        <TextSection value={vs.conclusioni} onChange={v => updVS({ conclusioni: v })} minH="min-h-[64px]" />
      </SectionBlock>

      <SectionBlock
        title="13) Terapia (indicazioni in uscita)"
        badge={conflicts.length > 0 && (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">
            <AlertTriangle className="w-3 h-3" /> {conflicts.length} conflitto{conflicts.length > 1 ? "i" : ""}
          </span>
        )}
      >
        {(draft.therapies || []).length > 0 ? (
          <TherapyEditor
            therapies={draft.therapies}
            conflicts={conflicts}
            onChange={t => upd({ therapies: t })}
          />
        ) : (
          <p className="text-xs text-gray-400 italic">Nessuna indicazione terapeutica estratta.</p>
        )}
      </SectionBlock>

      <SectionBlock title="14) Indicazioni ulteriori">
        <TextSection value={vs.indicazioni} onChange={v => updVS({ indicazioni: v })} minH="min-h-[64px]" />
      </SectionBlock>

      {(draft.requested_tests || []).length > 0 && (
        <SectionBlock title="Esami richiesti" defaultOpen={false}>
          <RequestedTestsEditor tests={draft.requested_tests || []} onChange={t => upd({ requested_tests: t })} />
        </SectionBlock>
      )}

      {warningCount > 0 && (
        <SectionBlock title={`Avvisi parser (${warningCount})`} defaultOpen={false}
          badge={<span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">non bloccanti</span>}>
          {unresolved.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Non risolti</div>
              <ul className="space-y-1">
                {unresolved.map((u, i) => (
                  <li key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    <span className="font-medium">{u.source || "—"}</span>: {u.reason || ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {lowConf.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Bassa confidenza</div>
              <ul className="space-y-1">
                {lowConf.map((u, i) => (
                  <li key={i} className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                    <span className="font-medium">{u.field || "—"}</span>: {u.reason || ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionBlock>
      )}

    </div>
  );
}
