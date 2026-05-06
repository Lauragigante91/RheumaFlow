import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Search, ChevronRight, RotateCcw, FileCheck2, Save } from "lucide-react";
import { toast } from "sonner";
import { CRITERIA, CRITERIA_GROUPS } from "../lib/criteria";
import { patientsApi, criteriaApi } from "../lib/api";
import ItalianDatePicker from "../components/ItalianDatePicker";

// Maps each criterion to a suggested diagnosis label
const CRITERIA_DIAGNOSIS_MAP = {
  acr_eular_2010_ra: "Artrite Reumatoide",
  caspar_psa: "Artrite Psoriasica",
  asas_axspa: "Spondiloartrite assiale",
  asas_ibp: null,
  acr_eular_2019_sle: "Lupus Eritematoso Sistemico",
  acr_eular_2016_sjogren: "Sindrome di Sjögren",
  acr_eular_2013_ssc: "Sclerosi Sistemica",
  vedoss_2011: "VEDOSS (Sclerodermia molto precoce)",
  acr_eular_2015_gout: "Gotta",
  acr_eular_2012_pmr: "Polimialgia Reumatica",
  acr_eular_2022_gpa: "Granulomatosi con Poliangite (GPA)",
  acr_eular_2022_mpa: "Poliangite Microscopica (MPA)",
  acr_eular_2022_egpa: "Granulomatosi Eosinofila con Poliangite (EGPA)",
  yamaguchi_aosd: "Still dell'adulto (AOSD)",
  acr_eular_2017_iim: "Miosite idiopatica infiammatoria",
  acr_2016_fm: "Fibromialgia",
  icbd_2014_behcet: "Malattia di Behçet",
  acr_eular_2019_igg4: "Malattia IgG4-correlata",
  acr_eular_2023_aps: "Sindrome da anticorpi antifosfolipidi (APS)",
  acr_eular_2022_gca: "Arterite Gigantocellulare (GCA)",
  acr_eular_2022_tak: "Arterite di Takayasu",
};

