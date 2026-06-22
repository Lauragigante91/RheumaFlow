import { parseJointExam } from "../lib/jointExamParser";

const R = "_r";
const L = "_l";
const both = (b) => [b + L, b + R];
const num = (p, ns, side) =>
  ns.flatMap((n) => (side ? [`${p}${n}${side}`] : [`${p}${n}${L}`, `${p}${n}${R}`]));

const keysOf = (text) => Object.keys(parseJointExam(text).joints).sort();

describe("jointExamParser — correzioni P0", () => {
  describe("BUG-A: stato clinico dopo l'articolazione ('dolenti')", () => {
    test("MCP II-V dolenti marca tutte le MCP 2-5 bilaterali come tender", () => {
      expect(parseJointExam("MCP II-V dolenti.").joints).toEqual({
        mcp2_l: "tender",
        mcp2_r: "tender",
        mcp3_l: "tender",
        mcp3_r: "tender",
        mcp4_l: "tender",
        mcp4_r: "tender",
        mcp5_l: "tender",
        mcp5_r: "tender",
      });
    });

    test("Polsi dolenti bilateralmente marca entrambi i polsi come tender", () => {
      expect(parseJointExam("Polsi dolenti bilateralmente.").joints).toEqual({
        wrist_l: "tender",
        wrist_r: "tender",
      });
    });

    test("Gomiti dolenti bilateralmente marca entrambi i gomiti come tender", () => {
      expect(parseJointExam("Gomiti dolenti bilateralmente.").joints).toEqual({
        elbow_l: "tender",
        elbow_r: "tender",
      });
    });
  });

  describe("BUG-D: laterality al maschile ('destro' / 'sinistro')", () => {
    test("ginocchio destro produce knee_r", () => {
      expect(parseJointExam("Ginocchio destro tumefatto.").joints).toEqual({
        knee_r: "swollen",
      });
    });

    test("gomito sinistro produce elbow_l", () => {
      expect(parseJointExam("Gomito sinistro dolente.").joints).toEqual({
        elbow_l: "tender",
      });
    });
  });

  describe("BUG-B: polso singolare + BUG-D maschile", () => {
    test("polso destro produce wrist_r", () => {
      expect(parseJointExam("Polso destro tumefatto.").joints).toEqual({
        wrist_r: "swollen",
      });
    });
  });

  describe("Stato e conteggi nelle frasi a laterality e stato misti", () => {
    test("tumefazione del solo polso dx + dolorabilità MCP non gonfia l'SJC", () => {
      const r = parseJointExam("Tumefazione polso dx e dolorabilità MCP 2-3 bilateralmente.");
      expect(r.joints).toEqual({
        wrist_r: "swollen",
        mcp2_l: "tender",
        mcp2_r: "tender",
        mcp3_l: "tender",
        mcp3_r: "tender",
      });
      expect(r.tjc).toBe(4);
      expect(r.sjc).toBe(1);
    });

    test("dolorabilità e tumefazione condivise marcano tutta la lista come both", () => {
      const r = parseJointExam("Dolorabilità e tumefazione di polso dx, MCP II-III e ginocchio sinistro.");
      expect(r.joints).toEqual({
        wrist_r: "both",
        mcp2_r: "both",
        mcp3_r: "both",
        knee_l: "both",
      });
      expect(r.tjc).toBe(4);
      expect(r.sjc).toBe(4);
    });
  });
});

