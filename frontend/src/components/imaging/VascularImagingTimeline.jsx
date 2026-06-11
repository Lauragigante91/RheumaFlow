/**
 * VascularImagingTimeline — unified longitudinal vascular imaging history.
 * Shows PET/TC, Ecodoppler, AngioCT, and AngioMRI in a single chronological list.
 * Always starts with a synthetic DISEASE ONSET block when pmrLvvProfile is provided.
 *
 * Props:
 *   assessments    — all patient assessments (filtered internally)
 *   pmrLvvProfile  — baseline disease profile data (from diseaseProfileApi)
 *   onEdit(a)      — callback to re-open an assessment for editing
 */
import React, { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Edit, ChevronDown, ChevronRight, Zap, Activity, Layers, Radio, Anchor } from "lucide-react";

const MONTHS_IT = [
  "Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
  "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre",
];

const PHENOTYPE_LABELS = {
  pmr_only:         "PMR isolata",
  gca_cranial:      "GCA cranica",
  pmr_gca:          "PMR + GCA",
  lvv_extracranial: "LVV extracranica",
  takayasu:         "Arterite di Takayasu",
  overlap:          "Overlap / Inclassificabile",
};

const MODALITY_META = {
  petvas:    { label: "PET/TC",     icon: Zap,      badgeCls: "bg-rose-50 border-rose-200 text-rose-700",     dotCls: "bg-rose-400",   purpose: "Attività infiammatoria metabolica" },
  ecodoppler:{ label: "Ecografia",  icon: Activity, badgeCls: "bg-blue-50 border-blue-200 text-blue-700",     dotCls: "bg-blue-400",   purpose: "Infiammazione parietale / vasi accessibili" },
  angio_ct:  { label: "AngioCT",    icon: Layers,   badgeCls: "bg-amber-50 border-amber-200 text-amber-700",  dotCls: "bg-amber-400",  purpose: "Danno strutturale vascolare" },
  angio_mri: { label: "AngioMRI",   icon: Radio,    badgeCls: "bg-purple-50 border-purple-200 text-purple-700",dotCls: "bg-purple-400",purpose: "Danno strutturale vascolare (RM)" },
};

const VASCULAR_TYPES = new Set(Object.keys(MODALITY_META));

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("it-IT"); } catch { return iso; }
}

function petPosFromA(a) {
  if (a?.inputs?.pet_positive != null) return a.inputs.pet_positive;
  return Object.values(a?.inputs?.territories ?? {}).some(v => v >= 2);
}

function getSummaryLine(a) {
  if (a.index_type === "petvas") {
    const pos = petPosFromA(a);
    const posLabel = pos ? "PET positiva" : "PET negativa";
    const score = a.score != null ? `PETVAS ${a.score}/27` : null;
    return [score, posLabel, a.interpretation].filter(Boolean).join(" · ");
  }
  if (a.inputs?.summary) return a.inputs.summary;
  if (a.interpretation) return a.interpretation;
  return null;
}

function getDetailItems(a) {
  const items = [];
  if (a.index_type === "petvas") {
    if (a.score != null) items.push({ label: "PETVAS", value: `${a.score}/27` });
    if (a.interpretation) items.push({ label: "Uptake", value: a.interpretation });
    const pos = petPosFromA(a);
    items.push({ label: "Stato", value: pos ? "PET positiva" : "PET negativa" });
  } else {
    const active = a.inputs?.active_districts || [];
    if (active.length) items.push({ label: "Distretti", value: `${active.length} con reperto` });
    if (a.interpretation) items.push({ label: "Esito", value: a.interpretation });
  }
  if (a.notes) items.push({ label: "Note", value: a.notes.split("\n")[0].slice(0, 120) });
  return items;
}

