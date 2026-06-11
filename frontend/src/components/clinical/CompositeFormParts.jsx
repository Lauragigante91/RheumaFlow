import React from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";

/** VAS/NRS slider 0-10 with companion numeric input. Shared by composite forms. */
export function VasSlider({ label, value, onChange, hint, testid }) {
  const v = Number(value) || 0;
  return (
    <div className="space-y-1" data-testid={testid}>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium leading-snug flex-1">{label}</Label>
        <Input
          type="number"
          min={0}
          max={10}
          step="0.1"
          className="w-20 text-sm h-8"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <Slider min={0} max={10} step={0.1} value={[v]} onValueChange={([val]) => onChange(val)} />
      {hint && <p className="text-[10px] text-gray-500 leading-tight">{hint}</p>}
    </div>
  );
}

/**
 * Read-only tile showing a computed clinimetric score + its interpretation.
 * If `missingFields` is a non-empty array, shows a grey "Dati incompleti" state
 * instead of the score, to prevent misinterpretation of partial data.
 */
export function ResultTile({ title, score, interp, subtitle, testid, missingFields }) {
  const incomplete = Array.isArray(missingFields) && missingFields.length > 0;

  if (incomplete) {
    return (
      <div
        className="border border-gray-200 rounded-md p-3 bg-gray-50"
        data-testid={testid}
      >
        <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-semibold">
          {title}
        </div>
        <div className="mt-1 text-xs font-semibold text-gray-400" data-testid={`${testid}-score`}>
          Dati incompleti
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
          Mancano: {missingFields.join(", ")}
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-md p-3" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold">{title}</div>
      <div className="flex items-baseline gap-2 mt-0.5">
        <span className="font-mono font-black text-2xl text-[#0A2540]" data-testid={`${testid}-score`}>
          {score === null || isNaN(score) ? "—" : score}
        </span>
        {subtitle && <span className="text-[10px] text-gray-500">{subtitle}</span>}
      </div>
      {interp && <div className="text-xs font-medium mt-0.5 text-gray-700">{interp}</div>}
    </div>
  );
}
