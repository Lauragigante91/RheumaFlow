/**
 * QuickClinicalNoteModal
 *
 * "Save selection as clinical note" — second step of the selection workflow.
 *
 * The physician picks a type (problem, comorbidity, complication, history note,
 * therapy note, timeline event, follow-up reminder), optionally edits the text,
 * sets a date, and saves. Stored as an Assessment with index_type "clinical_note".
 *
 * Props:
 *   open        boolean
 *   onClose     () => void
 *   sourceText  string  — selected text (pre-filled in content, read-only preview)
 *   patientId   string
 *   visitDate   string  — ISO date (pre-fill)
 *   defaultType string  — pre-select a note type
 *   onSaved     (assessment) => void
 */

import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import {
  AlertCircle, Heart, Zap, BookOpen, Pill, Calendar, Bell,
  CheckCircle2, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { assessmentsApi } from "../../lib/api";
import ItalianDatePicker from "../shared/ItalianDatePicker";

// ─── Note type definitions ─────────────────────────────────────────────────────

const NOTE_TYPES = [
  { key: "active_problem",    label: "Problema attivo",                icon: AlertCircle, color: "#dc2626", bg: "#fef2f2" },
  { key: "comorbidity",       label: "Comorbidità",                    icon: Heart,       color: "#9333ea", bg: "#faf5ff" },
  { key: "complication",      label: "Complicanza",                    icon: Zap,         color: "#ea580c", bg: "#fff7ed" },
  { key: "rheum_history",     label: "Nota anamnesi reumatologica",    icon: BookOpen,    color: "#0f766e", bg: "#f0fdfa" },
  { key: "therapy_note",      label: "Terapia anamnestica",            icon: Pill,        color: "#0284c7", bg: "#f0f9ff" },
  { key: "timeline_event",    label: "Evento clinico / timeline",      icon: Calendar,    color: "#7c3aed", bg: "#faf5ff" },
  { key: "followup_reminder", label: "Promemoria follow-up",           icon: Bell,        color: "#b45309", bg: "#fffbeb" },
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

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function QuickClinicalNoteModal({
  open, onClose, sourceText, patientId, visitDate, defaultType = "active_problem", onSaved,
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [noteType,  setNoteType]  = useState(defaultType);
  const [content,   setContent]   = useState("");
  const [date,      setDate]      = useState(visitDate || today);
  const [reminder,  setReminder]  = useState("");
  const [comment,   setComment]   = useState("");
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (open) {
      setNoteType(defaultType);
      setContent(sourceText || "");
      setDate(visitDate || today);
      setReminder("");
      setComment("");
    }
  }, [open]); // eslint-disable-line

  const meta = NOTE_TYPES.find(n => n.key === noteType) || NOTE_TYPES[0];
  const Icon = meta.icon;

  async function handleSave() {
    if (!patientId) { toast.error("ID paziente mancante"); return; }
    if (!content.trim()) { toast.error("Il contenuto non può essere vuoto"); return; }

    setSaving(true);
    try {
      const saved = await assessmentsApi.create({
        patient_id:     patientId,
        date,
        index_type:     "clinical_note",
        inputs: {
          note_type:       noteType,
          note_type_label: meta.label,
          content:         content.trim(),
          source_text:     sourceText || "",
          reminder_date:   noteType === "followup_reminder" ? reminder || null : null,
          comment:         comment.trim() || null,
          is_quick_entry:  true,
        },
        interpretation: `${meta.label}: ${content.trim().slice(0, 120)}`,
        notes:          comment.trim() || null,
      });
      toast.success(`${meta.label} salvato in cartella`);
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
        aria-describedby="qcnm-desc"
      >
        <DialogHeader>
          <DialogTitle style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px" }}>
            <Icon size={16} color={meta.color} />
            Salva nota clinica
          </DialogTitle>
          <p id="qcnm-desc" style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
            Scegli il tipo, modifica il testo se necessario e salva in cartella.
          </p>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "4px" }}>

          {/* Source text */}
          <div>
            <FieldLabel>Testo selezionato (sorgente)</FieldLabel>
            <div style={{
              fontFamily: "monospace", fontSize: "11px", color: "#374151",
              background: "#f9fafb", border: "1px solid #e5e7eb",
              borderRadius: "6px", padding: "7px 10px",
              lineHeight: "1.6", wordBreak: "break-word",
            }}>
              "{sourceText}"
            </div>
          </div>

          {/* Note type pills */}
          <div>
            <FieldLabel required>Tipo di nota</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {NOTE_TYPES.map(nt => {
                const NtIcon = nt.icon;
                const sel = nt.key === noteType;
                return (
                  <button
                    key={nt.key}
                    type="button"
                    onClick={() => setNoteType(nt.key)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      padding: "5px 11px",
                      borderRadius: "999px",
                      border: `1.5px solid ${sel ? nt.color : "#d1d5db"}`,
                      background: sel ? nt.bg : "#fff",
                      color: sel ? nt.color : "#6b7280",
                      fontSize: "11px", fontWeight: sel ? 700 : 400,
                      cursor: "pointer", transition: "all 0.12s",
                      boxShadow: sel ? `0 0 0 2px ${nt.color}33` : "none",
                    }}
                  >
                    <NtIcon size={10} />
                    {nt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editable content */}
          <div>
            <FieldLabel required>Contenuto</FieldLabel>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Testo del dato clinico da salvare…"
              style={{ fontSize: "13px", minHeight: "72px", resize: "vertical" }}
            />
          </div>

          {/* Date */}
          <div>
            <FieldLabel>Data di riferimento</FieldLabel>
            <ItalianDatePicker value={date} onChange={setDate} />
          </div>

          {/* Reminder date — only for follow-up reminder */}
          {noteType === "followup_reminder" && (
            <div>
              <FieldLabel>Data promemoria</FieldLabel>
              <input
                type="date"
                value={reminder}
                onChange={e => setReminder(e.target.value)}
                style={{
                  fontSize: "13px", border: "1px solid #d1d5db",
                  borderRadius: "6px", padding: "6px 10px",
                  background: "#fff", color: "#374151", width: "100%",
                }}
              />
            </div>
          )}

          {/* Comment */}
          <div>
            <FieldLabel>Nota aggiuntiva (opzionale)</FieldLabel>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Contesto clinico, rilevanza, correlazione con la terapia…"
              style={{ fontSize: "12px", minHeight: "48px", resize: "vertical" }}
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
            disabled={saving || !content.trim()}
            style={{ background: meta.color, color: "#fff", minWidth: "130px" }}
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin mr-1" /> Salvataggio…</>
              : <><CheckCircle2 size={14} style={{ marginRight: "6px" }} /> Salva nota</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
