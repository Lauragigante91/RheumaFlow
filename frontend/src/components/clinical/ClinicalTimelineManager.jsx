import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Edit2, Trash2, X, Check, Merge, ChevronDown, ChevronUp,
  AlertCircle, Loader2,
} from "lucide-react";
import { clinicalEventsApi } from "../../lib/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../ui/dialog";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPE_OPTIONS = [
  { value: "disease_onset",       label: "Esordio malattia",       categoria: "malattia" },
  { value: "manifestation_onset", label: "Esordio manifestazione", categoria: "malattia" },
  { value: "flare",               label: "Riacutizzazione",        categoria: "malattia" },
  { value: "remission",           label: "Remissione",             categoria: "malattia" },
  { value: "therapy_start",       label: "Inizio terapia",         categoria: "terapia" },
  { value: "therapy_stop",        label: "Sospensione terapia",    categoria: "terapia" },
  { value: "therapy_switch",      label: "Switch terapia",         categoria: "terapia" },
  { value: "dose_spacing",        label: "Spacing dose",           categoria: "terapia" },
  { value: "dose_reduction",      label: "Riduzione dose",         categoria: "terapia" },
  { value: "adverse_event",       label: "Evento avverso",         categoria: "terapia" },
  { value: "comorbidity_onset",   label: "Comorbidità",            categoria: "diagnosi" },
  { value: "exam",                label: "Esame / accertamento",   categoria: "esame" },
  { value: "hospitalization",     label: "Ricovero",               categoria: "ricovero" },
  { value: "procedure",           label: "Procedura",              categoria: "procedura" },
  { value: "other",               label: "Altro",                  categoria: "altro" },
];

const CATEGORIA_TABS = [
  { value: "tutti",     label: "Tutti" },
  { value: "malattia",  label: "Malattia" },
  { value: "terapia",   label: "Terapia" },
  { value: "diagnosi",  label: "Diagnosi" },
  { value: "esame",     label: "Esame" },
  { value: "ricovero",  label: "Ricovero" },
  { value: "procedura", label: "Procedura" },
  { value: "altro",     label: "Altro" },
];

const SOURCE_ORIGIN_LABELS = {
  inserimento_manuale: "manuale",
  import_testo:        "import testo",
  import_pdf:          "import PDF",
  generato_da_parser:  "parser",
  modifica_manuale:    "modifica",
};

