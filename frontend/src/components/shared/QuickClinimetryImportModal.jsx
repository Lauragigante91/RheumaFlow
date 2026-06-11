/**
 * QuickClinimetryImportModal
 *
 * Shown when a physician selects text containing pre-calculated clinimetric
 * scores (e.g. "DAS28-PCR 3.2 – ESSDAI 4") from a previous report.
 *
 * Features:
 *  • Auto-detects all clinimetric scores in the selected text
 *  • Allows confirming / changing index_type and score for each hit
 *  • Saves as assessments with inputs.imported = true (visually distinct in timeline)
 *  • Stores original source text for later reference
 *
 * Props:
 *   open         boolean
 *   onClose      () => void
 *   sourceText   string   — selected text passage
 *   patientId    string
 *   visitDate    string   — ISO date (default: today)
 *   onSaved      () => void
 */

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AlertCircle, BarChart2, CheckCircle2, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { assessmentsApi } from "../../lib/api";
import { parseClinimetryFromText, IMPORTABLE_INDICES } from "../../lib/clinimetryTextParser";
import ItalianDatePicker from "./ItalianDatePicker";
import {
  interpretDAS28,
  interpretCDAI,
  interpretSDAI,
  interpretASDAS,
  interpretDAPSA,
} from "../../lib/clinimetrics";

// ── Auto-interpret score for known indices ───────────────────────────────────
function autoInterpret(index_type, score) {
  if (score == null || isNaN(score)) return "";
  try {
    switch (index_type) {
      case "das28_crp":
      case "das28_esr":
        return interpretDAS28(score) || "";
      case "cdai":
        return interpretCDAI(score) || "";
      case "sdai":
        return interpretSDAI(score) || "";
      case "asdas_crp":
        return interpretASDAS(score) || "";
      case "dapsa":
        return interpretDAPSA(score) || "";
      default:
        return "";
    }
  } catch {
    return "";
  }
}

const SOURCE_TYPES = [
  { value: "previous_report",     label: "Referto precedente" },
  { value: "raccordo_anamnestico",label: "Raccordo anamnestico" },
  { value: "external_report",     label: "Referto esterno / altra struttura" },
  { value: "discharge_letter",    label: "Lettera di dimissione" },
  { value: "selected_text",       label: "Testo selezionato (generico)" },
];

