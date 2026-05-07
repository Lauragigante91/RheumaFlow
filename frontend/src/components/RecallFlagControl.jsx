import React, { useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Star, Eye, Users, X, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { toast } from "sonner";
import { patientsApi } from "../lib/api";

/**
 * 3-state recall flag for a patient:
 *   - flag = null      → niente
 *   - flag = "private" → stellina BLU (visibile solo a me)
 *   - flag = "shared"  → stellina ROSSA (visibile a tutti dell'organizzazione)
 *
 * Renders as a single icon button next to the patient name; clicking opens
 * a popover with state selector + optional note. After save, the patient
 * detail is reloaded by the parent.
 */

const STATES = [
  { value: null, label: "Niente", description: "Rimuovi il flag", icon: null, badge: null },
  {
    value: "private",
    label: "Solo per me",
    description: "Visibile solo a te in 'Pazienti da ricontrollare'",
    icon: Eye,
    badge: "bg-blue-100 text-blue-800 border-blue-300",
  },
  {
    value: "shared",
    label: "Per tutti",
    description: "Visibile a tutti i membri dell'organizzazione",
    icon: Users,
    badge: "bg-red-100 text-red-800 border-red-300",
  },
];

function StarIcon({ flag, className = "w-4 h-4" }) {
  if (flag === "shared") return <Star className={`${className} fill-red-500 text-red-500`} />;
  if (flag === "private") return <Star className={`${className} fill-blue-500 text-blue-500`} />;
  return <Star className={`${className} text-gray-300`} />;
}

export default function RecallFlagControl({ patient, onChanged }) {
  const recall = patient?.recall || null;
  const [open, setOpen] = useState(false);
  const [flag, setFlag] = useState(recall?.flag || null);
  const [note, setNote] = useState(recall?.note || "");
  const [saving, setSaving] = useState(false);

  // Reset state when popover opens
  const handleOpenChange = (v) => {
    setOpen(v);
    if (v) {
      setFlag(recall?.flag || null);
      setNote(recall?.note || "");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await patientsApi.setRecall(patient.id, { flag: flag || null, note });
      toast.success(flag ? "Paziente flaggato per ricontrollo" : "Flag rimosso");
      setOpen(false);
      if (onChanged) onChanged();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore");
    } finally {
      setSaving(false);
    }
  };

  const currentLabel = recall?.flag === "shared"
    ? "Da ricontrollare (tutti)"
    : recall?.flag === "private"
      ? "Da ricontrollare (solo me)"
      : "Segna da ricontrollare";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={
            recall?.flag === "shared" ? "border-red-300 text-red-700 hover:bg-red-50"
              : recall?.flag === "private" ? "border-blue-300 text-blue-700 hover:bg-blue-50"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
          }
          data-testid="recall-flag-btn"
          title={currentLabel}
        >
          <StarIcon flag={recall?.flag} className="w-4 h-4 mr-1.5" />
          <span className="text-xs font-medium">
            {recall?.flag === "shared" ? "Ricontrollo" : recall?.flag === "private" ? "Ricontrollo" : "Ricontrollo"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" data-testid="recall-flag-popover">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-heading font-bold text-base flex items-center gap-2">
            <StarIcon flag={flag} /> Pazienti da ricontrollare
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Flagga questo paziente per farlo apparire nella tua dashboard.
          </p>
        </div>
        <div className="p-3 space-y-1.5">
          {STATES.map((s) => {
            const Icon = s.icon;
            const isActive = (s.value || null) === (flag || null);
            return (
              <button
                key={s.value || "none"}
                type="button"
                onClick={() => setFlag(s.value)}
                className={`w-full flex items-start gap-2 px-3 py-2 rounded-md border text-left transition ${
                  isActive
                    ? "border-[#0A2540] bg-[#0A2540]/5"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
                data-testid={`recall-state-${s.value || "none"}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {s.value === null ? <X className="w-4 h-4 text-gray-400" /> : <StarIcon flag={s.value} />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[#0A2540] flex items-center gap-1.5">
                    {s.label}
                    {Icon && <Icon className="w-3 h-3 text-gray-500" />}
                  </div>
                  <div className="text-[11px] text-gray-500 leading-snug">{s.description}</div>
                </div>
                {isActive && (
                  <span className={`text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded font-bold ${s.badge || "bg-gray-100 text-gray-700"}`}>
                    selezionato
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {flag && (
          <div className="px-4 pb-3">
            <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-600 mb-1 inline-flex items-center gap-1.5">
              <Pencil className="w-3 h-3" /> Motivo del ricontrollo
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Es. Verificare risposta a Methotrexate dopo 3 mesi; chiamare lo specialista oculista; ecc."
              rows={3}
              className="text-sm"
              data-testid="recall-note-textarea"
            />
            {recall?.set_at && recall.flag === flag && (
              <div className="text-[10px] text-gray-500 mt-1.5">
                Flaggato da <span className="font-semibold">{recall.set_by_name || "—"}</span> il{" "}
                {new Date(recall.set_at).toLocaleDateString("it-IT")} alle{" "}
                {new Date(recall.set_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.
              </div>
            )}
          </div>
        )}
        <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} data-testid="recall-cancel-btn">
            Annulla
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving}
            className="bg-[#0A2540] text-white hover:bg-[#051626]"
            data-testid="recall-save-btn"
          >
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Small inline star badge — used in the Dashboard widget.
export function RecallBadge({ flag, className = "w-3.5 h-3.5" }) {
  return <StarIcon flag={flag} className={className} />;
}
