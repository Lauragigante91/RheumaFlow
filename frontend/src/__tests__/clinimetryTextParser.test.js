/**
 * Test suite — clinimetryTextParser.js
 *
 * Copre:
 *   - Pattern singoli (DAS28-CRP, CDAI, SDAI, HAQ, BASDAI, ASDAS, BASFI, BASMI,
 *     DAPSA, PASI, LEI, ESSDAI, ESSPRI, SLEDAI, BVAS, mRSS, FIQR)
 *   - Pattern composti locali (CDAI/SDAI x/y, DAS28-CRP/ESR x/y, BASDAI/BASFI x/y, …)
 *   - Collasso sequenze di tendenza (arrow)
 *   - Strip parentetici comparativi (era / precedente / baseline)
 *   - Virgola come separatore decimale
 *   - Varianti maiuscole/minuscole
 *   - Flag ambiguous
 *   - Nessun falso positivo su numeri casuali
 */

import { parseClinimetryFromText } from "../lib/clinimetryTextParser";

// ─── helpers ──────────────────────────────────────────────────────────────────
function findItem(items, index_type) {
  return items.find((i) => i.index_type === index_type) || null;
}

// ─── DAS28 variants ───────────────────────────────────────────────────────────
describe("DAS28 variants", () => {
  test("DAS28-CRP con valore decimale (punto)", () => {
    const { items } = parseClinimetryFromText("DAS28-CRP 4.2, buon controllo.");
    const item = findItem(items, "das28_crp");
    expect(item).not.toBeNull();
    expect(item.score).toBe(4.2);
    expect(item.ambiguous).toBe(false);
  });

  test("DAS28-CRP con virgola come decimale", () => {
    const { items } = parseClinimetryFromText("DAS28-PCR: 3,8");
    const item = findItem(items, "das28_crp");
    expect(item?.score).toBe(3.8);
  });

  test("DAS28-ESR variante italiana VES", () => {
    const { items } = parseClinimetryFromText("DAS28-VES 5.6 alta attività.");
    const item = findItem(items, "das28_esr");
    expect(item?.score).toBe(5.6);
  });

  test("DAS28 ambiguo (senza specificare CRP/ESR)", () => {
    const { items } = parseClinimetryFromText("DAS28 2.9");
    const item = findItem(items, "das28_crp");
    expect(item?.ambiguous).toBe(true);
  });

  test("DAS28-CRP/ESR composto — pattern locale", () => {
    const { items } = parseClinimetryFromText("DAS28-CRP/ESR 4.1/4.3");
    expect(findItem(items, "das28_crp")?.score).toBe(4.1);
    expect(findItem(items, "das28_esr")?.score).toBe(4.3);
  });

  test("DAS28-ESR/CRP composto invertito", () => {
    const { items } = parseClinimetryFromText("DAS28-VES/PCR 5.0/4.8");
    expect(findItem(items, "das28_esr")?.score).toBe(5.0);
    expect(findItem(items, "das28_crp")?.score).toBe(4.8);
  });
});

// ─── CDAI / SDAI ──────────────────────────────────────────────────────────────
describe("CDAI e SDAI", () => {
  test("CDAI valore semplice", () => {
    const { items } = parseClinimetryFromText("CDAI 18");
    expect(findItem(items, "cdai")?.score).toBe(18);
  });

  test("SDAI valore semplice", () => {
    const { items } = parseClinimetryFromText("SDAI: 22,5");
    expect(findItem(items, "sdai")?.score).toBe(22.5);
  });

  test("CDAI/SDAI composto", () => {
    const { items } = parseClinimetryFromText("CDAI/SDAI 10/13");
    expect(findItem(items, "cdai")?.score).toBe(10);
    expect(findItem(items, "sdai")?.score).toBe(13);
  });

  test("SDAI/CDAI composto invertito", () => {
    const { items } = parseClinimetryFromText("SDAI/CDAI 15/12");
    expect(findItem(items, "sdai")?.score).toBe(15);
    expect(findItem(items, "cdai")?.score).toBe(12);
  });
});

// ─── HAQ ─────────────────────────────────────────────────────────────────────
describe("HAQ", () => {
  test("HAQ-DI con variante DI", () => {
    const { items } = parseClinimetryFromText("HAQ-DI 1.375");
    // Math.round(1.375 * 100) / 100 = 1.37 per floating-point JS (comportamento atteso)
    expect(findItem(items, "haq")?.score).toBe(1.37);
  });

  test("HAQ semplice", () => {
    const { items } = parseClinimetryFromText("HAQ 0.5");
    expect(findItem(items, "haq")?.score).toBe(0.5);
  });
});

