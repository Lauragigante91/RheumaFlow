import React, { useEffect, useState } from "react";
import { diseaseProfileApi } from "../lib/api";
import { Card } from "./ui/card";
import { HeartPulse, Stethoscope, AlertCircle } from "lucide-react";
import { summarizeAav } from "./AavProfileSection";

// Card compatta da mostrare in intestazione paziente (solo se vasculite)
export default function AavSummaryHeader({ patient, reloadKey }) {
  const [profile, setProfile] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "aav")
      .then((doc) => setProfile(doc?.data || null))
      .catch(() => setProfile(null))
      .finally(() => setLoaded(true));
  }, [patient?.id, reloadKey]);

  if (!loaded) return null;
  const summary = summarizeAav(profile);
  const hasData = summary.organs.length > 0 || summary.basis.length > 0 || summary.anca;

  if (!hasData) {
    return (
      <Card className="border-amber-200 bg-amber-50/40 p-4" data-testid="aav-header-summary-empty">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5" />
          <div className="text-sm text-amber-900">
            Profilo vasculite non ancora compilato.{" "}
            <span className="text-amber-700">Compila organi coinvolti e base diagnostica qui sotto per un riepilogo in intestazione.</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-red-200 bg-red-50/30 p-4" data-testid="aav-header-summary">
      <div className="space-y-3">
        {summary.anca && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-900">ANCA</span>
            {summary.anca.pattern && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-700 text-white" data-testid="aav-header-pattern">
                {summary.anca.pattern}
              </span>
            )}
            {summary.anca.specificity && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white" data-testid="aav-header-spec">
                {summary.anca.specificity === "both" ? "PR3 + MPO" : `Anti-${summary.anca.specificity}`}
              </span>
            )}
          </div>
        )}

        {summary.organs.length > 0 && (
          <div className="flex items-start gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
              <HeartPulse className="w-3.5 h-3.5 text-red-700" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-red-900">Organi coinvolti</span>
            </div>
            <div className="flex flex-wrap gap-1.5" data-testid="aav-header-organs">
              {summary.organs.map((o) => (
                <span key={o} className="px-2 py-0.5 rounded text-xs bg-white border border-red-300 text-red-900 font-medium">
                  {o}
                </span>
              ))}
            </div>
          </div>
        )}

        {summary.basis.length > 0 && (
          <div className="flex items-start gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
              <Stethoscope className="w-3.5 h-3.5 text-gray-700" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-800">Diagnosi basata su</span>
            </div>
            <div className="flex flex-wrap gap-1.5" data-testid="aav-header-basis">
              {summary.basis.map((b) => (
                <span key={b} className="px-2 py-0.5 rounded text-xs bg-white border border-gray-300 text-gray-700 font-medium">
                  {b}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
