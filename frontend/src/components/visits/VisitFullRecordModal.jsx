import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { X, Printer, Copy, ChevronDown, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";

function fmtDate(iso) {
  if (!iso) return "—";
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function fmtDateLong(iso) {
  if (!iso) return "";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("it-IT", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

const SECTION_DEFS = [
  { key: "anamnesi_fisiologica",  num: "1",  label: "ANAMNESI FISIOLOGICA",                          titleCls: "text-gray-500",  headerBg: "bg-gray-50",  borderCls: "border-gray-200" },
  { key: "anamnesi_familiare",    num: "2",  label: "ANAMNESI FAMILIARE",                             titleCls: "text-gray-500",  headerBg: "bg-gray-50",  borderCls: "border-gray-200" },
  { key: "comorbidita",           num: "3",  label: "ANAMNESI PATOLOGICA REMOTA · COMORBIDITÀ",       titleCls: "text-gray-500",  headerBg: "bg-gray-50",  borderCls: "border-gray-200" },
  { key: "allergie",              num: "4",  label: "ALLERGIE",                                       titleCls: "text-gray-500",  headerBg: "bg-gray-50",  borderCls: "border-gray-200" },
  { key: "terapie_in_corso",      num: "5",  label: "TERAPIE IN CORSO ALLA DATA DELLA VISITA",        titleCls: "text-gray-500",  headerBg: "bg-gray-50",  borderCls: "border-gray-200" },
  { key: "terapie_pregresse",     num: "6",  label: "TERAPIE PREGRESSE",                              titleCls: "text-gray-500",  headerBg: "bg-gray-50",  borderCls: "border-gray-200" },
  { key: "raccordo",              num: "7",  label: "RACCORDO ANAMNESTICO REUMATOLOGICO",             titleCls: "text-amber-700", headerBg: "bg-amber-50", borderCls: "border-amber-200" },
  { key: "anamnesi_intervallare", num: "8",  label: "ANAMNESI INTERVALLARE",                         titleCls: "text-amber-700", headerBg: "bg-amber-50", borderCls: "border-amber-200" },
  { key: "esame_obiettivo",       num: "9",  label: "ESAME OBIETTIVO",                               titleCls: "text-amber-700", headerBg: "bg-amber-50", borderCls: "border-amber-200" },
  { key: "clinimetria",           num: "10", label: "CLINIMETRIE · SCORE",                           titleCls: "text-amber-700", headerBg: "bg-amber-50", borderCls: "border-amber-200" },
  { key: "esami",                 num: "11", label: "ESAMI DI LABORATORIO · IMAGING · STRUMENTALI",  titleCls: "text-amber-700", headerBg: "bg-amber-50", borderCls: "border-amber-200" },
  { key: "conclusioni",           num: "12", label: "CONCLUSIONI",                                   titleCls: "text-blue-700",  headerBg: "bg-blue-50",  borderCls: "border-blue-200" },
  { key: "terapia_uscita",        num: "13", label: "TERAPIA IN USCITA",                             titleCls: "text-blue-700",  headerBg: "bg-blue-50",  borderCls: "border-blue-200" },
  { key: "modifiche_terapeutiche", num: "14", label: "MODIFICHE TERAPEUTICHE",                       titleCls: "text-blue-700",  headerBg: "bg-blue-50",  borderCls: "border-blue-200" },
  { key: "indicazioni",           num: "15", label: "INDICAZIONI",                                   titleCls: "text-blue-700",  headerBg: "bg-blue-50",  borderCls: "border-blue-200" },
];

const PRINT_COLORS = {
  "text-gray-500":  "#6b7280",
  "text-amber-700": "#b45309",
  "text-blue-700":  "#1d4ed8",
};

function RecordSection({ def, content }) {
  const hasContent = Boolean(content?.trim());
  const [open, setOpen] = useState(hasContent);

  return (
    <div className={`rounded-lg border overflow-hidden ${def.borderCls}`}>
      <button
        type="button"
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
          open ? def.headerBg : "bg-white"
        } hover:${def.headerBg}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`text-[9.5px] font-bold uppercase tracking-[0.14em] flex-1 leading-none ${def.titleCls}`}>
          {def.num} · {def.label}
        </span>
        {!hasContent && (
          <span className="text-[10px] text-gray-300 italic mr-1 font-normal normal-case tracking-normal">
            non riportato
          </span>
        )}
        {open
          ? <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 opacity-60 ${hasContent ? def.titleCls : "text-gray-300"}`} />
          : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" />
        }
      </button>
      {open && (
        <div className={`px-4 py-3 border-t ${def.borderCls}`}>
          {hasContent
            ? <p className="whitespace-pre-wrap text-sm font-serif text-gray-800 leading-relaxed">{content.trim()}</p>
            : <p className="text-xs italic text-gray-400">Non riportato in questa visita.</p>
          }
        </div>
      )}
    </div>
  );
}

export default function VisitFullRecordModal({ onClose, record = {}, patient, extraFooterActions }) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const pLabel    = [patient?.cognome, patient?.nome].filter(Boolean).join(" ") || "Paziente";
  const dateShort = fmtDate(record.date);
  const dateLong  = fmtDateLong(record.date);
  const diagLabel = patient?.diagnosi || "";

  const handleCopy = () => {
    const lines = [
      `${pLabel} — ${record.visitTypeLabel || "Visita"} del ${dateShort}`,
      diagLabel ? `Diagnosi: ${diagLabel}` : null,
      record.medicoName ? `Medico: ${record.medicoName}` : null,
      "",
    ].filter((v) => v !== null);
    for (const s of SECTION_DEFS) {
      const c = record[s.key]?.trim();
      if (c) {
        lines.push(`${s.num} · ${s.label}`);
        lines.push(c);
        lines.push("");
      }
    }
    navigator.clipboard.writeText(lines.join("\n"))
      .then(() => toast.success("Testo copiato negli appunti"))
      .catch(() => toast.error("Copia non riuscita"));
  };

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup bloccato — abilita i popup per stampare"); return; }
    const esc = (s) =>
      (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    const sects = SECTION_DEFS
      .filter((s) => record[s.key]?.trim())
      .map((s) => `<div class="s">
  <div class="t" style="color:${PRINT_COLORS[s.titleCls] || "#555"}">${s.num} · ${esc(s.label)}</div>
  <div class="b">${esc(record[s.key])}</div>
</div>`).join("");
    w.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
<title>Referto — ${esc(pLabel)} — ${dateShort}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,"Times New Roman",serif;max-width:740px;margin:40px auto;padding:0 28px;color:#111;line-height:1.8;font-size:13px}
.hdr{border-bottom:2px solid #0A2540;padding-bottom:14px;margin-bottom:30px}
.hdr h1{font-size:21px;font-weight:700;color:#0A2540}
.hdr p{font-size:11px;color:#555;margin-top:4px}
.s{margin-bottom:24px}
.t{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;margin-bottom:7px}
.b{white-space:pre-wrap;color:#222}
.foot{margin-top:40px;border-top:1px solid #e5e7eb;padding-top:10px;font-size:10px;color:#9ca3af}
@media print{button{display:none!important}}
</style></head><body>
<div class="hdr">
  <h1>${esc(pLabel)}</h1>
  <p>${esc(record.visitTypeLabel || "Visita")} del ${dateShort}${diagLabel ? " · " + esc(diagLabel) : ""}${record.medicoName ? " · " + esc(record.medicoName) : ""}</p>
</div>
${sects}
<div class="foot">RheumaFlow — ${new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`flex min-h-full ${fullscreen ? "" : "items-start justify-center py-5 px-3"}`}>
        <div
          className={`bg-white flex flex-col shadow-2xl ${
            fullscreen ? "fixed inset-0 rounded-none" : "w-full max-w-4xl rounded-xl"
          }`}
        >
          <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-white rounded-t-xl">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-[#0A2540] text-base leading-tight">{pLabel}</h2>
                {record.visitTypeLabel && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-amber-50 border-amber-200 text-amber-700 whitespace-nowrap">
                    {record.visitTypeLabel}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                {dateLong || dateShort}
                {diagLabel ? ` · ${diagLabel}` : ""}
                {record.medicoName ? ` · Dr. ${record.medicoName}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button type="button" onClick={handleCopy} title="Copia testo"
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                <Copy className="w-4 h-4" />
              </button>
              <button type="button" onClick={handlePrint} title="Stampa / PDF"
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                <Printer className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setFullscreen((f) => !f)}
                title={fullscreen ? "Finestra" : "Schermo intero"}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button type="button" onClick={onClose} title="Chiudi"
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto px-6 py-5 ${fullscreen ? "max-h-[calc(100vh-130px)]" : ""}`}>
            <div className="space-y-1.5 max-w-3xl mx-auto">
              {SECTION_DEFS.map((def) => (
                <RecordSection key={def.key} def={def} content={record[def.key] || null} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 px-6 py-3 border-t border-gray-100 bg-gray-50/60 flex-shrink-0 rounded-b-xl">
            <button type="button" onClick={handlePrint}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[#0A2540] hover:bg-[#051626] px-3.5 py-1.5 rounded-lg transition-colors">
              <Printer className="w-4 h-4" /> Stampa referto
            </button>
            <button type="button" onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 px-3.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <Copy className="w-4 h-4" /> Copia testo
            </button>
            <div className="flex-1" />
            {extraFooterActions}
            <button type="button" onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
