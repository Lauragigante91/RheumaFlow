/**
 * steroidTapering.js
 *
 * Core logic for the steroid tapering plan module.
 * Formulations, tablet calculation, plan generation, presets, safety reminders.
 */

// ── Steroid recognition ──────────────────────────────────────────────────────

export const STEROID_KEYWORDS = [
  "prednisone", "prednisolone", "deltacortene",
  "metilprednisolone", "methylprednisolone", "medrol", "urbason",
  "deflazacort", "flantadin",
  "betametasone", "betamethasone",
  "desametasone", "dexamethasone", "decadron",
  "idrocortisone", "hydrocortisone",
  "cortisone", "cortisolo",
];

export function isSteroide(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return STEROID_KEYWORDS.some(kw => lower.includes(kw));
}

export function detectSteroide(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes("prednisone") || lower.includes("deltacortene") || lower.includes("prednisolone"))
    return "prednisone";
  if (lower.includes("metilprednisolone") || lower.includes("medrol") || lower.includes("urbason") || lower.includes("methylprednisolone"))
    return "metilprednisolone";
  if (lower.includes("deflazacort") || lower.includes("flantadin"))
    return "deflazacort";
  return "prednisone"; // fallback
}

// ── Formulations ─────────────────────────────────────────────────────────────

export const DRUG_FORMULATIONS = {
  prednisone: {
    label: "Prednisone / Deltacortene",
    brands: ["Deltacortene", "Prednisone generico"],
    defaultBrand: "Deltacortene",
    equivalentFactor: 1,
    tablets: [25, 5],
    fractionableLarge: true,
    unit: "mg",
  },
  metilprednisolone: {
    label: "Metilprednisolone / Medrol",
    brands: ["Medrol", "Urbason", "Metilprednisolone generico"],
    defaultBrand: "Medrol",
    equivalentFactor: 0.8,
    tablets: [32, 16, 4],
    unit: "mg",
  },
  deflazacort: {
    label: "Deflazacort / Flantadin",
    brands: ["Flantadin", "Deflazacort generico"],
    defaultBrand: "Flantadin",
    equivalentFactor: 1.2,
    tablets: [30, 6],
    unit: "mg",
  },
  brucorten: {
    label: "Prednisone / Brucorten",
    brands: ["Brucorten"],
    defaultBrand: "Brucorten",
    equivalentFactor: 1,
    tablets: [30, 10, 2.5],
    unit: "mg",
  },
};

/**
 * Calculate optimal tablet combination for a given dose.
 * Returns array of { mg, count } sorted by tablet size desc.
 * Handles half-tablets if needed.
 */
export function calculateTablets(dose, drugKey) {
  const formulation = DRUG_FORMULATIONS[drugKey];
  if (!formulation) return [];
  const sizes = [...formulation.tablets].sort((a, b) => b - a);
  const largest = sizes[0];
  const smallest = sizes[sizes.length - 1];
  const largestH = Math.round(largest * 100);
  const smallestH = Math.round(smallest * 100);
  const fractions = [0.75, 0.5, 0.25];
  const result = [];
  let remaining = Math.round(dose * 100);

  if (remaining >= largestH) {
    const count = Math.floor(remaining / largestH);
    result.push({ mg: largest, count });
    remaining -= count * largestH;
  }

  if (remaining > 0 && formulation.fractionableLarge) {
    for (const frac of fractions) {
      if (remaining === Math.round(largestH * frac)) {
        result.push({ mg: largest, count: frac });
        remaining = 0;
        break;
      }
    }
  }

  if (remaining > 0) {
    for (const size of sizes.slice(1)) {
      const sizeH = Math.round(size * 100);
      if (remaining >= sizeH) {
        const count = Math.floor(remaining / sizeH);
        result.push({ mg: size, count });
        remaining -= count * sizeH;
      }
    }
  }

  if (remaining > 0) {
    for (const frac of fractions) {
      if (remaining === Math.round(smallestH * frac)) {
        result.push({ mg: smallest, count: frac });
        remaining = 0;
        break;
      }
    }
  }

  if (remaining > 0) {
    result.push({ mg: remaining / 100, count: 1, custom: true });
  }

  return result.filter(r => r.count > 0);
}

