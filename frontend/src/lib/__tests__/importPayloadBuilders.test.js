import { buildWorkupVisitPayload } from "../importPayloadBuilders";

describe("buildWorkupVisitPayload — physical_exam_joint_exam (P2)", () => {
  test("importa sempre il testo EO completo", () => {
    const eo = "Polso dx tumefatto.";
    const p = buildWorkupVisitPayload({ visit_sections: { esame_obj: eo } }, "pid", "follow_up", false);
    expect(p.physical_exam).toBe(eo);
  });

  test("usa la mappa joints dal draft quando presente", () => {
    const draft = {
      visit_sections: { esame_obj: "testo qualsiasi" },
      physical_exam_joint_exam: { knee_l: "both" },
    };
    const p = buildWorkupVisitPayload(draft, "pid", "follow_up", false);
    expect(p.physical_exam_joint_exam).toEqual({ knee_l: "both" });
  });

  test("fallback: ricostruisce la mappa dal testo EO se il draft non la porta", () => {
    const p = buildWorkupVisitPayload(
      { visit_sections: { esame_obj: "Polso dx tumefatto." } },
      "pid", "follow_up", false,
    );
    expect(p.physical_exam_joint_exam).toEqual({ wrist_r: "swollen" });
  });

  test("EO negativo → physical_exam testo presente, joint exam null", () => {
    const p = buildWorkupVisitPayload(
      { visit_sections: { esame_obj: "Non sinoviti, non tumefazioni articolari." } },
      "pid", "follow_up", false,
    );
    expect(p.physical_exam).toBeTruthy();
    expect(p.physical_exam_joint_exam).toBeNull();
  });

  test("mappa vuota dal draft → null", () => {
    const p = buildWorkupVisitPayload(
      { visit_sections: { esame_obj: "" }, physical_exam_joint_exam: {} },
      "pid", "follow_up", false,
    );
    expect(p.physical_exam_joint_exam).toBeNull();
  });

  test("isolamento per-visita: due draft producono mappe distinte", () => {
    const p1 = buildWorkupVisitPayload(
      { visit_sections: { esame_obj: "Polso dx tumefatto." } },
      "pid", "follow_up", false,
    );
    const p2 = buildWorkupVisitPayload(
      { visit_sections: { esame_obj: "Ginocchio sn dolente e tumefatto." } },
      "pid", "follow_up", false,
    );
    expect(p1.physical_exam_joint_exam).toEqual({ wrist_r: "swollen" });
    expect(p2.physical_exam_joint_exam).toEqual({ knee_l: "both" });
    expect(p1.physical_exam_joint_exam).not.toEqual(p2.physical_exam_joint_exam);
  });
});

import { buildTherapyUpsertPayload } from "../importPayloadBuilders";

describe("buildTherapyUpsertPayload — raw_string (TASK P0)", () => {
  test("include raw_string quando presente nella terapia estratta", () => {
    const t = {
      drug_name: "Methotrexate",
      category: "csDMARD",
      status: "active",
      raw_string: "MTX 15mg 1v/settimana",
    };
    const p = buildTherapyUpsertPayload(t, "pid", null);
    expect(p.raw_string).toBe("MTX 15mg 1v/settimana");
  });

  test("raw_string null quando assente nel draft terapia", () => {
    const t = { drug_name: "Prednisone", category: "glucocorticoid", status: "active" };
    const p = buildTherapyUpsertPayload(t, "pid", null);
    expect(p.raw_string).toBeNull();
  });

  test("esposizione storica (discontinued + new_episode) ha raw_string preservato", () => {
    const t = {
      drug_name: "Ciclofosfamide",
      category: "csDMARD",
      status: "discontinued",
      _action: "new_episode",
      raw_string: "CYC ev 750mg mensile (sospeso 2019)",
    };
    const p = buildTherapyUpsertPayload(t, "pid", null);
    expect(p.raw_string).toBe("CYC ev 750mg mensile (sospeso 2019)");
    expect(p.event_type_override).toBe("historical_exposure");
  });
});
