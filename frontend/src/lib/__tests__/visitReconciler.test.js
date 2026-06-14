import { reconcileDrafts, ITEM_STATUS } from "../visitReconciler";

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