/**
 * Format tablet combination as Italian text.
 * e.g. [{ mg:25, count:1 }, { mg:5, count:4 }] → "1 cp da 25 mg + 4 cp da 5 mg"
 */
export function formatTablets(tablets, brand, totalDose) {
  if (!tablets.length) return `${totalDose} mg`;
  const fracLabel = { 0.25: "¼ cp", 0.5: "½ cp", 0.75: "¾ cp" };
  const parts = tablets.map(t => {
    const label = fracLabel[t.count] ?? `${t.count} cp`;
    return `${label} da ${t.mg} mg`;
  });
  return parts.join(" + ");
}

// ── Presets ──────────────────────────────────────────────────────────────────

export const TAPERING_PRESETS = {
  gca: {
    label: "GCA (arterite)",
    description: "Arterite a cellule giganti — dose iniziale alta",
    drug: "prednisone",
    startDose: 50,
    initialDurationDays: 14,
    targets: [
      { dose: 25, byWeeks: 4 },
      { dose: 15, byWeeks: 12 },
      { dose: 10, byWeeks: 26 },
      { dose: 5, byWeeks: 52 },
    ],
    stepRules: [
      { aboveDose: 30, reductionMg: 10,  intervalDays: 14 },
      { aboveDose: 20, reductionMg: 5,   intervalDays: 14 },
      { aboveDose: 10, reductionMg: 2.5, intervalDays: 28 },
      { aboveDose: 0,  reductionMg: 2.5, intervalDays: 28 },
    ],
    generalNote: "assumere al mattino dopo colazione",
  },
  pmr: {
    label: "PMR",
    description: "Polimialgia reumatica",
    drug: "prednisone",
    startDose: 15,
    initialDurationDays: 28,
    targets: [
      { dose: 10, byWeeks: 12 },
      { dose: 5,  byWeeks: 26 },
      { dose: 0,  byWeeks: 52 },
    ],
    stepRules: [
      { aboveDose: 10, reductionMg: 2.5, intervalDays: 28 },
      { aboveDose: 5,  reductionMg: 2.5, intervalDays: 28 },
      { aboveDose: 0,  reductionMg: 2.5, intervalDays: 56 },
    ],
    generalNote: "assumere al mattino dopo colazione",
  },
  vasculite_pexivas: {
    label: "Vasculite (PEXIVAS)",
    description: "Schema PEXIVAS ridotto per ANCA-vasculitis",
    drug: "prednisone",
    startDose: 1,
    startDoseIsPerKg: true,
    maxDose: 60,
    initialDurationDays: 7,
    targets: [
      { dose: 20, byWeeks: 5 },
      { dose: 15, byWeeks: 8 },
      { dose: 10, byWeeks: 13 },
      { dose: 5,  byWeeks: 25 },
    ],
    stepRules: [
      { aboveDose: 30, reductionMg: 10, intervalDays: 7  },
      { aboveDose: 20, reductionMg: 5,  intervalDays: 7  },
      { aboveDose: 10, reductionMg: 2.5, intervalDays: 14 },
      { aboveDose: 0,  reductionMg: 2.5, intervalDays: 28 },
    ],
    generalNote: "assumere al mattino dopo colazione",
  },
  les: {
    label: "LES moderato",
    description: "Lupus eritematoso sistemico, flare moderato",
    drug: "prednisone",
    startDose: 30,
    initialDurationDays: 14,
    targets: [
      { dose: 20, byWeeks: 4  },
      { dose: 10, byWeeks: 12 },
      { dose: 5,  byWeeks: 24 },
    ],
    stepRules: [
      { aboveDose: 20, reductionMg: 5,   intervalDays: 14 },
      { aboveDose: 10, reductionMg: 2.5, intervalDays: 28 },
      { aboveDose: 0,  reductionMg: 2.5, intervalDays: 28 },
    ],
    generalNote: "assumere al mattino dopo colazione",
  },
  ra_flare_lieve: {
    label: "AR — flare lieve",
    description: "Artrite reumatoide, flare lieve",
    drug: "prednisone",
    startDose: 10,
    initialDurationDays: 14,
    targets: [
      { dose: 5, byWeeks: 4 },
      { dose: 0, byWeeks: 8 },
    ],
    stepRules: [
      { aboveDose: 5, reductionMg: 2.5, intervalDays: 14 },
      { aboveDose: 0, reductionMg: 2.5, intervalDays: 14 },
    ],
    generalNote: "assumere al mattino dopo colazione",
  },
  ra_flare_moderato: {
    label: "AR — flare moderato",
    description: "Artrite reumatoide, flare moderato",
    drug: "prednisone",
    startDose: 25,
    initialDurationDays: 14,
    targets: [
      { dose: 15, byWeeks: 4  },
      { dose: 5,  byWeeks: 12 },
      { dose: 0,  byWeeks: 20 },
    ],
    stepRules: [
      { aboveDose: 15, reductionMg: 5,   intervalDays: 14 },
      { aboveDose: 5,  reductionMg: 2.5, intervalDays: 14 },
      { aboveDose: 0,  reductionMg: 2.5, intervalDays: 14 },
    ],
    generalNote: "assumere al mattino dopo colazione",
  },
  post_bolo: {
    label: "Post-bolo EV",
    description: "Scalaggio dopo boli di metilprednisolone e.v.",
    drug: "metilprednisolone",
    startDose: 32,
    initialDurationDays: 7,
    targets: [
      { dose: 16, byWeeks: 3  },
      { dose: 8,  byWeeks: 6  },
      { dose: 4,  byWeeks: 10 },
    ],
    stepRules: [
      { aboveDose: 16, reductionMg: 8, intervalDays: 14 },
      { aboveDose: 8,  reductionMg: 4, intervalDays: 14 },
      { aboveDose: 0,  reductionMg: 4, intervalDays: 28 },
    ],
    generalNote: "assumere al mattino dopo colazione",
  },
};

