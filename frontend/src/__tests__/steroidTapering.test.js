import { calculateTablets, formatTablets, DRUG_FORMULATIONS, generateTaperingPlan } from "../lib/steroidTapering";

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

const daysBetweenUTC = (a, b) =>
  Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);

const CONFIG_PMR = {
  drug: "prednisone",
  startDose: 15,
  startDate: "2026-06-15",
  initialDurationDays: 28,
  targets: [
    { dose: 10, byDate: "2026-09-07" },
    { dose: 5, byDate: "2026-12-14" },
    { dose: 0, byDate: "2027-06-14" },
  ],
  stepRules: [
    { aboveDose: 10, reductionMg: 2.5, intervalDays: 28 },
    { aboveDose: 5, reductionMg: 2.5, intervalDays: 28 },
    { aboveDose: 0, reductionMg: 2.5, intervalDays: 56 },
  ],
  generalNote: "",
};

const CONFIG_GCA = {
  drug: "prednisone",
  startDose: 50,
  startDate: "2026-01-10",
  initialDurationDays: 14,
  targets: [
    { dose: 25, byDate: "2026-04-01" },
    { dose: 15, byDate: "2026-07-01" },
    { dose: 10, byDate: "2026-10-01" },
    { dose: 5, byDate: "2027-06-01" },
  ],
  stepRules: [
    { aboveDose: 30, reductionMg: 10, intervalDays: 14 },
    { aboveDose: 20, reductionMg: 5, intervalDays: 14 },
    { aboveDose: 10, reductionMg: 2.5, intervalDays: 28 },
    { aboveDose: 0, reductionMg: 2.5, intervalDays: 28 },
  ],
  generalNote: "",
};

describe("generateTaperingPlan — coerenza delle date (fuso Europe/Rome)", () => {
  describe.each([
    ["PMR", CONFIG_PMR],
    ["GCA", CONFIG_GCA],
  ])("caso %s", (_label, config) => {
    test("genera almeno uno step", () => {
      const { steps } = generateTaperingPlan(config);
      expect(steps.length).toBeGreaterThan(0);
    });

    test("il primo step inizia esattamente alla data di inizio (visita)", () => {
      const { steps } = generateTaperingPlan(config);
      expect(steps[0].startDate).toBe(config.startDate);
    });

    test("ogni step ha durata positiva e coerente con start/end", () => {
      const { steps } = generateTaperingPlan(config);
      for (const s of steps) {
        expect(daysBetweenUTC(s.startDate, s.endDate)).toBeGreaterThanOrEqual(0);
        expect(s.durationDays).toBe(daysBetweenUTC(s.startDate, s.endDate) + 1);
        expect(s.durationDays).toBeGreaterThan(0);
      }
    });

    test("step consecutivi senza overlap né buchi (ogni inizio = giorno dopo la fine precedente)", () => {
      const { steps } = generateTaperingPlan(config);
      for (let i = 1; i < steps.length; i++) {
        expect(daysBetweenUTC(steps[i - 1].endDate, steps[i].startDate)).toBe(1);
      }
    });

    test("date in ordine cronologico stretto", () => {
      const { steps } = generateTaperingPlan(config);
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].startDate > steps[i - 1].startDate).toBe(true);
        expect(steps[i].endDate > steps[i - 1].endDate).toBe(true);
      }
    });

    test("l'ultimo step raggiunge la dose target finale", () => {
      const { steps } = generateTaperingPlan(config);
      const finalTarget = config.targets[config.targets.length - 1].dose;
      expect(steps[steps.length - 1].dose).toBe(finalTarget);
    });

    test("nessuno step supera la data dell'ultimo obiettivo", () => {
      const { steps } = generateTaperingPlan(config);
      const lastByDate = config.targets[config.targets.length - 1].byDate;
      for (const s of steps) {
        expect(s.endDate <= lastByDate).toBe(true);
      }
    });
  });

  test("PMR: gli step iniziali a regime durano quanto l'intervallo della regola (28 gg)", () => {
    const { steps } = generateTaperingPlan(CONFIG_PMR);
    expect(steps[0].durationDays).toBe(28);
    expect(steps[1].durationDays).toBe(28);
  });

  test("PMR: sequenza completa di date attesa (indipendente dal fuso)", () => {
    const { steps } = generateTaperingPlan(CONFIG_PMR);
    const seq = steps.map(s => `${s.startDate}|${s.endDate}|${s.dose}`);
    expect(seq).toEqual([
      "2026-06-15|2026-07-12|15",
      "2026-07-13|2026-08-09|15",
      "2026-08-10|2026-09-06|12.5",
      "2026-09-07|2026-10-04|10",
      "2026-10-05|2026-11-01|7.5",
      "2026-11-02|2026-12-13|5",
      "2026-12-14|2027-02-07|5",
      "2027-02-08|2027-04-04|2.5",
      "2027-04-05|2027-06-13|0",
    ]);
  });
});
