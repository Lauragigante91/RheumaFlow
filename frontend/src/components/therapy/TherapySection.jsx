import React, { useEffect, useState, useMemo } from "react";
import { therapiesApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Pill, Trash2, Edit, AlertTriangle,
  ShieldCheck, ChevronDown, ChevronRight,
  Check, X, Clock, ClipboardList,
} from "lucide-react";
import SelectableText   from "../shared/SelectableText";
import QuickTherapyModal from "./QuickTherapyModal";
import { toast } from "sonner";
import ItalianDatePicker from "../shared/ItalianDatePicker";
import { THERAPY_CATEGORIES, suggestTherapiesForDiagnosis } from "../../lib/therapySuggestions";
import { DRUGS, INDICATIONS, findDrug, formatRegimen } from "../../lib/drugs";
import { detectInteractions, SEVERITY } from "../../lib/drugInteractions";
import { detectSafetyReminders, REMINDER_STYLE_INTERACTION_IDS } from "../../lib/safetyReminders";

const STATUS_LABELS = {
  active: "In corso",
  discontinued: "Sospesa",
  completed: "Completata",
};

const STATUS_COLORS = {
  active: "bg-green-700 hover:bg-green-700 text-white",
  discontinued: "bg-red-50 text-red-400 hover:bg-red-50",
  completed: "bg-gray-100 text-gray-400 hover:bg-gray-100",
};

const emptyForm = {
  drug_name: "",
  category: "csDMARD",
  indication: "",
  dose: "",
  frequency: "",
  route: "",
  start_date: "",
  end_date: "",
  status: "active",
  discontinuation_reason: "",
  notes: "",
  therapy_event: null,
};

// Factory per le azioni del floating menu sulle righe farmaco
function makeTherapyRowActions(text, openQuick) {
  return [
    {
      key: "therapy",
      label: "Terapia (in corso / modifica / storico)",
      icon: Pill,
      color: "#16a34a",
      bg: "#f0fdf4",
      group: "save",
      handler: () => openQuick(text),
    },
  ];
}

