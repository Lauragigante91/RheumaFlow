// ==========================================================================
// PRO instruments — definitions used both by the patient submission form and
// by the doctor's PRO management dialog.
// Each instrument has:
//   - id: stable key (matches backend allow-list)
//   - label: short label
//   - title: longer title shown to the patient
//   - intro: instruction shown above the questions
//   - items: list of question definitions
//        type "nrs"   → 0-10 numeric rating scale (slider/buttons)
//        type "vas"   → 0-100 visual analog scale (slider)
//        type "yesno" → boolean
//        type "ord4"  → 0-3 (HAQ-like)
//   - score(responses) → returns { score, interpretation, inputs }
// ==========================================================================
import { calcHAQ, HAQ_CATEGORIES, calcBASDAI, calcBASFI, interpretBASDAI } from "./clinimetrics";

// RAID: weighted sum (Gossec et al, 2009): pain 0.21, function 0.16, fatigue 0.15,
// sleep 0.12, physical 0.12, emotional 0.12, coping 0.12. Range 0-10.
function calcRAID(r) {
  const w = { pain: 0.21, function: 0.16, fatigue: 0.15, sleep: 0.12, physical: 0.12, emotional: 0.12, coping: 0.12 };
  let s = 0;
  for (const k of Object.keys(w)) s += (Number(r[k]) || 0) * w[k];
  return Math.round(s * 10) / 10;
}

// PSAID-12: weighted average — Gossec et al 2014 (here equal-weight simplified).
function calcPSAID(r) {
  const keys = ["pain", "fatigue", "skin", "work", "function", "discomfort", "sleep", "coping", "anxiety", "embarrassment", "social", "depression"];
  const sum = keys.reduce((acc, k) => acc + (Number(r[k]) || 0), 0);
  return Math.round((sum / keys.length) * 10) / 10;
}

