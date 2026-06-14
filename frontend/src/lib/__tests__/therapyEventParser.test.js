import { parseTherapyEvents } from "../therapyEventParser";
import { findDrug } from "../drugs";

describe("parseTherapyEvents — launcher terapia follow-up", () => {
  test("avvio upadacitinib con dose/frequenza", () => {
    const events = parseTherapyEvents("Avvio upadacitinib 15 mg/die");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "start",
      drug_name: "Upadacitinib",
      dose: "15 mg",
      frequency: "die",
    });
  });

  test("sospensione adalimumab con motivo semplice", () => {
    const events = parseTherapyEvents("Sospendo adalimumab per inefficacia");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "stop",
      drug_name: "Adalimumab",
      reason: "inefficacia",
    });
  });

  test("sospendo ADA e avvio UPA genera due azioni ordinate", () => {
    const events = parseTherapyEvents("Sospendo ADA e avvio UPA");

    expect(events.map(e => `${e.action}:${e.drug_name}`)).toEqual([
      "stop:Adalimumab",
      "start:Upadacitinib",
    ]);
  });

  test("supportivi non riconosciuti non generano azioni", () => {
    expect(parseTherapyEvents("Aggiungo PEA/Milas/magnesio")).toHaveLength(0);
  });

  test("farmaco non gestito dal modulo terapia resta fuori dal launcher", () => {
    expect(parseTherapyEvents("Metoprololo 50 mg/die")).toHaveLength(0);
    expect(findDrug("Metoprololo")).toBeUndefined();
  });
});
