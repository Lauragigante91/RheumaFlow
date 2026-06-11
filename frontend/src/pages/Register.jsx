import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import BrandMark, { BrandWordmark } from "../components/layout/BrandMark";

function formatDetail(detail) {
  if (!detail) return "Errore di registrazione";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  return String(detail);
}

export default function Register() {
  const { register } = useAuth();
  const [mode, setMode] = useState("new"); // "new" | "join"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [platformCode, setPlatformCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("Tutti i campi sono obbligatori");
      return;
    }
    if (password.length < 6) {
      toast.error("La password deve essere lunga almeno 6 caratteri");
      return;
    }
    if (mode === "new" && !orgName.trim()) {
      toast.error("Inserisci il nome della tua UO");
      return;
    }
    if (mode === "new" && !platformCode.trim()) {
      toast.error("Inserisci il codice di accesso RheumaFlow");
      return;
    }
    if (mode === "join" && !inviteCode.trim()) {
      toast.error("Inserisci il codice invito");
      return;
    }
    setLoading(true);
    try {
      await register({
        name,
        email,
        password,
        ...(mode === "new"
          ? { organization_name: orgName.trim(), platform_code: platformCode.trim() }
          : { invite_code: inviteCode.trim() }),
      });
      toast.success("Registrazione completata");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(formatDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4" data-testid="register-page">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <BrandMark className="w-12 h-12" testid="register-brand-mark" />
            <div className="text-left">
              <BrandWordmark className="text-2xl leading-none" />
              <div className="text-[10px] font-medium tracking-[0.05em] text-gray-500 mt-1">
                The intelligent workspace for rheumatologists
              </div>
            </div>
          </div>
          <h1 className="font-heading text-3xl font-black tracking-tighter text-[#0A2540]">Registrazione</h1>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-1 mb-4">
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mode === "new"
                ? "bg-[#0A2540] text-white"
                : "text-gray-600 hover:text-[#0A2540]"
            }`}
            data-testid="mode-new"
          >
            Crea nuova UO
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mode === "join"
                ? "bg-[#0A2540] text-white"
                : "text-gray-600 hover:text-[#0A2540]"
            }`}
            data-testid="mode-join"
          >
            Unisciti a una UO esistente
          </button>
        </div>

        <Card className="border-gray-200 shadow-sm p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Nome e cognome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="reg-name" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="reg-email" autoComplete="email" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Password (min 6 caratteri)</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="reg-password" autoComplete="new-password" />
            </div>

            {mode === "new" ? (
              <>
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Nome UO / Reparto</Label>
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="es. UO Reumatologia Ospedale X"
                    data-testid="reg-org-name"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Sarai amministratore della tua UO e riceverai un codice invito per i colleghi.
                  </p>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Codice di accesso RheumaFlow</Label>
                  <Input
                    value={platformCode}
                    onChange={(e) => setPlatformCode(e.target.value)}
                    placeholder="Codice fornito da RheumaFlow"
                    data-testid="reg-platform-code"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Richiedi il codice per attivare una nuova struttura.
                  </p>
                </div>
              </>
            ) : (
              <div>
                <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Codice invito</Label>
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Codice fornito dall'amministratore"
                  data-testid="reg-invite"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Contatta il responsabile della tua UO per ottenere il codice.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full bg-[#0A2540] text-white hover:bg-[#051626]" disabled={loading} data-testid="reg-submit">
              {loading ? "Registrazione..." : mode === "new" ? "Crea UO e registrati" : "Registrati"}
            </Button>
          </form>
        </Card>

        <div className="text-center mt-4 text-sm text-gray-600">
          Hai già un account? <Link to="/login" className="text-[#0A2540] font-semibold hover:underline" data-testid="goto-login">Accedi</Link>
        </div>
      </div>
    </div>
  );
}
