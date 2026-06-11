/**
 * Test suite — visitTextParser.js
 *
 * Copre l'orchestratore principale che produce lo shape { extracted }
 * identico all'ex risposta di /ai/parse-visit.
 *
 * Sezioni testate:
 *   - assessments[]   — score clinimetrici con interpretazione
 *   - therapies[]     — farmaci (csDMARD, bDMARD, JAKi, corticosteroidi, FANS, integratori)
 *   - lab_exams[]     — esami raggruppati per pannello
 *   - patient         — anagrafica base + diagnosi
 *   - sclero_profile  — profilo SSc (solo se keyword presenti)
 *   - Testo campione completo (integrazione)
 */

import { parseVisitText } from "../lib/visitTextParser";

// helper
function findAssessment(extracted, index_type) {
  return (extracted.assessments || []).find((a) => a.index_type === index_type) || null;
}
function findTherapy(extracted, drugName) {
  return (extracted.therapies || []).find(
    (t) => t.drug_name.toLowerCase() === drugName.toLowerCase()
  ) || null;
}
function findLabExam(extracted, category) {
  return (extracted.lab_exams || []).find((e) => e.category === category) || null;
}

// ─── Assessments ─────────────────────────────────────────────────────────────
describe("Assessments — score e interpretazione", () => {
  test("DAS28-CRP rilevato con interpretazione alta attività", () => {
    const { extracted } = parseVisitText("DAS28-CRP 5.2");
    const a = findAssessment(extracted, "das28_crp");
    expect(a?.score).toBe(5.2);
    expect(a?.interpretation).toMatch(/alta/i);
  });

  test("DAS28-CRP in remissione", () => {
    const { extracted } = parseVisitText("DAS28-CRP 2.1");
    expect(findAssessment(extracted, "das28_crp")?.interpretation).toMatch(/remissione/i);
  });

  test("CDAI remissione (≤ 2.8)", () => {
    const { extracted } = parseVisitText("CDAI 2.0");
    expect(findAssessment(extracted, "cdai")?.interpretation).toMatch(/remissione/i);
  });

  test("CDAI attività moderata", () => {
    const { extracted } = parseVisitText("CDAI 15");
    expect(findAssessment(extracted, "cdai")?.interpretation).toMatch(/moderata/i);
  });

  test("HAQ disabilità lieve", () => {
    const { extracted } = parseVisitText("HAQ 0.625");
    expect(findAssessment(extracted, "haq")?.interpretation).toMatch(/lieve/i);
  });

  test("BASDAI malattia attiva (≥ 4)", () => {
    const { extracted } = parseVisitText("BASDAI 4.5");
    expect(findAssessment(extracted, "basdai")?.interpretation).toMatch(/attiv/i);
  });

  test("SLEDAI attività moderata", () => {
    const { extracted } = parseVisitText("SLEDAI 8");
    expect(findAssessment(extracted, "sledai")?.interpretation).toMatch(/moderata/i);
  });

  test("mRSS cute diffusa moderata", () => {
    const { extracted } = parseVisitText("mRSS 20");
    expect(findAssessment(extracted, "mrss")?.interpretation).toMatch(/moderata/i);
  });

  test("TJC e SJC estratti e allegati all'assessment", () => {
    const { extracted } = parseVisitText(
      "DAS28-CRP 4.2. TJC 6, SJC 4."
    );
    const a = findAssessment(extracted, "das28_crp");
    expect(a?.tender_count).toBe(6);
    expect(a?.swollen_count).toBe(4);
  });

  test("Data visita estratta e usata come date assessment", () => {
    const { extracted } = parseVisitText(
      "Visita del 15/03/2026. DAS28-CRP 3.8."
    );
    const a = findAssessment(extracted, "das28_crp");
    expect(a?.date).toBe("2026-03-15");
  });
});

