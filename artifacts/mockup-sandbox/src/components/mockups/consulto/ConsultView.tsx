import { Shield, Clock, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const Section = ({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-baseline py-1.5 border-b border-gray-100 last:border-0">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-sm text-gray-800 font-medium text-right max-w-[60%]">{value}</span>
  </div>
);

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>{label}</span>
);

export function ConsultView() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top banner */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">R</span>
          </div>
          <span className="font-semibold text-gray-800 text-sm">RheumaFlow</span>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-500">Vista consulto</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
          <Clock className="w-3 h-3" />
          Scade tra 6 giorni
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Intestazione paziente */}
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-700 font-bold text-sm">P42</span>
                </div>
                <div>
                  <p className="font-bold text-gray-800">Paziente #RF-2024-0042</p>
                  <p className="text-xs text-gray-500">Nato nel 1971 · M</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
              <Shield className="w-3 h-3" />
              Pseudonimizzato
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge label="SpA assiale (nr-axSpA)" color="bg-indigo-100 text-indigo-700" />
            <Badge label="HLA-B27+" color="bg-purple-100 text-purple-700" />
            <Badge label="Esordio 2019" color="bg-gray-100 text-gray-600" />
          </div>
          <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              Condiviso da <strong>UO Reumatologia</strong> per consulto. Visione in sola lettura.
            </p>
          </div>
        </div>

        {/* Indici di malattia */}
        <Section title="Indici di malattia — ultima visita (10/05/2026)">
          <div className="space-y-0">
            <Row label="ASDAS-CRP" value="2.4 — Attività alta" />
            <Row label="BASDAI" value="5.2 / 10" />
            <Row label="BASFI" value="3.8 / 10" />
            <Row label="PCR" value="12 mg/L" />
            <Row label="Lombalgia NRS" value="6 / 10" />
            <Row label="PGA paziente" value="5 / 10" />
          </div>
        </Section>

        {/* Terapia corrente */}
        <Section title="Terapia corrente">
          <div className="space-y-2.5">
            {[
              { drug: "Secukinumab 150 mg", detail: "s.c. ogni 4 settimane", since: "Da mar 2023", status: "Attiva" },
              { drug: "Naproxene 550 mg", detail: "al bisogno", since: "Da gen 2022", status: "Attiva" },
            ].map((t, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t.drug}</p>
                  <p className="text-xs text-gray-500">{t.detail} · {t.since}</p>
                </div>
                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{t.status}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Ultimi esami */}
        <Section title="Ultimi esami di laboratorio (28/04/2026)" defaultOpen={false}>
          <div className="space-y-0">
            <Row label="PCR" value="12 mg/L  ↑" />
            <Row label="VES" value="28 mm/h  ↑" />
            <Row label="Emocromo" value="nella norma" />
            <Row label="Creatinina" value="0.9 mg/dL" />
            <Row label="ALT / AST" value="22 / 18 U/L" />
          </div>
        </Section>

        {/* Diagnosi e storia */}
        <Section title="Diagnosi e storia clinica" defaultOpen={false}>
          <div className="space-y-0">
            <Row label="Diagnosi principale" value="SpA assiale non-radiografica (nr-axSpA)" />
            <Row label="Anno esordio" value="2019" />
            <Row label="Criteri ASAS assiali" value="Soddisfatti — HLA-B27+ con ≥2 features SpA" />
            <Row label="Coinvolgimento assiale" value="Sì" />
            <Row label="Coinvolgimento periferico" value="No" />
            <Row label="Manifestazioni extra-art." value="Uveite anteriore (2022)" />
          </div>
        </Section>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Dati in sola lettura · Generati il 17/05/2026 · Nessun dato identificativo condiviso
        </p>
      </div>
    </div>
  );
}
