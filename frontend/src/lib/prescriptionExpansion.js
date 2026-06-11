/**
 * prescriptionExpansion.js
 *
 * Template-based prescription text expansion.
 * Covers csDMARDs, tsDMARDs, bDMARDs.
 *
 * Add a new drug by appending an entry to DRUG_TEMPLATES.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEEKDAYS_IT = [
  "domenica", "lunedì", "martedì", "mercoledì",
  "giovedì", "venerdì", "sabato",
];

function normFreq(freq) {
  const f = (freq || "").toLowerCase();
  if (f.includes("mensil"))                                 return "/mese";
  if (f.includes("bisettimanal") || f.includes("ogni 2"))  return " ogni 2 settimane";
  if (f.includes("12 settiman") || f.includes("ogni 12"))  return " ogni 12 settimane";
  if (f.includes("8 settiman")  || f.includes("ogni 8"))   return " ogni 8 settimane";
  if (f.includes("6 settiman")  || f.includes("ogni 6"))   return " ogni 6 settimane";
  if (f.includes("4 settiman")  || f.includes("ogni 4"))   return " ogni 4 settimane";
  if (f.includes("3 settiman")  || f.includes("ogni 3"))   return " ogni 3 settimane";
  if (f.includes("giorn") || f.includes("quotidian"))      return "/giorno";
  if (f.includes("settiman"))                               return "/settimana";
  return freq ? ` (${freq})` : "";
}

function normRoute(route) {
  const r = (route || "").toLowerCase();
  if (r.includes(" os") || r.startsWith("os") || r.includes("orale")) return "per os";
  if (r.includes("sc") || r.includes("sottocutan"))                    return "s.c.";
  if (r.includes("im") || r.includes("intramuscol"))                   return "i.m.";
  if (r.includes("ev") || r.includes("endovena") || r.includes("infus")) return "e.v.";
  return route || "";
}

function buildBaseSentence(displayName, { dose, frequency, route }) {
  const freqNorm  = normFreq(frequency);
  const routeNorm = normRoute(route);
  let s = `Avvia ${displayName}`;
  if (dose)      s += ` ${dose.trim()}`;
  if (freqNorm)  s += freqNorm;
  if (routeNorm) s += ` ${routeNorm}`;
  s += ".";
  return s;
}

function nextWeekday(day) {
  const idx = WEEKDAYS_IT.indexOf((day || "").toLowerCase());
  if (idx < 0) return null;
  return WEEKDAYS_IT[(idx + 1) % 7];
}

// ── Shared text blocks ────────────────────────────────────────────────────────

const T = {
  screening_biologics:
    "Pre-avvio: QuantiFERON-TB (o Mantoux), HBsAg e HBcAb ± HBV-DNA, emocromo, transaminasi, creatinina, emocromo. Valutare vaccinazioni raccomandate prima dell'avvio.",
  screening_jakis:
    "Pre-avvio: QuantiFERON-TB, HBsAg/HBcAb, emocromo, profilo lipidico, transaminasi, creatinina.",
  monitoring_biologics:
    "Monitoraggio emocromo e transaminasi a 3 mesi, poi ogni 6 mesi.",
  monitoring_jakis:
    "Monitoraggio emocromo, lipidi e transaminasi a 4-8 settimane, poi ogni 3-6 mesi.",
  tb_positive:
    "In caso di QuantiFERON positivo: iniziare profilassi TB (isoniazide ± vitamina B6) per almeno 4 settimane prima del biologico.",
  pregnancy_antitнf:
    "Gli anti-TNF attraversano la placenta (specie infliximab/adalimumab nel 3° trimestre): sicuri nei primi 2 trimestri. Se esposti nel 3° trimestre, il neonato non deve ricevere vaccini vivi per i primi 6 mesi di vita.",
  pregnancy_certolizumab:
    "Certolizumab non attraversa la placenta in modo significativo: può essere usato in gravidanza.",
  pregnancy_etanercept:
    "Etanercept: passaggio transplacentare minimo rispetto ad altri anti-TNF; generalmente accettabile in gravidanza (specie nel 1°-2° trimestre).",
  pregnancy_teratogen:
    "Farmaco teratogeno accertato; contraccezione efficace obbligatoria durante il trattamento.",
  pregnancy_other:
    "Dati limitati in gravidanza; valutare profilo rischio-beneficio individuale con la paziente.",
  hbv_reactivation:
    "Rischio di riattivazione HBV: in portatori HBsAg+ avviare profilassi con entecavir o tenofovir prima del biologico; in HBcAb+/HBsAg− monitorare HBV-DNA ogni 3 mesi.",
  mace_jaki:
    "Rischio MACE aumentato in pazienti con fattori di rischio CV (età >65 anni, fumatori, dislipidemia); preferire con cautela in tali pazienti.",
  vte_tofacitinib:
    "Rischio TEV aumentato con tofacitinib ad alta dose; evitare in pazienti con storia di TVP/EP o trombofilia.",
  malignancy_jaki:
    "Screening malignità pre-avvio; aumentata incidenza di tumori maligni segnalata, specie con lunga esposizione.",
  il17_ibd:
    "Evitare o usare con cautela in caso di IBD (malattia di Crohn attiva o pregressa): rischio di esacerbazione.",
  il6_neutropenia:
    "Sospendere se neutrofili <500/mm³ o PLT <50.000/mm³.",
  il6_lipids:
    "Monitorare il profilo lipidico: possibile incremento del colesterolo LDL in corso di terapia.",
  rituximab_preinfusion:
    "Pre-medicazione raccomandata: metilprednisolone 100 mg e.v., paracetamolo e antistaminico 30-60 minuti prima dell'infusione.",
  rituximab_ig:
    "Monitorare le immunoglobuline ogni 6 mesi; in caso di ipogammaglobulinemia sintomatica valutare supplementazione.",
  abatacept_copd:
    "Usare con cautela in BPCO: maggiore rischio di infezioni respiratorie.",
};

// ── Drug templates ────────────────────────────────────────────────────────────
// Each entry:
//   id         string   — internal identifier
//   detect     (normalizedName: string) => boolean
//   displayName string  — shown in sentence
//   extraFields { weekday?: boolean }
//   renalFlagKey string? — key of the flag to pre-check if IRC detected
//   buildBase  ({ displayName, dose, frequency, route, weekday }) => string  (optional, default: buildBaseSentence)
//   flags      [{ key, label, defaultOn, text: string | (params) => string }]

const DRUG_TEMPLATES = [

  // ═══════════════════════════════════════════════════════════════════════
  //  csDMARDs
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "mtx",
    detect: n => n === "mtx" || n.includes("metotrexato") || n.includes("methotrexat") || n.includes("metex") || n.includes("nordimet"),
    displayName: "Metotrexato",
    extraFields: { weekday: true },
    renalFlagKey: "addRenal",
    buildBase: ({ displayName, dose, frequency, route, weekday }) => {
      let s = buildBaseSentence(displayName, { dose, frequency, route });
      if (weekday) s = s.replace(".", `, da assumere il ${weekday}.`);
      return s;
    },
    flags: [
      {
        key: "addFolate",
        label: "Supplementazione con folati (Folina 5 mg il giorno dopo)",
        defaultOn: true,
        text: ({ weekday }) => {
          const next = weekday ? `, ad esempio il ${nextWeekday(weekday)}` : "";
          return `Associare Folina 5 mg almeno 24 ore dopo il MTX${next}.`;
        },
      },
      {
        key: "addMonitoring",
        label: "Monitoraggio ematochimica (mensile × 3 mesi, poi ogni 3-4 mesi)",
        defaultOn: true,
        text: "Monitoraggio mensile per 3 mesi di emocromo, transaminasi e creatinina, poi ogni 3-4 mesi.",
      },
      {
        key: "addPregnancy",
        label: "Counselling gravidanza / contraccezione",
        defaultOn: true,
        text: "Farmaco teratogeno accertato; contraccezione efficace obbligatoria. Sospendere almeno 3 mesi prima di un tentativo di concepimento (entrambi i partner).",
      },
      {
        key: "addILD",
        label: "Cautela ILD o sintomi respiratori nuovi",
        defaultOn: false,
        text: "Valutare alternative in presenza di ILD preesistente; segnalare al paziente di riferire prontamente tosse o dispnea di nuova insorgenza.",
      },
      {
        key: "addRenal",
        label: "Cautela insufficienza renale",
        defaultOn: false,
        text: "Ridurre la dose o evitare MTX in caso di IRC moderata-grave (eGFR <30 ml/min/1.73m²).",
      },
    ],
  },

  {
    id: "leflunomide",
    detect: n => n.includes("leflunomide") || n.includes("arava") || n === "lef",
    displayName: "Leflunomide",
    flags: [
      {
        key: "addLoading",
        label: "Dose di carico 100 mg × 3 giorni (poi 20 mg/die)",
        defaultOn: true,
        text: "Dose di carico 100 mg/die per 3 giorni, poi mantenimento 20 mg/die.",
      },
      {
        key: "addMonitoring",
        label: "Monitoraggio LFT ed emocromo (mensile × 6 mesi, poi ogni 2-3 mesi)",
        defaultOn: true,
        text: "Controllo mensile di transaminasi ed emocromo per i primi 6 mesi, poi ogni 2-3 mesi.",
      },
      {
        key: "addPregnancy",
        label: "Counselling gravidanza — washout obbligatorio",
        defaultOn: true,
        text: "Farmaco teratogeno; contraccezione obbligatoria durante il trattamento. In caso di gravidanza pianificata eseguire washout con colestiramina (8 g × 3/die × 11 giorni) e verificare livelli ematici <0.02 mg/L prima di sospendere la contraccezione.",
      },
      {
        key: "addBP",
        label: "Monitoraggio pressione arteriosa",
        defaultOn: false,
        text: "Monitorare la pressione arteriosa durante il trattamento.",
      },
    ],
  },

  {
    id: "hcq",
    detect: n => n.includes("idrossiclorochina") || n.includes("hydroxychloroquin") || n.includes("plaquenil") || n === "hcq",
    displayName: "Idrossiclorochina",
    flags: [
      {
        key: "addDosing",
        label: "Nota dosaggio: non superare 5 mg/kg/die di peso reale",
        defaultOn: true,
        text: "Dose massima raccomandata ≤5 mg/kg/die del peso corporeo reale per ridurre il rischio di retinopatia.",
      },
      {
        key: "addOphth",
        label: "Screening oftalmologico (basale, poi annuale dopo 5 anni)",
        defaultOn: true,
        text: "Controllo oftalmologico basale; poi annuale dopo 5 anni di trattamento (anticipare in caso di dose elevata, IRC, uso concomitante di tamoxifene, malattia maculare preesistente).",
      },
      {
        key: "addPregnancy",
        label: "Sicuro in gravidanza (continuare se necessario)",
        defaultOn: false,
        text: "HCQ è considerato sicuro in gravidanza e non deve essere sospeso in caso di gravidanza pianificata o in corso (protezione attività lupica).",
      },
    ],
  },

  {
    id: "ssz",
    detect: n => n.includes("sulfasalazina") || n.includes("sulphasalazine") || n === "ssz",
    displayName: "Sulfasalazina",
    flags: [
      {
        key: "addTitration",
        label: "Titolazione graduale (500 mg/die per settimana fino a 2-3 g/die)",
        defaultOn: true,
        text: "Avviare con 500 mg/die e aumentare di 500 mg ogni settimana fino alla dose terapeutica (di solito 2-3 g/die) per migliorare la tollerabilità gastrointestinale.",
      },
      {
        key: "addMonitoring",
        label: "Monitoraggio emocromo e LFT",
        defaultOn: true,
        text: "Emocromo e transaminasi al basale, a 1 mese, 3 mesi, poi ogni 6 mesi.",
      },
      {
        key: "addFertility",
        label: "Oligospermia reversibile (informare pazienti maschi)",
        defaultOn: false,
        text: "Informare il paziente di sesso maschile della possibile oligospermia reversibile durante il trattamento; la fertilità si ripristina alla sospensione.",
      },
      {
        key: "addPregnancy",
        label: "Sicuro in gravidanza (associare folati)",
        defaultOn: false,
        text: "Sulfasalazina è compatibile con la gravidanza; associare acido folico 5 mg/die durante il trattamento e in pre-concepimento.",
      },
    ],
  },

  {
    id: "aza",
    detect: n => n.includes("azatioprina") || n.includes("azathioprin") || n.includes("imurel") || n === "aza",
    displayName: "Azatioprina",
    flags: [
      {
        key: "addTPMT",
        label: "Dosaggio attività TPMT prima dell'avvio",
        defaultOn: true,
        text: "Valutare attività TPMT prima dell'avvio: metabolizzatori lenti (TPMT bassa/assente) richiedono dosi nettamente ridotte per evitare mielotossicità grave.",
      },
      {
        key: "addMonitoring",
        label: "Monitoraggio emocromo (settimanale × 1 mese, poi mensile)",
        defaultOn: true,
        text: "Emocromo settimanale per il primo mese, poi mensile per 3 mesi, poi ogni 3 mesi.",
      },
      {
        key: "addAllopurinol",
        label: "Interazione con allopurinolo (rischio tossicità midollare)",
        defaultOn: false,
        text: "Evitare allopurinolo: aumenta la tossicità di AZA fino a 4 volte per inibizione della xantina-ossidasi. Se necessario usarli in combinazione, ridurre la dose di AZA al 25% e intensificare il monitoraggio.",
      },
      {
        key: "addPregnancy",
        label: "Relativa sicurezza in gravidanza",
        defaultOn: false,
        text: "Azatioprina può essere continuata in gravidanza quando i benefici superano i rischi (dati rassicuranti in IBD e trapianto); evitare se possibile nel 1° trimestre.",
      },
    ],
  },

  {
    id: "mmf",
    detect: n => n.includes("micofenolato") || n.includes("mycophenolat") || n.includes("cellcept") || n.includes("myfortic") || n === "mmf",
    displayName: "Micofenolato Mofetile",
    flags: [
      {
        key: "addTitration",
        label: "Titolazione graduale (500 mg/die → dose terapeutica)",
        defaultOn: true,
        text: "Iniziare con 500 mg/die e aumentare progressivamente ogni 2-4 settimane fino alla dose terapeutica (di solito 2-3 g/die per nefrite lupica, 1-2 g/die per altre indicazioni).",
      },
      {
        key: "addMonitoring",
        label: "Monitoraggio emocromo e creatinina",
        defaultOn: true,
        text: "Emocromo mensile per 3 mesi, poi ogni 3 mesi; creatinina a 1 e 3 mesi.",
      },
      {
        key: "addPregnancy",
        label: "Farmaco teratogeno — contraccezione obbligatoria",
        defaultOn: true,
        text: T.pregnancy_teratogen + " Sospendere almeno 6 settimane prima di un tentativo di concepimento.",
      },
    ],
  },

  {
    id: "ciclosporina",
    detect: n => n.includes("ciclosporina") || n.includes("cyclosporin") || n.includes("sandimmun") || n.includes("neoral") || n === "cya",
    displayName: "Ciclosporina",
    flags: [
      {
        key: "addMonitoring",
        label: "Monitoraggio PA, creatinina e ciclosporinemia",
        defaultOn: true,
        text: "Monitoraggio pressione arteriosa, creatinina e ciclosporinemia ogni 2-4 settimane nelle prime fasi, poi ogni 2-3 mesi a regime stabile.",
      },
      {
        key: "addRenal",
        label: "Riduzione dose se creatinina aumenta >30% dal basale",
        defaultOn: true,
        text: "Ridurre la dose del 25-50% se la creatinina aumenta >30% rispetto al basale in due misurazioni consecutive; sospendere se persiste.",
      },
      {
        key: "addInteractions",
        label: "Attenzione a interazioni farmacologiche (CYP3A4/P-gp)",
        defaultOn: true,
        text: "Numerose interazioni farmacologiche per metabolismo CYP3A4/P-gp: verificare ogni nuovo farmaco con ciclosporinemia ravvicinata. Evitare FANS (nefrotossicità sinergica).",
      },
      {
        key: "addPregnancy",
        label: "Gravidanza: relativa sicurezza (monitorare PA e funzione renale)",
        defaultOn: false,
        text: "Dati rassicuranti in gravidanza (esperienza in trapiantologia); monitorare PA, creatinina e crescita fetale.",
      },
    ],
  },

  {
    id: "ciclofosfamide",
    detect: n => n.includes("ciclofosfamide") || n.includes("cyclophosphamid") || n.includes("endoxan") || n === "ctx",
    displayName: "Ciclofosfamide",
    flags: [
      {
        key: "addHydration",
        label: "Ipeidratazione e mesna (profilassi cistite emorragica)",
        defaultOn: true,
        text: "Idratazione abbondante (almeno 2 L/die) durante il trattamento e nelle 24 ore successive. Associare mesna in caso di schemi ad alta dose o e.v. per prevenzione cistite emorragica.",
      },
      {
        key: "addMonitoring",
        label: "Monitoraggio emocromo, LFT, esame urine",
        defaultOn: true,
        text: "Emocromo completo prima di ogni ciclo, transaminasi e creatinina ogni 1-2 mesi, esame urine per ematuria.",
      },
      {
        key: "addFertility",
        label: "Counselling fertilità (preservazione gameti)",
        defaultOn: true,
        text: "Discutere con il paziente il rischio di insufficienza ovarica/gonadica; valutare preservazione della fertilità (crioconservazione ovociti/spermatozoi) prima dell'avvio.",
      },
      {
        key: "addPregnancy",
        label: "Teratogeno — contraccezione obbligatoria",
        defaultOn: true,
        text: "Farmaco fortemente teratogeno e gonado-tossico; contraccezione affidabile obbligatoria durante il trattamento e per almeno 6 mesi dopo la sospensione.",
      },
      {
        key: "addMalignancy",
        label: "Rischio neoplastico a lungo termine",
        defaultOn: false,
        text: "Rischio aumentato di neoplasie uroteliali (specie con dosi cumulative elevate) e linfomi: informare il paziente e programmare follow-up a lungo termine.",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  tsDMARDs — JAK-inibitori
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "tofacitinib",
    detect: n => n.includes("tofacitinib") || n.includes("xeljanz"),
    displayName: "Tofacitinib",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, lipidi)", defaultOn: true,  text: T.screening_jakis },
      { key: "addMonitoring", label: "Monitoraggio emocromo e lipidi", defaultOn: true,  text: T.monitoring_jakis },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMACE",       label: "Rischio MACE (pazienti CV ad alto rischio)", defaultOn: true,  text: T.mace_jaki },
      { key: "addVTE",        label: "Rischio TEV (preferire 5 mg × 2/die, non 10 mg)", defaultOn: true,  text: T.vte_tofacitinib },
      { key: "addMalignancy", label: "Screening malignità pre-avvio", defaultOn: false, text: T.malignancy_jaki },
      { key: "addPregnancy",  label: "Teratogeno — contraccezione obbligatoria", defaultOn: true,  text: "Evitare in gravidanza; sospendere almeno 4 settimane prima del tentativo di concepimento." },
    ],
  },

  {
    id: "baricitinib",
    detect: n => n.includes("baricitinib") || n.includes("olumiant"),
    displayName: "Baricitinib",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, lipidi)", defaultOn: true,  text: T.screening_jakis },
      { key: "addMonitoring", label: "Monitoraggio emocromo e lipidi", defaultOn: true,  text: T.monitoring_jakis },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMACE",       label: "Rischio MACE (pazienti CV ad alto rischio)", defaultOn: true,  text: T.mace_jaki },
      { key: "addMalignancy", label: "Screening malignità pre-avvio", defaultOn: false, text: T.malignancy_jaki },
      { key: "addPregnancy",  label: "Evitare in gravidanza", defaultOn: true,  text: "Evitare in gravidanza; sospendere almeno 4 settimane prima del tentativo di concepimento." },
      { key: "addRenal",      label: "Riduzione dose in IRC (2 mg → 1 mg/die se eGFR 30-60)", defaultOn: false, text: "In IRC moderata (eGFR 30-60 ml/min): ridurre la dose a 1 mg/die. Evitare se eGFR <30 ml/min." },
    ],
  },

  {
    id: "upadacitinib",
    detect: n => n.includes("upadacitinib") || n.includes("rinvoq"),
    displayName: "Upadacitinib",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, lipidi)", defaultOn: true,  text: T.screening_jakis },
      { key: "addMonitoring", label: "Monitoraggio emocromo e lipidi", defaultOn: true,  text: T.monitoring_jakis },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMACE",       label: "Rischio MACE (pazienti CV ad alto rischio)", defaultOn: true,  text: T.mace_jaki },
      { key: "addMalignancy", label: "Screening malignità pre-avvio", defaultOn: false, text: T.malignancy_jaki },
      { key: "addPregnancy",  label: "Evitare in gravidanza", defaultOn: true,  text: "Evitare in gravidanza; sospendere almeno 4 settimane prima del tentativo di concepimento." },
    ],
  },

  {
    id: "filgotinib",
    detect: n => n.includes("filgotinib") || n.includes("jyseleca"),
    displayName: "Filgotinib",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, lipidi)", defaultOn: true,  text: T.screening_jakis },
      { key: "addMonitoring", label: "Monitoraggio emocromo e lipidi", defaultOn: true,  text: T.monitoring_jakis },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMACE",       label: "Rischio MACE (pazienti CV ad alto rischio)", defaultOn: true,  text: T.mace_jaki },
      { key: "addPregnancy",  label: "Evitare in gravidanza", defaultOn: true,  text: "Evitare in gravidanza; sospendere almeno 4 settimane prima del tentativo di concepimento." },
      { key: "addFertility",  label: "Oligospermia reversibile (informare pazienti maschi)", defaultOn: false, text: "Possibile riduzione dei parametri seminali durante il trattamento; la fertilità si ripristina alla sospensione." },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  bDMARDs — anti-TNF
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "adalimumab",
    detect: n => n.includes("adalimumab") || n.includes("humira") || n.includes("hyrimoz") || n.includes("amgevita") || n.includes("imraldi") || n.includes("cyltezo") || n.includes("idacio"),
    displayName: "Adalimumab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, LFT)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addHBV",        label: "Profilassi/monitoraggio HBV", defaultOn: false, text: T.hbv_reactivation },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addPregnancy",  label: "Gravidanza: sicuro fino al 2° trimestre", defaultOn: false, text: T.pregnancy_antitнf },
    ],
  },

  {
    id: "etanercept",
    detect: n => n.includes("etanercept") || n.includes("enbrel") || n.includes("benepali") || n.includes("erelzi"),
    displayName: "Etanercept",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, LFT)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addPregnancy",  label: "Gravidanza: passaggio placentare minimo", defaultOn: false, text: T.pregnancy_etanercept },
    ],
  },

  {
    id: "infliximab",
    detect: n => n.includes("infliximab") || n.includes("remicade") || n.includes("remsima") || n.includes("inflectra") || n.includes("zessly") || n.includes("flixabi"),
    displayName: "Infliximab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, LFT)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addHBV",        label: "Profilassi/monitoraggio HBV", defaultOn: false, text: T.hbv_reactivation },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addPremedic",   label: "Pre-medicazione per infusione", defaultOn: true,  text: "Pre-medicazione raccomandata (paracetamolo ± antistaminico ± corticosteroide) 30-60 minuti prima dell'infusione per ridurre le reazioni acute." },
      { key: "addPregnancy",  label: "Gravidanza: sicuro fino al 2° trimestre", defaultOn: false, text: T.pregnancy_antitнf },
    ],
  },

  {
    id: "golimumab",
    detect: n => n.includes("golimumab") || n.includes("simponi"),
    displayName: "Golimumab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, LFT)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addPregnancy",  label: "Gravidanza: sicuro fino al 2° trimestre", defaultOn: false, text: T.pregnancy_antitнf },
    ],
  },

  {
    id: "certolizumab",
    detect: n => n.includes("certolizumab") || n.includes("cimzia"),
    displayName: "Certolizumab pegol",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, LFT)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addPregnancy",  label: "Gravidanza: non attraversa la placenta in modo significativo", defaultOn: false, text: T.pregnancy_certolizumab },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  bDMARDs — anti-IL-6
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "tocilizumab",
    detect: n => n.includes("tocilizumab") || n.includes("actemra") || n.includes("roactemra"),
    displayName: "Tocilizumab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, lipidi, LFT)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo, lipidi, LFT", defaultOn: true,  text: "Monitoraggio emocromo, transaminasi e lipidi a 4-8 settimane dall'avvio, poi ogni 3 mesi." },
      { key: "addNeutropenia",label: "Sospensione per neutropenia/trombocitopenia", defaultOn: true,  text: T.il6_neutropenia },
      { key: "addLipids",     label: "Incremento lipidico: valutare statina", defaultOn: true,  text: T.il6_lipids },
      { key: "addInfection",  label: "Mascheramento segni infezione (PCR soppressa)", defaultOn: true,  text: "TCZ sopprime la PCR: la febbre rimane un marker di infezione attiva; avvisare il paziente di riferire prontamente febbre, malessere intenso o segni locali di infezione." },
      { key: "addPregnancy",  label: "Gravidanza: dati limitati", defaultOn: false, text: T.pregnancy_other },
    ],
  },

  {
    id: "sarilumab",
    detect: n => n.includes("sarilumab") || n.includes("kevzara"),
    displayName: "Sarilumab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, lipidi, LFT)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo, lipidi, LFT", defaultOn: true,  text: "Monitoraggio emocromo, transaminasi e lipidi a 4-8 settimane dall'avvio, poi ogni 3 mesi." },
      { key: "addNeutropenia",label: "Sospensione per neutropenia/trombocitopenia", defaultOn: true,  text: T.il6_neutropenia },
      { key: "addLipids",     label: "Incremento lipidico: valutare statina", defaultOn: true,  text: T.il6_lipids },
      { key: "addPregnancy",  label: "Gravidanza: dati limitati", defaultOn: false, text: T.pregnancy_other },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  bDMARDs — anti-IL-17
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "secukinumab",
    detect: n => n.includes("secukinumab") || n.includes("cosentyx"),
    displayName: "Secukinumab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addIBD",        label: "Cautela IBD (rischio esacerbazione)", defaultOn: false, text: T.il17_ibd },
      { key: "addPregnancy",  label: "Gravidanza: dati limitati", defaultOn: false, text: T.pregnancy_other },
    ],
  },

  {
    id: "ixekizumab",
    detect: n => n.includes("ixekizumab") || n.includes("taltz"),
    displayName: "Ixekizumab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addIBD",        label: "Cautela IBD (rischio esacerbazione)", defaultOn: false, text: T.il17_ibd },
      { key: "addPregnancy",  label: "Gravidanza: dati limitati", defaultOn: false, text: T.pregnancy_other },
    ],
  },

  {
    id: "bimekizumab",
    detect: n => n.includes("bimekizumab") || n.includes("bimzelx"),
    displayName: "Bimekizumab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addIBD",        label: "Cautela IBD (rischio esacerbazione per inibizione IL-17F)", defaultOn: false, text: "Cautela in pazienti con IBD preesistente o pregressa (inibisce sia IL-17A che IL-17F)." },
      { key: "addCandidiasis",label: "Rischio aumentato candidiasi orale/genitale", defaultOn: true,  text: "Maggiore incidenza di candidiasi orale e genitale rispetto ad altri anti-IL-17; avvisare il paziente." },
      { key: "addPregnancy",  label: "Gravidanza: dati molto limitati", defaultOn: false, text: T.pregnancy_other },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  bDMARDs — anti-IL-12/23 e anti-IL-23
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "ustekinumab",
    detect: n => n.includes("ustekinumab") || n.includes("stelara"),
    displayName: "Ustekinumab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addPregnancy",  label: "Gravidanza: dati limitati", defaultOn: false, text: T.pregnancy_other },
    ],
  },

  {
    id: "guselkumab",
    detect: n => n.includes("guselkumab") || n.includes("tremfya"),
    displayName: "Guselkumab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addPregnancy",  label: "Gravidanza: dati limitati", defaultOn: false, text: T.pregnancy_other },
    ],
  },

  {
    id: "risankizumab",
    detect: n => n.includes("risankizumab") || n.includes("skyrizi"),
    displayName: "Risankizumab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addPregnancy",  label: "Gravidanza: dati limitati", defaultOn: false, text: T.pregnancy_other },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  bDMARDs — anti-CD20, CTLA4-Ig, anti-IL-1, anti-BLyS
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "rituximab",
    detect: n => n.includes("rituximab") || n.includes("mabthera") || n.includes("truxima") || n.includes("rixathon"),
    displayName: "Rituximab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, Ig)", defaultOn: true,  text: T.screening_biologics + " Dosare le immunoglobuline basali (IgG, IgA, IgM)." },
      { key: "addHBV",        label: "Profilassi HBV obbligatoria (rischio riattivazione alto)", defaultOn: true,  text: "Rischio elevato di riattivazione HBV: in portatori HBsAg+ avviare profilassi antivirale (entecavir o tenofovir) prima del rituximab e per almeno 12 mesi dopo l'ultima somministrazione." },
      { key: "addPremedic",   label: "Pre-medicazione infusione", defaultOn: true,  text: T.rituximab_preinfusion },
      { key: "addMonitoring", label: "Monitoraggio emocromo, LFT e immunoglobuline", defaultOn: true,  text: "Emocromo e transaminasi dopo ogni ciclo; immunoglobuline ogni 6 mesi." },
      { key: "addIg",         label: "Ipogammaglobulinemia — valutare sostituzione Ig", defaultOn: false, text: T.rituximab_ig },
      { key: "addPregnancy",  label: "Evitare in gravidanza (deplezione cellule B fetali)", defaultOn: true,  text: "Evitare in gravidanza (deplezione CD20+ fetali); sospendere almeno 12 mesi prima del tentativo di concepimento." },
    ],
  },

  {
    id: "abatacept",
    detect: n => n.includes("abatacept") || n.includes("orencia"),
    displayName: "Abatacept",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo, LFT)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addCOPD",       label: "Cautela in BPCO (rischio infezioni respiratorie)", defaultOn: false, text: T.abatacept_copd },
      { key: "addPregnancy",  label: "Gravidanza: dati limitati", defaultOn: false, text: T.pregnancy_other },
    ],
  },

  {
    id: "anakinra",
    detect: n => n.includes("anakinra") || n.includes("kineret"),
    displayName: "Anakinra",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo)", defaultOn: true,  text: T.screening_biologics },
      { key: "addMonitoring", label: "Monitoraggio emocromo (mensile × 3 mesi)", defaultOn: true,  text: "Emocromo mensile per i primi 3 mesi di trattamento." },
      { key: "addRenal",      label: "Riduzione frequenza in IRC grave", defaultOn: false, text: "In IRC grave (eGFR <30 ml/min): somministrazione a giorni alterni." },
      { key: "addPregnancy",  label: "Gravidanza: dati limitati", defaultOn: false, text: T.pregnancy_other },
    ],
  },

  {
    id: "canakinumab",
    detect: n => n.includes("canakinumab") || n.includes("ilaris"),
    displayName: "Canakinumab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo)", defaultOn: true,  text: T.screening_biologics },
      { key: "addTB",         label: "Gestione TB latente positiva", defaultOn: false, text: T.tb_positive },
      { key: "addMonitoring", label: "Monitoraggio emocromo e LFT", defaultOn: true,  text: T.monitoring_biologics },
      { key: "addPregnancy",  label: "Gravidanza: dati limitati", defaultOn: false, text: T.pregnancy_other },
    ],
  },

  {
    id: "belimumab",
    detect: n => n.includes("belimumab") || n.includes("benlysta"),
    displayName: "Belimumab",
    flags: [
      { key: "addScreening",  label: "Screening pre-avvio (TB, HBV, emocromo)", defaultOn: true,  text: T.screening_biologics },
      { key: "addMonitoring", label: "Monitoraggio emocromo, LFT, proteinuria", defaultOn: true,  text: "Monitoraggio emocromo, transaminasi e proteinuria/creatinina ogni 3 mesi." },
      { key: "addPsychiatric",label: "Monitoraggio depressione / tendenze suicidarie", defaultOn: true,  text: "Avvisare il paziente e i familiari di riferire prontamente sintomi depressivi nuovi o aggravamento dell'umore; casi di depressione e ideazione suicidaria segnalati post-marketing." },
      { key: "addPremedic",   label: "Pre-medicazione infusione (forma e.v.)", defaultOn: false, text: "Per la forma e.v.: premedicare con antistaminico e/o corticosteroide per ridurre le reazioni infusionali." },
      { key: "addPregnancy",  label: "Evitare in gravidanza", defaultOn: true,  text: "Evitare in gravidanza; sospendere almeno 4 mesi prima del tentativo di concepimento." },
    ],
  },

];

// ── Public API ────────────────────────────────────────────────────────────────

export function getDrugTemplate(name) {
  const n = (name || "").toLowerCase().trim();
  if (!n) return null;
  return DRUG_TEMPLATES.find(t => t.detect(n)) || null;
}

export function hasPrescriptionTemplate(name) {
  return !!getDrugTemplate(name);
}

/**
 * Build the full prescription expansion string.
 * @param {{ drugName, dose, frequency, route, weekday, exFlags }} params
 */
