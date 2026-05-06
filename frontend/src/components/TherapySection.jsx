import React, { useEffect, useState, useMemo } from "react";
import { therapiesApi } from "../lib/api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Plus, Pill, Trash2, Edit, CheckCircle2, XCircle, Sparkles, AlertTriangle, Info as InfoIcon } from "lucide-react";
import { toast } from "sonner";
import ItalianDatePicker from "./ItalianDatePicker";
import { THERAPY_CATEGORIES, suggestTherapiesForDiagnosis } from "../lib/therapySuggestions";
import { DRUGS, INDICATIONS, findDrug, formatRegimen } from "../lib/drugs";
import { detectInteractions, SEVERITY } from "../lib/drugInteractions";

const STATUS_LABELS = {
  active: "In corso",
  discontinued: "Sospesa",
  completed: "Completata",
};

const STATUS_COLORS = {
  active: "bg-green-700 hover:bg-green-700 text-white",
  discontinued: "bg-red-100 text-red-800 hover:bg-red-100",
  completed: "bg-gray-200 text-gray-800 hover:bg-gray-200",
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
};

export default function TherapySection({ patient }) {
  const [therapies, setTherapies] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    if (!patient?.id) return;
    const data = await therapiesApi.listByPatient(patient.id);
    setTherapies(data);
  };

  useEffect(() => { load(); }, [patient?.id]);

  const suggestions = useMemo(() => suggestTherapiesForDiagnosis(patient?.diagnosi), [patient?.diagnosi]);
  const allSuggested = suggestions.flatMap((s) => s.drugs);

  const openNew = (preset = null) => {
    setEditing(null);
    if (preset) {
      setForm({ ...emptyForm, drug_name: preset.name, category: preset.category, dose: preset.typical || "" });
    } else {
      setForm(emptyForm);
    }
    setOpen(true);
  };

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
  const past = therapies.filter((t) => t.status !== "active");

  // Rilevamento interazioni farmacologiche (solo terapie in corso)
  const interactions = useMemo(
    () => detectInteractions(active.map((t) => t.drug_name).filter(Boolean)),
    [active]
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
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl tracking-tight">Terapia in corso ({active.length})</h2>
        <Button onClick={() => openNew()} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="add-therapy-btn">
          <Plus className="w-4 h-4 mr-2" /> Aggiungi terapia
        </Button>
      </div>

      {/* Drug interaction alerts */}
      {interactions.length > 0 && (
        <InteractionAlerts interactions={interactions} />
      )}

      {/* Active therapies */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        {active.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Nessuna terapia in corso.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {active.map((t) => (
              <TherapyRow key={t.id} t={t} onEdit={openEdit} onRemove={remove} />
            ))}
          </div>
        )}
      </Card>

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

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-black tracking-tight">
              {editing ? "Modifica terapia" : "Nuova terapia"}
            </DialogTitle>
          </DialogHeader>
          {previewInteractions.length > 0 && (
            <div data-testid="therapy-form-interactions">
              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-600 mb-1.5">
                ⚡ Verifica interazioni in tempo reale
              </div>
              <InteractionAlerts interactions={previewInteractions} />
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
    </div>
  );
}

function TherapyRow({ t, onEdit, onRemove, dimmed }) {
  return (
    <div className={`flex items-start justify-between gap-4 p-4 ${dimmed ? "opacity-70" : ""}`} data-testid={`therapy-row-${t.id}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Pill className="w-4 h-4 text-[#0A2540]" />
          <span className="font-heading font-bold text-base">{t.drug_name}</span>
          <Badge variant="outline" className="text-xs">{THERAPY_CATEGORIES[t.category] || t.category}</Badge>
          <Badge className={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge>
        </div>
        <div className="text-sm text-gray-600 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {t.dose && <span><strong>Dose:</strong> {t.dose}</span>}
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

function InteractionAlerts({ interactions }) {
  const [expanded, setExpanded] = useState(new Set());
  const counts = interactions.reduce((acc, i) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1;
    return acc;
  }, {});
  const top = interactions[0].severity;
  const topSev = SEVERITY[top];

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card
      className="p-4 border-2"
      style={{
        borderColor: topSev.border,
        background: topSev.bg,
      }}
      data-testid="interactions-alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: topSev.color }} />
        <div className="flex-1 min-w-0">
          <h4 className="font-heading font-bold text-sm tracking-tight" style={{ color: topSev.color }}>
            {interactions.length === 1
              ? "1 interazione farmacologica rilevata"
              : `${interactions.length} interazioni farmacologiche rilevate`}
          </h4>
          <div className="flex flex-wrap gap-2 mt-1 text-[11px]">
            {counts.major && (
              <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: SEVERITY.major.color, color: "white" }}>
                {counts.major} Maggiore
              </span>
            )}
            {counts.moderate && (
              <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: SEVERITY.moderate.color, color: "white" }}>
                {counts.moderate} Moderata
              </span>
            )}
            {counts.minor && (
              <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: SEVERITY.minor.color, color: "white" }}>
                {counts.minor} Minore
              </span>
            )}
          </div>
          <ul className="mt-3 space-y-2">
            {interactions.map((i) => {
              const sev = SEVERITY[i.severity];
              const isOpen = expanded.has(i.id);
              return (
                <li
                  key={i.id}
                  className="bg-white/80 border rounded-md overflow-hidden"
                  style={{ borderColor: sev.border }}
                  data-testid={`interaction-${i.id}`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(i.id)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: sev.color, color: "white" }}
                      >
                        {sev.label}
                      </span>
                      <span className="text-sm font-semibold truncate">{i.title}</span>
                    </div>
                    <InfoIcon className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} style={{ color: sev.color }} />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 text-xs text-gray-700 leading-relaxed border-t bg-white" style={{ borderColor: sev.border }}>
                      {i.note}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-[10px] text-gray-500 italic mt-2">
            Gli alert sono informativi e non sostituiscono il giudizio clinico.
          </p>
        </div>
      </div>
    </Card>
  );
}
