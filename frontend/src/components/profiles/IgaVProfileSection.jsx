import React, { useEffect, useState } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Save, Beaker, HeartPulse, Stethoscope, FileText, Zap, Microscope, AlertTriangle, Activity } from "lucide-react";
import { toast } from "sonner";

const CLINICAL_FORMS = [
  { value: "hsp_classic",   label: "HSP classica (cute + artro ± GI)" },
  { value: "igav_renal",    label: "IgAV nefritica (coinvolgimento renale)" },
  { value: "igav_adult",    label: "Forma dell'adulto" },
  { value: "igav_atypical", label: "IgAV atipica" },
];

const TRIGGERS = [
  { value: "infection_urti",   label: "Infezione VADS" },
  { value: "infection_strep",  label: "Streptococco" },
  { value: "infection_covid",  label: "COVID-19 / post-COVID" },
  { value: "drug",             label: "Farmaco" },
  { value: "vaccine",          label: "Vaccinazione" },
  { value: "idiopathic",       label: "Idiopatico" },
  { value: "other",            label: "Altro" },
];

const ORGANS = [
  { key: "skin",    label: "Cute",            hint: "Porpora palpabile / lesioni emorragiche" },
  { key: "renal",   label: "Rene",            hint: "Nefropatia IgA, ematuria, proteinuria" },
  { key: "gi",      label: "GI",              hint: "Dolore addominale colico, sanguinamento" },
  { key: "joint",   label: "Articolare",      hint: "Artralgie / artrite (tipicamente grandi articolazioni)" },
  { key: "scrotal", label: "Scrotale",        hint: "Orchite (forma pediatrica)" },
  { key: "neuro",   label: "Neurologico",     hint: "Raro: convulsioni, encefalopatia" },
];

const PURPURA_DIST = [
  { value: "lower_limbs",        label: "Arti inferiori" },
  { value: "lower_limbs_glutei", label: "Arti inferiori + glutei" },
  { value: "generalized",        label: "Generalizzata" },
  { value: "other",              label: "Altra distribuzione" },
];

const DIAG_BASIS = [
  { key: "biopsy_skin_ifd",   label: "Biopsia cute (IFD — depositi IgA)" },
  { key: "biopsy_renal",      label: "Biopsia renale" },
  { key: "biopsy_renal_ifd",  label: "Biopsia renale (IF — depositi IgA mesangiali)" },
  { key: "clinical_criteria", label: "Criteri EULAR/PRINTO/PRES 2010" },
  { key: "echo_abdomen",      label: "Eco addome (invaginazione, edema parietale)" },
];

const COURSE_OPTIONS = [
  { value: "monophasic",   label: "Monofasico / singolo episodio" },
  { value: "recurrent",    label: "Recidivante" },
  { value: "chronic",      label: "Cronico-persistente > 6 mesi" },
];

const GI_SYMPTOMS = [
  { key: "abdominal_pain",   label: "Dolore addominale colico" },
  { key: "bleeding",         label: "Sanguinamento GI" },
  { key: "intussusception",  label: "Invaginazione intestinale" },
  { key: "vomiting",         label: "Vomito" },
];

const RENAL_INVOLVEMENT_ITEMS = [
  { key: "microematuria",       label: "Microematuria",                      hint: "Emazie urine > 5/campo" },
  { key: "proteinuria",         label: "Proteinuria",                        hint: "Qualsiasi grado" },
  { key: "proteinuria_05",      label: "Proteinuria > 0,5 g/die",            hint: "Soglia terapeutica" },
  { key: "proteinuria_1",       label: "Proteinuria > 1 g/die",              hint: "Fattore prognostico" },
  { key: "nephrotic_syndrome",  label: "Sindrome nefrosica",                 hint: "Prot > 3,5 g/die + ipoalbuminemia" },
  { key: "egfr_reduction",      label: "Riduzione eGFR / insufficienza renale", hint: "eGFR < 60 o calo ≥ 25%" },
  { key: "hypertension",        label: "Ipertensione arteriosa",             hint: "PA > 140/90 mmHg" },
  { key: "erythrocyte_casts",   label: "Cilindri eritrocitari",              hint: "Se disponibili all'esame urine" },
];

