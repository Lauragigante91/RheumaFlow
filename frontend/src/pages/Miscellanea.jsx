import React, { useState } from "react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Dna, Flame, ListTree, ChevronRight, Eye } from "lucide-react";
import {
  MYOSITIS_ANTIBODIES,
  AUTOINFLAMMATORY_DISEASES,
  ANA_PATTERNS,
  DIAGNOSTIC_ALGORITHMS,
} from "../lib/miscellanea";

export default function Miscellanea() {
  const [section, setSection] = useState("myositis");
  const [openAlgo, setOpenAlgo] = useState(null);

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

      {/* ANA */}
      {section === "ana" && (
        <Card className="border-gray-200 shadow-sm overflow-hidden" data-testid="ana-table">
          <div className="p-5 border-b border-gray-200">
            <h2 className="font-heading font-bold text-lg tracking-tight flex items-center gap-2 text-[#0A2540]">
              <Eye className="w-5 h-5" /> Pattern ANA e associazioni cliniche
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Pattern di immunofluorescenza indiretta su HEp-2 e anticorpi associati.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] border-b border-gray-200">
                <tr className="text-left">
                  <Th>Pattern</Th>
                  <Th>Anticorpi associati</Th>
                  <Th>Malattie principali</Th>
                </tr>
              </thead>
              <tbody>
                {ANA_PATTERNS.map((r) => (
                  <tr key={r.pattern} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 font-bold text-[#0A2540]">{r.pattern}</td>
                    <td className="px-4 py-3 text-gray-700">{r.antibodies}</td>
                    <td className="px-4 py-3 text-gray-700">{r.diseases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
