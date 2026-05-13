import { useState } from "react";
import { useSearchParams } from "react-router-dom";

const ReschedulePage = () => {
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointmentId") || "UNKNOWN";
  const emailFromUrl = searchParams.get("email") || "";  // ← get email from URL too

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [email, setEmail] = useState(emailFromUrl);      // ← email state
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const timeSlots = [
    "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM", "12:00 PM", "02:00 PM",
    "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM",
  ];

  const today = new Date().toISOString().split("T")[0];

  const handleConfirm = async () => {
  if (!date || !time) {
    alert("Please select both a date and time.");
    return;
  }
  if (!email) {
    alert("Please enter your email address.");
    return;
  }

  setStatus("loading");

  try {
    const WEBHOOK_URL = "http://localhost:5678/webhook/appointment-action";

    const params = new URLSearchParams({
      action: "reschedule-UI",
      appointmentId,
      newDate: date,
      newTime: time,
      email,
    });

    const res = await fetch(`${WEBHOOK_URL}?${params.toString()}`);

    if (res.ok) {
      setStatus("success");
    } else {
      setStatus("error");
    }
  } catch {
    setStatus("error");
  }
};

  const inputClass =
    "w-full bg-slate-700/60 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="bg-slate-800/90 backdrop-blur-xl p-8 rounded-3xl w-full max-w-md shadow-2xl border border-cyan-500/10">

        {status === "success" ? (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">Appointment Rescheduled!</h2>
            <p className="text-gray-400 text-sm mb-4">A confirmation email has been sent to you.</p>
            <div className="bg-slate-700/50 rounded-2xl p-4 text-left border border-slate-600 text-sm">
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Appointment ID</span>
                <span className="text-white font-mono">{appointmentId}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">New Date</span>
                <span className="text-white">{new Date(date).toDateString()}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">New Time</span>
                <span className="text-white">{time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email</span>
                <span className="text-white">{email}</span>
              </div>
            </div>
            <p className="text-cyan-400 text-xs mt-4 animate-pulse">You may close this window.</p>
          </div>

        ) : status === "error" ? (
          <div className="text-center">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 text-sm mb-6">Please try again or contact support.</p>
            <button
              onClick={() => setStatus("idle")}
              className="w-full bg-cyan-600 hover:bg-cyan-500 py-3 rounded-xl text-white font-semibold transition"
            >
              Try Again
            </button>
          </div>

        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <span style={{ fontSize: 28 }}>📅</span>
              <div>
                <h2 className="text-xl font-bold text-white">Reschedule Appointment</h2>
                <p className="text-gray-400 text-xs font-mono">ID: {appointmentId}</p>
              </div>
            </div>

            <div className="flex flex-col gap-5">

              {/* Email — auto-filled if passed in URL, editable if not */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Your Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Select New Date *</label>
                <input
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Time Slot *</label>
                <div className="grid grid-cols-3 gap-2">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setTime(slot)}
                      className={`py-2 rounded-lg text-xs font-medium border transition ${
                        time === slot
                          ? "bg-cyan-500 border-cyan-500 text-white"
                          : "bg-slate-700/50 border-slate-600 text-gray-300 hover:border-cyan-500 hover:text-white"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {date && time && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-4 py-3 text-sm text-cyan-300">
                  Rescheduling to <span className="font-semibold">{new Date(date).toDateString()}</span> at{" "}
                  <span className="font-semibold">{time}</span>
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={status === "loading" || !date || !time || !email}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 py-3 rounded-xl font-bold text-white transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {status === "loading" ? "Confirming..." : "Confirm Reschedule"}
              </button>

            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReschedulePage;