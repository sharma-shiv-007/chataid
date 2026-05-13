import { useState } from "react";
import { AlertTriangle, Loader, X } from "lucide-react";
import { api } from "../api/client";

interface Props {
  appointmentId: string;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CancelAppointmentModal({ appointmentId, patientName, onClose, onSuccess }: Props) {
  const [remark, setRemark] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCancel = async () => {
    if (!remark.trim()) {
      setError("Please provide a reason for cancellation.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.patch(`/cancellation/doctor-cancel/${appointmentId}`, { remark });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to cancel appointment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.68)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#0a1222", border: "1px solid rgba(148,163,184,0.16)", borderRadius: 18, overflow: "hidden", color: "#e2e8f0" }}>
        <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #ef4444, transparent)" }} />
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(148,163,184,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>Cancel Appointment</h2>
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>Patient: <strong style={{ color: "#e2e8f0" }}>{patientName}</strong></p>
          </div>
          <button onClick={onClose} disabled={loading} style={{ background: "transparent", border: 0, color: "#94a3b8", cursor: loading ? "not-allowed" : "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "1.25rem 1.5rem" }}>
          <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "10px 12px", color: "#f59e0b", fontSize: 12, marginBottom: 14, display: "flex", gap: 8 }}>
            <AlertTriangle size={15} />
            <span>If the patient has paid, admin will be notified for refund or reschedule.</span>
          </div>

          <label style={{ display: "block", color: "#cbd5e1", fontSize: 12, fontWeight: 700, marginBottom: 7 }}>Reason for Cancellation *</label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="e.g. Doctor is unavailable due to emergency leave..."
            rows={5}
            style={{ width: "100%", resize: "vertical", background: "rgba(15,23,42,0.9)", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 12, color: "#e2e8f0", padding: "0.8rem", outline: "none", fontFamily: "inherit", fontSize: 13 }}
          />

          {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 10 }}>{error}</p>}
        </div>

        <div style={{ padding: "0 1.5rem 1.5rem", display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: "11px", borderRadius: 12, background: "transparent", border: "1px solid rgba(148,163,184,0.18)", color: "#94a3b8", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700 }}>
            Go Back
          </button>
          <button onClick={handleCancel} disabled={loading || !remark.trim()} style={{ flex: 1, padding: "11px", borderRadius: 12, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", cursor: loading || !remark.trim() ? "not-allowed" : "pointer", fontWeight: 800, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
            {loading && <Loader size={14} style={{ animation: "spin .7s linear infinite" }} />}
            {loading ? "Cancelling..." : "Confirm Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