const CASES = [
  { id: 1, focus: "MCP+list+dx", text: "Dolorabilità alle MCP II-III-IV destra.", expected: num("mcp", [2, 3, 4], R) },
  { id: 2, focus: "PIP+range+bilat", text: "Tumefazione delle PIP 2-3 bilateralmente.", expected: num("pip", [2, 3]) },
  { id: 3, focus: "DIP single dx", text: "Sinovite DIP III destra.", expected: ["dip3_r"] },
  { id: 4, focus: "DIP1 inesistente", text: "DIP I sinistra dolente.", expected: [] },
  { id: 5, focus: "MCP+PIP+DIP tutte dx", text: "MCP, PIP e DIP della mano destra dolenti.", expected: [...num("mcp", [1, 2, 3, 4, 5], R), ...num("pip", [1, 2, 3, 4, 5], R), ...num("dip", [2, 3, 4, 5], R)] },
  { id: 6, focus: "MCP single both-status", text: "Dolore e tumefazione MCP V sinistra.", expected: ["mcp5_l"] },
  { id: 7, focus: "MCP plurale dolenti dx", text: "MCP II e III dolenti a destra.", expected: num("mcp", [2, 3], R), outOfScope: true },
  { id: 8, focus: "MCF abbrev", text: "Tumefazione MCF II-IV bilaterale.", expected: num("mcp", [2, 3, 4]) },
  { id: 9, focus: "IFP=PIP", text: "Dolorabilità IFP 2 e 3 mano destra.", expected: num("pip", [2, 3], R), outOfScope: true },
  { id: 10, focus: "MTP alluce dx", text: "Tumefazione MTP I destra.", expected: ["mtp1_r"] },
  { id: 11, focus: "MTP range piede sn", text: "Dolorabilità MTP 2-5 piede sinistro.", expected: num("mtp", [2, 3, 4, 5], L) },
  { id: 12, focus: "MTP plurale", text: "Sinovite delle MTP bilateralmente.", expected: num("mtp", [1, 2, 3, 4, 5]) },
  { id: 13, focus: "MTF abbrev", text: "MTF V destra tumefatta.", expected: ["mtp5_r"], outOfScope: true },
  { id: 14, focus: "polso destro (m)", text: "Tumefazione del polso destro.", expected: ["wrist_r"] },
  { id: 15, focus: "polsi plurale bilat", text: "Polsi dolenti bilateralmente.", expected: both("wrist") },
  { id: 16, focus: "polso dx abbrev", text: "Polso dx dolente.", expected: ["wrist_r"] },
  { id: 17, focus: "polso sn", text: "Polso sinistro tumefatto.", expected: ["wrist_l"] },
  { id: 18, focus: "caviglia dx (f)", text: "Caviglia destra tumefatta.", expected: ["ankle_r"] },
  { id: 19, focus: "caviglie plurale", text: "Caviglie dolenti.", expected: both("ankle") },
  { id: 20, focus: "caviglia sn", text: "Sinovite caviglia sinistra.", expected: ["ankle_l"] },
  { id: 21, focus: "ginocchia plurale", text: "Ginocchia tumefatte.", expected: both("knee") },
  { id: 22, focus: "ginocchio destro (m)", text: "Dolore al ginocchio destro.", expected: ["knee_r"] },
  { id: 23, focus: "ginocchio sn versam.", text: "Versamento articolare ginocchio sinistro.", expected: ["knee_l"] },
  { id: 24, focus: "entrambe ginocchia", text: "Entrambe le ginocchia tumefatte.", expected: both("knee") },
  { id: 25, focus: "spalla sn (f)", text: "Spalla sinistra dolente.", expected: ["shoulder_l"] },
  { id: 26, focus: "spalle plurale", text: "Spalle dolenti alla mobilizzazione.", expected: both("shoulder") },
  { id: 27, focus: "spalla dx", text: "Dolorabilità spalla destra.", expected: ["shoulder_r"] },
  { id: 28, focus: "gomito destro (m)", text: "Gomito destro con sinovite.", expected: ["elbow_r"] },
  { id: 29, focus: "gomiti plurale", text: "Gomiti dolenti bilateralmente.", expected: both("elbow") },
  { id: 30, focus: "sacroiliache", text: "Dolorabilità delle sacroiliache.", expected: ["si_l", "si_r"] },
  { id: 31, focus: "sacroileite bilat", text: "Sacroileite bilaterale.", expected: ["si_l", "si_r"] },
  { id: 32, focus: "sacroiliaca dx", text: "Dolore sacroiliaca destra.", expected: ["si_r"] },
  { id: 32.1, focus: "sacroileite dx", text: "Sacroileite destra.", expected: ["si_r"] },
  { id: 32.2, focus: "neg sacroileite", text: "Non si rileva sacroileite.", expected: [] },
  { id: 33, focus: "MCP bilat", text: "MCP II bilateralmente dolenti.", expected: num("mcp", [2]) },
  { id: 34, focus: "polsi bilat esplicito", text: "Tumefazione bilaterale dei polsi.", expected: both("wrist") },
  { id: 35, focus: "dx e sn", text: "Caviglia destra e sinistra tumefatte.", expected: both("ankle") },
  { id: 36, focus: "MTP range dx", text: "Sinovite MTP 2-5 destra.", expected: num("mtp", [2, 3, 4, 5], R) },
  { id: 37, focus: "MCP range romano dx", text: "MCP II-V dolenti a destra.", expected: num("mcp", [2, 3, 4, 5], R) },
  { id: 38, focus: "PIP range sn", text: "PIP 2-4 tumefatte a sinistra.", expected: num("pip", [2, 3, 4], L) },
  { id: 39, focus: "neg non si rileva", text: "Non si rileva tumefazione articolare.", expected: [] },
  { id: 40, focus: "neg assenza", text: "Assenza di sinovite a carico delle mani.", expected: [] },
  { id: 41, focus: "neg senza", text: "Mani e piedi senza artrite.", expected: [] },
  { id: 42, focus: "neg non dolenti", text: "MCP non dolenti, non tumefatte.", expected: [] },
  { id: 43, focus: "neg articolare diffuso", text: "Non si rilevano sinoviti né tumefazioni articolari.", expected: [] },
  { id: 44, focus: "polso+MCP bilat", text: "Tumefazione polso dx e dolorabilità MCP 2-3 bilateralmente.", expected: ["wrist_r", ...num("mcp", [2, 3])] },
  { id: 45, focus: "polso+MCP+ginocchio", text: "Dolorabilità e tumefazione di polso dx, MCP II-III e ginocchio sinistro.", expected: ["wrist_r", ...num("mcp", [2, 3], R), "knee_l"] },
  { id: 46, focus: "spalla+polso+MTP misti", text: "Spalla destra dolente, polso sinistro tumefatto, MTP I destra dolente.", expected: ["shoulder_r", "wrist_l", "mtp1_r"], outOfScope: true },
  { id: 47, focus: "carry-forward", text: "Dolorabilità: polso dx, MCP II dx; tumefazione: MCP III dx.", expected: ["wrist_r", "mcp2_r", "mcp3_r"] },
  { id: 48, focus: "ginocchio+caviglia dx", text: "Ginocchio e caviglia destra dolenti.", expected: ["knee_r", "ankle_r"] },
  { id: 49, focus: "OA scrosci", text: "Ginocchia con scrosci articolari, non tumefatte.", expected: [] },
  { id: 50, focus: "derm gomiti", text: "Placche psoriasiche ai gomiti.", expected: [] },
  { id: 51, focus: "derm ginocchia", text: "Lesioni cutanee alle ginocchia.", expected: [] },
  { id: 52, focus: "FTP MTP", text: "FTP positivo alle MTP bilateralmente.", expected: num("mtp", [1, 2, 3, 4, 5]) },
  { id: 53, focus: "mano dx generica", text: "Artrite a carico della mano destra.", expected: [] },
  { id: 54, focus: "dita mano", text: "Tumefazione delle dita della mano destra.", expected: [] },
  { id: 55, focus: "TMJ+spalla", text: "Dolorabilità ATM destra e spalla sinistra.", expected: ["tmj_r", "shoulder_l"] },
];

