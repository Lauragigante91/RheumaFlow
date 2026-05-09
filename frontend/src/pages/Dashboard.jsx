import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { statsApi, patientsApi, remindersApi } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import {
  Star, Clock, ListTodo, ChevronRight, Plus, AlertTriangle,
  Users, ClipboardList, Loader2, Keyboard,
} from "lucide-react";
import { INDEX_LABELS } from "../lib/clinimetrics";
import { RecallBadge } from "../components/RecallFlagControl";
import QuickTaskDialog from "../components/QuickTaskDialog";
import { toast } from "sonner";

// =============================================================================
// Cockpit operativo: 3 KPI compatti + Clinical To-do List + side widgets.
// =============================================================================

function daysUntil(iso) {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function deadlineLabel(iso) {
  const d = daysUntil(iso);
  if (d == null) return null;
  if (d === 0) return { text: "Oggi", color: "text-amber-700 bg-amber-50 border-amber-200" };
  if (d === 1) return { text: "Domani", color: "text-amber-700 bg-amber-50 border-amber-200" };
  if (d < 0) return { text: `Scaduto ${Math.abs(d)}gg`, color: "text-red-700 bg-red-50 border-red-200" };
  if (d <= 7) return { text: `Tra ${d}gg`, color: "text-gray-700 bg-gray-50 border-gray-200" };
  return { text: `Tra ${d}gg`, color: "text-gray-500 bg-gray-50 border-gray-200" };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 KPI compatti
// ─────────────────────────────────────────────────────────────────────────────
function Kpi({ icon: Icon, label, value, accent, testid }) {
  return (
    <Card className="border-gray-200 shadow-none p-5 hover:shadow-sm transition-shadow" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500 font-semibold">{label}</span>
          <span className="font-mono font-black text-4xl text-[#0A2540] mt-1.5 leading-none">{value}</span>
        </div>
        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${accent || "bg-gray-100 text-gray-600"}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Task card — Clinical To-do List item
// ─────────────────────────────────────────────────────────────────────────────
function TaskRow({ task, patient, onToggleComplete, busy }) {
  const dl = deadlineLabel(task.due_date);
  const isAsap = task.priority === "asap";
  const isOverdue = task.due_date && daysUntil(task.due_date) < 0;
  return (
    <div
      className="group flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/70 transition border-b border-gray-100 last:border-0"
      data-testid={`task-row-${task.id}`}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={(v) => onToggleComplete(task, !!v)}
        disabled={busy}
        className="mt-1 flex-shrink-0"
        data-testid={`task-complete-${task.id}`}
        aria-label="Segna come completato"
      />
      <Link
        to={patient ? `/pazienti/${patient.id}` : "/pazienti"}
        className="flex-1 min-w-0 flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isAsap && (
              <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded">
                <AlertTriangle className="w-2.5 h-2.5" /> ASAP
              </span>
            )}
            <span className={`text-sm font-semibold ${task.completed ? "line-through text-gray-400" : "text-[#0A2540]"} truncate`}>
              {task.title}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 truncate">
            {patient
              ? (patient.cognome && patient.nome
                  ? `${patient.cognome} ${patient.nome}`
                  : patient.codice_paziente || "Paziente")
              : "Paziente non disponibile"}
            {task.notes && <span className="text-gray-400"> · {task.notes}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {dl && (
            <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${dl.color} ${isOverdue && !task.completed ? "" : ""}`}>
              {dl.text}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition" />
        </div>
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact patient row used by side widgets
// ─────────────────────────────────────────────────────────────────────────────
function PatientCompactRow({ patient, right, badge, testid }) {
  return (
    <Link
      to={`/pazienti/${patient.id}`}
      className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50/70 transition border-b border-gray-100 last:border-0"
      data-testid={testid}
    >
      {badge}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#0A2540] truncate">
          {(patient.cognome || patient.nome)
            ? `${patient.cognome || ""} ${patient.nome || ""}`.trim()
            : (patient.codice_paziente || "Paziente")}
        </div>
        <div className="text-[11px] text-gray-500 truncate">{patient.diagnosi || "—"}</div>
      </div>
      {right && <div className="text-[10px] text-gray-500 flex-shrink-0">{right}</div>}
    </Link>
  );
}

// =============================================================================
// Page
// =============================================================================
export default function Dashboard() {
  const [stats, setStats] = useState({ patients: 0, assessments: 0 });
  const [patients, setPatients] = useState([]);
  const [reminders, setReminders] = useState([]); // raw upcoming (asap, not completed)
  const [recallList, setRecallList] = useState([]);
  const [recentMine, setRecentMine] = useState([]);
  const [taskFilter, setTaskFilter] = useState("active"); // active | all
  const [busyTaskId, setBusyTaskId] = useState(null);

  const refresh = async () => {
    const [s, p, u, r, rm] = await Promise.all([
      statsApi.get().catch(() => ({})),
      patientsApi.list().catch(() => []),
      remindersApi.upcoming().catch(() => []),
      patientsApi.listRecall().catch(() => []),
      patientsApi.recentMine(7).catch(() => []),
    ]);
    setStats(s || {});
    setPatients(p || []);
    setReminders(u || []);
    setRecallList(r || []);
    setRecentMine(rm || []);
  };
  useEffect(() => { refresh(); }, []);

  const patientsById = useMemo(
    () => Object.fromEntries(patients.map((p) => [p.id, p])),
    [patients]
  );

  // Sort reminders: incomplete first (overdue, today, soon, future), then completed
  const sortedTasks = useMemo(() => {
    const arr = [...reminders];
    arr.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const da = daysUntil(a.due_date) ?? 9999;
      const db = daysUntil(b.due_date) ?? 9999;
      return da - db;
    });
    return arr;
  }, [reminders]);

  const visibleTasks = useMemo(() => {
    if (taskFilter === "all") return sortedTasks;
    return sortedTasks.filter((t) => !t.completed);
  }, [sortedTasks, taskFilter]);

  const overdueCount = useMemo(
    () => reminders.filter((r) => !r.completed && daysUntil(r.due_date) < 0).length,
    [reminders]
  );
  const activeTodoCount = reminders.filter((r) => !r.completed).length;

  const toggleComplete = async (task, completed) => {
    setBusyTaskId(task.id);
    try {
      await remindersApi.update(task.id, { completed });
      setReminders((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed } : t))
      );
      toast.success(completed ? "Task completato" : "Task riaperto");
    } catch (e) {
      toast.error("Errore aggiornamento task");
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <div className="space-y-6 fade-in" data-testid="dashboard-cockpit">
      {/* ─── Header minimale ──────────────────────────────────────────── */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Cockpit</div>
          <h1 className="font-heading text-3xl md:text-4xl font-black tracking-tighter text-[#0A2540] mt-1">
            Buon lavoro.
          </h1>
        </div>
        <div className="text-[11px] text-gray-500 hidden md:block">
          {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* ─── 3 KPI ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi
          icon={Clock}
          label="Pazienti recenti (7gg)"
          value={recentMine.length}
          accent="bg-blue-50 text-blue-700"
          testid="kpi-recent-mine"
        />
        <Kpi
          icon={ListTodo}
          label="To-do list"
          value={activeTodoCount}
          accent={overdueCount > 0 ? "bg-red-50 text-red-700" : "bg-violet-50 text-violet-700"}
          testid="kpi-todos"
        />
        <Kpi
          icon={Star}
          label="Da ricontrollare"
          value={recallList.length}
          accent="bg-amber-50 text-amber-700"
          testid="kpi-recall"
        />
      </div>

      {/* ─── Main: To-do list + Side widgets ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* MAIN — Clinical To-do List */}
        <Card className="lg:col-span-2 border-gray-200 shadow-none overflow-hidden" data-testid="todo-card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-bold tracking-tight flex items-center gap-2 text-[#0A2540]">
                <ClipboardList className="w-5 h-5" /> Clinical To-do
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Rivalutare PCR · Discussione MDT · Controllare HRCT · Contattare specialista · Richiesta PT biologico
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setTaskFilter("active")}
                className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition ${
                  taskFilter === "active"
                    ? "bg-[#0A2540] text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
                data-testid="filter-active"
              >
                Attivi
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter("all")}
                className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition ${
                  taskFilter === "all"
                    ? "bg-[#0A2540] text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
                data-testid="filter-all"
              >
                Tutti
              </button>
            </div>
          </div>
          {visibleTasks.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <ClipboardList className="w-8 h-8 mx-auto text-gray-300" />
              <p className="text-sm text-gray-500 mt-3">
                {taskFilter === "active"
                  ? "Nessun task attivo. Crea una richiesta dalla scheda paziente."
                  : "Nessun task creato."}
              </p>
              <Link
                to="/pazienti"
                className="inline-flex items-center gap-1.5 mt-4 text-[11px] text-violet-700 hover:underline font-semibold"
              >
                <Plus className="w-3 h-3" /> Apri un paziente
              </Link>
            </div>
          ) : (
            <div data-testid="task-list">
              {visibleTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  patient={patientsById[t.patient_id]}
                  onToggleComplete={toggleComplete}
                  busy={busyTaskId === t.id}
                />
              ))}
            </div>
          )}
        </Card>

        {/* SIDE — Pazienti recenti + Da ricontrollare */}
        <div className="space-y-5">

          {/* Pazienti recenti */}
          <Card className="border-gray-200 shadow-none overflow-hidden" data-testid="recent-mine-card">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-heading text-sm font-bold tracking-tight text-[#0A2540] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Pazienti recenti
              </h3>
            </div>
            {recentMine.length === 0 ? (
              <div className="px-4 py-6 text-center text-[11px] text-gray-400">Nessuna visita negli ultimi 7gg.</div>
            ) : (
              recentMine.slice(0, 6).map((p) => {
                const d = daysUntil(p.last_assessment_at);
                const ago = -d;
                const right = ago === 0 ? "Oggi" : ago === 1 ? "Ieri" : `${ago}gg`;
                return (
                  <PatientCompactRow
                    key={p.id}
                    patient={p}
                    right={right}
                    badge={p.recall ? <RecallBadge flag={p.recall.flag} className="w-3 h-3" /> : null}
                    testid={`recent-mine-${p.id}`}
                  />
                );
              })
            )}
          </Card>

          {/* Da ricontrollare */}
          <Card className="border-gray-200 shadow-none overflow-hidden" data-testid="recall-card">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-heading text-sm font-bold tracking-tight text-[#0A2540] flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" /> Da ricontrollare
              </h3>
            </div>
            {recallList.length === 0 ? (
              <div className="px-4 py-6 text-center text-[11px] text-gray-400">
                Nessun paziente flaggato.
              </div>
            ) : (
              recallList.slice(0, 6).map((p) => (
                <PatientCompactRow
                  key={p.id}
                  patient={p}
                  badge={<RecallBadge flag={p.recall?.flag} className="w-3.5 h-3.5" />}
                  right={p.recall?.set_at ? new Date(p.recall.set_at).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) : null}
                  testid={`recall-row-${p.id}`}
                />
              ))
            )}
          </Card>

          {/* CTA discreto */}
          <Link
            to="/pazienti"
            className="block text-center text-[11px] text-gray-500 hover:text-violet-700 transition"
            data-testid="goto-patients"
          >
            <Users className="w-3 h-3 inline mr-1" />
            {stats.patients ? `${stats.patients} pazienti totali` : "Vedi tutti i pazienti"}
            <ChevronRight className="w-3 h-3 inline ml-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
