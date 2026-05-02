// Clinical formulas for rheumatology indices
// All comments in Italian

// ============ DAS28-ESR ============
export function calcDAS28_ESR({ tjc, sjc, esr, gh }) {
  const t = Number(tjc) || 0;
  const s = Number(sjc) || 0;
  const e = Math.max(Number(esr) || 1, 1);
  const g = Number(gh) || 0;
  const score = 0.56 * Math.sqrt(t) + 0.28 * Math.sqrt(s) + 0.70 * Math.log(e) + 0.014 * g;
  return round2(score);
}
export function interpretDAS28(score) {
  if (score == null || isNaN(score)) return "-";
  if (score < 2.6) return "Remissione";
  if (score <= 3.2) return "Bassa attività";
  if (score <= 5.1) return "Moderata attività";
  return "Alta attività";
}

// ============ DAS28-CRP ============
export function calcDAS28_CRP({ tjc, sjc, crp, gh }) {
  const t = Number(tjc) || 0;
  const s = Number(sjc) || 0;
  const c = Number(crp) || 0;
  const g = Number(gh) || 0;
  const score = 0.56 * Math.sqrt(t) + 0.28 * Math.sqrt(s) + 0.36 * Math.log(c + 1) + 0.014 * g + 0.96;
  return round2(score);
}

// ============ CDAI ============
export function calcCDAI({ tjc28, sjc28, pga, ega }) {
  const score = (Number(tjc28) || 0) + (Number(sjc28) || 0) + (Number(pga) || 0) + (Number(ega) || 0);
  return round2(score);
}
export function interpretCDAI(score) {
  if (score == null) return "-";
  if (score <= 2.8) return "Remissione";
  if (score <= 10) return "Bassa attività";
  if (score <= 22) return "Moderata attività";
  return "Alta attività";
}

// ============ SDAI ============
export function calcSDAI({ tjc28, sjc28, pga, ega, crp }) {
  const score = (Number(tjc28) || 0) + (Number(sjc28) || 0) + (Number(pga) || 0) + (Number(ega) || 0) + (Number(crp) || 0);
  return round2(score);
}
export function interpretSDAI(score) {
  if (score == null) return "-";
  if (score <= 3.3) return "Remissione";
  if (score <= 11) return "Bassa attività";
  if (score <= 26) return "Moderata attività";
  return "Alta attività";
}

// ============ BASDAI ============
// 6 domande, scala 0-10. Score = (Q1+Q2+Q3+Q4 + (Q5+Q6)/2) / 5
export function calcBASDAI({ q1, q2, q3, q4, q5, q6 }) {
  const score = ((Number(q1) || 0) + (Number(q2) || 0) + (Number(q3) || 0) + (Number(q4) || 0) + ((Number(q5) || 0) + (Number(q6) || 0)) / 2) / 5;
  return round2(score);
}
export function interpretBASDAI(score) {
  if (score == null) return "-";
  return score >= 4 ? "Malattia attiva" : "Malattia non attiva";
}

// ============ ASDAS-CRP ============
export function calcASDAS_CRP({ backPain, morningStiffness, pga, peripheralPain, crp }) {
  const bp = Number(backPain) || 0;
  const ms = Number(morningStiffness) || 0;
  const g = Number(pga) || 0;
  const pp = Number(peripheralPain) || 0;
  const c = Math.max(Number(crp) || 0, 0);
  const score = 0.12 * bp + 0.06 * ms + 0.11 * g + 0.07 * pp + 0.58 * Math.log(c + 1);
  return round2(score);
}
export function interpretASDAS(score) {
  if (score == null) return "-";
  if (score < 1.3) return "Inattiva";
  if (score < 2.1) return "Bassa attività";
  if (score <= 3.5) return "Alta attività";
  return "Molto alta attività";
}

// ============ DAPSA ============
export function calcDAPSA({ tjc68, sjc66, pga, patientPain, crp }) {
  const score = (Number(tjc68) || 0) + (Number(sjc66) || 0) + (Number(pga) || 0) + (Number(patientPain) || 0) + (Number(crp) || 0);
  return round2(score);
}
export function interpretDAPSA(score) {
  if (score == null) return "-";
  if (score <= 4) return "Remissione";
  if (score <= 14) return "Bassa attività";
  if (score <= 28) return "Moderata attività";
  return "Alta attività";
}

// ============ SLEDAI-2K ============
export const SLEDAI_ITEMS = [
  { key: "seizure", label: "Crisi epilettiche", weight: 8 },
  { key: "psychosis", label: "Psicosi", weight: 8 },
  { key: "organic_brain", label: "Sindrome cerebrale organica", weight: 8 },
  { key: "visual", label: "Disturbi visivi", weight: 8 },
  { key: "cranial_nerve", label: "Disturbi nervi cranici", weight: 8 },
  { key: "lupus_headache", label: "Cefalea lupica", weight: 8 },
  { key: "cva", label: "Ictus (CVA)", weight: 8 },
  { key: "vasculitis", label: "Vasculite", weight: 8 },
  { key: "arthritis", label: "Artrite (>2 articolazioni)", weight: 4 },
  { key: "myositis", label: "Miosite", weight: 4 },
  { key: "urinary_casts", label: "Cilindri urinari", weight: 4 },
  { key: "hematuria", label: "Ematuria", weight: 4 },
  { key: "proteinuria", label: "Proteinuria (>0.5 g/24h)", weight: 4 },
  { key: "pyuria", label: "Piuria", weight: 4 },
  { key: "rash", label: "Rash cutaneo", weight: 2 },
  { key: "alopecia", label: "Alopecia", weight: 2 },
  { key: "mucosal_ulcers", label: "Ulcere mucose", weight: 2 },
  { key: "pleurisy", label: "Pleurite", weight: 2 },
  { key: "pericarditis", label: "Pericardite", weight: 2 },
  { key: "low_complement", label: "Complemento basso", weight: 2 },
  { key: "increased_dna", label: "Anti-dsDNA aumentati", weight: 2 },
  { key: "fever", label: "Febbre (>38°C)", weight: 1 },
  { key: "thrombocytopenia", label: "Piastrinopenia (<100.000)", weight: 1 },
  { key: "leukopenia", label: "Leucopenia (<3.000)", weight: 1 },
];
export function calcSLEDAI(items) {
  return SLEDAI_ITEMS.reduce((sum, it) => sum + (items[it.key] ? it.weight : 0), 0);
}
export function interpretSLEDAI(score) {
  if (score == null) return "-";
  if (score === 0) return "Nessuna attività";
  if (score <= 5) return "Attività lieve";
  if (score <= 10) return "Attività moderata";
  if (score <= 19) return "Attività alta";
  return "Attività molto alta";
}

