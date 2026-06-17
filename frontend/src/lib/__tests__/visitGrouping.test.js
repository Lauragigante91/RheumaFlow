import { groupSidebarVisits } from "../visitGrouping";

function makeAssessment(id, date, indexType, score, visitId = null) {
  return { id, date, index_type: indexType, score, visit_id: visitId };
}

function makeWorkup(id, visitDate, visitType = "follow_up") {
  return { id, _id: id, visit_date: visitDate, visit_type: visitType };
}

describe("groupSidebarVisits", () => {
  it("workup + assessment orfano stessa data → una sola card workup, nessuna followup separata", () => {
    const workupVisits = [makeWorkup("wv-1", "2026-01-13")];
    const assessments = [makeAssessment("a-1", "2026-01-13", "basdai", 3.9)];
    const result = groupSidebarVisits({
      firstVisit: null,
      workupVisits,
      assessments,
      therapiesActiveOn: () => [],
      examsByDate: new Map(),
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("workup");
    expect(result[0].linkedAssessments).toContainEqual(
      expect.objectContaining({ id: "a-1", index_type: "basdai" })
    );
    expect(result.some((r) => r.type === "followup")).toBe(false);
  });

  it("assessment orfano su data senza workup → card followup (regressione)", () => {
    const assessments = [makeAssessment("a-2", "2026-03-10", "das28_crp", 4.1)];
    const result = groupSidebarVisits({
      firstVisit: null,
      workupVisits: [],
      assessments,
      therapiesActiveOn: () => [],
      examsByDate: new Map(),
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("followup");
    expect(result[0].data.assessments).toContainEqual(expect.objectContaining({ id: "a-2" }));
  });

  it("assessment orfano + workup su date diverse → due card distinte", () => {
    const workupVisits = [makeWorkup("wv-2", "2026-02-01")];
    const assessments = [makeAssessment("a-3", "2026-03-15", "das28_crp", 3.5)];
    const result = groupSidebarVisits({
      firstVisit: null,
      workupVisits,
      assessments,
      therapiesActiveOn: () => [],
      examsByDate: new Map(),
    });
    expect(result).toHaveLength(2);
    expect(result.some((r) => r.type === "workup" && r.date === "2026-02-01")).toBe(true);
    expect(result.some((r) => r.type === "followup" && r.date === "2026-03-15")).toBe(true);
  });

  it("assessment linkato via visit_id → aggregato alla card workup, nessuna followup", () => {
    const workupVisits = [makeWorkup("wv-3", "2026-04-10")];
    const assessments = [makeAssessment("a-4", "2026-04-10", "cdai", 8.0, "wv-3")];
    const result = groupSidebarVisits({
      firstVisit: null,
      workupVisits,
      assessments,
      therapiesActiveOn: () => [],
      examsByDate: new Map(),
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("workup");
    expect(result[0].linkedAssessments).toContainEqual(expect.objectContaining({ id: "a-4" }));
    expect(result.some((r) => r.type === "followup")).toBe(false);
  });

  it("prima visita + assessment orfano stessa data → aggregato a prima visita, nessuna followup", () => {
    const firstVisit = { referral_date: "2025-10-05T00:00:00Z", id: "fv-1" };
    const assessments = [makeAssessment("a-5", "2025-10-05", "das28_crp", 5.5)];
    const result = groupSidebarVisits({
      firstVisit,
      workupVisits: [],
      assessments,
      therapiesActiveOn: () => [],
      examsByDate: new Map(),
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("prima_visita");
    expect(result[0].linkedAssessments).toContainEqual(expect.objectContaining({ id: "a-5" }));
    expect(result.some((r) => r.type === "followup")).toBe(false);
  });

  it("più assessment orfani stessa data del workup → tutti nella linkedAssessments del workup", () => {
    const workupVisits = [makeWorkup("wv-4", "2026-05-20")];
    const assessments = [
      makeAssessment("a-6", "2026-05-20", "basdai", 4.2),
      makeAssessment("a-7", "2026-05-20", "asdas_crp", 2.1),
    ];
    const result = groupSidebarVisits({
      firstVisit: null,
      workupVisits,
      assessments,
      therapiesActiveOn: () => [],
      examsByDate: new Map(),
    });
    expect(result).toHaveLength(1);
    expect(result[0].linkedAssessments).toHaveLength(2);
  });

  it("input non mutati — non distruttivo", () => {
    const workupVisits = [makeWorkup("wv-5", "2026-06-01")];
    const assessments = [makeAssessment("a-8", "2026-06-01", "basdai", 5.0)];
    const origWvLen = workupVisits.length;
    const origALen = assessments.length;
    groupSidebarVisits({
      firstVisit: null,
      workupVisits,
      assessments,
      therapiesActiveOn: () => [],
      examsByDate: new Map(),
    });
    expect(workupVisits).toHaveLength(origWvLen);
    expect(assessments).toHaveLength(origALen);
  });

  it("ordine cronologico ascendente invariato", () => {
    const workupVisits = [makeWorkup("wv-6", "2026-04-01"), makeWorkup("wv-7", "2026-02-01")];
    const result = groupSidebarVisits({
      firstVisit: null,
      workupVisits,
      assessments: [],
      therapiesActiveOn: () => [],
      examsByDate: new Map(),
    });
    expect(result[0].date).toBe("2026-02-01");
    expect(result[1].date).toBe("2026-04-01");
  });
});
