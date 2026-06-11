/**
 * PmrLvvProfileSection — persistent baseline disease profile for PMR / GCA / LVV / Takayasu.
 *
 * Self-collapsible: closed by default, shows compact summary when collapsed.
 * Stored via diseaseProfileApi with key "pmr_lvv".
 * This is a disease-defining identity record, NOT a visit record.
 */
import React, { useEffect, useState } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Save, Calendar, Stethoscope, FlaskConical, MapPin,
  AlertTriangle, Pill, FileText, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

const MONTHS = [
  "Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
  "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre",
];

const PHENOTYPE_OPTIONS = [
  { v: "pmr_only",         l: "PMR isolata" },
  { v: "gca_cranial",      l: "GCA cranica" },
  { v: "pmr_gca",          l: "PMR + GCA" },
  { v: "lvv_extracranial", l: "LVV extracranica" },
  { v: "takayasu",         l: "Arterite di Takayasu" },
  { v: "overlap",          l: "Overlap / Inclassificabile" },
];

const PHENOTYPE_LABELS = Object.fromEntries(PHENOTYPE_OPTIONS.map(o => [o.v, o.l]));

// ─── Default state ────────────────────────────────────────────────────────────
const DEFAULTS = {
  onset_year:  "",
  onset_month: "",
  phenotype:   "",
  relapse_at_onset: false,
  onset_notes: "",

  // Presenting symptoms (at onset — baseline only)
  sx_shoulder_hip_pain:   false,
  sx_morning_stiffness:   false,
  sx_headache:            false,
  sx_jaw_claudication:    false,
  sx_scalp_tenderness:    false,
  sx_visual_symptoms:     false,
  sx_constitutional:      false,
  sx_fever:               false,
  sx_weight_loss:         false,
  sx_limb_claudication:   false,
  sx_vascular_pain:       false,
  sx_bp_asymmetry:        false,
  sx_ischemic:            false,
  sx_other:               "",

  // Diagnostic pathway
  dx_pet_positive:        false,
  dx_tab_positive:        false,
  dx_ultrasound_halo:     false,
  dx_angio_ct:            false,
  dx_angio_mri:           false,
  dx_biopsy_vasculitis:   false,
  dx_isolated_pmr:        false,
  dx_cranial_gca:         false,
  dx_extracranial_lvv:    false,
  dx_takayasu_phenotype:  false,
  dx_notes:               "",

  // Baseline vascular involvement
  vas_temporal:           false,
  vas_aorta:              false,
  vas_subclavian:         false,
  vas_carotid:            false,
  vas_axillary:           false,
  vas_vertebral:          false,
  vas_iliac:              false,
  vas_renal:              false,
  vas_mesenteric:         false,
  vas_femoral:            false,
  vas_other:              "",

  // Complications at diagnosis
  comp_visual_loss:              false,
  comp_ischemic_event:           false,
  comp_aneurysm:                 false,
  comp_stenosis:                 false,
  comp_hospitalization:          false,
  comp_constitutional_syndrome:  false,
  comp_other:                    "",

  // Initial treatment
  tx_glucocorticoids:    false,
  tx_gc_initial_dose:    "",
  tx_tocilizumab:        false,
  tx_methotrexate:       false,
  tx_cyclophosphamide:   false,
  tx_aspirin:            false,
  tx_other:              "",

  notes: "",
};

