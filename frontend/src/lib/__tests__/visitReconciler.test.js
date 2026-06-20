import { reconcileDrafts, ITEM_STATUS } from "../visitReconciler";
import { parseVisitText } from "../visitTextParser";

function reconcileTherapy(existingTherapies, draftTherapy) {
  const [draft] = reconcileDrafts(
    [{ therapies: [draftTherapy] }],
    { therapies: existingTherapies }
  );
  return draft.therapies[0];
}

function reconcileMany(existingData, draftTherapies) {
  const [draft] = reconcileDrafts([{ therapies: draftTherapies }], existingData);
  return draft.therapies;
}

function reconcileMultiDraft(existingData, draftsTherapies) {
  return reconcileDrafts(
    draftsTherapies.map((ts) => ({ therapies: ts })),
    existingData
  );
}

const MTX_ATTIVO = {
  id: "t-mtx",
  drug_name: "Metotrexato",
  category: "csDMARD",
  dose: "15 mg",
  frequency: "1 volta a settimana",
  route: "os",
  status: "active",
};

describe("reconcileDrafts — confronto terapia oltre la dose in mg", () => {
  it("MTX 15 mg/settimana -> 15 mg/die: NON continued (cambio frequenza)", () => {
    const out = reconcileTherapy([MTX_ATTIVO], {
      drug_name: "Metotrexato", dose: "15 mg", frequency: "die", route: "os", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out._action).toBe("regimen_change");
    expect(out._skip).toBe(false);
  });

  it("MTX 15 mg os -> 15 mg s.c.: NON continued (cambio via)", () => {
    const out = reconcileTherapy([MTX_ATTIVO], {
      drug_name: "Metotrexato", dose: "15 mg", frequency: "1 volta a settimana", route: "s.c.", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out._action).toBe("regimen_change");
    expect(out._skip).toBe(false);
  });

  it("Adalimumab ogni 14 giorni -> ogni 7 giorni: NON continued (cambio frequenza)", () => {
    const ada = {
      id: "t-ada", drug_name: "Adalimumab", category: "bDMARD",
      dose: "40 mg", frequency: "ogni 14 giorni", route: "s.c.", status: "active",
    };
    const out = reconcileTherapy([ada], {
      drug_name: "Adalimumab", dose: "40 mg", frequency: "ogni 7 giorni", route: "s.c.", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out._action).toBe("regimen_change");
    expect(out._skip).toBe(false);
  });

  it("terapia identica: continued (skip)", () => {
    const out = reconcileTherapy([MTX_ATTIVO], {
      drug_name: "Metotrexato", dose: "15 mg", frequency: "1 volta a settimana", route: "os", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONTINUITY);
    expect(out._skip).toBe(true);
  });

  it("cambio dose in mg: CONFLICT dose_change (comportamento preesistente)", () => {
    const out = reconcileTherapy([{ ...MTX_ATTIVO, dose: "10 mg" }], {
      drug_name: "Metotrexato", dose: "15 mg", frequency: "1 volta a settimana", route: "os", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out._action).toBe("dose_change");
    expect(out._skip).toBe(false);
  });

  it("cambio formulazione (2 cp -> 3 cp, mg non leggibile): CONFLICT regimen_change", () => {
    const supp = {
      id: "t-cal", drug_name: "Calcio", category: "other",
      dose: "2 cp", frequency: "die", route: "os", status: "active",
    };
    const out = reconcileTherapy([supp], {
      drug_name: "Calcio", dose: "3 cp", frequency: "die", route: "os", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out._action).toBe("regimen_change");
  });

  it("frequenza assente nello storico: continuità (confronto conservativo)", () => {
    const legacy = {
      id: "t-leg", drug_name: "Metotrexato", category: "csDMARD",
      dose: "15 mg", frequency: null, route: null, status: "active",
    };
    const out = reconcileTherapy([legacy], {
      drug_name: "Metotrexato", dose: "15 mg", frequency: "die", route: "os", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONTINUITY);
    expect(out._skip).toBe(true);
  });

  it("formattazione equivalente (15 mg vs 15mg, OS vs os): continued", () => {
    const out = reconcileTherapy([MTX_ATTIVO], {
      drug_name: "Metotrexato", dose: "15mg", frequency: "1 volta a settimana", route: "OS", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONTINUITY);
    expect(out._skip).toBe(true);
  });
});

describe("reconcileDrafts — stato attiva/sospesa", () => {
  it("attiva in DB + lettera identica attiva: NON discontinued", () => {
    const out = reconcileTherapy([MTX_ATTIVO], {
      drug_name: "Metotrexato", dose: "15 mg", frequency: "1 volta a settimana", route: "os", status: "active",
    });
    expect(out._status).not.toBe(ITEM_STATUS.UPDATE);
    expect(out._action).not.toBe("discontinue");
  });

  it("attiva in DB + lettera segnala sospensione: UPDATE discontinue", () => {
    const out = reconcileTherapy([MTX_ATTIVO], {
      drug_name: "Metotrexato", dose: "15 mg", status: "discontinued", discontinuation_reason: "intolleranza",
    });
    expect(out._status).toBe(ITEM_STATUS.UPDATE);
    expect(out._action).toBe("discontinue");
    expect(out._skip).toBe(false);
  });

  it("farmaco non presente nel profilo: NEW", () => {
    const out = reconcileTherapy([], {
      drug_name: "Idrossiclorochina", dose: "200 mg", frequency: "die", route: "os", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.NEW);
    expect(out._action).toBe("new_episode");
  });
});

describe("reconcileDrafts — roadmap punto 1: copertura dedicata", () => {
  it("1. terapia identica -> continued + skip (farmaco high-relevance registra continued)", () => {
    const out = reconcileTherapy([MTX_ATTIVO], {
      drug_name: "Metotrexato", dose: "15 mg", frequency: "1 volta a settimana", route: "os", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONTINUITY);
    expect(out._skip).toBe(true);
    expect(out._action).toBe("continued");
    expect(out._call_upsert).toBe(true);
  });

  it("2. cambio dose reale (mg) -> CONFLICT dose_change esplicito, non skip", () => {
    const out = reconcileTherapy([{ ...MTX_ATTIVO, dose: "10 mg" }], {
      drug_name: "Metotrexato", dose: "15 mg", frequency: "1 volta a settimana", route: "os", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out._action).toBe("dose_change");
    expect(out._skip).toBe(false);
    expect(out._dose_before).toBe("10 mg");
  });

  it("3. cambio frequency -> regimen_change (da rivedere, persistito)", () => {
    const out = reconcileTherapy([MTX_ATTIVO], {
      drug_name: "Metotrexato", dose: "15 mg", frequency: "die", route: "os", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out._action).toBe("regimen_change");
    expect(out._skip).toBe(false);
    expect(out._frequency_before).toBe("1 volta a settimana");
  });

  it("4. cambio route -> regimen_change (da rivedere, persistito)", () => {
    const out = reconcileTherapy([MTX_ATTIVO], {
      drug_name: "Metotrexato", dose: "15 mg", frequency: "1 volta a settimana", route: "s.c.", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out._action).toBe("regimen_change");
    expect(out._skip).toBe(false);
    expect(out._route_before).toBe("os");
  });

  it("5. cambio dose (mg) + frequency insieme -> CONFLICT non skip; dose_change ha precedenza", () => {
    const out = reconcileTherapy([{ ...MTX_ATTIVO, dose: "10 mg", frequency: "die" }], {
      drug_name: "Metotrexato", dose: "15 mg", frequency: "1 volta a settimana", route: "os", status: "active",
    });
    expect(out._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out._skip).toBe(false);
    expect(out._action).toBe("dose_change");
  });

  it("6. lettera segnala sospensione -> UPDATE discontinue", () => {
    const out = reconcileTherapy([MTX_ATTIVO], {
      drug_name: "Metotrexato", dose: "15 mg", status: "discontinued", discontinuation_reason: "intolleranza GI",
    });
    expect(out._status).toBe(ITEM_STATUS.UPDATE);
    expect(out._action).toBe("discontinue");
    expect(out._skip).toBe(false);
  });

  it("7. 'mai sospeso' (parser -> status active) non viene mai segnalato discontinue", () => {
    const out = reconcileTherapy([MTX_ATTIVO], {
      drug_name: "Metotrexato", dose: "15 mg", frequency: "1 volta a settimana", route: "os", status: "active",
    });
    expect(out._action).not.toBe("discontinue");
    expect(out._status).not.toBe(ITEM_STATUS.UPDATE);
  });

  it("8. switch farmaco A -> B: discontinue A + nuovo episodio B", () => {
    const out = reconcileMany(
      { therapies: [{ id: "t-ssz", drug_name: "Sulfasalazina", category: "csDMARD", dose: "1000 mg", frequency: "bid", route: "os", status: "active" }] },
      [
        { drug_name: "Sulfasalazina", dose: "1000 mg", status: "discontinued", discontinuation_reason: "inefficacia" },
        { drug_name: "Metotrexato", dose: "15 mg", frequency: "1 volta a settimana", route: "os", status: "active" },
      ]
    );
    const a = out.find((t) => t.drug_name === "Sulfasalazina");
    const b = out.find((t) => t.drug_name === "Metotrexato");
    expect(a._status).toBe(ITEM_STATUS.UPDATE);
    expect(a._action).toBe("discontinue");
    expect(a._skip).toBe(false);
    expect(b._status).toBe(ITEM_STATUS.NEW);
    expect(b._action).toBe("new_episode");
  });

  it("9. stesso farmaco due volte nello stesso import -> il secondo non viene risalvato", () => {
    const out = reconcileMany(
      { therapies: [] },
      [
        { drug_name: "Idrossiclorochina", dose: "200 mg", frequency: "die", route: "os", status: "active" },
        { drug_name: "Idrossiclorochina", dose: "200 mg", frequency: "die", route: "os", status: "active" },
      ]
    );
    expect(out[0]._status).toBe(ITEM_STATUS.NEW);
    expect(out[0]._skip).toBeFalsy();
    expect(out[1]._skip).toBe(true);
  });

  it("10. stesso farmaco in due lettere distinte -> salvato una volta sola", () => {
    const drafts = reconcileMultiDraft(
      { therapies: [] },
      [
        [{ drug_name: "Prednisone", dose: "5 mg", frequency: "die", route: "os", status: "active" }],
        [{ drug_name: "Prednisone", dose: "5 mg", frequency: "die", route: "os", status: "active" }],
      ]
    );
    expect(drafts[0].therapies[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[0].therapies[0]._skip).toBeFalsy();
    expect(drafts[1].therapies[0]._skip).toBe(true);
  });

  it("11. episodio storico (sospeso in DB) ripreso nella lettera -> nuovo episodio, non continuità", () => {
    const out = reconcileTherapy(
      [{ id: "t-ada-old", drug_name: "Adalimumab", category: "bDMARD", dose: "40 mg", frequency: "ogni 14 giorni", route: "s.c.", status: "discontinued" }],
      { drug_name: "Adalimumab", dose: "40 mg", frequency: "ogni 14 giorni", route: "s.c.", status: "active" }
    );
    expect(out._status).toBe(ITEM_STATUS.UPDATE);
    expect(out._action).toBe("new_episode");
    expect(out._status).not.toBe(ITEM_STATUS.CONTINUITY);
  });

  it("12. terapia domiciliare non reumatologica in continuità -> nessun evento (_call_upsert falso)", () => {
    const out = reconcileTherapy(
      [{ id: "t-ram", drug_name: "Ramipril", category: "other", dose: "5 mg", frequency: "die", route: "os", status: "active" }],
      { drug_name: "Ramipril", dose: "5 mg", frequency: "die", route: "os", status: "active" }
    );
    expect(out._status).toBe(ITEM_STATUS.CONTINUITY);
    expect(out._skip).toBe(true);
    expect(out._call_upsert).toBeFalsy();
  });
});

function reconcileEventsMultiDraft(existingData, draftsEvents) {
  return reconcileDrafts(
    draftsEvents.map((evs) => ({ raccordo_events: evs })),
    existingData
  );
}

const HISTORY = [
  { event_type: "disease_onset", date_value: "2013-01-01" },
  { event_type: "remission", date_value: "2018-01-01" },
  { event_type: "therapy_stop", date_value: "2022-01-01", drug_canonical: "metotrexato" },
  { event_type: "therapy_start", date_value: "2023-01-01", drug_canonical: "sulfasalazina" },
];

describe("reconcileDrafts — deduplica eventi raccordo (timeline)", () => {
  it("la stessa cronologia in due lettere del batch viene salvata una volta sola", () => {
    const drafts = reconcileEventsMultiDraft({ clinical_events: [] }, [HISTORY, HISTORY]);
    drafts[0].raccordo_events.forEach((e) => {
      expect(e._status).toBe(ITEM_STATUS.NEW);
      expect(e._skip).toBeFalsy();
    });
    drafts[1].raccordo_events.forEach((e) => {
      expect(e._status).toBe(ITEM_STATUS.DUPLICATE);
      expect(e._skip).toBe(true);
    });
  });

  it("evento già presente nella cronologia (DB) viene saltato", () => {
    const [draft] = reconcileDrafts(
      [{ raccordo_events: [{ event_type: "disease_onset", date_value: "2013-01-01" }] }],
      { clinical_events: [{ event_type: "disease_onset", date_value: "2013-01-01" }] }
    );
    expect(draft.raccordo_events[0]._status).toBe(ITEM_STATUS.DUPLICATE);
    expect(draft.raccordo_events[0]._skip).toBe(true);
  });

  it("eventi nuovi e non duplicati restano NEW e salvabili", () => {
    const [draft] = reconcileDrafts(
      [{ raccordo_events: HISTORY }],
      { clinical_events: [] }
    );
    expect(draft.raccordo_events.every((e) => e._status === ITEM_STATUS.NEW && !e._skip)).toBe(true);
  });

  it("due manifestazioni stesso anno ma organo diverso NON vengono deduplicate", () => {
    const [draft] = reconcileDrafts(
      [{ raccordo_events: [
        { event_type: "manifestation_onset", date_value: "2020-01-01", manifestation: "artrite" },
        { event_type: "manifestation_onset", date_value: "2020-01-01", manifestation: "psoriasi cutanea" },
      ] }],
      { clinical_events: [] }
    );
    expect(draft.raccordo_events[0]._status).toBe(ITEM_STATUS.NEW);
    expect(draft.raccordo_events[1]._status).toBe(ITEM_STATUS.NEW);
    expect(draft.raccordo_events[1]._skip).toBeFalsy();
  });

  it("stesso farmaco con date diverse (stop 2022, start 2023) NON viene deduplicato", () => {
    const [draft] = reconcileDrafts(
      [{ raccordo_events: [
        { event_type: "therapy_stop", date_value: "2022-01-01", drug_canonical: "metotrexato" },
        { event_type: "therapy_start", date_value: "2023-01-01", drug_canonical: "metotrexato" },
      ] }],
      { clinical_events: [] }
    );
    expect(draft.raccordo_events[0]._status).toBe(ITEM_STATUS.NEW);
    expect(draft.raccordo_events[1]._status).toBe(ITEM_STATUS.NEW);
  });

  it("reimport: evento con sola data stimata (date_estimated) gia' in DB viene saltato", () => {
    const [draft] = reconcileDrafts(
      [{ raccordo_events: [
        { event_type: "therapy_start", date_value: null, date_estimated: "2019", drug_canonical: "metotrexato" },
      ] }],
      { clinical_events: [
        { event_type: "therapy_start", date_value: null, date_estimated: "2019", drug_canonical: "metotrexato" },
      ] }
    );
    expect(draft.raccordo_events[0]._status).toBe(ITEM_STATUS.DUPLICATE);
    expect(draft.raccordo_events[0]._skip).toBe(true);
  });
});

function reconcileLab(existingLabs, draftLab) {
  const [draft] = reconcileDrafts([{ lab_exams: [draftLab] }], { lab_exams: existingLabs });
  return draft.lab_exams[0];
}

function reconcileLabMultiDraft(existingLabs, draftsLabs) {
  return reconcileDrafts(
    draftsLabs.map((labs) => ({ lab_exams: labs })),
    { lab_exams: existingLabs }
  );
}

describe("reconcileDrafts — esami di laboratorio a livello di parametro", () => {
  it("valore identico già presente in DB (stesso param + stessa data) -> DUPLICATE, non salvato", () => {
    const out = reconcileLab(
      [{ date: "2024-01-10", values: { pcr: { value: "0.5", unit: "mg/dL" } } }],
      { date: "2024-01-10", results: [{ param_key: "pcr", name: "PCR", value: "0.5", unit: "mg/dL" }] }
    );
    expect(out.results[0]._status).toBe(ITEM_STATUS.DUPLICATE);
    expect(out.results[0]._skip).toBe(true);
    expect(out._status).toBe(ITEM_STATUS.DUPLICATE);
    expect(out._skip).toBe(true);
  });

  it("stesso param + stessa data con valore discordante -> CONFLICT senza perdita dato", () => {
    const out = reconcileLab(
      [{ date: "2024-01-10", values: { pcr: { value: "0.5", unit: "mg/dL" } } }],
      { date: "2024-01-10", results: [{ param_key: "pcr", name: "PCR", value: "2.3", unit: "mg/dL" }] }
    );
    expect(out.results[0]._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out.results[0]._skip).toBe(true);
    expect(out._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out._skip).toBe(true);
  });

  it("parametro nuovo per quella data -> NEW e salvabile", () => {
    const out = reconcileLab(
      [{ date: "2024-01-10", values: { pcr: { value: "0.5", unit: "mg/dL" } } }],
      { date: "2024-01-10", results: [{ param_key: "ves", name: "VES", value: "20", unit: "mm/h" }] }
    );
    expect(out.results[0]._status).toBe(ITEM_STATUS.NEW);
    expect(out.results[0]._skip).toBeFalsy();
    expect(out._status).toBe(ITEM_STATUS.NEW);
    expect(out._skip).toBe(false);
  });

  it("stesso param ma data diversa -> NEW (nessun conflitto tra date distinte)", () => {
    const out = reconcileLab(
      [{ date: "2024-01-10", values: { pcr: { value: "0.5", unit: "mg/dL" } } }],
      { date: "2024-02-15", results: [{ param_key: "pcr", name: "PCR", value: "0.5", unit: "mg/dL" }] }
    );
    expect(out.results[0]._status).toBe(ITEM_STATUS.NEW);
    expect(out._skip).toBe(false);
  });

  it("esame misto: un parametro nuovo + uno in conflitto -> esame salvabile, conflitto marcato", () => {
    const out = reconcileLab(
      [{ date: "2024-01-10", values: { pcr: { value: "0.5", unit: "mg/dL" } } }],
      { date: "2024-01-10", results: [
        { param_key: "pcr", name: "PCR", value: "2.3", unit: "mg/dL" },
        { param_key: "ves", name: "VES", value: "20", unit: "mm/h" },
      ] }
    );
    const pcr = out.results.find(r => r.param_key === "pcr");
    const ves = out.results.find(r => r.param_key === "ves");
    expect(pcr._status).toBe(ITEM_STATUS.CONFLICT);
    expect(pcr._skip).toBe(true);
    expect(ves._status).toBe(ITEM_STATUS.NEW);
    expect(ves._skip).toBeFalsy();
    expect(out._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out._skip).toBe(false);
  });

  it("cross-batch: stesso param+data+valore in due lettere -> seconda è DUPLICATE", () => {
    const drafts = reconcileLabMultiDraft(
      [],
      [
        [{ date: "2024-01-10", results: [{ param_key: "pcr", name: "PCR", value: "0.5", unit: "mg/dL" }] }],
        [{ date: "2024-01-10", results: [{ param_key: "pcr", name: "PCR", value: "0.5", unit: "mg/dL" }] }],
      ]
    );
    expect(drafts[0].lab_exams[0].results[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[0].lab_exams[0]._skip).toBe(false);
    expect(drafts[1].lab_exams[0].results[0]._status).toBe(ITEM_STATUS.DUPLICATE);
    expect(drafts[1].lab_exams[0]._skip).toBe(true);
  });

  it("cross-batch: stesso param+data ma valore discordante in due lettere -> seconda è CONFLICT", () => {
    const drafts = reconcileLabMultiDraft(
      [],
      [
        [{ date: "2024-01-10", results: [{ param_key: "pcr", name: "PCR", value: "0.5", unit: "mg/dL" }] }],
        [{ date: "2024-01-10", results: [{ param_key: "pcr", name: "PCR", value: "3.0", unit: "mg/dL" }] }],
      ]
    );
    expect(drafts[1].lab_exams[0].results[0]._status).toBe(ITEM_STATUS.CONFLICT);
    expect(drafts[1].lab_exams[0]._skip).toBe(true);
  });

  it("formattazione equivalente (0.5 vs 0,5; spazi) -> DUPLICATE", () => {
    const out = reconcileLab(
      [{ date: "2024-01-10", values: { pcr: { value: "0.5", unit: "mg/dL" } } }],
      { date: "2024-01-10", results: [{ param_key: "pcr", name: "PCR", value: "0,5 ", unit: "mg/dL" }] }
    );
    expect(out.results[0]._status).toBe(ITEM_STATUS.DUPLICATE);
  });
});

describe("reconcileDrafts — terapie pregresse cross-batch (bug multi-import)", () => {
  const pregressa = {
    drug_name: "Sulfasalazina", category: "csDMARD",
    status: "discontinued", end_date: "2020-06-01", discontinuation_reason: "inefficacia",
  };

  it("stessa pregressa (farmaco + motivo + anno) in N lettere -> salvata una sola volta", () => {
    const drafts = reconcileMultiDraft({ therapies: [] }, [
      [{ ...pregressa }],
      [{ ...pregressa }],
      [{ ...pregressa }],
    ]);
    expect(drafts[0].therapies[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[0].therapies[0]._action).toBe("new_episode");
    expect(drafts[0].therapies[0]._skip).toBeFalsy();
    expect(drafts[1].therapies[0]._status).toBe(ITEM_STATUS.DUPLICATE);
    expect(drafts[1].therapies[0]._skip).toBe(true);
    expect(drafts[2].therapies[0]._status).toBe(ITEM_STATUS.DUPLICATE);
    expect(drafts[2].therapies[0]._skip).toBe(true);
  });

  it("stessa pregressa senza data (solo motivo) in due lettere -> seconda DUPLICATE", () => {
    const drafts = reconcileMultiDraft({ therapies: [] }, [
      [{ drug_name: "Leflunomide", category: "csDMARD", status: "discontinued", discontinuation_reason: "epatotossicità" }],
      [{ drug_name: "Leflunomide", category: "csDMARD", status: "discontinued", discontinuation_reason: "epatotossicità" }],
    ]);
    expect(drafts[0].therapies[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].therapies[0]._status).toBe(ITEM_STATUS.DUPLICATE);
    expect(drafts[1].therapies[0]._skip).toBe(true);
  });

  it("stesso farmaco con anno e motivo diversi -> due episodi storici distinti", () => {
    const drafts = reconcileMultiDraft({ therapies: [] }, [
      [{ drug_name: "Adalimumab", category: "bDMARD", status: "discontinued", end_date: "2018-01-01", discontinuation_reason: "inefficacia" }],
      [{ drug_name: "Adalimumab", category: "bDMARD", status: "discontinued", end_date: "2022-01-01", discontinuation_reason: "intolleranza" }],
    ]);
    expect(drafts[0].therapies[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].therapies[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].therapies[0]._action).toBe("new_episode");
    expect(drafts[1].therapies[0]._skip).toBeFalsy();
  });

  it("attiva poi sospesa nelle lettere successive -> una sola sospensione, non N", () => {
    const drafts = reconcileMultiDraft({ therapies: [] }, [
      [{ drug_name: "Prednisone", category: "GC", status: "active", dose: "5 mg", frequency: "die", route: "os" }],
      [{ drug_name: "Prednisone", category: "GC", status: "discontinued", end_date: "2021-03-01", discontinuation_reason: "remissione" }],
      [{ drug_name: "Prednisone", category: "GC", status: "discontinued", end_date: "2021-03-01", discontinuation_reason: "remissione" }],
    ]);
    expect(drafts[0].therapies[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].therapies[0]._status).toBe(ITEM_STATUS.UPDATE);
    expect(drafts[1].therapies[0]._action).toBe("discontinue");
    expect(drafts[2].therapies[0]._status).toBe(ITEM_STATUS.DUPLICATE);
    expect(drafts[2].therapies[0]._skip).toBe(true);
  });

  it("attiva poi sospensione storica remota (anno precedente) -> NEW, non chiude l'attiva", () => {
    const drafts = reconcileMultiDraft({ therapies: [] }, [
      [{ drug_name: "Metotrexato", category: "csDMARD", status: "active", start_date: "2016-01-01", dose: "15 mg" }],
      [{ drug_name: "Metotrexato", category: "csDMARD", status: "discontinued", end_date: "2014-01-01", discontinuation_reason: "inefficacia" }],
    ]);
    expect(drafts[0].therapies[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].therapies[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].therapies[0]._action).toBe("new_episode");
    expect(drafts[1].therapies[0]._skip).toBeFalsy();
  });

  it("attiva in DB + sospensione storica remota -> NEW historical, non discontinue l'attiva in DB", () => {
    const drafts = reconcileMultiDraft(
      { therapies: [{ id: "t1", drug_name: "Metotrexato", category: "csDMARD", status: "active", start_date: "2016-01-01" }] },
      [
        [{ drug_name: "Metotrexato", category: "csDMARD", status: "discontinued", end_date: "2014-01-01", discontinuation_reason: "inefficacia" }],
      ]
    );
    expect(drafts[0].therapies[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[0].therapies[0]._action).toBe("new_episode");
  });
});

describe("reconcileDrafts — dedup OCR-insensibile per diagnosis/disease_status (Fix 1)", () => {
  it("due diagnosis stesso anno, OCR diverso (2 vs ¿): il secondo è DUPLICATE", () => {
    const drafts = reconcileEventsMultiDraft({ clinical_events: [] }, [
      [{ event_type: "diagnosis", date_value: "2000-01-01", date_precision: "year", detail: "artrite sieronegativa2 posta nel 2000" }],
      [{ event_type: "diagnosis", date_value: "2000-01-01", date_precision: "year", detail: "artrite sieronegativa\u00bf posta nel 2000" }],
    ]);
    expect(drafts[0].raccordo_events[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].raccordo_events[0]._status).toBe(ITEM_STATUS.DUPLICATE);
    expect(drafts[1].raccordo_events[0]._skip).toBe(true);
  });

  it("disease_status stesso anno, testo OCR diverso: il secondo è DUPLICATE", () => {
    const drafts = reconcileEventsMultiDraft({ clinical_events: [] }, [
      [{ event_type: "disease_status", date_value: "2022-06-15", detail: "buon controllo\u00bf di malattia" }],
      [{ event_type: "disease_status", date_value: "2022-06-15", detail: "buon controllo2 di malattia" }],
    ]);
    expect(drafts[0].raccordo_events[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].raccordo_events[0]._skip).toBe(true);
  });

  it("due diagnosis anni diversi: entrambi NEW (non collassati)", () => {
    const drafts = reconcileEventsMultiDraft({ clinical_events: [] }, [
      [{ event_type: "diagnosis", date_value: "2000-01-01", date_precision: "year", detail: "artrite reumatoide 2000" }],
      [{ event_type: "diagnosis", date_value: "2005-01-01", date_precision: "year", detail: "artrite reumatoide 2005" }],
    ]);
    expect(drafts[0].raccordo_events[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].raccordo_events[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].raccordo_events[0]._skip).toBeFalsy();
  });

  it("diagnosis già in DB stesso anno con testo OCR diverso: classificato DUPLICATE", () => {
    const existing = [{ event_type: "diagnosis", date_value: "2000-01-01", date_precision: "year", detail: "artrite reumatoide" }];
    const drafts = reconcileEventsMultiDraft({ clinical_events: existing }, [
      [{ event_type: "diagnosis", date_value: "2000-01-01", date_precision: "year", detail: "artrite reumatoide2 variante" }],
    ]);
    expect(drafts[0].raccordo_events[0]._status).toBe(ITEM_STATUS.DUPLICATE);
    expect(drafts[0].raccordo_events[0]._skip).toBe(true);
  });

  it("disease_onset usa ancora il testo nel sig: varianti testo stesso anno NON collassano", () => {
    const drafts = reconcileEventsMultiDraft({ clinical_events: [] }, [
      [{ event_type: "disease_onset", date_value: "2010-01-01", detail: "artrite alle mani" }],
      [{ event_type: "disease_onset", date_value: "2010-01-01", detail: "artrite ai piedi" }],
    ]);
    expect(drafts[0].raccordo_events[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].raccordo_events[0]._status).toBe(ITEM_STATUS.NEW);
  });
});

describe("reconcileDrafts — eventKey normalizzazione e anno", () => {
  it("varianti di accenti/maiuscole/ordine nel testo evento -> deduplicate", () => {
    const drafts = reconcileEventsMultiDraft({ clinical_events: [] }, [
      [{ event_type: "manifestation_onset", date_value: "2020-01-01", manifestation: "Poliartrite simmetrica" }],
      [{ event_type: "manifestation_onset", date_value: "2020-01-01", manifestation: "poliartrite  simmetrica" }],
    ]);
    expect(drafts[0].raccordo_events[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].raccordo_events[0]._status).toBe(ITEM_STATUS.DUPLICATE);
    expect(drafts[1].raccordo_events[0]._skip).toBe(true);
  });

  it("data a livello anno: date_precision year e date_estimated equivalenti -> deduplicate", () => {
    const drafts = reconcileEventsMultiDraft({ clinical_events: [] }, [
      [{ event_type: "therapy_start", date_value: "2019-01-01", date_precision: "year", drug_canonical: "metotrexato" }],
      [{ event_type: "therapy_start", date_value: null, date_estimated: "2019", drug_canonical: "metotrexato" }],
    ]);
    expect(drafts[0].raccordo_events[0]._status).toBe(ITEM_STATUS.NEW);
    expect(drafts[1].raccordo_events[0]._status).toBe(ITEM_STATUS.DUPLICATE);
  });
});

describe("reconcileDrafts — aumento dose biologico (DB esistente)", () => {
  it("Secukinumab 150 mg in DB -> 300 mg importato: dose_change", () => {
    const out = reconcileTherapy(
      [{ id: "t-sec", drug_name: "Secukinumab", category: "bDMARD", dose: "150 mg", frequency: "ogni 4 settimane", route: "s.c.", status: "active" }],
      { drug_name: "Secukinumab", dose: "300 mg", frequency: "ogni 4 settimane", route: "s.c.", status: "active" }
    );
    expect(out._status).toBe(ITEM_STATUS.CONFLICT);
    expect(out._action).toBe("dose_change");
    expect(out._skip).toBe(false);
  });
});

describe("E2E multi-import — l'ultima visita determina lo stato attivo", () => {
  function findT(therapies, drug) {
    return therapies.find((t) => t.drug_name.toLowerCase() === drug.toLowerCase()) || null;
  }

  it("Secukinumab 300 + MTX attivi; Leflunomide/Golimumab storici discontinued", () => {
    const visitA = [
      "VISITA 10/01/2021",
      "TERAPIA IN ATTO:",
      "Golimumab 50 mg sc/mese",
      "Leflunomide 20 mg/die",
    ].join("\n");
    const visitB = [
      "VISITA 20/03/2024",
      "TERAPIA IN ATTO:",
      "Secukinumab 300 mg sc/mese",
      "Metotrexato 10 mg/settimana",
      "TERAPIE PREGRESSE:",
      "Leflunomide, Golimumab",
    ].join("\n");

    const dA = parseVisitText(visitA, "2024-03-20").extracted;
    const dB = parseVisitText(visitB, "2024-03-20").extracted;

    const reconciled = reconcileDrafts(
      [{ therapies: dA.therapies }, { therapies: dB.therapies }],
      { therapies: [] }
    );

    const finalT = reconciled[1].therapies;
    const sec = findT(finalT, "Secukinumab");
    const mtx = findT(finalT, "Methotrexate");
    const lef = findT(finalT, "Leflunomide");
    const goli = findT(finalT, "Golimumab");

    expect(sec?.status).toBe("active");
    expect(sec?.dose).toBe("300 mg");
    expect(sec?._skip).not.toBe(true);

    expect(mtx?.status).toBe("active");

    expect(lef?.status).toBe("discontinued");
    expect(lef?._action).toBe("discontinue");
    expect(goli?.status).toBe("discontinued");
    expect(goli?._action).toBe("discontinue");
  });
});
