import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const labApi = axios.create({ baseURL: BASE_URL });

labApi.interceptors.request.use(config => {
  const token = localStorage.getItem("medicare_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type LabStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type LabPriority = "Normal" | "Urgent";
export type ResultFlag = "normal" | "low" | "high" | "critical" | "";

export interface LabPerson {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  age?: number;
  gender?: string;
  specialisation?: string;
}

export interface LabResult {
  testName: string;
  value?: string;
  unit?: string;
  normalRange?: string;
  flag?: ResultFlag;
  values?: string;
}

export interface LabOrder {
  _id: string;
  patientId?: LabPerson;
  doctorId?: LabPerson;
  tests: string[];
  department?: string;
  priority: LabPriority;
  status: LabStatus;
  notes?: string;
  results?: LabResult[];
  resultPdfUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface CreateLabOrderInput {
  patientId: string;
  tests: string[];
  priority: LabPriority;
  notes?: string;
}

export interface LabOrderFilters {
  status?: string;
  date?: string;
  department?: string;
}

export interface LabStats {
  total: number;
  pending: number;
  completed: number;
  urgent: number;
}

const queryString = (filters: LabOrderFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export const labService = {
  async createOrder(input: CreateLabOrderInput) {
    const { data } = await labApi.post<{ order: LabOrder }>("/lab/orders", input);
    return data.order;
  },

  async getOrders(filters: LabOrderFilters = {}) {
    const { data } = await labApi.get<{ orders: LabOrder[] }>(`/lab/orders${queryString(filters)}`);
    return data.orders;
  },

  async updateResult(orderId: string, formData: FormData) {
    const { data } = await labApi.patch<{ order: LabOrder }>(`/lab/orders/${orderId}/results`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.order;
  },

  async markComplete(orderId: string) {
    const { data } = await labApi.patch<{ order: LabOrder }>(`/lab/orders/${orderId}/complete`, {});
    return data.order;
  },

  async getReports() {
    const { data } = await labApi.get<{ reports: LabOrder[] }>("/lab/reports");
    return data.reports;
  },

  async getDoctorReports() {
    const { data } = await labApi.get<{ reports: LabOrder[] }>("/lab/doctor/reports");
    return data.reports;
  },

  async getAdminStats(filters: Pick<LabOrderFilters, "date" | "department"> = {}) {
    const { data } = await labApi.get<{ stats: LabStats; departments: string[] }>(`/lab/admin/stats${queryString(filters)}`);
    return data;
  },
};
