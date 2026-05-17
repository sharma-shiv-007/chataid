import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:5000/api";

const ReschedulePage = () => {
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointmentId") || "UNKNOWN";
  const emailFromUrl  = searchParams.get("email") || "";

  const [email,    setEmail]    = useState(emailFromUrl);
  const [date,     setDate]     = useState("");
  const [time,     setTime]     = useState("");
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [slots,    setSlots]    = useState<{ time: string; booked: boolean; past?: boolean }[]>([]);
  const [slotsMsg, setSlotsMsg] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [status,   setStatus]   = useState<"idle" | "loading" | "success" | "error">("idle");

  const today = new Date().toISOString().split("T")[0];

  // Fetch doctorId from the appointment on load
  useEffect(() => {
    if (!appointmentId || appointmentId === "UNKNOWN") return;
    fetch(`${BASE}/appointments/${appointmentId}/public`)
      .then(r => r.json())
      .then(d => { if (d.doctorId) setDoctorId(d.doctorId); })
      .catch(() => {});
  }, [appointmentId]);

  // Fetch real slots whenever date or doctorId changes
  useEffect(() => {
    if (!doctorId || !date) { setSlots([]); setSlotsMsg(""); return; }
    setLoadingSlots(true);
    setSlots([]);
    setTime("");
    setSlotsMsg("");
    fetch(`${BASE}/availability/slots?doctorId=${doctorId}&date=${date}`)
      .then(r => r.json())
      .then(d => {
        const s = d.slots || [];
        setSlots(s);
        if (!s.length) setSlotsMsg(d.reason || "No slots available on this date.");
      })
      .catch(() => setSlotsMsg("Could not load slots. Please try again."))
      .finally(() => setLoadingSlots(false));
  }, [doctorId, date]);

  const handleConfirm = async () => {
    if (!date || !time) { alert("Please select both a date and time."); return; }
    if (!email)         { alert("Please enter your email address."); return; }
    setStatus("loading");
    try {
      const WEBHOOK_URL = "http://localhost:5678/webhook/appointment-action";
      const params = new URLSearchParams({ action: "reschedule-UI", appointmentId, newDate: date, newTime: time, email });
      const res = await fetch(`${WEBHOOK_URL}?${params.toString()}`);
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  const inputClass =
    "w-full bg-slate-700/60 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition";

  // Convert "14:00" → "2:00 PM" for display
  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour   = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
  };

  if (status === "success") return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="bg-slate-800/90 backdrop-blur-xl p-8 rounded-3xl w-full max-w-md shadow-2xl border border-cyan-500/10 text-center">
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
            <span className="text-white">{new Date(date + "T12:00:00").toDateString()}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">New Time</span>
            <span className="text-white">{formatTime(time)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Email</span>
            <span className="text-white">{email}</span>
          </div>
        </div>
        <p className="text-cyan-400 text-xs mt-4 animate-pulse">You may close this window.</p>
      </div>
    </div>
  );

  if (status === "error") return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="bg-slate-800/90 backdrop-blur-xl p-8 rounded-3xl w-full max-w-md shadow-2xl border border-cyan-500/10 text-center">
        <div className="text-5xl mb-4">❌</div>
        <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-gray-400 text-sm mb-6">Please try again or contact support.</p>
        <button onClick={() => setStatus("idle")} className="w-full bg-cyan-600 hover:bg-cyan-500 py-3 rounded-xl text-white font-semibold transition">
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="bg-slate-800/90 backdrop-blur-xl p-8 rounded-3xl w-full max-w-md shadow-2xl border border-cyan-500/10">

        <div className="flex items-center gap-3 mb-6">
          <span style={{ fontSize: 28 }}>📅</span>
          <div>
            <h2 className="text-xl font-bold text-white">Reschedule Appointment</h2>
            <p className="text-gray-400 text-xs font-mono">ID: {appointmentId}</p>
          </div>
        </div>

        <div className="flex flex-col gap-5">

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Your Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" className={inputClass} />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Select New Date *</label>
            <input type="date" min={today} value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
          </div>

          {/* Slots */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Select Time Slot *</label>

            {loadingSlots && (
              <p className="text-cyan-400 text-sm text-center py-3">Loading slots…</p>
            )}

            {!loadingSlots && !date && (
              <p className="text-gray-500 text-sm italic">Select a date first</p>
            )}

            {!loadingSlots && date && slotsMsg && (
              <p className="text-amber-400 text-sm">{slotsMsg}</p>
            )}

            {!loadingSlots && slots.length > 0 && (
              <>
                {/* Legend */}
                <div className="flex gap-4 mb-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-500/30 border border-cyan-500 inline-block"/> Available</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/40 inline-block"/> Past</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-600/50 border border-slate-600 inline-block"/> Booked</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {slots.map(slot => {
                    const isPast   = !!slot.past;
                    const isBooked = slot.booked;
                    const disabled = isPast || isBooked;
                    const selected = time === slot.time;

                    let cls = "py-2 rounded-lg text-xs font-medium border transition text-center ";
                    if (isPast)        cls += "bg-red-500/10 border-red-500/30 text-red-400/60 cursor-not-allowed";
                    else if (isBooked) cls += "bg-slate-700/30 border-slate-600/50 text-gray-500 cursor-not-allowed";
                    else if (selected) cls += "bg-cyan-500 border-cyan-500 text-white";
                    else               cls += "bg-slate-700/50 border-slate-600 text-gray-300 hover:border-cyan-500 hover:text-white cursor-pointer";

                    return (
                      <button key={slot.time} disabled={disabled} onClick={() => !disabled && setTime(slot.time)} className={cls}>
                        {formatTime(slot.time)}
                        {isPast   && <span className="block text-[9px] opacity-60">Past</span>}
                        {isBooked && <span className="block text-[9px] opacity-60">Booked</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {date && time && (
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-4 py-3 text-sm text-cyan-300">
              Rescheduling to <span className="font-semibold">{new Date(date + "T12:00:00").toDateString()}</span> at{" "}
              <span className="font-semibold">{formatTime(time)}</span>
            </div>
          )}

          <button onClick={handleConfirm}
            disabled={status === "loading" || !date || !time || !email}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 py-3 rounded-xl font-bold text-white transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
            {status === "loading" ? "Confirming..." : "Confirm Reschedule"}
          </button>

        </div>
      </div>
    </div>
  );
};

export default ReschedulePage;
