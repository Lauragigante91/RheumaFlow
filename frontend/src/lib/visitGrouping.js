function dateKey(d) {
  return (d || "").slice(0, 10);
}

export function groupSidebarVisits({ firstVisit, workupVisits, assessments, therapiesActiveOn, examsByDate }) {
  const allAssessments = Array.isArray(assessments) ? assessments : [];
  const allWorkups = Array.isArray(workupVisits) ? workupVisits : [];
  const therapiesFor = typeof therapiesActiveOn === "function" ? therapiesActiveOn : () => [];
  const examsFor = (k) =>
    examsByDate && typeof examsByDate.get === "function" ? examsByDate.get(k) || [] : [];

  const items = [];
  const firstVisitDateKey = firstVisit?.referral_date ? dateKey(firstVisit.referral_date) : null;

  const workupLinkedIds = new Set(allAssessments.filter((a) => a.visit_id).map((a) => a.id));

  const primaVisitaAssessments = firstVisitDateKey
    ? allAssessments.filter((a) => !a.visit_id && dateKey(a.date) === firstVisitDateKey)
    : [];
  const primaVisitaAssessmentIds = new Set(primaVisitaAssessments.map((a) => a.id));

  const workupDateKeys = new Set(allWorkups.map((wv) => dateKey(wv.visit_date)).filter(Boolean));

  if (firstVisit?.referral_date) {
    items.push({
      type: "prima_visita",
      date: firstVisit.referral_date,
      data: firstVisit,
      linkedAssessments: primaVisitaAssessments,
    });
  }

  for (const wv of allWorkups) {
    const wvKey = dateKey(wv.visit_date);
    const linkedById = allAssessments.filter(
      (a) => a.visit_id && (a.visit_id === wv.id || a.visit_id === wv._id)
    );
    const isAnchorForDate =
      !!wvKey && allWorkups.findIndex((x) => dateKey(x.visit_date) === wvKey) === allWorkups.indexOf(wv);
    const orphansOnDate = isAnchorForDate
      ? allAssessments.filter(
          (a) => !a.visit_id && !primaVisitaAssessmentIds.has(a.id) && dateKey(a.date) === wvKey
        )
      : [];
    items.push({
      type: "workup",
      date: wv.visit_date || "",
      data: wv,
      linkedAssessments: [...linkedById, ...orphansOnDate],
    });
  }

  const m = new Map();
  for (const a of allAssessments) {
    if (workupLinkedIds.has(a.id)) continue;
    if (primaVisitaAssessmentIds.has(a.id)) continue;
    const k = dateKey(a.date);
    if (!k) continue;
    if (workupDateKeys.has(k)) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(a);
  }
  for (const [date, ass] of m.entries()) {
    items.push({
      type: "followup",
      date,
      data: { date, assessments: ass, therapies: therapiesFor(date), exams: examsFor(date) },
    });
  }

  items.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return items;
}