// ─── Therapies ────────────────────────────────────────────────────────────────
describe("Therapies — farmaci con categoria e dose", () => {
  test("Methotrexate csDMARD", () => {
    const { extracted } = parseVisitText("Terapia: Methotrexate 15 mg/sett s.c.");
    const t = findTherapy(extracted, "Methotrexate");
    expect(t).not.toBeNull();
    expect(t?.category).toBe("dmard_conventional");
    expect(t?.route).toBe("s.c.");
  });

  test("MTX abbreviazione", () => {
    const { extracted } = parseVisitText("MTX 10 mg/sett.");
    expect(findTherapy(extracted, "Methotrexate")).not.toBeNull();
  });

  test("Idrossiclorochina csDMARD", () => {
    const { extracted } = parseVisitText("Idrossiclorochina 200 mg/die os.");
    const t = findTherapy(extracted, "Idrossiclorochina");
    expect(t?.category).toBe("dmard_conventional");
  });

  test("HCQ abbreviazione", () => {
    const { extracted } = parseVisitText("HCQ 400 mg/die");
    expect(findTherapy(extracted, "Idrossiclorochina")).not.toBeNull();
  });

  test("Adalimumab bDMARD", () => {
    const { extracted } = parseVisitText("Adalimumab 40 mg s.c. ogni 2 settimane.");
    const t = findTherapy(extracted, "Adalimumab");
    expect(t?.category).toBe("dmard_biologic");
  });

  test("Humira nome commerciale → Adalimumab", () => {
    const { extracted } = parseVisitText("Humira 40 mg s.c.");
    expect(findTherapy(extracted, "Adalimumab")).not.toBeNull();
  });

  test("Baricitinib JAK inibitore", () => {
    const { extracted } = parseVisitText("Baricitinib 4 mg/die os.");
    const t = findTherapy(extracted, "Baricitinib");
    expect(t?.category).toBe("dmard_targeted");
  });

  test("Upadacitinib alias Rinvoq", () => {
    const { extracted } = parseVisitText("Rinvoq 15 mg/die.");
    expect(findTherapy(extracted, "Upadacitinib")).not.toBeNull();
  });

  test("Prednisone corticosteroide", () => {
    const { extracted } = parseVisitText("Prednisone 5 mg/die os.");
    const t = findTherapy(extracted, "Prednisone");
    expect(t?.category).toBe("corticosteroid");
  });

  test("Deltacortene alias Prednisone", () => {
    const { extracted } = parseVisitText("Deltacortene 5 mg/die");
    expect(findTherapy(extracted, "Prednisone")).not.toBeNull();
  });

  test("Ibuprofene FANS", () => {
    const { extracted } = parseVisitText("Ibuprofene 600 mg al bisogno.");
    expect(findTherapy(extracted, "Ibuprofene")?.category).toBe("nsaid");
  });

  test("Etoricoxib alias Arcoxia", () => {
    const { extracted } = parseVisitText("Arcoxia 90 mg");
    expect(findTherapy(extracted, "Etoricoxib")).not.toBeNull();
  });

  test("Acido folico integratore", () => {
    const { extracted } = parseVisitText("Acido folico 5 mg/sett.");
    const t = findTherapy(extracted, "Acido folico");
    expect(t?.category).toBe("supplement");
  });

  test("Vitamina D integratore", () => {
    const { extracted } = parseVisitText("Vitamina D 25000 UI/mese.");
    expect(findTherapy(extracted, "Vitamina D")?.category).toBe("supplement");
  });

  test("Omeprazolo IPP", () => {
    const { extracted } = parseVisitText("Omeprazolo 20 mg/die.");
    expect(findTherapy(extracted, "Omeprazolo")?.category).toBe("other");
  });

  test("Farmaco non nel dizionario non rilevato", () => {
    const { extracted } = parseVisitText("Farmaco sconosciuto ZXYZ 10 mg.");
    expect(extracted.therapies).toHaveLength(0);
  });

  test("Più farmaci nello stesso testo", () => {
    const text =
      "Terapia: Methotrexate 15 mg/sett s.c., Acido folico 5 mg, Prednisone 5 mg/die.";
    const { extracted } = parseVisitText(text);
    expect(findTherapy(extracted, "Methotrexate")).not.toBeNull();
    expect(findTherapy(extracted, "Acido folico")).not.toBeNull();
    expect(findTherapy(extracted, "Prednisone")).not.toBeNull();
  });

  test("Farmaco duplicato conta una sola volta", () => {
    const { extracted } = parseVisitText(
      "Prednisone 5 mg. Continua Prednisone 5 mg."
    );
    const all = (extracted.therapies || []).filter(
      (t) => t.drug_name === "Prednisone"
    );
    expect(all).toHaveLength(1);
  });
});

// ─── Lab exams ────────────────────────────────────────────────────────────────
describe("Lab exams — raggruppati per pannello", () => {
  test("VES e PCR vanno in fase_acuta → ematochimici", () => {
    const { extracted } = parseVisitText("VES 32 mm/h, PCR 18 mg/L.");
    const e = findLabExam(extracted, "ematochimici");
    expect(e).not.toBeNull();
    const names = (e?.results || []).map((r) => r.name);
    expect(names).toContain("VES / ESR");
    expect(names).toContain("PCR / CRP");
  });

  test("Hb, GB, PLT vanno in emocromo", () => {
    const { extracted } = parseVisitText("Hb 12.5 g/dL, GB 7.2 K/μL, PLT 180 K/μL.");
    const e = findLabExam(extracted, "emocromo");
    const names = (e?.results || []).map((r) => r.name);
    expect(names).toContain("Hb / Emoglobina");
    expect(names).toContain("GB / WBC");
    expect(names).toContain("PLT / Piastrine");
  });

  test("ALT va in funzione_organi", () => {
    const { extracted } = parseVisitText("ALT 35 U/L.");
    const e = findLabExam(extracted, "funzione_organi");
    expect(e).not.toBeNull();
  });

  test("Risultato qualitativo nn incluso", () => {
    const { extracted } = parseVisitText("PCR nn, VES nella norma.");
    const e = findLabExam(extracted, "ematochimici");
    expect(e).not.toBeNull();
  });
});

