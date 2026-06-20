import React, { useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceArea,
} from "recharts";
import { INDEX_LABELS } from "../../lib/clinimetrics";

const CHART_LEFT_AXIS_W = 60;

const TIME_RANGES = [
  { value: "all", label: "Tutto" },
  { value: "5y", label: "5a", ms: 5 * 365.25 * 86400000 },
  { value: "2y", label: "2a", ms: 2 * 365.25 * 86400000 },
  { value: "1y", label: "1a", ms: 365.25 * 86400000 },
  { value: "6m", label: "6m", ms: 180 * 86400000 },
];

// Fasce cliniche per indice — usate come sfondo colorato del grafico
const ZONE_CONFIG = {
  das28_crp: {
    yMax: 9.4,
    zones: [
      { y1: 0,   y2: 2.6, color: "#DCFCE7", label: "Remissione" },
      { y1: 2.6, y2: 3.2, color: "#DBEAFE", label: "Bassa attività" },
      { y1: 3.2, y2: 5.1, color: "#FEF9C3", label: "Moderata attività" },
      { y1: 5.1, y2: 9.4, color: "#FEE2E2", label: "Alta attività" },
    ],
  },
  das28_esr: {
    yMax: 9.4,
    zones: [
      { y1: 0,   y2: 2.6, color: "#DCFCE7", label: "Remissione" },
      { y1: 2.6, y2: 3.2, color: "#DBEAFE", label: "Bassa attività" },
      { y1: 3.2, y2: 5.1, color: "#FEF9C3", label: "Moderata attività" },
      { y1: 5.1, y2: 9.4, color: "#FEE2E2", label: "Alta attività" },
    ],
  },
  cdai: {
    yMax: 76,
    zones: [
      { y1: 0,   y2: 2.8, color: "#DCFCE7", label: "Remissione" },
      { y1: 2.8, y2: 10,  color: "#DBEAFE", label: "Bassa attività" },
      { y1: 10,  y2: 22,  color: "#FEF9C3", label: "Moderata attività" },
      { y1: 22,  y2: 76,  color: "#FEE2E2", label: "Alta attività" },
    ],
  },
  sdai: {
    yMax: 86,
    zones: [
      { y1: 0,    y2: 3.3, color: "#DCFCE7", label: "Remissione" },
      { y1: 3.3,  y2: 11,  color: "#DBEAFE", label: "Bassa attività" },
      { y1: 11,   y2: 26,  color: "#FEF9C3", label: "Moderata attività" },
      { y1: 26,   y2: 86,  color: "#FEE2E2", label: "Alta attività" },
    ],
  },
  dapsa: {
    yMax: 164,
    zones: [
      { y1: 0,  y2: 4,   color: "#DCFCE7", label: "Remissione" },
      { y1: 4,  y2: 14,  color: "#DBEAFE", label: "Bassa attività" },
      { y1: 14, y2: 28,  color: "#FEF9C3", label: "Moderata attività" },
      { y1: 28, y2: 164, color: "#FEE2E2", label: "Alta attività" },
    ],
  },
  asdas_crp: {
    yMax: 6,
    zones: [
      { y1: 0,   y2: 1.3, color: "#DCFCE7", label: "Inattiva" },
      { y1: 1.3, y2: 2.1, color: "#DBEAFE", label: "Bassa attività" },
      { y1: 2.1, y2: 3.5, color: "#FEF9C3", label: "Alta attività" },
      { y1: 3.5, y2: 6,   color: "#FEE2E2", label: "Molto alta" },
    ],
  },
  basdai: {
    yMax: 10,
    zones: [
      { y1: 0, y2: 4,  color: "#DCFCE7", label: "Non attiva" },
      { y1: 4, y2: 10, color: "#FEE2E2", label: "Malattia attiva" },
    ],
  },
  basfi: {
    yMax: 10,
    zones: [
      { y1: 0, y2: 4,  color: "#DCFCE7", label: "Lieve" },
      { y1: 4, y2: 7,  color: "#FEF9C3", label: "Moderata" },
      { y1: 7, y2: 10, color: "#FEE2E2", label: "Grave" },
    ],
  },
  sledai: {
    yMax: 105,
    zones: [
      { y1: 0,  y2: 1,   color: "#DCFCE7", label: "Inattiva" },
      { y1: 1,  y2: 6,   color: "#DBEAFE", label: "Attività lieve" },
      { y1: 6,  y2: 11,  color: "#FEF9C3", label: "Attività moderata" },
      { y1: 11, y2: 20,  color: "#FEE2E2", label: "Attività alta" },
      { y1: 20, y2: 105, color: "#FECACA", label: "Molto alta" },
    ],
  },
  essdai: {
    yMax: 123,
    zones: [
      { y1: 0,  y2: 5,   color: "#DCFCE7", label: "Bassa (<5)" },
      { y1: 5,  y2: 14,  color: "#FEF9C3", label: "Moderata" },
      { y1: 14, y2: 123, color: "#FEE2E2", label: "Alta" },
    ],
  },
  esspri: {
    yMax: 10,
    zones: [
      { y1: 0, y2: 5,  color: "#DCFCE7", label: "Controllata" },
      { y1: 5, y2: 10, color: "#FEE2E2", label: "Non controllata" },
    ],
  },
  haq: {
    yMax: 3,
    zones: [
      { y1: 0,   y2: 0.5, color: "#DCFCE7", label: "Disabilità lieve" },
      { y1: 0.5, y2: 1.5, color: "#FEF9C3", label: "Moderata" },
      { y1: 1.5, y2: 3,   color: "#FEE2E2", label: "Grave" },
    ],
  },
  pasi: {
    yMax: 72,
    zones: [
      { y1: 0,  y2: 3,  color: "#DCFCE7", label: "Quasi nulla/nulla" },
      { y1: 3,  y2: 10, color: "#DBEAFE", label: "Lieve" },
      { y1: 10, y2: 20, color: "#FEF9C3", label: "Moderata" },
      { y1: 20, y2: 72, color: "#FEE2E2", label: "Grave" },
    ],
  },
};

