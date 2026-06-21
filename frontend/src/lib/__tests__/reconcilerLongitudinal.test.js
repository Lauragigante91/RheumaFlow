import {
  reconcileDrafts,
  diffLongitudinalFields,
  LONGIT_STATUS,
  LONGITUDINAL_FIELDS,
} from "../visitReconciler";

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyExisting() {
  return {
    therapies:        [],
    assessments:      [],
    lab_exams:        [],
    disease_profiles: {},
    sclero_profile:   null,
    clinical_events:  [],
    patient:          null,
  };
}

function makePatient(overrides = {}) {
  return {
    id:                  "pat-1",
    diagnosi:            null,
    allergie_testo:      null,
    anamnesi_familiare:  null,
    anamnesi_fisiologica:null,
    comorbidita_apr:     null,
    terapia_domiciliare: null,
    ...overrides,
  };
}

function makeDraft(overrides = {}) {
  return {
    visit_date: null,
    therapies: [],
    assessments: [],
    lab_exams: [],
    raccordo_events: [],
    ...overrides,
  };
}

// ── diffLongitudinalFields unit tests ─────────────────────────────────────────

describe("diffLongitudinalFields", () => {
  it("restituisce array vuoto se existingPatient è null", () => {
    const draft = makeDraft({ profilo_generale: { diagnosi: "Artrite reumatoide" } });
    expect(diffLongitudinalFields(draft, null)).toEqual([]);
  });

  it("NUOVO_DATO se il paziente non ha diagnosi", () => {
    const draft = makeDraft({ profilo_generale: { diagnosi: "Artrite reumatoide" } });
    const patient = makePatient({ diagnosi: null });
    const result = diffLongitudinalFields(draft, patient);
    const dx = result.find(f => f.key === "diagnosi");
    expect(dx).toBeDefined();
    expect(dx.status).toBe(LONGIT_STATUS.NUOVO_DATO);
    expect(dx._skip).toBe(false);
    expect(dx.previous).toBeNull();
    expect(dx.current).toBe("Artrite reumatoide");
  });

  it("INVARIATO se diagnosi identica (normalizzata)", () => {
    const draft = makeDraft({ profilo_generale: { diagnosi: "Artrite reumatoide" } });
    const patient = makePatient({ diagnosi: "Artrite reumatoide" });
    const result = diffLongitudinalFields(draft, patient);
    const dx = result.find(f => f.key === "diagnosi");
    expect(dx.status).toBe(LONGIT_STATUS.INVARIATO);
    expect(dx._skip).toBe(true);
  });

  it("CONFLITTO diagnosi diversa (modalità single)", () => {
    const draft = makeDraft({ profilo_generale: { diagnosi: "Artrite psoriasica" } });
    const patient = makePatient({ diagnosi: "Artrite indifferenziata" });
    const result = diffLongitudinalFields(draft, patient);
    const dx = result.find(f => f.key === "diagnosi");
    expect(dx.status).toBe(LONGIT_STATUS.CONFLITTO);
    expect(dx._skip).toBe(true);
    expect(dx.previous).toBe("Artrite indifferenziata");
    expect(dx.current).toBe("Artrite psoriasica");
  });

  it("INVARIATO allergie se testo identico", () => {
    const draft = makeDraft({ profilo_generale: { allergie: "Penicillina" } });
    const patient = makePatient({ allergie_testo: "Penicillina" });
    const result = diffLongitudinalFields(draft, patient);
    const al = result.find(f => f.key === "allergie_testo");
    expect(al.status).toBe(LONGIT_STATUS.INVARIATO);
  });

  it("NUOVO_DATO comorbidità se visita aggiunge nuovo dato", () => {
    const draft = makeDraft({
      profilo_generale: { comorbidita_apr: "Ipertensione\nDislipidemia" },
    });
    const patient = makePatient({ comorbidita_apr: "Ipertensione" });
    const result = diffLongitudinalFields(draft, patient);
    const comorb = result.find(f => f.key === "comorbidita_apr");
    expect(comorb.status).toBe(LONGIT_STATUS.NUOVO_DATO);
    expect(comorb._skip).toBe(false);
  });

  it("MODIFICA terapia_domiciliare (modalità replace)", () => {
    const draft = makeDraft({ profilo_generale: { terapia_domiciliare: "MTX 15mg + ADA" } });
    const patient = makePatient({ terapia_domiciliare: "MTX 15mg" });
    const result = diffLongitudinalFields(draft, patient);
    const td = result.find(f => f.key === "terapia_domiciliare");
    expect(td.status).toBe(LONGIT_STATUS.MODIFICA);
    expect(td._skip).toBe(true);
  });

  it("non restituisce entry se il draft non ha quel campo", () => {
    const draft = makeDraft({ profilo_generale: {} });
    const patient = makePatient({ diagnosi: "Artrite reumatoide" });
    const result = diffLongitudinalFields(draft, patient);
    const dx = result.find(f => f.key === "diagnosi");
    expect(dx).toBeUndefined();
  });
});

// ── Acceptance test: 3 visite cronologiche ────────────────────────────────────

