import React from "react";
import { MRSS_AREAS } from "../../lib/clinimetrics";

/**
 * mRSS Homunculus: 17 body regions, click to cycle 0→1→2→3 (skin thickness score).
 * Color: 0=light gray, 1=yellow, 2=orange, 3=red.
 * Props:
 *   values: { [areaKey]: 0|1|2|3 }
 *   onChange(newValues)
 */

const COLORS = {
  0: "#E5E7EB",
  1: "#FBBF24",
  2: "#F97316",
  3: "#DC2626",
  stroke: "#0A2540",
};

// Polygon paths for body regions (front view, viewBox 0 0 200 480)
// Each region is a shape (polygon or path) with the area key.
const REGIONS = {
  face: { type: "circle", cx: 100, cy: 35, r: 22 },
  ant_chest: { type: "polygon", points: "70,72 130,72 130,130 70,130" },
  abdomen: { type: "polygon", points: "70,130 130,130 130,180 72,180" },
  // Arms: upper (shoulder→elbow), forearm (elbow→wrist), hand (palm), fingers
  upper_arm_l: { type: "polygon", points: "62,72 70,72 65,150 50,150" },
  upper_arm_r: { type: "polygon", points: "130,72 138,72 150,150 135,150" },
  forearm_l: { type: "polygon", points: "50,150 65,150 60,210 40,210" },
  forearm_r: { type: "polygon", points: "135,150 150,150 160,210 140,210" },
  hand_l: { type: "ellipse", cx: 42, cy: 222, rx: 12, ry: 10 },
  hand_r: { type: "ellipse", cx: 158, cy: 222, rx: 12, ry: 10 },
  fingers_l: { type: "polygon", points: "30,234 56,234 54,260 32,260" },
  fingers_r: { type: "polygon", points: "144,234 170,234 168,260 146,260" },
  // Legs
  thigh_l: { type: "polygon", points: "75,180 99,180 95,300 78,300" },
  thigh_r: { type: "polygon", points: "101,180 125,180 122,300 105,300" },
  leg_l: { type: "polygon", points: "78,300 95,300 92,400 80,400" },
  leg_r: { type: "polygon", points: "105,300 122,300 120,400 108,400" },
  foot_l: { type: "ellipse", cx: 86, cy: 415, rx: 14, ry: 8 },
  foot_r: { type: "ellipse", cx: 114, cy: 415, rx: 14, ry: 8 },
};

// Label coordinates for showing the score number on the region
const LABEL_POS = {
  face: { x: 100, y: 38 },
  ant_chest: { x: 100, y: 105 },
  abdomen: { x: 100, y: 158 },
  upper_arm_l: { x: 60, y: 115 },
  upper_arm_r: { x: 140, y: 115 },
  forearm_l: { x: 53, y: 185 },
  forearm_r: { x: 147, y: 185 },
  hand_l: { x: 42, y: 225 },
  hand_r: { x: 158, y: 225 },
  fingers_l: { x: 43, y: 250 },
  fingers_r: { x: 157, y: 250 },
  thigh_l: { x: 87, y: 245 },
  thigh_r: { x: 113, y: 245 },
  leg_l: { x: 86, y: 350 },
  leg_r: { x: 114, y: 350 },
  foot_l: { x: 86, y: 418 },
  foot_r: { x: 114, y: 418 },
};

export default function MRSSHomunculus({ values = {}, onChange }) {
  const handleClick = (key) => {
    const cur = Number(values[key]) || 0;
    const next = (cur + 1) % 4;
    onChange && onChange({ ...values, [key]: next });
  };

  const total = MRSS_AREAS.reduce((s, a) => s + (Number(values[a.key]) || 0), 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 200 460" className="w-full max-w-[320px] h-auto" data-testid="mrss-homunculus">
        {/* Body outline (subtle) */}
        <g fill="none" stroke="#9CA3AF" strokeWidth="0.8">
          <path d="M 70 72 Q 65 130 72 180 L 75 180 Q 75 230 78 300 L 92 400 L 86 410 L 80 400 L 80 300 Q 78 230 72 180 Z" fill="transparent" />
        </g>

        {/* Regions */}
        {MRSS_AREAS.map((a) => {
          const r = REGIONS[a.key];
          if (!r) return null;
          const v = Number(values[a.key]) || 0;
          const fill = COLORS[v];
          const lp = LABEL_POS[a.key] || { x: 100, y: 100 };
          const common = {
            fill,
            stroke: COLORS.stroke,
            strokeWidth: 0.8,
            onClick: () => handleClick(a.key),
            style: { cursor: "pointer" },
            "data-testid": `mrss-area-${a.key}`,
          };
          return (
            <g key={a.key} className="joint-clickable">
              <title>{a.label} ({v})</title>
              {r.type === "circle" && <circle cx={r.cx} cy={r.cy} r={r.r} {...common} />}
              {r.type === "ellipse" && <ellipse cx={r.cx} cy={r.cy} rx={r.rx} ry={r.ry} {...common} />}
              {r.type === "polygon" && <polygon points={r.points} {...common} />}
              <text
                x={lp.x}
                y={lp.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="700"
                fill={v >= 2 ? "white" : "#0A2540"}
                pointerEvents="none"
              >
                {v}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-3 text-xs justify-center">
        <Legend color={COLORS[0]} label="0 - Normale" />
        <Legend color={COLORS[1]} label="1 - Lieve" />
        <Legend color={COLORS[2]} label="2 - Moderato" />
        <Legend color={COLORS[3]} label="3 - Severo" />
      </div>

      <div className="text-sm">
        Totale mRSS: <span className="font-mono font-black text-2xl text-[#0A2540]" data-testid="mrss-total">{total}</span>
        <span className="text-gray-500"> / 51</span>
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 rounded border border-gray-400" style={{ backgroundColor: color }} />
      <span className="text-gray-700">{label}</span>
    </div>
  );
}