export default function TherapySection({ patient, visitStartTherapies, onAcceptReminder, onRegisterHandle, onTherapySaved, onAppendToPlan }) {
  const [therapies, setTherapies] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [quickModal, setQuickModal] = useState({ open: false, src: "" });

  const openQuick = (src) => setQuickModal({ open: true, src });
  const closeQuick = () => setQuickModal({ open: false, src: "" });

  const load = async () => {
    if (!patient?.id) return;
    const data = await therapiesApi.listByPatient(patient.id);
    setTherapies(data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id]);

  const suggestions = useMemo(() => suggestTherapiesForDiagnosis(patient?.diagnosi), [patient?.diagnosi]);
  const allSuggested = suggestions.flatMap((s) => s.drugs);

  const openNew = (preset = null, preExisting = false) => {
    setEditing(null);
    const base = preExisting ? { ...emptyForm, therapy_event: "pre_existing" } : emptyForm;
    if (preset) {
      setForm({ ...base, drug_name: preset.name, category: preset.category, dose: preset.typical || "" });
    } else {
      setForm(base);
    }
    setOpen(true);
  };

  useEffect(() => {
    onRegisterHandle?.({ openNew, openPreExisting: () => openNew(null, true), reload: load });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterHandle]);

  const openEdit = (t) => {
    setEditing(t);
    const isCustom = t.drug_name && !findDrug(t.drug_name);
    setForm({ ...emptyForm, ...t, _isCustom: isCustom });
    setOpen(true);
  };

  const save = async () => {
    if (!form.drug_name || form.drug_name === "__custom__") {
      toast.error("Specifica il nome del farmaco");
      return;
    }
    // Strip UI-only fields
    const { _isCustom, _customName, ...payload } = form;
    try {
      if (editing) {
        await therapiesApi.update(editing.id, payload);
        toast.success("Terapia aggiornata");
      } else {
        await therapiesApi.create({ ...payload, patient_id: patient.id });
        toast.success("Terapia aggiunta");
        onTherapySaved?.(form.drug_name, form.dose, form.route, form.therapy_event);
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore");
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Eliminare la terapia "${t.drug_name}"?`)) return;
    await therapiesApi.remove(t.id);
    toast.success("Eliminata");
    load();
  };

  const active = therapies.filter((t) => t.status === "active");
  const past   = therapies.filter((t) => t.status !== "active");

  // Split: therapies that were active at visit-open (snapshot) vs added during this session
  const snapshotIds         = visitStartTherapies
    ? new Set(visitStartTherapies.filter(t => t.status === "active").map(t => t.id))
    : null;
  const snapshotActive      = snapshotIds ? active.filter(t =>  snapshotIds.has(t.id)) : active;
  const addedThisVisit      = snapshotIds ? active.filter(t => !snapshotIds.has(t.id)) : [];
  const newThisVisit        = addedThisVisit.filter(t => t.therapy_event !== "pre_existing");
  const preExistingThisVisit = addedThisVisit.filter(t => t.therapy_event === "pre_existing");

  // Drug-drug interactions (solo terapie in corso)
  const allInteractions = useMemo(
    () => detectInteractions(active.map((t) => t.drug_name).filter(Boolean)),
    [active]
  );
  // Filter out "reminder-style" single-drug interactions — handled by safetyReminders
  const interactions = useMemo(
    () => allInteractions.filter(i => !REMINDER_STYLE_INTERACTION_IDS.has(i.id)),
    [allInteractions]
  );
  // Pre-biologic/JAKi safety reminders
  const reminders = useMemo(
    () => detectSafetyReminders(active, patient),
    [active, patient]
  );

  // Preview interactions inside dialog: simulate adding/editing the current form
  // and show ONLY interactions newly introduced by this drug (not pre-existing).
  const previewInteractions = useMemo(() => {
    if (!form.drug_name || form.status !== "active") return [];
    const otherActiveNames = active
      .filter((t) => !editing || t.id !== editing.id)
      .map((t) => t.drug_name)
      .filter(Boolean);
    const baseline = detectInteractions(otherActiveNames);
    const baselineIds = new Set(baseline.map((i) => i.id));
    const withForm = detectInteractions([...otherActiveNames, form.drug_name]);
    return withForm.filter((i) => !baselineIds.has(i.id));
  }, [form.drug_name, form.status, active, editing]);

  return (
    <div className="space-y-4" data-testid="therapy-section">
      <h2 className="font-heading font-bold text-xl tracking-tight">
        Terapia in corso ({snapshotActive.length})
        {newThisVisit.length > 0 && (
          <span className="ml-2 text-xs font-normal text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 align-middle">
            +{newThisVisit.length} avviata oggi
          </span>
        )}
        {preExistingThisVisit.length > 0 && (
          <span className="ml-2 text-xs font-normal text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5 align-middle">
            +{preExistingThisVisit.length} già in corso
          </span>
        )}
      </h2>

      {/* Safety panel — prescription-time alerts removed (shown in QuickTherapyModal).
          Here: drug interactions for ongoing therapy + placeholder for future longitudinal reminders. */}
      <SafetyPanel
        reminders={[]}
        interactions={interactions}
        patientId={patient?.id}
        onAcceptReminder={onAcceptReminder}
      />

      {/* Snapshot therapies — active at visit-open */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        {snapshotActive.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Nessuna terapia in corso all'apertura della visita.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {snapshotActive.map((t) => (
              <TherapyRow key={t.id} t={t} onEdit={openEdit} onRemove={remove} />
            ))}
          </div>
        )}
      </Card>

      {/* Therapies newly started in this visit */}
      {newThisVisit.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">
              Avviata in questa visita
            </span>
            <span className="flex-1 h-px bg-emerald-100" />
          </div>
          <Card className="border-emerald-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-emerald-100">
              {newThisVisit.map((t) => (
                <TherapyRow key={t.id} t={t} onEdit={openEdit} onRemove={remove} />
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Pre-existing therapies registered for the first time in this visit */}
      {preExistingThisVisit.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-sky-700">
              Già in corso — registrata oggi
            </span>
            <span className="flex-1 h-px bg-sky-100" />
          </div>
          <Card className="border-sky-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-sky-100">
              {preExistingThisVisit.map((t) => (
                <TherapyRow key={t.id} t={t} onEdit={openEdit} onRemove={remove} />
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Past */}
      {past.length > 0 && (
        <>
          <h3 className="font-heading font-semibold text-sm uppercase tracking-[0.15em] text-gray-600 mt-6">Terapie precedenti ({past.length})</h3>
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-200">
              {past.map((t) => (
                <TherapyRow key={t.id} t={t} onEdit={openEdit} onRemove={remove} dimmed />
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Registra terapia già in corso — link discreto */}
      <button
        type="button"
        onClick={() => openNew(null, true)}
        data-testid="add-preexisting-therapy-btn"
        className="flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-800 hover:underline transition-colors"
      >
        <ClipboardList className="w-3 h-3" />
        Registra terapia già in corso
      </button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-black tracking-tight">
              {editing
                ? "Modifica terapia"
                : form.therapy_event === "pre_existing"
                  ? "Registra terapia già in corso"
                  : "Nuova terapia"}
            </DialogTitle>
          </DialogHeader>
          {previewInteractions.length > 0 && (
            <div data-testid="therapy-form-interactions" className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Interazioni rilevate con i farmaci in corso
              </div>
              <div className="space-y-1">
                {previewInteractions.map(i => {
                  const sev = SEVERITY[i.severity];
                  return (
                    <div key={i.id} className="flex items-start gap-2 text-xs">
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                        style={{ background: sev.color, color: "white" }}
                      >{sev.label}</span>
                      <span className="font-semibold text-gray-800">{i.title}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-500 italic mt-1.5">Espandi la sezione "Safety reminders" per i dettagli.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Farmaco *</Label>
              <Select
                value={form._isCustom ? "__custom__" : form.drug_name}
                onValueChange={(drugName) => {
                  if (drugName === "__custom__") {
                    setForm({ ...form, _isCustom: true, drug_name: "", indication: "" });
                    return;
                  }
                  const d = findDrug(drugName);
                  const newForm = { ...form, _isCustom: false, drug_name: drugName };
                  if (d) {
                    newForm.category = d.category || form.category;
                    if (d.regimens && d.regimens.length === 1) {
                      const r = d.regimens[0];
                      newForm.indication = r.indication;
                      newForm.dose = r.dose;
                      newForm.frequency = r.frequency;
                      newForm.route = r.route;
                    } else {
                      newForm.indication = "";
                    }
                  }
                  setForm(newForm);
                }}
              >
                <SelectTrigger data-testid="therapy-drug"><SelectValue placeholder="Seleziona farmaco o digita..." /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {DRUGS.map((d) => (
                    <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">Altro (inserisci manualmente)</SelectItem>
                </SelectContent>
              </Select>
              {form._isCustom && (
                <Input
                  className="mt-2"
                  placeholder="Nome farmaco"
                  value={form.drug_name || ""}
                  onChange={(e) => setForm({ ...form, drug_name: e.target.value })}
                  data-testid="therapy-drug-custom"
                />
              )}
              {(() => {
                const d = findDrug(form.drug_name);
                return d?.notes ? (
                  <div className="mt-1.5 text-[11px] text-amber-700 italic">⚠ {d.notes}</div>
                ) : null;
              })()}
            </div>

            {/* Indication */}
            {(() => {
              const d = findDrug(form.drug_name);
              if (!d || !d.regimens || d.regimens.length <= 1) return null;
              return (
                <div className="md:col-span-2">
                  <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Indicazione</Label>
                  <Select
                    value={form.indication || ""}
                    onValueChange={(ind) => {
                      const r = d.regimens.find((x) => x.indication === ind);
                      setForm({
                        ...form,
                        indication: ind,
                        dose: r?.dose || form.dose,
                        frequency: r?.frequency || form.frequency,
                        route: r?.route || form.route,
                      });
                    }}
                  >
                    <SelectTrigger data-testid="therapy-indication"><SelectValue placeholder="Scegli indicazione per auto-posologia" /></SelectTrigger>
                    <SelectContent>
                      {d.regimens.map((r) => (
                        <SelectItem key={`${d.name}-${r.indication}-${r.dose}`} value={r.indication}>
                          {INDICATIONS[r.indication] || r.indication} — {formatRegimen(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.indication && (() => {
                    const r = d.regimens.find((x) => x.indication === form.indication);
                    return r?.loading || r?.note ? (
                      <div className="mt-1.5 text-[11px] text-gray-600 italic">
                        {r.loading && <div>↻ Carico: {r.loading}</div>}
                        {r.note && <div>{r.note}</div>}
                      </div>
                    ) : null;
                  })()}
                </div>
              );
            })()}

            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="therapy-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(THERAPY_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Stato</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="therapy-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Dose</Label>
              <Input value={form.dose || ""} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="es. 15 mg" data-testid="therapy-dose" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Frequenza</Label>
              <Input value={form.frequency || ""} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="es. settimanale" data-testid="therapy-frequency" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Via</Label>
              <Input value={form.route || ""} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="es. orale, s.c., e.v." data-testid="therapy-route" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Inizio</Label>
              <ItalianDatePicker value={form.start_date || ""} onChange={(v) => setForm({ ...form, start_date: v })} testid="therapy-start-date" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Fine</Label>
              <ItalianDatePicker value={form.end_date || ""} onChange={(v) => setForm({ ...form, end_date: v })} testid="therapy-end-date" />
            </div>
            {form.status === "discontinued" && (
              <div className="md:col-span-2">
                <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Motivo sospensione</Label>
                <Input value={form.discontinuation_reason || ""} onChange={(e) => setForm({ ...form, discontinuation_reason: e.target.value })} placeholder="es. inefficacia, intolleranza..." data-testid="therapy-discontinuation" />
              </div>
            )}
            <div className="md:col-span-2">
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Note</Label>
              <Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="therapy-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" onClick={save} data-testid="save-therapy-btn">
              {editing ? "Aggiorna" : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QuickTherapyModal — aperto selezionando testo da una riga farmaco */}
      <QuickTherapyModal
        open={quickModal.open}
        onClose={closeQuick}
        sourceText={quickModal.src}
        patientId={patient?.id}
        patient={patient}
        onAppendToPlan={onAppendToPlan}
        onSaved={(name) => {
          closeQuick();
          load();
          onTherapySaved?.(name);
        }}
      />
    </div>
  );
}

function TherapyRow({ t, onEdit, onRemove, dimmed }) {
  return (
    <div className={`flex items-start justify-between gap-4 p-4 ${dimmed ? "opacity-40" : ""}`} data-testid={`therapy-row-${t.id}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Pill className="w-4 h-4 text-[#0A2540]" />
          <span className="font-heading font-bold text-base">{t.drug_name}</span>
          <Badge variant="outline" className="text-xs">{THERAPY_CATEGORIES[t.category] || t.category}</Badge>
          <Badge className={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge>
        </div>
        <div className="text-sm text-gray-600 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {t.dose && <span><strong>Dose:</strong> {t.dose.includes("→") ? t.dose.split("→").pop().trim() : t.dose}</span>}
          {t.frequency && <span><strong>Frequenza:</strong> {t.frequency}</span>}
          {t.route && <span><strong>Via:</strong> {t.route}</span>}
          {t.start_date && <span><strong>Dal:</strong> {new Date(t.start_date).toLocaleDateString("it-IT")}</span>}
          {t.end_date && <span><strong>Al:</strong> {new Date(t.end_date).toLocaleDateString("it-IT")}</span>}
        </div>
        {t.discontinuation_reason && (
          <div className="text-xs text-red-600 mt-1"><strong>Motivo sospensione:</strong> {t.discontinuation_reason}</div>
        )}
        {t.notes && <div className="text-xs text-gray-500 mt-1">{t.notes}</div>}
        {t.created_by_name && <div className="text-[10px] text-gray-500 mt-1">prescritto da {t.created_by_name}</div>}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => onEdit(t)} data-testid={`edit-therapy-${t.id}`}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onRemove(t)} data-testid={`delete-therapy-${t.id}`}>
          <Trash2 className="w-4 h-4 text-red-600" />
        </Button>
      </div>
    </div>
  );
}

// ── SafetyPanel ─────────────────────────────────────────────────────────────

function SafetyPanel({ reminders = [], interactions = [], patientId, onAcceptReminder }) {
  const [open, setOpen] = useState(false);
  const [expandedRem, setExpandedRem] = useState(new Set());
  const [expandedInt, setExpandedInt] = useState(new Set());
  // session-only snooze (rimando): reset when patient changes or page reloads
  const [snoozed, setSnoozed] = useState(new Set());
  // session-only "verificato" checkboxes for export to report
  const [checked, setChecked] = useState(new Set());

  const storageKey = `rhf_dismissed_${patientId}`;

  // Persistent dismiss (rifiuto / accetto) — localStorage per-patient
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) || "[]")); }
    catch { return new Set(); }
  });

  // Reset when patient changes
  useEffect(() => {
    try { setDismissed(new Set(JSON.parse(localStorage.getItem(`rhf_dismissed_${patientId}`) || "[]"))); }
    catch { setDismissed(new Set()); }
    setSnoozed(new Set());
  }, [patientId]);

  const persistDismiss = (id) => {
    const key = `rhf_dismissed_${patientId}`;
    setDismissed(prev => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem(key, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const handleAccept = (r) => {
    persistDismiss(r.id);
    onAcceptReminder?.(`• ${r.label} — verificato/prescritto`);
    toast.success(`"${r.label}" accettato`, { description: "Testo aggiunto alle indicazioni nel piano" });
  };
  const handleDismiss = (r) => {
    persistDismiss(r.id);
    toast.info(`"${r.label}" rimosso`);
  };
  const handleSnooze = (r) => {
    setSnoozed(prev => { const n = new Set(prev); n.add(r.id); return n; });
    toast.info(`"${r.label}" rimandato alla prossima visita`);
  };

  const handleInsertText = (r) => {
    if (!r.insertionText) return;
    onAcceptReminder?.(r.insertionText);
    toast.success("Testo inserito nelle indicazioni");
  };

  const handleCheck = (r) => {
    setChecked(prev => {
      const n = new Set(prev);
      n.has(r.id) ? n.delete(r.id) : n.add(r.id);
      return n;
    });
  };

  const handleExportChecked = () => {
    const items = [...checked]
      .map(id => visReminders.find(r => r.id === id))
      .filter(Boolean);
    if (items.length === 0) return;
    const lines = items.map(r => `• ${r.label}`).join("\n");
    onAcceptReminder?.(lines);
    items.forEach(r => persistDismiss(r.id));
    setChecked(new Set());
    toast.success(`${items.length} reminder verificat${items.length === 1 ? "o" : "i"} esportat${items.length === 1 ? "o" : "i"} nel referto`);
  };

  // Visible reminders (exclude dismissed + snoozed)
  const visReminders = reminders.filter(r => !dismissed.has(r.id) && !snoozed.has(r.id));
  const highReminders    = visReminders.filter(r => r.priority === "high");
  const routineReminders = visReminders.filter(r => r.priority === "routine");
  const lowReminders     = visReminders.filter(r => r.priority === "low");
  const majorInter = interactions.filter(i => i.severity === "major");
  const hasHighAlert = highReminders.length > 0 || majorInter.length > 0;

  const toggleRem = (id) => setExpandedRem(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleInt = (id) => setExpandedInt(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const previewItems = [
    ...highReminders.map(r => r.label),
    ...majorInter.map(i => i.title),
    ...routineReminders.slice(0, 2).map(r => r.label),
  ].slice(0, 3);

  // Hide panel entirely if nothing to show
  // Empty state: show a quiet placeholder (reserve space for future longitudinal reminders)
  if (visReminders.length === 0 && interactions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-3 flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <div>
          <p className="text-[11px] font-medium text-gray-400">Nessuna interazione farmacologica rilevata</p>
          <p className="text-[10px] text-gray-350 mt-0.5">
            Il monitoraggio longitudinale (screening biologici, controlli scaduti) sarà disponibile prossimamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden shadow-sm transition-all ${
        hasHighAlert ? "border-orange-300 bg-orange-50/50" : "border-amber-200 bg-amber-50/40"
      }`}
      data-testid="safety-panel"
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/40 transition"
      >
        <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${hasHighAlert ? "text-orange-600" : "text-amber-600"}`} />
        <span className={`text-sm font-semibold ${hasHighAlert ? "text-orange-800" : "text-amber-800"}`}>
          Safety reminders
        </span>
        <div className="flex items-center gap-1.5 ml-1">
          {highReminders.length > 0 && (
            <span className="text-[10px] font-bold bg-orange-500 text-white px-2 py-0.5 rounded-full">
              {highReminders.length} urgente{highReminders.length > 1 ? "i" : ""}
            </span>
          )}
          {majorInter.length > 0 && (
            <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
              {majorInter.length} int. maggiore{majorInter.length > 1 ? "i" : ""}
            </span>
          )}
          {routineReminders.length > 0 && (
            <span className="text-[10px] font-semibold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
              {routineReminders.length} da verificare
            </span>
          )}
          {interactions.filter(i => i.severity !== "major").length > 0 && (
            <span className="text-[10px] font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
              {interactions.filter(i => i.severity !== "major").length} int.
            </span>
          )}
        </div>
        {!open && previewItems.length > 0 && (
          <span className="hidden sm:block flex-1 text-xs text-amber-700/80 truncate">
            {previewItems.join(" · ")}
          </span>
        )}
        <span className="ml-auto flex-shrink-0">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-amber-100 px-4 pb-4 pt-3 space-y-4">
          {highReminders.length > 0 && (
            <ReminderGroup
              title="Priorità alta" items={highReminders} expanded={expandedRem} onToggle={toggleRem} accent="orange"
              checked={checked} onCheck={handleCheck} onDismiss={handleDismiss} onSnooze={handleSnooze}
              onInsert={handleInsertText}
            />
          )}
          {majorInter.length > 0 && (
            <InteractionGroup title="Interazioni maggiori" items={majorInter} expanded={expandedInt} onToggle={toggleInt} />
          )}
          {routineReminders.length > 0 && (() => {
            const cats = [...new Set(routineReminders.map(r => r.category))];
            return cats.map(cat => (
              <ReminderGroup
                key={cat} title={cat} accent="amber" expanded={expandedRem} onToggle={toggleRem}
                items={routineReminders.filter(r => r.category === cat)}
                checked={checked} onCheck={handleCheck} onDismiss={handleDismiss} onSnooze={handleSnooze}
                onInsert={handleInsertText}
              />
            ));
          })()}
          {/* Low priority: note silenziose, solo testo, nessuna azione */}
          {lowReminders.length > 0 && (
            <div className="border-t border-gray-100 pt-2 space-y-1">
              {lowReminders.map(r => (
                <div key={r.id} className="flex items-start gap-2 text-[10.5px] text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0 mt-[4px]" />
                  <span>{r.label}</span>
                </div>
              ))}
            </div>
          )}
          {interactions.filter(i => i.severity !== "major").length > 0 && (
            <InteractionGroup
              title="Altre interazioni farmacologiche"
              items={interactions.filter(i => i.severity !== "major")}
              expanded={expandedInt} onToggle={toggleInt}
            />
          )}

          {/* Export bar */}
          <div className="flex items-center justify-between pt-1 border-t border-amber-100">
            <p className="text-[10px] text-gray-400 italic">
              I suggerimenti sono informativi e non sostituiscono il giudizio clinico.
            </p>
            {checked.size > 0 && (
              <button
                type="button"
                onClick={handleExportChecked}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0A2540] hover:bg-[#051626] px-3 py-1.5 rounded-lg flex-shrink-0 ml-3"
              >
                <Check className="w-3 h-3" />
                Esporta {checked.size} verificat{checked.size === 1 ? "o" : "i"} nel referto
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Action buttons per reminder: checkbox (verificato) + dismiss + snooze ────
function ReminderActions({ r, checked, onCheck, onDismiss, onSnooze }) {
  const isChecked = checked?.has(r.id);
  return (
    <div
      style={{ display: "flex", gap: "3px", flexShrink: 0 }}
      onClick={e => e.stopPropagation()}
    >
      {/* Checkbox "Verificato" */}
      <button
        type="button"
        title={isChecked ? "Deseleziona" : "Segna come verificato"}
        onClick={() => onCheck(r)}
        style={{
          width: "22px", height: "22px", borderRadius: "5px",
          background: isChecked ? "#dcfce7" : "#f9fafb",
          border: isChecked ? "1.5px solid #86efac" : "1.5px solid #d1d5db",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0, transition: "all 0.15s",
        }}
      >
        {isChecked && <Check size={11} color="#15803d" strokeWidth={2.5} />}
      </button>
      {/* Dismiss */}
      <button
        type="button"
        title="Rimuovi definitivamente"
        onClick={() => onDismiss(r)}
        style={{
          width: "22px", height: "22px", borderRadius: "5px",
          background: "#fee2e2", border: "1px solid #fca5a5",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0,
        }}
      >
        <X size={11} color="#dc2626" strokeWidth={2.5} />
      </button>
      {/* Snooze */}
      <button
        type="button"
        title="Rimanda alla prossima visita"
        onClick={() => onSnooze(r)}
        style={{
          width: "22px", height: "22px", borderRadius: "5px",
          background: "#eff6ff", border: "1px solid #93c5fd",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0,
        }}
      >
        <Clock size={11} color="#2563eb" strokeWidth={2.5} />
      </button>
    </div>
  );
}

function ReminderGroup({ title, items, expanded, onToggle, accent = "amber", checked, onCheck, onDismiss, onSnooze, onInsert }) {
  const accentTitle  = accent === "orange" ? "text-orange-700" : "text-amber-700";
  const accentBorder = accent === "orange" ? "border-orange-200" : "border-amber-200";
  const accentBg     = accent === "orange" ? "bg-orange-50"     : "bg-amber-50/60";
  const dotColor     = accent === "orange" ? "bg-orange-400"     : "bg-amber-400";

  if (!items || items.length === 0) return null;

  return (
    <div>
      {title && (
        <div className={`text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5 ${accentTitle}`}>
          {title}
        </div>
      )}
      <div className="space-y-1">
        {items.map(r => {
          const isOpen = expanded.has(r.id);
          const isChecked = checked?.has(r.id);
          return (
            <div
              key={r.id}
              className={`rounded-lg border overflow-hidden transition-colors ${accentBorder} ${isChecked ? "bg-green-50/40" : ""}`}
              data-testid={`reminder-${r.id}`}
            >
              {/* Row: dot + expand toggle + action squares */}
              <div className="flex items-center gap-2 px-3 py-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                <button
                  type="button"
                  onClick={() => onToggle(r.id)}
                  className="flex-1 text-left flex items-center gap-1.5 min-w-0"
                >
                  <span className={`text-xs font-semibold truncate ${isChecked ? "line-through text-gray-400" : "text-gray-800"}`}>
                    {r.label}
                  </span>
                  {isOpen
                    ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  }
                </button>
                <ReminderActions r={r} checked={checked} onCheck={onCheck} onDismiss={onDismiss} onSnooze={onSnooze} />
              </div>
              {isOpen && (
                <div className={`px-3 pb-2.5 pt-1 text-[11px] text-gray-600 leading-relaxed border-t ${accentBorder} ${accentBg} whitespace-pre-line`}>
                  {r.detail}
                  {r.insertionText && onInsert && (
                    <div className="mt-2 pt-1.5 border-t border-gray-200/70">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onInsert(r); }}
                        className="text-[10px] font-semibold text-[#0A2540] underline underline-offset-2 hover:text-blue-700 transition-colors"
                      >
                        ↳ Inserisci in indicazioni
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InteractionGroup({ title, items, expanded, onToggle }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5 text-gray-500">
        {title}
      </div>
      <div className="space-y-1">
        {items.map(i => {
          const sev = SEVERITY[i.severity];
          const isOpen = expanded.has(i.id);
          return (
            <div
              key={i.id}
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: sev.border }}
              data-testid={`interaction-${i.id}`}
            >
              <button
                type="button"
                onClick={() => onToggle(i.id)}
                className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-white/60 transition"
                style={{ background: sev.bg }}
              >
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                  style={{ background: sev.color, color: "white" }}
                >
                  {sev.label}
                </span>
                <span className="flex-1 text-xs font-semibold text-gray-800">{i.title}</span>
                {isOpen
                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                }
              </button>
              {isOpen && (
                <div className="px-3 pb-2.5 pt-1 text-[11px] text-gray-600 leading-relaxed border-t bg-white">
                  {i.note}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
