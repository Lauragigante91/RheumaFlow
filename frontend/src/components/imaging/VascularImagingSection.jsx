/**
 * VascularImagingSection — compact unified summary for TodayVisitSection.
 * All 4 modalities shown as equal flat buttons.
 *
 * Props:
 *   instrumentalExams     — patient instrumental exams array
 *   onOpenVascularImaging(type) — type: "petvas" | "ecodoppler" | "angio_ct" | "angio_mri"
 */
import React, { useMemo } from "react";
import { Button } from "../ui/button";
import { Activity, Zap, Layers, Radio, Scan } from "lucide-react";

const MODALITY_META = {
  petvas:     { label: "PET/TC",        short: "PET",     btnLabel: "Nuova PET",     icon: Zap,      cls: "border-rose-300 text-rose-700 hover:bg-rose-50",    badgeCls: "bg-rose-50 border-rose-200 text-rose-700"   },
  ecodoppler: { label: "Eco Doppler",   short: "DOPPLER", btnLabel: "Nuovo Doppler", icon: Activity, cls: "border-blue-300 text-blue-700 hover:bg-blue-50",    badgeCls: "bg-blue-50 border-blue-200 text-blue-700"   },
  angio_ct:   { label: "AngioCT (CTA)", short: "CTA",     btnLabel: "Nuovo CTA",     icon: Layers,   cls: "border-amber-300 text-amber-700 hover:bg-amber-50", badgeCls: "bg-amber-50 border-amber-200 text-amber-700" },
  angio_mri:  { label: "AngioMRI (MRA)",short: "MRA",     btnLabel: "Nuova MRA",     icon: Radio,    cls: "border-purple-300 text-purple-700 hover:bg-purple-50",badgeCls: "bg-purple-50 border-purple-200 text-purple-700" },
  echo_msk:   { label: "Eco MSK",       short: "ECO",     icon: Scan,     cls: "border-teal-300 text-teal-700 hover:bg-teal-50",    badgeCls: "bg-teal-50 border-teal-200 text-teal-700"   },
};

function fmtDate(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString("it-IT"); } catch { return iso; }
}

function petPosFromA(a) {
  if (a?.structured_values?.pet_positive != null) return a.structured_values.pet_positive;
  if (a?.inputs?.pet_positive != null) return a.inputs.pet_positive;
  const territories = a?.structured_values?.territories ?? a?.inputs?.territories ?? {};
  return Object.values(territories).some(v => v >= 2);
}

function lastSummaryLine(a) {
  if (!a) return null;
  const examType = a.exam_type || a.index_type;
  if (examType === "petvas") {
    const pos = petPosFromA(a);
    const score = a.structured_values?.petvas_score ?? a.score ?? "—";
    return `PETVAS ${score}/27 · ${pos ? "PET positiva" : "PET negativa"}`;
  }
  if (a.summary) return a.summary.slice(0, 70) + (a.summary.length > 70 ? "…" : "");
  if (a.inputs?.summary) return a.inputs.summary.slice(0, 70) + (a.inputs.summary.length > 70 ? "…" : "");
  return null;
}

export default function VascularImagingSection({ instrumentalExams, onOpenVascularImaging }) {
  const lastByType = useMemo(() => {
    const all = instrumentalExams || [];
    const out = {};
    for (const type of Object.keys(MODALITY_META)) {
      const list = all.filter(a => (a.exam_type || a.index_type) === type)
        .sort((a, b) => (b.exam_date || b.date || "").localeCompare(a.exam_date || a.date || ""));
      if (list[0]) out[type] = list[0];
    }
    return out;
  }, [instrumentalExams]);

  const totalCount = Object.values(lastByType).filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Last exam summaries per modality */}
      {totalCount > 0 && (
        <div className="grid grid-cols-1 gap-1.5">
          {Object.entries(MODALITY_META).map(([type, meta]) => {
            const last = lastByType[type];
            if (!last) return null;
            const summary = lastSummaryLine(last);
            const isPetPos = type === "petvas" && petPosFromA(last);
            const isPetNeg = type === "petvas" && !petPosFromA(last);
            return (
              <div key={type}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${meta.badgeCls}`}>
                <meta.icon className="w-3 h-3 flex-shrink-0" />
                <span className="font-bold">{meta.label}</span>
                <span className="text-[10px] opacity-70">{fmtDate(last.exam_date || last.date)}</span>
                {type === "petvas" && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ml-1 ${
                    isPetPos ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"
                  }`}>
                    {isPetPos ? "PET+" : "PET−"}
                  </span>
                )}
                {summary && <span className="text-[10px] opacity-80 truncate flex-1">{summary}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* 5-button grid — vascular imaging (row 1) + MSK echo (row 2 center) */}
      <div className="grid grid-cols-2 gap-2">
        {["petvas","ecodoppler","angio_ct","angio_mri"].map(type => {
          const meta = MODALITY_META[type];
          const last = lastByType[type];
          return (
            <Button key={type} type="button" variant="outline" size="sm"
              onClick={() => onOpenVascularImaging?.(type)}
              className={`text-xs font-semibold flex items-center gap-1.5 justify-center ${meta.cls}`}>
              <meta.icon className="w-3 h-3" />
              {meta.btnLabel}
            </Button>
          );
        })}
      </div>
      {/* ECO MSK — separate row, full width */}
      <Button type="button" variant="outline" size="sm"
        onClick={() => onOpenVascularImaging?.("echo_msk")}
        className={`w-full text-xs font-semibold flex items-center gap-1.5 justify-center ${MODALITY_META.echo_msk.cls}`}>
        <MODALITY_META.echo_msk.icon className="w-3 h-3" />
        {lastByType.echo_msk ? "Aggiorna ECO MSK" : "+ ECO MSK (spalle/anche)"}
      </Button>

      {totalCount === 0 && (
        <p className="text-[10px] text-gray-400 italic">
          Nessun imaging registrato. DOPPLER = eco vascolare (LVV/GCA) · ECO = eco muscoloscheletrica (PMR).
        </p>
      )}
    </div>
  );
}
