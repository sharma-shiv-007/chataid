import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, CheckCircle, FlaskConical, LogOut, RefreshCw, Save, Stethoscope, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

const patientFromAppointment = (appointment: any) =>
  appointment.patientId || appointment.patient || {
    _id: appointment.patientId || appointment.patient,
    name: appointment.patientName || "Patient",
  };

export default function NurseDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [assignedDoctor, setAssignedDoctor] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [form, setForm] = useState({ bloodPressure: "", heartRate: "", temperature: "", status: "Normal" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAppointments = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get("/nurses/my-appointments");
      setAssignedDoctor(data.assignedDoctor || null);
      setAppointments(data.appointments || []);
      if (!selectedAppointment && data.appointments?.length) {
        openAppointment(data.appointments[0]);
      }
    } catch (err: any) {
      setError(err?.message || "Could not load appointments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAppointment = (appointment: any) => {
    const patient = patientFromAppointment(appointment);
    setSelectedAppointment(appointment);
    setMessage("");
    setForm({
      bloodPressure: patient?.vitals?.bloodPressure || "",
      heartRate: patient?.vitals?.heartRate ? String(patient.vitals.heartRate) : "",
      temperature: patient?.vitals?.temperature ? String(patient.vitals.temperature) : "",
      status: patient?.vitals?.status || "Normal",
    });
  };

  const saveVitals = async () => {
    const patient = patientFromAppointment(selectedAppointment);
    if (!patient?._id) {
      setError("Patient details are missing for this appointment.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await api.put(`/nurses/patients/${patient._id}/vitals`, form);
      setMessage("Vitals saved and doctor notified.");
      setAppointments(prev => prev.map(appt => {
        const apptPatient = patientFromAppointment(appt);
        if (apptPatient?._id !== patient._id) return appt;
        if (appt.patientId?._id) return { ...appt, patientId: data.patient };
        return { ...appt, patient: data.patient };
      }));
      setSelectedAppointment((prev: any) => {
        if (!prev) return prev;
        if (prev.patientId?._id) return { ...prev, patientId: data.patient };
        return { ...prev, patient: data.patient };
      });
    } catch (err: any) {
      setError(err?.message || "Could not save vitals.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const selectedPatient = selectedAppointment ? patientFromAppointment(selectedAppointment) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-cyan-300 text-sm font-bold">Nurse Dashboard</p>
          <h1 className="text-xl font-bold">{user?.name || "Nurse"}</h1>
        </div>
        <button onClick={handleLogout} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 text-sm font-semibold">
          <LogOut size={15} /> Logout
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-5">
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide">Assigned Doctor</p>
            <h2 className="text-lg font-bold">
              {assignedDoctor ? `Dr. ${assignedDoctor.name}` : "No doctor assigned yet"}
            </h2>
            {assignedDoctor && (
              <p className="text-slate-400 text-sm">{assignedDoctor.specialisation || "General"} · {assignedDoctor.email}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate("/lab/dashboard")} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-teal-500/30 text-teal-300 hover:bg-teal-500/10 text-sm font-semibold">
              <FlaskConical size={15} /> Lab Dashboard
            </button>
            <button onClick={loadAppointments} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 text-sm font-semibold">
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </section>

        {loading ? (
          <div className="text-center text-slate-400 py-20">Loading assigned appointments...</div>
        ) : error && !selectedAppointment ? (
          <div className="text-center text-red-300 py-20">{error}</div>
        ) : !assignedDoctor ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
            Admin has not assigned you to a doctor yet.
          </div>
        ) : appointments.length === 0 ? (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
            No appointments found for this doctor.
          </div>
        ) : (
          <div className="grid lg:grid-cols-[380px_1fr] gap-5">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="font-bold">Doctor Appointments</h3>
                <p className="text-slate-400 text-xs mt-1">Select a patient to check vitals</p>
              </div>
              <div className="max-h-[640px] overflow-y-auto divide-y divide-slate-800">
                {appointments.map(appt => {
                  const patient = patientFromAppointment(appt);
                  const checked = patient?.vitals?.nurseChecked;
                  const active = selectedAppointment?._id === appt._id;
                  return (
                    <button
                      key={appt._id}
                      onClick={() => openAppointment(appt)}
                      className={`w-full text-left p-4 transition ${active ? "bg-cyan-500/10" : "hover:bg-slate-800/60"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm text-white">{patient?.name || appt.patientName || "Patient"}</p>
                          <p className="text-slate-400 text-xs mt-1">{appt.dateKey || new Date(appt.date).toLocaleDateString("en-IN")} at {appt.time}</p>
                          <p className="text-slate-500 text-xs mt-1">{patient?.phone || patient?.email || "No contact"}</p>
                        </div>
                        {checked && (
                          <span className="inline-flex items-center gap-1 text-green-300 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-1 text-xs font-bold">
                            <CheckCircle size={12} /> Checked
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              {selectedPatient ? (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                        <UserRound size={20} className="text-cyan-300" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{selectedPatient.name || "Patient"}</h3>
                        <p className="text-slate-400 text-sm">{selectedPatient.email || selectedPatient.phone || "No contact"}</p>
                      </div>
                    </div>
                    {selectedPatient?.vitals?.nurseChecked && (
                      <span className="inline-flex items-center gap-1 text-green-300 bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1 text-xs font-bold">
                        <CheckCircle size={13} /> Vitals checked
                      </span>
                    )}
                  </div>

                  <div className="grid md:grid-cols-3 gap-3 mb-5">
                    <Info label="Age" value={selectedPatient.age || "-"} />
                    <Info label="Gender" value={selectedPatient.gender || "-"} />
                    <Info label="Status" value={selectedPatient.vitals?.status || "Not checked"} />
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={18} className="text-cyan-300" />
                    <h4 className="font-bold">Update Patient Vitals</h4>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Blood Pressure" value={form.bloodPressure} onChange={value => setForm(prev => ({ ...prev, bloodPressure: value }))} placeholder="120/80" />
                    <Field label="Heart Rate" type="number" value={form.heartRate} onChange={value => setForm(prev => ({ ...prev, heartRate: value }))} placeholder="72" />
                    <Field label="Temperature" type="number" value={form.temperature} onChange={value => setForm(prev => ({ ...prev, temperature: value }))} placeholder="98.6" />
                    <div>
                      <label className="block text-xs uppercase tracking-wide text-slate-500 font-bold mb-2">Status</label>
                      <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 text-slate-100 outline-none">
                        {["Normal", "Stable", "Monitoring", "Critical"].map(status => <option key={status}>{status}</option>)}
                      </select>
                    </div>
                  </div>

                  {error && <p className="text-red-300 text-sm mt-4">{error}</p>}
                  {message && <p className="text-green-300 text-sm mt-4">{message}</p>}

                  <button onClick={saveVitals} disabled={saving} className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold">
                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? "Saving..." : "Save Vitals"}
                  </button>
                </>
              ) : (
                <div className="h-80 flex flex-col items-center justify-center text-slate-500">
                  <Stethoscope size={36} className="mb-3" />
                  Select an appointment to check vitals.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
      <p className="text-slate-500 text-xs uppercase tracking-wide font-bold">{label}</p>
      <p className="text-slate-100 font-semibold mt-1">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wide text-slate-500 font-bold mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-3 text-slate-100 placeholder:text-slate-600 outline-none"
      />
    </div>
  );
}
