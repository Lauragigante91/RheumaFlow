import React from "react";

const SIDES = [
  { key: "si_l", label: "SI SX" },
  { key: "si_r", label: "SI DX" },
];

const STATE_ORDER = [null, "positive", "negative"];

function nextState(current) {
  const idx = STATE_ORDER.indexOf(current ?? null);
  return STATE_ORDER[(idx + 1) % STATE_ORDER.length];
}

function SideButton({ label, state, onClick, readOnly }) {
  const isPos = state === "positive";
  const isNeg = state === "negative";
  const borderColor = isPos ? "#1d4ed8" : isNeg ? "#dc2626" : "#d1d5db";
  const bgColor     = isPos ? "#eff6ff"  : isNeg ? "#fef2f2"  : "#f9fafb";
  const textColor   = isPos ? "#1d4ed8"  : isNeg ? "#dc2626"  : "#6b7280";

  return (
    <button
      type="button"
      onClick={readOnly ? undefined : onClick}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        padding: "8px 6px",
        border: "1.5px solid",
        borderColor,
        borderRadius: "6px",
        background: bgColor,
        cursor: readOnly ? "default" : "pointer",
        transition: "border-color 0.12s, background 0.12s",
      }}
    >
      <span style={{ fontSize: "16px", lineHeight: 1 }}>
        {isPos ? "✓" : isNeg ? "✗" : "—"}
      </span>
      <span style={{ fontSize: "10px", fontWeight: 700, color: textColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span style={{ fontSize: "9px", color: textColor, fontWeight: 400 }}>
        {isPos ? "positiva" : isNeg ? "negativa" : "non testata"}
      </span>
    </button>
  );
}

export default function SacroiliacWidget({ value = {}, onChange, readOnly = false }) {
  function handleClick(key) {
    if (readOnly) return;
    const current = value[key] ?? null;
    const next = nextState(current);
    onChange?.({ ...value, [key]: next });
  }

  return (
    <div style={{ marginTop: "12px" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
        Manovre sacroiliache
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {SIDES.map(({ key, label }) => (
          <SideButton
            key={key}
            label={label}
            state={value[key] ?? null}
            onClick={() => handleClick(key)}
            readOnly={readOnly}
          />
        ))}
      </div>
      {!readOnly && (
        <div style={{ fontSize: "9px", color: "#9ca3af", marginTop: "4px" }}>
          Clic per ciclare: non testata → positiva → negativa
        </div>
      )}
    </div>
  );
}
