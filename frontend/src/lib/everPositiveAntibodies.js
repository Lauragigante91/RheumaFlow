/**
 * everPositiveAntibodies.js
 *
 * Logic for the "ever-positive antibody" feature.
 * An antibody that was ever positive in the patient's lab history is
 * considered a persistent historical finding and should pre-fill
 * the corresponding disease profile field.
 *
 * Rules:
 * - Only auto-fills fields that are currently "unknown" and NOT in
 *   the profile's dismissed_antibodies list.
 * - If the user manually sets a field to "negative", that key is added
 *   to dismissed_antibodies and is never auto-applied again unless
 *   the user explicitly sets it back to "positive".
 */

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns true if a single lab value entry counts as positive.
 * Handles both numeric (status = "positive"|"high") and qualitative entries.
 */
export function isLabValuePositive(v) {
  if (!v) return false;
  const { status, qualitative, value } = v;
  if (status === "positive" || status === "high") return true;
  if (typeof qualitative === "string") {
    const q = qualitative.toLowerCase();
    if (q.includes("pos") || q.includes("rilevat") || q.includes("present")) return true;
  }
  if (typeof value === "string") {
    const s = value.toLowerCase().trim();
    if (s === "pos" || s === "positivo" || s === "presente") return true;
  }
  return false;
}

/**
 * Scans the values dict of a single lab exam and returns
 * a set of lab-panel keys that were positive.
 */
function positiveKeysInExam(exam) {
  const keys = new Set();
  if (!exam?.values) return keys;
  for (const [k, v] of Object.entries(exam.values)) {
    if (isLabValuePositive(v)) keys.add(k);
  }
  return keys;
}

/**
 * Given the full array of a patient's lab exams, returns
 *   Map<labKey, { positiveDate, titer }>
 * where positiveDate is the most recent date the key was positive.
 */
export function computeEverPositiveMap(labExams) {
  if (!Array.isArray(labExams)) return new Map();
  const map = new Map();

  for (const exam of labExams) {
    if (!exam?.values) continue;
    for (const [k, v] of Object.entries(exam.values)) {
      if (!isLabValuePositive(v)) continue;
      const existing = map.get(k);
      const date = exam.date || "";
      if (!existing || date > existing.positiveDate) {
        map.set(k, {
          positiveDate: date,
          titer: v.value != null ? String(v.value) + (v.unit ? " " + v.unit : "") : "",
        });
      }
    }
  }
  return map;
}

// ── Disease mapping ─────────────────────────────────────────────────────────
//
// Each mapping entry describes one antibody:
//   labKey      — key in the autoanticorpi panel (labPanels.js)
//   profileKey  — field path inside profile data for this disease
//   titerField  — optional companion field for the titer string
//   positiveValue  — the value to write into profileKey when positive
//   style       — "flat"   → data[profileKey] = positiveValue
//                 "nested" → data.antibodies[profileKey].status = positiveValue
//                 "ssc"    → profile.antibody[profileKey] = "pos"
//                 "myositis" → data.antibodies[profileKey] = positiveValue

