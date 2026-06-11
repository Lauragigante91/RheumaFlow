import React, { useEffect, useState, useMemo } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Save, Beaker, AlertTriangle, HeartPulse, FileText, Baby } from "lucide-react";
import { toast } from "sonner";

// GAPSS score components
const GAPSS_ITEMS = [
  { key: "hyperlipidemia",  label: "Iperlipidemia",              points: 3 },
  { key: "hypertension",    label: "Ipertensione arteriosa",     points: 1 },
  { key: "lac_positive",    label: "LAC positivo",               points: 4 },
  { key: "acl_40",          label: "aCL IgG/IgM ≥40 U",         points: 5 },
  { key: "ab2gpi_40",       label: "anti-β2GPI IgG/IgM ≥40 U", points: 4 },
];

const AB_FIELDS = [
  { key: "acl_igg",      label: "aCL IgG",            unit: "GPL-U/mL" },
  { key: "acl_igm",      label: "aCL IgM",            unit: "MPL-U/mL" },
  { key: "ab2gpi_igg",   label: "anti-β2GPI IgG",    unit: "U/mL" },
  { key: "ab2gpi_igm",   label: "anti-β2GPI IgM",    unit: "U/mL" },
  { key: "ab2gpi_iga",   label: "anti-β2GPI IgA",    unit: "U/mL" },
  { key: "lac",          label: "LAC (Lupus Anticoagulant)", unit: "" },
];

const THROMBOSIS = [
  { key: "art_stroke",  label: "Stroke / TIA",           type: "arteriale" },
  { key: "art_mi",      label: "Infarto miocardico",     type: "arteriale" },
  { key: "art_other",   label: "Altra trombosi arteriosa", type: "arteriale" },
  { key: "ven_dvt",     label: "TVP",                    type: "venosa" },
  { key: "ven_pe",      label: "Embolia polmonare",      type: "venosa" },
  { key: "ven_other",   label: "Altra trombosi venosa",  type: "venosa" },
  { key: "microvascular", label: "Microtrombosi / livedo racemosa", type: "micro" },
];

const OBSTETRIC = [
  { key: "loss_lt10",   label: "≥3 perdite fetali <10ª sett. (embrionica)" },
  { key: "loss_10_34",  label: "≥1 morte fetale ≥10ª sett. con morfologia normale" },
  { key: "premature",   label: "Parto prematuro <34ª sett. da preeclampsia/eclampsia/insufficienza placentare" },
];

const TERNARY = [
  { value: "positive", label: "Pos" },
  { value: "negative", label: "Neg" },
  { value: "borderline", label: "Borderline" },
  { value: "unknown",  label: "N.D." },
];

const DEFAULT = {
  aps_type: "",
  antibodies: {},
  antibody_titers: {},
  gapss: {},
  thrombosis: {},
  thrombosis_first_date: "",
  obstetric: {},
  current_anticoagulation: "",
  inr_target: "",
  current_inr: "",
  platelet_count: "",
  diagnostic_basis: {},
  course: "",
  altro: "",
};

