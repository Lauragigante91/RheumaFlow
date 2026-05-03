// Database di interazioni farmacologiche rilevanti in reumatologia.
// Ogni interazione ha un livello di severità e una nota clinica in italiano.

export const SEVERITY = {
  major: { label: "Maggiore", color: "#DC2626", bg: "#FEE2E2", border: "#FCA5A5" },
  moderate: { label: "Moderata", color: "#D97706", bg: "#FEF3C7", border: "#FCD34D" },
  minor: { label: "Minore", color: "#2563EB", bg: "#DBEAFE", border: "#93C5FD" },
};

// match: sottoinsieme di nomi (case-insensitive) che attiva l'alert
// note: cosa fare (monitoraggio, aggiustamento dose, alternative)
export const INTERACTIONS = [
  // ===== MTX =====
  {
    id: "mtx_tmp_smx",
    severity: "major",
    drugs: ["Methotrexate"],
    matchOther: ["cotrimoxazolo", "trimetoprim", "sulfametoxazolo", "bactrim"],
    title: "MTX + TMP/SMX (cotrimoxazolo)",
    note: "Rischio di soppressione midollare severa e deficit di folati. EVITARE associazione; se indispensabile monitorare emocromo settimanale e supplementare folati.",
  },
  {
    id: "mtx_nsaid",
    severity: "moderate",
    drugs: ["Methotrexate"],
    matchOther: ["ibuprofene", "naprossene", "diclofenac", "ketoprofene", "indometacina", "etoricoxib", "celecoxib", "piroxicam", "nimesulide"],
    title: "MTX + FANS",
    note: "I FANS riducono la clearance renale del MTX (soprattutto ad alte dosi >25 mg/sett). Alle dosi reumatologiche (≤25 mg/sett) il rischio è basso ma monitorare funzione renale ed emocromo.",
  },
  {
    id: "mtx_ppi",
    severity: "minor",
    drugs: ["Methotrexate"],
    matchOther: ["omeprazolo", "esomeprazolo", "lansoprazolo", "pantoprazolo", "rabeprazolo"],
    title: "MTX + PPI",
    note: "I PPI possono ridurre l'eliminazione renale di MTX (soprattutto ad alte dosi). Effetto clinicamente limitato alle dosi reumatologiche; preferire ranitidina/famotidina se necessario.",
  },
  {
    id: "mtx_leflunomide",
    severity: "major",
    drugs: ["Methotrexate", "Leflunomide"],
    matchOther: [],
    title: "MTX + Leflunomide",
    note: "Rischio aumentato di epatotossicità e soppressione midollare. Combinazione controversa, usare solo in casi selezionati con monitoraggio stretto (ALT/AST, emocromo ogni 2-4 settimane).",
  },

  // ===== Colchicina =====
  {
    id: "colchicine_macrolide",
    severity: "major",
    drugs: ["Colchicina"],
    matchOther: ["claritromicina", "eritromicina", "azitromicina", "telitromicina"],
    title: "Colchicina + Macrolidi",
    note: "I macrolidi (specialmente claritromicina) inibiscono CYP3A4 e P-glicoproteina → tossicità grave della colchicina (mielosoppressione, rabdomiolisi, morte). EVITARE associazione soprattutto in insufficienza renale/epatica.",
  },
  {
    id: "colchicine_cyclosporine",
    severity: "major",
    drugs: ["Colchicina", "Ciclosporina"],
    matchOther: [],
    title: "Colchicina + Ciclosporina",
    note: "Rischio di miotossicità e tossicità multi-organo. Se indispensabile, ridurre colchicina a 0.5 mg ogni 2-3 giorni e monitorare CK.",
  },
  {
    id: "colchicine_statin",
    severity: "moderate",
    drugs: ["Colchicina"],
    matchOther: ["atorvastatina", "simvastatina", "rosuvastatina", "pravastatina", "lovastatina", "fluvastatina"],
    title: "Colchicina + Statine",
    note: "Rischio additivo di miopatia/rabdomiolisi. Monitorare CK e sintomi muscolari; valutare dose-riduzione.",
  },

  // ===== Allopurinolo =====
  {
    id: "allopurinol_azathioprine",
    severity: "major",
    drugs: ["Allopurinolo"],
    matchOther: ["azatioprina", "6-mercaptopurina"],
    title: "Allopurinolo + Azatioprina/6-MP",
    note: "Allopurinolo inibisce xantina-ossidasi → accumulo di 6-MP attiva: mielotossicità severa. Se indispensabile combinare, ridurre AZA a 25% della dose e monitorare emocromo ogni 1-2 settimane. Alternativa: Febuxostat (stessa cautela).",
  },
  {
    id: "allopurinol_warfarin",
    severity: "moderate",
    drugs: ["Allopurinolo"],
    matchOther: ["warfarin"],
    title: "Allopurinolo + Warfarin",
    note: "Possibile aumento dell'effetto anticoagulante. Monitorare INR più frequentemente all'inizio della terapia.",
  },

  // ===== JAKi =====
  {
    id: "jaki_live_vaccines",
    severity: "major",
    drugs: ["Tofacitinib", "Baricitinib", "Upadacitinib", "Filgotinib"],
    matchOther: [],
    title: "JAK inibitori",
    note: "Controindicati i vaccini VIVI ATTENUATI (MMR, varicella, febbre gialla) durante terapia. Verificare stato vaccinale prima dell'inizio. Attenzione al rischio MACE/neoplasie/TEV (ORAL Surveillance).",
  },
  {
    id: "jaki_live_dup",  // duplicate guard for single-drug trigger
    severity: "moderate",
    drugs: ["Tofacitinib", "Baricitinib", "Upadacitinib", "Filgotinib"],
    matchOther: ["warfarin", "apixaban", "rivaroxaban", "dabigatran", "edoxaban"],
    title: "JAK inibitori + Anticoagulanti",
    note: "I JAKi aumentano il rischio di TEV (ORAL Surveillance). In pazienti in anticoagulazione, valutare bilancio rischio/beneficio e preferire TNFi/altri bDMARDs se fattibile.",
  },

  // ===== HCQ =====
  {
    id: "hcq_qt",
    severity: "moderate",
    drugs: ["Idrossiclorochina"],
    matchOther: ["azitromicina", "amiodarone", "sotalolo", "citalopram", "escitalopram", "ondansetron", "claritromicina"],
    title: "Idrossiclorochina + farmaci allungamento QT",
    note: "Rischio di prolungamento QT e aritmie (torsades). ECG baseline e monitoraggio se terapia prolungata; considerare alternative.",
  },

  // ===== Biologici / Vaccini vivi =====
  {
    id: "biologic_live_vaccine",
    severity: "major",
    drugs: ["Adalimumab", "Etanercept", "Infliximab", "Certolizumab pegol", "Golimumab", "Tocilizumab", "Sarilumab", "Rituximab", "Abatacept", "Belimumab", "Anifrolumab", "Secukinumab", "Ixekizumab", "Bimekizumab", "Ustekinumab", "Guselkumab", "Risankizumab", "Anakinra", "Canakinumab"],
    matchOther: [],
    title: "Biologico - vaccinazioni",
    note: "Controindicati i vaccini VIVI ATTENUATI (MMR, varicella, BCG, febbre gialla). Eseguire vaccinazioni vivi ALMENO 4 settimane prima dell'inizio biologico. Rituximab: attendere ≥6 mesi dall'ultima infusione.",
  },

  // ===== Rituximab-specifici =====
  {
    id: "rituximab_live",
    severity: "major",
    drugs: ["Rituximab"],
    matchOther: [],
    title: "Rituximab - vaccinazioni e risposta vaccinale",
    note: "Riduce drasticamente la risposta a nuovi vaccini per ≥6 mesi. Vaccinare idealmente 4-6 settimane prima dell'infusione. In donne fertili: contraccezione per 12 mesi dopo l'ultimo ciclo.",
  },

  // ===== GC + altro =====
  {
    id: "gc_nsaid",
    severity: "moderate",
    drugs: ["Prednisone", "Metilprednisolone (bolo)"],
    matchOther: ["ibuprofene", "naprossene", "diclofenac", "ketoprofene", "indometacina", "etoricoxib", "celecoxib", "piroxicam", "nimesulide"],
    title: "Glucocorticoidi + FANS",
    note: "Aumento rischio di ulcera/sanguinamento gastrointestinale. Considerare gastroprotezione con PPI.",
  },
  {
    id: "gc_warfarin",
    severity: "moderate",
    drugs: ["Prednisone", "Metilprednisolone (bolo)"],
    matchOther: ["warfarin"],
    title: "Glucocorticoidi + Warfarin",
    note: "Possibile alterazione dell'INR (in entrambe le direzioni). Monitorare INR più frequentemente.",
  },

  // ===== CYC + allopurinol =====
  {
    id: "cyc_allopurinol",
    severity: "moderate",
    drugs: ["Ciclofosfamide"],
    matchOther: ["allopurinolo"],
    title: "Ciclofosfamide + Allopurinolo",
    note: "Aumentata mielosoppressione. Monitorare emocromo più frequentemente o considerare alternativa.",
  },

  // ===== Tacrolimus CYP3A4 =====
  {
    id: "tacrolimus_cyp3a4",
    severity: "major",
    drugs: ["Tacrolimus", "Ciclosporina"],
    matchOther: ["diltiazem", "verapamil", "claritromicina", "eritromicina", "ketoconazolo", "itraconazolo", "fluconazolo", "voriconazolo"],
    title: "Tacrolimus/Ciclosporina + inibitori CYP3A4",
    note: "Aumento significativo dei livelli ematici. Monitorare concentrazione plasmatica; ridurre dose del 25-50% all'inizio.",
  },
  {
    id: "tacrolimus_rifampin",
    severity: "major",
    drugs: ["Tacrolimus", "Ciclosporina"],
    matchOther: ["rifampicina", "carbamazepina", "fenitoina", "fenobarbital"],
    title: "Tacrolimus/Ciclosporina + induttori CYP3A4",
    note: "Riduzione significativa dei livelli: rischio rigetto/perdita di efficacia. Aumentare dose e monitorare concentrazione plasmatica.",
  },

  // ===== NSAID + anticoagulants =====
  {
    id: "nsaid_anticoag",
    severity: "major",
    drugs: ["Ibuprofene", "Naprossene", "Diclofenac", "Ketoprofene", "Indometacina", "Etoricoxib"],
    matchOther: ["warfarin", "apixaban", "rivaroxaban", "dabigatran", "edoxaban"],
    title: "FANS + Anticoagulanti",
    note: "Aumento marcato del rischio emorragico. Evitare associazione; se indispensabile, usare FANS a breve emivita al dosaggio minimo + PPI.",
  },

  // ===== MMF + Magnesio/Colestiramina =====
  {
    id: "mmf_antacids",
    severity: "minor",
    drugs: ["Micofenolato Mofetil"],
    matchOther: ["magnesio", "alluminio", "colestiramina"],
    title: "MMF + Antiacidi/Colestiramina",
    note: "Riduzione dell'assorbimento. Somministrare a distanza ≥2 ore dall'antiacido; evitare colestiramina.",
  },

  // ===== Leflunomide =====
  {
    id: "leflunomide_warfarin",
    severity: "moderate",
    drugs: ["Leflunomide"],
    matchOther: ["warfarin"],
    title: "Leflunomide + Warfarin",
    note: "Possibile aumento dell'effetto anticoagulante. Monitorare INR all'inizio.",
  },
];

