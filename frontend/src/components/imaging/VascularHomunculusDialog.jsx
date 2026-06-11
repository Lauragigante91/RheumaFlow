import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import ItalianDatePicker from "../shared/ItalianDatePicker";
import { instrumentalExamsApi } from "../../lib/api";
import { toast } from "sonner";
import {
  Save, FileText, EyeOff, Info, Activity, BarChart2,
  Copy, Check, X, ArrowRight, Trash2,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// TERRITORY GROUPS
// Core PETVAS (9 territories, max 27) — bilateral contribution = max(L,R)
// ═══════════════════════════════════════════════════════════════════════════════
const CORE_GROUPS = [
  { no: 1,  label: "Aorta ascendente",          bilateral: false, keys: ["ascending_aorta"]                    },
  { no: 2,  label: "Arco aortico",               bilateral: false, keys: ["aortic_arch"]                        },
  { no: 3,  label: "Aorta toracica discendente", bilateral: false, keys: ["descending_thoracic"]                },
  { no: 4,  label: "Aorta addominale",           bilateral: false, keys: ["abdominal_aorta"]                    },
  { no: 5,  label: "Carotidi comuni",            bilateral: true,  keys: ["carotid_l","carotid_r"]              },
  { no: 6,  label: "Tronco brachiocefalico",     bilateral: false, keys: ["brachiocephalic"]                    },
  { no: 7,  label: "Succlavie",                  bilateral: true,  keys: ["subclavian_l","subclavian_r"]         },
  { no: 8,  label: "Arterie ascellari",          bilateral: true,  keys: ["axillary_l","axillary_r"]             },
  { no: 9,  label: "Iliache comuni",             bilateral: true,  keys: ["iliac_common_l","iliac_common_r"]     },
];
const EXTRA_GROUPS = [
  { no: 10, label: "Temporali superficiali",     bilateral: true,  keys: ["temporal_l","temporal_r"]            },
  { no: 11, label: "Arterie renali",             bilateral: true,  keys: ["renal_l","renal_r"]                  },
  { no: 12, label: "AMS (mesenterica sup.)",     bilateral: false, keys: ["mesenteric_sup"]                     },
  { no: 13, label: "AMI (mesenterica inf.)",     bilateral: false, keys: ["mesenteric_inf"]                     },
  { no: 14, label: "Arterie polmonari",          bilateral: false, keys: ["pulmonary"]                          },
  { no: 15, label: "Arterie femorali",           bilateral: true,  keys: ["femoral_l","femoral_r"]              },
  { no: 16, label: "Arterie vertebrali",         bilateral: true,  keys: ["vertebral_l","vertebral_r"]          },
];
const ALL_GROUPS = [...CORE_GROUPS, ...EXTRA_GROUPS];
const MAX_CORE = CORE_GROUPS.length * 3; // 27

// ═══════════════════════════════════════════════════════════════════════════════
// SVG VESSEL DEFINITIONS — ANATOMICALLY CORRECT ANTERIOR VIEW
// Patient RIGHT (Dx) = screen LEFT  |  Patient LEFT (Sx) = screen RIGHT
// ViewBox: 0 0 400 700
// ═══════════════════════════════════════════════════════════════════════════════
const VESSEL_DEFS = [
  // ── Aortic axis — ANATOMICALLY CORRECT ───────────────────────────────────
  // Anterior view: patient Dx (right) = screen LEFT, patient Sx (left) = screen RIGHT
  //
  // Ascending aorta exits the LEFT VENTRICLE → rises on patient's RIGHT → SCREEN LEFT (x≈168)
  // Aortic arch: sweeps from screen LEFT → apex (top) → screen RIGHT
  // Descending thoracic: runs along LEFT side of spine → SCREEN RIGHT (x≈230)
  // Abdominal aorta: continues from descending, drifts to midline for bifurcation

  { svgKey: "ascending_aorta", scoreKey: "ascending_aorta",    w: 13, d: "M 168,258 L 168,215" },
  { svgKey: "aortic_arch",     scoreKey: "aortic_arch",         w: 12, d: "M 168,215 Q 166,186 200,180 Q 232,175 232,205" },
  { svgKey: "desc_thoracic",   scoreKey: "descending_thoracic", w: 13, d: "M 232,205 L 230,315" },
  { svgKey: "abdominal_aorta", scoreKey: "abdominal_aorta",     w: 12, d: "M 230,315 L 216,460" },

  // ── BCT → patient RIGHT (screen LEFT) ────────────────────────────────────
  // BCT is the 1st arch branch; arises near the ascending/arch junction, runs to screen LEFT
  { svgKey: "brachiocephalic", scoreKey: "brachiocephalic",     w:  9, d: "M 170,215 Q 154,198 148,178 L 148,162" },

  // Patient Dx (right) = screen LEFT
  { svgKey: "carotid_r",       scoreKey: "carotid_r",           w:  7, d: "M 148,162 Q 150,115 155,82 L 158,58" },
  { svgKey: "subclavian_r",    scoreKey: "subclavian_r",        w:  7, d: "M 148,162 Q 100,162 55,170" },
  { svgKey: "axillary_r",      scoreKey: "axillary_r",          w:  6, d: "M 55,170 Q 40,215 35,298" },
  { svgKey: "iliac_r",         scoreKey: "iliac_common_r",      w: 10, d: "M 216,460 Q 180,490 140,528" },
  { svgKey: "temporal_r",      scoreKey: "temporal_r",          w:  3, d: "M 158,58 Q 145,42 134,26" },
  { svgKey: "renal_r",         scoreKey: "renal_r",             w:  5, d: "M 226,356 Q 172,353 115,358" },
  { svgKey: "femoral_r",       scoreKey: "femoral_r",           w:  8, d: "M 140,528 L 136,665" },

  // Patient Sx (left) = screen RIGHT
  // Left carotid: 2nd arch branch, arises near arch apex, goes UP screen RIGHT
  { svgKey: "carotid_l",       scoreKey: "carotid_l",           w:  7, d: "M 204,181 Q 213,135 220,88 L 224,58" },
  // Left subclavian: 3rd arch branch, arises near arch/descending junction, goes screen RIGHT
  { svgKey: "subclavian_l",    scoreKey: "subclavian_l",        w:  7, d: "M 232,204 Q 268,180 345,170" },
  { svgKey: "axillary_l",      scoreKey: "axillary_l",          w:  6, d: "M 345,170 Q 360,215 365,298" },
  { svgKey: "iliac_l",         scoreKey: "iliac_common_l",      w: 10, d: "M 216,460 Q 244,490 264,528" },
  { svgKey: "temporal_l",      scoreKey: "temporal_l",          w:  3, d: "M 224,58 Q 237,42 250,26" },
  { svgKey: "renal_l",         scoreKey: "renal_l",             w:  5, d: "M 226,356 Q 260,353 294,358" },
  { svgKey: "femoral_l",       scoreKey: "femoral_l",           w:  8, d: "M 264,528 L 268,665" },

  // ── Mesenteric ────────────────────────────────────────────────────────────
  { svgKey: "mesenteric",      scoreKey: "mesenteric_sup",      w:  4, d: "M 223,392 Q 219,420 216,448" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COLORS & SCALE
// ═══════════════════════════════════════════════════════════════════════════════
const MC = {
  stroke: ["#6B7280", "#D97706", "#EA580C", "#DC2626"],
  bg:     ["bg-gray-100",    "bg-yellow-100",  "bg-orange-100",  "bg-red-100"],
  text:   ["text-gray-600",  "text-yellow-800","text-orange-800","text-red-800"],
  border: ["border-gray-300","border-yellow-400","border-orange-400","border-red-400"],
  label:  ["Nessun uptake",  "Uptake < fegato","Uptake = fegato","Uptake > fegato"],
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function initScores() {
  const s = {};
  for (const g of ALL_GROUPS) for (const k of g.keys) s[k] = 0;
  return s;
}

function groupContrib(g, scores) {
  if (!g.bilateral) return scores[g.keys[0]] ?? 0;
  return Math.max(scores[g.keys[0]] ?? 0, scores[g.keys[1]] ?? 0);
}

function calcPetvasCore(scores) {
  return CORE_GROUPS.reduce((t, g) => t + groupContrib(g, scores), 0);
}

// PET positivity is INDEPENDENT of PETVAS magnitude:
// any territory with LVG ≥ 2 = active vascular uptake → PET positiva
// all territories ≤ 1 → PET negativa (even if PETVAS > 0 due to LVG 1 uptake)
function calcPetPositive(scores) {
  return Object.values(scores).some(v => v >= 2);
}

// Derive positivity from a saved exam object (uses stored flag or re-computes)
function petPosFromAssessment(a) {
  if (a?.structured_values?.pet_positive != null) return a.structured_values.pet_positive;
  if (a?.inputs?.pet_positive != null) return a.inputs.pet_positive;
  const territories = a?.structured_values?.territories ?? a?.inputs?.territories ?? {};
  return Object.values(territories).some(v => v >= 2);
}

function interpretPetvas(score) {
  if (score === 0)               return "Negativo";
  if (score / MAX_CORE <= 0.15)  return "Uptake lieve";
  if (score / MAX_CORE <= 0.45)  return "Uptake moderato";
  if (score / MAX_CORE <= 0.70)  return "Uptake elevato";
  return "Uptake molto elevato";
}

function petvasCls(score) {
  const p = score / MAX_CORE;
  if (score === 0)  return "text-gray-600 bg-gray-50 border-gray-200";
  if (p <= 0.15)    return "text-yellow-800 bg-yellow-50 border-yellow-200";
  if (p <= 0.45)    return "text-orange-800 bg-orange-50 border-orange-200";
  return "text-red-800 bg-red-50 border-red-200";
}

function petPosBadgeCls(positive) {
  return positive
    ? "bg-red-50 border-red-200 text-red-700"
    : "bg-green-50 border-green-200 text-green-700";
}

function petPosLabel(positive) {
  return positive ? "PET positiva" : "PET negativa";
}

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("it-IT"); } catch { return iso; }
}

function buildChanges(baseScores, currScores) {
  return ALL_GROUPS.map(g => {
    const p = groupContrib(g, baseScores);
    const c = groupContrib(g, currScores);
    const d = c - p;
    const status = p === 0 && c > 0 ? "new"
      : p > 0 && c === 0 ? "resolved"
      : d < 0 ? "improved"
      : d > 0 ? "worsened"
      : "stable";
    return { ...g, prev: p, curr: c, delta: d, status };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOATING LVG PICKER
// ═══════════════════════════════════════════════════════════════════════════════
function LVGPicker({ px, py, scoreKey, value, onChange, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", h), 10);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div ref={ref}
      style={{ position:"absolute", left:px, top:py, transform:"translate(-50%,-115%)", zIndex:60 }}
      className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-2.5 flex gap-1.5 items-center"
      onMouseDown={e => e.stopPropagation()}
    >
      {[0,1,2,3].map(v => (
        <button key={v} type="button"
          onClick={() => { onChange(scoreKey, v); onClose(); }}
          title={MC.label[v]}
          className={[
            "w-10 h-10 rounded-xl text-sm font-black border-2 transition-all",
            value === v
              ? `${MC.bg[v]} ${MC.text[v]} ${MC.border[v]} ring-2 ring-offset-1 scale-110 shadow-md`
              : "bg-white text-gray-400 border-gray-200 hover:scale-105 hover:bg-gray-50",
          ].join(" ")}
        >{v}</button>
      ))}
      <button type="button" onClick={onClose} className="ml-1 text-gray-300 hover:text-gray-500 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="absolute left-1/2 -translate-x-1/2 top-full" style={{
        borderLeft:"8px solid transparent", borderRight:"8px solid transparent", borderTop:"8px solid white", width:0, height:0 }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BODY SILHOUETTE
// ═══════════════════════════════════════════════════════════════════════════════
function BodySilhouette() {
  return (
    <g opacity="0.07" fill="#6B7280" stroke="none">
      <ellipse cx="200" cy="42" rx="30" ry="36" />
      <rect x="184" y="78" width="32" height="30" />
      <path d="M90,108 L310,108 L315,295 L85,295 Z" />
      <path d="M90,115 L52,128 L38,322 L65,324 L80,140 L92,125 Z" />
      <path d="M310,115 L348,128 L362,322 L335,324 L320,140 L308,125 Z" />
      <path d="M85,295 L73,402 L174,407 L228,407 L327,402 L315,295 Z" />
      <path d="M73,402 L62,695 L154,695 L160,407 Z" />
      <path d="M240,407 L248,695 L338,695 L327,402 Z" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VASCULAR SVG MAP
// ═══════════════════════════════════════════════════════════════════════════════
function VascularSVG({ scores, selectedKey, onVesselClick, baseScores }) {
  // Compute which score keys changed vs base (for change indicator on map)
  const changedKeys = useMemo(() => {
    if (!baseScores) return new Set();
    const s = new Set();
    for (const v of VESSEL_DEFS) {
      if ((scores[v.scoreKey] ?? 0) !== (baseScores[v.scoreKey] ?? 0)) s.add(v.scoreKey);
    }
    return s;
  }, [scores, baseScores]);

  return (
    <svg viewBox="0 0 400 700" className="w-full h-auto select-none" aria-label="Mappa vascolare">
      <BodySilhouette />

      {/* Anatomical orientation labels */}
      <g fontSize="8" fill="#D1D5DB" fontFamily="system-ui,sans-serif" fontWeight="600">
        <text x="6"   y="696">← Dx (destra paziente)</text>
        <text x="394" y="696" textAnchor="end">Sx (sinistra paziente) →</text>
      </g>

      {/* Core territory numbered labels — aligned to corrected vessel positions */}
      <g fontSize="8" fill="#9CA3AF" fontFamily="system-ui,sans-serif">
        {/* Midline / aortic axis */}
        {/* ① ascending aorta — screen LEFT (x≈168) */}
        <text x="154" y="238" textAnchor="end">①</text>
        {/* ② aortic arch — apex above centre */}
        <text x="200" y="170" textAnchor="middle">②</text>
        {/* ③ descending thoracic — screen RIGHT (x≈231) */}
        <text x="244" y="258" textAnchor="start">③</text>
        {/* ④ abdominal aorta — screen RIGHT */}
        <text x="244" y="400" textAnchor="start">④</text>
        {/* Dx = screen left */}
        <text x="150" y="42"  textAnchor="end">⑤Dx</text>
        <text x="134" y="162" textAnchor="end">⑥</text>
        <text x="40"  y="155" textAnchor="end">⑦Dx</text>
        <text x="22"  y="285" textAnchor="end">⑧Dx</text>
        <text x="126" y="542" textAnchor="end">⑨Dx</text>
        {/* Sx = screen right */}
        <text x="232" y="42"  textAnchor="start">⑤Sx</text>
        <text x="358" y="155" textAnchor="start">⑦Sx</text>
        <text x="372" y="285" textAnchor="start">⑧Sx</text>
        <text x="272" y="542" textAnchor="start">⑨Sx</text>
      </g>

      {/* Vessel paths */}
      {VESSEL_DEFS.map(v => {
        const sc    = scores[v.scoreKey] ?? 0;
        const isSel = selectedKey === v.scoreKey;
        const isChg = changedKeys.has(v.scoreKey);
        const color = MC.stroke[sc];
        return (
          <path key={v.svgKey} d={v.d}
            fill="none"
            stroke={isSel ? "#2563EB" : color}
            strokeWidth={isSel ? v.w + 4 : v.w}
            strokeLinecap="round" strokeLinejoin="round"
            opacity={sc === 0 && !isSel && !isChg ? 0.50 : 1}
            style={{
              filter: isSel
                ? "drop-shadow(0 0 5px #3B82F6)"
                : sc > 0
                  ? `drop-shadow(0 0 3px ${color}99)`
                  : "none",
              cursor: "pointer",
              transition: "stroke 0.15s, stroke-width 0.15s",
            }}
            onClick={e => onVesselClick(e, v.scoreKey)}
          >
            <title>{v.svgKey.replace(/_/g," ")} — LVG {sc}: {MC.label[sc]}</title>
          </path>
        );
      })}

      {/* Score badges + change indicator */}
      {VESSEL_DEFS.map(v => {
        const sc   = scores[v.scoreKey] ?? 0;
        const base = baseScores ? (baseScores[v.scoreKey] ?? 0) : null;
        const changed = base !== null && base !== sc;
        if (sc === 0 && !changed) return null;
        const m = v.d.match(/M\s*([\d.]+)[,\s]([\d.]+)/);
        const l = v.d.match(/L\s*([\d.]+)[,\s]([\d.]+)\s*$/);
        if (!m) return null;
        const cx = l ? (parseFloat(m[1]) + parseFloat(l[1])) / 2 : parseFloat(m[1]);
        const cy = l ? (parseFloat(m[2]) + parseFloat(l[2])) / 2 : parseFloat(m[2]);
        return (
          <g key={v.svgKey + "_b"} className="pointer-events-none">
            <circle cx={cx} cy={cy} r="8.5"
              fill={changed && sc !== base ? (sc > (base||0) ? "#DC2626" : "#16A34A") : MC.stroke[sc]}
              opacity="0.92" />
            <text x={cx} y={cy+3.5} textAnchor="middle" fontSize="8.5" fontWeight="bold"
              fill="white" fontFamily="system-ui,sans-serif">{sc}</text>
          </g>
        );
      })}

      {/* Meller legend */}
      <g transform="translate(8,678)" fontSize="8" fontFamily="system-ui,sans-serif">
        {[0,1,2,3].map((v,i) => (
          <g key={v} transform={`translate(${i*97},0)`}>
            <circle cx="6" cy="0" r="6" fill={MC.stroke[v]} opacity="0.85" />
            <text x="16" y="3.5" fill="#9CA3AF">{v} — {MC.label[v]}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR ROW (shows base→current change in longitudinal mode)
// ═══════════════════════════════════════════════════════════════════════════════
function SidebarRow({ g, scores, setScore, isExtra, baseScores }) {
  const contrib  = groupContrib(g, scores);
  const baseC    = baseScores ? groupContrib(g, baseScores) : null;
  const changed  = baseC !== null && baseC !== contrib;

  return (
    <div className={`py-1.5 border-b border-gray-100 last:border-0 ${isExtra ? "opacity-75" : ""}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center flex-shrink-0 ${
          isExtra ? "bg-gray-100 text-gray-500" : "bg-[#0A2540] text-white"}`}>
          {g.no}
        </span>
        <span className="text-xs text-gray-700 flex-1 leading-tight">{g.label}</span>
        {/* Change indicator */}
        {changed ? (
          <span className={`flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded border ${
            contrib > (baseC ?? 0)
              ? "bg-red-50 text-red-600 border-red-200"
              : "bg-green-50 text-green-600 border-green-200"
          }`}>
            {baseC}<ArrowRight className="w-2.5 h-2.5" />{contrib}
          </span>
        ) : !isExtra && (
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${MC.bg[contrib]} ${MC.text[contrib]} ${MC.border[contrib]}`}>
            {contrib}
          </span>
        )}
      </div>
      {g.bilateral ? (
        <div className="grid grid-cols-2 gap-1 pl-6">
          {[0,1].map(si => {
            const k   = g.keys[si];
            const v   = scores[k] ?? 0;
            const bv  = baseScores ? (baseScores[k] ?? 0) : null;
            const chg = bv !== null && bv !== v;
            const side = si === 0 ? "Sx" : "Dx";
            return (
              <div key={k}>
                <div className="text-[9px] uppercase text-gray-400 font-semibold mb-0.5 flex items-center gap-1">
                  {side}
                  {chg && <span className={`text-[8px] font-bold ${v > (bv??0) ? "text-red-500":"text-green-500"}`}>
                    ({bv}→{v})
                  </span>}
                </div>
                <div className="flex gap-0.5">
                  {[0,1,2,3].map(sc => (
                    <button key={sc} type="button" onClick={() => setScore(k, sc)}
                      className={[
                        "w-6 h-6 rounded text-[10px] font-bold border transition-all",
                        v === sc
                          ? `${MC.bg[sc]} ${MC.text[sc]} ${MC.border[sc]} shadow-sm ring-1 scale-105`
                          : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50",
                      ].join(" ")}
                    >{sc}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-0.5 pl-6">
          {[0,1,2,3].map(sc => {
            const k = g.keys[0];
            const v = scores[k] ?? 0;
            return (
              <button key={sc} type="button" onClick={() => setScore(k, sc)}
                className={[
                  "w-6 h-6 rounded text-[10px] font-bold border transition-all",
                  v === sc
                    ? `${MC.bg[sc]} ${MC.text[sc]} ${MC.border[sc]} shadow-sm ring-1 scale-105`
                    : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50",
                ].join(" ")}
              >{sc}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE COMPARISON SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
function InlineComparison({ baseRef, currScores, currCore }) {
  const [copied, setCopied] = useState(false);
  const prevCore  = baseRef?.structured_values?.petvas_score ?? 0;
  const delta     = currCore - prevCore;
  const rows      = useMemo(() => buildChanges(baseRef?.structured_values?.territories ?? baseRef?.inputs?.territories ?? {}, currScores), [baseRef, currScores]);
  const worsened  = rows.filter(r => r.status === "worsened" || r.status === "new");
  const improved  = rows.filter(r => r.status === "improved" || r.status === "resolved");
  const unchanged = rows.filter(r => r.status === "stable" && r.curr > 0);
  const hasChanges = worsened.length > 0 || improved.length > 0;

  // PET positivity for curr and prev — distinct from PETVAS magnitude
  const currPos = calcPetPositive(currScores);
  const prevPos = petPosFromAssessment(baseRef);

  const narrative = useMemo(() => {
    const lines = [];
    // Lead with positivity status (clinically primary) then PETVAS magnitude
    lines.push(`${petPosLabel(currPos)} — PETVAS ${currCore}/27${delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta} vs. precedente)` : " (invariato)"}.`);
    if (currPos !== prevPos) {
      lines.push(currPos
        ? "Nuova positività vascolare (LVG ≥2) rispetto al controllo precedente."
        : "Risoluzione della positività vascolare rispetto al controllo precedente.");
    }
    if (worsened.length)   lines.push(`Peggioramento/nuovo uptake: ${worsened.map(r=>r.label).join(", ")}.`);
    if (unchanged.length)  lines.push(`Uptake persistente: ${unchanged.map(r=>r.label).join(", ")}.`);
    if (improved.length)   lines.push(`Miglioramento/risoluzione: ${improved.map(r=>r.label).join(", ")}.`);
    return lines;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delta, prevCore, currCore, currPos, prevPos, worsened, unchanged, improved]);

  const copy = () => {
    navigator.clipboard.writeText(narrative.join("\n")).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-3 mb-3">
        <BarChart2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-600">
          Confronto con PET del {fmtDate(baseRef?.date)}
        </span>
        <div className={`ml-auto px-3 py-1 rounded-full text-xs font-black border ${
          delta < 0 ? "bg-green-50 border-green-200 text-green-700"
          : delta > 0 ? "bg-red-50 border-red-200 text-red-700"
          : "bg-gray-100 border-gray-200 text-gray-500"
        }`}>
          {delta > 0 ? "+" : ""}{delta} {delta < 0 ? "↓ Miglioramento" : delta > 0 ? "↑ Peggioramento" : "Stabile"}
        </div>
      </div>

      {!hasChanges && unchanged.length === 0 && (
        <p className="text-xs text-gray-400 italic">Nessuna modifica rispetto alla PET precedente.</p>
      )}

      {hasChanges && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {worsened.length > 0 && (
            <div>
              <div className="text-[10px] uppercase text-red-500 font-semibold mb-1">Peggiorati ({worsened.length})</div>
              {worsened.map(r => (
                <div key={r.no} className="flex items-center justify-between text-[11px] bg-white border border-red-100 rounded-lg px-2 py-1 mb-0.5">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" /><span className="text-red-700 truncate max-w-[100px]">{r.label}</span></div>
                  <span className="text-red-600 font-bold">{r.prev}→{r.curr}</span>
                </div>
              ))}
            </div>
          )}
          {improved.length > 0 && (
            <div>
              <div className="text-[10px] uppercase text-green-500 font-semibold mb-1">Migliorati ({improved.length})</div>
              {improved.map(r => (
                <div key={r.no} className="flex items-center justify-between text-[11px] bg-white border border-green-100 rounded-lg px-2 py-1 mb-0.5">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" /><span className="text-green-700 truncate max-w-[100px]">{r.label}</span></div>
                  <span className="text-green-600 font-bold">{r.prev}→{r.curr}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {unchanged.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {unchanged.map(r => (
            <span key={r.no} className="text-[10px] bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">
              {r.label} ({r.curr})
            </span>
          ))}
        </div>
      )}

      {/* Copyable narrative */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-0.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-widest text-blue-400 font-bold">Sintesi per referto</span>
          <button type="button" onClick={copy}
            className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copiato" : "Copia"}
          </button>
        </div>
        {narrative.map((l, i) => (
          <p key={i} className={`text-[11px] text-blue-900 leading-relaxed ${i===0 ? "font-semibold" : ""}`}>{l}</p>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PET TIMELINE
// ═══════════════════════════════════════════════════════════════════════════════
function PetTimeline({ history, currentDate }) {
  const all = useMemo(() =>
    [...history].sort((a,b) => (a.exam_date||"").localeCompare(b.exam_date||"")), [history]);
  if (all.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-2">Storico PET/TC</div>
      <div className="relative flex justify-between items-start">
        <div className="absolute top-1.5 left-0 right-0 h-px bg-gray-200" />
        {all.map((a, i) => {
          const isCurrent = a.exam_date?.slice(0,10) === currentDate;
          const pos       = petPosFromAssessment(a);
          return (
            <div key={a.id||i} className="flex flex-col items-center min-w-0 flex-1">
              {/* Timeline dot — red if PET+, green if PET−, dark if current */}
              <div className={`w-4 h-4 rounded-full border-2 z-10 flex-shrink-0 ${
                isCurrent ? "bg-[#0A2540] border-[#0A2540]"
                  : pos    ? "bg-red-400 border-red-500"
                           : "bg-green-400 border-green-500"}`} />
              <div className={`text-[9px] text-center mt-1 leading-tight ${isCurrent ? "font-bold text-[#0A2540]" : "text-gray-500"}`}>
                {fmtDate(a.exam_date)}
              </div>
              <div className={`text-[10px] font-black text-center ${isCurrent ? "text-rose-600" : "text-gray-500"}`}>
                {(a.structured_values?.petvas_score ?? "?")}/{MAX_CORE}
              </div>
              <div className={`text-[9px] font-semibold text-center ${pos ? "text-red-500" : "text-green-600"}`}>
                {pos ? "PET+" : "PET−"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DIALOG
// ═══════════════════════════════════════════════════════════════════════════════
export default function VascularHomunculusDialog({
  open, onClose, patient, onSaved, prefillAssessment,
  initialTab, visitDate,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]               = useState(visitDate || today);
  const [scores, setScores]           = useState(initScores);
  const [baseScores, setBaseScores]   = useState(null); // previous PET scores (for comparison)
  const [baseRef, setBaseRef]         = useState(null);  // previous PET assessment object
  const [reportText, setReportText]   = useState("");
  const [gdprMode, setGdprMode]       = useState(false);
  const [notes, setNotes]             = useState("");
  const [saving, setSaving]           = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [picker, setPicker]           = useState(null);
  const [showExtra, setShowExtra]     = useState(false);
  const [showReport, setShowReport]   = useState(false);
  const svgContainerRef               = useRef(null);
  // Tracks whether the dialog was open in the previous effect run (to detect false→true transition)
  const prevOpenRef                   = useRef(false);
  // Tracks whether initialization has been completed with real data for the current open session
  const initDoneRef                   = useRef(false);

  const [allInstrumentalExams, setAllInstrumentalExams] = useState([]);
  useEffect(() => {
    if (!open || !patient?.id) return;
    instrumentalExamsApi.list(patient.id).then(setAllInstrumentalExams).catch(() => {});
  }, [open, patient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const history = useMemo(() =>
    allInstrumentalExams.filter(e => e.exam_type === "petvas"), [allInstrumentalExams]);

  const petvasCore = useMemo(() => calcPetvasCore(scores), [scores]);
  const petPositive = useMemo(() => calcPetPositive(scores), [scores]);
  const interp     = interpretPetvas(petvasCore);
  const isUpdateMode = !prefillAssessment && baseRef !== null;

  // ── Open/reset logic ──────────────────────────────────────────────────────
  // Depends on `history` so that if allAssessments arrives after open=true,
  // the effect re-runs and can preload rather than showing blank state.
  // `prevOpenRef` / `initDoneRef` prevent resetting scores while the user is editing.
  useEffect(() => {
    if (!open) {
      // Dialog closing: reset tracking refs so next open starts fresh
      prevOpenRef.current = false;
      initDoneRef.current = false;
      return;
    }

    const justOpened = !prevOpenRef.current;
    prevOpenRef.current = true;

    // If dialog is already open AND we already initialised with real data → don't reset user edits
    if (!justOpened && initDoneRef.current) return;

    setPicker(null);
    setSelectedKey(null);

    const sorted = [...history].sort((a,b) => (b.exam_date||"").localeCompare(a.exam_date||""));
    const latest = sorted[0] || null;

    if (prefillAssessment) {
      // Edit a specific saved exam
      setDate((prefillAssessment.exam_date||"").slice(0,10));
      setScores({...initScores(), ...(prefillAssessment.structured_values?.territories ?? {})});
      setReportText(prefillAssessment.source_text || "");
      setGdprMode(prefillAssessment.structured_values?.gdpr_mode || false);
      setNotes("");
      setBaseRef(null);
      setBaseScores(null);
      initDoneRef.current = true;
    } else if (latest) {
      // Longitudinal mode — preload latest PET state as starting point
      const territory = latest.structured_values?.territories ?? {};
      setDate(visitDate || today);
      setScores({...initScores(), ...territory});
      setBaseScores({...initScores(), ...territory});
      setBaseRef(latest);
      setReportText("");
      setGdprMode(false);
      setNotes("");
      initDoneRef.current = true; // real data loaded — protect from future history updates
    } else {
      // No history yet — blank state; leave initDoneRef=false so we re-try when history loads
      setDate(visitDate || today);
      setScores(initScores());
      setBaseRef(null);
      setBaseScores(null);
      setReportText("");
      setGdprMode(false);
      setNotes("");
      // initDoneRef stays false: if history arrives later, effect will re-run and preload
    }
  }, [open, prefillAssessment, history]); // eslint-disable-line react-hooks/exhaustive-deps

  const setScore = useCallback((key, val) => setScores(p => ({...p, [key]: val})), []);

  const handleVesselClick = useCallback((e, scoreKey) => {
    e.stopPropagation();
    const container = svgContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setPicker({ px: e.clientX - rect.left, py: e.clientY - rect.top, scoreKey });
    setSelectedKey(scoreKey);
  }, []);

  const handleDelete = async () => {
    if (!prefillAssessment?.id) return;
    if (!window.confirm("Eliminare questa PET/CT (PETVAS)? L'azione non può essere annullata.")) return;
    try {
      await instrumentalExamsApi.remove(prefillAssessment.id);
      toast.success("PET/CT eliminata.");
      onSaved?.();
      onClose();
    } catch {
      toast.error("Errore durante l'eliminazione.");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        patient_id: patient.id,
        exam_date: date,
        exam_type: "petvas",
        result: petPositive ? "positive" : "negative",
        summary: `PETVAS ${petvasCore}/${MAX_CORE} — ${interp}`,
        source_text: gdprMode ? null : (reportText.trim() || notes.trim() || null),
        structured_values: {
          territories: {...scores},
          petvas_score: petvasCore,
          pet_positive: petPositive,
          report_imported: reportText.trim().length > 0,
          gdpr_mode: gdprMode,
        },
      };
      if (prefillAssessment?.id) {
        await instrumentalExamsApi.update(prefillAssessment.id, payload);
        toast.success("PETVAS aggiornato.");
      } else {
        await instrumentalExamsApi.create(payload);
        toast.success(`PET registrata — PETVAS ${petvasCore}/${MAX_CORE} · ${petPosLabel(petPositive)}.`);
      }
      onSaved?.();
      onClose();
    } catch {
      toast.error("Errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const deltaVsPrev = baseRef ? petvasCore - (baseRef.score ?? 0) : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-[1080px] max-h-[95vh] overflow-y-auto p-0"
        data-testid="petvas-dialog"
        onClick={() => { setPicker(null); setSelectedKey(null); }}
      >
        {/* ── STICKY HEADER ── */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-6 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-rose-500" />
              <h2 className="font-heading font-black text-[#0A2540] tracking-tight text-base">
                Mappa vascolare PET/TC — {patient?.cognome} {patient?.nome}
              </h2>
              {isUpdateMode && (
                <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5 font-semibold">
                  Aggiornamento longitudinale
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Data PET</div>
              <div className="scale-90 origin-left"><ItalianDatePicker value={date} onChange={setDate} /></div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                {isUpdateMode ? "Base (precedente)" : "Stato"}
              </div>
              <div className="text-xs font-semibold text-gray-600">
                {isUpdateMode ? `${fmtDate(baseRef?.date)} · ${baseRef?.score}/${MAX_CORE}` : "Prima PET"}
              </div>
            </div>
            <div className={`rounded-xl border px-3 py-2 ${petvasCls(petvasCore)}`}>
              <div className="text-[9px] uppercase tracking-widest font-bold opacity-60 mb-0.5">PETVAS core (9)</div>
              <div className="text-xl font-black">{petvasCore}<span className="text-[10px] font-normal opacity-50">/{MAX_CORE}</span></div>
              <div className="text-[10px] font-semibold leading-tight">{interp}</div>
              {/* PET positivity — clinically separate from PETVAS magnitude */}
              <div className={`inline-block mt-1 text-[9px] font-black px-1.5 py-0.5 rounded border ${petPosBadgeCls(petPositive)}`}>
                {petPosLabel(petPositive)}
              </div>
            </div>
            <div className={`rounded-xl border px-3 py-2 ${
              deltaVsPrev === null ? "bg-gray-50 border-gray-200 text-gray-400"
              : deltaVsPrev < 0 ? "bg-green-50 border-green-200 text-green-800"
              : deltaVsPrev > 0 ? "bg-red-50 border-red-200 text-red-800"
              : "bg-gray-50 border-gray-200 text-gray-600"
            }`}>
              <div className="text-[9px] uppercase tracking-widest font-bold opacity-60 mb-0.5">Variazione</div>
              <div className="text-xl font-black">
                {deltaVsPrev === null ? "—"
                  : deltaVsPrev < 0 ? `↓${Math.abs(deltaVsPrev)}`
                  : deltaVsPrev > 0 ? `↑${deltaVsPrev}` : "="}
              </div>
              <div className="text-[10px] font-semibold">
                {deltaVsPrev === null ? "Prima PET"
                  : deltaVsPrev < 0 ? "Miglioramento"
                  : deltaVsPrev > 0 ? "Peggioramento"
                  : "Invariato"}
              </div>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="px-6 py-4 space-y-4">
          {isUpdateMode && (
            <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              I punteggi dell'ultima PET ({fmtDate(baseRef?.date)}) sono precaricati.
              Modifica solo i distretti cambiati, poi salva come nuova PET.
            </p>
          )}

          {/* Main two-column layout */}
          <div className="grid grid-cols-[1fr_310px] gap-5">

            {/* LEFT: SVG map */}
            <div ref={svgContainerRef} className="relative"
              onClick={() => { setPicker(null); setSelectedKey(null); }}>
              <VascularSVG
                scores={scores}
                selectedKey={selectedKey}
                onVesselClick={handleVesselClick}
                baseScores={baseScores}
              />
              {picker && (
                <LVGPicker
                  px={picker.px} py={picker.py}
                  scoreKey={picker.scoreKey}
                  value={scores[picker.scoreKey] ?? 0}
                  onChange={setScore}
                  onClose={() => { setPicker(null); setSelectedKey(null); }}
                />
              )}
              <p className="text-[10px] text-gray-400 text-center mt-1 italic">
                Clic su un vaso → seleziona punteggio LVG 0–3
              </p>
            </div>

            {/* RIGHT: Score sidebar */}
            <div className="overflow-y-auto max-h-[580px] pr-0.5 space-y-3">
              {/* Core PETVAS */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
                    Distretti core PETVAS (9)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${petPosBadgeCls(petPositive)}`}>
                      {petPositive ? "PET+" : "PET−"}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${petvasCls(petvasCore)}`}>
                      {petvasCore}/{MAX_CORE}
                    </span>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 px-3 py-0.5 shadow-sm">
                  {CORE_GROUPS.map(g => (
                    <SidebarRow key={g.no} g={g} scores={scores} setScore={setScore}
                      isExtra={false} baseScores={baseScores} />
                  ))}
                </div>
              </div>

              {/* Extra territories */}
              <div>
                <button type="button" onClick={() => setShowExtra(v => !v)}
                  className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 font-semibold transition-colors">
                  <span className={`transition-transform text-[9px] ${showExtra ? "rotate-90":"rotate-0"}`}>▶</span>
                  Distretti aggiuntivi facoltativi
                </button>
                {showExtra && (
                  <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 px-3 py-0.5 mt-2">
                    <p className="text-[10px] text-gray-400 italic py-1 border-b border-gray-100 mb-0.5">
                      Non contano nel PETVAS ufficiale.
                    </p>
                    {EXTRA_GROUPS.map(g => (
                      <SidebarRow key={g.no} g={g} scores={scores} setScore={setScore}
                        isExtra baseScores={baseScores} />
                    ))}
                  </div>
                )}
              </div>

              {/* Report text (collapsible) */}
              <div>
                <button type="button" onClick={() => setShowReport(v => !v)}
                  className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 font-semibold transition-colors w-full">
                  <FileText className="w-3 h-3" />
                  Referto testuale (opzionale)
                  <button type="button" onClick={e => { e.stopPropagation(); setGdprMode(v=>!v); }}
                    className={`ml-auto flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border ${
                      gdprMode ? "bg-amber-50 text-amber-700 border-amber-300" : "bg-gray-100 text-gray-400 border-gray-200"}`}>
                    <EyeOff className="w-2.5 h-2.5" />
                    GDPR
                  </button>
                </button>
                {showReport && (
                  <div className="mt-2 space-y-2">
                    {gdprMode && (
                      <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 flex gap-1.5">
                        <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        Il testo sarà eliminato al salvataggio.
                      </div>
                    )}
                    <Textarea value={reportText} onChange={e => setReportText(e.target.value)}
                      placeholder="Incolla il testo del referto PET/TC…"
                      className="text-xs font-mono min-h-[60px] resize-y" data-testid="petvas-report-text" />
                  </div>
                )}
              </div>

              {/* Clinical notes */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1 block">Note cliniche</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Risposta alla terapia, commento clinico…"
                  className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2 min-h-[48px] resize-y focus:outline-none focus:ring-2 focus:ring-[#0A2540]/20"
                  data-testid="petvas-notes" />
              </div>
            </div>
          </div>

          {/* Inline comparison (auto-shown in longitudinal mode) */}
          {isUpdateMode && baseRef && (
            <InlineComparison
              baseRef={baseRef}
              currScores={scores}
              currCore={petvasCore}
            />
          )}

          {/* Timeline */}
          <PetTimeline history={history} currentDate={date} />

          {/* Save footer */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div>
              {prefillAssessment?.id && (
                <Button variant="outline" size="sm" onClick={handleDelete} disabled={saving}
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 text-xs h-8">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Elimina PET
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
              <Button onClick={save} disabled={saving}
                className="bg-[#0A2540] text-white hover:bg-[#051626] min-w-[180px]"
                data-testid="petvas-save">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Salvataggio…"
                  : isUpdateMode
                    ? `Salva aggiornamento PET (${petvasCore}/${MAX_CORE})`
                    : `Salva prima PET (${petvasCore}/${MAX_CORE})`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
