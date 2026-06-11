import { useState } from "react";
import { Link2, Clock, Eye, Copy, Check, Share2, Lock, Trash2 } from "lucide-react";

export function SharePanel() {
  const [copied, setCopied] = useState(false);
  const [expiry, setExpiry] = useState("7d");
  const [generated, setGenerated] = useState(false);
  const [sections, setSections] = useState({
    diagnosi: true,
    terapia: true,
    esami: true,
    indici: true,
    imaging: false,
  });

  const fakeLink = "https://rheumaflow.app/c/xK9mP2vT";

  const handleGenerate = () => setGenerated(true);
  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSection = (key: string) => {
    setSections(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const sectionLabels: Record<string, string> = {
    diagnosi: "Diagnosi e storia clinica",
    terapia: "Terapia corrente",
    esami: "Ultimi esami di laboratorio",
    indici: "Indici di malattia",
    imaging: "Imaging",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-white/20 rounded-lg p-1.5">
              <Share2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Consulto esterno</span>
          </div>
          <h2 className="text-lg font-bold">Genera link di consultazione</h2>
          <p className="text-indigo-200 text-xs mt-1">
            Il collega vedrà solo i dati che scegli, senza accesso al sistema.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Sezioni visibili */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Sezioni visibili al consulente
            </p>
            <div className="space-y-2">
              {Object.entries(sectionLabels).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => toggleSection(key)}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    sections[key as keyof typeof sections]
                      ? "bg-indigo-600 border-indigo-600"
                      : "border-gray-300 bg-white"
                  }`}>
                    {sections[key as keyof typeof sections] && (
                      <Check className="w-2.5 h-2.5 text-white" />
                    )}
                  </div>
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 select-none">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Scadenza */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Scadenza link
            </p>
            <div className="flex gap-2">
              {[
                { val: "24h", label: "24 ore" },
                { val: "7d", label: "7 giorni" },
                { val: "30d", label: "30 giorni" },
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setExpiry(opt.val)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    expiry === opt.val
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <Clock className="w-3 h-3 mx-auto mb-0.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy note */}
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <Lock className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Il link non richiede login. I dati del paziente sono pseudonimizzati — nessun dato identificativo viene condiviso.
            </p>
          </div>

          {/* Genera / Link generato */}
          {!generated ? (
            <button
              onClick={handleGenerate}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Link2 className="w-4 h-4" />
              Genera link consulto
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Link generato
              </p>
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5">
                <span className="text-xs text-indigo-700 font-mono flex-1 truncate">
                  {fakeLink}
                </span>
                <button
                  onClick={handleCopy}
                  className="shrink-0 text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-1.5 text-xs text-gray-500">
                  <Eye className="w-3.5 h-3.5" />
                  Scade tra 7 giorni · 0 visualizzazioni
                </div>
                <button className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
                  <Trash2 className="w-3 h-3" />
                  Revoca
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
