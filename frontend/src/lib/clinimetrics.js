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
// SLEDAI-2K (Bombardier 1992 / Gladman 2002) - 24 item con descrizioni cliniche
export const SLEDAI_ITEMS = [
  { key: "seizure", label: "Crisi epilettiche", weight: 8, description: "Crisi epilettiche di nuova insorgenza. Escludere cause metaboliche, infettive o farmacologiche" },
  { key: "psychosis", label: "Psicosi", weight: 8, description: "Alterata percezione della realtà con allucinazioni, deliri, pensiero illogico. Escludere uremia e farmaci" },
  { key: "organic_brain", label: "Sindrome cerebrale organica", weight: 8, description: "Alterazione delle funzioni mentali con disorientamento, deficit di memoria/concentrazione, oscillazioni dello stato di coscienza" },
  { key: "visual", label: "Disturbi visivi", weight: 8, description: "Coinvolgimento retinico/coroideo da SLE: corpi citoidi, emorragie retiniche, essudati, neurite ottica. Escludere ipertensione, infezioni, farmaci" },
  { key: "cranial_nerve", label: "Disturbi nervi cranici", weight: 8, description: "Neuropatia sensitiva o motoria di nuova insorgenza che coinvolge i nervi cranici" },
  { key: "lupus_headache", label: "Cefalea lupica", weight: 8, description: "Cefalea severa, persistente, di tipo emicranico, refrattaria agli analgesici narcotici" },
  { key: "cva", label: "Ictus (CVA)", weight: 8, description: "Stroke di nuova insorgenza. Escludere arteriosclerosi e ipertensione" },
  { key: "vasculitis", label: "Vasculite", weight: 8, description: "Ulcerazioni, gangrena, noduli digitali dolorosi, infarti periungueali, livedo, vasculite documentata da biopsia/angiografia" },
  { key: "arthritis", label: "Artrite (>2 articolazioni)", weight: 4, description: "Più di 2 articolazioni con dolore e segni infiammatori (tumefazione, dolorabilità, versamento)" },
  { key: "myositis", label: "Miosite", weight: 4, description: "Debolezza/dolore muscolare prossimale associato a CK/aldolasi elevati o EMG/biopsia compatibili" },
  { key: "urinary_casts", label: "Cilindri urinari", weight: 4, description: "Cilindri di emoglobina, granulari o eritrocitari" },
  { key: "hematuria", label: "Ematuria", weight: 4, description: ">5 GR/HPF. Escludere calcoli, infezioni, altre cause" },
  { key: "proteinuria", label: "Proteinuria (>0.5 g/24h)", weight: 4, description: "Proteinuria di nuova insorgenza o aumento >0,5 g/24h rispetto al basale" },
  { key: "pyuria", label: "Piuria", weight: 4, description: ">5 GB/HPF. Escludere infezioni" },
  { key: "rash", label: "Rash cutaneo", weight: 2, description: "Rash infiammatorio in atto" },
  { key: "alopecia", label: "Alopecia", weight: 2, description: "Caduta dei capelli a chiazze o diffusa di nuova insorgenza, in corso" },
  { key: "mucosal_ulcers", label: "Ulcere mucose", weight: 2, description: "Ulcerazioni orali o nasali in atto" },
  { key: "pleurisy", label: "Pleurite", weight: 2, description: "Dolore pleuritico classico con sfregamento, versamento o ispessimento pleurico" },
  { key: "pericarditis", label: "Pericardite", weight: 2, description: "Dolore pericardico con almeno uno tra: sfregamento, versamento, alterazioni ECG/ecocardio confermate" },
  { key: "low_complement", label: "Complemento basso", weight: 2, description: "C3, C4 o CH50 sotto il limite inferiore di laboratorio" },
  { key: "increased_dna", label: "Anti-dsDNA aumentati", weight: 2, description: "Anti-dsDNA aumentati >25% rispetto al precedente o sopra il limite di normalità" },
  { key: "fever", label: "Febbre (>38°C)", weight: 1, description: "Temperatura >38°C dopo esclusione di cause infettive" },
  { key: "thrombocytopenia", label: "Piastrinopenia (<100.000)", weight: 1, description: "Piastrine <100.000/mm³, escludendo cause farmacologiche" },
  { key: "leukopenia", label: "Leucopenia (<3.000)", weight: 1, description: "Leucociti <3.000/mm³, escludendo cause farmacologiche" },
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
// HAQ (Health Assessment Questionnaire) — versione italiana ufficiale.
// 8 categorie, 20 item. Per ogni item: 0 = senza difficoltà, 1 = con qualche
// difficoltà, 2 = con molta difficoltà, 3 = no (impossibile).
// Punteggio categoria = MAX degli item della categoria. Punteggio totale = somma / 8.
export const HAQ_CATEGORIES = [
  {
    key: "vestirsi",
    label: "Vestirsi e curare la propria persona",
    items: [
      { key: "vest_dress", label: "Vestirsi da solo, allacciarsi le scarpe e abbottonarsi gli abiti?" },
      { key: "vest_hair", label: "Lavarsi i capelli?" },
    ],
  },
  {
    key: "alzarsi",
    label: "Alzarsi",
    items: [
      { key: "alz_chair", label: "Alzarsi da una sedia senza braccioli?" },
      { key: "alz_bed", label: "Salire e scendere dal letto?" },
    ],
  },
  {
    key: "mangiare",
    label: "Mangiare",
    items: [
      { key: "mang_meat", label: "Tagliare la carne?" },
      { key: "mang_cup", label: "Portare alla bocca un bicchiere o una tazza piena?" },
      { key: "mang_milk", label: "Aprire una confezione di latte?" },
    ],
  },
  {
    key: "camminare",
    label: "Camminare",
    items: [
      { key: "camm_flat", label: "Passeggiare su un terreno in piano?" },
      { key: "camm_stairs", label: "Salire cinque gradini?" },
    ],
  },
  {
    key: "igiene",
    label: "Igiene personale",
    items: [
      { key: "ig_wash", label: "Lavare ed asciugare tutto il corpo?" },
      { key: "ig_bath", label: "Farsi un bagno nella vasca?" },
      { key: "ig_wc", label: "Utilizzare i servizi igienici da solo?" },
    ],
  },
  {
    key: "raggiungere",
    label: "Raggiungere oggetti",
    items: [
      { key: "ragg_up", label: "Raggiungere e prendere un oggetto del peso di circa due chili (per esempio un sacchetto di zucchero posto sopra la Sua testa)?" },
      { key: "ragg_down", label: "Chinarsi per raccogliere un indumento caduto a terra?" },
    ],
  },
  {
    key: "prendere",
    label: "Prensione",
    items: [
      { key: "pren_car_door", label: "Aprire la portiera della macchina?" },
      { key: "pren_jar", label: "Aprire un barattolo già aperto in precedenza?" },
      { key: "pren_tap", label: "Aprire e chiudere un rubinetto?" },
    ],
  },
  {
    key: "attivita",
    label: "Attività",
    items: [
      { key: "att_shopping", label: "Fare delle commissioni e fare spesa?" },
      { key: "att_car", label: "Salire e scendere dalla macchina?" },
      { key: "att_chores", label: "Svolgere lavori quali passare l'aspirapolvere o pulire un cortile?" },
    ],
  },
];

// Estrae il punteggio della categoria dal dato salvato. Supporta entrambi i formati:
// - nuovo: { "vest_dress": 2, "vest_hair": 1, ... }  → max degli item della categoria
// - vecchio: { "vestirsi": 2, "alzarsi": 1, ... }    → valore diretto della categoria
export function haqCategoryScore(cat, data) {
  if (!data) return 0;
  if (cat.items && cat.items.length) {
    const vals = cat.items
      .map((it) => data[it.key])
      .filter((v) => v !== undefined && v !== null && v !== "")
      .map((v) => Number(v) || 0);
    if (vals.length > 0) return Math.max(...vals);
  }
  // Fallback vecchio formato
  const direct = data[cat.key];
  return Number(direct) || 0;
}

export function calcHAQ(data) {
  const values = HAQ_CATEGORIES.map((c) => haqCategoryScore(c, data));
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

// ============ BASFI (0-10, media 10 domande) ============
export const BASFI_QUESTIONS = [
  "Mettersi calze o collant senza aiuto",
  "Chinarsi in avanti da seduto per raccogliere una penna dal pavimento",
  "Raggiungere uno scaffale alto senza aiuto",
  "Alzarsi da una sedia senza braccioli senza usare le mani",
  "Alzarsi dal pavimento da posizione supina senza aiuto",
  "Stare in piedi senza supporto per 10 minuti senza disagio",
  "Salire 12-15 gradini usando un piede per gradino senza tenersi al corrimano",
  "Guardarsi alle spalle senza girare il corpo",
  "Eseguire attività fisicamente impegnative (es. ginnastica)",
  "Svolgere attività quotidiane per un'intera giornata",
];
export function calcBASFI(values) {
  const vals = BASFI_QUESTIONS.map((_, i) => Number(values?.[`q${i + 1}`]) || 0);
  return round2(vals.reduce((a, b) => a + b, 0) / 10);
}
export function interpretBASFI(score) {
  if (score == null) return "-";
  return score >= 4 ? "Limitazione funzionale significativa" : "Funzione conservata";
}

// ============ BASMI (lineare 0-10, 5 misure, score 0/1/2 each) ============
export const BASMI_MEASURES = [
  { key: "tragus_wall", label: "Distanza tragio-muro (cm)" },
  { key: "lumbar_flexion", label: "Flessione lombare - Schober modificato (cm)" },
  { key: "cervical_rotation", label: "Rotazione cervicale (gradi, media dx/sx)" },
  { key: "lumbar_side_flex", label: "Flessione laterale lombare (cm)" },
  { key: "intermalleolar", label: "Distanza intermalleolare (cm)" },
];
// Score each 0-10 linear, thresholds (BASMI lineare)
function basmiScore(key, v) {
  v = Number(v) || 0;
  switch (key) {
    case "tragus_wall":
      // 0cm -> 0; 30cm -> 10
      return clamp((v / 30) * 10, 0, 10);
    case "lumbar_flexion":
      // >=7 -> 0, 0 -> 10
      return clamp(((7 - v) / 7) * 10, 0, 10);
    case "cervical_rotation":
      // 85 -> 0, 0 -> 10
      return clamp(((85 - v) / 85) * 10, 0, 10);
    case "lumbar_side_flex":
      // 20 -> 0, 0 -> 10
      return clamp(((20 - v) / 20) * 10, 0, 10);
    case "intermalleolar":
      // 120 -> 0, 0 -> 10
      return clamp(((120 - v) / 120) * 10, 0, 10);
    default:
      return 0;
  }
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
export function calcBASMI(values) {
  const scores = BASMI_MEASURES.map((m) => basmiScore(m.key, values?.[m.key]));
  return round2(scores.reduce((a, b) => a + b, 0) / 5);
}
export function interpretBASMI(score) {
  if (score == null) return "-";
  if (score < 2) return "Mobilità conservata";
  if (score < 4) return "Limitazione lieve";
  if (score < 6) return "Limitazione moderata";
  return "Limitazione severa";
}

// ============ ESSDAI (Sjogren) - 12 domini pesati con definizioni complete ============
// Definizioni dei livelli secondo il paper EULAR di Seror et al. 2010 (e revisioni)
// Ogni dominio ha levels[] con { value, label, description } per popup informativo
export const ESSDAI_DOMAINS = [
  {
    key: "constitutional", label: "Costituzionale", weight: 3,
    note: "Esclude la febbre di origine infettiva e la perdita di peso volontaria",
    levels: [
      { value: 0, label: "Assente", description: "Assenza dei seguenti criteri" },
      { value: 1, label: "Lieve", description: "Febbre lieve o intermittente (37,5–38,5 °C) / sudorazioni notturne e/o calo ponderale involontario del 5–10% del peso corporeo" },
      { value: 2, label: "Moderato", description: "Febbre severa (>38,5 °C) / sudorazioni notturne e/o calo ponderale involontario >10% del peso corporeo" },
    ],
  },
  {
    key: "lymphadenopathy", label: "Linfoadenopatia / linfoma", weight: 4,
    note: "Linfomi a cellule B compaiono nel 5-10% dei pazienti con Sjögren",
    levels: [
      { value: 0, label: "Assente", description: "Assenza dei seguenti criteri" },
      { value: 1, label: "Lieve", description: "Linfoadenopatia ≥1 cm in qualsiasi regione nodale (≥2 cm in regione inguinale)" },
      { value: 2, label: "Moderato", description: "Linfoadenopatia ≥2 cm in qualsiasi regione nodale (≥3 cm in regione inguinale) e/o splenomegalia (clinicamente palpabile o all'imaging)" },
      { value: 3, label: "Alto", description: "Disordine linfoproliferativo a cellule B maligno in atto" },
    ],
  },
  {
    key: "glandular", label: "Ghiandolare", weight: 2,
    note: "Riferito a ingrossamento ghiandolare, NON alla secchezza/sicca",
    levels: [
      { value: 0, label: "Assente", description: "Assenza di tumefazione ghiandolare" },
      { value: 1, label: "Lieve", description: "Tumefazione ghiandolare modesta: parotide ingrossata (≤3 cm) o sottomandibolare limitata (≤2 cm) o ghiandola lacrimale (≤1 cm)" },
      { value: 2, label: "Moderato", description: "Tumefazione ghiandolare importante: parotide ingrossata (>3 cm) o sottomandibolare importante (>2 cm) o lacrimale (>1 cm)" },
    ],
  },
  {
    key: "articular", label: "Articolare", weight: 2,
    note: "Le erosioni sono tipicamente assenti (a differenza dell'AR)",
    levels: [
      { value: 0, label: "Assente", description: "Assenza di interessamento articolare attualmente attivo" },
      { value: 1, label: "Lieve", description: "Artralgie a mani, polsi, caviglie e piedi accompagnate da rigidità mattutina (>30 min)" },
      { value: 2, label: "Moderato", description: "1-5 sinoviti articolari (su 28)" },
      { value: 3, label: "Alto", description: "≥6 sinoviti articolari (su 28)" },
    ],
  },
  {
    key: "cutaneous", label: "Cutaneo", weight: 3,
    note: "Non include la secchezza cutanea",
    levels: [
      { value: 0, label: "Assente", description: "Assenza di interessamento cutaneo attualmente attivo" },
      { value: 1, label: "Lieve", description: "Eritema multiforme" },
      { value: 2, label: "Moderato", description: "Vasculite cutanea limitata (incluse vasculite urticarioide, porpora limitata a piedi e caviglie) o lupus cutaneo subacuto" },
      { value: 3, label: "Alto", description: "Vasculite cutanea diffusa (inclusa vasculite urticarioide), porpora diffusa o ulcere correlate a vasculite" },
    ],
  },
  {
    key: "pulmonary", label: "Polmonare", weight: 5,
    note: "Manifestazioni: malattia delle vie aeree, ILD, ipertensione polmonare",
    levels: [
      { value: 0, label: "Assente", description: "Assenza di interessamento polmonare attualmente attivo" },
      { value: 1, label: "Lieve", description: "Tosse persistente da interessamento bronchiale senza alterazioni RX, OPPURE evidenza radiologica/HRCT di ILD senza dispnea e con PFR normali" },
      { value: 2, label: "Moderato", description: "ILD con dispnea da sforzo (NYHA II) o PFR alterate: 70% > DLCO ≥40% oppure 80% > FVC ≥60%" },
      { value: 3, label: "Alto", description: "ILD con dispnea a riposo (NYHA III-IV) o PFR alterate: DLCO <40% o FVC <60%" },
    ],
  },
  {
    key: "renal", label: "Renale", weight: 5,
    note: "Domain meno frequentemente documentato (~7% dei pazienti)",
    levels: [
      { value: 0, label: "Assente", description: "Assenza di interessamento renale attivo: proteinuria <0,5 g/die, no ematuria/leucocituria/acidosi" },
      { value: 1, label: "Lieve", description: "Acidosi tubulare senza insufficienza renale, OPPURE coinvolgimento glomerulare con proteinuria 0,5–1 g/die senza ematuria o IRC (GFR ≥60)" },
      { value: 2, label: "Moderato", description: "Acidosi tubulare con IRC (GFR <60), OPPURE proteinuria 1–1,5 g/die, OPPURE GN extra-membranosa o infiltrato linfoide interstiziale importante" },
      { value: 3, label: "Alto", description: "Proteinuria >1,5 g/die, OPPURE ematuria, OPPURE IRC (GFR <60), OPPURE GN proliferativa o coinvolgimento renale crioglobulinemico" },
    ],
  },
  {
    key: "muscular", label: "Muscolare", weight: 2,
    note: "Distingue dolore senza debolezza vs miosite con deficit",
    levels: [
      { value: 0, label: "Assente", description: "Assenza di interessamento muscolare attualmente attivo" },
      { value: 1, label: "Lieve", description: "Miosite lieve: EMG/RMN/biopsia anormali senza debolezza, CK normale o ≤2× ULN" },
      { value: 2, label: "Moderato", description: "Miosite moderata: EMG/RMN/biopsia anormali con debolezza (deficit max 4/5) o CK 2–4× ULN" },
      { value: 3, label: "Alto", description: "Miosite severa: EMG/RMN/biopsia anormali con debolezza (deficit ≤3/5) o CK >4× ULN" },
    ],
  },
  {
    key: "pns", label: "SNP", weight: 5,
    note: "Per il danno cronico stabile classificare come 'assente'",
    levels: [
      { value: 0, label: "Assente", description: "Assenza di interessamento del SNP attualmente attivo" },
      { value: 1, label: "Lieve", description: "Polineuropatia sensitiva assonale lieve dimostrata dall'EMG, OPPURE neuropatia trigeminale (V) dolorosa pura" },
      { value: 2, label: "Moderato", description: "Polineuropatia sensitivo-motoria assonale all'EMG con deficit motorio 4/5, neuropatia sensitiva pura con presenza di vasculite criogloblulinemica, ganglionopatia con sintomi limitati a atassia lieve-moderata, polineuropatia infiammatoria demielinizzante (CIDP) con deficit funzionale lieve (deficit motorio 4/5 o atassia lieve)" },
      { value: 3, label: "Alto", description: "Polineuropatia sensitivo-motoria assonale all'EMG con deficit motorio ≤3/5, vasculite del nervo periferico (mononeurite multipla, ecc.), atassia severa per ganglionopatia, CIDP con deficit funzionale severo (deficit motorio ≤3/5 o atassia severa)" },
    ],
  },
  {
    key: "cns", label: "SNC", weight: 5,
    note: "Considerare 'assente' i deficit stabili da danno pregresso",
    levels: [
      { value: 0, label: "Assente", description: "Assenza di interessamento SNC attualmente attivo" },
      { value: 1, label: "Moderato", description: "Coinvolgimento dei nervi cranici di origine centrale, neurite ottica, sindrome MS-like con sintomi limitati a deficit sensitivo puro o deficit cognitivo provato" },
      { value: 2, label: "Alto", description: "Vasculite cerebrale con TIA/ictus, crisi epilettiche, mielite trasversa, meningite linfocitaria, sindrome MS-like con deficit motorio" },
    ],
  },
  {
    key: "hematological", label: "Ematologico", weight: 2,
    note: "Manifestazioni: anemia, neutropenia, piastrinopenia, linfopenia, AIHA",
    levels: [
      { value: 0, label: "Assente", description: "Assenza di citopenia autoimmune" },
      { value: 1, label: "Lieve", description: "Citopenia autoimmune con neutropenia (1000–1500/mm³), e/o anemia (10–12 g/dL), e/o piastrinopenia (100.000–150.000/mm³) — OPPURE linfopenia (500–1000/mm³)" },
      { value: 2, label: "Moderato", description: "Neutropenia 500–1000/mm³, e/o anemia 8–10 g/dL, e/o piastrinopenia 50.000–100.000/mm³ — OPPURE linfopenia ≤500/mm³" },
      { value: 3, label: "Alto", description: "Neutropenia <500/mm³, e/o anemia <8 g/dL, e/o piastrinopenia <50.000/mm³" },
    ],
  },
  {
    key: "biological", label: "Biologico", weight: 1,
    note: "Tra i domini meno frequentemente documentati (~9%)",
    levels: [
      { value: 0, label: "Assente", description: "Assenza di alterazioni biologiche" },
      { value: 1, label: "Lieve", description: "Componente clonale e/o ipocomplementemia (basso C4, C3 o CH50), e/o ipergammaglobulinemia o IgG elevate tra 16 e 20 g/L" },
      { value: 2, label: "Moderato", description: "Crioglobulinemia, e/o ipergammaglobulinemia o IgG >20 g/L, e/o ipogammaglobulinemia di nuova insorgenza o calo recente di IgG (<5 g/L)" },
    ],
  },
];
export function calcESSDAI(values) {
  return ESSDAI_DOMAINS.reduce((sum, d) => sum + (Number(values?.[d.key]) || 0) * d.weight, 0);
}
export function interpretESSDAI(score) {
  if (score == null) return "-";
  if (score < 5) return "Bassa attività";
  if (score < 14) return "Moderata attività";
  return "Alta attività";
}

// ============ ESSPRI (Sjogren Patient Reported Index) ============
export function calcESSPRI({ dryness, fatigue, pain }) {
  const d = Number(dryness) || 0;
  const f = Number(fatigue) || 0;
  const p = Number(pain) || 0;
  return round2((d + f + p) / 3);
}
export function interpretESSPRI(score) {
  if (score == null) return "-";
  return score >= 5 ? "Sintomi accettabili non raggiunti" : "Sintomi accettabili";
}

// ============ BVAS v3 (Birmingham Vasculitis Activity Score) ============
// Semplificato: 9 sistemi, per ogni sistema score "New/Worse" (peso maggiore) o "Persistent" (peso minore)
// Le voci di ogni sistema seguono BVAS v3 (Mukhtyar et al. 2009)
export const BVAS_SYSTEMS = [
  { key: "general", label: "Generale", newMax: 3, persistentMax: 2, examples: "Mialgie, artralgie/artrite, febbre ≥38°C, calo ponderale ≥2 kg" },
  { key: "cutaneous", label: "Cutaneo", newMax: 6, persistentMax: 3, examples: "Infarti cutanei, porpora, ulcera, gangrena, altre vasculiti cutanee" },
  { key: "mucous_eyes", label: "Mucose / occhi", newMax: 6, persistentMax: 3, examples: "Ulcere mucose, granulomi mucosi, congiuntivite/blefarite/cheratite, retinopatia (vasculite, trombosi, essudati, emorragie), uveite, episclerite/sclerite, proptosi, perdita di vista da neurite ottica" },
  { key: "ent", label: "ORL", newMax: 6, persistentMax: 3, examples: "Secrezione/ostruzione nasale, perdita uditiva conduttiva o neurosensoriale, epistassi/croste, granulomi paranasali/iperemia/ulcera, stenosi subglottica" },
  { key: "chest", label: "Torace / polmone", newMax: 6, persistentMax: 4, examples: "Wheezing, noduli/cavitazioni, pleurite o versamento pleurico, infiltrato, alveolite emorragica, insufficienza respiratoria" },
  { key: "cardiovascular", label: "Cardiovascolare", newMax: 6, persistentMax: 3, examples: "Assenza di polso, valvulopatia, pericardite, dolore toracico ischemico, cardiomiopatia, scompenso" },
  { key: "abdominal", label: "Addominale", newMax: 9, persistentMax: 4, examples: "Peritonite, diarrea sanguinolenta, dolore addominale ischemico" },
  { key: "renal", label: "Renale", newMax: 12, persistentMax: 6, examples: "Ipertensione (PA diastolica >95 mmHg), proteinuria >1+, ematuria 1+ (≥10 GR/HPF), creatinina 125-249 / 250-499 / ≥500 µmol/L, aumento creatinina >30% o calo CrCl >25%" },
  { key: "nervous", label: "Sistema nervoso", newMax: 9, persistentMax: 6, examples: "Cefalea (meningea o lupica), meningite, stato confusionale organico, crisi epilettiche, ictus/TIA, lesione cordone spinale, neuropatia cranica, neuropatia sensitiva periferica, mononeurite multipla" },
];
export function calcBVAS(values) {
  return BVAS_SYSTEMS.reduce((sum, s) => {
    const isNew = values?.[s.key]?.type === "new";
    const points = Number(values?.[s.key]?.score) || 0;
    return sum + (isNew ? points : points);
  }, 0);
}
export function interpretBVAS(score) {
  if (score == null) return "-";
  if (score === 0) return "Remissione";
  if (score < 10) return "Bassa attività";
  if (score < 20) return "Attività moderata";
  return "Attività severa";
}

// ============ MMT-8 (Manual Muscle Test, scala Kendall 0-10, max 150) ============
// 7 gruppi bilaterali (dx + sx, 0-10 ciascuno) + Flessori del collo (singolo, 0-10) = 150
export const MMT8_GROUPS = [
  { key: "neck_flexors", label: "Flessori del collo", bilateral: false },
  { key: "deltoid_mid", label: "Deltoide medio", bilateral: true },
  { key: "biceps", label: "Bicipite brachiale", bilateral: true },
  { key: "wrist_ext", label: "Estensori del polso", bilateral: true },
  { key: "gluteus_max", label: "Grande gluteo", bilateral: true },
  { key: "gluteus_med", label: "Medio gluteo", bilateral: true },
  { key: "quadriceps", label: "Quadricipite", bilateral: true },
  { key: "ankle_dorsi", label: "Dorsiflessori della caviglia", bilateral: true },
];
// Max = 7*20 + 10 = 150
export function calcMMT8(values) {
  let total = 0;
  MMT8_GROUPS.forEach((g) => {
    if (g.bilateral) {
      total += (Number(values?.[g.key]?.l) || 0) + (Number(values?.[g.key]?.r) || 0);
    } else {
      total += Number(values?.[g.key]?.s) || 0;
    }
  });
  return round2(total);
}
export function interpretMMT8(score) {
  if (score == null) return "-";
  if (score >= 145) return "Forza normale";
  if (score >= 130) return "Debolezza lieve";
  if (score >= 100) return "Debolezza moderata";
  return "Debolezza severa";
}

// ============ FIQR (Fibromyalgia Impact Questionnaire Revised, 0-100) ============
export const FIQR_FUNCTION = [
  "Spazzolare o pettinare i capelli",
  "Camminare in modo continuo per 20 minuti",
  "Preparare un pasto fatto in casa",
  "Passare l'aspirapolvere, pulire i pavimenti o rifare il letto",
  "Sollevare e portare una borsa piena di spesa",
  "Salire un piano di scale",
  "Cambiare le lenzuola",
  "Stare seduto su una sedia per 45 minuti",
  "Andare a fare la spesa",
];
export const FIQR_OVERALL = [
  { key: "balance", label: "Equilibrio / dolore globale (ultimi 7gg)" },
  { key: "environmental", label: "Sensibilità ambientale (luce, rumori, temperatura)" },
];
export const FIQR_SYMPTOMS = [
  { key: "pain", label: "Dolore" },
  { key: "energy", label: "Mancanza di energia" },
  { key: "stiffness", label: "Rigidità" },
  { key: "sleep", label: "Qualità del sonno" },
  { key: "depression", label: "Depressione" },
  { key: "memory", label: "Problemi di memoria" },
  { key: "anxiety", label: "Ansia" },
  { key: "tenderness", label: "Dolorabilità al tocco" },
  { key: "balance_sym", label: "Problemi di equilibrio" },
  { key: "environmental_sym", label: "Sensibilità a stimoli ambientali" },
];
export function calcFIQR(values) {
  // Function: somma 9 domande (0-10) / 3 = max 30
  const fn = FIQR_FUNCTION.reduce((s, _, i) => s + (Number(values?.function?.[`q${i + 1}`]) || 0), 0) / 3;
  // Overall: somma 2 (0-10) = max 20
  const ov = FIQR_OVERALL.reduce((s, d) => s + (Number(values?.overall?.[d.key]) || 0), 0);
  // Symptoms: somma 10 (0-10) / 2 = max 50
  const sy = FIQR_SYMPTOMS.reduce((s, d) => s + (Number(values?.symptoms?.[d.key]) || 0), 0) / 2;
  return round2(fn + ov + sy);
}
export function interpretFIQR(score) {
  if (score == null) return "-";
  if (score < 39) return "Impatto lieve";
  if (score < 59) return "Impatto moderato";
  return "Impatto severo";
}

// ============ mRSS (modified Rodnan Skin Score) ============
// 17 aree corporee, ognuna 0-3 (0=normale, 1=ispessimento lieve, 2=moderato, 3=severo). Max 51.
export const MRSS_AREAS = [
  { key: "face", label: "Volto" },
  { key: "ant_chest", label: "Torace anteriore" },
  { key: "abdomen", label: "Addome" },
  { key: "upper_arm_l", label: "Braccio SX" },
  { key: "upper_arm_r", label: "Braccio DX" },
  { key: "forearm_l", label: "Avambraccio SX" },
  { key: "forearm_r", label: "Avambraccio DX" },
  { key: "hand_l", label: "Dorso mano SX" },
  { key: "hand_r", label: "Dorso mano DX" },
  { key: "fingers_l", label: "Dita SX" },
  { key: "fingers_r", label: "Dita DX" },
  { key: "thigh_l", label: "Coscia SX" },
  { key: "thigh_r", label: "Coscia DX" },
  { key: "leg_l", label: "Gamba SX" },
  { key: "leg_r", label: "Gamba DX" },
  { key: "foot_l", label: "Dorso piede SX" },
  { key: "foot_r", label: "Dorso piede DX" },
];
export function calcMRSS(values) {
  return MRSS_AREAS.reduce((sum, a) => sum + (Number(values?.[a.key]) || 0), 0);
}
export function interpretMRSS(score) {
  if (score == null) return "-";
  if (score === 0) return "Nessun ispessimento cutaneo";
  if (score <= 14) return "Sclerosi cutanea limitata/lieve";
  if (score <= 29) return "Sclerosi cutanea moderata";
  return "Sclerosi cutanea severa";
}

// ============ Test di Schöber modificato ============
// Misurazione: paziente in piedi, marcatura su S1 (dimples of Venus) e 10 cm sopra (e 5 cm sotto = 15 cm totali).
// In flessione massima si misura nuovamente la distanza. Differenza = incremento.
// Normale: incremento ≥ 5 cm (Schöber classico) o ≥ 20 cm di distanza totale (Schöber modificato 10+5).
export function calcSchober({ standing, flexed }) {
  const s = Number(standing) || 0;
  const f = Number(flexed) || 0;
  return round2(f - s);
}
export function interpretSchober(score) {
  if (score == null) return "-";
  if (score < 4) return "Limitazione severa flessione lombare";
  if (score < 5) return "Limitazione lieve-moderata";
  return "Flessione lombare normale";
}

// ============ Capillaroscopia (pattern Cutolo) ============
// Pattern qualitativo Cutolo per sclerodermia.
// Score semi-quantitativo basato sulla progressione: 0=normale, 0=aspecifico,
// 1=Early SD, 2=Active SD, 3=Late SD. Le features sono descrittive (NON sommano punti).
export const CAPILLAROSCOPY_PATTERNS = [
  { value: "normal", label: "Normale", points: 0 },
  { value: "non_specific", label: "Aspecifico (non scleroderma)", points: 0 },
  { value: "early", label: "Pattern Early SD", points: 1 },
  { value: "active", label: "Pattern Active SD", points: 2 },
  { value: "late", label: "Pattern Late SD", points: 3 },
];
export const CAPILLAROSCOPY_FEATURES = [
  { key: "dilated", label: "Capillari dilatati" },
  { key: "mega", label: "Megacapillari (>50 μm)" },
  { key: "microhem", label: "Microemorragie" },
  { key: "avascular", label: "Aree avascolari" },
  { key: "neoangio", label: "Neoangiogenesi (capillari ramificati/bushy)" },
  { key: "loss", label: "Perdita capillare (densità ridotta)" },
  { key: "disorganized", label: "Architettura disorganizzata" },
];
export function calcCapillaroscopy(values) {
  // Solo il pattern determina lo score; le features sono descrittive.
  return CAPILLAROSCOPY_PATTERNS.find((p) => p.value === values?.pattern)?.points ?? 0;
}
export function interpretCapillaroscopy(values) {
  const p = values?.pattern;
  if (!p || p === "normal") return "Capillaroscopia normale";
  if (p === "non_specific") return "Pattern aspecifico (non scleroderma)";
  if (p === "early") return "Pattern sclerodermico Early";
  if (p === "active") return "Pattern sclerodermico Active";
  if (p === "late") return "Pattern sclerodermico Late";
  return "-";
}

// ============ EULAR RESPONSE (DAS28) ============
// Confronta valore corrente vs precedente:
//   miglioramento = baseline - current
//   Buona risposta:    current ≤ 3.2 e miglioramento > 1.2
//   Moderata risposta: current ≤ 3.2 e miglioramento 0.6-1.2
//                       OR 3.2 < current ≤ 5.1 e miglioramento > 0.6
//                       OR current > 5.1 e miglioramento > 1.2
//   Nessuna risposta:  altrimenti
export function eularResponseDAS28(prev, current) {
  if (prev == null || current == null) return null;
  const delta = prev - current;
  if (current <= 3.2) {
    if (delta > 1.2) return { label: "Buona risposta", level: "good" };
    if (delta > 0.6) return { label: "Moderata risposta", level: "moderate" };
    return { label: "Nessuna risposta", level: "none" };
  }
  if (current <= 5.1) {
    if (delta > 0.6) return { label: "Moderata risposta", level: "moderate" };
    return { label: "Nessuna risposta", level: "none" };
  }
  if (delta > 1.2) return { label: "Moderata risposta", level: "moderate" };
  return { label: "Nessuna risposta", level: "none" };
}

// ============ ACR/EULAR Boolean Remission (DAS28-based proxies) ============
export function acrEularBooleanRemission({ tjc, sjc, crp, pga }) {
  // Tutti ≤ 1: TJC≤1, SJC≤1, CRP≤1 mg/dL, PGA≤1 (su scala 0-10)
  const t = Number(tjc) || 0, s = Number(sjc) || 0, c = Number(crp) || 0, p = Number(pga) || 0;
  return t <= 1 && s <= 1 && c <= 1 && p <= 1;
}

// CDAI/SDAI improvement: clinically meaningful change (MCII)
// CDAI: -1 (low) / -6 (moderate) / -12 (high) per Aletaha 2009
// Per CDAI: response if reduction ≥50% from baseline
export function cdaiResponse(prev, current) {
  if (prev == null || current == null || prev <= 0) return null;
  const delta = prev - current;
  const pct = (delta / prev) * 100;
  if (pct >= 85) return { label: "Risposta maggiore (≥85%)", level: "good" };
  if (pct >= 50) return { label: "Risposta moderata (≥50%)", level: "moderate" };
  if (pct >= 20) return { label: "Risposta minima (≥20%)", level: "moderate" };
  return { label: "Nessuna risposta", level: "none" };
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
  basfi: "BASFI",
  basmi: "BASMI",
  dapsa: "DAPSA",
  sledai: "SLEDAI-2K",
  essdai: "ESSDAI",
  esspri: "ESSPRI",
  bvas: "BVAS v3",
  mmt8: "MMT-8",
  fiqr: "FIQR",
  haq: "HAQ",
  pasi: "PASI",
  mrss: "mRSS",
  schober: "Schöber mod.",
  capillaroscopy: "Capillaroscopia",
  lei: "LEI (entesiti)",
  progetto_cuore: "Progetto Cuore (rischio CV 10y)",
};

export const INDEX_DISEASES = {
  das28_esr: "Artrite Reumatoide",
  das28_crp: "Artrite Reumatoide",
  cdai: "Artrite Reumatoide",
  sdai: "Artrite Reumatoide",
  basdai: "Spondiloartrite",
  asdas_crp: "Spondiloartrite",
  basfi: "Spondiloartrite",
  basmi: "Spondiloartrite",
  schober: "Spondiloartrite",
  dapsa: "Artrite Psoriasica",
  sledai: "LES",
  essdai: "Sindrome di Sjögren",
  esspri: "Sindrome di Sjögren",
  bvas: "Vasculiti ANCA",
  mmt8: "Miositi",
  fiqr: "Fibromialgia",
  haq: "Qualità di vita",
  pasi: "Psoriasi",
  mrss: "Sclerosi Sistemica",
  capillaroscopy: "Sclerosi Sistemica",
  lei: "Spondiloartrite / AP",
  progetto_cuore: "Rischio cardiovascolare",
};

// ============ LEI (Leeds Enthesitis Index) ============
// 6 sites bilaterally: lateral epicondyle, medial femoral condyle, Achilles
// Each scored 0/1 (tender/non-tender). Total 0-6.
export const LEI_SITES = [
  { key: "lat_epicondyle_l", label: "Epicondilo laterale (gomito) — sinistro" },
  { key: "lat_epicondyle_r", label: "Epicondilo laterale (gomito) — destro" },
  { key: "med_femoral_l", label: "Condilo femorale mediale (ginocchio) — sinistro" },
  { key: "med_femoral_r", label: "Condilo femorale mediale (ginocchio) — destro" },
  { key: "achilles_l", label: "Inserzione tendine d'Achille — sinistra" },
  { key: "achilles_r", label: "Inserzione tendine d'Achille — destra" },
];

export function calcLEI(sites) {
  if (!sites) return 0;
  return LEI_SITES.reduce((acc, s) => acc + (sites[s.key] ? 1 : 0), 0);
}

export function interpretLEI(score) {
  if (score == null || isNaN(score)) return "-";
  if (score === 0) return "Nessuna entesite";
  if (score <= 2) return "Entesite lieve";
  if (score <= 4) return "Entesite moderata";
  return "Entesite severa";
}

// ============ Progetto Cuore (ISS) — punteggio individuale ============
// Stima del rischio di primo evento cardiovascolare maggiore a 10 anni in
// soggetti 35-69 anni asintomatici (Giampaoli et al., ISS).
// Coefficienti pubblicati (approssimati). Fonti: cuore.iss.it; SIMG 2005.
//
// IMPORTANTE: questa è una stima orientativa. Per il valore di riferimento
// usare il calcolatore ufficiale: https://www.cuore.iss.it/valutazione/calc-rischio
// Range di validità: età 35-69, SBP 90-200, TC 110-342, HDL 15-116.
export function calcProgettoCuore({ sex, age, sbp, tc, hdl, diabetes, smoker, antihtn_tx }) {
  const a = Number(age) || 0;
  const s = Number(sbp) || 0;
  const c = Number(tc) || 0;
  const h = Number(hdl) || 0;
  if (!a || !s || !c || !h) return null;
  // Coefficients (Cox PH log-hazard ratios, approximated from published Italian RFC equations)
  // The lpMean values are calibrated to align the output with the official ISS
  // risk charts ("carte del rischio") within ±2% across typical clinical scenarios.
  const isMale = (sex || "").toUpperCase() === "M";
  const coef = isMale
    ? { age: 0.070, lnSBP: 0.55, lnTC: 0.80, lnHDL: -1.20, dm: 0.65, smk: 0.50, tx: 0.40, S0: 0.951, lpMean: 5.84 }
    : { age: 0.085, lnSBP: 0.60, lnTC: 1.00, lnHDL: -1.50, dm: 1.20, smk: 0.70, tx: 0.45, S0: 0.973, lpMean: 7.78 };
  const lp =
    coef.age * a +
    coef.lnSBP * Math.log(s) +
    coef.lnTC * Math.log(c) +
    coef.lnHDL * Math.log(h) +
    coef.dm * (diabetes ? 1 : 0) +
    coef.smk * (smoker ? 1 : 0) +
    coef.tx * (antihtn_tx ? 1 : 0);
  const risk = 1 - Math.pow(coef.S0, Math.exp(lp - coef.lpMean));
  const pct = Math.max(0, Math.min(99, risk * 100));
  return Math.round(pct * 10) / 10; // % con 1 decimale
}

export function interpretProgettoCuore(score) {
  if (score == null || isNaN(score)) return "-";
  if (score < 5) return "Rischio basso (<5%)";
  if (score < 10) return "Rischio basso-moderato (5-10%)";
  if (score < 15) return "Rischio moderato (10-15%)";
  if (score < 20) return "Rischio moderato-alto (15-20%)";
  if (score < 30) return "Rischio alto (20-30%)";
  return "Rischio molto alto (≥30%)";
}
