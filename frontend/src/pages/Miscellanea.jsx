import React, { useState, useMemo } from "react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Dna, Flame, ListTree, ChevronRight, Eye, ChevronDown, ChevronUp, Search, X, ExternalLink, Info } from "lucide-react";
import {
  MYOSITIS_ANTIBODIES,
  AUTOINFLAMMATORY_DISEASES,
  ANA_PATTERNS,
  ICAP_ANA_PATTERNS,
  DIAGNOSTIC_ALGORITHMS,
} from "../lib/miscellanea";

export default function Miscellanea() {
  const [section, setSection] = useState("myositis");
  const [openAlgo, setOpenAlgo] = useState(null);

  // ANA / ICAP filters
  const [anaExpanded, setAnaExpanded] = useState(null);
  const [anaCodeSearch, setAnaCodeSearch] = useState("");
  const [anaDiseaseSearch, setAnaDiseaseSearch] = useState("");
  const [anaCategory, setAnaCategory] = useState("all");
  const [anaAbSearch, setAnaAbSearch] = useState("");

  const filteredAna = useMemo(() => {
    const code = anaCodeSearch.trim().toLowerCase();
    const dis = anaDiseaseSearch.trim().toLowerCase();
    const ab = anaAbSearch.trim().toLowerCase();
    return ICAP_ANA_PATTERNS.filter((p) => {
      if (code && !p.code.toLowerCase().includes(code) && !p.name.toLowerCase().includes(code)) return false;
      if (dis && !p.diseases.join(" ").toLowerCase().includes(dis)) return false;
      if (anaCategory !== "all" && p.category !== anaCategory) return false;
      if (ab && !p.antigens.join(" ").toLowerCase().includes(ab)) return false;
      return true;
    });
  }, [anaCodeSearch, anaDiseaseSearch, anaCategory, anaAbSearch]);

  const tabs = [
    { id: "myositis", label: "Anticorpi miosite-specifici", icon: Dna },
    { id: "autoinflammatory", label: "Malattie autoinfiammatorie", icon: Flame },
    { id: "ana", label: "Pattern ANA", icon: Eye },
    { id: "algorithms", label: "Iter diagnostici", icon: ListTree },
  ];

  return (
    <div className="space-y-6 fade-in" data-testid="miscellanea-page">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">Reference</div>
        <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tighter text-[#0A2540]">
          Miscellanea
        </h1>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Tabelle sinottiche e algoritmi diagnostici per problemi clinici comuni in reumatologia.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
                section === t.id
                  ? "border-[#0A2540] text-[#0A2540] bg-gray-50"
                  : "border-transparent text-gray-600 hover:text-[#0A2540] hover:bg-gray-50"
              }`}
              data-testid={`misc-tab-${t.id}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Myositis antibodies */}
      {section === "myositis" && (
        <Card className="border-gray-200 shadow-sm overflow-hidden" data-testid="myositis-table">
          <div className="p-5 border-b border-gray-200">
            <h2 className="font-heading font-bold text-lg tracking-tight flex items-center gap-2 text-[#0A2540]">
              <Dna className="w-5 h-5" /> Anticorpi miosite-specifici e coinvolgimento d'organo
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              ✓ = coinvolgimento frequente · ✓✓ = coinvolgimento tipico · ✓✓✓ = dominante · ± = variabile · ✗ = raro/assente
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#F9FAFB] border-b border-gray-200">
                <tr className="text-left">
                  <Th>Anticorpo</Th>
                  <Th>Fenotipo</Th>
                  <Th>Muscolo</Th>
                  <Th>Cute</Th>
                  <Th>Polmone (ILD)</Th>
                  <Th>Cuore</Th>
                  <Th>GI</Th>
                  <Th>Tumore</Th>
                  <Th>Altri segni</Th>
                </tr>
              </thead>
              <tbody>
                {MYOSITIS_ANTIBODIES.map((r) => (
                  <tr key={r.antibody} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-3 font-bold text-[#0A2540] whitespace-nowrap">{r.antibody}</td>
                    <td className="px-3 py-3 text-gray-700">{r.phenotype}</td>
                    <Cell>{r.muscle}</Cell>
                    <Cell>{r.skin}</Cell>
                    <Cell>{r.lung}</Cell>
                    <Cell>{r.heart}</Cell>
                    <Cell>{r.gi}</Cell>
                    <Cell emphasized={r.tumor.includes("✓")}>{r.tumor}</Cell>
                    <td className="px-3 py-3 text-gray-700 text-[11px]">{r.other}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Autoinflammatory */}
      {section === "autoinflammatory" && (
        <Card className="border-gray-200 shadow-sm overflow-hidden" data-testid="autoinflammatory-table">
          <div className="p-5 border-b border-gray-200">
            <h2 className="font-heading font-bold text-lg tracking-tight flex items-center gap-2 text-[#0A2540]">
              <Flame className="w-5 h-5" /> Malattie autoinfiammatorie - tabella clinica
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#F9FAFB] border-b border-gray-200">
                <tr className="text-left">
                  <Th>Malattia</Th>
                  <Th>Esordio</Th>
                  <Th>Febbre</Th>
                  <Th>Pattern</Th>
                  <Th>Segni chiave</Th>
                  <Th>Cute</Th>
                  <Th>Organi</Th>
                  <Th>Red flag</Th>
                  <Th>Genetica / test</Th>
                </tr>
              </thead>
              <tbody>
                {AUTOINFLAMMATORY_DISEASES.map((r) => (
                  <tr key={r.disease} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                    <td className="px-3 py-3 font-bold text-[#0A2540] whitespace-nowrap">{r.disease}</td>
                    <td className="px-3 py-3 text-gray-700">{r.onset}</td>
                    <Cell>{r.fever}</Cell>
                    <td className="px-3 py-3 text-gray-700">{r.pattern}</td>
                    <td className="px-3 py-3 text-gray-700">{r.signs}</td>
                    <td className="px-3 py-3 text-gray-700">{r.skin}</td>
                    <td className="px-3 py-3 text-gray-700">{r.organs}</td>
                    <td className="px-3 py-3 text-gray-700 italic">{r.redflag}</td>
                    <td className="px-3 py-3 text-[#0A2540] font-mono font-bold">{r.genetics}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ANA — ICAP classification */}
      {section === "ana" && (
        <div className="space-y-4" data-testid="ana-icap-section">
          {/* Header + intro */}
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="font-heading font-bold text-xl tracking-tight flex items-center gap-2 text-[#0A2540]">
                    <Eye className="w-5 h-5 flex-shrink-0" /> Pattern ANA secondo ICAP
                  </h2>
                  <p className="mt-2 text-xs text-gray-600 max-w-3xl leading-relaxed">
                    Il test ANA per immunofluorescenza indiretta (IFI) su cellule HEp-2 è lo screening
                    standard per le malattie autoimmuni sistemiche. I pattern osservati sono uno strumento
                    di orientamento diagnostico: il loro significato clinico dipende dal titolo ANA, dal
                    contesto clinico e dalla conferma con test antigene-specifici (ENA, anti-dsDNA, AMA ecc.).
                    La classificazione ICAP fornisce un sistema nomenclaturale standardizzato per la
                    comunicazione tra laboratori e clinici.
                  </p>
                </div>
                <a
                  href="https://www.anapatterns.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-[#0A2540] hover:underline font-medium whitespace-nowrap flex-shrink-0 mt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  ANApatterns.org (ICAP)
                </a>
              </div>
            </div>

            {/* Filters */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Code / name search */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold block mb-1">
                  Codice AC o nome
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={anaCodeSearch}
                    onChange={(e) => setAnaCodeSearch(e.target.value)}
                    placeholder="es. AC-3, centromerico…"
                    className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0A2540] bg-white"
                  />
                  {anaCodeSearch && (
                    <button onClick={() => setAnaCodeSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Disease search */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold block mb-1">
                  Patologia sospetta
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={anaDiseaseSearch}
                    onChange={(e) => setAnaDiseaseSearch(e.target.value)}
                    placeholder="es. LES, SSc, Sjögren, PBC…"
                    className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0A2540] bg-white"
                  />
                  {anaDiseaseSearch && (
                    <button onClick={() => setAnaDiseaseSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category filter */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold block mb-1">
                  Categoria
                </label>
                <div className="flex gap-1 flex-wrap">
                  {[
                    { val: "all", label: "Tutti" },
                    { val: "nuclear", label: "Nucleare" },
                    { val: "cytoplasmic", label: "Citoplasmatico" },
                    { val: "mitotic", label: "Mitotico" },
                  ].map(({ val, label }) => (
                    <button
                      key={val}
                      onClick={() => setAnaCategory(val)}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                        anaCategory === val
                          ? "bg-[#0A2540] text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:border-[#0A2540] hover:text-[#0A2540]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Autoantibody search */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold block mb-1">
                  Autoanticorpo
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={anaAbSearch}
                    onChange={(e) => setAnaAbSearch(e.target.value)}
                    placeholder="es. anti-dsDNA, Jo-1, AMA…"
                    className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0A2540] bg-white"
                  />
                  {anaAbSearch && (
                    <button onClick={() => setAnaAbSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Result count */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">
                {filteredAna.length} pattern su {ICAP_ANA_PATTERNS.length}
              </span>
              {(anaCodeSearch || anaDiseaseSearch || anaAbSearch || anaCategory !== "all") && (
                <button
                  onClick={() => { setAnaCodeSearch(""); setAnaDiseaseSearch(""); setAnaAbSearch(""); setAnaCategory("all"); }}
                  className="text-[11px] text-[#0A2540] hover:underline flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Azzera filtri
                </button>
              )}
            </div>
          </Card>

          {/* Table */}
          <Card className="border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#F9FAFB] border-b border-gray-200">
                  <tr className="text-left">
                    <Th>Codice ICAP</Th>
                    <Th>Pattern</Th>
                    <Th>Categoria</Th>
                    <Th>Antigeni / Autoanticorpi</Th>
                    <Th>Rilevanza clinica</Th>
                    <Th>Test di conferma</Th>
                    <Th>Note pratiche</Th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filteredAna.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-xs text-gray-400">
                        Nessun pattern corrisponde ai filtri selezionati.
                      </td>
                    </tr>
                  )}
                  {filteredAna.map((p) => {
                    const isOpen = anaExpanded === p.code;
                    const catStyle =
                      p.category === "nuclear"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : p.category === "cytoplasmic"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-purple-50 text-purple-700 border-purple-200";
                    const catLabel =
                      p.category === "nuclear"
                        ? "Nucleare"
                        : p.category === "cytoplasmic"
                        ? "Citoplasmatico"
                        : "Mitotico";
                    return (
                      <>
                        <tr
                          key={p.code}
                          className={`border-b border-gray-100 hover:bg-gray-50 align-top cursor-pointer transition-colors ${isOpen ? "bg-blue-50/30" : ""}`}
                          onClick={() => setAnaExpanded(isOpen ? null : p.code)}
                        >
                          <td className="px-3 py-3 font-mono font-bold text-[#0A2540] whitespace-nowrap">
                            {p.code}
                          </td>
                          <td className="px-3 py-3 font-semibold text-[#0A2540] whitespace-nowrap">
                            {p.name}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${catStyle}`}>
                              {catLabel}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-700 max-w-[180px]">
                            {p.antigens.join(", ")}
                          </td>
                          <td className="px-3 py-3 text-gray-700 max-w-[160px]">
                            {p.diseases.join(", ")}
                          </td>
                          <td className="px-3 py-3 text-gray-600 max-w-[180px]">
                            {p.confirmatory}
                          </td>
                          <td className="px-3 py-3 text-gray-500 italic max-w-[160px]">
                            {p.notes}
                          </td>
                          <td className="px-3 py-3 text-gray-400">
                            {isOpen
                              ? <ChevronUp className="w-4 h-4" />
                              : <ChevronDown className="w-4 h-4" />}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${p.code}-detail`} className="bg-blue-50/20 border-b border-gray-200">
                            <td colSpan={8} className="px-4 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                <div>
                                  <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-1.5 flex items-center gap-1">
                                    <Eye className="w-3 h-3" /> Descrizione del pattern
                                  </div>
                                  <p className="text-gray-700 leading-relaxed">{p.description}</p>
                                  <div className="mt-2.5">
                                    <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-1">
                                      Principali autoanticorpi
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {p.antigens.map((a) => (
                                        <span key={a} className="inline-block bg-[#0A2540]/8 text-[#0A2540] border border-[#0A2540]/20 rounded px-1.5 py-0.5 text-[10px] font-medium">
                                          {a}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-1.5">
                                    Malattie associate
                                  </div>
                                  <ul className="space-y-1">
                                    {p.diseases.map((d) => (
                                      <li key={d} className="flex gap-1.5 text-gray-700">
                                        <span className="text-[#0A2540] font-bold mt-0.5">›</span>
                                        <span>{d}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-1.5">
                                    Iter clinico consigliato
                                  </div>
                                  <p className="text-gray-700 leading-relaxed">{p.workup}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-900">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Nota clinica:</strong> I pattern ANA guidano l'interpretazione clinica ma non sono di per
              sé diagnostici. La rilevanza clinica dipende dal titolo ANA, dal contesto clinico e dalla conferma
              con test antigene-specifici. Un ANA positivo a basso titolo (&lt; 1:80) è frequente nella popolazione
              generale e non implica necessariamente una malattia autoimmune. La classificazione ICAP è uno strumento
              nomenclaturale standardizzato: il giudizio clinico rimane indispensabile.
            </span>
          </div>

          {/* Reference */}
          <div className="text-[11px] text-gray-400 flex items-center gap-1.5 pl-1">
            <ExternalLink className="w-3 h-3" />
            Fonte:{" "}
            <a
              href="https://www.anapatterns.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              ICAP – International Consensus on ANA Patterns · ANApatterns.org
            </a>
          </div>
        </div>
      )}

      {/* Algorithms */}
      {section === "algorithms" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DIAGNOSTIC_ALGORITHMS.map((a) => (
            <button
              key={a.id}
              onClick={() => setOpenAlgo(a)}
              className="text-left border border-gray-200 hover:border-[#0A2540] hover:shadow-md rounded-md p-5 transition-all bg-white group"
              data-testid={`misc-algo-${a.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                    {a.category}
                  </div>
                  <h3 className="font-heading font-bold text-lg tracking-tight mt-1 text-[#0A2540]">
                    {a.name}
                  </h3>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#0A2540]" />
              </div>
              <p className="mt-2 text-xs text-gray-600 line-clamp-3">{a.intro}</p>
              <Badge variant="outline" className="mt-3 text-[10px]">{a.steps.length} step</Badge>
            </button>
          ))}
        </div>
      )}

      {/* Algorithm Dialog */}
      <Dialog open={!!openAlgo} onOpenChange={(v) => !v && setOpenAlgo(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">{openAlgo?.name}</DialogTitle>
          </DialogHeader>
          {openAlgo && (
            <div className="space-y-5">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">{openAlgo.category}</div>
                <h2 className="font-heading text-3xl font-black tracking-tighter text-[#0A2540] mt-1">
                  {openAlgo.name}
                </h2>
                <p className="mt-2 text-sm text-gray-700">{openAlgo.intro}</p>
              </div>
              <div className="space-y-3">
                {openAlgo.steps.map((s, i) => (
                  <Card key={s.title} className="border-gray-200 shadow-sm p-4">
                    <h3 className="font-heading font-bold text-sm uppercase tracking-[0.15em] text-[#0A2540] mb-2 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-sm bg-[#0A2540] text-white inline-flex items-center justify-center text-[11px] font-mono">
                        {i + 1}
                      </span>
                      {s.title}
                    </h3>
                    <ul className="space-y-1.5 ml-1">
                      {s.items.map((it) => (
                        <li key={it} className="text-sm text-gray-700 leading-relaxed flex gap-2">
                          <span className="text-[#0A2540] font-bold mt-0.5">›</span>
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Th = ({ children }) => (
  <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500 whitespace-nowrap">{children}</th>
);

const Cell = ({ children, emphasized }) => {
  const txt = String(children || "");
  const isCheck = txt.includes("✓");
  const isX = txt === "✗" || txt.startsWith("✗");
  const classes = emphasized
    ? "text-red-700 font-bold"
    : isCheck
    ? "text-green-700 font-bold"
    : isX
    ? "text-gray-400"
    : "text-gray-700";
  return <td className={`px-3 py-3 ${classes}`}>{children}</td>;
};
