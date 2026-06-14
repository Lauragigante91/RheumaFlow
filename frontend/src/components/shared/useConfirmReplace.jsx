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

  const requestReplace = useCallback((currentValue, applyFn) => {
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
            Il campo Terapia indicata contiene già testo. Vuoi sostituirlo con il testo generato dalla Gestione terapia?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={close}>Annulla</AlertDialogCancel>
          <AlertDialogAction onClick={() => { if (pendingApply) pendingApply(); close(); }}>Sostituisci</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { requestReplace, confirmDialog };
}
