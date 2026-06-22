import React from "react";

/**
 * Body chart per indici di entesite (LEI; estendibile a MASES/SPARCC).
 * 6 siti LEI bilaterali:
 *   - Epicondilo laterale (gomito)
 *   - Condilo femorale mediale (ginocchio)
 *   - Inserzione tendine d'Achille (calcagno)
 * Click toggla 0 ↔ 1 (entesite assente/presente).
 *
 * Props:
 *   sites: { [key]: bool }
 *   onChange: (newSitesMap) => void
 *   labels: { [key]: string }   (per accessibilità/title)
 *   readOnly?: bool
 *   title?: string
 */

// Coordinate dei 6 siti LEI sul medesimo body silhouette dell'homunculus articolare
// (viewBox 200x440). Per Achille metto i punti accanto al tallone (vista anteriore con label
// "Achille" perché il tendine è posteriore — clinicamente il sito è ben individuato).
const LEI_POSITIONS = {
  lat_epicondyle_l: { x: 60, y: 130, r: 7, group: "Gomito" },
  lat_epicondyle_r: { x: 140, y: 130, r: 7, group: "Gomito" },
  med_femoral_l:    { x: 92, y: 300, r: 7, group: "Ginocchio" },
  med_femoral_r:    { x: 108, y: 300, r: 7, group: "Ginocchio" },
  achilles_l:       { x: 80, y: 412, r: 7, group: "Achille" },
  achilles_r:       { x: 120, y: 412, r: 7, group: "Achille" },
};

const COLORS = {
  off:    { fill: "#F3F4F6", stroke: "#9CA3AF" },
  active: { fill: "#DC2626", stroke: "#7F1D1D" },
};

export default function EnthesisBodyChart({ sites = {}, onChange, labels = {}, readOnly = false, title, positions = LEI_POSITIONS }) {
  const handleClick = (key) => {
    if (readOnly) return;
    const next = !sites[key];
    onChange && onChange({ ...sites, [key]: next });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {title && <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{title}</div>}
      <svg
        viewBox="0 0 200 440"
        className="w-full max-w-[260px] h-auto"
        xmlns="http://www.w3.org/2000/svg"
        data-testid="enthesis-body-chart"
      >
        {/* Gruppo specchiato: silhouette + punti cliccabili.
            Stessa convenzione di Homunculus.jsx: lato destro del paziente (_r) appare
            a sinistra dello schermo (convenzione radiologica standard). */}
        <g transform="scale(-1,1) translate(-200,0)">
          {/* Body silhouette */}
          <g fill="#F9FAFB" stroke="#9CA3AF" strokeWidth="1.2">
            <circle cx="100" cy="30" r="18" />
            <rect x="93" y="47" width="14" height="12" />
            <path d="M 72 60 Q 65 70 68 100 L 70 160 Q 70 200 75 220 L 125 220 Q 130 200 130 160 L 132 100 Q 135 70 128 60 Z" />
            <path d="M 72 65 Q 55 100 50 150 Q 45 180 48 200 L 58 200 Q 62 180 65 150 Q 72 100 78 75 Z" />
            <path d="M 128 65 Q 145 100 150 150 Q 155 180 152 200 L 142 200 Q 138 180 135 150 Q 128 100 122 75 Z" />
            <ellipse cx="48" cy="220" rx="14" ry="22" />
            <ellipse cx="152" cy="220" rx="14" ry="22" />
            <path d="M 75 222 Q 70 280 78 340 Q 80 380 82 410 L 96 410 Q 97 380 97 340 Q 97 280 95 222 Z" />
            <path d="M 125 222 Q 130 280 122 340 Q 120 380 118 410 L 104 410 Q 103 380 103 340 Q 103 280 105 222 Z" />
            <ellipse cx="82" cy="418" rx="12" ry="6" />
            <ellipse cx="118" cy="418" rx="12" ry="6" />
          </g>

          {/* Punti LEI cliccabili */}
          {Object.entries(positions).map(([key, p]) => {
            const active = !!sites[key];
            const c = active ? COLORS.active : COLORS.off;
            const label = labels[key] || key;
            return (
              <g key={key} className="enthesis-clickable">
                <title>{label}{active ? " — Doloroso" : ""}</title>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.r + 4}
                  fill="transparent"
                  onClick={() => handleClick(key)}
                  style={{ cursor: readOnly ? "default" : "pointer" }}
                  data-testid={`enthesis-hit-${key}`}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.r}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={active ? 2.2 : 1.5}
                  data-testid={`enthesis-dot-${key}`}
                  pointerEvents="none"
                />
                {active && (
                  <text
                    x={p.x}
                    y={p.y + 3}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill="white"
                    pointerEvents="none"
                    transform={`scale(-1,1) translate(${-2 * p.x},0)`}
                  >!</text>
                )}
              </g>
            );
          })}
        </g>

        {/* Etichette centrate — fuori dal gruppo specchiato per restare leggibili */}
        <g fontSize="9" fill="#374151" fontFamily="system-ui">
          <text x="100" y="118" textAnchor="middle">Epicondilo laterale</text>
          <text x="100" y="288" textAnchor="middle">Condilo femorale mediale</text>
          <text x="100" y="402" textAnchor="middle">Achille (calcagno)</text>
        </g>

        {/* Etichette laterali DX/SX (convenzione radiologica: DX paziente = sinistra schermo) */}
        <g fontSize="11" fontWeight="bold" fill="#6B7280" fontFamily="system-ui">
          <text x="8" y="224" textAnchor="middle">DX</text>
          <text x="192" y="224" textAnchor="middle">SX</text>
        </g>
      </svg>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-[11px] text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: COLORS.off.fill, border: `1px solid ${COLORS.off.stroke}` }} />
          Non doloroso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: COLORS.active.fill, border: `1px solid ${COLORS.active.stroke}` }} />
          Doloroso
        </span>
      </div>
    </div>
  );
}
