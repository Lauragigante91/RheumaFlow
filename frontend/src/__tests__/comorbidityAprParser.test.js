import { analyzeComorbidityText } from "../lib/comorbidityAprParser";

describe("analyzeComorbidityText", () => {
  test("testo vuoto restituisce risultato vuoto e confidence none", () => {
    const r = analyzeComorbidityText("   ");
    expect(r.recognized_known).toEqual([]);
    expect(r.review).toEqual([]);
    expect(r.negated).toEqual([]);
    expect(r.surgeries).toEqual([]);
    expect(r.confidence).toBe("none");
  });

  test("etichette esatte note -> recognized_known, confidence high", () => {
    const r = analyzeComorbidityText("Ipertensione arteriosa, diabete tipo 2");
    const canonicals = r.recognized_known.map((c) => c.canonical).sort();
    expect(canonicals).toEqual(["dm2", "hypertension"]);
    expect(r.review).toEqual([]);
    expect(r.confidence).toBe("high");
  });

  test("sinonimo che mappa a un solo canonico -> recognized_known", () => {
    const r = analyzeComorbidityText("IPA");
    expect(r.recognized_known.map((c) => c.canonical)).toEqual(["hypertension"]);
    expect(r.review).toEqual([]);
  });

  test("sinonimo ambiguo -> review ambigua, mai salvato", () => {
    const r = analyzeComorbidityText("IRC");
    expect(r.recognized_known).toEqual([]);
    expect(r.review.length).toBe(1);
    expect(r.review[0].kind).toBe("ambiguous");
    expect(r.review[0].canonical).toBeNull();
  });

  test("negazione esplicita di comorbidita rilevanti -> negated, nulla salvato", () => {
    const r = analyzeComorbidityText("Non comorbidità extrareumatologiche rilevanti.");
    expect(r.recognized_known).toEqual([]);
    expect(r.negated.length).toBeGreaterThan(0);
  });

  test("negazione specifica -> condizione in negated, non in recognized", () => {
    const r = analyzeComorbidityText("Nega cardiopatia ischemica");
    expect(r.recognized_known).toEqual([]);
    expect(r.negated).toContain("Cardiopatia ischemica");
  });

  test("neoplasia pregressa -> review neoplasia con status e anno", () => {
    const r = analyzeComorbidityText("Pregressa neoplasia mammaria nel 2018");
    expect(r.recognized_known).toEqual([]);
    expect(r.review.length).toBe(1);
    expect(r.review[0].kind).toBe("neoplasia");
    expect(r.review[0].status).toBe("historical");
    expect(r.review[0].onset_date).toBe("2018");
  });

  test("infezione rilevante -> review infection, mai auto-salvata", () => {
    const r = analyzeComorbidityText("Epatite C");
    expect(r.recognized_known).toEqual([]);
    expect(r.review.length).toBe(1);
    expect(r.review[0].kind).toBe("infection");
  });

  test("condizione multi-istanza -> review multi, mai auto-salvata", () => {
    const r = analyzeComorbidityText("TVP/TEP");
    expect(r.recognized_known).toEqual([]);
    expect(r.review.length).toBe(1);
    expect(r.review[0].kind).toBe("multi");
    expect(r.review[0].canonical).toBe("vte");
  });

  test("intervento chirurgico -> surgeries info-only, non salvato", () => {
    const r = analyzeComorbidityText("Colecistectomia per fango biliare");
    expect(r.recognized_known).toEqual([]);
    expect(r.review).toEqual([]);
    expect(r.surgeries.length).toBe(1);
  });

  test("condizione non riconosciuta -> review unrecognized", () => {
    const r = analyzeComorbidityText("Sindrome di Gilbert");
    expect(r.recognized_known).toEqual([]);
    expect(r.review.length).toBe(1);
    expect(r.review[0].kind).toBe("unrecognized");
    expect(r.review[0].canonical).toBeNull();
  });
});
