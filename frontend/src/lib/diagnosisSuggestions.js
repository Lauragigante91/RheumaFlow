// Suggerimenti automatici di indici clinimetrici e criteri classificativi
// in base alla diagnosi del paziente (matching su keyword)

const RULES = [
  {
    keywords: ["artrite reumatoide", "ar ", "rheumatoid", "early arthritis"],
    indices: ["das28_esr", "das28_crp", "cdai", "sdai", "haq"],
    criteria: ["acr_eular_2010_ra"],
    diseaseLabel: "Artrite Reumatoide",
  },
  {
    keywords: ["psoriasica", "psoriasic", "psa", "artrite psor"],
    indices: ["dapsa", "pasi", "haq", "das28_esr"],
    criteria: ["caspar_psa"],
    diseaseLabel: "Artrite Psoriasica",
  },
  {
    keywords: ["spondilo", "spondilite anchilosante", "axspa", "spa ", "anchilosante", "as "],
    indices: ["basdai", "asdas_crp", "basfi", "basmi", "schober"],
    criteria: ["asas_axspa", "asas_ibp"],
    diseaseLabel: "Spondiloartrite",
  },
  {
    keywords: ["lupus", "les", "sle "],
    indices: ["sledai"],
    criteria: ["acr_eular_2019_sle"],
    diseaseLabel: "LES",
  },
  {
    keywords: ["sjogren", "sjögren", "ssp"],
    indices: ["essdai", "esspri"],
    criteria: ["acr_eular_2016_sjogren"],
    diseaseLabel: "Sindrome di Sjögren",
  },
  {
    keywords: ["vasculit", "anca", "gpa", "mpa", "egpa", "wegener", "churg"],
    indices: ["bvas"],
    criteria: ["acr_eular_2022_gpa", "acr_eular_2022_mpa", "acr_eular_2022_egpa"],
    diseaseLabel: "Vasculiti ANCA",
  },
  {
    keywords: ["miosit", "dermatomiosit", "polimiosit", "iim"],
    indices: ["mmt8"],
    criteria: ["acr_eular_2017_iim"],
    diseaseLabel: "Miositi",
  },
  {
    keywords: ["fibromialg", "fibromyalg"],
    indices: ["fiqr"],
    criteria: ["acr_2016_fm"],
    diseaseLabel: "Fibromialgia",
  },
  {
    keywords: ["sclerosi sistem", "sclerodermia", "ssc ", "scleroderma", "vedoss", "raynaud"],
    indices: ["mrss", "capillaroscopy", "haq"],
    criteria: ["acr_eular_2013_ssc", "vedoss_2011"],
    diseaseLabel: "Sclerosi Sistemica",
  },
  {
    keywords: ["gotta", "gout"],
    indices: [],
    criteria: ["acr_eular_2015_gout"],
    diseaseLabel: "Gotta",
  },
  {
    keywords: ["polimialgia", "pmr"],
    indices: [],
    criteria: ["acr_eular_2012_pmr"],
    diseaseLabel: "Polimialgia Reumatica",
  },
  {
    keywords: ["behçet", "behcet"],
    indices: [],
    criteria: ["icbd_2014_behcet"],
    diseaseLabel: "Malattia di Behçet",
  },
  {
    keywords: ["igg4", "igg-4"],
    indices: [],
    criteria: ["acr_eular_2019_igg4"],
    diseaseLabel: "IgG4-RD",
  },
  {
    keywords: ["still", "aosd"],
    indices: [],
    criteria: ["yamaguchi_aosd"],
    diseaseLabel: "Still dell'adulto",
  },
  {
    keywords: ["psoriasi"],
    indices: ["pasi"],
    criteria: [],
    diseaseLabel: "Psoriasi",
  },
  {
    keywords: ["antifosfolipid", "antiphospholipid", "aps", "apl ", "anti-fosfolipid", "trombofilia autoimmune"],
    indices: [],
    criteria: ["acr_eular_2023_aps"],
    diseaseLabel: "Sindrome da anticorpi antifosfolipidi",
  },
];

export function suggestForDiagnosis(diagnosis) {
  if (!diagnosis) return { indices: [], criteria: [], matchedRules: [] };
  const text = String(diagnosis).toLowerCase();
  const matched = RULES.filter((r) => r.keywords.some((k) => text.includes(k.toLowerCase())));
  const indices = Array.from(new Set(matched.flatMap((m) => m.indices)));
  const criteria = Array.from(new Set(matched.flatMap((m) => m.criteria)));
  return { indices, criteria, matchedRules: matched };
}
