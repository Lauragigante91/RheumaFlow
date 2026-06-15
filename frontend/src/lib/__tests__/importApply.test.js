import { applyOneDraft, mergeFreeTextConservative, fillMissingOnly } from "../importApply";
import { buildTherapyUpsertPayload } from "../importPayloadBuilders";
import {
  patientsApi,
  assessmentsApi,
  instrumentalExamsApi,
  scleroProfileApi,
  therapiesApi,
  labExamsApi,
  diseaseProfileApi,
  workupVisitsApi,
  clinicalEventsApi,
} from "../api";

jest.mock("../api", () => ({
  patientsApi:         { update: jest.fn(), patch: jest.fn() },
  assessmentsApi:      { create: jest.fn() },
  instrumentalExamsApi:{ create: jest.fn() },
  scleroProfileApi:    { get: jest.fn(), upsert: jest.fn() },
  therapiesApi:        { upsert: jest.fn() },
  labExamsApi:         { upsert: jest.fn() },
  diseaseProfileApi:   { get: jest.fn(), upsert: jest.fn() },
  workupVisitsApi:     { create: jest.fn() },
  clinicalEventsApi:   { batchCreate: jest.fn() },
}));

const ALL_SELECTED = {
  patient: true,
  visit_sections: true,
  exam_imaging: true,
  assessments: true,
  therapies: true,
  lab_exams: true,
  instrumental_findings: true,
  sclero_profile: true,
  ra_profile: true,
  spa_profile: true,
  sle_profile: true,
  profilo_generale: true,
  comorbidita: true,
  intolleranze: true,
  raccordo_events: true,
};

function basePatient(overrides = {}) {
  return {
    id: "p1",
    nome: "Mario",
    cognome: "Rossi",
    comorbidita_apr: "",
    allergie_testo: "",
    anamnesi_fisiologica: "",
    anamnesi_familiare: "",
    terapia_domiciliare: "",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  let seq = 0;
  workupVisitsApi.create.mockImplementation(() => Promise.resolve({ id: `wv-${++seq}` }));
  assessmentsApi.create.mockResolvedValue({});
  instrumentalExamsApi.create.mockResolvedValue({});
  therapiesApi.upsert.mockResolvedValue({});
  labExamsApi.upsert.mockResolvedValue({});
  patientsApi.update.mockResolvedValue({});
  patientsApi.patch.mockResolvedValue({});
  diseaseProfileApi.get.mockResolvedValue(null);
  diseaseProfileApi.upsert.mockResolvedValue({});
  scleroProfileApi.get.mockResolvedValue(null);
  scleroProfileApi.upsert.mockResolvedValue({});
  clinicalEventsApi.batchCreate.mockResolvedValue({});
});

describe("mergeFreeTextConservative", () => {
  it("aggiunge solo le righe nuove, preservando quelle esistenti", () => {
    const out = mergeFreeTextConservative("Ipertensione\nDiabete", "Diabete\nDislipidemia");
    expect(out).toBe("Ipertensione\nDiabete\nDislipidemia");
  });

  it("dedup case-insensitive e con punteggiatura/spazi finali", () => {
    const out = mergeFreeTextConservative("Ipertensione", "ipertensione.\nIPERTENSIONE");
    expect(out).toBe("Ipertensione");
  });

  it("testo esistente vuoto -> usa solo l'incoming", () => {
    expect(mergeFreeTextConservative("", "Asma")).toBe("Asma");
  });

  it("ordine parole diverso (stessa diagnosi) -> non duplica", () => {
    const out = mergeFreeTextConservative(
      "Artrite reumatoide sieropositiva",
      "Sieropositiva artrite reumatoide"
    );
    expect(out).toBe("Artrite reumatoide sieropositiva");
  });

  it("varianti di accenti e punteggiatura -> non duplica", () => {
    const out = mergeFreeTextConservative(
      "Sindrome di Sjögren",
      "sindrome di sjogren.\nSjögren, sindrome di"
    );
    expect(out).toBe("Sindrome di Sjögren");
  });

  it("preserva le negazioni: 'fumatore' e 'non fumatore' restano distinti", () => {
    const out = mergeFreeTextConservative("Fumatore", "Non fumatore");
    expect(out).toBe("Fumatore\nNon fumatore");
  });
});

