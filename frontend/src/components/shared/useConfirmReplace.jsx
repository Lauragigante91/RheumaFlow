import { useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "../ui/alert-dialog";

export default function useConfirmReplace() {
  const [pendingApply, setPendingApply] = useState(null);

  const safeInsertTherapyText = useCallback((currentValue, applyFn) => {
    if (!currentValue || !String(currentValue).trim()) {
      applyFn();
    } else {
      setPendingApply(() => applyFn);
    }
  }, []);

  const close = useCallback(() => setPendingApply(null), []);

  const confirmDialog = (
    <AlertDialog open={!!pendingApply} onOpenChange={(open) => { if (!open) close(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Terapia indicata</AlertDialogTitle>
          <AlertDialogDescription>
            Il campo Terapia contiene già testo. Vuoi sostituirlo con il testo generato?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={close}>Annulla</AlertDialogCancel>
          <AlertDialogAction onClick={() => { if (pendingApply) pendingApply(); close(); }}>Sostituisci</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { safeInsertTherapyText, confirmDialog };
}
