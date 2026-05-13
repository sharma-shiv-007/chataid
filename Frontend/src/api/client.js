// Frontend/src/api/client.js  ── complete drop-in replacement
const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const getToken = () => localStorage.getItem("medicare_token");

const headers = (isFormData = false) => {
  const h = { Authorization: `Bearer ${getToken()}` };
  if (!isFormData) h["Content-Type"] = "application/json";
  return h;
};

const handleRes = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

export const api = {
  // ── Generic ────────────────────────────────────────────────────────────────
  get: (path) =>
    fetch(`${BASE}${path}`, { headers: headers() }).then(handleRes),

  post: (path, body) =>
    fetch(`${BASE}${path}`, {
      method: "POST", headers: headers(), body: JSON.stringify(body),
    }).then(handleRes),

  patch: (path, body) =>
    fetch(`${BASE}${path}`, {
      method: "PATCH", headers: headers(), body: JSON.stringify(body),
    }).then(handleRes),

  put: (path, body) =>
    fetch(`${BASE}${path}`, {
      method: "PUT", headers: headers(), body: JSON.stringify(body),
    }).then(handleRes),

  delete: (path) =>
    fetch(`${BASE}${path}`, { method: "DELETE", headers: headers() }).then(handleRes),

  // ── Auth ───────────────────────────────────────────────────────────────────
  login: (body) =>
    fetch(`${BASE}/auth/login`, {
      method: "POST", headers: headers(), body: JSON.stringify(body),
    }).then(handleRes),

  // ── Patient Dashboard ──────────────────────────────────────────────────────
  getDashboard: () =>
    fetch(`${BASE}/patient/dashboard`, { headers: headers() }).then(handleRes),

  getProfile: () =>
    fetch(`${BASE}/patient/profile`, { headers: headers() }).then(handleRes),

  updateProfile: (body) =>
    fetch(`${BASE}/patient/profile`, {
      method: "PUT", headers: headers(), body: JSON.stringify(body),
    }).then(handleRes),

  getMyPrescriptions: () =>
    fetch(`${BASE}/patient/prescriptions`, { headers: headers() }).then(handleRes),

  getMyNotes: () =>
    fetch(`${BASE}/patient/notes`, { headers: headers() }).then(handleRes),

  getMyReports: () =>
    fetch(`${BASE}/patient/reports`, { headers: headers() }).then(handleRes),

  getMyAppointments: () =>
    fetch(`${BASE}/patient/appointments`, { headers: headers() }).then(handleRes),

  bookAppointment: (body) =>
    fetch(`${BASE}/patient/appointments`, {
      method: "POST", headers: headers(), body: JSON.stringify(body),
    }).then(handleRes),

  // ── Patients (Doctor-facing) ───────────────────────────────────────────────
  listPatients: (q = "") =>
    fetch(`${BASE}/doctor/patients?q=${encodeURIComponent(q)}`, {
      headers: headers(),
    }).then(handleRes),

  getPatient: (id) =>
    fetch(`${BASE}/doctor/patients/${id}`, { headers: headers() }).then(handleRes),

  getMyPatients: () =>
    fetch(`${BASE}/doctor/my-patients`, { headers: headers() }).then(handleRes),

  // ── Vitals ─────────────────────────────────────────────────────────────────
  updateVitals: (patientId, vitals) =>
    fetch(`${BASE}/doctor/patients/${patientId}/vitals`, {
      method: "PUT", headers: headers(), body: JSON.stringify(vitals),
    }).then(handleRes),

  // ── Appointments (Doctor-facing) ───────────────────────────────────────────
  getDoctorAppointments: () =>
    fetch(`${BASE}/doctor/appointments`, { headers: headers() }).then(handleRes),

  getTodayAppointments: () =>
    fetch(`${BASE}/doctor/appointments/today`, { headers: headers() }).then(handleRes),

  updateAppointmentStatus: (id, status) =>
    fetch(`${BASE}/doctor/appointments/${id}/status`, {
      method: "PATCH", headers: headers(), body: JSON.stringify({ status }),
    }).then(handleRes),

  // ── Prescriptions (Doctor-facing) ──────────────────────────────────────────
  writePrescription: (body) =>
    fetch(`${BASE}/doctor/prescriptions`, {
      method: "POST", headers: headers(), body: JSON.stringify(body),
    }).then(handleRes),

  getPatientPrescriptions: (patientId) =>
    fetch(`${BASE}/doctor/prescriptions/${patientId}`, {
      headers: headers(),
    }).then(handleRes),

  // ── Clinical Notes (Doctor-facing) ─────────────────────────────────────────
  addNote: (body) =>
    fetch(`${BASE}/doctor/notes`, {
      method: "POST", headers: headers(), body: JSON.stringify(body),
    }).then(handleRes),

  getPatientNotes: (patientId) =>
    fetch(`${BASE}/doctor/notes/${patientId}`, { headers: headers() }).then(handleRes),

  // ── Report Upload (Doctor-facing) ──────────────────────────────────────────
  uploadReport: (formData) =>
    fetch(`${BASE}/doctor/reports`, {
      method: "POST",
      headers: headers(true),
      body: formData,
    }).then(handleRes),

  uploadLabResults: (orderId, formData) =>
    fetch(`${BASE}/lab/orders/${orderId}/results`, {
      method: "PATCH",
      headers: headers(true),
      body: formData,
    }).then(handleRes),
};
