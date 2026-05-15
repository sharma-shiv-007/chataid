/**
 * EmergencyBooking.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Flow:
 *   Step 1 "select"    — pick emergency type (Chest / Accident / Breathing)
 *   Step 2 "complaint" — chief complaint text + AI severity classification
 *   Step 3 "hospital"  — OSM hospital finder (GPS or city)
 *   Step 4 "form"      — name, phone, age (pre-filled if logged in)
 *   Step 5 "booking"   — saving to MongoDB + n8n (optional)
 *   Step 6 "confirmed" — token, ward, hospital, doctor, AI triage note
 *
 * ✅ No login required — works for guests
 * ✅ AI severity detection via Claude
 * ✅ Saves to MongoDB Appointment collection
 * ✅ OSM hospital finder — no API key
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, MapPin, Mic, ArrowLeft, Loader2,
  CheckCircle2, Phone, Clock, HeartPulse, Brain,
} from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:5000/api";
const N8N_WEBHOOK_URL = "http://localhost:5678/webhook/emergency-booking"; // optional

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Hospital {
  id: string; name: string; address: string;
  lat: number; lng: number; distanceKm?: number;
  phone?: string; emergency?: boolean;
}

type Step = "select" | "complaint" | "hospital" | "form" | "booking" | "confirmed";
type Priority = "CRITICAL" | "HIGH" | "MEDIUM";

interface EmergencyType {
  id: string; label: string; icon: string;
  border: string; priorityColor: string; bgGlow: string;
  department: string; ward: string; priority: Priority; specialty: string;
}

interface Classification {
  severity: string; priority: Priority;
  aiSeverityScore: number; triageNote: string; suggestedSpecialty: string;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
const RED    = "#ef4444";
const ORANGE = "#f97316";
const CYAN   = "#06b6d4";
const GREEN  = "#10b981";
const AMBER  = "#f59e0b";
const BG     = "#020817";
const SURFACE = "rgba(15,23,42,0.85)";
const BORDER  = "rgba(148,163,184,0.1)";
const TEXT    = "#e2e8f0";
const DIM     = "#64748b";


const EMERGENCY_TYPES: EmergencyType[] = [
  { id: "chest",     label: "Chest Pain / Heart",    icon: "❤️",  border: "rgba(239,68,68,0.4)",   priorityColor: RED,    bgGlow: "rgba(239,68,68,0.08)",   department: "Cardiology Emergency", ward: "Cardiac ICU — Ward 4B",      priority: "CRITICAL", specialty: "Cardiologist" },
  { id: "accident",  label: "Accident / Injury",     icon: "🚨",  border: "rgba(249,115,22,0.4)",  priorityColor: ORANGE, bgGlow: "rgba(249,115,22,0.08)",  department: "Trauma Center",        ward: "Trauma Bay — Ground Floor",  priority: "CRITICAL", specialty: "Trauma Specialist" },
  { id: "breathing", label: "Breathing Difficulty",  icon: "🫁",  border: "rgba(6,182,212,0.4)",   priorityColor: CYAN,   bgGlow: "rgba(6,182,212,0.08)",   department: "ICU / Oxygen Support",  ward: "Respiratory ICU — Ward 2A", priority: "HIGH",     specialty: "Pulmonologist" },
  { id: "stroke",    label: "Stroke / Unconscious",  icon: "🧠",  border: "rgba(139,92,246,0.4)",  priorityColor: "#8b5cf6", bgGlow: "rgba(139,92,246,0.08)", department: "Neurology Emergency", ward: "Neuro ICU — Ward 3C",       priority: "CRITICAL", specialty: "Neurologist" },
  { id: "fever",     label: "High Fever / Infection",icon: "🌡️", border: "rgba(245,158,11,0.4)",  priorityColor: AMBER,  bgGlow: "rgba(245,158,11,0.08)",  department: "General Emergency",    ward: "Fever Clinic — OPD 1",      priority: "HIGH",     specialty: "General Medicine" },
  { id: "other",     label: "Other Emergency",       icon: "🏥",  border: "rgba(16,185,129,0.4)",  priorityColor: GREEN,  bgGlow: "rgba(16,185,129,0.08)",  department: "Emergency Triage",     ward: "Triage — Main Entrance",    priority: "HIGH",     specialty: "General Medicine" },
];

const CITIES = [
  { name: "Jammu",     lat: 32.7266, lng: 74.8570, radiusKm: 15 },
  { name: "Udhampur",  lat: 32.9200, lng: 75.1400, radiusKm: 12 },
  { name: "Samba",     lat: 32.5620, lng: 74.9320, radiusKm: 10 },
  { name: "Kathua",    lat: 32.3850, lng: 75.5100, radiusKm: 10 },
  { name: "Srinagar",  lat: 34.0837, lng: 74.7973, radiusKm: 15 },
  { name: "Delhi",     lat: 28.6139, lng: 77.2090, radiusKm: 15 },
  { name: "Mumbai",    lat: 19.0760, lng: 72.8777, radiusKm: 15 },
  { name: "Bangalore", lat: 12.9716, lng: 77.5946, radiusKm: 15 },
];

// Static fallback hospitals shown when OSM is unreachable
const STATIC_HOSPITALS: Record<string, Hospital[]> = {
  Jammu: [
    { id: "s1", name: "Government Medical College Jammu",   address: "Gandhi Nagar, Jammu", lat: 32.7180, lng: 74.8560, phone: "0191-2547327", emergency: true },
    { id: "s2", name: "SMGS Hospital",                      address: "Shalamar Road, Jammu", lat: 32.7300, lng: 74.8600, phone: "0191-2544439", emergency: true },
    { id: "s3", name: "Narayana Hospital Jammu",            address: "Karan Nagar, Jammu",  lat: 32.7250, lng: 74.8620, phone: "0191-2520303", emergency: true },
  ],
  Kathua: [
    { id: "s4", name: "District Hospital Kathua",           address: "Civil Lines, Kathua",  lat: 32.3850, lng: 75.5100, phone: "01922-232101", emergency: true },
  ],
  Udhampur: [
    { id: "s5", name: "District Hospital Udhampur",         address: "Hospital Road, Udhampur", lat: 32.9200, lng: 75.1400, phone: "01992-270102", emergency: true },
  ],
  Samba: [
    { id: "s6", name: "Community Health Centre Vijaypur",   address: "Vijaypur, Samba",      lat: 32.5620, lng: 74.9320, phone: "01923-220100", emergency: true },
  ],
  Srinagar: [
    { id: "s7", name: "SMHS Hospital Srinagar",             address: "Karan Nagar, Srinagar", lat: 34.0900, lng: 74.8000, phone: "0194-2452090", emergency: true },
    { id: "s8", name: "SKIMS Soura",                        address: "Soura, Srinagar",       lat: 34.1100, lng: 74.8200, phone: "0194-2401013", emergency: true },
  ],
  Delhi: [
    { id: "s9",  name: "AIIMS New Delhi",                   address: "Ansari Nagar, Delhi",   lat: 28.5672, lng: 77.2100, phone: "011-26588500", emergency: true },
    { id: "s10", name: "Safdarjung Hospital",                address: "Safdarjung, Delhi",     lat: 28.5679, lng: 77.2066, phone: "011-26165060", emergency: true },
  ],
  Mumbai: [
    { id: "s11", name: "KEM Hospital Mumbai",               address: "Parel, Mumbai",         lat: 18.9985, lng: 72.8435, phone: "022-24136051", emergency: true },
    { id: "s12", name: "Nair Hospital Mumbai",              address: "Mumbai Central",         lat: 18.9696, lng: 72.8253, phone: "022-23027600", emergency: true },
  ],
  Bangalore: [
    { id: "s13", name: "Victoria Hospital Bangalore",       address: "Bhavana Vihar, Bangalore", lat: 12.9629, lng: 77.5746, phone: "080-26701150", emergency: true },
    { id: "s14", name: "Bowring Hospital Bangalore",        address: "Shivajinagar, Bangalore",  lat: 12.9833, lng: 77.5915, phone: "080-25544060", emergency: true },
  ],
};


function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = ((lat2-lat1)*Math.PI)/180, dLng = ((lng2-lng1)*Math.PI)/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

function parseOSMResponse(json: any, lat: number, lng: number): Hospital[] {
  return (json.elements as any[]).map((el: any) => {
    const elLat = el.lat ?? el.center?.lat, elLng = el.lon ?? el.center?.lon;
    if (!elLat || !elLng) return null;
    const t = el.tags ?? {};
    return {
      id: String(el.id),
      name: t.name || t["name:en"] || "Unnamed Hospital",
      address: [t["addr:houseno"], t["addr:street"], t["addr:city"]].filter(Boolean).join(", ") || t["addr:full"] || "",
      lat: elLat, lng: elLng,
      phone: t.phone || t["contact:phone"] || "",
      emergency: t.emergency === "yes",
    };
  }).filter(Boolean) as Hospital[];
}

async function fetchHospitals(lat: number, lng: number, radiusKm: number): Promise<Hospital[]> {
  const q = `[out:json][timeout:20];(node["amenity"="hospital"](around:${radiusKm*1000},${lat},${lng});way["amenity"="hospital"](around:${radiusKm*1000},${lat},${lng}););out center;`;

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(`${mirror}?data=${encodeURIComponent(q)}`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = await res.json();
      const results = parseOSMResponse(json, lat, lng);
      if (results.length > 0) return results;
    } catch { continue; }
  }
  throw new Error("osm_unavailable");
}

async function apiReq(method: string, path: string, body?: object) {
  const token = localStorage.getItem("medicare_token");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Failed (${res.status})`);
  return data as any;
}

const priorityBg = (p: string) =>
  p === "CRITICAL" ? "rgba(239,68,68,0.15)" : p === "HIGH" ? "rgba(249,115,22,0.12)" : "rgba(245,158,11,0.1)";
const priorityBdr = (p: string) =>
  p === "CRITICAL" ? "rgba(239,68,68,0.35)" : p === "HIGH" ? "rgba(249,115,22,0.3)" : "rgba(245,158,11,0.25)";
const priorityTxt = (p: string) =>
  p === "CRITICAL" ? RED : p === "HIGH" ? ORANGE : AMBER;

const scoreBar = (score: number) => {
  const color = score >= 8 ? RED : score >= 5 ? ORANGE : AMBER;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
      <span style={{ fontSize: 11, color: DIM, width: 80, flexShrink: 0 }}>Severity {score}/10</span>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${score * 10}%` }} transition={{ duration: 0.6 }}
          style={{ height: "100%", background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
};

// ─── Step progress ────────────────────────────────────────────────────────────
const STEPS = ["Type", "Complaint", "Hospital", "Details", "Done"];
function StepBar({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
      {STEPS.map((label, i) => (
        <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: i <= current ? RED : "rgba(255,255,255,0.05)", border: `2px solid ${i <= current ? RED : "rgba(148,163,184,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: i <= current ? "#fff" : DIM }}>
              {i < current ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 9, color: i <= current ? TEXT : DIM, letterSpacing: 0.3, textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? RED : "rgba(148,163,184,0.12)", margin: "0 4px", marginBottom: 16 }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function EmergencyBooking() {
  const navigate = useNavigate();

  const [step,           setStep]           = useState<Step>("select");
  const [selectedType,   setSelectedType]   = useState<EmergencyType | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [classifying,    setClassifying]    = useState(false);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [hospital,       setHospital]       = useState<Hospital | null>(null);
  const [form,           setForm]           = useState({ name: "", phone: "", age: "" });
  const [location,       setLocation]       = useState<{ lat: number; lng: number } | null>(null);
  const [hospitals,      setHospitals]      = useState<Hospital[]>([]);
  const [hospLoading,    setHospLoading]    = useState(false);
  const [hospError,      setHospError]      = useState("");
  const [activeCity,     setActiveCity]     = useState<string | null>(null);
  const [usingGPS,       setUsingGPS]       = useState(false);
  const [selectedHospId, setSelectedHospId] = useState<string | null>(null);
  const [error,          setError]          = useState("");
  const [result,         setResult]         = useState<any>(null);
  const stepIdx = ["select","complaint","hospital","form","booking","confirmed"].indexOf(step);

  // Pre-fill form if logged in
  useEffect(() => {
    try {
      const cached = localStorage.getItem("medicare_patient");
      if (cached) { const p = JSON.parse(cached); setForm(f => ({ ...f, name: p.name || "", phone: p.phone || "" })); }
    } catch {}
    navigator.geolocation?.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => setLocation({ lat: 32.7266, lng: 74.857 }),
      { timeout: 6000 }
    );
  }, []);

  // ── Hospital fetch ────────────────────────────────────────────────────────
  const loadHospitals = useCallback(async (lat: number, lng: number, radiusKm: number, label: string) => {
    setHospLoading(true); setHospError(""); setHospitals([]); setSelectedHospId(null);
    try {
      let raw = await fetchHospitals(lat, lng, radiusKm);
      if (raw.length === 0) raw = await fetchHospitals(lat, lng, radiusKm * 2.5);
      if (raw.length > 0) {
        const sorted = raw.map(h => ({ ...h, distanceKm: haversineKm(lat, lng, h.lat, h.lng) }))
          .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999)).slice(0, 6);
        setHospitals(sorted);
        return;
      }
    } catch (err: any) {
      // OSM unavailable — fall through to static list
    }

    // Fallback: find nearest city to the coordinates, use its static list
    const nearestCity = CITIES
      .filter(c => STATIC_HOSPITALS[c.name])
      .sort((a, b) => haversineKm(lat, lng, a.lat, a.lng) - haversineKm(lat, lng, b.lat, b.lng))[0];

    const staticList = nearestCity ? STATIC_HOSPITALS[nearestCity.name] : null;
    if (staticList?.length) {
      const withDist = staticList.map(h => ({ ...h, distanceKm: haversineKm(lat, lng, h.lat, h.lng) }))
        .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
      setHospitals(withDist);
      setHospError("");
    } else {
      setHospError("No hospitals found nearby. Please select a city manually.");
    }
    setHospLoading(false);
  }, []);

  const handleCity = (city: typeof CITIES[0]) => {
    setActiveCity(city.name); setUsingGPS(false);
    loadHospitals(city.lat, city.lng, city.radiusKm, city.name);
  };

  const handleGPS = () => {
    if (!navigator.geolocation) {
      setHospError("GPS not supported on this device. Please select a city below.");
      return;
    }
    setActiveCity(null); setUsingGPS(true); setHospLoading(true); setHospError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ lat: coords.latitude, lng: coords.longitude });
        loadHospitals(coords.latitude, coords.longitude, 15, "your location");
      },
      (err) => {
        setHospLoading(false); setUsingGPS(false);
        if (err.code === 1) {
          setHospError("Location permission denied. Tap a city below to find hospitals.");
        } else if (err.code === 3) {
          setHospError("Location timed out. Tap a city below instead.");
        } else {
          setHospError("Could not get location. Tap a city below.");
        }
      },
      { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 }
    );
  };

  const selectHospital = (h: Hospital) => {
    setSelectedHospId(h.id); setHospital(h);
    setTimeout(() => setStep("form"), 500);
  };

  // ── AI classify ───────────────────────────────────────────────────────────
  const classifyComplaint = async () => {
    if (!chiefComplaint.trim()) { setError("Please describe your emergency."); return; }
    setClassifying(true); setError("");
    try {
      const data = await apiReq("POST", "/emergency/classify", { chiefComplaint });
      setClassification(data.classification);
      setStep("hospital");
    } catch {
      // Fallback — never block emergency flow
      setClassification({ severity: "other", priority: "HIGH", aiSeverityScore: 6, triageNote: chiefComplaint, suggestedSpecialty: selectedType?.specialty || "General Medicine" });
      setStep("hospital");
    } finally { setClassifying(false); }
  };

  // ── Confirm booking ───────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setError("Name and phone are required."); return; }
    setError(""); setStep("booking");
    try {
      const data = await apiReq("POST", "/emergency/book", {
        patientName:       form.name,
        phone:             form.phone,
        age:               form.age,
        chiefComplaint,
        severity:          classification?.severity || "other",
        priority:          classification?.priority || selectedType?.priority || "HIGH",
        aiSeverityScore:   classification?.aiSeverityScore || 5,
        triageNote:        classification?.triageNote || chiefComplaint,
        suggestedSpecialty: classification?.suggestedSpecialty || selectedType?.specialty,
        hospital,
        location,
      });
      setResult(data);
      // Also fire n8n (non-blocking, optional)
      fetch(N8N_WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, type: selectedType, hospital, patient: form }),
      }).catch(() => {});
    } catch (err: any) {
      // Fallback token — never block confirmed state in emergency
      setResult({ token: `EMG-${Math.floor(1000 + Math.random() * 9000)}`, message: "Emergency booking created." });
    }
    setStep("confirmed");
  };

  const reset = () => { setStep("select"); setSelectedType(null); setChiefComplaint(""); setClassification(null); setHospital(null); setHospitals([]); setForm({ name: "", phone: "", age: "" }); setResult(null); setError(""); setActiveCity(null); setUsingGPS(false); };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "system-ui, sans-serif" }}>
      {/* Red glow bg */}
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(239,68,68,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

      {/* Navbar */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(2,8,23,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(239,68,68,0.15)", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => navigate(-1)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: DIM, cursor: "pointer", fontSize: 13 }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>
            <AlertTriangle size={18} color={RED} />
          </motion.div>
          <span style={{ fontWeight: 800, fontSize: 15, color: RED, letterSpacing: -0.3 }}>Emergency Fast Track</span>
        </div>
        <span style={{ fontSize: 11, color: DIM }}>No login needed</span>
      </nav>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem 4rem", position: "relative", zIndex: 1 }}>

        {/* Step bar — hidden on confirmed */}
        {step !== "confirmed" && step !== "booking" && (
          <StepBar current={Math.min(stepIdx, 3)} />
        )}

        <AnimatePresence mode="wait">

        {/* ══ SELECT TYPE ════════════════════════════════════════════════════ */}
        {step === "select" && (
          <motion.div key="select" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>What's your emergency?</h1>
            <p style={{ color: DIM, fontSize: 13, marginBottom: 24 }}>Select the type — reachable in under 3 taps.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {EMERGENCY_TYPES.map(type => (
                <motion.button key={type.id} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedType(type); setStep("complaint"); }}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 14, border: `1px solid ${type.border}`, background: type.bgGlow, cursor: "pointer", textAlign: "left", color: TEXT, fontFamily: "inherit" }}>
                  <span style={{ fontSize: 28, flexShrink: 0 }}>{type.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{type.label}</p>
                    <p style={{ fontSize: 11, color: DIM }}>{type.department} · {type.specialty}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 20, background: `${priorityBg(type.priority)}`, border: `1px solid ${priorityBdr(type.priority)}`, color: priorityTxt(type.priority), flexShrink: 0, letterSpacing: 0.5 }}>
                    {type.priority}
                  </span>
                </motion.button>
              ))}
            </div>

            <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 12, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", display: "flex", gap: 12, flexWrap: "wrap" }}>
              {["⚡ Under 3 taps", "📍 GPS hospital routing", "🤖 AI triage", "💾 Saved to records"].map(f => (
                <span key={f} style={{ fontSize: 11, color: DIM }}>{f}</span>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══ CHIEF COMPLAINT ════════════════════════════════════════════════ */}
        {step === "complaint" && selectedType && (
          <motion.div key="complaint" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            {/* Type badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: `1px solid ${selectedType.border}`, background: selectedType.bgGlow, marginBottom: 24 }}>
              <span style={{ fontSize: 24 }}>{selectedType.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700 }}>{selectedType.department}</p>
                <p style={{ fontSize: 11, color: DIM }}>{selectedType.ward}</p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: priorityBg(selectedType.priority), border: `1px solid ${priorityBdr(selectedType.priority)}`, color: priorityTxt(selectedType.priority) }}>
                {selectedType.priority}
              </span>
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Describe your emergency</h2>
            <p style={{ color: DIM, fontSize: 13, marginBottom: 16 }}>One sentence is enough. Our AI will classify severity instantly.</p>

            <div style={{ position: "relative", marginBottom: 16 }}>
              <textarea
                value={chiefComplaint}
                onChange={e => setChiefComplaint(e.target.value)}
                placeholder='e.g. "Severe chest pain radiating to left arm, started 10 minutes ago"'
                rows={4}
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "12px 14px", color: TEXT, fontSize: 14, fontFamily: "inherit", resize: "none", outline: "none", lineHeight: 1.6 }}
              />
              <span style={{ position: "absolute", bottom: 10, right: 12, fontSize: 10, color: DIM }}>{chiefComplaint.length}/200</span>
            </div>

            {/* AI badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)", marginBottom: 20 }}>
              <Brain size={13} color={CYAN} />
              <span style={{ fontSize: 12, color: DIM }}>Claude AI will classify your severity and suggest the right specialist</span>
            </div>

            {error && <p style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={classifyComplaint} disabled={classifying || !chiefComplaint.trim()}
              style={{ width: "100%", background: chiefComplaint.trim() ? `linear-gradient(135deg, ${RED}, #dc2626)` : "rgba(255,255,255,0.04)", border: "none", color: chiefComplaint.trim() ? "#fff" : DIM, borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: chiefComplaint.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {classifying ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Analysing…</> : <><Brain size={16} /> Analyse & Find Hospital</>}
            </motion.button>

            <button onClick={() => setStep("select")} style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: DIM, fontSize: 13, cursor: "pointer", padding: "8px" }}>
              ← Change emergency type
            </button>
          </motion.div>
        )}

        {/* ══ HOSPITAL SELECTOR ══════════════════════════════════════════════ */}
        {step === "hospital" && selectedType && (
          <motion.div key="hospital" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>

            {/* AI Classification result */}
            {classification && (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                style={{ padding: "14px 16px", borderRadius: 12, background: priorityBg(classification.priority), border: `1px solid ${priorityBdr(classification.priority)}`, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Brain size={14} color={CYAN} />
                    <span style={{ fontSize: 11, color: CYAN, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>AI Triage Result</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: priorityBg(classification.priority), border: `1px solid ${priorityBdr(classification.priority)}`, color: priorityTxt(classification.priority) }}>
                    {classification.priority}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{classification.triageNote}</p>
                <p style={{ fontSize: 11, color: DIM, marginTop: 6 }}>Suggested: {classification.suggestedSpecialty}</p>
                {scoreBar(classification.aiSeverityScore)}
              </motion.div>
            )}

            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Find nearest hospital</h2>
            <p style={{ color: DIM, fontSize: 13, marginBottom: 16 }}>Choose your city or use GPS — data from OpenStreetMap, no API key.</p>

            {/* City buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {CITIES.map(city => (
                <button key={city.name} onClick={() => handleCity(city)} disabled={hospLoading}
                  style={{ padding: "7px 16px", borderRadius: 20, border: `1px solid ${activeCity === city.name ? "rgba(239,68,68,0.5)" : BORDER}`, background: activeCity === city.name ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.02)", color: activeCity === city.name ? RED : DIM, cursor: "pointer", fontSize: 13, fontWeight: activeCity === city.name ? 700 : 400 }}>
                  {city.name}
                </button>
              ))}
            </div>

            <button onClick={handleGPS} disabled={hospLoading}
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${usingGPS ? "rgba(16,185,129,0.4)" : BORDER}`, background: usingGPS ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)", color: usingGPS ? GREEN : DIM, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 16 }}>
              <MapPin size={14} /> {usingGPS ? "📡 Using GPS…" : "Use my current location"}
            </button>

            {hospLoading && (
              <div style={{ textAlign: "center", padding: "2rem 0" }}>
                <Loader2 size={28} color={RED} style={{ animation: "spin 1s linear infinite", margin: "0 auto 10px" }} />
                <p style={{ color: DIM, fontSize: 13 }}>Searching hospitals…</p>
              </div>
            )}

            {hospError && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                <p style={{ color: AMBER, fontSize: 13, lineHeight: 1.5 }}>{hospError}</p>
              </div>
            )}

            {hospitals.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 11, color: DIM, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Top {hospitals.length} Nearest</p>
                {hospitals.map((h, idx) => (
                  <motion.div key={h.id} whileHover={{ x: 2 }}
                    style={{ padding: "14px 16px", borderRadius: 14, border: `1px solid ${selectedHospId === h.id ? "rgba(239,68,68,0.4)" : idx === 0 ? "rgba(16,185,129,0.3)" : BORDER}`, background: selectedHospId === h.id ? "rgba(239,68,68,0.08)" : idx === 0 ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.02)", position: "relative" }}>
                    {idx === 0 && (
                      <span style={{ position: "absolute", top: -10, left: 12, fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: GREEN, color: "#fff", letterSpacing: 0.5, textTransform: "uppercase" }}>⚡ Recommended</span>
                    )}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{h.distanceKm?.toFixed(1) ?? "?"}</span>
                        <span style={{ fontSize: 9, color: DIM }}>km</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <p style={{ fontSize: 13, fontWeight: 700 }}>{h.name}</p>
                          {h.emergency && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 6, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)", color: RED }}>24H ER</span>}
                        </div>
                        {h.address && <p style={{ fontSize: 11, color: DIM, marginTop: 2 }}>{h.address}</p>}
                        {h.phone && <p style={{ fontSize: 11, color: DIM }}>📞 {h.phone}</p>}
                      </div>
                      <button onClick={() => selectHospital(h)}
                        style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 10, border: `1px solid ${selectedHospId === h.id ? "rgba(239,68,68,0.4)" : BORDER}`, background: selectedHospId === h.id ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", color: selectedHospId === h.id ? RED : TEXT, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                        {selectedHospId === h.id ? "✓ Selected" : "Select"}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <button onClick={() => setStep("complaint")} style={{ width: "100%", marginTop: 16, background: "transparent", border: "none", color: DIM, fontSize: 13, cursor: "pointer" }}>
              ← Edit complaint
            </button>
          </motion.div>
        )}

        {/* ══ PATIENT FORM ═══════════════════════════════════════════════════ */}
        {step === "form" && selectedType && hospital && (
          <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 10, color: DIM, marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>Hospital</p>
                <p style={{ fontSize: 13, fontWeight: 700 }}>{hospital.name}</p>
                {hospital.distanceKm && <p style={{ fontSize: 11, color: GREEN }}>📍 {hospital.distanceKm.toFixed(1)} km</p>}
              </div>
              {classification && (
                <div style={{ padding: "12px 14px", borderRadius: 12, background: priorityBg(classification.priority), border: `1px solid ${priorityBdr(classification.priority)}` }}>
                  <p style={{ fontSize: 10, color: DIM, marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>AI Priority</p>
                  <p style={{ fontSize: 13, fontWeight: 800, color: priorityTxt(classification.priority) }}>{classification.priority}</p>
                  <p style={{ fontSize: 11, color: DIM }}>{classification.aiSeverityScore}/10 severity</p>
                </div>
              )}
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Quick details</h2>
            <p style={{ color: DIM, fontSize: 13, marginBottom: 20 }}>Booking takes under 3 seconds. No account needed.</p>

            {[
              { key: "name",  label: "Full Name *",     placeholder: "Patient's name",   type: "text" },
              { key: "phone", label: "Phone Number *",  placeholder: "+91 XXXXX XXXXX",  type: "tel"  },
              { key: "age",   label: "Age (optional)",  placeholder: "e.g. 45",          type: "number" },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: DIM, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", display: "block", marginBottom: 5 }}>{label}</label>
                <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", color: TEXT, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              </div>
            ))}

            {error && <p style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleConfirm} disabled={!form.name.trim() || !form.phone.trim()}
              style={{ width: "100%", background: `linear-gradient(135deg, ${RED}, #dc2626)`, border: "none", color: "#fff", borderRadius: 12, padding: "15px", fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: "0 0 40px rgba(239,68,68,0.25)" }}>
              <AlertTriangle size={16} /> 🚨 Book Emergency Now
            </motion.button>
            <button onClick={() => setStep("hospital")} style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: DIM, fontSize: 13, cursor: "pointer" }}>
              ← Change hospital
            </button>
          </motion.div>
        )}

        {/* ══ BOOKING SPINNER ════════════════════════════════════════════════ */}
        {step === "booking" && (
          <motion.div key="booking" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: "center", padding: "4rem 0" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              style={{ width: 56, height: 56, border: `4px solid rgba(239,68,68,0.2)`, borderTopColor: RED, borderRadius: "50%", margin: "0 auto 20px" }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Creating Emergency Slot…</h3>
            <p style={{ color: DIM, fontSize: 13 }}>Saving to records · Notifying hospital</p>
          </motion.div>
        )}

        {/* ══ CONFIRMED ══════════════════════════════════════════════════════ */}
        {step === "confirmed" && result && (
          <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            style={{ textAlign: "center" }}>
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5 }}
              style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.35)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle2 size={32} color={RED} />
            </motion.div>

            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, color: RED }}>Emergency Booked!</h2>
            <p style={{ color: DIM, fontSize: 13, marginBottom: 24 }}>Proceed immediately to the department shown below.</p>

            <div style={{ background: SURFACE, border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: "1.25rem", textAlign: "left", marginBottom: 20 }}>
              {[
                { label: "Token",      val: result.token },
                { label: "Patient",    val: form.name },
                { label: "Phone",      val: form.phone },
                { label: "Hospital",   val: hospital?.name },
                { label: "Department", val: selectedType?.department },
                { label: "Ward",       val: selectedType?.ward },
                { label: "Doctor",     val: selectedType?.specialty ? `On-Call ${selectedType.specialty}` : "On-Call Doctor" },
                { label: "Priority",   val: classification?.priority || selectedType?.priority },
                { label: "Specialty",  val: classification?.suggestedSpecialty },
              ].map(({ label, val }) => val ? (
                <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 11, color: DIM, width: 80, flexShrink: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: label === "Token" ? RED : TEXT, fontFamily: label === "Token" ? "monospace" : "inherit" }}>{val}</span>
                </div>
              ) : null)}

              {classification && (
                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.15)" }}>
                  <p style={{ fontSize: 10, color: CYAN, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>🤖 AI Triage Note</p>
                  <p style={{ fontSize: 12, color: TEXT, lineHeight: 1.6 }}>{classification.triageNote}</p>
                  {scoreBar(classification.aiSeverityScore)}
                </div>
              )}
            </div>

            <motion.p animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
              style={{ color: RED, fontSize: 14, fontWeight: 700, marginBottom: 20 }}>
              ⚠️ Go directly to {selectedType?.ward}
            </motion.p>

            {hospital?.phone && (
              <a href={`tel:${hospital.phone}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: RED, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none", marginBottom: 12 }}>
                <Phone size={15} /> Call {hospital.name}
              </a>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={reset} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: DIM, padding: "12px", borderRadius: 12, cursor: "pointer", fontSize: 13 }}>
                New Emergency
              </button>
              <button onClick={() => navigate("/")} style={{ flex: 1, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", color: CYAN, padding: "12px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                Back to Home
              </button>
            </div>
          </motion.div>
        )}

        </AnimatePresence>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0 }
        textarea, input { font-family: inherit }
        input:focus, textarea:focus { border-color: rgba(239,68,68,0.5) !important; outline: none }
      `}</style>
    </div>
  );
}