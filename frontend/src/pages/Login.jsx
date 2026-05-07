import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "../lib/api";
import BrandMark, { BrandWordmark } from "../components/BrandMark";

function formatDetail(detail) {
  if (!detail) return "Errore di accesso";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  return String(detail);
}

export default function Login() {
  const { login, refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email e password sono obbligatori");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Accesso effettuato");
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(formatDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const startDemo = async () => {
    setDemoLoading(true);
    try {
      await authApi.demo();
      if (refreshUser) await refreshUser();
      toast.success("Account demo creato — esplora 3 pazienti di esempio!");
      navigate("/pazienti", { replace: true });
      // Force a hard refresh of context
      window.location.href = "/pazienti";
    } catch (err) {
      toast.error("Errore durante la creazione del demo");
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <BrandMark className="w-12 h-12" testid="login-brand-mark" />
            <div className="text-left">
              <BrandWordmark className="text-2xl leading-none" />
              <div className="text-[10px] font-medium tracking-[0.05em] text-gray-500 mt-1">
                The intelligent workspace for rheumatologists
              </div>
            </div>
          </div>
          <h1 className="font-heading text-3xl font-black tracking-tighter text-[#0A2540]">Accesso</h1>
          <p className="text-sm text-gray-600 mt-1">Inserisci le tue credenziali per accedere</p>
        </div>

        <Card className="border-gray-200 shadow-sm p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" autoComplete="email" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password" autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full bg-[#0A2540] text-white hover:bg-[#051626]" disabled={loading} data-testid="login-submit">
              {loading ? "Accesso in corso..." : "Accedi"}
            </Button>
          </form>
        </Card>

        <div className="text-center mt-4 text-sm text-gray-600">
          Non hai un account? <Link to="/register" className="text-[#0A2540] font-semibold hover:underline" data-testid="goto-register">Registrati</Link>
        </div>

        {/* Demo CTA */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.2em]">
              <span className="bg-[#F9FAFB] px-3 text-gray-500">oppure</span>
            </div>
          </div>
          <Button
            type="button"
            onClick={startDemo}
            disabled={demoLoading}
            className="mt-4 w-full bg-violet-600 text-white hover:bg-violet-700"
            data-testid="demo-btn"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {demoLoading ? "Creazione demo in corso..." : "Esplora con dati di esempio"}
          </Button>
          <p className="text-[11px] text-gray-500 text-center mt-2 leading-relaxed">
            Crea istantaneamente un account isolato con 3 pazienti reumatologici (AR, SpA, LES),
            valutazioni longitudinali e terapie già impostate. Nessuna registrazione richiesta.
          </p>
        </div>
      </div>
    </div>
  );
}
