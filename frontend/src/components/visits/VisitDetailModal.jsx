import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import { X, Printer, Copy } from "lucide-react";
import SelectableTextBlock from "../shared/SelectableTextBlock";
import { toast } from "sonner";

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = (iso || "").split("-");
  return `${d}/${m}/${y}`;
}

function fmtDateLong(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

export default function VisitDetailModal({
  onClose,
  dateIso,
  dateLabelOverride,
  patient,
  sections = [],
  badge = null,
  extraFooterActions = null,
  renderSectionContent = null,
  onInsertToSection = null,
  insertSections = [],
}) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const pLabel    = [patient?.cognome, patient?.nome].filter(Boolean).join(" ") || "Paziente";
  const dateLabel = dateLabelOverride || fmtDate(dateIso);
  const diagLabel = patient?.diagnosi || "";
  const dateLong  = dateIso ? fmtDateLong(dateIso) : (dateLabelOverride || "");

  const handleCopy = () => {
    const txt = [
      `${pLabel} — Visita del ${dateLabel}${diagLabel ? ` · ${diagLabel}` : ""}`,
      "",
      ...sections.map(s => `${s.number ? s.number + " · " : ""}${s.label}\n${s.text}`),
    ].join("\n\n");
    navigator.clipboard.writeText(txt)
      .then(() => toast.success("Testo copiato negli appunti"))
      .catch(() => toast.error("Copia non riuscita"));
  };

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup bloccato — abilita i popup per stampare"); return; }
    const esc = (s = "") => s
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
    w.document.write(`<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8">
<title>Referto – ${pLabel} – ${dateLabel}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #111; line-height: 1.7; font-size: 13px; }
  .header { border-bottom: 2px solid #0A2540; padding-bottom: 14px; margin-bottom: 24px; }
  .header h1 { font-size: 20px; font-weight: 700; color: #0A2540; }
  .header .sub { font-size: 12px; color: #555; margin-top: 3px; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #b45309; margin-bottom: 6px; }
  .section-title.blue { color: #1d4ed8; }
  .section-body { white-space: pre-wrap; color: #222; }
  .footer-note { margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 10px; color: #9ca3af; }
  @media print { button { display: none !important; } }
</style>
</head><body>
<div class="header">
  <h1>${esc(pLabel)}</h1>
  <div class="sub">Visita del ${dateLabel}${diagLabel ? ` · ${esc(diagLabel)}` : ""}</div>
</div>
${sections.map(s => `<div class="section">
  <div class="section-title${s.color === "blue" ? " blue" : ""}">${s.number ? s.number + " · " : ""}${esc(s.label)}</div>
  <div class="section-body">${esc(s.text)}</div>
</div>`).join("")}
<div class="footer-note">Documento generato da RheumaFlow — ${new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-[#0A2540] text-sm leading-snug">{pLabel}</h2>
              {badge}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {dateLong}{diagLabel ? ` · ${diagLabel}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button type="button" onClick={handleCopy} title="Copia testo"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <Copy className="w-4 h-4" />
            </button>
            <button type="button" onClick={handlePrint} title="Stampa / PDF"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <Printer className="w-4 h-4" />
            </button>
            <button type="button" onClick={onClose} title="Chiudi"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {sections.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm font-medium">Nessun dato registrato per questa visita.</p>
              <p className="text-[11px] mt-1 text-gray-300">
                Le visite più vecchie potrebbero non avere tutti i campi strutturati.
              </p>
            </div>
          ) : (
            <div className="space-y-5 font-serif text-sm text-gray-800 leading-relaxed">
              <div className="border-b border-gray-200 pb-3">
                <div className="text-base font-bold text-[#0A2540]">{pLabel}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Visita del {dateLabel}{diagLabel ? ` · ${diagLabel}` : ""}
                </div>
              </div>
              {sections.map((s, i) => (
                <div key={i}>
                  <div className={`text-[10px] font-bold uppercase tracking-[0.14em] mb-1.5 ${
                    s.color === "blue" ? "text-blue-700" : "text-amber-700"
                  }`}>
                    {s.number ? `${s.number} · ` : ""}{s.label}
                  </div>
                  {renderSectionContent
                    ? renderSectionContent(s)
                    : onInsertToSection
                      ? <SelectableTextBlock
                          text={s.text}
                          patient={patient}
                          visitDate={dateIso}
                          onInsertToSection={onInsertToSection}
                          insertSections={insertSections}
                          paragraphClass="whitespace-pre-wrap text-gray-800 leading-relaxed text-sm font-serif"
                        />
                      : <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">{s.text}</p>
                  }
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-xl flex-shrink-0">
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
    </div>,
    document.body
  );
}
