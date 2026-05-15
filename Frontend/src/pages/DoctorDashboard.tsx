// Frontend/src/pages/DoctorDashboard.tsx  ── complete drop-in replacement
import React, { useEffect, useState, useRef, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse, Search, User, Activity, Heart, Thermometer,
  LogOut, AlertCircle, X, Save, Upload, Clock, Pill,
  StickyNote, Calendar, CheckCircle, Loader, Trash2, Plus,
  Check, Bell, FlaskConical,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import AvailabilityTab from "./AvailabilityTab";
import CancelAppointmentModal from "../components/CancelAppointmentModal";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  cyan:      "#06b6d4",
  cyanBg:    "rgba(6,182,212,0.08)",
  cyanBdr:   "rgba(6,182,212,0.22)",
  bg:        "#020817",
  surface:   "rgba(12,20,38,0.85)",
  border:    "rgba(148,163,184,0.07)",
  borderMid: "rgba(148,163,184,0.14)",
  text:      "#e2e8f0",
  dim:       "#64748b",
  green:     "#10b981",
  greenBg:   "rgba(16,185,129,0.08)",
  greenBdr:  "rgba(16,185,129,0.22)",
  red:       "#ef4444",
  redBg:     "rgba(239,68,68,0.08)",
  redBdr:    "rgba(239,68,68,0.2)",
  orange:    "#f97316",
  purple:    "#8b5cf6",
  purpleBg:  "rgba(139,92,246,0.08)",
  purpleBdr: "rgba(139,92,246,0.22)",
};

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  Normal:     { bg: C.greenBg,  border: C.greenBdr,  text: C.green  },
  Stable:     { bg: C.cyanBg,   border: C.cyanBdr,   text: C.cyan   },
  Monitoring: { bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.25)", text: C.orange },
  Critical:   { bg: C.redBg,    border: C.redBdr,    text: C.red    },
};

const apptStatusColors: Record<string, { bg: string; border: string; text: string }> = {
  scheduled: { bg: C.cyanBg,  border: C.cyanBdr,  text: C.cyan  },
  completed: { bg: C.greenBg, border: C.greenBdr, text: C.green },
  cancelled: { bg: C.redBg,   border: C.redBdr,   text: C.red   },
  pending:   { bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.25)", text: C.orange },
};

const MEDICINES: Record<string, string[]> = {
  A: ["Acyclovir", "Albendazole", "Albuterol", "Alendronate", "Allopurinol", "Alprazolam", "Amikacin", "Amlodipine", "Amoxicillin", "Ampicillin", "Atenolol", "Atorvastatin", "Azithromycin"],
  B: ["Baclofen", "Betamethasone", "Bisoprolol", "Budesonide", "Bupropion", "Buspirone"],
  C: ["Captopril", "Carbamazepine", "Carvedilol", "Cefixime", "Ceftriaxone", "Cetirizine", "Ciprofloxacin", "Clarithromycin", "Clindamycin", "Clopidogrel", "Clonazepam", "Codeine"],
  D: ["Dexamethasone", "Diazepam", "Diclofenac", "Digoxin", "Diltiazem", "Domperidone", "Doxycycline"],
  E: ["Enalapril", "Erythromycin", "Escitalopram", "Esomeprazole", "Ethambutol"],
  F: ["Famotidine", "Fluconazole", "Fluoxetine", "Furosemide"],
  G: ["Gabapentin", "Gentamicin", "Glibenclamide", "Glimepiride", "Glipizide"],
  H: ["Haloperidol", "Hydralazine", "Hydrochlorothiazide", "Hydroxychloroquine", "Hyoscine"],
  I: ["Ibuprofen", "Imipramine", "Insulin Regular", "Isoniazid", "Ivermectin"],
  J: ["Januvia Sitagliptin"],
  K: ["Ketoconazole", "Ketoprofen"],
  L: ["Lactulose", "Lamotrigine", "Lansoprazole", "Levodopa", "Levofloxacin", "Levothyroxine", "Lisinopril", "Loperamide", "Loratadine", "Lorazepam", "Losartan"],
  M: ["Mebendazole", "Metformin", "Methotrexate", "Methyldopa", "Methylprednisolone", "Metoclopramide", "Metoprolol", "Metronidazole", "Miconazole", "Midazolam", "Montelukast", "Morphine"],
  N: ["Naproxen", "Nevirapine", "Nifedipine", "Nitrofurantoin", "Nitroglycerin"],
  O: ["Omeprazole", "Ondansetron", "Oseltamivir", "Oxytocin"],
  P: ["Pantoprazole", "Paracetamol", "Penicillin V", "Phenobarbitone", "Phenytoin", "Prednisolone", "Propranolol"],
  Q: ["Quetiapine"],
  R: ["Ranitidine", "Rifampicin", "Risperidone", "Rosuvastatin"],
  S: ["Salbutamol", "Sertraline", "Simvastatin", "Sodium Valproate", "Spironolactone", "Streptomycin"],
  T: ["Tamoxifen", "Tenofovir", "Tramadol", "Trazodone"],
  U: ["Ursodeoxycholic Acid"],
  V: ["Valproic Acid", "Valsartan", "Vancomycin", "Verapamil"],
  W: ["Warfarin"],
  X: ["Xylometazoline"],
  Y: ["Yeast Saccharomyces"],
  Z: ["Zidovudine", "Zinc Sulfate", "Zolpidem"],
};

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

type MedicineDraft = {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
};

// ── Shared style helpers ──────────────────────────────────────────────────────
const inp = (focused = false): CSSProperties => ({
  width: "100%", boxSizing: "border-box",
  background: "rgba(10,18,34,0.9)",
  border: `1px solid ${focused ? C.cyanBdr : C.borderMid}`,
  borderRadius: 10, padding: "0.6rem 0.85rem",
  color: C.text, fontFamily: "inherit", fontSize: 13, outline: "none",
  transition: "border-color 0.2s",
});

const card = (extra: CSSProperties = {}): CSSProperties => ({
  background: C.surface, backdropFilter: "blur(20px)",
  border: `1px solid ${C.border}`, borderRadius: 16,
  overflow: "hidden", ...extra,
});

const topBar = (color = C.cyan): CSSProperties => ({
  height: 2,
  background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
});

const sectionLabel: CSSProperties = {
  fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 0.6,
  textTransform: "uppercase", display: "block", marginBottom: 5,
};

const badge = (s?: { bg?: string; border?: string; text?: string }): CSSProperties => ({
  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
  background: s?.bg, border: `1px solid ${s?.border}`, color: s?.text,
  flexShrink: 0, textTransform: "capitalize",
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "appointments", label: "Appointments",   icon: Calendar   },
  { id: "availability", label: "Availability",   icon: Clock      },
  { id: "patients",     label: "Patients",       icon: User       },
  { id: "prescription", label: "Prescription",   icon: Pill       },
  { id: "notes",        label: "Clinical Notes", icon: StickyNote },
  { id: "reports",      label: "Upload Reports", icon: Upload     },
];

function formatDoctorName(name?: string) {
  if (!name) return "";
  return name.startsWith("Dr.") ? name : `Dr. ${name}`;
}