// ============ HAQ ============
export const HAQ_CATEGORIES = [
  { key: "vestirsi", label: "Vestirsi e curare la propria persona" },
  { key: "alzarsi", label: "Alzarsi" },
  { key: "mangiare", label: "Mangiare" },
  { key: "camminare", label: "Camminare" },
  { key: "igiene", label: "Igiene personale" },
  { key: "raggiungere", label: "Raggiungere oggetti" },
  { key: "prendere", label: "Prendere oggetti" },
  { key: "attivita", label: "Attività" },
];
// Ogni categoria: valore 0-3 (max della categoria)
export function calcHAQ(categories) {
  const values = HAQ_CATEGORIES.map((c) => Number(categories[c.key]) || 0);
  const sum = values.reduce((a, b) => a + b, 0);
  return round2(sum / HAQ_CATEGORIES.length);
}
export function interpretHAQ(score) {
  if (score == null) return "-";
  if (score < 0.5) return "Nessuna/lieve disabilità";
  if (score < 1.5) return "Disabilità lieve-moderata";
  if (score < 2.5) return "Disabilità moderata-grave";
  return "Disabilità grave";
}

// ============ PASI ============
// Regions: head (0.1), upper limbs (0.2), trunk (0.3), lower limbs (0.4)
// Per region: (E + I + D) * A * weight
// E, I, D: 0-4; A (area score): 0-6
export const PASI_REGIONS = [
  { key: "head", label: "Capo", weight: 0.1 },
  { key: "upper", label: "Arti superiori", weight: 0.2 },
  { key: "trunk", label: "Tronco", weight: 0.3 },
  { key: "lower", label: "Arti inferiori", weight: 0.4 },
];
export function calcPASI(data) {
  let total = 0;
  PASI_REGIONS.forEach((r) => {
    const e = Number(data?.[r.key]?.E) || 0;
    const i = Number(data?.[r.key]?.I) || 0;
    const d = Number(data?.[r.key]?.D) || 0;
    const a = Number(data?.[r.key]?.A) || 0;
    total += (e + i + d) * a * r.weight;
  });
  return round2(total);
}
export function interpretPASI(score) {
  if (score == null) return "-";
  if (score < 5) return "Lieve";
  if (score < 10) return "Moderata";
  return "Severa";
}

// ============ Joint definitions ============
// DAS28: 28 articolazioni
export const JOINTS_DAS28 = [
  "shoulder_l", "shoulder_r",
  "elbow_l", "elbow_r",
  "wrist_l", "wrist_r",
  "mcp1_l", "mcp2_l", "mcp3_l", "mcp4_l", "mcp5_l",
  "mcp1_r", "mcp2_r", "mcp3_r", "mcp4_r", "mcp5_r",
  "pip1_l", "pip2_l", "pip3_l", "pip4_l", "pip5_l",
  "pip1_r", "pip2_r", "pip3_r", "pip4_r", "pip5_r",
  "knee_l", "knee_r",
];

// 66/68 count adds: hip (only tender for 68), ankle, MTP, subtalar, tarsotarsal, TMJ, SC, AC
export const JOINTS_66_68 = [
  ...JOINTS_DAS28,
  "tmj_l", "tmj_r",
  "sc_l", "sc_r",
  "ac_l", "ac_r",
  "hip_l", "hip_r", // only for 68 TJC (not in 66 SJC)
  "ankle_l", "ankle_r",
  "subtalar_l", "subtalar_r",
  "midtarsal_l", "midtarsal_r",
  "mtp1_l", "mtp2_l", "mtp3_l", "mtp4_l", "mtp5_l",
  "mtp1_r", "mtp2_r", "mtp3_r", "mtp4_r", "mtp5_r",
  "dip2_l", "dip3_l", "dip4_l", "dip5_l",
  "dip2_r", "dip3_r", "dip4_r", "dip5_r",
];

export function round2(n) {
  if (n == null || isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

export const INDEX_LABELS = {
  das28_esr: "DAS28-ESR",
  das28_crp: "DAS28-CRP",
  cdai: "CDAI",
  sdai: "SDAI",
  basdai: "BASDAI",
  asdas_crp: "ASDAS-CRP",
  dapsa: "DAPSA",
  sledai: "SLEDAI-2K",
  haq: "HAQ",
  pasi: "PASI",
};

export const INDEX_DISEASES = {
  das28_esr: "Artrite Reumatoide",
  das28_crp: "Artrite Reumatoide",
  cdai: "Artrite Reumatoide",
  sdai: "Artrite Reumatoide",
  basdai: "Spondiloartrite",
  asdas_crp: "Spondiloartrite",
  dapsa: "Artrite Psoriasica",
  sledai: "LES",
  haq: "Qualità di vita",
  pasi: "Psoriasi",
};
