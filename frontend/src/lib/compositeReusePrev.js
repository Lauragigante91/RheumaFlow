// Pure functions to map a previous visit's assessments into setter calls
// for the CompositeAssessmentDialog. Extracted to keep the dialog focused
// on UI orchestration.
//
// Each function takes:
//   - prevVisit: { date: ISO string, items: Array<assessment doc> }
//   - setters: object with setX functions matching the dialog state
// and applies the patches directly via the provided setters.

function _rebuildJointsFrom(assessment) {
  const out = {};
  (assessment?.tender_joints || []).forEach((k) => {
    out[k] = "tender";
  });
  (assessment?.swollen_joints || []).forEach((k) => {
    out[k] = out[k] === "tender" ? "both" : "swollen";
  });
  return out;
}

export function applyPrevToRa(prevVisit, setters) {
  const byType = Object.fromEntries((prevVisit?.items || []).map((a) => [a.index_type, a]));
  const src = byType.das28_esr || byType.das28_crp || byType.cdai || byType.sdai;
  setters.setJoints(_rebuildJointsFrom(src));
  const ins = src?.inputs || {};
  setters.setEsr(ins.esr ?? "");
  setters.setCrp(ins.crp ?? "");
  setters.setPga(Number(ins.pga) || 0);
  setters.setEga(Number(ins.ega) || 0);
}

export function applyPrevToSpa(prevVisit, setters) {
  const byType = Object.fromEntries((prevVisit?.items || []).map((a) => [a.index_type, a]));
  const basdai = byType.basdai?.inputs || {};
  const asdas = byType.asdas_crp?.inputs || {};
  const basfi = byType.basfi?.inputs || {};
  setters.setBas({
    q1: basdai.q1 ?? "",
    q2: basdai.q2 ?? asdas.backPain ?? "",
    q3: basdai.q3 ?? asdas.peripheralPain ?? "",
    q4: basdai.q4 ?? "",
    q5: basdai.q5 ?? "",
    q6: basdai.q6 ?? asdas.morningStiffness ?? "",
  });
  setters.setAsdasPga(Number(asdas.pga) || 0);
  setters.setCrp(asdas.crp ?? "");
  const bf = {};
  for (let i = 1; i <= 10; i++) bf[`q${i}`] = basfi[`q${i}`] ?? "";
  setters.setBasfiVals(bf);
}

export function applyPrevToPsa(prevVisit, setters) {
  const byType = Object.fromEntries((prevVisit?.items || []).map((a) => [a.index_type, a]));
  const dapsa = byType.dapsa;
  const dapsaIns = dapsa?.inputs || {};
  setters.setJoints(_rebuildJointsFrom(dapsa));
  setters.setPga(Number(dapsaIns.pga) || 0);
  setters.setPatientPain(Number(dapsaIns.patientPain) || 0);
  setters.setCrp(dapsaIns.crp ?? "");
  const lei = byType.lei?.inputs || {};
  setters.setLeiSites(lei.sites || {});
  const pasiIns = byType.pasi?.inputs || {};
  const pd = { head: {}, upper: {}, trunk: {}, lower: {} };
  ["head", "upper", "trunk", "lower"].forEach((reg) => {
    if (pasiIns[reg]) pd[reg] = { ...pasiIns[reg] };
  });
  setters.setPasiData(pd);
}
