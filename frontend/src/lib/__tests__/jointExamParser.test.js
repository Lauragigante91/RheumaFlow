import { parseJointExam } from "../jointExamParser";

describe("jointExamParser — P0 homunculus regressions", () => {
  test("sinovite ginocchio sinistro crea solo knee_l swollen", () => {
    const out = parseJointExam("sinovite ginocchio sinistro");

    expect(out.joints).toEqual({ knee_l: "swollen" });
    expect(out.tjc).toBe(0);
    expect(out.sjc).toBe(1);
  });

  test("sinovite ginocchio destro crea solo knee_r swollen", () => {
    const out = parseJointExam("sinovite ginocchio destro");

    expect(out.joints).toEqual({ knee_r: "swollen" });
    expect(out.tjc).toBe(0);
    expect(out.sjc).toBe(1);
  });

  test("polsi dolenti e tumefatti crea entrambi i polsi both", () => {
    const out = parseJointExam("polsi dolenti e tumefatti");

    expect(out.joints).toEqual({ wrist_r: "both", wrist_l: "both" });
    expect(out.tjc).toBe(2);
    expect(out.sjc).toBe(2);
  });

  test("non evidenti sinoviti periferiche non crea joint", () => {
    const out = parseJointExam("non evidenti sinoviti periferiche");

    expect(out.joints).toEqual({});
    expect(out.found).toBe(false);
    expect(out.tjc).toBe(0);
    expect(out.sjc).toBe(0);
  });

  test("non tumefazioni né dolorabilità articolari non crea joint", () => {
    const out = parseJointExam("non tumefazioni né dolorabilità articolari");

    expect(out.joints).toEqual({});
    expect(out.found).toBe(false);
    expect(out.tjc).toBe(0);
    expect(out.sjc).toBe(0);
  });
});
