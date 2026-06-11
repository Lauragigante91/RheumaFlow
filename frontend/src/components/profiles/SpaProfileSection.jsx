import React, { useEffect, useState } from "react";
import { diseaseProfileApi } from "../../lib/api";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Save, User, Eye, Stethoscope, FileText, Bone, MoveVertical } from "lucide-react";
import { toast } from "sonner";

const FLAGS = [
  {
    key: "psoriasis",
    label: "Psoriasi",
    hint: "Cutanea e/o ungueale, presente o pregressa",
    Icon: User,
  },
  {
    key: "uveitis",
    label: "Uveite",
    hint: "Anteriore acuta ricorrente o posteriore",
    Icon: Eye,
  },
  {
    key: "ibd",
    label: "IBD (MICI)",
    hint: "Morbo di Crohn o Rettocolite ulcerosa",
    Icon: Stethoscope,
  },
  {
    key: "dactylitis",
    label: "Dattilite",
    hint: "Tumefazione \"a salsicciotto\" di un intero dito (presente o pregressa)",
    Icon: Bone,
  },
  {
    key: "enthesitis",
    label: "Entesite",
    hint: "Inserzione di Achille, fascia plantare, tuberosità ischiatica, epicondilo (es. LEI ≥1)",
    Icon: MoveVertical,
  },
];

export default function SpaProfileSection({ patient, onUpdated }) {
  const [data, setData] = useState({
    peripheral_involvement: false,
    axial_involvement: false,
    psoriasis: false,
    uveitis: false,
    ibd: false,
    dactylitis: false,
    enthesitis: false,
    altro: "",
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    diseaseProfileApi
      .get(patient.id, "spa")
      .then((doc) => {
        if (doc?.data) setData((prev) => ({ ...prev, ...doc.data }));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [patient?.id]);

  const save = async () => {
    setSaving(true);
    try {
      await diseaseProfileApi.upsert(patient.id, "spa", data);
      toast.success("Profilo SpA salvato");
      if (onUpdated) onUpdated(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <Card className="border-gray-200 shadow-sm p-6 text-sm text-gray-500" data-testid="spa-profile-loading">
        Caricamento profilo SpA…
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 shadow-sm p-6" data-testid="spa-profile-section">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">Profilo clinico</div>
          <h2 className="font-heading font-black text-2xl tracking-tight text-[#0A2540]">Spondiloartrite</h2>
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="bg-[#0A2540] text-white hover:bg-[#051626]"
          data-testid="spa-profile-save-btn"
        >
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </div>

      <div className="space-y-5">
        {/* Domini di malattia GRAPPA */}
        <div>
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700 mb-3">Domini di malattia</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: "peripheral_involvement", label: "Impegno articolare periferico", hint: "Artrite periferica (mani, piedi, grandi articolazioni)", Icon: Bone },
              { key: "axial_involvement", label: "Impegno assiale", hint: "Sacroileite / spondilite · abilita ASDAS, BASDAI, BASFI", Icon: MoveVertical },
            ].map(({ key, label, hint, Icon }) => {
              const checked = !!data[key];
              return (
                <label
                  key={key}
                  className={`flex items-start gap-3 border rounded-md p-3 cursor-pointer transition ${
                    checked ? "border-[#0A2540] bg-[#F9FAFB] ring-1 ring-[#0A2540]" : "border-gray-200 hover:bg-gray-50"
                  }`}
                  data-testid={`spa-${key}-toggle`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => setData((p) => ({ ...p, [key]: !!v }))}
                    data-testid={`spa-${key}-checkbox`}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <Icon className="w-4 h-4 text-[#0A2540]" />
                    <div>
                      <div className="text-sm font-semibold">{label}</div>
                      <div className="text-[11px] text-gray-500 leading-snug">{hint}</div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Manifestazioni extra-articolari */}
        <div>
          <h3 className="font-heading font-bold text-sm uppercase tracking-[0.12em] text-gray-700 mb-3">Manifestazioni extra-articolari</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {FLAGS.map(({ key, label, hint, Icon }) => {
              const checked = !!data[key];
              return (
                <label
                  key={key}
                  className={`flex items-start gap-3 border rounded-md p-3 cursor-pointer transition ${
                    checked
                      ? "border-[#0A2540] bg-[#F9FAFB] ring-1 ring-[#0A2540]"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                  data-testid={`spa-${key}-toggle`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => setData((p) => ({ ...p, [key]: !!v }))}
                    data-testid={`spa-${key}-checkbox`}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <Icon className="w-4 h-4 text-[#0A2540]" />
                    <div>
                      <div className="text-sm font-semibold">{label}</div>
                      <div className="text-[11px] text-gray-500 leading-snug">{hint}</div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
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
          onChange={(e) => setData((p) => ({ ...p, altro: e.target.value }))}
          placeholder="Entesite, dattilite, HLA-B27, eventi intestinali/cutanei/oculari, note cliniche..."
          data-testid="spa-altro"
        />
      </div>
    </Card>
  );
}
