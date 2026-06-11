// ─── instrumentalFormatters.js ────────────────────────────────────────────────
// Shared utilities for rendering instrumental_exams records as structured text.
// Used by VisitReportDialog, export.js, and any future print/PDF component.

export const EXAM_TYPE_LABELS = {
  hrct:           "HRCT Torace",
  pft:            "Spirometria / PFR",
  echo_cardiac:   "Ecocardiogramma",
  capillaroscopy: "Capillaroscopia",
  ecodoppler:     "Ecodoppler vascolare",
  petvas:         "PET/TC vascolare",
  angio_ct:       "Angio-TC",
  angio_mri:      "Angio-RMN",
  echo_msk:       "Ecografia MSK",
  xray:           "Radiografia",
  mri:            "Risonanza magnetica",
  ct:             "TC",
  imaging_report: "Referto imaging",
  other:          "Esame strumentale",
};

// Meller grading scale
const MELLER_LABEL = [
  "nessun uptake",
  "uptake lieve (< fegato)",
  "uptake moderato (= fegato)",
  "uptake intenso (> fegato)",
];

// PET territory key → Italian anatomical label
const TERRITORY_LABEL = {
  ascending_aorta:     "Aorta ascendente",
  aortic_arch:         "Arco aortico",
  descending_thoracic: "Aorta toracica discendente",
  abdominal_aorta:     "Aorta addominale",
  carotid_l:           "Carotide comune sinistra",
  carotid_r:           "Carotide comune destra",
  brachiocephalic:     "Tronco brachiocefalico",
  subclavian_l:        "Succlavia sinistra",
  subclavian_r:        "Succlavia destra",
  axillary_l:          "Ascellare sinistra",
  axillary_r:          "Ascellare destra",
  iliac_common_l:      "Iliaca comune sinistra",
  iliac_common_r:      "Iliaca comune destra",
  temporal_l:          "Temporale superficiale sinistra",
  temporal_r:          "Temporale superficiale destra",
  renal_l:             "Arteria renale sinistra",
  renal_r:             "Arteria renale destra",
  mesenteric_sup:      "AMS (mesenterica superiore)",
  mesenteric_inf:      "AMI (mesenterica inferiore)",
  pulmonary:           "Arterie polmonari",
  femoral_l:           "Arteria femorale sinistra",
  femoral_r:           "Arteria femorale destra",
  vertebral_l:         "Arteria vertebrale sinistra",
  vertebral_r:         "Arteria vertebrale destra",
};

export function fmtDateIT(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString("it-IT");
}

// ── Retrieve territories dict from exam (new + legacy shape) ─────────────────
function getTerritories(exam) {
  return exam?.structured_values?.territories ?? exam?.inputs?.territories ?? {};
}

// ── Format PET territory map → multiline text block ──────────────────────────
// Source of truth: the territory map with Meller grading.
// pet_positive is used as a helper only when no territory map is available.
export function formatPetDistricts(exam) {
  const terr = getTerritories(exam);
  const entries = Object.entries(terr).filter(([, v]) => v > 0);
  if (!entries.length) return null;

  const pathological = entries.filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]);
  const mild         = entries.filter(([, v]) => v === 1);
  const lines = [];

  if (pathological.length) {
    lines.push("Distretti con captazione patologica (Meller ≥ 2):");
    for (const [k, v] of pathological) {
      const label = TERRITORY_LABEL[k] || k.replace(/_/g, " ");
      lines.push(`  • ${label} — grado ${v} (${MELLER_LABEL[v] || v})`);
    }
  }
  if (mild.length) {
    lines.push("Distretti con uptake lieve — Meller 1 (non patologico per LVV):");
    for (const [k] of mild) {
      const label = TERRITORY_LABEL[k] || k.replace(/_/g, " ");
      lines.push(`  • ${label}`);
    }
  }
  return lines.join("\n") || null;
}

// ── Compute positivity from territory map (Meller-based, not pet_positive) ───
export function isPetPositive(exam) {
  const terr = getTerritories(exam);
  if (Object.keys(terr).length) {
    return Object.values(terr).some(v => v >= 2);
  }
  // Fallback to stored flag only when no territory map is recorded
  if (exam?.structured_values?.pet_positive != null) return exam.structured_values.pet_positive;
  if (exam?.inputs?.pet_positive != null)             return exam.inputs.pet_positive;
  return null;
}

