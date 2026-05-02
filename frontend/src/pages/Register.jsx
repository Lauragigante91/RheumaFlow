import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Activity } from "lucide-react";
import { toast } from "sonner";

function formatDetail(detail) {
  if (!detail) return "Errore di registrazione";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  return String(detail);
}

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgMode, setOrgMode] = useState("create");
  const [orgName, setOrgName] = useState("");
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
    if (orgMode === "create" && !orgName) {
      toast.error("Specifica il nome dell'UO");
      return;
    }
    if (orgMode === "join" && !inviteCode) {
      toast.error("Inserisci il codice invito");
      return;
    }
    setLoading(true);
    try {
      await register({
        name,
        email,
        password,
        organization_name: orgMode === "create" ? orgName : undefined,
        invite_code: orgMode === "join" ? inviteCode.trim() : undefined,
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
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-[#0A2540] flex items-center justify-center rounded-sm">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-heading font-black text-2xl tracking-tighter">CLINIMETRIA</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Reumatologia</div>
            </div>
          </div>
          <h1 className="font-heading text-3xl font-black tracking-tighter text-[#0A2540]">Registrazione</h1>
          <p className="text-sm text-gray-600 mt-1">Crea un account o unisciti a una UO esistente</p>
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

            <Tabs value={orgMode} onValueChange={setOrgMode}>
              <TabsList className="grid grid-cols-2 mb-3">
                <TabsTrigger value="create" data-testid="tab-create-org">Crea nuova UO</TabsTrigger>
                <TabsTrigger value="join" data-testid="tab-join-org">Unisciti con codice</TabsTrigger>
              </TabsList>
              <TabsContent value="create">
                <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Nome Unità Operativa</Label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="es. UO Reumatologia Policlinico..." data-testid="reg-org-name" />
                <p className="text-xs text-gray-500 mt-1">Sarai amministratore della nuova UO. Potrai invitare altri medici via codice.</p>
              </TabsContent>
              <TabsContent value="join">
                <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Codice invito</Label>
                <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Codice fornito dal collega" data-testid="reg-invite" />
                <p className="text-xs text-gray-500 mt-1">Vedrai gli stessi pazienti dei colleghi della tua UO.</p>
              </TabsContent>
            </Tabs>

            <Button type="submit" className="w-full bg-[#0A2540] text-white hover:bg-[#051626]" disabled={loading} data-testid="reg-submit">
              {loading ? "Registrazione..." : "Registrati"}
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
