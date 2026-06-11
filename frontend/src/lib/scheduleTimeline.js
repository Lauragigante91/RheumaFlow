/**
 * scheduleTimeline.js
 *
 * Generates ordered administration dates from a drug schedule definition.
 *
 * Schedule structure (attached to drug regimen in drugs.js):
 * {
 *   phases: [
 *     { label: "Induzione", type: "induction",    dayOffsets: [0, 14, 42], dose?: "5 mg/kg" },
 *     { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 6 }
 *     // OR for count-based interval induction:
 *     { label: "Induzione", type: "induction", interval: { days: 28 }, count: 4, dose: "320 mg" }
 *   ]
 * }
 *
 * Phase types: "loading" | "induction" | "maintenance" | "cycle"
 */

export function generateTimelineDates(schedule, startDateISO, maxCount = 10) {
  if (!schedule?.phases || !startDateISO) return [];
  const start = new Date(startDateISO + "T00:00:00");
  if (isNaN(start.getTime())) return [];

  const results = [];
  let anchorDate = new Date(start);

  for (const phase of schedule.phases) {
    if (results.length >= maxCount) break;

    if (phase.dayOffsets && phase.dayOffsets.length > 0) {
      // Explicit day offsets from the original start date
      for (const offset of phase.dayOffsets) {
        if (results.length >= maxCount) break;
        const d = new Date(start);
        d.setDate(d.getDate() + offset);
        results.push({
          date:  isoDate(d),
          phase: phase.label,
          type:  phase.type || "maintenance",
          dose:  phase.dose || "",
        });
        anchorDate = d;
      }
    } else if (phase.interval) {
      // Interval-based (can be induction with count or open-ended maintenance)
      const phaseMax = Math.min(phase.count ?? 99, maxCount - results.length);
      for (let i = 1; i <= phaseMax; i++) {
        if (results.length >= maxCount) break;
        const d = new Date(anchorDate);
        d.setDate(d.getDate() + i * phase.interval.days);
        results.push({
          date:  isoDate(d),
          phase: phase.label,
          type:  phase.type || "maintenance",
          dose:  phase.dose || "",
        });
      }
      // Update anchor to the last date added in this phase
      if (results.length > 0) {
        anchorDate = new Date(results[results.length - 1].date + "T00:00:00");
      }
    }
  }

  return results;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Formats a timeline list as human-readable Italian text for report export. */
export function formatScheduleForExport(dates, drugName) {
  if (!dates || dates.length === 0) return "";
  const header = `Schema somministrazioni — ${drugName}`;
  const lines  = dates.map((item, i) => {
    const dateStr = new Date(item.date + "T00:00:00").toLocaleDateString("it-IT", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
    const doseStr = item.dose ? ` (${item.dose})` : "";
    return `  ${(i + 1).toString().padStart(2)}. ${dateStr}  ${item.phase}${doseStr}`;
  });
  return [header, ...lines].join("\n");
}

/** Color for each phase type */
export function phaseColor(type) {
  return {
    loading:     { bg: "#fff7ed", border: "#fbbf24", text: "#92400e", dot: "#f59e0b" },
    induction:   { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", dot: "#3b82f6" },
    maintenance: { bg: "#f0fdf4", border: "#86efac", text: "#14532d", dot: "#22c55e" },
    cycle:       { bg: "#faf5ff", border: "#c4b5fd", text: "#4c1d95", dot: "#8b5cf6" },
  }[type] || { bg: "#f9fafb", border: "#d1d5db", text: "#374151", dot: "#9ca3af" };
}
