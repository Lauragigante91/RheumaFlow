import React, { useEffect, useState } from "react";
import { remindersApi } from "../lib/api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Plus, Bell, Trash2, Calendar as CalendarIcon, User } from "lucide-react";
import { toast } from "sonner";
import ItalianDatePicker from "./ItalianDatePicker";

const REMINDER_TYPES = {
  follow_up: "Visita di controllo",
  lab: "Esami di laboratorio",
  imaging: "Imaging",
  therapy: "Modifica terapia",
  capillaroscopy: "Capillaroscopia",
  other: "Altro",
};

const QUICK_PRESETS = [
  { label: "+1 mese", days: 30 },
  { label: "+3 mesi", days: 90 },
  { label: "+6 mesi", days: 180 },
  { label: "+12 mesi", days: 365 },
];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(iso) {
  if (!iso) return null;
  const due = new Date(iso);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.floor((due - now) / 86400000);
}

const emptyForm = { title: "", type: "follow_up", due_date: "", notes: "", completed: false };

export default function RemindersSection({ patient }) {
  const [reminders, setReminders] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    if (!patient?.id) return;
    const data = await remindersApi.listByPatient(patient.id);
    setReminders(data);
  };
  useEffect(() => { load(); }, [patient?.id]);

  const openNew = () => { setForm(emptyForm); setOpen(true); };

  const save = async () => {
    if (!form.title || !form.due_date) {
      toast.error("Titolo e data sono obbligatori");
      return;
    }
    try {
      await remindersApi.create({ ...form, patient_id: patient.id });
      toast.success("Reminder creato");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore");
    }
  };

  const toggleComplete = async (r) => {
    await remindersApi.update(r.id, { completed: !r.completed });
    load();
  };

  const remove = async (r) => {
    if (!window.confirm("Eliminare questo reminder?")) return;
    await remindersApi.remove(r.id);
    toast.success("Eliminato");
    load();
  };

  const pending = reminders.filter((r) => !r.completed);
  const completed = reminders.filter((r) => r.completed);

  return (
    <div className="space-y-3" data-testid="reminders-section">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl tracking-tight">Reminder follow-up</h2>
        <Button onClick={openNew} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="add-reminder-btn">
          <Plus className="w-4 h-4 mr-2" /> Aggiungi reminder
        </Button>
      </div>

      <Card className="border-gray-200 shadow-sm overflow-hidden">
        {pending.length === 0 && completed.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Nessun reminder programmato.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pending.map((r) => <ReminderRow key={r.id} r={r} onToggle={toggleComplete} onRemove={remove} />)}
            {completed.length > 0 && (
              <div className="bg-gray-50 px-4 py-2 text-xs uppercase tracking-[0.15em] text-gray-500">Completati</div>
            )}
            {completed.map((r) => <ReminderRow key={r.id} r={r} onToggle={toggleComplete} onRemove={remove} dimmed />)}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading font-black tracking-tight">Nuovo reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger data-testid="reminder-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REMINDER_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Titolo *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="es. Capillaroscopia di controllo"
                data-testid="reminder-title"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Data scadenza *</Label>
              <ItalianDatePicker value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} testid="reminder-date" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {QUICK_PRESETS.map((p) => (
                  <Button key={p.days} variant="outline" size="sm" type="button" className="text-xs h-7" onClick={() => setForm({ ...form, due_date: addDays(p.days) })} data-testid={`quick-${p.days}`}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Note</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="reminder-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" onClick={save} data-testid="save-reminder-btn">Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReminderRow({ r, onToggle, onRemove, dimmed }) {
  const days = daysUntil(r.due_date);
  let urgency = "default";
  if (!r.completed) {
    if (days < 0) urgency = "overdue";
    else if (days <= 7) urgency = "soon";
    else if (days <= 30) urgency = "month";
  }
  const urgencyClass = {
    overdue: "bg-red-100 text-red-800 hover:bg-red-100",
    soon: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    month: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    default: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  }[urgency];
  const dueLabel = days < 0 ? `Scaduto da ${Math.abs(days)}gg` : days === 0 ? "Oggi" : `Tra ${days}gg`;

  return (
    <div className={`flex items-start gap-3 p-4 ${dimmed ? "opacity-60" : ""}`} data-testid={`reminder-row-${r.id}`}>
      <Checkbox checked={r.completed} onCheckedChange={() => onToggle(r)} data-testid={`toggle-reminder-${r.id}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Bell className="w-4 h-4 text-[#0A2540]" />
          <span className={`font-heading font-bold text-sm ${r.completed ? "line-through text-gray-500" : ""}`}>{r.title}</span>
          <Badge variant="outline" className="text-xs">{REMINDER_TYPES[r.type] || r.type}</Badge>
          {!r.completed && <Badge className={urgencyClass}>{dueLabel}</Badge>}
        </div>
        <div className="text-xs text-gray-600 mt-1 flex items-center gap-2 flex-wrap">
          <CalendarIcon className="w-3 h-3" /> {new Date(r.due_date).toLocaleDateString("it-IT")}
          {r.created_by_name && (<><span>·</span><User className="w-3 h-3" /> {r.created_by_name}</>)}
        </div>
        {r.notes && <div className="text-xs text-gray-500 mt-1">{r.notes}</div>}
      </div>
      <Button variant="ghost" size="icon" onClick={() => onRemove(r)} data-testid={`delete-reminder-${r.id}`}>
        <Trash2 className="w-4 h-4 text-red-600" />
      </Button>
    </div>
  );
}
