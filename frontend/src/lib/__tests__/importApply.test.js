import {
  applyOneDraft,
  mergeFreeTextConservative,
  fillMissingOnly,
  applyDraftBatch,
  computeLongitudinalState,
} from "../importApply";
import { buildTherapyUpsertPayload } from "../importPayloadBuilders";
import { buildTerapiaUscita } from "../terapiaUscita";
import { parseVisitText } from "../visitTextParser";
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

describe("applyDraftBatch — multi-import: per-visita N volte + stato longitudinale una volta", () => {
  const mkDraft = (date, { diagnosi = "", anamnesi = "", terapia = "" }) => ({
    visit_date: date,
    visit_type: "follow_up",
    patient: { diagnosi },
    profilo_generale: { anamnesi_fisiologica: anamnesi, terapia_domiciliare: terapia },
    visit_sections: { anamnesi: `controllo ${date}`, esame_obj: `EO ${date}` },
    assessments: [{ index_type: "DAS28", score: 2.5 }],
  });

  const toApply = [
    {
      date: "2023-01-10", visitType: "follow_up", label: "V1", selected: ALL_SELECTED,
      draft: mkDraft("2023-01-10", { diagnosi: "Artrite reumatoide", anamnesi: "Non fumatore", terapia: "MTX 10mg" }),
    },
    {
      date: "2023-06-15", visitType: "follow_up", label: "V2", selected: ALL_SELECTED,
      draft: mkDraft("2023-06-15", { diagnosi: "Artrite reumatoide sieropositiva", anamnesi: "Ex fumatore", terapia: "MTX 15mg" }),
    },
    {
      date: "2024-02-20", visitType: "follow_up", label: "V3", selected: ALL_SELECTED,
      draft: mkDraft("2024-02-20", { diagnosi: "Artrite reumatoide sieropositiva erosiva", anamnesi: "Ex fumatore, sospeso 2023", terapia: "MTX 15mg + ADA" }),
    },
  ];

  it("crea N workup_visit e N assessment, uno per visita, con date e referti distinti", async () => {
    const patient = basePatient({ diagnosi: "" });
    await applyDraftBatch(toApply, patient, { defaultVisitType: "follow_up" });

    expect(workupVisitsApi.create).toHaveBeenCalledTimes(3);
    expect(assessmentsApi.create).toHaveBeenCalledTimes(3);

    const visitDates = workupVisitsApi.create.mock.calls.map((c) => c[1].visit_date);
    expect(visitDates).toEqual(["2023-01-10", "2023-06-15", "2024-02-20"]);

    const intervalHistories = workupVisitsApi.create.mock.calls.map((c) => c[1].interval_history);
    expect(intervalHistories).toEqual(["controllo 2023-01-10", "controllo 2023-06-15", "controllo 2024-02-20"]);

    const exams = workupVisitsApi.create.mock.calls.map((c) => c[1].physical_exam);
    expect(exams).toEqual(["EO 2023-01-10", "EO 2023-06-15", "EO 2024-02-20"]);

    const assessmentDates = assessmentsApi.create.mock.calls.map((c) => c[0].date);
    expect(assessmentDates).toEqual(["2023-01-10", "2023-06-15", "2024-02-20"]);
  });

  it("aggiorna lo stato del paziente UNA sola volta con i valori dell'ultima visita (no concatenazione)", async () => {
    const patient = basePatient({ diagnosi: "" });
    await applyDraftBatch(toApply, patient, { defaultVisitType: "follow_up" });

    expect(patientsApi.update).toHaveBeenCalledTimes(1);
    const updatePatch = patientsApi.update.mock.calls[0][1];
    expect(updatePatch.diagnosi).toBe("Artrite reumatoide sieropositiva erosiva");
    expect(updatePatch.diagnosi).not.toContain("\n");

    expect(patientsApi.patch).toHaveBeenCalledTimes(1);
    const patchPatch = patientsApi.patch.mock.calls[0][1];
    expect(patchPatch.anamnesi_fisiologica).toBe("Ex fumatore, sospeso 2023");
    expect(patchPatch.anamnesi_fisiologica).not.toContain("Non fumatore");
    expect(patchPatch.terapia_domiciliare).toBe("MTX 15mg + ADA");
  });

  it("guardia anti-vuoto: una visita più recente senza diagnosi non cancella quella precedente", async () => {
    const patient = basePatient({ diagnosi: "" });
    const drafts = [
      {
        date: "2023-01-10", visitType: "follow_up", label: "V1", selected: ALL_SELECTED,
        draft: mkDraft("2023-01-10", { diagnosi: "LES", anamnesi: "A", terapia: "X" }),
      },
      {
        date: "2024-02-20", visitType: "follow_up", label: "V2", selected: ALL_SELECTED,
        draft: mkDraft("2024-02-20", { diagnosi: "", anamnesi: "B", terapia: "Y" }),
      },
    ];
    await applyDraftBatch(drafts, patient, {});

    expect(patientsApi.update).toHaveBeenCalledTimes(1);
    expect(patientsApi.update.mock.calls[0][1].diagnosi).toBe("LES");
  });

  it("skip-if-same: stato già allineato non genera scritture sul paziente", async () => {
    const patient = basePatient({
      diagnosi: "Artrite reumatoide sieropositiva erosiva",
      anamnesi_fisiologica: "Ex fumatore, sospeso 2023",
      terapia_domiciliare: "MTX 15mg + ADA",
    });
    await applyDraftBatch(toApply, patient, {});

    expect(patientsApi.update).not.toHaveBeenCalled();
    expect(patientsApi.patch).not.toHaveBeenCalled();
    expect(workupVisitsApi.create).toHaveBeenCalledTimes(3);
  });

  it("computeLongitudinalState: latest-non-empty per campo", () => {
    const state = computeLongitudinalState(toApply.map((v) => ({ draft: v.draft, selected: v.selected })));
    expect(state.diagnosi).toBe("Artrite reumatoide sieropositiva erosiva");
    expect(state.anamnesi_fisiologica).toBe("Ex fumatore, sospeso 2023");
    expect(state.terapia_domiciliare).toBe("MTX 15mg + ADA");
  });

  it("comorbidità/allergie: precedenza structured + fallback profilo, latest-wins senza concatenazione", async () => {
    const patient = basePatient();
    const drafts = [
      {
        date: "2023-01-10", visitType: "follow_up", label: "V1", selected: ALL_SELECTED,
        draft: {
          visit_date: "2023-01-10",
          visit_type: "follow_up",
          profilo_generale: { comorbidita_apr: "Ipertensione" },
          intolleranze: [{ drug: "Penicillina", reason: "orticaria" }],
        },
      },
      {
        date: "2024-02-20", visitType: "follow_up", label: "V2", selected: ALL_SELECTED,
        draft: {
          visit_date: "2024-02-20",
          visit_type: "follow_up",
          comorbidita: [{ text: "Diabete" }],
          profilo_generale: { allergie: "Nessuna allergia nota" },
        },
      },
    ];
    await applyDraftBatch(drafts, patient, {});

    expect(patientsApi.patch).toHaveBeenCalledTimes(1);
    const patchPatch = patientsApi.patch.mock.calls[0][1];
    expect(patchPatch.comorbidita_apr).toBe("Diabete");
    expect(patchPatch.comorbidita_apr).not.toContain("Ipertensione");
    expect(patchPatch.allergie_testo).toBe("Nessuna allergia nota");
    expect(patchPatch.allergie_testo).not.toContain("Penicillina");
  });

  it("checklist completezza per-visita: ogni visita conserva raccordo/anamnesi/EO/clinimetrie/esami/indicazioni e le storiche non vengono impoverite", async () => {
    const mkFull = (date, score) => ({
      date,
      visitType: "follow_up",
      label: `V ${date}`,
      selected: ALL_SELECTED,
      draft: {
        visit_date: date,
        visit_type: "follow_up",
        patient: { diagnosi: `Dx ${date}` },
        profilo_generale: { terapia_domiciliare: `Terapia ${date}`, anamnesi_fisiologica: `Anam ${date}` },
        visit_sections: {
          raccordo: `Raccordo ${date}`,
          anamnesi: `Anamnesi ${date}`,
          esame_obj: `EO ${date}`,
          conclusioni: `Conclusioni ${date}`,
          indicazioni: `Indicazioni ${date}`,
        },
        assessments: [{ index_type: "DAS28", score }],
        exam_imaging: [{ examLabel: `Ecografia ${date}`, reportText: `Referto ${date}` }],
      },
    });
    const d = ["2022-02-01", "2023-05-10", "2024-09-30"];
    const drafts = [mkFull(d[0], 4.1), mkFull(d[1], 3.0), mkFull(d[2], 1.8)];
    const patient = basePatient({ diagnosi: "" });
    await applyDraftBatch(drafts, patient, { defaultVisitType: "follow_up" });

    expect(workupVisitsApi.create).toHaveBeenCalledTimes(3);
    const wv = workupVisitsApi.create.mock.calls.map((c) => c[1]);

    expect(wv.map((p) => p.visit_date)).toEqual(d);
    expect(wv.map((p) => p.rheumatologic_history_summary)).toEqual(d.map((x) => `Raccordo ${x}`));
    expect(wv.map((p) => p.interval_history)).toEqual(d.map((x) => `Anamnesi ${x}`));
    expect(wv.map((p) => p.physical_exam)).toEqual(d.map((x) => `EO ${x}`));
    expect(wv.map((p) => p.conclusions)).toEqual(d.map((x) => `Conclusioni ${x}`));
    expect(wv.map((p) => p.referral_note)).toEqual(d.map((x) => `Indicazioni ${x}`));
    wv.forEach((p, i) => {
      expect(p.labs_imaging).toContain(`Ecografia ${d[i]}`);
      expect(p.labs_imaging).toContain(`Referto ${d[i]}`);
      expect(p.home_therapies_text).toBe(`Terapia ${d[i]}`);
    });

    expect(assessmentsApi.create).toHaveBeenCalledTimes(3);
    expect(assessmentsApi.create.mock.calls.map((c) => c[0].date)).toEqual(d);
    expect(assessmentsApi.create.mock.calls.map((c) => c[0].score)).toEqual([4.1, 3.0, 1.8]);

    expect(instrumentalExamsApi.create).toHaveBeenCalledTimes(3);
    expect(instrumentalExamsApi.create.mock.calls.map((c) => c[0].exam_date)).toEqual(d);

    expect(patientsApi.update).toHaveBeenCalledTimes(1);
    expect(patientsApi.update.mock.calls[0][1].diagnosi).toBe(`Dx ${d[2]}`);
    expect(patientsApi.update.mock.calls[0][1].diagnosi).not.toContain("\n");
    expect(patientsApi.patch).toHaveBeenCalledTimes(1);
    expect(patientsApi.patch.mock.calls[0][1].terapia_domiciliare).toBe(`Terapia ${d[2]}`);
    expect(patientsApi.patch.mock.calls[0][1].anamnesi_fisiologica).toBe(`Anam ${d[2]}`);
  });
});

