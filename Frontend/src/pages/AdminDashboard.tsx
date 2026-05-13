import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "doctors" | "nurses" | "appointments" | "cancellations" | "emergency">("overview");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState("");
  const [cancellations, setCancellations] = useState<any[]>([]);
  const [cancellationsLoading, setCancellationsLoading] = useState(false);
  const [cancellationsError, setCancellationsError] = useState("");
  const [nurses, setNurses] = useState<any[]>([]);
  const [nurseDoctors, setNurseDoctors] = useState<any[]>([]);
  const [nursesLoading, setNursesLoading] = useState(false);
  const [nursesError, setNursesError] = useState("");

  const handleLogout = () => { logout(); navigate("/login"); };

  const stats = [
    { label: "Total Doctors",      value: "24",  icon: "🩺", color: "text-teal-400",   sub: "8 on duty" },
    { label: "Today's Patients",   value: "143", icon: "👥", color: "text-blue-400",   sub: "+12 vs yesterday" },
    { label: "Emergencies Today",  value: "7",   icon: "🚨", color: "text-red-400",    sub: "3 critical" },
    { label: "Beds Available",     value: "38",  icon: "🛏", color: "text-green-400",  sub: "of 120 total" },
  ];

  const doctors = [
    { id: "DOC001", name: "Dr. Rajiv Sharma",  specialty: "Cardiologist",      status: "on-duty",  patients: 8 },
    { id: "DOC002", name: "Dr. Sunita Raina",  specialty: "Cardiologist",      status: "on-duty",  patients: 6 },
    { id: "DOC003", name: "Dr. Priya Mehta",   specialty: "Trauma Specialist", status: "off-duty", patients: 0 },
    { id: "DOC004", name: "Dr. Vikram Singh",  specialty: "Trauma Specialist", status: "on-duty",  patients: 5 },
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

  const fetchNurses = async () => {
    setNursesLoading(true);
    setNursesError("");
    try {
      const data = await api.get("/nurses");
      setNurses(data.nurses || []);
      setNurseDoctors(data.doctors || []);
    } catch (err: any) {
      setNursesError(err?.message || "Could not load nurses.");
    } finally {
      setNursesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "nurses") fetchNurses();
  }, [activeTab]);

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
          {(["overview", "doctors", "nurses", "appointments", "cancellations", "emergency"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition capitalize
                ${activeTab === t
                  ? t === "emergency" ? "bg-red-600/20 border-red-500/40 text-red-300"
                    : "bg-teal-600/20 border-teal-500/40 text-teal-300"
                  : "border-slate-700 text-slate-400 hover:text-white"}`}>
              {t === "emergency" ? `🚨 Emergencies ${emergencies.length > 0 ? `(${emergencies.length})` : ""}` : t.charAt(0).toUpperCase() + t.slice(1)}
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
            {doctors.map(d => (
              <div key={d.id} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-teal-600/20 rounded-xl flex items-center justify-center text-xl">🩺</div>
                  <div>
                    <p className="text-white font-semibold text-sm">{d.name}</p>
                    <p className="text-slate-400 text-xs">{d.specialty} · ID: {d.id}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{d.patients} patients today</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border
                  ${d.status === "on-duty"
                    ? "bg-green-500/20 text-green-300 border-green-500/30"
                    : "bg-slate-600/20 text-slate-400 border-slate-600/30"}`}>
                  {d.status === "on-duty" ? "● On Duty" : "Off Duty"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* NURSES */}
        {activeTab === "nurses" && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-700">
              <h3 className="text-white font-bold">Nurses</h3>
              <p className="text-slate-400 text-xs mt-1">Assign newly created nurse accounts to a doctor</p>
            </div>

            {nursesLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading nurses...</div>
            ) : nursesError ? (
              <div className="p-8 text-center text-red-300 text-sm">{nursesError}</div>
            ) : nurses.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No nurses found. Create a nurse account from the login page.</div>
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
                      {nurseDoctors.map(doc => (
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