describe("reconcileDrafts — confronto longitudinale 3 visite", () => {
  const patient = makePatient({
    diagnosi:       "Artrite indifferenziata",
    allergie_testo: "Penicillina",
  });

  const v1Draft = makeDraft({
    visit_date: "2023-01-10",
    profilo_generale: { diagnosi: "Artrite indifferenziata", allergie: "Penicillina" },
    therapies: [
      { drug_name: "Methotrexate", dose: "15 mg/sett", status: "active" },
      { drug_name: "Secukinumab",  dose: "150 mg",     status: "active" },
    ],
  });

  const v2Draft = makeDraft({
    visit_date: "2023-06-20",
    profilo_generale: { allergie: "Penicillina" },
    therapies: [
      { drug_name: "Methotrexate", dose: "15 mg/sett", status: "active" },
      { drug_name: "Secukinumab",  dose: "300 mg",     status: "active" },
    ],
  });

  const v3Draft = makeDraft({
    visit_date: "2024-01-15",
    profilo_generale: { comorbidita_apr: "Dislipidemia" },
    therapies: [
      { drug_name: "Methotrexate", dose: "15 mg/sett", status: "active" },
      { drug_name: "Secukinumab",  dose: "300 mg",     status: "active" },
    ],
  });

  const existingData = {
    ...emptyExisting(),
    patient,
  };

  const [r1, r2, r3] = reconcileDrafts([v1Draft, v2Draft, v3Draft], existingData);

  it("V1 — diagnosi INVARIATO (uguale a DB)", () => {
    const dx = (r1._longitudinal || []).find(f => f.key === "diagnosi");
    expect(dx).toBeDefined();
    expect(dx.status).toBe(LONGIT_STATUS.INVARIATO);
  });

  it("V1 — allergie INVARIATO", () => {
    const al = (r1._longitudinal || []).find(f => f.key === "allergie_testo");
    expect(al).toBeDefined();
    expect(al.status).toBe(LONGIT_STATUS.INVARIATO);
  });

  it("V2 — diagnosi non estratta → nessuna entry longitudinale", () => {
    const dx = (r2._longitudinal || []).find(f => f.key === "diagnosi");
    expect(dx).toBeUndefined();
  });

  it("V2 — allergie INVARIATO", () => {
    const al = (r2._longitudinal || []).find(f => f.key === "allergie_testo");
    expect(al.status).toBe(LONGIT_STATUS.INVARIATO);
  });

  it("V2 — Secukinumab cambio dose → CONFLICT therapy", () => {
    const sec = r2.therapies.find(t => /secukinumab/i.test(t.drug_name));
    expect(sec._status).toBe("conflict");
    expect(sec._action).toBe("dose_change");
    expect(sec._dose_before).toBe("150 mg");
  });

  it("V2 — MTX continuità (no duplicazione)", () => {
    const mtx = r2.therapies.find(t => /methotrexate/i.test(t.drug_name));
    expect(mtx._status).toBe("continuity");
    expect(mtx._skip).toBe(true);
  });

  it("V3 — comorbidità Dislipidemia → NUOVO_DATO (non in DB)", () => {
    const comorb = (r3._longitudinal || []).find(f => f.key === "comorbidita_apr");
    expect(comorb).toBeDefined();
    expect(comorb.status).toBe(LONGIT_STATUS.NUOVO_DATO);
    expect(comorb._skip).toBe(false);
    expect(comorb.current).toContain("Dislipidemia");
  });

  it("V3 — diagnosi non estratta, allergie non estratte → nessun overwrite automatico", () => {
    const dx = (r3._longitudinal || []).find(f => f.key === "diagnosi");
    const al = (r3._longitudinal || []).find(f => f.key === "allergie_testo");
    expect(dx).toBeUndefined();
    expect(al).toBeUndefined();
  });

  it("V3 — nessuna duplicazione terapie già in batch", () => {
    const sec = r3.therapies.find(t => /secukinumab/i.test(t.drug_name));
    const mtx = r3.therapies.find(t => /methotrexate/i.test(t.drug_name));
    expect(sec._status).toBe("continuity");
    expect(mtx._status).toBe("continuity");
  });
});

// ── LONGITUDINAL_FIELDS integrità ─────────────────────────────────────────────

describe("LONGITUDINAL_FIELDS costante", () => {
  it("contiene tutti i campi stabili attesi", () => {
    const keys = LONGITUDINAL_FIELDS.map(f => f.key);
    expect(keys).toContain("diagnosi");
    expect(keys).toContain("allergie_testo");
    expect(keys).toContain("anamnesi_familiare");
    expect(keys).toContain("anamnesi_fisiologica");
    expect(keys).toContain("comorbidita_apr");
    expect(keys).toContain("terapia_domiciliare");
  });

  it("diagnosi ha mode single", () => {
    const dx = LONGITUDINAL_FIELDS.find(f => f.key === "diagnosi");
    expect(dx.mode).toBe("single");
  });

  it("campi append-style hanno mode append", () => {
    const appendKeys = ["allergie_testo", "anamnesi_familiare", "anamnesi_fisiologica", "comorbidita_apr"];
    appendKeys.forEach(k => {
      const f = LONGITUDINAL_FIELDS.find(x => x.key === k);
      expect(f.mode).toBe("append");
    });
  });
});
