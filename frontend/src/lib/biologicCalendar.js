/**
 * biologicCalendar.js
 * Calendar generation and text formatting for biologic injections.
 */

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateISO, n) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function formatDateIT(dateISO) {
  if (!dateISO) return "";
  const [y, m, d] = dateISO.split("-");
  return `${d}/${m}/${y}`;
}

export function formatIntervalLabel(days) {
  const d = parseInt(days) || 14;
  if (d === 7)  return "7 giorni (settimanale)";
  if (d === 14) return "14 giorni (ogni 2 settimane)";
  if (d === 21) return "21 giorni (ogni 3 settimane)";
  if (d === 28) return "28 giorni (ogni 4 settimane)";
  if (d === 42) return "42 giorni (ogni 6 settimane)";
  if (d === 56) return "56 giorni (ogni 8 settimane)";
  if (d % 28 === 0) return `${d} giorni (ogni ${d / 28} ${d / 28 === 1 ? "mese" : "mesi"})`;
  if (d % 7 === 0)  return `${d} giorni (ogni ${d / 7} settimane)`;
  return `${d} giorni`;
}

export function formatIntervalShort(days) {
  const d = parseInt(days) || 14;
  if (d === 7)  return "settimana";
  if (d === 14) return "2 settimane";
  if (d === 21) return "3 settimane";
  if (d === 28) return "4 settimane";
  if (d === 42) return "6 settimane";
  if (d === 56) return "8 settimane";
  if (d % 28 === 0) return `${d / 28} ${d / 28 === 1 ? "mese" : "mesi"}`;
  if (d % 7 === 0)  return `${d / 7} settimane`;
  return `${d} giorni`;
}

function formatWeeksList(weeks) {
  if (!weeks?.length) return "";
  const nums = weeks.map(Number).sort((a, b) => a - b);
  if (nums.length === 1) return `settimana ${nums[0]}`;
  const last = nums[nums.length - 1];
  const rest = nums.slice(0, -1);
  return `settimane ${rest.join(", ")} e ${last}`;
}

/**
 * Parse comma-separated week string like "0, 2, 4" → [0, 2, 4]
 */
export function parseWeeks(str) {
  if (!str?.trim()) return [];
  return str
    .split(/[,\s]+/)
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n) && n >= 0)
    .sort((a, b) => a - b);
}

/**
 * Generate biologic administration calendar.
 * config: {
 *   drugName, route,
 *   firstDoseDate,            // ISO
 *   hasInduction,             // boolean
 *   inductionWeeks,           // [0, 2, 4]  (already parsed ints)
 *   inductionDose,            // "400 mg"
 *   maintenanceIntervalDays,  // 14
 *   maintenanceDose,          // "200 mg"
 *   durationMonths,           // 3 | 6 | 12
 *   customEndDate,            // ISO (overrides durationMonths when set)
 *   patientNote,              // string
 * }
 * Returns [{ date, phase, dose }]
 */
export function generateBiologicCalendar(config) {
  const {
    firstDoseDate,
    hasInduction,
    inductionWeeks,
    inductionDose,
    maintenanceIntervalDays,
    maintenanceDose,
    durationMonths,
    customEndDate,
  } = config;

  if (!firstDoseDate) return [];

  let endDateISO;
  if (customEndDate) {
    endDateISO = customEndDate;
  } else {
    const d = new Date(firstDoseDate + "T00:00:00");
    d.setMonth(d.getMonth() + (parseInt(durationMonths) || 6));
    endDateISO = isoDate(d);
  }

  const entries = [];

  if (hasInduction && inductionWeeks?.length > 0) {
    const sorted = [...inductionWeeks].sort((a, b) => a - b);
    for (const week of sorted) {
      const dateISO = addDays(firstDoseDate, Number(week) * 7);
      if (dateISO <= endDateISO) {
        entries.push({ date: dateISO, phase: "Induzione", dose: inductionDose || "" });
      }
    }
  }

  const intervalDays = parseInt(maintenanceIntervalDays) || 14;
  const anchor = entries.length > 0 ? entries[entries.length - 1].date : firstDoseDate;
  let current = addDays(anchor, intervalDays);

  const MAX = 200;
  let safety = 0;
  while (current <= endDateISO && safety++ < MAX) {
    entries.push({ date: current, phase: "Mantenimento", dose: maintenanceDose || "" });
    current = addDays(current, intervalDays);
  }

  if (!hasInduction && entries.length === 0) {
    entries.unshift({ date: firstDoseDate, phase: "Mantenimento", dose: maintenanceDose || "" });
  }

  return entries;
}

// ─── helpers (not exported) ───────────────────────────────────────────────────

function normalizeRoute(route) {
  if (!route) return "s.c.";
  const r = route.toLowerCase();
  if (r.includes("s.c")) return "s.c.";
  if (r.includes("e.v") || r.includes("i.v")) return "e.v.";
  if (r.includes("i.m")) return "i.m.";
  if (r.includes("oral")) return "orale";
  return "s.c.";
}