describe("buildTherapyUpsertPayload — override esposizione storica", () => {
  it("pregressa (discontinued + new_episode) -> event_type_override historical_exposure", () => {
    const p = buildTherapyUpsertPayload(
      { drug_name: "Adalimumab", status: "discontinued", _action: "new_episode", end_date: "2019-01-01" },
      "p1",
      "wv-1"
    );
    expect(p.event_type_override).toBe("historical_exposure");
    expect(p.end_date).toBe("2019-01-01");
  });

  it("sospensione di terapia attiva (discontinue) -> nessun override", () => {
    const p = buildTherapyUpsertPayload(
      { drug_name: "Metotrexato", status: "discontinued", _action: "discontinue" },
      "p1",
      "wv-1"
    );
    expect(p.event_type_override).toBeUndefined();
  });

  it("terapia attiva -> nessun override anche con new_episode", () => {
    const p = buildTherapyUpsertPayload(
      { drug_name: "Idrossiclorochina", status: "active", _action: "new_episode" },
      "p1",
      "wv-1"
    );
    expect(p.event_type_override).toBeUndefined();
  });

  it("import singolo (senza _action) -> nessun override", () => {
    const p = buildTherapyUpsertPayload(
      { drug_name: "Prednisone", status: "discontinued" },
      "p1",
      "wv-1"
    );
    expect(p.event_type_override).toBeUndefined();
  });
});

describe("fillMissingOnly", () => {
  it("riempie solo i campi vuoti, mai sovrascrive i non vuoti", () => {
    const out = fillMissingOnly({ a: "X", b: "" }, { a: "Y", b: "Z", c: "W" });
    expect(out).toEqual({ a: "X", b: "Z", c: "W" });
  });

  it("skipFalse: ignora i valori false in incoming", () => {
    const out = fillMissingOnly({ flag: "" }, { flag: false }, { skipFalse: true });
    expect(out).toEqual({ flag: "" });
  });
});

describe("applyOneDraft — diagnosi conservativa", () => {
  it("diagnosi diversa -> merge append, mai overwrite distruttivo", async () => {
    const patient = basePatient({ diagnosi: "Artrite reumatoide" });
    await applyOneDraft(
      { patient: { diagnosi: "Artrite psoriasica" } },
      patient,
      { patient: true },
      "follow_up"
    );
    expect(patientsApi.update).toHaveBeenCalledWith("p1", {
      diagnosi: "Artrite reumatoide\nArtrite psoriasica",
    });
  });

  it("diagnosi identica -> nessuna scrittura", async () => {
    const patient = basePatient({ diagnosi: "Artrite reumatoide" });
    await applyOneDraft(
      { patient: { diagnosi: "artrite reumatoide" } },
      patient,
      { patient: true },
      "follow_up"
    );
    expect(patientsApi.update).not.toHaveBeenCalled();
  });

  it("diagnosi assente nel paziente -> usa quella importata", async () => {
    const patient = basePatient({ diagnosi: "" });
    await applyOneDraft(
      { patient: { diagnosi: "LES" } },
      patient,
      { patient: true },
      "follow_up"
    );
    expect(patientsApi.update).toHaveBeenCalledWith("p1", { diagnosi: "LES" });
  });
});

describe("applyOneDraft — sezione deselezionata non importata", () => {
  it("exam_imaging deselezionato -> nessun esame strumentale creato", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2024-01-10",
        exam_imaging: [{ examLabel: "Ecografia", reportText: "ndr" }],
      },
      patient,
      { exam_imaging: false },
      "follow_up"
    );
    expect(instrumentalExamsApi.create).not.toHaveBeenCalled();
  });

  it("exam_imaging selezionato -> esame strumentale creato con la data della visita", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2024-01-10",
        exam_imaging: [{ examLabel: "Ecografia", reportText: "ndr" }],
      },
      patient,
      { exam_imaging: true },
      "follow_up"
    );
    expect(instrumentalExamsApi.create).toHaveBeenCalledTimes(1);
    expect(instrumentalExamsApi.create.mock.calls[0][0].exam_date).toBe("2024-01-10");
  });
});

describe("applyOneDraft — clinimetrie con data della visita", () => {
  it("usa extracted.visit_date come fallback per la data degli assessment", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2024-03-01",
        assessments: [{ index_type: "DAS28", score: 3.2 }],
      },
      patient,
      ALL_SELECTED,
      "follow_up"
    );
    expect(assessmentsApi.create).toHaveBeenCalledTimes(1);
    expect(assessmentsApi.create.mock.calls[0][0].date).toBe("2024-03-01");
  });

  it("assessment con data propria mantiene la propria data", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2024-03-01",
        assessments: [{ index_type: "DAS28", score: 3.2, date: "2024-02-20" }],
      },
      patient,
      ALL_SELECTED,
      "follow_up"
    );
    expect(assessmentsApi.create.mock.calls[0][0].date).toBe("2024-02-20");
  });
});

