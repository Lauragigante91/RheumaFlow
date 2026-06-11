import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import {
  X, User as UserIcon, StickyNote, UserCircle, Users, Lock, Zap,
} from "lucide-react";
import { remindersApi, api } from "../../lib/api";
import { toast } from "sonner";

// ─── Presets ─────────────────────────────────────────────────────────────────
const STANDALONE_PRESETS = [
  "Preparare documenti comitato etico",
  "Chiamare radiologia per protocollo PET",
  "Aggiornare checklist vasculite",
  "Discussione MDT settimanale",
  "Inviare richiesta PT biologico",
  "Verificare protocollo off-label",
];

const PATIENT_PRESETS = [
  "Rivalutare PCR",
  "Controllare HRCT",
  "Contattare specialista",
  "Verificare risposta a 3 mesi",
  "Aggiustare dosaggio",
];

const PRIORITY_OPTIONS = [
  { value: "asap", label: "Urgente", icon: Zap, color: "text-amber-600", bg: "border-amber-500 bg-amber-50" },
  { value: "routine", label: "Programmato", icon: UserCircle, color: "text-[#0A2540]", bg: "border-[#0A2540] bg-blue-50/30" },
];

const VISIBILITY_OPTIONS = [
  {
    value: "private",
    label: "Solo io",
    desc: "Visibile solo a te (puoi condividerla con colleghi selezionati).",
    icon: Lock,
    color: "border-purple-500 bg-purple-50",
  },
  {
    value: "shared",
    label: "Tutta l'UO",
    desc: "Tutti i medici dell'unità operativa la vedono.",
    icon: Users,
    color: "border-[#0A2540] bg-blue-50/30",
  },
];

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function QuickTaskDialog({ open, onOpenChange, patients = [], onCreated }) {
  const [title, setTitle]           = useState("");
  const [description, setDesc]      = useState("");
  const [dueDate, setDueDate]       = useState(todayPlus(0));
  const [priority, setPriority]     = useState("asap");
  const [visibility, setVisibility] = useState("private");
  const [sharedWith, setSharedWith] = useState([]);
  const [patientId, setPatientId]   = useState("__NONE__");
  const [patientQuery, setPatientQ] = useState("");
  const [saving, setSaving]         = useState(false);
  const [members, setMembers]       = useState([]);
  const titleRef = useRef(null);

  // Determine whether standalone or patient-linked
  const isStandalone = patientId === "__NONE__";

  // Reset form when dialog opens; also load org members
  useEffect(() => {
    if (open) {
      setTitle("");
      setDesc("");
      setDueDate(todayPlus(0));
      setPriority("asap");
      setVisibility("private");
      setSharedWith([]);
      setPatientId("__NONE__");
      setPatientQ("");
      setTimeout(() => titleRef.current?.focus(), 50);
      api.get("/organization/members")
        .then((r) => setMembers(r.data || []))
        .catch(() => setMembers([]));
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

  const toggleShareWith = (uid) => setSharedWith((prev) =>
    prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
  );

  const save = async () => {
    if (!title.trim()) { toast.error("Inserisci un titolo"); return; }
    if (!dueDate)       { toast.error("Inserisci una data");  return; }
    setSaving(true);
    try {
      const payload = {
        title:       title.trim(),
        notes:       description.trim() || null,
        due_date:    dueDate,
        type:        isStandalone ? "other" : "follow_up",
        priority,
        visibility,
        shared_with_user_ids: visibility === "private" ? sharedWith : [],
        ...(patientId !== "__NONE__" ? { patient_id: patientId } : {}),
      };
      await remindersApi.create(payload);
      toast.success(isStandalone ? "Post-it aggiunto al cockpit" : "Task paziente aggiunto al cockpit");
      onOpenChange(false);
      if (onCreated) onCreated();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); }
  };

  const presets = isStandalone ? STANDALONE_PRESETS : PATIENT_PRESETS;
  const otherMembers = members.filter((m) => true); // show all for sharing

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl p-0 overflow-hidden"
        data-testid="quick-task-dialog"
        onKeyDown={onKeyDown}
      >
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-gray-100">
          <DialogTitle className="font-heading text-xl tracking-tight text-[#0A2540]">
            Nuovo task clinico
          </DialogTitle>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Aggiungi un task al tuo cockpit — con o senza paziente collegato.
          </p>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* ── Task type hint ── */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setPatientId("__NONE__"); setPatientQ(""); }}
              className={`flex items-start gap-2 p-3 border-2 rounded-md text-left transition text-sm ${
                isStandalone ? "border-violet-500 bg-violet-50" : "border-gray-200 hover:border-gray-300"
              }`}
              data-testid="mode-standalone"
            >
              <StickyNote className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isStandalone ? "text-violet-600" : "text-gray-400"}`} />
              <div>
                <div className="font-semibold text-xs leading-tight">Post-it clinico</div>
                <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">Non legato a nessun paziente</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { /* just enables the patient search */ titleRef.current?.focus(); }}
              className={`flex items-start gap-2 p-3 border-2 rounded-md text-left transition text-sm ${
                !isStandalone ? "border-[#0A2540] bg-blue-50/40" : "border-gray-200 hover:border-gray-300"
              }`}
              data-testid="mode-patient"
            >
              <UserIcon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${!isStandalone ? "text-[#0A2540]" : "text-gray-400"}`} />
              <div>
                <div className="font-semibold text-xs leading-tight">Task paziente</div>
                <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">Collegato a un paziente specifico</div>
              </div>
            </button>
          </div>

          {/* ── Title + presets ── */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-600">Titolo *</Label>
            <Input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isStandalone ? "Es. Preparare documenti comitato etico" : "Es. Rivalutare PCR"}
              className="mt-1"
              data-testid="task-title-input"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTitle(p)}
                  className="text-[10px] px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* ── Description ── */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-600">
              Descrizione <span className="font-normal text-gray-400 normal-case">(opzionale)</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Dettagli aggiuntivi, contesto, passi successivi..."
              rows={2}
              className="mt-1 text-sm"
              data-testid="task-description-textarea"
            />
          </div>

          {/* ── Patient search (optional) ── */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-600">
              Paziente <span className="text-gray-400 normal-case font-normal">(opzionale)</span>
            </Label>
            {selectedPatient ? (
              <div className="mt-1 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserIcon className="w-3.5 h-3.5 text-[#0A2540] flex-shrink-0" />
                  <span className="text-sm font-medium text-[#0A2540] truncate">
                    {(selectedPatient.cognome || selectedPatient.nome)
                      ? `${selectedPatient.cognome || ""} ${selectedPatient.nome || ""}`.trim()
                      : (selectedPatient.codice_paziente || "Paziente")}
                  </span>
                  <span className="text-[11px] text-gray-500 truncate">{selectedPatient.diagnosi || ""}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setPatientId("__NONE__"); setPatientQ(""); }}
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
                  onChange={(e) => setPatientQ(e.target.value)}
                  placeholder="Cerca per cognome, nome, codice, diagnosi..."
                  className="mt-1"
                  data-testid="patient-search-input"
                />
                {patientQuery.trim() && filteredPatients.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-md bg-white max-h-40 overflow-y-auto">
                    {filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setPatientId(p.id); setPatientQ(""); }}
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
                {!patientQuery.trim() && (
                  <div className="text-[10px] text-gray-400 mt-1">
                    Lascia vuoto per un post-it non legato a un paziente.
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Due date ── */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-600">Scadenza *</Label>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-40"
                data-testid="task-due-date"
              />
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: "Oggi",  days: 0 },
                  { label: "Dom.",  days: 1 },
                  { label: "+7gg",  days: 7 },
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

          {/* ── Priority ── */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-600 mb-2 block">Priorità</Label>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`flex items-center gap-2 p-2.5 border-2 rounded-md text-left transition text-sm ${
                      priority === opt.value ? opt.bg : "border-gray-200 hover:border-gray-300"
                    }`}
                    data-testid={`priority-${opt.value}`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${priority === opt.value ? opt.color : "text-gray-400"}`} />
                    <span className="font-semibold text-xs">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Visibility ── */}
          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-600 mb-2 block">Visibilità</Label>
            <div className="grid grid-cols-2 gap-2">
              {VISIBILITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVisibility(opt.value)}
                    className={`flex items-start gap-2 p-3 border-2 rounded-md text-left transition ${
                      visibility === opt.value ? opt.color : "border-gray-200 hover:border-gray-300"
                    }`}
                    data-testid={`visibility-${opt.value}`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${visibility === opt.value ? "" : "text-gray-400"}`} />
                    <div>
                      <div className="font-semibold text-xs">{opt.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Colleague selector when "private" */}
            {visibility === "private" && otherMembers.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] text-gray-500 mb-1.5">Condividi anche con (opzionale):</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                  {otherMembers.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 p-1.5 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={sharedWith.includes(m.id)}
                        onCheckedChange={() => toggleShareWith(m.id)}
                        data-testid={`share-with-${m.id}`}
                      />
                      <div className="text-[11px] leading-tight">
                        <div className="font-semibold">{m.name || m.email}</div>
                        <div className="text-gray-500">{m.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-2">
          <span className="text-[10px] text-gray-400 hidden sm:block">
            <kbd className="font-mono bg-white border border-gray-200 rounded px-1">Ctrl</kbd> +{" "}
            <kbd className="font-mono bg-white border border-gray-200 rounded px-1">Enter</kbd> per salvare
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
              {saving ? "Salvataggio..." : isStandalone ? "Salva post-it" : "Salva task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