describe("terapia in uscita (TERAPIA IN USCITA) — testo del referto", () => {
  beforeEach(() => jest.clearAllMocks());

  it("buildTerapiaUscita: restituisce il testo del referto verbatim, senza marcatura", () => {
    const ref = "Secukinumab 300 mg s.c. ogni 4 settimane.\nMethotrexate 10 mg i.m. una volta a settimana.";
    const out = buildTerapiaUscita({ refertoText: ref, ricostruito: "Adalimumab 40 mg" });
    expect(out).toBe(ref);
    expect(out).not.toContain("(ricostruito)");
    expect(out).not.toContain("(invariata)");
  });

  it("buildTerapiaUscita: senza testo del referto ricade sul ledger marcato (ricostruito)", () => {
    const out = buildTerapiaUscita({ ricostruito: "Metotrexato 15 mg/sett" });
    expect(out).toContain("Metotrexato 15 mg/sett");
    expect(out).toContain("(ricostruito)");
    expect(out).not.toContain("(invariata)");
  });

  it("buildTerapiaUscita: testo del referto vuoto o solo spazi ricade sul ledger (ricostruito)", () => {
    const a = buildTerapiaUscita({ refertoText: "", ricostruito: "MTX 10 mg" });
    expect(a).toContain("MTX 10 mg");
    expect(a).toContain("(ricostruito)");
    const b = buildTerapiaUscita({ refertoText: "   ", ricostruito: "MTX 10 mg" });
    expect(b).toContain("MTX 10 mg");
    expect(b).toContain("(ricostruito)");
  });

  it("buildTerapiaUscita: nessun dato restituisce null", () => {
    expect(buildTerapiaUscita({})).toBeNull();
    expect(buildTerapiaUscita({ refertoText: "", ricostruito: "" })).toBeNull();
  });

  it("buildTerapiaUscita: non fabbrica mai '(invariata)'", () => {
    expect(buildTerapiaUscita({ ricostruito: "MTX 15 mg/sett" })).not.toContain("(invariata)");
    expect(buildTerapiaUscita({ refertoText: "MTX 15 mg/sett" })).not.toContain("(invariata)");
  });

  it("parser (a): una sezione IN TERAPIA lunga diventa la TERAPIA IN USCITA verbatim, non una lista farmaco+dose", () => {
    const referto = [
      "CONCLUSIONI",
      "Artrite psoriasica in buon controllo di malattia.",
      "",
      "IN TERAPIA:",
      "- Secukinumab 300 mg s.c. ogni 4 settimane.",
      "- Methotrexate 10 mg i.m. una volta a settimana.",
      "- Acido folico 5 mg il giorno dopo il methotrexate.",
      "- Controllo emocromo, AST, ALT e creatinina ogni 8-12 settimane.",
    ].join("\n");
    const { extracted } = parseVisitText(referto);
    const uscita = extracted.visit_sections.terapia_uscita;
    expect(uscita).toContain("Secukinumab 300 mg");
    expect(uscita).toContain("ogni 4 settimane");
    expect(uscita).toContain("Methotrexate 10 mg");
    expect(uscita).toContain("una volta a settimana");
    expect(uscita).toContain("Acido folico 5 mg");
    expect(uscita).toContain("Controllo emocromo");
    expect(uscita).not.toContain("(invariata)");
    expect(uscita).not.toContain("(ricostruito)");
  });

  it("parser (b): senza IN TERAPIA, la TERAPIA IN USCITA contiene solo la parte farmacologica di INDICAZIONI", () => {
    const referto = [
      "CONCLUSIONI",
      "Artrite reumatoide in fase attiva.",
      "",
      "INDICAZIONI",
      "- Aumentare metotrexato a 15 mg a settimana.",
      "- Aggiungere acido folico 5 mg.",
      "- Controllo emocromo e transaminasi tra 6 settimane.",
      "- Rivalutazione clinica tra 3 mesi.",
    ].join("\n");
    const { extracted } = parseVisitText(referto);
    const uscita = extracted.visit_sections.terapia_uscita;
    expect(uscita).toContain("metotrexato");
    expect(uscita).toContain("15 mg");
    expect(uscita).toContain("acido folico 5 mg");
    expect(uscita).not.toContain("emocromo");
    expect(uscita).not.toContain("Rivalutazione");
  });

  it("parser (c): le terapie pregresse del raccordo non entrano nella TERAPIA IN USCITA", () => {
    const referto = [
      "RACCORDO ANAMNESTICO",
      "In passato trattata con Adalimumab dal 2018 al 2020, sospeso per inefficacia.",
      "Etanercept dal 2020, sospeso per reazione cutanea.",
      "",
      "IN TERAPIA:",
      "- Secukinumab 300 mg s.c. ogni 4 settimane.",
    ].join("\n");
    const { extracted } = parseVisitText(referto);
    const uscita = extracted.visit_sections.terapia_uscita;
    expect(uscita).toContain("Secukinumab");
    expect(uscita).not.toContain("Adalimumab");
    expect(uscita).not.toContain("Etanercept");
  });

  it("buildTerapiaUscita (d): con ledger discordante segue il testo del referto, non il ledger", () => {
    const referto = "Secukinumab 300 mg s.c. ogni 4 settimane.\nMethotrexate 10 mg i.m. una volta a settimana.";
    const ledger = "Adalimumab 40 mg (invariata)\nPrednisone 5 mg";
    const out = buildTerapiaUscita({ refertoText: referto, ricostruito: ledger });
    expect(out).toBe(referto);
    expect(out).not.toContain("Adalimumab");
    expect(out).not.toContain("(invariata)");
  });

  it("parser: una IN TERAPIA breve inline non viene scartata dalla soglia di lunghezza", () => {
    const { extracted } = parseVisitText("IN TERAPIA: MTX 10 mg");
    expect(extracted.visit_sections.terapia_uscita).toContain("MTX 10 mg");
  });

  it("parser: un header esplicito TERAPIA IN USCITA breve viene preservato", () => {
    const { extracted } = parseVisitText("TERAPIA IN USCITA: Humira");
    expect(extracted.visit_sections.terapia_uscita).toContain("Humira");
  });

  it("parser: la parte farmacologica di INDICAZIONI si ferma prima di accertamenti, controlli e saluti", () => {
    const referto = [
      "CONCLUSIONI",
      "Artrite reumatoide.",
      "",
      "INDICAZIONI",
      "- Prosegue Medrol 16 mg 1/4 cp al giorno per 1 mese, poi 1/4 cp a giorni alterni per 1 mese, poi STOP.",
      "- RIPRENDE Metotrexato 7.5 mg 1 fl sc ogni 7 giorni (es il lunedì) seguita dopo 24 ore da Folina 5 mg (es il martedì). Monitoraggio mensile degli esami come da impegnativa per 3 mesi.",
      "- Deursil 450 mg 1 cp a pranzo.",
      "- Colecalciferolo 10.000 UI 40 gtt a settimana.",
      "Si prescrivono i seguenti accertamenti ematochimici: emocromo, PCR, creatinina, transaminasi.",
      "Controllo clinico programmato tra 3 mesi.",
      "Cordiali saluti.",
    ].join("\n");
    const { extracted } = parseVisitText(referto);
    const uscita = extracted.visit_sections.terapia_uscita;
    expect(uscita).toContain("Medrol 16 mg");
    expect(uscita).toContain("RIPRENDE Metotrexato 7.5 mg");
    expect(uscita).toContain("Folina 5 mg");
    expect(uscita).toContain("Monitoraggio mensile degli esami");
    expect(uscita).toContain("Deursil 450 mg");
    expect(uscita).toContain("Colecalciferolo 10.000 UI");
    expect(uscita).not.toContain("accertamenti");
    expect(uscita).not.toContain("emocromo");
    expect(uscita).not.toContain("Controllo clinico");
    expect(uscita).not.toContain("Cordiali saluti");
    expect(uscita).not.toContain("(ricostruito)");
  });

  it("parser: una INDICAZIONI che inizia con 'Si prescrive <farmaco>' non viene tagliata a vuoto", () => {
    const referto = [
      "CONCLUSIONI",
      "Artrite reumatoide.",
      "",
      "INDICAZIONI",
      "Si prescrive Methotrexate 15 mg a settimana e acido folico 5 mg.",
      "Si prescrivono i seguenti accertamenti: emocromo, creatinina.",
      "Controllo tra 3 mesi.",
    ].join("\n");
    const { extracted } = parseVisitText(referto);
    const uscita = extracted.visit_sections.terapia_uscita;
    expect(uscita).toContain("Methotrexate 15 mg");
    expect(uscita).toContain("acido folico 5 mg");
    expect(uscita).not.toContain("accertamenti");
    expect(uscita).not.toContain("emocromo");
    expect(uscita).not.toContain("Controllo tra");
    expect(uscita).not.toContain("(ricostruito)");
  });

  it("parser: il blocco non farmacologico in minuscolo dopo punto viene comunque tagliato", () => {
    const referto = [
      "CONCLUSIONI",
      "Artrite reumatoide.",
      "",
      "INDICAZIONI",
      "Prosegue prednisone 5 mg al giorno. esami ematici di controllo tra 1 mese.",
    ].join("\n");
    const { extracted } = parseVisitText(referto);
    const uscita = extracted.visit_sections.terapia_uscita;
    expect(uscita).toContain("prednisone 5 mg");
    expect(uscita).not.toContain("esami ematici");
    expect(uscita).not.toContain("(ricostruito)");
  });

  it("import singolo: visit_sections.terapia_uscita viene salvato in exit_therapy_text", async () => {
    const ORIG = [
      "PRESCRIZIONE TERAPEUTICA: Upadacitinib 15 mg/die.",
      "Controllo lipidi e transaminasi a 4 settimane. Rivalutazione a 3 mesi.",
    ].join("\n");
    await applyOneDraft(
      {
        visit_date: "2024-05-10",
        visit_type: "follow_up",
        visit_sections: { anamnesi: "controllo", esame_obj: "ndr", terapia_uscita: ORIG },
      },
      basePatient(),
      ALL_SELECTED,
      "follow_up"
    );
    expect(workupVisitsApi.create).toHaveBeenCalledTimes(1);
    const payload = workupVisitsApi.create.mock.calls[0][1];
    expect(payload.exit_therapy_text).toBe(ORIG);
  });

  it("multi-import: ogni visita conserva il proprio testo terapia in uscita (isolamento per-visita)", async () => {
    const texts = {
      "2022-04-01": "Metotrexato 15 mg/sett invariato. Folina 5 mg/sett.",
      "2023-04-01": "Aggiunto Adalimumab 40 mg s.c. ogni 2 settimane. Screening TBC eseguito.",
      "2024-04-01": "Sospeso Adalimumab; avviato Secukinumab 300 mg mensile. Controllo a 3 mesi.",
    };
    const drafts = Object.entries(texts).map(([date, t]) => ({
      date,
      visitType: "follow_up",
      label: `Visita ${date}`,
      selected: ALL_SELECTED,
      draft: {
        visit_date: date,
        visit_type: "follow_up",
        visit_sections: { anamnesi: `controllo ${date}`, esame_obj: `EO ${date}`, terapia_uscita: t },
      },
    }));

    await applyDraftBatch(drafts, basePatient(), { defaultVisitType: "follow_up" });

    expect(workupVisitsApi.create).toHaveBeenCalledTimes(3);
    const byDate = {};
    workupVisitsApi.create.mock.calls.forEach((c) => {
      byDate[c[1].visit_date] = c[1].exit_therapy_text;
    });
    expect(byDate).toEqual(texts);
  });
});
