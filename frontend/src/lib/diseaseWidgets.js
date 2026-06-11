// Central registry: maps each rheumatic disease to its clinical workflow.
// Every patient visit adapts to this config — symptom chips, inline clinimetry,
// primary activity index shown in the sticky header, and report template.

import {
  isRaDiagnosis,
  isSpaDiagnosis,
  isSleDiagnosis,
  isAavDiagnosis,
  isIgaVDiagnosis,
  isCryoVasDiagnosis,
  isUrticarialVasDiagnosis,
  isBehcetDiagnosis,
  isPanDiagnosis,
  isCsvvDiagnosis,
  isAosdDiagnosis,
  isApsDiagnosis,
  isGoutDiagnosis,
  isMctdDiagnosis,
  isIgg4RdDiagnosis,
  isRpcDiagnosis,
  isSjogrenDiagnosis,
  isMyositisDiagnosis,
} from "./diseaseDetection";
import { isScleroDiagnosis } from "../components/profiles/ScleroProfileSection";

// ─── Symptom library ──────────────────────────────────────────────────────────
// Every chip used by any disease workflow lives here.
const SYMPTOM_LIBRARY = {
  // Universal
  pain:              { label: "Dolore articolare",      emoji: "🔴", on: "bg-red-100 border-red-300 text-red-800" },
  stiffness:         { label: "Rigidità",               emoji: "🔵", on: "bg-blue-100 border-blue-300 text-blue-800" },
  swelling:          { label: "Gonfiore",               emoji: "🟡", on: "bg-yellow-100 border-yellow-300 text-yellow-800" },
  flare:             { label: "Riacutizzazione",        emoji: "🔥", on: "bg-orange-100 border-orange-300 text-orange-800" },
  fatigue:           { label: "Affaticamento",          emoji: "😴", on: "bg-indigo-100 border-indigo-300 text-indigo-800" },
  infections:        { label: "Infezioni",              emoji: "🦠", on: "bg-purple-100 border-purple-300 text-purple-800" },
  dyspnea:           { label: "Dispnea",                emoji: "💨", on: "bg-cyan-100 border-cyan-300 text-cyan-800" },
  rash:              { label: "Rash cutaneo",           emoji: "🌸", on: "bg-pink-100 border-pink-300 text-pink-800" },
  fever:             { label: "Febbre",                 emoji: "🌡️", on: "bg-red-100 border-red-300 text-red-800" },
  adverse_events:    { label: "Effetti avversi",        emoji: "⚠️", on: "bg-amber-100 border-amber-300 text-amber-800" },
  // SpA / PsA
  back_pain:         { label: "Lombalgia",              emoji: "🔺", on: "bg-orange-100 border-orange-300 text-orange-800" },
  morning_stiffness: { label: "Rigidità mattutina",     emoji: "🌅", on: "bg-blue-100 border-blue-300 text-blue-800" },
  enthesitis:        { label: "Entesiti",               emoji: "🦵", on: "bg-amber-100 border-amber-300 text-amber-800" },
  peripheral_joints: { label: "Artrite periferica",     emoji: "🦴", on: "bg-yellow-100 border-yellow-300 text-yellow-800" },
  uveitis:           { label: "Uveite",                 emoji: "👁️", on: "bg-indigo-100 border-indigo-300 text-indigo-800" },
  psoriasis:         { label: "Psoriasi",               emoji: "🌿", on: "bg-green-100 border-green-300 text-green-800" },
  dactylitis:        { label: "Dattilite",              emoji: "🖐️", on: "bg-pink-100 border-pink-300 text-pink-800" },
  // PMR / GCA
  shoulder_pain:     { label: "Dolore cingolo scapolare", emoji: "🔺", on: "bg-red-100 border-red-300 text-red-800" },
  hip_pain:          { label: "Dolore cingolo pelvico",   emoji: "🔻", on: "bg-orange-100 border-orange-300 text-orange-800" },
  headache:          { label: "Cefalea",                emoji: "🤕", on: "bg-rose-100 border-rose-300 text-rose-800" },
  jaw_claudication:  { label: "Claudicatio mascellare", emoji: "😖", on: "bg-rose-100 border-rose-300 text-rose-800" },
  visual_symptoms:   { label: "Sintomi visivi",         emoji: "👁️", on: "bg-indigo-100 border-indigo-300 text-indigo-800" },
  // SLE / vasculitis
  oral_ulcers:       { label: "Ulcere orali",           emoji: "👄", on: "bg-red-100 border-red-300 text-red-800" },
  alopecia:          { label: "Alopecia",               emoji: "💇", on: "bg-purple-100 border-purple-300 text-purple-800" },
  pleuritis:         { label: "Pleurite / Sierositi",   emoji: "🫁", on: "bg-blue-100 border-blue-300 text-blue-800" },
  renal_symptoms:    { label: "Sintomi renali",         emoji: "🫘", on: "bg-indigo-100 border-indigo-300 text-indigo-800" },
  // Sjögren
  xerostomia:        { label: "Secchezza orale",        emoji: "👅", on: "bg-amber-100 border-amber-300 text-amber-800" },
  xerophthalmia:     { label: "Secchezza oculare",      emoji: "👁️", on: "bg-blue-100 border-blue-300 text-blue-800" },
  // Scleroderma
  raynaud:           { label: "Fenomeno di Raynaud",    emoji: "🖐️", on: "bg-blue-100 border-blue-300 text-blue-800" },
  digital_ulcers:    { label: "Ulcere digitali",        emoji: "🩹", on: "bg-red-100 border-red-300 text-red-800" },
  // Myositis
  muscle_weakness:   { label: "Debolezza muscolare",   emoji: "💪", on: "bg-orange-100 border-orange-300 text-orange-800" },
  dysphagia:         { label: "Disfagia",               emoji: "🫁", on: "bg-amber-100 border-amber-300 text-amber-800" },
  // Fibromyalgia
  diffuse_pain:      { label: "Dolore diffuso",         emoji: "🔴", on: "bg-red-100 border-red-300 text-red-800" },
  sleep_disturbance: { label: "Disturbi del sonno",     emoji: "🛌", on: "bg-indigo-100 border-indigo-300 text-indigo-800" },
  cognitive_fog:     { label: "Nebbia cognitiva",       emoji: "🧠", on: "bg-violet-100 border-violet-300 text-violet-800" },
  // Osteoporosis
  fracture:          { label: "Frattura recente",       emoji: "🦴", on: "bg-red-100 border-red-300 text-red-800" },
  back_pain_osteo:   { label: "Dolore vertebrale",      emoji: "⬆️", on: "bg-amber-100 border-amber-300 text-amber-800" },
  // IgA Vasculitis
  purpura:           { label: "Porpora palpabile",      emoji: "🟣", on: "bg-purple-100 border-purple-300 text-purple-800" },
  abdominal_pain:    { label: "Dolore addominale",      emoji: "🫃", on: "bg-orange-100 border-orange-300 text-orange-800" },
  hematuria:         { label: "Ematuria",               emoji: "🔴", on: "bg-red-100 border-red-300 text-red-800" },
  // Crioglobulinemica
  livedo:            { label: "Livedo reticularis",     emoji: "🔵", on: "bg-blue-100 border-blue-300 text-blue-800" },
  neuropathy:        { label: "Neuropatia periferica",  emoji: "⚡", on: "bg-yellow-100 border-yellow-300 text-yellow-800" },
  // Orticarioide
  urticaria:         { label: "Orticaria vasculitica",  emoji: "🌸", on: "bg-pink-100 border-pink-300 text-pink-800" },
  // Behçet
  oral_ulcers_bd:    { label: "Ulcere orali ricorrenti", emoji: "👄", on: "bg-red-100 border-red-300 text-red-800" },
  genital_ulcers:    { label: "Ulcere genitali",        emoji: "⚠️", on: "bg-amber-100 border-amber-300 text-amber-800" },
  // APS
  thrombosis:        { label: "Evento trombotico",      emoji: "🩸", on: "bg-red-100 border-red-300 text-red-800" },
  // Gotta
  joint_swelling_acute: { label: "Artrite acuta",       emoji: "🔥", on: "bg-orange-100 border-orange-300 text-orange-800" },
};

