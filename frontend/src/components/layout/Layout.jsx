import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, FileCheck2, BookOpen, LogOut, Copy, Home,
  Database, FileJson, FileArchive, FileSpreadsheet, FlaskConical, ShieldCheck,
  Menu, X, BrainCircuit, ExternalLink, KeyRound,
} from "lucide-react";
import BrandMark, { BrandWordmark } from "./BrandMark";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { exportApi, api } from "../../lib/api";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pazienti", label: "Pazienti", icon: Users },
  { to: "/criteri", label: "Criteri", icon: FileCheck2 },
  { to: "/linee-guida", label: "Linee Guida", icon: BookOpen },
  { to: "/miscellanea", label: "Miscellanea", icon: FlaskConical },
  { to: "/privacy", label: "Privacy / GDPR", icon: ShieldCheck },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cohortOpen, setCohortOpen] = useState(false);
  const [cohortDiag, setCohortDiag] = useState("__ALL__");
  const [cohortAnchor, setCohortAnchor] = useState("__NONE__");
  const [diagnoses, setDiagnoses] = useState([]);
  const [drugs, setDrugs] = useState([]);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [cohortLoading, setCohortLoading] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    closeMobile();
  }, [location.pathname, closeMobile]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeMobile(); };
    if (mobileOpen) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen, closeMobile]);

  const changePassword = async () => {
    if (!pwCurrent || !pwNew || !pwConfirm) {
      toast.error("Compila tutti i campi");
      return;
    }
    if (pwNew.length < 6) {
      toast.error("La nuova password deve essere lunga almeno 6 caratteri");
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error("Le password non coincidono");
      return;
    }
    setPwLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: pwCurrent,
        new_password: pwNew,
      });
      toast.success("Password aggiornata");
      setPwOpen(false);
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore durante il cambio password");
    } finally {
      setPwLoading(false);
    }
  };

  const copyInvite = () => {
    if (user?.invite_code) {
      navigator.clipboard.writeText(user.invite_code);
      toast.success("Codice invito copiato");
    }
  };

  const openCohortDialog = async () => {
    setCohortOpen(true);
    try {
      const [resDiag, resDrugs] = await Promise.all([
        api.get("/export/diagnoses"),
        api.get("/export/drugs"),
      ]);
      setDiagnoses(resDiag.data?.diagnoses || []);
      setDrugs(resDrugs.data?.drugs || []);
    } catch (e) {
      setDiagnoses([]);
      setDrugs([]);
    }
  };

  const downloadCohort = async () => {
    setCohortLoading(true);
    try {
      const diag = cohortDiag && cohortDiag !== "__ALL__" ? cohortDiag : "";
      const anchor = cohortAnchor && cohortAnchor !== "__NONE__" ? cohortAnchor : "";
      const params = [];
      if (diag) params.push(`diagnosis=${encodeURIComponent(diag)}`);
      if (anchor) params.push(`anchor_drug=${encodeURIComponent(anchor)}`);
      const qs = params.length ? `?${params.join("&")}` : "";
      const res = await api.get(`/export/cohort-xlsx${qs}`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const filename =
        res.headers["content-disposition"]?.match(/filename="([^"]+)"/)?.[1] ||
        `coorte_${diag || "tutti"}.xlsx`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      toast.success("Coorte esportata (Excel)");
      setCohortOpen(false);
    } catch (e) {
      toast.error("Errore durante l'export della coorte");
    } finally {
      setCohortLoading(false);
    }
  };

  const downloadExport = async (kind) => {
    try {
      const url = kind === "json" ? exportApi.json() : exportApi.csvZip();
      const res = await api.get(url.replace(/^.*\/api/, ""), { responseType: "blob" });
      const blob = new Blob([res.data]);
      const filename =
        res.headers["content-disposition"]?.match(/filename="([^"]+)"/)?.[1] ||
        (kind === "json" ? "export.json" : "export.zip");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      toast.success(`Database esportato (${kind.toUpperCase()})`);
    } catch (e) {
      toast.error("Errore durante l'export");
    }
  };

  const SidebarContent = ({ onNavigate }) => (
    <>
      <Link
        to="/"
        onClick={onNavigate}
        className="p-6 border-b border-gray-200 block hover:bg-gray-100 transition-colors"
        data-testid="sidebar-home-link"
      >
        <div className="flex items-center gap-2.5">
          <BrandMark className="w-10 h-10 flex-shrink-0" testid="sidebar-brand-mark" />
          <div className="min-w-0">
            <BrandWordmark className="text-lg leading-none" />
            <div className="text-[9px] font-medium tracking-[0.05em] text-gray-500 mt-1 leading-tight">
              The intelligent workspace for rheumatologists
            </div>
          </div>
        </div>
      </Link>

      {user && (
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">UO</div>
          <div className="text-sm font-medium text-[#0A2540] truncate" title={user.organization_name}>
            {user.organization_name || "—"}
          </div>
          {user.invite_code && (
            <button
              onClick={copyInvite}
              className="mt-1 text-xs text-gray-500 hover:text-[#0A2540] flex items-center gap-1"
              data-testid="copy-invite-code"
            >
              <Copy className="w-3 h-3" /> Codice: <span className="font-mono">{user.invite_code}</span>
            </button>
          )}
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-[#0A2540] text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-2 mt-2 border-t border-gray-200">
          <div className="px-3 pb-1.5 text-[9px] uppercase tracking-[0.2em] text-gray-400 font-semibold">
            Strumenti esterni
          </div>
          <a
            href="https://www.medscape.com/ai-search?ecd=medscapeai_landing-page"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-gray-700 hover:bg-gray-100"
          >
            <BrainCircuit className="w-4 h-4 flex-shrink-0 text-indigo-500" />
            <span className="flex-1">Medscape AI</span>
            <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
          </a>
        </div>
      </nav>

      {user && (
        <div className="p-3 border-t border-gray-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 h-auto py-2" data-testid="user-menu-btn">
                <div className="w-8 h-8 rounded-full bg-[#0A2540] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {(user.name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium truncate">{user.name}</div>
                  <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{user.role === "admin" ? "Admin" : "Membro"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold">
                Backup database
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => downloadExport("json")} data-testid="export-json-btn">
                <FileJson className="w-4 h-4 mr-2" /> Esporta JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadExport("csv")} data-testid="export-csv-btn">
                <FileArchive className="w-4 h-4 mr-2" /> Esporta CSV (ZIP)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openCohortDialog} data-testid="export-cohort-btn">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Esporta coorte (Excel)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setPwOpen(true)} data-testid="change-pw-btn">
                <KeyRound className="w-4 h-4 mr-2" /> Cambia password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600" data-testid="logout-btn">
                <LogOut className="w-4 h-4 mr-2" /> Esci
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="flex">
        {/* Desktop Sidebar — unchanged */}
        <aside className="w-64 min-h-screen border-r border-gray-200 bg-[#F9FAFB] hidden md:flex flex-col">
          <SidebarContent onNavigate={() => {}} />
        </aside>

        {/* Mobile drawer overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-hidden="true"
            onClick={closeMobile}
          />
        )}

        {/* Mobile drawer panel */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#F9FAFB] flex flex-col shadow-xl md:hidden transform transition-transform duration-250 ease-in-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-end px-3 pt-3 pb-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={closeMobile}
              aria-label="Chiudi menu"
              className="text-gray-600"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <SidebarContent onNavigate={closeMobile} />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-h-screen fade-in">
          {/* Mobile header */}
          <div className="md:hidden border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-2 sticky top-0 bg-white z-30">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(true)}
                aria-label="Apri menu"
                data-testid="mobile-menu-btn"
                className="text-gray-700"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Link to="/" className="flex items-center gap-2" data-testid="mobile-home-link">
                <BrandMark className="w-7 h-7 flex-shrink-0" testid="mobile-brand-mark" />
                <BrandWordmark />
              </Link>
            </div>
            <div className="flex items-center gap-1">
              {location.pathname !== "/" && (
                <Link to="/">
                  <Button variant="ghost" size="icon" data-testid="mobile-home-btn" title="Home">
                    <Home className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              {user && (
                <Button variant="ghost" size="icon" onClick={logout} data-testid="mobile-logout">
                  <LogOut className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="p-6 md:p-8 lg:p-10">{children}</div>

          {/* Floating Home button */}
          {location.pathname !== "/" && (
            <Link to="/" data-testid="floating-home-btn" title="Vai alla Dashboard">
              <Button
                size="icon"
                className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full shadow-lg bg-[#0A2540] hover:bg-[#051626] text-white"
              >
                <Home className="w-5 h-5" />
              </Button>
            </Link>
          )}
        </main>
      </div>

      {/* Change password dialog */}
      <Dialog open={pwOpen} onOpenChange={(o) => { setPwOpen(o); if (!o) { setPwCurrent(""); setPwNew(""); setPwConfirm(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading font-black tracking-tight">Cambia password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Password attuale</Label>
              <Input
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                autoComplete="current-password"
                data-testid="pw-current"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Nuova password</Label>
              <Input
                type="password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                autoComplete="new-password"
                data-testid="pw-new"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Conferma nuova password</Label>
              <Input
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                autoComplete="new-password"
                data-testid="pw-confirm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)} disabled={pwLoading}>
              Annulla
            </Button>
            <Button
              onClick={changePassword}
              disabled={pwLoading}
              className="bg-[#0A2540] text-white hover:bg-[#051626]"
              data-testid="pw-submit"
            >
              {pwLoading ? "Salvo..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cohort export dialog */}
      <Dialog open={cohortOpen} onOpenChange={setCohortOpen}>
        <DialogContent className="max-w-md" data-testid="cohort-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading font-black tracking-tight">
              Esporta coorte in Excel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-gray-600 leading-relaxed">
              Scarica un file Excel con una riga per paziente e colonne pivotate
              per visita (t1, t2, ...): anagrafica, profilo di malattia, punteggi
              clinimetrici e terapie attive a ogni data. Fogli aggiuntivi:
              <span className="font-semibold"> Terapie</span> e <span className="font-semibold">Valutazioni</span> in formato esteso.
              <br />
              <span className="text-[11px] text-gray-500">Puoi opzionalmente <span className="font-semibold">ancorare la timeline</span> alla data di inizio di un farmaco specifico (es. inizio Adalimumab) per confrontare la coorte sullo stesso punto temporale clinico.</span>
            </p>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600 mb-1.5 block">
                Filtra per diagnosi
              </Label>
              <Select value={cohortDiag} onValueChange={setCohortDiag}>
                <SelectTrigger data-testid="cohort-diagnosis-select">
                  <SelectValue placeholder="Tutte le diagnosi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">Tutte le diagnosi</SelectItem>
                  {diagnoses.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cohortDiag && cohortDiag !== "__ALL__" && (
                <div className="text-[11px] text-gray-500 italic mt-1.5">
                  Match insensibile al case e "contains": es. "artrite reumatoide" include anche "Artrite reumatoide sieropositiva".
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600 mb-1.5 block">
                Ancora a farmaco (opzionale)
              </Label>
              <Select value={cohortAnchor} onValueChange={setCohortAnchor}>
                <SelectTrigger data-testid="cohort-anchor-select">
                  <SelectValue placeholder="Nessuno (date assolute)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">Nessuno (date assolute)</SelectItem>
                  {drugs.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cohortAnchor && cohortAnchor !== "__NONE__" ? (
                <div className="text-[11px] text-gray-500 italic mt-1.5">
                  t0 = data di inizio del primo ciclo di <span className="font-semibold">{cohortAnchor}</span> per ogni paziente.
                  Ogni visita avrà una colonna <span className="font-mono">tN_giorni_da_anchor</span> (negativa se prima, positiva se dopo).
                </div>
              ) : (
                <div className="text-[11px] text-gray-500 italic mt-1.5">
                  Esempio: scegli "Adalimumab" per allineare la coorte al momento di inizio biologico, indipendentemente dalla data assoluta.
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCohortOpen(false)} disabled={cohortLoading}>
              Annulla
            </Button>
            <Button
              onClick={downloadCohort}
              disabled={cohortLoading}
              className="bg-[#0A2540] text-white hover:bg-[#051626]"
              data-testid="cohort-download-btn"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {cohortLoading ? "Esporto..." : "Scarica Excel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
