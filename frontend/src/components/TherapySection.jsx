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
import { Plus, Pill, Trash2, Edit, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ItalianDatePicker from "./ItalianDatePicker";
import { THERAPY_CATEGORIES, suggestTherapiesForDiagnosis } from "../lib/therapySuggestions";

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
    setForm({ ...emptyForm, ...t });
    setOpen(true);
  };

  const save = async () => {
    if (!form.drug_name) {
      toast.error("Specifica il nome del farmaco");
      return;
    }
    try {
      if (editing) {
        await therapiesApi.update(editing.id, form);
        toast.success("Terapia aggiornata");
      } else {
        await therapiesApi.create({ ...form, patient_id: patient.id });
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

  return (
    <div className="space-y-4" data-testid="therapy-section">
      {/* Suggestions banner */}
      {allSuggested.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/40 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#0A2540] mt-0.5" />
            <div className="flex-1">
              <h4 className="font-heading font-bold text-sm tracking-tight">Terapie suggerite per {patient.diagnosi}</h4>
              <p className="text-xs text-gray-600 mt-1">Clicca per pre-compilare il form</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {allSuggested.slice(0, 30).map((d, i) => (
                  <Button key={i} variant="outline" size="sm" className="bg-white text-xs h-7" onClick={() => openNew(d)} data-testid={`suggested-therapy-${i}`}>
                    <Pill className="w-3 h-3 mr-1" /> {d.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl tracking-tight">Terapia in corso ({active.length})</h2>
        <Button onClick={() => openNew()} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="add-therapy-btn">
          <Plus className="w-4 h-4 mr-2" /> Aggiungi terapia
        </Button>
      </div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Farmaco *</Label>
              <Input value={form.drug_name} onChange={(e) => setForm({ ...form, drug_name: e.target.value })} data-testid="therapy-drug" />
            </div>
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
