import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Activity } from "lucide-react";
import { toast } from "sonner";

function formatDetail(detail) {
  if (!detail) return "Errore di accesso";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  return String(detail);
}

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-[#0A2540] flex items-center justify-center rounded-sm">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-heading font-black text-2xl tracking-tighter">CLINIMETRIA</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Reumatologia</div>
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
      </div>
    </div>
  );
}
