import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { proTokensApi } from "../lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { QrCode, Plus, Copy, Trash2, CheckCircle2, Clock, Printer, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { PRO_INSTRUMENTS } from "../lib/proInstruments";

const DURATIONS = [
  { value: 24, label: "24 ore" },
  { value: 72, label: "3 giorni" },
  { value: 168, label: "7 giorni (default)" },
  { value: 336, label: "14 giorni" },
  { value: 720, label: "30 giorni" },
];

export default function PROManagement({ patient, open, onOpenChange, onConverted }) {
  const [tokens, setTokens] = useState([]);
  const [creating, setCreating] = useState(false);
  const [selectedInstruments, setSelectedInstruments] = useState(["haq", "vas_pain"]);
  const [duration, setDuration] = useState(168);
  const [note, setNote] = useState("");
  const [createdToken, setCreatedToken] = useState(null);
  const [createdQrDataUrl, setCreatedQrDataUrl] = useState(null);

  const load = async () => {
    if (!patient?.id) return;
    try {
      const data = await proTokensApi.listByPatient(patient.id);
      setTokens(data);
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    if (open) {
      load();
      setCreatedToken(null);
      setCreatedQrDataUrl(null);
    }
  }, [open, patient?.id]);

  const toggleInstrument = (k) => {
    setSelectedInstruments((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  };

  const create = async () => {
    if (selectedInstruments.length === 0) {
      toast.error("Seleziona almeno un questionario");
      return;
    }
    setCreating(true);
    try {
      const t = await proTokensApi.create({
        patient_id: patient.id,
        instruments: selectedInstruments,
        expires_in_hours: duration,
        note: note || null,
      });
      const url = `${window.location.origin}/pro/${t.token}`;
      const qrDataUrl = await QRCode.toDataURL(url, { width: 480, margin: 2, color: { dark: "#0A2540", light: "#FFFFFF" } });
      setCreatedToken({ ...t, url });
      setCreatedQrDataUrl(qrDataUrl);
      setNote("");
      load();
      toast.success("Link PRO generato");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore durante la creazione");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Revocare questo link? Le compilazioni in attesa saranno perse.")) return;
    try {
      await proTokensApi.remove(id);
      load();
      toast.success("Link revocato");
    } catch (e) {
      toast.error("Errore");
    }
  };

  const convert = async (id) => {
    try {
      const res = await proTokensApi.convert(id);
      toast.success(`Salvati ${res.created.length} questionari nello storico`);
      load();
      if (onConverted) onConverted();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore");
    }
  };

  const copyLink = (url) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiato");
  };

  const printQr = () => {
    if (!createdQrDataUrl) return;
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>QR PRO ${patient.codice_paziente || ""}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:30px}h1{color:#0A2540}
      .url{font-family:monospace;font-size:12px;color:#555;word-break:break-all;margin-top:18px}
      .info{margin:20px 0;color:#333}</style></head><body>
      <h1>Compila i questionari prima della visita</h1>
      <p class="info">Inquadra il QR code col tuo cellulare per aprire il modulo.</p>
      <img src="${createdQrDataUrl}" alt="QR" style="width:380px;height:380px"/>
      <p class="url">${createdToken.url}</p>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const sortedTokens = tokens;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" data-testid="pro-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading font-black tracking-tight flex items-center gap-2">
            <QrCode className="w-5 h-5" /> Patient-Reported Outcomes (QR per il paziente)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Generated QR shown prominently */}
          {createdToken && createdQrDataUrl && (
            <Card className="p-5 border-emerald-300 bg-emerald-50/40 text-center" data-testid="created-qr">
              <div className="text-xs uppercase tracking-[0.15em] text-emerald-800 font-semibold mb-2">
                ✓ QR pronto da mostrare/stampare
              </div>
              <img
                src={createdQrDataUrl}
                alt="QR code"
                className="w-60 h-60 mx-auto bg-white p-3 border border-emerald-200 rounded-md"
              />
              <div className="text-xs font-mono text-gray-600 mt-3 break-all">{createdToken.url}</div>
              <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => copyLink(createdToken.url)} data-testid="copy-qr-link">
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copia link
                </Button>
                <Button variant="outline" size="sm" onClick={printQr} data-testid="print-qr">
                  <Printer className="w-3.5 h-3.5 mr-1.5" /> Stampa
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setCreatedToken(null); setCreatedQrDataUrl(null); }}>
                  Crea un altro
                </Button>
              </div>
              <div className="text-[11px] text-gray-600 mt-3">
                Valido fino al {new Date(createdToken.expires_at).toLocaleString("it-IT")}.
                Mostralo al paziente sul tuo monitor o stampalo, lui lo inquadra dal cellulare.
              </div>
            </Card>
          )}

          {/* New token form (hidden if just created) */}
          {!createdToken && (
            <Card className="p-4 border-gray-200 space-y-4">
              <div className="text-xs uppercase tracking-[0.15em] text-gray-600 font-semibold flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> Genera nuovo QR
              </div>

              <div>
                <Label className="text-xs uppercase tracking-[0.15em] text-gray-600 mb-2 block">
                  Questionari da far compilare
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {Object.values(PRO_INSTRUMENTS).map((instr) => (
                    <label
                      key={instr.id}
                      className={`flex items-start gap-2 p-2 border rounded-md cursor-pointer transition ${
                        selectedInstruments.includes(instr.id)
                          ? "border-[#0A2540] bg-blue-50/40"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <Checkbox
                        checked={selectedInstruments.includes(instr.id)}
                        onCheckedChange={() => toggleInstrument(instr.id)}
                        data-testid={`pro-pick-${instr.id}`}
                      />
                      <div className="flex-1">
                        <div className="text-xs font-bold">{instr.label}</div>
                        <div className="text-[10px] text-gray-500 leading-tight">{instr.title}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Validità</Label>
                  <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                    <SelectTrigger data-testid="pro-duration"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-[0.15em] text-gray-600">Nota per il paziente (facoltativa)</Label>
                  <Textarea
                    rows={1}
                    placeholder="es. Compilare prima della visita di controllo"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    data-testid="pro-note"
                  />
                </div>
              </div>

              <Button
                className="bg-[#0A2540] text-white hover:bg-[#051626] w-full"
                onClick={create}
                disabled={creating}
                data-testid="generate-qr-btn"
              >
                <QrCode className="w-4 h-4 mr-2" />
                {creating ? "Generazione..." : "Genera QR e link"}
              </Button>
            </Card>
          )}

          {/* List of existing tokens */}
          <div>
            <div className="text-xs uppercase tracking-[0.15em] text-gray-600 font-semibold mb-2">
              Storico link PRO
            </div>
            {sortedTokens.length === 0 ? (
              <div className="text-sm text-gray-400 italic">Nessun link generato per questo paziente.</div>
            ) : (
              <div className="space-y-2">
                {sortedTokens.map((t) => {
                  const expired = !t.completed_at && t.expires_at < new Date().toISOString();
                  const completed = !!t.completed_at;
                  return (
                    <Card key={t.id} className="p-3 border-gray-200" data-testid={`pro-row-${t.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {completed ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Compilato
                              </Badge>
                            ) : expired ? (
                              <Badge className="bg-gray-200 text-gray-700 hover:bg-gray-200">Scaduto</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                <Clock className="w-3 h-3 mr-1" /> In attesa
                              </Badge>
                            )}
                            {t.converted && (
                              <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">
                                Salvato in storico
                              </Badge>
                            )}
                            {(t.instruments || []).map((i) => (
                              <Badge key={i} variant="outline" className="text-[10px]">
                                {(PRO_INSTRUMENTS[i] && PRO_INSTRUMENTS[i].label) || i}
                              </Badge>
                            ))}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-1">
                            Creato il {new Date(t.created_at).toLocaleString("it-IT")} · Scade il {new Date(t.expires_at).toLocaleString("it-IT")}
                            {t.created_by_name && ` · da ${t.created_by_name}`}
                          </div>
                          {completed && t.submitted_responses?.instruments && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {Object.entries(t.submitted_responses.instruments).map(([k, v]) => (
                                <span key={k} className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 text-[10px]">
                                  <span className="font-bold text-[#0A2540]">{(PRO_INSTRUMENTS[k] && PRO_INSTRUMENTS[k].label) || k}</span>
                                  <span className="font-mono">{v?.score ?? "-"}</span>
                                  {v?.interpretation && <span className="text-gray-600">({v.interpretation})</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {!completed && !expired && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyLink(`${window.location.origin}/pro/${t.token}`)}
                              data-testid={`copy-${t.id}`}
                            >
                              <Copy className="w-3 h-3 mr-1" /> Link
                            </Button>
                          )}
                          {completed && !t.converted && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-violet-300 text-violet-700 hover:bg-violet-50"
                              onClick={() => convert(t.id)}
                              data-testid={`convert-${t.id}`}
                            >
                              <ArrowRight className="w-3 h-3 mr-1" /> Salva nello storico
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(t.id)}
                            className="text-red-600 hover:text-red-700"
                            data-testid={`remove-${t.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
