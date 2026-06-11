import React, { useEffect, useState, useRef } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { useArchiveValues } from "../../hooks/useArchiveValues";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Save, Beaker, Droplet, FileText, History, Archive } from "lucide-react";
import { toast } from "sonner";
import { TriState } from "../ui/TriState";
import { useEverPositiveAntibodies } from "../../hooks/useEverPositiveAntibodies";
import { buildEverPositivePatch, mergeEverPositivePatch } from "../../lib/everPositiveAntibodies";

const ANTIBODIES = [
  { key: "ana",       label: "ANA",                       hasTiter: true,  titerPh: "es. 1:640 omogeneo" },
  { key: "dsdna",     label: "Anti-dsDNA",                hasTiter: true,  titerPh: "UI/mL" },
  { key: "sm",        label: "Anti-Sm",                   hasTiter: false },
  { key: "ro_ssa",    label: "Anti-Ro/SSA",               hasTiter: false },
  { key: "la_ssb",    label: "Anti-La/SSB",               hasTiter: false },
  { key: "rnp",       label: "Anti-RNP",                  hasTiter: false },
  { key: "apl_acl",   label: "aCL (anticardiolipina)",    hasTiter: false },
  { key: "apl_b2gpi", label: "Anti-β2-GP1",               hasTiter: false },
  { key: "apl_lac",   label: "Lupus Anticoagulant (LAC)", hasTiter: false },
];

function ArchiveBadge({ entry, unit }) {
  if (!entry || entry.value == null) return null;
  const d = entry.date
    ? new Date(entry.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "2-digit" })
    : null;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      marginTop: "4px", padding: "2px 7px", borderRadius: "4px",
      fontSize: "11px", fontWeight: 500,
      color: "#0f766e", background: "#f0fdfa", border: "1px solid #99f6e4",
    }}>
      <Archive size={10} />
      <span>Archivio: <strong>{entry.value}</strong>{unit ? ` ${unit}` : ""}</span>
      {d && <span style={{ color: "#9ca3af" }}>· {d}</span>}
    </div>
  );
}

const RENAL_CLASSES = [
  { value: "",      label: "— non eseguita —" },
  { value: "I",     label: "Classe I (mesangiale minima)" },
  { value: "II",    label: "Classe II (mesangiale proliferativa)" },
  { value: "III",   label: "Classe III (focale)" },
  { value: "III+V", label: "Classe III + V" },
  { value: "IV",    label: "Classe IV (diffusa)" },
  { value: "IV+V",  label: "Classe IV + V" },
  { value: "V",     label: "Classe V (membranosa)" },
  { value: "VI",    label: "Classe VI (sclerosi avanzata)" },
];

function EverPositiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
      <History className="w-3 h-3" /> storico
    </span>
  );
}

