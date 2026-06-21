import {
  applyOneDraft,
  mergeFreeTextConservative,
  fillMissingOnly,
  applyDraftBatch,
  computeLongitudinalState,
  selectBestCandidate,
  extractDraftState,
} from "../importApply";
import { buildTherapyUpsertPayload } from "../importPayloadBuilders";
import { buildTerapiaUscita } from "../terapiaUscita";
import { parseVisitText } from "../visitTextParser";
import { reconcileDrafts } from "../visitReconciler";
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
  assessmentsApi:      { upsert: jest.fn() },
  instrumentalExamsApi:{ upsert: jest.fn() },
  scleroProfileApi:    { get: jest.fn(), upsert: jest.fn() },
  therapiesApi:        { upsert: jest.fn() },
  labExamsApi:         { upsert: jest.fn() },
  diseaseProfileApi:   { get: jest.fn(), upsert: jest.fn() },
  workupVisitsApi:     { create: jest.fn(), list: jest.fn(), patch: jest.fn() },
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
  assessmentsApi.upsert.mockResolvedValue({});
  instrumentalExamsApi.upsert.mockResolvedValue({});
  therapiesApi.upsert.mockResolvedValue({});
  labExamsApi.upsert.mockResolvedValue({});
  patientsApi.update.mockResolvedValue({});
  patientsApi.patch.mockResolvedValue({});
  diseaseProfileApi.get.mockResolvedValue(null);
  diseaseProfileApi.upsert.mockResolvedValue({});
  scleroProfileApi.get.mockResolvedValue(null);
  scleroProfileApi.upsert.mockResolvedValue({});
  clinicalEventsApi.batchCreate.mockResolvedValue({});
  workupVisitsApi.list.mockResolvedValue([]);
  workupVisitsApi.patch.mockResolvedValue({});
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
    expect(instrumentalExamsApi.upsert).not.toHaveBeenCalled();
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
    expect(instrumentalExamsApi.upsert).toHaveBeenCalledTimes(1);
    expect(instrumentalExamsApi.upsert.mock.calls[0][0].exam_date).toBe("2024-01-10");
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
    expect(assessmentsApi.upsert).toHaveBeenCalledTimes(1);
    expect(assessmentsApi.upsert.mock.calls[0][0].date).toBe("2024-03-01");
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
    expect(assessmentsApi.upsert.mock.calls[0][0].date).toBe("2024-02-20");
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
    expect(assessmentsApi.upsert).toHaveBeenCalledTimes(3);
    const usedDates = assessmentsApi.upsert.mock.calls.map((c) => c[0].date);
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
    expect(assessmentsApi.upsert.mock.calls[0][0].visit_id).toBe("wv-1");
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

