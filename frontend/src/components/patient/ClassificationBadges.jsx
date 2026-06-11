import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "../ui/badge";
import { FileCheck2, ShieldCheck, ShieldX } from "lucide-react";

/**
 * Compact static classification summary.
 * Shows the most recent result per criteria type — no longitudinal history,
 * no per-visit repetition. Pure baseline metadata.
 */
export default function ClassificationBadges({ criteriaEvals = [], patientId }) {
  if (!criteriaEvals.length) {
    return (
      <div className="flex items-center justify-between flex-wrap gap-2 px-1 py-0.5">
        <span className="text-xs text-gray-400 italic">Nessun criterio classificativo applicato.</span>
        {patientId && (
          <Link
            to={`/criteri?paziente=${patientId}`}
            className="inline-flex items-center gap-1 text-xs text-[#0A2540] hover:underline font-medium"
          >
            <FileCheck2 className="w-3.5 h-3.5" /> Applica criteri
          </Link>
        )}
      </div>
    );
  }

  const latestByCriteria = Object.values(
    criteriaEvals.reduce((acc, ce) => {
      const key = ce.criteria_name;
      if (!acc[key] || ce.date > acc[key].date) acc[key] = ce;
      return acc;
    }, {})
  ).sort((a, b) => a.criteria_name.localeCompare(b.criteria_name, "it"));

  return (
    <div className="flex items-start justify-between flex-wrap gap-3 px-1 py-0.5">
      <div className="flex flex-wrap gap-2">
        {latestByCriteria.map((ce) => (
          <div
            key={ce.criteria_name}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold border ${
              ce.meets
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-gray-50 border-gray-200 text-gray-500"
            }`}
            title={`${ce.criteria_name} · ${ce.score} / ≥${ce.threshold} · ${new Date(ce.date).toLocaleDateString("it-IT")}`}
          >
            {ce.meets
              ? <ShieldCheck className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              : <ShieldX className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
            <span>{ce.criteria_name}</span>
            <span className={`font-mono ${ce.meets ? "text-green-700" : "text-gray-400"}`}>
              {ce.score}/{ce.threshold}
            </span>
          </div>
        ))}
      </div>
      {patientId && (
        <Link
          to={`/criteri?paziente=${patientId}`}
          className="inline-flex items-center gap-1 text-xs text-[#0A2540] hover:underline font-medium flex-shrink-0"
        >
          <FileCheck2 className="w-3.5 h-3.5" /> Applica / aggiorna
        </Link>
      )}
    </div>
  );
}