const EVENT_CONFIG = {
  disease_onset:       { label: "Esordio malattia",       dot: "bg-red-500",     badge: "bg-red-50 border-red-200 text-red-700" },
  manifestation_onset: { label: "Esordio manifestazione", dot: "bg-orange-400",  badge: "bg-orange-50 border-orange-200 text-orange-700" },
  flare:               { label: "Riacutizzazione",        dot: "bg-red-400",     badge: "bg-red-50 border-red-200 text-red-600" },
  remission:           { label: "Remissione",             dot: "bg-emerald-500", badge: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  therapy_start:       { label: "Inizio terapia",         dot: "bg-green-500",   badge: "bg-green-50 border-green-200 text-green-700" },
  therapy_stop:        { label: "Sospensione terapia",    dot: "bg-gray-400",    badge: "bg-gray-100 border-gray-300 text-gray-600" },
  therapy_switch:      { label: "Switch terapia",         dot: "bg-blue-400",    badge: "bg-blue-50 border-blue-200 text-blue-700" },
  dose_spacing:        { label: "Spacing dose",           dot: "bg-blue-400",    badge: "bg-blue-50 border-blue-200 text-blue-700" },
  dose_reduction:      { label: "Riduzione dose",         dot: "bg-indigo-400",  badge: "bg-indigo-50 border-indigo-200 text-indigo-700" },
  adverse_event:       { label: "Evento avverso",         dot: "bg-amber-500",   badge: "bg-amber-50 border-amber-200 text-amber-700" },
  comorbidity_onset:   { label: "Comorbidità",            dot: "bg-purple-400",  badge: "bg-purple-50 border-purple-200 text-purple-700" },
  exam:                { label: "Esame",                  dot: "bg-sky-400",     badge: "bg-sky-50 border-sky-200 text-sky-700" },
  hospitalization:     { label: "Ricovero",               dot: "bg-rose-500",    badge: "bg-rose-50 border-rose-200 text-rose-700" },
  procedure:           { label: "Procedura",              dot: "bg-teal-400",    badge: "bg-teal-50 border-teal-200 text-teal-700" },
  other:               { label: "Altro",                  dot: "bg-gray-300",    badge: "bg-gray-50 border-gray-200 text-gray-600" },
};

const CATEGORIA_FROM_TYPE = {
  disease_onset: "malattia", manifestation_onset: "malattia", flare: "malattia", remission: "malattia",
  therapy_start: "terapia", therapy_stop: "terapia", therapy_switch: "terapia",
  dose_spacing: "terapia", dose_reduction: "terapia", adverse_event: "terapia",
  comorbidity_onset: "diagnosi", exam: "esame", hospitalization: "ricovero", procedure: "procedura",
};

function categoriaOf(ev) {
  return ev.categoria || CATEGORIA_FROM_TYPE[ev.event_type] || "altro";
}

const EMPTY_FORM = {
  event_type: "therapy_start",
  categoria: "terapia",
  titolo: "",
  date_value: "",
  date_precision: "year",
  date_approximate: false,
  drug_canonical: "",
  drug_name: "",
  from_drug: "",
  to_drug: "",
  manifestation: "",
  body_system: "",
  reason: "",
  detail: "",
  confidence: "high",
  source_origin: "inserimento_manuale",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateValue, datePrecision, dateText) {
  if (!dateValue) return dateText || "Data n.d.";
  try {
    const d = new Date(dateValue + "T00:00:00Z");
    if (datePrecision === "year") return String(d.getUTCFullYear());
    if (datePrecision === "month_year") {
      return d.toLocaleDateString("it-IT", { month: "short", year: "numeric", timeZone: "UTC" });
    }
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  } catch {
    return dateText || dateValue;
  }
}

function normalizeDate(raw) {
  if (!raw) return { date_value: null, date_precision: "year" };
  const s = raw.trim();
  if (/^\d{4}$/.test(s))         return { date_value: `${s}-01-01`,       date_precision: "year" };
  if (/^\d{4}-\d{2}$/.test(s))   return { date_value: `${s}-01`,          date_precision: "month_year" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { date_value: s,               date_precision: "exact" };
  return { date_value: s, date_precision: "year" };
}

function displayDateInput(date_value, date_precision) {
  if (!date_value) return "";
  if (date_precision === "year")       return date_value.substring(0, 4);
  if (date_precision === "month_year") return date_value.substring(0, 7);
  return date_value.substring(0, 10);
}

function eventSummary(ev) {
  const cfg = EVENT_CONFIG[ev.event_type] || { label: ev.event_type };
  const date = formatDate(ev.date_value, ev.date_precision, ev.date_text);
  const drug = ev.drug_canonical || ev.from_drug || ev.to_drug || "";
  const parts = [cfg.label];
  if (drug) parts.push(drug);
  if (ev.reason) parts.push(`(${ev.reason})`);
  return `${date} · ${parts.join(" ")}`;
}

// ── EventForm ─────────────────────────────────────────────────────────────────

function EventForm({ form, onChange }) {
  const isTherapy = ["therapy_start", "therapy_stop", "dose_spacing", "dose_reduction", "adverse_event"].includes(form.event_type);
  const isSwitch  = form.event_type === "therapy_switch";
  const hasReason = ["therapy_stop", "adverse_event", "dose_spacing", "dose_reduction"].includes(form.event_type);
  const hasManifestation = ["disease_onset", "manifestation_onset", "flare", "comorbidity_onset"].includes(form.event_type);

  function set(field, val) { onChange({ ...form, [field]: val }); }

  function handleTypeChange(v) {
    const cat = CATEGORIA_FROM_TYPE[v] || "altro";
    onChange({ ...form, event_type: v, categoria: cat });
  }

  function handleDateInput(raw) {
    const { date_value, date_precision } = normalizeDate(raw);
    onChange({ ...form, date_value, date_precision, _dateRaw: raw });
  }

  const dateDisplay = form._dateRaw !== undefined ? form._dateRaw : displayDateInput(form.date_value, form.date_precision);

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-600 block mb-1">Tipo evento *</label>
          <Select value={form.event_type} onValueChange={handleTypeChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-600 block mb-1">Titolo</label>
          <Input
            value={form.titolo || ""}
            onChange={e => set("titolo", e.target.value)}
            placeholder="Titolo descrittivo (opzionale)"
            className="h-8 text-xs"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Data</label>
          <Input
            value={dateDisplay}
            onChange={e => handleDateInput(e.target.value)}
            placeholder="AAAA o AAAA-MM-GG"
            className="h-8 text-xs font-mono"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">Es: 2007 · 2007-08 · 2007-08-15</p>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Confidenza</label>
          <Select value={form.confidence} onValueChange={v => set("confidence", v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high" className="text-xs">Alta</SelectItem>
              <SelectItem value="medium" className="text-xs">Media</SelectItem>
              <SelectItem value="low" className="text-xs">Bassa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(isTherapy) && !isSwitch && (
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Farmaco</label>
          <Input
            value={form.drug_canonical || ""}
            onChange={e => set("drug_canonical", e.target.value)}
            placeholder="es. Methotrexate"
            className="h-8 text-xs"
          />
        </div>
      )}

      {isSwitch && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Da farmaco</label>
            <Input value={form.from_drug || ""} onChange={e => set("from_drug", e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">A farmaco</label>
            <Input value={form.to_drug || ""} onChange={e => set("to_drug", e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      )}

      {hasReason && (
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Motivo</label>
          <Input
            value={form.reason || ""}
            onChange={e => set("reason", e.target.value)}
            placeholder="es. inefficacia, tossicità, remissione"
            className="h-8 text-xs"
          />
        </div>
      )}

      {hasManifestation && (
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Manifestazione / organo</label>
          <Input
            value={form.manifestation || ""}
            onChange={e => set("manifestation", e.target.value)}
            placeholder="es. artrite, rash malarico"
            className="h-8 text-xs"
          />
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Note / descrizione</label>
        <textarea
          value={form.detail || ""}
          onChange={e => set("detail", e.target.value)}
          placeholder="Dettagli aggiuntivi..."
          rows={2}
          className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Origine</label>
        <Select value={form.source_origin || "inserimento_manuale"} onValueChange={v => set("source_origin", v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inserimento_manuale" className="text-xs">Inserimento manuale</SelectItem>
            <SelectItem value="import_testo"        className="text-xs">Import da testo</SelectItem>
            <SelectItem value="import_pdf"          className="text-xs">Import da PDF</SelectItem>
            <SelectItem value="generato_da_parser"  className="text-xs">Parser automatico</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ── EventRow ──────────────────────────────────────────────────────────────────

function EventRow({ ev, mergeMode, mergeSet, onToggleMerge, onEdit, onDelete }) {
  const cfg = EVENT_CONFIG[ev.event_type] || { label: ev.event_type, dot: "bg-gray-300", badge: "bg-gray-50 border-gray-200 text-gray-600" };
  const dateStr = formatDate(ev.date_value, ev.date_precision, ev.date_text);
  const srcLabel = SOURCE_ORIGIN_LABELS[ev.source_origin] || (ev.source_section === "raccordo" ? "raccordo" : null);
  const inMergeSet = mergeSet.has(ev.id);

  return (
    <div className={`flex items-start gap-2 group rounded-md px-2 py-1.5 transition-colors ${inMergeSet ? "bg-indigo-50 ring-1 ring-indigo-300" : "hover:bg-gray-50"}`}>
      {mergeMode && (
        <input
          type="checkbox"
          checked={inMergeSet}
          onChange={() => onToggleMerge(ev.id)}
          className="mt-1 flex-shrink-0 accent-indigo-600"
        />
      )}

      <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 ${cfg.dot}`} />

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          {ev.date_value && (
            <span className="text-[11px] font-mono font-semibold text-gray-500 flex-shrink-0">
              {dateStr}
            </span>
          )}
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.badge}`}>
            {cfg.label}
          </span>
          {ev.titolo && (
            <span className="text-[11px] font-medium text-gray-800">{ev.titolo}</span>
          )}
          {!ev.titolo && ev.drug_canonical && (
            <span className="text-[11px] font-medium text-gray-700">{ev.drug_canonical}</span>
          )}
          {!ev.titolo && !ev.drug_canonical && ev.from_drug && (
            <span className="text-[11px] font-medium text-gray-700">{ev.from_drug} → {ev.to_drug}</span>
          )}
          {ev.reason && (
            <span className="text-[11px] text-gray-500 italic">per {ev.reason}</span>
          )}
          {ev.manifestation && !ev.titolo && (
            <span className="text-[11px] text-gray-600">{ev.manifestation}</span>
          )}
          {ev.confidence === "low" && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-600 font-medium flex-shrink-0">
              conf. bassa
            </span>
          )}
          {srcLabel && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-gray-50 border border-gray-100 text-gray-400 flex-shrink-0">
              {srcLabel}
            </span>
          )}
        </div>
        {ev.detail && (
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{ev.detail}</p>
        )}
        {ev.source_text && !ev.detail && (
          <p className="text-[10px] text-gray-400 italic mt-0.5 line-clamp-1">«{ev.source_text}»</p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(ev)}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
          title="Modifica"
        >
          <Edit2 className="w-3 h-3" />
        </button>
        <button
          onClick={() => onDelete(ev.id)}
          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
          title="Elimina"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClinicalTimelineManager({ patientId }) {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("tutti");
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSet, setMergeSet]   = useState(new Set());
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // null = new event
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);
  const [deleteId, setDeleteId]   = useState(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeKeepId, setMergeKeepId]         = useState(null);
  const [mergeSaving, setMergeSaving]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clinicalEventsApi.list(patientId);
      const list = Array.isArray(data) ? data : [];
      if (process.env.NODE_ENV !== "production") {
        console.log("[timeline][reload] eventi caricati dal DB:", list.length);
      }
      setEvents(list);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const displayed = events.filter(e => filter === "tutti" || categoriaOf(e) === filter);
  const dated   = [...displayed.filter(e => e.date_value)].sort((a, b) => a.date_value.localeCompare(b.date_value));
  const undated = displayed.filter(e => !e.date_value);

  const yearGroups = {};
  dated.forEach(e => {
    const y = e.date_value.substring(0, 4);
    if (!yearGroups[y]) yearGroups[y] = [];
    yearGroups[y].push(e);
  });
  const years = Object.keys(yearGroups).sort();

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openAdd() {
    setEditingEvent(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(ev) {
    setEditingEvent(ev);
    setForm({
      ...EMPTY_FORM,
      ...ev,
      _dateRaw: displayDateInput(ev.date_value, ev.date_precision),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.event_type) return;
    setSaving(true);
    try {
      const { _dateRaw, ...payload } = form;
      if (!payload.date_value) payload.date_value = null;
      // Clean empty strings
      Object.keys(payload).forEach(k => {
        if (payload[k] === "") payload[k] = null;
      });
      payload.categoria = CATEGORIA_FROM_TYPE[payload.event_type] || "altro";

      if (editingEvent) {
        await clinicalEventsApi.update(patientId, editingEvent.id, payload);
        toast.success("Evento aggiornato");
      } else {
        payload.source_origin = payload.source_origin || "inserimento_manuale";
        await clinicalEventsApi.create(patientId, { ...payload, patient_id: patientId });
        toast.success("Evento aggiunto alla timeline");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await clinicalEventsApi.remove(patientId, id);
      toast.success("Evento eliminato");
      setDeleteId(null);
      await load();
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  }

  function toggleMerge(id) {
    setMergeSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 2) {
        next.add(id);
      } else {
        toast.info("Seleziona al massimo 2 eventi da unire");
      }
      return next;
    });
  }

  function openMergeDialog() {
    const [id1] = Array.from(mergeSet);
    setMergeKeepId(id1);
    setMergeDialogOpen(true);
  }

  async function handleMerge() {
    if (!mergeKeepId) return;
    const [id1, id2] = Array.from(mergeSet);
    const discardId = mergeKeepId === id1 ? id2 : id1;
    const keepEv    = events.find(e => e.id === mergeKeepId);
    const discardEv = events.find(e => e.id === discardId);
    if (!keepEv || !discardEv) return;

    setMergeSaving(true);
    try {
      // Merge discarded event's detail into kept event
      const mergedDetail = [keepEv.detail, discardEv.detail].filter(Boolean).join(" | ") || null;
      const mergedSource = [keepEv.source_text, discardEv.source_text].filter(Boolean).join(" | ") || null;
      await clinicalEventsApi.update(patientId, mergeKeepId, {
        detail: mergedDetail,
        source_text: mergedSource,
      });
      await clinicalEventsApi.remove(patientId, discardId);
      toast.success("Eventi uniti");
      setMergeDialogOpen(false);
      setMergeMode(false);
      setMergeSet(new Set());
      await load();
    } catch {
      toast.error("Errore nell'unione degli eventi");
    } finally {
      setMergeSaving(false);
    }
  }

  const mergeArr = Array.from(mergeSet);
  const mergeEv1 = events.find(e => e.id === mergeArr[0]);
  const mergeEv2 = events.find(e => e.id === mergeArr[1]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Caricamento timeline...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {CATEGORIA_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                filter === t.value
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setMergeMode(m => !m); setMergeSet(new Set()); }}
            className={`text-[11px] font-medium px-2.5 py-1 rounded border transition-colors ${
              mergeMode ? "bg-amber-50 text-amber-700 border-amber-300" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="flex items-center gap-1">
              <Merge className="w-3 h-3" /> {mergeMode ? "Annulla selezione" : "Unisci"}
            </span>
          </button>
          {mergeMode && mergeSet.size === 2 && (
            <Button size="sm" className="h-7 text-[11px] bg-amber-600 hover:bg-amber-700" onClick={openMergeDialog}>
              Unisci selezionati ({mergeSet.size})
            </Button>
          )}
          <Button size="sm" className="h-7 text-[11px]" onClick={openAdd}>
            <Plus className="w-3 h-3 mr-1" /> Aggiungi evento
          </Button>
        </div>
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
          <AlertCircle className="w-6 h-6 text-gray-300" />
          <p className="text-sm">Nessun evento nella timeline</p>
          <p className="text-xs text-gray-400">Aggiungi eventi manualmente o importa da testo/PDF</p>
        </div>
      )}

      {events.length > 0 && displayed.length === 0 && (
        <div className="text-center py-6 text-sm text-gray-400">
          Nessun evento per la categoria selezionata
        </div>
      )}

      {/* ── Dated timeline ───────────────────────────────────────────────────── */}
      {years.length > 0 && (
        <div className="space-y-0">
          {years.map(year => (
            <div key={year} className="relative">
              {/* Year separator */}
              <div className="flex items-center gap-2 mb-1 mt-2">
                <span className="text-[11px] font-bold font-mono text-gray-400 bg-white pr-1.5">{year}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              {/* Events in this year */}
              <div className="relative pl-4">
                <div className="absolute left-[5px] top-0 bottom-0 w-px bg-gray-100" />
                <div className="space-y-0.5">
                  {yearGroups[year].map(ev => (
                    <EventRow
                      key={ev.id}
                      ev={ev}
                      mergeMode={mergeMode}
                      mergeSet={mergeSet}
                      onToggleMerge={toggleMerge}
                      onEdit={openEdit}
                      onDelete={setDeleteId}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Undated section ──────────────────────────────────────────────────── */}
      {undated.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5 mt-2">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 flex-shrink-0">
              Senza data ({undated.length})
            </span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>
          <div className="space-y-0.5 pl-2">
            {undated.map(ev => (
              <EventRow
                key={ev.id}
                ev={ev}
                mergeMode={mergeMode}
                mergeSet={mergeSet}
                onToggleMerge={toggleMerge}
                onEdit={openEdit}
                onDelete={setDeleteId}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Add / Edit dialog ─────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingEvent ? "Modifica evento" : "Aggiungi evento"}
            </DialogTitle>
          </DialogHeader>
          <EventForm form={form} onChange={setForm} />
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annulla
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.event_type}>
              {saving && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
              {editingEvent ? "Salva modifiche" : "Aggiungi evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Elimina evento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Sei sicuro di voler eliminare questo evento dalla timeline? L&apos;operazione non è reversibile.
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Annulla</Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(deleteId)}>
              <Trash2 className="w-3 h-3 mr-1.5" /> Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Merge dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={mergeDialogOpen} onOpenChange={open => { if (!open) setMergeDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Unisci eventi</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500 mb-3">
            Scegli quale evento mantenere. Le note dell&apos;altro verranno aggiunte alla descrizione e l&apos;evento duplicato verrà eliminato.
          </p>
          {[mergeEv1, mergeEv2].filter(Boolean).map(ev => (
            <label
              key={ev.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors mb-2 ${
                mergeKeepId === ev.id ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="mergeKeep"
                value={ev.id}
                checked={mergeKeepId === ev.id}
                onChange={() => setMergeKeepId(ev.id)}
                className="mt-0.5 accent-indigo-600"
              />
              <div>
                <p className="text-xs font-semibold text-gray-700">{eventSummary(ev)}</p>
                {ev.detail && <p className="text-[11px] text-gray-500 mt-0.5">{ev.detail}</p>}
              </div>
            </label>
          ))}
          <DialogFooter className="gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setMergeDialogOpen(false)} disabled={mergeSaving}>
              Annulla
            </Button>
            <Button size="sm" onClick={handleMerge} disabled={!mergeKeepId || mergeSaving}>
              {mergeSaving && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
              Conferma unione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
