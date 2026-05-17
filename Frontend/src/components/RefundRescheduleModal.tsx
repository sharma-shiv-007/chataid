import { useState } from "react";
import { Calendar, Loader, WalletCards, X } from "lucide-react";
import { api } from "../api/client";

interface Props {
  appointment: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RefundRescheduleModal({ appointment, onClose, onSuccess }: Props) {
  const [choice, setChoice] = useState<"refund" | "reschedule" | "">("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const doctorName = appointment.doctorId?.name || appointment.doctor?.name || appointment.doctorName || "Doctor";
  const fee = Number(appointment.consultationFee) || 0;

  const handleSubmit = async () => {
    if (!choice) {
      setError("Please select an option.");
      return;
    }
    if (choice === "reschedule" && (!rescheduleDate || !rescheduleTime)) {
      setError("Please select new date and time.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.patch(`/cancellation/patient-choice/${appointment._id}`, {
        choice,
        rescheduleDate,
        rescheduleTime,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to submit choice.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.68)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 460, background: "#0a1222", border: "1px solid rgba(148,163,184,0.16)", borderRadius: 18, overflow: "hidden", color: "#e2e8f0" }}>
        <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #06b6d4, transparent)" }} />
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(148,163,184,0.08)", display: "flex", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Appointment Cancelled</h2>
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>Your appointment with Dr. {doctorName} was cancelled.</p>
          </div>
          <button onClick={onClose} disabled={loading} style={{ background: "transparent", border: 0, color: "#94a3b8", cursor: loading ? "not-allowed" : "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "1.25rem 1.5rem" }}>
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <p style={{ color: "#ef4444", fontSize: 11, fontWeight: 800, marginBottom: 4 }}>REASON FROM DOCTOR</p>
            <p style={{ color: "#cbd5e1", fontSize: 13 }}>{appointment.cancellationRemark || "No reason provided"}</p>
          </div>

          <p style={{ fontWeight: 800, marginBottom: 10 }}>What would you like to do?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ChoiceButton selected={choice === "refund"} color="#10b981" icon={<WalletCards size={20} />} title="Get Refund" subtitle={`INR ${fee} will be credited after 24 hours once admin approves`} onClick={() => setChoice("refund")} />
            <ChoiceButton selected={choice === "reschedule"} color="#06b6d4" icon={<Calendar size={20} />} title="Reschedule" subtitle="Pick a new date and time" onClick={() => setChoice("reschedule")} />
          </div>

          {choice === "refund" && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <p style={{ color: "#10b981", fontSize: 12, fontWeight: 800 }}>Refund request will be sent to admin.</p>
              <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>After admin approval, the amount will be credited to your wallet within 24 hours.</p>
            </div>
          )}

          {choice === "reschedule" && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(15,23,42,0.75)", border: "1px solid rgba(148,163,184,0.12)", display: "grid", gap: 10 }}>
              <input type="date" value={rescheduleDate} min={new Date().toISOString().split("T")[0]} onChange={(e) => setRescheduleDate(e.target.value)} style={fieldStyle} />
              <input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} style={fieldStyle} />
            </div>
          )}

          {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 10 }}>{error}</p>}
        </div>

        <div style={{ padding: "0 1.5rem 1.5rem", display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: "11px", borderRadius: 12, background: "transparent", border: "1px solid rgba(148,163,184,0.18)", color: "#94a3b8", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700 }}>
            Later
          </button>
          <button onClick={handleSubmit} disabled={loading || !choice} style={{ flex: 1, padding: "11px", borderRadius: 12, background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.28)", color: "#06b6d4", cursor: loading || !choice ? "not-allowed" : "pointer", fontWeight: 800, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
            {loading && <Loader size={14} style={{ animation: "spin .7s linear infinite" }} />}
            {loading ? "Submitting..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChoiceButton({ selected, color, icon, title, subtitle, onClick }: any) {
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: 14, borderRadius: 12, border: `2px solid ${selected ? color : "rgba(148,163,184,0.14)"}`, background: selected ? `${color}18` : "rgba(15,23,42,0.75)", color: "#e2e8f0", cursor: "pointer" }}>
      <span style={{ color }}>{icon}</span>
      <span>
        <span style={{ display: "block", fontWeight: 800 }}>{title}</span>
        <span style={{ display: "block", color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{subtitle}</span>
      </span>
    </button>
  );
}

const fieldStyle = {
  width: "100%",
  background: "rgba(2,8,23,0.9)",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 10,
  color: "#e2e8f0",
  padding: "0.65rem",
  outline: "none",
} as const;