// ─── Build synthetic onset entry from baseline profile ─────────────────────────
function buildOnsetBlock(profile) {
  if (!profile) return null;
  const year  = profile.onset_year;
  const month = profile.onset_month;
  if (!year && !month) return null;

  const monthLabel = month ? MONTHS_IT[parseInt(month) - 1] : null;
  const onsetDate  = [monthLabel, year].filter(Boolean).join(" ");

  const phenoLabel = PHENOTYPE_LABELS[profile.phenotype] || profile.phenotype || "";

  const imaging = [
    profile.dx_pet_positive     && "PET/TC positiva",
    profile.dx_tab_positive     && "TAB positiva",
    profile.dx_ultrasound_halo  && "Halo sign ecografico",
    profile.dx_angio_ct         && "AngioCT positiva",
    profile.dx_angio_mri        && "AngioMRI positiva",
  ].filter(Boolean);

  const territories = [
    profile.vas_temporal   && "Art. temporali",
    profile.vas_aorta      && "Aorta",
    profile.vas_subclavian && "Succlavia",
    profile.vas_carotid    && "Carotidi",
    profile.vas_axillary   && "Ascellare",
    profile.vas_vertebral  && "Vertebrale",
    profile.vas_iliac      && "Iliaca",
    profile.vas_renal      && "Renale",
    profile.vas_mesenteric && "Mesenterica",
    profile.vas_femoral    && "Femorale",
  ].filter(Boolean);

  const complications = [
    profile.comp_visual_loss             && "Perdita del visus",
    profile.comp_ischemic_event          && "Evento ischemico",
    profile.comp_aneurysm                && "Aneurisma",
    profile.comp_stenosis                && "Stenosi significativa",
    profile.comp_hospitalization         && "Ospedalizzazione",
    profile.comp_constitutional_syndrome && "Sindrome costituzionale severa",
  ].filter(Boolean);

  const initialTx = [
    profile.tx_glucocorticoids && `GC${profile.tx_gc_initial_dose ? ` ${profile.tx_gc_initial_dose}` : ""}`,
    profile.tx_tocilizumab     && "Tocilizumab",
    profile.tx_methotrexate    && "Metotrexato",
    profile.tx_cyclophosphamide && "Ciclofosfamide",
    profile.tx_aspirin         && "Aspirina",
  ].filter(Boolean);

  return {
    isOnset: true,
    onsetDate,
    phenoLabel,
    imaging,
    territories,
    complications,
    initialTx,
    notes: profile.onset_notes || "",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function VascularImagingTimeline({ assessments, pmrLvvProfile, onEdit }) {
  const [expanded, setExpanded] = useState(null);
  const [onsetExpanded, setOnsetExpanded] = useState(false);

  const rows = useMemo(() =>
    (assessments || [])
      .filter(a => VASCULAR_TYPES.has(a.index_type))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [assessments]
  );

  const counts = useMemo(() => {
    const c = {};
    for (const a of rows) c[a.index_type] = (c[a.index_type] || 0) + 1;
    return c;
  }, [rows]);

  const onsetBlock = useMemo(() => buildOnsetBlock(pmrLvvProfile), [pmrLvvProfile]);

  if (rows.length === 0 && !onsetBlock) {
    return (
      <div className="text-center py-8 text-sm text-gray-400 italic">
        Nessun imaging vascolare registrato.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 bg-[#0A2540]/5 border-b border-[#0A2540]/10">
        <span className="text-[10px] uppercase tracking-widest font-bold text-[#0A2540]">
          Imaging vascolare longitudinale
        </span>
        <span className="text-[10px] text-gray-400">{rows.length} esami totali</span>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {Object.entries(MODALITY_META).map(([type, meta]) =>
            counts[type] ? (
              <span key={type} className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.badgeCls}`}>
                <meta.icon className="w-2.5 h-2.5" />
                {counts[type]} {meta.label}
              </span>
            ) : null
          )}
        </div>
      </div>

      {/* Modality legend */}
      <div className="flex items-center gap-4 flex-wrap px-4 py-1.5 bg-gray-50/60 border-b border-gray-100 text-[9px] text-gray-400">
        {Object.entries(MODALITY_META).map(([type, meta]) => (
          <span key={type} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${meta.dotCls}`} />
            {meta.label}: {meta.purpose}
          </span>
        ))}
      </div>

      {/* Timeline entries */}
      <div className="divide-y divide-gray-100">

        {/* Visit imaging entries (newest → oldest) */}
        {rows.map((a, i) => {
          const meta = MODALITY_META[a.index_type] || MODALITY_META.petvas;
          const isExp = expanded === (a.id || i);
          const summaryLine = getSummaryLine(a);
          const detailItems = getDetailItems(a);
          const hasDetail = detailItems.length > 0;
          let dotCls = meta.dotCls;
          if (a.index_type === "petvas") {
            dotCls = petPosFromA(a) ? "bg-red-500" : "bg-green-500";
          }

          return (
            <div key={a.id || i} className={`group ${isExp ? "bg-blue-50/10" : "hover:bg-gray-50/50"} transition-colors`}>
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex flex-col items-center mt-1 flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${dotCls}`} />
                  {(i < rows.length - 1 || onsetBlock) && (
                    <div className="w-px flex-1 bg-gray-200 mt-1" style={{ minHeight: 12 }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[11px] text-[#0A2540]">{fmtDate(a.date)}</span>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border ${meta.badgeCls}`}>
                      <meta.icon className="w-2.5 h-2.5" />
                      {meta.label}
                    </span>
                    {a.index_type === "petvas" && (() => {
                      const pos = petPosFromA(a);
                      return (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${
                          pos ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"
                        }`}>
                          {pos ? "PET+" : "PET−"}
                        </span>
                      );
                    })()}
                  </div>

                  {summaryLine && (
                    <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">{summaryLine}</p>
                  )}

                  {hasDetail && (
                    <button type="button"
                      onClick={() => setExpanded(isExp ? null : (a.id || i))}
                      className="flex items-center gap-1 text-[9px] text-blue-500 hover:text-blue-700 mt-1 font-semibold">
                      {isExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {isExp ? "Comprimi" : "Dettagli"}
                    </button>
                  )}

                  {isExp && (
                    <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200 grid grid-cols-2 md:grid-cols-3 gap-2">
                      {detailItems.map((item, j) => (
                        <div key={j} className={item.label === "Note" ? "col-span-2 md:col-span-3" : ""}>
                          <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">{item.label}</div>
                          <div className="text-[11px] text-gray-700 mt-0.5 leading-snug">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Edit / Duplicate / Delete buttons */}
                {onEdit && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                    <Button type="button" variant="ghost" size="sm"
                      onClick={() => onEdit(a)}
                      className="text-gray-400 hover:text-blue-600 p-1 h-auto"
                      title="Modifica">
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* DISEASE ONSET block — always at the bottom */}
        {onsetBlock && (
          <div className="bg-[#0A2540]/3 border-t-2 border-[#0A2540]/15">
            <div className="flex items-start gap-3 px-4 py-4">
              {/* Special anchor dot */}
              <div className="flex flex-col items-center mt-1 flex-shrink-0">
                <div className="w-4 h-4 rounded-full bg-[#0A2540] border-2 border-white shadow flex items-center justify-center">
                  <Anchor className="w-2 h-2 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-black text-[11px] text-[#0A2540] uppercase tracking-wider">
                    Esordio di malattia
                  </span>
                  {onsetBlock.onsetDate && (
                    <span className="text-[10px] font-bold text-[#0A2540]/70 bg-[#0A2540]/10 px-2 py-0.5 rounded-full">
                      {onsetBlock.onsetDate}
                    </span>
                  )}
                  {onsetBlock.phenoLabel && (
                    <span className="text-[10px] font-semibold text-[#0A2540]/60 bg-white border border-[#0A2540]/20 px-2 py-0.5 rounded-full">
                      {onsetBlock.phenoLabel}
                    </span>
                  )}
                </div>

                {/* Toggle detail */}
                <button type="button"
                  onClick={() => setOnsetExpanded(v => !v)}
                  className="flex items-center gap-1 text-[9px] text-[#0A2540]/60 hover:text-[#0A2540] font-semibold mb-2">
                  {onsetExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {onsetExpanded ? "Comprimi profilo basale" : "Mostra profilo basale"}
                </button>

                {/* Inline compact summary always visible */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#0A2540]/70">
                  {onsetBlock.imaging.length > 0 && (
                    <span>
                      <span className="font-bold">Imaging+:</span> {onsetBlock.imaging.join(", ")}
                    </span>
                  )}
                  {onsetBlock.territories.length > 0 && (
                    <span>
                      <span className="font-bold">Vasi:</span> {onsetBlock.territories.join(", ")}
                    </span>
                  )}
                  {onsetBlock.complications.length > 0 && (
                    <span className="text-red-700">
                      <span className="font-bold">Complicanze:</span> {onsetBlock.complications.join(", ")}
                    </span>
                  )}
                </div>

                {/* Expanded detail */}
                {onsetExpanded && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-[#0A2540]/15 space-y-2">
                    {onsetBlock.initialTx.length > 0 && (
                      <div>
                        <div className="text-[9px] uppercase tracking-widest text-[#0A2540]/50 font-bold mb-0.5">Terapia iniziale</div>
                        <div className="text-[11px] text-gray-700">{onsetBlock.initialTx.join(" · ")}</div>
                      </div>
                    )}
                    {onsetBlock.notes && (
                      <div>
                        <div className="text-[9px] uppercase tracking-widest text-[#0A2540]/50 font-bold mb-0.5">Note esordio</div>
                        <div className="text-[11px] text-gray-600 italic">{onsetBlock.notes}</div>
                      </div>
                    )}
                    <p className="text-[9px] text-gray-400 italic border-t border-gray-100 pt-2">
                      Dati generati automaticamente dal Profilo PMR / GCA / LVV basale.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
