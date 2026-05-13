import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, FlaskConical, Search, Send } from "lucide-react";
import { api } from "../api/client";
import LabTestCard from "../components/lab/LabTestCard";
import { labService } from "../services/labService";

const LAB_TESTS = [
  "CBC",
  "Blood Sugar",
  "Liver Function",
  "Kidney Function",
  "Lipid Profile",
  "Thyroid Profile",
  "Urine Routine",
  "HbA1c",
  "Electrolytes",
  "CRP",
];

export default function LabOrder() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [priority, setPriority] = useState<"Normal" | "Urgent">("Normal");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api.listPatients(query)
      .then(data => setPatients(data.patients || []))
      .catch(err => setError(err?.message || "Could not load patients."))
      .finally(() => setLoading(false));
  }, [query]);

  const canSubmit = selectedPatient && selectedTests.length > 0 && !submitting;

  const selectedLabel = useMemo(
    () => selectedTests.length ? selectedTests.join(", ") : "No tests selected",
    [selectedTests]
  );

  const toggleTest = (test: string) => {
    setSelectedTests(prev => prev.includes(test) ? prev.filter(item => item !== test) : [...prev, test]);
  };

  const submitOrder = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await labService.createOrder({
        patientId: selectedPatient._id,
        tests: selectedTests,
        priority,
        notes,
      });
      setMessage("Lab order submitted.");
      setSelectedTests([]);
      setNotes("");
      setPriority("Normal");
    } catch (err: any) {
      setError(err?.message || "Could not submit lab order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-5 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-teal-300" />
            <span className="font-bold">Order Lab Test</span>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-5 grid lg:grid-cols-[1fr_380px] gap-5">
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h1 className="text-xl font-bold">Patient</h1>
          <p className="text-sm text-slate-400 mt-1">Search and select a patient for the lab order.</p>

          <div className="mt-4 relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by patient name, email, or phone"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-teal-500"
            />
          </div>

          <div className="mt-4 space-y-2">
            {loading ? (
              <p className="text-sm text-slate-500 p-4">Loading patients...</p>
            ) : patients.length === 0 ? (
              <p className="text-sm text-slate-500 p-4">No patients found.</p>
            ) : patients.map(patient => (
              <button
                key={patient._id}
                onClick={() => setSelectedPatient(patient)}
                className={`w-full text-left border rounded-xl p-4 transition ${
                  selectedPatient?._id === patient._id
                    ? "bg-teal-500/10 border-teal-500/40"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-600"
                }`}
              >
                <p className="font-semibold text-sm text-white">{patient.name}</p>
                <p className="text-xs text-slate-400 mt-1">{patient.email || "No email"} {patient.age ? `- ${patient.age} yrs` : ""}</p>
              </button>
            ))}
          </div>
        </section>

        <aside className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 h-fit">
          <h2 className="text-lg font-bold">Lab Tests</h2>
          <p className="text-xs text-slate-400 mt-1">{selectedLabel}</p>

          <div className="grid grid-cols-2 gap-2 mt-4">
            {LAB_TESTS.map(test => (
              <LabTestCard key={test} name={test} selected={selectedTests.includes(test)} onClick={() => toggleTest(test)} />
            ))}
          </div>

          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mt-5 mb-2">Priority</label>
          <div className="grid grid-cols-2 gap-2">
            {(["Normal", "Urgent"] as const).map(item => (
              <button
                key={item}
                onClick={() => setPriority(item)}
                className={`rounded-xl border px-3 py-2 text-sm font-bold ${
                  priority === item
                    ? item === "Urgent" ? "bg-red-500/10 border-red-500/40 text-red-300" : "bg-teal-500/10 border-teal-500/40 text-teal-300"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mt-5 mb-2">Doctor Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="Clinical context, fasting instructions, suspected diagnosis..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-teal-500 resize-y"
          />

          {error && <p className="mt-3 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">{error}</p>}
          {message && <p className="mt-3 text-sm text-green-300 bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-2"><CheckCircle size={15} />{message}</p>}

          <button
            onClick={submitOrder}
            disabled={!canSubmit}
            className="mt-5 w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-center gap-2"
          >
            <Send size={15} /> {submitting ? "Submitting..." : "Submit Lab Order"}
          </button>
        </aside>
      </main>
    </div>
  );
}
