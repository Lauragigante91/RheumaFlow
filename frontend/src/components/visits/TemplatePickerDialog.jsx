import React, { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { visitTemplatesApi } from "../../lib/api";
import { Check, Pencil, Trash2, Plus, Save, X, FileText, Search } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS = {
  rheumatic_history: "Anamnesi reumatologica",
  physical_exam: "Esame obiettivo",
  diagnostic_conclusion: "Conclusione diagnostica",
  outcome_notes: "Indicazioni",
  therapy: "Terapia indicata",
  indications: "Indicazioni terapeutiche",
};

export default function TemplatePickerDialog({
  open: openProp,
  onClose,
  onLoad,
  onSelect,
  category,
  currentText,
}) {
  const isSelfContained = onSelect !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);

  const open = isSelfContained ? internalOpen : openProp;
  const handleClose = isSelfContained ? () => setInternalOpen(false) : onClose;
  const handleLoad = isSelfContained
    ? (text) => { onSelect(text); setInternalOpen(false); }
    : onLoad;

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [newName, setNewName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [savingNew, setSavingNew] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [overwriteId, setOverwriteId] = useState(null);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const data = await visitTemplatesApi.list(category);
      setTemplates(data);
    } catch {
      toast.error("Impossibile caricare i template.");
    } finally {
      setLoading(false);
    }
  }, [open, category]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open) {
      setShowNewForm(false);
      setNewName("");
      setEditingId(null);
      setOverwriteId(null);
      setSearch("");
    }
  }, [open]);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("Inserisci un nome per il template."); return; }
    if (!currentText?.trim()) { toast.error("Il testo corrente è vuoto."); return; }
    setSavingNew(true);
    try {
      const created = await visitTemplatesApi.create({ category, name: newName.trim(), content: currentText });
      setTemplates((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setShowNewForm(false);
      toast.success("Template salvato.");
    } catch { toast.error("Errore nel salvataggio."); }
    finally { setSavingNew(false); }
  };

  const handleOverwrite = async (id) => {
    if (!currentText?.trim()) { toast.error("Il testo corrente è vuoto."); return; }
    try {
      const updated = await visitTemplatesApi.update(id, { content: currentText });
      setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, content: currentText, updated_at: updated.updated_at } : t));
      setOverwriteId(null);
      toast.success("Template aggiornato con il testo corrente.");
    } catch { toast.error("Errore nell'aggiornamento."); }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) { toast.error("Il nome non può essere vuoto."); return; }
    setSavingEdit(true);
    try {
      await visitTemplatesApi.update(editingId, { name: editName.trim(), content: editContent });
      setTemplates((prev) =>
        prev.map((t) => t.id === editingId ? { ...t, name: editName.trim(), content: editContent } : t)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
      toast.success("Template aggiornato.");
    } catch { toast.error("Errore nell'aggiornamento."); }
    finally { setSavingEdit(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Eliminare il template "${name}"?`)) return;
    try {
      await visitTemplatesApi.remove(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template eliminato.");
    } catch { toast.error("Errore nell'eliminazione."); }
  };

  const startEdit = (tpl) => {
    setEditingId(tpl.id);
    setEditName(tpl.name);
    setEditContent(tpl.content);
  };

  const q = search.trim().toLowerCase();
  const visibleTemplates = q
    ? templates.filter(
        (t) =>
          (t.name || "").toLowerCase().includes(q) ||
          (t.content || "").toLowerCase().includes(q),
      )
    : templates;

  return (
    <>
      {isSelfContained && (
        <button
          type="button"
          onClick={() => setInternalOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#0A2540] hover:bg-gray-100 px-2 py-0.5 rounded transition-colors"
        >
          <FileText className="w-3 h-3" />
          Template
        </button>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base font-heading">
              <FileText className="w-4 h-4 text-[#0A2540]" />
              Template — {CATEGORY_LABELS[category] || category}
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Seleziona un template da caricare nel campo, oppure crea/modifica i tuoi template personali.
            </p>
          </DialogHeader>

          {!loading && templates.length > 0 && (
            <div className="flex-shrink-0 px-5 pt-3 pb-1">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca template..."
                  className="w-full h-8 text-xs pl-9 pr-8 border border-gray-200 rounded-md focus:outline-none focus:border-blue-300"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    title="Cancella ricerca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 min-h-0">
            {loading && <p className="text-xs text-gray-400 text-center py-6">Caricamento…</p>}

            {!loading && templates.length === 0 && !showNewForm && (
              <div className="text-center py-10">
                <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">Nessun template salvato</p>
                <p className="text-xs text-gray-400 mt-1">Scrivi il testo nel campo e salvalo come template.</p>
              </div>
            )}

            {!loading && templates.length > 0 && visibleTemplates.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-10">Nessun template trovato</p>
            )}

            {!loading && visibleTemplates.map((tpl) => (
              <div key={tpl.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {editingId === tpl.id ? (
                  <div className="p-3 space-y-2 bg-gray-50">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nome template"
                      className="w-full h-8 text-xs px-3 border border-gray-200 rounded-md focus:outline-none focus:border-blue-300 bg-white"
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={8}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-300 bg-white leading-relaxed font-mono"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-7 text-xs">
                        <X className="w-3 h-3 mr-1" /> Annulla
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit}
                        className="h-7 text-xs bg-[#0A2540] text-white hover:bg-[#051626]">
                        <Save className="w-3 h-3 mr-1" />
                        {savingEdit ? "Salvataggio…" : "Salva modifiche"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                      <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{tpl.name}</span>

                      {overwriteId === tpl.id ? (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-[10px] text-amber-700">Sovrascrivere con il testo attuale?</span>
                          <button onClick={() => handleOverwrite(tpl.id)}
                            className="text-[10px] font-semibold text-white bg-amber-500 hover:bg-amber-600 px-2 py-0.5 rounded">
                            Sì
                          </button>
                          <button onClick={() => setOverwriteId(null)}
                            className="text-[10px] text-gray-500 hover:text-gray-700">No</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 ml-auto">
                          <button onClick={() => setOverwriteId(tpl.id)} title="Aggiorna con testo attuale"
                            className="text-[10px] text-gray-400 hover:text-amber-600 px-1.5 py-0.5 rounded hover:bg-amber-50 transition-colors">
                            ↑ aggiorna
                          </button>
                          <button onClick={() => startEdit(tpl)} title="Modifica template"
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(tpl.id, tpl.name)} title="Elimina template"
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="px-3 py-2 flex items-start gap-3">
                      <p className="text-[11px] text-gray-500 flex-1 leading-relaxed whitespace-pre-wrap line-clamp-3 font-mono">
                        {tpl.content}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => { handleLoad(tpl.content); handleClose(); }}
                        className="flex-shrink-0 h-7 text-xs bg-[#0A2540] text-white hover:bg-[#051626]"
                      >
                        <Check className="w-3 h-3 mr-1" /> Carica
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex-shrink-0 border-t border-gray-100 px-5 py-3">
            {showNewForm ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNewForm(false); }}
                  placeholder="Nome del nuovo template…"
                  className="flex-1 h-8 text-xs px-3 border border-gray-200 rounded-md focus:outline-none focus:border-blue-300"
                />
                <Button size="sm" onClick={handleCreate} disabled={savingNew}
                  className="h-8 text-xs bg-[#0A2540] text-white hover:bg-[#051626]">
                  <Save className="w-3 h-3 mr-1" />
                  {savingNew ? "Salvataggio…" : "Salva"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowNewForm(false); setNewName(""); }}
                  className="h-8 text-xs">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-gray-400">
                  {currentText?.trim()
                    ? "Salva il testo corrente come nuovo template personale"
                    : "Scrivi del testo nel campo per poterlo salvare come template"}
                </p>
                <Button size="sm" variant="outline" onClick={() => setShowNewForm(true)}
                  disabled={!currentText?.trim()}
                  className="h-7 text-xs border-gray-300 text-gray-700 hover:border-[#0A2540]">
                  <Plus className="w-3 h-3 mr-1" /> Salva testo attuale come template
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
