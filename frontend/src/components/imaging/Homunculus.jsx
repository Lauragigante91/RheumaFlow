import React from "react";

/**
 * Interactive Homunculus component.
 * Each joint can be: "none", "tender" (blue), "swollen" (red), "both" (purple).
 * Mode controls which subset of joints is displayed:
 *   - "28": 28 DAS28 joints
 *   - "66_68": full 66/68-joint count
 *
 * 66/68 joint set (68 total, per ACR/EULAR standard):
 *   TMJ(2) + SC(2) + AC(2) + Shoulder(2) + Elbow(2) + Wrist(2) +
 *   MCP fingers(10) + PIP fingers(10) + DIP fingers(8) +
 *   Hip(2 — tender-only, excluded from SJC66) +
 *   Knee(2) + Ankle(2) + Tarsus/Midfoot(2) + MTP(10) + Toe PIP(10)
 *   = TJC68 = 68 | SJC66 = 66 (excluding hips)
 *
 * Props:
 *   mode: "28" | "66_68"
 *   joints: { [key]: "none" | "tender" | "swollen" | "both" }
 *   onChange: (newJointsMap) => void
 *
 * La figura è orientata come il paziente di fronte all'osservatore:
 * lato SX del paziente appare a destra del medico, DX a sinistra.
 */

const COLORS = {
  none: "#E5E7EB",
  tender: "#0055FF",
  swollen: "#FF3333",
  both: "#8B5CF6",
  stroke: "#0A2540",
};

function nextState(current) {
  const order = ["none", "tender", "swollen", "both"];
  const idx = order.indexOf(current || "none");
  return order[(idx + 1) % order.length];
}

