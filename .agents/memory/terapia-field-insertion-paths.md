---
name: Terapia field generated-text insertion paths
description: All generated therapy text must funnel through the guarded safeInsertTherapyText; PatientDetail has TWO distinct insertion mechanisms that are easy to miss.
---

The free-text therapy field ("Terapia" / "Terapia indicata") is `indicazioni` in PlanSection (PatientDetail today-visit) and `therapy_modification` in WorkupVisitPage / FirstVisitPage.

Rule: generated text (Gestione terapia, schema/preset, calendario biologico, tapering, safety reminders) must NOT auto-append. Empty field -> insert; non-empty -> confirm-replace modal ("Sostituisci" / "Annulla"). Implemented by the shared hook `useConfirmReplace` returning `safeInsertTherapyText(currentValue, applyFn)`.

**Why:** auto-append created duplicates with manually-typed / Template text. First fix missed a path and the bug persisted.

**How to apply / the trap:** PatientDetail feeds the PlanSection field through TWO independent mechanisms — guarding one and missing the other is the exact bug that recurred:
1. handleAppendToPlan / handleAcceptReminder -> setAppendPlanText -> PlanSection `appendPlanText` effect.
2. onTherapySaved -> findPresetText (lib/therapyPresets.js, "Si avvia ...") -> planHandle.appendIndicazioni -> PlanSection imperative handle.
Both must call safeInsertTherapyText. The imperative handle is registered once (`[]`-deps effect), so read the live value via a ref (`indicazioniRef.current`, assigned during render), NOT the closed-over state, or it always sees the stale initial value.

Template's own TemplatePickerDialog `onSelect` intentionally STAYS append (not routed through the guard). Manual textarea typing is never gated.
