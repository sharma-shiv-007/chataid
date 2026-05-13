// Frontend/src/pages/AvailabilityTab.tsx
// Drop this file in src/pages/ and import it into DoctorDashboard.tsx
import React, { useEffect, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, XCircle, Plus, Trash2, Loader,
  ToggleLeft, ToggleRight, Calendar, Clock,
} from "lucide-react";
import { api } from "../api/client";

// ── tokens (mirror DoctorDashboard) ──────────────────────────────────────────
const C = {
  cyan:    "#06b6d4", cyanBg: "rgba(6,182,212,0.08)", cyanBdr: "rgba(6,182,212,0.22)",
  bg:      "#020817", surface: "rgba(12,20,38,0.85)",
  border:  "rgba(148,163,184,0.07)", borderMid: "rgba(148,163,184,0.14)",
  text:    "#e2e8f0", dim: "#64748b",
  green:   "#10b981", greenBg: "rgba(16,185,129,0.08)", greenBdr: "rgba(16,185,129,0.22)",
  red:     "#ef4444", redBg: "rgba(239,68,68,0.08)", redBdr: "rgba(239,68,68,0.2)",
  orange:  "#f97316",
};

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
type Day = typeof DAYS[number];

const inp: CSSProperties = {
  background: "rgba(10,18,34,0.9)", border: `1px solid ${C.borderMid}`,
  borderRadius: 8, padding: "0.45rem 0.7rem", color: C.text,
  fontFamily: "inherit", fontSize: 12, outline: "none", width: "100%",
  boxSizing: "border-box",
};

interface DayConfig {
  active: boolean;
  startTime: string;
  endTime: string;
  slotDurationMins: number;
}

type WeeklyDraft = Record<Day, DayConfig>;

const defaultDay = (): DayConfig => ({
  active: false, startTime: "09:00", endTime: "17:00", slotDurationMins: 30,
});

