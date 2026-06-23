import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

// Normalise Pydantic v2 validation errors: detail is an array of
// {type, loc, msg, input} objects — flatten to a readable string so that
// toast.error(e.response?.data?.detail) never tries to render a plain object.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    const detail = error.response?.data?.detail;
    if (Array.isArray(detail)) {
      error.response.data.detail = detail
        .map((d) => (typeof d === "object" && d !== null ? d.msg || JSON.stringify(d) : String(d)))
        .join("; ");
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data) => api.post("/auth/register", data).then((r) => r.data),
  login: (data) => api.post("/auth/login", data).then((r) => r.data),
  demo: () => api.post("/auth/demo").then((r) => r.data),
  logout: () => api.post("/auth/logout").then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
};

export const patientsApi = {
  list: () => api.get("/patients").then((r) => r.data),
  get: (id) => api.get(`/patients/${id}`).then((r) => r.data),
  create: (data) => api.post("/patients", data).then((r) => r.data),
  update: (id, data) => api.put(`/patients/${id}`, data).then((r) => r.data),
  /**
   * Non-destructive partial update.
   * - Non-null values → $set on the patient document.
   * - null values → $unset (clear the field).
   * Only the fields explicitly included in `data` are touched.
   */
  patch: (id, data) => api.patch(`/patients/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/patients/${id}`).then((r) => r.data),
  anonymize: (id) => api.post(`/patients/${id}/anonymize`).then((r) => r.data),
  setRecall: (id, payload) => api.put(`/patients/${id}/recall`, payload).then((r) => r.data),
  listRecall: () => api.get("/patients-recall").then((r) => r.data),
  recentMine: (days = 7) => api.get(`/patients-recent-mine?days=${days}`).then((r) => r.data),
};

export const workupVisitsApi = {
  list: (patientId) =>
    api.get(`/patients/${patientId}/workup-visits`).then((r) => r.data),
  create: (patientId, data) =>
    api.post(`/patients/${patientId}/workup-visits`, data).then((r) => r.data),
  update: (visitId, data) =>
    api.put(`/workup-visits/${visitId}`, data).then((r) => r.data),
  patch: (visitId, data) =>
    api.patch(`/workup-visits/${visitId}`, data).then((r) => r.data),
  complete: (visitId) =>
    api.patch(`/workup-visits/${visitId}/complete`).then((r) => r.data),
  remove: (visitId) =>
    api.delete(`/workup-visits/${visitId}`).then((r) => r.data),
};

export const orgApi = {
  updateSettings: (data) => api.put("/organization/settings", data).then((r) => r.data),
  members: () => api.get("/organization/members").then((r) => r.data),
};

export const assessmentsApi = {
  create: (data) => api.post("/assessments", data).then((r) => r.data),
  upsert: (data) => api.post("/assessments/upsert", data).then((r) => r.data),
  update: (id, data) => api.put(`/assessments/${id}`, data).then((r) => r.data),
  listByPatient: (patientId) =>
    api.get(`/patients/${patientId}/assessments`).then((r) => r.data),
  get: (id) => api.get(`/assessments/${id}`).then((r) => r.data),
  remove: (id) => api.delete(`/assessments/${id}`).then((r) => r.data),
};

export const instrumentalExamsApi = {
  create: (data) => api.post("/instrumental-exams", data).then((r) => r.data),
  upsert: (data) => api.post("/instrumental-exams/upsert", data).then((r) => r.data),
  update: (id, data) => api.put(`/instrumental-exams/${id}`, data).then((r) => r.data),
  list: (patientId) =>
    api.get(`/patients/${patientId}/instrumental-exams`).then((r) => r.data),
  listByPatient: (patientId) =>
    api.get(`/patients/${patientId}/instrumental-exams`).then((r) => r.data),
  get: (id) => api.get(`/instrumental-exams/${id}`).then((r) => r.data),
  remove: (id) => api.delete(`/instrumental-exams/${id}`).then((r) => r.data),
};