// Coordinate front-view — x, y, r (raggio)
// Figura specchiata via SVG transform: _l appare a dx del medico, _r a sx.
const FRONT_JOINTS = {
  // ── TMJ ──────────────────────────────────────────────────────────
  tmj_l: { x: 92, y: 30, r: 3 },
  tmj_r: { x: 108, y: 30, r: 3 },
  // ── Shoulder girdle ──────────────────────────────────────────────
  sc_l: { x: 90, y: 70, r: 3 },
  sc_r: { x: 110, y: 70, r: 3 },
  ac_l: { x: 82, y: 72, r: 3 },
  ac_r: { x: 118, y: 72, r: 3 },
  // ── Shoulders ────────────────────────────────────────────────────
  shoulder_l: { x: 78, y: 82, r: 6 },
  shoulder_r: { x: 122, y: 82, r: 6 },
  // ── Elbows ───────────────────────────────────────────────────────
  elbow_l: { x: 62, y: 130, r: 5 },
  elbow_r: { x: 138, y: 130, r: 5 },
  // ── Wrists ───────────────────────────────────────────────────────
  wrist_l: { x: 50, y: 180, r: 5 },
  wrist_r: { x: 150, y: 180, r: 5 },
  // ── MCP fingers (left) — significativamente ingranditi e distanziati ─
  mcp1_l: { x: 16, y: 202, r: 6.5 },
  mcp2_l: { x: 28, y: 208, r: 6.5 },
  mcp3_l: { x: 40, y: 211, r: 6.5 },
  mcp4_l: { x: 51, y: 211, r: 6.5 },
  mcp5_l: { x: 62, y: 207, r: 6.5 },
  // ── MCP fingers (right) ──────────────────────────────────────────
  mcp1_r: { x: 184, y: 202, r: 6.5 },
  mcp2_r: { x: 172, y: 208, r: 6.5 },
  mcp3_r: { x: 160, y: 211, r: 6.5 },
  mcp4_r: { x: 149, y: 211, r: 6.5 },
  mcp5_r: { x: 138, y: 207, r: 6.5 },
  // ── PIP fingers (left) ───────────────────────────────────────────
  pip1_l: { x: 11, y: 220, r: 5.5 },
  pip2_l: { x: 25, y: 228, r: 5.5 },
  pip3_l: { x: 38, y: 233, r: 5.5 },
  pip4_l: { x: 50, y: 233, r: 5.5 },
  pip5_l: { x: 61, y: 228, r: 5.5 },
  // ── PIP fingers (right) ──────────────────────────────────────────
  pip1_r: { x: 189, y: 220, r: 5.5 },
  pip2_r: { x: 175, y: 228, r: 5.5 },
  pip3_r: { x: 162, y: 233, r: 5.5 },
  pip4_r: { x: 150, y: 233, r: 5.5 },
  pip5_r: { x: 139, y: 228, r: 5.5 },
  // ── DIP fingers (left, digits 2-5) ───────────────────────────────
  dip2_l: { x: 23, y: 242, r: 4.5 },
  dip3_l: { x: 36, y: 248, r: 4.5 },
  dip4_l: { x: 49, y: 248, r: 4.5 },
  dip5_l: { x: 60, y: 242, r: 4.5 },
  // ── DIP fingers (right, digits 2-5) ──────────────────────────────
  dip2_r: { x: 177, y: 242, r: 4.5 },
  dip3_r: { x: 164, y: 248, r: 4.5 },
  dip4_r: { x: 151, y: 248, r: 4.5 },
  dip5_r: { x: 140, y: 242, r: 4.5 },
  // ── Hips (tender-only in SJC66; excluded from swollen count) ─────
  hip_l: { x: 88, y: 220, r: 5 },
  hip_r: { x: 112, y: 220, r: 5 },
  // ── Knees ────────────────────────────────────────────────────────
  knee_l: { x: 85, y: 300, r: 6 },
  knee_r: { x: 115, y: 300, r: 6 },
  // ── Ankles ───────────────────────────────────────────────────────
  ankle_l: { x: 85, y: 380, r: 5 },
  ankle_r: { x: 115, y: 380, r: 5 },
  // ── Tarsus / Midfoot ─────────────────────────────────────────────
  midtarsal_l: { x: 82, y: 393, r: 3 },
  midtarsal_r: { x: 118, y: 393, r: 3 },
  // ── MTP (left) — significativamente ingranditi e distanziati ─────
  mtp1_l: { x: 54, y: 412, r: 6 },
  mtp2_l: { x: 65, y: 415, r: 6 },
  mtp3_l: { x: 76, y: 417, r: 6 },
  mtp4_l: { x: 87, y: 415, r: 6 },
  mtp5_l: { x: 97, y: 412, r: 6 },
  // ── MTP (right) ──────────────────────────────────────────────────
  mtp1_r: { x: 146, y: 412, r: 6 },
  mtp2_r: { x: 135, y: 415, r: 6 },
  mtp3_r: { x: 124, y: 417, r: 6 },
  mtp4_r: { x: 113, y: 415, r: 6 },
  mtp5_r: { x: 103, y: 412, r: 6 },
  // ── Toe PIP (left, digits 1-5) ───────────────────────────────────
  toe_pip1_l: { x: 52, y: 428, r: 5.5 },
  toe_pip2_l: { x: 63, y: 432, r: 5.5 },
  toe_pip3_l: { x: 74, y: 435, r: 5.5 },
  toe_pip4_l: { x: 85, y: 432, r: 5.5 },
  toe_pip5_l: { x: 95, y: 428, r: 5.5 },
  // ── Toe PIP (right, digits 1-5) ──────────────────────────────────
  toe_pip1_r: { x: 148, y: 428, r: 5.5 },
  toe_pip2_r: { x: 137, y: 432, r: 5.5 },
  toe_pip3_r: { x: 126, y: 435, r: 5.5 },
  toe_pip4_r: { x: 115, y: 432, r: 5.5 },
  toe_pip5_r: { x: 105, y: 428, r: 5.5 },
};

const DAS28_KEYS = [
  "shoulder_l", "shoulder_r",
  "elbow_l", "elbow_r",
  "wrist_l", "wrist_r",
  "mcp1_l", "mcp2_l", "mcp3_l", "mcp4_l", "mcp5_l",
  "mcp1_r", "mcp2_r", "mcp3_r", "mcp4_r", "mcp5_r",
  "pip1_l", "pip2_l", "pip3_l", "pip4_l", "pip5_l",
  "pip1_r", "pip2_r", "pip3_r", "pip4_r", "pip5_r",
  "knee_l", "knee_r",
];

