// Pure scoring function for AssessmentForm: takes the full input state
// and returns { score, interp, ins }. Extracted from AssessmentForm.jsx
// to keep the main component focused on UI orchestration.
//
// `interp` is a function (score) => string interpretation; for the special
// `capillaroscopy` index (whose interpretation depends on the full input
// payload, not the score), the wrapper closes over the inputs.

import {
  calcDAS28_ESR, calcDAS28_CRP, calcCDAI, calcSDAI, calcBASDAI, calcASDAS_CRP, calcDAPSA,
  calcSLEDAI, calcHAQ, calcPASI, calcBASFI, calcBASMI, calcESSDAI, calcESSPRI, calcBVAS, calcMMT8, calcFIQR,
  calcMRSS, calcSchober, calcCapillaroscopy, calcLEI, calcProgettoCuore,
  interpretDAS28, interpretCDAI, interpretSDAI, interpretBASDAI, interpretASDAS, interpretDAPSA,
  interpretSLEDAI, interpretHAQ, interpretPASI, interpretBASFI, interpretBASMI, interpretESSDAI,
  interpretESSPRI, interpretBVAS, interpretMMT8, interpretFIQR, interpretMRSS, interpretSchober,
  interpretCapillaroscopy, interpretLEI, interpretProgettoCuore,
  JOINTS_DAS28,
} from "./clinimetrics";
import { countTender, countSwollen, countTenderIn, countSwollenIn } from "../components/imaging/Homunculus";

/**
 * @param {Object} state - All form state needed to compute the score.
 * @param {string} state.indexType
 * @param {Object} state.inputs - Generic numeric/boolean fields (esr, crp, gh, pga, ega, q1..q10, sex, age, sbp, tc, hdl, ...)
 * @param {Object} state.joints - Joint state map
 * @param {Object} state.pasiData
 * @param {Object} state.sledaiData
 * @param {Object} state.haqData
 * @param {Object} state.essdaiData
 * @param {Object} state.bvasData
 * @param {Object} state.mmtData
 * @param {Object} state.fiqrData
 * @param {Object} state.mrssData
 * @param {Object} state.capData
 * @param {Object} state.leiSites
 */
export function computeAssessmentScore(state) {
  const {
    indexType, inputs, joints,
    pasiData, sledaiData, haqData, essdaiData, bvasData,
    mmtData, fiqrData, mrssData, capData, leiSites,
  } = state;

  // Joint counts: homunculus is 66/68; for DAS28/CDAI/SDAI we extract the 28 subset.
  const tjc28 = countTenderIn(joints, JOINTS_DAS28);
  const sjc28 = countSwollenIn(joints, JOINTS_DAS28);
  const tjcAll = countTender(joints);
  const sjcAll = countSwollen(joints);

  switch (indexType) {
    case "das28_esr":
      return {
        score: calcDAS28_ESR({ tjc: tjc28, sjc: sjc28, esr: inputs.esr, gh: inputs.gh }),
        interp: interpretDAS28,
        ins: { ...inputs, tjc: tjc28, sjc: sjc28, tjc_all: tjcAll, sjc_all: sjcAll },
      };
    case "das28_crp":
      return {
        score: calcDAS28_CRP({ tjc: tjc28, sjc: sjc28, crp: inputs.crp, gh: inputs.gh }),
        interp: interpretDAS28,
        ins: { ...inputs, tjc: tjc28, sjc: sjc28, tjc_all: tjcAll, sjc_all: sjcAll },
      };
    case "cdai":
      return {
        score: calcCDAI({ tjc28, sjc28, pga: inputs.pga, ega: inputs.ega }),
        interp: interpretCDAI,
        ins: { ...inputs, tjc28, sjc28, tjc_all: tjcAll, sjc_all: sjcAll },
      };
    case "sdai":
      return {
        score: calcSDAI({ tjc28, sjc28, pga: inputs.pga, ega: inputs.ega, crp: inputs.crp }),
        interp: interpretSDAI,
        ins: { ...inputs, tjc28, sjc28, tjc_all: tjcAll, sjc_all: sjcAll },
      };
    case "basdai":
      return { score: calcBASDAI(inputs), interp: interpretBASDAI, ins: { ...inputs } };
    case "asdas_crp":
      return { score: calcASDAS_CRP(inputs), interp: interpretASDAS, ins: { ...inputs } };
    case "dapsa":
      return {
        score: calcDAPSA({ tjc68: tjcAll, sjc66: sjcAll, pga: inputs.pga, patientPain: inputs.patientPain, crp: inputs.crp }),
        interp: interpretDAPSA,
        ins: { ...inputs, tjc68: tjcAll, sjc66: sjcAll },
      };
    case "lei":
      return { score: calcLEI(leiSites), interp: interpretLEI, ins: { sites: leiSites } };
    case "sledai":
      return { score: calcSLEDAI(sledaiData), interp: interpretSLEDAI, ins: { items: sledaiData } };
    case "haq":
      return { score: calcHAQ(haqData), interp: interpretHAQ, ins: { categories: haqData } };
    case "pasi":
      return { score: calcPASI(pasiData), interp: interpretPASI, ins: { regions: pasiData } };
    case "basfi":
      return { score: calcBASFI(inputs), interp: interpretBASFI, ins: { ...inputs } };
    case "basmi":
      return { score: calcBASMI(inputs), interp: interpretBASMI, ins: { ...inputs } };
    case "essdai":
      return { score: calcESSDAI(essdaiData), interp: interpretESSDAI, ins: { domains: essdaiData } };
    case "esspri":
      return { score: calcESSPRI(inputs), interp: interpretESSPRI, ins: { ...inputs } };
    case "bvas":
      return { score: calcBVAS(bvasData), interp: interpretBVAS, ins: { systems: bvasData } };
    case "mmt8":
      return { score: calcMMT8(mmtData), interp: interpretMMT8, ins: { groups: mmtData } };
    case "fiqr":
      return { score: calcFIQR(fiqrData), interp: interpretFIQR, ins: fiqrData };
    case "mrss":
      return { score: calcMRSS(mrssData), interp: interpretMRSS, ins: { areas: mrssData } };
    case "schober":
      return { score: calcSchober(inputs), interp: interpretSchober, ins: { ...inputs } };
    case "capillaroscopy": {
      const sc = calcCapillaroscopy(capData);
      return { score: sc, interp: () => interpretCapillaroscopy(capData), ins: { ...capData } };
    }
    case "progetto_cuore": {
      const sc = calcProgettoCuore({
        sex: inputs.sex, age: inputs.age, sbp: inputs.sbp, tc: inputs.tc, hdl: inputs.hdl,
        diabetes: !!inputs.diabetes, smoker: !!inputs.smoker, antihtn_tx: !!inputs.antihtn_tx,
      });
      return { score: sc, interp: interpretProgettoCuore, ins: { ...inputs } };
    }
    default:
      return { score: null, interp: () => "-", ins: {} };
  }
}