describe("applyOneDraft — più draft: N visita-odierna + N assessment con data per-visita", () => {
  it("3 draft generano 3 workup_visit e 3 assessment legati alla data di ciascuna visita", async () => {
    const dates = ["2024-01-10", "2024-03-15", "2024-06-20"];
    for (const d of dates) {
      const patient = basePatient();
      await applyOneDraft(
        {
          visit_date: d,
          visit_sections: { anamnesi: "controllo", esame_obj: "ndr" },
          assessments: [{ index_type: "DAS28", score: 2.5 }],
        },
        patient,
        ALL_SELECTED,
        "follow_up"
      );
    }
    expect(workupVisitsApi.create).toHaveBeenCalledTimes(3);
    expect(assessmentsApi.create).toHaveBeenCalledTimes(3);
    const usedDates = assessmentsApi.create.mock.calls.map((c) => c[0].date);
    expect(usedDates).toEqual(dates);
    const visitDates = workupVisitsApi.create.mock.calls.map((c) => c[1].visit_date);
    expect(visitDates).toEqual(dates);
  });

  it("ogni assessment è legato al workup_visit creato nello stesso draft", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2024-01-10",
        visit_sections: { anamnesi: "x" },
        assessments: [{ index_type: "DAS28", score: 2.5 }],
      },
      patient,
      ALL_SELECTED,
      "follow_up"
    );
    expect(assessmentsApi.create.mock.calls[0][0].visit_id).toBe("wv-1");
  });
});

describe("applyOneDraft — merge conservativo comorbidità/allergie/profilo generale", () => {
  it("comorbidità: append-only, preserva quelle esistenti", async () => {
    const patient = basePatient({ comorbidita_apr: "Ipertensione" });
    await applyOneDraft(
      { comorbidita: [{ text: "Diabete" }] },
      patient,
      { comorbidita: true },
      "follow_up"
    );
    expect(patientsApi.patch).toHaveBeenCalledWith("p1", { comorbidita_apr: "Ipertensione\nDiabete" });
  });

  it("comorbidità identica già presente -> nessuna patch", async () => {
    const patient = basePatient({ comorbidita_apr: "Diabete" });
    await applyOneDraft(
      { comorbidita: [{ text: "Diabete" }] },
      patient,
      { comorbidita: true },
      "follow_up"
    );
    expect(patientsApi.patch).not.toHaveBeenCalled();
  });

  it("profilo generale: free-text uniti in modo conservativo", async () => {
    const patient = basePatient({ anamnesi_fisiologica: "Non fumatore" });
    await applyOneDraft(
      { profilo_generale: { anamnesi_fisiologica: "Non fumatore\nBevitore occasionale" } },
      patient,
      { profilo_generale: true },
      "follow_up"
    );
    expect(patientsApi.patch).toHaveBeenCalledWith("p1", {
      anamnesi_fisiologica: "Non fumatore\nBevitore occasionale",
    });
  });
});

describe("applyOneDraft — profili malattia fill-empty-only", () => {
  it("non sovrascrive un campo già valorizzato nel profilo AR esistente", async () => {
    diseaseProfileApi.get.mockResolvedValue({ data: { erosioni: "sì", noduli: "" } });
    const patient = basePatient();
    await applyOneDraft(
      { ra_profile: { erosioni: "no", noduli: "presenti" } },
      patient,
      { ra_profile: true },
      "follow_up"
    );
    expect(diseaseProfileApi.upsert).toHaveBeenCalledWith("p1", "ra", {
      erosioni: "sì",
      noduli: "presenti",
    });
  });

  it("profilo SLE: antibodies merge annidato fill-empty-only", async () => {
    diseaseProfileApi.get.mockResolvedValue({ data: { antibodies: { ana: "1:320", dsdna: "" } } });
    const patient = basePatient();
    await applyOneDraft(
      { sle_profile: { antibodies: { ana: "1:80", dsdna: "positivo" }, nefrite: "sì" } },
      patient,
      { sle_profile: true },
      "follow_up"
    );
    expect(diseaseProfileApi.upsert).toHaveBeenCalledWith("p1", "sle", {
      antibodies: { ana: "1:320", dsdna: "positivo" },
      nefrite: "sì",
    });
  });
});

describe("applyOneDraft — lab in conflitto non inviato a upsert", () => {
  it("invia solo i risultati non _skip; un esame con tutti i risultati in conflitto è già escluso a monte", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2024-01-10",
        lab_exams: [
          {
            date: "2024-01-10",
            _skip: false,
            results: [
              { param_key: "ves", name: "VES", value: "20", unit: "mm/h", _status: "new" },
              { param_key: "pcr", name: "PCR", value: "2.3", unit: "mg/dL", _status: "conflict", _skip: true },
            ],
          },
        ],
      },
      patient,
      { lab_exams: true },
      "follow_up"
    );
    expect(labExamsApi.upsert).toHaveBeenCalledTimes(1);
    const payload = labExamsApi.upsert.mock.calls[0][0];
    expect(Object.keys(payload.values)).toEqual(["ves"]);
    expect(payload.values.pcr).toBeUndefined();
  });

  it("esame con _skip:true non viene inviato all'upsert", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2024-01-10",
        lab_exams: [
          {
            date: "2024-01-10",
            _skip: true,
            results: [{ param_key: "pcr", name: "PCR", value: "0.5", unit: "mg/dL", _status: "duplicate", _skip: true }],
          },
        ],
      },
      patient,
      { lab_exams: true },
      "follow_up"
    );
    expect(labExamsApi.upsert).not.toHaveBeenCalled();
  });
});