export function buildPrescriptionExpansion({ drugName, dose, frequency, route, weekday, exFlags }) {
  const template = getDrugTemplate(drugName);
  if (!template) return null;

  const baseParams = { displayName: template.displayName, dose, frequency, route, weekday };
  const base = template.buildBase
    ? template.buildBase(baseParams)
    : buildBaseSentence(template.displayName, { dose, frequency, route });

  const parts = [base];

  for (const flag of template.flags) {
    if (!exFlags?.[flag.key]) continue;
    const text = typeof flag.text === "function"
      ? flag.text({ drugName, dose, frequency, route, weekday, ...(exFlags || {}) })
      : flag.text;
    if (text) parts.push(text);
  }

  return parts.join(" ");
}

// ── Renal impairment check ────────────────────────────────────────────────────

const IRC_KW = ["irc", "ckd", "insufficienza renale", "nefropatia", "dialisi", "emodialisi"];

export function patientHasRenalImpairment(patient) {
  const list = [
    ...(Array.isArray(patient?.comorbidita)   ? patient.comorbidita   : []),
    ...(Array.isArray(patient?.comorbidities) ? patient.comorbidities : []),
  ];
  return list.some(c => {
    const label = (typeof c === "string" ? c : c.item || c.label || c.nome || "").toLowerCase();
    return IRC_KW.some(kw => label.includes(kw));
  });
}

// ── Backward-compat exports ───────────────────────────────────────────────────

export function isMTXDrug(name) {
  const t = getDrugTemplate(name);
  return t?.id === "mtx";
}

export function buildMTXExpansion(params) {
  return buildPrescriptionExpansion({
    drugName: params.drugName || "Metotrexato",
    dose:      params.dose,
    frequency: params.frequency,
    route:     params.route,
    weekday:   params.weekday,
    exFlags:   {
      addFolate:      params.addFolate,
      addMonitoring:  params.addMonitoring,
      addPregnancy:   params.addPregnancy,
      addILD:         params.addILD,
      addRenal:       params.addRenal,
    },
  });
}
