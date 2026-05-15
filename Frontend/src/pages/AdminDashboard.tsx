import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import ThemeToggle from "../components/ThemeToggle";

const SPECIALISATIONS = [
  "General Medicine",
  "General Surgery",
  "Emergency Medicine",
  "Cardiology",
  "Cardiologist",
  "Neurology",
  "Neurologist",
  "Orthopedics",
  "Ortho Surgeon",
  "Trauma Specialist",
  "Pediatrics",
  "Gynecology & Obstetrics",
  "Dermatology",
  "Psychiatry",
  "Pulmonology",
  "Pulmonologist",
  "Gastroenterology",
  "Nephrology",
  "Urology",
  "Oncology",
  "Ophthalmology",
  "ENT (Ear, Nose & Throat)",
  "Radiology",
  "Anesthesiology",
  "Endocrinology",
  "Rheumatology",
  "Hematology",
  "Infectious Disease",
  "Plastic Surgery",
  "Vascular Surgery",
  "Dentistry",
  "Physiotherapy",
  "Dietitian / Nutrition",
  "Other",
] as const;

const emptyDoctorForm = {
  name: "",
  email: "",
  password: "",
  specialisation: "",
  medRegNo: "",
  hospital: "",
  phone: "",
};

const emptyNurseForm = {
  name: "",
  email: "",
  password: "",
  hospital: "",
  phone: "",
};

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
type Day = typeof DAYS[number];

type DayScheduleDraft = {
  active: boolean;
  startTime: string;
  endTime: string;
  slotDurationMins: number;
};

type WeeklyScheduleDraft = Record<Day, DayScheduleDraft>;

const emptySchedule = (): WeeklyScheduleDraft =>
  Object.fromEntries(DAYS.map(day => [day, {
    active: false,
    startTime: "09:00",
    endTime: "17:00",
    slotDurationMins: 30,
  }])) as WeeklyScheduleDraft;

