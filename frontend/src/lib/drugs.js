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
};

// Helper per mostrare etichetta compatta "Ind → Dose"
// Struttura drug:
// { name, category, routes[], defaultIndication, notes, regimens: [{ indication, dose, frequency, route, loading?, note }] }
export const DRUGS = [
  // ======= csDMARDs =======
  {
    name: "Methotrexate",
    category: "csDMARD",
    notes: "Sempre con Acido folico 5 mg ≥24h dopo MTX.",
    regimens: [
      { indication: "RA", dose: "15 mg", frequency: "Settimanale", route: "orale o s.c.", note: "Titolare fino a 25 mg/sett se necessario" },
      { indication: "PsA", dose: "15 mg", frequency: "Settimanale", route: "orale o s.c." },
      { indication: "JIA", dose: "10-15 mg/m²", frequency: "Settimanale", route: "orale o s.c." },
      { indication: "Myositis", dose: "15-25 mg", frequency: "Settimanale", route: "orale o s.c." },
      { indication: "SLE", dose: "10-20 mg", frequency: "Settimanale", route: "orale o s.c." },
      { indication: "Behcet", dose: "7.5-15 mg", frequency: "Settimanale", route: "orale" },
    ],
  },
  { name: "Leflunomide", category: "csDMARD", regimens: [
    { indication: "RA", dose: "20 mg", frequency: "Giornaliera", route: "orale", loading: "100 mg/die x 3 gg (opzionale)" },
    { indication: "PsA", dose: "20 mg", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Sulfasalazina", category: "csDMARD", regimens: [
    { indication: "RA", dose: "2-3 g", frequency: "Giornaliera (in 2-3 somministrazioni)", route: "orale" },
    { indication: "PsA", dose: "2 g", frequency: "Giornaliera", route: "orale" },
    { indication: "axSpA", dose: "2-3 g", frequency: "Giornaliera", route: "orale", note: "Solo SpA con artrite periferica" },
    { indication: "JIA", dose: "30-50 mg/kg/die", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Idrossiclorochina", category: "csDMARD", regimens: [
    { indication: "SLE", dose: "200-400 mg", frequency: "Giornaliera", route: "orale", note: "Max 5 mg/kg/die (peso reale) per minimizzare rischio retinico" },
    { indication: "RA", dose: "200-400 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "Sjogren", dose: "200-400 mg", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Azatioprina", category: "csDMARD", regimens: [
    { indication: "SLE", dose: "1-3 mg/kg/die", frequency: "Giornaliera", route: "orale", note: "Tipicamente 50-150 mg/die" },
    { indication: "AAV", dose: "1-2 mg/kg/die", frequency: "Giornaliera", route: "orale", note: "Mantenimento post-CYC" },
    { indication: "Behcet", dose: "2-3 mg/kg/die", frequency: "Giornaliera", route: "orale" },
    { indication: "Myositis", dose: "1-2 mg/kg/die", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Micofenolato Mofetil", category: "csDMARD", regimens: [
    { indication: "SSc_ILD", dose: "2-3 g", frequency: "Giornaliera (in 2 somministrazioni)", route: "orale" },
    { indication: "LES_renal", dose: "2-3 g", frequency: "Giornaliera (in 2 somministrazioni)", route: "orale", note: "Induzione nefrite lupica" },
    { indication: "SLE", dose: "1-2 g", frequency: "Giornaliera", route: "orale" },
    { indication: "AAV", dose: "2-3 g", frequency: "Giornaliera", route: "orale" },
    { indication: "Myositis", dose: "2-3 g", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Ciclosporina", category: "csDMARD", regimens: [
    { indication: "SLE", dose: "2.5-4 mg/kg/die", frequency: "Giornaliera (in 2 somministrazioni)", route: "orale" },
    { indication: "Behcet", dose: "3-5 mg/kg/die", frequency: "Giornaliera", route: "orale" },
    { indication: "Uveitis", dose: "3-5 mg/kg/die", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Tacrolimus", category: "csDMARD", regimens: [
    { indication: "LES_renal", dose: "0.05-0.1 mg/kg/die", frequency: "Giornaliera (in 2 somministrazioni)", route: "orale", note: "Target livelli 4-8 ng/mL" },
    { indication: "Myositis", dose: "0.06-0.1 mg/kg/die", frequency: "Giornaliera", route: "orale", note: "Target 5-10 ng/mL in MDA5-ILD" },
  ]},
  { name: "Ciclofosfamide", category: "csDMARD", regimens: [
    { indication: "AAV", dose: "15 mg/kg (max 1.2 g)", frequency: "Ogni 2-3 settimane", route: "e.v.", note: "6 boli NIH/EUVAS" },
    { indication: "LES_renal", dose: "500 mg", frequency: "Ogni 2 settimane", route: "e.v.", note: "6 boli (schema EuroLupus)" },
    { indication: "SSc_ILD", dose: "500-750 mg/m²", frequency: "Mensile", route: "e.v.", note: "6-12 mesi" },
  ]},

  // ======= Glucocorticoids =======
  { name: "Prednisone", category: "glucocorticoid", regimens: [
    { indication: "RA", dose: "5-10 mg", frequency: "Giornaliera", route: "orale", note: "Bridging temporaneo, tapering rapido" },
    { indication: "SLE", dose: "0.5-1 mg/kg/die", frequency: "Giornaliera", route: "orale", note: "Dose in base a severità" },
    { indication: "AAV", dose: "1 mg/kg/die (max 60-80 mg)", frequency: "Giornaliera", route: "orale" },
    { indication: "GCA", dose: "40-60 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "PMR", dose: "12.5-25 mg", frequency: "Giornaliera", route: "orale", note: "Tapering in 12-24 mesi" },
    { indication: "Myositis", dose: "1 mg/kg/die", frequency: "Giornaliera", route: "orale" },
    { indication: "AOSD", dose: "0.5-1 mg/kg/die", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Metilprednisolone (bolo)", category: "glucocorticoid", regimens: [
    { indication: "SLE", dose: "500-1000 mg", frequency: "Giornaliera x 3 gg", route: "e.v." },
    { indication: "AAV", dose: "500-1000 mg", frequency: "Giornaliera x 3 gg", route: "e.v." },
    { indication: "GCA", dose: "500-1000 mg", frequency: "Giornaliera x 3 gg", route: "e.v.", note: "Se perdita visiva" },
    { indication: "Myositis", dose: "500-1000 mg", frequency: "Giornaliera x 3 gg", route: "e.v." },
  ]},

  // ======= TNF inhibitors =======
  { name: "Adalimumab", category: "bDMARD", regimens: [
    { indication: "RA", dose: "40 mg", frequency: "Ogni 2 settimane", route: "s.c." },
    { indication: "PsA", dose: "40 mg", frequency: "Ogni 2 settimane", route: "s.c." },
    { indication: "axSpA", dose: "40 mg", frequency: "Ogni 2 settimane", route: "s.c." },
    { indication: "Uveitis", dose: "80 mg loading → 40 mg", frequency: "Ogni 2 settimane", route: "s.c." },
    { indication: "JIA", dose: "20 mg (peso 10-30 kg) / 40 mg (>30 kg)", frequency: "Ogni 2 settimane", route: "s.c." },
    { indication: "IBD", dose: "160 mg → 80 mg → 40 mg", frequency: "Ogni 2 settimane", route: "s.c.", loading: "160 mg sett 0, 80 mg sett 2" },
    { indication: "HS", dose: "160 mg → 80 mg → 40 mg", frequency: "Settimanale", route: "s.c." },
  ]},
  { name: "Etanercept", category: "bDMARD", regimens: [
    { indication: "RA", dose: "50 mg", frequency: "Settimanale", route: "s.c." },
    { indication: "PsA", dose: "50 mg", frequency: "Settimanale", route: "s.c." },
    { indication: "axSpA", dose: "50 mg", frequency: "Settimanale", route: "s.c." },
    { indication: "JIA", dose: "0.4 mg/kg (max 25 mg) x 2/sett oppure 0.8 mg/kg (max 50 mg)", frequency: "Settimanale", route: "s.c." },
  ]},
  { name: "Infliximab", category: "bDMARD", regimens: [
    { indication: "RA", dose: "3 mg/kg", frequency: "Sett 0, 2, 6 poi ogni 8 settimane", route: "e.v." },
    { indication: "PsA", dose: "5 mg/kg", frequency: "Sett 0, 2, 6 poi ogni 8 settimane", route: "e.v." },
    { indication: "axSpA", dose: "5 mg/kg", frequency: "Sett 0, 2, 6 poi ogni 6-8 settimane", route: "e.v." },
    { indication: "Behcet", dose: "5 mg/kg", frequency: "Sett 0, 2, 6 poi ogni 8 settimane", route: "e.v.", note: "Uveite posteriore / vascolare" },
    { indication: "Uveitis", dose: "5 mg/kg", frequency: "Ogni 6-8 settimane", route: "e.v." },
    { indication: "TAK", dose: "5 mg/kg", frequency: "Ogni 6-8 settimane", route: "e.v." },
    { indication: "IBD", dose: "5 mg/kg", frequency: "Sett 0, 2, 6 poi ogni 8 settimane", route: "e.v." },
  ]},
  { name: "Certolizumab pegol", category: "bDMARD", regimens: [
    { indication: "RA", dose: "400 mg → 200 mg", frequency: "Ogni 2 settimane (o 400 mg ogni 4 sett)", route: "s.c.", loading: "400 mg settimana 0, 2, 4" },
    { indication: "axSpA", dose: "200 mg ogni 2 sett o 400 mg ogni 4 sett", frequency: "Vedi dose", route: "s.c." },
    { indication: "PsA", dose: "200 mg ogni 2 sett o 400 mg ogni 4 sett", frequency: "Vedi dose", route: "s.c." },
  ]},
  { name: "Golimumab", category: "bDMARD", regimens: [
    { indication: "RA", dose: "50 mg", frequency: "Mensile", route: "s.c." },
    { indication: "PsA", dose: "50 mg", frequency: "Mensile", route: "s.c." },
    { indication: "axSpA", dose: "50 mg", frequency: "Mensile", route: "s.c." },
    { indication: "JIA", dose: "50 mg (30-80 kg) / 100 mg (>80 kg)", frequency: "Mensile", route: "s.c." },
  ]},

  // ======= IL-6 =======
  { name: "Tocilizumab", category: "bDMARD", regimens: [
    { indication: "RA", dose: "8 mg/kg (max 800 mg)", frequency: "Ogni 4 settimane", route: "e.v." },
    { indication: "RA", dose: "162 mg", frequency: "Settimanale", route: "s.c." },
    { indication: "GCA", dose: "162 mg", frequency: "Settimanale", route: "s.c." },
    { indication: "SSc_ILD", dose: "162 mg", frequency: "Settimanale", route: "s.c." },
    { indication: "JIA", dose: "8-12 mg/kg (sJIA) / 8 mg/kg (poly-JIA)", frequency: "Ogni 2-4 settimane", route: "e.v." },
    { indication: "AOSD", dose: "8 mg/kg ogni 2-4 sett o 162 mg/sett", frequency: "Vedi dose", route: "e.v. o s.c." },
  ]},
  { name: "Sarilumab", category: "bDMARD", regimens: [
    { indication: "RA", dose: "200 mg", frequency: "Ogni 2 settimane", route: "s.c." },
  ]},

  // ======= CD20 / B-cell =======
  { name: "Rituximab", category: "bDMARD", regimens: [
    { indication: "RA", dose: "1000 mg x 2 (day 1 e 15)", frequency: "Cicli ogni 6 mesi", route: "e.v." },
    { indication: "AAV", dose: "375 mg/m² settimanale x 4 OPPURE 1000 mg x 2", frequency: "Induzione", route: "e.v." },
    { indication: "SLE", dose: "1000 mg x 2 (day 1 e 15)", frequency: "Cicli ogni 6 mesi (off-label)", route: "e.v." },
    { indication: "Sjogren", dose: "1000 mg x 2", frequency: "Ogni 6 mesi (off-label)", route: "e.v." },
    { indication: "Myositis", dose: "1000 mg x 2 (day 1 e 15)", frequency: "Cicli 6-12 mesi", route: "e.v." },
  ]},

  // ======= CTLA-4 =======
  { name: "Abatacept", category: "bDMARD", regimens: [
    { indication: "RA", dose: "125 mg", frequency: "Settimanale", route: "s.c." },
    { indication: "RA", dose: "10 mg/kg", frequency: "Sett 0, 2, 4 poi ogni 4 settimane", route: "e.v." },
    { indication: "PsA", dose: "125 mg settimanale o 10 mg/kg ogni 4 sett", frequency: "Vedi dose", route: "s.c. o e.v." },
    { indication: "JIA", dose: "10 mg/kg (peso <75 kg)", frequency: "Ogni 4 settimane", route: "e.v." },
  ]},

  // ======= BLyS / IFN =======
  { name: "Belimumab", category: "bDMARD", regimens: [
    { indication: "SLE", dose: "10 mg/kg", frequency: "Sett 0, 2, 4 poi ogni 4 settimane", route: "e.v." },
    { indication: "SLE", dose: "200 mg", frequency: "Settimanale", route: "s.c." },
    { indication: "LES_renal", dose: "10 mg/kg e.v. o 200 mg s.c./sett", frequency: "Vedi dose", route: "e.v. o s.c." },
  ]},
  { name: "Anifrolumab", category: "bDMARD", regimens: [
    { indication: "SLE", dose: "300 mg", frequency: "Ogni 4 settimane", route: "e.v." },
  ]},

  // ======= IL-17 =======
  { name: "Secukinumab", category: "bDMARD", notes: "Dosaggi DIVERSI per indicazione.", regimens: [
    { indication: "PsO", dose: "300 mg", frequency: "Sett 0,1,2,3,4 poi mensile", route: "s.c.", loading: "5 dosi di carico settimanali" },
    { indication: "PsA", dose: "150 mg (300 mg se PsO coesistente)", frequency: "Sett 0,1,2,3,4 poi mensile", route: "s.c." },
    { indication: "axSpA", dose: "150 mg", frequency: "Sett 0,1,2,3,4 poi mensile", route: "s.c." },
    { indication: "HS", dose: "300 mg", frequency: "Settimanale x 5 poi ogni 4 sett (o 2 sett se inadeguata risposta)", route: "s.c." },
  ]},
  { name: "Ixekizumab", category: "bDMARD", regimens: [
    { indication: "PsO", dose: "160 mg → 80 mg", frequency: "Loading + 80 mg ogni 2 sett x 12 sett, poi ogni 4 sett", route: "s.c.", loading: "160 mg a sett 0" },
    { indication: "PsA", dose: "160 mg → 80 mg", frequency: "Loading + 80 mg ogni 4 settimane", route: "s.c." },
    { indication: "axSpA", dose: "160 mg → 80 mg", frequency: "Loading + 80 mg ogni 4 settimane", route: "s.c." },
  ]},
  { name: "Bimekizumab", category: "bDMARD", regimens: [
    { indication: "PsO", dose: "320 mg", frequency: "Ogni 4 sett x 16 sett, poi ogni 8 sett", route: "s.c." },
    { indication: "PsA", dose: "160 mg", frequency: "Ogni 4 settimane", route: "s.c." },
    { indication: "axSpA", dose: "160 mg", frequency: "Ogni 4 settimane", route: "s.c." },
    { indication: "HS", dose: "320 mg", frequency: "Ogni 2 sett x 16 sett, poi ogni 4 sett", route: "s.c." },
  ]},

  // ======= IL-23 =======
  { name: "Ustekinumab", category: "bDMARD", regimens: [
    { indication: "PsO", dose: "45 mg (<100 kg) / 90 mg (>100 kg)", frequency: "Sett 0, 4 poi ogni 12 sett", route: "s.c." },
    { indication: "PsA", dose: "45 mg (<100 kg) / 90 mg (>100 kg)", frequency: "Sett 0, 4 poi ogni 12 sett", route: "s.c." },
    { indication: "IBD", dose: "~6 mg/kg e.v. (induzione) → 90 mg s.c. ogni 8 sett", frequency: "Induzione e mantenimento", route: "e.v. poi s.c." },
  ]},
  { name: "Guselkumab", category: "bDMARD", regimens: [
    { indication: "PsO", dose: "100 mg", frequency: "Sett 0, 4 poi ogni 8 settimane", route: "s.c." },
    { indication: "PsA", dose: "100 mg", frequency: "Sett 0, 4 poi ogni 8 settimane", route: "s.c." },
  ]},
  { name: "Risankizumab", category: "bDMARD", regimens: [
    { indication: "PsO", dose: "150 mg", frequency: "Sett 0, 4 poi ogni 12 settimane", route: "s.c." },
    { indication: "PsA", dose: "150 mg", frequency: "Sett 0, 4 poi ogni 12 settimane", route: "s.c." },
  ]},

  // ======= IL-1 =======
  { name: "Anakinra", category: "bDMARD", regimens: [
    { indication: "RA", dose: "100 mg", frequency: "Giornaliera", route: "s.c." },
    { indication: "AOSD", dose: "100-200 mg", frequency: "Giornaliera", route: "s.c." },
    { indication: "Gout", dose: "100 mg", frequency: "Giornaliera x 3-5 gg", route: "s.c.", note: "Attacco acuto refrattario" },
    { indication: "CAPS", dose: "1-2 mg/kg/die (max 100-200 mg)", frequency: "Giornaliera", route: "s.c." },
    { indication: "FMF", dose: "100 mg", frequency: "Giornaliera", route: "s.c.", note: "Refrattaria colchicina" },
  ]},
  { name: "Canakinumab", category: "bDMARD", regimens: [
    { indication: "AOSD", dose: "4 mg/kg (max 300 mg)", frequency: "Ogni 4 settimane", route: "s.c." },
    { indication: "CAPS", dose: "150 mg (o 2 mg/kg se <40 kg)", frequency: "Ogni 8 settimane", route: "s.c." },
    { indication: "FMF", dose: "150 mg (2 mg/kg se <40 kg)", frequency: "Ogni 4-8 settimane", route: "s.c." },
    { indication: "TRAPS", dose: "150 mg", frequency: "Ogni 4-8 settimane", route: "s.c." },
    { indication: "HIDS", dose: "150 mg", frequency: "Ogni 4-8 settimane", route: "s.c." },
    { indication: "Gout", dose: "150 mg", frequency: "Singola dose al bisogno", route: "s.c." },
  ]},

  // ======= JAK inhibitors =======
  { name: "Tofacitinib", category: "tsDMARD", notes: "Attenzione MACE/malignità/TEV in pazienti a rischio.", regimens: [
    { indication: "RA", dose: "5 mg", frequency: "2 volte/die (o 11 mg XR 1/die)", route: "orale" },
    { indication: "PsA", dose: "5 mg", frequency: "2 volte/die", route: "orale" },
    { indication: "axSpA", dose: "5 mg", frequency: "2 volte/die", route: "orale" },
    { indication: "JIA", dose: "5 mg (>40 kg) scalato per peso", frequency: "2 volte/die", route: "orale" },
    { indication: "IBD", dose: "10 mg 2 volte/die (induzione) → 5 mg 2 volte/die", frequency: "Vedi dose", route: "orale", note: "Colite ulcerosa" },
  ]},
  { name: "Baricitinib", category: "tsDMARD", regimens: [
    { indication: "RA", dose: "4 mg", frequency: "Giornaliera (2 mg se ≥75 aa o ClCr 30-60)", route: "orale" },
    { indication: "JIA", dose: "Peso-dipendente (2-4 mg)", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Upadacitinib", category: "tsDMARD", notes: "Posologia uniforme 15 mg/die per indicazioni reumatologiche.", regimens: [
    { indication: "RA", dose: "15 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "PsA", dose: "15 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "axSpA", dose: "15 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "IBD", dose: "45 mg induzione 8 sett → 15-30 mg mantenimento", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Filgotinib", category: "tsDMARD", regimens: [
    { indication: "RA", dose: "200 mg (100 mg se ≥75 aa)", frequency: "Giornaliera", route: "orale" },
  ]},

  // ======= PDE4 =======
  { name: "Apremilast", category: "tsDMARD", regimens: [
    { indication: "PsO", dose: "30 mg", frequency: "2 volte/die", route: "orale", loading: "Titolazione 10-50 mg in 6 giorni" },
    { indication: "PsA", dose: "30 mg", frequency: "2 volte/die", route: "orale" },
    { indication: "Behcet", dose: "30 mg", frequency: "2 volte/die", route: "orale", note: "Aftosi orale refrattaria" },
  ]},

  // ======= Antifibrotici =======
  { name: "Nintedanib", category: "other", regimens: [
    { indication: "SSc_ILD", dose: "150 mg", frequency: "2 volte/die", route: "orale", note: "Ridurre a 100 mg 2/die se intolleranza" },
    { indication: "PPF_ILD", dose: "150 mg", frequency: "2 volte/die", route: "orale" },
  ]},
  { name: "Pirfenidone", category: "other", regimens: [
    { indication: "PPF_ILD", dose: "801 mg (3 cps da 267 mg)", frequency: "3 volte/die", route: "orale", loading: "Titolazione in 2 sett" },
  ]},

  // ======= Altri =======
  { name: "Colchicina", category: "other", regimens: [
    { indication: "FMF", dose: "1-2 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "Gout", dose: "1 mg iniziale + 0.5 mg dopo 1h (acuto); 0.5-1 mg/die (profilassi)", frequency: "Vedi dose", route: "orale" },
    { indication: "Behcet", dose: "1-2 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "PMR", dose: "—", frequency: "—", route: "—", note: "Non di routine" },
  ]},
  { name: "Allopurinolo", category: "other", regimens: [
    { indication: "Gout", dose: "100 mg (start) titolando a 300-600 mg/die", frequency: "Giornaliera", route: "orale", note: "Target uricemia <6 mg/dL (<5 in gotta tofacea)" },
  ]},
  { name: "Febuxostat", category: "other", regimens: [
    { indication: "Gout", dose: "80-120 mg", frequency: "Giornaliera", route: "orale" },
  ]},

  // ======= FANS =======
  { name: "Naprossene", category: "NSAID", regimens: [
    { indication: "axSpA", dose: "500-1000 mg", frequency: "Giornaliera (in 2 somministrazioni)", route: "orale" },
    { indication: "RA", dose: "500-1000 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "Gout", dose: "500 mg", frequency: "2 volte/die (acuto)", route: "orale" },
  ]},
  { name: "Indometacina", category: "NSAID", regimens: [
    { indication: "Gout", dose: "50 mg", frequency: "3 volte/die (acuto)", route: "orale" },
    { indication: "axSpA", dose: "75-150 mg", frequency: "Giornaliera", route: "orale" },
  ]},
  { name: "Etoricoxib", category: "NSAID", regimens: [
    { indication: "RA", dose: "60-90 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "axSpA", dose: "60-90 mg", frequency: "Giornaliera", route: "orale" },
    { indication: "Gout", dose: "120 mg", frequency: "Giornaliera (max 8 gg)", route: "orale" },
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