const DRUG_PALETTE = [
  "#0A2540", "#0EA5E9", "#8B5CF6", "#F59E0B", "#10B981",
  "#EF4444", "#EC4899", "#14B8A6", "#F97316", "#6366F1",
  "#84CC16", "#06B6D4", "#D946EF", "#E11D48", "#65A30D",
  "#7C3AED", "#0369A1", "#B45309",
];

const INDEX_LINE_STYLE = [
  { color: "#0A2540", dash: "0" },
  { color: "#0EA5E9", dash: "4 3" },
  { color: "#8B5CF6", dash: "0" },
  { color: "#F59E0B", dash: "6 3" },
  { color: "#10B981", dash: "0" },
  { color: "#EF4444", dash: "3 3" },
  { color: "#EC4899", dash: "0" },
  { color: "#14B8A6", dash: "5 3" },
  { color: "#F97316", dash: "0" },
  { color: "#6366F1", dash: "4 4" },
];

export function getTherapiesActiveOn(therapies, isoDate) {
  if (!isoDate || !therapies || therapies.length === 0) return [];
  return therapies.filter((t) => {
    const start = t.start_date || t.first_seen_date || null;
    const end = t.end_date || null;
    if (start && isoDate < start) return false;
    if (end && isoDate > end) return false;
    return true;
  });
}

export function buildDrugColorMap(chartData) {
  const map = {};
  let idx = 0;
  (chartData || []).forEach((d) => {
    (d.therapies || []).forEach((t) => {
      const name = t.name;
      if (name && !(name in map)) {
        map[name] = DRUG_PALETTE[idx % DRUG_PALETTE.length];
        idx += 1;
      }
    });
  });
  return map;
}

function fmtTickDate(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT", { month: "2-digit", year: "2-digit", day: "2-digit" });
}

function fmtFullDate(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT");
}

// Dot personalizzato: cerchio vuoto per valori importati, pieno per calcolati
function makeDot(color, importedKey) {
  return function CustomDot(props) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    if (payload?.[importedKey]) {
      return (
        <circle
          key={`dot-${cx}-${cy}`}
          cx={cx} cy={cy} r={5}
          fill="white"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="3 2"
        />
      );
    }
    return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} />;
  };
}