const getTodayKey = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function AvailabilityTab() {
  const [avail,      setAvail]      = useState<any>(null);
  const [draft,      setDraft]      = useState<WeeklyDraft>(() =>
    Object.fromEntries(DAYS.map(d => [d, defaultDay()])) as WeeklyDraft
  );
  const [leaveInput, setLeaveInput] = useState("");
  const [notifyAdmin, setNotifyAdmin] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [toggling,   setToggling]   = useState(false);
  const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null);
  const [loading,    setLoading]    = useState(true);

  // Load existing availability
  useEffect(() => {
    api.get("/availability/me")
      .then(data => {
        setAvail(data.availability);
        if (data.availability?.weeklySchedule) {
          const ws = data.availability.weeklySchedule;
          setDraft(prev => {
            const next = { ...prev };
            for (const day of DAYS) {
              const d = ws[day];
              if (d) {
                // Reconstruct startTime/endTime from first/last slot
                const slots: string[] = (d.slots || []).map((s: any) => s.time);
                next[day] = {
                  active: d.active || false,
                  startTime: slots[0] || "09:00",
                  endTime:   slots.length > 1
                    ? addMins(slots[slots.length - 1], d.slotDurationMins || 30)
                    : "17:00",
                  slotDurationMins: d.slotDurationMins || 30,
                };
              }
            }
            return next;
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function addMins(time: string, mins: number) {
    const [h, m] = time.split(":").map(Number);
    const total  = h * 60 + m + mins;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  // Save weekly schedule
  const saveSchedule = async () => {
    setSaving(true);
    try {
      const data = await api.put("/availability/schedule", { weeklySchedule: draft });
      setAvail(data.availability);
      flash("Schedule saved ✓");
    } catch (err: any) {
      flash(err?.message || "Failed to save.", false);
    } finally {
      setSaving(false);
    }
  };

  // Toggle global availability
  const toggleAvailability = async () => {
    setToggling(true);
    try {
      const data = await api.patch("/availability/toggle", {});
      setAvail((prev: any) => ({ ...prev, isAvailable: data.isAvailable }));
      flash(data.isAvailable ? "You are now Available ✓" : "OPD closed");
    } catch (err: any) {
      flash(err?.message || "Toggle failed.", false);
    } finally {
      setToggling(false);
    }
  };

  // Add leave date
  const addLeave = async () => {
    if (!leaveInput) return;
    if (notifyAdmin && !leaveReason.trim()) {
      flash("Please add a reason for admin.", false);
      return;
    }
    const date = leaveInput;
    try {
      const data = await api.post("/availability/leave", {
        date,
        notifyAdmin,
        reason: leaveReason.trim(),
      });
      setAvail((prev: any) => ({
        ...prev,
        leaves: data.leaves,
        leaveRequests: data.leaveRequests || prev?.leaveRequests || [],
      }));
      setLeaveInput("");
      setNotifyAdmin(false);
      setLeaveReason("");
      flash(date === getTodayKey() ? "Leave added for today. OPD Closed" : `Leave added for ${date} ✓`);
    } catch (err: any) {
      flash(err?.message || "Could not add leave.", false);
    }
  };

  // Remove leave date
  const removeLeave = async (date: string) => {
    try {
      const data = await api.delete(`/availability/leave/${date}`);
      setAvail((prev: any) => ({ ...prev, leaves: data.leaves }));
      flash(`Leave removed ✓`);
    } catch (err: any) {
      flash(err?.message || "Could not remove leave.", false);
    }
  };

  const updateDay = (day: Day, field: keyof DayConfig, value: any) =>
    setDraft(p => ({ ...p, [day]: { ...p[day], [field]: value } }));

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.cyanBdr}`, borderTopColor: C.cyan, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
    </div>
  );

  const isAvailable = avail?.isAvailable ?? true;
  const leaves: string[] = avail?.leaves || [];
  const isOnLeaveToday = leaves.includes(getTodayKey());
  const isOpdOpen = isAvailable && !isOnLeaveToday;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* Flash message */}
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, background: msg.ok ? C.greenBg : C.redBg, border: `1px solid ${msg.ok ? C.greenBdr : C.redBdr}`, color: msg.ok ? C.green : C.red }}>
            {msg.ok ? <CheckCircle size={14} /> : <XCircle size={14} />} {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Global toggle ─────────────────────────────────────────────────── */}
      <div style={{ background: C.surface, backdropFilter: "blur(20px)", border: `1px solid ${isOpdOpen ? C.greenBdr : C.redBdr}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${isOpdOpen ? C.green : C.red}, transparent)` }} />
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Availability Status</p>
            <p style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>
              {isOpdOpen ? "Patients can see and book your slots" : isOnLeaveToday ? "Today is marked as leave - OPD is closed" : "Patients cannot book - you appear offline"}
            </p>
          </div>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={toggleAvailability} disabled={toggling || isOnLeaveToday}
            title={isOnLeaveToday ? "Remove today's leave date to reopen OPD" : undefined}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, cursor: (toggling || isOnLeaveToday) ? "not-allowed" : "pointer", border: `1px solid ${isOpdOpen ? C.greenBdr : C.redBdr}`, background: isOpdOpen ? C.greenBg : C.redBg, color: isOpdOpen ? C.green : C.red, fontSize: 14, fontWeight: 800, fontFamily: "inherit" }}>
            {toggling
              ? <Loader size={16} style={{ animation: "spin .7s linear infinite" }} />
              : isOpdOpen ? <ToggleRight size={22} /> : <ToggleLeft size={22} />
            }
            {isOpdOpen ? "Available" : "OPD Closed"}
          </motion.button>
        </div>
      </div>

      {/* ── Weekly schedule ───────────────────────────────────────────────── */}
      <div style={{ background: C.surface, backdropFilter: "blur(20px)", border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${C.cyan}, transparent)` }} />
        <div style={{ padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Weekly Schedule</p>
              <p style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Set working hours for each day — slots are auto-generated</p>
            </div>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={saveSchedule} disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 10, cursor: saving ? "not-allowed" : "pointer", background: C.cyanBg, border: `1px solid ${C.cyanBdr}`, color: C.cyan, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
              {saving ? <Loader size={13} style={{ animation: "spin .7s linear infinite" }} /> : <CheckCircle size={13} />}
              {saving ? "Saving…" : "Save Schedule"}
            </motion.button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: "110px 60px 1fr 1fr 90px", gap: 8, padding: "0 8px" }}>
              {["Day", "Active", "Start", "End", "Slot (min)"].map(h => (
                <p key={h} style={{ fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" as const }}>{h}</p>
              ))}
            </div>

            {DAYS.map(day => {
              const d = draft[day];
              return (
                <motion.div key={day} layout
                  style={{ display: "grid", gridTemplateColumns: "110px 60px 1fr 1fr 90px", gap: 8, alignItems: "center", padding: "10px 8px", borderRadius: 10, background: d.active ? C.cyanBg : "rgba(255,255,255,0.02)", border: `1px solid ${d.active ? C.cyanBdr : C.border}`, transition: "all 0.2s" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: d.active ? C.text : C.dim, textTransform: "capitalize" as const }}>{day}</p>

                  {/* Toggle */}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button onClick={() => updateDay(day, "active", !d.active)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: d.active ? C.green : C.dim }}>
                      {d.active ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                    </button>
                  </div>

                  {/* Start time */}
                  <input type="time" value={d.startTime} disabled={!d.active}
                    onChange={e => updateDay(day, "startTime", e.target.value)}
                    style={{ ...inp, opacity: d.active ? 1 : 0.4, cursor: d.active ? "auto" : "not-allowed" }} />

                  {/* End time */}
                  <input type="time" value={d.endTime} disabled={!d.active}
                    onChange={e => updateDay(day, "endTime", e.target.value)}
                    style={{ ...inp, opacity: d.active ? 1 : 0.4, cursor: d.active ? "auto" : "not-allowed" }} />

                  {/* Slot duration */}
                  <select value={d.slotDurationMins} disabled={!d.active}
                    onChange={e => updateDay(day, "slotDurationMins", Number(e.target.value))}
                    style={{ ...inp, opacity: d.active ? 1 : 0.4, cursor: d.active ? "pointer" : "not-allowed" }}>
                    {[15, 20, 30, 45, 60].map(m => <option key={m} style={{ background: "#0a1222" }}>{m}</option>)}
                  </select>
                </motion.div>
              );
            })}
          </div>

          {/* Slot preview */}
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
              <Clock size={11} style={{ display: "inline", marginRight: 4 }} /> Slot preview (today's active days)
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {DAYS.filter(d => draft[d].active).length === 0
                ? <p style={{ fontSize: 12, color: C.dim, fontStyle: "italic" }}>No active days set</p>
                : DAYS.filter(d => draft[d].active).map(day => {
                    const d = draft[day];
                    const slots = generatePreviewSlots(d.startTime, d.endTime, d.slotDurationMins);
                    return (
                      <div key={day} style={{ marginBottom: 8, width: "100%" }}>
                        <p style={{ fontSize: 11, color: C.cyan, fontWeight: 700, marginBottom: 5, textTransform: "capitalize" as const }}>{day} — {slots.length} slots</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {slots.map(t => (
                            <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: C.cyanBg, border: `1px solid ${C.cyanBdr}`, color: C.cyan }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── Leave management ──────────────────────────────────────────────── */}
      <div style={{ background: C.surface, backdropFilter: "blur(20px)", border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${C.orange}, transparent)` }} />
        <div style={{ padding: "1.25rem 1.5rem" }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>Leave Dates</p>
          <p style={{ fontSize: 11, color: C.dim, marginBottom: 14 }}>Mark specific dates as leave — patients won't see any slots on these days</p>

          {/* Add leave */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input type="date" value={leaveInput} onChange={e => setLeaveInput(e.target.value)}
              min={getTodayKey()}
              style={{ ...inp, flex: 1 }} />
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={addLeave} disabled={!leaveInput}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, cursor: leaveInput ? "pointer" : "not-allowed", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: C.orange, fontSize: 13, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" }}>
              <Plus size={13} /> Add Leave
            </motion.button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: C.text, fontSize: 12, fontWeight: 700 }}>
            <input type="checkbox" checked={notifyAdmin} onChange={e => setNotifyAdmin(e.target.checked)} />
            Notify admin with reason
          </label>
          {notifyAdmin && (
            <textarea
              value={leaveReason}
              onChange={e => setLeaveReason(e.target.value)}
              placeholder="Reason for leave"
              rows={3}
              style={{ ...inp, resize: "vertical", marginBottom: 14 }}
            />
          )}

          {/* Leave list */}
          {leaves.length === 0 ? (
            <p style={{ fontSize: 12, color: C.dim, fontStyle: "italic" }}>No leave dates added</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[...leaves].sort().map(date => (
                <motion.div key={date} layout
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 10, background: C.redBg, border: `1px solid ${C.redBdr}` }}>
                  <Calendar size={12} color={C.red} />
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>
                    {new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <button onClick={() => removeLeave(date)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.red, padding: 0, display: "flex" }}>
                    <Trash2 size={12} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Preview helper (client-side only, no backend call)
function generatePreviewSlots(start: string, end: string, dur: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endMins = eh * 60 + em;
  while (cur + dur <= endMins) {
    slots.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
    cur += dur;
  }
  return slots;
}
