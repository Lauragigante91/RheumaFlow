import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import ExamsSection from "./ExamsSection";

/**
 * Modal wrapper that hosts the full ExamsSection (CRUD esami di laboratorio).
 * Used so that the patient page no longer shows exams as a permanent block,
 * but they remain accessible from the assessment history (icon 🧪) and
 * from a quick-action button in the header.
 *
 * Props:
 *   open, onOpenChange — controlled state
 *   patient            — patient object passed through to ExamsSection
 */
export default function ExamsDialog({ open, onOpenChange, patient }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="exams-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading font-black tracking-tight">
            Esami di laboratorio
          </DialogTitle>
        </DialogHeader>
        {patient && <ExamsSection patient={patient} />}
      </DialogContent>
    </Dialog>
  );
}