export default function QuickClinimetryImportModal({
  open,
  onClose,
  sourceText = "",
  patientId,
  visitDate,
  onSaved,
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [items,       setItems]      = useState([]);   // detected + edited items
  const [date,        setDate]       = useState("");
  const [sourceType,  setSourceType] = useState("previous_report");
  const [notes,       setNotes]      = useState("");
  const [saving,      setSaving]     = useState(false);

  // ── Parse on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const { items: detected } = parseClinimetryFromText(sourceText);
    setItems(
      detected.length > 0
        ? detected.map(d => ({ ...d, enabled: true, scoreStr: String(d.score) }))
        : [{ index_type: "", label: "", score: null, scoreStr: "", enabled: true, ambiguous: false, raw_match: "" }]
    );
    setDate(visitDate || "");
    setSourceType("previous_report");
    setNotes("");
  }, [open, sourceText, visitDate]);

  // ── Item helpers ───────────────────────────────────────────────────────────
  const toggleItem = (i) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, enabled: !it.enabled } : it));

  const updateItem = (i, patch) =>
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, ...patch };
      // Update label from IMPORTABLE_INDICES when index_type changes
      if (patch.index_type) {
        const found = IMPORTABLE_INDICES.find(x => x.value === patch.index_type);
        if (found) next.label = found.label;
      }
      return next;
    }));

  const addBlankItem = () =>
    setItems(prev => [...prev, { index_type: "", label: "", score: null, scoreStr: "", enabled: true, ambiguous: false, raw_match: "" }]);

  const removeItem = (i) =>
    setItems(prev => prev.filter((_, idx) => idx !== i));

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const toSave = items.filter(it => it.enabled && it.index_type && it.scoreStr !== "");
    if (toSave.length === 0) {
      toast.error("Seleziona almeno un indice da salvare con tipo e valore");
      return;
    }
    if (!patientId) {
      toast.error("Paziente non identificato");
      return;
    }
    const saveDate = date || today;

    setSaving(true);
    try {
      await Promise.all(
        toSave.map(it => {
          const score = parseFloat(String(it.scoreStr).replace(",", "."));
          const interpretation = autoInterpret(it.index_type, score);
          return assessmentsApi.create({
            patient_id:     patientId,
            date:           saveDate,
            index_type:     it.index_type,
            score:          isNaN(score) ? null : score,
            interpretation: interpretation || "",
            inputs: {
              imported:          true,
              source_type:       sourceType,
              source_text:       sourceText || "",
              raw_match:         it.raw_match || it.scoreStr,
              notes:             notes || "",
            },
            notes: notes || "",
          });
        })
      );

      const names = toSave.map(it => it.label || it.index_type).join(", ");
      toast.success(`${toSave.length} valore/i importati: ${names}`);
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const hasDetected = items.some(it => it.raw_match);
  const activeCount = items.filter(it => it.enabled && it.index_type && it.scoreStr !== "").length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="w-4 h-4 text-[#0A2540]" />
            Importa clinimetria da testo
          </DialogTitle>
        </DialogHeader>

        {/* Source text */}
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 italic leading-snug max-h-16 overflow-y-auto">
          «{sourceText}»
        </div>

        {/* Detection result header */}
        {hasDetected ? (
          <div className="flex items-center gap-1.5 text-[11px] text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {items.filter(it => it.raw_match).length} valore/i clinimetrici riconosciuti — verifica e conferma
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
            <AlertCircle className="w-3.5 h-3.5" />
            Nessun valore riconosciuto automaticamente — inserisci manualmente
          </div>
        )}

        {/* Items list */}
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {items.map((it, i) => (
            <div
              key={i}
              className={`rounded-lg border px-3 py-2 transition-all ${
                it.enabled
                  ? "border-[#0A2540]/20 bg-[#0A2540]/2"
                  : "border-gray-200 bg-gray-50 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Enable toggle */}
                <input
                  type="checkbox"
                  checked={it.enabled}
                  onChange={() => toggleItem(i)}
                  className="w-3.5 h-3.5 accent-[#0A2540] flex-shrink-0"
                />

                {/* Index type selector */}
                <div className="relative flex-1 min-w-0">
                  <select
                    value={it.index_type}
                    onChange={e => updateItem(i, { index_type: e.target.value })}
                    disabled={!it.enabled}
                    className="w-full h-7 rounded border border-input bg-background px-2 text-xs appearance-none pr-6"
                  >
                    <option value="">— scegli tipo —</option>
                    {IMPORTABLE_INDICES.map(idx => (
                      <option key={idx.value} value={idx.value}>
                        {idx.label} ({idx.disease})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>

                {/* Score input */}
                <Input
                  value={it.scoreStr}
                  onChange={e => updateItem(i, { scoreStr: e.target.value })}
                  disabled={!it.enabled}
                  placeholder="es. 3.2"
                  className="w-20 h-7 text-xs font-mono text-center flex-shrink-0"
                />

                {/* Auto-interpretation preview */}
                {it.enabled && it.index_type && it.scoreStr && (
                  <span className="text-[10px] text-gray-500 flex-shrink-0 max-w-[80px] truncate">
                    {autoInterpret(it.index_type, parseFloat(String(it.scoreStr).replace(",", ".")))}
                  </span>
                )}

                {/* Ambiguous hint */}
                {it.ambiguous && it.enabled && (
                  <span title="Tipo riconosciuto automaticamente — verifica">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  </span>
                )}

                {/* Remove */}
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Raw match badge */}
              {it.raw_match && (
                <div className="mt-1 ml-5">
                  <span className="text-[10px] text-gray-400">
                    da testo: <span className="font-mono text-gray-600">"{it.raw_match}"</span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add another */}
        <button
          type="button"
          onClick={addBlankItem}
          className="text-[11px] text-[#0A2540]/60 hover:text-[#0A2540] flex items-center gap-1 w-fit"
        >
          + Aggiungi valore manuale
        </button>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <Label className="text-xs">Data visita / referto di origine</Label>
            <ItalianDatePicker
              value={date}
              onChange={setDate}
              placeholder="dd/mm/yyyy"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fonte</Label>
            <div className="relative">
              <select
                value={sourceType}
                onChange={e => setSourceType(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs appearance-none pr-6"
              >
                {SOURCE_TYPES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Note (opzionali)</Label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="es. da visita reumatologica di altro centro, 02/2023"
              className="text-xs h-8"
            />
          </div>
        </div>

        {/* Imported flag notice */}
        <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-700 leading-snug">
            I valori saranno salvati come <strong>importati</strong> e appariranno nella timeline con un badge distinto. Il testo originale viene conservato.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || activeCount === 0}
            className="bg-[#0A2540] hover:bg-[#051626] text-white"
          >
            {saving
              ? "Salvataggio…"
              : `Importa ${activeCount > 0 ? activeCount : ""} valore${activeCount !== 1 ? "i" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