// ── Temporal comparison between two consecutive PET exams ────────────────────
export function formatPetComparison(current, previous) {
  if (!previous) return null;
  const currT = getTerritories(current);
  const prevT = getTerritories(previous);
  const allKeys = new Set([...Object.keys(currT), ...Object.keys(prevT)]);

  const appeared = [];
  const resolved = [];
  const worsened = [];
  const improved = [];

  for (const k of allKeys) {
    const c = currT[k] ?? 0;
    const p = prevT[k] ?? 0;
    if (c === p) continue;
    const label = TERRITORY_LABEL[k] || k.replace(/_/g, " ");
    if (p < 2 && c >= 2)  appeared.push(`${label} (grado ${c})`);
    else if (p >= 2 && c < 2) resolved.push(label);
    else if (c > p)        worsened.push(`${label}: grado ${p}→${c}`);
    else if (c < p)        improved.push(`${label}: grado ${p}→${c}`);
  }

  const d = fmtDateIT(previous.exam_date || previous.date);
  const lines = [`Confronto con esame precedente (${d}):`];

  if (!appeared.length && !resolved.length && !worsened.length && !improved.length) {
    lines.push("  Distribuzione territoriale stabile rispetto al controllo precedente.");
  } else {
    if (appeared.length)  lines.push(`  Nuovi distretti patologici: ${appeared.join(", ")}.`);
    if (resolved.length)  lines.push(`  Distretti risolti: ${resolved.join(", ")}.`);
    if (worsened.length)  lines.push(`  Peggioramento: ${worsened.join("; ")}.`);
    if (improved.length)  lines.push(`  Miglioramento: ${improved.join("; ")}.`);
  }
  return lines.join("\n");
}

// ── Full PET exam block (with optional temporal comparison) ──────────────────
export function formatPetExam(exam, previousExam) {
  if (!exam) return null;
  const d = fmtDateIT(exam.exam_date || exam.date);
  const positive = isPetPositive(exam);

  const positivityLine =
    positive === true  ? "Positività vascolare confermata (Meller ≥ 2 in almeno un distretto)." :
    positive === false ? "PET vascolare negativa per captazione patologica." :
                         "Positività non determinabile dalla mappa territoriale.";

  const parts = [
    `PET/TC vascolare — ${d}`,
    positivityLine,
    formatPetDistricts(exam),
    exam.summary ? `Descrizione: ${exam.summary}` : null,
    formatPetComparison(exam, previousExam),
  ].filter(Boolean);

  const score = exam.structured_values?.petvas_score ?? exam.score;
  if (score != null) parts.push(`PETVAS score (dato di ricerca): ${score}/27`);

  return parts.join("\n");
}

// ── All exams of given type(s), newest first ─────────────────────────────────
export function allByType(instrumentalExams, types) {
  const typeArr = Array.isArray(types) ? types : [types];
  return [...(instrumentalExams || [])]
    .filter(e => typeArr.includes(e.exam_type))
    .sort((a, b) => {
      const da = a.exam_date || a.date || "";
      const db = b.exam_date || b.date || "";
      return db > da ? 1 : db < da ? -1 : 0;
    });
}

// ── Latest exam of given type(s) ─────────────────────────────────────────────
export function latestByType(instrumentalExams, types) {
  return allByType(instrumentalExams, types)[0] || null;
}

