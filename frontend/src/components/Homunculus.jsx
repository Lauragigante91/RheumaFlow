import React from "react";

/**
 * Interactive Homunculus component.
 * Each joint can be: "none", "tender" (blue), "swollen" (red), "both" (purple).
 * Mode controls which subset of joints is displayed:
 *   - "28": 28 DAS28 joints
 *   - "66_68": 66/68 count
 *
 * Props:
 *   mode: "28" | "66_68"
 *   joints: { [key]: "none" | "tender" | "swollen" | "both" }
 *   onChange: (newJointsMap) => void
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

// Coordinates for front-view joints
// x, y, r (radius)
const FRONT_JOINTS = {
  // shoulders
  shoulder_l: { x: 78, y: 82, r: 6 },
  shoulder_r: { x: 122, y: 82, r: 6 },
  // elbows
  elbow_l: { x: 62, y: 130, r: 5 },
  elbow_r: { x: 138, y: 130, r: 5 },
  // wrists
  wrist_l: { x: 50, y: 180, r: 5 },
  wrist_r: { x: 150, y: 180, r: 5 },
  // MCP left (closer to body center on left forearm) - small circles in a row
  mcp1_l: { x: 36, y: 205, r: 3 },
  mcp2_l: { x: 42, y: 210, r: 3 },
  mcp3_l: { x: 48, y: 213, r: 3 },
  mcp4_l: { x: 54, y: 213, r: 3 },
  mcp5_l: { x: 60, y: 210, r: 3 },
  // MCP right
  mcp1_r: { x: 164, y: 205, r: 3 },
  mcp2_r: { x: 158, y: 210, r: 3 },
  mcp3_r: { x: 152, y: 213, r: 3 },
  mcp4_r: { x: 146, y: 213, r: 3 },
  mcp5_r: { x: 140, y: 210, r: 3 },
  // PIP left
  pip1_l: { x: 32, y: 218, r: 2.5 },
  pip2_l: { x: 40, y: 224, r: 2.5 },
  pip3_l: { x: 47, y: 228, r: 2.5 },
  pip4_l: { x: 54, y: 228, r: 2.5 },
  pip5_l: { x: 61, y: 224, r: 2.5 },
  // PIP right
  pip1_r: { x: 168, y: 218, r: 2.5 },
  pip2_r: { x: 160, y: 224, r: 2.5 },
  pip3_r: { x: 153, y: 228, r: 2.5 },
  pip4_r: { x: 146, y: 228, r: 2.5 },
  pip5_r: { x: 139, y: 224, r: 2.5 },
  // knees
  knee_l: { x: 85, y: 300, r: 6 },
  knee_r: { x: 115, y: 300, r: 6 },
  // extra for 66/68
  tmj_l: { x: 92, y: 30, r: 3 },
  tmj_r: { x: 108, y: 30, r: 3 },
  sc_l: { x: 90, y: 70, r: 3 },
  sc_r: { x: 110, y: 70, r: 3 },
  ac_l: { x: 82, y: 72, r: 3 },
  ac_r: { x: 118, y: 72, r: 3 },
  hip_l: { x: 88, y: 220, r: 5 },
  hip_r: { x: 112, y: 220, r: 5 },
  ankle_l: { x: 85, y: 380, r: 5 },
  ankle_r: { x: 115, y: 380, r: 5 },
  subtalar_l: { x: 82, y: 390, r: 3 },
  subtalar_r: { x: 118, y: 390, r: 3 },
  midtarsal_l: { x: 82, y: 400, r: 3 },
  midtarsal_r: { x: 118, y: 400, r: 3 },
  mtp1_l: { x: 74, y: 410, r: 2.5 },
  mtp2_l: { x: 78, y: 412, r: 2.5 },
  mtp3_l: { x: 82, y: 413, r: 2.5 },
  mtp4_l: { x: 86, y: 412, r: 2.5 },
  mtp5_l: { x: 90, y: 410, r: 2.5 },
  mtp1_r: { x: 126, y: 410, r: 2.5 },
  mtp2_r: { x: 122, y: 412, r: 2.5 },
  mtp3_r: { x: 118, y: 413, r: 2.5 },
  mtp4_r: { x: 114, y: 412, r: 2.5 },
  mtp5_r: { x: 110, y: 410, r: 2.5 },
  dip2_l: { x: 40, y: 235, r: 2 },
  dip3_l: { x: 47, y: 240, r: 2 },
  dip4_l: { x: 54, y: 240, r: 2 },
  dip5_l: { x: 61, y: 235, r: 2 },
  dip2_r: { x: 160, y: 235, r: 2 },
  dip3_r: { x: 153, y: 240, r: 2 },
  dip4_r: { x: 146, y: 240, r: 2 },
  dip5_r: { x: 139, y: 235, r: 2 },
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
  shoulder_l: "Spalla SX", shoulder_r: "Spalla DX",
  elbow_l: "Gomito SX", elbow_r: "Gomito DX",
  wrist_l: "Polso SX", wrist_r: "Polso DX",
  knee_l: "Ginocchio SX", knee_r: "Ginocchio DX",
  hip_l: "Anca SX", hip_r: "Anca DX",
  ankle_l: "Caviglia SX", ankle_r: "Caviglia DX",
  tmj_l: "ATM SX", tmj_r: "ATM DX",
  sc_l: "Sternoclavicolare SX", sc_r: "Sternoclavicolare DX",
  ac_l: "Acromioclavicolare SX", ac_r: "Acromioclavicolare DX",
  subtalar_l: "Sottoastragalica SX", subtalar_r: "Sottoastragalica DX",
  midtarsal_l: "Mediotarsica SX", midtarsal_r: "Mediotarsica DX",
  mcp1_l: "MCF 1 SX", mcp2_l: "MCF 2 SX", mcp3_l: "MCF 3 SX", mcp4_l: "MCF 4 SX", mcp5_l: "MCF 5 SX",
  mcp1_r: "MCF 1 DX", mcp2_r: "MCF 2 DX", mcp3_r: "MCF 3 DX", mcp4_r: "MCF 4 DX", mcp5_r: "MCF 5 DX",
  pip1_l: "IFP 1 SX", pip2_l: "IFP 2 SX", pip3_l: "IFP 3 SX", pip4_l: "IFP 4 SX", pip5_l: "IFP 5 SX",
  pip1_r: "IFP 1 DX", pip2_r: "IFP 2 DX", pip3_r: "IFP 3 DX", pip4_r: "IFP 4 DX", pip5_r: "IFP 5 DX",
  dip2_l: "IFD 2 SX", dip3_l: "IFD 3 SX", dip4_l: "IFD 4 SX", dip5_l: "IFD 5 SX",
  dip2_r: "IFD 2 DX", dip3_r: "IFD 3 DX", dip4_r: "IFD 4 DX", dip5_r: "IFD 5 DX",
  mtp1_l: "MTF 1 SX", mtp2_l: "MTF 2 SX", mtp3_l: "MTF 3 SX", mtp4_l: "MTF 4 SX", mtp5_l: "MTF 5 SX",
  mtp1_r: "MTF 1 DX", mtp2_r: "MTF 2 DX", mtp3_r: "MTF 3 DX", mtp4_r: "MTF 4 DX", mtp5_r: "MTF 5 DX",
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
        viewBox="0 0 200 440"
        className="joint-svg w-full max-w-[280px] h-auto"
        xmlns="http://www.w3.org/2000/svg"
        data-testid="homunculus-svg"
      >
        {/* Body silhouette */}
        <g fill="#F9FAFB" stroke="#9CA3AF" strokeWidth="1.2">
          {/* Head */}
          <circle cx="100" cy="30" r="18" />
          {/* Neck */}
          <rect x="93" y="47" width="14" height="12" />
          {/* Torso */}
          <path d="M 72 60 Q 65 70 68 100 L 70 160 Q 70 200 75 220 L 125 220 Q 130 200 130 160 L 132 100 Q 135 70 128 60 Z" />
          {/* Left arm */}
          <path d="M 72 65 Q 55 100 50 150 Q 45 180 48 200 L 58 200 Q 62 180 65 150 Q 72 100 78 75 Z" />
          {/* Right arm */}
          <path d="M 128 65 Q 145 100 150 150 Q 155 180 152 200 L 142 200 Q 138 180 135 150 Q 128 100 122 75 Z" />
          {/* Left hand (simplified palm) */}
          <ellipse cx="48" cy="220" rx="14" ry="22" />
          {/* Right hand */}
          <ellipse cx="152" cy="220" rx="14" ry="22" />
          {/* Left leg */}
          <path d="M 75 222 Q 70 280 78 340 Q 80 380 82 410 L 96 410 Q 97 380 97 340 Q 97 280 95 222 Z" />
          {/* Right leg */}
          <path d="M 125 222 Q 130 280 122 340 Q 120 380 118 410 L 104 410 Q 103 380 103 340 Q 103 280 105 222 Z" />
          {/* Feet */}
          <ellipse cx="82" cy="418" rx="12" ry="6" />
          <ellipse cx="118" cy="418" rx="12" ry="6" />
        </g>

        {/* Joints */}
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
                r={j.r + 2}
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
      </svg>

      {/* Legend */}
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