// ── Plan generator ────────────────────────────────────────────────────────────

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateISO, n) {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function daysBetween(a, b) {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / 86400000);
}

/**
 * Generate a tapering plan from a configuration object.
 *
 * config: {
 *   drug: "prednisone" | "metilprednisolone" | "deflazacort",
 *   startDose: number,         // mg/die
 *   startDate: "YYYY-MM-DD",
 *   initialDurationDays: number,
 *   targets: [{ dose: number, byDate: "YYYY-MM-DD" }],
 *   stepRules: [{ aboveDose: number, reductionMg: number, intervalDays: number }],
 *   generalNote: string,
 * }
 *
 * Returns: { steps, warnings }
 * steps: [{ startDate, endDate, dose, durationDays, tablets, tabletText }]
 */
export function generateTaperingPlan(config) {
  const { drug, startDose, startDate, initialDurationDays, targets, stepRules, generalNote } = config;
  if (!startDose || !startDate || !targets?.length) return { steps: [], warnings: [] };

  const sortedTargets = [...targets]
    .filter(t => t.dose !== "" && t.byDate)
    .sort((a, b) => new Date(a.byDate) - new Date(b.byDate));

  if (!sortedTargets.length) return { steps: [], warnings: [] };

  const steps = [];
  const warnings = [];
  let currentDate = startDate;
  let currentDose = parseFloat(startDose);

  if (isNaN(currentDose) || currentDose <= 0) return { steps: [], warnings: ["Dose iniziale non valida"] };

  // Initial phase (dose stabile)
  const initDays = parseInt(initialDurationDays) || 0;
  if (initDays > 0) {
    const endDate = addDays(currentDate, initDays - 1);
    steps.push(makeStep(currentDate, endDate, currentDose, drug, generalNote));
    currentDate = addDays(currentDate, initDays);
  }

  for (const target of sortedTargets) {
    const targetDose = parseFloat(target.dose);
    if (isNaN(targetDose)) continue;
    if (currentDose <= targetDose) {
      warnings.push(`Dose corrente (${currentDose} mg) già uguale o inferiore all'obiettivo (${targetDose} mg)`);
      continue;
    }

    const targetDate = target.byDate;
    let safety = 0;

    while (currentDose > targetDose && safety < 200) {
      safety++;
      // Find applicable step rule
      const rule = [...stepRules]
        .sort((a, b) => b.aboveDose - a.aboveDose)
        .find(r => currentDose > r.aboveDose) || stepRules[stepRules.length - 1];

      const intervalDays = rule?.intervalDays || 28;
      const reduction = rule?.reductionMg || 2.5;
      const nextDose = Math.max(currentDose - reduction, targetDose);
      const nextDate = addDays(currentDate, intervalDays);

      let stepEndDate;
      if (nextDate > targetDate) {
        stepEndDate = addDays(targetDate, -1);
        if (daysBetween(currentDate, stepEndDate) < 0) break;
      } else {
        stepEndDate = addDays(nextDate, -1);
      }

      steps.push(makeStep(currentDate, stepEndDate, currentDose, drug, generalNote));
      currentDate = addDays(stepEndDate, 1);
      currentDose = nextDose;

      if (currentDate > targetDate && currentDose > targetDose) {
        warnings.push(`Obiettivo ${targetDose} mg entro ${formatDateIT(targetDate)} non raggiungibile con questi parametri — continuare nella visita successiva`);
        break;
      }
    }

    // If we hit target dose before target date, add a step at target dose
    if (currentDose === targetDose && currentDate <= targetDate) {
      const holdEnd = addDays(targetDate, -1);
      if (daysBetween(currentDate, holdEnd) >= 0) {
        steps.push(makeStep(currentDate, holdEnd, currentDose, drug, generalNote));
        currentDate = targetDate;
      }
    }
  }

  return { steps, warnings };
}