function TrendTooltip({ active, payload, showTherapies, drugColorMap }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const indices = d.indices || {};
  const indexEntries = Object.entries(indices);
  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-lg p-3 text-xs max-w-xs">
      <div className="font-bold text-[#0A2540]">{d.date}</div>
      {indexEntries.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {indexEntries.map(([k, v]) => (
            <li key={k} className="flex items-center gap-2">
              <span className="text-gray-600">{v.type}:</span>
              <span className="font-mono font-bold">{v.score ?? "—"}</span>
              {v.interpretation && <span className="text-[10px] text-gray-500">{v.interpretation}</span>}
              {v.imported && (
                <span className="text-[9px] text-cyan-600 border border-cyan-300 rounded px-1 font-medium">
                  importato
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-gray-500 italic mt-1">Nessun punteggio</div>
      )}
      {showTherapies && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-1">
            Terapia in corso
          </div>
          {d.therapies && d.therapies.length > 0 ? (
            <ul className="space-y-0.5">
              {d.therapies.map((t, i) => (
                <li key={`${t.name}-${i}`} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: (drugColorMap && drugColorMap[t.name]) || "#6B7280" }}
                  />
                  <span className="font-medium">{t.name}</span>
                  {t.dose && <span className="text-gray-500">{t.dose}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <span className="italic text-gray-400">{d.therapyLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

function TherapyGantt({ therapies, domain, drugColorMap, leftAxisWidth, rightMargin }) {
  const [hover, setHover] = useState(null);

  const tStart = (t) => t.start_date || t.first_seen_date;

  // Group therapy segments by drug_name so each drug occupies one continuous row.
  // Within a group, segments are sorted by start_date ascending.
  const drugRows = useMemo(() => {
    const valid = (therapies || []).filter((t) => t.drug_name && (t.start_date || t.first_seen_date));
    const map = {};
    valid.forEach((t) => {
      if (!map[t.drug_name]) map[t.drug_name] = [];
      map[t.drug_name].push(t);
    });
    // Sort each group by start; sort groups by their earliest start
    return Object.entries(map)
      .map(([name, segs]) => ({
        name,
        segs: [...segs].sort((a, b) => Date.parse(tStart(a)) - Date.parse(tStart(b))),
      }))
      .sort((a, b) => Date.parse(tStart(a.segs[0])) - Date.parse(tStart(b.segs[0])));
  }, [therapies]); // eslint-disable-line

  if (drugRows.length === 0) {
    return (
      <div
        className="text-[11px] text-gray-500 italic mt-2"
        style={{ paddingLeft: leftAxisWidth + 4 }}
      >
        Nessuna terapia registrata.
      </div>
    );
  }

  const ROW_H = 22;
  const ROW_GAP = 2;
  const HEADER_H = 18;
  const totalH = HEADER_H + drugRows.length * (ROW_H + ROW_GAP) + 4;
  const span = domain.max - domain.min;
  const pct = (ts) => Math.max(0, Math.min(100, ((ts - domain.min) / span) * 100));
  const today = Date.now();

  return (
    <div className="mt-1 select-none" data-testid="therapy-gantt">
      <div className="flex items-center" style={{ paddingLeft: leftAxisWidth, paddingRight: rightMargin }}>
        <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold">
          Linea del tempo terapie
        </div>
      </div>
      <div
        className="relative"
        style={{ height: totalH, paddingLeft: leftAxisWidth, paddingRight: rightMargin }}
      >
        <div className="absolute inset-y-0 border-l border-r border-gray-100 bg-gray-50/40" style={{ left: leftAxisWidth, right: rightMargin }}>
          {today >= domain.min && today <= domain.max && (
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-gray-400"
              style={{ left: `${pct(today)}%` }}
              title="Oggi"
            />
          )}
        </div>

        {drugRows.map(({ name, segs }, rowIdx) => {
          const color = drugColorMap?.[name] || "#6B7280";
          const top = HEADER_H + rowIdx * (ROW_H + ROW_GAP);
          // Is the drug currently active? (last segment is active or has no end_date)
          const lastSeg = segs[segs.length - 1];
          const isActive = lastSeg.status === "active" || !lastSeg.end_date;

          return (
            <React.Fragment key={name}>
              {/* Row label */}
              <div
                className="absolute text-[11px] font-medium text-gray-700 truncate text-right pr-2"
                style={{ left: 0, top: top + (ROW_H - 14) / 2, height: 14, width: leftAxisWidth - 4 }}
                title={name}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: color }} />
                {name}
              </div>

              {/* Connector line spanning from first start to last end — gives the "continuous" feel */}
              {segs.length > 1 && (() => {
                const firstTs = Date.parse(tStart(segs[0]));
                const lastTs  = lastSeg.end_date ? Date.parse(lastSeg.end_date) : today;
                const lineLeft  = pct(firstTs);
                const lineWidth = Math.max(0.4, pct(lastTs) - lineLeft);
                return (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `calc(${leftAxisWidth}px + (100% - ${leftAxisWidth + rightMargin}px) * ${lineLeft / 100})`,
                      width: `calc((100% - ${leftAxisWidth + rightMargin}px) * ${lineWidth / 100})`,
                      top: top + ROW_H / 2 - 1,
                      height: 2,
                      background: color,
                      opacity: 0.25,
                    }}
                  />
                );
              })()}

              {/* One bar per segment */}
              {segs.map((t, segIdx) => {
                const startTs = Date.parse(tStart(t));
                const endTs   = t.end_date ? Date.parse(t.end_date) : today;
                const left    = pct(startTs);
                const width   = Math.max(0.4, pct(endTs) - left);
                const segIsActive = t.status === "active" || !t.end_date;
                const segLabel = `${t.drug_name}${t.dose ? ` ${t.dose}` : ""}`;
                return (
                  <div
                    key={t.id || `${t.drug_name}-${tStart(t)}-${segIdx}`}
                    className="absolute rounded-sm border cursor-pointer"
                    style={{
                      left: `calc(${leftAxisWidth}px + (100% - ${leftAxisWidth + rightMargin}px) * ${left / 100})`,
                      width: `calc((100% - ${leftAxisWidth + rightMargin}px) * ${width / 100})`,
                      top,
                      height: ROW_H,
                      background: color,
                      borderColor: color,
                      opacity: segIsActive ? 1 : 0.65,
                    }}
                    data-testid={`gantt-bar-${t.id || segIdx}`}
                    onMouseEnter={(e) => setHover({ t, x: e.clientX, y: e.clientY })}
                    onMouseMove={(e) => setHover({ t, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHover(null)}
                  >
                    {width > 6 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white px-1.5 truncate">
                        {segLabel}
                      </span>
                    )}
                    {!segIsActive && segIdx === segs.length - 1 && (
                      <span className="absolute -right-1 top-0 bottom-0 w-1 bg-gray-700 rounded-r-sm" title="Sospesa" />
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
      {hover && (
        <div
          className="fixed z-50 pointer-events-none bg-white border border-gray-200 rounded-md shadow-lg p-2 text-xs max-w-xs"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="font-bold text-[#0A2540]">{hover.t.drug_name}{hover.t.dose ? ` · ${hover.t.dose}` : ""}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {hover.t.category}{hover.t.frequency ? ` · ${hover.t.frequency}` : ""}
          </div>
          <div className="mt-1 text-gray-700">
            {fmtFullDate(Date.parse(tStart(hover.t)))} → {hover.t.end_date ? fmtFullDate(Date.parse(hover.t.end_date)) : "in corso"}
          </div>
          {hover.t.status !== "active" && hover.t.end_date && (
            <div className="text-[10px] text-amber-700 italic mt-0.5">
              Sospesa{hover.t.discontinuation_reason ? ` — ${hover.t.discontinuation_reason}` : hover.t.auto_discontinued ? " automaticamente (nuovo biologico)" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Legenda zone cliniche
function ZoneLegend({ zones }) {
  if (!zones || zones.length === 0) return null;
  return (
    <div className="flex items-center gap-3 flex-wrap mt-1 mb-3">
      {zones.map((z) => (
        <div key={z.label} className="flex items-center gap-1.5 text-[10px] text-gray-600">
          <span className="w-3 h-3 rounded-sm border border-gray-200 flex-shrink-0" style={{ background: z.color }} />
          {z.label}
        </div>
      ))}
      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 ml-2 border-l border-gray-200 pl-3">
        <svg width="16" height="12" viewBox="0 0 16 12">
          <circle cx="8" cy="6" r="4" fill="white" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="2 1.5" />
        </svg>
        Importato da referto
      </div>
    </div>
  );
}

export default function TrendChartCard({
  chartData,
  chartIndexTypes,
  drugColorMap,
  timelineDomain,
  therapies,
  selectedIndex,
  setSelectedIndex,
  showTherapies,
  setShowTherapies,
}) {
  const [timeRange, setTimeRange] = useState("all");

  // Filtra i dati per l'intervallo temporale selezionato
  const filteredData = useMemo(() => {
    if (timeRange === "all") return chartData;
    const cfg = TIME_RANGES.find((t) => t.value === timeRange);
    if (!cfg?.ms) return chartData;
    const cutoff = Date.now() - cfg.ms;
    return chartData.filter((d) => d.ts >= cutoff);
  }, [chartData, timeRange]);

  // Dominio temporale aggiornato per i dati filtrati
  const filteredDomain = useMemo(() => {
    if (filteredData.length === 0) return timelineDomain;
    const tsList = filteredData.map((d) => d.ts);
    let min = Math.min(...tsList);
    let max = Math.max(...tsList);
    const span = max - min || 86400000;
    // Allunga max a oggi se c'è una terapia attiva
    const hasActive = (therapies || []).some((t) => t.status === "active");
    if (hasActive) max = Math.max(max, Date.now());
    return { min: min - span * 0.025, max: max + span * 0.025 };
  }, [filteredData, timelineDomain, therapies]);

  // Zona clinica attiva (solo quando un indice singolo è selezionato)
  const activeZone = selectedIndex !== "all" ? ZONE_CONFIG[selectedIndex] : null;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="trend-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h2 className="font-heading font-bold text-xl tracking-tight">Andamento nel tempo</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
            <input
              type="checkbox"
              checked={showTherapies}
              onChange={(e) => setShowTherapies(e.target.checked)}
              className="w-4 h-4 accent-[#0A2540]"
              data-testid="show-therapies-toggle"
            />
            <span className="font-medium text-gray-700">Mostra terapie</span>
          </label>
          <Select value={selectedIndex} onValueChange={setSelectedIndex}>
            <SelectTrigger className="w-56" data-testid="trend-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli indici</SelectItem>
              {Object.entries(INDEX_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Selettore intervallo temporale */}
      <div className="flex items-center gap-1 mb-3">
        {TIME_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setTimeRange(r.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              timeRange === r.value
                ? "bg-[#0A2540] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Legenda zone + importati */}
      {activeZone && <ZoneLegend zones={activeZone.zones} />}
      {!activeZone && (
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-3">
          <svg width="16" height="12" viewBox="0 0 16 12">
            <circle cx="8" cy="6" r="4" fill="white" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="2 1.5" />
          </svg>
          Cerchio aperto = valore importato da referto
        </div>
      )}

      {filteredData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500 border border-dashed border-gray-200 rounded-md">
          Nessun dato per questo periodo / indice
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(260, 220 + chartIndexTypes.length * 6)}>
            <LineChart data={filteredData} margin={{ top: 10, right: 24, left: 0, bottom: 4 }}>
              {/* Fasce cliniche (solo indice singolo con zone definite) */}
              {activeZone && activeZone.zones.map((z) => (
                <ReferenceArea
                  key={z.label}
                  y1={z.y1}
                  y2={z.y2}
                  fill={z.color}
                  fillOpacity={0.55}
                  strokeOpacity={0}
                  ifOverflow="hidden"
                />
              ))}

              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                type="number"
                dataKey="ts"
                scale="time"
                domain={filteredDomain ? [filteredDomain.min, filteredDomain.max] : ["dataMin", "dataMax"]}
                tickFormatter={fmtTickDate}
                fontSize={11}
                stroke="#6B7280"
                height={28}
              />
              <YAxis
                fontSize={11}
                stroke="#6B7280"
                width={CHART_LEFT_AXIS_W}
                domain={activeZone ? [0, activeZone.yMax] : ["auto", "auto"]}
              />
              <Tooltip content={<TrendTooltip showTherapies={showTherapies} drugColorMap={drugColorMap} />} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
              {chartIndexTypes.map((idxType, i) => {
                const style = INDEX_LINE_STYLE[i % INDEX_LINE_STYLE.length];
                const importedKey = `imported_${idxType}`;
                return (
                  <Line
                    key={idxType}
                    type="monotone"
                    dataKey={`score_${idxType}`}
                    name={INDEX_LABELS[idxType] || idxType}
                    stroke={style.color}
                    strokeWidth={2}
                    strokeDasharray={style.dash}
                    dot={makeDot(style.color, importedKey)}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
          {showTherapies && filteredDomain && (
            <TherapyGantt
              therapies={therapies}
              domain={filteredDomain}
              drugColorMap={drugColorMap}
              leftAxisWidth={CHART_LEFT_AXIS_W}
              rightMargin={24}
            />
          )}
        </>
      )}
    </Card>
  );
}
