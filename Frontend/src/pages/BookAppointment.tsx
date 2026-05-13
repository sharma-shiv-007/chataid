// Frontend/src/pages/BookAppointment.tsx
import React, { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse, User, Clock, CheckCircle,
  AlertCircle, Loader, ChevronLeft, Stethoscope, CreditCard,
} from "lucide-react";
import { api } from "../api/client";

// ── tokens ────────────────────────────────────────────────────────────────────
const C = {
  cyan: "#06b6d4", cyanBg: "rgba(6,182,212,0.08)", cyanBdr: "rgba(6,182,212,0.22)",
  bg: "#020817", surface: "rgba(12,20,38,0.85)",
  border: "rgba(148,163,184,0.07)", borderMid: "rgba(148,163,184,0.14)",
  text: "#e2e8f0", dim: "#64748b",
  green: "#10b981", greenBg: "rgba(16,185,129,0.08)", greenBdr: "rgba(16,185,129,0.22)",
  red: "#ef4444", redBg: "rgba(239,68,68,0.08)", redBdr: "rgba(239,68,68,0.2)",
};

const card: CSSProperties = {
  background: C.surface, backdropFilter: "blur(20px)",
  border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden",
};

const topBar = (color = C.cyan): CSSProperties => ({
  height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
});

const doctorDisplayName = (name = "") => {
  const cleanName = String(name || "").trim();
  if (!cleanName) return "Doctor";
  return cleanName.toLowerCase().startsWith("dr.") ? cleanName : `Dr. ${cleanName}`;
};

// Slot button states
const slotStyle = (booked: boolean, selected: boolean): CSSProperties => ({
  padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700,
  fontFamily: "inherit", cursor: booked ? "not-allowed" : "pointer",
  border: `1px solid ${booked ? C.borderMid : selected ? C.cyanBdr : C.borderMid}`,
  background: booked ? "rgba(255,255,255,0.02)" : selected ? C.cyanBg : "rgba(255,255,255,0.03)",
  color: booked ? C.dim : selected ? C.cyan : C.text,
  opacity: booked ? 0.5 : 1,
  transition: "all 0.15s",
  position: "relative" as const,
});

