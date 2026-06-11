import React, { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Search, ChevronRight, BookOpen, ExternalLink, Stethoscope } from "lucide-react";
import { GUIDELINES, GUIDELINE_GROUPS } from "../lib/guidelines";

export default function Guidelines() {
  const [search, setSearch] = useState("");
  const [selectedDisease, setSelectedDisease] = useState("all");
  const [open, setOpen] = useState(null);
  const location = useLocation();

  // Read ?q=... from URL on mount and whenever it changes (e.g., navigated from
  // the patient guidelines shortcut).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q) setSearch(q);
  }, [location.search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return GUIDELINES.filter((g) => {
      if (selectedDisease !== "all" && g.disease !== selectedDisease) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        g.disease.toLowerCase().includes(q) ||
        g.source.toLowerCase().includes(q)
      );
    });
  }, [search, selectedDisease]);

  // ILD always first when "all" is selected
  const ordered = useMemo(() => {
    if (selectedDisease !== "all") return filtered;
    const ild = filtered.find((g) => g.id === "ers_acr_eular_2023_ild");
    const rest = filtered.filter((g) => g.id !== "ers_acr_eular_2023_ild");
    return ild ? [ild, ...rest] : rest;
  }, [filtered, selectedDisease]);

  return (
    <div className="space-y-6 fade-in" data-testid="guidelines-page">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 mb-2">Reference</div>
        <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tighter text-[#0A2540]">
          Linee Guida ACR / EULAR / ERS
        </h1>
        <p className="mt-2 text-gray-600 max-w-3xl">
          Sintesi clinica delle principali raccomandazioni per la gestione delle malattie reumatiche, inclusa la
          gestione delle interstiziopatie polmonari (ILD) nelle SARDs (ACR + ERS-EULAR 2023).
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Cerca linee guida o malattia"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="guidelines-search"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedDisease === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedDisease("all")}
          className={selectedDisease === "all" ? "bg-[#0A2540] text-white" : ""}
          data-testid="guidelines-filter-all"
        >
          Tutte
        </Button>
        {GUIDELINE_GROUPS.map((g) => (
          <Button
            key={g}
            variant={selectedDisease === g ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDisease(g)}
            className={selectedDisease === g ? "bg-[#0A2540] text-white" : ""}
            data-testid={`guidelines-filter-${g}`}
          >
            {g}
          </Button>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ordered.map((g) => {
          const isILD = g.id === "ers_acr_eular_2023_ild";
          return (
            <button
              key={g.id}
              onClick={() => setOpen(g)}
              className={`text-left border rounded-md p-5 transition-all bg-white group ${
                isILD
                  ? "border-amber-300 ring-1 ring-amber-200 hover:border-amber-500 hover:shadow-md"
                  : "border-gray-200 hover:border-[#0A2540] hover:shadow-md"
              }`}
              data-testid={`guidelines-card-${g.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 flex items-center gap-1.5">
                    {isILD && <Stethoscope className="w-3 h-3 text-amber-600" />}
                    {g.source} · {g.year}
                  </div>
                  <h3 className="font-heading font-bold text-lg tracking-tight mt-1 text-[#0A2540]">
                    {g.name}
                  </h3>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#0A2540] transition-colors" />
              </div>
              <p className="mt-2 text-xs text-gray-600 line-clamp-3">{g.intro}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-xs">{g.disease}</Badge>
                <span className="text-[10px] text-gray-400">
                  {g.sections.length} sezioni
                </span>
              </div>
              {g.url && (
                <a
                  href={g.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#0A2540] hover:underline"
                  data-testid={`guidelines-card-link-${g.id}`}
                >
                  <ExternalLink className="w-3 h-3" /> Apri documento originale
                </a>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-10 text-center text-gray-500">Nessuna linea guida per questa ricerca.</div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">{open?.name}</DialogTitle>
          </DialogHeader>
          {open && <GuidelineDetail g={open} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GuidelineDetail({ g }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5" /> {g.source} · {g.year}
        </div>
        <h2 className="font-heading text-3xl font-black tracking-tighter text-[#0A2540] mt-1">
          {g.name}
        </h2>
        <Badge variant="outline" className="mt-2">{g.disease}</Badge>
        <p className="mt-3 text-sm text-gray-700 leading-relaxed">{g.intro}</p>
        {(g.url || (g.urls && g.urls.length > 0)) && (
          <div className="mt-4 p-3 bg-[#F9FAFB] border border-gray-200 rounded-md">
            <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold mb-2 flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3" /> Documenti originali
            </div>
            <div className="flex flex-col gap-1.5">
              {g.url && (
                <a
                  href={g.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#0A2540] hover:underline inline-flex items-center gap-1.5 break-all"
                  data-testid={`guideline-detail-link-main-${g.id}`}
                >
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">Sito ufficiale / Articolo</span>
                  <span className="text-xs text-gray-500 font-mono truncate">{g.url}</span>
                </a>
              )}
              {(g.urls || []).map((u, i) => (
                <a
                  key={u.href}
                  href={u.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#0A2540] hover:underline inline-flex items-center gap-1.5 break-all"
                  data-testid={`guideline-detail-link-${g.id}-${i}`}
                >
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">{u.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {g.sections.map((sec, idx) => (
          <Card key={sec.title} className="border-gray-200 shadow-sm p-5" data-testid={`guideline-section-${idx}`}>
            <h3 className="font-heading font-bold text-sm uppercase tracking-[0.15em] text-[#0A2540] mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-sm bg-[#0A2540] text-white inline-flex items-center justify-center text-[11px] font-mono">
                {idx + 1}
              </span>
              {sec.title}
            </h3>
            <ul className="space-y-2 ml-1">
              {sec.items.map((it) => (
                <li key={it} className="text-sm text-gray-700 leading-relaxed flex gap-2">
                  <span className="text-[#0A2540] font-bold mt-0.5">›</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {g.note && (
        <div className="text-xs text-gray-500 italic border-t border-gray-200 pt-3 flex items-start gap-2">
          <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0" />
          {g.note}
        </div>
      )}
    </div>
  );
}