// ─── Helper components ────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, badge }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-[#0A2540] flex-shrink-0" />
      <h3 className="font-heading font-bold text-[11px] uppercase tracking-[0.18em] text-gray-600">
        {title}
      </h3>
      {badge != null && badge > 0 && (
        <span className="text-[9px] font-black text-[#0A2540] bg-[#0A2540]/10 px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
}

function CheckRow({ label, sub, checked, onChange }) {
  return (
    <label className="flex items-start gap-2 py-1 cursor-pointer group">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={e => onChange(e.target.checked)}
        className="w-3.5 h-3.5 mt-0.5 accent-[#0A2540] flex-shrink-0 cursor-pointer"
      />
      <div>
        <span className="text-[12px] text-gray-800 group-hover:text-[#0A2540] transition-colors leading-snug">
          {label}
        </span>
        {sub && <div className="text-[9px] text-gray-400 leading-tight mt-0.5">{sub}</div>}
      </div>
    </label>
  );
}

function TextInput({ value, onChange, placeholder, className = "" }) {
  return (
    <input
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-300 ${className}`}
    />
  );
}

function Divider() {
  return <div className="border-t border-gray-100 my-1" />;
}

// ─── Compact summary builder ───────────────────────────────────────────────────
function buildSummary(data) {
  const onsetParts = [
    data.onset_month ? MONTHS[parseInt(data.onset_month) - 1] : null,
    data.onset_year || null,
  ].filter(Boolean);
  const onset = onsetParts.join(" ");
  const phenotype = PHENOTYPE_LABELS[data.phenotype] || "";

  const imaging = [
    data.dx_pet_positive    && "PET+",
    data.dx_tab_positive    && "TAB+",
    data.dx_ultrasound_halo && "Halo+",
    data.dx_angio_ct        && "AngioCT+",
    data.dx_angio_mri       && "AngioMRI+",
  ].filter(Boolean).join(" · ");

  const territories = [
    data.vas_temporal   && "Art. temporali",
    data.vas_aorta      && "Aorta",
    data.vas_subclavian && "Succlavia",
    data.vas_carotid    && "Carotidi",
    data.vas_axillary   && "Ascellare",
    data.vas_vertebral  && "Vertebrale",
    data.vas_iliac      && "Iliaca",
    data.vas_renal      && "Renale",
    data.vas_mesenteric && "Mesenterica",
    data.vas_femoral    && "Femorale",
  ].filter(Boolean);

  const complications = [
    data.comp_visual_loss             && "Perdita visus",
    data.comp_ischemic_event          && "Evento ischemico",
    data.comp_aneurysm                && "Aneurisma",
    data.comp_stenosis                && "Stenosi",
    data.comp_hospitalization         && "Ospedalizzazione",
    data.comp_constitutional_syndrome && "Sind. costituzionale",
  ].filter(Boolean);

  const isEmpty = !onset && !phenotype && !imaging && territories.length === 0 && complications.length === 0;
  return { onset, phenotype, imaging, territories, complications, isEmpty };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PmrLvvProfileSection({ patient }) {
  const [data, setData]     = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen]     = useState(false);  // closed by default

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi
      .get(patient.id, "pmr_lvv")
      .then(doc => {
        if (doc?.data) setData(prev => ({ ...prev, ...doc.data }));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (k, v) => setData(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "pmr_lvv", data);
      toast.success("Profilo PMR/LVV salvato.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const summary = buildSummary(data);

  // Counts for badges
  const sxKeys = [
    "sx_shoulder_hip_pain","sx_morning_stiffness","sx_headache","sx_jaw_claudication",
    "sx_scalp_tenderness","sx_visual_symptoms","sx_constitutional","sx_fever",
    "sx_weight_loss","sx_limb_claudication","sx_vascular_pain","sx_bp_asymmetry","sx_ischemic",
  ];
  const sxCount  = sxKeys.filter(k => data[k]).length;
  const dxCount  = ["dx_pet_positive","dx_tab_positive","dx_ultrasound_halo","dx_angio_ct","dx_angio_mri","dx_biopsy_vasculitis","dx_isolated_pmr","dx_cranial_gca","dx_extracranial_lvv","dx_takayasu_phenotype"].filter(k => data[k]).length;
  const vasCount = ["vas_temporal","vas_aorta","vas_subclavian","vas_carotid","vas_axillary","vas_vertebral","vas_iliac","vas_renal","vas_mesenteric","vas_femoral"].filter(k => data[k]).length;
  const compCount= ["comp_visual_loss","comp_ischemic_event","comp_aneurysm","comp_stenosis","comp_hospitalization","comp_constitutional_syndrome"].filter(k => data[k]).length;

  if (!loaded) {
    return (
      <Card className="border-gray-200 shadow-sm p-5 text-sm text-gray-400 animate-pulse">
        Caricamento profilo PMR/LVV…
      </Card>
    );
  }

  return (
    <Card className="border-[#0A2540]/15 shadow-md overflow-hidden">
      {/* ── Clickable card header (toggle) ──────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full bg-[#0A2540] px-6 py-4 flex items-center justify-between gap-4 hover:bg-[#0d2e4e] transition-colors"
      >
        <div className="text-left">
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/50 mb-0.5">
            Profilo di malattia basale · Clicca per {open ? "chiudere" : "aprire"}
          </div>
          <h2 className="font-heading font-black text-xl text-white tracking-tight">
            PMR / GCA / LVV
          </h2>
          <p className="text-[10px] text-white/60 mt-0.5">
            Caratteristiche all'esordio · Non modificate dalle visite
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Badge counts in header */}
          {!open && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {summary.onset && (
                <span className="text-[9px] font-bold bg-white/15 text-white px-2 py-0.5 rounded-full">
                  Esordio: {summary.onset}
                </span>
              )}
              {summary.phenotype && (
                <span className="text-[9px] font-bold bg-white/15 text-white px-2 py-0.5 rounded-full">
                  {summary.phenotype}
                </span>
              )}
              {vasCount > 0 && (
                <span className="text-[9px] font-bold bg-white/15 text-white px-2 py-0.5 rounded-full">
                  {vasCount} territori vascolari
                </span>
              )}
            </div>
          )}
          {open
            ? <ChevronUp className="w-5 h-5 text-white/70" />
            : <ChevronDown className="w-5 h-5 text-white/70" />}
        </div>
      </button>

      {/* ── Compact summary (when collapsed) ────────────────────────────── */}
      {!open && !summary.isEmpty && (
        <div className="px-5 py-3 bg-[#0A2540]/3 border-b border-[#0A2540]/10">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-gray-700">
            {summary.imaging && (
              <span>
                <span className="font-semibold text-[#0A2540]">Imaging basale:</span> {summary.imaging}
              </span>
            )}
            {summary.territories.length > 0 && (
              <span>
                <span className="font-semibold text-[#0A2540]">Territori:</span> {summary.territories.join(", ")}
              </span>
            )}
            {summary.complications.length > 0 && (
              <span className="text-red-700">
                <span className="font-semibold">Complicanze esordio:</span> {summary.complications.join(", ")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Full form (when open) ─────────────────────────────────────── */}
      {open && (
        <>
          {/* Save button in subheader */}
          <div className="px-6 py-3 bg-[#0A2540]/5 border-b border-[#0A2540]/10 flex justify-end">
            <Button onClick={save} disabled={saving}
              className="bg-[#0A2540] text-white hover:bg-[#0A2540]/90 font-bold text-xs h-9 px-4">
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? "Salvataggio…" : "Salva profilo"}
            </Button>
          </div>

          <div className="p-6 space-y-6">

            {/* ════ 1. ESORDIO DI MALATTIA ═══════════════════════════════════ */}
            <div>
              <SectionHeader icon={Calendar} title="Esordio di malattia" />
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-gray-600 w-12">Anno</label>
                    <input
                      type="number" min="1940" max={new Date().getFullYear()}
                      value={data.onset_year} onChange={e => set("onset_year", e.target.value)}
                      placeholder="es. 2023"
                      className="w-24 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-300"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-gray-600 w-12">Mese</label>
                    <select value={data.onset_month} onChange={e => set("onset_month", e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-300 bg-white">
                      <option value="">—</option>
                      {MONTHS.map((m, i) => (
                        <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-gray-600 cursor-pointer ml-2">
                    <input type="checkbox" checked={!!data.relapse_at_onset}
                      onChange={e => set("relapse_at_onset", e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#0A2540]" />
                    GCA/LVV in corso di recidiva PMR
                  </label>
                </div>

                {/* Phenotype */}
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-2">
                    Fenotipo clinico
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PHENOTYPE_OPTIONS.map(o => (
                      <button key={o.v} type="button"
                        onClick={() => set("phenotype", data.phenotype === o.v ? "" : o.v)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                          data.phenotype === o.v
                            ? "bg-[#0A2540] text-white border-[#0A2540]"
                            : "bg-white text-gray-600 border-gray-200 hover:border-[#0A2540]/40"
                        }`}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>

                <TextInput
                  value={data.onset_notes}
                  onChange={v => set("onset_notes", v)}
                  placeholder="Note sull'esordio (modalità di presentazione, contesto, ecc.)"
                />
              </div>
            </div>

            <Divider />

            {/* ════ 2. SINTOMI ALL'ESORDIO (baseline only) ══════════════════ */}
            <div>
              <SectionHeader icon={Stethoscope} title="Sintomi all'esordio — solo profilo basale" badge={sxCount} />
              <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3 font-medium">
                Questi sono i sintomi <strong>all'esordio della malattia</strong>. I sintomi della visita odierna si registrano separatamente in "Visita di oggi".
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <div className="space-y-0">
                  <CheckRow label="Dolore cingolo scapolare / pelvico"
                    sub="PMR tipica — spalle e anche"
                    checked={data.sx_shoulder_hip_pain} onChange={v => set("sx_shoulder_hip_pain", v)} />
                  <CheckRow label="Rigidità mattutina prolungata"
                    sub="> 45 minuti"
                    checked={data.sx_morning_stiffness} onChange={v => set("sx_morning_stiffness", v)} />
                  <CheckRow label="Cefalea temporale"
                    sub="Unilaterale o bilaterale, tipica GCA"
                    checked={data.sx_headache} onChange={v => set("sx_headache", v)} />
                  <CheckRow label="Claudicatio mascellare"
                    sub="Dolore alla masticazione"
                    checked={data.sx_jaw_claudication} onChange={v => set("sx_jaw_claudication", v)} />
                  <CheckRow label="Dolorabilità dello scalpo"
                    sub="Sensibilità al tatto del cuoio capelluto"
                    checked={data.sx_scalp_tenderness} onChange={v => set("sx_scalp_tenderness", v)} />
                  <CheckRow label="Sintomi visivi"
                    sub="Visione offuscata, diplopia, amaurosi"
                    checked={data.sx_visual_symptoms} onChange={v => set("sx_visual_symptoms", v)} />
                  <CheckRow label="Sintomi costituzionali"
                    sub="Astenia, anoressia, malessere"
                    checked={data.sx_constitutional} onChange={v => set("sx_constitutional", v)} />
                </div>
                <div className="space-y-0">
                  <CheckRow label="Febbre"
                    sub="Febbre moderata o alta all'esordio"
                    checked={data.sx_fever} onChange={v => set("sx_fever", v)} />
                  <CheckRow label="Calo ponderale"
                    sub="Non intenzionale, > 5% del peso"
                    checked={data.sx_weight_loss} onChange={v => set("sx_weight_loss", v)} />
                  <CheckRow label="Claudicatio agli arti"
                    sub="Ischemia da vasculite periferica"
                    checked={data.sx_limb_claudication} onChange={v => set("sx_limb_claudication", v)} />
                  <CheckRow label="Dolore vascolare"
                    sub="Dolore lungo il decorso dei vasi"
                    checked={data.sx_vascular_pain} onChange={v => set("sx_vascular_pain", v)} />
                  <CheckRow label="Asimmetria pressoria agli arti superiori"
                    sub="> 10 mmHg di differenza tra i lati"
                    checked={data.sx_bp_asymmetry} onChange={v => set("sx_bp_asymmetry", v)} />
                  <CheckRow label="Sintomi ischemici"
                    sub="TIA, ictus, angina, ischemia viscerale"
                    checked={data.sx_ischemic} onChange={v => set("sx_ischemic", v)} />
                </div>
              </div>
              <div className="mt-2">
                <TextInput value={data.sx_other} onChange={v => set("sx_other", v)}
                  placeholder="Altri sintomi rilevanti all'esordio…" />
              </div>
            </div>

            <Divider />

            {/* ════ 3. PERCORSO DIAGNOSTICO ══════════════════════════════════ */}
            <div>
              <SectionHeader icon={FlaskConical} title="Percorso diagnostico" badge={dxCount} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <div className="space-y-0">
                  <div className="text-[9px] uppercase tracking-widest text-blue-400 font-bold mb-1 mt-1">Esami strumentali positivi</div>
                  <CheckRow label="PET/TC positiva" sub="Uptake vascolare patologico (LVG ≥ 2)"
                    checked={data.dx_pet_positive} onChange={v => set("dx_pet_positive", v)} />
                  <CheckRow label="TAB (biopsia art. temporale) positiva" sub="Vasculite istopatologica confermata"
                    checked={data.dx_tab_positive} onChange={v => set("dx_tab_positive", v)} />
                  <CheckRow label="Ecodoppler: segno del halo" sub="Halo sign all'esordio"
                    checked={data.dx_ultrasound_halo} onChange={v => set("dx_ultrasound_halo", v)} />
                  <CheckRow label="AngioCT positiva" sub="Ispessimento parietale / stenosi / aneurisma"
                    checked={data.dx_angio_ct} onChange={v => set("dx_angio_ct", v)} />
                  <CheckRow label="AngioMRI positiva" sub="Enhancement parietale / ispessimento"
                    checked={data.dx_angio_mri} onChange={v => set("dx_angio_mri", v)} />
                  <CheckRow label="Biopsia vascolare: vasculite confermata" sub="Sede diversa dall'arteria temporale"
                    checked={data.dx_biopsy_vasculitis} onChange={v => set("dx_biopsy_vasculitis", v)} />
                </div>
                <div className="space-y-0">
                  <div className="text-[9px] uppercase tracking-widest text-indigo-400 font-bold mb-1 mt-1">Classificazione diagnostica</div>
                  <CheckRow label="PMR isolata" sub="Senza coinvolgimento dei grossi vasi"
                    checked={data.dx_isolated_pmr} onChange={v => set("dx_isolated_pmr", v)} />
                  <CheckRow label="GCA cranica" sub="Arterie craniali: temporale, oftalmica, ecc."
                    checked={data.dx_cranial_gca} onChange={v => set("dx_cranial_gca", v)} />
                  <CheckRow label="LVV extracranica" sub="Aorta e suoi rami principali"
                    checked={data.dx_extracranial_lvv} onChange={v => set("dx_extracranial_lvv", v)} />
                  <CheckRow label="Fenotipo Takayasu" sub="Distribuzione Takayasu-like"
                    checked={data.dx_takayasu_phenotype} onChange={v => set("dx_takayasu_phenotype", v)} />
                </div>
              </div>
              <div className="mt-2">
                <TextInput value={data.dx_notes} onChange={v => set("dx_notes", v)}
                  placeholder="Note sul percorso diagnostico (criteri soddisfatti, altri esami, ecc.)" />
              </div>
            </div>

            <Divider />

            {/* ════ 4. COINVOLGIMENTO VASCOLARE BASALE ══════════════════════ */}
            <div>
              <SectionHeader icon={MapPin} title="Coinvolgimento vascolare basale" badge={vasCount} />
              <p className="text-[10px] text-gray-400 italic mb-3">
                Territori coinvolti alla diagnosi — record permanente del fenotipo vascolare iniziale.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-0">
                {[
                  { k: "vas_temporal",   l: "Art. temporali" },
                  { k: "vas_carotid",    l: "Carotidi" },
                  { k: "vas_aorta",      l: "Aorta" },
                  { k: "vas_subclavian", l: "Succlavia" },
                  { k: "vas_axillary",   l: "Ascellare" },
                  { k: "vas_vertebral",  l: "Vertebrale" },
                  { k: "vas_iliac",      l: "Iliaca" },
                  { k: "vas_renal",      l: "Renale" },
                  { k: "vas_mesenteric", l: "Mesenterica" },
                  { k: "vas_femoral",    l: "Femorale" },
                ].map(({ k, l }) => (
                  <CheckRow key={k} label={l} checked={data[k]} onChange={v => set(k, v)} />
                ))}
              </div>
              <div className="mt-2">
                <TextInput value={data.vas_other} onChange={v => set("vas_other", v)}
                  placeholder="Altri distretti vascolari coinvolti (specificare)" />
              </div>
            </div>

            <Divider />

            {/* ════ 5. COMPLICANZE ALLA DIAGNOSI ════════════════════════════ */}
            <div>
              <SectionHeader icon={AlertTriangle} title="Complicanze alla diagnosi" badge={compCount} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <div className="space-y-0">
                  <CheckRow label="Perdita del visus (parziale o totale)"
                    sub="Neuropatia ottica ischemica, BRAO, CRAO"
                    checked={data.comp_visual_loss} onChange={v => set("comp_visual_loss", v)} />
                  <CheckRow label="Evento ischemico"
                    sub="TIA, ictus, ischemia viscerale, infarto"
                    checked={data.comp_ischemic_event} onChange={v => set("comp_ischemic_event", v)} />
                  <CheckRow label="Aneurisma vascolare"
                    sub="Confermato a imaging"
                    checked={data.comp_aneurysm} onChange={v => set("comp_aneurysm", v)} />
                </div>
                <div className="space-y-0">
                  <CheckRow label="Stenosi vascolare significativa"
                    sub="Moderata/severa a imaging"
                    checked={data.comp_stenosis} onChange={v => set("comp_stenosis", v)} />
                  <CheckRow label="Ospedalizzazione per esordio"
                    sub="Ricovero urgente o programmato all'esordio"
                    checked={data.comp_hospitalization} onChange={v => set("comp_hospitalization", v)} />
                  <CheckRow label="Sindrome costituzionale severa"
                    sub="Perdita peso > 10%, astenia profonda"
                    checked={data.comp_constitutional_syndrome} onChange={v => set("comp_constitutional_syndrome", v)} />
                </div>
              </div>
              <div className="mt-2">
                <TextInput value={data.comp_other} onChange={v => set("comp_other", v)}
                  placeholder="Altre complicanze all'esordio (descrivere)" />
              </div>
            </div>

            <Divider />

            {/* ════ 6. TERAPIA INIZIALE ══════════════════════════════════════ */}
            <div>
              <SectionHeader icon={Pill} title="Terapia iniziale" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                <div className="space-y-0">
                  <CheckRow label="Glucocorticoidi"
                    checked={data.tx_glucocorticoids} onChange={v => set("tx_glucocorticoids", v)} />
                  {data.tx_glucocorticoids && (
                    <div className="ml-5 mb-2">
                      <TextInput value={data.tx_gc_initial_dose} onChange={v => set("tx_gc_initial_dose", v)}
                        placeholder="Dose iniziale (es. Prednisone 40 mg/die)" />
                    </div>
                  )}
                  <CheckRow label="Tocilizumab" sub="Anti-IL-6 per GCA/LVV"
                    checked={data.tx_tocilizumab} onChange={v => set("tx_tocilizumab", v)} />
                </div>
                <div className="space-y-0">
                  <CheckRow label="Metotrexato" sub="Steroid-sparing"
                    checked={data.tx_methotrexate} onChange={v => set("tx_methotrexate", v)} />
                  <CheckRow label="Ciclofosfamide" sub="Forme severe / Takayasu"
                    checked={data.tx_cyclophosphamide} onChange={v => set("tx_cyclophosphamide", v)} />
                  <CheckRow label="Aspirina / antiaggregante" sub="Profilassi eventi ischemici"
                    checked={data.tx_aspirin} onChange={v => set("tx_aspirin", v)} />
                </div>
              </div>
              <div className="mt-2">
                <TextInput value={data.tx_other} onChange={v => set("tx_other", v)}
                  placeholder="Altri farmaci iniziali (specificare)" />
              </div>
            </div>

            <Divider />

            {/* ════ 7. NOTE CLINICHE AGGIUNTIVE ═════════════════════════════ */}
            <div>
              <SectionHeader icon={FileText} title="Note cliniche aggiuntive" />
              <textarea
                value={data.notes || ""}
                onChange={e => set("notes", e.target.value)}
                rows={3}
                placeholder="Anamnesi familiare, caratteristiche peculiari della presentazione, considerazioni diagnostiche differenziali, comorbidità rilevanti…"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-blue-300"
              />
            </div>

            {/* Bottom save */}
            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={saving}
                className="bg-[#0A2540] text-white hover:bg-[#0A2540]/90 text-xs h-9">
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {saving ? "Salvataggio…" : "Salva profilo PMR/LVV"}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
