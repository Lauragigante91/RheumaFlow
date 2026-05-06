import React, { useMemo, useState } from "react";
import { Card } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { INDEX_LABELS } from "../lib/clinimetrics";

// Constants
const CHART_LEFT_AXIS_W = 60;

const DRUG_PALETTE = [
  "#0A2540", "#0EA5E9", "#8B5CF6", "#F59E0B", "#10B981",
  "#EF4444", "#EC4899", "#14B8A6", "#F97316", "#6366F1",
  "#84CC16", "#06B6D4", "#D946EF", "#E11D48", "#65A30D",
  "#7C3AED", "#0369A1", "#B45309",
];

const INDEX_LINE_STYLE = [
  { color: "#0A2540", dash: "0",     shape: "circle" },
  { color: "#0EA5E9", dash: "4 3",   shape: "square" },
  { color: "#8B5CF6", dash: "0",     shape: "diamond" },
  { color: "#F59E0B", dash: "6 3",   shape: "triangle" },
  { color: "#10B981", dash: "0",     shape: "circle" },
  { color: "#EF4444", dash: "3 3",   shape: "square" },
  { color: "#EC4899", dash: "0",     shape: "diamond" },
  { color: "#14B8A6", dash: "5 3",   shape: "triangle" },
  { color: "#F97316", dash: "0",     shape: "circle" },
  { color: "#6366F1", dash: "4 4",   shape: "square" },
];

// Deriva una mappa farmaco→colore stabile in base all'ordine di comparsa
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

// ============ Gantt-style timeline of therapies ============
function TherapyGantt({ therapies, domain, drugColorMap, leftAxisWidth, rightMargin }) {
  const [hover, setHover] = useState(null);

  const rows = useMemo(() => {
    const ts = (s) => Date.parse(s);
    const valid = (therapies || []).filter((t) => t.drug_name && t.start_date);
    return [...valid].sort((a, b) => ts(a.start_date) - ts(b.start_date));
  }, [therapies]);

  if (rows.length === 0) {
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
  const totalH = HEADER_H + rows.length * (ROW_H + ROW_GAP) + 4;
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

        {rows.map((t, idx) => {
          const startTs = Date.parse(t.start_date);
          const endTs = t.end_date ? Date.parse(t.end_date) : today;
          const left = pct(startTs);
          const width = Math.max(0.4, pct(endTs) - left);
          const color = drugColorMap?.[t.drug_name] || "#6B7280";
          const isActive = t.status === "active";
          const top = HEADER_H + idx * (ROW_H + ROW_GAP);
          const drugLabel = `${t.drug_name}${t.dose ? ` ${t.dose}` : ""}`;
          return (
            <React.Fragment key={t.id || `${t.drug_name}-${t.start_date}`}>
              <div
                className="absolute text-[11px] font-medium text-gray-700 truncate text-right pr-2"
                style={{
                  left: 0,
                  top: top + (ROW_H - 14) / 2,
                  height: 14,
                  width: leftAxisWidth - 4,
                }}
                title={drugLabel}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: color }} />
                {t.drug_name}
              </div>
              <div
                className="absolute rounded-sm border cursor-pointer"
                style={{
                  left: `calc(${leftAxisWidth}px + (100% - ${leftAxisWidth + rightMargin}px) * ${left / 100})`,
                  width: `calc((100% - ${leftAxisWidth + rightMargin}px) * ${width / 100})`,
                  top: top,
                  height: ROW_H,
                  background: color,
                  borderColor: color,
                  opacity: isActive ? 1 : 0.65,
                }}
                data-testid={`gantt-bar-${t.id || idx}`}
                onMouseEnter={(e) => setHover({ t, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setHover({ t, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
              >
                {width > 6 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white px-1.5 truncate">
                    {drugLabel}
                  </span>
                )}
                {!isActive && (
                  <span className="absolute -right-1 top-0 bottom-0 w-1 bg-gray-700 rounded-r-sm" title="Sospesa" />
                )}
              </div>
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
            {hover.t.category}
            {hover.t.frequency ? ` · ${hover.t.frequency}` : ""}
          </div>
          <div className="mt-1 text-gray-700">
            {fmtFullDate(Date.parse(hover.t.start_date))} → {hover.t.end_date ? fmtFullDate(Date.parse(hover.t.end_date)) : "in corso"}
          </div>
          {hover.t.status !== "active" && (
            <div className="text-[10px] text-amber-700 italic mt-0.5">
              Sospesa{hover.t.discontinuation_reason ? ` — ${hover.t.discontinuation_reason}` : hover.t.auto_discontinued ? " automaticamente (nuovo biologico)" : ""}
            </div>
          )}
        </div>
      )}
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
  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="trend-card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
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
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500 border border-dashed border-gray-200 rounded-md">
          Nessun dato per questo indice
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(260, 220 + chartIndexTypes.length * 6)}>
            <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                type="number"
                dataKey="ts"
                scale="time"
                domain={timelineDomain ? [timelineDomain.min, timelineDomain.max] : ["dataMin", "dataMax"]}
                tickFormatter={fmtTickDate}
                fontSize={11}
                stroke="#6B7280"
                height={28}
              />
              <YAxis fontSize={11} stroke="#6B7280" width={CHART_LEFT_AXIS_W} />
              <Tooltip content={<TrendTooltip showTherapies={showTherapies} drugColorMap={drugColorMap} />} />
              <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
              {chartIndexTypes.map((idxType, i) => {
                const style = INDEX_LINE_STYLE[i % INDEX_LINE_STYLE.length];
                return (
                  <Line
                    key={idxType}
                    type="monotone"
                    dataKey={`score_${idxType}`}
                    name={INDEX_LABELS[idxType] || idxType}
                    stroke={style.color}
                    strokeWidth={2}
                    strokeDasharray={style.dash}
                    dot={{ r: 4, fill: style.color, strokeWidth: 0, shape: style.shape }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
          {showTherapies && timelineDomain && (
            <TherapyGantt
              therapies={therapies}
              domain={timelineDomain}
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
