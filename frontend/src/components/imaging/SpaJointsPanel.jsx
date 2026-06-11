import React, { useMemo } from "react";
import { Card } from "../ui/card";
import Homunculus, { countTender, countSwollen } from "./Homunculus";
import EnthesisBodyChart from "./EnthesisBodyChart";
import { LEI_SITES, calcLEI, interpretLEI } from "../../lib/clinimetrics";
import { Activity, Footprints, Calendar } from "lucide-react";

/**
 * Pannello sempre visibile per pazienti SpA/PsA con impegno periferico.
 * Mostra l'ultimo stato articolare 66/68 (TJ68/SJ66) e l'ultimo stato entesite (LEI).
 * Read-only: per modificarli l'utente apre il form composito SpA o un nuovo LEI.
 */
export default function SpaJointsPanel({ patient, assessments }) {
  // Trova l'ultima valutazione articolare (da DAPSA o DAS28 o CDAI o SDAI - hanno tender/swollen joints)
  const lastJoints = useMemo(() => {
    const articularTypes = ["dapsa", "das28_esr", "das28_crp", "cdai", "sdai"];
    const sorted = [...(assessments || [])]
      .filter((a) => articularTypes.includes(a.index_type))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return sorted[0] || null;
  }, [assessments]);

  // Ricostruisci joint state mappa da tender/swollen arrays
  const jointMap = useMemo(() => {
    const m = {};
    (lastJoints?.tender_joints || []).forEach((k) => { m[k] = "tender"; });
    (lastJoints?.swollen_joints || []).forEach((k) => {
      m[k] = m[k] === "tender" ? "both" : "swollen";
    });
    return m;
  }, [lastJoints]);

  // Ultima valutazione LEI
  const lastLei = useMemo(() => {
    const sorted = [...(assessments || [])]
      .filter((a) => a.index_type === "lei")
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return sorted[0] || null;
  }, [assessments]);
  const leiSites = lastLei?.inputs?.sites || {};
  const leiScore = lastLei ? lastLei.score : calcLEI(leiSites);

  const tjcAll = countTender(jointMap);
  const sjcAll = countSwollen(jointMap);
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("it-IT") : "—";

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="spa-joints-panel">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Impegno periferico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">
            Quadro articolare ed entesitico
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Articular homunculus 66/68 */}
        <div className="border border-gray-200 rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0A2540]" />
              <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">
                Conta articolare 66/68
              </h3>
            </div>
            {lastJoints && (
              <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {fmtDate(lastJoints.date)}
              </span>
            )}
          </div>
          {lastJoints ? (
            <>
              <Homunculus mode="66_68" joints={jointMap} onChange={() => {}} title={null} readOnly />
              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                <div className="border rounded-md p-2 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">TJ totale</div>
                  <div className="font-mono font-bold text-[#0055FF] text-lg" data-testid="spa-panel-tjc">{tjcAll}</div>
                </div>
                <div className="border rounded-md p-2 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">SJ totale</div>
                  <div className="font-mono font-bold text-[#FF3333] text-lg" data-testid="spa-panel-sjc">{sjcAll}</div>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 italic mt-2 text-center">
                Da ultima valutazione {lastJoints.index_type?.toUpperCase()}
              </p>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-md">
              Nessuna conta articolare registrata. Crea una nuova valutazione DAPSA/DAS28.
            </div>
          )}
        </div>

        {/* LEI body chart */}
        <div className="border border-gray-200 rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Footprints className="w-4 h-4 text-[#0A2540]" />
              <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">
                LEI — Entesiti (Leeds)
              </h3>
            </div>
            {lastLei && (
              <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {fmtDate(lastLei.date)}
              </span>
            )}
          </div>
          {lastLei ? (
            <>
              <EnthesisBodyChart
                sites={leiSites}
                onChange={() => {}}
                labels={Object.fromEntries(LEI_SITES.map((s) => [s.key, s.label]))}
                readOnly
                title={null}
              />
              <div className="border rounded-md p-2 mt-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-gray-500">Score LEI</div>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="font-mono font-bold text-[#DC2626] text-lg" data-testid="spa-panel-lei-score">{leiScore}</span>
                  <span className="text-xs text-gray-600">/ 6</span>
                </div>
                <div className="text-xs text-gray-700">{interpretLEI(leiScore)}</div>
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-md">
              Nessuna valutazione LEI registrata. Apri "Nuova valutazione" → LEI.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