export const statsApi = {
  get: () => api.get("/stats").then((r) => r.data),
};

export const criteriaApi = {
  create: (data) => api.post("/criteria-evaluations", data).then((r) => r.data),
  listByPatient: (patientId) =>
    api.get(`/patients/${patientId}/criteria-evaluations`).then((r) => r.data),
  remove: (id) => api.delete(`/criteria-evaluations/${id}`).then((r) => r.data),
};

export const therapiesApi = {
  create:   (data)     => api.post("/therapies", data).then((r) => r.data),
  upsert:   (data)     => api.post("/therapies/upsert", data).then((r) => r.data),
  addEvent: (id, data) => api.post(`/therapies/${id}/events`, data).then((r) => r.data),
  listByPatient: (patientId) =>
    api.get(`/patients/${patientId}/therapies`).then((r) => r.data),
  update: (id, data) => api.put(`/therapies/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/therapies/${id}`).then((r) => r.data),
};

export const labExamsApi = {
  create: (data) => api.post("/lab-exams", data).then((r) => r.data),
  upsert: (data) => api.post("/lab-exams/upsert", data).then((r) => r.data),
  listByPatient: (patientId) =>
    api.get(`/patients/${patientId}/lab-exams`).then((r) => r.data),
  update: (id, data) => api.put(`/lab-exams/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/lab-exams/${id}`).then((r) => r.data),
};

export const specialistVisitsApi = {
  create: (data) => api.post("/specialist-visits", data).then((r) => r.data),
  listByPatient: (patientId) =>
    api.get(`/patients/${patientId}/specialist-visits`).then((r) => r.data),
  update: (id, data) => api.put(`/specialist-visits/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/specialist-visits/${id}`).then((r) => r.data),
};

export const remindersApi = {
  create: (data) => api.post("/reminders", data).then((r) => r.data),
  listByPatient: (patientId) =>
    api.get(`/patients/${patientId}/reminders`).then((r) => r.data),
  upcoming: () => api.get("/reminders/upcoming").then((r) => r.data),
  update: (id, data) => api.put(`/reminders/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/reminders/${id}`).then((r) => r.data),
};

export const scleroProfileApi = {
  get: (patientId) =>
    api.get(`/patients/${patientId}/sclero-profile`).then((r) => r.data),
  upsert: (patientId, data) =>
    api.put(`/patients/${patientId}/sclero-profile`, { ...data, patient_id: patientId }).then((r) => r.data),
};

export const diseaseProfileApi = {
  get: (patientId, diseaseType) =>
    api
      .get(`/patients/${patientId}/disease-profile/${diseaseType}`)
      .then((r) => r.data),
  upsert: (patientId, diseaseType, data) =>
    api
      .put(`/patients/${patientId}/disease-profile/${diseaseType}`, {
        patient_id: patientId,
        data,
      })
      .then((r) => r.data),
  remove: (patientId, diseaseType) =>
    api
      .delete(`/patients/${patientId}/disease-profile/${diseaseType}`)
      .then((r) => r.data),
};

export const exportApi = {
  json: () => `${API}/export/json`,
  csvZip: () => `${API}/export/csv-zip`,
};

export const conditionsApi = {
  /** List all conditions for a patient, sorted by category then label. */
  list:     (patientId)    => api.get(`/patients/${patientId}/conditions`).then((r) => r.data),
  /** Smart upsert — respects single_instance / multi_instance semantics. */
  upsert:   (payload)      => api.post("/conditions/upsert", payload).then((r) => r.data),
  /** Unconditional create (bypasses upsert dedup logic). */
  create:   (payload)      => api.post("/conditions", payload).then((r) => r.data),
  /** Partial update of an existing condition. */
  update:   (id, payload)  => api.put(`/conditions/${id}`, payload).then((r) => r.data),
  /** Delete a condition by id. */
  remove:   (id)           => api.delete(`/conditions/${id}`).then((r) => r.data),
  /** Fetch the canonical registry from backend (60 V1 entries + metadata). */
  registry: ()             => api.get("/conditions/registry").then((r) => r.data),
  /** Fetch the label → canonical_name reverse map from backend. */
  labelMap: ()             => api.get("/conditions/label-map").then((r) => r.data),
};

