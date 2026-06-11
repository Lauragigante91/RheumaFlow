/**
 * PmrLvvTimeline — unified "one row = one outpatient visit" longitudinal table
 * for PMR / GCA / LVV patients.
 *
 * Column layout:
 *   Date | VES | PCR | GC | Attività/Sintomi | Terapia | ECO | DOPPLER | PET/CT | CTA | MRA | Piano
 *
 * Each imaging column shows a compact clickable badge only when data exists for that date.
 * Clicking opens the relevant structured exam dialog via onEditImaging(assessment).
 * PET/CT cell shows [PET+]/[PET-] badge + PETVAS score beneath it.
 *
 * Props:
 *   assessments      — full patient assessment list
 *   therapies        — full patient therapy list
 *   labExams         — full patient lab exam list
 *   onEditImaging(a) — open the appropriate dialog for assessment a
 *   onEditVisit(a)   — open pmr_activity detail/edit (optional)
 */
import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Stethoscope } from "lucide-react";
import { categoryColor } from "../../lib/drugs";

// ─── Symptom compact map ───────────────────────────────────────────────────────
const SYMPTOM_COMPACT = {
  shoulder_pain:     { short: "Spalle",   emoji: "🔺", cls: "bg-red-50 border-red-200 text-red-700" },
  hip_pain:          { short: "Anche",    emoji: "🔻", cls: "bg-orange-50 border-orange-200 text-orange-700" },
  morning_stiffness: { short: "Rigidità", emoji: "🌅", cls: "bg-blue-50 border-blue-200 text-blue-700" },
  headache:          { short: "Cefalea",  emoji: "🤕", cls: "bg-rose-50 border-rose-200 text-rose-700" },
  jaw_claudication:  { short: "Claudic.", emoji: "😖", cls: "bg-rose-50 border-rose-200 text-rose-800" },
  visual_symptoms:   { short: "Visivi",   emoji: "👁️", cls: "bg-indigo-50 border-indigo-200 text-indigo-700" },
  fever:             { short: "Febbre",   emoji: "🌡️", cls: "bg-amber-50 border-amber-200 text-amber-700" },
  fatigue:           { short: "Astenia",  emoji: "😴", cls: "bg-gray-100 border-gray-300 text-gray-600" },
  weight_loss:       { short: "Calo p.",  emoji: "⚖️", cls: "bg-yellow-50 border-yellow-200 text-yellow-800" },
  limb_pain:         { short: "Arti",     emoji: "🦵", cls: "bg-amber-50 border-amber-200 text-amber-800" },
  pain:              { short: "Dolore",   emoji: "🔴", cls: "bg-red-50 border-red-200 text-red-700" },
  adverse_events:    { short: "AE",       emoji: "⚠️", cls: "bg-yellow-50 border-yellow-300 text-yellow-900" },
};

// ─── Disease activity map ──────────────────────────────────────────────────────
const ACTIVITY_MAP = {
  clinical_remission:     { l: "Remissione",  cls: "bg-green-50 border-green-200 text-green-700" },
  suspected_pmr_activity: { l: "Att. PMR",    cls: "bg-amber-50 border-amber-200 text-amber-700" },
  suspected_cranial_gca:  { l: "GCA cranica", cls: "bg-red-50 border-red-300 text-red-700" },
  suspected_lvv_activity: { l: "LVV attiva",  cls: "bg-purple-50 border-purple-300 text-purple-700" },
  damage_no_activity:     { l: "Danno",       cls: "bg-gray-100 border-gray-300 text-gray-600" },
  alternative_cause:      { l: "Causa alt.",  cls: "bg-orange-50 border-orange-300 text-orange-700" },
};

const GC_NAMES = ["prednisone","prednisolone","methylprednisolone","metilprednisolone","cortisone",
  "deflazacort","betametasone","betamethasone","desametasone","dexamethasone"];

const IMAGING_TYPES = new Set(["petvas","ecodoppler","angio_ct","angio_mri","echo_msk"]);