// Given list of therapy names (active), returns list of triggered interactions.
export function detectInteractions(therapyNames) {
  if (!therapyNames || therapyNames.length < 1) return [];
  const norm = therapyNames.map((n) => (n || "").toLowerCase().trim()).filter(Boolean);
  const triggered = [];
  const seen = new Set();
  for (const inter of INTERACTIONS) {
    const drugNames = inter.drugs.map((d) => d.toLowerCase());
    const otherNames = (inter.matchOther || []).map((d) => d.toLowerCase());
    // How many of inter.drugs are in the therapy list
    const drugHits = drugNames.filter((d) =>
      norm.some((t) => t.includes(d) || d.includes(t))
    );
    if (otherNames.length === 0) {
      // Multi-drug: all drugs must be present
      if (inter.drugs.length >= 2) {
        if (drugHits.length === inter.drugs.length) {
          if (!seen.has(inter.id)) { triggered.push(inter); seen.add(inter.id); }
        }
      } else {
        // Single-drug "info" (e.g. JAKi vaccines warning)
        if (drugHits.length >= 1) {
          if (!seen.has(inter.id)) { triggered.push(inter); seen.add(inter.id); }
        }
      }
    } else {
      // at least 1 of inter.drugs AND at least 1 of matchOther
      const otherHits = otherNames.filter((o) => norm.some((t) => t.includes(o)));
      if (drugHits.length >= 1 && otherHits.length >= 1) {
        if (!seen.has(inter.id)) { triggered.push(inter); seen.add(inter.id); }
      }
    }
  }
  // Sort: major > moderate > minor
  const order = { major: 0, moderate: 1, minor: 2 };
  return triggered.sort((a, b) => order[a.severity] - order[b.severity]);
}