export default function SleProfileSection({ patient }) {
  const [data, setData] = useState({
    antibodies: {},
    c3: "",
    c4: "",
    renal_involvement: false,
    renal_biopsy_class: "",
    proteinuria_24h: "",
    altro: "",
    dismissed_antibodies: [],
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [appliedKeys, setAppliedKeys] = useState(new Set());

  const { everPositiveMap } = useEverPositiveAntibodies(patient?.id);
  const { latestValues: archiveVals } = useArchiveValues(patient?.id);
  const profileLoaded = useRef(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "sle")
      .then((doc) => { if (doc?.data) setData((p) => ({ ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => { profileLoaded.current = true; setLoaded(true); });
  }, [patient?.id]);

  useEffect(() => {
    if (!profileLoaded.current || everPositiveMap.size === 0) return;
    setData((prev) => {
      const { patch, applied } = buildEverPositivePatch("sle", prev, everPositiveMap);
      if (applied.length === 0) return prev;
      setAppliedKeys(new Set(applied));
      return mergeEverPositivePatch(prev, patch);
    });
  }, [everPositiveMap, loaded]);

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "sle", data);
      toast.success("Profilo LES salvato");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const setAb = (key, field, value) => {
    setData((p) => {
      const dismissed = new Set(p.dismissed_antibodies || []);
      if (field === "status") {
        if (value !== "positive" && appliedKeys.has(key)) {
          dismissed.add(key);
        } else if (value === "positive") {
          dismissed.delete(key);
          setAppliedKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
        }
      }
      return {
        ...p,
        antibodies: { ...p.antibodies, [key]: { ...(p.antibodies?.[key] || {}), [field]: value } },
        dismissed_antibodies: [...dismissed],
      };
    });
  };

  if (!loaded) {
    return <Card className="p-6 text-sm text-gray-500" data-testid="sle-profile-loading">Caricamento profilo LES…</Card>;
  }

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="sle-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Lupus Eritematoso Sistemico</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="sle-profile-save-btn">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Antibodies */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Beaker className="w-4 h-4 text-[#0A2540]" />
            <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Anticorpi</h3>
          </div>
          {ANTIBODIES.map((a) => {
            const v = data.antibodies?.[a.key] || {};
            const isHistoric = appliedKeys.has(a.key);
            return (
              <div key={a.key} className="border border-gray-200 rounded-md p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                    {a.label}
                    {isHistoric && <EverPositiveBadge />}
                  </Label>
                  <TriState
                    value={v.status || "unknown"}
                    onChange={(val) => setAb(a.key, "status", val)}
                    testid={`sle-${a.key}-status`}
                  />
                </div>
                {a.hasTiter && v.status === "positive" && (
                  <Input
                    className="text-sm h-8"
                    value={v.titer || ""}
                    onChange={(e) => setAb(a.key, "titer", e.target.value)}
                    placeholder={a.titerPh}
                    data-testid={`sle-${a.key}-titer`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Complement + Renal */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Droplet className="w-4 h-4 text-[#0A2540]" />
            <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Complemento</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600">C3 (mg/dL)</Label>
              <Input value={data.c3 || ""} onChange={(e) => setData((p) => ({ ...p, c3: e.target.value }))} placeholder="90-180" data-testid="sle-c3" />
              <ArchiveBadge entry={archiveVals.c3} unit={archiveVals.c3?.unit || "mg/dL"} />
            </div>
            <div>
              <Label className="text-xs text-gray-600">C4 (mg/dL)</Label>
              <Input value={data.c4 || ""} onChange={(e) => setData((p) => ({ ...p, c4: e.target.value }))} placeholder="10-40" data-testid="sle-c4" />
              <ArchiveBadge entry={archiveVals.c4} unit={archiveVals.c4?.unit || "mg/dL"} />
            </div>
          </div>

          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700 pt-2">Nefrite lupica</h3>
          <label className="flex items-center gap-3 border border-gray-200 rounded-md p-3 hover:bg-gray-50 cursor-pointer" data-testid="sle-renal-toggle">
            <Checkbox checked={!!data.renal_involvement} onCheckedChange={(v) => setData((p) => ({ ...p, renal_involvement: !!v }))} data-testid="sle-renal-checkbox" />
            <div className="flex-1">
              <div className="text-sm font-medium">Impegno renale / nefrite lupica</div>
              <div className="text-[11px] text-gray-500">Proteinuria &gt; 0.5 g/24h, sedimento attivo, biopsia</div>
            </div>
          </label>

          {data.renal_involvement && (
            <div className="space-y-2 pl-1">
              <div>
                <Label className="text-xs text-gray-600">Classe ISN/RPS (biopsia renale)</Label>
                <Select value={data.renal_biopsy_class || ""} onValueChange={(v) => setData((p) => ({ ...p, renal_biopsy_class: v }))}>
                  <SelectTrigger data-testid="sle-renal-class"><SelectValue placeholder="Seleziona classe…" /></SelectTrigger>
                  <SelectContent>
                    {RENAL_CLASSES.map((c) => (
                      <SelectItem key={c.value || "none"} value={c.value || "none"}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Proteinuria 24h (g/24h)</Label>
                <Input value={data.proteinuria_24h || ""} onChange={(e) => setData((p) => ({ ...p, proteinuria_24h: e.target.value }))} placeholder="es. 2.4" data-testid="sle-proteinuria" />
                <ArchiveBadge entry={archiveVals.proteinuria_24h} unit={archiveVals.proteinuria_24h?.unit || "g/24h"} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Altro */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-[#0A2540]" />
          <Label className="text-sm font-bold uppercase tracking-[0.12em] text-gray-700">Altro</Label>
        </div>
        <Textarea rows={3} value={data.altro || ""} onChange={(e) => setData((p) => ({ ...p, altro: e.target.value }))} placeholder="Rash, sierositi, coinvolgimento ematologico/SNC, APS coesistente, note..." data-testid="sle-altro" />
      </div>
    </Card>
  );
}