// ── Shared modal primitives ───────────────────────────────────────────────────
function isCriticalCase(item: any) {
  return String(item?.vitals?.status || item?.priority || item?.severity || "").toUpperCase() === "CRITICAL";
}

function isNurseChecked(item: any) {
  return Boolean(item?.vitals?.nurseChecked || item?.vitals?.updatedByRole === "nurse");
}

function sortCriticalFirst<T extends { name?: string; createdAt?: string; date?: string }>(items: T[]) {
  return [...items].sort((a: any, b: any) => {
    const criticalDelta = Number(isCriticalCase(b)) - Number(isCriticalCase(a));
    if (criticalDelta) return criticalDelta;

    const aTime = new Date(a.createdAt || a.date || 0).getTime();
    const bTime = new Date(b.createdAt || b.date || 0).getTime();
    if (aTime !== bTime) return bTime - aTime;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(5px)", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "1rem",
    }}>
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function ModalShell({ title, subtitle, onClose, maxWidth = 420, color = C.cyan, children }: {
  title: string; subtitle?: string; onClose: () => void;
  maxWidth?: number; color?: string; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      style={{
        background: "#0a1222", border: "1px solid rgba(148,163,184,0.12)",
        borderRadius: 18, width: "100%", maxWidth, overflow: "hidden",
      }}>
      <div style={topBar(color)} />
      <div style={{
        padding: "1.25rem 1.5rem", borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</p>
          {subtitle && <p style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{subtitle}</p>}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", padding: 4 }}>
          <X size={16} />
        </button>
      </div>
      {children}
    </motion.div>
  );
}

function ModalFooter({ onCancel, onConfirm, loading, confirmLabel, icon, color = C.cyan, colorBg = C.cyanBg, colorBdr = C.cyanBdr }: {
  onCancel: () => void; onConfirm: () => void; loading: boolean;
  confirmLabel: string; icon: React.ReactNode;
  color?: string; colorBg?: string; colorBdr?: string;
}) {
  return (
    <div style={{ padding: "1rem 1.5rem 1.5rem", display: "flex", gap: 10 }}>
      <button onClick={onCancel} style={{
        flex: 1, padding: "0.6rem", borderRadius: 10, background: "none",
        border: `1px solid ${C.border}`, color: C.dim, cursor: "pointer",
        fontSize: 13, fontFamily: "inherit",
      }}>Cancel</button>
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        onClick={onConfirm} disabled={loading}
        style={{
          flex: 2, padding: "0.6rem", borderRadius: 10, background: colorBg,
          border: `1px solid ${colorBdr}`, color, cursor: loading ? "not-allowed" : "pointer",
          fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 6, fontFamily: "inherit",
        }}>
        {loading ? <Loader size={13} style={{ animation: "spin .7s linear infinite" }} /> : icon}
        {loading ? "Saving…" : confirmLabel}
      </motion.button>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      background: C.redBg, border: `1px solid ${C.redBdr}`, borderRadius: 10,
      padding: "8px 12px", fontSize: 12, color: C.red,
      display: "flex", gap: 8, alignItems: "center",
    }}>
      <AlertCircle size={13} /> {msg}
    </div>
  );
}

function SuccessState({ msg }: { msg: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "1.5rem 0" }}>
      <CheckCircle size={36} color={C.green} />
      <p style={{ color: C.green, fontWeight: 700, fontSize: 14 }}>{msg}</p>
    </div>
  );
}

// ── Vitals modal ──────────────────────────────────────────────────────────────
function VitalsModal({ patient, onClose, onSaved }: { patient: any; onClose: () => void; onSaved: (p: any) => void }) {
  const [form, setForm] = useState({
    bloodPressure: patient?.vitals?.bloodPressure || "",
    heartRate:     String(patient?.vitals?.heartRate   || ""),
    temperature:   String(patient?.vitals?.temperature || ""),
    status:        patient?.vitals?.status || "Normal",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      // Uses PUT /api/doctor/patients/:id/vitals
      const data = await api.updateVitals(patient._id, {
        bloodPressure: form.bloodPressure,
        heartRate:     form.heartRate   ? Number(form.heartRate)   : null,
        temperature:   form.temperature ? Number(form.temperature) : null,
        status:        form.status,
      });
      onSaved(data.patient);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to update vitals.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalShell title="Update Vitals" subtitle={`Patient: ${patient?.name}`} onClose={onClose} maxWidth={420}>
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { key: "bloodPressure", label: "Blood Pressure",   placeholder: "e.g. 120/80", type: "text"   },
            { key: "heartRate",     label: "Heart Rate (bpm)",  placeholder: "e.g. 72",    type: "number" },
            { key: "temperature",   label: "Temperature (°F)",  placeholder: "e.g. 98.6",  type: "number" },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label style={sectionLabel}>{label}</label>
              <input type={type} value={(form as any)[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder} style={inp()} />
            </div>
          ))}
          <div>
            <label style={sectionLabel}>Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              style={{ ...inp(), cursor: "pointer" }}>
              {["Normal", "Stable", "Monitoring", "Critical"].map(s => (
                <option key={s} style={{ background: "#0f172a" }}>{s}</option>
              ))}
            </select>
          </div>
          {error && <ErrorBox msg={error} />}
        </div>
        <ModalFooter onCancel={onClose} onConfirm={handleSave} loading={saving} confirmLabel="Save Vitals" icon={<Save size={13} />} />
      </ModalShell>
    </Overlay>
  );
}

// ── Prescription modal ────────────────────────────────────────────────────────
function OldPrescriptionModal({ patient, onClose, onSaved }: { patient: any; onClose: () => void; onSaved?: () => void }) {
  const [form, setForm] = useState({ drugName: "", dose: "", frequency: "", duration: "", instructions: "" });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!form.drugName || !form.dose || !form.frequency) {
      setError("Drug name, dose, and frequency are required."); return;
    }
    setSaving(true); setError("");
    try {
      // Uses POST /api/doctor/prescriptions
      await api.post("/doctor/prescriptions", { patientId: patient._id, ...form });
      setSuccess(true);
      setTimeout(() => { onSaved?.(); onClose(); }, 1200);
    } catch (err: any) {
      setError(err?.message || "Failed to save prescription.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalShell title="Write Prescription" subtitle={`For: ${patient?.name}`} onClose={onClose} maxWidth={480} color={C.purple}>
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: 14 }}>
          {success ? <SuccessState msg="Prescription saved!" /> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { key: "drugName",  label: "Drug Name", placeholder: "e.g. Amoxicillin" },
                  { key: "dose",      label: "Dose",      placeholder: "e.g. 500mg"        },
                  { key: "frequency", label: "Frequency", placeholder: "e.g. Twice daily"  },
                  { key: "duration",  label: "Duration",  placeholder: "e.g. 7 days"       },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label style={sectionLabel}>{label}</label>
                    <input value={(form as any)[key]}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder} style={inp()} />
                  </div>
                ))}
              </div>
              <div>
                <label style={sectionLabel}>Special Instructions</label>
                <textarea value={form.instructions}
                  onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
                  placeholder="Take with food, avoid alcohol…" rows={3}
                  style={{ ...inp(), resize: "vertical", lineHeight: 1.5 }} />
              </div>
              {error && <ErrorBox msg={error} />}
            </>
          )}
        </div>
        {!success && (
          <ModalFooter onCancel={onClose} onConfirm={handleSave} loading={saving} confirmLabel="Save Prescription"
            icon={<Pill size={13} />} color={C.purple} colorBg={C.purpleBg} colorBdr={C.purpleBdr} />
        )}
      </ModalShell>
    </Overlay>
  );
}