const RENAL_PROGNOSTIC_ITEMS = [
  { key: "persistent_proteinuria", label: "Proteinuria persistente",                    hint: "> 3-6 mesi" },
  { key: "proteinuria_1",          label: "Proteinuria > 1 g/die",                      hint: "Fattore di rischio progressione" },
  { key: "egfr_reduction",         label: "Riduzione eGFR",                             hint: "Al momento della diagnosi o in progressione" },
  { key: "hypertension",           label: "Ipertensione arteriosa",                     hint: "Richiede terapia antipertensiva" },
  { key: "crescents",              label: "Crescents / semilune extracapillari",        hint: "Alla biopsia renale" },
  { key: "chronic_lesions",        label: "Lesioni croniche / fibro-interstiziali",     hint: "Alla biopsia renale" },
];

export function summarizeIgaV(profileData) {
  if (!profileData) return { organs: [], form: null, renal: false };
  const organs = ORGANS.filter(o => profileData.organs?.[o.key]).map(o => o.label);
  const formObj = CLINICAL_FORMS.find(f => f.value === profileData.clinical_form);
  const renalFlags = profileData.renal_involvement || {};
  const progFlags  = profileData.renal_prognostic_factors || {};
  return {
    organs,
    form: formObj?.label || null,
    renal: !!profileData.organs?.renal,
    oxford: profileData.oxford_class || null,
    renalHighRisk: !!(progFlags.crescents || progFlags.chronic_lesions || renalFlags.proteinuria_1),
  };
}

const DEFAULT = {
  clinical_form: "",
  trigger: "",
  trigger_detail: "",
  iga_level: "",
  iga_elevated: false,
  organs: {},
  purpura_distribution: "",
  skin_biopsy: false,
  skin_biopsy_iga: null,
  renal_biopsy: false,
  renal_biopsy_iga: null,
  oxford_class: "",
  gi_symptoms: {},
  joint_involvement: "",
  joint_sites: "",
  diagnostic_basis: {},
  course: "",
  recurrences: "",
  renal_involvement: {},
  renal_prognostic_factors: {},
  altro: "",
  // legacy fields — kept for backwards compat, no longer shown in UI
  proteinuria_range: "",
  egfr_baseline: "",
  complement_c3c4: "",
  anca_status: "",
  ana_status: "",
};

