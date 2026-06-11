export const DRUG_PRESETS = [
  {
    group: "csDMARDs",
    drugs: [
      {
        label: "Metotrexato 10 mg/sett — os",
        matchName: ["metotrexato", "methotrexate"],
        matchRoute: ["orale", "os", "per os"],
        matchDoseMin: 1, matchDoseMax: 12,
        text: "Si avvia Metotrexato 10 mg/settimana per via orale (1 volta/settimana, es il lunedì). Supplementazione con Acido Folico 5 mg il giorno successivo (es il martedì). Monitoraggio mensile per i primi 3 mesi, poi ogni 3-4 mesi: emocromo con formula, transaminasi, creatinina.",
      },
      {
        label: "Metotrexato 15 mg/sett — sc",
        matchName: ["metotrexato", "methotrexate"],
        matchRoute: ["sc", "s.c.", "sottocutanea", "sottocute"],
        matchDoseMin: 13, matchDoseMax: 17,
        text: "Si avvia Metotrexato 15 mg 1 fl sc ogni settimana (es il lunedì) seguito dopo 24 ore da Acido Folinico (Folina) 5 mg per os (es il martedì). Monitoraggio mensile per i primi 3 mesi, poi ogni 3-4 mesi: emocromo con formula, transaminasi, creatinina.",
      },
      {
        label: "Metotrexato 20 mg/sett — sc",
        matchName: ["metotrexato", "methotrexate"],
        matchRoute: ["sc", "s.c.", "sottocutanea", "sottocute"],
        matchDoseMin: 18, matchDoseMax: 99,
        text: "Si avvia Metotrexato 20 mg 1 fl sc ogni settimana (es il lunedì) seguito dopo 24 ore da Acido Folinico (Folina) 5 mg per os (es il martedì). Monitoraggio mensile per i primi 3 mesi, poi ogni 3-4 mesi: emocromo con formula, transaminasi, creatinina.",
      },
      {
        label: "Idrossiclorochina 200 mg/die",
        matchName: "idrossiclorochina",
        text: "Si avvia Idrossiclorochina (Plaquenil) 200 mg/die per via orale. Visita oculistica basale entro 1 anno dall'inizio, poi annuale (screening retinopatie). Follow-up clinico a 3 mesi.",
      },
      {
        label: "Leflunomide 20 mg/die",
        matchName: "leflunomide",
        text: "Si avvia Leflunomide 20 mg/die per via orale (oppure 10 mg/die in caso di intolleranza). Monitoraggio mensile per i primi 6 mesi, poi ogni 3 mesi: emocromo, transaminasi, creatinina, pressione arteriosa.",
      },
      {
        label: "Sulfasalazina — schema graduale",
        matchName: "sulfasalazina",
        text: "Si avvia Sulfasalazina con schema posologico graduale: 500 mg/die × 1 settimana → 1 g/die × 1 settimana → 1,5 g/die × 1 settimana → 2 g/die in mantenimento. Monitoraggio mensile per i primi 3 mesi: emocromo con formula, transaminasi.",
      },
    ],
  },
  {
    group: "Biologici / JAK inibitori",
    drugs: [
      {
        label: "Anti-TNF (generico)",
        matchName: null,
        matchCategory: ["biologic", "biological", "biologico", "anti-tnf"],
        text: "Si avvia terapia biologica con ____ (anti-TNF). Screening pre-biologico effettuato: Quantiferon/Mantoux negativo, HBV/HCV/HIV negativi. Dose: ____. Rivalutazione clinica e laboratoristica a 3 mesi.",
      },
      {
        label: "Etanercept",
        matchName: "etanercept",
        text: "Si avvia Etanercept 50 mg sc 1 fl/settimana. Screening pre-biologico effettuato (Quantiferon negativo, HBV/HCV/HIV negativi). Rivalutazione clinica e laboratoristica a 3 mesi.",
      },
      {
        label: "Adalimumab",
        matchName: "adalimumab",
        text: "Si avvia Adalimumab 40 mg sc ogni 2 settimane. Screening pre-biologico effettuato (Quantiferon negativo, HBV/HCV/HIV negativi). Rivalutazione clinica e laboratoristica a 3 mesi.",
      },
      {
        label: "Tocilizumab (sc)",
        matchName: "tocilizumab",
        text: "Si avvia Tocilizumab 162 mg sc ogni settimana (oppure ogni 2 settimane). Screening pre-biologico effettuato. Monitoraggio: emocromo, transaminasi, lipidi a 4-8 settimane, poi ogni 3 mesi. Rivalutazione a 3 mesi.",
      },
      {
        label: "Abatacept (sc)",
        matchName: "abatacept",
        text: "Si avvia Abatacept 125 mg sc 1 fl/settimana. Screening pre-biologico effettuato. Rivalutazione a 3 mesi con score di malattia e laboratorio.",
      },
      {
        label: "Rituximab (schema)",
        matchName: "rituximab",
        text: "Si programma ciclo con Rituximab 1000 mg ev gg 1 e gg 15 (con premedicazione: metilprednisolone 100 mg + antistaminico + paracetamolo). Rivalutazione a 6 mesi. Monitoraggio: Ig, emocromo.",
      },
      {
        label: "Baricitinib",
        matchName: "baricitinib",
        text: "Si avvia Baricitinib 4 mg/die per os. Screening pre-biologico effettuato (TBC, HBV, HCV, HIV). Monitoraggio: emocromo, transaminasi, colesterolo a 4-8 settimane, poi ogni 3 mesi. Rivalutazione clinica a 3 mesi.",
      },
      {
        label: "Tofacitinib",
        matchName: "tofacitinib",
        text: "Si avvia Tofacitinib 5 mg × 2/die per os. Screening pre-biologico effettuato (TBC, HBV, HCV, HIV). Monitoraggio: emocromo, transaminasi, colesterolo a 4-8 settimane, poi ogni 3 mesi. Rivalutazione clinica a 3 mesi.",
      },
      {
        label: "Upadacitinib",
        matchName: "upadacitinib",
        text: "Si avvia Upadacitinib 15 mg/die per os (30 mg/die in PsA/SpA assiale se necessario). Screening pre-biologico effettuato (TBC, HBV, HCV, HIV). Monitoraggio: emocromo, transaminasi, colesterolo a 4-8 settimane, poi ogni 3 mesi. Rivalutazione clinica a 3 mesi.",
      },
      {
        label: "Secukinumab",
        matchName: "secukinumab",
        text: "Si avvia Secukinumab 300 mg sc (in AS/SpA: 150 mg) — schema di induzione: sett 0, 1, 2, 3, 4, poi ogni 4 settimane in mantenimento. Screening pre-biologico effettuato. Rivalutazione clinica a 3 mesi.",
      },
      {
        label: "Ixekizumab",
        matchName: "ixekizumab",
        text: "Si avvia Ixekizumab 160 mg sc alla settimana 0, poi 80 mg ogni 4 settimane. Screening pre-biologico effettuato. Rivalutazione clinica a 3 mesi.",
      },
    ],
  },
  {
    group: "Corticosteroidi",
    drugs: [
      {
        label: "Deltacortene — ciclo breve",
        matchName: "deltacortene",
        text: "Si prescrive ciclo breve di Deltacortene 25 mg: 1/2 cp per 5 giorni, poi 1/4 cp per 7 giorni, poi 1/4 cp a giorni alterni per 10 giorni, poi STOP.",
      },
      {
        label: "Prednisone — mantenimento",
        matchName: "prednisone",
        text: "Si imposta Prednisone ____ mg/die come terapia di mantenimento. Supplementazione con Calcio 1000 mg + Vitamina D 800 UI/die. Monitoraggio: glicemia, pressione arteriosa. Densitometria ossea se terapia >3 mesi.",
      },
      {
        label: "Metilprednisolone — bolo im",
        matchName: "metilprednisolone",
        text: "Si esegue bolo intramuscolare di Metilprednisolone 80 mg. Rivalutazione clinica a 2-4 settimane.",
      },
    ],
  },
];

export function findPresetText(drugName, dose, route) {
  if (!drugName) return null;
  const allDrugs = DRUG_PRESETS.flatMap((g) => g.drugs);
  const lowerName = drugName.toLowerCase().trim();
  const firstName = lowerName.split(" ")[0];
  const lowerRoute = (route || "").toLowerCase().trim();
  const doseNum = parseFloat((dose || "").replace(",", ".")) || null;

  const nameMatches = (d) => {
    if (!d.matchName) return false;
    const names = Array.isArray(d.matchName) ? d.matchName : [d.matchName];
    return names.some((n) => lowerName.includes(n) || n.includes(firstName));
  };

  const candidates = allDrugs.filter(nameMatches);

  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0].text;

  for (const c of candidates) {
    const routeMatch = !c.matchRoute || c.matchRoute.some((r) => lowerRoute.includes(r));
    const doseMatch =
      doseNum == null ||
      (c.matchDoseMin == null && c.matchDoseMax == null) ||
      (doseNum >= (c.matchDoseMin ?? 0) && doseNum <= (c.matchDoseMax ?? Infinity));
    if (routeMatch && doseMatch) return c.text;
  }

  return candidates[0].text;
}
