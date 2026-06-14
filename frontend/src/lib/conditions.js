/**
 * conditions.js — Single source of truth for patient conditions / comorbidities.
 *
 * Naming convention:
 *   Code / API : "conditions", conditionsApi, canonical_name
 *   Italian UI : "Comorbidità / Condizioni" (label field)
 *
 * Exports:
 *   CANONICAL_MAP            — 60 V1 conditions keyed by canonical_name
 *   LABEL_TO_CANONICAL       — reverse lookup: lowercase label → canonical_name
 *   COMORBIDITY_CATEGORIES   — UI category tree (same shape used by existing components)
 *   CONDITION_SYNONYMS       — search aliases: label → [synonym, ...]
 *   buildConditionFromLabel  — resolve a label string → upsert-ready payload
 *   buildCustomCondition     — build a custom_ condition for free-entry labels
 *   isMultiInstance          — boolean helper
 *   getDefaultStatus         — string helper
 *   getConditionFlags        — string[] helper
 *   matchesConditionSearch   — search helper (replaces matchesComorbiditySearch)
 *   slugify                  — internal, also exported for custom canonical generation
 */

// ── Canonical map ─────────────────────────────────────────────────────────────
// Keys     : canonical_name  (machine key, used in API, alert engine, DB)
// label    : default Italian display string
// category : one of 12 standard categories + "other"
// status   : status_default  ("active" | "resolved" | "historical" | "latent")
// relevance: "high" | "medium" | "low"
// flags    : string[]  — machine-readable alert/safety flags
// multi    : boolean   — true = multi_instance (multiple coexisting episodes)

