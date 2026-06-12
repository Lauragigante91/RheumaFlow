// Database di farmaci reumatologici con posologie standard per indicazione.
// Nota: posologie indicative "in scheda tecnica"; il giudizio clinico è sempre prevalente.

// indicazioni possibili
export const INDICATIONS = {
  RA: "Artrite Reumatoide",
  PsA: "Artrite Psoriasica",
  axSpA: "Spondiloartrite assiale (AS/nr-axSpA)",
  PsO: "Psoriasi a placche",
  JIA: "Artrite idiopatica giovanile",
  IBD: "Malattia infiammatoria intestinale",
  SSc: "Sclerosi sistemica",
  SSc_ILD: "Sclerosi sistemica con ILD",
  SSc_PAH: "Ipertensione polmonare arteriosa (PAH/SSc)",
  SSc_Vasc: "Vasculopatia/Fenomeno di Raynaud (SSc)",
  SLE: "Lupus eritematoso sistemico",
  LES_renal: "Nefrite lupica",
  AAV: "Vasculiti ANCA-associate",
  GCA: "Arterite gigantocellulare",
  TAK: "Arterite di Takayasu",
  Behcet: "Malattia di Behçet",
  Sjogren: "Sindrome di Sjögren",
  Gout: "Gotta",
  PMR: "Polimialgia reumatica",
  Myositis: "Miosite/dermatomiosite",
  AOSD: "Malattia di Still dell'adulto",
  Uveitis: "Uveite non infettiva",
  HS: "Idradenite suppurativa",
  PPF_ILD: "PPF/ILD progressiva",
  FMF: "Febbre mediterranea familiare",
  CAPS: "Sindromi CAPS",
  TRAPS: "TRAPS",
  HIDS: "HIDS/MKD",
  EGPA: "EGPA/Sindrome di Churg-Strauss",
};