// ─── Patient info ─────────────────────────────────────────────────────────────
describe("Patient — anagrafica e diagnosi", () => {
  test("Diagnosi estratta", () => {
    const { extracted } = parseVisitText(
      "Diagnosi: Artrite reumatoide sieropositiva (AR)."
    );
    expect(extracted.patient?.diagnosi).toMatch(/artrite reumatoide/i);
  });

  test("Sesso maschile", () => {
    const { extracted } = parseVisitText("Paziente maschio di 58 anni.");
    expect(extracted.patient?.sesso).toBe("M");
  });

  test("Sesso femminile da 'donna'", () => {
    const { extracted } = parseVisitText("Paziente donna, 45 anni.");
    expect(extracted.patient?.sesso).toBe("F");
  });

  test("Testo senza dati anagrafici → patient null", () => {
    const { extracted } = parseVisitText("DAS28-CRP 3.5.");
    expect(extracted.patient).toBeNull();
  });
});

// ─── Sclero profile ───────────────────────────────────────────────────────────
describe("Sclero profile — solo se SSc keyword presente", () => {
  test("Nessun profilo se SSc non citata", () => {
    const { extracted } = parseVisitText("DAS28-CRP 4.2, Methotrexate 15 mg.");
    expect(extracted.sclero_profile).toBeNull();
  });

  test("Profilo SSc presente con anticorpi Scl-70", () => {
    const { extracted } = parseVisitText(
      "Sclerosi sistemica. Anti-Scl-70 positivo. LSSc. Fenomeno di Raynaud presente."
    );
    expect(extracted.sclero_profile).not.toBeNull();
    expect(extracted.sclero_profile?.antibody?.scl70).toBe(true);
    expect(extracted.sclero_profile?.vascular?.raynaud).toBe(true);
    expect(extracted.sclero_profile?.cutaneous?.subtype).toBe("LSSc");
  });

  test("Anti-centromero / ACA", () => {
    const { extracted } = parseVisitText(
      "SSc. Anti-centromero (ACA) positivo."
    );
    expect(extracted.sclero_profile?.antibody?.centromere).toBe(true);
  });

  test("ILD / NSIP rilevato", () => {
    const { extracted } = parseVisitText(
      "Sclerosi sistemica diffusa. ILD pattern NSIP alla HRCT."
    );
    expect(extracted.sclero_profile?.ild?.present).toBe(true);
    expect(extracted.sclero_profile?.ild?.pattern).toBe("NSIP");
  });
});

// ─── Summary ──────────────────────────────────────────────────────────────────
describe("Summary auto-generato", () => {
  test("Non null se ci sono dati", () => {
    const { extracted } = parseVisitText("DAS28-CRP 4.2.");
    expect(extracted.summary).not.toBeNull();
  });

  test("Null se testo senza dati riconoscibili", () => {
    const { extracted } = parseVisitText("Visita di controllo. Nessuna variazione.");
    expect(extracted.summary).toBeNull();
  });
});

// ─── Integrazione: testo campione completo ────────────────────────────────────
describe("Integrazione — testo visita AR completo", () => {
  const FULL_TEXT = `
    Visita ambulatoriale del 15/02/2026.
    Paziente: Mario Rossi, 58 anni, M.
    Diagnosi: Artrite reumatoide sieropositiva.
    Esame: 6 articolazioni dolenti (TJC), 4 tumefatte (SJC).
    DAS28-CRP 4.2 (alta attività). CDAI 18. HAQ 0.75.
    Esami: VES 32 mm/h, PCR 18 mg/L.
    Terapia in corso: Methotrexate 15 mg/sett s.c., Acido folico 5 mg, Prednisone 5 mg/die.
  `;

  let extracted;
  beforeAll(() => {
    extracted = parseVisitText(FULL_TEXT).extracted;
  });

  test("Score clinimetrici rilevati", () => {
    expect(findAssessment(extracted, "das28_crp")?.score).toBe(4.2);
    expect(findAssessment(extracted, "cdai")?.score).toBe(18);
    expect(findAssessment(extracted, "haq")?.score).toBe(0.75);
  });

  test("Data visita corretta", () => {
    expect(findAssessment(extracted, "das28_crp")?.date).toBe("2026-02-15");
  });

  test("TJC e SJC collegati", () => {
    expect(findAssessment(extracted, "das28_crp")?.tender_count).toBe(6);
    expect(findAssessment(extracted, "das28_crp")?.swollen_count).toBe(4);
  });

  test("Terapie complete", () => {
    expect(findTherapy(extracted, "Methotrexate")?.route).toBe("s.c.");
    expect(findTherapy(extracted, "Acido folico")).not.toBeNull();
    expect(findTherapy(extracted, "Prednisone")?.category).toBe("corticosteroid");
  });

  test("Lab esami infiammazione", () => {
    const e = findLabExam(extracted, "ematochimici");
    const names = (e?.results || []).map((r) => r.name);
    expect(names).toContain("VES / ESR");
    expect(names).toContain("PCR / CRP");
  });

  test("Sesso e diagnosi paziente", () => {
    expect(extracted.patient?.sesso).toBe("M");
    expect(extracted.patient?.diagnosi).toMatch(/artrite reumatoide/i);
  });

  test("Nessun profilo SSc per paziente AR", () => {
    expect(extracted.sclero_profile).toBeNull();
  });
});