export default function Criteria() {
  const [searchParams] = useSearchParams();
  const paramPatient = searchParams.get("paziente");
  const paramOpen = searchParams.get("open");

  const [search, setSearch] = useState("");
  const [selectedDisease, setSelectedDisease] = useState("all");
  const [openCrit, setOpenCrit] = useState(null);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(paramPatient || "");

  useEffect(() => {
    patientsApi.list().then(setPatients).catch(() => {});
  }, []);

  // Auto-open criteria from URL param
  useEffect(() => {
    if (paramOpen) {
      const c = CRITERIA.find((x) => x.id === paramOpen);
      if (c) setOpenCrit(c);
    }
  }, [paramOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CRITERIA.filter((c) => {
      if (selectedDisease !== "all" && c.disease !== selectedDisease) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.disease.toLowerCase().includes(q) ||
        c.source.toLowerCase().includes(q)
      );
    });
  }, [search, selectedDisease]);

  return (
    <div className="space-y-6 fade-in" data-testid="criteria-page">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">Reference</div>
        <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tighter text-[#0A2540]">
          Criteri Classificativi
        </h1>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Calcolatori interattivi dei principali criteri classificativi delle malattie reumatiche. Seleziona una malattia per applicare i criteri al paziente.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Cerca criteri o malattia"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="criteria-search"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedDisease === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedDisease("all")}
          className={selectedDisease === "all" ? "bg-[#0A2540] text-white" : ""}
          data-testid="filter-all"
        >
          Tutte
        </Button>
        {CRITERIA_GROUPS.map((g) => (
          <Button
            key={g}
            variant={selectedDisease === g ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDisease(g)}
            className={selectedDisease === g ? "bg-[#0A2540] text-white" : ""}
            data-testid={`filter-${g}`}
          >
            {g}
          </Button>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => setOpenCrit(c)}
            className="text-left border border-gray-200 hover:border-[#0A2540] hover:shadow-md rounded-md p-5 transition-all bg-white group"
            data-testid={`criteria-card-${c.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{c.source}</div>
                <h3 className="font-heading font-bold text-lg tracking-tight mt-1 text-[#0A2540]">{c.name}</h3>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#0A2540] transition-colors" />
            </div>
            <Badge variant="outline" className="mt-3 text-xs">{c.disease}</Badge>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="p-10 text-center text-gray-500">Nessun criterio per questa ricerca.</div>
      )}

      <Dialog open={!!openCrit} onOpenChange={(v) => !v && setOpenCrit(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">{openCrit?.name}</DialogTitle>
          </DialogHeader>
          {openCrit && (
            <CriteriaInteractive
              criteria={openCrit}
              patients={patients}
              selectedPatient={selectedPatient}
              setSelectedPatient={setSelectedPatient}
              onSaved={() => setOpenCrit(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CriteriaInteractive({ criteria, patients = [], selectedPatient = "", setSelectedPatient, onSaved }) {
  const [state, setState] = useState({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const reset = () => setState({});

  const isDisabled = (cond) => {
    if (!cond || !cond.groupKey) return false;
    const cur = state[cond.groupKey];
    return cur !== undefined && (cond.values || []).map(String).includes(String(cur));
  };

  const total = useMemo(() => {
    let sum = 0;
    criteria.sections.forEach((sec) => {
      const sectionDisabled = isDisabled(sec.disableIfRadio);
      if (sec.type === "check") {
        sec.items.forEach((it) => {
          if (sectionDisabled || isDisabled(it.disableIfRadio)) return;
          if (state[it.key]) sum += it.points;
        });
      } else if (sec.type === "radio") {
        if (sectionDisabled) return;
        const val = state[sec.groupKey];
        if (val !== undefined) {
          const opt = sec.options.find((o) => String(o.value) === String(val));
          if (opt) sum += opt.points;
        }
      }
    });
    return sum;
  }, [state, criteria]);

  const meets = total >= criteria.threshold.value;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{criteria.source}</div>
        <h2 className="font-heading text-3xl font-black tracking-tighter text-[#0A2540] mt-1">
          {criteria.name}
        </h2>
        <p className="mt-2 text-sm text-gray-600">{criteria.intro}</p>
      </div>

      {/* Sections */}
      <div className="space-y-5">
        {criteria.sections.map((sec, sIdx) => {
          const sectionDisabled = isDisabled(sec.disableIfRadio);
          return (
          <Card key={sIdx} className={`border-gray-200 shadow-sm p-4 ${sectionDisabled ? "opacity-50" : ""}`}>
            {sec.title && (
              <h3 className="font-heading font-bold text-sm uppercase tracking-[0.15em] text-gray-700 mb-1">
                {sec.title}
              </h3>
            )}
            {sec.note && (
              <div className="text-xs italic text-gray-500 mb-3">⚠ {sec.note}</div>
            )}
            {sectionDisabled && (
              <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-3">
                Sezione non conteggiata: chirurgia della caviglia presente
              </div>
            )}

            {sec.type === "check" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sec.items.map((it) => {
                  const itemDisabled = sectionDisabled || isDisabled(it.disableIfRadio);
                  return (
                  <label
                    key={it.key}
                    className={`flex items-start gap-3 p-2.5 border border-gray-200 rounded-md ${itemDisabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "hover:bg-gray-50 cursor-pointer"}`}
                  >
                    <Checkbox
                      checked={!!state[it.key]}
                      disabled={itemDisabled}
                      onCheckedChange={(v) => setState((p) => ({ ...p, [it.key]: !!v }))}
                      data-testid={`crit-${criteria.id}-${it.key}`}
                    />
                    <div className="flex-1">
                      <div className="text-sm">{it.label}</div>
                      {it.note && (
                        <div className="text-xs italic text-gray-500 mt-0.5">⚠ {it.note}</div>
                      )}
                    </div>
                    {it.points !== 0 && (
                      <span className={`text-xs font-mono font-bold ${it.points < 0 ? "text-red-600" : "text-gray-500"}`}>
                        {it.points > 0 ? `+${it.points}` : it.points}
                      </span>
                    )}
                  </label>
                  );
                })}
              </div>
            )}

            {sec.type === "radio" && (
              <div className="space-y-1.5">
                {sec.options.map((opt) => {
                  const isSelected = String(state[sec.groupKey]) === String(opt.value);
                  return (
                    <button
                      key={String(opt.value)}
                      disabled={sectionDisabled}
                      onClick={() => setState((p) => ({ ...p, [sec.groupKey]: opt.value }))}
                      className={`w-full text-left flex items-center justify-between gap-3 p-2.5 border rounded-md transition-colors ${
                        sectionDisabled
                          ? "border-gray-200 cursor-not-allowed"
                          : isSelected
                          ? "border-[#0A2540] bg-[#F9FAFB] ring-1 ring-[#0A2540]"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                      data-testid={`crit-${criteria.id}-${sec.groupKey}-${opt.value}`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                            isSelected ? "border-[#0A2540] bg-[#0A2540]" : "border-gray-400"
                          }`}
                        />
                        <span className="text-sm">{opt.label}</span>
                      </div>
                      {opt.points !== 0 && (
                        <span className={`text-xs font-mono font-bold ${opt.points < 0 ? "text-red-600" : "text-gray-500"}`}>
                          {opt.points > 0 ? `+${opt.points}` : opt.points}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
          );
        })}
      </div>

      {/* Save to patient */}
      <Card className="border-gray-200 shadow-sm p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs uppercase tracking-[0.15em] text-gray-600 mb-1.5">Paziente</div>
            <Select value={selectedPatient} onValueChange={setSelectedPatient}>
              <SelectTrigger data-testid="criteria-patient-select"><SelectValue placeholder="Seleziona paziente" /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.cognome} {p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <div className="text-xs uppercase tracking-[0.15em] text-gray-600 mb-1.5">Data</div>
            <ItalianDatePicker value={date} onChange={setDate} testid="criteria-date" />
          </div>
          <Button
            onClick={async () => {
              if (!selectedPatient) {
                toast.error("Seleziona un paziente");
                return;
              }
              setSaving(true);
              try {
                await criteriaApi.create({
                  patient_id: selectedPatient,
                  criteria_id: criteria.id,
                  criteria_name: criteria.name,
                  source: criteria.source,
                  date,
                  score: total,
                  threshold: criteria.threshold.value,
                  meets,
                  selections: state,
                });
                toast.success("Valutazione criteri salvata");

                // Auto-suggest diagnosis update if criteria are met
                const suggested = CRITERIA_DIAGNOSIS_MAP[criteria.id];
                if (meets && suggested) {
                  const patient = patients.find((p) => p.id === selectedPatient);
                  if (patient && (patient.diagnosi || "").trim().toLowerCase() !== suggested.toLowerCase()) {
                    if (window.confirm(
                      `I criteri sono soddisfatti.\n\nVuoi aggiornare la diagnosi del paziente ${patient.cognome} ${patient.nome} a:\n"${suggested}"?\n\nDiagnosi attuale: ${patient.diagnosi || "—"}`
                    )) {
                      await patientsApi.update(selectedPatient, { diagnosi: suggested });
                      toast.success("Diagnosi aggiornata");
                    }
                  }
                }

                onSaved && onSaved();
              } catch (e) {
                toast.error(e.response?.data?.detail || "Errore");
              } finally {
                setSaving(false);
              }
            }}
            className="bg-[#0A2540] text-white hover:bg-[#051626]"
            disabled={saving}
            data-testid="criteria-save-btn"
          >
            <Save className="w-4 h-4 mr-2" /> Salva nel paziente
          </Button>
        </div>
      </Card>

      {/* Score summary */}
      <div className="sticky bottom-0 bg-white border-t-2 border-[#0A2540] -mx-6 px-6 pt-4 pb-2">
        <div className="p-4 bg-[#F9FAFB] border border-gray-200 rounded-md flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Score</div>
              <div className="font-mono font-black text-3xl text-[#0A2540]" data-testid="criteria-score">{total}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Soglia</div>
              <div className="font-mono font-bold text-lg">≥ {criteria.threshold.value}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Esito</div>
              <div className={`font-heading font-bold text-base flex items-center gap-2 ${meets ? "text-green-700" : "text-gray-700"}`} data-testid="criteria-result">
                {meets && <FileCheck2 className="w-4 h-4" />}
                {meets ? criteria.threshold.label : "Criteri non raggiunti"}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={reset} data-testid="criteria-reset">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Azzera
          </Button>
        </div>
        {criteria.note && (
          <div className="mt-3 text-xs text-gray-500 italic">Nota: {criteria.note}</div>
        )}
      </div>
    </div>
  );
}