// ─── Color helpers ─────────────────────────────────────────────────────────────
function esrCls(v) {
  if (v == null) return "text-gray-300";
  if (v > 40)  return "text-red-700 font-black";
  if (v > 20)  return "text-amber-700 font-bold";
  return "text-green-700 font-bold";
}
function crpCls(v) {
  if (v == null) return "text-gray-300";
  if (v > 10) return "text-red-700 font-black";
  if (v > 5)  return "text-amber-700 font-bold";
  return "text-green-700 font-bold";
}
function gcNumCls(v) {
  if (v == null) return "text-gray-300";
  if (v > 25) return "text-red-700 font-black";
  if (v > 10) return "text-orange-700 font-bold";
  if (v > 0)  return "text-green-700 font-bold";
  return "text-gray-400";
}

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("it-IT"); } catch { return iso; }
}

function petPosFromA(a) {
  if (!a) return null;
  if (a.structured_values?.pet_positive != null) return a.structured_values.pet_positive;
  if (a.inputs?.pet_positive != null) return a.inputs.pet_positive;
  const t = a.structured_values?.territories ?? a.inputs?.territories ?? {};
  if (!Object.keys(t).length) return null;
  return Object.values(t).some(v => v >= 2);
}

function ecoMskHasFindings(a) {
  if (!a) return false;
  const sv = a.structured_values || {};
  return (sv.active_sites?.length > 0) || (a.inputs?.active_sites?.length > 0) ||
    (a.result === "positive") || (a.summary && /reperto|positiv|sinovite|borsit/i.test(a.summary));
}

function dopplerHasFindings(a) {
  if (!a) return false;
  const sv = a.structured_values || {};
  return (sv.active_districts?.length > 0) || (a.inputs?.active_districts?.length > 0) ||
    (a.result === "positive") || (a.summary && /reperto|positiv|halo|stenosi/i.test(a.summary));
}

function angioHasFindings(a) {
  if (!a) return false;
  return (a.result === "positive") ||
    (a.summary && /positiv|patolog|stenosi|aneuris/i.test(a.summary)) ||
    (a.structured_values?.active_districts?.length > 0);
}

function activeTherapiesOn(therapies, isoDate) {
  if (!isoDate || !therapies?.length) return [];
  return therapies.filter(t => {
    if (t.start_date && isoDate < t.start_date) return false;
    if (t.end_date   && isoDate > t.end_date)   return false;
    return true;
  });
}

function gcFromTherapies(ths) {
  for (const t of ths) {
    const name = (t.drug_name || "").toLowerCase();
    if (GC_NAMES.some(g => name.includes(g))) {
      return t.dose ? parseFloat(t.dose) || null : null;
    }
  }
  return null;
}

function labValueForDate(labExams, date) {
  let esr = null, crp = null;
  for (const e of (labExams || [])) {
    if ((e.date || "").slice(0, 10) !== date) continue;
    const vals = e.values || {};
    if (esr == null) {
      const k = Object.keys(vals).find(k => /ves|esr|velocità|eritrociti/i.test(k));
      if (k) esr = parseFloat(vals[k]?.value) || null;
    }
    if (crp == null) {
      const k = Object.keys(vals).find(k => /pcr|crp|proteina\s*c|reactive\s*protein/i.test(k));
      if (k) crp = parseFloat(vals[k]?.value) || null;
    }
    if (esr != null && crp != null) break;
  }
  return { esr, crp };
}

// ─── Column definitions (12 columns) ──────────────────────────────────────────
const COL_COUNT = 12;