// ─── Disease workflow definitions ─────────────────────────────────────────────
export const DISEASE_WORKFLOWS = {
  ra: {
    key: "ra",
    label: "Artrite Reumatoide",
    symptoms: ["pain", "stiffness", "swelling", "flare", "fatigue", "infections", "dyspnea", "rash", "adverse_events"],
    clinimetryType: "ra_das28",
    primaryIndexTypes: ["das28_crp", "das28_esr", "cdai", "sdai"],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "ra",
  },
  spa: {
    key: "spa",
    label: "Spondiloartrite / Artrite Psoriasica",
    symptoms: ["back_pain", "morning_stiffness", "enthesitis", "peripheral_joints", "uveitis", "psoriasis", "dactylitis", "fatigue", "adverse_events"],
    clinimetryType: "spa_asdas",
    primaryIndexTypes: ["asdas_crp", "basdai"],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "spa",
  },
  pmr: {
    key: "pmr",
    label: "PMR / GCA",
    symptoms: ["shoulder_pain", "hip_pain", "morning_stiffness", "headache", "jaw_claudication", "visual_symptoms", "fever", "fatigue"],
    clinimetryType: "pmr_quick",
    primaryIndexTypes: [],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "pmr",
  },
  sle: {
    key: "sle",
    label: "LES / Lupus Eritematoso Sistemico",
    symptoms: ["pain", "rash", "alopecia", "oral_ulcers", "pleuritis", "renal_symptoms", "fever", "fatigue", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: ["sledai"],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "sle",
  },
  vasculitis: {
    key: "vasculitis",
    label: "Vasculite (AAV)",
    symptoms: ["fever", "rash", "dyspnea", "renal_symptoms", "fatigue", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: ["bvas"],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "vasculitis",
  },
  myositis: {
    key: "myositis",
    label: "Miosite Infiammatoria",
    symptoms: ["muscle_weakness", "dysphagia", "dyspnea", "rash", "fatigue", "fever", "adverse_events"],
    clinimetryType: "myositis_quick",
    primaryIndexTypes: ["mmt8"],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "myositis",
  },
  sclero: {
    key: "sclero",
    label: "Sclerosi Sistemica",
    symptoms: ["raynaud", "digital_ulcers", "dyspnea", "dysphagia", "pain", "fatigue", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: ["mrss"],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "sclero",
  },
  sjogren: {
    key: "sjogren",
    label: "Sindrome di Sjögren",
    symptoms: ["xerostomia", "xerophthalmia", "fatigue", "pain", "rash", "fever", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: ["essdai", "esspri"],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "sjogren",
  },
  fibromyalgia: {
    key: "fibromyalgia",
    label: "Fibromialgia",
    symptoms: ["diffuse_pain", "fatigue", "sleep_disturbance", "cognitive_fog", "headache", "stiffness"],
    clinimetryType: "fibro_quick",
    primaryIndexTypes: ["fiqr"],
    labsToWatch: [],
    reportTemplate: "fibromyalgia",
  },
  osteoporosis: {
    key: "osteoporosis",
    label: "Osteoporosi",
    symptoms: ["fracture", "back_pain_osteo", "fatigue", "adverse_events"],
    clinimetryType: "osteo_quick",
    primaryIndexTypes: [],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "osteoporosis",
  },
  igav: {
    key: "igav",
    label: "Vasculite IgA (IgAV / HSP)",
    symptoms: ["purpura", "renal_symptoms", "hematuria", "abdominal_pain", "pain", "fever", "rash", "fatigue", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: ["bvas"],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "vasculitis",
  },
  cryo_vas: {
    key: "cryo_vas",
    label: "Vasculite Crioglobulinemica",
    symptoms: ["purpura", "livedo", "renal_symptoms", "neuropathy", "pain", "fatigue", "raynaud", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: ["bvas"],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "vasculitis",
  },
  urticarial_vas: {
    key: "urticarial_vas",
    label: "Vasculite Orticarioide (UV/HUV)",
    symptoms: ["urticaria", "renal_symptoms", "dyspnea", "pain", "fatigue", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: [],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "vasculitis",
  },
  behcet: {
    key: "behcet",
    label: "Malattia di Behçet",
    symptoms: ["oral_ulcers_bd", "genital_ulcers", "rash", "renal_symptoms", "fever", "pain", "dyspnea", "fatigue", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: ["bvas"],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "vasculitis",
  },
  pan: {
    key: "pan",
    label: "Poliarterite Nodosa (PAN)",
    symptoms: ["pain", "neuropathy", "renal_symptoms", "fatigue", "fever", "rash", "livedo", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: ["bvas"],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "vasculitis",
  },
  csvv: {
    key: "csvv",
    label: "Vasculite Cutanea dei Piccoli Vasi (CSVV)",
    symptoms: ["purpura", "rash", "renal_symptoms", "fatigue", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: [],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "vasculitis",
  },
  aosd: {
    key: "aosd",
    label: "Malattia di Still dell'adulto (AOSD)",
    symptoms: ["fever", "rash", "pain", "fatigue", "dyspnea", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: [],
    labsToWatch: ["crp", "ves", "ferritin"],
    reportTemplate: "generic",
  },
  aps: {
    key: "aps",
    label: "Sindrome da Antifosfolipidi (APS)",
    symptoms: ["thrombosis", "renal_symptoms", "dyspnea", "fatigue", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: [],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "generic",
  },
  gout: {
    key: "gout",
    label: "Gotta (Artrite Uratica)",
    symptoms: ["joint_swelling_acute", "pain", "swelling", "fatigue", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: [],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "generic",
  },
  mctd: {
    key: "mctd",
    label: "Connettivite Mista (MCTD / Sharp)",
    symptoms: ["raynaud", "dyspnea", "pain", "fatigue", "rash", "swelling", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: [],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "generic",
  },
  igg4rd: {
    key: "igg4rd",
    label: "Malattia Correlata a IgG4 (IgG4-RD)",
    symptoms: ["pain", "fatigue", "dyspnea", "renal_symptoms", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: [],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "generic",
  },
  rpc: {
    key: "rpc",
    label: "Policondrite Recidivante (RPC)",
    symptoms: ["pain", "dyspnea", "fatigue", "rash", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: [],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "generic",
  },
  generic: {
    key: "generic",
    label: "Reumatologia Generale",
    symptoms: ["pain", "stiffness", "swelling", "fatigue", "fever", "dyspnea", "rash", "adverse_events"],
    clinimetryType: null,
    primaryIndexTypes: [],
    labsToWatch: ["crp", "ves"],
    reportTemplate: "generic",
  },
};

// ─── Local helpers for diseases not in diseaseDetection.js ───────────────────
function isPmrGcaDiagnosis(d) {
  const s = (typeof d === "string" ? d : (d?.diagnosi || "") + " " + (d?.diagnosi_secondarie || []).join(" ")).toLowerCase();
  return (
    s.includes("polimialgia") ||
    s.includes("pmr") ||
    s.includes("giant cell") ||
    s.includes("gca") ||
    s.includes("arterite a cellule giganti") ||
    s.includes("arterite temporale") ||
    s.includes("arterite di horton")
  );
}

function isFibromyalgiaDiagnosis(d) {
  const s = (typeof d === "string" ? d : (d?.diagnosi || "")).toLowerCase();
  return s.includes("fibromi");
}

function isOsteoporosisDiagnosis(d) {
  const s = (typeof d === "string" ? d : (d?.diagnosi || "")).toLowerCase();
  return s.includes("osteoporo");
}

// ─── Main detector ────────────────────────────────────────────────────────────
export function detectDiseaseWorkflow(patient) {
  if (!patient) return DISEASE_WORKFLOWS.generic;
  if (isRaDiagnosis(patient))          return DISEASE_WORKFLOWS.ra;
  if (isSpaDiagnosis(patient))         return DISEASE_WORKFLOWS.spa;
  if (isPmrGcaDiagnosis(patient))      return DISEASE_WORKFLOWS.pmr;
  if (isSleDiagnosis(patient))         return DISEASE_WORKFLOWS.sle;
  if (isIgaVDiagnosis(patient))        return DISEASE_WORKFLOWS.igav;
  if (isCryoVasDiagnosis(patient))     return DISEASE_WORKFLOWS.cryo_vas;
  if (isUrticarialVasDiagnosis(patient)) return DISEASE_WORKFLOWS.urticarial_vas;
  if (isBehcetDiagnosis(patient))      return DISEASE_WORKFLOWS.behcet;
  if (isPanDiagnosis(patient))         return DISEASE_WORKFLOWS.pan;
  if (isCsvvDiagnosis(patient))        return DISEASE_WORKFLOWS.csvv;
  if (isAavDiagnosis(patient))         return DISEASE_WORKFLOWS.vasculitis;
  if (isMyositisDiagnosis(patient))    return DISEASE_WORKFLOWS.myositis;
  if (isScleroDiagnosis(patient?.diagnosi)) return DISEASE_WORKFLOWS.sclero;
  if (isSjogrenDiagnosis(patient))     return DISEASE_WORKFLOWS.sjogren;
  if (isAosdDiagnosis(patient))        return DISEASE_WORKFLOWS.aosd;
  if (isApsDiagnosis(patient))         return DISEASE_WORKFLOWS.aps;
  if (isGoutDiagnosis(patient))        return DISEASE_WORKFLOWS.gout;
  if (isMctdDiagnosis(patient))        return DISEASE_WORKFLOWS.mctd;
  if (isIgg4RdDiagnosis(patient))      return DISEASE_WORKFLOWS.igg4rd;
  if (isRpcDiagnosis(patient))         return DISEASE_WORKFLOWS.rpc;
  if (isFibromyalgiaDiagnosis(patient)) return DISEASE_WORKFLOWS.fibromyalgia;
  if (isOsteoporosisDiagnosis(patient)) return DISEASE_WORKFLOWS.osteoporosis;
  return DISEASE_WORKFLOWS.generic;
}

// Returns symptom chip definitions for a workflow (includes `key` field)
export function getSymptomDefs(workflow) {
  return (workflow.symptoms || [])
    .map(k => ({ key: k, ...SYMPTOM_LIBRARY[k] }))
    .filter(d => d.label);
}

// Returns the latest primary index assessment for a workflow
export function getLatestPrimaryIndex(workflow, assessments) {
  const types = workflow.primaryIndexTypes || [];
  if (!types.length) return null;
  const sorted = [...(assessments || [])]
    .filter(a => types.includes(a.index_type))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (!sorted.length) return null;
  const latest = sorted[0];
  const labelMap = {
    das28_crp: "DAS28-PCR", das28_esr: "DAS28-VES", cdai: "CDAI", sdai: "SDAI",
    asdas_crp: "ASDAS-CRP", basdai: "BASDAI", sledai: "SLEDAI", bvas: "BVAS",
    mmt8: "MMT-8", fiqr: "FIQR", essdai: "ESSDAI", esspri: "ESSPRI", mrss: "mRSS",
  };
  return {
    label: labelMap[latest.index_type] || latest.index_type.toUpperCase(),
    score: latest.score,
    interp: latest.interpretation,
    date: latest.date,
  };
}
