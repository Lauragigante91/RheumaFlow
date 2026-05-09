import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { AlertTriangle, X, User as UserIcon } from "lucide-react";
import { remindersApi } from "../lib/api";
import { toast } from "sonner";

const PRESETS = [
  "Rivalutare PCR",
  "Discussione MDT",
  "Controllare HRCT",
  "Contattare specialista",
  "Richiesta PT biologico",
  "Inviare richiesta comitato etico",
  "Verificare risposta a 3 mesi",
];

const TYPES = [
  { value: "follow_up", label: "Follow-up" },
  { value: "lab", label: "Esami di laboratorio" },
  { value: "imaging", label: "Imaging" },
  { value: "therapy", label: "Terapia" },
  { value: "other", label: "Altro" },
];

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function QuickTaskDialog({ open, onOpenChange, patients = [], onCreated }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("other");
  const [dueDate, setDueDate] = useState(todayPlus(0));
  const [asap, setAsap] = useState(true);
  const [shared, setShared] = useState(true);
  const [notes, setNotes] = useState("");
  const [patientId, setPatientId] = useState("__NONE__");
  const [patientQuery, setPatientQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setType("other");
      setDueDate(todayPlus(0));
      setAsap(true);
      setShared(true);
      setNotes("");
      setPatientId("__NONE__");
      setPatientQuery("");
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open]);

  const filteredPatients = useMemo(() => {
    if (!patientQuery.trim()) return patients.slice(0, 8);
    const q = patientQuery.toLowerCase();
    return patients
      .filter((p) => {
        const txt = [p.cognome, p.nome, p.codice_paziente, p.diagnosi].filter(Boolean).join(" ").toLowerCase();
        return txt.includes(q);
      })
      .slice(0, 8);
  }, [patients, patientQuery]);

  const selectedPatient = patientId !== "__NONE__" ? patients.find((p) => p.id === patientId) : null;

  const save = async () => {
    if (!title.trim()) {
      toast.error("Inserisci un titolo");
      return;
    }
    if (!dueDate) {
      toast.error("Inserisci una data");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        due_date: dueDate,
        type,
        notes: notes.trim() || null,
        priority: asap ? "asap" : "routine",
        visibility: shared ? "shared" : "private",
        ...(patientId !== "__NONE__" ? { patient_id: patientId } : {}),
      };
      await remindersApi.create(payload);
      toast.success(asap ? "Task aggiunto al cockpit" : "Promemoria salvato");
      onOpenChange(false);
      if (onCreated) onCreated();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  // Cmd/Ctrl + Enter to save
  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      save();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl p-0 overflow-hidden"
        data-testid="quick-task-dialog"
        onKeyDown={onKeyDown}
      >
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-gray-100">
          <DialogTitle className="font-heading text-xl tracking-tight text-[#0A2540]">
            Nuovo task
          </DialogTitle>
          <p className="text-[11px] text-gray-500">
            Aggiungi una richiesta operativa al tuo cockpit. Il paziente è opzionale.
          </p>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Title + presets */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-600">Titolo</Label>
            <Input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Inviare richiesta comitato etico"
              className="mt-1"
              data-testid="task-title-input"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTitle(p)}
                  className="text-[10px] px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition"
                  data-testid={`preset-${p.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Patient autocomplete (optional) */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-600">
              Paziente <span className="text-gray-400 normal-case font-normal">(opzionale)</span>
            </Label>
            {selectedPatient ? (
              <div className="mt-1 flex items-center justify-between bg-violet-50 border border-violet-200 rounded-md px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserIcon className="w-3.5 h-3.5 text-violet-700 flex-shrink-0" />
                  <span className="text-sm font-medium text-[#0A2540] truncate">
                    {(selectedPatient.cognome || selectedPatient.nome)
                      ? `${selectedPatient.cognome || ""} ${selectedPatient.nome || ""}`.trim()
                      : (selectedPatient.codice_paziente || "Paziente")}
                  </span>
                  <span className="text-[11px] text-gray-500 truncate">{selectedPatient.diagnosi || ""}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setPatientId("__NONE__"); setPatientQuery(""); }}
                  className="text-gray-400 hover:text-gray-600"
                  data-testid="clear-patient-btn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Cerca per cognome, nome, codice, diagnosi..."
                  className="mt-1"
                  data-testid="patient-search-input"
                />
                {patientQuery.trim() && filteredPatients.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-md bg-white max-h-48 overflow-y-auto">
                    {filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setPatientId(p.id); setPatientQuery(""); }}
                        className="w-full text-left px-3 py-1.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        data-testid={`patient-suggest-${p.id}`}
                      >
                        <div className="text-sm font-medium text-[#0A2540]">
                          {(p.cognome || p.nome)
                            ? `${p.cognome || ""} ${p.nome || ""}`.trim()
                            : (p.codice_paziente || "Paziente")}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">{p.diagnosi || "—"}</div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-gray-400 mt-1">
                  Lascia vuoto per un task non legato a nessun paziente (es. burocrazia, organizzazione, comitato etico).
                </div>
              </>
            )}
          </div>

          {/* Date shortcuts */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-600">Scadenza</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-40"
                data-testid="task-due-date"
              />
              <div className="flex gap-1.5">
                {[
                  { label: "Oggi", days: 0 },
                  { label: "Domani", days: 1 },
                  { label: "+7gg", days: 7 },
                  { label: "+30gg", days: 30 },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setDueDate(todayPlus(s.days))}
                    className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                    data-testid={`due-shortcut-${s.label}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Type + flags */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-600">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-1 h-9" data-testid="task-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={asap} onCheckedChange={(v) => setAsap(!!v)} data-testid="task-asap-checkbox" />
                <span className="text-xs text-gray-700 inline-flex items-center gap-1">
                  <AlertTriangle className={`w-3 h-3 ${asap ? "text-violet-600" : "text-gray-400"}`} />
                  ASAP — appare nel cockpit
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={shared} onCheckedChange={(v) => setShared(!!v)} data-testid="task-shared-checkbox" />
                <span className="text-xs text-gray-700">Condividi con la mia organizzazione</span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-600">Note</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dettagli aggiuntivi (opzionale)"
              rows={2}
              className="mt-1 text-sm"
              data-testid="task-notes-textarea"
            />
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-2">
          <span className="text-[10px] text-gray-400 hidden sm:block">
            Suggerimento: <kbd className="font-mono bg-white border border-gray-200 rounded px-1">Ctrl</kbd> + <kbd className="font-mono bg-white border border-gray-200 rounded px-1">Enter</kbd> per salvare
          </span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} data-testid="task-cancel-btn">
              Annulla
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={saving}
              className="bg-[#0A2540] text-white hover:bg-[#051626]"
              data-testid="task-save-btn"
            >
              {saving ? "Salvataggio..." : "Salva task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
