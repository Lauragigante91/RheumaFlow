import React, { useEffect, useState } from "react";
import { remindersApi, api } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Plus, Bell, Trash2, Calendar as CalendarIcon, User, Zap, Lock, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import ItalianDatePicker from "../shared/ItalianDatePicker";

const REMINDER_TYPES = {
  follow_up: "Visita di controllo",
  lab: "Esami di laboratorio",
  imaging: "Imaging",
  therapy: "Modifica terapia",
  capillaroscopy: "Capillaroscopia",
  ethics_committee: "Comitato etico",
  other: "Altro",
};

const QUICK_PRESETS_ROUTINE = [
  { label: "Prossima visita (~3 mesi)", days: 90 },
  { label: "+6 mesi", days: 180 },
  { label: "+12 mesi", days: 365 },
];

const QUICK_PRESETS_ASAP = [
  { label: "Oggi", days: 0 },
  { label: "+3 gg", days: 3 },
  { label: "+1 settimana", days: 7 },
  { label: "+2 settimane", days: 14 },
];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(iso) {
  if (!iso) return null;
  const due = new Date(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((due - now) / 86400000);
}

const emptyForm = {
  title: "",
  type: "follow_up",
  due_date: "",
  notes: "",
  completed: false,
  priority: "routine",
  visibility: "shared",
  shared_with_user_ids: [],
};

export default function RemindersSection({ patient }) {
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [members, setMembers] = useState([]);

  const load = async () => {
    if (!patient?.id) return;
    const data = await remindersApi.listByPatient(patient.id);
    setReminders(data);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id]);

  useEffect(() => {
    api
      .get("/organization/members")
      .then((res) => setMembers(res.data || []))
      .catch(() => setMembers([]));
  }, []);

  const openNew = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const save = async () => {
    if (!form.title || !form.due_date) {
      toast.error("Titolo e data sono obbligatori");
      return;
    }
    try {
      const payload = { ...form, patient_id: patient.id };
      // If shared, drop shared_with_user_ids
      if (payload.visibility === "shared") payload.shared_with_user_ids = [];
      await remindersApi.create(payload);
      toast.success("Richiesta creata");
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
    if (!window.confirm("Eliminare questa richiesta?")) return;
    try {
      await remindersApi.remove(r.id);
      toast.success("Eliminata");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore");
    }
  };

  const pending = reminders.filter((r) => !r.completed);
  const completed = reminders.filter((r) => r.completed);

  const otherMembers = members.filter((m) => m.id !== user?.id);

  const togglePriority = (val) => setForm((p) => ({ ...p, priority: val }));
  const toggleVisibility = (val) => setForm((p) => ({ ...p, visibility: val }));
  const toggleShareUser = (uid) =>
    setForm((p) => {
      const cur = p.shared_with_user_ids || [];
      return {
        ...p,
        shared_with_user_ids: cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid],
      };
    });

  return (
    <div className="space-y-3" data-testid="reminders-section">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-xl tracking-tight">Reminder &amp; richieste</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Visite di controllo programmate · richieste urgenti che compaiono in dashboard
          </p>
        </div>
        <Button onClick={openNew} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="add-reminder-btn">
          <Plus className="w-4 h-4 mr-2" /> Aggiungi
        </Button>
      </div>

      <Card className="border-gray-200 shadow-sm overflow-hidden">
        {pending.length === 0 && completed.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Nessun reminder programmato.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pending.map((r) => (
              <ReminderRow key={r.id} r={r} onToggle={toggleComplete} onRemove={remove} currentUserId={user?.id} />
            ))}
            {completed.length > 0 && (
              <div className="bg-gray-50 px-4 py-2 text-xs uppercase tracking-[0.15em] text-gray-500">Completati</div>
            )}
            {completed.map((r) => (
              <ReminderRow key={r.id} r={r} onToggle={toggleComplete} onRemove={remove} currentUserId={user?.id} dimmed />
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading font-black tracking-tight">Nuova richiesta / reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Priority selector */}
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600 mb-2 block">
                Tipo di richiesta
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => togglePriority("routine")}
                  className={`flex items-start gap-3 p-3 border-2 rounded-md text-left transition ${
                    form.priority === "routine"
                      ? "border-[#0A2540] bg-blue-50/40"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  data-testid="priority-routine"
                >
                  <CalendarIcon className="w-5 h-5 text-[#0A2540] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-heading font-bold text-sm">Programmata</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Da rivedere alla prossima visita / tra 6 mesi / 1 anno. Visibile solo dentro la scheda paziente.
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => togglePriority("asap")}
                  className={`flex items-start gap-3 p-3 border-2 rounded-md text-left transition ${
                    form.priority === "asap"
                      ? "border-amber-600 bg-amber-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  data-testid="priority-asap"
                >
                  <Zap className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-heading font-bold text-sm">Urgente / da fare prima possibile</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Compare nella dashboard finché non viene completata. Es. comitato etico, esame da prenotare.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Categoria</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger data-testid="reminder-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REMINDER_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Titolo *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="es. Richiesta CE per off-label MMF"
                  data-testid="reminder-title"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Data scadenza *</Label>
              <ItalianDatePicker value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} testid="reminder-date" />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(form.priority === "asap" ? QUICK_PRESETS_ASAP : QUICK_PRESETS_ROUTINE).map((p) => (
                  <Button
                    key={p.days}
                    variant="outline"
                    size="sm"
                    type="button"
                    className="text-xs h-7"
                    onClick={() => setForm({ ...form, due_date: addDays(p.days) })}
                    data-testid={`quick-${p.days}`}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Note</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="reminder-notes" />
            </div>

            {/* Visibility */}
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600 mb-2 block">Visibilità</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => toggleVisibility("shared")}
                  className={`flex items-start gap-3 p-3 border-2 rounded-md text-left transition ${
                    form.visibility === "shared" ? "border-[#0A2540] bg-blue-50/40" : "border-gray-200 hover:border-gray-300"
                  }`}
                  data-testid="visibility-shared"
                >
                  <UsersIcon className="w-5 h-5 text-[#0A2540] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-heading font-bold text-sm">Condivisa nell'UO</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Tutti i medici dell'unità operativa la vedono e possono completarla.
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => toggleVisibility("private")}
                  className={`flex items-start gap-3 p-3 border-2 rounded-md text-left transition ${
                    form.visibility === "private" ? "border-purple-600 bg-purple-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                  data-testid="visibility-private"
                >
                  <Lock className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-heading font-bold text-sm">Privata</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Solo tu (e i colleghi che selezioni qui sotto) la vedi.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {form.visibility === "private" && otherMembers.length > 0 && (
              <div>
                <Label className="text-xs uppercase tracking-[0.15em] text-gray-600 mb-2 block">
                  Condividi anche con (facoltativo)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {otherMembers.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={form.shared_with_user_ids.includes(m.id)}
                        onCheckedChange={() => toggleShareUser(m.id)}
                        data-testid={`share-with-${m.id}`}
                      />
                      <div className="text-xs leading-tight">
                        <div className="font-semibold">{m.name || m.email}</div>
                        <div className="text-gray-500">{m.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" onClick={save} data-testid="save-reminder-btn">
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReminderRow({ r, onToggle, onRemove, dimmed, currentUserId }) {
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

  const isAsap = r.priority === "asap";
  const isPrivate = r.visibility === "private";
  const isMine = currentUserId && r.created_by === currentUserId;

  return (
    <div
      className={`flex items-start gap-3 p-4 ${dimmed ? "opacity-60" : ""} ${isAsap ? "bg-amber-50/40" : ""}`}
      data-testid={`reminder-row-${r.id}`}
    >
      <Checkbox checked={r.completed} onCheckedChange={() => onToggle(r)} data-testid={`toggle-reminder-${r.id}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {isAsap ? <Zap className="w-4 h-4 text-amber-600" /> : <Bell className="w-4 h-4 text-[#0A2540]" />}
          <span className={`font-heading font-bold text-sm ${r.completed ? "line-through text-gray-500" : ""}`}>
            {r.title}
          </span>
          <Badge variant="outline" className="text-xs">
            {REMINDER_TYPES[r.type] || r.type}
          </Badge>
          {!r.completed && <Badge className={urgencyClass}>{dueLabel}</Badge>}
          {isAsap && (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">
              <Zap className="w-3 h-3 mr-1" /> Urgente
            </Badge>
          )}
          {isPrivate && (
            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-xs" title={isMine ? "Privata (creata da te)" : "Privata (condivisa con te)"}>
              <Lock className="w-3 h-3 mr-1" /> Privata
            </Badge>
          )}
        </div>
        <div className="text-xs text-gray-600 mt-1 flex items-center gap-2 flex-wrap">
          <CalendarIcon className="w-3 h-3" /> {new Date(r.due_date).toLocaleDateString("it-IT")}
          {r.created_by_name && (
            <>
              <span>·</span>
              <User className="w-3 h-3" /> {r.created_by_name}
            </>
          )}
        </div>
        {r.notes && <div className="text-xs text-gray-500 mt-1">{r.notes}</div>}
      </div>
      <Button variant="ghost" size="icon" onClick={() => onRemove(r)} data-testid={`delete-reminder-${r.id}`}>
        <Trash2 className="w-4 h-4 text-red-600" />
      </Button>
    </div>
  );
}