describe("jointExamParser — audit di non-regressione", () => {
  for (const c of CASES) {
    const titolo = `#${c.id} ${c.focus}: ${c.text}`;
    if (c.outOfScope) {
      test.skip(`${titolo} [limite noto, fuori scope P0]`, () => {});
      continue;
    }
    test(titolo, () => {
      expect(keysOf(c.text)).toEqual([...c.expected].sort());
    });
  }
});

describe("jointExamParser — nessun falso positivo nel corpus", () => {
  test("nessuna chiave inattesa su tutti i casi clinici (out-of-scope inclusi)", () => {
    const fpAll = [];
    for (const c of CASES) {
      const expSet = new Set(c.expected);
      for (const k of Object.keys(parseJointExam(c.text).joints)) {
        if (!expSet.has(k)) fpAll.push(`#${c.id}:${k}`);
      }
    }
    expect(fpAll).toEqual([]);
  });
});

describe("jointExamParser — P2 import homunculus per-visita", () => {
  test("EO negativo → nessuna articolazione", () => {
    const r = parseJointExam("Obiettivamente: non dolorabilità né tumefazione articolare periferica.");
    expect(r.found).toBe(false);
    expect(r.joints).toEqual({});
  });

  test("polso dx tumefatto → wrist_r swollen", () => {
    expect(parseJointExam("Polso dx tumefatto.").joints).toEqual({ wrist_r: "swollen" });
  });

  test("MCF II-III bilateralmente dolenti → mcp2/mcp3 bilaterali tender", () => {
    expect(parseJointExam("MCF II-III bilateralmente dolenti.").joints).toEqual({
      mcp2_r: "tender", mcp2_l: "tender", mcp3_r: "tender", mcp3_l: "tender",
    });
  });

  test("ginocchio sn dolente e tumefatto → knee_l both", () => {
    expect(parseJointExam("Ginocchio sn dolente e tumefatto.").joints).toEqual({ knee_l: "both" });
  });

  test("non sinoviti → nessuna articolazione", () => {
    const r = parseJointExam("Non sinoviti, non tumefazioni articolari.");
    expect(r.found).toBe(false);
    expect(r.joints).toEqual({});
  });
});