export const CANONICAL_MAP = {
  // ── Cardiovascolare ─────────────────────────────────────────────────────────
  hypertension:              { label: "Ipertensione arteriosa",          category: "cardiovascular",   status: "active",    relevance: "medium", flags: [],                                                          multi: false },
  atrial_fibrillation:       { label: "Fibrillazione atriale",           category: "cardiovascular",   status: "active",    relevance: "high",   flags: ["anticoagulation_check", "cardiovascular_risk"],            multi: false },
  ischemic_heart_disease:    { label: "Cardiopatia ischemica",           category: "cardiovascular",   status: "active",    relevance: "high",   flags: ["cardiovascular_risk"],                                     multi: false },
  heart_failure:             { label: "Scompenso cardiaco",              category: "cardiovascular",   status: "active",    relevance: "high",   flags: ["cardiovascular_risk", "anti_tnf_caution"],                 multi: false },
  valvulopathy:              { label: "Valvulopatia",                    category: "cardiovascular",   status: "active",    relevance: "medium", flags: [],                                                          multi: false },
  peripheral_artery_disease: { label: "Arteriopatia periferica",         category: "cardiovascular",   status: "active",    relevance: "medium", flags: ["cardiovascular_risk"],                                     multi: false },
  stroke_tia:                { label: "Pregresso ictus/TIA",             category: "cardiovascular",   status: "historical",relevance: "high",   flags: ["anticoagulation_check", "cardiovascular_risk"],            multi: true  },
  vte:                       { label: "TVP/TEP",                         category: "cardiovascular",   status: "historical",relevance: "high",   flags: ["anticoagulation_check"],                                   multi: true  },

  // ── Metabolico ──────────────────────────────────────────────────────────────
  dm2:                       { label: "Diabete tipo 2",                  category: "metabolic",        status: "active",    relevance: "medium", flags: ["cardiovascular_risk"],                                     multi: false },
  dm1:                       { label: "Diabete tipo 1",                  category: "metabolic",        status: "active",    relevance: "medium", flags: [],                                                          multi: false },
  dyslipidemia:              { label: "Dislipidemia",                    category: "metabolic",        status: "active",    relevance: "low",    flags: ["cardiovascular_risk"],                                     multi: false },
  obesity:                   { label: "Obesità",                         category: "metabolic",        status: "active",    relevance: "low",    flags: ["cardiovascular_risk"],                                     multi: false },
  metabolic_syndrome:        { label: "Sindrome metabolica",             category: "metabolic",        status: "active",    relevance: "low",    flags: ["cardiovascular_risk"],                                     multi: false },
  hyperuricemia_gout:        { label: "Iperuricemia / Gotta",            category: "metabolic",        status: "active",    relevance: "medium", flags: [],                                                          multi: false },
  nafld:                     { label: "Steatosi epatica",                category: "metabolic",        status: "active",    relevance: "low",    flags: ["hepatotoxic_drugs_caution"],                               multi: false },

  // ── Respiratorio ────────────────────────────────────────────────────────────
  copd:                      { label: "BPCO",                            category: "respiratory",      status: "active",    relevance: "medium", flags: [],                                                          multi: false },
  asthma:                    { label: "Asma bronchiale",                 category: "respiratory",      status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  ild:                       { label: "ILD / Fibrosi polmonare",         category: "respiratory",      status: "active",    relevance: "high",   flags: ["ild_monitoring"],                                          multi: false },
  osas:                      { label: "Apnea ostruttiva del sonno",      category: "respiratory",      status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  pulmonary_hypertension:    { label: "Ipertensione polmonare",          category: "respiratory",      status: "active",    relevance: "high",   flags: [],                                                          multi: false },

  // ── Infettivologico ─────────────────────────────────────────────────────────
  hbv_hbsag_positive:        { label: "Epatite B (HBsAg+)",             category: "infectious",       status: "active",    relevance: "high",   flags: ["requires_pre_biologic_screening"],                         multi: false },
  hbv_hbcab_positive:        { label: "Epatite B (HBcAb+)",             category: "infectious",       status: "latent",    relevance: "high",   flags: ["requires_pre_biologic_screening"],                         multi: false },
  hcv:                       { label: "Epatite C",                      category: "infectious",       status: "active",    relevance: "high",   flags: ["requires_pre_biologic_screening"],                         multi: false },
  hiv:                       { label: "HIV",                             category: "infectious",       status: "active",    relevance: "high",   flags: ["requires_pre_biologic_screening"],                         multi: false },
  tbc_latent:                { label: "TBC latente",                     category: "infectious",       status: "latent",    relevance: "high",   flags: ["requires_pre_biologic_screening"],                         multi: false },
  recurrent_infections:      { label: "Infezioni ricorrenti",            category: "infectious",       status: "active",    relevance: "medium", flags: [],                                                          multi: false },
  bronchiectasis:            { label: "Bronchiectasie",                  category: "infectious",       status: "active",    relevance: "medium", flags: [],                                                          multi: false },

  // ── Oncologico ──────────────────────────────────────────────────────────────
  solid_tumor_prior:         { label: "Neoplasia solida pregressa",      category: "oncologic",        status: "historical",relevance: "high",   flags: ["contraindication_some_biologics"],                         multi: true  },
  solid_tumor_active:        { label: "Neoplasia solida attiva",         category: "oncologic",        status: "active",    relevance: "high",   flags: ["contraindication_most_biologics"],                         multi: true  },
  hematologic_tumor_prior:   { label: "Neoplasia ematologica pregressa", category: "oncologic",        status: "historical",relevance: "high",   flags: ["contraindication_some_biologics"],                         multi: true  },
  hematologic_tumor_active:  { label: "Neoplasia ematologica attiva",    category: "oncologic",        status: "active",    relevance: "high",   flags: ["contraindication_most_biologics"],                         multi: true  },
  melanoma_prior:            { label: "Melanoma pregresso",              category: "oncologic",        status: "historical",relevance: "high",   flags: ["contraindication_anti_tnf"],                               multi: true  },

  // ── Gastroenterico ──────────────────────────────────────────────────────────
  peptic_ulcer:              { label: "Ulcera peptica",                  category: "gastrointestinal", status: "active",    relevance: "medium", flags: ["nsaid_caution", "gastroprotection_needed"],                multi: false },
  gerd:                      { label: "MRGE",                            category: "gastrointestinal", status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  diverticular_disease:      { label: "Diverticolite / Diverticolosi",   category: "gastrointestinal", status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  ibd:                       { label: "IBD (Crohn / RCU)",               category: "gastrointestinal", status: "active",    relevance: "high",   flags: [],                                                          multi: false },
  chronic_liver_disease:     { label: "Epatopatia cronica",              category: "gastrointestinal", status: "active",    relevance: "high",   flags: ["hepatotoxic_drugs_caution"],                               multi: false },
  cirrhosis:                 { label: "Cirrosi epatica",                 category: "gastrointestinal", status: "active",    relevance: "high",   flags: ["hepatotoxic_drugs_caution", "many_drug_contraindications"], multi: false },

  // ── Renale ──────────────────────────────────────────────────────────────────
  ckd_mild:                  { label: "IRC lieve (GFR 60\u201389)",      category: "renal",            status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  ckd_moderate:              { label: "IRC moderata (GFR 30\u201359)",   category: "renal",            status: "active",    relevance: "high",   flags: ["dose_adjustment_needed", "nsaid_caution"],                 multi: false },
  ckd_severe:                { label: "IRC grave (GFR <30)",             category: "renal",            status: "active",    relevance: "high",   flags: ["dose_adjustment_needed", "nsaid_contraindicated"],         multi: false },
  dialysis:                  { label: "Dialisi",                         category: "renal",            status: "active",    relevance: "high",   flags: ["dose_adjustment_needed"],                                  multi: false },
  renal_transplant:          { label: "Trapianto renale",                category: "renal",            status: "active",    relevance: "high",   flags: ["immunosuppression_context"],                               multi: false },
  significant_proteinuria:   { label: "Proteinuria significativa",       category: "renal",            status: "active",    relevance: "medium", flags: ["nsaid_caution"],                                           multi: false },

  // ── Neurologico ─────────────────────────────────────────────────────────────
  peripheral_neuropathy:     { label: "Neuropatia periferica",           category: "neurologic",       status: "active",    relevance: "medium", flags: [],                                                          multi: false },
  epilepsy:                  { label: "Epilessia",                       category: "neurologic",       status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  parkinson:                 { label: "Parkinson",                       category: "neurologic",       status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  multiple_sclerosis:        { label: "Sclerosi multipla",               category: "neurologic",       status: "active",    relevance: "high",   flags: ["contraindication_anti_tnf"],                               multi: false },
  dementia:                  { label: "Demenza / decadimento cognitivo", category: "neurologic",       status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  myopathy:                  { label: "Miopatia",                        category: "neurologic",       status: "active",    relevance: "medium", flags: [],                                                          multi: false },

  // ── Psichiatrico ────────────────────────────────────────────────────────────
  depression:                { label: "Depressione",                     category: "psychiatric",      status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  anxiety_disorder:          { label: "Disturbo ansioso",                category: "psychiatric",      status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  bipolar_disorder:          { label: "Disturbo bipolare",               category: "psychiatric",      status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  psychosis:                 { label: "Schizofrenia / Psicosi",          category: "psychiatric",      status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  sleep_disorder:            { label: "Disturbo del sonno",              category: "psychiatric",      status: "active",    relevance: "low",    flags: [],                                                          multi: false },

  // ── Osteo-metabolico ────────────────────────────────────────────────────────
  osteoporosis:              { label: "Osteoporosi",                     category: "osteo_rheum",      status: "active",    relevance: "medium", flags: ["bone_protection_needed"],                                  multi: false },
  osteopenia:                { label: "Osteopenia",                      category: "osteo_rheum",      status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  vitamin_d_deficiency:      { label: "Ipovitaminosi D cronica",         category: "osteo_rheum",      status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  fragility_fracture:        { label: "Frattura da fragilità",           category: "osteo_rheum",      status: "historical",relevance: "medium", flags: ["bone_protection_needed"],                                  multi: true  },

  // ── Endocrino ───────────────────────────────────────────────────────────────
  hypothyroidism:            { label: "Ipotiroidismo",                   category: "endocrine",        status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  hyperthyroidism:           { label: "Ipertiroidismo",                  category: "endocrine",        status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  autoimmune_thyroiditis:    { label: "Tiroidite autoimmune",            category: "endocrine",        status: "active",    relevance: "low",    flags: [],                                                          multi: false },
  adrenal_insufficiency:     { label: "Insufficienza surrenalica",       category: "endocrine",        status: "active",    relevance: "high",   flags: ["steroid_interaction"],                                     multi: false },
  hypogonadism:              { label: "Ipogonadismo",                    category: "endocrine",        status: "active",    relevance: "low",    flags: [],                                                          multi: false },
};

// ── Reverse lookup: lowercase label → canonical_name ──────────────────────────
export const LABEL_TO_CANONICAL = Object.fromEntries(
  Object.entries(CANONICAL_MAP).map(([k, v]) => [v.label.toLowerCase(), k])
);

// ── UI category tree (same shape as legacy COMORBIDITY_CATEGORIES) ─────────────
// Used by: FirstVisitPage, ComorbiditiesSection, DiagnosticDossierPanel (migration target)
export const COMORBIDITY_CATEGORIES = [
  { key: "cardiovascular",   label: "Cardiovascolare",              items: ["Ipertensione arteriosa","Fibrillazione atriale","Cardiopatia ischemica","Scompenso cardiaco","Valvulopatia","Pregresso ictus/TIA","TVP/TEP","Arteriopatia periferica"] },
  { key: "metabolic",        label: "Metabolico",                   items: ["Diabete tipo 2","Diabete tipo 1","Dislipidemia","Obesità","Sindrome metabolica","Iperuricemia / Gotta","Steatosi epatica"] },
  { key: "respiratory",      label: "Respiratorio",                 items: ["BPCO","Asma bronchiale","ILD / Fibrosi polmonare","Apnea ostruttiva del sonno","Ipertensione polmonare"] },
  { key: "infectious",       label: "Infettivologico",              items: ["Epatite B (HBsAg+)","Epatite B (HBcAb+)","Epatite C","HIV","TBC latente","Infezioni ricorrenti","Bronchiectasie"] },
  { key: "oncologic",        label: "Oncologico",                   items: ["Neoplasia solida pregressa","Neoplasia solida attiva","Neoplasia ematologica pregressa","Neoplasia ematologica attiva","Melanoma pregresso"] },
  { key: "gastrointestinal", label: "Gastroenterico",               items: ["Ulcera peptica","MRGE","Diverticolite / Diverticolosi","IBD (Crohn / RCU)","Epatopatia cronica","Cirrosi epatica"] },
  { key: "renal",            label: "Renale",                       items: ["IRC lieve (GFR 60–89)","IRC moderata (GFR 30–59)","IRC grave (GFR <30)","Dialisi","Trapianto renale","Proteinuria significativa"] },
  { key: "neurologic",       label: "Neurologico",                  items: ["Neuropatia periferica","Epilessia","Parkinson","Sclerosi multipla","Demenza / decadimento cognitivo","Miopatia"] },
  { key: "psychiatric",      label: "Psichiatrico",                 items: ["Depressione","Disturbo ansioso","Disturbo bipolare","Schizofrenia / Psicosi","Disturbo del sonno"] },
  { key: "osteo_rheum",      label: "Osteo-metabolico",             items: ["Osteoporosi","Osteopenia","Pregresse fratture da fragilità","Ipovitaminosi D cronica"] },
  { key: "endocrine",        label: "Endocrino",                    items: ["Ipotiroidismo","Ipertiroidismo","Tiroidite autoimmune","Insufficienza surrenalica","Ipogonadismo"] },
  { key: "allergologic",     label: "Allergologico",                items: ["Allergia a farmaci","Allergia alimentare","Asma allergica","Dermatite atopica"] },
  { key: "other",            label: "Altro",                        items: [] },
];

// Frequent conditions shown as quick-access chips in the UI
export const FREQUENT_CONDITIONS = [
  { label: "Ipertensione arteriosa",    catKey: "cardiovascular"   },
  { label: "Diabete tipo 2",            catKey: "metabolic"        },
  { label: "Dislipidemia",              catKey: "metabolic"        },
  { label: "Obesità",                   catKey: "metabolic"        },
  { label: "Osteoporosi",               catKey: "osteo_rheum"      },
  { label: "Cardiopatia ischemica",     catKey: "cardiovascular"   },
  { label: "Fibrillazione atriale",     catKey: "cardiovascular"   },
  { label: "BPCO",                      catKey: "respiratory"      },
  { label: "ILD / Fibrosi polmonare",   catKey: "respiratory"      },
  { label: "IRC moderata (GFR 30–59)",  catKey: "renal"            },
  { label: "Epatite B (HBsAg+)",        catKey: "infectious"       },
  { label: "Neoplasia solida pregressa",catKey: "oncologic"        },
  { label: "IBD (Crohn / RCU)",         catKey: "gastrointestinal" },
  { label: "Depressione",               catKey: "psychiatric"      },
];

// ── Search synonyms ──────────────────────────────────────────────────────────
// Keys: label string. Values: lowercase aliases for search matching.
export const CONDITION_SYNONYMS = {
  "Ipertensione arteriosa":          ["ipertensione", "ipa", "hta", "pressione alta", "iperteso"],
  "Fibrillazione atriale":           ["fa", "fibrillazione", "afib"],
  "Cardiopatia ischemica":           ["angina", "infarto", "ami", "stemi", "nstemi", "coronaropatia", "cao"],
  "Scompenso cardiaco":              ["hf", "insufficienza cardiaca", "scompenso"],
  "BPCO":                            ["bpco", "copd", "bronchite cronica ostruttiva", "enfisema"],
  "Asma bronchiale":                 ["asma"],
  "ILD / Fibrosi polmonare":         ["ild", "fibrosi", "interstiziopatia", "pneumopatia interstiziale", "uip", "nsip"],
  "Ipertensione polmonare":          ["ph", "pap", "iap"],
  "Diabete tipo 2":                  ["dm2", "diabete", "dmt2", "diabete mellito tipo 2", "t2dm"],
  "Diabete tipo 1":                  ["dm1", "diabete tipo 1", "dmt1", "t1dm"],
  "Dislipidemia":                    ["colesterolo", "trigliceridi", "ipercolesterolemia", "iperlipidemia"],
  "Obesità":                         ["obeso", "bmi"],
  "Iperuricemia / Gotta":            ["gotta", "acido urico", "iperuricemia", "gout"],
  "Steatosi epatica":                ["nafld", "nash", "fegato grasso", "steatosi"],
  "IBD (Crohn / RCU)":              ["crohn", "rcu", "ibd", "colite ulcerosa", "rettocolite"],
  "Epatite B (HBsAg+)":            ["epatite b", "hbv", "hbsag", "hbs", "hbsag positivo"],
  "Epatite B (HBcAb+)":            ["epatite b", "hbv", "hbcab", "hbc", "anti-hbc", "hbcab positivo"],
  "Epatite C":                      ["hcv", "epatite c"],
  "TBC latente":                    ["tbc", "tubercolosi", "quantiferon positivo", "mantoux", "ltbi"],
  "Pregresso ictus/TIA":            ["ictus", "tia", "stroke", "cerebrovascolari", "attacco ischemico"],
  "TVP/TEP":                        ["tvp", "tep", "trombosi venosa", "embolia polmonare", "tromboembolismo", "vte", "tromboembolia"],
  "IRC lieve (GFR 60–89)":          ["irc", "ckd", "insufficienza renale", "nefropatia"],
  "IRC moderata (GFR 30–59)":       ["irc", "ckd", "insufficienza renale", "nefropatia"],
  "IRC grave (GFR <30)":            ["irc", "ckd", "insufficienza renale", "nefropatia grave"],
  "Dialisi":                        ["emodialisi", "dialisi peritoneale", "hdp"],
  "Neoplasia solida pregressa":     ["tumore", "cancro", "neoplasia", "carcinoma", "oncologico", "k"],
  "Neoplasia solida attiva":        ["tumore", "cancro", "neoplasia", "carcinoma", "oncologico attivo"],
  "Neoplasia ematologica pregressa":["linfoma", "leucemia", "mieloma", "neoplasia ematologica"],
  "Neoplasia ematologica attiva":   ["linfoma attivo", "leucemia attiva", "mieloma attivo"],
  "Melanoma pregresso":             ["melanoma"],
  "Sclerosi multipla":              ["sm", "ms", "sclerosi multipla"],
  "Tiroidite autoimmune":           ["hashimoto", "tiroidite"],
  "Osteoporosi":                    ["op", "osteoporosi"],
  "Frattura da fragilità":          ["frattura", "frattura vertebrale", "frattura femore", "fractured"],
  "Epatopatia cronica":             ["cirrosi compensata", "epatite cronica", "hcc"],
  "Cirrosi epatica":                ["cirrosi"],
  "Arteria periferica":             ["pad", "arteriopatia"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a free-text label to a safe slug for custom_ canonical names.
 * e.g. "Sindrome di Sjögren" → "sindrome_di_sjogren"
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip diacritics
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60) || "condition";
}

/** True if the canonical allows multiple coexisting episodes per patient. */
export function isMultiInstance(canonical) {
  return CANONICAL_MAP[canonical]?.multi === true;
}

/** Default status string for a canonical, or "active" if not in registry. */
export function getDefaultStatus(canonical) {
  return CANONICAL_MAP[canonical]?.status ?? "active";
}

/** Flag array for a canonical, or [] if not in registry or custom. */
export function getConditionFlags(canonical) {
  return [...(CANONICAL_MAP[canonical]?.flags ?? [])];
}

/** Default relevance string for a canonical. */
export function getDefaultRelevance(canonical) {
  return CANONICAL_MAP[canonical]?.relevance ?? "low";
}

/**
 * Resolve a display label to its canonical_name.
 * Returns null if the label is not in the registry (caller should use buildCustomCondition).
 */
export function resolveCanonical(label) {
  return LABEL_TO_CANONICAL[label.toLowerCase()] ?? null;
}

/**
 * Build an upsert-ready condition payload from a known label string.
 * If label is not in the registry, falls back to buildCustomCondition.
 *
 * @param {string} label          - Display string, e.g. "Ipertensione arteriosa"
 * @param {string} [patientId]    - patient_id (required for API calls)
 * @param {string} [source]       - "prima_visita" | "follow_up" | "manual"
 * @param {object} [overrides]    - Any field overrides (status, onset_date, note…)
 * @returns {object}              - Payload for conditionsApi.upsert()
 */
export function buildConditionFromLabel(label, patientId = "", source = "prima_visita", overrides = {}) {
  const canonical = resolveCanonical(label);
  if (!canonical) {
    return buildCustomCondition(label, patientId, source, overrides);
  }
  const reg = CANONICAL_MAP[canonical];
  return {
    patient_id:                patientId,
    label:                     reg.label,           // use canonical label (normalised)
    canonical_name:            canonical,
    category:                  reg.category,
    status:                    reg.status,
    onset_date:                null,
    relevance_to_rheumatology: reg.relevance,
    source,
    note:                      null,
    flags:                     [...reg.flags],
    multi_instance:            reg.multi,
    ...overrides,
  };
}

/**
 * Build an upsert-ready payload for a condition not in the registry.
 * canonical_name will be "custom_<slug>".
 * No flags or enrichment; no alert rules will fire.
 */
export function buildCustomCondition(label, patientId = "", source = "manual", overrides = {}) {
  return {
    patient_id:                patientId,
    label:                     label.trim(),
    canonical_name:            `custom_${slugify(label)}`,
    category:                  "other",
    status:                    "active",
    onset_date:                null,
    relevance_to_rheumatology: "low",
    source,
    note:                      null,
    flags:                     [],
    multi_instance:            false,
    ...overrides,
  };
}

/**
 * Search helper — returns true if the condition label matches the query string,
 * considering both the label text and registered synonyms.
 * Replaces the legacy matchesComorbiditySearch in FirstVisitPage.
 */
export function matchesConditionSearch(label, query) {
  if (!query?.trim()) return true;
  const q = query.toLowerCase();
  if (label.toLowerCase().includes(q)) return true;
  return (CONDITION_SYNONYMS[label] ?? []).some(
    (s) => s.includes(q) || q.includes(s)
  );
}

// ── Phase 4a: text → structured condition resolution ─────────────────────────

/**
 * Extract status modifier and onset year from a raw Italian text fragment.
 * Examples:
 *   "pregressa neoplasia mammaria nel 2018" → { status: "historical", onset_date: "2018", cleanedText: "neoplasia mammaria" }
 *   "IRC moderata"                           → { status: null, onset_date: null, cleanedText: "IRC moderata" }
 *   "TBC latente"                            → { status: "latent", onset_date: null, cleanedText: "TBC" }
 *
 * @internal
 */
export function extractConditionModifiers(raw) {
  let text = raw.trim();
  let status = null;
  let onset_date = null;

  // Status prefix — order matters: check historical before latent
  if (/^pregress[aeio]\s+/i.test(text)) {
    status = "historical";
    text = text.replace(/^pregress[aeio]\s+/i, "").trim();
  } else if (/\blatent[ei]?\b/i.test(text)) {
    status = "latent";
    text = text.replace(/\blatent[ei]?\b/i, "").trim();
  } else if (/^risolt[ao]\s+/i.test(text)) {
    status = "resolved";
    text = text.replace(/^risolt[ao]\s+/i, "").trim();
  }

  // Year — "nel 2018", "del 2018", "anno 2018", or bare year at word boundary
  const yearRe = /(?:(?:nel|del|dall[''`]?anno|anno)\s+)?(\b(?:19|20)\d{2}\b)/i;
  const yearMatch = text.match(yearRe);
  if (yearMatch) {
    onset_date = yearMatch[1];
    text = text.replace(yearMatch[0], "").trim().replace(/\s{2,}/g, " ");
  }

  return { cleanedText: text.trim(), status, onset_date };
}

/**
 * Find the best matching canonical_name for a cleaned query string.
 * Tries in order:
 *   1. Exact label match (LABEL_TO_CANONICAL)
 *   2. Synonym / partial label search (matchesConditionSearch)
 *
 * Returns canonical_name string or null if no match found.
 *
 * @internal
 */
export function findBestCanonical(query) {
  if (!query?.trim()) return null;
  const q = query.trim();

  // 1. Exact (case-insensitive) label match
  const exact = resolveCanonical(q);
  if (exact) return exact;

  // 2. Scan all labels with synonym-aware search
  for (const [canonical, meta] of Object.entries(CANONICAL_MAP)) {
    if (matchesConditionSearch(meta.label, q)) {
      return canonical;
    }
  }

  return null;
}

/**
 * Resolve an array of raw Italian comorbidity strings (e.g. from the text parser)
 * to structured condition payloads ready for conditionsApi.upsert().
 *
 * Each item gets a `_raw` field (original text) and `_skip: false` sentinel
 * so it can be used directly in the import review flow.
 *
 * patientId should be "" when called from the parser (no patient context yet).
 * VisitImportButton._applyOneDraft() must inject patient_id before upserting.
 *
 * @param {string[]} rawItems   - Array of raw text fragments
 * @param {string}  [patientId] - Patient ID (empty string if called pre-patient)
 * @param {string}  [source]    - "import" | "prima_visita" | "manual"
 * @returns {object[]}          - ConditionPayload[] with _raw + _skip
 */
export function resolveComorbidita(rawItems, patientId = "", source = "import") {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return [];

  return rawItems
    .map((raw) => {
      if (!raw?.trim()) return null;

      const { cleanedText, status: detectedStatus, onset_date } = extractConditionModifiers(raw);

      const canonical = findBestCanonical(cleanedText);

      let payload;
      if (canonical) {
        const reg = CANONICAL_MAP[canonical];
        // Detected status (e.g. "pregressa") overrides registry default;
        // if no modifier found, registry default stands.
        payload = buildConditionFromLabel(reg.label, patientId, source, {
          ...(detectedStatus ? { status: detectedStatus } : {}),
          ...(onset_date     ? { onset_date }              : {}),
        });
      } else {
        // No match → custom condition; use cleaned text as label
        payload = buildCustomCondition(
          cleanedText || raw.trim(),
          patientId,
          source,
          {
            ...(detectedStatus ? { status: detectedStatus } : {}),
            ...(onset_date     ? { onset_date }              : {}),
          }
        );
      }

      return {
        ...payload,
        _raw:  raw,    // original fragment — shown in review UI
        _skip: false,
      };
    })
    .filter(Boolean);
}