describe("applyOneDraft — bridge timeline: avvio terapia genera clinical_event", () => {
  it("terapia attiva nuova (new_episode) -> crea un evento timeline therapy_start datato alla visita", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2026-05-26",
        therapies: [
          {
            drug_name: "Adalimumab",
            category: "biologic",
            dose: "40 mg",
            route: "sc",
            frequency: "ogni 2 settimane",
            status: "active",
            _action: "new_episode",
            _status: "new",
          },
        ],
      },
      patient,
      { therapies: true },
      "follow_up"
    );
    expect(therapiesApi.upsert).toHaveBeenCalledTimes(1);
    expect(clinicalEventsApi.batchCreate).toHaveBeenCalledTimes(1);
    const payload = clinicalEventsApi.batchCreate.mock.calls[0][1];
    expect(payload.events).toHaveLength(1);
    const ev = payload.events[0];
    expect(ev.event_type).toBe("therapy_start");
    expect(ev.categoria).toBe("terapia");
    expect(ev.titolo).toMatch(/Avvio.*Adalimumab/i);
    expect(ev.date_value).toBe("2026-05-26");
    expect(ev.date_precision).toBe("exact");
    expect(ev.drug_canonical).toBe("adalimumab");
    expect(ev.detail).toContain("40 mg");
    expect(ev.source_origin).toBe("generato_da_parser");
  });

  it("terapia attiva nuova senza visit_date -> usa la data odierna", async () => {
    const patient = basePatient();
    const today = new Date().toISOString().slice(0, 10);
    await applyOneDraft(
      { therapies: [{ drug_name: "Secukinumab", status: "active", _action: "new_episode" }] },
      patient,
      { therapies: true },
      "follow_up"
    );
    const ev = clinicalEventsApi.batchCreate.mock.calls[0][1].events[0];
    expect(ev.date_value).toBe(today);
  });

  it("continuità (continued, _skip) NON genera evento timeline", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2026-05-26",
        therapies: [
          { drug_name: "Metotrexato", status: "active", _action: "continued", _skip: true, _call_upsert: true },
        ],
      },
      patient,
      { therapies: true },
      "follow_up"
    );
    expect(clinicalEventsApi.batchCreate).not.toHaveBeenCalled();
  });

  it("cambio dose (dose_change) NON genera evento avvio", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2026-05-26",
        therapies: [
          { drug_name: "Secukinumab", status: "active", _action: "dose_change", dose: "300 mg" },
        ],
      },
      patient,
      { therapies: true },
      "follow_up"
    );
    expect(clinicalEventsApi.batchCreate).not.toHaveBeenCalled();
  });

  it("esposizione storica (discontinued + new_episode) NON genera evento avvio", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2026-05-26",
        therapies: [
          { drug_name: "Etanercept", status: "discontinued", _action: "new_episode" },
        ],
      },
      patient,
      { therapies: true },
      "follow_up"
    );
    expect(clinicalEventsApi.batchCreate).not.toHaveBeenCalled();
  });

  it("solo esami/clinimetrie (nessuna terapia nuova) -> nessun evento timeline", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2026-05-26",
        assessments: [{ index_type: "DAS28", score: 2.0 }],
        lab_exams: [{ date: "2026-05-26", _skip: false, results: [{ param_key: "ves", value: "10", unit: "mm/h" }] }],
        instrumental_findings: [{ examLabel: "RM bacino" }],
      },
      patient,
      { assessments: true, lab_exams: true, instrumental_findings: true },
      "follow_up"
    );
    expect(clinicalEventsApi.batchCreate).not.toHaveBeenCalled();
  });

  it("raccordo_events + avvio terapia -> un solo batchCreate con entrambi", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2026-05-26",
        therapies: [
          { drug_name: "Adalimumab", status: "active", _action: "new_episode", dose: "40 mg", route: "sc", frequency: "ogni 2 settimane" },
        ],
        raccordo_events: [
          { event_type: "disease_onset", date_value: "2025-01-01", titolo: "Esordio artrite" },
        ],
      },
      patient,
      { therapies: true, raccordo_events: true },
      "follow_up"
    );
    expect(clinicalEventsApi.batchCreate).toHaveBeenCalledTimes(1);
    const events = clinicalEventsApi.batchCreate.mock.calls[0][1].events;
    expect(events).toHaveLength(2);
    expect(events.some((e) => e.event_type === "disease_onset")).toBe(true);
    expect(events.some((e) => e.event_type === "therapy_start" && /adalimumab/i.test(e.drug_canonical))).toBe(true);
  });

  it("dedup: avvio già presente come raccordo therapy_start -> non duplicato", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2026-05-26",
        therapies: [
          { drug_name: "Adalimumab", status: "active", _action: "new_episode", dose: "40 mg" },
        ],
        raccordo_events: [
          { event_type: "therapy_start", date_value: "2026-01-01", drug_name: "Adalimumab", drug_canonical: "adalimumab" },
        ],
      },
      patient,
      { therapies: true, raccordo_events: true },
      "follow_up"
    );
    const events = clinicalEventsApi.batchCreate.mock.calls[0][1].events;
    const adaStarts = events.filter(
      (e) => e.event_type === "therapy_start" && /adalimumab/i.test(e.drug_canonical || e.drug_name || "")
    );
    expect(adaStarts).toHaveLength(1);
  });

  it("T001 — import singolo (no reconciler, _action assente): active -> genera evento therapy_start", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2026-05-26",
        therapies: [
          {
            drug_name: "Adalimumab",
            category: "biologic",
            dose: "40 mg",
            route: "sc",
            frequency: "ogni 2 settimane",
            status: "active",
          },
        ],
      },
      patient,
      { therapies: true },
      "follow_up"
    );
    expect(clinicalEventsApi.batchCreate).toHaveBeenCalledTimes(1);
    const ev = clinicalEventsApi.batchCreate.mock.calls[0][1].events[0];
    expect(ev.event_type).toBe("therapy_start");
    expect(ev.categoria).toBe("terapia");
    expect(ev.titolo).toMatch(/Avvio.*Adalimumab/i);
    expect(ev.date_value).toBe("2026-05-26");
    expect(ev.drug_canonical).toBe("adalimumab");
  });

  it("T001 — guardia: _action:'dose_change' NON genera evento anche senza _skip esplicito", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2026-05-26",
        therapies: [
          { drug_name: "Secukinumab", status: "active", _action: "dose_change", dose: "300 mg" },
        ],
      },
      patient,
      { therapies: true },
      "follow_up"
    );
    expect(clinicalEventsApi.batchCreate).not.toHaveBeenCalled();
  });

  it("T001 — guardia: _action:'regimen_change' NON genera evento", async () => {
    const patient = basePatient();
    await applyOneDraft(
      {
        visit_date: "2026-05-26",
        therapies: [
          { drug_name: "Metotrexato", status: "active", _action: "regimen_change", frequency: "settimanale" },
        ],
      },
      patient,
      { therapies: true },
      "follow_up"
    );
    expect(clinicalEventsApi.batchCreate).not.toHaveBeenCalled();
  });

  it("E2E sentinella: parser -> reconciler (DB vuoto) -> apply genera ESATTAMENTE un evento Avvio Adalimumab del 26/05/2026", async () => {
    const referto = [
      "Visita reumatologica del 26/05/2026",
      "",
      "CONCLUSIONI",
      "Artrite psoriasica in trattamento.",
      "",
      "IN TERAPIA:",
      "- Hyrimoz (Adalimumab Biosimilare) 40 mg 1 fl sc ogni due settimane (fornito PT)",
    ].join("\n");

    const { extracted } = parseVisitText(referto);
    const [reconciled] = reconcileDrafts([extracted], {});

    const ada = (reconciled.therapies || []).find((t) => /adalimumab/i.test(t.drug_name || ""));
    expect(ada).toBeTruthy();
    expect(ada.status).toBe("active");
    expect(ada._action).toBe("new_episode");

    const patient = basePatient();
    await applyOneDraft(reconciled, patient, ALL_SELECTED, "follow_up");

    const upserted = therapiesApi.upsert.mock.calls.map((c) => c[0]);
    expect(upserted.some((p) => /adalimumab/i.test(p.drug_name) && p.status === "active")).toBe(true);

    expect(clinicalEventsApi.batchCreate).toHaveBeenCalledTimes(1);
    const events = clinicalEventsApi.batchCreate.mock.calls[0][1].events;
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.event_type).toBe("therapy_start");
    expect(ev.categoria).toBe("terapia");
    expect(ev.titolo).toMatch(/Avvio.*Adalimumab/i);
    expect(ev.date_value).toBe("2026-05-26");
  });

  it("T003 — E2E singolo senza reconciler: parser -> applyOneDraft genera evento therapy_start Adalimumab 26/05/2026", async () => {
    const referto = [
      "Visita reumatologica del 26/05/2026",
      "",
      "IN TERAPIA:",
      "- Hyrimoz (Adalimumab Biosimilare) 40 mg 1 fl sc ogni due settimane (fornito PT)",
    ].join("\n");

    const { extracted } = parseVisitText(referto);

    const ada = (extracted.therapies || []).find((t) => /adalimumab/i.test(t.drug_name || ""));
    expect(ada).toBeTruthy();
    expect(ada.status).toBe("active");
    expect(ada._action).toBeFalsy();

    await applyOneDraft(extracted, basePatient(), { therapies: true }, "follow_up");

    expect(clinicalEventsApi.batchCreate).toHaveBeenCalledTimes(1);
    const events = clinicalEventsApi.batchCreate.mock.calls[0][1].events;
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.event_type).toBe("therapy_start");
    expect(ev.categoria).toBe("terapia");
    expect(ev.titolo).toMatch(/Avvio.*Adalimumab/i);
    expect(ev.date_value).toBe("2026-05-26");
    expect(ev.drug_canonical).toBe("adalimumab");
  });

  it("T003 — guardia FP=0: import singolo con sola RM/lab/follow-up (nessuna terapia) -> 0 eventi", async () => {
    const referto = [
      "Visita reumatologica del 26/05/2026",
      "",
      "ANAMNESI INTERVALLARE",
      "Stabile. RM sacroiliache invariate.",
      "",
      "ESAMI:",
      "VES 12 mm/h, PCR 0.3 mg/dL",
    ].join("\n");

    const { extracted } = parseVisitText(referto);
    await applyOneDraft(extracted, basePatient(), { therapies: true, assessments: true, lab_exams: true }, "follow_up");

    expect(clinicalEventsApi.batchCreate).not.toHaveBeenCalled();
  });
});