function frequencyStringToDays(freq) {
  if (!freq) return 28;
  const f = freq.toLowerCase();
  if (f.includes("giornaliera") || f.includes("giornaliero") || f.includes("1/die")) return 1;
  if (f.includes("2 volte") || f.includes("2/die") || f.includes("bid")) return 1;
  if (f.includes("ogni 12 sett") || f.includes("12 sett")) return 84;
  if (f.includes("ogni 8 sett") || f.includes("8 sett")) return 56;
  if (f.includes("ogni 6 sett") || f.includes("6 sett")) return 42;
  if (f.includes("mensile") || f.includes("ogni 4 sett") || f.includes("4 sett") || f.includes("ogni mese")) return 28;
  if (f.includes("ogni 3 sett") || f.includes("3 sett")) return 21;
  if (f.includes("ogni 2 sett") || f.includes("bisettimanale") || f.includes("2 sett")) return 14;
  if (f.includes("settimanale") || f.includes("/sett")) return 7;
  return 28;
}

/**
 * Derive pre-fill defaults for BiologicCalendarModal from a drugs.js drug entry.
 *
 * Reads the first regimen that has a schedule (falling back to the first regimen).
 * Converts phase dayOffsets (in days) to weeks for the modal's induction weeks field.
 *
 * Returns: { route, hasInduction, inductionWeeksRaw, inductionDose, maintenanceDays, maintenanceDose }
 * Returns null if drugEntry is null/undefined.
 */
export function extractBiologicDefaults(drugEntry, specificRegimen = null) {
  if (!drugEntry) return null;

  // Use the explicitly provided regimen if given; otherwise prefer first with schedule
  const regimenWithSchedule = drugEntry.regimens?.find(r => r.schedule?.phases?.length > 0);
  const firstRegimen = drugEntry.regimens?.[0];
  const regimen = specificRegimen || regimenWithSchedule || firstRegimen;
  if (!regimen) return null;

  const route = normalizeRoute(regimen.route || "s.c.");

  if (regimen.schedule?.phases?.length > 0) {
    const phases = regimen.schedule.phases;

    // Maintenance phase
    const maintPhase = phases.find(p => p.type === "maintenance");
    const maintenanceIntervalDays = maintPhase?.interval?.days || 28;
    const maintenanceDose = maintPhase?.dose || regimen.dose || "";

    // All non-maintenance phases that have explicit day offsets (loading + induction)
    const inductionPhases = phases.filter(
      p => (p.type === "induction" || p.type === "loading" || p.type === "cycle") && p.dayOffsets?.length > 0,
    );
    const hasInduction = inductionPhases.length > 0;

    // Collect all offsets → convert to unique weeks
    const allOffsets = [];
    let inductionDose = "";
    for (const phase of inductionPhases) {
      allOffsets.push(...phase.dayOffsets);
      if (!inductionDose) inductionDose = phase.dose || "";
    }
    const inductionWeeks = [...new Set(allOffsets.map(d => Math.round(d / 7)))]
      .sort((a, b) => a - b);
    const inductionWeeksRaw = inductionWeeks.join(", ");

    return { route, hasInduction, inductionWeeksRaw, inductionDose, maintenanceDays: String(maintenanceIntervalDays), maintenanceDose };
  }

  // No schedule — derive from frequency text
  const days = frequencyStringToDays(regimen.frequency || "");
  return {
    route,
    hasInduction: false,
    inductionWeeksRaw: "",
    inductionDose: "",
    maintenanceDays: String(days),
    maintenanceDose: regimen.dose || "",
  };
}

/**
 * Short synthetic text for the medical report.
 * e.g. "Avviata terapia con Certolizumab pegol: induzione 400 mg s.c. alle settimane 0, 2 e 4, quindi mantenimento 200 mg s.c. ogni 2 settimane."
 */
export function formatBiologicSyntheticText(config) {
  const {
    drugName,
    route,
    hasInduction,
    inductionWeeks,
    inductionDose,
    maintenanceIntervalDays,
    maintenanceDose,
  } = config;

  if (!drugName) return "";

  const routeStr = route ? ` ${route}` : "";
  const parts = [];

  if (hasInduction && inductionWeeks?.length > 0) {
    const weeksLabel = formatWeeksList(inductionWeeks.map(Number));
    parts.push(`induzione ${inductionDose}${routeStr} alle ${weeksLabel}`);
  }

  const intLabel = formatIntervalShort(parseInt(maintenanceIntervalDays) || 14);
  parts.push(`quindi mantenimento ${maintenanceDose}${routeStr} ogni ${intLabel}`);

  return `Avviata terapia con ${drugName}: ${parts.join(", ")}.`;
}
