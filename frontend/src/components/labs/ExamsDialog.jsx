import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { FlaskConical, ScanSearch, Stethoscope, Clock } from "lucide-react";
import ExamsSection from "./ExamsSection";
import InstrumentalExamsSection from "./InstrumentalExamsSection";
import SpecialistVisitsSection from "../specialist/SpecialistVisitsSection";
import ChronologicalExamsTab from "./ChronologicalExamsTab";

/**
 * Modal wrapper che ospita quattro tab:
 *   - Laboratorio             (ExamsSection)
 *   - Strumentali             (InstrumentalExamsSection)
 *   - Visite specialistiche   (SpecialistVisitsSection)
 *   - Cronologico             (ChronologicalExamsTab) — vista unificata
 *
 * Props:
 *   open, onOpenChange — controlled state
 *   patient            — patient object
 *   initialTab         — "lab" | "strumentali" | "specialist" | "cronologico" (default "lab")
 */
export default function ExamsDialog({ open, onOpenChange, patient, initialTab = "lab" }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [open, initialTab]);

  const tabs = [
    { key: "lab",         label: "Laboratorio",          icon: FlaskConical },
    { key: "strumentali", label: "Strumentali",           icon: ScanSearch   },
    { key: "specialist",  label: "Visite specialistiche", icon: Stethoscope  },
    { key: "cronologico", label: "Cronologico",           icon: Clock        },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="exams-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading font-black tracking-tight">
            Archivio esami e visite
          </DialogTitle>
        </DialogHeader>

        {/* ── Tab bar ── */}
        <div style={{
          display: "flex", gap: "4px",
          borderBottom: "1.5px solid #e5e7eb",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}>
          {tabs.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px",
                  border: "none", background: "none",
                  borderBottom: active ? "2.5px solid #0A2540" : "2.5px solid transparent",
                  color: active ? "#0A2540" : "#6b7280",
                  fontWeight: active ? 700 : 500,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  marginBottom: "-1.5px",
                  whiteSpace: "nowrap",
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ── */}
        {patient && (
          <>
            <div style={{ display: activeTab === "lab" ? "block" : "none" }}>
              <ExamsSection patient={patient} />
            </div>
            <div style={{ display: activeTab === "strumentali" ? "block" : "none" }}>
              <InstrumentalExamsSection patient={patient} />
            </div>
            <div style={{ display: activeTab === "specialist" ? "block" : "none" }}>
              <SpecialistVisitsSection patient={patient} />
            </div>
            <div style={{ display: activeTab === "cronologico" ? "block" : "none" }}>
              {activeTab === "cronologico" && (
                <ChronologicalExamsTab patient={patient} />
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
