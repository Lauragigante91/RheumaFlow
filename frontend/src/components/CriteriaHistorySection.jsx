import React from "react";
import { Link } from "react-router-dom";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { FileCheck2, Trash2 } from "lucide-react";

const Th = ({ children, className = "" }) => (
  <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500 ${className}`}>{children}</th>
);

export default function CriteriaHistorySection({ patientId, criteriaEvals, onRemove }) {
  return (
    <Card className="border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading font-bold text-xl tracking-tight">Storico criteri classificativi</h2>
        <Link to={`/criteri?paziente=${patientId}`}>
          <Button variant="outline" size="sm" data-testid="goto-criteria-btn">
            <FileCheck2 className="w-4 h-4 mr-2" /> Applica criteri
          </Button>
        </Link>
      </div>
      {criteriaEvals.length === 0 ? (
        <div className="p-10 text-center text-gray-500" data-testid="empty-criteria">
          Nessun criterio applicato. Vai a "Criteri" per valutare il paziente.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F9FAFB] border-b border-gray-200">
              <tr className="text-left">
                <Th>Data</Th>
                <Th>Criteri</Th>
                <Th>Sorgente</Th>
                <Th>Score</Th>
                <Th>Esito</Th>
                <Th className="text-right">Azioni</Th>
              </tr>
            </thead>
            <tbody>
              {criteriaEvals.map((ce) => (
                <tr key={ce.id} className="border-b border-gray-100 hover:bg-gray-50" data-testid={`criteria-row-${ce.id}`}>
                  <td className="px-4 py-3 font-medium">{new Date(ce.date).toLocaleDateString("it-IT")}</td>
                  <td className="px-4 py-3">{ce.criteria_name}</td>
                  <td className="px-4 py-3 text-gray-600">{ce.source}</td>
                  <td className="px-4 py-3 font-mono font-bold text-[#0A2540]">{ce.score} / ≥{ce.threshold}</td>
                  <td className="px-4 py-3">
                    <Badge variant={ce.meets ? "default" : "outline"} className={ce.meets ? "bg-green-700 hover:bg-green-700 text-white" : ""}>
                      {ce.meets ? "Soddisfatti" : "Non raggiunti"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => onRemove(ce.id)} data-testid={`delete-criteria-${ce.id}`}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
