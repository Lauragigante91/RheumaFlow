import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { patientsApi } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Search, User, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

const emptyForm = { nome: "", cognome: "", data_nascita: "", sesso: "", codice_fiscale: "", diagnosi: "", note: "" };

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const data = await patientsApi.list();
    setPatients(data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...emptyForm, ...p }); setOpen(true); };

  const save = async () => {
    if (!form.nome || !form.cognome) {
      toast.error("Nome e cognome sono obbligatori");
      return;
    }
    try {
      if (editing) {
        await patientsApi.update(editing.id, form);
        toast.success("Paziente aggiornato");
      } else {
        await patientsApi.create(form);
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

  const filtered = patients.filter((p) =>
    `${p.cognome} ${p.nome} ${p.codice_fiscale || ""} ${p.diagnosi || ""}`
      .toLowerCase()
      .includes(filter.toLowerCase())
  );

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome *" required>
                <Input data-testid="patient-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </Field>
              <Field label="Cognome *" required>
                <Input data-testid="patient-cognome" value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} />
              </Field>
              <Field label="Data di nascita">
                <Input type="date" data-testid="patient-data-nascita" value={form.data_nascita || ""} onChange={(e) => setForm({ ...form, data_nascita: e.target.value })} />
              </Field>
              <Field label="Sesso">
                <Select value={form.sesso || ""} onValueChange={(v) => setForm({ ...form, sesso: v })}>
                  <SelectTrigger data-testid="patient-sesso"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Maschio</SelectItem>
                    <SelectItem value="F">Femmina</SelectItem>
                    <SelectItem value="Altro">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Codice Fiscale">
                <Input data-testid="patient-cf" value={form.codice_fiscale || ""} onChange={(e) => setForm({ ...form, codice_fiscale: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Diagnosi">
                <Input data-testid="patient-diagnosi" value={form.diagnosi || ""} onChange={(e) => setForm({ ...form, diagnosi: e.target.value })} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Note cliniche">
                  <Textarea data-testid="patient-note" value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} />
                </Field>
              </div>
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Cerca per cognome, nome, CF o diagnosi"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          data-testid="patient-search"
        />
      </div>

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
                  <Th>Cognome / Nome</Th>
                  <Th>Data nascita</Th>
                  <Th>Sesso</Th>
                  <Th>Diagnosi</Th>
                  <Th className="text-right">Azioni</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/pazienti/${p.id}`} className="flex items-center gap-3 font-medium text-[#0A2540] hover:underline" data-testid={`patient-row-${p.id}`}>
                        <div className="w-8 h-8 rounded-full bg-[#0A2540] text-white flex items-center justify-center text-xs font-bold">
                          {(p.cognome?.[0] || "") + (p.nome?.[0] || "")}
                        </div>
                        {p.cognome} {p.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.data_nascita ? new Date(p.data_nascita).toLocaleDateString("it-IT") : "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{p.sesso || "-"}</td>
                    <td className="px-4 py-3 text-gray-700">{p.diagnosi || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`edit-${p.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(p)} data-testid={`delete-${p.id}`}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
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

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-600">{label}</Label>
    {children}
  </div>
);
