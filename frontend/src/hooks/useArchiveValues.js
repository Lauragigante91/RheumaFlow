import { useState, useEffect, useCallback, useMemo } from "react";
import { labExamsApi } from "../lib/api";

/**
 * Legge tutti i lab_exams del paziente e restituisce:
 *   latestValues  — { [canonicalKey]: { value, unit, qualitative, date, examId } }
 *                   il valore più recente per ogni chiave canonica
 *   allByKey      — { [canonicalKey]: [ ...sorted desc by date ] }
 *   labExams      — array grezzo ordinato desc per data
 *   loading
 *   reload        — fn per refresh manuale
 */
export function useArchiveValues(patientId) {
  const [labExams, setLabExams] = useState([]);
  const [loading,  setLoading]  = useState(false);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await labExamsApi.listByPatient(patientId);
      const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
      setLabExams(sorted);
    } catch (_) {
      // silently ignore — caller shows fallback
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const { latestValues, allByKey } = useMemo(() => {
    const latest = {};
    const all    = {};
    for (const exam of labExams) {
      const values = exam.values || {};
      for (const [key, v] of Object.entries(values)) {
        if (!all[key]) all[key] = [];
        all[key].push({ ...v, date: exam.date, examId: exam.id });
        if (!latest[key]) {
          latest[key] = { ...v, date: exam.date, examId: exam.id };
        }
      }
    }
    return { latestValues: latest, allByKey: all };
  }, [labExams]);

  return { latestValues, allByKey, labExams, loading, reload: load };
}
