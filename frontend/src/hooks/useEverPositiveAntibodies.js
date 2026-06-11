import { useState, useEffect } from "react";
import { labExamsApi } from "../lib/api";
import { computeEverPositiveMap } from "../lib/everPositiveAntibodies";

/**
 * Fetches all lab exams for a patient and computes a Map of
 * ever-positive antibody lab keys → { positiveDate, titer }.
 *
 * @param {string|null} patientId
 * @returns {{ everPositiveMap: Map, loading: boolean }}
 */
export function useEverPositiveAntibodies(patientId) {
  const [everPositiveMap, setEverPositiveMap] = useState(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patientId) {
      setEverPositiveMap(new Map());
      return;
    }
    setLoading(true);
    labExamsApi
      .listByPatient(patientId)
      .then((exams) => setEverPositiveMap(computeEverPositiveMap(exams)))
      .catch(() => setEverPositiveMap(new Map()))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { everPositiveMap, loading };
}