// ── Format a non-PET exam as a single descriptive line ───────────────────────
export function formatGenericExam(exam) {
  const d = fmtDateIT(exam.exam_date || exam.date);
  const sv = exam.structured_values || {};
  const details = [];

  switch (exam.exam_type) {
    case "hrct":
      if (sv.hrct_pattern) details.push(`pattern: ${sv.hrct_pattern}`);
      if (sv.extent)       details.push(`estensione: ${sv.extent}`);
      if (sv.fvc_percent)  details.push(`FVC: ${sv.fvc_percent}%`);
      break;
    case "pft":
      if (sv.fvc_percent)  details.push(`FVC: ${sv.fvc_percent}%`);
      if (sv.dlco_percent) details.push(`DLCO: ${sv.dlco_percent}%`);
      if (sv.fev1_percent) details.push(`FEV1: ${sv.fev1_percent}%`);
      if (sv.pattern)      details.push(`pattern: ${sv.pattern}`);
      break;
    case "echo_cardiac":
      if (sv.echo_psap)    details.push(`PSAP: ${sv.echo_psap} mmHg`);
      if (sv.ef_percent != null) details.push(`FE: ${sv.ef_percent}%`);
      if (sv.pattern)      details.push(sv.pattern);
      break;
    case "capillaroscopy":
      if (sv.pattern)      details.push(`pattern: ${sv.pattern}`);
      if (sv.nvc_pattern)  details.push(`NVC: ${sv.nvc_pattern}`);
      break;
    case "ecodoppler":
      if (sv.territory)    details.push(sv.territory);
      if (sv.stenosis)     details.push(`stenosi: ${sv.stenosis}`);
      if (sv.finding)      details.push(sv.finding);
      break;
    case "angio_ct":
    case "angio_mri":
      if (sv.territory)    details.push(sv.territory);
      if (sv.finding)      details.push(sv.finding);
      break;
    case "echo_msk":
      if (sv.joint)        details.push(sv.joint);
      if (sv.finding)      details.push(sv.finding);
      break;
    default:
      if (sv.finding)      details.push(sv.finding);
      break;
  }

  const territory = exam.territory && exam.territory !== exam.summary ? ` — ${exam.territory}` : "";
  const detailStr = details.length ? ` (${details.join(", ")})` : "";
  const summaryStr = exam.summary && !details.some(d => exam.summary.startsWith(d))
    ? `\n    ${exam.summary}` : "";

  return `${d}${territory}${detailStr}${summaryStr}`;
}

// ── Build "ESAMI STRUMENTALI" text block ─────────────────────────────────────
// types: array of exam_type to include (null = all types present)
// Returns null if no matching exams.
export function buildInstrumentalText(instrumentalExams, types) {
  const allExams = [...(instrumentalExams || [])]
    .filter(e => !types || types.includes(e.exam_type));

  if (!allExams.length) return null;

  const byType = {};
  for (const e of allExams) {
    const t = e.exam_type || "other";
    if (!byType[t]) byType[t] = [];
    byType[t].push(e);
  }

  // Sort types: petvas first (most clinically narrative), then alphabetical
  const typeOrder = ["petvas", "hrct", "pft", "echo_cardiac", "capillaroscopy",
                     "ecodoppler", "angio_ct", "angio_mri", "echo_msk",
                     "xray", "mri", "ct", "imaging_report", "other"];
  const sortedTypes = Object.keys(byType).sort((a, b) => {
    const ia = typeOrder.indexOf(a);
    const ib = typeOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const sections = [];

  for (const type of sortedTypes) {
    const label = EXAM_TYPE_LABELS[type] || type;
    const group = byType[type];

    if (type === "petvas") {
      // PET: full narrative block per exam, newest first, with temporal comparison
      const sorted = [...group].sort((a, b) => {
        const da = a.exam_date || a.date || "";
        const db = b.exam_date || b.date || "";
        return db > da ? 1 : db < da ? -1 : 0;
      });
      const petLines = [label.toUpperCase()];
      for (let i = 0; i < sorted.length; i++) {
        const block = formatPetExam(sorted[i], sorted[i + 1] || null);
        if (block) petLines.push(block);
        if (i < sorted.length - 1) petLines.push("");
      }
      sections.push(petLines.join("\n"));
    } else {
      // Generic: one bullet per exam, oldest to newest
      const sorted = [...group].sort((a, b) => {
        const da = a.exam_date || a.date || "";
        const db = b.exam_date || b.date || "";
        return da > db ? 1 : da < db ? -1 : 0;
      });
      const lines = [label.toUpperCase()];
      for (const e of sorted) {
        lines.push(`  • ${formatGenericExam(e)}`);
      }
      sections.push(lines.join("\n"));
    }
  }

  return sections.join("\n\n");
}
