import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { FileText, FileDown, Clipboard, Check, Loader2 } from "lucide-react";
import {
  exportFullHistoryPDF,
  exportFullHistoryTXTDownload,
  copyFullHistoryToClipboard,
} from "../../lib/export";
import { toast } from "sonner";

export default function HistoryExportDialog({ open, onOpenChange, patient, firstVisit, workupVisits, assessments, instrumentalExams }) {
  const [copied,      setCopied]      = useState(false);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [txtLoading,  setTxtLoading]  = useState(false);

  const data = {
    firstVisit,
    workupVisits:      workupVisits      || [],
    assessments:       assessments       || [],
    instrumentalExams: instrumentalExams || [],
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    try {
      exportFullHistoryPDF(patient, data);
    } catch (e) {
      toast.error("Errore nella generazione del PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleTXT = () => {
    setTxtLoading(true);
    try {
      exportFullHistoryTXTDownload(patient, data);
    } catch (e) {
      toast.error("Errore nell'esportazione testo");
    } finally {
      setTxtLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await copyFullHistoryToClipboard(patient, data);
      setCopied(true);
      toast.success("Storico copiato negli appunti");
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      toast.error("Impossibile accedere agli appunti");
    }
  };

  const visitCount =
    (firstVisit ? 1 : 0) +
    (workupVisits?.length      || 0) +
    (assessments?.length       || 0) +
    (instrumentalExams?.length || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-[#0A2540]">
            Esporta storico completo
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-500 -mt-1 mb-4">
          {visitCount > 0
            ? `${visitCount} record trovati — prima visita, workup diagnostici, follow-up ed esami strumentali in ordine cronologico.`
            : "Nessun dato disponibile per questo paziente."}
        </p>

        <div className="space-y-2.5">
          <button
            onClick={handlePDF}
            disabled={pdfLoading || visitCount === 0}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-[#0A2540] hover:border-[#0A2540] hover:text-white group transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            {pdfLoading
              ? <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
              : <FileText className="w-5 h-5 flex-shrink-0 text-[#0A2540] group-hover:text-white transition-colors" />}
            <div>
              <div className="text-sm font-semibold text-gray-800 group-hover:text-white transition-colors">
                Scarica PDF
              </div>
              <div className="text-[11px] text-gray-400 group-hover:text-blue-100 transition-colors">
                Documento formattato con tutte le visite ed esami strumentali
              </div>
            </div>
          </button>

          <button
            onClick={handleTXT}
            disabled={txtLoading || visitCount === 0}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 group transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            {txtLoading
              ? <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
              : <FileDown className="w-5 h-5 flex-shrink-0 text-gray-500" />}
            <div>
              <div className="text-sm font-semibold text-gray-700">
                Scarica testo (.txt)
              </div>
              <div className="text-[11px] text-gray-400">
                Testo semplice, compatibile con qualsiasi editor
              </div>
            </div>
          </button>

          <button
            onClick={handleCopy}
            disabled={visitCount === 0}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 group transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            {copied
              ? <Check className="w-5 h-5 flex-shrink-0 text-green-500" />
              : <Clipboard className="w-5 h-5 flex-shrink-0 text-gray-500" />}
            <div>
              <div className="text-sm font-semibold text-gray-700">
                {copied ? "Copiato!" : "Copia negli appunti"}
              </div>
              <div className="text-[11px] text-gray-400">
                Incolla direttamente nella cartella clinica
              </div>
            </div>
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs text-gray-500">
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
