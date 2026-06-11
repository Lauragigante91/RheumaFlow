import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { patientsApi } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Search, User, Trash2, Edit, ArrowUpDown, X, ShieldCheck, FlaskConical, CheckCircle2 } from "lucide-react";
import { PATIENT_STATES } from "../components/layout/PatientHeader";
import { toast } from "sonner";
import ItalianDatePicker from "../components/shared/ItalianDatePicker";

const emptyForm = {
  codice_paziente: "", nome: "", cognome: "",
  anno_nascita: "", data_nascita: "", sesso: "",
  codice_fiscale: "", diagnosi: "", diagnosi_secondarie: [], note: "",
  onset_year: "", onset_month: "",
  patient_state: "",
};

const WORKFLOW_OPTIONS = [
  {
    value: "first_visit",
    label: "Prima visita",
    description: "Valutazione diagnostica iniziale completa",
    icon: "📋",
    color: "border-blue-300 bg-blue-50 text-blue-900",
    activeRing: "ring-2 ring-blue-400",
  },
  {
    value: "workup_in_progress",
    label: "Iter diagnostico in corso",
    description: "Workup pre-diagnostico, diagnosi ancora aperta",
    icon: "🔬",
    color: "border-amber-300 bg-amber-50 text-amber-900",
    activeRing: "ring-2 ring-amber-400",
  },
  {
    value: "follow_up",
    label: "Follow-up di malattia nota",
    description: "Diagnosi definitiva, monitoraggio attività di malattia",
    icon: "✅",
    color: "border-emerald-300 bg-emerald-50 text-emerald-900",
    activeRing: "ring-2 ring-emerald-400",
  },
];

const SORT_OPTIONS = [
  { value: "cognome_asc", label: "Cognome (A→Z)" },
  { value: "cognome_desc", label: "Cognome (Z→A)" },
  { value: "created_desc", label: "Più recenti" },
  { value: "created_asc", label: "Più vecchi" },
  { value: "age_asc", label: "Età crescente" },
  { value: "age_desc", label: "Età decrescente" },
];