// ── Clinical notes modal ──────────────────────────────────────────────────────
function PrescriptionModal({ patient, onClose, onSaved }: { patient: any; onClose: () => void; onSaved?: () => void }) {
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeLetter, setActiveLetter] = useState("A");
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [medicines, setMedicines] = useState<MedicineDraft[]>([]);
  const [followUpRemark, setFollowUpRemark] = useState("");
  const [needsLabTest, setNeedsLabTest] = useState(false);
  const [labTests, setLabTests] = useState<string[]>([]);
  const [labPriority, setLabPriority] = useState<"Normal" | "Urgent">("Normal");
  const [labNotes, setLabNotes] = useState("");
  const [labOrderCreated, setLabOrderCreated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const allMedicines = Object.entries(MEDICINES).flatMap(([letter, names]) =>
    names.map(name => ({ letter, name }))
  );
  const addedNames = new Set(medicines.map(m => m.name.toLowerCase()));
  const visibleMedicines = search.trim()
    ? allMedicines.filter(m => m.name.toLowerCase().includes(search.trim().toLowerCase()))
    : (MEDICINES[activeLetter] || []).map(name => ({ letter: activeLetter, name }));

  const toggleMedicine = (name: string) => {
    if (addedNames.has(name.toLowerCase())) return;
    setSelectedNames(prev => prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]);
  };

  const addSelected = () => {
    const next = selectedNames
      .filter(name => !addedNames.has(name.toLowerCase()))
      .map(name => ({ name, dose: "", frequency: "", duration: "", instructions: "" }));
    if (!next.length) return;
    setMedicines(prev => [...prev, ...next]);
    setSelectedNames([]);
    setSearch("");
    setPickerOpen(false);
  };

  const updateMedicine = (index: number, key: keyof MedicineDraft, value: string) => {
    setMedicines(prev => prev.map((medicine, i) => i === index ? { ...medicine, [key]: value } : medicine));
  };

  const removeMedicine = (index: number) => {
    setMedicines(prev => prev.filter((_, i) => i !== index));
  };

  const toggleLabTest = (test: string) => {
    setLabTests(prev => prev.includes(test) ? prev.filter(item => item !== test) : [...prev, test]);
  };

  const handleSave = async () => {
    setError("");
    if (!medicines.length) {
      setError("Add at least one medicine.");
      return;
    }

    const incomplete = medicines.find(m => !m.dose.trim() || !m.frequency.trim());
    if (incomplete) {
      setError(`Dose and frequency are required for ${incomplete.name}.`);
      return;
    }
    if (needsLabTest && !labTests.length) {
      setError("Select at least one lab test.");
      return;
    }

    setSaving(true);
    try {
      const data = await api.post("/doctor/prescriptions", {
        patientId: patient._id,
        medications: medicines,
        followUpRemark,
        needsLabTest,
        labTests: needsLabTest ? labTests : [],
        labPriority,
        labNotes,
      });
      setLabOrderCreated(Boolean(data?.labOrder));
      setSuccess(true);
      setTimeout(() => { onSaved?.(); onClose(); }, needsLabTest ? 1600 : 1200);
    } catch (err: any) {
      setError(err?.message || "Failed to save prescription.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalShell title="Write Prescription" subtitle={`For: ${patient?.name}`} onClose={onClose} maxWidth={760} color={C.purple}>
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: 14, maxHeight: "72vh", overflowY: "auto" }}>
          {success ? <SuccessState msg={labOrderCreated ? "Prescription saved and lab order created!" : "Prescription saved!"} /> : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Add medicines</p>
                  <p style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Search, browse A-Z, then add multiple medicines together.</p>
                </div>
                <span style={{ ...badge({ bg: C.purpleBg, border: C.purpleBdr, text: C.purple }), fontSize: 11 }}>
                  {medicines.length} medicine{medicines.length === 1 ? "" : "s"}
                </span>
              </div>

              <div style={{ border: `1px solid ${C.borderMid}`, borderRadius: 14, padding: 12, background: "rgba(255,255,255,0.02)" }}>
                <label style={sectionLabel}>Medicine search</label>
                <div style={{ position: "relative" }}>
                  <Search size={14} color={C.dim} style={{ position: "absolute", left: 12, top: 12 }} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    onFocus={() => setPickerOpen(true)}
                    placeholder="Type medicine name or choose a letter below"
                    style={{ ...inp(), paddingLeft: 34 }} />
                </div>

                {pickerOpen && (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                      {Object.keys(MEDICINES).map(letter => (
                        <button key={letter} onClick={() => { setActiveLetter(letter); setSearch(""); }}
                          style={{
                            width: 25, height: 25, borderRadius: 8, cursor: "pointer",
                            border: `1px solid ${activeLetter === letter && !search ? C.purpleBdr : C.borderMid}`,
                            background: activeLetter === letter && !search ? C.purpleBg : "rgba(15,23,42,0.6)",
                            color: activeLetter === letter && !search ? C.purple : C.dim,
                            fontSize: 11, fontWeight: 800,
                          }}>
                          {letter}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginTop: 12, maxHeight: 172, overflowY: "auto" }}>
                      {visibleMedicines.map(({ name }) => {
                        const alreadyAdded = addedNames.has(name.toLowerCase());
                        const selected = selectedNames.includes(name);
                        return (
                          <button key={name} onClick={() => toggleMedicine(name)} disabled={alreadyAdded}
                            style={{
                              borderRadius: 10, padding: "9px 10px", textAlign: "left",
                              border: `1px solid ${selected ? C.purpleBdr : C.borderMid}`,
                              background: alreadyAdded ? "rgba(15,23,42,0.45)" : selected ? C.purpleBg : "rgba(15,23,42,0.7)",
                              color: alreadyAdded ? C.dim : C.text,
                              cursor: alreadyAdded ? "not-allowed" : "pointer",
                              opacity: alreadyAdded ? 0.55 : 1,
                            }}>
                            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 700 }}>
                              {name}
                              {selected && <Check size={14} color={C.purple} />}
                            </span>
                            <span style={{ fontSize: 10, color: selected ? C.purple : C.dim }}>
                              {alreadyAdded ? "Already added" : selected ? "Selected" : "Click to select"}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button onClick={addSelected} disabled={!selectedNames.length}
                        style={{
                          marginTop: 12, width: "100%", padding: "0.65rem", borderRadius: 10,
                          border: `1px solid ${C.purpleBdr}`, background: C.purpleBg,
                          color: C.purple, fontWeight: 800, cursor: selectedNames.length ? "pointer" : "not-allowed",
                          opacity: selectedNames.length ? 1 : 0.45, display: "flex", alignItems: "center",
                          justifyContent: "center", gap: 7, fontFamily: "inherit",
                        }}>
                        <Plus size={14} /> Add Selected {selectedNames.length ? `(${selectedNames.length})` : ""}
                      </button>
                  </>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {medicines.map((medicine, index) => (
                  <div key={`${medicine.name}-${index}`} style={{ border: `1px solid ${C.purpleBdr}`, borderRadius: 14, padding: 12, background: C.purpleBg }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{index + 1}. {medicine.name}</p>
                      <button onClick={() => removeMedicine(index)} title="Remove medicine"
                        style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${C.redBdr}`, background: C.redBg, color: C.red, cursor: "pointer" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                      {[
                        { key: "dose", label: "Dose", placeholder: "e.g. 500mg" },
                        { key: "frequency", label: "Frequency", placeholder: "e.g. Twice daily" },
                        { key: "duration", label: "Duration", placeholder: "e.g. 7 days" },
                      ].map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label style={sectionLabel}>{label}</label>
                          <input value={(medicine as any)[key]}
                            onChange={e => updateMedicine(index, key as keyof MedicineDraft, e.target.value)}
                            placeholder={placeholder} style={inp()} />
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <label style={sectionLabel}>Special instructions</label>
                      <textarea value={medicine.instructions}
                        onChange={e => updateMedicine(index, "instructions", e.target.value)}
                        placeholder="Take with food, avoid alcohol, before sleep..."
                        rows={2} style={{ ...inp(), resize: "vertical", lineHeight: 1.5 }} />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label style={sectionLabel}>Follow-up remark for next appointment</label>
                <textarea value={followUpRemark} onChange={e => setFollowUpRemark(e.target.value)}
                  placeholder="e.g. Patient needs a follow-up appointment after 7 days with CBC report."
                  rows={3} style={{ ...inp(), resize: "vertical", lineHeight: 1.5 }} />
              </div>

              <div style={{ border: `1px solid ${needsLabTest ? C.cyanBdr : C.borderMid}`, borderRadius: 14, padding: 12, background: needsLabTest ? C.cyanBg : "rgba(255,255,255,0.02)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: C.text, fontSize: 13, fontWeight: 800 }}>
                  <input
                    type="checkbox"
                    checked={needsLabTest}
                    onChange={e => {
                      const checked = e.target.checked;
                      setNeedsLabTest(checked);
                      if (!checked) {
                        setLabTests([]);
                        setLabPriority("Normal");
                        setLabNotes("");
                      }
                    }}
                  />
                  <FlaskConical size={15} color={needsLabTest ? C.cyan : C.dim} />
                  Needs Lab Test
                </label>

                {needsLabTest && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={sectionLabel}>Select tests</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8 }}>
                        {LAB_TESTS.map(test => {
                          const selected = labTests.includes(test);
                          return (
                            <button key={test} type="button" onClick={() => toggleLabTest(test)}
                              style={{
                                borderRadius: 10, padding: "9px 10px", cursor: "pointer",
                                border: `1px solid ${selected ? C.cyanBdr : C.borderMid}`,
                                background: selected ? C.cyanBg : "rgba(15,23,42,0.7)",
                                color: selected ? C.cyan : C.text,
                                fontSize: 12, fontWeight: 800, textAlign: "left",
                                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                              }}>
                              {test}
                              {selected && <Check size={13} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label style={sectionLabel}>Priority</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {(["Normal", "Urgent"] as const).map(priority => {
                          const selected = labPriority === priority;
                          const color = priority === "Urgent" ? C.red : C.cyan;
                          const bg = priority === "Urgent" ? C.redBg : C.cyanBg;
                          const bdr = priority === "Urgent" ? C.redBdr : C.cyanBdr;
                          return (
                            <button key={priority} type="button" onClick={() => setLabPriority(priority)}
                              style={{ borderRadius: 10, padding: "8px 10px", cursor: "pointer", border: `1px solid ${selected ? bdr : C.borderMid}`, background: selected ? bg : "rgba(15,23,42,0.7)", color: selected ? color : C.dim, fontSize: 12, fontWeight: 800 }}>
                              {priority}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label style={sectionLabel}>Lab notes</label>
                      <textarea value={labNotes} onChange={e => setLabNotes(e.target.value)}
                        placeholder="Clinical context, fasting instructions, suspected diagnosis..."
                        rows={2} style={{ ...inp(), resize: "vertical", lineHeight: 1.5 }} />
                    </div>
                  </div>
                )}
              </div>

              {error && <ErrorBox msg={error} />}
            </>
          )}
        </div>
        {!success && (
          <ModalFooter onCancel={onClose} onConfirm={handleSave} loading={saving} confirmLabel={needsLabTest ? "Save & Order Lab" : "Save Prescription"}
            icon={<Pill size={13} />} color={C.purple} colorBg={C.purpleBg} colorBdr={C.purpleBdr} />
        )}
      </ModalShell>
    </Overlay>
  );
}

function NotesModal({ patient, onClose, onSaved }: { patient: any; onClose: () => void; onSaved?: () => void }) {
  const [note,    setNote]    = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!note.trim()) { setError("Note cannot be empty."); return; }
    setSaving(true); setError("");
    try {
      // Uses POST /api/doctor/notes
      await api.post("/doctor/notes", { patientId: patient._id, note });
      setSuccess(true);
      setTimeout(() => { onSaved?.(); onClose(); }, 1200);
    } catch (err: any) {
      setError(err?.message || "Failed to save note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalShell title="Add Clinical Note" subtitle={`Patient: ${patient?.name}`} onClose={onClose} maxWidth={460} color={C.orange}>
        <div style={{ padding: "1.25rem 1.5rem" }}>
          {success ? <SuccessState msg="Note saved!" /> : (
            <>
              <label style={sectionLabel}>Clinical Note</label>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="Patient presented with… Assessment: … Plan: …"
                rows={7} style={{ ...inp(), resize: "vertical", lineHeight: 1.6 }} />
              {error && <div style={{ marginTop: 10 }}><ErrorBox msg={error} /></div>}
            </>
          )}
        </div>
        {!success && (
          <ModalFooter onCancel={onClose} onConfirm={handleSave} loading={saving} confirmLabel="Save Note"
            icon={<StickyNote size={13} />} color={C.orange}
            colorBg="rgba(249,115,22,0.1)" colorBdr="rgba(249,115,22,0.25)" />
        )}
      </ModalShell>
    </Overlay>
  );
}

// ── Report upload modal ───────────────────────────────────────────────────────
function ReportModal({ patient, onClose, onSaved }: { patient: any; onClose: () => void; onSaved?: () => void }) {
  const [file,      setFile]      = useState<File | null>(null);
  const [label,     setLabel]     = useState("");
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) { setError("Please select a file."); return; }
    setUploading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("patientId", patient._id);
      fd.append("label", label || file.name);
      // Uses POST /api/doctor/reports  (multipart)
      await api.uploadReport(fd);
      setSuccess(true);
      setTimeout(() => { onSaved?.(); onClose(); }, 1200);
    } catch (err: any) {
      setError(err?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalShell title="Upload Report" subtitle={`Patient: ${patient?.name}`} onClose={onClose} maxWidth={440} color={C.green}>
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: 14 }}>
          {success ? <SuccessState msg="Report uploaded!" /> : (
            <>
              <div>
                <label style={sectionLabel}>Report Label</label>
                <input value={label} onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Blood Test — June 2025" style={inp()} />
              </div>
              <div onClick={() => fileRef.current?.click()} style={{
                border: `2px dashed ${file ? C.greenBdr : C.borderMid}`, borderRadius: 12,
                padding: "1.5rem", textAlign: "center", cursor: "pointer",
                background: file ? C.greenBg : "transparent", transition: "all 0.2s",
              }}>
                <Upload size={22} color={file ? C.green : C.dim} style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: file ? C.green : C.dim, fontWeight: 600 }}>
                  {file ? file.name : "Click to select PDF or image"}
                </p>
                <p style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>PDF, JPG, PNG up to 10 MB</p>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
                  onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
              {error && <ErrorBox msg={error} />}
            </>
          )}
        </div>
        {!success && (
          <ModalFooter onCancel={onClose} onConfirm={handleUpload} loading={uploading} confirmLabel="Upload"
            icon={<Upload size={13} />} color={C.green} colorBg={C.greenBg} colorBdr={C.greenBdr} />
        )}
      </ModalShell>
    </Overlay>
  );
}

// ── Tiny shared components ────────────────────────────────────────────────────
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 11, color: C.dim, background: "rgba(255,255,255,0.04)",
      border: `1px solid ${C.border}`, padding: "2px 8px", borderRadius: 20,
    }}>{children}</span>
  );
}

function Tag({ children, color, bg, bdr }: { children: React.ReactNode; color: string; bg: string; bdr: string }) {
  return (
    <span style={{ fontSize: 11, background: bg, border: `1px solid ${bdr}`, color, padding: "3px 10px", borderRadius: 20 }}>
      {children}
    </span>
  );
}

function TabSpinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "3rem 0" }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.cyanBdr}`, borderTopColor: C.cyan, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
    </div>
  );
}

function EmptyState({ icon, msg }: { icon: React.ReactNode; msg: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "3rem 0", gap: 10 }}>
      {icon}
      <p style={{ fontSize: 12, color: C.dim }}>{msg}</p>
    </div>
  );
}

// ── Patient list helper (used by PatientsTab + ActionTab) ─────────────────────
async function fetchMyPatients() {
  try {
    const data = await api.get("/doctor/my-patients");
    // If no appointment-linked patients yet, fall back to all patients
    if (!data.patients?.length) {
      return api.listPatients("");
    }
    return data;
  } catch {
    return api.listPatients("");
  }
}

// ── Sub-cards shown inside patient detail ─────────────────────────────────────
function VitalsCard({ patient }: { patient: any }) {
  const v  = patient.vitals;
  const sc = statusColors[v?.status];
  const isCrit = v?.status === "Critical";

  return (
    <div style={{ ...card(), border: `1px solid ${isCrit ? C.redBdr : C.border}` }}>
      <div style={topBar(isCrit ? C.red : C.green)} />
      <div style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>📊 Vitals</p>
          {v?.status && <span style={badge(sc)}>● {v.status}</span>}
        </div>
        {!(v?.bloodPressure || v?.heartRate || v?.temperature) ? (
          <p style={{ fontSize: 12, color: C.dim, fontStyle: "italic" }}>
            No vitals recorded — click "Vitals" to add them.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {[
              { Icon: Activity,    label: "Blood Pressure", value: v.bloodPressure, unit: "mmHg" },
              { Icon: Heart,       label: "Heart Rate",     value: v.heartRate,     unit: "bpm"  },
              { Icon: Thermometer, label: "Temperature",    value: v.temperature,   unit: "°F"   },
            ].map(({ Icon, label, value, unit }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.025)", border: `1px solid ${C.border}`,
                borderRadius: 12, padding: 12, textAlign: "center",
              }}>
                <Icon size={15} color={C.cyan} style={{ marginBottom: 5 }} />
                <p style={{ fontSize: 17, fontWeight: 800, color: C.text }}>
                  {value ?? "—"}
                  {value && <span style={{ fontSize: 9, color: C.dim, marginLeft: 2 }}>{unit}</span>}
                </p>
                <p style={{ fontSize: 9, color: C.dim, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.3 }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}
        {v?.updatedAt && (
          <p style={{ fontSize: 10, color: C.dim, marginTop: 10, fontStyle: "italic" }}>
            Last updated: {new Date(v.updatedAt).toLocaleString()}
            {v?.updatedByRole === "nurse" || v?.nurseChecked ? ` by Nurse ${v.checkedByNurseName || v.updatedByName || ""}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function PrescriptionsCard({ prescriptions }: { prescriptions: any[] }) {
  if (!prescriptions?.length) return null;
  return (
    <div style={card()}>
      <div style={topBar(C.purple)} />
      <div style={{ padding: "1rem 1.25rem" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>💊 Prescriptions</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {prescriptions.map((rx, i) => (
            <div key={rx._id || i} style={{ background: C.purpleBg, border: `1px solid ${C.purpleBdr}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                  {rx.medications?.length ? `${rx.medications.length} medicine${rx.medications.length === 1 ? "" : "s"}` : rx.drugName}
                </p>
                <span style={{ fontSize: 10, color: C.dim }}>{rx.createdAt ? new Date(rx.createdAt).toLocaleDateString() : ""}</span>
              </div>
              <p style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{rx.dose} · {rx.frequency}{rx.duration ? ` · ${rx.duration}` : ""}</p>
              {rx.instructions && <p style={{ fontSize: 11, color: C.dim, marginTop: 3, fontStyle: "italic" }}>{rx.instructions}</p>}
              {rx.medications?.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {rx.medications.map((med: any, medIndex: number) => (
                    <div key={`${med.name}-${medIndex}`} style={{ borderTop: medIndex ? `1px solid ${C.purpleBdr}` : "none", paddingTop: medIndex ? 6 : 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{med.name}</p>
                      <p style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{[med.dose, med.frequency, med.duration].filter(Boolean).join(" | ")}</p>
                      {med.instructions && <p style={{ fontSize: 11, color: C.dim, marginTop: 2, fontStyle: "italic" }}>{med.instructions}</p>}
                    </div>
                  ))}
                </div>
              )}
              {(rx.followUpRemark || rx.advice) && (
                <p style={{ fontSize: 11, color: C.purple, marginTop: 8, fontWeight: 700 }}>Follow-up: {rx.followUpRemark || rx.advice}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClinicalNotesCard({ notes }: { notes: any[] }) {
  if (!notes?.length) return null;
  return (
    <div style={card()}>
      <div style={topBar(C.orange)} />
      <div style={{ padding: "1rem 1.25rem" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>📝 Clinical Notes</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((n, i) => (
            <div key={n._id || i} style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{n.note || n.text || n}</p>
              {n.createdAt && <p style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>{new Date(n.createdAt).toLocaleString()}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MedicalCard({ patient }: { patient: any }) {
  if (!patient.symptoms?.length && !patient.conditions?.length) return null;
  return (
    <div style={card()}>
      <div style={topBar(C.purple)} />
      <div style={{ padding: "1rem 1.25rem" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🩺 Medical Info</p>
        {patient.symptoms?.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <p style={sectionLabel}>Symptoms</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {patient.symptoms.map((s: string, i: number) => (
                <Tag key={i} color={C.cyan} bg={C.cyanBg} bdr={C.cyanBdr}>{s}</Tag>
              ))}
            </div>
          </div>
        )}
        {patient.conditions?.length > 0 && (
          <div>
            <p style={sectionLabel}>Conditions</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {patient.conditions.map((c: any, i: number) => (
                <Tag key={i} color={C.orange} bg="rgba(249,115,22,0.1)" bdr="rgba(249,115,22,0.25)">
                  {typeof c === "string" ? c : c.name}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APPOINTMENTS TAB
// ══════════════════════════════════════════════════════════════════════════════
function getAppointmentPatientName(appt: any) {
  return (
    appt.patientName ||
    appt.patientId?.name ||
    appt.patient?.name ||
    appt.fullName ||
    appt.name ||
    "Unknown"
  );
}

function AppointmentsTab() {
  const [appts,      setAppts]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState("");
  const [actionId,   setActionId]   = useState<string | null>(null);
  const [newIds,     setNewIds]     = useState<Set<string>>(new Set());
  const [newBanner,  setNewBanner]  = useState<string[]>([]);
  const prevIdsRef = useRef<Set<string>>(new Set());

  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const load = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const data = await api.get("/doctor/appointments/today");
      const incoming: any[] = data.appointments || [];

      // Detect new arrivals
      if (prevIdsRef.current.size > 0) {
        const arrived = incoming.filter(a => !prevIdsRef.current.has(String(a._id)));
        if (arrived.length > 0) {
          setNewBanner(arrived.map(a => getAppointmentPatientName(a)));
          setNewIds(new Set(arrived.map(a => String(a._id))));
          setTimeout(() => setNewIds(new Set()), 30_000);
        }
      }
      prevIdsRef.current = new Set(incoming.map(a => String(a._id)));

      // Sort by time ascending
      incoming.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
      setAppts(incoming);
    } catch (err: any) {
      setError(err?.message || "Could not load appointments.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const t = window.setInterval(() => load(true), 20_000);
    return () => window.clearInterval(t);
  }, []);

  const markAttendance = async (id: string, status: "completed" | "no-show") => {
    setActionId(`${id}:${status}`);
    try {
      const data = await api.updateAppointmentStatus(id, status);
      setAppts(prev => prev.map(a => a._id === id ? { ...a, status: data.appointment?.status || status } : a));
    } catch (err: any) {
      setError(err?.message || "Could not update.");
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <TabSpinner />;

  const attended  = appts.filter(a => a.status === "completed").length;
  const absent    = appts.filter(a => a.status === "no-show").length;
  const pending   = appts.filter(a => !["completed", "no-show", "cancelled"].includes(a.status)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Today's Appointments</h2>
          <p style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{todayLabel}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {refreshing && <Loader size={12} color={C.dim} style={{ animation: "spin 1s linear infinite" }} />}
          <button onClick={() => load(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.cyanBg, border: `1px solid ${C.cyanBdr}`, color: C.cyan, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { label: "Total",    val: appts.length, color: C.cyan,   bg: C.cyanBg,   bdr: C.cyanBdr },
          { label: "Pending",  val: pending,       color: C.orange, bg: "rgba(249,115,22,0.08)", bdr: "rgba(249,115,22,0.25)" },
          { label: "Present",  val: attended,      color: C.green,  bg: C.greenBg,  bdr: C.greenBdr },
          { label: "Absent",   val: absent,        color: C.red,    bg: C.redBg,    bdr: C.redBdr },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, background: s.bg, border: `1px solid ${s.bdr}`, borderRadius: 8, padding: "4px 10px" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.val}</span>
            <span style={{ fontSize: 10, color: s.color, opacity: 0.8 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* New arrivals banner */}
      <AnimatePresence>
        {newBanner.length > 0 && (
          <motion.div key="banner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={14} color={C.green} />
              <p style={{ fontSize: 12, fontWeight: 700, color: C.green }}>
                New booking{newBanner.length > 1 ? "s" : ""}: {newBanner.join(", ")}
              </p>
            </div>
            <button onClick={() => setNewBanner([])} style={{ background: "transparent", border: "none", color: C.dim, cursor: "pointer" }}>
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <ErrorBox msg={error} />}

      {appts.length === 0 && !error
        ? <EmptyState icon={<Calendar size={24} color={C.dim} />} msg="No appointments scheduled for today" />
        : appts.map((appt, i) => {
            const patientName = getAppointmentPatientName(appt);
            const reason      = appt.reason
              || (Array.isArray(appt.symptoms) && appt.symptoms.length ? appt.symptoms.join(", ") : "")
              || appt.specialty || "General consultation";
            const isCritical  = isCriticalCase(appt);
            const isNew       = newIds.has(String(appt._id));
            const isDone      = appt.status === "completed" || appt.status === "no-show" || appt.status === "cancelled";

            return (
              <motion.div key={appt._id || i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                style={{ ...card({ border: `1px solid ${isNew ? "rgba(16,185,129,0.4)" : isCritical ? C.redBdr : C.border}` }), padding: "1rem 1.25rem" }}>

                {isNew && <div style={{ height: 2, background: "linear-gradient(90deg,transparent,#10b981,transparent)", margin: "-1rem -1.25rem 0.75rem" }} />}

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

                  {/* Time badge */}
                  <div style={{ minWidth: 52, textAlign: "center", background: C.cyanBg, border: `1px solid ${C.cyanBdr}`, borderRadius: 10, padding: "6px 4px", flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: C.cyan }}>{appt.time || "—"}</p>
                  </div>

                  {/* Patient info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{patientName}</p>
                      {isNew && <span style={{ fontSize: 9, fontWeight: 900, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: C.green, borderRadius: 6, padding: "2px 6px", textTransform: "uppercase" }}>NEW</span>}
                      {isCritical && <span style={{ ...badge(statusColors.Critical) }}>CRITICAL</span>}
                      {appt.bookedVia === "voice"      && <span style={{ fontSize: 9, fontWeight: 700, background: C.purpleBg, border: `1px solid ${C.purpleBdr}`, color: C.purple, borderRadius: 6, padding: "2px 6px", textTransform: "uppercase" }}>Voice</span>}
                      {appt.bookedVia === "emergency"  && <span style={{ fontSize: 9, fontWeight: 700, background: C.redBg,    border: `1px solid ${C.redBdr}`,    color: C.red,    borderRadius: 6, padding: "2px 6px", textTransform: "uppercase" }}>Emergency</span>}
                    </div>
                    <p style={{ fontSize: 11, color: C.dim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>{reason}</p>
                  </div>

                  {/* Attendance actions */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    {appt.status === "completed" ? (
                      <span style={{ ...badge({ bg: C.greenBg, border: C.greenBdr, text: C.green }), display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Check size={10} /> Present
                      </span>
                    ) : appt.status === "no-show" ? (
                      <span style={{ ...badge({ bg: C.redBg, border: C.redBdr, text: C.red }), display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <X size={10} /> Absent
                      </span>
                    ) : appt.status === "cancelled" ? (
                      <span style={{ ...badge({ bg: C.redBg, border: C.redBdr, text: C.red }) }}>Cancelled</span>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        {/* ✓ Present */}
                        <button
                          onClick={() => markAttendance(appt._id, "completed")}
                          disabled={actionId !== null}
                          title="Mark as present"
                          style={{ width: 36, height: 36, borderRadius: 10, background: C.greenBg, border: `1px solid ${C.greenBdr}`, color: C.green, cursor: actionId !== null ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {actionId === `${appt._id}:completed` ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={16} />}
                        </button>
                        {/* ✗ Absent */}
                        <button
                          onClick={() => markAttendance(appt._id, "no-show")}
                          disabled={actionId !== null}
                          title="Mark as absent"
                          style={{ width: 36, height: 36, borderRadius: 10, background: C.redBg, border: `1px solid ${C.redBdr}`, color: C.red, cursor: actionId !== null ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {actionId === `${appt._id}:no-show` ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <X size={16} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PATIENTS TAB
// ══════════════════════════════════════════════════════════════════════════════
function PatientsTab() {
  const [patients, setPatients] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [modal,    setModal]    = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchMyPatients();
        setPatients(data.patients || []);
      } catch (err: any) {
        setError(err?.message || "Could not load patients.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = sortCriticalFirst(patients.filter(p =>
    !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase()) ||
    p._id?.toLowerCase().includes(search.toLowerCase())
  ));

  const handleVitalsSaved = (updated: any) => {
    setPatients(prev => prev.map(p => p._id === updated._id ? updated : p));
    setSelected((prev: any) => ({
      ...prev,
      ...updated,
      prescriptions: prev?.prescriptions || updated.prescriptions,
      clinicalNotes: prev?.clinicalNotes || updated.clinicalNotes,
    }));
  };

  const openPatient = async (patient: any) => {
    setSelected(patient);
    try {
      const data = await api.getPatient(patient._id);
      setSelected(data.patient);
      setPatients(prev => prev.map(p => p._id === data.patient._id ? data.patient : p));
    } catch (err: any) {
      setError(err?.message || "Could not load patient record.");
    }
  };

  // After prescription/note/report — refresh patient detail from server
  const refreshSelected = async () => {
    if (!selected) return;
    try {
      const data = await api.getPatient(selected._id);
      setSelected(data.patient);
      setPatients(prev => prev.map(p => p._id === data.patient._id ? data.patient : p));
    } catch { /* silent */ }
  };

  if (loading) return <TabSpinner />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1rem", alignItems: "start" }}>
      {/* Left: patient list */}
      <div style={card()}>
        <div style={topBar()} />
        <div style={{ padding: "1rem" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>My Patients</p>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={13} color={C.dim} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name or ID..." style={{ ...inp(), paddingLeft: 30 }} />
          </div>
          {error && <p style={{ fontSize: 11, color: C.red, marginBottom: 6 }}>{error}</p>}
          <div style={{ maxHeight: "calc(100vh - 270px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
            {filtered.length === 0
              ? <p style={{ fontSize: 12, color: C.dim, textAlign: "center", padding: "2rem 0" }}>No patients found</p>
              : filtered.map(p => {
                  const sc = statusColors[p.vitals?.status];
                  const isActive = selected?._id === p._id;
                  const isCritical = isCriticalCase(p);
                  const nurseChecked = isNurseChecked(p);
                  return (
                    <motion.button key={p._id} whileHover={{ x: 2 }} onClick={() => openPatient(p)}
                      style={{
                        width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 10, cursor: "pointer",
                        background: isActive ? C.cyanBg : isCritical ? C.redBg : nurseChecked ? C.greenBg : "rgba(255,255,255,0.015)",
                        border: `1px solid ${isActive ? C.cyanBdr : isCritical ? C.redBdr : nurseChecked ? C.greenBdr : "transparent"}`,
                        color: C.text, fontFamily: "inherit", transition: "all 0.15s",
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                            {p.name}
                            {nurseChecked && <CheckCircle size={12} color={C.green} />}
                          </p>
                          <p style={{ fontSize: 10, color: C.dim, marginTop: 1 }}>{p.email}</p>
                        </div>
                        {p.vitals?.status && <span style={badge(sc)}>{p.vitals.status}</span>}
                      </div>
                    </motion.button>
                  );
                })
            }
          </div>
        </div>
      </div>

      {/* Right: patient detail */}
      <div>
        {!selected ? (
          <div style={{ ...card(), height: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: C.cyanBg, border: `1px solid ${C.cyanBdr}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={20} color={C.cyan} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Select a patient</p>
            <p style={{ fontSize: 12, color: C.dim }}>Click any patient from the list</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={selected._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

              {/* Header */}
              <div style={card()}>
                <div style={topBar()} />
                <div style={{ padding: "1.1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{selected.name}</h2>
                    <p style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{selected.email}</p>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      {selected.age    && <Chip>{selected.age} yrs</Chip>}
                      {selected.gender && <Chip>{selected.gender}</Chip>}
                      {selected.blood  && <Chip>Blood: {selected.blood}</Chip>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {[
                      { label: "Vitals",       icon: <Activity size={12} />,   action: "vitals",       color: C.cyan,   bg: C.cyanBg,   bdr: C.cyanBdr   },
                      { label: "Prescription", icon: <Pill size={12} />,        action: "prescription", color: C.purple, bg: C.purpleBg, bdr: C.purpleBdr },
                      { label: "Notes",        icon: <StickyNote size={12} />, action: "notes",        color: C.orange, bg: "rgba(249,115,22,0.1)", bdr: "rgba(249,115,22,0.25)" },
                      { label: "Report",       icon: <Upload size={12} />,      action: "reports",      color: C.green,  bg: C.greenBg,  bdr: C.greenBdr  },
                    ].map(({ label, icon, action, color, bg, bdr }) => (
                      <motion.button key={action} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => setModal(action)}
                        style={{ background: bg, border: `1px solid ${bdr}`, color, padding: "6px 12px", borderRadius: 9, cursor: "pointer", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
                        {icon} {label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {isNurseChecked(selected) && (
                <div style={{ ...card(), border: `1px solid ${C.greenBdr}`, background: C.greenBg }}>
                  <div style={{ padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle size={16} color={C.green} />
                    <p style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>
                      Vitals checked by Nurse {selected.vitals?.checkedByNurseName || selected.vitals?.updatedByName || ""}. Please review before consultation.
                    </p>
                  </div>
                </div>
              )}

              <VitalsCard patient={selected} />
              <MedicalCard patient={selected} />
              <PrescriptionsCard prescriptions={selected.prescriptions} />
              <ClinicalNotesCard notes={selected.clinicalNotes} />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === "vitals"       && selected && <VitalsModal       patient={selected} onClose={() => setModal(null)} onSaved={handleVitalsSaved} />}
        {modal === "prescription" && selected && <PrescriptionModal patient={selected} onClose={() => setModal(null)} onSaved={refreshSelected} />}
        {modal === "notes"        && selected && <NotesModal        patient={selected} onClose={() => setModal(null)} onSaved={refreshSelected} />}
        {modal === "reports"      && selected && <ReportModal       patient={selected} onClose={() => setModal(null)} onSaved={refreshSelected} />}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTION TAB (standalone Prescription / Notes / Reports tabs)
// ══════════════════════════════════════════════════════════════════════════════
function ActionTab({ title, icon: Icon, color, colorBg, colorBdr, ModalComponent, actionLabel }: {
  title: string; icon: React.ElementType; color: string;
  colorBg: string; colorBdr: string;
  ModalComponent: React.ComponentType<any>; actionLabel: string;
}) {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [search,   setSearch]   = useState("");
  const [modal,    setModal]    = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchMyPatients();
        setPatients(data.patients || []);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = sortCriticalFirst(patients.filter(p =>
    !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase()) ||
    p._id?.toLowerCase().includes(search.toLowerCase())
  ));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{title}</h2>
        {selected && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setModal(true)}
              style={{ background: colorBg, border: `1px solid ${colorBdr}`, color, padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
              <Icon size={13} /> {actionLabel} for {selected.name}
            </motion.button>
            {actionLabel === "Write Prescription" && (
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigate("/lab/order")}
                style={{ background: C.cyanBg, border: `1px solid ${C.cyanBdr}`, color: C.cyan, padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                <FlaskConical size={13} /> Order Lab Test
              </motion.button>
            )}
          </div>
        )}
      </div>

      <div style={card()}>
        <div style={topBar(color)} />
        <div style={{ padding: "1rem" }}>
          <p style={{ fontSize: 12, color: C.dim, marginBottom: 8 }}>Select a patient first</p>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={12} color={C.dim} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search patient or ID..." style={{ ...inp(), paddingLeft: 30 }} />
          </div>
          {loading ? <TabSpinner /> : (
            <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {filtered.map(p => {
                const isActive = selected?._id === p._id;
                const isCritical = isCriticalCase(p);
                const nurseChecked = isNurseChecked(p);
                return (
                  <motion.button key={p._id} whileHover={{ x: 2 }} onClick={() => setSelected(p)}
                    style={{ width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 10, cursor: "pointer", background: isActive ? colorBg : isCritical ? C.redBg : nurseChecked ? C.greenBg : "rgba(255,255,255,0.015)", border: `1px solid ${isActive ? colorBdr : isCritical ? C.redBdr : nurseChecked ? C.greenBdr : "transparent"}`, color: C.text, fontFamily: "inherit" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                          {p.name}
                          {nurseChecked && <CheckCircle size={12} color={C.green} />}
                        </p>
                        <p style={{ fontSize: 10, color: C.dim }}>{p.email}</p>
                      </div>
                      {p.vitals?.status && <span style={badge(statusColors[p.vitals.status])}>{p.vitals.status}</span>}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {modal && selected && (
          <ModalComponent patient={selected} onClose={() => setModal(false)} onSaved={() => setModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
export default function DoctorDashboard() {
  const navigate   = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("appointments");
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!localStorage.getItem("medicare_token")) navigate("/login");
  }, [navigate]);

  useEffect(() => {
    api.get("/notifications")
      .then(data => setNotifications(data.notifications || []))
      .catch(() => setNotifications([]));
  }, []);

  const handleLogout = () => { logout(); navigate("/", { replace: true }); };
  const unreadNotifications = notifications.filter(notification => !notification.isRead).slice(0, 3);

  const markAllNotificationsRead = async () => {
    if (!unreadNotifications.length) return;
    setNotifications(prev => prev.map(notification => ({ ...notification, isRead: true })));
    await api.patch("/notifications/read-all", {}).catch(() => null);
  };

  const renderTab = () => {
    switch (activeTab) {
      case "appointments": return <AppointmentsTab />;
      case "availability": return <AvailabilityTab />;
      case "patients":     return <PatientsTab />;
      case "prescription": return (
        <ActionTab title="Write Prescription" icon={Pill} color={C.purple}
          colorBg={C.purpleBg} colorBdr={C.purpleBdr}
          ModalComponent={PrescriptionModal} actionLabel="Write Prescription" />
      );
      case "notes": return (
        <ActionTab title="Add Clinical Notes" icon={StickyNote} color={C.orange}
          colorBg="rgba(249,115,22,0.1)" colorBdr="rgba(249,115,22,0.25)"
          ModalComponent={NotesModal} actionLabel="Add Note" />
      );
      case "reports": return (
        <ActionTab title="Upload Reports" icon={Upload} color={C.green}
          colorBg={C.greenBg} colorBdr={C.greenBdr}
          ModalComponent={ReportModal} actionLabel="Upload Report" />
      );
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, -apple-system, sans-serif", color: C.text }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse 60% 40% at 70% 5%, rgba(6,182,212,0.04) 0%, transparent 60%)" }} />

      {/* Navbar */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(2,8,23,0.88)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${C.border}`, padding: "0 1.5rem",
        height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: C.cyanBg, border: `1px solid ${C.cyanBdr}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HeartPulse size={15} color={C.cyan} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 15 }}>MediCare <span style={{ color: C.cyan }}>AI</span></span>
          <span style={{ color: C.border, margin: "0 6px" }}>|</span>
          <span style={{ fontSize: 12, color: C.dim }}>Doctor Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 148 }}>
          {unreadNotifications.length > 0 && (
            <div style={{ minWidth: 260, maxWidth: 360, background: C.surface, border: `1px solid ${C.cyanBdr}`, borderRadius: 12, padding: "8px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: C.cyan, fontSize: 12, fontWeight: 800 }}>
                  <Bell size={13} /> Notifications
                </span>
                <button onClick={markAllNotificationsRead} style={{ background: "transparent", border: `1px solid ${C.borderMid}`, color: C.dim, borderRadius: 7, padding: "3px 7px", fontSize: 10, cursor: "pointer" }}>
                  Mark read
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {unreadNotifications.map(notification => (
                  <div key={notification._id} style={{ fontSize: 11, color: C.text, lineHeight: 1.35 }}>
                    <strong>{notification.title || "Notification"}:</strong> {notification.message}
                  </div>
                ))}
              </div>
            </div>
          )}
          {user?.name && (
            <span style={{ fontSize: 12, color: C.dim }}>{formatDoctorName(user.name)}</span>
          )}
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigate("/lab/doctor-reports")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: C.cyanBg, border: `1px solid ${C.cyanBdr}`, color: C.cyan, padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
            <FlaskConical size={13} /> Lab Results
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleLogout}
            style={{ display: "flex", alignItems: "center", gap: 6, background: C.redBg, border: `1px solid ${C.redBdr}`, color: C.red, padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>
            <LogOut size={13} /> Sign out
          </motion.button>
        </div>
      </nav>

      {/* Tab bar */}
      <div style={{
        position: "sticky", top: 56, zIndex: 40,
        background: "rgba(2,8,23,0.9)", backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${C.border}`, padding: "0 1.5rem",
        display: "flex", gap: 2, overflowX: "auto",
      }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "12px 14px", background: "none", border: "none",
              borderBottom: `2px solid ${active ? C.cyan : "transparent"}`,
              color: active ? C.cyan : C.dim, cursor: "pointer",
              fontSize: 12, fontWeight: active ? 700 : 400,
              fontFamily: "inherit", whiteSpace: "nowrap", transition: "all 0.15s",
            }}>
              <Icon size={13} /> {label}
            </button>
          );
        })}
      </div>

      {/* Page content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", position: "relative", zIndex: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0 }
        select option { background: #0a1222; color: #e2e8f0 }
        ::-webkit-scrollbar { width: 4px; height: 4px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.15); border-radius: 4px }
        button:focus-visible { outline: 2px solid #06b6d4; outline-offset: 2px }
      `}</style>
    </div>
  );
}
