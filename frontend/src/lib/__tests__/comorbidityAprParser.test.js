import { parseComorbidityAprText } from "../comorbidityAprParser";

describe("parseComorbidityAprText", () => {
  test("negazione generale + colecistectomia", () => {
    const out = parseComorbidityAprText(
      "Non comorbidità extrareumatologiche che richiedano terapie croniche o regolari follow-up. Colecistectomia per fango biliare."
    );

    expect(out.active_comorbidities).toEqual([]);
    expect(out.negated_relevant_absences).toContain("comorbidita extrareumatologiche rilevanti negate");
    expect(out.surgeries).toEqual(["Colecistectomia per fango biliare"]);
  });

  test("nega diabete e ipertensione, conserva colecistectomia pregressa", () => {
    const out = parseComorbidityAprText("Nega diabete, ipertensione. Pregressa colecistectomia.");

    expect(out.active_comorbidities).toEqual([]);
    expect(out.negated_relevant_absences).toEqual(
      expect.arrayContaining(["Diabete tipo 2 negata", "Ipertensione arteriosa negata"])
    );
    expect(out.surgeries).toEqual(["colecistectomia"]);
  });

  test("neoplasia pregressa", () => {
    const out = parseComorbidityAprText("Pregressa neoplasia mammaria nel 2018.");

    expect(out.active_comorbidities).toEqual([]);
    expect(out.prior_neoplasia).toEqual(["neoplasia mammaria nel 2018"]);
  });

  test("TBC latente trattata", () => {
    const out = parseComorbidityAprText("TBC latente trattata.");

    expect(out.relevant_infections).toEqual(["TBC latente trattata"]);
    expect(out.active_comorbidities).toEqual([]);
  });

  test("diabete tipo 2 e ipertensione arteriosa attive", () => {
    const out = parseComorbidityAprText("Diabete tipo 2 e ipertensione arteriosa.");

    expect(out.active_comorbidities).toEqual(["Diabete tipo 2", "Ipertensione arteriosa"]);
    expect(out.negated_relevant_absences).toEqual([]);
  });

  test("nessuna comorbidità rilevante", () => {
    const out = parseComorbidityAprText("Nessuna comorbidità rilevante.");

    expect(out.active_comorbidities).toEqual([]);
    expect(out.negated_relevant_absences).toContain("comorbidita extrareumatologiche rilevanti negate");
  });
});
