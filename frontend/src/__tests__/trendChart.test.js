import { getTherapiesActiveOn } from "../components/clinical/TrendChartCard";

const MTX = {
  drug_name: "Methotrexate",
  dose: "10 mg",
  status: "active",
  start_date: null,
  first_seen_date: "2022-09-13",
  end_date: null,
  category: "csDMARD",
};

const SEC = {
  drug_name: "Secukinumab",
  dose: "300 mg",
  status: "active",
  start_date: null,
  first_seen_date: "2022-09-13",
  end_date: null,
  category: "biologic",
};

const MTX_WITH_START = {
  drug_name: "Methotrexate",
  dose: "10 mg",
  status: "active",
  start_date: "2021-06-01",
  first_seen_date: "2021-06-01",
  end_date: null,
  category: "csDMARD",
};

describe("getTherapiesActiveOn — concordanza tooltip e barra Gantt", () => {
  it("terapia con solo first_seen_date (no start_date) compare in entrambe le visite sentinella", () => {
    const therapies = [MTX, SEC];
    const at0913 = getTherapiesActiveOn(therapies, "2022-09-13");
    const at0310 = getTherapiesActiveOn(therapies, "2023-03-10");
    expect(at0913.map(t => t.drug_name)).toEqual(expect.arrayContaining(["Methotrexate", "Secukinumab"]));
    expect(at0310.map(t => t.drug_name)).toEqual(expect.arrayContaining(["Methotrexate", "Secukinumab"]));
  });

  it("terapia con first_seen_date NON compare in visite precedenti all'avvio", () => {
    const therapies = [MTX];
    const before = getTherapiesActiveOn(therapies, "2021-12-31");
    expect(before).toHaveLength(0);
  });

  it("terapia con start_date esplicita funziona come prima", () => {
    const therapies = [MTX_WITH_START];
    const before = getTherapiesActiveOn(therapies, "2020-01-01");
    const during = getTherapiesActiveOn(therapies, "2022-01-01");
    expect(before).toHaveLength(0);
    expect(during.map(t => t.drug_name)).toContain("Methotrexate");
  });

  it("terapia sospesa (end_date) non compare dopo la sospensione", () => {
    const stopped = { ...MTX, start_date: "2021-06-01", end_date: "2023-01-01" };
    const after = getTherapiesActiveOn([stopped], "2023-06-01");
    expect(after).toHaveLength(0);
    const during = getTherapiesActiveOn([stopped], "2022-06-01");
    expect(during).toHaveLength(1);
  });

  it("concordanza: le terapie restituite da getTherapiesActiveOn hanno start_date || first_seen_date -> Gantt le renderizza", () => {
    const therapies = [MTX, SEC];
    const atVisit = getTherapiesActiveOn(therapies, "2023-03-10");
    expect(atVisit).toHaveLength(2);
    atVisit.forEach(t => {
      expect(t.start_date || t.first_seen_date).toBeTruthy();
    });
  });

  it("lista vuota -> nessuna terapia", () => {
    expect(getTherapiesActiveOn([], "2023-01-01")).toHaveLength(0);
    expect(getTherapiesActiveOn(null, "2023-01-01")).toHaveLength(0);
    expect(getTherapiesActiveOn([MTX], null)).toHaveLength(0);
  });
});