export const clinicalEventsApi = {
  list:        (patientId, params) => api.get(`/patients/${patientId}/clinical-events`, { params }).then(r => r.data),
  create:      (patientId, data)   => api.post(`/patients/${patientId}/clinical-events`, data).then(r => r.data),
  batchCreate: (patientId, data)   => api.post(`/patients/${patientId}/clinical-events/batch`, data).then(r => r.data),
  update:      (patientId, id, data) => api.patch(`/patients/${patientId}/clinical-events/${id}`, data).then(r => r.data),
  confirm:     (patientId, id)     => api.patch(`/patients/${patientId}/clinical-events/${id}/confirm`).then(r => r.data),
  remove:      (patientId, id)     => api.delete(`/patients/${patientId}/clinical-events/${id}`).then(r => r.data),
};

export const visitTemplatesApi = {
  list: (category) =>
    api.get("/visit-templates", { params: category ? { category } : {} }).then((r) => r.data),
  create: (data) => api.post("/visit-templates", data).then((r) => r.data),
  update: (id, data) => api.put(`/visit-templates/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/visit-templates/${id}`).then((r) => r.data),
};

export const proTokensApi = {
  create: (data) => api.post("/pro-tokens", data).then((r) => r.data),
  listByPatient: (patientId) =>
    api.get(`/patients/${patientId}/pro-tokens`).then((r) => r.data),
  remove: (id) => api.delete(`/pro-tokens/${id}`).then((r) => r.data),
  convert: (id) => api.post(`/pro-tokens/${id}/convert`).then((r) => r.data),
  // Public (no auth) — uses raw axios
  publicGet: (token) => axios.get(`${API}/public/pro/${token}`).then((r) => r.data),
  publicSubmit: (token, responses) =>
    axios.post(`${API}/public/pro/${token}/submit`, { responses }).then((r) => r.data),
};

export const consultApi = {
  create: (patientId, data) =>
    api.post(`/patients/${patientId}/consult-token`, data).then((r) => r.data),
  list: (patientId) =>
    api.get(`/patients/${patientId}/consult-tokens`).then((r) => r.data),
  remove: (id) => api.delete(`/consult-tokens/${id}`).then((r) => r.data),
  // Public (no auth) — uses raw axios
  publicGet: (token) =>
    axios.get(`${API}/public/consult/${token}`).then((r) => r.data),
};

export const examUploadApi = {
  generateQR: (visitId, purpose) =>
    api.post(`/visits/${visitId}/generate-exam-upload-qr`, { purpose }).then((r) => r.data),
  revokeSession: (sessionId) =>
    api.post(`/exam-upload-sessions/${sessionId}/revoke`).then((r) => r.data),
  listUploads: (visitId) =>
    api.get(`/visits/${visitId}/exam-uploads`).then((r) => r.data),
  updateUpload: (uploadId, data) =>
    api.patch(`/exam-uploads/${uploadId}`, data).then((r) => r.data),
  deleteUpload: (uploadId) =>
    api.delete(`/exam-uploads/${uploadId}`).then((r) => r.data),
  fileUrl: (uploadId) => `${API}/exam-uploads/${uploadId}/file`,
  // Public (no auth) — uses raw axios
  publicStatus: (token) =>
    axios.get(`${API}/exam-upload/${token}/status`).then((r) => r.data),
  publicUpload: (token, formData) =>
    axios.post(`${API}/exam-upload/${token}/upload`, formData).then((r) => r.data),
  publicPatchExtractedText: (token, uploadId, extractedText, extractedValues) =>
    axios.patch(`${API}/exam-upload/${token}/uploads/${uploadId}/text`, { extracted_text: extractedText, extracted_values: extractedValues || [] }).then((r) => r.data),
};
