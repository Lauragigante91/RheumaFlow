import React from "react";

export const TRISTATE_OPTIONS = [
  { value: "positive", label: "Positivo", cls: "bg-red-100 text-red-800 border-red-300" },
  { value: "negative", label: "Negativo", cls: "bg-green-100 text-green-800 border-green-300" },
  { value: "unknown", label: "Non testato", cls: "bg-gray-100 text-gray-700 border-gray-300" },
];

export function TriState({ value, onChange, testid }) {
  return (
    <div className="flex gap-1" data-testid={testid}>
      {TRISTATE_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-xs rounded-md border transition ${
            value === o.value
              ? o.cls + " font-semibold"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
          }`}
          data-testid={`${testid}-${o.value}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