// ─── Main component ────────────────────────────────────────────────────────────
export default function PmrLvvTimeline({ assessments, instrumentalExams, therapies, labExams, onEditImaging, onEditVisit }) {
  const [expanded, setExpanded] = useState(null);

  const rows = useMemo(() => {
    const byDate = new Map();

    const getOrCreate = (date) => {
      if (!byDate.has(date)) {
        byDate.set(date, {
          date,
          pmrA: null,
          petvas: null, ecodoppler: null, angio_ct: null, angio_mri: null, echo_msk: null,
          esr: null, crp: null, steroidNum: null, gcDoseStr: null,
          symptoms: [], diseaseActivity: null,
          therapies: [],
          notes: null,
        });
      }
      return byDate.get(date);
    };

    // Clinical PMR/GCA activity assessments (assessments collection)
    for (const a of (assessments || [])) {
      const d = (a.date || "").slice(0, 10);
      if (!d) continue;
      if (a.index_type === "pmr_activity") {
        const row = getOrCreate(d);
        if (!row.pmrA || a.date > row.pmrA.date) row.pmrA = a;
      }
    }

    // Imaging exams (instrumental_exams collection)
    for (const a of (instrumentalExams || [])) {
      const d = (a.exam_date || "").slice(0, 10);
      if (!d) continue;
      if (IMAGING_TYPES.has(a.exam_type)) {
        const row = getOrCreate(d);
        const cur = row[a.exam_type];
        if (!cur || a.exam_date > cur.exam_date) row[a.exam_type] = a;
      }
    }

    // pull lab-only dates
    for (const e of (labExams || [])) {
      const d = (e.date || "").slice(0, 10);
      if (!d) continue;
      const vals = e.values || {};
      const hasRel = Object.keys(vals).some(k => /ves|esr|pcr|crp|proteina\s*c/i.test(k));
      if (hasRel) getOrCreate(d);
    }

    for (const [date, row] of byDate) {
      const pmrA = row.pmrA;
      let esr = pmrA?.inputs?.esr ?? null;
      let crp = pmrA?.inputs?.crp ?? null;
      if (esr == null || crp == null) {
        const lab = labValueForDate(labExams, date);
        if (esr == null) esr = lab.esr;
        if (crp == null) crp = lab.crp;
      }
      row.esr = esr;
      row.crp = crp;

      const steroidNum = pmrA?.inputs?.steroid_mg ?? null;
      row.steroidNum = steroidNum;
      const activeTher = activeTherapiesOn(therapies, date);
      row.therapies = activeTher;

      if (steroidNum != null) {
        row.gcDoseStr = `${steroidNum} mg`;
      } else {
        const gcN = gcFromTherapies(activeTher);
        row.gcDoseStr = gcN != null ? `${gcN} mg` : null;
        row.steroidNum = gcN;
      }

      row.symptoms        = pmrA?.inputs?.symptoms ?? [];
      row.diseaseActivity = pmrA?.inputs?.disease_activity ?? null;
      row.notes           = pmrA?.notes ?? null;
    }

    return [...byDate.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter(row =>
        row.pmrA != null ||
        Object.keys({ petvas:1, ecodoppler:1, angio_ct:1, angio_mri:1, echo_msk:1 })
          .some(k => row[k] != null) ||
        row.esr != null || row.crp != null
      );
  }, [assessments, instrumentalExams, therapies, labExams]);

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-400 italic">
        Nessuna visita PMR/GCA registrata. Usa "Visita di oggi" per iniziare.
      </div>
    );
  }

  const totalImaging = rows.reduce((n, r) =>
    n + (r.petvas ? 1 : 0) + (r.ecodoppler ? 1 : 0) + (r.angio_ct ? 1 : 0) +
        (r.angio_mri ? 1 : 0) + (r.echo_msk ? 1 : 0), 0);

  return (
    <div className="rounded-xl border border-[#0A2540]/10 overflow-hidden shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 bg-[#0A2540]/5 border-b border-[#0A2540]/10">
        <span className="text-[10px] uppercase tracking-widest font-bold text-[#0A2540]">
          Visit History — una riga per visita
        </span>
        <span className="text-[10px] text-gray-400">
          {rows.length} {rows.length === 1 ? "visita" : "visite"}
          {totalImaging > 0 && ` · ${totalImaging} esami imaging`}
        </span>
        <div className="ml-auto flex items-center gap-4 text-[9px] text-gray-500 flex-wrap">
          <span className="flex gap-1 items-center"><span className="font-bold text-rose-600">ECO</span> eco muscolo-artic.</span>
          <span className="flex gap-1 items-center"><span className="font-bold text-blue-600">DOPPLER</span> eco vascolare</span>
          <span className="flex gap-1 items-center"><span className="font-bold text-rose-700">PET+/−</span> + PETVAS score</span>
          <span className="text-gray-400 opacity-60">Clic badge → apre esame</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: "1080px" }}>
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              {/* Date */}
              <th className="px-3 py-2 text-left text-[9px] uppercase tracking-widest font-bold text-gray-500 w-[96px] sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                Data
              </th>
              {/* VES */}
              <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-gray-500 w-[56px] border-r border-gray-100">
                VES<br /><span className="font-normal normal-case text-gray-400">mm/h</span>
              </th>
              {/* CRP */}
              <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-gray-500 w-[56px] border-r border-gray-100">
                PCR<br /><span className="font-normal normal-case text-gray-400">mg/L</span>
              </th>
              {/* GC */}
              <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-orange-700 w-[70px] border-r border-orange-200 bg-orange-50/60">
                GC<br /><span className="font-normal normal-case text-orange-400">mg/die</span>
              </th>
              {/* Activity/Symptoms */}
              <th className="px-3 py-2 text-left text-[9px] uppercase tracking-widest font-bold text-gray-500 w-[150px] border-r border-gray-100">
                Attività / Sintomi
              </th>
              {/* Therapy */}
              <th className="px-3 py-2 text-left text-[9px] uppercase tracking-widest font-bold text-gray-500 w-[160px] border-r border-gray-100">
                Terapia
              </th>
              {/* ECO — articular ultrasound */}
              <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-teal-700 w-[64px] border-r border-teal-100 bg-teal-50/40">
                Articular<br />ultrasound
              </th>
              {/* DOPPLER — vascular */}
              <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-blue-700 w-[68px] border-r border-blue-100 bg-blue-50/30">
                Vascular<br />Doppler
              </th>
              {/* PET/CT */}
              <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-rose-700 w-[72px] border-r border-rose-100 bg-rose-50/30">
                PET/CT<br /><span className="font-normal normal-case text-rose-400">+PETVAS</span>
              </th>
              {/* CTA */}
              <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-amber-700 w-[58px] border-r border-amber-100 bg-amber-50/30">
                CTA
              </th>
              {/* MRA */}
              <th className="px-2 py-2 text-center text-[9px] uppercase tracking-widest font-bold text-purple-700 w-[58px] border-r border-purple-100 bg-purple-50/30">
                MRA
              </th>
              {/* Plan */}
              <th className="px-3 py-2 text-left text-[9px] uppercase tracking-widest font-bold text-gray-500 min-w-[120px]">
                Piano / Note
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.map(row => {
              const isExp = expanded === row.date;
              const act   = ACTIVITY_MAP[row.diseaseActivity];
              const hasAnyImaging = row.petvas || row.ecodoppler || row.angio_ct || row.angio_mri || row.echo_msk;
              const hasClinical   = row.pmrA != null;
              const hasDetail     = row.pmrA?.inputs?.pain_vas != null ||
                row.pmrA?.inputs?.stiffness_min != null || row.notes;

              // PET
              const petPos   = petPosFromA(row.petvas);
              const petScore = row.petvas?.structured_values?.petvas_score ?? row.petvas?.score ?? null;

              // Dot color
              let dotCls = "bg-gray-300";
              if (petPos === true)  dotCls = "bg-red-500";
              else if (petPos === false) dotCls = "bg-green-500";
              else if (hasClinical) dotCls = "bg-[#0A2540]/40";

              return (
                <React.Fragment key={row.date}>
                  <tr className={`group transition-colors ${isExp ? "bg-blue-50/20" : "hover:bg-gray-50/40"}`}>

                    {/* ── Date ── */}
                    <td className="px-3 py-2 align-top sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 border-r border-gray-200">
                      <button
                        type="button"
                        onClick={() => setExpanded(isExp ? null : row.date)}
                        className="text-left w-full hover:text-blue-700 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls}`} />
                          <span className="font-bold text-[11px] text-[#0A2540]">{fmtDate(row.date)}</span>
                          {hasDetail
                            ? (isExp
                                ? <ChevronDown className="w-3 h-3 text-blue-400" />
                                : <ChevronRight className="w-3 h-3 text-gray-300" />)
                            : null}
                        </span>
                        <span className="text-[9px] text-gray-400 pl-3.5 block">
                          {new Date(row.date).toLocaleDateString("it-IT", { weekday: "short" })}
                          {!hasClinical && hasAnyImaging && (
                            <span className="ml-1 italic text-purple-400">solo imaging</span>
                          )}
                        </span>
                      </button>
                    </td>

                    {/* ── VES ── */}
                    <td className={`px-2 py-2 text-center align-middle border-r border-gray-100 ${esrCls(row.esr)}`}>
                      {row.esr != null
                        ? <span className="font-mono text-sm">{row.esr}</span>
                        : <span className="text-gray-200">—</span>}
                    </td>

                    {/* ── CRP ── */}
                    <td className={`px-2 py-2 text-center align-middle border-r border-gray-100 ${crpCls(row.crp)}`}>
                      {row.crp != null
                        ? <span className="font-mono text-sm">{row.crp}</span>
                        : <span className="text-gray-200">—</span>}
                    </td>

                    {/* ── GC dose ── */}
                    <td className="px-2 py-2 text-center align-middle border-r border-orange-100 bg-orange-50/20">
                      {row.gcDoseStr
                        ? <span className={`font-mono text-sm ${gcNumCls(row.steroidNum)}`}>{row.gcDoseStr}</span>
                        : <span className="text-gray-200">—</span>}
                    </td>

                    {/* ── Activity / Symptoms ── */}
                    <td className="px-3 py-2 align-middle border-r border-gray-100">
                      <div className="flex flex-wrap gap-1">
                        {act && (
                          <span className={`inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-full border ${act.cls}`}>
                            {act.l}
                          </span>
                        )}
                        {row.symptoms.slice(0, 3).map(k => {
                          const s = SYMPTOM_COMPACT[k] ?? { short: k, emoji: "•", cls: "bg-gray-100 border-gray-200 text-gray-600" };
                          return (
                            <span key={k}
                              className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${s.cls}`}
                              title={s.short}
                            >
                              {s.emoji} {s.short}
                            </span>
                          );
                        })}
                        {row.symptoms.length > 3 && (
                          <span className="text-[9px] text-gray-400">+{row.symptoms.length - 3}</span>
                        )}
                        {!act && row.symptoms.length === 0 && (
                          <span className="text-gray-200 text-[10px]">—</span>
                        )}
                      </div>
                    </td>

                    {/* ── Therapy ── */}
                    <td className="px-3 py-2 align-middle border-r border-gray-100">
                      {row.therapies.length === 0
                        ? <span className="text-gray-200">—</span>
                        : (
                          <div className="flex flex-wrap gap-1">
                            {row.therapies.slice(0, 4).map(t => (
                              <span key={t.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-white border border-gray-200 shadow-sm"
                                title={`${t.drug_name}${t.dose ? ` · ${t.dose}` : ""}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: categoryColor(t.category) }} />
                                <span className="font-medium">{t.drug_name}</span>
                                {t.dose && <span className="text-gray-400">{t.dose}</span>}
                              </span>
                            ))}
                            {row.therapies.length > 4 && (
                              <span className="text-[9px] text-gray-400 self-center">+{row.therapies.length - 4}</span>
                            )}
                          </div>
                        )}
                    </td>

                    {/* ── ECO — articular/MSK ultrasound ── */}
                    <td className="px-2 py-2 text-center align-middle border-r border-teal-100 bg-teal-50/10">
                      {row.echo_msk ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <button type="button"
                            onClick={() => onEditImaging?.(row.echo_msk)}
                            className="inline-flex items-center gap-0.5 text-[9px] font-black px-2 py-0.5 rounded-full border bg-teal-50 border-teal-300 text-teal-700 hover:bg-teal-100 transition-colors"
                            title={`Apri Eco MSK del ${fmtDate(row.echo_msk.date)}`}
                          >
                            ECO
                            {ecoMskHasFindings(row.echo_msk) && (
                              <span className="ml-0.5 text-amber-600 font-black">!</span>
                            )}
                          </button>
                          {row.echo_msk.inputs?.active_sites?.length > 0 && (
                            <span className="text-[8px] text-teal-600 font-semibold">
                              {row.echo_msk.inputs.active_sites.length}s
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>

                    {/* ── DOPPLER — vascular ultrasound ── */}
                    <td className="px-2 py-2 text-center align-middle border-r border-blue-100 bg-blue-50/10">
                      {row.ecodoppler ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <button type="button"
                            onClick={() => onEditImaging?.(row.ecodoppler)}
                            className="inline-flex items-center gap-0.5 text-[9px] font-black px-2 py-0.5 rounded-full border bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 transition-colors"
                            title={`Apri Eco Doppler del ${fmtDate(row.ecodoppler.date)}`}
                          >
                            DOPPLER
                            {dopplerHasFindings(row.ecodoppler) && (
                              <span className="ml-0.5 text-amber-600 font-black">!</span>
                            )}
                          </button>
                          {row.ecodoppler.inputs?.active_districts?.length > 0 && (
                            <span className="text-[8px] text-blue-600 font-semibold">
                              {row.ecodoppler.inputs.active_districts.length}d
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>

                    {/* ── PET/CT + PETVAS ── */}
                    <td className="px-2 py-2 text-center align-middle border-r border-rose-100 bg-rose-50/10">
                      {row.petvas ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <button type="button"
                            onClick={() => onEditImaging?.(row.petvas)}
                            className={`inline-flex items-center gap-0.5 text-[9px] font-black px-2 py-0.5 rounded-full border transition-colors ${
                              petPos === true
                                ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                                : petPos === false
                                ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                                : "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100"
                            }`}
                            title={`Apri PET/CT del ${fmtDate(row.petvas.date)}`}
                          >
                            {petPos === true ? "PET+" : petPos === false ? "PET−" : "PET"}
                          </button>
                          {petScore != null && (
                            <span className="text-[8px] font-mono font-bold text-rose-600">
                              PETVAS {petScore}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>

                    {/* ── CTA ── */}
                    <td className="px-2 py-2 text-center align-middle border-r border-amber-100 bg-amber-50/10">
                      {row.angio_ct ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <button type="button"
                            onClick={() => onEditImaging?.(row.angio_ct)}
                            className={`inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded-full border bg-amber-50 border-amber-300 hover:bg-amber-100 transition-colors ${
                              angioHasFindings(row.angio_ct) ? "text-amber-800" : "text-amber-600"
                            }`}
                            title={`Apri AngioCT del ${fmtDate(row.angio_ct.date)}`}
                          >
                            CTA{angioHasFindings(row.angio_ct) ? "!" : ""}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>

                    {/* ── MRA ── */}
                    <td className="px-2 py-2 text-center align-middle border-r border-purple-100 bg-purple-50/10">
                      {row.angio_mri ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <button type="button"
                            onClick={() => onEditImaging?.(row.angio_mri)}
                            className={`inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded-full border bg-purple-50 border-purple-300 hover:bg-purple-100 transition-colors ${
                              angioHasFindings(row.angio_mri) ? "text-purple-800" : "text-purple-600"
                            }`}
                            title={`Apri AngioMRI del ${fmtDate(row.angio_mri.date)}`}
                          >
                            MRA{angioHasFindings(row.angio_mri) ? "!" : ""}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>

                    {/* ── Piano / Notes ── */}
                    <td className="px-3 py-2 align-middle max-w-[160px]">
                      {row.notes
                        ? (
                          <p className="text-[9px] text-gray-600 leading-relaxed line-clamp-2 whitespace-pre-wrap" title={row.notes}>
                            {row.notes}
                          </p>
                        )
                        : <span className="text-gray-200">—</span>}
                    </td>
                  </tr>

                  {/* ── Expandable detail row ── */}
                  {isExp && hasDetail && (
                    <tr>
                      <td colSpan={COL_COUNT} className="bg-blue-50/20 border-t border-blue-100 px-6 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          {row.pmrA?.inputs?.pain_vas != null && (
                            <div>
                              <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Dolore VAS</div>
                              <span className="font-mono font-black text-lg text-[#0A2540]">
                                {row.pmrA.inputs.pain_vas}
                              </span>
                              <span className="text-gray-400 text-[10px]">/10</span>
                            </div>
                          )}
                          {row.pmrA?.inputs?.stiffness_min != null && (
                            <div>
                              <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Rigidità mattutina</div>
                              <span className="font-mono font-black text-lg text-[#0A2540]">
                                {row.pmrA.inputs.stiffness_min}
                              </span>
                              <span className="text-gray-400 text-[10px]"> min</span>
                            </div>
                          )}
                          {row.diseaseActivity && (
                            <div>
                              <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Valutazione attività</div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ACTIVITY_MAP[row.diseaseActivity]?.cls || ""}`}>
                                {ACTIVITY_MAP[row.diseaseActivity]?.l || row.diseaseActivity}
                              </span>
                            </div>
                          )}
                          {row.notes && (
                            <div className="col-span-2 md:col-span-4">
                              <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Note / Piano clinico</div>
                              <p className="text-[10px] text-gray-700 leading-relaxed whitespace-pre-wrap">{row.notes}</p>
                            </div>
                          )}
                        </div>
                        {onEditVisit && row.pmrA && (
                          <div className="mt-2 border-t border-blue-100 pt-2 flex items-center gap-2">
                            <Stethoscope className="w-3 h-3 text-blue-400" />
                            <button type="button" onClick={() => onEditVisit(row.pmrA)}
                              className="text-[10px] text-blue-500 hover:text-blue-700 font-semibold">
                              Modifica questa visita
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