function calcAge(p) {
  if (p?.data_nascita) {
    const dob = new Date(p.data_nascita);
    if (!isNaN(dob.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
      return age;
    }
  }
  if (p?.anno_nascita) {
    return new Date().getFullYear() - Number(p.anno_nascita);
  }
  return null;
}

export default function Patients() {
  const { user } = useAuth();
  const pseudo = user?.pseudonymized_mode === true;
  const [patients, setPatients] = useState([]);
  const [filter, setFilter] = useState("");
  const [sex, setSex] = useState("all");
  const [diagnosis, setDiagnosis] = useState("all");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [sortBy, setSortBy] = useState("cognome_asc");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const data = await patientsApi.list();
    setPatients(data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      ...emptyForm,
      ...p,
      diagnosi_secondarie: Array.isArray(p?.diagnosi_secondarie) ? p.diagnosi_secondarie : [],
    });
    setOpen(true);
  };

  const save = async () => {
    const hasCode = !!(form.codice_paziente || "").trim();
    const hasName = !!(form.nome || "").trim() && !!(form.cognome || "").trim();
    if (!hasCode && !hasName) {
      toast.error(pseudo
        ? "Codice paziente obbligatorio in modalità pseudonimizzata"
        : "Fornisci almeno il codice paziente oppure nome + cognome"
      );
      return;
    }
    if (!editing && !form.patient_state) {
      toast.error("Seleziona il tipo di percorso clinico");
      return;
    }
    // Normalize payload: convert empty strings to null; anno_nascita to number
    const payload = { ...form };
    ["nome", "cognome", "data_nascita", "codice_fiscale", "diagnosi", "note", "sesso", "codice_paziente"].forEach((k) => {
      if (!payload[k]) payload[k] = null;
    });
    payload.anno_nascita = form.anno_nascita ? Number(form.anno_nascita) : null;
    payload.onset_year  = form.onset_year  ? Number(form.onset_year)  : null;
    payload.onset_month = form.onset_month ? Number(form.onset_month) : null;
    // Clean diagnosi_secondarie: array of trimmed non-empty strings
    payload.diagnosi_secondarie = (form.diagnosi_secondarie || [])
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    try {
      if (editing) {
        await patientsApi.update(editing.id, payload);
        toast.success("Paziente aggiornato");
      } else {
        await patientsApi.create(payload);
        toast.success("Paziente creato");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore");
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Eliminare definitivamente ${p.cognome} ${p.nome}?`)) return;
    await patientsApi.remove(p.id);
    toast.success("Paziente eliminato");
    load();
  };

  const diagnosisOptions = useMemo(() => {
    const set = new Set();
    patients.forEach((p) => { if (p.diagnosi) set.add(p.diagnosi); });
    return Array.from(set).sort();
  }, [patients]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let result = patients.filter((p) => {
      if (q) {
        const text = `${p.cognome || ""} ${p.nome || ""} ${p.codice_paziente || ""} ${p.codice_fiscale || ""} ${p.diagnosi || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (sex !== "all" && p.sesso !== sex) return false;
      if (diagnosis !== "all") {
        if (diagnosis === "_none" && p.diagnosi) return false;
        if (diagnosis !== "_none" && p.diagnosi !== diagnosis) return false;
      }
      const age = calcAge(p);
      if (ageMin !== "" && (age === null || age < Number(ageMin))) return false;
      if (ageMax !== "" && (age === null || age > Number(ageMax))) return false;
      return true;
    });
    result.sort((a, b) => {
      switch (sortBy) {
        case "cognome_asc":
          return (a.cognome || "").localeCompare(b.cognome || "", "it");
        case "cognome_desc":
          return (b.cognome || "").localeCompare(a.cognome || "", "it");
        case "created_desc":
          return (b.created_at || "").localeCompare(a.created_at || "");
        case "created_asc":
          return (a.created_at || "").localeCompare(b.created_at || "");
        case "age_asc":
          return (calcAge(a) ?? 999) - (calcAge(b) ?? 999);
        case "age_desc":
          return (calcAge(b) ?? -1) - (calcAge(a) ?? -1);
        default:
          return 0;
      }
    });
    return result;
  }, [patients, filter, sex, diagnosis, ageMin, ageMax, sortBy]);

  const hasActiveFilters = filter || sex !== "all" || diagnosis !== "all" || ageMin !== "" || ageMax !== "";
  const clearFilters = () => {
    setFilter("");
    setSex("all");
    setDiagnosis("all");
    setAgeMin("");
    setAgeMax("");
  };

  return (
    <div className="space-y-6 fade-in" data-testid="patients-page">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">Anagrafica</div>
          <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tighter text-[#0A2540]">
            Pazienti
          </h1>
          <p className="mt-2 text-gray-600">Gestisci l'anagrafica e accedi allo storico delle valutazioni.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-[#0A2540] hover:bg-[#051626] text-white" data-testid="add-patient-btn">
              <Plus className="w-4 h-4 mr-2" /> Nuovo paziente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-heading font-black tracking-tight">
                {editing ? "Modifica paziente" : "Nuovo paziente"}
              </DialogTitle>
            </DialogHeader>
            {pseudo && (
              <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Modalità pseudonimizzata attiva</div>
                  Inserisci solo il <strong>codice paziente</strong>, anno di nascita, sesso e diagnosi. Mantieni la corrispondenza codice↔identità offline.
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Field label={pseudo ? "Codice paziente *" : "Codice paziente"} required={pseudo}>
                  <Input
                    data-testid="patient-codice"
                    value={form.codice_paziente || ""}
                    onChange={(e) => setForm({ ...form, codice_paziente: e.target.value })}
                    placeholder="es. RX-2026-001"
                  />
                </Field>
              </div>

              {/* ── Tipo di percorso ── */}
              <div className="md:col-span-2">
                <div className="mb-1.5 flex items-center gap-1">
                  <span className="text-xs font-semibold text-gray-700">Tipo di percorso</span>
                  {!editing && <span className="text-red-500 text-xs ml-0.5">*</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {WORKFLOW_OPTIONS.map((opt) => {
                    const active = form.patient_state === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          const cleared = opt.value !== "follow_up" && !editing
                            ? { diagnosi: "", diagnosi_secondarie: [], onset_year: "", onset_month: "", note: "" }
                            : {};
                          setForm({ ...form, patient_state: opt.value, ...cleared });
                        }}
                        className={`text-left p-3 rounded-lg border transition-all ${opt.color} ${active ? opt.activeRing : "opacity-70 hover:opacity-90"}`}
                      >
                        <div className="text-base mb-0.5">{opt.icon}</div>
                        <div className="font-semibold text-sm leading-tight">{opt.label}</div>
                        <div className="text-[11px] mt-0.5 opacity-75 leading-snug">{opt.description}</div>
                      </button>
                    );
                  })}
                </div>
                {!editing && !form.patient_state && (
                  <p className="text-[11px] text-gray-400 mt-1">Seleziona il tipo di percorso per il paziente.</p>
                )}
              </div>

              {!pseudo && (
                <>
                  <Field label="Nome *">
                    <Input data-testid="patient-nome" value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                  </Field>
                  <Field label="Cognome *">
                    <Input data-testid="patient-cognome" value={form.cognome || ""} onChange={(e) => setForm({ ...form, cognome: e.target.value })} />
                  </Field>
                  <Field label="Data di nascita">
                    <ItalianDatePicker value={form.data_nascita || ""} onChange={(v) => setForm({ ...form, data_nascita: v })} testid="patient-data-nascita" />
                  </Field>
                  <Field label="Codice Fiscale">
                    <Input data-testid="patient-cf" value={form.codice_fiscale || ""} onChange={(e) => setForm({ ...form, codice_fiscale: e.target.value.toUpperCase() })} />
                  </Field>
                </>
              )}
              {pseudo && (
                <Field label="Anno di nascita">
                  <Input
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    data-testid="patient-anno-nascita"
                    value={form.anno_nascita || ""}
                    onChange={(e) => setForm({ ...form, anno_nascita: e.target.value })}
                    placeholder="es. 1965"
                  />
                </Field>
              )}
              <Field label="Sesso">
                <Select value={form.sesso || ""} onValueChange={(v) => setForm({ ...form, sesso: v })}>
                  <SelectTrigger data-testid="patient-sesso"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="M">Maschio</SelectItem>
                    <SelectItem value="F">Femmina</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {/* Clinical fields — only for follow-up patients (or when editing any patient) */}
              {(editing || form.patient_state === "follow_up") && (<>
                <Field label="Diagnosi (principale)">
                  <Input data-testid="patient-diagnosi" value={form.diagnosi || ""} onChange={(e) => setForm({ ...form, diagnosi: e.target.value })} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Diagnosi secondarie / overlap (separate da virgola)">
                    <Input
                      data-testid="patient-diagnosi-secondarie"
                      value={(form.diagnosi_secondarie || []).join(", ")}
                      onChange={(e) => setForm({
                        ...form,
                        diagnosi_secondarie: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })}
                      placeholder="es. Fibromialgia, Osteoporosi, Sjögren secondario"
                    />
                    <div className="text-[11px] text-gray-500 italic mt-1">
                      Le diagnosi qui inserite contribuiscono ai profili clinici e alle linee guida suggerite (es. AR + Fibromialgia → entrambe le sezioni vengono mostrate).
                    </div>
                  </Field>
                </div>
                {/* Disease onset */}
                <div className="md:col-span-2">
                  <div className="border-t border-gray-100 pt-3 mt-1">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-2">
                      Esordio di malattia
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Anno esordio">
                        <Input
                          type="number"
                          min="1900"
                          max={new Date().getFullYear()}
                          data-testid="patient-onset-year"
                          value={form.onset_year || ""}
                          onChange={(e) => setForm({ ...form, onset_year: e.target.value })}
                          placeholder={String(new Date().getFullYear() - 5)}
                        />
                      </Field>
                      <Field label="Mese esordio (opzionale)">
                        <Select
                          value={form.onset_month ? String(form.onset_month) : ""}
                          onValueChange={(v) => setForm({ ...form, onset_month: v })}
                        >
                          <SelectTrigger data-testid="patient-onset-month">
                            <SelectValue placeholder="Mese (opz.)" />
                          </SelectTrigger>
                          <SelectContent>
                            {["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"].map((m, i) => (
                              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="text-[11px] text-gray-400 italic mt-1">
                      La durata di malattia influisce su classificazione, prognosi e strategia terapeutica.
                      Se il mese esatto è sconosciuto, inserisci solo l'anno.
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Field label="Note cliniche">
                    <Textarea data-testid="patient-note" value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} />
                  </Field>
                </div>
              </>)}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
              <Button className="bg-[#0A2540] text-white hover:bg-[#051626]" onClick={save} data-testid="save-patient-btn">
                {editing ? "Aggiorna" : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & filters */}
      <Card className="border-gray-200 shadow-sm p-4 space-y-3" data-testid="patients-filters">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Cerca per cognome, nome, CF o diagnosi"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              data-testid="patient-search"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44" data-testid="patient-sort">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="patient-clear-filters">
              <X className="w-3.5 h-3.5 mr-1" /> Pulisci
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Sesso</Label>
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger className="mt-1" data-testid="filter-sex"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="M">M</SelectItem>
                <SelectItem value="F">F</SelectItem>
                <SelectItem value="Altro">Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Diagnosi</Label>
            <Select value={diagnosis} onValueChange={setDiagnosis}>
              <SelectTrigger className="mt-1" data-testid="filter-diagnosis"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="_none">Senza diagnosi</SelectItem>
                {diagnosisOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Età min</Label>
            <Input type="number" min="0" max="120" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} placeholder="es. 18" className="mt-1" data-testid="filter-age-min" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Età max</Label>
            <Input type="number" min="0" max="120" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} placeholder="es. 80" className="mt-1" data-testid="filter-age-max" />
          </div>
        </div>
        <div className="text-xs text-gray-500" data-testid="patients-count">
          {filtered.length} su {patients.length} pazienti
        </div>
      </Card>

      {/* Table */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500" data-testid="empty-patients">
            {patients.length === 0 ? "Nessun paziente. Aggiungine uno per iniziare." : "Nessun risultato per questa ricerca."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] border-b border-gray-200">
                <tr className="text-left">
                  <Th>{pseudo ? "Codice" : "Cognome / Nome"}</Th>
                  <Th>{pseudo ? "Età" : "Data nascita"}</Th>
                  <Th>Sesso</Th>
                  <Th>Diagnosi</Th>
                  <Th>Percorso</Th>
                  <Th className="text-right">Azioni</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const age = calcAge(p);
                  const displayName = pseudo
                    ? (p.codice_paziente || "—")
                    : (`${p.cognome || ""} ${p.nome || ""}`.trim() || p.codice_paziente || "—");
                  const initials = pseudo
                    ? (p.codice_paziente?.slice(0, 2).toUpperCase() || "PZ")
                    : ((p.cognome?.[0] || "") + (p.nome?.[0] || "") || "PZ");
                  return (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/pazienti/${p.id}`} className="flex items-center gap-3 font-medium text-[#0A2540] hover:underline" data-testid={`patient-row-${p.id}`}>
                          <div className="w-8 h-8 rounded-full bg-[#0A2540] text-white flex items-center justify-center text-xs font-bold">
                            {initials}
                          </div>
                          <div>
                            <div>{displayName}</div>
                            {!pseudo && p.codice_paziente && (
                              <div className="text-[10px] text-gray-400 font-mono">{p.codice_paziente}</div>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {pseudo
                          ? (age !== null ? `${age} anni` : "-")
                          : (p.data_nascita ? new Date(p.data_nascita).toLocaleDateString("it-IT") : "-")}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.sesso || "-"}</td>
                      <td className="px-4 py-3 text-gray-700">{p.diagnosi || "-"}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const cfg = p.patient_state ? PATIENT_STATES[p.patient_state] : null;
                          if (!cfg) return <span className="text-[11px] text-gray-400">—</span>;
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`edit-${p.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(p)} data-testid={`delete-${p.id}`}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const Th = ({ children, className = "" }) => (
  <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500 ${className}`}>{children}</th>
);

const Field = ({ label, children, required }) => (
  <div className="space-y-1.5">
    <Label className={`text-xs font-semibold uppercase tracking-[0.15em] ${required ? "text-red-700" : "text-gray-600"}`}>{label}</Label>
    {children}
  </div>
);
