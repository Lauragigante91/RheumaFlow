/**
 * FindingProfileUpdateModal
 *
 * Opens when the user clicks "→ Profilo malattia" on a saved instrumental finding.
 * Pre-fills the relevant disease-profile section from the finding's structured_values
 * and lets the user confirm / edit before saving.
 *
 * Props:
 *   open        boolean
 *   onClose     () => void
 *   assessment  object  — the saved Assessment record
 *   patient     object  — full patient object { id, diagnosi, … }
 *   onUpdated   () => void  — called after successful save
 */

import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { CheckCircle2, Loader2, ArrowRight, Dna } from "lucide-react";
import { toast } from "sonner";
import {
  getProfileMapping,
  STRUCTURED_TO_PROFILE_MAP,
  writeToProfile,
} from "../labs/InstrumentalFindingModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: "10px", fontWeight: 700, color: "#6b7280",
      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px",
    }}>
      {children}
    </div>
  );
}

// ─── Profile field renderer ───────────────────────────────────────────────────

function ProfileField({ field, value, onChange, visitDate }) {
  return (
    <div>
      <FieldLabel>{field.label}</FieldLabel>

      {field.type === "number" && (
        <Input
          type="number"
          value={value ?? ""}
          onChange={e => onChange(field.key, e.target.value === "" ? null : Number(e.target.value))}
          placeholder={field.placeholder || ""}
          style={{ fontSize: "13px" }}
        />
      )}

      {field.type === "select" && (
        <select
          value={value || ""}
          onChange={e => onChange(field.key, e.target.value || null)}
          style={{
            width: "100%", fontSize: "13px",
            border: "1px solid #d1d5db", borderRadius: "6px",
            padding: "6px 10px", background: "#fff", color: "#374151",
          }}
        >
          <option value="">— seleziona —</option>
          {(field.options || []).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      {field.type === "date" && (
        <input
          type="date"
          value={value || visitDate || ""}
          onChange={e => onChange(field.key, e.target.value || null)}
          style={{
            fontSize: "13px", border: "1px solid #d1d5db",
            borderRadius: "6px", padding: "6px 10px",
            background: "#fff", color: "#374151", width: "100%",
          }}
        />
      )}

      {field.type === "boolean" && (
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(field.key, e.target.checked)}
            style={{ width: "15px", height: "15px", cursor: "pointer" }}
          />
          <span style={{ fontSize: "12px", color: "#374151" }}>
            Sì — aggiorna nel profilo di malattia
          </span>
        </label>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function FindingProfileUpdateModal({
  open, onClose, assessment, patient, onUpdated,
}) {
  const [values,  setValues]  = useState({});
  const [saving,  setSaving]  = useState(false);

  const examType = assessment?.exam_type || assessment?.inputs?.exam_type || assessment?.index_type || "";
  const mapping  = getProfileMapping(examType, patient);

  // Pre-fill from structured_values when modal opens
  useEffect(() => {
    if (!open || !assessment || !mapping) return;

    const sv      = assessment.structured_values || assessment.inputs?.structured_values || {};
    const syncMap = STRUCTURED_TO_PROFILE_MAP[examType] || {};
    const pre     = {};

    // Map structured values → profile keys
    for (const [sKey, pKey] of Object.entries(syncMap)) {
      const v = sv[sKey];
      if (v !== undefined && v !== null && v !== "") {
        pre[pKey] = typeof v === "string" ? Number(v) || v : v;
      }
    }

    // Capillaroscopy pattern (select, not numeric)
    if (examType === "capillaroscopy" && sv.pattern) {
      pre.capillo_pattern = sv.pattern;
    }

    // Default date fields to the finding's date
    for (const field of mapping.fields) {
      if (field.type === "date" && !pre[field.key]) {
        pre[field.key] = assessment.exam_date || assessment.date || new Date().toISOString().slice(0, 10);
      }
      if (field.type === "boolean" && pre[field.key] === undefined) {
        pre[field.key] = false;
      }
    }

    setValues(pre);
  }, [open, assessment?.id]); // eslint-disable-line

  if (!mapping) return null;

  function handleChange(key, val) {
    setValues(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await writeToProfile(mapping, values, patient?.id);
      toast.success("Profilo malattia aggiornato", {
        description: `${mapping.sectionLabel} — salvato dal referto del ${fmtDate(assessment?.exam_date || assessment?.date)}`,
      });
      onUpdated?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Errore nel salvataggio del profilo");
    } finally {
      setSaving(false);
    }
  }

  const hasValues = Object.values(values).some(
    v => v !== null && v !== undefined && v !== "" && v !== false
  );

  const sv = assessment?.structured_values || assessment?.inputs?.structured_values || {};
  const prefilledKeys = Object.values(STRUCTURED_TO_PROFILE_MAP[examType] || {});

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        style={{ maxWidth: "480px", maxHeight: "90vh", overflowY: "auto" }}
        aria-describedby="finding-profile-desc"
      >
        <DialogHeader>
          <DialogTitle style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px" }}>
            <Dna size={16} color="#1d4ed8" />
            Aggiorna profilo malattia
          </DialogTitle>
          <p id="finding-profile-desc" style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
            Valori estratti dal referto del {fmtDate(assessment?.exam_date || assessment?.date)}. Verifica e salva nel profilo paziente.
          </p>
        </DialogHeader>

        {/* Breadcrumb */}
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "6px 10px", background: "#eff6ff", borderRadius: "8px",
          fontSize: "11px",
        }}>
          <span style={{ fontWeight: 700, color: "#1d4ed8" }}>{mapping.diseaseLabel}</span>
          <ArrowRight size={10} color="#93c5fd" />
          <span style={{ color: "#1d4ed8" }}>{mapping.sectionLabel}</span>
        </div>

        {/* Pre-filled notice */}
        {prefilledKeys.some(k => values[k] !== undefined && values[k] !== null && values[k] !== "") && (
          <div style={{
            fontSize: "11px", color: "#0369a1",
            background: "#f0f9ff", borderRadius: "6px",
            padding: "6px 10px", border: "1px solid #bae6fd",
          }}>
            I campi evidenziati sono stati pre-compilati dai valori strutturati del referto.
            Verificali prima di salvare.
          </div>
        )}

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {mapping.fields.map(field => (
            <div
              key={field.key}
              style={{
                background: prefilledKeys.includes(field.key) && values[field.key] !== undefined
                  ? "#f0f9ff"
                  : "transparent",
                borderRadius: "6px",
                padding: prefilledKeys.includes(field.key) && values[field.key] !== undefined
                  ? "8px 10px"
                  : "0",
                border: prefilledKeys.includes(field.key) && values[field.key] !== undefined
                  ? "1px solid #bae6fd"
                  : "none",
              }}
            >
              <ProfileField
                field={field}
                value={values[field.key]}
                onChange={handleChange}
                visitDate={assessment?.date}
              />
            </div>
          ))}
        </div>

        <DialogFooter style={{ gap: "8px", marginTop: "4px" }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasValues}
            style={{ background: "#1d4ed8", color: "#fff", minWidth: "140px" }}
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin mr-1" /> Salvataggio…</>
            ) : (
              <><CheckCircle2 size={14} style={{ marginRight: "6px" }} /> Salva nel profilo</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
