import React, { useMemo, useState } from "react";
import { parseTherapyEvents, ACTION_COLORS } from "../../lib/therapyEventParser";
import { findDrug } from "../../lib/drugs";

const LAUNCHABLE_THERAPY_ACTIONS = new Set(["start", "stop", "increase", "decrease"]);

const THERAPY_ACTION_LABELS = {
  start: "Start",
  stop: "Stop",
  increase: "Aumento",
  decrease: "Riduzione",
};

function normDrugName(name) {
  return String(name || "").trim().toLowerCase();
}

function therapyLauncherKey(ev) {
  return [ev.action, ev.drug_name, ev.dose, ev.frequency, ev.route, ev.source_text].filter(Boolean).join("::");
}

function findActiveTherapyForDrug(therapies, drugName) {
  const wanted = normDrugName(drugName);
  if (!wanted) return null;
  return (therapies || []).find(t => {
    if (t.status !== "active") return false;
    const canonical = findDrug(t.drug_name)?.name || t.drug_name;
    return normDrugName(canonical) === wanted || normDrugName(t.drug_name) === wanted;
  }) || null;
}

export default function TherapyActionLauncher({ text, therapies, onAddTherapy }) {
  const [ignoredTherapyActions, setIgnoredTherapyActions] = useState(new Set());

  const therapyLauncherActions = useMemo(() => {
    return parseTherapyEvents(text)
      .filter(ev => LAUNCHABLE_THERAPY_ACTIONS.has(ev.action))
      .map(ev => {
        const drug = findDrug(ev.drug_name);
        if (!drug) return null;
        const targetTherapy = ev.action === "start" ? null : findActiveTherapyForDrug(therapies, drug.name);
        const requiresActive = ev.action !== "start";
        return {
          ...ev,
          key: therapyLauncherKey(ev),
          drug_name: drug.name,
          drug_canonical: drug.name,
          category: drug.category || ev.category,
          targetTherapy,
          canOpen: !requiresActive || !!targetTherapy,
          blockedReason: requiresActive && !targetTherapy ? "Terapia attiva non trovata" : "",
        };
      })
      .filter(Boolean)
      .filter(ev => !ignoredTherapyActions.has(ev.key));
  }, [text, therapies, ignoredTherapyActions]);

  const ignoreTherapyAction = (key) => {
    setIgnoredTherapyActions(prev => new Set([...prev, key]));
  };

  if (therapyLauncherActions.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3" data-testid="therapy-launcher-card">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 mb-2">
        Azioni terapeutiche rilevate
      </div>
      <div className="space-y-2">
        {therapyLauncherActions.map(action => {
          const colors = ACTION_COLORS[action.action] || ACTION_COLORS.continue;
          const details = [action.dose, action.frequency, action.route].filter(Boolean).join(" ");
          return (
            <div key={action.key} className="flex items-start gap-2 rounded-md border border-white/70 bg-white px-2.5 py-2 text-xs shadow-sm">
              <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${colors.badge} ${colors.text}`}>
                {THERAPY_ACTION_LABELS[action.action] || action.label}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-800">
                  {action.drug_name}{details ? ` ${details}` : ""}
                </div>
                {action.reason && <div className="text-[11px] text-gray-500">Motivo: {action.reason}</div>}
                {action.blockedReason && <div className="text-[11px] text-amber-700">{action.blockedReason}</div>}
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={!action.canOpen}
                  onClick={() => onAddTherapy?.(action)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                    action.canOpen
                      ? "border-[#0A2540]/30 text-[#0A2540] hover:bg-[#0A2540] hover:text-white"
                      : "cursor-not-allowed border-gray-200 text-gray-300"
                  }`}
                >
                  Apri schema
                </button>
                <button
                  type="button"
                  onClick={() => ignoreTherapyAction(action.key)}
                  className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-50"
                >
                  Ignora
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