// Helper per mostrare etichetta compatta "Ind → Dose"
// Struttura drug:
// { name, category, routes[], defaultIndication, notes, regimens: [{ indication, dose, frequency, route, loading?, note, schedule? }] }
// schedule: { phases: [{ label, type, dayOffsets?, interval?, count?, dose? }] }
export const DRUGS = [
  // ======= csDMARDs =======
  {
    name: "Methotrexate",
    category: "csDMARD",
    notes: "Sempre con Acido folico 5 mg ≥24h dopo MTX.",
    regimens: [
      { indication: "RA",       dose: "15 mg", frequency: "Settimanale", route: "orale o s.c.", note: "Titolare fino a 25 mg/sett se necessario" },
      { indication: "PsA",      dose: "15 mg", frequency: "Settimanale", route: "orale o s.c." },
      { indication: "JIA",      dose: "10-15 mg/m²", frequency: "Settimanale", route: "orale o s.c." },
      { indication: "Myositis", dose: "15-25 mg", frequency: "Settimanale", route: "orale o s.c." },
      { indication: "SLE",      dose: "10-20 mg", frequency: "Settimanale", route: "orale o s.c." },
      { indication: "Behcet",   dose: "7.5-15 mg", frequency: "Settimanale", route: "orale" },
    ],
  },
  { name: "Leflunomide", category: "csDMARD", regimens: [
    { indication: "RA",  dose: "20 mg", frequency: "Giornaliera", route: "orale", loading: "100 mg/die x 3 gg (opzionale)" },
    { indication: "PsA", dose: "20 mg", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Sulfasalazina", category: "csDMARD", regimens: [
    { indication: "RA",    dose: "2-3 g", frequency: "Giornaliera (in 2-3 somministrazioni)", route: "orale" },
    { indication: "PsA",   dose: "2 g",   frequency: "Giornaliera", route: "orale" },
    { indication: "axSpA", dose: "2-3 g", frequency: "Giornaliera", route: "orale", note: "Solo SpA con artrite periferica" },
    { indication: "JIA",   dose: "30-50 mg/kg/die", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Idrossiclorochina", category: "csDMARD", regimens: [
    { indication: "SLE",     dose: "200-400 mg", frequency: "Giornaliera", route: "orale", note: "Max 5 mg/kg/die (peso reale) per minimizzare rischio retinico" },
    { indication: "RA",      dose: "200-400 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "Sjogren", dose: "200-400 mg", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Azatioprina", category: "csDMARD", regimens: [
    { indication: "SLE",      dose: "1-3 mg/kg/die",  frequency: "Giornaliera", route: "orale", note: "Tipicamente 50-150 mg/die" },
    { indication: "AAV",      dose: "1-2 mg/kg/die",  frequency: "Giornaliera", route: "orale", note: "Mantenimento post-CYC" },
    { indication: "Behcet",   dose: "2-3 mg/kg/die",  frequency: "Giornaliera", route: "orale" },
    { indication: "Myositis", dose: "1-2 mg/kg/die",  frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Micofenolato Mofetil", category: "csDMARD", regimens: [
    { indication: "SSc_ILD",   dose: "2-3 g", frequency: "Giornaliera (in 2 somministrazioni)", route: "orale" },
    { indication: "LES_renal", dose: "2-3 g", frequency: "Giornaliera (in 2 somministrazioni)", route: "orale", note: "Induzione nefrite lupica" },
    { indication: "SLE",       dose: "1-2 g", frequency: "Giornaliera", route: "orale" },
    { indication: "AAV",       dose: "2-3 g", frequency: "Giornaliera", route: "orale" },
    { indication: "Myositis",  dose: "2-3 g", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Ciclosporina", category: "csDMARD", regimens: [
    { indication: "SLE",     dose: "2.5-4 mg/kg/die", frequency: "Giornaliera (in 2 somministrazioni)", route: "orale" },
    { indication: "Behcet",  dose: "3-5 mg/kg/die",   frequency: "Giornaliera", route: "orale" },
    { indication: "Uveitis", dose: "3-5 mg/kg/die",   frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Tacrolimus", category: "csDMARD", regimens: [
    { indication: "LES_renal", dose: "0.05-0.1 mg/kg/die", frequency: "Giornaliera (in 2 somministrazioni)", route: "orale", note: "Target livelli 4-8 ng/mL" },
    { indication: "Myositis",  dose: "0.06-0.1 mg/kg/die", frequency: "Giornaliera", route: "orale", note: "Target 5-10 ng/mL in MDA5-ILD" },
  ]},
  { name: "Ciclofosfamide", category: "csDMARD", regimens: [
    { indication: "AAV",      dose: "15 mg/kg (max 1.2 g)",  frequency: "Ogni 2-3 settimane", route: "e.v.", note: "6 boli NIH/EUVAS" },
    { indication: "LES_renal",dose: "500 mg",                frequency: "Ogni 2 settimane",   route: "e.v.", note: "6 boli (schema EuroLupus)" },
    { indication: "SSc_ILD",  dose: "500-750 mg/m²",         frequency: "Mensile",            route: "e.v.", note: "6-12 mesi" },
  ]},

  // ======= Glucocorticoids =======
  { name: "Prednisone", category: "glucocorticoid", regimens: [
    { indication: "RA",       dose: "5-10 mg",             frequency: "Giornaliera", route: "orale", note: "Bridging temporaneo, tapering rapido" },
    { indication: "SLE",      dose: "0.5-1 mg/kg/die",     frequency: "Giornaliera", route: "orale", note: "Dose in base a severità" },
    { indication: "AAV",      dose: "1 mg/kg/die (max 60-80 mg)", frequency: "Giornaliera", route: "orale" },
    { indication: "GCA",      dose: "40-60 mg",            frequency: "Giornaliera", route: "orale" },
    { indication: "PMR",      dose: "12.5-25 mg",          frequency: "Giornaliera", route: "orale", note: "Tapering in 12-24 mesi" },
    { indication: "Myositis", dose: "1 mg/kg/die",         frequency: "Giornaliera", route: "orale" },
    { indication: "AOSD",     dose: "0.5-1 mg/kg/die",     frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Metilprednisolone (bolo)", category: "glucocorticoid", regimens: [
    { indication: "SLE",      dose: "500-1000 mg", frequency: "Giornaliera x 3 gg", route: "e.v." },
    { indication: "AAV",      dose: "500-1000 mg", frequency: "Giornaliera x 3 gg", route: "e.v." },
    { indication: "GCA",      dose: "500-1000 mg", frequency: "Giornaliera x 3 gg", route: "e.v.", note: "Se perdita visiva" },
    { indication: "Myositis", dose: "500-1000 mg", frequency: "Giornaliera x 3 gg", route: "e.v." },
  ]},

  // ======= TNF inhibitors =======
  {
    name: "Adalimumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/humira",
    notes: "Nessuna induzione standard nelle indicazioni reumatologiche (RA/PsA/SpA). Dose di carico prevista per IBD e HS.",
    regimens: [
      { indication: "RA",      dose: "40 mg", frequency: "Ogni 2 settimane", route: "s.c." },
      { indication: "PsA",     dose: "40 mg", frequency: "Ogni 2 settimane", route: "s.c." },
      { indication: "axSpA",   dose: "40 mg", frequency: "Ogni 2 settimane", route: "s.c." },
      { indication: "Uveitis", dose: "80 mg loading → 40 mg", frequency: "Ogni 2 settimane", route: "s.c.",
        loading: "80 mg sett 0, poi 40 mg ogni 2 sett da sett 1",
        schedule: {
          phases: [
            { label: "Dose carico", type: "loading",     dayOffsets: [0],  dose: "80 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 14 }, count: 7, dose: "40 mg" },
          ],
        },
      },
      { indication: "JIA",     dose: "20 mg (peso 10-30 kg) / 40 mg (>30 kg)", frequency: "Ogni 2 settimane", route: "s.c." },
      { indication: "IBD",     dose: "160 mg → 80 mg → 40 mg", frequency: "Ogni 2 settimane", route: "s.c.",
        loading: "160 mg sett 0, 80 mg sett 2",
        schedule: {
          phases: [
            { label: "Dose carico", type: "loading",     dayOffsets: [0],  dose: "160 mg" },
            { label: "Induzione",   type: "induction",   dayOffsets: [14], dose: "80 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 14 }, count: 7, dose: "40 mg" },
          ],
        },
      },
      { indication: "HS",      dose: "160 mg → 80 mg → 40 mg", frequency: "Settimanale", route: "s.c.",
        loading: "160 mg sett 0, 80 mg sett 2, poi 40 mg/sett",
        schedule: {
          phases: [
            { label: "Dose carico",  type: "loading",    dayOffsets: [0],  dose: "160 mg" },
            { label: "Induzione",    type: "induction",  dayOffsets: [14], dose: "80 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 7 }, count: 8, dose: "40 mg" },
          ],
        },
      },
    ],
  },
  {
    name: "Etanercept",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/enbrel",
    notes: "Nessuna induzione — mantenimento diretto.",
    regimens: [
      { indication: "RA",    dose: "50 mg", frequency: "Settimanale", route: "s.c." },
      { indication: "PsA",   dose: "50 mg", frequency: "Settimanale", route: "s.c." },
      { indication: "axSpA", dose: "50 mg", frequency: "Settimanale", route: "s.c." },
      { indication: "JIA",   dose: "0.4 mg/kg (max 25 mg) x 2/sett oppure 0.8 mg/kg (max 50 mg)", frequency: "Settimanale", route: "s.c." },
    ],
  },
  {
    name: "Infliximab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/remicade",
    regimens: [
      { indication: "RA",      dose: "3 mg/kg", frequency: "Sett 0, 2, 6 poi ogni 8 settimane", route: "e.v.",
        schedule: {
          phases: [
            { label: "Induzione", type: "induction",   dayOffsets: [0, 14, 42], dose: "3 mg/kg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 6, dose: "3 mg/kg" },
          ],
        },
      },
      { indication: "PsA",     dose: "5 mg/kg", frequency: "Sett 0, 2, 6 poi ogni 6-8 settimane", route: "e.v.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 42], dose: "5 mg/kg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 6, dose: "5 mg/kg" },
          ],
        },
      },
      { indication: "axSpA",   dose: "5 mg/kg", frequency: "Sett 0, 2, 6 poi ogni 6-8 settimane", route: "e.v.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 42], dose: "5 mg/kg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 6, dose: "5 mg/kg" },
          ],
        },
      },
      { indication: "Behcet",  dose: "5 mg/kg", frequency: "Sett 0, 2, 6 poi ogni 8 settimane", route: "e.v.", note: "Uveite posteriore / vascolare",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 42], dose: "5 mg/kg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 6, dose: "5 mg/kg" },
          ],
        },
      },
      { indication: "Uveitis", dose: "5 mg/kg", frequency: "Ogni 6-8 settimane", route: "e.v.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 42], dose: "5 mg/kg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 6, dose: "5 mg/kg" },
          ],
        },
      },
      { indication: "TAK",     dose: "5 mg/kg", frequency: "Ogni 6-8 settimane", route: "e.v.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 42], dose: "5 mg/kg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 6, dose: "5 mg/kg" },
          ],
        },
      },
      { indication: "IBD",     dose: "5 mg/kg", frequency: "Sett 0, 2, 6 poi ogni 8 settimane", route: "e.v.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 42], dose: "5 mg/kg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 6, dose: "5 mg/kg" },
          ],
        },
      },
    ],
  },
  {
    name: "Certolizumab pegol",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/cimzia",
    regimens: [
      { indication: "RA",    dose: "400 mg → 200 mg", frequency: "Ogni 2 settimane (o 400 mg ogni 4 sett)", route: "s.c.",
        loading: "400 mg settimana 0, 2, 4",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 28], dose: "400 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 14 }, count: 7, dose: "200 mg" },
          ],
        },
      },
      { indication: "axSpA", dose: "200 mg ogni 2 sett o 400 mg ogni 4 sett", frequency: "Vedi dose", route: "s.c.",
        loading: "400 mg settimana 0, 2, 4",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 28], dose: "400 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 14 }, count: 7, dose: "200 mg" },
          ],
        },
      },
      { indication: "PsA",   dose: "200 mg ogni 2 sett o 400 mg ogni 4 sett", frequency: "Vedi dose", route: "s.c.",
        loading: "400 mg settimana 0, 2, 4",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 28], dose: "400 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 14 }, count: 7, dose: "200 mg" },
          ],
        },
      },
    ],
  },
  {
    name: "Golimumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/simponi",
    regimens: [
      { indication: "RA",    dose: "50 mg", frequency: "Mensile", route: "s.c." },
      { indication: "PsA",   dose: "50 mg", frequency: "Mensile", route: "s.c." },
      { indication: "axSpA", dose: "50 mg", frequency: "Mensile", route: "s.c." },
      { indication: "JIA",   dose: "50 mg (30-80 kg) / 100 mg (>80 kg)", frequency: "Mensile", route: "s.c." },
      { indication: "RA",    dose: "2 mg/kg", frequency: "Sett 0, 4 poi ogni 8 settimane", route: "e.v.", note: "Formulazione EV",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 28], dose: "2 mg/kg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 5, dose: "2 mg/kg" },
          ],
        },
      },
    ],
  },

  // ======= IL-6 =======
  {
    name: "Tocilizumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/roactemra",
    notes: "Nessuna vera induzione — mantenimento diretto a intervallo regolare.",
    regimens: [
      { indication: "RA",      dose: "8 mg/kg (max 800 mg)", frequency: "Ogni 4 settimane", route: "e.v.",
        schedule: {
          phases: [
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 7 },
          ],
        },
      },
      { indication: "RA",      dose: "162 mg", frequency: "Settimanale", route: "s.c." },
      { indication: "GCA",     dose: "162 mg", frequency: "Settimanale", route: "s.c.", note: "Con tapering steroideo — reminder: schema riduzione GC associato" },
      { indication: "SSc_ILD", dose: "162 mg", frequency: "Settimanale", route: "s.c." },
      { indication: "JIA",     dose: "8-12 mg/kg (sJIA) / 8 mg/kg (poly-JIA)", frequency: "Ogni 2-4 settimane", route: "e.v." },
      { indication: "AOSD",    dose: "8 mg/kg ogni 2-4 sett o 162 mg/sett", frequency: "Vedi dose", route: "e.v. o s.c." },
    ],
  },
  {
    name: "Sarilumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/kevzara",
    notes: "Nessuna induzione — mantenimento diretto.",
    regimens: [
      { indication: "RA", dose: "200 mg", frequency: "Ogni 2 settimane", route: "s.c." },
    ],
  },

  // ======= CD20 / B-cell =======
  {
    name: "Rituximab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/mabthera",
    notes: "Non 'induzione' ma ciclo terapeutico: 2 infusioni a distanza di 14 gg. Retreatment possibile dopo almeno 6 mesi.",
    regimens: [
      { indication: "RA",       dose: "1000 mg x 2 (day 1 e 15)", frequency: "Cicli ogni 6 mesi", route: "e.v.",
        schedule: {
          phases: [
            { label: "Ciclo — dose 1", type: "cycle", dayOffsets: [0],   dose: "1000 mg" },
            { label: "Ciclo — dose 2", type: "cycle", dayOffsets: [14],  dose: "1000 mg" },
            { label: "Retreatment 1",  type: "cycle", dayOffsets: [180], dose: "1000 mg" },
            { label: "Retreatment 2",  type: "cycle", dayOffsets: [194], dose: "1000 mg" },
            { label: "Retreatment 3",  type: "cycle", dayOffsets: [360], dose: "1000 mg" },
            { label: "Retreatment 4",  type: "cycle", dayOffsets: [374], dose: "1000 mg" },
          ],
        },
      },
      { indication: "AAV",      dose: "375 mg/m² settimanale x 4 OPPURE 1000 mg x 2", frequency: "Induzione", route: "e.v.",
        schedule: {
          phases: [
            { label: "Ciclo — dose 1", type: "cycle", dayOffsets: [0],  dose: "1000 mg" },
            { label: "Ciclo — dose 2", type: "cycle", dayOffsets: [14], dose: "1000 mg" },
          ],
        },
      },
      { indication: "SLE",      dose: "1000 mg x 2 (day 1 e 15)", frequency: "Cicli ogni 6 mesi (off-label)", route: "e.v.",
        schedule: {
          phases: [
            { label: "Ciclo — dose 1", type: "cycle", dayOffsets: [0],  dose: "1000 mg" },
            { label: "Ciclo — dose 2", type: "cycle", dayOffsets: [14], dose: "1000 mg" },
          ],
        },
      },
      { indication: "Sjogren",  dose: "1000 mg x 2", frequency: "Ogni 6 mesi (off-label)", route: "e.v.",
        schedule: {
          phases: [
            { label: "Ciclo — dose 1", type: "cycle", dayOffsets: [0],  dose: "1000 mg" },
            { label: "Ciclo — dose 2", type: "cycle", dayOffsets: [14], dose: "1000 mg" },
          ],
        },
      },
      { indication: "Myositis", dose: "1000 mg x 2 (day 1 e 15)", frequency: "Cicli 6-12 mesi", route: "e.v.",
        schedule: {
          phases: [
            { label: "Ciclo — dose 1", type: "cycle", dayOffsets: [0],  dose: "1000 mg" },
            { label: "Ciclo — dose 2", type: "cycle", dayOffsets: [14], dose: "1000 mg" },
          ],
        },
      },
    ],
  },

  // ======= CTLA-4 =======
  {
    name: "Abatacept",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/orencia",
    regimens: [
      { indication: "RA",  dose: "125 mg", frequency: "Settimanale", route: "s.c." },
      { indication: "RA",  dose: "10 mg/kg", frequency: "Sett 0, 2, 4 poi ogni 4 settimane", route: "e.v.",
        note: "Induzione breve (W0/W2/W4) poi mantenimento mensile",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 28], dose: "10 mg/kg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 6, dose: "10 mg/kg" },
          ],
        },
      },
      { indication: "PsA", dose: "125 mg settimanale o 10 mg/kg ogni 4 sett", frequency: "Vedi dose", route: "s.c. o e.v.",
        schedule: {
          phases: [
            { label: "Induzione (EV opzionale)", type: "induction",   dayOffsets: [0, 14, 28], dose: "10 mg/kg" },
            { label: "Mantenimento",             type: "maintenance", interval: { days: 28 }, count: 6, dose: "10 mg/kg" },
          ],
        },
      },
      { indication: "JIA", dose: "10 mg/kg (peso <75 kg)", frequency: "Ogni 4 settimane", route: "e.v.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 28], dose: "10 mg/kg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 6, dose: "10 mg/kg" },
          ],
        },
      },
    ],
  },

  // ======= BLyS / IFN =======
  {
    name: "Belimumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/benlysta",
    regimens: [
      { indication: "SLE",       dose: "10 mg/kg", frequency: "Sett 0, 2, 4 poi ogni 4 settimane", route: "e.v.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 28], dose: "10 mg/kg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 7, dose: "10 mg/kg" },
          ],
        },
      },
      { indication: "SLE",       dose: "200 mg", frequency: "Settimanale", route: "s.c.", note: "Nessuna vera induzione SC — mantenimento diretto settimanale" },
      { indication: "LES_renal", dose: "10 mg/kg e.v. o 200 mg s.c./sett", frequency: "Vedi dose", route: "e.v. o s.c.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 28], dose: "10 mg/kg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 7, dose: "10 mg/kg" },
          ],
        },
      },
    ],
  },
  {
    name: "Anifrolumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/saphnelo",
    notes: "Nessuna induzione — infusione EV ogni 4 settimane da subito.",
    regimens: [
      { indication: "SLE", dose: "300 mg", frequency: "Ogni 4 settimane", route: "e.v.",
        schedule: {
          phases: [
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 7 },
          ],
        },
      },
    ],
  },

  // ======= IL-17 =======
  {
    name: "Secukinumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/cosentyx",
    notes: "Dosaggi DIVERSI per indicazione. Induzione settimanale sett 0-4 in tutte le indicazioni principali.",
    regimens: [
      { indication: "PsO",   dose: "300 mg", frequency: "Sett 0,1,2,3,4 poi mensile", route: "s.c.",
        loading: "5 dosi di carico settimanali (sett 0-4)",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 7, 14, 21, 28], dose: "300 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 7, dose: "300 mg" },
          ],
        },
      },
      { indication: "PsA",   dose: "150 mg (300 mg se PsO coesistente)", frequency: "Sett 0,1,2,3,4 poi mensile", route: "s.c.",
        loading: "5 dosi di carico settimanali (sett 0-4)",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 7, 14, 21, 28], dose: "150 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 7, dose: "150 mg" },
          ],
        },
      },
      { indication: "axSpA", dose: "150 mg", frequency: "Sett 0,1,2,3,4 poi mensile", route: "s.c.",
        loading: "5 dosi di carico settimanali (sett 0-4)",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 7, 14, 21, 28], dose: "150 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 7, dose: "150 mg" },
          ],
        },
      },
      { indication: "HS",    dose: "300 mg", frequency: "Settimanale x 5 poi ogni 4 sett (o 2 sett se inadeguata risposta)", route: "s.c.",
        loading: "5 dosi settimanali poi mensile o bisettimanale",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 7, 14, 21, 28], dose: "300 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 7, dose: "300 mg" },
          ],
        },
      },
    ],
  },
  {
    name: "Ixekizumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/taltz",
    regimens: [
      { indication: "PsO",   dose: "160 mg → 80 mg", frequency: "Loading + 80 mg ogni 2 sett x 12 sett, poi ogni 4 sett", route: "s.c.",
        loading: "160 mg a sett 0",
        schedule: {
          phases: [
            { label: "Dose carico",  type: "loading",     dayOffsets: [0],  dose: "160 mg" },
            { label: "Induzione",    type: "induction",   dayOffsets: [14, 28, 42, 56, 70, 84], dose: "80 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 6, dose: "80 mg" },
          ],
        },
      },
      { indication: "PsA",   dose: "160 mg → 80 mg", frequency: "Loading + 80 mg ogni 4 settimane", route: "s.c.",
        loading: "160 mg a sett 0",
        schedule: {
          phases: [
            { label: "Dose carico",  type: "loading",     dayOffsets: [0], dose: "160 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 8, dose: "80 mg" },
          ],
        },
      },
      { indication: "axSpA", dose: "160 mg → 80 mg", frequency: "Loading + 80 mg ogni 4 settimane", route: "s.c.",
        loading: "160 mg a sett 0",
        schedule: {
          phases: [
            { label: "Dose carico",  type: "loading",     dayOffsets: [0], dose: "160 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 8, dose: "80 mg" },
          ],
        },
      },
    ],
  },
  {
    name: "Bimekizumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/bimzelx",
    regimens: [
      {
        indication: "PsO",
        dose: "320 mg",
        frequency: "Sett 0,4,8,12,16 poi ogni 8 sett",
        route: "s.c.",
        note: "Dopo sett 16 può essere valutato il passaggio a 160 mg ogni 4 settimane in base alla risposta clinica",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 28, 56, 84, 112], dose: "320 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 6,  dose: "320 mg" },
          ],
        },
      },
      {
        indication: "PsA",
        dose: "160 mg",
        frequency: "Ogni 4 settimane",
        route: "s.c.",
        note: "Nei pazienti con psoriasi cutanea estesa può essere valutato lo schema della psoriasi (320 mg, sett 0,4,8,12,16 poi ogni 8 sett)",
      },
      { indication: "axSpA", dose: "160 mg", frequency: "Ogni 4 settimane", route: "s.c." },
      {
        indication: "HS",
        dose: "320 mg",
        frequency: "Ogni 2 sett x 16 sett, poi ogni 4 sett",
        route: "s.c.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 28, 42, 56, 70, 84, 98], dose: "320 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 6, dose: "320 mg" },
          ],
        },
      },
    ],
  },

  // ======= IL-23 =======
  {
    name: "Ustekinumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/stelara",
    regimens: [
      { indication: "PsO",   dose: "45 mg (<100 kg) / 90 mg (>100 kg)", frequency: "Sett 0, 4 poi ogni 12 sett", route: "s.c.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 28], dose: "45-90 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 84 }, count: 5, dose: "45-90 mg" },
          ],
        },
      },
      { indication: "PsA",   dose: "45 mg (<100 kg) / 90 mg (>100 kg)", frequency: "Sett 0, 4 poi ogni 12 sett", route: "s.c.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 28], dose: "45-90 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 84 }, count: 5, dose: "45-90 mg" },
          ],
        },
      },
      { indication: "IBD",   dose: "~6 mg/kg e.v. (induzione) → 90 mg s.c. ogni 8 sett", frequency: "Induzione e mantenimento", route: "e.v. poi s.c.",
        loading: "Dose EV unica peso-dipendente sett 0; poi SC ogni 8 sett da sett 8",
        schedule: {
          phases: [
            { label: "Induzione EV", type: "induction",   dayOffsets: [0],  dose: "~6 mg/kg e.v." },
            { label: "Mantenimento SC", type: "maintenance", interval: { days: 56 }, count: 6, dose: "90 mg s.c." },
          ],
        },
      },
    ],
  },
  {
    name: "Guselkumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/tremfya",
    regimens: [
      { indication: "PsO",   dose: "100 mg", frequency: "Sett 0, 4 poi ogni 8 settimane", route: "s.c.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 28], dose: "100 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 6, dose: "100 mg" },
          ],
        },
      },
      { indication: "PsA",   dose: "100 mg", frequency: "Sett 0, 4 poi ogni 8 settimane", route: "s.c.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 28], dose: "100 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 6, dose: "100 mg" },
          ],
        },
      },
    ],
  },
  {
    name: "Risankizumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/skyrizi",
    regimens: [
      { indication: "PsO",   dose: "150 mg", frequency: "Sett 0, 4 poi ogni 12 settimane", route: "s.c.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 28], dose: "150 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 84 }, count: 5, dose: "150 mg" },
          ],
        },
      },
      { indication: "PsA",   dose: "150 mg", frequency: "Sett 0, 4 poi ogni 12 settimane", route: "s.c.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 28], dose: "150 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 84 }, count: 5, dose: "150 mg" },
          ],
        },
      },
    ],
  },
  {
    name: "Tildrakizumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/ilumetri",
    regimens: [
      { indication: "PsO",   dose: "100 mg (200 mg se grave)", frequency: "Sett 0, 4 poi ogni 12 settimane", route: "s.c.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 28], dose: "100 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 84 }, count: 5, dose: "100 mg" },
          ],
        },
      },
    ],
  },

  // ======= IL-1 =======
  { name: "Anakinra", category: "bDMARD", smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/kineret", regimens: [
    { indication: "RA",    dose: "100 mg", frequency: "Giornaliera", route: "s.c." },
    { indication: "AOSD",  dose: "100-200 mg", frequency: "Giornaliera", route: "s.c." },
    { indication: "Gout",  dose: "100 mg", frequency: "Giornaliera x 3-5 gg", route: "s.c.", note: "Attacco acuto refrattario" },
    { indication: "CAPS",  dose: "1-2 mg/kg/die (max 100-200 mg)", frequency: "Giornaliera", route: "s.c." },
    { indication: "FMF",   dose: "100 mg", frequency: "Giornaliera", route: "s.c.", note: "Refrattaria colchicina" },
  ]},
  { name: "Canakinumab", category: "bDMARD", smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/ilaris", regimens: [
    { indication: "AOSD",  dose: "4 mg/kg (max 300 mg)", frequency: "Ogni 4 settimane", route: "s.c." },
    { indication: "CAPS",  dose: "150 mg (o 2 mg/kg se <40 kg)", frequency: "Ogni 8 settimane", route: "s.c." },
    { indication: "FMF",   dose: "150 mg (2 mg/kg se <40 kg)", frequency: "Ogni 4-8 settimane", route: "s.c." },
    { indication: "TRAPS", dose: "150 mg", frequency: "Ogni 4-8 settimane", route: "s.c." },
    { indication: "HIDS",  dose: "150 mg", frequency: "Ogni 4-8 settimane", route: "s.c." },
    { indication: "Gout",  dose: "150 mg", frequency: "Singola dose al bisogno", route: "s.c." },
  ]},

  // ======= JAK inhibitors =======
  { name: "Tofacitinib",   category: "tsDMARD", smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/xeljanz", notes: "Nessuna induzione. Attenzione MACE/malignità/TEV in pazienti a rischio.", regimens: [
    { indication: "RA",    dose: "5 mg",  frequency: "2 volte/die (o 11 mg XR 1/die)", route: "orale" },
    { indication: "PsA",   dose: "5 mg",  frequency: "2 volte/die", route: "orale" },
    { indication: "axSpA", dose: "5 mg",  frequency: "2 volte/die", route: "orale" },
    { indication: "JIA",   dose: "5 mg (>40 kg) scalato per peso", frequency: "2 volte/die", route: "orale" },
    { indication: "IBD",   dose: "10 mg 2 volte/die (induzione) → 5 mg 2 volte/die", frequency: "Vedi dose", route: "orale", note: "Colite ulcerosa" },
  ]},
  { name: "Baricitinib",   category: "tsDMARD", smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/olumiant", notes: "Nessuna induzione.", regimens: [
    { indication: "RA",  dose: "4 mg", frequency: "Giornaliera (2 mg se ≥75 aa o ClCr 30-60)", route: "orale" },
    { indication: "JIA", dose: "Peso-dipendente (2-4 mg)", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Upadacitinib",  category: "tsDMARD", smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/rinvoq", notes: "Nessuna induzione. Posologia uniforme 15 mg/die per indicazioni reumatologiche.", regimens: [
    { indication: "RA",    dose: "15 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "PsA",   dose: "15 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "axSpA", dose: "15 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "IBD",   dose: "45 mg induzione 8 sett → 15-30 mg mantenimento", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Filgotinib",    category: "tsDMARD", smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/jyseleca", notes: "Nessuna induzione.", regimens: [
    { indication: "RA", dose: "200 mg (100 mg se ≥75 aa)", frequency: "Giornaliera", route: "orale" },
  ]},

  // ======= PDE4 =======
  { name: "Apremilast",    category: "tsDMARD", smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/otezla", regimens: [
    { indication: "PsO",    dose: "30 mg", frequency: "2 volte/die", route: "orale", loading: "Titolazione 10-50 mg in 6 giorni" },
    { indication: "PsA",    dose: "30 mg", frequency: "2 volte/die", route: "orale" },
    { indication: "Behcet", dose: "30 mg", frequency: "2 volte/die", route: "orale", note: "Aftosi orale refrattaria" },
  ]},

  // ======= Biologici IBD / Vasculiti =======
  {
    name: "Vedolizumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/entyvio",
    regimens: [
      { indication: "IBD",   dose: "300 mg", frequency: "Sett 0, 2, 6 poi ogni 8 settimane", route: "e.v.",
        schedule: {
          phases: [
            { label: "Induzione",    type: "induction",   dayOffsets: [0, 14, 42], dose: "300 mg" },
            { label: "Mantenimento", type: "maintenance", interval: { days: 56 }, count: 6, dose: "300 mg" },
          ],
        },
      },
    ],
  },
  {
    name: "Mepolizumab",
    category: "bDMARD",
    smpcUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/nucala",
    notes: "Schema mensile fisso — nessuna induzione.",
    regimens: [
      { indication: "EGPA", dose: "300 mg", frequency: "Ogni 4 settimane", route: "s.c.",
        schedule: {
          phases: [
            { label: "Mantenimento", type: "maintenance", interval: { days: 28 }, count: 7 },
          ],
        },
      },
    ],
  },

  // ======= PAH / SSc vasculopathy — ERA =======
  { name: "Bosentan",    category: "other", notes: "Controllo LFT mensile. Teratogeno — contraccezione obbligatoria.", regimens: [
    { indication: "SSc_PAH",  dose: "62.5 mg → 125 mg", frequency: "2 volte/die", route: "orale", loading: "62.5 mg 2/die x 4 sett poi 125 mg 2/die" },
    { indication: "SSc_Vasc", dose: "62.5 mg",           frequency: "2 volte/die", route: "orale", note: "Ulcere digitali — prevenzione" },
  ]},
  { name: "Ambrisentan", category: "other", notes: "LFT non richiesto di routine (meno epatotossico). Teratogeno.", regimens: [
    { indication: "SSc_PAH",  dose: "5 mg", frequency: "Giornaliera (max 10 mg)", route: "orale" },
  ]},
  { name: "Macitentan",  category: "other", notes: "LFT basale; teratogeno — contraccezione mensile confermata.", regimens: [
    { indication: "SSc_PAH",  dose: "10 mg", frequency: "Giornaliera", route: "orale" },
  ]},

  // ======= PAH — PDE5 inibitori =======
  { name: "Sildenafil",  category: "other", regimens: [
    { indication: "SSc_PAH",  dose: "20 mg",    frequency: "3 volte/die", route: "orale" },
    { indication: "SSc_Vasc", dose: "25-50 mg", frequency: "2-3 volte/die", route: "orale", note: "Raynaud grave refrattario" },
  ]},
  { name: "Tadalafil",   category: "other", regimens: [
    { indication: "SSc_PAH",  dose: "40 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "SSc_Vasc", dose: "20 mg", frequency: "Giornaliera", route: "orale", note: "Raynaud grave" },
  ]},

  // ======= PAH — sGC stimolatore =======
  { name: "Riociguat",   category: "other", notes: "Controindicato con PDE5i. Titolazione lenta. Teratogeno.", regimens: [
    { indication: "SSc_PAH",  dose: "1 mg → max 2.5 mg", frequency: "3 volte/die", route: "orale", loading: "Titolazione: +0.5 mg ogni 2 sett se tollerato" },
  ]},

  // ======= PAH — agonista recettore prostaciclina =======
  { name: "Selexipag",   category: "other", notes: "Titolazione individuale; effetti collaterali prostaciclinici comuni.", regimens: [
    { indication: "SSc_PAH",  dose: "200 µg → max 1600 µg", frequency: "2 volte/die", route: "orale", loading: "+200 µg ogni sett fino a dose max tollerata" },
  ]},

  // ======= PAH — analoghi prostaciclinica =======
  { name: "Iloprost",      category: "other", regimens: [
    { indication: "SSc_PAH",  dose: "2.5-5 µg/sessione", frequency: "6-9 sessioni/die (inalato)", route: "inalatorio" },
    { indication: "SSc_Vasc", dose: "0.5-2 ng/kg/min x 6h", frequency: "Cicli 5 gg/mese", route: "e.v.", note: "Ulcere digitali/crisi vasospastica grave" },
  ]},
  { name: "Epoprostenol",  category: "other", notes: "Infusione e.v. continua; pompa dedicata. Emivita brevissima.", regimens: [
    { indication: "SSc_PAH",  dose: "2 ng/kg/min (start)", frequency: "Infusione continua e.v.", route: "e.v.", loading: "Titolazione progressiva in ambiente specialistico" },
  ]},
  { name: "Treprostinil",  category: "other", regimens: [
    { indication: "SSc_PAH",  dose: "1.25 ng/kg/min (start)", frequency: "Infusione continua s.c./e.v.", route: "s.c. o e.v.", loading: "Titolazione in centri specialistici" },
    { indication: "SSc_PAH",  dose: "54 µg (3 inalazioni 4 volte/die)", frequency: "4 volte/die", route: "inalatorio", note: "Formulazione inalatoria (Tyvaso)" },
  ]},

  // ======= Raynaud / vasculopatia SSc =======
  { name: "Nifedipina",    category: "other", regimens: [
    { indication: "SSc_Vasc", dose: "30-60 mg", frequency: "Giornaliera (formulazione CR/LA)", route: "orale", note: "Prima scelta nel Raynaud — formulazione a rilascio prolungato" },
  ]},
  { name: "Amlodipina",    category: "other", regimens: [
    { indication: "SSc_Vasc", dose: "5-10 mg", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Losartan",      category: "other", regimens: [
    { indication: "SSc_Vasc", dose: "25-50 mg", frequency: "Giornaliera", route: "orale", note: "Alternativa ai calcio-antagonisti nel Raynaud" },
  ]},
  { name: "Fluoxetina",    category: "other", regimens: [
    { indication: "SSc_Vasc", dose: "20 mg", frequency: "Giornaliera", route: "orale", note: "SSRI — efficacia nel Raynaud da vasodilatazione serotoninergica" },
  ]},

  // ======= Antifibrotici =======
  { name: "Nintedanib",    category: "other", regimens: [
    { indication: "SSc_ILD", dose: "150 mg", frequency: "2 volte/die", route: "orale", note: "Ridurre a 100 mg 2/die se intolleranza" },
    { indication: "PPF_ILD", dose: "150 mg", frequency: "2 volte/die", route: "orale" },
  ]},
  { name: "Pirfenidone",   category: "other", regimens: [
    { indication: "PPF_ILD", dose: "801 mg (3 cps da 267 mg)", frequency: "3 volte/die", route: "orale", loading: "Titolazione in 2 sett" },
  ]},

  // ======= Altri =======
  { name: "Colchicina",    category: "antiinflammatory", regimens: [
    { indication: "FMF",    dose: "1-2 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "Gout",   dose: "1 mg iniziale + 0.5 mg dopo 1h (acuto); 0.5-1 mg/die (profilassi)", frequency: "Vedi dose", route: "orale" },
    { indication: "Behcet", dose: "1-2 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "PMR",    dose: "—", frequency: "—", route: "—", note: "Non di routine" },
  ]},
  { name: "Allopurinolo",  category: "other", regimens: [
    { indication: "Gout", dose: "100 mg (start) titolando a 300-600 mg/die", frequency: "Giornaliera", route: "orale", note: "Target uricemia <6 mg/dL (<5 in gotta tofacea)" },
  ]},
  { name: "Febuxostat",    category: "other", regimens: [
    { indication: "Gout", dose: "80-120 mg", frequency: "Giornaliera", route: "orale" },
  ]},

  // ======= FANS =======
  { name: "Naprossene",    category: "NSAID", regimens: [
    { indication: "axSpA", dose: "500-1000 mg", frequency: "Giornaliera (in 2 somministrazioni)", route: "orale" },
    { indication: "RA",    dose: "500-1000 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "Gout",  dose: "500 mg",      frequency: "2 volte/die (acuto)", route: "orale" },
  ]},
  { name: "Indometacina",  category: "NSAID", regimens: [
    { indication: "Gout",  dose: "50 mg", frequency: "3 volte/die (acuto)", route: "orale" },
    { indication: "axSpA", dose: "75-150 mg", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Etoricoxib",    category: "NSAID", regimens: [
    { indication: "RA",    dose: "60-90 mg",  frequency: "Giornaliera", route: "orale" },
    { indication: "axSpA", dose: "60-90 mg",  frequency: "Giornaliera", route: "orale" },
    { indication: "Gout",  dose: "120 mg",    frequency: "Giornaliera (max 8 gg)", route: "orale" },
  ]},
];

export function formatRegimen(r) {
  const parts = [r.dose, r.frequency, r.route ? `(${r.route})` : null].filter(Boolean);
  return parts.join(" ");
}

export function findDrug(name) {
  if (!name) return null;
  return DRUGS.find((d) => d.name.toLowerCase() === name.toLowerCase());
}

// Category → color used for therapy pills (also re-used in Gantt chart legend)
export const CATEGORY_COLORS = {
  csDMARD: "#0A2540",
  bDMARD: "#0EA5E9",
  tsDMARD: "#8B5CF6",
  glucocorticoid: "#F59E0B",
  NSAID: "#10B981",
  analgesic: "#6B7280",
  supportive: "#9CA3AF",
  other: "#6B7280",
};

export function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || "#6B7280";
}

// ── Single-source drug alias map ──────────────────────────────────────────────
// Maps every known lowercase alias / brand name → { canonical, category }.
// This is the ONLY place to add new drugs or aliases — therapyTextParser,
// therapyEventParser, and visitTextParser all derive their lookup tables from here.
// canonical must match the `name` field in DRUGS[] above (or be a new drug name).
export const DRUG_ALIAS_MAP = {
  // ── NSAIDs ────────────────────────────────────────────────────────────────
  "celecoxib":          { canonical: "Celecoxib",            category: "NSAID" },
  "celebrex":           { canonical: "Celecoxib",            category: "NSAID" },
  "etoricoxib":         { canonical: "Etoricoxib",           category: "NSAID" },
  "arcoxia":            { canonical: "Etoricoxib",           category: "NSAID" },
  "naprossene":         { canonical: "Naprossene",           category: "NSAID" },
  "naproxen":           { canonical: "Naprossene",           category: "NSAID" },
  "naprosyn":           { canonical: "Naprossene",           category: "NSAID" },
  "aleve":              { canonical: "Naprossene",           category: "NSAID" },
  "momendol":           { canonical: "Naprossene",           category: "NSAID" },
  "synflex":            { canonical: "Naprossene",           category: "NSAID" },
  "indometacina":       { canonical: "Indometacina",         category: "NSAID" },
  "indomethacin":       { canonical: "Indometacina",         category: "NSAID" },
  "liometacen":         { canonical: "Indometacina",         category: "NSAID" },
  "ibuprofene":         { canonical: "Ibuprofene",           category: "NSAID" },
  "ibuprofen":          { canonical: "Ibuprofene",           category: "NSAID" },
  "moment":             { canonical: "Ibuprofene",           category: "NSAID" },
  "brufen":             { canonical: "Ibuprofene",           category: "NSAID" },
  "nurofen":            { canonical: "Ibuprofene",           category: "NSAID" },
  "diclofenac":         { canonical: "Diclofenac",           category: "NSAID" },
  "voltaren":           { canonical: "Diclofenac",           category: "NSAID" },
  "flector":            { canonical: "Diclofenac",           category: "NSAID" },
  "dicloreum":          { canonical: "Diclofenac",           category: "NSAID" },
  "ketoprofene":        { canonical: "Ketoprofene",          category: "NSAID" },
  "ketoprofen":         { canonical: "Ketoprofene",          category: "NSAID" },
  "fastum":             { canonical: "Ketoprofene",          category: "NSAID" },
  "orudis":             { canonical: "Ketoprofene",          category: "NSAID" },
  "ketodol":            { canonical: "Ketoprofene",          category: "NSAID" },
  "oki":                { canonical: "Ketoprofene",          category: "NSAID" },
  "meloxicam":          { canonical: "Meloxicam",            category: "NSAID" },
  "mobic":              { canonical: "Meloxicam",            category: "NSAID" },
  "piroxicam":          { canonical: "Piroxicam",            category: "NSAID" },
  "feldene":            { canonical: "Piroxicam",            category: "NSAID" },
  "nimesulide":         { canonical: "Nimesulide",           category: "NSAID" },
  "aulin":              { canonical: "Nimesulide",           category: "NSAID" },
  "aceclofenac":        { canonical: "Aceclofenac",          category: "NSAID" },
  "fans":               { canonical: "FANS",                 category: "NSAID" },
  "nsaid":              { canonical: "FANS",                 category: "NSAID" },

  // ── Glucocorticoids ───────────────────────────────────────────────────────
  "prednisone":         { canonical: "Prednisone",           category: "glucocorticoid" },
  "deltacortene":       { canonical: "Prednisone",           category: "glucocorticoid" },
  "lodotra":            { canonical: "Prednisone",           category: "glucocorticoid" },
  "prednisolone":       { canonical: "Prednisolone",         category: "glucocorticoid" },
  "prelone":            { canonical: "Prednisolone",         category: "glucocorticoid" },
  "deflazacort":        { canonical: "Deflazacort",          category: "glucocorticoid" },
  "deflan":             { canonical: "Deflazacort",          category: "glucocorticoid" },
  "calcort":            { canonical: "Deflazacort",          category: "glucocorticoid" },
  "flazacort":          { canonical: "Deflazacort",          category: "glucocorticoid" },
  "metilprednisolone":  { canonical: "Metilprednisolone",    category: "glucocorticoid" },
  "methylprednisolone": { canonical: "Metilprednisolone",    category: "glucocorticoid" },
  "medrol":             { canonical: "Metilprednisolone",    category: "glucocorticoid" },
  "urbason":            { canonical: "Metilprednisolone",    category: "glucocorticoid" },
  "solu-medrol":        { canonical: "Metilprednisolone",    category: "glucocorticoid" },
  "solumedrol":         { canonical: "Metilprednisolone",    category: "glucocorticoid" },
  "depo-medrol":        { canonical: "Metilprednisolone",    category: "glucocorticoid" },
  "depomedrol":         { canonical: "Metilprednisolone",    category: "glucocorticoid" },
  "betametasone":       { canonical: "Betametasone",         category: "glucocorticoid" },
  "betamethasone":      { canonical: "Betametasone",         category: "glucocorticoid" },
  "bentelan":           { canonical: "Betametasone",         category: "glucocorticoid" },
  "celestone":          { canonical: "Betametasone",         category: "glucocorticoid" },
  "desametasone":       { canonical: "Desametasone",         category: "glucocorticoid" },
  "dexamethasone":      { canonical: "Desametasone",         category: "glucocorticoid" },
  "soldesam":           { canonical: "Desametasone",         category: "glucocorticoid" },
  "triamcinolone":      { canonical: "Triamcinolone",        category: "glucocorticoid" },
  "kenacort":           { canonical: "Triamcinolone",        category: "glucocorticoid" },
  "triam":              { canonical: "Triamcinolone",        category: "glucocorticoid" },
  "idrocortisone":      { canonical: "Idrocortisone",        category: "glucocorticoid" },
  "hydrocortisone":     { canonical: "Idrocortisone",        category: "glucocorticoid" },
  "cortef":             { canonical: "Idrocortisone",        category: "glucocorticoid" },

  // ── csDMARDs ──────────────────────────────────────────────────────────────
  "methotrexate":       { canonical: "Methotrexate",         category: "csDMARD" },
  "metotrexato":        { canonical: "Methotrexate",         category: "csDMARD" },
  "metotressato":       { canonical: "Methotrexate",         category: "csDMARD" },
  "mtx":                { canonical: "Methotrexate",         category: "csDMARD" },
  "reumaflex":          { canonical: "Methotrexate",         category: "csDMARD" },
  "leflunomide":        { canonical: "Leflunomide",          category: "csDMARD" },
  "lef":                { canonical: "Leflunomide",          category: "csDMARD" },
  "leflu":              { canonical: "Leflunomide",          category: "csDMARD" },
  "arava":              { canonical: "Leflunomide",          category: "csDMARD" },
  "sulfasalazina":      { canonical: "Sulfasalazina",        category: "csDMARD" },
  "sulphasalazine":     { canonical: "Sulfasalazina",        category: "csDMARD" },
  "salazopyrin":        { canonical: "Sulfasalazina",        category: "csDMARD" },
  "salazoprina":        { canonical: "Sulfasalazina",        category: "csDMARD" },
  "salazopirina":       { canonical: "Sulfasalazina",        category: "csDMARD" },
  "ssz":                { canonical: "Sulfasalazina",        category: "csDMARD" },
  "sasp":               { canonical: "Sulfasalazina",        category: "csDMARD" },
  // NOTE: "ssa" RIMOSSO — SSA in reumatologia = anti-SSA/Ro (autoanticorpo): alias errato → falsi positivi certi
  // NOTE: "ssp" RIMOSSO — non è abbreviazione standard per sulfasalazina; SSZ e SASP sono quelle accettate
  "idrossiclorochina":  { canonical: "Idrossiclorochina",    category: "csDMARD" },
  "idrossiclorichina":  { canonical: "Idrossiclorochina",    category: "csDMARD" },
  "hydroxychloroquine": { canonical: "Idrossiclorochina",    category: "csDMARD" },
  "plaquenil":          { canonical: "Idrossiclorochina",    category: "csDMARD" },
  "hcq":                { canonical: "Idrossiclorochina",    category: "csDMARD" },
  "clorochina":         { canonical: "Clorochina",           category: "csDMARD" },
  "chloroquine":        { canonical: "Clorochina",           category: "csDMARD" },
  "azatioprina":        { canonical: "Azatioprina",          category: "csDMARD" },
  "azathioprine":       { canonical: "Azatioprina",          category: "csDMARD" },
  "aza":                { canonical: "Azatioprina",          category: "csDMARD" },
  "imuran":             { canonical: "Azatioprina",          category: "csDMARD" },
  "micofenolato":       { canonical: "Micofenolato Mofetil", category: "csDMARD" },
  "mycophenolate":      { canonical: "Micofenolato Mofetil", category: "csDMARD" },
  "mmf":                { canonical: "Micofenolato Mofetil", category: "csDMARD" },
  "cellcept":           { canonical: "Micofenolato Mofetil", category: "csDMARD" },
  "mofetile":           { canonical: "Micofenolato Mofetil", category: "csDMARD" },
  "ciclosporina":       { canonical: "Ciclosporina",         category: "csDMARD" },
  "cyclosporina":       { canonical: "Ciclosporina",         category: "csDMARD" },
  "cyclosporine":       { canonical: "Ciclosporina",         category: "csDMARD" },
  "csa":                { canonical: "Ciclosporina",         category: "csDMARD" },
  "sandimmun":          { canonical: "Ciclosporina",         category: "csDMARD" },
  "neoral":             { canonical: "Ciclosporina",         category: "csDMARD" },
  "tacrolimus":         { canonical: "Tacrolimus",           category: "csDMARD" },
  "prograf":            { canonical: "Tacrolimus",           category: "csDMARD" },
  "dapsone":            { canonical: "Dapsone",              category: "csDMARD" },
  "diaminodifenilsulfone": { canonical: "Dapsone",           category: "csDMARD" },
  "ciclofosfamide":     { canonical: "Ciclofosfamide",       category: "csDMARD" },
  "cyclophosphamide":   { canonical: "Ciclofosfamide",       category: "csDMARD" },
  "cyc":                { canonical: "Ciclofosfamide",       category: "csDMARD" },
  "endoxan":            { canonical: "Ciclofosfamide",       category: "csDMARD" },
  "clorambucile":       { canonical: "Clorambucile",         category: "csDMARD" },
  "chlorambucil":       { canonical: "Clorambucile",         category: "csDMARD" },
  "leukeran":           { canonical: "Clorambucile",         category: "csDMARD" },

  // ── bDMARDs — anti-TNF ────────────────────────────────────────────────────
  "adalimumab":         { canonical: "Adalimumab",           category: "bDMARD" },
  "humira":             { canonical: "Adalimumab",           category: "bDMARD" },
  "imraldi":            { canonical: "Adalimumab",           category: "bDMARD" },
  "hyrimoz":            { canonical: "Adalimumab",           category: "bDMARD" },
  "amgevita":           { canonical: "Adalimumab",           category: "bDMARD" },
  "hadlima":            { canonical: "Adalimumab",           category: "bDMARD" },
  "idacio":             { canonical: "Adalimumab",           category: "bDMARD" },
  "ADA":                { canonical: "Adalimumab",           category: "bDMARD", caseSensitive: true },
  "ADA-b":              { canonical: "Adalimumab",           category: "bDMARD", caseSensitive: true },
  "etanercept":         { canonical: "Etanercept",           category: "bDMARD" },
  "enbrel":             { canonical: "Etanercept",           category: "bDMARD" },
  "benepali":           { canonical: "Etanercept",           category: "bDMARD" },
  "erelzi":             { canonical: "Etanercept",           category: "bDMARD" },
  "lifmior":            { canonical: "Etanercept",           category: "bDMARD" },
  "ETN":                { canonical: "Etanercept",           category: "bDMARD", caseSensitive: true },
  "infliximab":         { canonical: "Infliximab",           category: "bDMARD" },
  "remicade":           { canonical: "Infliximab",           category: "bDMARD" },
  "remsima":            { canonical: "Infliximab",           category: "bDMARD" },
  "inflectra":          { canonical: "Infliximab",           category: "bDMARD" },
  "flixabi":            { canonical: "Infliximab",           category: "bDMARD" },
  "zessly":             { canonical: "Infliximab",           category: "bDMARD" },
  "IFX":                { canonical: "Infliximab",           category: "bDMARD", caseSensitive: true },
  "certolizumab":       { canonical: "Certolizumab pegol",   category: "bDMARD" },
  "cimzia":             { canonical: "Certolizumab pegol",   category: "bDMARD" },
  "CZP":                { canonical: "Certolizumab pegol",   category: "bDMARD", caseSensitive: true },
  "golimumab":          { canonical: "Golimumab",            category: "bDMARD" },
  "simponi":            { canonical: "Golimumab",            category: "bDMARD" },
  "GOL":                { canonical: "Golimumab",            category: "bDMARD", caseSensitive: true },

  // ── bDMARDs — anti-IL-6 ───────────────────────────────────────────────────
  "tocilizumab":        { canonical: "Tocilizumab",          category: "bDMARD" },
  "roactemra":          { canonical: "Tocilizumab",          category: "bDMARD" },
  "actemra":            { canonical: "Tocilizumab",          category: "bDMARD" },
  "tyenne":             { canonical: "Tocilizumab",          category: "bDMARD" },
  "sarilumab":          { canonical: "Sarilumab",            category: "bDMARD" },
  "kevzara":            { canonical: "Sarilumab",            category: "bDMARD" },
  "siltuximab":         { canonical: "Siltuximab",           category: "bDMARD" },
  "sylvant":            { canonical: "Siltuximab",           category: "bDMARD" },

  // ── bDMARDs — anti-CD20 / CD80-86 / BLyS / IFN ───────────────────────────
  "rituximab":          { canonical: "Rituximab",            category: "bDMARD" },
  "rtx":                { canonical: "Rituximab",            category: "bDMARD" },
  "mabthera":           { canonical: "Rituximab",            category: "bDMARD" },
  "truxima":            { canonical: "Rituximab",            category: "bDMARD" },
  "rixathon":           { canonical: "Rituximab",            category: "bDMARD" },
  "ritemvia":           { canonical: "Rituximab",            category: "bDMARD" },
  "rituzena":           { canonical: "Rituximab",            category: "bDMARD" },
  "abatacept":          { canonical: "Abatacept",            category: "bDMARD" },
  "orencia":            { canonical: "Abatacept",            category: "bDMARD" },
  "ABA":                { canonical: "Abatacept",            category: "bDMARD", caseSensitive: true },
  "belimumab":          { canonical: "Belimumab",            category: "bDMARD" },
  "benlysta":           { canonical: "Belimumab",            category: "bDMARD" },
  "anifrolumab":        { canonical: "Anifrolumab",          category: "bDMARD" },
  "saphnelo":           { canonical: "Anifrolumab",          category: "bDMARD" },
  "voclosporin":        { canonical: "Voclosporin",          category: "bDMARD" },
  "lupkynis":           { canonical: "Voclosporin",          category: "bDMARD" },

  // ── bDMARDs — anti-IL-17 / IL-23 / IL-12/23 ──────────────────────────────
  "secukinumab":        { canonical: "Secukinumab",          category: "bDMARD" },
  "cosentyx":           { canonical: "Secukinumab",          category: "bDMARD" },
  "SEC":                { canonical: "Secukinumab",          category: "bDMARD", caseSensitive: true },
  "ixekizumab":         { canonical: "Ixekizumab",           category: "bDMARD" },
  "taltz":              { canonical: "Ixekizumab",           category: "bDMARD" },
  "IXE":                { canonical: "Ixekizumab",           category: "bDMARD", caseSensitive: true },
  "bimekizumab":        { canonical: "Bimekizumab",          category: "bDMARD" },
  "bimzelx":            { canonical: "Bimekizumab",          category: "bDMARD" },
  "ustekinumab":        { canonical: "Ustekinumab",          category: "bDMARD" },
  "stelara":            { canonical: "Ustekinumab",          category: "bDMARD" },
  "guselkumab":         { canonical: "Guselkumab",           category: "bDMARD" },
  "tremfya":            { canonical: "Guselkumab",           category: "bDMARD" },
  "GUS":                { canonical: "Guselkumab",           category: "bDMARD", caseSensitive: true },
  "risankizumab":       { canonical: "Risankizumab",         category: "bDMARD" },
  "skyrizi":            { canonical: "Risankizumab",         category: "bDMARD" },
  "RIS":                { canonical: "Risankizumab",         category: "bDMARD", caseSensitive: true },
  "tildrakizumab":      { canonical: "Tildrakizumab",        category: "bDMARD" },
  "ilumetri":           { canonical: "Tildrakizumab",        category: "bDMARD" },

  // ── bDMARDs — anti-IL-1 ───────────────────────────────────────────────────
  "anakinra":           { canonical: "Anakinra",             category: "bDMARD" },
  "kineret":            { canonical: "Anakinra",             category: "bDMARD" },
  "canakinumab":        { canonical: "Canakinumab",          category: "bDMARD" },
  "ilaris":             { canonical: "Canakinumab",          category: "bDMARD" },
  "rilonacept":         { canonical: "Rilonacept",           category: "bDMARD" },
  "arcalyst":           { canonical: "Rilonacept",           category: "bDMARD" },

  // ── bDMARDs — altri meccanismi ────────────────────────────────────────────
  "avacopan":           { canonical: "Avacopan",             category: "bDMARD" },
  "tavneos":            { canonical: "Avacopan",             category: "bDMARD" },
  "mepolizumab":        { canonical: "Mepolizumab",          category: "bDMARD" },
  "nucala":             { canonical: "Mepolizumab",          category: "bDMARD" },
  "dupilumab":          { canonical: "Dupilumab",            category: "bDMARD" },
  "dupixent":           { canonical: "Dupilumab",            category: "bDMARD" },

  // ── tsDMARDs — JAKi / PDE4 / TYK2 ────────────────────────────────────────
  "baricitinib":        { canonical: "Baricitinib",          category: "tsDMARD" },
  "olumiant":           { canonical: "Baricitinib",          category: "tsDMARD" },
  "BARI":               { canonical: "Baricitinib",          category: "tsDMARD", caseSensitive: true },
  "tofacitinib":        { canonical: "Tofacitinib",          category: "tsDMARD" },
  "xeljanz":            { canonical: "Tofacitinib",          category: "tsDMARD" },
  "TOFA":               { canonical: "Tofacitinib",          category: "tsDMARD", caseSensitive: true },
  "upadacitinib":       { canonical: "Upadacitinib",         category: "tsDMARD" },
  "rinvoq":             { canonical: "Upadacitinib",         category: "tsDMARD" },
  "UPA":                { canonical: "Upadacitinib",         category: "tsDMARD", caseSensitive: true },
  "filgotinib":         { canonical: "Filgotinib",           category: "tsDMARD" },
  "jyseleca":           { canonical: "Filgotinib",           category: "tsDMARD" },
  "abrocitinib":        { canonical: "Abrocitinib",          category: "tsDMARD" },
  "cibinqo":            { canonical: "Abrocitinib",          category: "tsDMARD" },
  "deucravacitinib":    { canonical: "Deucravacitinib",      category: "tsDMARD" },
  "sotyktu":            { canonical: "Deucravacitinib",      category: "tsDMARD" },
  "apremilast":         { canonical: "Apremilast",           category: "tsDMARD" },
  "otezla":             { canonical: "Apremilast",           category: "tsDMARD" },

  // ── Colchicina ────────────────────────────────────────────────────────────
  // (gli uricostatici sono nella sezione urate_lowering più in basso)
  "colchicina":         { canonical: "Colchicina",           category: "antiinflammatory" },
  "colchicine":         { canonical: "Colchicina",           category: "antiinflammatory" },
  "colchysat":          { canonical: "Colchicina",           category: "antiinflammatory" },

  // ── Osteoporosi / osso ────────────────────────────────────────────────────
  "xgeva":              { canonical: "Denosumab",            category: "denosumab",            therapy_type: "osteoporosis",   relevance: "low" },
  "osteomax":           { canonical: "Alendronato",          category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "ibandronate":        { canonical: "Ibandronato",          category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "zoledronico":        { canonical: "Acido Zoledronico",    category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "raloxifene":         { canonical: "Raloxifene",           category: "serm",                 therapy_type: "osteoporosis",   relevance: "low" },
  "evista":             { canonical: "Raloxifene",           category: "serm",                 therapy_type: "osteoporosis",   relevance: "low" },
  "forsteo":            { canonical: "Teriparatide",         category: "denosumab",            therapy_type: "osteoporosis",   relevance: "low" },
  "terrosa":            { canonical: "Teriparatide",         category: "denosumab",            therapy_type: "osteoporosis",   relevance: "low" },

  // ── ILD / fibrosi polmonare ───────────────────────────────────────────────
  "nintedanib":         { canonical: "Nintedanib",           category: "other" },
  "ofev":               { canonical: "Nintedanib",           category: "other" },
  "pirfenidone":        { canonical: "Pirfenidone",          category: "other" },
  "esbriet":            { canonical: "Pirfenidone",          category: "other" },

  // ── PAH / vasculopatia SSc ────────────────────────────────────────────────
  "bosentan":           { canonical: "Bosentan",             category: "other" },
  "tracleer":           { canonical: "Bosentan",             category: "other" },
  "stayveer":           { canonical: "Bosentan",             category: "other" },
  "ambrisentan":        { canonical: "Ambrisentan",          category: "other" },
  "volibris":           { canonical: "Ambrisentan",          category: "other" },
  "letairis":           { canonical: "Ambrisentan",          category: "other" },
  "macitentan":         { canonical: "Macitentan",           category: "other" },
  "opsumit":            { canonical: "Macitentan",           category: "other" },
  "sildenafil":         { canonical: "Sildenafil",           category: "other" },
  "revatio":            { canonical: "Sildenafil",           category: "other" },
  "tadalafil":          { canonical: "Tadalafil",            category: "other" },
  "adcirca":            { canonical: "Tadalafil",            category: "other" },
  "cialis":             { canonical: "Tadalafil",            category: "other" },
  "riociguat":          { canonical: "Riociguat",            category: "other" },
  "adempas":            { canonical: "Riociguat",            category: "other" },
  "selexipag":          { canonical: "Selexipag",            category: "other" },
  "uptravi":            { canonical: "Selexipag",            category: "other" },
  "iloprost":           { canonical: "Iloprost",             category: "other" },
  "endoprost":          { canonical: "Iloprost",             category: "other" },
  "ventavis":           { canonical: "Iloprost",             category: "other" },
  "ilomedine":          { canonical: "Iloprost",             category: "other" },
  "ilomedin":           { canonical: "Iloprost",             category: "other" },
  "epoprostenol":       { canonical: "Epoprostenol",         category: "other" },
  "flolan":             { canonical: "Epoprostenol",         category: "other" },
  "veletri":            { canonical: "Epoprostenol",         category: "other" },
  "treprostinil":       { canonical: "Treprostinil",         category: "other" },
  "remodulin":          { canonical: "Treprostinil",         category: "other" },
  "tyvaso":             { canonical: "Treprostinil",         category: "other" },

  // ── Raynaud / vasospasmo ──────────────────────────────────────────────────
  "nifedipine":         { canonical: "Nifedipina",           category: "ca_channel_blocker",   therapy_type: "cardiovascular", relevance: "low" },
  "plendil":            { canonical: "Felodipina",           category: "other" },
  "felodipina":         { canonical: "Felodipina",           category: "other" },
  "felodipine":         { canonical: "Felodipina",           category: "other" },
  "nifedicor":          { canonical: "Nifedipina",           category: "ca_channel_blocker",   therapy_type: "cardiovascular", relevance: "low" },
  "lortaan":            { canonical: "Losartan",             category: "arb",                  therapy_type: "cardiovascular", relevance: "low" },
  "hyzaar":             { canonical: "Losartan",             category: "arb",                  therapy_type: "cardiovascular", relevance: "low" },
  "fluoxetina":         { canonical: "Fluoxetina",           category: "other" },
  "fluoxetine":         { canonical: "Fluoxetina",           category: "other" },
  "prozac":             { canonical: "Fluoxetina",           category: "other" },

  // ── Analgesici / neuromodulatori ──────────────────────────────────────────
  "acetaminofene":      { canonical: "Paracetamolo",         category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
  "tachidol":           { canonical: "Tramadolo",            category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
  "duloxetina":         { canonical: "Duloxetina",           category: "analgesic" },
  "duloxetine":         { canonical: "Duloxetina",           category: "analgesic" },
  "cymbalta":           { canonical: "Duloxetina",           category: "analgesic" },
  "amitriptilina":      { canonical: "Amitriptilina",        category: "analgesic" },
  "amitriptyline":      { canonical: "Amitriptilina",        category: "analgesic" },

  // ── Supportivo / integratori / gastroprotezione ───────────────────────────
  "acido folico":       { canonical: "Acido folico",         category: "supportive" },
  "folic acid":         { canonical: "Acido folico",         category: "supportive" },
  "acifol":             { canonical: "Acido folico",         category: "supportive" },
  "folina":             { canonical: "Acido folico",         category: "supportive" },
  "omeprazole":         { canonical: "Omeprazolo",           category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "pantoprazole":       { canonical: "Pantoprazolo",         category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "lansoprazole":       { canonical: "Lansoprazolo",         category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "lansox":             { canonical: "Lansoprazolo",         category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "esomeprazole":       { canonical: "Esomeprazolo",         category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "rabeprazole":        { canonical: "Rabeprazolo",          category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "calcio carbonato":   { canonical: "Calcio carbonato",     category: "supportive" },
  "calcio citrato":     { canonical: "Calcio carbonato",     category: "supportive" },
  "calcio":             { canonical: "Calcio carbonato",     category: "supportive" },
  "calcium":            { canonical: "Calcio carbonato",     category: "supportive" },
  "caltrate":           { canonical: "Calcio carbonato",     category: "supportive" },
  "vitamina d":         { canonical: "Vitamina D3",          category: "supportive" },
  "vitamina d3":        { canonical: "Vitamina D3",          category: "supportive" },
  "vit d":              { canonical: "Vitamina D3",          category: "supportive" },
  "colecalciferolo":    { canonical: "Vitamina D3",          category: "supportive" },
  "ergocalciferolo":    { canonical: "Vitamina D3",          category: "supportive" },
  "calcifediolo":       { canonical: "Vitamina D3",          category: "supportive" },
  "dibase":             { canonical: "Vitamina D3",          category: "supportive" },
  "rocaltrol":          { canonical: "Vitamina D3",          category: "supportive" },
  "vitamina b12":       { canonical: "Vitamina B12",         category: "supportive" },
  "cobalamina":         { canonical: "Vitamina B12",         category: "supportive" },
  "vitamina c":         { canonical: "Vitamina C",           category: "supportive" },
  "acido ascorbico":    { canonical: "Vitamina C",           category: "supportive" },

  // ── Antiplatelet ──────────────────────────────────────────────────────────
  "cardioaspirina":     { canonical: "ASA",                  category: "antiplatelet",         therapy_type: "cardiovascular", relevance: "low" },
  "aspirina":           { canonical: "ASA",                  category: "antiplatelet",         therapy_type: "cardiovascular", relevance: "low" },
  "aspirin":            { canonical: "ASA",                  category: "antiplatelet",         therapy_type: "cardiovascular", relevance: "low" },
  "asa":                { canonical: "ASA",                  category: "antiplatelet",         therapy_type: "cardiovascular", relevance: "low" },
  "acido acetilsalicilico": { canonical: "ASA",              category: "antiplatelet",         therapy_type: "cardiovascular", relevance: "low" },
  "clopidogrel":        { canonical: "Clopidogrel",          category: "antiplatelet",         therapy_type: "cardiovascular", relevance: "low" },
  "plavix":             { canonical: "Clopidogrel",          category: "antiplatelet",         therapy_type: "cardiovascular", relevance: "low" },
  "ticagrelor":         { canonical: "Ticagrelor",           category: "antiplatelet",         therapy_type: "cardiovascular", relevance: "low" },
  "brilique":           { canonical: "Ticagrelor",           category: "antiplatelet",         therapy_type: "cardiovascular", relevance: "low" },
  "prasugrel":          { canonical: "Prasugrel",            category: "antiplatelet",         therapy_type: "cardiovascular", relevance: "low" },
  "efient":             { canonical: "Prasugrel",            category: "antiplatelet",         therapy_type: "cardiovascular", relevance: "low" },

  // ── ACE inibitori ─────────────────────────────────────────────────────────
  "ramipril":           { canonical: "Ramipril",             category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "triatec":            { canonical: "Ramipril",             category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "altace":             { canonical: "Ramipril",             category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "lisinopril":         { canonical: "Lisinopril",           category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "zestril":            { canonical: "Lisinopril",           category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "prinivil":           { canonical: "Lisinopril",           category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "enalapril":          { canonical: "Enalapril",            category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "enapren":            { canonical: "Enalapril",            category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "naprilene":          { canonical: "Enalapril",            category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "perindopril":        { canonical: "Perindopril",          category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "coversyl":           { canonical: "Perindopril",          category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "zofenopril":         { canonical: "Zofenopril",           category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "zofenil":            { canonical: "Zofenopril",           category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },
  "fosinopril":         { canonical: "Fosinopril",           category: "ace_inhibitor",        therapy_type: "cardiovascular", relevance: "low" },

  // ── Sartani (ARB) ─────────────────────────────────────────────────────────
  "losartan":           { canonical: "Losartan",             category: "arb",                  therapy_type: "cardiovascular", relevance: "low" },
  "cozaar":             { canonical: "Losartan",             category: "arb",                  therapy_type: "cardiovascular", relevance: "low" },
  "valsartan":          { canonical: "Valsartan",            category: "arb",                  therapy_type: "cardiovascular", relevance: "low" },
  "diovan":             { canonical: "Valsartan",            category: "arb",                  therapy_type: "cardiovascular", relevance: "low" },
  "tareg":              { canonical: "Valsartan",            category: "arb",                  therapy_type: "cardiovascular", relevance: "low" },
  "irbesartan":         { canonical: "Irbesartan",           category: "arb",                  therapy_type: "cardiovascular", relevance: "low" },
  "aprovel":            { canonical: "Irbesartan",           category: "arb",                  therapy_type: "cardiovascular", relevance: "low" },
  "candesartan":        { canonical: "Candesartan",          category: "arb",                  therapy_type: "cardiovascular", relevance: "low" },
  "atacand":            { canonical: "Candesartan",          category: "arb",                  therapy_type: "cardiovascular", relevance: "low" },
  "olmesartan":         { canonical: "Olmesartan",                   category: "arb",              therapy_type: "cardiovascular", relevance: "low" },
  "olmetec":            { canonical: "Olmesartan",                   category: "arb",              therapy_type: "cardiovascular", relevance: "low" },
  "olprezide":          { canonical: "Olmesartan/Idroclorotiazide",  category: "arb_combination",  therapy_type: "cardiovascular", relevance: "low" },
  "telmisartan":        { canonical: "Telmisartan",                  category: "arb",              therapy_type: "cardiovascular", relevance: "low" },
  "micardis":           { canonical: "Telmisartan",          category: "arb",                  therapy_type: "cardiovascular", relevance: "low" },

  // ── Calcio-antagonisti ────────────────────────────────────────────────────
  "amlodipina":         { canonical: "Amlodipina",           category: "ca_channel_blocker",   therapy_type: "cardiovascular", relevance: "low" },
  "amlodipine":         { canonical: "Amlodipina",           category: "ca_channel_blocker",   therapy_type: "cardiovascular", relevance: "low" },
  "norvasc":            { canonical: "Amlodipina",           category: "ca_channel_blocker",   therapy_type: "cardiovascular", relevance: "low" },
  "nifedipina":         { canonical: "Nifedipina",           category: "ca_channel_blocker",   therapy_type: "cardiovascular", relevance: "low" },
  "adalat":             { canonical: "Nifedipina",           category: "ca_channel_blocker",   therapy_type: "cardiovascular", relevance: "low" },
  "diltiazem":          { canonical: "Diltiazem",            category: "ca_channel_blocker",   therapy_type: "cardiovascular", relevance: "low" },
  "tildiem":            { canonical: "Diltiazem",            category: "ca_channel_blocker",   therapy_type: "cardiovascular", relevance: "low" },
  "verapamil":          { canonical: "Verapamil",            category: "ca_channel_blocker",   therapy_type: "cardiovascular", relevance: "low" },
  "isoptin":            { canonical: "Verapamil",            category: "ca_channel_blocker",   therapy_type: "cardiovascular", relevance: "low" },

  // ── Beta-bloccanti ────────────────────────────────────────────────────────
  "bisoprololo":        { canonical: "Bisoprololo",          category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "bisoprolol":         { canonical: "Bisoprololo",          category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "concor":             { canonical: "Bisoprololo",          category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "cardicor":           { canonical: "Bisoprololo",          category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "metoprololo":        { canonical: "Metoprololo",          category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "metoprolol":         { canonical: "Metoprololo",          category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "seloken":            { canonical: "Metoprololo",          category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "lopresor":           { canonical: "Metoprololo",          category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "carvedilolo":        { canonical: "Carvedilolo",          category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "carvedilol":         { canonical: "Carvedilolo",          category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "coreg":              { canonical: "Carvedilolo",          category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "nebivololo":         { canonical: "Nebivololo",           category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "nebilet":            { canonical: "Nebivololo",           category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "atenololo":          { canonical: "Atenololo",            category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "atenolol":           { canonical: "Atenololo",            category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "tenormin":           { canonical: "Atenololo",            category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "propranololo":       { canonical: "Propranololo",         category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },
  "inderal":            { canonical: "Propranololo",         category: "beta_blocker",         therapy_type: "cardiovascular", relevance: "low" },

  // ── Anticoagulanti (rilevanti in reumatologia: APS, CAPS) ────────────────
  "warfarin":           { canonical: "Warfarin",             category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "medium" },
  "coumadin":           { canonical: "Warfarin",             category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "medium" },
  "acenocumarolo":      { canonical: "Acenocumarolo",        category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "medium" },
  "acenocoumarol":      { canonical: "Acenocumarolo",        category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "medium" },
  "sintrom":            { canonical: "Acenocumarolo",        category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "medium" },
  "aldocumar":          { canonical: "Acenocumarolo",        category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "medium" },
  "rivaroxaban":        { canonical: "Rivaroxaban",          category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "xarelto":            { canonical: "Rivaroxaban",          category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "apixaban":           { canonical: "Apixaban",             category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "eliquis":            { canonical: "Apixaban",             category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "dabigatran":         { canonical: "Dabigatran",           category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "pradaxa":            { canonical: "Dabigatran",           category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "edoxaban":           { canonical: "Edoxaban",             category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "lixiana":            { canonical: "Edoxaban",             category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "enoxaparina":        { canonical: "Enoxaparina",          category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "clexane":            { canonical: "Enoxaparina",          category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "lovenox":            { canonical: "Enoxaparina",          category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "fondaparinux":       { canonical: "Fondaparinux",         category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "arixtra":            { canonical: "Fondaparinux",         category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "nadroparina":        { canonical: "Nadroparina",          category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },
  "fraxiparina":        { canonical: "Nadroparina",          category: "anticoagulant",        therapy_type: "cardiovascular", relevance: "low" },

  // ── Diuretici ─────────────────────────────────────────────────────────────
  "furosemide":         { canonical: "Furosemide",           category: "diuretic",             therapy_type: "cardiovascular", relevance: "low" },
  "lasix":              { canonical: "Furosemide",           category: "diuretic",             therapy_type: "cardiovascular", relevance: "low" },
  "idroclorotiazide":   { canonical: "Idroclorotiazide",     category: "diuretic",             therapy_type: "cardiovascular", relevance: "low" },
  "hct":                { canonical: "Idroclorotiazide",     category: "diuretic",             therapy_type: "cardiovascular", relevance: "low" },
  "spironolattone":     { canonical: "Spironolattone",       category: "diuretic",             therapy_type: "cardiovascular", relevance: "low" },
  "aldactone":          { canonical: "Spironolattone",       category: "diuretic",             therapy_type: "cardiovascular", relevance: "low" },
  "torasemide":         { canonical: "Torasemide",           category: "diuretic",             therapy_type: "cardiovascular", relevance: "low" },
  "diuremid":           { canonical: "Torasemide",           category: "diuretic",             therapy_type: "cardiovascular", relevance: "low" },
  "indapamide":         { canonical: "Indapamide",           category: "diuretic",             therapy_type: "cardiovascular", relevance: "low" },
  "natrilix":           { canonical: "Indapamide",           category: "diuretic",             therapy_type: "cardiovascular", relevance: "low" },

  // ── Antiaritmici / altri cardiovascolari ──────────────────────────────────
  "amiodarone":         { canonical: "Amiodarone",           category: "antiarrhythmic",       therapy_type: "cardiovascular", relevance: "low" },
  "cordarone":          { canonical: "Amiodarone",           category: "antiarrhythmic",       therapy_type: "cardiovascular", relevance: "low" },
  "digossina":          { canonical: "Digossina",            category: "antiarrhythmic",       therapy_type: "cardiovascular", relevance: "low" },
  "lanoxin":            { canonical: "Digossina",            category: "antiarrhythmic",       therapy_type: "cardiovascular", relevance: "low" },
  "ivabradina":         { canonical: "Ivabradina",           category: "antiarrhythmic",       therapy_type: "cardiovascular", relevance: "low" },
  "procoralan":         { canonical: "Ivabradina",           category: "antiarrhythmic",       therapy_type: "cardiovascular", relevance: "low" },
  "sacubitril":         { canonical: "Sacubitril/Valsartan", category: "antiarrhythmic",       therapy_type: "cardiovascular", relevance: "low" },
  "entresto":           { canonical: "Sacubitril/Valsartan", category: "antiarrhythmic",       therapy_type: "cardiovascular", relevance: "low" },

  // ── Statine e ipolipemizzanti ──────────────────────────────────────────────
  "atorvastatina":      { canonical: "Atorvastatina",        category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "atorvastatin":       { canonical: "Atorvastatina",        category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "torvast":            { canonical: "Atorvastatina",        category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "lipitor":            { canonical: "Atorvastatina",        category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "rosuvastatina":      { canonical: "Rosuvastatina",        category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "rosuvastatin":       { canonical: "Rosuvastatina",        category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "crestor":            { canonical: "Rosuvastatina",        category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "simvastatina":       { canonical: "Simvastatina",         category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "simvastatin":        { canonical: "Simvastatina",         category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "zocor":              { canonical: "Simvastatina",         category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "pravastatina":       { canonical: "Pravastatina",         category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "pravastatin":        { canonical: "Pravastatina",         category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "fluvastatina":       { canonical: "Fluvastatina",         category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "lovastatina":        { canonical: "Lovastatina",          category: "statin",               therapy_type: "metabolic",      relevance: "low" },
  "ezetimibe":          { canonical: "Ezetimibe",                   category: "other_lipid",          therapy_type: "metabolic",  relevance: "low" },
  "zetia":              { canonical: "Ezetimibe",                   category: "other_lipid",          therapy_type: "metabolic",  relevance: "low" },
  "ezetrol":            { canonical: "Ezetimibe",                   category: "other_lipid",          therapy_type: "metabolic",  relevance: "low" },
  "aurozeb":            { canonical: "Rosuvastatina/Ezetimibe",     category: "statin_combination",   therapy_type: "metabolic",  relevance: "low" },
  "fenofibrato":        { canonical: "Fenofibrato",          category: "other_lipid",          therapy_type: "metabolic",      relevance: "low" },
  "lipanthyl":          { canonical: "Fenofibrato",          category: "other_lipid",          therapy_type: "metabolic",      relevance: "low" },

  // ── Antidiabetici ─────────────────────────────────────────────────────────
  "metformina":         { canonical: "Metformina",           category: "biguanide",            therapy_type: "metabolic",      relevance: "low" },
  "metformin":          { canonical: "Metformina",           category: "biguanide",            therapy_type: "metabolic",      relevance: "low" },
  "glucophage":         { canonical: "Metformina",           category: "biguanide",            therapy_type: "metabolic",      relevance: "low" },
  "gliclazide":         { canonical: "Gliclazide",           category: "sulfonylurea",         therapy_type: "metabolic",      relevance: "low" },
  "diamicron":          { canonical: "Gliclazide",           category: "sulfonylurea",         therapy_type: "metabolic",      relevance: "low" },
  "glibenclamide":      { canonical: "Glibenclamide",        category: "sulfonylurea",         therapy_type: "metabolic",      relevance: "low" },
  "daonil":             { canonical: "Glibenclamide",        category: "sulfonylurea",         therapy_type: "metabolic",      relevance: "low" },
  "sitagliptin":        { canonical: "Sitagliptin",          category: "dpp4_inhibitor",       therapy_type: "metabolic",      relevance: "low" },
  "januvia":            { canonical: "Sitagliptin",          category: "dpp4_inhibitor",       therapy_type: "metabolic",      relevance: "low" },
  "saxagliptin":        { canonical: "Saxagliptin",          category: "dpp4_inhibitor",       therapy_type: "metabolic",      relevance: "low" },
  "onglyza":            { canonical: "Saxagliptin",          category: "dpp4_inhibitor",       therapy_type: "metabolic",      relevance: "low" },
  "linagliptin":        { canonical: "Linagliptin",          category: "dpp4_inhibitor",       therapy_type: "metabolic",      relevance: "low" },
  "trajenta":           { canonical: "Linagliptin",          category: "dpp4_inhibitor",       therapy_type: "metabolic",      relevance: "low" },
  "empagliflozin":      { canonical: "Empagliflozin",        category: "sglt2_inhibitor",      therapy_type: "metabolic",      relevance: "low" },
  "jardiance":          { canonical: "Empagliflozin",        category: "sglt2_inhibitor",      therapy_type: "metabolic",      relevance: "low" },
  "dapagliflozin":      { canonical: "Dapagliflozin",        category: "sglt2_inhibitor",      therapy_type: "metabolic",      relevance: "low" },
  "forxiga":            { canonical: "Dapagliflozin",        category: "sglt2_inhibitor",      therapy_type: "metabolic",      relevance: "low" },
  "canagliflozin":      { canonical: "Canagliflozin",        category: "sglt2_inhibitor",      therapy_type: "metabolic",      relevance: "low" },
  "invokana":           { canonical: "Canagliflozin",        category: "sglt2_inhibitor",      therapy_type: "metabolic",      relevance: "low" },
  "semaglutide":        { canonical: "Semaglutide",          category: "glp1_agonist",         therapy_type: "metabolic",      relevance: "low" },
  "ozempic":            { canonical: "Semaglutide",          category: "glp1_agonist",         therapy_type: "metabolic",      relevance: "low" },
  "wegovy":             { canonical: "Semaglutide",          category: "glp1_agonist",         therapy_type: "metabolic",      relevance: "low" },
  "liraglutide":        { canonical: "Liraglutide",          category: "glp1_agonist",         therapy_type: "metabolic",      relevance: "low" },
  "victoza":            { canonical: "Liraglutide",          category: "glp1_agonist",         therapy_type: "metabolic",      relevance: "low" },
  "dulaglutide":        { canonical: "Dulaglutide",          category: "glp1_agonist",         therapy_type: "metabolic",      relevance: "low" },
  "trulicity":          { canonical: "Dulaglutide",          category: "glp1_agonist",         therapy_type: "metabolic",      relevance: "low" },
  "insulina":           { canonical: "Insulina",             category: "insulin",              therapy_type: "metabolic",      relevance: "low" },
  "insulin":            { canonical: "Insulina",             category: "insulin",              therapy_type: "metabolic",      relevance: "low" },
  "lantus":             { canonical: "Insulina",             category: "insulin",              therapy_type: "metabolic",      relevance: "low" },
  "toujeo":             { canonical: "Insulina",             category: "insulin",              therapy_type: "metabolic",      relevance: "low" },
  "tresiba":            { canonical: "Insulina",             category: "insulin",              therapy_type: "metabolic",      relevance: "low" },
  "novorapid":          { canonical: "Insulina",             category: "insulin",              therapy_type: "metabolic",      relevance: "low" },
  "humalog":            { canonical: "Insulina",             category: "insulin",              therapy_type: "metabolic",      relevance: "low" },

  // ── Uricostatici / iperuricemia (gotta) ──────────────────────────────────
  "allopurinolo":       { canonical: "Allopurinolo",         category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "allopurinol":        { canonical: "Allopurinolo",         category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "zyloric":            { canonical: "Allopurinolo",         category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "febuxostat":         { canonical: "Febuxostat",           category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "adenuric":           { canonical: "Febuxostat",           category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "benzbromarone":      { canonical: "Benzbromarone",        category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "benzbromaron":       { canonical: "Benzbromarone",        category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "uricovac":           { canonical: "Benzbromarone",        category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "desuric":            { canonical: "Benzbromarone",        category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "probenecid":         { canonical: "Probenecid",           category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "pegloticase":        { canonical: "Pegloticase",          category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "krystexxa":          { canonical: "Pegloticase",          category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "rasburicase":        { canonical: "Rasburicase",          category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },
  "fasturtec":          { canonical: "Rasburicase",          category: "urate_lowering",       therapy_type: "metabolic",      relevance: "medium" },

  // ── Gastroprotettori (PPI) ────────────────────────────────────────────────
  "omeprazolo":         { canonical: "Omeprazolo",           category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "omeprazol":          { canonical: "Omeprazolo",           category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "losec":              { canonical: "Omeprazolo",           category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "pantoprazolo":       { canonical: "Pantoprazolo",         category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "pantoprazol":        { canonical: "Pantoprazolo",         category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "pantopan":           { canonical: "Pantoprazolo",         category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "pantorc":            { canonical: "Pantoprazolo",         category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "lansoprazolo":       { canonical: "Lansoprazolo",         category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "zoton":              { canonical: "Lansoprazolo",         category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "esomeprazolo":       { canonical: "Esomeprazolo",         category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "nexium":             { canonical: "Esomeprazolo",         category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "rabeprazolo":        { canonical: "Rabeprazolo",          category: "ppi",                  therapy_type: "supportive",     relevance: "low" },
  "pariet":             { canonical: "Rabeprazolo",          category: "ppi",                  therapy_type: "supportive",     relevance: "low" },

  // ── Tiroide ───────────────────────────────────────────────────────────────
  "levotiroxina":       { canonical: "Levotiroxina",         category: "thyroid",              therapy_type: "supportive",     relevance: "low" },
  "levothyroxine":      { canonical: "Levotiroxina",         category: "thyroid",              therapy_type: "supportive",     relevance: "low" },
  "eutirox":            { canonical: "Levotiroxina",         category: "thyroid",              therapy_type: "supportive",     relevance: "low" },
  "tirosint":           { canonical: "Levotiroxina",         category: "thyroid",              therapy_type: "supportive",     relevance: "low" },
  "l-tiroxina":         { canonical: "Levotiroxina",         category: "thyroid",              therapy_type: "supportive",     relevance: "low" },
  "propiltiouracile":   { canonical: "Propiltiouracile",     category: "thyroid",              therapy_type: "supportive",     relevance: "low" },
  "tapazole":           { canonical: "Metimazolo",           category: "thyroid",              therapy_type: "supportive",     relevance: "low" },

  // ── Bifosfonati e anti-osteoporotici ──────────────────────────────────────
  "alendronato":        { canonical: "Alendronato",          category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "alendronate":        { canonical: "Alendronato",          category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "fosamax":            { canonical: "Alendronato",          category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "fosavance":          { canonical: "Alendronato",          category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "adronat":            { canonical: "Alendronato",          category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "risedronato":        { canonical: "Risedronato",          category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "risedronate":        { canonical: "Risedronato",          category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "actonel":            { canonical: "Risedronato",          category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "zoledronato":        { canonical: "Acido Zoledronico",    category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "zoledronate":        { canonical: "Acido Zoledronico",    category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "acido zoledronico":  { canonical: "Acido Zoledronico",    category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "aclasta":            { canonical: "Acido Zoledronico",    category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "zometa":             { canonical: "Acido Zoledronico",    category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "ibandronato":        { canonical: "Ibandronato",          category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "bonviva":            { canonical: "Ibandronato",          category: "bisphosphonate",       therapy_type: "osteoporosis",   relevance: "low" },
  "denosumab":          { canonical: "Denosumab",            category: "denosumab",            therapy_type: "osteoporosis",   relevance: "low" },
  "prolia":             { canonical: "Denosumab",            category: "denosumab",            therapy_type: "osteoporosis",   relevance: "low" },
  "romosozumab":        { canonical: "Romosozumab",          category: "denosumab",            therapy_type: "osteoporosis",   relevance: "low" },
  "evenity":            { canonical: "Romosozumab",          category: "denosumab",            therapy_type: "osteoporosis",   relevance: "low" },
  "teriparatide":       { canonical: "Teriparatide",         category: "denosumab",            therapy_type: "osteoporosis",   relevance: "low" },
  "forteo":             { canonical: "Teriparatide",         category: "denosumab",            therapy_type: "osteoporosis",   relevance: "low" },

  // ── Antivirali HBV ────────────────────────────────────────────────────────
  "tenofovir":          { canonical: "Tenofovir",            category: "antiviral_hbv",        therapy_type: "antiviral",      relevance: "medium" },
  "viread":             { canonical: "Tenofovir",            category: "antiviral_hbv",        therapy_type: "antiviral",      relevance: "medium" },
  "vemlidy":            { canonical: "Tenofovir alafenamide", category: "antiviral_hbv",        therapy_type: "antiviral",      relevance: "medium" },
  "entecavir":          { canonical: "Entecavir",            category: "antiviral_hbv",        therapy_type: "antiviral",      relevance: "medium" },
  "baraclude":          { canonical: "Entecavir",            category: "antiviral_hbv",        therapy_type: "antiviral",      relevance: "medium" },
  "lamivudina":         { canonical: "Lamivudina",           category: "antiviral_hbv",        therapy_type: "antiviral",      relevance: "medium" },
  "epivir":             { canonical: "Lamivudina",           category: "antiviral_hbv",        therapy_type: "antiviral",      relevance: "medium" },
  "telbivudina":        { canonical: "Telbivudina",          category: "antiviral_hbv",        therapy_type: "antiviral",      relevance: "medium" },
  "sebivo":             { canonical: "Telbivudina",          category: "antiviral_hbv",        therapy_type: "antiviral",      relevance: "medium" },
  "adefovir":           { canonical: "Adefovir",             category: "antiviral_hbv",        therapy_type: "antiviral",      relevance: "medium" },

  // ── Antivirali HCV ────────────────────────────────────────────────────────
  "sofosbuvir":         { canonical: "Sofosbuvir",           category: "antiviral_hcv",        therapy_type: "antiviral",      relevance: "medium" },
  "sovaldi":            { canonical: "Sofosbuvir",           category: "antiviral_hcv",        therapy_type: "antiviral",      relevance: "medium" },
  "daclatasvir":        { canonical: "Daclatasvir",          category: "antiviral_hcv",        therapy_type: "antiviral",      relevance: "medium" },
  "daklinza":           { canonical: "Daclatasvir",          category: "antiviral_hcv",        therapy_type: "antiviral",      relevance: "medium" },
  "ledipasvir":         { canonical: "Ledipasvir/Sofosbuvir", category: "antiviral_hcv",        therapy_type: "antiviral",      relevance: "medium" },
  "harvoni":            { canonical: "Ledipasvir/Sofosbuvir", category: "antiviral_hcv",        therapy_type: "antiviral",      relevance: "medium" },
  "velpatasvir":        { canonical: "Sofosbuvir/Velpatasvir", category: "antiviral_hcv",        therapy_type: "antiviral",      relevance: "medium" },
  "epclusa":            { canonical: "Sofosbuvir/Velpatasvir", category: "antiviral_hcv",        therapy_type: "antiviral",      relevance: "medium" },
  "glecaprevir":        { canonical: "Glecaprevir/Pibrentasvir", category: "antiviral_hcv",        therapy_type: "antiviral",      relevance: "medium" },
  "maviret":            { canonical: "Glecaprevir/Pibrentasvir", category: "antiviral_hcv",        therapy_type: "antiviral",      relevance: "medium" },

  // ── Immunoglobuline endovena (IVIg) — usate in CAPS, miosite, IgG4-RD ───
  "immunoglobuline":      { canonical: "IVIg",              category: "immunotherapy",        therapy_type: "immunomodulatory", relevance: "medium" },
  "immunoglobuline ev":   { canonical: "IVIg",              category: "immunotherapy",        therapy_type: "immunomodulatory", relevance: "medium" },
  "ig endovena":          { canonical: "IVIg",              category: "immunotherapy",        therapy_type: "immunomodulatory", relevance: "medium" },
  "ivig":                 { canonical: "IVIg",              category: "immunotherapy",        therapy_type: "immunomodulatory", relevance: "medium" },
  "gammaglobuline":       { canonical: "IVIg",              category: "immunotherapy",        therapy_type: "immunomodulatory", relevance: "medium" },
  "privigen":             { canonical: "IVIg",              category: "immunotherapy",        therapy_type: "immunomodulatory", relevance: "medium" },
  "octagam":              { canonical: "IVIg",              category: "immunotherapy",        therapy_type: "immunomodulatory", relevance: "medium" },
  "kiovig":               { canonical: "IVIg",              category: "immunotherapy",        therapy_type: "immunomodulatory", relevance: "medium" },

  // ── Analgesici / altro supportivo ─────────────────────────────────────────
  "paracetamolo":       { canonical: "Paracetamolo",         category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
  "acetaminophen":      { canonical: "Paracetamolo",         category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
  "tachipirina":        { canonical: "Paracetamolo",         category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
  "efferalgan":         { canonical: "Paracetamolo",         category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
  "tramadolo":          { canonical: "Tramadolo",            category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
  "tramadol":           { canonical: "Tramadolo",            category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
  "contramal":          { canonical: "Tramadolo",            category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
  "pregabalin":         { canonical: "Pregabalin",           category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
  "lyrica":             { canonical: "Pregabalin",           category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
  "gabapentin":         { canonical: "Gabapentin",           category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
  "neurontin":          { canonical: "Gabapentin",           category: "analgesic",            therapy_type: "supportive",     relevance: "low" },
};
