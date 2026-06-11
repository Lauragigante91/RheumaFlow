import React, { useEffect, useState, useRef } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Save, Beaker, Activity, FileText, History } from "lucide-react";
import { toast } from "sonner";
import { TriState } from "../ui/TriState";
import { useEverPositiveAntibodies } from "../../hooks/useEverPositiveAntibodies";
import { buildEverPositivePatch, mergeEverPositivePatch } from "../../lib/everPositiveAntibodies";

const ANTIBODIES = [
  { group: "MSA — Sindrome antisintetasi (ASyS)", items: [
    { key: "jo1",  label: "Anti-Jo1 (anti-histidyl-tRNA)" },
    { key: "pl7",  label: "Anti-PL-7 (threonyl)" },
    { key: "pl12", label: "Anti-PL-12 (alanyl)" },
    { key: "ej",   label: "Anti-EJ (glycyl)" },
    { key: "oj",   label: "Anti-OJ (isoleucyl)" },
    { key: "ks",   label: "Anti-KS (asparaginyl)" },
  ]},
  { group: "MSA — Dermatomiosite", items: [
    { key: "mi2",   label: "Anti-Mi2 (classica DM)" },
    { key: "mda5",  label: "Anti-MDA5 (DM amiopatica, ILD rapida)" },
    { key: "tif1g", label: "Anti-TIF1-γ (associato a neoplasie)" },
    { key: "nxp2",  label: "Anti-NXP2 (calcinosi, neoplasie)" },
    { key: "sae",   label: "Anti-SAE" },
  ]},
  { group: "MSA — IMNM / altri", items: [
    { key: "srp",   label: "Anti-SRP (miopatia necrotizzante)" },
    { key: "hmgcr", label: "Anti-HMGCR (statin-indotta)" },
  ]},
  { group: "MAA — Overlap / associati", items: [
    { key: "pm_scl", label: "Anti-PM/Scl (overlap SSc)" },
    { key: "ku",     label: "Anti-Ku (overlap LES/SSc)" },
    { key: "u1rnp",  label: "Anti-U1-RNP (MCTD)" },
    { key: "ro52",   label: "Anti-Ro52 (ILD spesso concomitante)" },
  ]},
];

const SUBTYPES = [
  { value: "",              label: "— non specificato —" },
  { value: "DM",            label: "Dermatomiosite (DM)" },
  { value: "DM_amyopathic", label: "DM clinicamente amiopatica (CADM)" },
  { value: "PM",            label: "Polimiosite (PM)" },
  { value: "IBM",           label: "Miosite a corpi inclusi (IBM)" },
  { value: "IMNM",          label: "Miopatia necrotizzante immuno-mediata (IMNM)" },
  { value: "ASyS",          label: "Sindrome antisintetasi (ASyS)" },
  { value: "Overlap",       label: "Miosite overlap" },
  { value: "JDM",           label: "Dermatomiosite giovanile (JDM)" },
];

function EverPositiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
      <History className="w-3 h-3" /> storico
    </span>
  );
}

export default function MyositisProfileSection({ patient }) {
  const [data, setData] = useState({
    subtype: "",
    antibodies: {},
    ck_max: "",
    aldolase: "",
    ild_present: false,
    altro: "",
    dismissed_antibodies: [],
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [appliedKeys, setAppliedKeys] = useState(new Set());

  const { everPositiveMap } = useEverPositiveAntibodies(patient?.id);
  const profileLoaded = useRef(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "myositis")
      .then((doc) => { if (doc?.data) setData((p) => ({ ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => { profileLoaded.current = true; setLoaded(true); });
  }, [patient?.id]);

  useEffect(() => {
    if (!profileLoaded.current || everPositiveMap.size === 0) return;
    setData((prev) => {
      const { patch, applied } = buildEverPositivePatch("myositis", prev, everPositiveMap);
      if (applied.length === 0) return prev;
      setAppliedKeys(new Set(applied));
      return mergeEverPositivePatch(prev, patch);
    });
  }, [everPositiveMap, loaded]);

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "myositis", data);
      toast.success("Profilo miosite salvato");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const setAb = (key, val) => {
    setData((p) => {
      const dismissed = new Set(p.dismissed_antibodies || []);
      if (val !== "positive" && appliedKeys.has(key)) {
        dismissed.add(key);
      } else if (val === "positive") {
        dismissed.delete(key);
        setAppliedKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
      }
      return {
        ...p,
        antibodies: { ...p.antibodies, [key]: val },
        dismissed_antibodies: [...dismissed],
      };
    });
  };

  if (!loaded) return <Card className="p-6 text-sm text-gray-500" data-testid="myositis-profile-loading">Caricamento profilo miosite…</Card>;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="myositis-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Miosite / Miopatia infiammatoria</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="myositis-profile-save-btn">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      {/* Subtype + enzymes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="md:col-span-3">
          <Label className="text-xs uppercase tracking-[0.12em] text-gray-600">Sottotipo</Label>
          <div className="flex flex-wrap gap-1 mt-1" data-testid="myositis-subtype">
            {SUBTYPES.map((s) => (
              <button key={s.value || "none"} type="button"
                onClick={() => setData((p) => ({ ...p, subtype: s.value }))}
                className={`px-2.5 py-1 text-xs rounded-md border ${data.subtype === s.value ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                data-testid={`myositis-subtype-${s.value || "none"}`}
              >{s.label}</button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-600">CK max (U/L)</Label>
          <Input type="number" value={data.ck_max} onChange={(e) => setData((p) => ({ ...p, ck_max: e.target.value }))} placeholder="es. 4500" data-testid="myositis-ck" />
        </div>
        <div>
          <Label className="text-xs text-gray-600">Aldolasi (U/L)</Label>
          <Input type="number" value={data.aldolase} onChange={(e) => setData((p) => ({ ...p, aldolase: e.target.value }))} placeholder="es. 15" data-testid="myositis-aldolase" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer border border-gray-200 rounded-md p-2.5 h-fit mt-auto" data-testid="myositis-ild-toggle">
          <input type="checkbox" checked={!!data.ild_present} onChange={(e) => setData((p) => ({ ...p, ild_present: e.target.checked }))} className="w-4 h-4 accent-[#0A2540]" data-testid="myositis-ild-checkbox" />
          <Activity className="w-4 h-4 text-[#0A2540]" />
          Interstiziopatia polmonare (ILD)
        </label>
      </div>

      {/* Antibodies grouped */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Beaker className="w-4 h-4 text-[#0A2540]" />
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Anticorpi miosite-specifici e associati</h3>
        </div>
        {ANTIBODIES.map((g) => (
          <div key={g.group}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500 mb-2">{g.group}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {g.items.map((a) => {
                const isHistoric = appliedKeys.has(a.key);
                return (
                  <div key={a.key} className="border border-gray-200 rounded-md p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                        {a.label}
                        {isHistoric && <EverPositiveBadge />}
                      </Label>
                      <TriState
                        value={data.antibodies?.[a.key] || "unknown"}
                        onChange={(v) => setAb(a.key, v)}
                        testid={`myositis-${a.key}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Altro */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-[#0A2540]" />
          <Label className="text-sm font-bold uppercase tracking-[0.12em] text-gray-700">Altro</Label>
        </div>
        <Textarea rows={3} value={data.altro || ""} onChange={(e) => setData((p) => ({ ...p, altro: e.target.value }))} placeholder="Quadro cutaneo (rash eliotropo, papule di Gottron, meccanico), disfagia, neoplasie, biopsia, EMG, RMN muscolare..." data-testid="myositis-altro" />
      </div>
    </Card>
  );
}