// ─── SpA scores ───────────────────────────────────────────────────────────────
describe("SpA — BASDAI, ASDAS, BASFI, BASMI", () => {
  test("BASDAI", () => {
    const { items } = parseClinimetryFromText("BASDAI 3.2");
    expect(findItem(items, "basdai")?.score).toBe(3.2);
  });

  test("ASDAS-CRP variante PCR", () => {
    const { items } = parseClinimetryFromText("ASDAS-PCR 2.4");
    expect(findItem(items, "asdas_crp")?.score).toBe(2.4);
  });

  test("ASDAS ambiguo", () => {
    const { items } = parseClinimetryFromText("ASDAS 1.9");
    expect(findItem(items, "asdas_crp")?.ambiguous).toBe(true);
  });

  test("BASFI", () => {
    const { items } = parseClinimetryFromText("BASFI: 4,1");
    expect(findItem(items, "basfi")?.score).toBe(4.1);
  });

  test("BASMI", () => {
    const { items } = parseClinimetryFromText("BASMI 2");
    expect(findItem(items, "basmi")?.score).toBe(2);
  });

  test("BASDAI/BASFI composto", () => {
    const { items } = parseClinimetryFromText("BASDAI/BASFI 4.0/3.5");
    expect(findItem(items, "basdai")?.score).toBe(4.0);
    expect(findItem(items, "basfi")?.score).toBe(3.5);
  });

  test("BASFI/BASDAI composto invertito", () => {
    const { items } = parseClinimetryFromText("BASFI/BASDAI 3.2/3.8");
    expect(findItem(items, "basfi")?.score).toBe(3.2);
    expect(findItem(items, "basdai")?.score).toBe(3.8);
  });
});

// ─── PsA ─────────────────────────────────────────────────────────────────────
describe("PsA — DAPSA, PASI, LEI", () => {
  test("DAPSA", () => {
    const { items } = parseClinimetryFromText("DAPSA 8");
    expect(findItem(items, "dapsa")?.score).toBe(8);
  });

  test("PASI con percentuale", () => {
    const { items } = parseClinimetryFromText("PASI 7.2");
    expect(findItem(items, "pasi")?.score).toBe(7.2);
  });

  test("LEI", () => {
    const { items } = parseClinimetryFromText("LEI: 1");
    expect(findItem(items, "lei")?.score).toBe(1);
  });
});

// ─── Sjögren ──────────────────────────────────────────────────────────────────
describe("Sjögren — ESSDAI, ESSPRI", () => {
  test("ESSDAI", () => {
    const { items } = parseClinimetryFromText("ESSDAI 6");
    expect(findItem(items, "essdai")?.score).toBe(6);
  });

  test("ESSPRI", () => {
    const { items } = parseClinimetryFromText("ESSPRI 4");
    expect(findItem(items, "esspri")?.score).toBe(4);
  });

  test("ESSDAI/ESSPRI composto", () => {
    const { items } = parseClinimetryFromText("ESSDAI/ESSPRI 6/4");
    expect(findItem(items, "essdai")?.score).toBe(6);
    expect(findItem(items, "esspri")?.score).toBe(4);
  });
});

// ─── LES / Vasculiti / Miositi / SSc ─────────────────────────────────────────
describe("Altri indici specialistici", () => {
  test("SLEDAI-2K", () => {
    const { items } = parseClinimetryFromText("SLEDAI-2K 8");
    expect(findItem(items, "sledai")?.score).toBe(8);
  });

  test("SLEDAI senza suffisso", () => {
    const { items } = parseClinimetryFromText("SLEDAI 4");
    expect(findItem(items, "sledai")?.score).toBe(4);
  });

  test("BVAS v3", () => {
    const { items } = parseClinimetryFromText("BVAS v3 12");
    expect(findItem(items, "bvas")?.score).toBe(12);
  });

  test("BVAS senza versione", () => {
    const { items } = parseClinimetryFromText("BVAS 0");
    expect(findItem(items, "bvas")?.score).toBe(0);
  });

  test("mRSS", () => {
    const { items } = parseClinimetryFromText("mRSS: 14");
    expect(findItem(items, "mrss")?.score).toBe(14);
  });

  test("MMT-8", () => {
    const { items } = parseClinimetryFromText("MMT-8 62");
    expect(findItem(items, "mmt8")?.score).toBe(62);
  });

  test("FIQR", () => {
    const { items } = parseClinimetryFromText("FIQR 38");
    expect(findItem(items, "fiqr")?.score).toBe(38);
  });
});

