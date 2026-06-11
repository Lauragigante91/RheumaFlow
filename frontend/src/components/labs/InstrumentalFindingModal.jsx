/**
 * InstrumentalFindingModal
 *
 * Manual "highlight → structured instrumental finding" flow.
 *
 * KEY FEATURES:
 *   • Exam types grouped (vascular/MSK · SSc/organ-specific · generic)
 *   • resultMode per type: "required" | "optional" | "hidden"
 *     - required → PET/TC only (positive/negative is the primary output)
 *     - optional → generic imaging, vascular, MSK
 *     - hidden  → echo, HRCT, spirometry, capillaroscopy (structured values are the output)
 *   • Exam-specific structured value grids for:
 *       pft          → FVC, FEV1, FEV1/FVC, DLCO, DLCOc, TLC
 *       echo_cardiac → PAPs, TAPSE, RV dysfunction, pericardial effusion, LVEF
 *       capillaroscopy → NVC pattern, capillary density, avascular areas, megacapillaries
 *   • Structured values auto-propagate into the disease-profile mapping section
 *     (physician can edit/override before confirming)
 *   • Disease-profile section appears only when patient has a matching diagnosis
 *
 * Saves:
 *   1. An InstrumentalExam record (instrumental_exams collection via instrumentalExamsApi)
 *   2. Optionally: the relevant section of the SSc or PMR/LVV disease profile
 *
 * Props:
 *   open        boolean
 *   onClose     () => void
 *   sourceText  string   — the originally selected text (read-only)
 *   patientId   string
 *   patient     object   — full patient object (for disease detection)
 *   visitDate   string   — ISO date pre-fill
 *   onSaved     (assessment) => void
 */

import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Zap, Activity, Layers, Radio, Scan, Film, Cpu, FileImage,
  HelpCircle, CheckCircle2, Loader2, Heart, Wind, BarChart2,
  ArrowRight, Microscope, Stethoscope, Clock,
} from "lucide-react";
import OcrScanButton from "./OcrScanButton";
import { toast } from "sonner";
import { instrumentalExamsApi, scleroProfileApi, diseaseProfileApi } from "../../lib/api";
import ItalianDatePicker from "../shared/ItalianDatePicker";
import { isPmrDiagnosis, isLvvDiagnosis } from "../../lib/diseaseDetection";
import { isScleroDiagnosis } from "../profiles/ScleroProfileSection";

// ─── Exam type definitions ─────────────────────────────────────────────────────
// resultMode:
//   "required" → must pick Pos/Neg/Doubtful (PET/TC)
//   "optional" → field shown but not required
//   "hidden"   → no result pill (structured values are the output)

const EXAM_TYPES = [
  // ── Imaging vascolare ─────────────────────────────────────────────────────
  { key: "ecodoppler",    label: "Eco Doppler vascolare",  nativeType: "ecodoppler",  color: "#1d4ed8", bg: "#eff6ff", icon: Activity,     group: "vascular",  resultMode: "optional" },
  { key: "petvas",        label: "PET/TC",                 nativeType: "petvas",      color: "#be185d", bg: "#fff1f2", icon: Zap,          group: "vascular",  resultMode: "required" },
  { key: "angio_ct",      label: "AngioCT",                nativeType: "angio_ct",    color: "#b45309", bg: "#fffbeb", icon: Layers,       group: "vascular",  resultMode: "optional" },
  { key: "angio_mri",     label: "AngioRM",                nativeType: "angio_mri",   color: "#7c3aed", bg: "#f5f3ff", icon: Radio,        group: "vascular",  resultMode: "optional" },
  // ── Cardiologico ──────────────────────────────────────────────────────────
  { key: "echo_cardiac",  label: "Ecocardiografia",        nativeType: null,          color: "#dc2626", bg: "#fef2f2", icon: Heart,        group: "cardiac",   resultMode: "hidden"   },
  { key: "ecg",           label: "ECG",                    nativeType: null,          color: "#e11d48", bg: "#fff1f2", icon: Stethoscope,  group: "cardiac",   resultMode: "optional" },
  { key: "holter_ecg",    label: "Holter ECG",             nativeType: null,          color: "#9f1239", bg: "#ffeef2", icon: Clock,        group: "cardiac",   resultMode: "optional" },
  // ── Polmonare ─────────────────────────────────────────────────────────────
  { key: "pft",           label: "Spirometria / PFR",      nativeType: null,          color: "#0891b2", bg: "#ecfeff", icon: BarChart2,    group: "pulmonary", resultMode: "hidden"   },
  { key: "hrct",          label: "HRCT / TC torace",       nativeType: null,          color: "#0284c7", bg: "#f0f9ff", icon: Wind,         group: "pulmonary", resultMode: "hidden"   },
  // ── Muscolo-scheletrico ───────────────────────────────────────────────────
  { key: "echo_msk",      label: "Eco MSK / articolare",   nativeType: "echo_msk",    color: "#0f766e", bg: "#f0fdfa", icon: Scan,         group: "msk",       resultMode: "optional" },
  { key: "mri",           label: "RM",                     nativeType: null,          color: "#9333ea", bg: "#faf5ff", icon: Cpu,          group: "msk",       resultMode: "optional" },
  { key: "ct",            label: "TC",                     nativeType: null,          color: "#9a3412", bg: "#fff7ed", icon: FileImage,    group: "msk",       resultMode: "optional" },
  { key: "xray",          label: "Radiografia",            nativeType: null,          color: "#374151", bg: "#f9fafb", icon: Film,         group: "msk",       resultMode: "optional" },
  // ── Altro strumentale ─────────────────────────────────────────────────────
  { key: "capillaroscopy",label: "Capillaroscopia",        nativeType: null,          color: "#7c3aed", bg: "#faf5ff", icon: Microscope,   group: "other",     resultMode: "hidden"   },
  { key: "other",         label: "Altro",                  nativeType: null,          color: "#6b7280", bg: "#f9fafb", icon: HelpCircle,   group: "other",     resultMode: "optional" },
];

