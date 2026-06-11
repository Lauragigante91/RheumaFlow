import React, { useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  AlertCircle, Wind, Bone, Heart, Activity, ShieldAlert,
  Plus, X, ChevronDown, Eye, Zap, AlertTriangle, Clock,
} from "lucide-react";

const ALL_PROBLEMS = [
  { key: "ild",            label: "ILD / Malattia interstiziale",         Icon: Wind,          color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
  { key: "osteoporosis",   label: "Osteoporosi / GIOP",                   Icon: Bone,          color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
  { key: "hbv",            label: "HBV positivo / screening",             Icon: ShieldAlert,   color: "text-red-700",     bg: "bg-red-50 border-red-200" },
  { key: "fibromyalgia",   label: "Fibromialgia concomitante",            Icon: Activity,      color: "text-violet-700",  bg: "bg-violet-50 border-violet-200" },
  { key: "cardiovascular", label: "Rischio cardiovascolare elevato",      Icon: Heart,         color: "text-rose-700",    bg: "bg-rose-50 border-rose-200" },
  { key: "lymphopenia",    label: "Linfopenia",                           Icon: AlertCircle,   color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
  { key: "erosive",        label: "Malattia erosiva",                     Icon: AlertCircle,   color: "text-orange-700",  bg: "bg-orange-50 border-orange-200" },
  { key: "vasculitis",     label: "Vasculite",                            Icon: Activity,      color: "text-purple-700",  bg: "bg-purple-50 border-purple-200" },
  { key: "renal",          label: "Nefrite / insufficienza renale",       Icon: AlertCircle,   color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
  { key: "diabetes",       label: "Diabete (steroidi o altro)",           Icon: Activity,      color: "text-orange-700",  bg: "bg-orange-50 border-orange-200" },
  // PMR / GCA / LVV specific alerts
  { key: "gca_headache",   label: "⚠ Nuova cefalea → escludere GCA cranica",       Icon: AlertTriangle, color: "text-red-700",     bg: "bg-red-50 border-red-300",    urgent: true },
  { key: "gca_visual",     label: "⚠ Sintomi visivi → rischio cecità urgente",     Icon: Eye,           color: "text-red-700",     bg: "bg-red-50 border-red-300",    urgent: true },
  { key: "gca_jaw",        label: "⚠ Claudicatio mascellare → escludere GCA",      Icon: AlertTriangle, color: "text-red-700",     bg: "bg-red-50 border-red-300",    urgent: true },
  { key: "gca_inflam",     label: "VES/PCR elevata con sintomi — valutare riacutizzazione", Icon: Zap, color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
  { key: "gca_steroid",    label: "Esposizione cronica glucocorticoidi (>3 mesi)", Icon: Bone,          color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
  { key: "gca_pet_pos",    label: "Imaging vascolare recente positivo",            Icon: Zap,           color: "text-purple-700",  bg: "bg-purple-50 border-purple-200" },
  { key: "gca_overdue",    label: "Follow-up scaduto — programmare visita",        Icon: Clock,         color: "text-gray-600",    bg: "bg-gray-50 border-gray-300" },
];

const PMR_KEYS = new Set(["gca_headache","gca_visual","gca_jaw","gca_inflam","gca_steroid","gca_pet_pos","gca_overdue"]);

function detectAutoProblems(patient, labExams, therapies, assessments) {
  const result = new Set();
  const note = (patient?.note || "").toLowerCase();
  const diag = (patient?.diagnosi || "").toLowerCase();

  if (/ild|interstiziale|fibrosi polmonare/.test(note)) result.add("ild");
  if (/osteopor/.test(note)) result.add("osteoporosis");
  if (/hbv|hbs|epatite[\s-]b/.test(note)) result.add("hbv");
  if (/fibromi/.test(note)) result.add("fibromyalgia");
  if (/erosiv/.test(note)) result.add("erosive");
  if (/vasculit/.test(diag) || /vasculit/.test(note)) result.add("vasculitis");
  if (/nefrit|renale|insufficienza renale/.test(note)) result.add("renal");
  if (/diabet/.test(note)) result.add("diabetes");

  const active = (therapies || []).filter(t => t.status === "active");
  if (active.some(t => /predniso|deltacortene|metilpredniso/i.test(t.drug_name || ""))) {
    result.add("cardiovascular");
  }

  for (const e of labExams || []) {
    const lymph = (e.values || {}).lymphocytes;
    if (lymph?.value != null && Number(lymph.value) < 1.0) { result.add("lymphopenia"); break; }
  }

  // PMR / GCA / LVV specific alerts
  const isPmrGca = /pmr|polimialgia|arterite|gca|lvv|takayasu|giant cell/.test(diag);
  if (!isPmrGca) return result;

  // Check recent pmr_activity assessments (last 30 days)
  const now = new Date();
  const cutoff30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const recentPmr = (assessments || []).filter(a =>
    a.index_type === "pmr_activity" && (a.date || "") >= cutoff30
  );

  for (const a of recentPmr) {
    const sx = Array.isArray(a.inputs?.symptoms) ? a.inputs.symptoms : [];
    const sxStr = sx.join(" ").toLowerCase();
    if (/headache|cefalea/.test(sxStr)) result.add("gca_headache");
    if (/visiv|visual|diplop|amauros|offuscam/.test(sxStr)) result.add("gca_visual");
    if (/jaw|masticaz|claudi/.test(sxStr)) result.add("gca_jaw");
    // Elevated inflammatory markers with any symptoms
    const esr = a.inputs?.esr ?? 0;
    const crp = a.inputs?.crp ?? 0;
    if ((esr > 40 || crp > 10) && sx.length > 0) result.add("gca_inflam");
  }

  // Also detect headache/visual from diseaseWidgets symptom keys stored in notes
  for (const a of recentPmr) {
    const noteTxt = (a.notes || "").toLowerCase();
    if (/cefalea|headache/.test(noteTxt)) result.add("gca_headache");
    if (/visiv|diplop|amauros/.test(noteTxt)) result.add("gca_visual");
  }

  // Chronic steroid exposure: any steroid therapy lasting >90 days
  const steroidTherapies = (therapies || []).filter(t =>
    /predniso|deltacortene|metilpredniso|depo.medrol|betameta/i.test(t.drug_name || "")
  );
  for (const th of steroidTherapies) {
    if (!th.start_date) continue;
    const start = new Date(th.start_date);
    const end = th.end_date ? new Date(th.end_date) : now;
    const days = (end - start) / 86400000;
    if (days > 90) { result.add("gca_steroid"); break; }
  }

  // Recent positive imaging (petvas PET+ in last 90 days)
  const cutoff90 = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  const recentImaging = (assessments || []).filter(a =>
    ["petvas","ecodoppler","angio_ct","angio_mri"].includes(a.index_type) &&
    (a.date || "") >= cutoff90
  );
  for (const a of recentImaging) {
    const isPetPos = a.index_type === "petvas" && (
      a.inputs?.pet_positive ||
      Object.values(a.inputs?.territories ?? {}).some(v => v >= 2)
    );
    const hasFindings = a.inputs?.active_districts?.length > 0 ||
      (a.interpretation && /positiv|patolog|halo|stenosi|ispessim/i.test(a.interpretation));
    if (isPetPos || hasFindings) { result.add("gca_pet_pos"); break; }
  }

  // Overdue follow-up: no visit in last 6 months
  const cutoff180 = new Date(now.getTime() - 180 * 86400000).toISOString().slice(0, 10);
  const hasRecentVisit = (assessments || []).some(a =>
    a.index_type === "pmr_activity" && (a.date || "") >= cutoff180
  );
  if (!hasRecentVisit && (assessments || []).some(a => a.index_type === "pmr_activity")) {
    result.add("gca_overdue");
  }

  return result;
}

export default function ActiveProblemsCard({ patient, labExams, therapies, assessments }) {
  const autoDetected = useMemo(
    () => detectAutoProblems(patient, labExams, therapies, assessments),
    [patient, labExams, therapies, assessments]
  );
  const [manual, setManual] = useState(new Set());
  const [adding, setAdding] = useState(false);

  const all = new Set([...autoDetected, ...manual]);

  const addManual = (key) => { setManual(prev => new Set([...prev, key])); setAdding(false); };
  const removeManual = (key) => setManual(prev => { const n = new Set(prev); n.delete(key); return n; });

  const remaining = ALL_PROBLEMS.filter(p => !all.has(p.key));

  // Separate urgent PMR alerts from general problems
  const urgentItems = ALL_PROBLEMS.filter(p => p.urgent && all.has(p.key));
  const generalItems = ALL_PROBLEMS.filter(p => !p.urgent && all.has(p.key));

  return (
    <Card className="border-gray-200 shadow-sm overflow-hidden" data-testid="active-problems-card">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <h3 className="font-heading font-bold text-sm text-[#0A2540] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          Problemi attivi
          {all.size > 0 && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
              {all.size}
            </span>
          )}
        </h3>
        {remaining.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setAdding(v => !v)}
            title="Aggiungi problema"
          >
            {adding ? <ChevronDown className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>

      <div className="p-3 space-y-1.5">
        {all.size === 0 && !adding && (
          <p className="text-xs text-gray-500 italic py-2 text-center">
            Nessun problema attivo rilevato automaticamente.
          </p>
        )}

        {/* Urgent alerts first */}
        {urgentItems.map(prob => {
          const { Icon } = prob;
          return (
            <div key={prob.key}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-md border ${prob.bg} ring-1 ring-red-300`}
              data-testid={`problem-${prob.key}`}>
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${prob.color}`} />
              <span className="text-xs font-semibold flex-1 text-red-800 leading-tight">{prob.label}</span>
              <span className="text-[8px] font-black uppercase tracking-wider text-red-600 bg-red-100 px-1 py-0.5 rounded">URGENTE</span>
              {!autoDetected.has(prob.key) && (
                <button onClick={() => removeManual(prob.key)}
                  className="text-gray-300 hover:text-red-500 transition-colors ml-1">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* General problems */}
        {generalItems.map(prob => {
          const { Icon } = prob;
          const isAuto = autoDetected.has(prob.key);
          return (
            <div key={prob.key}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-md border ${prob.bg}`}
              data-testid={`problem-${prob.key}`}>
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${prob.color}`} />
              <span className="text-xs font-medium flex-1 text-gray-800 leading-tight">{prob.label}</span>
              {isAuto && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 opacity-70">auto</span>
              )}
              {!isAuto && (
                <button onClick={() => removeManual(prob.key)}
                  className="text-gray-300 hover:text-red-500 transition-colors ml-1">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {adding && remaining.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-[10px] uppercase tracking-[0.1em] text-gray-500 mb-2 font-semibold">
              Aggiungi problema
            </div>
            <div className="space-y-0.5">
              {remaining.map(prob => {
                const { Icon } = prob;
                return (
                  <button key={prob.key}
                    onClick={() => addManual(prob.key)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 text-left transition-colors">
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${prob.color}`} />
                    <span className="text-xs text-gray-700">{prob.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