// ── Step indicator ────────────────────────────────────────────────────────────
function Steps({ step }: { step: number }) {
  const steps = ["Choose Doctor", "Pick Date", "Select Slot", "Confirm"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: "1.5rem" }}>
      {steps.map((s, i) => {
        const active   = i + 1 === step;
        const done     = i + 1 < step;
        const color    = done ? C.green : active ? C.cyan : C.dim;
        const bg       = done ? C.greenBg : active ? C.cyanBg : "transparent";
        const bdr      = done ? C.greenBdr : active ? C.cyanBdr : C.borderMid;
        return (
          <React.Fragment key={s}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: bg, border: `2px solid ${bdr}`, color, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {done ? <CheckCircle size={14} /> : i + 1}
              </div>
              <p style={{ fontSize: 10, color, fontWeight: active ? 700 : 400, whiteSpace: "nowrap" }}>{s}</p>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? C.green : C.borderMid, margin: "0 4px", marginBottom: 16, transition: "background 0.3s" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BookAppointment() {
  const navigate = useNavigate();

  const [step,      setStep]      = useState(1);
  const [doctors,   setDoctors]   = useState<any[]>([]);
  const [selDoc,    setSelDoc]    = useState<any>(null);
  const [selDate,   setSelDate]   = useState("");
  const [slots,     setSlots]     = useState<{ time: string; booked: boolean }[]>([]);
  const [selSlot,   setSelSlot]   = useState("");
  const [reason,    setReason]    = useState("");
  const [slotsMsg,  setSlotsMsg]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [booking,   setBooking]   = useState(false);
  const [booked,    setBooked]    = useState<any>(null);
  const [error,     setError]     = useState("");

  // Step 1 — load available doctors
  useEffect(() => {
    setLoading(true);
    api.get("/availability/doctors")
      .then(d => setDoctors(d.doctors || []))
      .catch(err => setError(err?.message || "Could not load doctors."))
      .finally(() => setLoading(false));
  }, []);

  // Step 3 — load slots when date changes
  useEffect(() => {
    if (!selDoc || !selDate) return;
    setSlots([]); setSelSlot(""); setSlotsMsg("");
    api.get(`/availability/slots?doctorId=${selDoc._id}&date=${selDate}`)
      .then(d => {
        setSlots(d.slots || []);
        if (!d.slots?.length) setSlotsMsg(d.reason || "No slots available on this date.");
      })
      .catch(err => setSlotsMsg(err?.message || "Could not fetch slots."));
  }, [selDoc, selDate]);

  const handleBook = async () => {
    setBooking(true); setError("");
    try {
      const data = await api.post("/appointments/book", {
        doctorId: selDoc._id, dateKey: selDate, time: selSlot, reason,
      });
      setBooked(data.appointment);
    } catch (err: any) {
      setError(err?.message || "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  const handleProceedToPayment = () => {
    setError("");
    navigate("/payment", {
      state: {
        doctorName: doctorDisplayName(selDoc?.name),
        specialty: selDoc?.specialisation || "General",
        amount: consultationFee,
        appointmentData: {
          doctorId: selDoc?._id,
          dateKey: selDate,
          date: selDate,
          time: selSlot,
          symptoms: reason ? [reason] : [],
          reason,
          appointmentType: "in-person",
          specialty: selDoc?.specialisation || "",
        },
      },
    });
  };

  const minDate = new Date().toISOString().split("T")[0];
  const consultationFee = Number(selDoc?.consultationFee) > 0 ? Number(selDoc.consultationFee) : 500;

  // ── Success screen ────────────────────────────────────────────────────────
  if (booked) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        style={{ ...card, maxWidth: 420, width: "100%", margin: "1rem", textAlign: "center", padding: "2.5rem 2rem" }}>
        <div style={topBar(C.green)} />
        <CheckCircle size={52} color={C.green} style={{ margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 6 }}>Appointment Booked!</h2>
        <p style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>
          {selDate} at {selSlot} with {doctorDisplayName(selDoc?.name)}
        </p>
        <div style={{ background: C.greenBg, border: `1px solid ${C.greenBdr}`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, textAlign: "left" }}>
          <p style={{ fontSize: 12, color: C.text }}><strong>Status:</strong> {booked.status}</p>
          <p style={{ fontSize: 12, color: C.text, marginTop: 4 }}><strong>Ref ID:</strong> {booked._id}</p>
        </div>
        <button onClick={() => navigate("/dashboard")}
          style={{ width: "100%", padding: "10px", borderRadius: 10, background: C.cyanBg, border: `1px solid ${C.cyanBdr}`, color: C.cyan, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Go to Dashboard
        </button>
      </motion.div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, -apple-system, sans-serif", color: C.text }}>
      {/* Navbar */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(2,8,23,0.88)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}`, padding: "0 1.5rem", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
          <ChevronLeft size={16} /> Back
        </button>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: C.cyanBg, border: `1px solid ${C.cyanBdr}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <HeartPulse size={14} color={C.cyan} />
        </div>
        <span style={{ fontWeight: 800, fontSize: 14 }}>Book Appointment</span>
      </nav>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
        <Steps step={step} />

        <AnimatePresence mode="wait">

          {/* ── STEP 1: Choose doctor ─────────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div style={card}>
                <div style={topBar()} />
                <div style={{ padding: "1.25rem" }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 12 }}>
                    Available Doctors
                  </p>
                  {loading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                      <div style={{ width: 32, height: 32, border: `3px solid ${C.cyanBdr}`, borderTopColor: C.cyan, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                    </div>
                  ) : doctors.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2rem", color: C.dim, fontSize: 13 }}>
                      No doctors are currently available.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {doctors.map(doc => (
                        <motion.button key={doc._id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                          onClick={() => { setSelDoc(doc); setStep(2); }}
                          style={{ textAlign: "left", padding: "14px 16px", borderRadius: 12, cursor: "pointer", background: selDoc?._id === doc._id ? C.cyanBg : "rgba(255,255,255,0.02)", border: `1px solid ${selDoc?._id === doc._id ? C.cyanBdr : C.border}`, color: C.text, fontFamily: "inherit", transition: "all 0.15s" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.cyanBg, border: `1px solid ${C.cyanBdr}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <User size={18} color={C.cyan} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{doctorDisplayName(doc.name)}</p>
                              {doc.specialisation && <p style={{ fontSize: 12, color: C.dim, marginTop: 2 }}><Stethoscope size={10} style={{ display: "inline", marginRight: 4 }} />{doc.specialisation}</p>}
                              {doc.hospital && <p style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{doc.hospital}</p>}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              {doc.consultationFee > 0 && <p style={{ fontSize: 13, fontWeight: 700, color: C.cyan }}>₹{doc.consultationFee}</p>}
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
                                {(doc.activeDays || []).slice(0, 3).map((d: string) => (
                                  <span key={d} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 6, background: C.greenBg, border: `1px solid ${C.greenBdr}`, color: C.green, textTransform: "capitalize" as const }}>{d.slice(0,3)}</span>
                                ))}
                                {(doc.activeDays || []).length > 3 && <span style={{ fontSize: 9, color: C.dim }}>+{doc.activeDays.length - 3}</span>}
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Pick date ─────────────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div style={card}>
                <div style={topBar()} />
                <div style={{ padding: "1.25rem" }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>
                    Select Date — {doctorDisplayName(selDoc?.name)}
                  </p>
                  <p style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>
                    Works: {selDoc?.activeDays?.map((d: string) => d.slice(0,3)).join(", ") || "Check schedule"}
                  </p>
                  <input type="date" value={selDate} min={minDate}
                    onChange={e => { setSelDate(e.target.value); setStep(3); }}
                    style={{ width: "100%", boxSizing: "border-box" as const, background: "rgba(10,18,34,0.9)", border: `1px solid ${C.cyanBdr}`, borderRadius: 10, padding: "0.7rem 1rem", color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
                  <p style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>Slots load automatically once you pick a date</p>
                </div>
              </div>
              <NavButtons onBack={() => setStep(1)} />
            </motion.div>
          )}

          {/* ── STEP 3: Select slot ───────────────────────────────────────── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div style={card}>
                <div style={topBar()} />
                <div style={{ padding: "1.25rem" }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>
                    Available Slots — {selDate}
                  </p>
                  <p style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>
                    Greyed out = already booked. Click an open slot to select it.
                  </p>

                  {slots.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2rem", color: C.dim, fontSize: 13 }}>
                      {slotsMsg || "No slots available for this date."}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {slots.map(s => (
                        <button key={s.time} disabled={s.booked}
                          onClick={() => { setSelSlot(s.time); setStep(4); }}
                          style={slotStyle(s.booked, selSlot === s.time)}>
                          <Clock size={11} style={{ display: "inline", marginRight: 4 }} />
                          {formatTime(s.time)}
                          {s.booked && <span style={{ display: "block", fontSize: 9, color: C.dim }}>Booked</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <NavButtons onBack={() => setStep(2)} />
            </motion.div>
          )}

          {/* ── STEP 4: Confirm ───────────────────────────────────────────── */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div style={card}>
                <div style={topBar(C.green)} />
                <div style={{ padding: "1.25rem" }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 16 }}>Confirm Booking</p>

                  {/* Summary */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { label: "Doctor",    value: doctorDisplayName(selDoc?.name) },
                      { label: "Specialty", value: selDoc?.specialisation || "—" },
                      { label: "Date",      value: new Date(`${selDate}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
                      { label: "Time",      value: formatTime(selSlot) },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Reason */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, color: C.dim, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Reason (optional)</label>
                    <textarea value={reason} onChange={e => setReason(e.target.value)}
                      placeholder="e.g. Fever, follow-up, general checkup…" rows={3}
                      style={{ width: "100%", boxSizing: "border-box" as const, background: "rgba(10,18,34,0.9)", border: `1px solid ${C.borderMid}`, borderRadius: 10, padding: "0.6rem 0.85rem", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" as const }} />
                  </div>

                  {error && (
                    <div style={{ background: C.redBg, border: `1px solid ${C.redBdr}`, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: C.red, display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                      <AlertCircle size={13} /> {error}
                    </div>
                  )}

                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleProceedToPayment} disabled={booking}
                    style={{ width: "100%", padding: "12px", borderRadius: 12, background: C.greenBg, border: `1px solid ${C.greenBdr}`, color: C.green, fontSize: 14, fontWeight: 800, cursor: booking ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {booking ? <Loader size={16} style={{ animation: "spin .7s linear infinite" }} /> : <CreditCard size={16} />}
                    {booking ? "Booking..." : `Proceed to Payment - INR ${consultationFee}`}
                  </motion.button>
                </div>
              </div>
              <NavButtons onBack={() => setStep(3)} />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0 }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7) }
      `}</style>
    </div>
  );
}

function NavButtons({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid rgba(148,163,184,0.15)`, color: "#64748b", padding: "8px 14px", borderRadius: 10, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
        <ChevronLeft size={14} /> Back
      </button>
    </div>
  );
}

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