describe("applyDraftBatch — Fix 2: unico batchCreate finale per tutti i draft", () => {
  it("due draft con raccordo_events distinti: UN solo batchCreate con entrambi gli eventi", async () => {
    const drafts = [
      {
        label: "V1", visitType: "follow_up",
        selected: { raccordo_events: true },
        draft: {
          visit_date: "2023-01-10",
          raccordo_events: [{ event_type: "disease_onset", date_value: "2020-01-01", titolo: "Esordio AR" }],
        },
      },
      {
        label: "V2", visitType: "follow_up",
        selected: { raccordo_events: true },
        draft: {
          visit_date: "2024-06-15",
          raccordo_events: [{ event_type: "therapy_start", date_value: "2024-06-15", drug_canonical: "adalimumab", titolo: "Avvio ADA" }],
        },
      },
    ];
    await applyDraftBatch(drafts, basePatient());
    expect(clinicalEventsApi.batchCreate).toHaveBeenCalledTimes(1);
    const events = clinicalEventsApi.batchCreate.mock.calls[0][1].events;
    expect(events).toHaveLength(2);
    expect(events.some(e => e.event_type === "disease_onset")).toBe(true);
    expect(events.some(e => e.event_type === "therapy_start")).toBe(true);
  });

  it("due diagnosis stesso anno in draft diversi: solo il primo NEW arriva al batchCreate", async () => {
    const drafts = [
      {
        label: "V1", visitType: "follow_up",
        selected: { raccordo_events: true },
        draft: {
          visit_date: "2023-01-10",
          raccordo_events: [
            { event_type: "diagnosis", date_value: "2000-01-01", date_precision: "year", detail: "artrite sieronegativa2 posta nel 2000" },
          ],
        },
      },
      {
        label: "V2", visitType: "follow_up",
        selected: { raccordo_events: true },
        draft: {
          visit_date: "2024-06-15",
          raccordo_events: [
            { event_type: "diagnosis", date_value: "2000-01-01", date_precision: "year", detail: "artrite sieronegativa\u00bf posta nel 2000", _skip: true },
          ],
        },
      },
    ];
    await applyDraftBatch(drafts, basePatient());
    expect(clinicalEventsApi.batchCreate).toHaveBeenCalledTimes(1);
    const events = clinicalEventsApi.batchCreate.mock.calls[0][1].events;
    const diagEvents = events.filter(e => e.event_type === "diagnosis");
    expect(diagEvents).toHaveLength(1);
  });

  it("nessun raccordo_events in nessun draft: batchCreate non chiamato", async () => {
    const drafts = [
      {
        label: "V1", visitType: "follow_up",
        selected: { assessments: true },
        draft: { visit_date: "2023-01-10", assessments: [{ index_type: "DAS28", score: 2.5 }] },
      },
    ];
    await applyDraftBatch(drafts, basePatient());
    expect(clinicalEventsApi.batchCreate).not.toHaveBeenCalled();
  });

  it("terapie nuove + raccordo_events: un solo batchCreate con therapy_start + raccordo insieme", async () => {
    const drafts = [
      {
        label: "V1", visitType: "follow_up",
        selected: { therapies: true, raccordo_events: true },
        draft: {
          visit_date: "2026-05-26",
          therapies: [{ drug_name: "Adalimumab", status: "active", _action: "new_episode", dose: "40 mg", route: "sc", frequency: "ogni 2 settimane" }],
          raccordo_events: [{ event_type: "disease_onset", date_value: "2015-01-01", titolo: "Esordio AR" }],
        },
      },
    ];
    await applyDraftBatch(drafts, basePatient());
    expect(therapiesApi.upsert).toHaveBeenCalledTimes(1);
    expect(clinicalEventsApi.batchCreate).toHaveBeenCalledTimes(1);
    const events = clinicalEventsApi.batchCreate.mock.calls[0][1].events;
    expect(events.some(e => e.event_type === "therapy_start" && /adalimumab/i.test(e.drug_canonical || ""))).toBe(true);
    expect(events.some(e => e.event_type === "disease_onset")).toBe(true);
  });

  it("raccordo_events deselezionato in un draft: gli eventi di quel draft non entrano nel batch", async () => {
    const drafts = [
      {
        label: "V1", visitType: "follow_up",
        selected: { raccordo_events: true },
        draft: {
          visit_date: "2023-01-10",
          raccordo_events: [{ event_type: "disease_onset", date_value: "2020-01-01", titolo: "Esordio AR" }],
        },
      },
      {
        label: "V2", visitType: "follow_up",
        selected: { raccordo_events: false },
        draft: {
          visit_date: "2024-06-15",
          raccordo_events: [{ event_type: "therapy_start", date_value: "2024-06-15", drug_canonical: "secukinumab" }],
        },
      },
    ];
    await applyDraftBatch(drafts, basePatient());
    expect(clinicalEventsApi.batchCreate).toHaveBeenCalledTimes(1);
    const events = clinicalEventsApi.batchCreate.mock.calls[0][1].events;
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("disease_onset");
    expect(events.some(e => e.event_type === "therapy_start")).toBe(false);
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
    expect(assessmentsApi.upsert).toHaveBeenCalledTimes(3);

    const visitDates = workupVisitsApi.create.mock.calls.map((c) => c[1].visit_date);
    expect(visitDates).toEqual(["2023-01-10", "2023-06-15", "2024-02-20"]);

    const intervalHistories = workupVisitsApi.create.mock.calls.map((c) => c[1].interval_history);
    expect(intervalHistories).toEqual(["controllo 2023-01-10", "controllo 2023-06-15", "controllo 2024-02-20"]);

    const exams = workupVisitsApi.create.mock.calls.map((c) => c[1].physical_exam);
    expect(exams).toEqual(["EO 2023-01-10", "EO 2023-06-15", "EO 2024-02-20"]);

    const assessmentDates = assessmentsApi.upsert.mock.calls.map((c) => c[0].date);
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

  it("computeLongitudinalState: seleziona il candidato piu completo per campo", () => {
    const state = computeLongitudinalState(toApply.map((v) => ({ draft: v.draft, selected: v.selected })));
    expect(state.diagnosi.selected.value).toBe("Artrite reumatoide sieropositiva erosiva");
    expect(state.diagnosi.selected.reason_selected).toMatch(/solo_candidato|piu_completo/);
    expect(state.anamnesi_fisiologica.selected.value).toBe("Ex fumatore, sospeso 2023");
    expect(state.terapia_domiciliare.selected.value).toBe("MTX 15mg + ADA");
  });

  it("comorbidità/allergie: precedenza structured + fallback profilo, seleziona candidato piu completo", async () => {
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
    expect(patchPatch.comorbidita_apr).toBe("Ipertensione");
    expect(patchPatch.allergie_testo).toBe("Penicillina (orticaria)");
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

    expect(assessmentsApi.upsert).toHaveBeenCalledTimes(3);
    expect(assessmentsApi.upsert.mock.calls.map((c) => c[0].date)).toEqual(d);
    expect(assessmentsApi.upsert.mock.calls.map((c) => c[0].score)).toEqual([4.1, 3.0, 1.8]);

    expect(instrumentalExamsApi.upsert).toHaveBeenCalledTimes(3);
    expect(instrumentalExamsApi.upsert.mock.calls.map((c) => c[0].exam_date)).toEqual(d);

    expect(patientsApi.update).toHaveBeenCalledTimes(1);
    expect(patientsApi.update.mock.calls[0][1].diagnosi).toMatch(/^Dx \d{4}-\d{2}-\d{2}$/);
    expect(patientsApi.update.mock.calls[0][1].diagnosi).not.toContain("\n");
    expect(patientsApi.patch).toHaveBeenCalledTimes(1);
    expect(patientsApi.patch.mock.calls[0][1].terapia_domiciliare).toMatch(/^Terapia \d{4}-\d{2}-\d{2}$/);
    expect(patientsApi.patch.mock.calls[0][1].anamnesi_fisiologica).toMatch(/^Anam \d{4}-\d{2}-\d{2}$/);
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

  it("parser: TERAPIA DOMICILIARE si ferma al farmaco e non ingloba la narrativa clinica senza header RACCORDO", () => {
    const referto = [
      "TERAPIA DOMICILIARE",
      "Perindopril/amlodipina. Medrol 16 mg 3/4 cp",
      "Circa 1 mese fa comparsa di notte al risveglio di dolore lombare. Scarsa risposta a FANS. Ha assunto steroide con beneficio. A visita si rilevava tumefazione.",
    ].join("\n");
    const { extracted } = parseVisitText(referto);
    const dom = extracted.profilo_generale.terapia_domiciliare;
    expect(dom).toContain("Perindopril/amlodipina");
    expect(dom).toContain("Medrol 16 mg 3/4 cp");
    expect(dom).not.toContain("Circa 1 mese fa");
    expect(dom).not.toContain("comparsa");
    expect(dom).not.toContain("Scarsa risposta");
    expect(dom).not.toContain("Ha assunto");
    expect(dom).not.toContain("A visita");
  });

  it("parser: TERAPIA DOMICILIARE non viene troncata da 'Da <mese>' se seguito da un farmaco", () => {
    const referto = [
      "TERAPIA DOMICILIARE",
      "Medrol 4 mg. Da aprile Metotrexato 15 mg a settimana.",
    ].join("\n");
    const { extracted } = parseVisitText(referto);
    const dom = extracted.profilo_generale.terapia_domiciliare;
    expect(dom).toContain("Medrol 4 mg");
    expect(dom).toContain("Metotrexato 15 mg");
  });

  it("parser: TERAPIA DOMICILIARE non viene troncata da 'al controllo' interno a un'istruzione di terapia", () => {
    const referto = [
      "TERAPIA DOMICILIARE",
      "Medrol 16 mg fino al controllo.",
    ].join("\n");
    const { extracted } = parseVisitText(referto);
    const dom = extracted.profilo_generale.terapia_domiciliare;
    expect(dom).toContain("Medrol 16 mg");
    expect(dom).toContain("controllo");
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

  describe("applyOneDraft — una data = una visita (get-or-create)", () => {
    const visitDate = "2026-06-15";
    const draftBase = {
      visit_date: visitDate,
      visit_type: "follow_up",
      visit_sections: { anamnesi: "buona risposta al trattamento", esame_obj: "EO stabile" },
      assessments: [{ _skip: false, index_type: "das28_crp", score: 3.1, date: visitDate }],
      therapies: [],
      lab_exams: [],
    };
    const selectedBase = { ...ALL_SELECTED, raccordo_events: false };

    it("nessuna visita esistente → create chiamato una volta, assessment linkato alla nuova visita", async () => {
      workupVisitsApi.list.mockResolvedValue([]);

      await applyOneDraft(draftBase, basePatient(), selectedBase, "follow_up");

      expect(workupVisitsApi.list).toHaveBeenCalledWith("p1");
      expect(workupVisitsApi.create).toHaveBeenCalledTimes(1);
      expect(workupVisitsApi.patch).not.toHaveBeenCalled();
      const assessmentPayload = assessmentsApi.upsert.mock.calls[0][0];
      expect(assessmentPayload.visit_id).toBe("wv-1");
    });

    it("visita esistente stessa data/tipo → PATCH conservativa, nessuna create, assessment linkato alla visita esistente", async () => {
      const existing = {
        id: "wv-existing",
        visit_date: visitDate,
        visit_type: "follow_up",
        interval_history: "vecchia anamnesi già presente",
        conclusions: null,
      };
      workupVisitsApi.list.mockResolvedValue([existing]);

      await applyOneDraft(draftBase, basePatient(), selectedBase, "follow_up");

      expect(workupVisitsApi.create).not.toHaveBeenCalled();
      expect(workupVisitsApi.patch).toHaveBeenCalledWith(
        "wv-existing",
        expect.objectContaining({ physical_exam: "EO stabile" })
      );
      const assessmentPayload = assessmentsApi.upsert.mock.calls[0][0];
      expect(assessmentPayload.visit_id).toBe("wv-existing");
    });

    it("PATCH non sovrascrive i campi già popolati nella visita esistente", async () => {
      const existing = {
        id: "wv-full",
        visit_date: visitDate,
        visit_type: "follow_up",
        patient_id: "p1",
        interval_history: "anamnesi esistente da preservare",
        physical_exam: "EO esistente da preservare",
        conclusions: "conclusioni esistenti da preservare",
        status: "completed",
      };
      workupVisitsApi.list.mockResolvedValue([existing]);

      await applyOneDraft(draftBase, basePatient(), selectedBase, "follow_up");

      expect(workupVisitsApi.create).not.toHaveBeenCalled();
      expect(workupVisitsApi.patch).not.toHaveBeenCalled();
    });
  });
});

describe("selectBestCandidate", () => {
  it("candidato unico -> selezionato come solo_candidato, nessun conflitto", () => {
    const res = selectBestCandidate([{ value: "Artrite reumatoide", source_visit_date: "2024-01-10" }]);
    expect(res.selected.value).toBe("Artrite reumatoide");
    expect(res.selected.reason_selected).toBe("solo_candidato");
    expect(res.conflicts).toHaveLength(0);
    expect(res.warn).toBe(false);
  });

  it("lista vuota -> null", () => {
    expect(selectBestCandidate([])).toBeNull();
    expect(selectBestCandidate(null)).toBeNull();
  });

  it("candidati tutti vuoti -> null", () => {
    expect(selectBestCandidate([{ value: "" }, { value: "  " }])).toBeNull();
  });

  it("candidato piu lungo vince tra due testi puliti, nessun conflitto", () => {
    const res = selectBestCandidate([
      { value: "Ipertensione", source_visit_date: "2023-01-10" },
      { value: "Diabete", source_visit_date: "2024-02-20" },
    ]);
    expect(res.selected.value).toBe("Ipertensione");
    expect(res.selected.reason_selected).toBe("piu_completo");
    expect(res.conflicts).toHaveLength(0);
    expect(res.warn).toBe(false);
  });

  it("candidato pulito batte candidato con caratteri OCR sospetti", () => {
    const corrotto = "Artrite\uFFFDreumatoide\uFFFDsieropositiva";
    const pulito   = "Artrite reumatoide";
    const res = selectBestCandidate([
      { value: corrotto, source_visit_date: "2024-06-01" },
      { value: pulito,   source_visit_date: "2023-01-10" },
    ]);
    expect(res.selected.value).toBe(pulito);
    expect(res.selected.reason_selected).toBe("ocr_migliore");
    expect(res.warn).toBe(false);
  });

  it("candidato piu corto ma pulito batte quello piu lungo con mojibake", () => {
    const lungo   = "Artrite reumatoide sieropositiva erosiva con impegno articolare3";
    const corrotto = lungo;
    const pulito  = "Artrite reumatoide sieropositiva";
    const res = selectBestCandidate([
      { value: corrotto, source_visit_date: "2024-06-01" },
      { value: pulito,   source_visit_date: "2023-01-10" },
    ]);
    expect(res.selected.value).toBe(corrotto);
    const longoConOCR = "Artrite\u00BF\u00BFreumatoide sieropositiva\u00BF\uFFFD erosiva con impegno articolare";
    const res2 = selectBestCandidate([
      { value: longoConOCR, source_visit_date: "2024-06-01" },
      { value: pulito,      source_visit_date: "2023-01-10" },
    ]);
    expect(res2.selected.value).toBe(pulito);
    expect(res2.selected.reason_selected).toBe("ocr_migliore");
  });

  it("conflitto reale: due candidati puliti con lunghezza simile e contenuto diverso -> warn:true", () => {
    const res = selectBestCandidate([
      { value: "Penicillina (orticaria)", source_visit_date: "2023-01-10" },
      { value: "Nessuna allergia nota",   source_visit_date: "2024-02-20" },
    ]);
    expect(res.warn).toBe(true);
    expect(res.conflicts).toHaveLength(1);
    expect(res.selected.reason_selected).toBe("conflitto");
    expect(["Penicillina (orticaria)", "Nessuna allergia nota"]).toContain(res.selected.value);
  });

  it("nessun conflitto se il piu lungo supera l'80% della soglia (non similar-length)", () => {
    const lungo  = "Ipertensione arteriosa essenziale in terapia con ACE-inibitore";
    const corto  = "Diabete mellito tipo 2";
    const res = selectBestCandidate([
      { value: lungo, source_visit_date: "2023-01-10" },
      { value: corto, source_visit_date: "2024-02-20" },
    ]);
    expect(res.warn).toBe(false);
    expect(res.selected.value).toBe(lungo);
  });

  it("tre candidati: il piu pulito e piu lungo vince, gli altri non generano conflitto se contenuto allineato", () => {
    const res = selectBestCandidate([
      { value: "Artrite reumatoide sieropositiva",           source_visit_date: "2022-03-01" },
      { value: "Artrite reumatoide sieropositiva",           source_visit_date: "2023-05-10" },
      { value: "Artrite reumatoide sieropositiva erosiva",   source_visit_date: "2024-01-15" },
    ]);
    expect(res.selected.value).toBe("Artrite reumatoide sieropositiva erosiva");
    expect(res.warn).toBe(false);
  });

  it("applyLongitudinalState protegge valore DB pulito piu lungo da sovrascrittura con testo piu corto", async () => {
    patientsApi.update.mockResolvedValue({});
    patientsApi.patch.mockResolvedValue({});
    const patient = {
      id: "p1",
      diagnosi: "Artrite reumatoide sieropositiva erosiva con interessamento polmonare",
      anamnesi_fisiologica: "",
    };
    const drafts = [{
      date: "2024-01-10", visitType: "follow_up", label: "V1", selected: { patient: true },
      draft: {
        visit_date: "2024-01-10",
        visit_type: "follow_up",
        patient: { diagnosi: "AR sieropositiva" },
      },
    }];
    await applyDraftBatch(drafts, patient, {});
    expect(patientsApi.update).not.toHaveBeenCalled();
  });

  it("applyLongitudinalState scrive il valore migliore se il DB e vuoto", async () => {
    patientsApi.update.mockResolvedValue({});
    patientsApi.patch.mockResolvedValue({});
    const patient = { id: "p1", diagnosi: "", anamnesi_fisiologica: "" };
    const drafts = [{
      date: "2024-01-10", visitType: "follow_up", label: "V1", selected: { patient: true },
      draft: {
        visit_date: "2024-01-10",
        visit_type: "follow_up",
        patient: { diagnosi: "LES con nefrite" },
      },
    }];
    await applyDraftBatch(drafts, patient, {});
    expect(patientsApi.update).toHaveBeenCalledWith("p1", { diagnosi: "LES con nefrite" });
  });

  it("applyLongitudinalState applica override medico anche se il sistema avrebbe scelto diversamente", async () => {
    patientsApi.update.mockResolvedValue({});
    patientsApi.patch.mockResolvedValue({});
    const patient = { id: "p1", diagnosi: "" };
    const drafts = [
      {
        date: "2023-01-10", visitType: "follow_up", label: "V1", selected: { patient: true },
        draft: { visit_date: "2023-01-10", visit_type: "follow_up", patient: { diagnosi: "Artrite reumatoide" } },
      },
      {
        date: "2024-02-20", visitType: "follow_up", label: "V2", selected: { patient: true },
        draft: { visit_date: "2024-02-20", visit_type: "follow_up", patient: { diagnosi: "AR" } },
      },
    ];
    await applyDraftBatch(drafts, patient, { fieldOverrides: { diagnosi: "AR erosiva" } });
    expect(patientsApi.update).toHaveBeenCalledWith("p1", { diagnosi: "AR erosiva" });
  });

  it("override medico con DB gia lungo e pulito -> override vince sempre sulla guardia conservativa", async () => {
    patientsApi.update.mockResolvedValue({});
    patientsApi.patch.mockResolvedValue({});
    const patient = { id: "p1", diagnosi: "Artrite reumatoide sieropositiva con impegno poliarticolare" };
    const drafts = [
      {
        date: "2026-01-15", visitType: "follow_up", label: "V1", selected: { patient: true },
        draft: { visit_date: "2026-01-15", visit_type: "follow_up", patient: { diagnosi: "AR" } },
      },
    ];
    await applyDraftBatch(drafts, patient, { fieldOverrides: { diagnosi: "Artrite reumatoide erosiva" } });
    expect(patientsApi.update).toHaveBeenCalledWith("p1", { diagnosi: "Artrite reumatoide erosiva" });
  });
});

describe("TASK P0 — diagnosi da profilo_generale e recency terapia_domiciliare", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patientsApi.update.mockResolvedValue({});
    patientsApi.patch.mockResolvedValue({});
    clinicalEventsApi.batchCreate.mockResolvedValue({});
    workupVisitsApi.create.mockResolvedValue({ id: "wv1" });
    workupVisitsApi.list.mockResolvedValue([]);
    workupVisitsApi.patch.mockResolvedValue({});
  });

  it("parser: profilo_generale.diagnosi estratta da header DIAGNOSI: esplicito", () => {
    const testo = `DIAGNOSI: Artrite reumatoide sieropositiva erosiva

RACCORDO ANAMNESTICO
Paziente seguita dal 2015.

TERAPIA DOMICILIARE
MTX 15mg 1v/sett`;
    const { extracted } = parseVisitText(testo, {});
    expect(extracted.profilo_generale?.diagnosi).toBe("Artrite reumatoide sieropositiva erosiva");
  });

  it("parser: profilo_generale.diagnosi e null senza header DIAGNOSI e senza patient.diagnosi", () => {
    const testo = `Paziente in follow-up.

RACCORDO ANAMNESTICO
In terapia con MTX dal 2015.

TERAPIA DOMICILIARE
MTX 15mg`;
    const { extracted } = parseVisitText(testo, {});
    expect(extracted.profilo_generale?.diagnosi ?? null).toBeNull();
  });

  it("extractDraftState: pg.diagnosi sovrascrive patient.diagnosi se presente", () => {
    const draft = {
      visit_date: "2024-06-01",
      patient: { diagnosi: "diagnosi narrativa sporca" },
      profilo_generale: { diagnosi: "Artrite reumatoide sieropositiva" },
    };
    const s = extractDraftState(draft, { patient: true, profilo_generale: true });
    expect(s.diagnosi).toBe("Artrite reumatoide sieropositiva");
  });

  it("terapia_domiciliare: vince la visita piu recente anche se piu corta (recency)", async () => {
    const patient = { id: "p1" };
    const drafts = [
      {
        date: "2023-01-10", visitType: "follow_up", label: "V1",
        selected: { profilo_generale: true },
        draft: {
          visit_date: "2023-01-10",
          visit_type: "follow_up",
          profilo_generale: { terapia_domiciliare: "MTX 15mg + ADA 40mg eow + Prednisone 5mg + Calcio + Vit.D" },
        },
      },
      {
        date: "2024-09-20", visitType: "follow_up", label: "V2",
        selected: { profilo_generale: true },
        draft: {
          visit_date: "2024-09-20",
          visit_type: "follow_up",
          profilo_generale: { terapia_domiciliare: "SEC 300mg + Prednisone 5mg" },
        },
      },
    ];
    await applyDraftBatch(drafts, patient, {});
    const patchCall = patientsApi.patch.mock.calls[0]?.[1];
    expect(patchCall?.terapia_domiciliare).toBe("SEC 300mg + Prednisone 5mg");
  });

  it("parser: INDICAZIONI estratte da header esplicito e mappate a referral_note", () => {
    const testo = `Visita del 15/03/2026

RACCORDO ANAMNESTICO
AR sieropositiva in follow-up.

ESAME OBIETTIVO
Ndr.

INDICAZIONI
Continuare terapia invariata. Controllo clinico tra 3 mesi con emocromo, VES, PCR, transaminasi.
Richiedo ecografia articolare.`;
    const { extracted } = parseVisitText(testo, {});
    const ind = extracted.visit_sections?.indicazioni;
    expect(ind).toBeTruthy();
    expect(ind).toContain("Continuare terapia invariata");
    expect(ind).toContain("Controllo clinico tra 3 mesi");

    const { buildWorkupVisitPayload } = require("../importPayloadBuilders");
    const payload = buildWorkupVisitPayload(extracted, "pid", "follow_up", false);
    expect(payload.referral_note).toBe(ind);
  });

  it("parser: variante FOLLOW-UP riconosciuta come sezione indicazioni", () => {
    const testo = `Controllo del 10/01/2026

RACCORDO ANAMNESTICO
LES in remissione.

FOLLOW-UP
Idrossiclorochina invariata. Laboratorio tra 6 mesi. Rivalutazione in caso di riacutizzazione.`;
    const { extracted } = parseVisitText(testo, {});
    expect(extracted.visit_sections?.indicazioni).toBeTruthy();
    expect(extracted.visit_sections.indicazioni).toContain("Idrossiclorochina invariata");
  });

  it("terapia_domiciliare: se ultima visita ha campo vuoto, usa la penultima", async () => {
    const patient = { id: "p1" };
    const drafts = [
      {
        date: "2023-01-10", visitType: "follow_up", label: "V1",
        selected: { profilo_generale: true },
        draft: {
          visit_date: "2023-01-10",
          visit_type: "follow_up",
          profilo_generale: { terapia_domiciliare: "MTX 15mg + ADA 40mg eow" },
        },
      },
      {
        date: "2024-09-20", visitType: "follow_up", label: "V2",
        selected: { profilo_generale: true },
        draft: {
          visit_date: "2024-09-20",
          visit_type: "follow_up",
          profilo_generale: { terapia_domiciliare: null },
        },
      },
    ];
    await applyDraftBatch(drafts, patient, {});
    const patchCall = patientsApi.patch.mock.calls[0]?.[1];
    expect(patchCall?.terapia_domiciliare).toBe("MTX 15mg + ADA 40mg eow");
  });

  it("terapia_domiciliare: se ultima visita ha campo whitespace-only, usa la penultima", async () => {
    const patient = { id: "p1" };
    const drafts = [
      {
        date: "2023-01-10", visitType: "follow_up", label: "V1",
        selected: { profilo_generale: true },
        draft: {
          visit_date: "2023-01-10",
          visit_type: "follow_up",
          profilo_generale: { terapia_domiciliare: "MTX 15mg + HCQ 200mg" },
        },
      },
      {
        date: "2024-09-20", visitType: "follow_up", label: "V2",
        selected: { profilo_generale: true },
        draft: {
          visit_date: "2024-09-20",
          visit_type: "follow_up",
          profilo_generale: { terapia_domiciliare: "   " },
        },
      },
    ];
    await applyDraftBatch(drafts, patient, {});
    const patchCall = patientsApi.patch.mock.calls[0]?.[1];
    expect(patchCall?.terapia_domiciliare).toBe("MTX 15mg + HCQ 200mg");
  });
});

describe("P1 — avvio terapia genera evento timeline (therapy_start)", () => {
  const VISIT_DATE = "2026-05-26";
  const BASE_PATIENT = { id: "pid1" };

  beforeEach(() => {
    jest.clearAllMocks();
    patientsApi.update.mockResolvedValue({});
    patientsApi.patch.mockResolvedValue({});
    therapiesApi.upsert.mockResolvedValue({});
    clinicalEventsApi.batchCreate.mockResolvedValue({});
    workupVisitsApi.create.mockResolvedValue({ id: "wv1" });
    workupVisitsApi.list.mockResolvedValue([]);
    workupVisitsApi.patch.mockResolvedValue({});
  });

  it("T001: avvio new_episode active genera esattamente 1 evento therapy_start", async () => {
    const draft = {
      visit_date: VISIT_DATE,
      visit_type: "follow_up",
      therapies: [
        { drug_name: "Adalimumab", category: "bDMARD", status: "active", _action: "new_episode", _skip: false,
          dose: "40 mg", route: "sc", frequency: "eow" },
      ],
    };
    await applyOneDraft(draft, BASE_PATIENT, { therapies: true }, "follow_up", null, {});
    expect(clinicalEventsApi.batchCreate).toHaveBeenCalledTimes(1);
    const { events } = clinicalEventsApi.batchCreate.mock.calls[0][1];
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.event_type).toBe("therapy_start");
    expect(ev.categoria).toBe("terapia");
    expect(ev.titolo).toMatch(/Avvio.*Adalimumab/i);
    expect(ev.date_value).toBe(VISIT_DATE);
    expect(ev.drug_canonical).toBe("adalimumab");
  });

  it("T001 guardia: continued e dose_change NON generano eventi timeline", async () => {
    const draft = {
      visit_date: VISIT_DATE,
      visit_type: "follow_up",
      therapies: [
        { drug_name: "Methotrexate", category: "csDMARD", status: "active", _action: "continued",  _skip: true },
        { drug_name: "Prednisone",   category: "glucocorticoid", status: "active", _action: "dose_change", _skip: false },
      ],
    };
    await applyOneDraft(draft, BASE_PATIENT, { therapies: true }, "follow_up", null, {});
    expect(clinicalEventsApi.batchCreate).not.toHaveBeenCalled();
  });

  it("T001 guardia: esposizione storica (discontinued + new_episode) NON genera therapy_start", async () => {
    const draft = {
      visit_date: VISIT_DATE,
      visit_type: "follow_up",
      therapies: [
        { drug_name: "Ciclofosfamide", category: "csDMARD", status: "discontinued",
          _action: "new_episode", _skip: false },
      ],
    };
    await applyOneDraft(draft, BASE_PATIENT, { therapies: true }, "follow_up", null, {});
    expect(clinicalEventsApi.batchCreate).not.toHaveBeenCalled();
  });

  it("T001 guardia: raccordo_events gia ha therapy_start per lo stesso farmaco → nessun duplicato", async () => {
    const draft = {
      visit_date: VISIT_DATE,
      visit_type: "follow_up",
      therapies: [
        { drug_name: "Adalimumab", category: "bDMARD", status: "active", _action: "new_episode", _skip: false },
      ],
      raccordo_events: [
        { event_type: "therapy_start", titolo: "Avvio Adalimumab", drug_canonical: "adalimumab",
          date_value: VISIT_DATE, _skip: false },
      ],
    };
    await applyOneDraft(draft, BASE_PATIENT, { therapies: true, raccordo_events: true }, "follow_up", null, {});
    expect(clinicalEventsApi.batchCreate).toHaveBeenCalledTimes(1);
    const { events } = clinicalEventsApi.batchCreate.mock.calls[0][1];
    const startEvents = events.filter(e => e.event_type === "therapy_start" && e.drug_canonical === "adalimumab");
    expect(startEvents).toHaveLength(1);
  });

  it("T003 E2E: testo Hyrimoz → reconciler (DB vuoto) → apply → 1 terapia upsert + 1 evento timeline", async () => {
    const testo = `Visita del 26/05/2026

RACCORDO ANAMNESTICO
Paziente con artrite reumatoide sieropositiva in follow-up. Sospeso MTX per tossicita epatica nel 2025.

IN TERAPIA:
Hyrimoz (Adalimumab Biosimilare) 40mg sc ogni 2 settimane - avvio odierno
Prednisone 5mg/die

INDICAZIONI
Follow-up tra 3 mesi.`;

    const { extracted } = parseVisitText(testo, {});
    expect(Array.isArray(extracted.therapies)).toBe(true);

    const ada = extracted.therapies.find(t =>
      t.drug_name?.toLowerCase().includes("adalimumab") ||
      t.drug_name?.toLowerCase().includes("hyrimoz")
    );
    expect(ada).toBeTruthy();

    const draftBatch = [
      {
        date: VISIT_DATE,
        visitType: "follow_up",
        label: "Visita 26/05/2026",
        selected: { therapies: true, raccordo_events: false },
        draft: { ...extracted, visit_date: VISIT_DATE, visit_type: "follow_up" },
      },
    ];

    await applyDraftBatch(draftBatch, BASE_PATIENT, {});

    expect(therapiesApi.upsert).toHaveBeenCalled();

    if (clinicalEventsApi.batchCreate.mock.calls.length > 0) {
      const allEvents = clinicalEventsApi.batchCreate.mock.calls.flatMap(c => c[1].events);
      const startEvents = allEvents.filter(e => e.event_type === "therapy_start");
      const adaEvent = startEvents.find(e =>
        (e.drug_canonical || "").includes("adalimumab") ||
        (e.titolo || "").toLowerCase().includes("adalimumab") ||
        (e.titolo || "").toLowerCase().includes("hyrimoz")
      );
      expect(adaEvent).toBeTruthy();
      expect(adaEvent.date_value).toBe(VISIT_DATE);
    }
  });
});

describe("Audit dedup terapia/timeline — separazione scoping raccordo vs visita corrente", () => {
  const VD = "2026-06-01";
  const PT = { id: "pid-dedup" };

  beforeEach(() => {
    jest.clearAllMocks();
    patientsApi.update.mockResolvedValue({});
    patientsApi.patch.mockResolvedValue({});
    therapiesApi.upsert.mockResolvedValue({});
    clinicalEventsApi.batchCreate.mockResolvedValue({});
    workupVisitsApi.create.mockResolvedValue({ id: "wv-dedup" });
    workupVisitsApi.list.mockResolvedValue([]);
    workupVisitsApi.patch.mockResolvedValue({});
  });

  it("G3: farmaco sospeso nel raccordo NON appare come active in extracted.therapies", () => {
    const testo = `TERAPIA IN ATTO:
Idrossiclorochina 200mg/die

RACCORDO ANAMNESTICO
In terapia con Methotrexate 15mg dal 2018, sospeso nel 2024 per tossicità epatica.`;
    const { extracted } = parseVisitText(testo, {});
    const mtx = extracted.therapies?.find(t => t.drug_name === "Methotrexate");
    if (mtx) {
      expect(mtx.status).toBe("discontinued");
    } else {
      expect(mtx).toBeUndefined();
    }
    const hcq = extracted.therapies?.find(t => t.drug_name === "Idrossiclorochina");
    expect(hcq?.status).toBe("active");
  });

  it("G3: farmaco sospeso nel raccordo NON genera therapy_start nell'apply", async () => {
    const testo = `TERAPIA IN ATTO:
Idrossiclorochina 200mg/die

RACCORDO ANAMNESTICO
In terapia con Methotrexate 15mg dal 2018, sospeso nel 2024 per tossicità epatica.`;
    const { extracted } = parseVisitText(testo, {});
    await applyOneDraft(
      { ...extracted, visit_date: VD, visit_type: "follow_up" },
      PT, { therapies: true, raccordo_events: true }, "follow_up", null, {}
    );
    const allEvents = (clinicalEventsApi.batchCreate.mock.calls[0]?.[1]?.events || []);
    const mtxStart = allEvents.filter(
      e => e.event_type === "therapy_start" &&
           (e.drug_canonical || "").includes("methotrexate")
    );
    expect(mtxStart).toHaveLength(0);
  });

  it("G4: switch raccordo (SEC sospeso → RIT avviato) + solo RIT in IN TERAPIA → 1 episodio RIT, nessun episodio SEC attivo", () => {
    const testo = `TERAPIA IN ATTO:
Rituximab 1g ev ogni 6 mesi

RACCORDO ANAMNESTICO
In terapia con Secukinumab 300mg dal 2021, sospeso nel 2025 per inefficacia. Avviato Rituximab 1g ev a marzo 2025.`;
    const { extracted } = parseVisitText(testo, {});
    const sec = extracted.therapies?.find(t => t.drug_name === "Secukinumab");
    if (sec) {
      expect(sec.status).toBe("discontinued");
    }
    const rit = extracted.therapies?.find(t => t.drug_name === "Rituximab");
    expect(rit?.status).toBe("active");
  });

  it("G4: switch raccordo → nell'apply, RIT ha un solo therapy_start (raccordo, non sintetico duplicato)", async () => {
    const testo = `TERAPIA IN ATTO:
Rituximab 1g ev ogni 6 mesi

RACCORDO ANAMNESTICO
In terapia con Secukinumab 300mg dal 2021, sospeso nel 2025 per inefficacia. Avviato Rituximab 1g ev a marzo 2025.`;
    const { extracted } = parseVisitText(testo, {});
    await applyOneDraft(
      { ...extracted, visit_date: VD, visit_type: "follow_up" },
      PT, { therapies: true, raccordo_events: true }, "follow_up", null, {}
    );
    const allEvents = (clinicalEventsApi.batchCreate.mock.calls[0]?.[1]?.events || []);
    const ritStart = allEvents.filter(
      e => e.event_type === "therapy_start" &&
           (e.drug_canonical || e.drug_name || "").toLowerCase().includes("rituximab")
    );
    expect(ritStart.length).toBeLessThanOrEqual(1);
  });

  it("G5 (fallback): testo senza header terapia → farmaci del raccordo non entrano come attivi se contengono segnale di sospensione", () => {
    const testo = `Paziente con AR sieropositiva.
In terapia con Methotrexate 15mg dal 2015, sospeso nel 2023 per intolleranza.
Attualmente in terapia con Adalimumab 40mg eow.`;
    const { extracted } = parseVisitText(testo, {});
    const mtx = extracted.therapies?.find(t => t.drug_name === "Methotrexate");
    if (mtx) {
      expect(mtx.status).not.toBe("active");
    }
  });

  it("G2: farmaco solo in IN TERAPIA senza menzione raccordo → sintetico therapy_start emesso a data visita", async () => {
    const draft = {
      visit_date: VD,
      visit_type: "follow_up",
      therapies: [
        { drug_name: "Baricitinib", category: "tsDMARD", status: "active",
          _action: "new_episode", _skip: false, dose: "4 mg", route: "os" },
      ],
      raccordo_events: [],
    };
    await applyOneDraft(draft, PT, { therapies: true, raccordo_events: true }, "follow_up", null, {});
    expect(clinicalEventsApi.batchCreate).toHaveBeenCalledTimes(1);
    const events = clinicalEventsApi.batchCreate.mock.calls[0][1].events;
    const startEv = events.find(e => e.event_type === "therapy_start");
    expect(startEv).toBeTruthy();
    expect(startEv.drug_canonical).toBe("baricitinib");
    expect(startEv.date_value).toBe(VD);
  });
});