const JOINT_LABELS_IT = {
  tmj_l: "ATM SX", tmj_r: "ATM DX",
  sc_l: "Sternoclavicolare SX", sc_r: "Sternoclavicolare DX",
  ac_l: "Acromioclavicolare SX", ac_r: "Acromioclavicolare DX",
  shoulder_l: "Spalla SX", shoulder_r: "Spalla DX",
  elbow_l: "Gomito SX", elbow_r: "Gomito DX",
  wrist_l: "Polso SX", wrist_r: "Polso DX",
  mcp1_l: "MCF 1 SX", mcp2_l: "MCF 2 SX", mcp3_l: "MCF 3 SX", mcp4_l: "MCF 4 SX", mcp5_l: "MCF 5 SX",
  mcp1_r: "MCF 1 DX", mcp2_r: "MCF 2 DX", mcp3_r: "MCF 3 DX", mcp4_r: "MCF 4 DX", mcp5_r: "MCF 5 DX",
  pip1_l: "IFP 1 SX", pip2_l: "IFP 2 SX", pip3_l: "IFP 3 SX", pip4_l: "IFP 4 SX", pip5_l: "IFP 5 SX",
  pip1_r: "IFP 1 DX", pip2_r: "IFP 2 DX", pip3_r: "IFP 3 DX", pip4_r: "IFP 4 DX", pip5_r: "IFP 5 DX",
  dip2_l: "IFD 2 SX", dip3_l: "IFD 3 SX", dip4_l: "IFD 4 SX", dip5_l: "IFD 5 SX",
  dip2_r: "IFD 2 DX", dip3_r: "IFD 3 DX", dip4_r: "IFD 4 DX", dip5_r: "IFD 5 DX",
  hip_l: "Anca SX", hip_r: "Anca DX",
  knee_l: "Ginocchio SX", knee_r: "Ginocchio DX",
  ankle_l: "Caviglia SX", ankle_r: "Caviglia DX",
  midtarsal_l: "Tarso/Mesopiede SX", midtarsal_r: "Tarso/Mesopiede DX",
  mtp1_l: "MTF 1 SX", mtp2_l: "MTF 2 SX", mtp3_l: "MTF 3 SX", mtp4_l: "MTF 4 SX", mtp5_l: "MTF 5 SX",
  mtp1_r: "MTF 1 DX", mtp2_r: "MTF 2 DX", mtp3_r: "MTF 3 DX", mtp4_r: "MTF 4 DX", mtp5_r: "MTF 5 DX",
  toe_pip1_l: "IFP alluce SX", toe_pip2_l: "IFP dito 2 piede SX", toe_pip3_l: "IFP dito 3 piede SX", toe_pip4_l: "IFP dito 4 piede SX", toe_pip5_l: "IFP dito 5 piede SX",
  toe_pip1_r: "IFP alluce DX", toe_pip2_r: "IFP dito 2 piede DX", toe_pip3_r: "IFP dito 3 piede DX", toe_pip4_r: "IFP dito 4 piede DX", toe_pip5_r: "IFP dito 5 piede DX",
};

export { JOINT_LABELS_IT };

