// Frontend/src/pages/PatientDashboard.tsx  ── complete drop-in replacement
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse, Activity, Thermometer, Heart, User, FlaskConical,
  Pill, Shield, Zap, LogOut, AlertCircle, Clock, Droplets,
  Phone, MapPin, Calendar, Stethoscope, Edit2, Check, X,
  Lock, ChevronRight, AlertTriangle, Mic, FileText, Upload,
  Bell, ClipboardList, CreditCard,
  WalletCards,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import RefundRescheduleModal from "../components/RefundRescheduleModal";
import { labService, type LabOrder } from "../services/labService";

// ─── Design tokens ─────────────────────────────────────────────────────────
const CYAN     = "#06b6d4";
const CYAN_BG  = "rgba(6,182,212,0.1)";
const CYAN_BDR = "rgba(6,182,212,0.25)";
const BG       = "#020817";
const SURFACE  = "rgba(15,23,42,0.7)";
const BORDER   = "rgba(148,163,184,0.08)";
const TEXT      = "#e2e8f0";
const TEXT_DIM  = "#64748b";
const GREEN     = "#10b981";
const RED       = "#ef4444";
const VIOLET    = "#8b5cf6";
const ORANGE    = "#f97316";
const AMBER     = "#f59e0b";

const card = {
  background: SURFACE,
  backdropFilter: "blur(20px)" as const,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  overflow: "hidden" as const,
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

// ─── Shared small components ────────────────────────────────────────────────
type PatientTab = "overview" | "prescriptions" | "notes" | "reports" | "appointments";

const notificationTabId = (notification: any): PatientTab | null => {
  switch (notification?.type) {
    case "prescription_issued":
      return "prescriptions";
    case "clinical_note_added":
      return "notes";
    case "report_uploaded":
    case "lab_result_ready":
      return "reports";
    case "appt_booked":
    case "appt_confirmed":
    case "appt_cancelled":
    case "appt_completed":
    case "cancellation":
    case "reschedule":
      return "appointments";
    case "vitals_updated":
      return "overview";
    default:
      return null;
  }
};

const sortAppointmentsNewestFirst = (items: any[]) =>
  [...(items || [])].sort((a, b) => {
    const createdDelta = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    if (createdDelta) return createdDelta;
    const dateDelta = new Date(b.date || b.dateKey || 0).getTime() - new Date(a.date || a.dateKey || 0).getTime();
    if (dateDelta) return dateDelta;
    return String(b.time || "").localeCompare(String(a.time || ""));
  });

const formatDoctorName = (name: string) => {
  if (!name || name === "Unknown") return "Unknown";
  return name.trim().toLowerCase().startsWith("dr.") ? name.trim() : `Dr. ${name.trim()}`;
};

const Tag = ({ label, color = CYAN }: { label: string; color?: string }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${color}18`, border: `1px solid ${color}30`, color }}>
    {label}
  </span>
);

const DoctorBadge = () => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: VIOLET, letterSpacing: 0.3 }}>
    <Lock size={9} /> Doctor only
  </span>
);

const SectionHeader = ({ icon: Icon, title, color = CYAN, onEdit, editing, badge }: {
  icon: React.ElementType; title: string; color?: string;
  onEdit?: () => void; editing?: boolean; badge?: React.ReactNode;
}) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${BORDER}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={14} color={color} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{title}</span>
      {badge}
    </div>
    {onEdit && (
      <button onClick={onEdit} style={{ display: "flex", alignItems: "center", gap: 5, background: editing ? CYAN_BG : "transparent", border: `1px solid ${editing ? CYAN_BDR : "rgba(148,163,184,0.15)"}`, color: editing ? CYAN : TEXT_DIM, padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
        <Edit2 size={10} /> {editing ? "Editing" : "Edit"}
      </button>
    )}
  </div>
);

const VitalBox = ({ icon: Icon, label, value, unit, critical }: {
  icon: React.ElementType; label: string; value?: string | number | null; unit?: string; critical?: boolean;
}) => (
  <div style={{ background: critical ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${critical ? "rgba(239,68,68,0.2)" : BORDER}`, borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
    <Icon size={18} color={critical ? RED : CYAN} style={{ marginBottom: 6 }} />
    <div style={{ fontSize: 20, fontWeight: 800, color: critical ? RED : TEXT, lineHeight: 1 }}>
      {value ?? "—"}{unit && value && <span style={{ fontSize: 10, fontWeight: 400, color: TEXT_DIM, marginLeft: 2 }}>{unit}</span>}
    </div>
    <div style={{ fontSize: 10, color: TEXT_DIM, marginTop: 4, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</div>
  </div>
);

// ─── Editable field ─────────────────────────────────────────────────────────
function EditableRow({ label, icon: Icon, value, field, editing, draft, onChange }: {
  label: string; icon: React.ElementType; value?: string; field: string;
  editing: boolean; draft: Record<string, string>; onChange: (f: string, v: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={13} color={CYAN} />
      </div>
      <span style={{ fontSize: 11, color: TEXT_DIM, width: 90, flexShrink: 0, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</span>
      {editing ? (
        <input
          value={draft[field] ?? value ?? ""}
          onChange={e => onChange(field, e.target.value)}
          style={{ flex: 1, background: "rgba(6,182,212,0.05)", border: `1px solid ${CYAN_BDR}`, borderRadius: 8, padding: "4px 10px", color: TEXT, fontSize: 13, outline: "none" }}
        />
      ) : (
        <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{value || "—"}</span>
      )}
    </div>
  );
}

function LockedRow({ label, icon: Icon, value }: { label: string; icon: React.ElementType; value?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${BORDER}`, opacity: 0.85 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={13} color={VIOLET} />
      </div>
      <span style={{ fontSize: 11, color: TEXT_DIM, width: 90, flexShrink: 0, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 13, color: TEXT, fontWeight: 500, flex: 1 }}>{value || "—"}</span>
      <Lock size={11} color={VIOLET} style={{ flexShrink: 0 }} />
    </div>
  );
}

// ─── Prescription Card ──────────────────────────────────────────────────────
function PrescriptionCard({ rx }: { rx: any }) {
  const medications = Array.isArray(rx.medications)
    ? rx.medications.filter((med: any) => med?.name)
    : [];
  const hasMultipleMedicineFormat = medications.length > 0;

  return (
    <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
          {hasMultipleMedicineFormat ? `${medications.length} medicine${medications.length === 1 ? "" : "s"}` : rx.drugName}
        </span>
        <span style={{ fontSize: 10, color: TEXT_DIM }}>{new Date(rx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>

      {!hasMultipleMedicineFormat && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
            {rx.dose && <Tag label={rx.dose} color={VIOLET} />}
            {rx.frequency && <Tag label={rx.frequency} color={CYAN} />}
            {rx.duration && <Tag label={rx.duration} color={ORANGE} />}
          </div>
          {rx.instructions && (
            <p style={{ fontSize: 12, color: TEXT_DIM, fontStyle: "italic", marginTop: 4 }}>{rx.instructions}</p>
          )}
        </>
      )}

      {hasMultipleMedicineFormat && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
          {medications.map((med: any, medIndex: number) => (
            <div key={`${med.name}-${medIndex}`} style={{ borderTop: medIndex ? "1px solid rgba(139,92,246,0.18)" : "none", paddingTop: medIndex ? 7 : 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{med.name}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                {med.dose && <Tag label={med.dose} color={VIOLET} />}
                {med.frequency && <Tag label={med.frequency} color={CYAN} />}
                {med.duration && <Tag label={med.duration} color={ORANGE} />}
              </div>
              {med.instructions && (
                <p style={{ fontSize: 12, color: TEXT_DIM, fontStyle: "italic", marginTop: 4 }}>{med.instructions}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {(rx.followUpRemark || rx.advice) && (
        <p style={{ fontSize: 12, color: VIOLET, fontWeight: 700, marginTop: 8 }}>
          Follow-up: {rx.followUpRemark || rx.advice}
        </p>
      )}
      <p style={{ fontSize: 11, color: TEXT_DIM, marginTop: 6 }}>
        <Stethoscope size={10} style={{ display: "inline", marginRight: 4 }} />
        Dr. {rx.doctorId?.name || "Unknown"}{rx.doctorId?.specialization ? ` · ${rx.doctorId.specialization}` : ""}
      </p>
    </div>
  );
}

// ─── Note Card ──────────────────────────────────────────────────────────────
function NoteCard({ note }: { note: any }) {
  return (
    <div style={{ background: "rgba(6,182,212,0.04)", border: `1px solid ${CYAN_BDR}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: CYAN, fontWeight: 700 }}>
          <Stethoscope size={10} style={{ display: "inline", marginRight: 4 }} />
          Dr. {note.doctorId?.name || "Unknown"}
        </span>
        <span style={{ fontSize: 10, color: TEXT_DIM }}>{new Date(note.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>
      <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{note.note}</p>
    </div>
  );
}

// ─── Report Card ─────────────────────────────────────────────────────────────
function ReportCard({ report }: { report: any }) {
  return (
    <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <FileText size={16} color={GREEN} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 2 }}>{report.label || report.originalName || "Report"}</p>
        <p style={{ fontSize: 11, color: TEXT_DIM }}>
          {new Date(report.uploadedAt || report.createdAt || Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          {report.doctorName ? ` · Dr. ${report.doctorName}` : ""}
        </p>
      </div>
      {report.url && (
        <a href={report.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: CYAN, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
          View ↗
        </a>
      )}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "2rem 0" }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
        <Icon size={18} color={TEXT_DIM} />
      </div>
      <p style={{ color: TEXT_DIM, fontSize: 13 }}>{message}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function WalletCard({ wallet }: { wallet: any }) {
  const transactions = wallet?.transactions || [];
  return (
    <motion.div {...fadeUp(0.03)} style={{ ...card, marginBottom: "1rem" }}>
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)` }} />
      <div style={{ padding: "1.25rem" }}>
        <SectionHeader icon={WalletCards} title="My Wallet" color={GREEN} />
        <p style={{ fontSize: 32, fontWeight: 900, color: GREEN, marginBottom: 12 }}>INR {wallet?.balance || 0}</p>
        {transactions.length === 0 ? (
          <p style={{ color: TEXT_DIM, fontSize: 12 }}>No wallet transactions yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {transactions.slice(-5).reverse().map((t: any, i: number) => (
              <div key={t._id || i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
                <span style={{ color: TEXT_DIM }}>{t.description}</span>
                <span style={{ color: t.type === "credit" ? GREEN : RED, fontWeight: 800 }}>
                  {t.type === "credit" ? "+" : "-"}INR {t.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function LabBillsCard({ bills, onPay }: { bills: LabOrder[]; onPay: (bill: LabOrder, method: "online" | "cash") => void }) {
  const recentBills = bills.slice(0, 5);
  const [payingBill, setPayingBill] = useState<LabOrder | null>(null);

  return (
    <>
      <motion.div {...fadeUp(0.04)} style={{ ...card, marginBottom: "1rem" }}>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)` }} />
        <div style={{ padding: "1.25rem" }}>
          <SectionHeader icon={FlaskConical} title="Lab Bills" color={CYAN} />
          {recentBills.length === 0 ? (
            <p style={{ color: TEXT_DIM, fontSize: 12 }}>No lab bills yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recentBills.map(bill => {
                const paid = bill.paymentStatus === "paid_online" || bill.paymentStatus === "cash_paid";
                return (
                  <div key={bill._id} style={{ background: "rgba(6,182,212,0.05)", border: `1px solid ${paid ? "rgba(16,185,129,0.22)" : CYAN_BDR}`, borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>{bill.tests.join(", ")}</p>
                        <p style={{ fontSize: 11, color: TEXT_DIM, marginTop: 3 }}>Dr. {bill.doctorId?.name || "Doctor"}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 18, color: paid ? GREEN : CYAN, fontWeight: 900 }}>₹{bill.billAmount || 0}</p>
                        <p style={{ fontSize: 10, color: paid ? GREEN : "#f59e0b", fontWeight: 800, textTransform: "uppercase" }}>
                          {bill.paymentStatus === "paid_online" ? "Paid online" : bill.paymentStatus === "cash_paid" ? "Cash paid" : "Unpaid"}
                        </p>
                      </div>
                    </div>
                    {bill.billItems?.length ? (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {bill.billItems.map(item => (
                          <div key={item.testName} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, color: TEXT_DIM }}>
                            <span>{item.testName}</span><span>₹{item.price}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {!paid && (
                      <button onClick={() => setPayingBill(bill)}
                        style={{ marginTop: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(37,99,235,0.18)", border: "1px solid rgba(96,165,250,0.35)", color: "#60a5fa", padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                        <CreditCard size={13} /> Pay ₹{bill.billAmount} Now
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Inline payment modal ── */}
      {payingBill && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 400, background: "#0f172a", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 20, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
            {/* Modal header */}
            <div style={{ background: "#1e3a5f", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ color: "#93c5fd", fontSize: 11, fontWeight: 700, marginBottom: 3 }}>ChatAid Clinic — Lab Bill</p>
                <p style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>{payingBill.tests.join(", ")}</p>
                <p style={{ color: "#60a5fa", fontSize: 24, fontWeight: 900, marginTop: 4 }}>₹{payingBill.billAmount?.toLocaleString("en-IN")}</p>
              </div>
              <button onClick={() => setPayingBill(null)} style={{ color: "#94a3b8", background: "none", border: "none", cursor: "pointer", marginTop: 2 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px" }}>
              <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, marginBottom: 12, letterSpacing: "0.05em" }}>SELECT PAYMENT METHOD</p>

              {/* Online */}
              <button onClick={() => { setPayingBill(null); onPay(payingBill, "online"); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "rgba(37,99,235,0.12)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", marginBottom: 10, textAlign: "left" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(37,99,235,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CreditCard size={18} color="#60a5fa" />
                </div>
                <div>
                  <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 800 }}>Pay Online</p>
                  <p style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>UPI · Card · Net Banking · Wallet</p>
                </div>
                <ChevronRight size={16} color="#475569" style={{ marginLeft: "auto" }} />
              </button>

              {/* Cash */}
              <button onClick={() => { setPayingBill(null); onPay(payingBill, "cash"); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <WalletCards size={18} color="#10b981" />
                </div>
                <div>
                  <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 800 }}>Pay at Counter</p>
                  <p style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>Mark as cash paid at hospital desk</p>
                </div>
                <ChevronRight size={16} color="#475569" style={{ marginLeft: "auto" }} />
              </button>

              <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: "#334155", fontSize: 10 }}>
                <Lock size={9} /> Demo Mode — No real money charged
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function PatientDashboard() {
  const navigate   = useNavigate();
  const { logout } = useAuth();

  const [patient,       setPatient]       = useState<Record<string, any> | null>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [notes,         setNotes]         = useState<any[]>([]);
  const [reports,       setReports]       = useState<any[]>([]);
  const [labBills,      setLabBills]      = useState<LabOrder[]>([]);
  const [appointments,  setAppointments]  = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [wallet,        setWallet]        = useState<any>({ balance: 0, transactions: [] });
  const [choiceTarget,  setChoiceTarget]  = useState<any | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [saving,        setSaving]        = useState(false);
  const [saveMsg,       setSaveMsg]       = useState("");
  const [activeTab,     setActiveTab]     = useState<PatientTab>("overview");
  const [editSection,   setEditSection]   = useState<"profile"|"lifestyle"|"insurance"|null>(null);
  const [draft,         setDraft]         = useState<Record<string, string>>({});

  // ── Load dashboard ──────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("medicare_token");
    if (!token) { navigate("/login"); return; }
    let cancelled = false;
    const loadDashboard = async (showLoader = false) => {
      try {
        if (showLoader) setLoading(true);
        const [data, walletData, notificationData, labBillData] = await Promise.all([
          api.getDashboard(),
          api.get("/cancellation/wallet").catch(() => ({ wallet: { balance: 0, transactions: [] } })),
          api.get("/notifications").catch(() => ({ notifications: [] })),
          labService.getBills().catch(() => []),
        ]);
        if (!cancelled) {
          setPatient(data.patient);
          setPrescriptions(data.prescriptions || []);
          setNotes(data.notes || []);
          setReports(data.reports || []);
          setAppointments(sortAppointmentsNewestFirst(data.appointments || []));
          setNotifications(notificationData.notifications || []);
          setWallet(walletData.wallet || { balance: 0, transactions: [] });
          setLabBills(labBillData || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err.message?.includes("401")) navigate("/login");
          else setError(err.message || "Failed to load dashboard.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDashboard(true);
    const refresh = window.setInterval(() => loadDashboard(false), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [navigate]);

  // ── Edit helpers ─────────────────────────────────────────────────────────
  const startEdit  = (s: typeof editSection) => { setEditSection(s); setDraft({}); setSaveMsg(""); };
  const cancelEdit = () => { setEditSection(null); setDraft({}); };
  const handleChange = (field: string, value: string) => setDraft(d => ({ ...d, [field]: value }));

  const saveEdit = async () => {
    if (!Object.keys(draft).length) { cancelEdit(); return; }
    setSaving(true);
    try {
      const res = await api.updateProfile(draft);
      setPatient(res.patient);
      setSaveMsg("Saved ✓");
      setTimeout(() => setSaveMsg(""), 2500);
      setEditSection(null);
      setDraft({});
    } catch (err: any) {
      setSaveMsg(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem("medicare_patient");
    navigate("/", { replace: true });
  };

  const payLabBill = async (bill: LabOrder, method: "online" | "cash") => {
    if (method === "online") {
      navigate("/payment", {
        state: {
          paymentFor: "lab",
          amount: bill.billAmount || 0,
          labBill: bill,
        },
      });
      return;
    }

    try {
      const updated = await labService.payBill(bill._id, method);
      setLabBills(prev => prev.map(item => item._id === updated._id ? updated : item));
    } catch (err: any) {
      alert(err?.message || "Could not update lab bill payment.");
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const isCritical = patient?.vitals?.status === "Critical";
  const hasVitals  = patient?.vitals && (patient.vitals.bloodPressure || patient.vitals.heartRate || patient.vitals.temperature);
  const initials   = patient?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  const profilePct = patient ? (() => {
    const fields = ["name","email","phone","dob","blood","gender","city","state","insurance","smoker","occupation"];
    return Math.round(fields.filter(f => patient[f]).length / fields.length * 100);
  })() : 0;

  const toNameArray = (arr: any[]) => {
    if (!arr?.length) return [];
    return arr.map((item: any) => typeof item === "string" ? item : item.name || "").filter(Boolean);
  };
  const conditionNames  = toNameArray(patient?.conditions  || []);
  const allergyNames    = toNameArray(patient?.allergies   || []);
  const medicationNames = toNameArray(patient?.medications || []);

  const allUnreadNotifications = (notifications || []).filter((n: any) => !n.isRead);
  const unreadNotifications = allUnreadNotifications.slice(0, 3);
  const unreadCountFor = (tabId: PatientTab) =>
    allUnreadNotifications.filter((n: any) => notificationTabId(n) === tabId).length;

  const markAllNotificationsRead = async () => {
    if (!allUnreadNotifications.length) return;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await api.patch("/notifications/read-all", {});
    } catch (err) {
      console.error("Could not mark notifications read", err);
    }
  };

  const markTabNotificationsRead = async (tabId: PatientTab) => {
    const ids = allUnreadNotifications
      .filter((n: any) => notificationTabId(n) === tabId)
      .map((n: any) => n._id)
      .filter(Boolean);

    if (!ids.length) return;
    setNotifications(prev => prev.map(n => ids.includes(n._id) ? { ...n, isRead: true } : n));
    await Promise.all(ids.map(id => api.patch(`/notifications/${id}/read`, {}).catch(() => null)));
  };

  // ── Tabs config ──────────────────────────────────────────────────────────
  const tabs = [
    { id: "overview",      label: "Overview",       icon: User },
    { id: "prescriptions", label: "Prescriptions",  icon: Pill,          count: unreadCountFor("prescriptions") },
    { id: "notes",         label: "Doctor Notes",   icon: ClipboardList, count: unreadCountFor("notes") },
    { id: "reports",       label: "Reports",        icon: FileText,      count: unreadCountFor("reports") },
    { id: "appointments",  label: "Appointments",   icon: Calendar,      count: unreadCountFor("appointments") },
  ] as const;

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 44, height: 44, border: `3px solid ${CYAN_BDR}`, borderTopColor: CYAN, borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: TEXT_DIM, fontSize: 13 }}>Loading your dashboard…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ ...card, padding: "2rem", maxWidth: 380, textAlign: "center" }}>
        <AlertCircle size={40} color={RED} style={{ marginBottom: 12 }} />
        <p style={{ color: TEXT, fontWeight: 700, marginBottom: 6 }}>Something went wrong</p>
        <p style={{ color: TEXT_DIM, fontSize: 13, marginBottom: 16 }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, color: CYAN, padding: "8px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          Try Again
        </button>
      </div>
    </div>
  );

  // ═══ RENDER ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "system-ui, -apple-system, sans-serif", color: TEXT }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 50% at 20% 10%, rgba(6,182,212,0.04) 0%, transparent 60%)" }} />

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(2,8,23,0.88)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${BORDER}`, padding: "0 1.5rem", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HeartPulse size={15} color={CYAN} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.3 }}>
            Chat<span style={{ color: CYAN }}>Aid</span>
          </span>
          <span style={{ color: BORDER, margin: "0 6px" }}>|</span>
          <span style={{ fontSize: 12, color: TEXT_DIM }}>Patient Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saveMsg && <span style={{ fontSize: 12, color: saveMsg.includes("✓") ? GREEN : RED, fontWeight: 600 }}>{saveMsg}</span>}
          <button onClick={() => navigate("/voice")} style={{ display: "flex", alignItems: "center", gap: 5, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, color: CYAN, padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
            <Mic size={11} /> Voice Book
          </button>
          <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid rgba(148,163,184,0.15)", color: TEXT_DIM, padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
            <LogOut size={11} /> Sign out
          </button>
          <button onClick={() => navigate("/emergency")} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.35)", color: RED, padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
            <AlertTriangle size={11} /> Emergency
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "1.5rem 1rem 4rem", position: "relative", zIndex: 1 }}>

        {/* ── Profile Incomplete Banner ───────────────────────────────── */}
        <AnimatePresence>
          {patient && !patient.profileComplete && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(239,68,68,0.08))", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 14, padding: "14px 18px", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <AlertCircle size={20} color={AMBER} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 2 }}>Complete your medical profile</p>
                  <p style={{ fontSize: 12, color: TEXT_DIM }}>Profile is {profilePct}% complete.</p>
                </div>
              </div>
              <div style={{ flex: "1 1 180px" }}>
                <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${profilePct}%` }} transition={{ duration: 0.8 }}
                    style={{ height: "100%", background: "linear-gradient(90deg, #f59e0b, #ef4444)", borderRadius: 3 }} />
                </div>
              </div>
              <button onClick={() => { setActiveTab("overview"); startEdit("profile"); }} style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: AMBER, padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Complete Now →
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Welcome Banner ──────────────────────────────────────────── */}
        <AnimatePresence>
          {unreadNotifications.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ ...card, padding: "12px 16px", marginBottom: "1rem", borderColor: CYAN_BDR, background: "rgba(6,182,212,0.07)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Bell size={14} color={CYAN} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                    <p style={{ fontSize: 12, color: CYAN, fontWeight: 800 }}>Doctor updates</p>
                    <button onClick={markAllNotificationsRead} style={{ background: "transparent", border: `1px solid ${CYAN_BDR}`, color: CYAN, borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      Mark read
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {unreadNotifications.map((item: any, i: number) => (
                      <p key={item._id || i} style={{ fontSize: 12, color: TEXT_DIM }}>
                        <span style={{ color: TEXT, fontWeight: 700 }}>{item.title}</span>
                        {item.message ? ` - ${item.message}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div {...fadeUp(0)} style={{ ...card, padding: "1.5rem", marginBottom: "1rem", background: "linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(15,23,42,0.8) 100%)", borderColor: CYAN_BDR }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: CYAN, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: TEXT_DIM, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Welcome back 👋</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT, letterSpacing: -0.5, margin: "2px 0" }}>{patient?.name || "Patient"}</h1>
              <p style={{ fontSize: 12, color: TEXT_DIM }}>
                {patient?.email} · Member since {patient?.createdAt ? new Date(patient.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" }) : "—"}
              </p>
            </div>
            {/* Quick stats pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {prescriptions.length > 0 && (
                <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: VIOLET }}>
                  {prescriptions.length} Rx
                </span>
              )}
              {notes.length > 0 && (
                <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, color: CYAN }}>
                  {notes.length} Notes
                </span>
              )}
              {patient?.profileComplete && (
                <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: GREEN }}>
                  ✓ Profile Complete
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 6, marginBottom: "1rem", overflowX: "auto", paddingBottom: 2 }}>
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as PatientTab); markTabNotificationsRead(tab.id as PatientTab); }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: `1px solid ${active ? CYAN_BDR : "rgba(148,163,184,0.1)"}`, background: active ? CYAN_BG : "transparent", color: active ? CYAN : TEXT_DIM, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                <tab.icon size={13} />
                {tab.label}
                {"count" in tab && tab.count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 10, background: active ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.06)", color: active ? CYAN : TEXT_DIM }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══ OVERVIEW TAB ════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <>
            <WalletCard wallet={wallet} />
            <LabBillsCard bills={labBills} onPay={payLabBill} />

            {/* Profile + Medical */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              {/* Profile — editable */}
              <motion.div {...fadeUp(0.06)} style={card}>
                <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)` }} />
                <div style={{ padding: "1.25rem" }}>
                  <SectionHeader icon={User} title="Profile" onEdit={() => editSection === "profile" ? cancelEdit() : startEdit("profile")} editing={editSection === "profile"} />
                  <EditableRow label="Name"      icon={User}        field="name"            value={patient?.name}           editing={editSection === "profile"} draft={draft} onChange={handleChange} />
                  <EditableRow label="Phone"     icon={Phone}       field="phone"           value={patient?.phone}          editing={editSection === "profile"} draft={draft} onChange={handleChange} />
                  <EditableRow label="Address"   icon={MapPin}      field="address"         value={patient?.address}        editing={editSection === "profile"} draft={draft} onChange={handleChange} />
                  <EditableRow label="City"      icon={MapPin}      field="city"            value={patient?.city}           editing={editSection === "profile"} draft={draft} onChange={handleChange} />
                  <EditableRow label="Emergency" icon={AlertCircle} field="emergencyName"   value={patient?.emergencyName}  editing={editSection === "profile"} draft={draft} onChange={handleChange} />
                  <EditableRow label="Em. Phone" icon={Phone}       field="emergencyContact" value={patient?.emergencyContact} editing={editSection === "profile"} draft={draft} onChange={handleChange} />
                  <LockedRow   label="Age / DOB" icon={Calendar}    value={patient?.age ? `${patient.age} yrs${patient.dob ? ` · ${patient.dob}` : ""}` : patient?.dob} />
                  <LockedRow   label="Blood"     icon={Droplets}    value={patient?.blood} />
                  {editSection === "profile" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={saveEdit} disabled={saving} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, color: CYAN, padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        <Check size={13} /> {saving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={cancelEdit} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "1px solid rgba(148,163,184,0.15)", color: TEXT_DIM, padding: "8px", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Medical — read only */}
              <motion.div {...fadeUp(0.1)} style={card}>
                <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${VIOLET}, transparent)` }} />
                <div style={{ padding: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${BORDER}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${VIOLET}15`, border: `1px solid ${VIOLET}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Stethoscope size={14} color={VIOLET} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Medical Information</span>
                    </div>
                    <DoctorBadge />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 10, color: TEXT_DIM, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>📋 Conditions</p>
                    {conditionNames.length > 0 ? <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{conditionNames.map((c, i) => <Tag key={i} label={c} color={ORANGE} />)}</div> : <p style={{ fontSize: 12, color: TEXT_DIM, fontStyle: "italic" }}>None recorded</p>}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 10, color: TEXT_DIM, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>⚠️ Allergies</p>
                    {allergyNames.length > 0 ? <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{allergyNames.map((a, i) => <Tag key={i} label={a} color={RED} />)}</div> : <p style={{ fontSize: 12, color: TEXT_DIM, fontStyle: "italic" }}>None recorded</p>}
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: TEXT_DIM, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>💊 Current Medications</p>
                    {medicationNames.length > 0 ? <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{medicationNames.map((m, i) => <Tag key={i} label={m} color={VIOLET} />)}</div> : <p style={{ fontSize: 12, color: TEXT_DIM, fontStyle: "italic" }}>None recorded</p>}
                  </div>
                  <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
                    <p style={{ fontSize: 11, color: VIOLET, fontWeight: 600 }}>
                      <Lock size={10} style={{ display: "inline", marginRight: 4 }} />
                      Updated by your doctor during visits.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Vitals */}
            <motion.div {...fadeUp(0.14)} style={{ ...card, marginBottom: "1rem", borderColor: isCritical ? "rgba(239,68,68,0.25)" : BORDER }}>
              <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${isCritical ? RED : GREEN}, transparent)` }} />
              <div style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <SectionHeader icon={Activity} title="Vitals" color={isCritical ? RED : GREEN} badge={<DoctorBadge />} />
                  {patient?.vitals?.status && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: isCritical ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", border: `1px solid ${isCritical ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`, color: isCritical ? RED : GREEN }}>
                      ● {patient.vitals.status}
                    </span>
                  )}
                </div>
                {!hasVitals ? (
                  <EmptyState icon={Stethoscope} message="Your doctor will update your vitals after your visit" />
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                      <VitalBox icon={Activity}    label="Blood Pressure" value={patient.vitals.bloodPressure} unit="mmHg" critical={isCritical} />
                      <VitalBox icon={Heart}       label="Heart Rate"     value={patient.vitals.heartRate}     unit="bpm" />
                      <VitalBox icon={Thermometer} label="Temperature"    value={patient.vitals.temperature}   unit="°F" />
                    </div>
                    {patient.vitals.updatedAt && (
                      <p style={{ fontSize: 11, color: TEXT_DIM, marginTop: 10, textAlign: "right" }}>
                        <Clock size={10} style={{ display: "inline", marginRight: 4 }} />
                        Updated: {new Date(patient.vitals.updatedAt).toLocaleString("en-IN")}
                        {patient.vitals.updatedByName ? ` · Dr. ${patient.vitals.updatedByName}` : ""}
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>

            {/* Insurance + Lifestyle */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <motion.div {...fadeUp(0.18)} style={card}>
                <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)` }} />
                <div style={{ padding: "1.25rem" }}>
                  <SectionHeader icon={Shield} title="Insurance & Care" color={GREEN} onEdit={() => editSection === "insurance" ? cancelEdit() : startEdit("insurance")} editing={editSection === "insurance"} />
                  <EditableRow label="Provider"  icon={Shield}       field="insurance"         value={patient?.insurance}         editing={editSection === "insurance"} draft={draft} onChange={handleChange} />
                  <EditableRow label="Policy No" icon={ChevronRight} field="policyNo"          value={patient?.policyNo}          editing={editSection === "insurance"} draft={draft} onChange={handleChange} />
                  <EditableRow label="Doctor"    icon={Stethoscope}  field="primaryDoctor"     value={patient?.primaryDoctor}     editing={editSection === "insurance"} draft={draft} onChange={handleChange} />
                  <EditableRow label="Hospital"  icon={MapPin}       field="preferredHospital" value={patient?.preferredHospital} editing={editSection === "insurance"} draft={draft} onChange={handleChange} />
                  {editSection === "insurance" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={saveEdit} disabled={saving} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: GREEN, padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        <Check size={13} /> {saving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={cancelEdit} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "1px solid rgba(148,163,184,0.15)", color: TEXT_DIM, padding: "8px", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div {...fadeUp(0.22)} style={card}>
                <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${ORANGE}, transparent)` }} />
                <div style={{ padding: "1.25rem" }}>
                  <SectionHeader icon={Zap} title="Lifestyle" color={ORANGE} onEdit={() => editSection === "lifestyle" ? cancelEdit() : startEdit("lifestyle")} editing={editSection === "lifestyle"} />
                  <EditableRow label="Activity" icon={Zap}          field="activityLevel" value={patient?.activityLevel} editing={editSection === "lifestyle"} draft={draft} onChange={handleChange} />
                  <EditableRow label="Diet"     icon={Heart}        field="dietType"       value={patient?.dietType}      editing={editSection === "lifestyle"} draft={draft} onChange={handleChange} />
                  <EditableRow label="Smoking"  icon={Activity}     field="smoker"         value={patient?.smoker}        editing={editSection === "lifestyle"} draft={draft} onChange={handleChange} />
                  <EditableRow label="Alcohol"  icon={FlaskConical} field="alcohol"        value={patient?.alcohol}       editing={editSection === "lifestyle"} draft={draft} onChange={handleChange} />
                  <EditableRow label="Job"      icon={User}         field="occupation"     value={patient?.occupation}    editing={editSection === "lifestyle"} draft={draft} onChange={handleChange} />
                  {editSection === "lifestyle" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button onClick={saveEdit} disabled={saving} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: ORANGE, padding: "8px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        <Check size={13} /> {saving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={cancelEdit} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "1px solid rgba(148,163,184,0.15)", color: TEXT_DIM, padding: "8px", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Quick Actions */}
            <motion.div {...fadeUp(0.26)} style={card}>
              <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${VIOLET}, transparent)` }} />
              <div style={{ padding: "1.25rem" }}>
                <SectionHeader icon={Zap} title="Quick Actions" color={VIOLET} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  {[
                    { label: "Book Appointment", icon: Calendar, color: CYAN,   action: () => navigate("/book-appointment") },
                    { label: "Voice Booking",    icon: Mic,      color: CYAN,   action: () => navigate("/voice") },
                    { label: "Emergency SOS",    icon: AlertTriangle, color: RED, action: () => navigate("/emergency") },
                    { label: "My Prescriptions", icon: Pill,     color: VIOLET, action: () => setActiveTab("prescriptions") },
                    { label: "Doctor Notes",     icon: ClipboardList, color: GREEN, action: () => setActiveTab("notes") },
                    { label: "My Reports",       icon: FileText, color: ORANGE, action: () => setActiveTab("reports") },
                    { label: "My Lab Reports",   icon: FlaskConical, color: GREEN, action: () => navigate("/lab/reports") },
                  ].map(({ label, icon: Icon, color, action }) => (
                    <button key={label} onClick={action}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: `${color}08`, border: `1px solid ${color}20`, borderRadius: 12, padding: "14px 10px", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${color}15`}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `${color}08`}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={16} color={color} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: TEXT, textAlign: "center" }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* ══ PRESCRIPTIONS TAB ════════════════════════════════════════════ */}
        {activeTab === "prescriptions" && (
          <motion.div {...fadeUp(0)} style={card}>
            <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${VIOLET}, transparent)` }} />
            <div style={{ padding: "1.25rem" }}>
              <SectionHeader icon={Pill} title="My Prescriptions" color={VIOLET} badge={<DoctorBadge />} />
              {prescriptions.length === 0 ? (
                <EmptyState icon={Pill} message="No prescriptions yet. Your doctor will add them after your visit." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {prescriptions.map((rx, i) => <PrescriptionCard key={rx._id || i} rx={rx} />)}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ══ NOTES TAB ════════════════════════════════════════════════════ */}
        {activeTab === "notes" && (
          <motion.div {...fadeUp(0)} style={card}>
            <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)` }} />
            <div style={{ padding: "1.25rem" }}>
              <SectionHeader icon={ClipboardList} title="Doctor's Clinical Notes" badge={<DoctorBadge />} />
              {notes.length === 0 ? (
                <EmptyState icon={ClipboardList} message="No notes yet. Your doctor will add clinical notes after your visit." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {notes.map((note, i) => <NoteCard key={note._id || i} note={note} />)}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ══ REPORTS TAB ══════════════════════════════════════════════════ */}
        {activeTab === "reports" && (
          <motion.div {...fadeUp(0)} style={card}>
            <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)` }} />
            <div style={{ padding: "1.25rem" }}>
              <SectionHeader icon={FileText} title="Lab Reports & Documents" color={GREEN} badge={<DoctorBadge />} />
              {reports.length === 0 ? (
                <EmptyState icon={Upload} message="No reports uploaded yet. Your doctor will attach lab results here." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {reports.map((report, i) => <ReportCard key={report._id || i} report={report} />)}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ══ APPOINTMENTS TAB ═════════════════════════════════════════════ */}
        {activeTab === "appointments" && (
          <motion.div {...fadeUp(0)} style={card}>
            <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${ORANGE}, transparent)` }} />
            <div style={{ padding: "1.25rem" }}>
              <SectionHeader icon={Calendar} title="My Appointments" color={ORANGE} />
              {appointments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem 0" }}>
                  <EmptyState icon={Calendar} message="No appointments yet." />
                  <button onClick={() => navigate("/book-appointment")}
                    style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, color: CYAN, padding: "8px 18px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    <Calendar size={13} /> Book an Appointment
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {appointments.map((appt, i) => {
                    const statusColor = appt.status === "completed" ? GREEN : appt.status === "cancelled" ? RED : ORANGE;
                    const doctorName = appt.doctorId?.name || appt.doctor?.name || appt.doctorName || "Unknown";
                    const specialty = appt.doctorId?.specialization || appt.doctorId?.specialisation || appt.doctor?.specialisation || appt.doctor?.specialization || appt.specialty;
                    const reason = appt.reason || (appt.symptoms || []).join(", ") || appt.notes;
                    return (
                      <div key={appt._id || i} style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
                            {formatDoctorName(doctorName)}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${statusColor}15`, border: `1px solid ${statusColor}30`, color: statusColor, textTransform: "capitalize" }}>
                            {appt.status || "Scheduled"}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: TEXT_DIM, marginBottom: 4 }}>
                          <Calendar size={10} style={{ display: "inline", marginRight: 4 }} />
                          {appt.date ? new Date(appt.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—"}
                          {appt.time ? ` · ${appt.time}` : ""}
                        </p>
                        {reason && <p style={{ fontSize: 12, color: TEXT_DIM }}>{reason}</p>}
                        {appt.status === "cancelled" && appt.cancelledBy === "doctor" && appt.cancellationRemark && (
                          <div style={{ marginTop: 10, padding: "9px 10px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                            <p style={{ color: RED, fontSize: 11, fontWeight: 800, marginBottom: 3 }}>Cancelled by doctor</p>
                            <p style={{ color: TEXT_DIM, fontSize: 12 }}>{appt.cancellationRemark}</p>
                            {(!appt.patientChoice || appt.patientChoice === "none") ? (
                              <button onClick={() => setChoiceTarget(appt)}
                                style={{ marginTop: 8, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, color: CYAN, padding: "7px 12px", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                                Choose Refund or Reschedule
                              </button>
                            ) : (
                              <p style={{ color: CYAN, fontSize: 12, fontWeight: 700, marginTop: 7 }}>
                                Request submitted: {appt.patientChoice}
                              </p>
                            )}
                          </div>
                        )}
                        {specialty && <Tag label={specialty} color={ORANGE} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

      </main>

      <AnimatePresence>
        {choiceTarget && (
          <RefundRescheduleModal
            appointment={choiceTarget}
            onClose={() => setChoiceTarget(null)}
            onSuccess={async () => {
              const [data, walletData] = await Promise.all([
                api.getDashboard(),
                api.get("/cancellation/wallet").catch(() => ({ wallet })),
              ]);
              setAppointments(data.appointments || []);
              setWallet(walletData.wallet || wallet);
            }}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0 }
        input:focus { border-color: ${CYAN} !important; }
        @media (max-width: 640px) {
          .grid-2 { grid-template-columns: 1fr !important }
        }
      `}</style>
    </div>
  );
}
