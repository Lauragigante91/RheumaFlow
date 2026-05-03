import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { statsApi, patientsApi, remindersApi } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Users, Activity, TrendingUp, Bell, Calendar as CalendarIcon,
  FileCheck2, BookOpen, ChevronRight, Stethoscope,
} from "lucide-react";
import { INDEX_LABELS } from "../lib/clinimetrics";
import { CRITERIA, CRITERIA_GROUPS } from "../lib/criteria";
import { GUIDELINES } from "../lib/guidelines";

// Pinned items shown on dashboard for quick access
const PINNED_CRITERIA = [
  "acr_eular_2010_ra",
  "acr_eular_2019_sle",
  "acr_eular_2013_ssc",
  "acr_eular_2023_aps",
  "acr_eular_2022_gca",
  "acr_eular_2022_tak",
];

const PINNED_GUIDELINES = [
  "ers_eular_2025_ctd_ild",
  "eular_2025_ra",
  "eular_2025_behcet",
  "eular_2024_pregnancy",
  "eular_2019_vaccination",
  "acr_aahks_2022_perioperative",
];

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

  const pinnedCriteria = PINNED_CRITERIA
    .map((id) => CRITERIA.find((c) => c.id === id))
    .filter(Boolean);

  const pinnedGuidelines = PINNED_GUIDELINES
    .map((id) => GUIDELINES.find((g) => g.id === id))
    .filter(Boolean);

  const ildGuide = GUIDELINES.find((g) => g.id === "ers_eular_2025_ctd_ild") || GUIDELINES.find((g) => g.id === "ers_acr_eular_2023_ild");

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

      {/* ILD Spotlight - feature card prominently because user explicitly requested it */}
      {ildGuide && (
        <Link
          to="/linee-guida"
          className="block group"
          data-testid="dashboard-ild-spotlight"
        >
          <Card className="relative overflow-hidden border-amber-300 bg-gradient-to-br from-amber-50 via-white to-white p-6 hover:shadow-lg transition-shadow">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-200/30 rounded-full -translate-y-20 translate-x-20 blur-3xl pointer-events-none" />
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-sm bg-amber-600 text-white flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-amber-800 font-semibold">
                  {ildGuide.source} · {ildGuide.year}
                </div>
                <h3 className="font-heading text-xl md:text-2xl font-black tracking-tight text-[#0A2540] mt-1">
                  {ildGuide.name}
                </h3>
                <p className="mt-1.5 text-sm text-gray-700 line-clamp-2">{ildGuide.intro}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-amber-800 group-hover:text-amber-900">
                  Apri linee guida ILD <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </Card>
        </Link>
      )}

      {/* Criteria + Guidelines widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Criteria classificativi */}
        <Card className="border-gray-200 shadow-sm" data-testid="dashboard-criteria-widget">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-sm bg-[#0A2540] flex items-center justify-center">
                <FileCheck2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-bold tracking-tight">Criteri Classificativi</h2>
                <div className="text-xs text-gray-500">{CRITERIA.length} criteri · {CRITERIA_GROUPS.length} malattie</div>
              </div>
            </div>
            <Link to="/criteri">
              <Button variant="outline" size="sm" data-testid="dashboard-criteria-all-btn">
                Tutti <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {pinnedCriteria.map((c) => (
              <Link
                key={c.id}
                to={`/criteri?open=${c.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                data-testid={`dashboard-criterion-${c.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#0A2540] truncate">{c.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{c.source} · {c.disease}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#0A2540] flex-shrink-0" />
              </Link>
            ))}
          </div>
        </Card>

        {/* Guidelines */}
        <Card className="border-gray-200 shadow-sm" data-testid="dashboard-guidelines-widget">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-sm bg-[#0A2540] flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-bold tracking-tight">Linee Guida ACR/EULAR/ERS</h2>
                <div className="text-xs text-gray-500">{GUIDELINES.length} documenti di sintesi</div>
              </div>
            </div>
            <Link to="/linee-guida">
              <Button variant="outline" size="sm" data-testid="dashboard-guidelines-all-btn">
                Tutte <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            {pinnedGuidelines.map((g) => {
              const isILD = g.id === "ers_acr_eular_2023_ild" || g.id === "ers_eular_2025_ctd_ild";
              const isPreg = g.disease === "Gravidanza e RMD";
              const isAPS = g.disease === "APS";
              const isLVV = g.disease === "Vasculiti grandi vasi";
              const isVacc = g.disease === "Vaccinazioni e profilassi";
              const isPeriop = g.disease === "Perioperatorio";
              const isNew = g.year === 2025;
              return (
                <Link
                  key={g.id}
                  to="/linee-guida"
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                  data-testid={`dashboard-guideline-${g.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#0A2540] truncate flex items-center gap-2">
                      {isILD && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] px-1.5 py-0">ILD</Badge>}
                      {isPreg && <Badge className="bg-pink-100 text-pink-800 hover:bg-pink-100 text-[10px] px-1.5 py-0">Gravidanza</Badge>}
                      {isAPS && <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-[10px] px-1.5 py-0">APS</Badge>}
                      {isLVV && <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 text-[10px] px-1.5 py-0">LVV</Badge>}
                      {isVacc && <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 text-[10px] px-1.5 py-0">Vaccini</Badge>}
                      {isPeriop && <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 text-[10px] px-1.5 py-0">Perioperatorio</Badge>}
                      {isNew && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] px-1.5 py-0">2025</Badge>}
                      {g.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{g.source} · {g.year}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#0A2540] flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Reminders + Recent assessments */}
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