// ─── Arrow / trend collapse ───────────────────────────────────────────────────
describe("Collasso sequenze trend (arrow)", () => {
  test("DAS28 3.5-->2.8-->2.1 → importa solo 2.1", () => {
    const { items } = parseClinimetryFromText("DAS28-CRP 3.5-->2.8-->2.1");
    expect(findItem(items, "das28_crp")?.score).toBe(2.1);
  });

  test("CDAI 25→18→10 → importa solo 10", () => {
    const { items } = parseClinimetryFromText("CDAI 25→18→10");
    expect(findItem(items, "cdai")?.score).toBe(10);
  });

  test("BASDAI con freccia semplice", () => {
    const { items } = parseClinimetryFromText("BASDAI 5.0-->3.2");
    expect(findItem(items, "basdai")?.score).toBe(3.2);
  });
});

// ─── Strip comparativi ────────────────────────────────────────────────────────
describe("Strip parentetici comparativi", () => {
  test("(era 4.5) non inquina il valore corrente", () => {
    const { items } = parseClinimetryFromText("DAS28-CRP 3.1 (era 4.5)");
    const item = findItem(items, "das28_crp");
    expect(item?.score).toBe(3.1);
  });

  test("(precedente 25/26) non inquina CDAI/SDAI", () => {
    const { items } = parseClinimetryFromText("CDAI/SDAI 10/12 (precedente 25/26)");
    expect(findItem(items, "cdai")?.score).toBe(10);
    expect(findItem(items, "sdai")?.score).toBe(12);
  });

  test("Snippets comparativi sono restituiti in comparatives[]", () => {
    const { comparatives } = parseClinimetryFromText("DAS28-CRP 2.8 (baseline 4.2)");
    expect(comparatives.length).toBeGreaterThan(0);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────
describe("Edge cases", () => {
  test("Testo vuoto → items vuoto", () => {
    expect(parseClinimetryFromText("").items).toHaveLength(0);
  });

  test("Nessun numero casuale interpretato come score", () => {
    const { items } = parseClinimetryFromText("Il paziente ha 58 anni. Peso 72 kg. PA 125/80.");
    expect(items).toHaveLength(0);
  });

  test("Più indici nello stesso testo", () => {
    const text = "DAS28-CRP 4.2, CDAI 18, HAQ 0.75, VES 32.";
    const { items } = parseClinimetryFromText(text);
    expect(findItem(items, "das28_crp")?.score).toBe(4.2);
    expect(findItem(items, "cdai")?.score).toBe(18);
    expect(findItem(items, "haq")?.score).toBe(0.75);
  });

  test("Indice duplicato: viene tenuto solo il primo", () => {
    const { items } = parseClinimetryFromText("DAS28-CRP 4.2, DAS28-CRP 3.1");
    const all = items.filter((i) => i.index_type === "das28_crp");
    expect(all).toHaveLength(1);
    expect(all[0].score).toBe(4.2);
  });

  test("Case insensitive", () => {
    const { items } = parseClinimetryFromText("das28-crp 3.9");
    expect(findItem(items, "das28_crp")?.score).toBe(3.9);
  });
});

// ─── TJC / SJC espliciti (G7) ─────────────────────────────────────────────────
describe("TJC e SJC espliciti", () => {
  test("TJC e SJC separati", () => {
    const { items } = parseClinimetryFromText("TJC 4, SJC 2.");
    expect(findItem(items, "tjc")?.score).toBe(4);
    expect(findItem(items, "sjc")?.score).toBe(2);
  });

  test("TJC e SJC inline con DAS28", () => {
    const { items } = parseClinimetryFromText("TJC 6, SJC 4. DAS28-CRP 4.2.");
    expect(findItem(items, "tjc")?.score).toBe(6);
    expect(findItem(items, "sjc")?.score).toBe(4);
    expect(findItem(items, "das28_crp")?.score).toBe(4.2);
  });

  test("TJC senza SJC", () => {
    const { items } = parseClinimetryFromText("Articolazioni dolenti TJC 8.");
    expect(findItem(items, "tjc")?.score).toBe(8);
    expect(findItem(items, "sjc")).toBeNull();
  });

  test("TJC e SJC non marcati ambiguous", () => {
    const { items } = parseClinimetryFromText("TJC 4, SJC 2.");
    expect(findItem(items, "tjc")?.ambiguous).toBe(false);
    expect(findItem(items, "sjc")?.ambiguous).toBe(false);
  });
});
