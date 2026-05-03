import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

// 401 interceptor: emit a custom event so AuthContext can react
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data) => api.post("/auth/register", data).then((r) => r.data),
  login: (data) => api.post("/auth/login", data).then((r) => r.data),
  logout: () => api.post("/auth/logout").then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
};

export const patientsApi = {
  list: () => api.get("/patients").then((r) => r.data),
  get: (id) => api.get(`/patients/${id}`).then((r) => r.data),
  create: (data) => api.post("/patients", data).then((r) => r.data),
  update: (id, data) => api.put(`/patients/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/patients/${id}`).then((r) => r.data),
};

export const assessmentsApi = {
  create: (data) => api.post("/assessments", data).then((r) => r.data),
  update: (id, data) => api.put(`/assessments/${id}`, data).then((r) => r.data),
  listByPatient: (patientId) =>
    api.get(`/patients/${patientId}/assessments`).then((r) => r.data),
  get: (id) => api.get(`/assessments/${id}`).then((r) => r.data),
  remove: (id) => api.delete(`/assessments/${id}`).then((r) => r.data),
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
  create: (data) => api.post("/therapies", data).then((r) => r.data),
  listByPatient: (patientId) =>
    api.get(`/patients/${patientId}/therapies`).then((r) => r.data),
  update: (id, data) => api.put(`/therapies/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/therapies/${id}`).then((r) => r.data),
};

export const labExamsApi = {
  create: (data) => api.post("/lab-exams", data).then((r) => r.data),
  listByPatient: (patientId) =>
    api.get(`/patients/${patientId}/lab-exams`).then((r) => r.data),
  update: (id, data) => api.put(`/lab-exams/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/lab-exams/${id}`).then((r) => r.data),
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
