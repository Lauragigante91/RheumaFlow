---
name: Follow-up visit exit_therapy_text pipeline
description: How exit_therapy_text is saved and loaded for follow-up visits created via TodayVisitSection + PlanSection.
---

**The pipeline (post-fix):**
1. PlanSection.handleSaveVisit() calls onSaveVisit(indicazioniRef.current) — passes the §10 Terapia text
2. PatientDetail.onSaveVisit = (txt) => todayVisitHandle.current?.save(txt) — forwards to TodayVisitSection
3. TodayVisitSection.save(exitTherapyText) includes exit_therapy_text in narrativePayload → saved to workup_visit DB field

**Loading (post-fix):**
- PatientDetail computes todayFuVisit inline: workupVisits.find(v => v.visit_type==="follow_up" && v.visit_date?.slice(0,10)===followupVisitDate)
- Passes initialTherapyText={todayFuVisit?.exit_therapy_text || null} to PlanSection
- PlanSection useEffect: if initialTherapyText → sets indicazioni + marks hasInitFromSavedText=true + hasInitFromTherapies=true (blocks fallback)

**Timing issue (why hasInitFromSavedText is separate from hasInitFromTherapies):**
- In PatientDetail.load(), therapies loads BEFORE workupVisits (sequential await)
- formatActiveTherapies effect may run first and set hasInitFromTherapies=true
- initialTherapyText effect must NOT check hasInitFromTherapies — it uses its own ref hasInitFromSavedText
- This way, when workupVisits eventually arrives with exit_therapy_text, it overrides the reconstructed text

**Why:** TERAPIA IN USCITA must show verbatim doctor-approved text from DB, never "(ricostruito)" from ledger.
**How to apply:** Never check hasInitFromTherapies in the initialTherapyText useEffect. The saved text always wins.
