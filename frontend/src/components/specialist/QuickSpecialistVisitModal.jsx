/**
 * QuickSpecialistVisitModal
 *
 * "Save selection as specialist visit" — part of the selection workflow.
 *
 * Props:
 *   open        boolean
 *   onClose     () => void
 *   sourceText  string  — selected text (pre-filled as source_text + editable sintesi)
 *   patientId   string
 *   visitDate   string  — ISO date (pre-fill)
 *   onSaved     (visit) => void
 */

import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Stethoscope, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { specialistVisitsApi } from "../../lib/api";
import ItalianDatePicker from "../shared/ItalianDatePicker";

const SPECIALTIES = [
  { key: "neurologia",        label: "Neurologia" },
  { key: "cardiologia",       label: "Cardiologia" },
  { key: "pneumologia",       label: "Pneumologia" },
  { key: "dermatologia",      label: "Dermatologia" },
  { key: "gastroenterologia", label: "Gastroenterologia" },
  { key: "nefrologia",        label: "Nefrologia" },
  { key: "endocrinologia",    label: "Endocrinologia" },
  { key: "ortopedia",         label: "Ortopedia" },
  { key: "oculistica",        label: "Oculistica" },
  { key: "oncologia",         label: "Oncologia" },
  { key: "infettivologia",    label: "Infettivologia" },
  { key: "ginecologia",       label: "Ginecologia" },
  { key: "urologia",          label: "Urologia" },
  { key: "psichiatria",       label: "Psichiatria" },
  { key: "altro",             label: "Altra specialità" },
];

function FieldLabel({ children, required }) {
  return (
    <div style={{
      fontSize: "10px", fontWeight: 700, color: "#6b7280",
      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px",
    }}>
      {children}
      {required && <span style={{ color: "#ef4444", marginLeft: "3px" }}>*</span>}
    </div>
  );
}

export default function QuickSpecialistVisitModal({
  open, onClose, sourceText, patientId, visitDate, onSaved,
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [specialty,  setSpecialty]  = useState("");
  const [visitType,  setVisitType]  = useState("");
  const [sintesi,    setSintesi]    = useState("");
  const [date,       setDate]       = useState(visitDate || today);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (open) {
      setSpecialty("");
      setVisitType("");
      setSintesi("");
      setDate(visitDate || today);
    }
  }, [open]); // eslint-disable-line

  function handleSpecialtyPick(key) {
    setSpecialty(key);
    const meta = SPECIALTIES.find(s => s.key === key);
    if (meta && !visitType) {
      setVisitType(`Visita ${meta.label.toLowerCase()}`);
    }
  }

  async function handleSave() {
    if (!patientId) { toast.error("ID paziente mancante"); return; }
    if (!visitType.trim()) { toast.error("Specifica il tipo di visita"); return; }

    setSaving(true);
    try {
      const saved = await specialistVisitsApi.create({
        patient_id:  patientId,
        visit_date:  date,
        visit_type:  visitType.trim(),
        specialty:   specialty || null,
        source_text: sourceText || null,
        sintesi:     sintesi.trim() || null,
      });
      toast.success("Visita specialistica salvata in cartella");
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        style={{ maxWidth: "520px", maxHeight: "90vh", overflowY: "auto" }}
        aria-describedby="qsvm-desc"
      >
        <DialogHeader>
          <DialogTitle style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px" }}>
            <Stethoscope size={16} color="#0f766e" />
            Salva visita specialistica
          </DialogTitle>
          <p id="qsvm-desc" style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
            Seleziona la specialità, verifica il referto e salva in cartella.
          </p>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "4px" }}>

          {/* Source text preview */}
          <div>
            <FieldLabel>Testo selezionato (referto)</FieldLabel>
            <div style={{
              fontFamily: "monospace", fontSize: "11px", color: "#374151",
              background: "#f9fafb", border: "1px solid #e5e7eb",
              borderRadius: "6px", padding: "7px 10px",
              lineHeight: "1.6", wordBreak: "break-word",
              maxHeight: "96px", overflowY: "auto",
            }}>
              "{sourceText}"
            </div>
          </div>

          {/* Specialty pills */}
          <div>
            <FieldLabel>Specialità</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {SPECIALTIES.map(s => {
                const sel = s.key === specialty;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => handleSpecialtyPick(s.key)}
                    style={{
                      display: "inline-flex", alignItems: "center",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      border: `1.5px solid ${sel ? "#0f766e" : "#d1d5db"}`,
                      background: sel ? "#f0fdfa" : "#fff",
                      color: sel ? "#0f766e" : "#6b7280",
                      fontSize: "11px", fontWeight: sel ? 700 : 400,
                      cursor: "pointer", transition: "all 0.12s",
                      boxShadow: sel ? "0 0 0 2px #0f766e33" : "none",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visit type */}
          <div>
            <FieldLabel required>Tipo di visita / etichetta</FieldLabel>
            <input
              type="text"
              value={visitType}
              onChange={e => setVisitType(e.target.value)}
              placeholder="es. Visita neurologica, Consulenza dermatologica…"
              style={{
                width: "100%", fontSize: "13px",
                border: "1px solid #d1d5db", borderRadius: "6px",
                padding: "6px 10px", background: "#fff", color: "#374151",
              }}
            />
          </div>

          {/* Date */}
          <div>
            <FieldLabel>Data della visita</FieldLabel>
            <ItalianDatePicker value={date} onChange={setDate} />
          </div>

          {/* Sintesi */}
          <div>
            <FieldLabel>Sintesi / conclusioni (opzionale)</FieldLabel>
            <Textarea
              value={sintesi}
              onChange={e => setSintesi(e.target.value)}
              placeholder="Conclusione della visita, raccomandazioni, follow-up proposto…"
              style={{ fontSize: "12px", minHeight: "60px", resize: "vertical" }}
            />
          </div>

        </div>

        <DialogFooter style={{ gap: "8px", marginTop: "8px" }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !visitType.trim()}
            style={{ background: "#0f766e", color: "#fff", minWidth: "150px" }}
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin mr-1" /> Salvataggio…</>
              : <><CheckCircle2 size={14} style={{ marginRight: "6px" }} /> Salva visita</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
