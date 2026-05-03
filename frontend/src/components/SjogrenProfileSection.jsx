import React, { useEffect, useState } from "react";
import { diseaseProfileApi } from "../lib/api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Save, Beaker, Eye, Microscope, FileText } from "lucide-react";
import { toast } from "sonner";
import { TriState } from "./ui/TriState";

const ANTIBODIES = [
  { key: "ssa_ro", label: "Anti-Ro/SSA (52 o 60 kDa)", hasTiter: true, titerPh: "titolo/UI" },
  { key: "ssb_la", label: "Anti-La/SSB", hasTiter: true, titerPh: "titolo/UI" },
  { key: "ana", label: "ANA", hasTiter: true, titerPh: "1:160 screziato" },
  { key: "rf", label: "Fattore Reumatoide (FR)", hasTiter: true, titerPh: "UI/mL" },
];

export default function SjogrenProfileSection({ patient }) {
  const [data, setData] = useState({
    antibodies: {},
    schirmer_right_mm: "",
    schirmer_left_mm: "",
    salivary_flow: "",
    biopsy_done: false,
    biopsy_focus_score: "",
    biopsy_notes: "",
    altro: "",
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi.get(patient.id, "sjogren")
      .then((doc) => { if (doc?.data) setData((p) => ({ ...p, ...doc.data })); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "sjogren", data);
      toast.success("Profilo Sjögren salvato");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const setAb = (key, field, value) => {
    setData((p) => ({
      ...p,
      antibodies: { ...p.antibodies, [key]: { ...(p.antibodies?.[key] || {}), [field]: value } },
    }));
  };

  if (!loaded) return <Card className="p-6 text-sm text-gray-500" data-testid="sjogren-profile-loading">Caricamento profilo Sjögren…</Card>;

  const focusPathol = data.biopsy_focus_score && Number(data.biopsy_focus_score) >= 1;
  const schirmerRightPathol = data.schirmer_right_mm !== "" && Number(data.schirmer_right_mm) <= 5;
  const schirmerLeftPathol = data.schirmer_left_mm !== "" && Number(data.schirmer_left_mm) <= 5;

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="sjogren-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Sindrome di Sjögren</h2>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#0A2540] text-white hover:bg-[#051626]" data-testid="sjogren-profile-save-btn">
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
            return (
              <div key={a.key} className="border border-gray-200 rounded-md p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-medium">{a.label}</Label>
                  <TriState value={v.status || "unknown"} onChange={(val) => setAb(a.key, "status", val)} testid={`sjogren-${a.key}-status`} />
                </div>
                {a.hasTiter && v.status === "positive" && (
                  <Input className="text-sm h-8" value={v.titer || ""} onChange={(e) => setAb(a.key, "titer", e.target.value)} placeholder={a.titerPh} data-testid={`sjogren-${a.key}-titer`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Schirmer + Biopsy */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-[#0A2540]" />
              <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Test di Schirmer</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Occhio destro (mm/5 min)</Label>
                <Input type="number" value={data.schirmer_right_mm} onChange={(e) => setData((p) => ({ ...p, schirmer_right_mm: e.target.value }))} placeholder="es. 4" data-testid="sjogren-schirmer-right" className={schirmerRightPathol ? "border-red-400" : ""} />
                {schirmerRightPathol && <span className="text-[10px] text-red-600">Patologico (≤5 mm)</span>}
              </div>
              <div>
                <Label className="text-xs text-gray-600">Occhio sinistro (mm/5 min)</Label>
                <Input type="number" value={data.schirmer_left_mm} onChange={(e) => setData((p) => ({ ...p, schirmer_left_mm: e.target.value }))} placeholder="es. 3" data-testid="sjogren-schirmer-left" className={schirmerLeftPathol ? "border-red-400" : ""} />
                {schirmerLeftPathol && <span className="text-[10px] text-red-600">Patologico (≤5 mm)</span>}
              </div>
            </div>
            <div className="mt-2">
              <Label className="text-xs text-gray-600">Flusso salivare non stimolato (mL/min)</Label>
              <Input value={data.salivary_flow || ""} onChange={(e) => setData((p) => ({ ...p, salivary_flow: e.target.value }))} placeholder="es. 0.05 (patologico ≤0.1)" data-testid="sjogren-saliva" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Microscope className="w-4 h-4 text-[#0A2540]" />
              <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Biopsia ghiandole salivari minori</h3>
            </div>
            <div className="border border-gray-200 rounded-md p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!data.biopsy_done} onChange={(e) => setData((p) => ({ ...p, biopsy_done: e.target.checked }))} className="w-4 h-4 accent-[#0A2540]" data-testid="sjogren-biopsy-done" />
                Biopsia eseguita
              </label>
              {data.biopsy_done && (
                <>
                  <div>
                    <Label className="text-xs text-gray-600">Focus score (n° foci / 4 mm²)</Label>
                    <Input type="number" step="0.1" value={data.biopsy_focus_score || ""} onChange={(e) => setData((p) => ({ ...p, biopsy_focus_score: e.target.value }))} placeholder="es. 1.5 (patologico ≥1)" data-testid="sjogren-focus-score" className={focusPathol ? "border-red-400" : ""} />
                    {focusPathol && <span className="text-[10px] text-red-600">Focus ≥1: compatibile con Sjögren</span>}
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Descrizione</Label>
                    <Input value={data.biopsy_notes || ""} onChange={(e) => setData((p) => ({ ...p, biopsy_notes: e.target.value }))} placeholder="Infiltrato linfocitario, pattern..." data-testid="sjogren-biopsy-notes" />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Altro */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-[#0A2540]" />
          <Label className="text-sm font-bold uppercase tracking-[0.12em] text-gray-700">Altro</Label>
        </div>
        <Textarea rows={3} value={data.altro || ""} onChange={(e) => setData((p) => ({ ...p, altro: e.target.value }))} placeholder="Parotite ricorrente, linfoma MALT, cheratocongiuntivite sicca, impegno extra-ghiandolare..." data-testid="sjogren-altro" />
      </div>
    </Card>
  );
}