const EXAM_GROUPS = [
  { id: "vascular",  label: "Imaging vascolare" },
  { id: "cardiac",   label: "Cardiologico" },
  { id: "pulmonary", label: "Polmonare" },
  { id: "msk",       label: "Muscolo-scheletrico" },
  { id: "other",     label: "Altro strumentale" },
];

// ─── Field visibility rules per exam type ─────────────────────────────────────
// Only these exam types show the territory / finding-type fields.
// Measurement is removed entirely (no exam needs it as a free field anymore).
const SHOW_TERRITORY    = new Set(["ecodoppler","petvas","angio_ct","angio_mri","echo_msk","mri","ct","xray","other"]);
const SHOW_FINDING_TYPE = new Set(["other"]);

const RESULTS = [
  { key: "positive", label: "Positivo",  color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  { key: "negative", label: "Negativo",  color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  { key: "doubtful", label: "Dubbio",    color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
];

// ─── Structured field option sets ─────────────────────────────────────────────

const RV_DYSFUNCTION_OPTIONS = [
  { value: "none",     label: "Assente" },
  { value: "mild",     label: "Lieve" },
  { value: "moderate", label: "Moderata" },
  { value: "severe",   label: "Severa" },
];

const PERICARDIAL_EFF_OPTIONS = [
  { value: "none",     label: "Assente" },
  { value: "mild",     label: "Piccolo" },
  { value: "moderate", label: "Moderato" },
  { value: "large",    label: "Abbondante" },
];

const CAPILLO_PATTERN_OPTIONS = [
  { value: "normal",    label: "Normale" },
  { value: "early_ssc", label: "Precoce SSc" },
  { value: "active_ssc",label: "Attivo SSc" },
  { value: "late_ssc",  label: "Tardivo SSc" },
  { value: "nonspecific",label: "Non specifico" },
];

const HRCT_PATTERN_STRUCT_OPTIONS = [
  { value: "nsip",      label: "NSIP" },
  { value: "uip_prob",  label: "UIP probabile" },
  { value: "uip_def",   label: "UIP definita" },
  { value: "op",        label: "OP (organizing pneumonia)" },
  { value: "lip",       label: "LIP" },
  { value: "none",      label: "Non definito" },
];

const HRCT_EXTENT_STRUCT_OPTIONS = [
  { value: "lt10",   label: "< 10%" },
  { value: "10_20",  label: "10–20%" },
  { value: "gt20",   label: "> 20%" },
];

const AVASCULAR_OPTIONS = [
  { value: "no",          label: "Assenti" },
  { value: "yes_focal",   label: "Sì — focali" },
  { value: "yes_diffuse", label: "Sì — diffuse" },
];

const MEGA_CAP_OPTIONS = [
  { value: "no",       label: "Assenti" },
  { value: "yes_few",  label: "Presenti (pochi)" },
  { value: "yes_many", label: "Presenti (numerosi)" },
];

// ─── Exam-specific structured value grids ─────────────────────────────────────

const EXAM_STRUCTURED_FIELDS = {
  hrct: {
    label: "Pattern polmonare / ILD",
    color: "#0284c7",
    bg: "#f0f9ff",
    fields: [
      { key: "hrct_pattern", label: "Pattern ILD",  type: "select", options: HRCT_PATTERN_STRUCT_OPTIONS },
      { key: "hrct_extent",  label: "Estensione",   type: "select", options: HRCT_EXTENT_STRUCT_OPTIONS },
    ],
  },
  pft: {
    label: "Valori spirometrici / PFR",
    color: "#0891b2",
    bg: "#ecfeff",
    fields: [
      { key: "fvc_percent",  label: "FVC",           type: "number", placeholder: "es. 72", unit: "% pred." },
      { key: "fev1_percent", label: "FEV1",          type: "number", placeholder: "es. 78", unit: "% pred." },
      { key: "fev1_fvc",     label: "FEV1/FVC",      type: "number", placeholder: "es. 0.78" },
      { key: "dlco_percent", label: "DLCO",          type: "number", placeholder: "es. 62", unit: "% pred." },
      { key: "dlco_c",       label: "DLCOc",         type: "number", placeholder: "es. 65", unit: "% pred." },
      { key: "tlc_percent",  label: "TLC",           type: "number", placeholder: "es. 85", unit: "% pred." },
    ],
  },
  echo_cardiac: {
    label: "Parametri ecocardiografici",
    color: "#dc2626",
    bg: "#fef2f2",
    fields: [
      { key: "paps",      label: "PAPs / sPAP",       type: "number", placeholder: "es. 42",  unit: "mmHg" },
      { key: "tapse",     label: "TAPSE",             type: "number", placeholder: "es. 18",  unit: "mm" },
      { key: "lvef",      label: "LVEF / FE VS",      type: "number", placeholder: "es. 60",  unit: "%" },
      { key: "rv_dysfunc",label: "Disfunzione VD",    type: "select", options: RV_DYSFUNCTION_OPTIONS },
      { key: "peri_eff",  label: "Vers. pericardico", type: "select", options: PERICARDIAL_EFF_OPTIONS },
    ],
  },
  capillaroscopy: {
    label: "Pattern capillaroscopico (NVC)",
    color: "#7c3aed",
    bg: "#faf5ff",
    fields: [
      { key: "pattern",    label: "Pattern NVC",          type: "select", options: CAPILLO_PATTERN_OPTIONS },
      { key: "density",    label: "Densità (cap/mm)",     type: "number", placeholder: "es. 6.2" },
      { key: "avascular",  label: "Aree avascolari",      type: "select", options: AVASCULAR_OPTIONS },
      { key: "megacap",    label: "Megacapillari",        type: "select", options: MEGA_CAP_OPTIONS },
    ],
  },
};

// Keys to propagate from structured fields → profile mapping fields
export const STRUCTURED_TO_PROFILE_MAP = {
  pft: {
    fvc_percent:  "fvc_percent",
    fev1_percent: "fev1_percent",
    dlco_percent: "dlco_percent",
  },
  echo_cardiac: {
    paps:  "echo_psap",
    tapse: "tapse",
  },
  capillaroscopy: {
    pattern: "capillo_pattern",
  },
};

// ─── Disease profile mapping definitions ──────────────────────────────────────

const PAH_STATUS_OPTIONS = [
  { value: "not_screened", label: "Non screenato" },
  { value: "negative",     label: "Screening negativo" },
  { value: "suspected",    label: "Sospetto (PSAP elevato)" },
  { value: "confirmed",    label: "Confermata (RHC+)" },
];

const ILD_PRESENT_OPTIONS = [
  { value: "no",              label: "No (HRCT negativa)" },
  { value: "yes_stable",      label: "Sì — stabile" },
  { value: "yes_progressive", label: "Sì — progressiva" },
  { value: "not_assessed",    label: "Non valutata" },
];

const HRCT_PATTERN_OPTIONS = [
  { value: "none",  label: "Assente" },
  { value: "nsip",  label: "NSIP" },
  { value: "uip",   label: "UIP" },
  { value: "op",    label: "OP (organizing pneumonia)" },
  { value: "mixed", label: "Misto / indeterminato" },
];

const ILD_EXTENT_OPTIONS = [
  { value: "limited",   label: "Limitata (<20%)" },
  { value: "extensive", label: "Estesa (≥20% Goh-Wells)" },
];

export function getProfileMapping(examType, patient) {
  const isSSc    = isScleroDiagnosis(patient);
  const isPmrLvv = isPmrDiagnosis(patient) || isLvvDiagnosis(patient);

  if (examType === "echo_cardiac" && isSSc) {
    return {
      profileType: "ssc", section: "pah",
      diseaseLabel: "Sclerosi sistemica",
      sectionLabel: "Ipertensione polmonare (PAH)",
      fields: [
        { key: "echo_psap",      label: "PAPs eco (mmHg)",    type: "number", placeholder: "es. 38" },
        { key: "tapse",          label: "TAPSE (mm)",         type: "number", placeholder: "es. 18" },
        { key: "status",         label: "Stato PAH",          type: "select", options: PAH_STATUS_OPTIONS },
        { key: "screening_date", label: "Data screening",     type: "date" },
      ],
    };
  }

  if (examType === "hrct" && isSSc) {
    return {
      profileType: "ssc", section: "ild",
      diseaseLabel: "Sclerosi sistemica",
      sectionLabel: "ILD polmonare (SSc-ILD)",
      fields: [
        { key: "present",      label: "ILD presente",   type: "select", options: ILD_PRESENT_OPTIONS },
        { key: "hrct_pattern", label: "Pattern HRCT",   type: "select", options: HRCT_PATTERN_OPTIONS },
        { key: "extent",       label: "Estensione",     type: "select", options: ILD_EXTENT_OPTIONS },
        { key: "hrct_date",    label: "Data HRCT",      type: "date" },
      ],
    };
  }

  if (examType === "pft" && isSSc) {
    return {
      profileType: "ssc", section: "ild",
      diseaseLabel: "Sclerosi sistemica",
      sectionLabel: "Funzionalità polmonare (FVC, DLCO)",
      fields: [
        { key: "fvc_percent",  label: "FVC % predetto",  type: "number", placeholder: "es. 78" },
        { key: "fev1_percent", label: "FEV1 % predetto", type: "number", placeholder: "es. 75" },
        { key: "dlco_percent", label: "DLCO % predetto", type: "number", placeholder: "es. 62" },
        { key: "pft_date",     label: "Data PFR",        type: "date" },
      ],
    };
  }

  if (examType === "capillaroscopy" && isSSc) {
    return {
      profileType: "ssc", section: "microvascular",
      diseaseLabel: "Sclerosi sistemica",
      sectionLabel: "Profilo microvascolare (NVC)",
      fields: [
        { key: "capillo_pattern", label: "Pattern NVC", type: "select", options: CAPILLO_PATTERN_OPTIONS },
        { key: "capillo_date",    label: "Data esame",  type: "date" },
      ],
    };
  }

  if (examType === "petvas" && isPmrLvv) {
    return {
      profileType: "pmr_lvv", section: null,
      diseaseLabel: "PMR / GCA / LVV",
      sectionLabel: "Percorso diagnostico",
      fields: [{ key: "dx_pet_positive", label: "PET/TC positiva", type: "boolean" }],
    };
  }

  if (examType === "ecodoppler" && isPmrLvv) {
    return {
      profileType: "pmr_lvv", section: null,
      diseaseLabel: "PMR / GCA / LVV",
      sectionLabel: "Percorso diagnostico",
      fields: [{ key: "dx_ultrasound_halo", label: "Segno del halo (Eco Doppler)", type: "boolean" }],
    };
  }

  if (examType === "angio_ct" && isPmrLvv) {
    return {
      profileType: "pmr_lvv", section: null,
      diseaseLabel: "PMR / GCA / LVV",
      sectionLabel: "Percorso diagnostico",
      fields: [{ key: "dx_angio_ct", label: "AngioCT positiva", type: "boolean" }],
    };
  }

  if (examType === "angio_mri" && isPmrLvv) {
    return {
      profileType: "pmr_lvv", section: null,
      diseaseLabel: "PMR / GCA / LVV",
      sectionLabel: "Percorso diagnostico",
      fields: [{ key: "dx_angio_mri", label: "AngioMRI positiva", type: "boolean" }],
    };
  }

  return null;
}

// ─── writeToProfile helper ────────────────────────────────────────────────────

export async function writeToProfile(mapping, profileValues, patientId) {
  if (mapping.profileType === "ssc") {
    const current = await scleroProfileApi.get(patientId).catch(() => ({}));
    const section = mapping.section;
    await scleroProfileApi.upsert(patientId, {
      ...current,
      [section]: { ...(current[section] || {}), ...profileValues },
    });
  } else if (mapping.profileType === "pmr_lvv") {
    const doc = await diseaseProfileApi.get(patientId, "pmr_lvv").catch(() => null);
    const current = doc?.data || {};
    await diseaseProfileApi.upsert(patientId, "pmr_lvv", { ...current, ...profileValues });
  }
}

// ─── Spirometry / PFT value extractor ────────────────────────────────────────
// Parses FVC %, FEV1 %, FEV1/FVC, DLCO %, DLCOc %, TLC % from free text.

function extractPftValues(text) {
  if (!text?.trim()) return {};
  const result = {};

  // Helper: match number (integer or decimal, comma or dot)
  const NUM = "(\\d+(?:[.,]\\d+)?)";

  // FEV1/FVC ratio — must come before FEV1 and FVC individually
  const fev1FvcM = new RegExp(`FEV\\s*1\\s*[/\\\\]\\s*FVC\\s*[:=]?\\s*${NUM}`, "i").exec(text);
  if (fev1FvcM) {
    let val = parseFloat(fev1FvcM[1].replace(",", "."));
    if (val > 1.5) val = val / 100; // e.g. "78" → 0.78
    result.fev1_fvc = val;
  }

  // DLCOc / DLCO corretto (before plain DLCO to avoid prefix match)
  const dlcocM = new RegExp(`DLCO[ck](?:\\s*corr(?:etto|ected)?)?\\s*[:=]?\\s*${NUM}\\s*%?`, "i").exec(text);
  if (dlcocM) result.dlco_c = parseFloat(dlcocM[1].replace(",", "."));

  // DLCO plain (not followed by c/k)
  const dlcoM = new RegExp(`DLCO(?![ck])\\s*[:=]?\\s*${NUM}\\s*%?`, "i").exec(text);
  if (dlcoM) result.dlco_percent = parseFloat(dlcoM[1].replace(",", "."));

  // FVC
  const fvcM = new RegExp(`FVC\\s*[:=]?\\s*${NUM}\\s*%?`, "i").exec(text);
  if (fvcM) result.fvc_percent = parseFloat(fvcM[1].replace(",", "."));

  // FEV1 (not followed by /)
  const fev1M = new RegExp(`FEV\\s*1(?!\\s*[/\\\\])\\s*[:=]?\\s*${NUM}\\s*%?`, "i").exec(text);
  if (fev1M) result.fev1_percent = parseFloat(fev1M[1].replace(",", "."));

  // TLC
  const tlcM = new RegExp(`TLC\\s*[:=]?\\s*${NUM}\\s*%?`, "i").exec(text);
  if (tlcM) result.tlc_percent = parseFloat(tlcM[1].replace(",", "."));

  return result;
}

// ─── Exam auto-detection from source text ─────────────────────────────────────

function detectExamTypeFromText(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/fvc|fev[\s]*1|dlco|spirome|pfr\b|pft\b|tlc\s*[:=]/.test(t)) return "pft";
  if (/capillar|nvc\b|megacap/.test(t))                              return "capillaroscopy";
  if (/hrct|tc\s+torace|ground.glass|reticolare|fibrosi\s+polm/.test(t)) return "hrct";
  if (/psap|paps|tapse|lvef|fe\s*vs|ecocardio/.test(t))             return "echo_cardiac";
  return null;
}

function extractDateFromSourceText(text) {
  if (!text) return null;
  const m = text.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const year = y.length === 2 ? `20${y}` : y;
  const iso = `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return null;
  return iso;
}

// ─── Build one-liner summary ───────────────────────────────────────────────────

function buildSummary({ examKey, territories, findingType, result, measurement, structuredValues }) {
  const examMeta   = EXAM_TYPES.find(e => e.key === examKey);
  const resultMeta = RESULTS.find(r => r.key === result);
  const parts      = [examMeta?.label || examKey];
  if (resultMeta?.label)   parts.push(resultMeta.label);
  if (territories?.trim()) parts.push(territories.trim());
  if (findingType?.trim())  parts.push(findingType.trim());
  if (measurement?.trim())  parts.push(measurement.trim());

  // Append non-empty structured values as a compact string
  if (structuredValues) {
    const def = EXAM_STRUCTURED_FIELDS[examKey];
    if (def) {
      const vals = def.fields
        .filter(f => {
          const v = structuredValues[f.key];
          return v !== null && v !== undefined && v !== "";
        })
        .map(f => {
          const v = structuredValues[f.key];
          if (f.type === "select") {
            const opt = (f.options || []).find(o => o.value === v);
            return `${f.label} ${opt?.label || v}`;
          }
          return `${f.label} ${v}${f.unit ? " " + f.unit : ""}`;
        });
      if (vals.length) parts.push(vals.join(", "));
    }
  }

  return parts.join(" · ");
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function FieldLabel({ children, required }) {
  return (
    <div style={{
      fontSize: "10px", fontWeight: 700, color: "#6b7280",
      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px",
    }}>
      {children}
      {required && <span style={{ color: "#ef4444", marginLeft: "3px" }}>*</span>}
    </div>
  );
}

function ResultPills({ value, onChange, mode }) {
  if (mode === "hidden") return null;
  return (
    <div>
      <FieldLabel required={mode === "required"}>
        Esito{mode === "optional" && <span style={{ fontWeight: 400, textTransform: "none", fontSize: "9px", color: "#9ca3af", marginLeft: "6px" }}>(opzionale)</span>}
      </FieldLabel>
      <div style={{ display: "flex", gap: "6px" }}>
        {RESULTS.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => onChange(value === r.key ? null : r.key)}
            style={{
              padding: "5px 14px", borderRadius: "999px",
              border: `1.5px solid ${value === r.key ? r.color : "#d1d5db"}`,
              background: value === r.key ? r.bg : "#fff",
              color: value === r.key ? r.color : "#6b7280",
              fontSize: "11px", fontWeight: value === r.key ? 700 : 400,
              cursor: "pointer", transition: "all 0.12s",
              boxShadow: value === r.key ? `0 0 0 2px ${r.color}33` : "none",
            }}
          >
            {r.label}
          </button>
        ))}
        {value && mode === "optional" && (
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{
              padding: "5px 10px", borderRadius: "999px",
              border: "1.5px solid #e5e7eb",
              background: "#f9fafb", color: "#9ca3af",
              fontSize: "10px", cursor: "pointer",
            }}
          >
            ✕ Rimuovi
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Exam-specific structured value grid ─────────────────────────────────────

function StructuredValuesSection({ examType, values, onChange }) {
  const def = EXAM_STRUCTURED_FIELDS[examType];
  if (!def) return null;

  return (
    <div style={{
      border: `1.5px solid ${def.color}44`,
      borderRadius: "8px",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "7px 12px",
        background: def.bg,
        fontSize: "10px", fontWeight: 700, color: def.color,
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        {def.label}
      </div>
      <div style={{
        padding: "10px 12px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: "8px",
        background: "#fff",
      }}>
        {def.fields.map(field => (
          <div key={field.key}>
            <div style={{
              fontSize: "9px", fontWeight: 700, color: "#6b7280",
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px",
            }}>
              {field.label}
              {field.unit && (
                <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: "3px" }}>
                  {field.unit}
                </span>
              )}
            </div>
            {field.type === "number" && (
              <Input
                type="number"
                value={values[field.key] ?? ""}
                onChange={e => onChange(field.key, e.target.value === "" ? null : e.target.value)}
                placeholder={field.placeholder || ""}
                style={{ fontSize: "13px", height: "32px" }}
              />
            )}
            {field.type === "select" && (
              <select
                value={values[field.key] || ""}
                onChange={e => onChange(field.key, e.target.value || null)}
                style={{
                  width: "100%", fontSize: "12px",
                  border: "1px solid #d1d5db", borderRadius: "6px",
                  padding: "4px 6px", background: "#fff", color: "#374151",
                  height: "32px",
                }}
              >
                <option value="">—</option>
                {field.options.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Exam type grouped selector ───────────────────────────────────────────────

function ExamTypeSelector({ value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {EXAM_GROUPS.map(group => (
        <div key={group.id}>
          <div style={{
            fontSize: "9px", fontWeight: 700, color: "#9ca3af",
            textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "5px",
          }}>
            {group.label}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {EXAM_TYPES.filter(e => e.group === group.id).map(opt => {
              const selected = opt.key === value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onChange(opt.key)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    padding: "5px 11px",
                    borderRadius: "999px",
                    border: `1.5px solid ${selected ? opt.color : "#d1d5db"}`,
                    background: selected ? opt.bg : "#fff",
                    color: selected ? opt.color : "#6b7280",
                    fontSize: "11px", fontWeight: selected ? 700 : 400,
                    cursor: "pointer", transition: "all 0.12s",
                    boxShadow: selected ? `0 0 0 2px ${opt.color}33` : "none",
                  }}
                >
                  {Icon && <Icon size={11} />}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Profile mapping inline form ───────────────────────────────────────────────

function ProfileMappingSection({ mapping, values, onChange, visitDate }) {
  if (!mapping || !mapping.fields.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {mapping.fields.map(field => (
        <div key={field.key}>
          <FieldLabel>{field.label}</FieldLabel>
          {field.type === "number" && (
            <Input
              type="number"
              value={values[field.key] ?? ""}
              onChange={e => onChange(field.key, e.target.value === "" ? null : Number(e.target.value))}
              placeholder={field.placeholder || ""}
              style={{ fontSize: "13px" }}
            />
          )}
          {field.type === "select" && (
            <select
              value={values[field.key] || ""}
              onChange={e => onChange(field.key, e.target.value || null)}
              style={{
                width: "100%", fontSize: "13px",
                border: "1px solid #d1d5db", borderRadius: "6px",
                padding: "6px 10px", background: "#fff", color: "#374151",
              }}
            >
              <option value="">— seleziona —</option>
              {field.options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {field.type === "date" && (
            <input
              type="date"
              value={values[field.key] || visitDate || ""}
              onChange={e => onChange(field.key, e.target.value || null)}
              style={{
                fontSize: "13px", border: "1px solid #d1d5db",
                borderRadius: "6px", padding: "6px 10px",
                background: "#fff", color: "#374151",
              }}
            />
          )}
          {field.type === "boolean" && (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!!values[field.key]}
                onChange={e => onChange(field.key, e.target.checked)}
                style={{ width: "15px", height: "15px", cursor: "pointer" }}
              />
              <span style={{ fontSize: "12px", color: "#374151" }}>Sì — aggiorna nel profilo di malattia</span>
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function InstrumentalFindingModal({
  open, onClose, sourceText, patientId, patient, visitDate, onSaved,
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [editedSourceText, setEditedSourceText] = useState(sourceText || "");
  const [examType,         setExamType]         = useState("ecodoppler");
  const [date,             setDate]             = useState(visitDate || today);
  const [territories,      setTerritories]      = useState("");
  const [findingType,      setFindingType]       = useState("");
  const [result,           setResult]           = useState(null);
  const [measurement,      setMeasurement]      = useState("");
  const [comment,          setComment]          = useState("");
  const [structuredValues, setStructuredValues] = useState({});
  const [saving,           setSaving]           = useState(false);

  // Profile mapping
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [profileValues, setProfileValues] = useState({});

  const selectedExam = EXAM_TYPES.find(e => e.key === examType);
  const resultMode   = selectedExam?.resultMode || "optional";
  const mapping      = getProfileMapping(examType, patient);

  // ── Reset on open — auto-detect exam type and extract PFT values ────────────
  useEffect(() => {
    if (open) {
      const text     = sourceText || "";
      const autoType = detectExamTypeFromText(text);
      const startType = autoType || "ecodoppler";
      setEditedSourceText(text);
      setExamType(startType);
      setDate(extractDateFromSourceText(text) || visitDate || today);
      setTerritories("");
      setFindingType("");
      setResult(null);
      setMeasurement("");
      setComment("");
      setStructuredValues(startType === "pft" ? extractPftValues(text) : {});
      setSaveToProfile(true);
      setProfileValues({});
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-seed structured values + profile defaults when exam type changes ──────
  useEffect(() => {
    // Auto-extract spirometry values when user switches to pft
    if (examType === "pft" && editedSourceText) {
      setStructuredValues(extractPftValues(editedSourceText));
    } else {
      setStructuredValues({});
    }
    const m = getProfileMapping(examType, patient);
    if (!m) { setProfileValues({}); return; }
    const defaults = {};
    for (const field of m.fields) {
      if (field.type === "boolean") defaults[field.key] = false;
      if (field.type === "date")    defaults[field.key] = date || visitDate || today;
    }
    setProfileValues(defaults);
  }, [examType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-seed boolean defaults when result changes ────────────────────────────
  useEffect(() => {
    const m = getProfileMapping(examType, patient);
    if (!m) return;
    setProfileValues(prev => {
      const updated = { ...prev };
      for (const field of m.fields) {
        if (field.type === "boolean") updated[field.key] = result === "positive";
      }
      return updated;
    });
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-propagate structured field values → profile mapping ───────────────
  useEffect(() => {
    const syncMap = STRUCTURED_TO_PROFILE_MAP[examType];
    if (!syncMap) return;
    const profileUpdates = {};
    for (const [sKey, pKey] of Object.entries(syncMap)) {
      const val = structuredValues[sKey];
      if (val !== undefined && val !== null && val !== "") {
        profileUpdates[pKey] = Number(val) || val;
      }
    }
    // Also handle select fields (capillaroscopy pattern)
    if (examType === "capillaroscopy" && structuredValues.pattern) {
      profileUpdates.capillo_pattern = structuredValues.pattern;
    }
    if (Object.keys(profileUpdates).length) {
      setProfileValues(prev => ({ ...prev, ...profileUpdates }));
    }
  }, [structuredValues]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStructuredChange(key, val) {
    setStructuredValues(prev => ({ ...prev, [key]: val }));
  }

  function handleProfileChange(key, val) {
    setProfileValues(prev => ({ ...prev, [key]: val }));
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!patientId) { toast.error("ID paziente mancante"); return; }

    const examMeta  = EXAM_TYPES.find(e => e.key === examType);
    const indexType = examMeta?.nativeType || "imaging_report";
    const summary   = buildSummary({ examKey: examType, territories, findingType, result, measurement, structuredValues });

    setSaving(true);
    try {
      const payload = {
        patient_id:        patientId,
        exam_date:         date,
        exam_type:         examType,
        territory:         territories.trim() || null,
        result:            result || null,
        summary,
        source_text:       editedSourceText.trim() || null,
        structured_values: Object.keys(structuredValues).length ? structuredValues : null,
      };
      const saved = await instrumentalExamsApi.create(payload);

      // Optionally write to disease profile — wrapped separately so a profile
      // write failure does NOT roll back the already-created assessment record.
      let profileUpdated = false;
      if (saveToProfile && mapping) {
        const nonEmpty = Object.values(profileValues).some(v =>
          v !== null && v !== undefined && v !== "" && v !== false
        );
        if (nonEmpty) {
          try {
            await writeToProfile(mapping, profileValues, patientId);
            profileUpdated = true;
          } catch {
            toast.warning("Reperto salvato, ma aggiornamento profilo malattia non riuscito. Riprova dalla scheda malattia.");
          }
        }
      }

      toast.success(
        "Reperto strutturato salvato" +
        (profileUpdated ? " + profilo malattia aggiornato" : "")
      );
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  }

  // canSave: result required only when resultMode === "required"
  const canSave = !!examType && (resultMode !== "required" || !!result);
  const hasStructuredValues = Object.values(structuredValues).some(v => v !== null && v !== undefined && v !== "");
  const showSummaryPreview  = territories || findingType || hasStructuredValues;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        style={{ maxWidth: "620px", maxHeight: "92vh", overflowY: "auto" }}
        aria-describedby="instr-finding-desc"
      >
        <DialogHeader>
          <DialogTitle style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px" }}>
            {selectedExam?.icon && React.createElement(selectedExam.icon, { size: 16, color: selectedExam.color })}
            Struttura reperto strumentale
          </DialogTitle>
          <p id="instr-finding-desc" style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
            Incolla il referto, seleziona il tipo di esame e aggiungi i dati strutturati opzionali.
          </p>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingTop: "4px" }}>

          {/* ── Source text — primary editable field ─────────────────────── */}
          <div style={{
            background: "#f8faff",
            border: "1.5px solid #bfdbfe",
            borderRadius: "10px",
            padding: "12px 14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <FieldLabel required style={{ fontSize: "12px", color: "#1d4ed8", fontWeight: 700, margin: 0 }}>
                Testo del referto
              </FieldLabel>
              <OcrScanButton
                label="Da immagine"
                onText={(text) => {
                  setEditedSourceText(text);
                  const autoType = detectExamTypeFromText(text);
                  if (autoType) setExamType(autoType);
                }}
              />
            </div>
            <Textarea
              value={editedSourceText}
              onChange={e => setEditedSourceText(e.target.value)}
              placeholder="Incolla qui il testo del referto (es. dal Fascicolo Sanitario Elettronico)…"
              style={{
                fontSize: "12px",
                fontFamily: "ui-monospace, monospace",
                minHeight: "130px",
                resize: "vertical",
                lineHeight: "1.65",
                background: "transparent",
                border: "none",
                padding: 0,
                boxShadow: "none",
              }}
            />
          </div>

          {/* ── Exam type ────────────────────────────────────────────────── */}
          <div>
            <FieldLabel required>Tipo di esame</FieldLabel>
            <ExamTypeSelector value={examType} onChange={setExamType} />
          </div>

          {/* ── Date ─────────────────────────────────────────────────────── */}
          <div>
            <FieldLabel>Data esame</FieldLabel>
            <ItalianDatePicker value={date} onChange={setDate} />
          </div>

          {/* ── Exam-specific structured fields (PFT / echo / capillaroscopy) ── */}
          {EXAM_STRUCTURED_FIELDS[examType] && (
            <StructuredValuesSection
              examType={examType}
              values={structuredValues}
              onChange={handleStructuredChange}
            />
          )}

          {/* ── Result (conditional on resultMode) ───────────────────────── */}
          {resultMode !== "hidden" && (
            <ResultPills value={result} onChange={setResult} mode={resultMode} />
          )}

          {/* ── Territory — only for exam types that need it ──────────────── */}
          {SHOW_TERRITORY.has(examType) && (
            <div>
              <FieldLabel>Distretto anatomico / territorio</FieldLabel>
              <Input
                value={territories}
                onChange={e => setTerritories(e.target.value)}
                placeholder="es. Aorta toracica, succlavia bilat., temporali, parenchima polmonare…"
                style={{ fontSize: "13px" }}
              />
            </div>
          )}

          {/* ── Finding type — only for "Altro strumentale" ───────────────── */}
          {SHOW_FINDING_TYPE.has(examType) && (
            <div>
              <FieldLabel>Tipo di reperto (libero)</FieldLabel>
              <Input
                value={findingType}
                onChange={e => setFindingType(e.target.value)}
                placeholder="es. Segno del halo, uptake vascolare, NSIP, borsite sottoacromiale…"
                style={{ fontSize: "13px" }}
              />
            </div>
          )}

          {/* ── Comment ──────────────────────────────────────────────────── */}
          <div>
            <FieldLabel>Commento strutturato (opzionale)</FieldLabel>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Correlazione clinica, confronto con precedenti, proposta diagnostica…"
              style={{ fontSize: "12px", minHeight: "56px", resize: "vertical" }}
            />
          </div>

          {/* ── Summary preview ───────────────────────────────────────────── */}
          {showSummaryPreview && (
            <div style={{
              background: selectedExam?.bg || "#f9fafb",
              border: `1px solid ${selectedExam?.color || "#e5e7eb"}33`,
              borderRadius: "6px", padding: "8px 10px",
            }}>
              <div style={{
                fontSize: "10px", fontWeight: 700,
                color: selectedExam?.color || "#6b7280",
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px",
              }}>
                Anteprima sintesi
              </div>
              <div style={{ fontSize: "12px", color: "#374151", fontStyle: "italic" }}>
                {buildSummary({ examKey: examType, territories, findingType, result, measurement, structuredValues })}
              </div>
            </div>
          )}

          {/* ── Disease profile mapping ───────────────────────────────────── */}
          {mapping && (
            <div style={{ border: "1.5px solid #dbeafe", borderRadius: "8px", overflow: "hidden" }}>
              {/* Header / toggle */}
              <label style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 14px",
                background: saveToProfile ? "#eff6ff" : "#f9fafb",
                cursor: "pointer",
              }}>
                <input
                  type="checkbox"
                  checked={saveToProfile}
                  onChange={e => setSaveToProfile(e.target.checked)}
                  style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#1d4ed8" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#1d4ed8" }}>
                    Salva anche nel profilo malattia
                  </div>
                  <div style={{
                    fontSize: "10px", color: "#6b7280",
                    display: "flex", alignItems: "center", gap: "4px", marginTop: "1px",
                  }}>
                    <span>{mapping.diseaseLabel}</span>
                    <ArrowRight size={9} />
                    <span>{mapping.sectionLabel}</span>
                  </div>
                </div>
                <div style={{
                  fontSize: "9px", fontWeight: 700, padding: "2px 8px",
                  borderRadius: "999px",
                  background: saveToProfile ? "#dbeafe" : "#f3f4f6",
                  color: saveToProfile ? "#1d4ed8" : "#9ca3af",
                }}>
                  {saveToProfile ? "Attivo" : "Disattivato"}
                </div>
              </label>

              {/* Inline fields */}
              {saveToProfile && (
                <div style={{ padding: "12px 14px", background: "#fff", borderTop: "1px solid #dbeafe" }}>
                  <div style={{ fontSize: "10px", color: "#4b5563", marginBottom: "10px" }}>
                    {hasStructuredValues
                      ? "I valori misurati sono stati pre-compilati dal reperto. Conferma o modifica prima di salvare."
                      : "Conferma o modifica i valori da scrivere nel profilo paziente. Nulla viene salvato automaticamente — solo quando clicchi \"Salva reperto\"."
                    }
                  </div>
                  <ProfileMappingSection
                    mapping={mapping}
                    values={profileValues}
                    onChange={handleProfileChange}
                    visitDate={date || visitDate}
                  />
                </div>
              )}
            </div>
          )}

        </div>

        <DialogFooter style={{ gap: "8px", marginTop: "8px" }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !canSave}
            style={{
              background: selectedExam?.color || "#0f766e",
              color: "#fff", minWidth: "140px",
            }}
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin mr-1" /> Salvataggio…</>
              : <><CheckCircle2 size={14} style={{ marginRight: "6px" }} /> Salva reperto</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
