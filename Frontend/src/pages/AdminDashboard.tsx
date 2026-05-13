import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

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
  const [activeTab, setActiveTab] = useState<"overview" | "doctors" | "nurses" | "appointments" | "cancellations" | "leave" | "emergency">("overview");
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
  const [scheduleDoctor, setScheduleDoctor] = useState<any>(null);
  const [scheduleDraft, setScheduleDraft] = useState<WeeklyScheduleDraft>(() => emptySchedule());
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState("");
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  const handleLogout = () => { logout(); navigate("/login"); };

  const stats = [
    { label: "Total Doctors",      value: "24",  icon: "🩺", color: "text-teal-400",   sub: "8 on duty" },
    { label: "Today's Patients",   value: "143", icon: "👥", color: "text-blue-400",   sub: "+12 vs yesterday" },
    { label: "Emergencies Today",  value: "7",   icon: "🚨", color: "text-red-400",    sub: "3 critical" },
    { label: "Beds Available",     value: "38",  icon: "🛏", color: "text-green-400",  sub: "of 120 total" },
  ];

  const emergencies = JSON.parse(localStorage.getItem("emergency_appointments") ?? "[]");

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
    if (activeTab === "leave") fetchLeaveRequests();
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
      <div className="bg-slate-800/80 backdrop-blur border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-500 rounded-xl flex items-center justify-center text-white font-black">H</div>
          <div>
            <p className="text-white font-semibold text-sm">Healthify AI — Admin</p>
            <p className="text-slate-400 text-xs">{user?.hospitalId?.replace("_", " ").toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {emergencies.length > 0 && (
            <button onClick={() => setActiveTab("emergency")}
              className="flex items-center gap-1.5 bg-red-600/20 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-xs animate-pulse">
              🚨 {emergencies.length} Emergency
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
        <div className="flex gap-2 mb-6">
          {(["overview", "doctors", "nurses", "appointments", "cancellations", "leave", "emergency"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition capitalize
                ${activeTab === t
                  ? t === "emergency" ? "bg-red-600/20 border-red-500/40 text-red-300"
                    : "bg-teal-600/20 border-teal-500/40 text-teal-300"
                  : "border-slate-700 text-slate-400 hover:text-white"}`}>
              {t === "emergency" ? `🚨 Emergencies ${emergencies.length > 0 ? `(${emergencies.length})` : ""}` : t === "leave" ? "Leave Requests" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-7">
              {stats.map(s => (
                <div key={s.label} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{s.icon}</span>
                    <span className={`text-3xl font-bold ${s.color}`}>{s.value}</span>
                  </div>
                  <p className="text-white text-sm font-semibold">{s.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">Department Load</h3>
              {[
                { dept: "Cardiology",   load: 85, color: "bg-red-500" },
                { dept: "Trauma",       load: 60, color: "bg-orange-500" },
                { dept: "Pulmonology",  load: 45, color: "bg-blue-500" },
                { dept: "General OPD",  load: 70, color: "bg-teal-500" },
              ].map(d => (
                <div key={d.dept} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{d.dept}</span>
                    <span className="text-slate-400">{d.load}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full">
                    <div className={`h-1.5 ${d.color} rounded-full`} style={{ width: `${d.load}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </>
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
                <input className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none" placeholder="Specialisation" value={doctorForm.specialisation} onChange={updateDoctorForm("specialisation")} />
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
            {staffLoading && <div className="p-5 text-center text-slate-400 text-sm">Loading doctors...</div>}
            {!staffLoading && doctors.length === 0 && <div className="p-8 text-center text-slate-500 text-sm bg-slate-800/60 border border-slate-700 rounded-2xl">No doctors registered yet.</div>}
            {doctors.map(d => (
              <div key={d._id || d.id} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-teal-600/20 rounded-xl flex items-center justify-center text-xl">🩺</div>
                  <div>
                    <p className="text-white font-semibold text-sm">{d.name}</p>
                    <p className="text-slate-400 text-xs">{d.specialisation || "No specialisation"} - {d.email}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{d.hospital || "No hospital listed"}</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-green-500/20 text-green-300 border-green-500/30">
                  Active
                </span>
                <button onClick={() => loadDoctorSchedule(d)} className="ml-3 text-xs font-semibold px-3 py-1.5 rounded-lg border border-teal-500/30 text-teal-300 hover:bg-teal-500/10">
                  Schedule
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

            {staffLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading nurses...</div>
            ) : staffError ? (
              <div className="p-8 text-center text-red-300 text-sm">{staffError}</div>
            ) : nurses.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No nurses found. Register one above.</div>
            ) : (
              <div className="divide-y divide-slate-700/70">
                {nurses.map(nurse => (
                  <div key={nurse._id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <p className="text-white font-semibold text-sm">{nurse.name}</p>
                      <p className="text-slate-400 text-xs">{nurse.email}</p>
                      <p className="text-slate-500 text-xs mt-1">
                        Assigned: {nurse.assignedDoctor?.name ? `Dr. ${nurse.assignedDoctor.name}` : "Not assigned"}
                      </p>
                    </div>
                    <select
                      value={nurse.assignedDoctor?._id || nurse.assignedDoctor || ""}
                      onChange={e => assignNurse(nurse._id, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none min-w-[240px]"
                    >
                      <option value="">Select doctor</option>
                      {doctors.map(doc => (
                        <option key={doc._id} value={doc._id}>
                          Dr. {doc.name} {doc.specialisation ? `- ${doc.specialisation}` : ""}
                        </option>
                      ))}
                    </select>
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

        {/* EMERGENCIES */}
        {activeTab === "emergency" && (
          <div>
            {emergencies.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-3">🟢</div>
                <p className="text-slate-500">No active emergencies</p>
              </div>
            ) : (
              <div className="space-y-4">
                {emergencies.map((e: any) => (
                  <div key={e.appointmentId}
                    className="bg-slate-800/60 border-2 border-red-500/50 rounded-2xl p-5 shadow-lg shadow-red-900/20">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">🚨</span>
                      <div className="flex-1">
                        <p className="text-white font-bold">{e.patientName}</p>
                        <p className="text-slate-400 text-xs">{e.appointmentId}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border
                        ${e.priority === "CRITICAL"
                          ? "bg-red-600/20 text-red-300 border-red-500/30"
                          : "bg-orange-500/20 text-orange-300 border-orange-500/30"}`}>
                        {e.priority}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-500">Emergency</span><br /><span className="text-white">{e.emergencyLabel}</span></div>
                      <div><span className="text-slate-500">Doctor</span><br /><span className="text-white">{e.doctorName}</span></div>
                      <div><span className="text-slate-500">Hospital</span><br /><span className="text-white">{e.hospitalName}</span></div>
                      <div><span className="text-slate-500">Phone</span><br /><span className="text-white">{e.patientPhone}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
