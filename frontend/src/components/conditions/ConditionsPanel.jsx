import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, ChevronDown, ChevronUp, Clock, Edit2,
  Plus, Search, Shield, Trash2, X, Check, Tag,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { conditionsApi } from "../../lib/api";
import {
  buildConditionFromLabel,
  buildCustomCondition,
  CANONICAL_MAP,
  COMORBIDITY_CATEGORIES,
  FREQUENT_CONDITIONS,
  getConditionFlags,
  isMultiInstance,
  matchesConditionSearch,
  resolveCanonical,
} from "../../lib/conditions";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "active",     label: "Attiva" },
  { value: "historical", label: "Pregressa" },
  { value: "latent",     label: "Latente" },
  { value: "resolved",   label: "Risolta" },
];

const RELEVANCE_OPTIONS = [
  { value: "high",   label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low",    label: "Bassa" },
];

// Flags that warrant a visual warning indicator
const WARNING_FLAGS = new Set([
  "requires_pre_biologic_screening",
  "contraindication_anti_tnf",
  "contraindication_most_biologics",
  "contraindication_some_biologics",
  "anti_tnf_caution",
  "many_drug_contraindications",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusMeta(status) {
  switch (status) {
    case "active":
      return { label: "Attiva",    cls: "bg-blue-50 text-blue-700 border-blue-200" };
    case "historical":
      return { label: "Pregressa", cls: "bg-gray-100 text-gray-500 border-gray-200" };
    case "latent":
      return { label: "Latente",   cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "resolved":
      return { label: "Risolta",   cls: "bg-green-50 text-green-700 border-green-200" };
    default:
      return { label: status,      cls: "bg-gray-100 text-gray-500 border-gray-200" };
  }
}

function relevanceMeta(rel) {
  switch (rel) {
    case "high":   return { label: "Rilevanza alta",   cls: "bg-red-50 text-red-600" };
    case "medium": return { label: "Rilevanza media",  cls: "bg-orange-50 text-orange-600" };
    default:       return { label: "Rilevanza bassa",  cls: "bg-gray-50 text-gray-400" };
  }
}

function hasWarningFlags(flags = []) {
  return flags.some((f) => WARNING_FLAGS.has(f));
}

function categoryLabel(key) {
  return COMORBIDITY_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const m = statusMeta(status);
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${m.cls}`}>
      {m.label}
    </span>
  );
}

// ─── FlagWarning ─────────────────────────────────────────────────────────────

function FlagWarning({ flags = [] }) {
  const warnings = flags.filter((f) => WARNING_FLAGS.has(f));
  if (!warnings.length) return null;
  const tip = warnings.map((f) => f.replace(/_/g, " ")).join(", ");
  return (
    <span title={tip} className="inline-flex items-center">
      <AlertTriangle className="w-3 h-3 text-amber-500" />
    </span>
  );
}

// ─── ConditionRow ─────────────────────────────────────────────────────────────

function ConditionRow({ condition, onEdit, onDelete, deleting }) {
  const { label, status, onset_date, note, relevance_to_rheumatology, flags = [], canonical_name } = condition;
  const isCustom = canonical_name?.startsWith("custom_");

  return (
    <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors group">
      {/* Status dot */}
      <span
        className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
          status === "active" ? "bg-blue-500" :
          status === "latent" ? "bg-amber-400" :
          status === "resolved" ? "bg-green-500" : "bg-gray-300"
        }`}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-[12px] font-medium text-gray-800 leading-tight">{label}</span>
          <StatusBadge status={status} />
          <FlagWarning flags={flags} />
          {isCustom && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 border border-dashed border-gray-200 px-1.5 py-0.5 rounded">
              <Tag className="w-2.5 h-2.5" /> personalizzata
            </span>
          )}
          {relevance_to_rheumatology === "high" && (
            <span className={`text-[10px] px-1 py-0.5 rounded ${relevanceMeta("high").cls}`}>
              rilevante
            </span>
          )}
        </div>
        {(onset_date || note) && (
          <div className="mt-0.5 flex flex-wrap gap-2">
            {onset_date && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <Clock className="w-3 h-3" />
                {onset_date}
              </span>
            )}
            {note && (
              <span className="text-[11px] text-gray-400 italic truncate max-w-xs">{note}</span>
            )}
          </div>
        )}
      </div>

      {/* Actions (appear on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          type="button"
          onClick={() => onEdit(condition)}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          title="Modifica"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(condition._id)}
          disabled={deleting === condition._id}
          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
          title="Elimina"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({ condition, open, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (condition) {
      setForm({
        status:                    condition.status ?? "active",
        onset_date:                condition.onset_date ?? "",
        note:                      condition.note ?? "",
        relevance_to_rheumatology: condition.relevance_to_rheumatology ?? "low",
        flags:                     condition.flags ?? [],
      });
    }
  }, [condition]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await conditionsApi.update(condition._id, {
        status:                    form.status,
        onset_date:                form.onset_date || null,
        note:                      form.note || null,
        relevance_to_rheumatology: form.relevance_to_rheumatology,
      });
      toast.success("Condizione aggiornata.");
      onSaved();
      onClose();
    } catch {
      toast.error("Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const knownFlags = condition ? getConditionFlags(condition.canonical_name) : [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-[#0A2540]">
            Modifica condizione
          </DialogTitle>
          {condition && (
            <p className="text-xs text-gray-500 mt-0.5">{condition.label}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Stato</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Relevance */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Rilevanza reumatologica</Label>
            <Select
              value={form.relevance_to_rheumatology}
              onValueChange={(v) => setForm((p) => ({ ...p, relevance_to_rheumatology: v }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELEVANCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Onset date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Data / anno di insorgenza</Label>
            <Input
              type="text"
              placeholder="es. 2019, 03/2021"
              value={form.onset_date ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, onset_date: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Note cliniche</Label>
            <textarea
              value={form.note ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              rows={3}
              placeholder="Dettagli clinici, decorso, trattamento correlato…"
              className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
            />
          </div>

          {/* Flags (read-only, informational) */}
          {knownFlags.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">
                <Shield className="w-3 h-3 inline mr-1 text-amber-500" />
                Alert clinici associati
              </Label>
              <div className="flex flex-wrap gap-1">
                {knownFlags.map((f) => (
                  <span
                    key={f}
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      WARNING_FLAGS.has(f)
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                    }`}
                  >
                    {f.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-[#0A2540] hover:bg-[#051626] text-white"
          >
            {saving ? "Salvataggio…" : "Salva modifiche"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AddPanel ────────────────────────────────────────────────────────────────

function AddPanel({ patientId, onAdded, onClose }) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(null); // label being added
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filtered results across all categories
  const filtered = query.trim()
    ? COMORBIDITY_CATEGORIES.flatMap((cat) =>
        cat.items
          .filter((item) => matchesConditionSearch(item, query))
          .map((item) => ({ label: item, catKey: cat.key, catLabel: cat.label }))
      )
    : [];

  const handleAdd = async (label, catKey) => {
    setAdding(label);
    try {
      const payload = buildConditionFromLabel(label, patientId, "manual");
      await conditionsApi.upsert(payload);
      toast.success(`"${label}" aggiunta.`);
      onAdded();
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Errore nell'aggiunta.");
    } finally {
      setAdding(null);
    }
  };

  const handleAddCustom = async () => {
    if (!query.trim()) return;
    setAdding("__custom__");
    try {
      const payload = buildCustomCondition(query.trim(), patientId, "manual");
      await conditionsApi.upsert(payload);
      toast.success(`"${query.trim()}" aggiunta come condizione personalizzata.`);
      onAdded();
      setQuery("");
    } catch (e) {
      toast.error(e?.response?.data?.detail ?? "Errore nell'aggiunta.");
    } finally {
      setAdding(null);
    }
  };

  const handleFrequent = (item) => handleAdd(item.label, item.catKey);

  const noResults = query.trim() && filtered.length === 0;

  return (
    <div className="border border-blue-200 rounded-xl bg-blue-50/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#0A2540]">
          Aggiungi condizione
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-gray-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca condizione o sinonimo…"
          className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
      </div>

      {/* Search results */}
      {query.trim() && (
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {filtered.map((r) => (
            <button
              key={`${r.catKey}-${r.label}`}
              type="button"
              disabled={adding === r.label}
              onClick={() => handleAdd(r.label, r.catKey)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-gray-100 hover:border-blue-200 hover:bg-blue-50 text-left transition-colors group disabled:opacity-50"
            >
              <div>
                <span className="text-xs text-gray-800">{r.label}</span>
                <span className="ml-2 text-[10px] text-gray-400">{r.catLabel}</span>
              </div>
              <Plus className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
            </button>
          ))}

          {/* Custom entry option */}
          {noResults && (
            <button
              type="button"
              disabled={adding === "__custom__"}
              onClick={handleAddCustom}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-left transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span className="text-xs text-gray-700">
                Aggiungi <strong>"{query.trim()}"</strong> come condizione personalizzata
              </span>
            </button>
          )}
        </div>
      )}

      {/* Frequent conditions (shown when no query) */}
      {!query.trim() && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">
            Frequenti
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FREQUENT_CONDITIONS.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={adding === item.label}
                onClick={() => handleFrequent(item)}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-[#0A2540] hover:text-[#0A2540] transition-colors disabled:opacity-40"
              >
                {adding === item.label ? (
                  <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CategorySection ─────────────────────────────────────────────────────────

function CategorySection({ catKey, catLabel, items, onEdit, onDelete, deleting }) {
  const [expanded, setExpanded] = useState(true);

  if (!items.length) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 mb-2 group w-full text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">
          {catLabel}
        </span>
        <span className="text-[9px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
          {items.length}
        </span>
        {expanded
          ? <ChevronUp className="w-3 h-3 text-gray-300 ml-auto" />
          : <ChevronDown className="w-3 h-3 text-gray-300 ml-auto" />}
      </button>

      {expanded && (
        <div className="space-y-1.5 mb-1">
          {items.map((cond) => (
            <ConditionRow
              key={cond._id}
              condition={cond}
              onEdit={onEdit}
              onDelete={onDelete}
              deleting={deleting}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ConditionsPanel({ patient }) {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [showResolved, setShowResolved] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!patient?.id) return;
    setLoading(true);
    try {
      const data = await conditionsApi.list(patient.id);
      setConditions(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Errore nel caricamento delle condizioni.");
    } finally {
      setLoading(false);
    }
  }, [patient?.id]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Eliminare questa condizione?")) return;
    setDeleting(id);
    try {
      await conditionsApi.remove(id);
      setConditions((prev) => prev.filter((c) => c._id !== id));
      toast.success("Condizione eliminata.");
    } catch {
      toast.error("Errore nell'eliminazione.");
    } finally {
      setDeleting(null);
    }
  };

  // ── Group by category ────────────────────────────────────────────────────
  const active   = conditions.filter((c) => c.status !== "resolved");
  const resolved = conditions.filter((c) => c.status === "resolved");

  // Group active conditions by category, preserving COMORBIDITY_CATEGORIES order
  const grouped = COMORBIDITY_CATEGORIES.map((cat) => ({
    catKey:   cat.key,
    catLabel: cat.label,
    items:    active.filter((c) => c.category === cat.key),
  })).filter((g) => g.items.length > 0);

  // Custom / "other" category not in COMORBIDITY_CATEGORIES
  const knownKeys = new Set(COMORBIDITY_CATEGORIES.map((c) => c.key));
  const otherItems = active.filter((c) => !knownKeys.has(c.category));
  if (otherItems.length) {
    grouped.push({ catKey: "other", catLabel: "Altro", items: otherItems });
  }

  // ── Summary for header ───────────────────────────────────────────────────
  const totalActive   = active.length;
  const totalResolved = resolved.length;
  const highAlert     = conditions.filter((c) => hasWarningFlags(c.flags ?? []));

  return (
    <>
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        {/* ── Collapsible header ─────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-heading font-semibold text-xs text-gray-400 uppercase tracking-[0.15em]">
              Comorbidità / Condizioni
            </span>
            {!loading && conditions.length === 0 && (
              <span className="text-[11px] text-gray-400 font-normal normal-case italic">
                Nessuna registrata
              </span>
            )}
            {totalActive > 0 && (
              <span className="text-[11px] text-gray-500 font-normal normal-case">
                {totalActive} {totalActive === 1 ? "condizione attiva" : "condizioni attive"}
                {totalResolved > 0 && ` · ${totalResolved} risolta/e`}
              </span>
            )}
            {highAlert.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                {highAlert.length} alert
              </span>
            )}
          </div>
          {open
            ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        </button>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        {open && (
          <div className="p-5 space-y-5">

            {/* Add bar */}
            {!addOpen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(true)}
                className="text-xs h-8 border-dashed text-gray-500 hover:text-[#0A2540] hover:border-[#0A2540]"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Aggiungi condizione
              </Button>
            ) : (
              <AddPanel
                patientId={patient?.id}
                onAdded={() => { load(); setAddOpen(false); }}
                onClose={() => setAddOpen(false)}
              />
            )}

            {/* Loading */}
            {loading && (
              <div className="text-xs text-gray-400 text-center py-4">Caricamento…</div>
            )}

            {/* Empty state */}
            {!loading && conditions.length === 0 && (
              <div className="text-center py-6 text-gray-400">
                <Shield className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                <p className="text-xs">Nessuna condizione registrata per questo paziente.</p>
                <p className="text-[11px] mt-0.5 text-gray-300">
                  Usa "Aggiungi condizione" per iniziare.
                </p>
              </div>
            )}

            {/* Active / historical / latent conditions by category */}
            {!loading && grouped.length > 0 && (
              <div className="space-y-4">
                {grouped.map((g) => (
                  <CategorySection
                    key={g.catKey}
                    catKey={g.catKey}
                    catLabel={g.catLabel}
                    items={g.items}
                    onEdit={setEditItem}
                    onDelete={handleDelete}
                    deleting={deleting}
                  />
                ))}
              </div>
            )}

            {/* Resolved conditions (collapsible sub-section) */}
            {!loading && resolved.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowResolved((v) => !v)}
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors mb-2"
                >
                  {showResolved
                    ? <ChevronUp className="w-3 h-3" />
                    : <ChevronDown className="w-3 h-3" />}
                  Risolte ({resolved.length})
                </button>
                {showResolved && (
                  <div className="space-y-1.5 opacity-70">
                    {resolved.map((cond) => (
                      <ConditionRow
                        key={cond._id}
                        condition={cond}
                        onEdit={setEditItem}
                        onDelete={handleDelete}
                        deleting={deleting}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </Card>

      {/* ── Edit modal ──────────────────────────────────────────────────── */}
      <EditModal
        condition={editItem}
        open={!!editItem}
        onClose={() => setEditItem(null)}
        onSaved={load}
      />
    </>
  );
}