export default function ApsProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "aps")
      .then(doc => { if (doc?.data) setData(p => ({ ...DEFAULT, ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const set = (k, v) => setData(p => ({ ...p, [k]: v }));
  const setNested = (obj, k, v) => setData(p => ({ ...p, [obj]: { ...p[obj], [k]: v } }));

  const gapssScore = useMemo(() => GAPSS_ITEMS.reduce((sum, i) => sum + (data.gapss?.[i.key] ? i.points : 0), 0), [data.gapss]);

  // Triple positivity
  const triplePos = useMemo(() => {
    const ab = data.antibodies || {};
    const posCount = ["lac","acl_igg","acl_igm","ab2gpi_igg","ab2gpi_igm"].filter(k => ab[k] === "positive").length;
    return posCount >= 3;
  }, [data.antibodies]);

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "aps", data);
      toast.success("Profilo APS salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) { toast.error(e.response?.data?.detail || "Errore salvataggio"); }
    finally { setSaving(false); }
  };

  if (!loaded) return <Card className="p-6 text-sm text-gray-500">Caricamento profilo APS…</Card>;

  const thrombArterial = THROMBOSIS.filter(t => t.type === "arteriale");
  const thrombVenous   = THROMBOSIS.filter(t => t.type === "venosa");
  const thrombMicro    = THROMBOSIS.filter(t => t.type === "micro");

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="aps-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Sindrome da Antifosfolipidi (APS)</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]">
          <Save className="w-4 h-4 mr-2" />{saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* TIPO */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700 w-full">Tipo APS</Label>
        {[{v:"primary",l:"Primaria"},{v:"secondary",l:"Secondaria (LES/CTD)"},{v:"catastrophic",l:"CAPS (catastrofica)"}].map(o => (
          <button key={o.v} type="button" onClick={() => set("aps_type", data.aps_type === o.v ? "" : o.v)}
            className={`px-2.5 py-1 text-xs rounded-md border transition ${data.aps_type === o.v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
          >{o.l}</button>
        ))}
      </div>

      {/* ANTICORPI */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Beaker className="w-4 h-4 text-[#0A2540]" />
            <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Profilo anticorpale</h3>
          </div>
          {triplePos && <span className="text-xs font-bold px-2 py-1 bg-red-100 text-red-700 border border-red-300 rounded-full">⚠ Tripla positività — alto rischio</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium text-gray-600 w-36">Anticorpo</th>
                <th className="text-center px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Risultato</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-medium text-gray-600">Titolo / valore</th>
              </tr>
            </thead>
            <tbody>
              {AB_FIELDS.map(ab => (
                <tr key={ab.key} className={data.antibodies?.[ab.key] === "positive" ? "bg-red-50/40" : ""}>
                  <td className="px-2 py-1.5 border border-gray-200 font-medium">{ab.label}</td>
                  <td className="px-2 py-1.5 border border-gray-200">
                    <div className="flex gap-1 justify-center">
                      {TERNARY.map(o => (
                        <button key={o.value} type="button" onClick={() => setNested("antibodies", ab.key, o.value)}
                          className={`px-1.5 py-0.5 text-xs rounded border transition ${data.antibodies?.[ab.key] === o.value
                            ? o.value === "positive" ? "bg-red-500 text-white border-red-500"
                              : o.value === "negative" ? "bg-green-600 text-white border-green-600"
                              : "bg-[#0A2540] text-white border-[#0A2540]"
                            : "bg-white text-gray-600 border-gray-200"}`}
                        >{o.label}</button>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 border border-gray-200">
                    <input type="text" value={data.antibody_titers?.[ab.key] || ""} onChange={e => setNested("antibody_titers", ab.key, e.target.value)}
                      placeholder={ab.unit || "valore"} className="w-full text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-[#0A2540]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GAPSS SCORE */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50/30">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">GAPSS Score (rischio trombosi)</Label>
          <div className={`px-3 py-1 rounded-full text-sm font-bold border ${gapssScore >= 10 ? "bg-red-50 border-red-300 text-red-700" : gapssScore >= 6 ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-gray-100 border-gray-300 text-gray-600"}`}>
            {gapssScore} punti{gapssScore >= 10 ? " — alto rischio" : gapssScore >= 6 ? " — rischio intermedio" : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {GAPSS_ITEMS.map(item => {
            const checked = !!data.gapss?.[item.key];
            return (
              <label key={item.key} className={`flex items-center gap-2 border rounded-md px-2.5 py-1.5 cursor-pointer text-xs transition ${checked ? "border-[#0A2540] bg-[#F0F4F8]" : "border-gray-200 hover:bg-gray-50"}`}>
                <Checkbox checked={checked} onCheckedChange={v => setNested("gapss", item.key, !!v)} />
                <span>{item.label}</span>
                <span className={`text-xs font-bold px-1 py-0.5 rounded ${checked ? "bg-[#0A2540] text-white" : "bg-gray-200 text-gray-600"}`}>+{item.points}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* EVENTI TROMBOTICI + OSTETRICI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Eventi trombotici</Label>
          </div>
          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Arteriosi</div>
          {thrombArterial.map(t => (
            <label key={t.key} className={`flex items-center gap-2 border rounded-md p-2 mb-1 cursor-pointer text-xs transition ${data.thrombosis?.[t.key] ? "border-red-300 bg-red-50/60" : "border-gray-200 hover:bg-gray-50"}`}>
              <Checkbox checked={!!data.thrombosis?.[t.key]} onCheckedChange={v => setNested("thrombosis", t.key, !!v)} />
              {t.label}
            </label>
          ))}
          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-2 mb-1">Venosi</div>
          {thrombVenous.map(t => (
            <label key={t.key} className={`flex items-center gap-2 border rounded-md p-2 mb-1 cursor-pointer text-xs transition ${data.thrombosis?.[t.key] ? "border-orange-300 bg-orange-50/60" : "border-gray-200 hover:bg-gray-50"}`}>
              <Checkbox checked={!!data.thrombosis?.[t.key]} onCheckedChange={v => setNested("thrombosis", t.key, !!v)} />
              {t.label}
            </label>
          ))}
          {thrombMicro.map(t => (
            <label key={t.key} className={`flex items-center gap-2 border rounded-md p-2 mb-1 cursor-pointer text-xs transition ${data.thrombosis?.[t.key] ? "border-amber-300 bg-amber-50/60" : "border-gray-200 hover:bg-gray-50"}`}>
              <Checkbox checked={!!data.thrombosis?.[t.key]} onCheckedChange={v => setNested("thrombosis", t.key, !!v)} />
              {t.label}
            </label>
          ))}
          <div className="mt-2">
            <Label className="text-xs text-gray-600">Data primo evento</Label>
            <Input type="date" value={data.thrombosis_first_date || ""} onChange={e => set("thrombosis_first_date", e.target.value)} className="text-xs mt-1" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Baby className="w-4 h-4 text-[#0A2540]" />
            <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Morbilità ostetrica</Label>
          </div>
          {OBSTETRIC.map(o => (
            <label key={o.key} className={`flex items-start gap-2 border rounded-md p-2 mb-1.5 cursor-pointer text-xs transition ${data.obstetric?.[o.key] ? "border-pink-300 bg-pink-50/40" : "border-gray-200 hover:bg-gray-50"}`}>
              <Checkbox checked={!!data.obstetric?.[o.key]} onCheckedChange={v => setNested("obstetric", o.key, !!v)} className="mt-0.5" />
              {o.label}
            </label>
          ))}

          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse className="w-4 h-4 text-[#0A2540]" />
              <Label className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">Anticoagulazione</Label>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {["Nessuna","Aspirina","Warfarin","LMWH","DOAC"].map(v => (
                <button key={v} type="button" onClick={() => set("current_anticoagulation", data.current_anticoagulation === v ? "" : v)}
                  className={`px-2 py-0.5 text-xs rounded border transition ${data.current_anticoagulation === v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >{v}</button>
              ))}
            </div>
            {data.current_anticoagulation === "Warfarin" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-600">Target INR</Label>
                  <div className="flex gap-1 mt-0.5">
                    {["2.0–3.0","2.5–3.5","3.0–4.0"].map(v => (
                      <button key={v} type="button" onClick={() => set("inr_target", v)}
                        className={`px-1.5 py-0.5 text-xs rounded border transition ${data.inr_target === v ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200"}`}
                      >{v}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">INR attuale</Label>
                  <Input value={data.current_inr || ""} onChange={e => set("current_inr", e.target.value)} placeholder="es. 2.4" className="text-xs mt-0.5" />
                </div>
              </div>
            )}
          </div>
          <div className="mt-3">
            <Label className="text-xs text-gray-600">Piastrine (×10³/µL)</Label>
            <Input value={data.platelet_count || ""} onChange={e => set("platelet_count", e.target.value)} placeholder="es. 95 (trombocitopenia APS)" className="text-xs mt-1" />
          </div>
        </div>
      </div>

      <Textarea rows={2} value={data.altro || ""} onChange={e => set("altro", e.target.value)} placeholder="Note: CAPS (eparina non frazionata + steroidi + IVIG/PE), risposta terapeutica, complicanze…" data-testid="aps-altro" />
    </Card>
  );
}
