import React from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { isRaDiagnosis, isSpaDiagnosis, isSleDiagnosis, isAavDiagnosis, isSjogrenDiagnosis, isMyositisDiagnosis, allDiagnoses } from "../lib/diseaseDetection";

// Map diagnosis flags → list of suggested guideline shortcut entries
function shortcutsFor(patient) {
  const out = [];
  const seen = new Set();
  const push = (key, label, q, color) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, label, q, color });
  };

  if (isRaDiagnosis(patient)) push("ra", "Artrite Reumatoide", "Artrite Reumatoide", "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100");
  if (isSpaDiagnosis(patient)) {
    const flat = (patient?.diagnosi || "").toLowerCase()
      + " " + ((patient?.diagnosi_secondarie || []).join(" ").toLowerCase());
    if (/psor|psa/.test(flat)) {
      push("psa", "Artrite Psoriasica", "Psoriasica", "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200 hover:bg-fuchsia-100");
    } else {
      push("axspa", "Spondilite anchilosante", "Spondiloartrite", "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100");
    }
  }
  if (isSleDiagnosis(patient)) push("sle", "LES", "LES", "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100");
  if (isAavDiagnosis(patient)) push("aav", "Vasculiti ANCA", "Vasculiti", "bg-red-50 text-red-800 border-red-200 hover:bg-red-100");
  if (isSjogrenDiagnosis(patient)) push("sjogren", "Sindrome di Sjögren", "Sjögren", "bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100");
  if (isMyositisDiagnosis(patient)) push("myositis", "Miositi", "Miositi", "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100");

  // Pattern-based shortcuts from free-text diagnoses
  const all = allDiagnoses(patient).join(" | ").toLowerCase();
  if (/\bbeh[çc]et\b/.test(all)) push("behcet", "Behçet", "Behçet", "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100");
  if (/sclerod|ssc|sclerosi sistemica|vedoss/.test(all)) push("ssc", "Sclerosi Sistemica", "Sclerosi Sistemica", "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100");
  if (/gotta|gout/.test(all)) push("gout", "Gotta", "Gotta", "bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100");
  if (/fibromialgia|fibromyalgia/.test(all)) push("fm", "Fibromialgia", "Fibromialgia", "bg-pink-50 text-pink-800 border-pink-200 hover:bg-pink-100");
  if (/ipaf|ild|interstizial/.test(all)) push("ild", "ILD / IPAF", "ILD", "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100");
  if (/osteoporosi|osteoporos/.test(all)) push("op", "Osteoporosi", "Osteoporosi", "bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100");
  if (/aps|antifosfolipid/.test(all)) push("aps", "APS", "APS", "bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100");
  if (/igg4|emocromatosi|haemoch/.test(all)) push("igg4", "IgG4-RD / Emocromatosi", "IgG4", "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100");
  if (/pmr|polimialg/.test(all)) push("pmr", "Polimialgia Reumatica", "PMR", "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100");
  if (/gca|horton|takayasu|arterite/.test(all)) push("lvv", "Vasculiti grandi vasi", "GCA", "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100");

  return out;
}

export default function PatientGuidelinesShortcut({ patient }) {
  const shortcuts = shortcutsFor(patient);
  if (shortcuts.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="guidelines-shortcuts">
      <span className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mr-1 inline-flex items-center gap-1">
        <BookOpen className="w-3 h-3" /> Linee guida:
      </span>
      {shortcuts.map((s) => (
        <Link
          key={s.key}
          to={`/linee-guida?q=${encodeURIComponent(s.q)}`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition ${s.color}`}
          data-testid={`guideline-shortcut-${s.key}`}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}