export default function Homunculus({ mode = "28", joints = {}, onChange, readOnly = false, title }) {
  const keys = mode === "28" ? DAS28_KEYS : Object.keys(FRONT_JOINTS);

  const handleClick = (key) => {
    if (readOnly) return;
    const current = joints[key] || "none";
    const next = nextState(current);
    const updated = { ...joints, [key]: next };
    onChange && onChange(updated);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {title && <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{title}</div>}
      <svg
        viewBox="0 0 200 450"
        className="joint-svg w-full max-w-[280px] h-auto"
        xmlns="http://www.w3.org/2000/svg"
        data-testid="homunculus-svg"
      >
        <g transform="scale(-1,1) translate(-200,0)">
          {/* Sagoma corpo */}
          <g fill="#F9FAFB" stroke="#9CA3AF" strokeWidth="1.2">
            {/* Testa */}
            <circle cx="100" cy="30" r="18" />
            {/* Collo */}
            <rect x="93" y="47" width="14" height="12" />
            {/* Torace */}
            <path d="M 72 60 Q 65 70 68 100 L 70 160 Q 70 200 75 220 L 125 220 Q 130 200 130 160 L 132 100 Q 135 70 128 60 Z" />
            {/* Braccio sinistro */}
            <path d="M 72 65 Q 55 100 50 150 Q 45 180 48 200 L 58 200 Q 62 180 65 150 Q 72 100 78 75 Z" />
            {/* Braccio destro */}
            <path d="M 128 65 Q 145 100 150 150 Q 155 180 152 200 L 142 200 Q 138 180 135 150 Q 128 100 122 75 Z" />
            {/* Mano sinistra — ingrandita */}
            <ellipse cx="38" cy="224" rx="30" ry="30" />
            {/* Mano destra — ingrandita */}
            <ellipse cx="162" cy="224" rx="30" ry="30" />
            {/* Gamba sinistra */}
            <path d="M 75 222 Q 70 280 78 340 Q 80 380 82 415 L 96 415 Q 97 380 97 340 Q 97 280 95 222 Z" />
            {/* Gamba destra */}
            <path d="M 125 222 Q 130 280 122 340 Q 120 380 118 415 L 104 415 Q 103 380 103 340 Q 103 280 105 222 Z" />
            {/* Piede sinistro — ingrandito */}
            <ellipse cx="75" cy="427" rx="27" ry="17" />
            {/* Piede destro — ingrandito */}
            <ellipse cx="125" cy="427" rx="27" ry="17" />
          </g>

          {/* Articolazioni */}
          {keys.map((key) => {
            const j = FRONT_JOINTS[key];
            if (!j) return null;
            const state = joints[key] || "none";
            const fill = COLORS[state];
            return (
              <g key={key} className="joint-clickable">
                <title>{JOINT_LABELS_IT[key] || key}</title>
                <circle
                  cx={j.x}
                  cy={j.y}
                  r={j.r + 2.5}
                  fill="transparent"
                  onClick={() => handleClick(key)}
                  data-testid={`joint-${key}`}
                  style={{ cursor: readOnly ? "default" : "pointer" }}
                />
                <circle
                  cx={j.x}
                  cy={j.y}
                  r={j.r}
                  fill={fill}
                  stroke={COLORS.stroke}
                  strokeWidth="0.8"
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </g>

        {/* Etichette laterali DX/SX (convenzione radiologica: DX paziente = sinistra schermo) */}
        <g fontSize="11" fontWeight="bold" fill="#6B7280" fontFamily="system-ui">
          <text x="8" y="225" textAnchor="middle">DX</text>
          <text x="192" y="225" textAnchor="middle">SX</text>
        </g>
      </svg>

      <div className="text-xs text-gray-400 tracking-wide">Paziente di fronte</div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs justify-center">
        <LegendDot color={COLORS.none} label="Nessuno" />
        <LegendDot color={COLORS.tender} label="Dolente" />
        <LegendDot color={COLORS.swollen} label="Tumefatta" />
        <LegendDot color={COLORS.both} label="Entrambe" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rounded-full border border-gray-400"
        style={{ backgroundColor: color }}
      />
      <span className="text-gray-700">{label}</span>
    </div>
  );
}

// Helpers
export function countByState(joints, state) {
  return Object.values(joints || {}).filter((v) => v === state).length;
}
export function countTender(joints) {
  return Object.entries(joints || {}).filter(([_, v]) => v === "tender" || v === "both").length;
}
export function countSwollen(joints) {
  return Object.entries(joints || {}).filter(([_, v]) => v === "swollen" || v === "both").length;
}
export function getTenderKeys(joints) {
  return Object.entries(joints || {}).filter(([_, v]) => v === "tender" || v === "both").map(([k]) => k);
}
export function getSwollenKeys(joints) {
  return Object.entries(joints || {}).filter(([_, v]) => v === "swollen" || v === "both").map(([k]) => k);
}
export function countTenderIn(joints, allowedKeys) {
  const set = new Set(allowedKeys);
  return Object.entries(joints || {}).filter(([k, v]) => set.has(k) && (v === "tender" || v === "both")).length;
}
export function countSwollenIn(joints, allowedKeys) {
  const set = new Set(allowedKeys);
  return Object.entries(joints || {}).filter(([k, v]) => set.has(k) && (v === "swollen" || v === "both")).length;
}