const addMins = (time: string, mins: number) => {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "doctors" | "nurses" | "appointments" | "cancellations" | "leave" | "emergency" | "patients">("overview");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState("");
  const [cancellations, setCancellations] = useState<any[]>([]);
  const [cancellationsLoading, setCancellationsLoading] = useState(false);
  const [cancellationsError, setCancellationsError] = useState("");
  const [doctors, setDoctors] = useState<any[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [doctorForm, setDoctorForm] = useState(emptyDoctorForm);
  const [nurseForm, setNurseForm] = useState(emptyNurseForm);
  const [creatingRole, setCreatingRole] = useState<"" | "doctor" | "nurse">("");
  const [staffSuccess, setStaffSuccess] = useState("");
  const [editDoctor, setEditDoctor] = useState<any>(null);
  const [editDoctorForm, setEditDoctorForm] = useState({ name: "", email: "", specialisation: "", medRegNo: "", hospital: "", phone: "", consultationFee: "" });
  const [editNurse, setEditNurse] = useState<any>(null);
  const [editNurseForm, setEditNurseForm] = useState({ name: "", email: "", hospital: "", phone: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [scheduleDoctor, setScheduleDoctor] = useState<any>(null);
  const [scheduleDraft, setScheduleDraft] = useState<WeeklyScheduleDraft>(() => emptySchedule());
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState("");
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyError, setEmergencyError] = useState("");

  // ── Patients tab ──────────────────────────────────────────────────────────
  const [patients, setPatients]             = useState<any[]>([]);
  const [patientTotal, setPatientTotal]     = useState(0);
  const [patientPage, setPatientPage]       = useState(1);
  const [patientPages, setPatientPages]     = useState(1);
  const [patientQ, setPatientQ]             = useState("");
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError]     = useState("");
  const [expandedPatient, setExpandedPatient] = useState<any | null>(null);
  const [expandedDetail, setExpandedDetail]   = useState<any | null>(null);
  const [detailLoading, setDetailLoading]     = useState(false);
  const [togglingId, setTogglingId]           = useState<string | null>(null);

  const handleLogout = () => { logout(); navigate("/login"); };

  const fetchEmergencies = (showLoading = true) => {
    if (showLoading) setEmergencyLoading(true);
    setEmergencyError("");
    api.get("/emergency/list")
      .then(data => setEmergencies(data.emergencies || []))
      .catch(err => setEmergencyError(err?.message || "Could not load emergencies."))
      .finally(() => { if (showLoading) setEmergencyLoading(false); });
  };

  const dismissEmergency = async (id: string) => {
    setEmergencies(prev => prev.filter(e => e._id !== id));
    try {
      await api.patch(`/appointments/${id}/status`, { status: "acknowledged" });
    } catch {
      // silently ignore — it's already removed from UI
    }
  };

  useEffect(() => {
    fetchEmergencies();
    const timer = window.setInterval(() => fetchEmergencies(false), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchPatients = (q = patientQ, page = patientPage) => {
    setPatientLoading(true);
    setPatientError("");
    api.get(`/admin/patients?q=${encodeURIComponent(q)}&page=${page}&limit=20`)
      .then(d => { setPatients(d.patients || []); setPatientTotal(d.total || 0); setPatientPages(d.pages || 1); })
      .catch(err => setPatientError(err?.message || "Could not load patients."))
      .finally(() => setPatientLoading(false));
  };

  const loadPatientDetail = async (p: any) => {
    if (expandedPatient?._id === p._id) { setExpandedPatient(null); setExpandedDetail(null); return; }
    setExpandedPatient(p);
    setExpandedDetail(null);
    setDetailLoading(true);
    try {
      const d = await api.get(`/admin/patients/${p._id}`);
      setExpandedDetail(d);
    } catch { setExpandedDetail(null); }
    finally { setDetailLoading(false); }
  };

  const toggleDeactivate = async (p: any) => {
    setTogglingId(p._id);
    try {
      const d = await api.patch(`/admin/patients/${p._id}/deactivate`, {});
      setPatients(prev => prev.map(x => x._id === p._id ? { ...x, deactivated: d.deactivated } : x));
      if (expandedPatient?._id === p._id) setExpandedPatient((prev: any) => ({ ...prev, deactivated: d.deactivated }));
    } catch (err: any) { alert(err?.message || "Could not update patient."); }
    finally { setTogglingId(null); }
  };

  useEffect(() => {
    if (activeTab === "patients") fetchPatients(patientQ, 1);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "appointments") return;
    setAppointmentsLoading(true);
    setAppointmentsError("");
    api.get("/admin/appointments")
      .then(data => setAppointments(data.appointments || []))
      .catch(err => setAppointmentsError(err?.message || "Could not load appointments."))
      .finally(() => setAppointmentsLoading(false));
  }, [activeTab]);

  const fetchCancellations = async () => {
    setCancellationsLoading(true);
    setCancellationsError("");
    try {
      const data = await api.get("/cancellation/cancelled");
      setCancellations(data.appointments || []);
    } catch (err: any) {
      setCancellationsError(err?.message || "Could not load cancellations.");
    } finally {
      setCancellationsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "cancellations") fetchCancellations();
  }, [activeTab]);

  const fetchStaff = async () => {
    setStaffLoading(true);
    setStaffError("");
    try {
      const data = await api.get("/nurses");
      setNurses(data.nurses || []);
      setDoctors(data.doctors || []);
    } catch (err: any) {
      setStaffError(err?.message || "Could not load staff.");
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    if (["overview", "doctors", "nurses"].includes(activeTab)) fetchStaff();
  }, [activeTab]);

  const draftFromAvailability = (availability: any): WeeklyScheduleDraft => {
    const next = emptySchedule();
    const weeklySchedule = availability?.weeklySchedule || {};
    for (const day of DAYS) {
      const saved = weeklySchedule[day];
      if (!saved) continue;
      const slots = (saved.slots || []).map((slot: any) => slot.time);
      next[day] = {
        active: Boolean(saved.active),
        startTime: slots[0] || "09:00",
        endTime: slots.length
          ? addMins(slots[slots.length - 1], saved.slotDurationMins || 30)
          : "17:00",
        slotDurationMins: saved.slotDurationMins || 30,
      };
    }
    return next;
  };

  const loadDoctorSchedule = async (doctor: any) => {
    const doctorId = doctor._id || doctor.id;
    setScheduleDoctor(doctor);
    setScheduleMsg("");
    setScheduleLoading(true);
    try {
      const data = await api.get(`/availability/admin/${doctorId}`);
      setScheduleDraft(draftFromAvailability(data.availability));
    } catch (err: any) {
      setScheduleMsg(err?.message || "Could not load doctor schedule.");
      setScheduleDraft(emptySchedule());
    } finally {
      setScheduleLoading(false);
    }
  };

  const updateScheduleDay = (day: Day, field: keyof DayScheduleDraft, value: any) =>
    setScheduleDraft(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));

  const saveDoctorSchedule = async () => {
    if (!scheduleDoctor) return;
    const doctorId = scheduleDoctor._id || scheduleDoctor.id;
    setScheduleSaving(true);
    setScheduleMsg("");
    try {
      await api.put(`/availability/admin/${doctorId}/schedule`, { weeklySchedule: scheduleDraft });
      setScheduleMsg("Schedule saved. Patients will see these slots now.");
      await fetchStaff();
    } catch (err: any) {
      setScheduleMsg(err?.message || "Could not save doctor schedule.");
    } finally {
      setScheduleSaving(false);
    }
  };

  const fetchLeaveRequests = async () => {
    setLeaveLoading(true);
    setLeaveError("");
    try {
      const data = await api.get("/availability/admin/leave-requests");
      setLeaveRequests(data.requests || []);
    } catch (err: any) {
      setLeaveError(err?.message || "Could not load leave requests.");
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "leave" || activeTab === "overview") fetchLeaveRequests();
  }, [activeTab]);

  const reviewLeaveRequest = async (requestId: string, decision: "approved" | "cancelled") => {
    try {
      await api.patch(`/availability/admin/leave-requests/${requestId}`, { decision });
      setLeaveRequests(prev => prev.map(req => req._id === requestId ? { ...req, status: decision } : req));
    } catch (err: any) {
      alert(err?.message || "Could not update leave request.");
    }
  };

  const updateDoctorForm = (field: keyof typeof emptyDoctorForm) =>
    (e: ChangeEvent<HTMLInputElement>) => setDoctorForm(prev => ({ ...prev, [field]: e.target.value }));

  const updateNurseForm = (field: keyof typeof emptyNurseForm) =>
    (e: ChangeEvent<HTMLInputElement>) => setNurseForm(prev => ({ ...prev, [field]: e.target.value }));

  const createDoctor = async () => {
    setStaffError("");
    setStaffSuccess("");
    if (!doctorForm.name.trim() || !doctorForm.email.trim() || !doctorForm.password.trim()) {
      setStaffError("Doctor name, email, and password are required.");
      return;
    }
    setCreatingRole("doctor");
    try {
      await api.post("/auth/signup/doctor", {
        ...doctorForm,
        name: doctorForm.name.trim(),
        email: doctorForm.email.trim(),
        specialisation: doctorForm.specialisation.trim(),
        medRegNo: doctorForm.medRegNo.trim(),
        hospital: doctorForm.hospital.trim(),
        phone: doctorForm.phone.trim(),
      });
      setDoctorForm(emptyDoctorForm);
      setStaffSuccess("Doctor registered successfully.");
      await fetchStaff();
    } catch (err: any) {
      setStaffError(err?.message || "Could not register doctor.");
    } finally {
      setCreatingRole("");
    }
  };

  const createNurse = async () => {
    setStaffError("");
    setStaffSuccess("");
    if (!nurseForm.name.trim() || !nurseForm.email.trim() || !nurseForm.password.trim()) {
      setStaffError("Nurse name, email, and password are required.");
      return;
    }
    setCreatingRole("nurse");
    try {
      await api.post("/auth/signup/nurse", {
        ...nurseForm,
        name: nurseForm.name.trim(),
        email: nurseForm.email.trim(),
        hospital: nurseForm.hospital.trim(),
        phone: nurseForm.phone.trim(),
      });
      setNurseForm(emptyNurseForm);
      setStaffSuccess("Nurse registered successfully.");
      await fetchStaff();
    } catch (err: any) {
      setStaffError(err?.message || "Could not register nurse.");
    } finally {
      setCreatingRole("");
    }
  };

  const assignNurse = async (nurseId: string, doctorId: string) => {
    try {
      const data = await api.patch(`/nurses/${nurseId}/assign`, { doctorId });
      setNurses(prev => prev.map(n => n._id === nurseId ? data.nurse : n));
    } catch (err: any) {
      alert(err?.message || "Could not assign nurse.");
    }
  };

  const openEditDoctor = (d: any) => {
    setEditDoctor(d);
    setEditDoctorForm({ name: d.name || "", email: d.email || "", specialisation: d.specialisation || "", medRegNo: d.medRegNo || "", hospital: d.hospital || "", phone: d.phone || "", consultationFee: String(d.consultationFee || "") });
    setEditError("");
  };

  const saveEditDoctor = async () => {
    if (!editDoctor) return;
    setEditSaving(true); setEditError("");
    try {
      const data = await api.patch(`/doctors/${editDoctor._id || editDoctor.id}`, {
        ...editDoctorForm,
        consultationFee: editDoctorForm.consultationFee ? Number(editDoctorForm.consultationFee) : 0,
      });
      setDoctors(prev => prev.map(d => (d._id || d.id) === (editDoctor._id || editDoctor.id) ? data.doctor : d));
      setEditDoctor(null);
    } catch (err: any) {
      setEditError(err?.message || "Could not update doctor.");
    } finally {
      setEditSaving(false);
    }
  };

  const openEditNurse = (n: any) => {
    setEditNurse(n);
    setEditNurseForm({ name: n.name || "", email: n.email || "", hospital: n.hospital || "", phone: n.phone || "" });
    setEditError("");
  };

  const saveEditNurse = async () => {
    if (!editNurse) return;
    setEditSaving(true); setEditError("");
    try {
      const data = await api.patch(`/nurses/${editNurse._id}`, editNurseForm);
      setNurses(prev => prev.map(n => n._id === editNurse._id ? data.nurse : n));
      setEditNurse(null);
    } catch (err: any) {
      setEditError(err?.message || "Could not update nurse.");
    } finally {
      setEditSaving(false);
    }
  };

  const deleteDoctor = async (id: string, name: string) => {
    if (!confirm(`Delete Dr. ${name}? This cannot be undone. Any nurses assigned to this doctor will be unassigned.`)) return;
    try {
      await api.delete(`/doctors/${id}`);
      setDoctors(prev => prev.filter(d => (d._id || d.id) !== id));
      setNurses(prev => prev.map(n =>
        (n.assignedDoctor?._id || n.assignedDoctor) === id
          ? { ...n, assignedDoctor: null }
          : n
      ));
    } catch (err: any) {
      alert(err?.message || "Could not delete doctor.");
    }
  };

  const deleteNurse = async (id: string, name: string) => {
    if (!confirm(`Delete nurse ${name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/nurses/${id}`);
      setNurses(prev => prev.filter(n => n._id !== id));
    } catch (err: any) {
      alert(err?.message || "Could not delete nurse.");
    }
  };

  const approveRefund = async (id: string) => {
    if (!confirm("Approve refund and credit patient wallet?")) return;
    await api.patch(`/cancellation/admin-refund/${id}`, {});
    fetchCancellations();
  };

  const approveReschedule = async (id: string) => {
    if (!confirm("Approve reschedule?")) return;
    await api.patch(`/cancellation/admin-reschedule/${id}`, {});
    fetchCancellations();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Header */}
      <div className="bg-slate-800/80 backdrop-blur border-b border-slate-700 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-teal-500 rounded-xl flex items-center justify-center text-white font-black flex-shrink-0">H</div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">Healthify AI — Admin</p>
            <p className="text-slate-400 text-xs truncate">{user?.hospitalId?.replace("_", " ").toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ThemeToggle size={14} />
          {emergencies.length > 0 && (
            <button onClick={() => setActiveTab("emergency")}
              className="flex items-center gap-1 bg-red-600/20 border border-red-500/30 text-red-400 px-2 py-1.5 rounded-lg text-xs animate-pulse">
              🚨 <span className="hidden sm:inline">{emergencies.length} Emergency</span><span className="sm:hidden">{emergencies.length}</span>
            </button>
          )}
          <button onClick={handleLogout}
            className="text-sm text-red-400 hover:text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg transition">
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-7">

        <div className="mb-7">
          <h1 className="text-white font-bold text-2xl">Hospital Admin Panel 🏥</h1>
          <p className="text-slate-400 text-sm mt-1">Welcome, {user?.name}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {(["overview", "doctors", "nurses", "patients", "appointments", "cancellations", "leave", "emergency"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition capitalize whitespace-nowrap flex-shrink-0
                ${activeTab === t
                  ? t === "emergency" ? "bg-red-600/20 border-red-500/40 text-red-300"
                    : "bg-teal-600/20 border-teal-500/40 text-teal-300"
                  : "border-slate-700 text-slate-400 hover:text-white"}`}>
              {t === "emergency" ? (
                <span className="flex items-center gap-1.5">
                  🚨 Emergencies
                  {emergencies.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className={`inline-flex h-2 w-2 rounded-full ${emergencies.some((e: any) => e.priority === "CRITICAL") ? "bg-red-400 animate-pulse" : "bg-orange-400"}`} />
                      <span className="text-xs font-bold">{emergencies.length}</span>
                    </span>
                  )}
                </span>
              ) : t === "leave" ? "Leave Requests"
                : t === "patients" ? (
                <span className="flex items-center gap-1.5">
                  👥 Patients
                  {patientTotal > 0 && <span className="text-xs bg-slate-700 text-slate-300 rounded-full px-1.5 py-0.5 font-bold">{patientTotal}</span>}
                </span>
              ) : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-5">

            {/* ── Emergency alert banner ── */}
            {emergencies.length > 0 && (
              <div className={`flex items-center justify-between gap-4 rounded-2xl border p-4
                ${emergencies.some((e: any) => e.priority === "CRITICAL")
                  ? "bg-red-950/40 border-red-500/50"
                  : "bg-orange-950/30 border-orange-500/40"}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl animate-pulse">🚨</span>
                  <div>
                    <p className={`text-sm font-bold ${emergencies.some((e: any) => e.priority === "CRITICAL") ? "text-red-300" : "text-orange-300"}`}>
                      {emergencies.filter((e: any) => e.priority === "CRITICAL").length > 0
                        ? `${emergencies.filter((e: any) => e.priority === "CRITICAL").length} CRITICAL emergency in progress`
                        : `${emergencies.length} active emergency booking${emergencies.length > 1 ? "s" : ""}`}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Latest: {emergencies[0]?.patientName} — {emergencies[0]?.chiefComplaint?.slice(0, 60) || "No complaint recorded"}
                    </p>
                  </div>
                </div>
                <button onClick={() => setActiveTab("emergency")}
                  className="flex-shrink-0 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-bold text-white transition">
                  View All
                </button>
              </div>
            )}

            {/* ── 4 stat cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: "Doctors",
                  value: staffLoading ? "—" : doctors.length,
                  sub: `${nurses.length} nurse${nurses.length !== 1 ? "s" : ""} registered`,
                  icon: "🩺", color: "text-teal-400",
                  action: () => setActiveTab("doctors"),
                },
                {
                  label: "Emergencies (24h)",
                  value: emergencies.length,
                  sub: `${emergencies.filter((e: any) => e.priority === "CRITICAL").length} critical`,
                  icon: "🚨", color: emergencies.length > 0 ? "text-red-400" : "text-slate-400",
                  action: () => setActiveTab("emergency"),
                },
                {
                  label: "Leave Requests",
                  value: leaveLoading ? "—" : leaveRequests.filter((r: any) => r.status === "pending").length,
                  sub: `${leaveRequests.length} total submitted`,
                  icon: "📋", color: "text-yellow-400",
                  action: () => setActiveTab("leave"),
                },
                {
                  label: "Appointments",
                  value: appointments.length || "—",
                  sub: "Click to load today's list",
                  icon: "📅", color: "text-blue-400",
                  action: () => setActiveTab("appointments"),
                },
              ].map(s => (
                <button key={s.label} onClick={s.action}
                  className="text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-2xl p-4 transition group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl">{s.icon}</span>
                    <span className="text-xs text-slate-600 group-hover:text-slate-400 transition">→</span>
                  </div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-white text-xs font-semibold mt-1">{s.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{s.sub}</p>
                </button>
              ))}
            </div>

            {/* ── Quick actions ── */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-white font-bold text-sm mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Lab Admin",       sub: "Tests & pricing",         icon: "🧪", color: "teal",   path: "/lab/admin" },
                  { label: "Lab Dashboard",   sub: "Orders & results",        icon: "📊", color: "blue",   path: "/lab/dashboard" },
                  { label: "Register Doctor", sub: "Add new doctor",          icon: "🩺", color: "purple", tab: "doctors" as const },
                  { label: "Register Nurse",  sub: "Add new nurse",           icon: "👩‍⚕️", color: "pink",   tab: "nurses" as const },
                ].map(a => (
                  <button key={a.label}
                    onClick={() => a.path ? navigate(a.path) : setActiveTab(a.tab!)}
                    className={`text-left rounded-xl border p-3.5 transition
                      ${a.color === "teal"   ? "bg-teal-500/10 border-teal-500/25 hover:bg-teal-500/20"
                      : a.color === "blue"   ? "bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/20"
                      : a.color === "purple" ? "bg-purple-500/10 border-purple-500/25 hover:bg-purple-500/20"
                                             : "bg-pink-500/10 border-pink-500/25 hover:bg-pink-500/20"}`}>
                    <span className="text-lg block mb-2">{a.icon}</span>
                    <p className={`text-xs font-bold
                      ${a.color === "teal" ? "text-teal-300" : a.color === "blue" ? "text-blue-300" : a.color === "purple" ? "text-purple-300" : "text-pink-300"}`}>
                      {a.label}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">{a.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Active emergency preview (top 3 if any) ── */}
            {emergencies.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-bold text-sm">Recent Emergencies</h3>
                  <button onClick={() => setActiveTab("emergency")}
                    className="text-xs text-teal-400 hover:text-teal-300 font-semibold">View all →</button>
                </div>
                <div className="space-y-2">
                  {emergencies.slice(0, 3).map((e: any) => (
                    <div key={e._id} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3
                      ${e.priority === "CRITICAL" ? "border-red-500/30 bg-red-500/8" : "border-orange-500/25 bg-orange-500/5"}`}>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{e.patientName}</p>
                        <p className="text-slate-400 text-xs truncate">{e.chiefComplaint || e.specialty}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-500">
                          {new Date(e.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold border
                          ${e.priority === "CRITICAL" ? "bg-red-600/20 text-red-300 border-red-500/30"
                          : "bg-orange-500/20 text-orange-300 border-orange-500/30"}`}>
                          {e.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Department load ── */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-white font-bold text-sm mb-4">Department Load</h3>
              <div className="space-y-3">
                {[
                  { dept: "Cardiology",  load: 85, color: "bg-red-500",    text: "text-red-400"    },
                  { dept: "Trauma",      load: 60, color: "bg-orange-500", text: "text-orange-400" },
                  { dept: "General OPD", load: 70, color: "bg-teal-500",   text: "text-teal-400"   },
                  { dept: "Pulmonology", load: 45, color: "bg-blue-500",   text: "text-blue-400"   },
                ].map(d => (
                  <div key={d.dept}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-slate-300 text-xs font-medium">{d.dept}</span>
                      <span className={`text-xs font-bold ${d.text}`}>{d.load}%</span>
                    </div>
                    <div className="h-2 bg-slate-700/80 rounded-full overflow-hidden">
                      <div className={`h-2 ${d.color} rounded-full transition-all`} style={{ width: `${d.load}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* DOCTORS */}
        {activeTab === "doctors" && (
          <div className="space-y-3">
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-white font-bold">Register Doctor</h3>
              <p className="text-slate-400 text-xs mt-1 mb-4">Only admins can create doctor accounts.</p>
              <div className="grid md:grid-cols-2 gap-3">
                <input className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Doctor name" value={doctorForm.name} onChange={updateDoctorForm("name")} />
                <input className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Email" type="email" value={doctorForm.email} onChange={updateDoctorForm("email")} />
                <input className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Password" type="password" value={doctorForm.password} onChange={updateDoctorForm("password")} />
                <select className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" value={doctorForm.specialisation} onChange={updateDoctorForm("specialisation")}>
                  <option value="">Select specialisation</option>
                  {SPECIALISATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Medical registration no." value={doctorForm.medRegNo} onChange={updateDoctorForm("medRegNo")} />
                <input className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Hospital" value={doctorForm.hospital} onChange={updateDoctorForm("hospital")} />
                <input className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Phone" value={doctorForm.phone} onChange={updateDoctorForm("phone")} />
              </div>
              <button onClick={createDoctor} disabled={creatingRole === "doctor"} className="mt-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                {creatingRole === "doctor" ? "Registering..." : "Register Doctor"}
              </button>
            </div>

            {staffSuccess && <div className="bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl p-3 text-sm">{staffSuccess}</div>}
            {staffError && <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm">{staffError}</div>}
            {scheduleDoctor && (
              <div className="bg-slate-800/60 border border-teal-500/30 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-white font-bold">Set Schedule for Dr. {scheduleDoctor.name}</h3>
                    <p className="text-slate-400 text-xs mt-1">These slots are shown directly to patients.</p>
                  </div>
                  <button onClick={() => setScheduleDoctor(null)} className="text-slate-400 hover:text-white text-sm">Close</button>
                </div>

                {scheduleLoading ? (
                  <p className="text-slate-400 text-sm">Loading schedule...</p>
                ) : (
                  <div className="space-y-2">
                    <div className="hidden md:grid grid-cols-[110px_70px_1fr_1fr_110px] gap-2 px-2 text-[10px] uppercase tracking-wide text-slate-500 font-bold">
                      <span>Day</span><span>Active</span><span>Start</span><span>End</span><span>Slot</span>
                    </div>
                    {DAYS.map(day => {
                      const d = scheduleDraft[day];
                      return (
                        <div key={day} className={`grid md:grid-cols-[110px_70px_1fr_1fr_110px] gap-2 items-center rounded-xl border p-2 ${d.active ? "bg-teal-500/10 border-teal-500/30" : "bg-slate-900/50 border-slate-700"}`}>
                          <p className="capitalize text-sm font-semibold text-slate-200">{day}</p>
                          <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input type="checkbox" checked={d.active} onChange={e => updateScheduleDay(day, "active", e.target.checked)} />
                            Open
                          </label>
                          <input type="time" disabled={!d.active} value={d.startTime} onChange={e => updateScheduleDay(day, "startTime", e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none disabled:opacity-40" />
                          <input type="time" disabled={!d.active} value={d.endTime} onChange={e => updateScheduleDay(day, "endTime", e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none disabled:opacity-40" />
                          <select disabled={!d.active} value={d.slotDurationMins} onChange={e => updateScheduleDay(day, "slotDurationMins", Number(e.target.value))} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none disabled:opacity-40">
                            {[15, 20, 30, 45, 60].map(min => <option key={min} value={min}>{min} min</option>)}
                          </select>
                        </div>
                      );
                    })}
                    <button onClick={saveDoctorSchedule} disabled={scheduleSaving} className="mt-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                      {scheduleSaving ? "Saving..." : "Save Schedule"}
                    </button>
                    {scheduleMsg && <p className="text-xs text-teal-300 mt-2">{scheduleMsg}</p>}
                  </div>
                )}
              </div>
            )}
            {/* Edit doctor panel */}
            {editDoctor && (
              <div className="bg-slate-800/60 border border-teal-500/30 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-bold">Edit Dr. {editDoctor.name}</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Changes are saved immediately to the database.</p>
                  </div>
                  <button onClick={() => setEditDoctor(null)} className="text-slate-400 hover:text-white text-sm">✕ Close</button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { label: "Full Name",            field: "name",           placeholder: "Dr. Full Name" },
                    { label: "Email",                field: "email",          placeholder: "doctor@hospital.com" },
                    { label: "Med. Reg. No.",        field: "medRegNo",       placeholder: "MCI registration" },
                    { label: "Hospital",             field: "hospital",       placeholder: "Hospital name" },
                    { label: "Phone",                field: "phone",          placeholder: "+91 XXXXX XXXXX" },
                    { label: "Consultation Fee (₹)", field: "consultationFee", placeholder: "e.g. 500" },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label className="block text-xs text-slate-500 mb-1 font-medium">{label}</label>
                      <input
                        value={(editDoctorForm as any)[field]}
                        onChange={e => setEditDoctorForm(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-teal-500 transition-colors"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">Specialisation</label>
                    <select
                      value={editDoctorForm.specialisation}
                      onChange={e => setEditDoctorForm(prev => ({ ...prev, specialisation: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-teal-500 transition-colors"
                    >
                      <option value="">Select specialisation</option>
                      {SPECIALISATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {editError && <p className="mt-3 text-xs text-red-400">{editError}</p>}
                <div className="flex gap-2 mt-4">
                  <button onClick={saveEditDoctor} disabled={editSaving}
                    className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white px-5 py-2 rounded-xl text-sm font-semibold transition">
                    {editSaving ? "Saving…" : "Save Changes"}
                  </button>
                  <button onClick={() => setEditDoctor(null)}
                    className="border border-slate-700 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {staffLoading && <div className="p-5 text-center text-slate-400 text-sm">Loading doctors...</div>}
            {!staffLoading && doctors.length === 0 && <div className="p-8 text-center text-slate-500 text-sm bg-slate-800/60 border border-slate-700 rounded-2xl">No doctors registered yet.</div>}
            {doctors.map(d => (
              <div key={d._id || d.id} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-600/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🩺</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{d.name}</p>
                  <p className="text-slate-400 text-xs">{d.specialisation || "No specialisation"} · {d.email}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{d.hospital || "No hospital listed"}</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-green-500/20 text-green-300 border-green-500/30 flex-shrink-0">
                  Active
                </span>
                <button onClick={() => openEditDoctor(d)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex-shrink-0">
                  Edit
                </button>
                <button onClick={() => loadDoctorSchedule(d)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-teal-500/30 text-teal-300 hover:bg-teal-500/10 flex-shrink-0">
                  Schedule
                </button>
                <button onClick={() => deleteDoctor(d._id || d.id, d.name)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 flex-shrink-0">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* NURSES */}
        {activeTab === "nurses" && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-700">
              <h3 className="text-white font-bold">Nurses</h3>
              <p className="text-slate-400 text-xs mt-1">Register nurses and assign them to a doctor</p>
            </div>

            <div className="p-5 border-b border-slate-700">
              <div className="grid md:grid-cols-2 gap-3">
                <input className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Nurse name" value={nurseForm.name} onChange={updateNurseForm("name")} />
                <input className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Email" type="email" value={nurseForm.email} onChange={updateNurseForm("email")} />
                <input className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Password" type="password" value={nurseForm.password} onChange={updateNurseForm("password")} />
                <input className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Hospital" value={nurseForm.hospital} onChange={updateNurseForm("hospital")} />
                <input className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Phone" value={nurseForm.phone} onChange={updateNurseForm("phone")} />
              </div>
              <button onClick={createNurse} disabled={creatingRole === "nurse"} className="mt-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                {creatingRole === "nurse" ? "Registering..." : "Register Nurse"}
              </button>
              {staffSuccess && <div className="mt-3 bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl p-3 text-sm">{staffSuccess}</div>}
              {staffError && <div className="mt-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm">{staffError}</div>}
            </div>

            {/* Edit nurse panel */}
            {editNurse && (
              <div className="border-t border-slate-700 p-5 bg-slate-900/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-bold">Edit {editNurse.name}</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Update nurse details.</p>
                  </div>
                  <button onClick={() => setEditNurse(null)} className="text-slate-400 hover:text-white text-sm">✕ Close</button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { label: "Full Name", field: "name",     placeholder: "Nurse full name" },
                    { label: "Email",     field: "email",    placeholder: "nurse@hospital.com" },
                    { label: "Hospital",  field: "hospital", placeholder: "Hospital name" },
                    { label: "Phone",     field: "phone",    placeholder: "+91 XXXXX XXXXX" },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label className="block text-xs text-slate-500 mb-1 font-medium">{label}</label>
                      <input
                        value={(editNurseForm as any)[field]}
                        onChange={e => setEditNurseForm(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-teal-500 transition-colors"
                      />
                    </div>
                  ))}
                </div>
                {editError && <p className="mt-3 text-xs text-red-400">{editError}</p>}
                <div className="flex gap-2 mt-4">
                  <button onClick={saveEditNurse} disabled={editSaving}
                    className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white px-5 py-2 rounded-xl text-sm font-semibold transition">
                    {editSaving ? "Saving…" : "Save Changes"}
                  </button>
                  <button onClick={() => setEditNurse(null)}
                    className="border border-slate-700 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {staffLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading nurses...</div>
            ) : staffError ? (
              <div className="p-8 text-center text-red-300 text-sm">{staffError}</div>
            ) : nurses.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No nurses found. Register one above.</div>
            ) : (
              <div className="divide-y divide-slate-700/70">
                {nurses.map(nurse => (
                  <div key={nurse._id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 bg-purple-600/20 rounded-xl flex items-center justify-center text-lg flex-shrink-0">👩‍⚕️</div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm">{nurse.name}</p>
                        <p className="text-slate-400 text-xs">{nurse.email}</p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {nurse.assignedDoctor?.name ? `Assigned to Dr. ${nurse.assignedDoctor.name}` : "Not assigned"}
                        </p>
                      </div>
                    </div>
                    <select
                      value={nurse.assignedDoctor?._id || nurse.assignedDoctor || ""}
                      onChange={e => assignNurse(nurse._id, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none min-w-[220px]"
                    >
                      <option value="">Unassigned</option>
                      {doctors.map(doc => (
                        <option key={doc._id} value={doc._id}>
                          Dr. {doc.name} {doc.specialisation ? `- ${doc.specialisation}` : ""}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => openEditNurse(nurse)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 flex-shrink-0">
                      Edit
                    </button>
                    <button onClick={() => deleteNurse(nurse._id, nurse.name)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 flex-shrink-0">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* APPOINTMENTS */}
        {activeTab === "appointments" && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-700">
              <h3 className="text-white font-bold">Appointments</h3>
              <p className="text-slate-400 text-xs mt-1">Recent bookings and demo payment status</p>
            </div>

            {appointmentsLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading appointments...</div>
            ) : appointmentsError ? (
              <div className="p-8 text-center text-red-300 text-sm">{appointmentsError}</div>
            ) : appointments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No appointments found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/60 text-slate-400">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Patient</th>
                      <th className="text-left px-4 py-3 font-semibold">Doctor</th>
                      <th className="text-left px-4 py-3 font-semibold">Date</th>
                      <th className="text-left px-4 py-3 font-semibold">Status</th>
                      <th className="text-left px-4 py-3 font-semibold">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map(appointment => (
                      <tr key={appointment._id} className="border-t border-slate-700/70">
                        <td className="px-4 py-3 text-white">{appointment.patientName || "Patient"}</td>
                        <td className="px-4 py-3 text-slate-300">
                          {appointment.doctorId?.name || appointment.doctor?.name || appointment.doctorName || "Doctor"}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {appointment.dateKey || new Date(appointment.date).toLocaleDateString("en-IN")} {appointment.time}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-200">
                            {appointment.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            appointment.paymentStatus === "paid"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {appointment.paymentStatus === "paid" ? "Paid" : "Pending"}
                          </span>
                          {appointment.consultationFee > 0 && (
                            <span className="ml-2 text-xs text-slate-400">INR {appointment.consultationFee}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CANCELLATIONS */}
        {activeTab === "cancellations" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white">Cancellations & Refunds</h2>
              <p className="text-slate-400 text-sm mt-1">Doctor cancellations, patient choices, wallet refunds, and reschedules</p>
            </div>

            {cancellationsLoading ? (
              <p className="text-slate-400 p-4">Loading...</p>
            ) : cancellationsError ? (
              <p className="text-red-300 p-4">{cancellationsError}</p>
            ) : cancellations.length === 0 ? (
              <p className="text-slate-400 bg-slate-800/60 border border-slate-700 rounded-2xl p-5">No cancelled appointments pending action</p>
            ) : (
              cancellations.map((apt: any) => {
                const patientName = apt.patientId?.name || apt.patient?.name || apt.patientName || "Patient";
                const doctorName = apt.doctorId?.name || apt.doctor?.name || apt.doctorName || "Doctor";
                return (
                  <div key={apt._id} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
                    <div className="flex justify-between items-start mb-3 gap-4">
                      <div>
                        <p className="text-white font-semibold">{patientName}</p>
                        <p className="text-slate-400 text-sm">Dr. {doctorName} · {apt.dateKey || new Date(apt.date).toLocaleDateString("en-IN")} {apt.time}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        apt.paymentStatus === "paid" || apt.paymentStatus === "refund_requested"
                          ? "bg-green-900/40 text-green-300"
                          : apt.paymentStatus === "refunded"
                            ? "bg-blue-900/40 text-blue-300"
                            : "bg-slate-700 text-slate-300"
                      }`}>
                        {apt.paymentStatus === "refund_requested" ? "Paid" : apt.paymentStatus}
                      </span>
                    </div>

                    <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-3">
                      <p className="text-red-400 text-xs font-semibold mb-1">DOCTOR'S REASON</p>
                      <p className="text-slate-300 text-sm">{apt.cancellationRemark || "No reason provided"}</p>
                    </div>

                    {apt.patientChoice && apt.patientChoice !== "none" ? (
                      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 mb-3">
                        <p className="text-blue-400 text-xs font-semibold mb-1">PATIENT'S CHOICE</p>
                        <p className="text-white text-sm font-semibold">
                          {apt.patientChoice === "refund" ? "Wants Refund" : `Wants Reschedule -> ${apt.rescheduleDate} at ${apt.rescheduleTime}`}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">Waiting for patient to choose refund or reschedule.</p>
                    )}

                    {apt.refundStatus === "requested" && apt.patientChoice !== "none" && (
                      <div className="flex gap-3 mt-3">
                        {apt.patientChoice === "refund" && (
                          <button onClick={() => approveRefund(apt._id)}
                            className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold text-sm">
                            Approve Refund INR {apt.consultationFee || 0}
                          </button>
                        )}
                        {apt.patientChoice === "reschedule" && (
                          <button onClick={() => approveReschedule(apt._id)}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold text-sm">
                            Approve Reschedule
                          </button>
                        )}
                      </div>
                    )}

                    {apt.refundStatus === "approved" && (
                      <p className="text-green-400 text-sm font-semibold mt-2">Refund approved. INR {apt.consultationFee || 0} credited to wallet.</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* LEAVE REQUESTS */}
        {activeTab === "leave" && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-700 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-white font-bold">Doctor Leave Requests</h3>
                <p className="text-slate-400 text-xs mt-1">Reasons submitted from doctor availability dashboards</p>
              </div>
              <button onClick={fetchLeaveRequests} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-teal-500/30 text-teal-300 hover:bg-teal-500/10">
                Refresh
              </button>
            </div>

            {leaveLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading leave requests...</div>
            ) : leaveError ? (
              <div className="p-8 text-center text-red-300 text-sm">{leaveError}</div>
            ) : leaveRequests.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No leave requests yet.</div>
            ) : (
              <div className="divide-y divide-slate-700/70">
                {leaveRequests.map(req => (
                  <div key={req._id} className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div>
                        <p className="text-white font-semibold text-sm">Dr. {req.doctor?.name || "Doctor"}</p>
                        <p className="text-slate-400 text-xs mt-1">
                          {req.doctor?.specialisation || "No specialisation"} - {req.doctor?.email || "No email"}
                        </p>
                        <p className="text-slate-300 text-sm mt-3">{req.reason || "No reason provided."}</p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-teal-300 font-bold text-sm">{req.date}</p>
                        <p className="text-slate-500 text-xs mt-1">{new Date(req.requestedAt).toLocaleString("en-IN")}</p>
                        <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">
                          {req.status || "pending"}
                        </span>
                        {req.status === "pending" && (
                          <div className="flex md:justify-end gap-2 mt-3">
                            <button onClick={() => reviewLeaveRequest(req._id, "approved")} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-green-500/30 text-green-300 hover:bg-green-500/10">
                              Approve
                            </button>
                            <button onClick={() => reviewLeaveRequest(req._id, "cancelled")} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10">
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PATIENTS */}
        {activeTab === "patients" && (
          <div className="space-y-4">
            {/* Search + header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                <input
                  value={patientQ}
                  onChange={e => setPatientQ(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { setPatientPage(1); fetchPatients(patientQ, 1); } }}
                  placeholder="Search by name, email or phone…"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-colors"
                />
              </div>
              <button onClick={() => { setPatientPage(1); fetchPatients(patientQ, 1); }}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors flex-shrink-0">
                Search
              </button>
            </div>
            <p className="text-xs text-slate-500">{patientTotal} patient{patientTotal !== 1 ? "s" : ""} registered</p>

            {patientError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">{patientError}</div>}

            {patientLoading ? (
              <div className="py-16 text-center text-slate-500">Loading patients…</div>
            ) : patients.length === 0 ? (
              <div className="py-16 text-center text-slate-500">No patients found.</div>
            ) : (
              <div className="space-y-2">
                {patients.map(p => {
                  const isExpanded = expandedPatient?._id === p._id;
                  const isDeactivated = !!p.deactivated;
                  return (
                    <div key={p._id} className={`rounded-2xl border transition-colors overflow-hidden ${isDeactivated ? "border-slate-700/50 opacity-60" : "border-slate-700 bg-slate-800/60"}`}>
                      {/* Row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        {/* Avatar */}
                        <div className="h-9 w-9 rounded-xl bg-teal-600/20 flex items-center justify-center text-sm font-bold text-teal-300 flex-shrink-0">
                          {p.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white font-semibold text-sm">{p.name}</p>
                            {isDeactivated && <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/25 rounded-full px-2 py-0.5 font-bold">Deactivated</span>}
                            {p.profileComplete && <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/25 rounded-full px-2 py-0.5">Profile complete</span>}
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5 truncate">{p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
                        </div>
                        {/* Meta */}
                        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
                          {p.age && <span>{p.age}y</span>}
                          {p.gender && <span className="capitalize">{p.gender}</span>}
                          {p.city && <span>{p.city}</span>}
                          <span>{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => loadPatientDetail(p)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-teal-500/30 text-teal-400 hover:bg-teal-500/10 transition-colors">
                            {isExpanded ? "Hide" : "View"}
                          </button>
                          <button onClick={() => toggleDeactivate(p)} disabled={togglingId === p._id}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                              isDeactivated
                                ? "border-green-500/30 text-green-400 hover:bg-green-500/10"
                                : "border-red-500/30 text-red-400 hover:bg-red-500/10"
                            }`}>
                            {togglingId === p._id ? "…" : isDeactivated ? "Reactivate" : "Deactivate"}
                          </button>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t border-slate-700/60 px-4 py-4 bg-slate-900/60">
                          {detailLoading ? (
                            <p className="text-slate-500 text-sm py-4 text-center">Loading details…</p>
                          ) : expandedDetail ? (
                            <div className="space-y-4">
                              {/* Personal info grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                  { label: "Blood Group", value: expandedDetail.patient.blood || "—" },
                                  { label: "Date of Birth", value: expandedDetail.patient.dob || "—" },
                                  { label: "City", value: `${expandedDetail.patient.city || "—"}${expandedDetail.patient.state ? ", " + expandedDetail.patient.state : ""}` },
                                  { label: "Appointments", value: String(expandedDetail.appointmentCount || 0) },
                                ].map(({ label, value }) => (
                                  <div key={label} className="bg-slate-800/60 rounded-xl p-3">
                                    <p className="text-slate-500 text-xs mb-1">{label}</p>
                                    <p className="text-white text-sm font-semibold">{value}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Medical summary */}
                              {(expandedDetail.patient.conditions?.length > 0 || expandedDetail.patient.allergies?.length > 0) && (
                                <div className="grid sm:grid-cols-2 gap-3">
                                  {expandedDetail.patient.conditions?.length > 0 && (
                                    <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3">
                                      <p className="text-red-400 text-xs font-bold mb-2">Conditions</p>
                                      <div className="flex flex-wrap gap-1">
                                        {(expandedDetail.patient.conditions as any[]).map((c: any, i: number) => (
                                          <span key={i} className="bg-red-500/15 text-red-300 text-xs px-2 py-0.5 rounded-full">
                                            {typeof c === "string" ? c : c.name || "Unknown"}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {expandedDetail.patient.allergies?.length > 0 && (
                                    <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl p-3">
                                      <p className="text-orange-400 text-xs font-bold mb-2">Allergies</p>
                                      <div className="flex flex-wrap gap-1">
                                        {(expandedDetail.patient.allergies as any[]).map((a: any, i: number) => (
                                          <span key={i} className="bg-orange-500/15 text-orange-300 text-xs px-2 py-0.5 rounded-full">
                                            {typeof a === "string" ? a : a.name || "Unknown"}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Recent appointments */}
                              {expandedDetail.appointments?.length > 0 && (
                                <div>
                                  <p className="text-slate-400 text-xs font-bold mb-2">Recent Appointments</p>
                                  <div className="space-y-1.5">
                                    {expandedDetail.appointments.map((a: any) => (
                                      <div key={a._id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 text-xs">
                                        <span className="text-slate-300">{a.dateKey} {a.time && `at ${a.time}`}</span>
                                        <span className="text-slate-400">{a.specialty || "General"}</span>
                                        <span className={`font-semibold capitalize ${a.status === "confirmed" ? "text-green-400" : a.status === "cancelled" ? "text-red-400" : "text-yellow-400"}`}>{a.status}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-slate-500 text-sm py-2">Could not load details.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {patientPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button disabled={patientPage <= 1} onClick={() => { setPatientPage(p => p - 1); fetchPatients(patientQ, patientPage - 1); }}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs font-semibold hover:text-white disabled:opacity-40 transition-colors">
                  ← Prev
                </button>
                <span className="text-slate-500 text-xs">Page {patientPage} of {patientPages}</span>
                <button disabled={patientPage >= patientPages} onClick={() => { setPatientPage(p => p + 1); fetchPatients(patientQ, patientPage + 1); }}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs font-semibold hover:text-white disabled:opacity-40 transition-colors">
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* EMERGENCIES */}
        {activeTab === "emergency" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Emergency Bookings</h2>
                <p className="text-xs text-slate-500 mt-0.5">Last 24 hours · auto-refreshes every 30 s</p>
              </div>
              <button onClick={() => fetchEmergencies()}
                className="border border-red-500/30 text-red-300 hover:bg-red-500/10 rounded-xl px-4 py-2 text-sm font-semibold">
                Refresh
              </button>
            </div>

            {emergencyLoading ? (
              <div className="text-center py-20 text-slate-500">Loading emergencies…</div>
            ) : emergencyError ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">{emergencyError}</div>
            ) : emergencies.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-3">🟢</div>
                <p className="text-slate-500">No active emergencies in the last 24 hours</p>
              </div>
            ) : (
              <div className="space-y-4">
                {emergencies.map((e: any) => {
                  const isCritical = e.priority === "CRITICAL";
                  const isHigh = e.priority === "HIGH";
                  const bookedAt = new Date(e.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                  const bookedDate = new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                  return (
                    <div key={e._id}
                      className={`rounded-2xl border-2 p-5 shadow-lg ${
                        isCritical ? "border-red-500/60 bg-red-950/20 shadow-red-900/20"
                        : isHigh    ? "border-orange-500/50 bg-orange-950/20 shadow-orange-900/10"
                                    : "border-yellow-500/40 bg-yellow-950/10"}`}>

                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg
                            ${isCritical ? "bg-red-500/20" : isHigh ? "bg-orange-500/20" : "bg-yellow-500/20"}`}>
                            🚨
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">{e.patientName}</p>
                            <p className="text-slate-500 text-xs mt-0.5">{bookedDate} at {bookedAt}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border
                            ${isCritical ? "bg-red-600/20 text-red-300 border-red-500/30"
                            : isHigh     ? "bg-orange-500/20 text-orange-300 border-orange-500/30"
                                         : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"}`}>
                            {e.priority}
                          </span>
                          <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full font-medium">
                            Score {e.aiSeverityScore}/10
                          </span>
                          <button
                            onClick={() => dismissEmergency(e._id)}
                            title="Mark as read"
                            className="text-xs font-semibold px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                            ✓ Done
                          </button>
                        </div>
                      </div>

                      {/* Chief complaint */}
                      {e.chiefComplaint && (
                        <p className={`text-sm mb-4 px-3 py-2 rounded-lg
                          ${isCritical ? "bg-red-500/10 text-red-200" : isHigh ? "bg-orange-500/10 text-orange-200" : "bg-yellow-500/10 text-yellow-200"}`}>
                          "{e.chiefComplaint}"
                        </p>
                      )}

                      {/* Detail grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                        <div>
                          <p className="text-slate-500 mb-0.5">Phone</p>
                          <a href={`tel:${e.phone}`} className="text-teal-400 hover:underline font-medium">{e.phone || "—"}</a>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-0.5">Age</p>
                          <p className="text-white font-medium">{e.age || "—"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-0.5">Specialty</p>
                          <p className="text-white font-medium">{e.specialty || "—"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-0.5">Status</p>
                          <p className={`font-semibold capitalize ${e.status === "confirmed" ? "text-green-400" : "text-yellow-400"}`}>
                            {e.status}
                          </p>
                        </div>
                        {e.hospitalName && (
                          <div className="col-span-2">
                            <p className="text-slate-500 mb-0.5">Hospital</p>
                            <p className="text-white font-medium">{e.hospitalName}</p>
                            {e.hospitalAddress && <p className="text-slate-400 mt-0.5">{e.hospitalAddress}</p>}
                          </div>
                        )}
                        {e.hospitalPhone && (
                          <div className="col-span-2">
                            <p className="text-slate-500 mb-0.5">Hospital Phone</p>
                            <a href={`tel:${e.hospitalPhone}`} className="text-teal-400 hover:underline font-medium">{e.hospitalPhone}</a>
                          </div>
                        )}
                      </div>

                      {/* Triage note */}
                      {e.notes && (
                        <p className="mt-3 text-xs text-slate-400 border-t border-slate-700/50 pt-3">
                          <span className="text-slate-500 font-medium">Triage: </span>{e.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