export const PRO_INSTRUMENTS = {
  haq: {
    id: "haq",
    label: "HAQ",
    title: "Health Assessment Questionnaire (HAQ)",
    intro: "Indica per ogni attività se in questa ULTIMA SETTIMANA sei stato in grado di farla:",
    options: [
      { value: 0, label: "Senza difficoltà" },
      { value: 1, label: "Con qualche difficoltà" },
      { value: 2, label: "Con molta difficoltà" },
      { value: 3, label: "Non ne sono in grado" },
    ],
    items: HAQ_CATEGORIES.flatMap((cat) =>
      cat.items.map((it) => ({
        key: it.key,
        type: "ord4",
        category: cat.label,
        question: it.label,
      }))
    ),
    score: (responses) => {
      const score = calcHAQ(responses);
      let interpretation = "Disabilità minima";
      if (score >= 1 && score < 2) interpretation = "Disabilità lieve";
      else if (score >= 2 && score < 2.5) interpretation = "Disabilità moderata";
      else if (score >= 2.5) interpretation = "Disabilità grave";
      return { score, interpretation, inputs: responses };
    },
  },

  basdai: {
    id: "basdai",
    label: "BASDAI",
    title: "Bath Ankylosing Spondylitis Disease Activity Index",
    intro:
      "Pensa a come ti sei sentito nell'ULTIMA SETTIMANA. Per ogni domanda sposta il cursore tra 0 (nessun problema) e 10 (massimo problema):",
    items: [
      { key: "fatigue", type: "nrs", question: "Quanto è stata grave la tua stanchezza generale?" },
      { key: "spinal_pain", type: "nrs", question: "Quanto è stato grave il dolore al collo, alla schiena o alle anche?" },
      { key: "joint_pain", type: "nrs", question: "Quanto è stato grave il dolore o la tumefazione alle altre articolazioni?" },
      { key: "tenderness", type: "nrs", question: "Quanto fastidio ti danno le aree del corpo dolenti al tatto o alla pressione?" },
      { key: "morning_stiff_severity", type: "nrs", question: "Quanto è stata grave la rigidità mattutina?" },
      { key: "morning_stiff_duration", type: "nrs", question: "Quanto è durata la rigidità mattutina al risveglio? (0=nessuna · 5=≥1 ora · 10=≥2 ore)" },
    ],
    score: (responses) => {
      const score = calcBASDAI(responses);
      const interpretation = interpretBASDAI(score);
      return { score, interpretation, inputs: responses };
    },
  },

  basfi: {
    id: "basfi",
    label: "BASFI",
    title: "Bath Ankylosing Spondylitis Functional Index",
    intro:
      "Indica per ognuna di queste attività quanto ne sei stato capace nell'ULTIMA SETTIMANA (0 = facile, 10 = impossibile):",
    items: [
      { key: "socks", type: "nrs", question: "Mettere le calze o le calze di sostegno senza aiuto" },
      { key: "pen", type: "nrs", question: "Raccogliere una penna dal pavimento piegandoti in avanti, senza aiuto" },
      { key: "shelf", type: "nrs", question: "Raggiungere uno scaffale alto, senza aiuto" },
      { key: "chair", type: "nrs", question: "Alzarti da una sedia senza braccioli senza usare le mani" },
      { key: "floor", type: "nrs", question: "Alzarti dal pavimento dalla posizione supina, senza aiuto" },
      { key: "stand", type: "nrs", question: "Stare in piedi senza appoggio per 10 minuti" },
      { key: "stairs", type: "nrs", question: "Salire 12-15 scalini senza usare il corrimano" },
      { key: "look_back", type: "nrs", question: "Guardare alle tue spalle senza ruotare il corpo" },
      { key: "demanding", type: "nrs", question: "Svolgere attività che richiedono sforzo (es. esercizio fisico, giardinaggio, sport)" },
      { key: "fullday", type: "nrs", question: "Affrontare una giornata intera di attività (lavorative o domestiche)" },
    ],
    score: (responses) => {
      const score = calcBASFI(responses);
      let interpretation = "Funzione preservata";
      if (score >= 4 && score < 6) interpretation = "Limitazione moderata";
      else if (score >= 6) interpretation = "Limitazione grave";
      return { score, interpretation, inputs: responses };
    },
  },

  raid: {
    id: "raid",
    label: "RAID",
    title: "Rheumatoid Arthritis Impact of Disease",
    intro:
      "Pensa all'ULTIMA SETTIMANA. Sposta il cursore tra 0 (nessun impatto) e 10 (massimo impatto):",
    items: [
      { key: "pain", type: "nrs", question: "Dolore", weight: 0.21 },
      { key: "function", type: "nrs", question: "Difficoltà a svolgere le attività quotidiane (capacità funzionale)", weight: 0.16 },
      { key: "fatigue", type: "nrs", question: "Stanchezza/affaticamento", weight: 0.15 },
      { key: "sleep", type: "nrs", question: "Disturbi del sonno", weight: 0.12 },
      { key: "physical", type: "nrs", question: "Benessere fisico complessivo", weight: 0.12 },
      { key: "emotional", type: "nrs", question: "Benessere emotivo complessivo", weight: 0.12 },
      { key: "coping", type: "nrs", question: "Capacità di affrontare la malattia", weight: 0.12 },
    ],
    score: (responses) => {
      const score = calcRAID(responses);
      let interpretation = "Impatto basso";
      if (score >= 2 && score < 4) interpretation = "Impatto moderato";
      else if (score >= 4) interpretation = "Impatto alto (PASS non raggiunto)";
      return { score, interpretation, inputs: responses };
    },
  },

  psaid: {
    id: "psaid",
    label: "PSAID",
    title: "Psoriatic Arthritis Impact of Disease",
    intro:
      "Pensa all'ULTIMA SETTIMANA. Sposta il cursore tra 0 (nessun impatto) e 10 (massimo impatto):",
    items: [
      { key: "pain", type: "nrs", question: "Dolore" },
      { key: "fatigue", type: "nrs", question: "Stanchezza/affaticamento" },
      { key: "skin", type: "nrs", question: "Problemi cutanei (psoriasi)" },
      { key: "work", type: "nrs", question: "Difficoltà nel lavoro o nelle attività quotidiane" },
      { key: "function", type: "nrs", question: "Capacità funzionale" },
      { key: "discomfort", type: "nrs", question: "Disagio (es. tumefazione articolare, prurito)" },
      { key: "sleep", type: "nrs", question: "Disturbi del sonno" },
      { key: "coping", type: "nrs", question: "Capacità di affrontare la malattia" },
      { key: "anxiety", type: "nrs", question: "Ansia, paura, incertezze" },
      { key: "embarrassment", type: "nrs", question: "Imbarazzo o vergogna per l'aspetto della pelle" },
      { key: "social", type: "nrs", question: "Difficoltà nelle attività sociali" },
      { key: "depression", type: "nrs", question: "Tristezza o depressione" },
    ],
    score: (responses) => {
      const score = calcPSAID(responses);
      let interpretation = "Impatto basso";
      if (score >= 4 && score < 7) interpretation = "Impatto moderato";
      else if (score >= 7) interpretation = "Impatto alto";
      return { score, interpretation, inputs: responses };
    },
  },

  vas_pain: {
    id: "vas_pain",
    label: "VAS Dolore",
    title: "Scala del Dolore (VAS)",
    intro: "Indica il livello di dolore percepito nell'ULTIMA SETTIMANA:",
    items: [
      { key: "vas_pain", type: "vas100", question: "Dolore (0 = nessun dolore, 100 = dolore peggiore immaginabile)" },
    ],
    score: (responses) => {
      const score = Number(responses.vas_pain) || 0;
      let interpretation = "Dolore lieve";
      if (score >= 30 && score < 60) interpretation = "Dolore moderato";
      else if (score >= 60) interpretation = "Dolore grave";
      return { score, interpretation, inputs: responses };
    },
  },

  vas_pga: {
    id: "vas_pga",
    label: "VAS PGA",
    title: "Valutazione globale del paziente (PGA)",
    intro: "Considerando il tuo stato di salute attuale legato alla malattia:",
    items: [
      { key: "vas_pga", type: "vas100", question: "Come valuti la tua attività di malattia oggi? (0 = ottimo, 100 = pessimo)" },
    ],
    score: (responses) => {
      const score = Number(responses.vas_pga) || 0;
      let interpretation = "Attività bassa percepita";
      if (score >= 30 && score < 60) interpretation = "Attività moderata percepita";
      else if (score >= 60) interpretation = "Attività alta percepita";
      return { score, interpretation, inputs: responses };
    },
  },

  vas_fatigue: {
    id: "vas_fatigue",
    label: "VAS Fatigue",
    title: "Scala dell'Affaticamento (VAS)",
    intro: "Indica il tuo livello di stanchezza/affaticamento:",
    items: [
      { key: "vas_fatigue", type: "vas100", question: "Affaticamento (0 = nessuno, 100 = massimo)" },
    ],
    score: (responses) => {
      const score = Number(responses.vas_fatigue) || 0;
      let interpretation = "Affaticamento lieve";
      if (score >= 30 && score < 60) interpretation = "Affaticamento moderato";
      else if (score >= 60) interpretation = "Affaticamento grave";
      return { score, interpretation, inputs: responses };
    },
  },
};

export const PRO_INSTRUMENT_KEYS = Object.keys(PRO_INSTRUMENTS);
