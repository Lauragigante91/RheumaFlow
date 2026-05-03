import React, { useEffect, useState } from "react";
import { diseaseProfileApi } from "../lib/api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Save, Beaker, Bone, Wind, FileText } from "lucide-react";
import { toast } from "sonner";
import { TriState } from "./ui/TriState";

export default function RaProfileSection({ patient }) {
  const [data, setData] = useState({
    rf_status: "unknown",
    rf_titer: "",
    acpa_status: "unknown",
    acpa_titer: "",
    disease_type: "non_erosive", // erosive | non_erosive
    ild: false,
    altro: "",
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi
      .get(patient.id, "ra")
      .then((doc) => {
        if (doc?.data) setData((prev) => ({ ...prev, ...doc.data }));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "ra", data);
      toast.success("Profilo AR salvato");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setData((p) => ({ ...p, [k]: v }));

  if (!loaded) {
    return (
      <Card className="border-gray-200 shadow-sm p-6 text-sm text-gray-500" data-testid="ra-profile-loading">
        Caricamento profilo AR…
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="ra-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Artrite Reumatoide</h2>
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="bg-[#0A2540] text-white hover:bg-[#051626]"
          data-testid="ra-profile-save-btn"
        >
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Antibodies */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Beaker className="w-4 h-4 text-[#0A2540]" />
            <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Anticorpi</h3>
          </div>

          <div className="border border-gray-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-medium">Fattore Reumatoide (FR)</Label>
              <TriState value={data.rf_status} onChange={(v) => set("rf_status", v)} testid="ra-rf-status" />
            </div>
            {data.rf_status === "positive" && (
              <Input
                value={data.rf_titer || ""}
                onChange={(e) => set("rf_titer", e.target.value)}
                placeholder="Titolo (es. 120 UI/mL)"
                className="text-sm"
                data-testid="ra-rf-titer"
              />
            )}
          </div>

          <div className="border border-gray-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-medium">Anti-CCP / ACPA</Label>
              <TriState value={data.acpa_status} onChange={(v) => set("acpa_status", v)} testid="ra-acpa-status" />
            </div>
            {data.acpa_status === "positive" && (
              <Input
                value={data.acpa_titer || ""}
                onChange={(e) => set("acpa_titer", e.target.value)}
                placeholder="Titolo (es. 250 U/mL)"
                className="text-sm"
                data-testid="ra-acpa-titer"
              />
            )}
          </div>
        </div>

        {/* Disease type + ILD */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bone className="w-4 h-4 text-[#0A2540]" />
            <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700">Danno strutturale & organi</h3>
          </div>

          <div className="border border-gray-200 rounded-md p-3">
            <Label className="text-sm font-medium block mb-2">Forma</Label>
            <div className="flex gap-2" data-testid="ra-disease-type">
              {[
                { v: "non_erosive", l: "Non erosiva" },
                { v: "erosive", l: "Erosiva" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => set("disease_type", o.v)}
                  className={`flex-1 px-3 py-2 text-sm rounded-md border transition ${
                    data.disease_type === o.v
                      ? "bg-[#0A2540] text-white border-[#0A2540] font-semibold"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  }`}
                  data-testid={`ra-disease-type-${o.v}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <label
            className="flex items-center gap-3 border border-gray-200 rounded-md p-3 hover:bg-gray-50 cursor-pointer"
            data-testid="ra-ild-toggle"
          >
            <Checkbox
              checked={!!data.ild}
              onCheckedChange={(v) => set("ild", !!v)}
              data-testid="ra-ild-checkbox"
            />
            <div className="flex items-center gap-2 flex-1">
              <Wind className="w-4 h-4 text-[#0A2540]" />
              <div>
                <div className="text-sm font-medium">Interstiziopatia polmonare (RA-ILD)</div>
                <div className="text-[11px] text-gray-500">Pattern HRCT compatibile / confermata</div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Altro */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-[#0A2540]" />
          <Label className="text-sm font-bold uppercase tracking-[0.12em] text-gray-700">Altro</Label>
        </div>
        <Textarea
          rows={3}
          value={data.altro || ""}
          onChange={(e) => set("altro", e.target.value)}
          placeholder="Manifestazioni extra-articolari, comorbidità rilevanti, note cliniche..."
          data-testid="ra-altro"
        />
      </div>
    </Card>
  );
}