function makeStep(startDate, endDate, dose, drug, note) {
  const tablets = calculateTablets(dose, drug);
  const formulation = DRUG_FORMULATIONS[drug];
  return {
    startDate,
    endDate,
    dose,
    durationDays: daysBetween(startDate, endDate) + 1,
    tablets,
    tabletText: formatTablets(tablets, formulation?.defaultBrand, dose),
  };
}

// ── Output formatters ─────────────────────────────────────────────────────────

function formatDateIT(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Output A — testo clinico sintetico per il referto.
 */
export function formatClinicalText(config, steps) {
  const { drug, startDose, startDate, targets, generalNote } = config;
  const formulation = DRUG_FORMULATIONS[drug];
  const drugLabel = formulation?.label || drug;
  const lastTarget = targets?.filter(t => t.dose !== "" && t.byDate).sort((a, b) => new Date(b.byDate) - new Date(a.byDate))[0];

  let text = `Si programma scalaggio del ${drugLabel} (dose iniziale: ${startDose} mg/die dal ${formatDateIT(startDate)})`;

  if (lastTarget) {
    text += `, con obiettivo ${lastTarget.dose} mg/die entro il ${formatDateIT(lastTarget.byDate)}`;
  }

  text += `, secondo schema calendarizzato allegato.`;

  if (steps.length) {
    const finalDose = steps[steps.length - 1].dose;
    const finalDate = steps[steps.length - 1].endDate;
    if (finalDose !== parseFloat(lastTarget?.dose)) {
      text += ` Lo schema generato prevede una dose di ${finalDose} mg/die al ${formatDateIT(finalDate)}.`;
    }
  }

  if (generalNote) text += ` (${generalNote})`;

  return text;
}

/**
 * Output B — schema paziente stampabile.
 */
export function formatPatientSchedule(config, steps) {
  const { drug, generalNote } = config;
  const formulation = DRUG_FORMULATIONS[drug];
  const brand = formulation?.defaultBrand || drug;

  const lines = [];
  lines.push(`SCHEMA SCALAGGIO — ${(formulation?.label || drug || "prednisone").toUpperCase()}`);
  lines.push("=".repeat(60));

  for (const step of steps) {
    const dur = step.durationDays === 1 ? "1 giorno" : `${step.durationDays} giorni`;
    lines.push(`\nDal ${formatDateIT(step.startDate)} al ${formatDateIT(step.endDate)} (${dur}):`);
    lines.push(`  Totale: ${step.dose} mg al giorno`);

    if (step.tablets?.length) {
      const fracWord = { 0.25: "¼ compressa", 0.5: "½ compressa", 0.75: "¾ compressa" };
      const tabParts = step.tablets.map(t => {
        const n = fracWord[t.count] ?? `${t.count} ${t.count === 1 ? "compressa" : "compresse"}`;
        return `${brand} ${t.mg} mg: ${n}`;
      });
      lines.push(`  ${tabParts.join(" + ")}`);
    }

    if (generalNote) lines.push(`  Note: ${generalNote}`);
  }

  lines.push("\n" + "=".repeat(60));
  lines.push("IMPORTANTE: Non interrompere lo steroide bruscamente.");
  lines.push("In caso di malattia, trauma o intervento: contattare il medico.");

  return lines.join("\n");
}

// ── Safety reminders ─────────────────────────────────────────────────────────

/**
 * Returns array of safety reminders based on the generated plan.
 * config.hasImmunosuppressants: bool
 */
export function getSafetyReminders(config, steps) {
  const reminders = [];
  if (!steps?.length) return reminders;

  const totalDays = steps.reduce((s, st) => s + st.durationDays, 0);
  const maxDose = Math.max(...steps.map(s => s.dose));
  const avgDose = totalDays > 0
    ? steps.reduce((s, st) => s + st.dose * st.durationDays, 0) / totalDays
    : 0;

  // Convert to prednisone equivalent
  const factor = DRUG_FORMULATIONS[config.drug]?.equivalentFactor || 1;
  const maxPDN = maxDose / factor;
  const avgPDN = avgDose / factor;

  if (avgPDN > 5 && totalDays > 90) {
    reminders.push({
      id: "osteoporosi",
      priority: "high",
      icon: "🦴",
      label: "Prevenzione osteoporosi",
      text: `GC equivalenti >5 mg/die per >3 mesi (media attuale: ${avgPDN.toFixed(1)} mg PDN eq). Valutare: Ca++ 1g/die + vitamina D 800-1000 UI/die + bifosfonato se FRAX elevato. Densitometria ossea alla diagnosi.`,
    });
  }

  if (maxPDN >= 20 || config.hasImmunosuppressants) {
    reminders.push({
      id: "pjp",
      priority: "high",
      icon: "🦠",
      label: "Profilassi PJP / Rischio infettivo",
      text: `Dose > 20 mg/die${config.hasImmunosuppressants ? " + immunosoppressore" : ""}: considerare cotrimossazolo 960 mg x3/sett (se GFR ≥30). Aggiornare vaccinazioni (influenza, pneumococco). Evitare vaccini vivi.`,
    });
  }

  const rapidReductionBelow10 = steps.some((st, i) => {
    if (i === 0) return false;
    return steps[i - 1].dose > 10 && st.dose < 10 && (steps[i - 1].dose - st.dose) > 4;
  });
  if (rapidReductionBelow10) {
    reminders.push({
      id: "surrenalica",
      priority: "high",
      icon: "⚠️",
      label: "Rischio insufficienza surrenalica",
      text: "Riduzione rapida sotto 10 mg/die: scalare ≤1 mg ogni 4 settimane. Informare il paziente sui sintomi da insufficienza surrenalica (nausea, astenia, ipotensione). In caso di stress (interventi, infezioni gravi): dose di stress.",
    });
  }

  reminders.push({
    id: "monitoraggio",
    priority: "medium",
    icon: "📋",
    label: "Monitoraggio periodico",
    text: "Glicemia (a digiuno ogni 3-6 mesi), pressione arteriosa (ogni visita), peso corporeo, controllo oculistico (cataratta, glaucoma) annuale.",
  });

  return reminders;
}

export { formatDateIT };
