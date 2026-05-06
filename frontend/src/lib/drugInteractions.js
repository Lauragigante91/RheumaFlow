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
    mode: "any",
    matchOther: [],
    title: "JAK inibitori",
    note: "Controindicati i vaccini VIVI ATTENUATI (MMR, varicella, febbre gialla) durante terapia. Verificare stato vaccinale prima dell'inizio. Attenzione al rischio MACE/neoplasie/TEV (ORAL Surveillance).",
  },
  {
    id: "jaki_live_dup",  // duplicate guard for single-drug trigger
    severity: "moderate",
    drugs: ["Tofacitinib", "Baricitinib", "Upadacitinib", "Filgotinib"],
    mode: "any",
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
    mode: "any",
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

  // ===== Cotrimoxazolo + Warfarin =====
  {
    id: "tmp_smx_warfarin",
    severity: "major",
    drugs: ["Warfarin"],
    matchOther: ["cotrimoxazolo", "trimetoprim", "sulfametoxazolo", "bactrim"],
    title: "Warfarin + Cotrimoxazolo",
    note: "TMP/SMX inibisce CYP2C9 e disloca warfarin dalle proteine plasmatiche → forte aumento dell'INR e rischio emorragico. Evitare l'associazione; se indispensabile, ridurre warfarin del 25-50% e controllare INR ogni 2-3 giorni.",
  },

  // ===== Biologici / JAKi e TBC latente =====
  {
    id: "biologic_tb_screening",
    severity: "major",
    drugs: ["Adalimumab", "Etanercept", "Infliximab", "Certolizumab pegol", "Golimumab", "Tocilizumab", "Sarilumab", "Tofacitinib", "Baricitinib", "Upadacitinib", "Filgotinib", "Ustekinumab", "Guselkumab", "Risankizumab", "Secukinumab", "Ixekizumab", "Bimekizumab"],
    mode: "any",
    matchOther: [],
    title: "Biologico/JAKi - Screening TBC latente obbligatorio",
    note: "Prima dell'inizio: Quantiferon (o IGRA) + Rx torace. In caso di TBC latente, profilassi con isoniazide 300 mg/die + vitamina B6 per ≥1 mese prima del biologico, totale 6-9 mesi. Massimo rischio con TNFi, intermedio con IL-6/JAKi, minimo con IL-17/IL-23.",
  },

  // ===== MTX + Probenecid =====
  {
    id: "mtx_probenecid",
    severity: "major",
    drugs: ["Methotrexate"],
    matchOther: ["probenecid"],
    title: "MTX + Probenecid",
    note: "Probenecid blocca la secrezione tubulare renale di MTX → tossicità severa (mielosoppressione, mucosite). Evitare l'associazione.",
  },

  // ===== JAKi + Rifampicina =====
  {
    id: "jaki_rifampin",
    severity: "moderate",
    drugs: ["Tofacitinib", "Upadacitinib", "Filgotinib"],
    matchOther: ["rifampicina", "carbamazepina", "fenitoina", "fenobarbital"],
    title: "JAKi + Induttori CYP3A4",
    note: "Riduzione significativa dei livelli plasmatici di tofacitinib/upadacitinib (CYP3A4-dipendenti) → perdita efficacia. Considerare alternative o aumentare la dose secondo SmPC.",
  },

  // ===== SSZ + Allopurinolo / 6-MP =====
  {
    id: "ssz_azathioprine",
    severity: "moderate",
    drugs: ["Sulfasalazina"],
    matchOther: ["azatioprina", "6-mercaptopurina"],
    title: "Sulfasalazina + Azatioprina/6-MP",
    note: "Aumentato rischio di mielosoppressione (entrambi inibiscono TPMT/sintesi nucleotidica). Monitorare emocromo ogni 2-4 settimane all'inizio.",
  },

  // ===== GC + Vaccini vivi =====
  {
    id: "gc_live_vaccines",
    severity: "major",
    drugs: ["Prednisone", "Metilprednisolone (bolo)"],
    mode: "any",
    matchOther: [],
    title: "Glucocorticoidi - Vaccini vivi",
    note: "Vaccini VIVI controindicati se prednisone ≥20 mg/die o equivalente per >2 settimane. Attendere ≥1 mese dalla sospensione. Vaccini inattivati permessi (efficacia ridotta a dosi alte).",
  },

  // ===== MMF + Sali di ferro =====
  {
    id: "mmf_iron",
    severity: "minor",
    drugs: ["Micofenolato Mofetil"],
    matchOther: ["ferro", "solfato ferroso", "fumarato ferroso"],
    title: "MMF + Sali di ferro orali",
    note: "I sali di ferro chelano il MMF nel tratto GI → riduzione assorbimento. Somministrare a distanza ≥2 ore.",
  },

  // ===== Idrossiclorochina + Digossina =====
  {
    id: "hcq_digoxin",
    severity: "moderate",
    drugs: ["Idrossiclorochina"],
    matchOther: ["digossina"],
    title: "Idrossiclorochina + Digossina",
    note: "Aumento dei livelli sierici di digossina (≥30%) per inibizione P-gp. Monitorare digossinemia e sintomi di tossicità (nausea, aritmie, alterazioni visive).",
  },

  // ===== Denosumab + Immunosoppressori =====
  {
    id: "denosumab_immunosuppression",
    severity: "moderate",
    drugs: ["Denosumab"],
    matchOther: ["methotrexate", "leflunomide", "azatioprina", "ciclofosfamide", "micofenolato", "ciclosporina", "tacrolimus", "tofacitinib", "baricitinib", "upadacitinib", "rituximab", "abatacept", "infliximab", "adalimumab", "etanercept"],
    title: "Denosumab + Immunosoppressori/Biologici",
    note: "Rischio additivo di infezioni gravi (cellulite, endocardite). Screening odontoiatrico (rischio ONJ) prima dell'inizio. Evitare procedure dentali invasive durante la terapia.",
  },

  // ===== Anti-IL-6 + Statine (CYP) =====
  {
    id: "il6_cyp_statin",
    severity: "moderate",
    drugs: ["Tocilizumab", "Sarilumab"],
    matchOther: ["atorvastatina", "simvastatina", "ciclosporina", "warfarin"],
    title: "Anti-IL-6 + substrati CYP3A4/CYP2C9",
    note: "IL-6 sopprime CYP450 epatici; bloccando IL-6 si normalizza il metabolismo → calo dei livelli plasmatici di simvastatina/atorvastatina, ciclosporina, warfarin. Monitorare INR/livelli, riadeguare la dose dopo l'inizio del biologico.",
  },

  // ===== Abatacept + TNFi =====
  {
    id: "abatacept_tnfi",
    severity: "major",
    drugs: ["Abatacept"],
    matchOther: ["adalimumab", "etanercept", "infliximab", "certolizumab", "golimumab"],
    title: "Abatacept + TNF-alfa inibitore",
    note: "ATTAIN/ASSURE: combinazione associata ad aumento di infezioni gravi senza beneficio clinico aggiuntivo. EVITARE l'associazione.",
  },

  // ===== Anifrolumab + Vaccini vivi =====
  {
    id: "anifrolumab_live",
    severity: "major",
    drugs: ["Anifrolumab"],
    matchOther: [],
    title: "Anifrolumab - Vaccini vivi e infezioni Herpes Zoster",
    note: "Controindicati i vaccini VIVI durante terapia. Aumentato rischio di Herpes Zoster: considerare Shingrix (inattivato) prima dell'inizio. Screening per epatite B.",
  },

  // ===== Tofacitinib + Contraccettivi orali =====
  {
    id: "tofa_oral_contraceptives",
    severity: "minor",
    drugs: ["Tofacitinib"],
    matchOther: ["etinilestradiolo", "levonorgestrel", "drospirenone"],
    title: "Tofacitinib + Contraccettivi ormonali",
    note: "Modesta riduzione dei livelli di etinilestradiolo (~6%). Effetto clinicamente trascurabile, ma in donne ad alto rischio TEV preferire metodi non ormonali (specie con ORAL Surveillance MACE/TEV).",
  },

  // ===== Baricitinib + Probenecid =====
  {
    id: "baricitinib_probenecid",
    severity: "moderate",
    drugs: ["Baricitinib"],
    matchOther: ["probenecid"],
    title: "Baricitinib + Probenecid",
    note: "Probenecid inibisce OAT3 → raddoppio dei livelli plasmatici di baricitinib. Ridurre baricitinib a 2 mg/die durante uso concomitante.",
  },

  // ===== Tofacitinib + Fluconazolo =====
  {
    id: "tofa_fluconazole",
    severity: "moderate",
    drugs: ["Tofacitinib"],
    matchOther: ["fluconazolo", "ketoconazolo", "itraconazolo", "voriconazolo"],
    title: "Tofacitinib + Inibitori CYP3A4/CYP2C19",
    note: "Aumento esposizione tofacitinib. Ridurre la dose a 5 mg/die (da 10 mg BID per RCU) o 5 mg/die (da 5 mg BID per RA).",
  },

  // ===== Anakinra/Canakinumab + Biologici =====
  {
    id: "il1_with_other_biologic",
    severity: "major",
    drugs: ["Anakinra", "Canakinumab"],
    matchOther: ["adalimumab", "etanercept", "infliximab", "tocilizumab", "rituximab", "abatacept"],
    title: "Anti-IL-1 + altri biologici",
    note: "Combinazioni mai testate in trial; aumento sostanziale del rischio infettivo senza efficacia provata. EVITARE.",
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
      // No matchOther: either "any" mode (any single drug from list triggers)
      // or strict multi-drug (all listed drugs must be present together).
      if (inter.mode === "any" || inter.drugs.length === 1) {
        if (drugHits.length >= 1) {
          if (!seen.has(inter.id)) { triggered.push(inter); seen.add(inter.id); }
        }
      } else if (inter.drugs.length >= 2) {
        if (drugHits.length === inter.drugs.length) {
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
