// Detect specific rheumatic diagnoses from free-text patient.diagnosi

export function isRaDiagnosis(d) {
  if (!d) return false;
  const s = String(d).toLowerCase();
  return (
    s.includes("artrite reumatoide") ||
    /(^|\s)ar(\s|,|\.|$)/.test(s) ||
    s.includes("rheumatoid")
  );
}

export function isSpaDiagnosis(d) {
  if (!d) return false;
  const s = String(d).toLowerCase();
  return (
    s.includes("spondilo") ||
    s.includes("spondilite anchilosante") ||
    s.includes("anchilosante") ||
    s.includes("axspa") ||
    /(^|\s)spa(\s|,|\.|$)/.test(s) ||
    /(^|\s)as(\s|,|\.|$)/.test(s) ||
    s.includes("artrite psoriasica") ||
    s.includes("psa") ||
    s.includes("artrite psor")
  );
}

export function isSleDiagnosis(d) {
  if (!d) return false;
  const s = String(d).toLowerCase();
  return (
    s.includes("lupus") ||
    /(^|\s)les(\s|,|\.|$)/.test(s) ||
    /(^|\s)sle(\s|,|\.|$)/.test(s) ||
    s.includes("lupus eritematoso")
  );
}

export function isAavDiagnosis(d) {
  if (!d) return false;
  const s = String(d).toLowerCase();
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
  if (!d) return false;
  const s = String(d).toLowerCase();
  return (
    s.includes("sjogren") ||
    s.includes("sjögren") ||
    s.includes("ssp ") ||
    /(^|\s)ss(\s|,|\.|$)/.test(s)
  );
}

export function isMyositisDiagnosis(d) {
  if (!d) return false;
  const s = String(d).toLowerCase();
  return (
    s.includes("miosit") ||
    s.includes("dermatomiosit") ||
    s.includes("polimiosit") ||
    s.includes("iim") ||
    s.includes("miopatia infiammatoria")
  );
}
