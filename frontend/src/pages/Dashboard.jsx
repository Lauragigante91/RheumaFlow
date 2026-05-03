import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { statsApi, patientsApi, remindersApi } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Users, Activity, Plus, TrendingUp, Bell, Calendar as CalendarIcon } from "lucide-react";
import { INDEX_LABELS } from "../lib/clinimetrics";

export default function Dashboard() {
  const [stats, setStats] = useState({ patients: 0, assessments: 0, recent_assessments: [] });
  const [patients, setPatients] = useState([]);
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    statsApi.get().then(setStats).catch(() => {});
    patientsApi.list().then(setPatients).catch(() => {});
    remindersApi.upcoming().then(setUpcoming).catch(() => setUpcoming([]));
  }, []);

  const patientsById = Object.fromEntries(patients.map((p) => [p.id, p]));

  const daysUntil = (iso) => {
    const due = new Date(iso);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.floor((due - now) / 86400000);
  };

  const overdueCount = upcoming.filter((r) => daysUntil(r.due_date) < 0).length;

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">
            Panoramica clinica
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tighter text-[#0A2540]">
            Dashboard
          </h1>
          <p className="mt-2 text-gray-600 max-w-2xl">
            Gestione delle valutazioni clinimetriche per le malattie reumatiche.
          </p>
        </div>
        <Link to="/pazienti">
          <Button className="bg-[#0A2540] hover:bg-[#051626] text-white" data-testid="dashboard-go-patients-btn">
            <Users className="w-4 h-4 mr-2" /> Vai ai pazienti
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon={Users} label="Pazienti" value={stats.patients} testid="stat-patients" />
        <StatCard icon={Activity} label="Valutazioni totali" value={stats.assessments} testid="stat-assessments" />
        <StatCard icon={TrendingUp} label="Ultime 5" value={(stats.recent_assessments || []).length} testid="stat-recent" />
        <StatCard icon={Bell} label="Reminder attivi" value={upcoming.length} testid="stat-reminders" highlight={overdueCount > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming reminders */}
        <Card className="border-gray-200 shadow-sm" data-testid="upcoming-reminders-card">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="w-5 h-5" /> Prossimi reminder
            </h2>
            {overdueCount > 0 && <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{overdueCount} scaduti</Badge>}
          </div>
          <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
            {upcoming.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">Nessun reminder pendente.</div>
            ) : (
              upcoming.slice(0, 8).map((r) => {
                const p = patientsById[r.patient_id];
                const days = daysUntil(r.due_date);
                const cls = days < 0 ? "text-red-700" : days <= 7 ? "text-amber-700" : "text-gray-700";
                return (
                  <Link
                    key={r.id}
                    to={p ? `/pazienti/${p.id}` : "/pazienti"}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[#0A2540] truncate">{r.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {p ? `${p.cognome} ${p.nome}` : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-medium ${cls}`}>
                        {days < 0 ? `Scaduto ${Math.abs(days)}gg fa` : days === 0 ? "Oggi" : `Tra ${days}gg`}
                      </div>
                      <div className="text-[10px] text-gray-500 flex items-center justify-end gap-1 mt-0.5">
                        <CalendarIcon className="w-2.5 h-2.5" /> {new Date(r.due_date).toLocaleDateString("it-IT")}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </Card>

        {/* Recent assessments */}
        <Card className="border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="font-heading text-xl font-bold tracking-tight">Valutazioni recenti</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
            {(stats.recent_assessments || []).length === 0 && (
              <div className="p-10 text-center text-gray-500">
                Nessuna valutazione registrata.
              </div>
            )}
            {(stats.recent_assessments || []).map((a) => {
              const p = patientsById[a.patient_id];
              return (
                <Link
                  key={a.id}
                  to={p ? `/pazienti/${p.id}` : "/pazienti"}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="font-medium text-[#0A2540]">
                      {p ? `${p.cognome} ${p.nome}` : "Paziente rimosso"}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {INDEX_LABELS[a.index_type] || a.index_type} · {new Date(a.date).toLocaleDateString("it-IT")}
                      {a.created_by_name && ` · ${a.created_by_name}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-lg">{a.score ?? "-"}</div>
                    <div className="text-xs text-gray-500">{a.interpretation || ""}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, testid, highlight }) {
  return (
    <Card className={`border-gray-200 shadow-sm p-6 ${highlight ? "ring-2 ring-red-300" : ""}`} data-testid={testid}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{label}</div>
          <div className="mt-3 font-heading font-black text-4xl text-[#0A2540]">{value}</div>
        </div>
        <div className={`w-10 h-10 ${highlight ? "bg-red-600" : "bg-[#0A2540]"} flex items-center justify-center rounded-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </Card>
  );
}