export default function IgaVProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "igav")
      .then(doc => { if (doc?.data) setData(p => ({ ...DEFAULT, ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (key, val) => setData(p => ({ ...p, [key]: val }));
  const setNested = (obj, key, val) => setData(p => ({ ...p, [obj]: { ...p[obj], [key]: val } }));

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "igav", data);
      toast.success("Profilo IgAV salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <Card className="p-6 text-sm text-gray-500">Caricamento profilo vasculite IgA…</Card>;
  }

  const BtnRow = ({ field, options }) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {options.map(o => (
        <button key={o.value} type="button"
          onClick={() => set(field, data[field] === o.value ? "" : o.value)}
          className={`px-2.5 py-1 text-xs rounded-md border transition ${data[field] === o.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
        >{o.label}</button>
      ))}
    </div>
  );

  const hasRenalInvolvement = !!data.organs?.renal;
  const activeRenalFlags = RENAL_INVOLVEMENT_ITEMS.filter(i => data.renal_involvement?.[i.key]).length;
  const activeProgFlags  = RENAL_PROGNOSTIC_ITEMS.filter(i => data.renal_prognostic_factors?.[i.key]).length;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="igav-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Vasculite IgA (IgAV / HSP)</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="igav-save-btn">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* FORMA CLINICA + FATTORE SCATENANTE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Forma clinica</Label>
          </div>
          <BtnRow field="clinical_form" options={CLINICAL_FORMS} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Fattore scatenante</Label>
          </div>
          <BtnRow field="trigger" options={TRIGGERS} />
          {data.trigger && data.trigger !== "idiopathic" && (
            <Input className="mt-2 text-xs" value={data.trigger_detail || ""} onChange={e => set("trigger_detail", e.target.value)} placeholder="Dettaglio (es. nome farmaco, tipo vaccino, agente infettivo…)" />
          )}
        </div>
      </div>

      {/* SIEROLOGICO — solo IgA */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Beaker className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Sierologico</h3>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <Label className="text-xs text-gray-600">IgA sierica (mg/dL)</Label>
            <Input
              value={data.iga_level || ""}
              onChange={e => set("iga_level", e.target.value)}
              placeholder="es. 480"
              className="text-xs mt-1 w-32"
              data-testid="igav-iga-level"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer pb-1">
            <Checkbox checked={!!data.iga_elevated} onCheckedChange={v => set("iga_elevated", !!v)} data-testid="igav-iga-elevated" />
            <span className="text-sm font-medium text-gray-700">IgA elevata (↑ rispetto ai valori normali)</span>
          </label>
        </div>
        <p className="mt-2 text-[11px] text-gray-400 italic">
          C3/C4, ANCA e ANA sono disponibili nella sezione generale Esami / Autoimmunità del paziente.
        </p>
      </div>

      {/* ORGANI COINVOLTI */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <HeartPulse className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Organi coinvolti</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          {ORGANS.map(o => {
            const checked = !!data.organs?.[o.key];
            return (
              <label key={o.key} className={`flex items-start gap-2.5 border rounded-md p-2.5 cursor-pointer transition ${checked ? "border-red-300 bg-red-50/60" : "border-gray-200 hover:bg-gray-50"}`} data-testid={`igav-organ-${o.key}`}>
                <Checkbox checked={checked} onCheckedChange={v => setNested("organs", o.key, !!v)} />
                <div>
                  <div className="text-sm font-medium leading-tight">{o.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{o.hint}</div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Dettaglio CUTE */}
        {data.organs?.skin && (
          <div className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50/40">
            <div className="font-semibold text-xs uppercase tracking-wide text-gray-600 mb-3">Cute — Dettaglio</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Distribuzione porpora</Label>
                <BtnRow field="purpura_distribution" options={PURPURA_DIST} />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Biopsia cutanea</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={!!data.skin_biopsy} onCheckedChange={v => set("skin_biopsy", !!v)} />
                    <span className="text-xs">Eseguita</span>
                  </label>
                  {data.skin_biopsy && (
                    <div className="flex gap-1 ml-2">
                      {[{v: true, l:"IgA +"}, {v: false, l:"IgA –"}, {v: null, l:"N.D."}].map(opt => (
                        <button key={String(opt.v)} type="button"
                          onClick={() => set("skin_biopsy_iga", opt.v)}
                          className={`px-2 py-0.5 text-xs rounded border transition ${data.skin_biopsy_iga === opt.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                        >{opt.l}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dettaglio RENE — solo biopsia e Oxford; i parametri funzionali sono in Coinvolgimento renale */}
        {data.organs?.renal && (
          <div className="border border-indigo-200 rounded-lg p-4 mb-3 bg-indigo-50/30">
            <div className="font-semibold text-xs uppercase tracking-wide text-indigo-700 mb-3">Rene — Biopsia</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Biopsia renale</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={!!data.renal_biopsy} onCheckedChange={v => set("renal_biopsy", !!v)} />
                    <span className="text-xs">Eseguita</span>
                  </label>
                  {data.renal_biopsy && (
                    <div className="flex gap-1 ml-2">
                      {[{v: true, l:"IgA +"}, {v: false, l:"IgA –"}, {v: null, l:"N.D."}].map(opt => (
                        <button key={String(opt.v)} type="button"
                          onClick={() => set("renal_biopsy_iga", opt.v)}
                          className={`px-2 py-0.5 text-xs rounded border transition ${data.renal_biopsy_iga === opt.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                        >{opt.l}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {data.renal_biopsy && (
                <div>
                  <Label className="text-xs text-gray-600">Classificazione Oxford (MEST-C)</Label>
                  <Input value={data.oxford_class || ""} onChange={e => set("oxford_class", e.target.value)} placeholder="es. M1 E0 S1 T1 C0" className="text-xs mt-1" data-testid="igav-oxford" />
                </div>
              )}
            </div>
            <p className="mt-2.5 text-[11px] text-gray-400 italic">
              Proteinuria quantitativa, creatinina ed eGFR → sezione Laboratorio / Urine. I flag clinici sono nella sezione Coinvolgimento renale qui sotto.
            </p>
          </div>
        )}

        {/* Dettaglio GI */}
        {data.organs?.gi && (
          <div className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50/40">
            <div className="font-semibold text-xs uppercase tracking-wide text-gray-600 mb-2">Gastrointestinale — Dettaglio</div>
            <div className="flex flex-wrap gap-2">
              {GI_SYMPTOMS.map(s => (
                <label key={s.key} className={`flex items-center gap-1.5 border rounded-md px-3 py-1.5 cursor-pointer transition text-xs ${data.gi_symptoms?.[s.key] ? "border-orange-300 bg-orange-50 text-orange-800" : "border-gray-200 hover:bg-gray-50 text-gray-700"}`}>
                  <Checkbox checked={!!data.gi_symptoms?.[s.key]} onCheckedChange={v => setNested("gi_symptoms", s.key, !!v)} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Dettaglio ARTICOLARE */}
        {data.organs?.joint && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/40">
            <div className="font-semibold text-xs uppercase tracking-wide text-gray-600 mb-2">Articolare — Dettaglio</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Tipo</Label>
                <div className="flex gap-1 mt-1">
                  {["Artralgie", "Artrite", "Entrambi"].map(v => (
                    <button key={v} type="button"
                      onClick={() => set("joint_involvement", v)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition ${data.joint_involvement === v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                    >{v}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Sedi (es. ginocchia, caviglie)</Label>
                <Input value={data.joint_sites || ""} onChange={e => set("joint_sites", e.target.value)} placeholder="es. ginocchia bilaterali, caviglie" className="text-xs mt-1" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* COINVOLGIMENTO RENALE */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-indigo-600" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Coinvolgimento renale</h3>
          {activeRenalFlags > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 rounded">{activeRenalFlags} attivi</span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 italic mb-3">
          Flag clinici basati sui dati di Laboratorio / Urine / Parametri vitali. I valori numerici rimangono nelle sezioni dedicate.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RENAL_INVOLVEMENT_ITEMS.map(item => {
            const checked = !!data.renal_involvement?.[item.key];
            return (
              <label key={item.key}
                className={`flex items-start gap-2.5 border rounded-md p-2.5 cursor-pointer transition ${checked ? "border-indigo-400 bg-indigo-50/70" : "border-gray-200 hover:bg-gray-50"}`}
                data-testid={`igav-renal-${item.key}`}
              >
                <Checkbox checked={checked} onCheckedChange={v => setNested("renal_involvement", item.key, !!v)} />
                <div>
                  <div className="text-sm font-medium leading-tight">{item.label}</div>
                  {item.hint && <div className="text-[10px] text-gray-500 mt-0.5">{item.hint}</div>}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* FATTORI PROGNOSTICI RENALI */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Fattori prognostici renali</h3>
          {activeProgFlags > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded">{activeProgFlags} presenti</span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 italic mb-3">
          Indicatori associati a progressione verso IRC o danno renale cronico (linee guida KDIGO / SHARE).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RENAL_PROGNOSTIC_ITEMS.map(item => {
            const checked = !!data.renal_prognostic_factors?.[item.key];
            return (
              <label key={item.key}
                className={`flex items-start gap-2.5 border rounded-md p-2.5 cursor-pointer transition ${checked ? "border-amber-400 bg-amber-50/70" : "border-gray-200 hover:bg-gray-50"}`}
                data-testid={`igav-prog-${item.key}`}
              >
                <Checkbox checked={checked} onCheckedChange={v => setNested("renal_prognostic_factors", item.key, !!v)} />
                <div>
                  <div className="text-sm font-medium leading-tight">{item.label}</div>
                  {item.hint && <div className="text-[10px] text-gray-500 mt-0.5">{item.hint}</div>}
                </div>
              </label>
            );
          })}
        </div>
        {(data.renal_prognostic_factors?.crescents || data.renal_prognostic_factors?.chronic_lesions) && (
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              <strong>Attenzione:</strong> la presenza di crescents o lesioni fibro-interstiziali alla biopsia si associa a rischio elevato di progressione verso IRC — considerare terapia immunosoppressiva aggressiva e follow-up nefrologico ravvicinato.
            </p>
          </div>
        )}
      </div>

      {/* BASE DIAGNOSTICA */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Microscope className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Base diagnostica</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {DIAG_BASIS.map(b => {
            const checked = !!data.diagnostic_basis?.[b.key];
            return (
              <label key={b.key} className={`flex items-center gap-2.5 border rounded-md p-2.5 cursor-pointer transition ${checked ? "border-[#0A2540] bg-[#F9FAFB]" : "border-gray-200 hover:bg-gray-50"}`} data-testid={`igav-basis-${b.key}`}>
                <Checkbox checked={checked} onCheckedChange={v => setNested("diagnostic_basis", b.key, !!v)} />
                <span className="text-sm">{b.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* DECORSO */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-[#0A2540]" />
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Decorso clinico</Label>
        </div>
        <BtnRow field="course" options={COURSE_OPTIONS} />
        {data.course === "recurrent" && (
          <div className="mt-2">
            <Label className="text-xs text-gray-600">N° recidive documentate</Label>
            <Input value={data.recurrences || ""} onChange={e => set("recurrences", e.target.value)} placeholder="es. 2" className="text-xs mt-1 w-32" />
          </div>
        )}
      </div>

      {/* NOTE */}
      <div>
        <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 block mb-2">Note cliniche</Label>
        <Textarea rows={3} value={data.altro || ""} onChange={e => set("altro", e.target.value)} placeholder="Dettagli istologici, trattamenti specifici, note evolutive, complicanze…" data-testid="igav-altro" />
      </div>
    </Card>
  );
}
