import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const patientsApi = {
  list: () => api.get("/patients").then((r) => r.data),
  get: (id) => api.get(`/patients/${id}`).then((r) => r.data),
  create: (data) => api.post("/patients", data).then((r) => r.data),
  update: (id, data) => api.put(`/patients/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/patients/${id}`).then((r) => r.data),
};

export const assessmentsApi = {
  create: (data) => api.post("/assessments", data).then((r) => r.data),
  listByPatient: (patientId) =>
    api.get(`/patients/${patientId}/assessments`).then((r) => r.data),
  get: (id) => api.get(`/assessments/${id}`).then((r) => r.data),
  remove: (id) => api.delete(`/assessments/${id}`).then((r) => r.data),
};

export const statsApi = {
  get: () => api.get("/stats").then((r) => r.data),
};