export const DISEASE_ANTIBODY_MAP = {
  // ── Artrite Reumatoide ───────────────────────────────────────────────────
  ra: [
    { labKey: "fr",          profileKey: "rf_status",   titerField: "rf_titer",   positiveValue: "positive", style: "flat" },
    { labKey: "acpa_anti_ccp", profileKey: "acpa_status", titerField: "acpa_titer", positiveValue: "positive", style: "flat" },
  ],

  // ── Lupus Eritematoso Sistemico ──────────────────────────────────────────
  sle: [
    { labKey: "anti_dsdna",    profileKey: "dsdna",    positiveValue: "positive", style: "nested" },
    { labKey: "anti_sm",       profileKey: "sm",       positiveValue: "positive", style: "nested" },
    { labKey: "anti_ssa_ro",   profileKey: "ro_ssa",   positiveValue: "positive", style: "nested" },
    { labKey: "anti_ssb_la",   profileKey: "la_ssb",   positiveValue: "positive", style: "nested" },
    { labKey: "anti_rnp",      profileKey: "rnp",      positiveValue: "positive", style: "nested" },
    { labKey: "lac",           profileKey: "apl_lac",  positiveValue: "positive", style: "nested" },
    { labKey: "acl_igg",       profileKey: "apl_acl",  positiveValue: "positive", style: "nested" },
    { labKey: "b2gp1_igg",     profileKey: "apl_b2gpi",positiveValue: "positive", style: "nested" },
  ],

  // ── Sclerosi Sistemica ───────────────────────────────────────────────────
  // Uses scleroProfileApi → profile.antibody.{key} with "pos"/"neg"/null
  ssc: [
    { labKey: "anti_scl70",      profileKey: "scl70",    positiveValue: "pos", style: "ssc" },
    { labKey: "anti_centromero", profileKey: "aca",      positiveValue: "pos", style: "ssc" },
    { labKey: "anti_rnap3",      profileKey: "rnap3",    positiveValue: "pos", style: "ssc" },
    { labKey: "anti_pmscl",      profileKey: "pm_scl",   positiveValue: "pos", style: "ssc" },
    { labKey: "anti_ku",         profileKey: "ku",       positiveValue: "pos", style: "ssc" },
    { labKey: "anti_rnp",        profileKey: "u1rnp",    positiveValue: "pos", style: "ssc" },
  ],

  // ── Sindrome di Sjögren ──────────────────────────────────────────────────
  sjogren: [
    { labKey: "anti_ssa_ro",  profileKey: "ssa_ro", positiveValue: "positive", style: "nested" },
    { labKey: "anti_ssb_la",  profileKey: "ssb_la", positiveValue: "positive", style: "nested" },
    { labKey: "fr",           profileKey: "rf",     positiveValue: "positive", style: "nested" },
  ],

  // ── Miosite / Miopatie infiammatorie ─────────────────────────────────────
  myositis: [
    { labKey: "anti_jo1",   profileKey: "jo1",    positiveValue: "positive", style: "myositis" },
    { labKey: "anti_mi2",   profileKey: "mi2",    positiveValue: "positive", style: "myositis" },
    { labKey: "anti_mda5",  profileKey: "mda5",   positiveValue: "positive", style: "myositis" },
    { labKey: "anti_tif1g", profileKey: "tif1g",  positiveValue: "positive", style: "myositis" },
    { labKey: "anti_nxp2",  profileKey: "nxp2",   positiveValue: "positive", style: "myositis" },
    { labKey: "anti_srp",   profileKey: "srp",    positiveValue: "positive", style: "myositis" },
    { labKey: "anti_hmgcr", profileKey: "hmgcr",  positiveValue: "positive", style: "myositis" },
    { labKey: "anti_pmscl", profileKey: "pm_scl", positiveValue: "positive", style: "myositis" },
    { labKey: "anti_ku",    profileKey: "ku",      positiveValue: "positive", style: "myositis" },
    { labKey: "anti_rnp",   profileKey: "u1rnp",  positiveValue: "positive", style: "myositis" },
    { labKey: "anti_ssa_ro",profileKey: "ro52",   positiveValue: "positive", style: "myositis" },
  ],
};

// ── Per-disease applier ─────────────────────────────────────────────────────

/**
 * Returns a suggested partial update to profileData for the given disease,
 * based on ever-positive lab history.
 *
 * Only suggests fields that are currently "unknown" / missing AND
 * are NOT in profileData.dismissed_antibodies.
 *
 * @param {string} disease         — one of: ra | sle | ssc | sjogren | myositis
 * @param {object} profileData     — current profile data object (may be {} for new profiles)
 * @param {Map}    everPositiveMap  — output of computeEverPositiveMap(labExams)
 * @returns {{ patch: object, applied: string[] }}
 *   patch   — a deep-merge-ready object with the suggested updates
 *   applied — list of profileKey strings that were auto-applied (for UI badge display)
 */
export function buildEverPositivePatch(disease, profileData, everPositiveMap) {
  const mapping = DISEASE_ANTIBODY_MAP[disease];
  if (!mapping || everPositiveMap.size === 0) return { patch: {}, applied: [] };

  const dismissed = new Set(profileData?.dismissed_antibodies || []);
  const patch = {};
  const applied = [];

  for (const m of mapping) {
    if (!everPositiveMap.has(m.labKey)) continue;
    if (dismissed.has(m.profileKey)) continue;

    const info = everPositiveMap.get(m.labKey);

    if (m.style === "flat") {
      const current = profileData?.[m.profileKey];
      if (current && current !== "unknown") continue;
      patch[m.profileKey] = m.positiveValue;
      if (m.titerField && info.titer && !profileData?.[m.titerField]) {
        patch[m.titerField] = info.titer;
      }
      applied.push(m.profileKey);

    } else if (m.style === "nested") {
      const current = profileData?.antibodies?.[m.profileKey]?.status;
      if (current && current !== "unknown") continue;
      if (!patch.antibodies) patch.antibodies = {};
      patch.antibodies[m.profileKey] = {
        ...(profileData?.antibodies?.[m.profileKey] || {}),
        status: m.positiveValue,
      };
      applied.push(m.profileKey);

    } else if (m.style === "ssc") {
      const current = profileData?.antibody?.[m.profileKey];
      if (current && current !== null) continue;
      if (!patch.antibody) patch.antibody = {};
      patch.antibody[m.profileKey] = m.positiveValue;
      applied.push(m.profileKey);

    } else if (m.style === "myositis") {
      const current = profileData?.antibodies?.[m.profileKey];
      if (current && current !== "unknown") continue;
      if (!patch.antibodies) patch.antibodies = {};
      patch.antibodies[m.profileKey] = m.positiveValue;
      applied.push(m.profileKey);
    }
  }

  return { patch, applied };
}

/**
 * Deep merges `patch` into `base` (one level of nesting for antibodies/antibody).
 */
export function mergeEverPositivePatch(base, patch) {
  const result = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      result[k] = { ...(base[k] || {}), ...v };
    } else {
      result[k] = v;
    }
  }
  return result;
}
