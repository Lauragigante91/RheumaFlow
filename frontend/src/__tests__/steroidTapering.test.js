import { calculateTablets, formatTablets, DRUG_FORMULATIONS } from "../lib/steroidTapering";

function fmt(dose, drug = "prednisone") {
  return formatTablets(calculateTablets(dose, drug), DRUG_FORMULATIONS[drug].defaultBrand, dose);
}

describe("Prednisone — preferenza frazione cp da 25 mg", () => {
  test("25 mg = 1 cp da 25", () => {
    expect(calculateTablets(25, "prednisone")).toEqual([{ mg: 25, count: 1 }]);
    expect(fmt(25)).toBe("1 cp da 25 mg");
  });

  test("18.75 mg = ¾ cp da 25 (non 3,75 cp da 5)", () => {
    expect(calculateTablets(18.75, "prednisone")).toEqual([{ mg: 25, count: 0.75 }]);
    expect(fmt(18.75)).toBe("¾ cp da 25 mg");
  });

  test("12.5 mg = ½ cp da 25 (non 2,5 cp da 5)", () => {
    expect(calculateTablets(12.5, "prednisone")).toEqual([{ mg: 25, count: 0.5 }]);
    expect(fmt(12.5)).toBe("½ cp da 25 mg");
  });

  test("6.25 mg = ¼ cp da 25 (non 1,25 cp da 5)", () => {
    expect(calculateTablets(6.25, "prednisone")).toEqual([{ mg: 25, count: 0.25 }]);
    expect(fmt(6.25)).toBe("¼ cp da 25 mg");
  });
});

describe("Prednisone — dosi gestite con cp da 5 mg", () => {
  test("20 mg = 4 cp da 5", () => {
    expect(calculateTablets(20, "prednisone")).toEqual([{ mg: 5, count: 4 }]);
    expect(fmt(20)).toBe("4 cp da 5 mg");
  });

  test("15 mg = 3 cp da 5", () => {
    expect(calculateTablets(15, "prednisone")).toEqual([{ mg: 5, count: 3 }]);
    expect(fmt(15)).toBe("3 cp da 5 mg");
  });

  test("10 mg = 2 cp da 5", () => {
    expect(calculateTablets(10, "prednisone")).toEqual([{ mg: 5, count: 2 }]);
    expect(fmt(10)).toBe("2 cp da 5 mg");
  });

  test("7.5 mg = 1 cp da 5 + ½ cp da 5", () => {
    expect(calculateTablets(7.5, "prednisone")).toEqual([{ mg: 5, count: 1 }, { mg: 5, count: 0.5 }]);
    expect(fmt(7.5)).toBe("1 cp da 5 mg + ½ cp da 5 mg");
  });

  test("5 mg = 1 cp da 5", () => {
    expect(calculateTablets(5, "prednisone")).toEqual([{ mg: 5, count: 1 }]);
    expect(fmt(5)).toBe("1 cp da 5 mg");
  });

  test("2.5 mg = ½ cp da 5", () => {
    expect(calculateTablets(2.5, "prednisone")).toEqual([{ mg: 5, count: 0.5 }]);
    expect(fmt(2.5)).toBe("½ cp da 5 mg");
  });
});

describe("Prednisone — dosi > 25 mg (nessuna regressione)", () => {
  test("50 mg = 2 cp da 25", () => {
    expect(calculateTablets(50, "prednisone")).toEqual([{ mg: 25, count: 2 }]);
  });

  test("40 mg = 1 cp da 25 + 3 cp da 5", () => {
    expect(calculateTablets(40, "prednisone")).toEqual([{ mg: 25, count: 1 }, { mg: 5, count: 3 }]);
  });

  test("30 mg = 1 cp da 25 + 1 cp da 5", () => {
    expect(calculateTablets(30, "prednisone")).toEqual([{ mg: 25, count: 1 }, { mg: 5, count: 1 }]);
  });

  test("31.25 mg = 1 cp da 25 + ¼ cp da 25", () => {
    expect(calculateTablets(31.25, "prednisone")).toEqual([{ mg: 25, count: 1 }, { mg: 25, count: 0.25 }]);
  });
});

describe("Metilprednisolone — nessuna preferenza frazione-grande (no regressione)", () => {
  test("16 mg = 1 cp da 16", () => {
    expect(calculateTablets(16, "metilprednisolone")).toEqual([{ mg: 16, count: 1 }]);
  });

  test("20 mg = 1 cp da 16 + 1 cp da 4", () => {
    expect(calculateTablets(20, "metilprednisolone")).toEqual([{ mg: 16, count: 1 }, { mg: 4, count: 1 }]);
  });

  test("36 mg = 1 cp da 32 + 1 cp da 4", () => {
    expect(calculateTablets(36, "metilprednisolone")).toEqual([{ mg: 32, count: 1 }, { mg: 4, count: 1 }]);
  });

  test("2 mg = ½ cp da 4", () => {
    expect(calculateTablets(2, "metilprednisolone")).toEqual([{ mg: 4, count: 0.5 }]);
  });
});
