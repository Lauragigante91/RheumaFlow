// Detect specific rheumatic diagnoses from free-text.
// Each helper accepts EITHER a string (legacy) OR a patient-like object
// `{ diagnosi, diagnosi_secondarie }` so multi-diagnosis (overlap) patients
// are correctly classified by all disease profile sections.

function flatDiagnoses(d) {
  if (!d) return "";
  if (typeof d === "string") return d;
  if (typeof d === "object") {
    const parts = [d.diagnosi || ""];
    if (Array.isArray(d.diagnosi_secondarie)) {
      parts.push(...d.diagnosi_secondarie.filter(Boolean));
    }
    return parts.filter(Boolean).join(" | ");
  }
  return String(d);
}

export function isRaDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("artrite reumatoide") ||
    /(^|\s|\|)ar(\s|,|\.|\||$)/.test(s) ||
    s.includes("rheumatoid")
  );
}

export function isSpaDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("spondilo") ||
    s.includes("spondilite anchilosante") ||
    s.includes("anchilosante") ||
    s.includes("axspa") ||
    /(^|\s|\|)spa(\s|,|\.|\||$)/.test(s) ||
    /(^|\s|\|)as(\s|,|\.|\||$)/.test(s) ||
    s.includes("artrite psoriasica") ||
    s.includes("psa") ||
    s.includes("artrite psor")
  );
}

export function isSleDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("lupus") ||
    /(^|\s|\|)les(\s|,|\.|\||$)/.test(s) ||
    /(^|\s|\|)sle(\s|,|\.|\||$)/.test(s) ||
    s.includes("lupus eritematoso")
  );
}

export function isAavDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("vasculit") ||
    s.includes("anca") ||
    s.includes("gpa") ||
    s.includes("mpa") ||
    s.includes("egpa") ||
    s.includes("wegener") ||
    s.includes("churg") ||
    s.includes("poliangioite") ||
    s.includes("granulomatosi")
  );
}

export function isSjogrenDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("sjogren") ||
    s.includes("sjögren") ||
    s.includes("ssp ") ||
    /(^|\s|\|)ss(\s|,|\.|\||$)/.test(s)
  );
}

export function isMyositisDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("miosit") ||
    s.includes("dermatomiosit") ||
    s.includes("polimiosit") ||
    s.includes("iim") ||
    s.includes("miopatia infiammatoria")
  );
}

// Helper: list of all diagnoses (primary + secondary) for display
export function allDiagnoses(patient) {
  if (!patient) return [];
  const out = [];
  if (patient.diagnosi) out.push(patient.diagnosi);
  if (Array.isArray(patient.diagnosi_secondarie)) {
    for (const d of patient.diagnosi_secondarie) if (d) out.push(d);
  }
  return out;
}
