import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const EVENT_CONFIG = {
  disease_onset:       { label: "Esordio malattia",       dot: "bg-red-500",     text: "text-red-700",    badge: "bg-red-50 border-red-200 text-red-700" },
  manifestation_onset: { label: "Esordio manifestazione", dot: "bg-orange-400",  text: "text-orange-700", badge: "bg-orange-50 border-orange-200 text-orange-700" },
  therapy_start:       { label: "Inizio terapia",         dot: "bg-green-500",   text: "text-green-700",  badge: "bg-green-50 border-green-200 text-green-700" },
  therapy_stop:        { label: "Sospensione terapia",    dot: "bg-gray-400",    text: "text-gray-600",   badge: "bg-gray-100 border-gray-300 text-gray-600" },
  remission:           { label: "Remissione",             dot: "bg-emerald-500", text: "text-emerald-700",badge: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  flare:               { label: "Riacutizzazione",        dot: "bg-red-400",     text: "text-red-600",    badge: "bg-red-50 border-red-200 text-red-600" },
  dose_spacing:        { label: "Spacing dose",           dot: "bg-blue-400",    text: "text-blue-700",   badge: "bg-blue-50 border-blue-200 text-blue-700" },
  dose_reduction:      { label: "Riduzione dose",         dot: "bg-indigo-400",  text: "text-indigo-700", badge: "bg-indigo-50 border-indigo-200 text-indigo-700" },
  comorbidity_onset:   { label: "Comorbidità",            dot: "bg-purple-400",  text: "text-purple-700", badge: "bg-purple-50 border-purple-200 text-purple-700" },
  adverse_event:       { label: "Evento avverso",         dot: "bg-amber-500",   text: "text-amber-700",  badge: "bg-amber-50 border-amber-200 text-amber-700" },
};

function formatDate(dateValue, datePrecision, dateText) {
  if (!dateValue) return dateText || "Data n.d.";
  try {
    const d = new Date(dateValue + "T00:00:00Z");
    if (datePrecision === "year") return String(d.getUTCFullYear());
    if (datePrecision === "month_year") {
      return d.toLocaleDateString("it-IT", { month: "short", year: "numeric", timeZone: "UTC" });
    }
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  } catch {
    return dateText || dateValue;
  }
}

function EventRow({ ev, i }) {
  const cfg = EVENT_CONFIG[ev.event_type] || {
    label: ev.event_type, dot: "bg-gray-400", text: "text-gray-600", badge: "bg-gray-50 border-gray-200 text-gray-600",
  };
  const dateStr = formatDate(ev.date_value, ev.date_precision, ev.date_text);
  const hasAnaphora = ev.inferred_by === "anaphora";
  const isLowConf = ev.confidence === "low" || ev.confidence === "medium";

  return (
    <div className="flex items-start gap-3">
      <div className={`flex-shrink-0 w-3.5 h-3.5 rounded-full border-2 border-white ring-1 ring-gray-200 mt-0.5 ${cfg.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[11px] font-mono font-semibold text-gray-500 flex-shrink-0 w-[62px]">
            {dateStr}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.badge}`}>
            {cfg.label}
          </span>
          {ev.drug_canonical && (
            <span className="text-[11px] font-medium text-gray-700">{ev.drug_canonical}</span>
          )}
          {ev.reason && (
            <span className="text-[11px] text-gray-500 italic">per {ev.reason}</span>
          )}
          {hasAnaphora && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-50 border border-yellow-200 text-yellow-700 font-medium flex-shrink-0">
              ⚠ anafora
            </span>
          )}
          {isLowConf && !hasAnaphora && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-400 font-medium flex-shrink-0">
              conf. media
            </span>
          )}
        </div>
        {ev.detail && (
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{ev.detail}</p>
        )}
        {!ev.detail && ev.manifestation && (
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{ev.manifestation}</p>
        )}
      </div>
    </div>
  );
}

export default function ClinicalTimeline({ events = [] }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!events.length) return null;

  // Separate dated (placed on timeline) from undated (anamnesi senza data)
  const dated   = events.filter(e =>  e.date_value).sort((a, b) => a.date_value.localeCompare(b.date_value));
  const undated = events.filter(e => !e.date_value);

  return (
    <div className="mb-2">
      <button
        className="flex items-center gap-2 w-full text-left mb-3 group"
        onClick={() => setCollapsed(c => !c)}
      >
        <h3 className="font-heading font-bold text-sm text-gray-700 uppercase tracking-[0.12em]">
          Raccordo anamnestico
        </h3>
        <span className="text-[11px] text-gray-400 font-medium">({events.length} eventi)</span>
        <span className="ml-auto text-gray-400 group-hover:text-gray-600">
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-4">
          {/* ── Dated timeline ──────────────────────────────────────────────── */}
          {dated.length > 0 && (
            <div className="relative pl-5">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
              <div className="space-y-2.5">
                {dated.map((ev, i) => <EventRow key={ev.id || i} ev={ev} i={i} />)}
              </div>
            </div>
          )}

          {/* ── Undated events ──────────────────────────────────────────────── */}
          {undated.length > 0 && (
            <div className="mt-1">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1 flex-shrink-0">
                  Anamnesi senza data ({undated.length})
                </span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <div className="space-y-1.5 pl-1">
                {undated.map((ev, i) => (
                  <div key={ev.id || i} className="flex items-start gap-2 py-1 px-2 rounded bg-gray-50 border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        {(() => {
                          const cfg = EVENT_CONFIG[ev.event_type] || { label: ev.event_type, badge: "bg-gray-50 border-gray-200 text-gray-600" };
                          return (
                            <>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.badge}`}>{cfg.label}</span>
                              {ev.drug_canonical && <span className="text-[11px] font-medium text-gray-700">{ev.drug_canonical}</span>}
                              {ev.reason         && <span className="text-[11px] text-gray-500 italic">per {ev.reason}</span>}
                            </>
                          );
                        })()}
                      </div>
                      {ev.source_text && (
                        <p className="text-[10px] text-gray-400 italic mt-0.5 leading-snug line-clamp-1">«{ev.source_text}»</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
