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

export function isIgaVDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("schönlein") ||
    s.includes("schonlein") ||
    s.includes("henoch") ||
    s.includes("porpora di") ||
    s.includes("igav") ||
    s.includes("iga vasculit") ||
    s.includes("vasculite iga") ||
    s.includes("vasculite ad iga") ||
    s.includes("porpora anafilattoide") ||
    s.includes("hsp")
  );
}

export function isCryoVasDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("crioglobulin") ||
    s.includes("cryoglobulin") ||
    s.includes("criovas")
  );
}

export function isUrticarialVasDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("orticarioide") ||
    s.includes("urticarial vas") ||
    s.includes("mcduffie") ||
    /(^|\s|\|)huv(\s|,|\.|\||$)/.test(s) ||
    s.includes("hypocomplementemic urticarial")
  );
}

export function isBehcetDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("behçet") ||
    s.includes("behcet") ||
    s.includes("adamantiades")
  );
}

export function isAosdDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("still") ||
    /\baosd\b/.test(s) ||
    s.includes("adult onset still") ||
    s.includes("adult-onset still")
  );
}

export function isApsDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("antifosfolipidi") ||
    s.includes("antiphospholipid") ||
    /\baps\b/.test(s) ||
    s.includes("sindrome da antifosfolipid") ||
    s.includes("sindrome antifosfolipidica")
  );
}

export function isGoutDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("gotta") ||
    s.includes("gout") ||
    s.includes("artrite gottosa") ||
    s.includes("artrite uratica") ||
    s.includes("iperuricemia sintomatica")
  );
}

export function isMctdDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    /\bmctd\b/.test(s) ||
    s.includes("connettivite mista") ||
    s.includes("malattia mista del tessuto connettivo") ||
    s.includes("sindrome di sharp") ||
    s.includes("sharp syndrome")
  );
}

export function isIgg4RdDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("igg4") ||
    s.includes("ig g4") ||
    s.includes("pancreatite autoimmune di tipo 1") ||
    s.includes("colangite igg")
  );
}

export function isRpcDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("policondrite") ||
    s.includes("relapsing polychondritis") ||
    /\brpc\b/.test(s)
  );
}

export function isPanDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("poliarterite nodosa") ||
    s.includes("polyarteritis nodosa") ||
    /\bpan\b/.test(s)
  );
}

export function isCsvvDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  // CSVV = vasculite leucocitoclastica SOLO cutanea isolata.
  // "leucocitoclastica" da solo NON è sufficiente: è la descrizione istologica
  // comune a tutte le vasculiti dei piccoli vasi (IgAV, criovas, urticarioide…).
  // Richiede esplicitamente "cutanea" o "isolata" o la sigla CSVV.
  return (
    /\bcsvv\b/.test(s) ||
    s.includes("vasculite cutanea isolata") ||
    s.includes("vasculite cutanea dei piccoli vasi") ||
    (s.includes("leucocitoclastica") && (s.includes("cutanea") || s.includes("isolata"))) ||
    (s.includes("leucocytoclastic") && (s.includes("cutaneous") || s.includes("isolat")))
  );
}

export function isAavDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  if (isIgaVDiagnosis(d)) return false;
  if (isCryoVasDiagnosis(d)) return false;
  if (isUrticarialVasDiagnosis(d)) return false;
  if (isCsvvDiagnosis(d)) return false;
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

// PMR: Polymyalgia Rheumatica
export function isPmrDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("polimialgia") ||
    s.includes("polymyalgia") ||
    /(^|\s|\|)pmr(\s|,|\.|\||$)/.test(s)
  );
}

export function isScleroDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("sclerodermi") ||
    s.includes("sclerosi sistemica") ||
    s.includes("sclerosi cutanea") ||
    /(^|\s|\|)ssc(\s|,|\.|\||$)/.test(s) ||
    s.includes("sclerosi") && (s.includes("sistema") || s.includes("progressi") || s.includes("limitata") || s.includes("diffusa"))
  );
}

// Large Vessel Vasculitis: GCA, Takayasu, LVV
export function isLvvDiagnosis(d) {
  const s = flatDiagnoses(d).toLowerCase();
  if (!s) return false;
  return (
    s.includes("takayasu") ||
    s.includes("lvv") ||
    s.includes("large vessel") ||
    s.includes("arterite di takayasu") ||
    s.includes("gca") ||
    s.includes("giant cell") ||
    s.includes("arterite a cellule giganti") ||
    s.includes("arterite temporale") ||
    s.includes("arterite di horton") ||
    s.includes("horton") ||
    (s.includes("arterite") && !s.includes("anca"))
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
