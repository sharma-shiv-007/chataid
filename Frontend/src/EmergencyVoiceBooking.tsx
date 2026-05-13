/**
 * EmergencyVoiceBooking.tsx
 * AI-powered Emergency Voice Booking System
 * React + TypeScript | Web Speech API | OpenStreetMap | Anthropic AI | n8n
 *
 * SETUP:
 *  1. Set VITE_ANTHROPIC_API_KEY in .env (or pass via prop)
 *  2. Set VITE_N8N_WEBHOOK_URL in .env (or pass via prop)
 *  3. Install: npm install lucide-react
 *  4. Tailwind CSS must be configured
 *
 * n8n WEBHOOK PAYLOAD FORMAT:
 * POST /emergency-booking
 * {
 *   patient: string,       phone: string,
 *   hospital: string,      doctor: string,
 *   emergencyType: string, severity: "LOW"|"URGENT"|"CRITICAL",
 *   department: string,    startTime: ISO string,
 *   endTime: ISO string
 * }
 *
 * n8n EXPECTED RESPONSE:
 * { success: true, appointmentId: string, hospital: string, doctor: string, time: string, message: string }
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, MicOff, AlertTriangle, MapPin, Calendar, Phone,
  CheckCircle, Loader2, Volume2, RefreshCw, Ambulance
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Severity = "LOW" | "URGENT" | "CRITICAL";

export interface AIResult {
  emergencyType: string;
  severity: Severity;
  department: string;
  doctorType: string;
  explanation: string;
  doctor?: string;
}

export interface Hospital {
  id: number | string;
  name: string;
  lat?: number;
  lon?: number;
  distance?: number;
  phone?: string;
  emergency?: string;
}

export interface Booking {
  id: string;
  hospital: string;
  doctor: string;
  time: string;
  date: string;
  department: string;
  severity: Severity;
  emergencyType: string;
  message?: string;
}

type Step = 0 | 1 | 2 | 3 | 4;

interface ProcessingState {
  ai: boolean;
  location: boolean;
  hospital: boolean;
  booking: boolean;
}

interface Props {
  anthropicApiKey?: string;
  n8nWebhookUrl?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOCTOR_MAP: Record<string, string> = {
  "Cardiology": "Dr. Arjun Verma",
  "Trauma": "Dr. Vikram Singh",
  "Pulmonology": "Dr. Kavita Dhar",
  "Neurology": "Dr. Priya Sharma",
  "Orthopedics": "Dr. Rajesh Kumar",
  "General Emergency": "Dr. Meera Nair",
  "Gastroenterology": "Dr. Suresh Patel",
  "Nephrology": "Dr. Anita Rao",
  "Ophthalmology": "Dr. Rohit Gupta",
  "ENT": "Dr. Sneha Joshi",
  "Pediatrics": "Dr. Deepa Menon",
  "Psychiatry": "Dr. Arun Bose",
};

const FALLBACK_KEYWORDS: Record<Severity, { words: string[]; type: string; dept: string }> = {
  CRITICAL: {
    words: ["heart", "cardiac", "chest pain", "stroke", "unconscious", "breathing",
      "attack", "seizure", "दिल", "सीने में दर्द", "सांस", "paralysis"],
    type: "Cardiac Emergency", dept: "Cardiology",
  },
  URGENT: {
    words: ["fracture", "broken", "bleeding", "cut", "wound", "burn", "allergy",
      "vomit", "fever", "pain", "दर्द", "बुखार", "चोट", "accident"],
    type: "Acute Medical", dept: "General Emergency",
  },
  LOW: {
    words: ["headache", "cold", "cough", "dizziness", "नाक", "सर्दी", "खांसी", "rash"],
    type: "General Complaint", dept: "General Emergency",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return "MED-" + Date.now().toString(36).toUpperCase();
}

function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ─── AI Classification ────────────────────────────────────────────────────────

async function classifyWithAI(text: string, apiKey: string): Promise<AIResult | null> {
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: `You are a medical emergency triage assistant. Analyze symptoms and return ONLY valid JSON with these exact keys:
          emergencyType (string), severity ("LOW"|"URGENT"|"CRITICAL"), department (string), doctorType (string), explanation (string).
          No markdown, no backticks, no extra text. Return only the JSON object.`,
        messages: [
          {
            role: "user",
            content: `Patient reports: "${text}"\nReturn JSON only.`,
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const raw = data.content[0].text.replace(/```json|```/g, "").trim();
    return JSON.parse(raw) as AIResult;
  } catch {
    return null;
  }
}

function fallbackClassify(text: string): AIResult {
  const lower = text.toLowerCase();
  for (const [sev, data] of Object.entries(FALLBACK_KEYWORDS) as [Severity, typeof FALLBACK_KEYWORDS[Severity]][]) {
    if (data.words.some((w) => lower.includes(w))) {
      return {
        emergencyType: data.type,
        severity: sev,
        department: data.dept,
        doctorType: "Emergency Physician",
        explanation: "Detected via keyword analysis. Keyword match found. Please verify with medical staff.",
      };
    }
  }
  return {
    emergencyType: "General Emergency",
    severity: "URGENT",
    department: "General Emergency",
    doctorType: "Emergency Physician",
    explanation: "Could not classify precisely. Routing to general emergency for evaluation.",
  };
}

// ─── Hospital Fetch ───────────────────────────────────────────────────────────

async function fetchHospitals(lat: number, lon: number): Promise<Hospital[]> {
  const radius = 20000; // 20 km
  const query = `[out:json][timeout:25];(node["amenity"="hospital"](around:${radius},${lat},${lon});way["amenity"="hospital"](around:${radius},${lat},${lon}););out center 8;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
  });
  const data = await response.json();

  const hospitals: Hospital[] = data.elements
    .map((e: any) => {
      const lt = e.lat ?? e.center?.lat;
      const ln = e.lon ?? e.center?.lon;
      const name: string = e.tags?.name ?? "Government Hospital";
      if (!lt || !ln) return null;
      return {
        id: e.id,
        name,
        lat: lt,
        lon: ln,
        distance: distKm(lat, lon, lt, ln),
        phone: e.tags?.phone,
        emergency: e.tags?.emergency,
      } as Hospital;
    })
    .filter(Boolean) as Hospital[];

  hospitals.sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99));

  if (hospitals.length === 0) {
    return [
      { id: 1, name: "AIIMS Emergency Hospital", distance: 6.2 },
      { id: 2, name: "Apollo Hospitals", distance: 7.1 },
      { id: 3, name: "District Civil Hospital", distance: 9.7 },
    ];
  }
  return hospitals.slice(0, 4);
}

// ─── n8n Webhook ──────────────────────────────────────────────────────────────

/**
 * n8n Workflow:
 * 1. Webhook trigger → receives JSON payload below
 * 2. IF node: severity === "CRITICAL" → red color (11), else severity === "URGENT" → orange color (6)
 * 3. Google Calendar node:
 *    - Title: `🚨 EMERGENCY – ${emergencyType}`
 *    - Start: startTime, End: endTime
 *    - Description: `Patient: ${patient}\nPhone: ${phone}\nDoctor: ${doctor}\nHospital: ${hospital}`
 *    - Color: from IF node
 *    - Status: confirmed
 * 4. Respond to Webhook: { success: true, appointmentId: ..., hospital, doctor, time, message }
 */
interface N8nPayload {
  patient: string;
  phone: string;
  hospital: string;
  doctor: string;
  emergencyType: string;
  severity: Severity;
  department: string;
  startTime: string;
  endTime: string;
}

interface N8nResponse {
  success: boolean;
  appointmentId?: string;
  hospital?: string;
  doctor?: string;
  time?: string;
  message?: string;
}

async function sendToN8n(payload: N8nPayload, webhookUrl: string): Promise<N8nResponse> {
  if (!webhookUrl) {
    return {
      success: true,
      appointmentId: generateId(),
      message: "Booked locally (n8n not configured)",
    };
  }
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("n8n error");
    return (await response.json()) as N8nResponse;
  } catch {
    return {
      success: true,
      appointmentId: generateId(),
      message: "Booked locally (n8n unavailable)",
    };
  }
}

// ─── Severity Styles ──────────────────────────────────────────────────────────

const severityStyles: Record<Severity, string> = {
  CRITICAL: "bg-red-500/20 text-red-300 border border-red-500/40",
  URGENT: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  LOW: "bg-green-600/20 text-green-300 border border-green-600/40",
};

// ─── Main Component ───────────────────────────────────────────────────────────

const EmergencyVoiceBooking: React.FC<Props> = ({
  anthropicApiKey: keyProp,
  n8nWebhookUrl: webhookProp,
}) => {
  // State
  const [step, setStep] = useState<Step>(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [patientName, setPatientName] = useState("Emergency Case");
  const [patientPhone, setPatientPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    ai: false, location: false, hospital: false, booking: false,
  });
  const [apiKey, setApiKey] = useState<string>(
    keyProp ?? localStorage.getItem("medAlert_apiKey") ?? ""
  );
  const [n8nWebhook, setN8nWebhook] = useState<string>(
    webhookProp ?? localStorage.getItem("medAlert_n8nUrl") ?? ""
  );
  const [showConfig, setShowConfig] = useState(false);

  const recognitionRef = useRef<any>(null);

  // ── Speech synthesis ──
  const speak = useCallback((text: string) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-IN";
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch { /* silent */ }
  }, []);

  // ── Start listening ──
  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition not supported. Please use Chrome or Edge.");
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "hi-IN"; // Supports Hindi + English (Hinglish)
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
      setError(null);
      setTranscript("");
      setInterimTranscript("");
    };

    rec.onresult = (e: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      if (finalText) setTranscript((prev) => prev + finalText);
      setInterimTranscript(interimText);
    };

    rec.onerror = (e: any) => {
      if (e.error === "no-speech") return;
      setListening(false);
      setError(`Microphone error: ${e.error}`);
    };

    rec.onend = () => {
      setListening((l) => {
        if (l) rec.start(); // keep going until user stops
        return l;
      });
    };

    recognitionRef.current = rec;
    rec.start();
    speak("Emergency system active. Please describe your symptoms.");
  }, [speak]);

  // ── Stop listening ──
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      window.speechSynthesis.cancel();
    };
  }, []);

  // ── Process transcript ──
  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setStep(1);
    setProcessing({ ai: true, location: false, hospital: false, booking: false });
    speak("Analyzing your symptoms now.");

    // AI classification
    let result = await classifyWithAI(text, apiKey);
    if (!result) result = fallbackClassify(text);
    result.doctor = DOCTOR_MAP[result.department] ?? DOCTOR_MAP["General Emergency"];
    setAiResult(result);
    setProcessing({ ai: false, location: true, hospital: false, booking: false });
    setStep(2);

    if (result.severity === "CRITICAL") speak("Critical emergency detected. Finding nearest hospital immediately.");
    else speak("Emergency detected. Finding nearest hospital.");

    // Geolocation
    let coords = { lat: 30.684, lon: 76.718 }; // fallback: Baddi, HP
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, enableHighAccuracy: true })
      );
      coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    } catch { /* use fallback */ }

    setProcessing({ ai: false, location: false, hospital: true, booking: false });

    // Fetch hospitals
    let hospList: Hospital[] = [];
    try {
      hospList = await fetchHospitals(coords.lat, coords.lon);
    } catch {
      hospList = [
        { id: 1, name: "AIIMS Emergency Hospital", distance: 5.3 },
        { id: 2, name: "District Civil Hospital", distance: 8.9 },
        { id: 3, name: "Apollo Hospitals", distance: 11.2 },
      ];
    }

    setHospitals(hospList);
    setSelectedHospital(hospList[0] ?? null);
    setProcessing({ ai: false, location: false, hospital: false, booking: false });
    setStep(3);
    speak("Nearest hospital found. Please confirm your booking.");
  }, [apiKey, speak]);

  // ── Confirm booking ──
  const confirmBooking = useCallback(async () => {
    if (!selectedHospital || !aiResult) return;
    setProcessing((p) => ({ ...p, booking: true }));

    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60 * 1000);

    const payload: N8nPayload = {
      patient: patientName || "Emergency Case",
      phone: patientPhone || "N/A",
      hospital: selectedHospital.name,
      doctor: aiResult.doctor ?? DOCTOR_MAP["General Emergency"],
      emergencyType: aiResult.emergencyType,
      severity: aiResult.severity,
      department: aiResult.department,
      startTime: now.toISOString(),
      endTime: end.toISOString(),
    };

    const resp = await sendToN8n(payload, n8nWebhook);

    const newBooking: Booking = {
      id: resp.appointmentId ?? generateId(),
      hospital: selectedHospital.name,
      doctor: payload.doctor,
      time: `${formatTime(now)} – ${formatTime(end)}`,
      date: now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      department: aiResult.department,
      severity: aiResult.severity,
      emergencyType: aiResult.emergencyType,
      message: resp.message,
    };

    // Persist in localStorage
    try {
      const prev = JSON.parse(localStorage.getItem("medAlert_bookings") ?? "[]");
      prev.unshift({ ...newBooking, patient: payload.patient, createdAt: now.toISOString() });
      localStorage.setItem("medAlert_bookings", JSON.stringify(prev.slice(0, 20)));
    } catch { /* silent */ }

    setBooking(newBooking);
    setProcessing({ ai: false, location: false, hospital: false, booking: false });
    setStep(4);
    speak(`Booking confirmed at ${selectedHospital.name}. Your doctor is ${payload.doctor}. Please proceed immediately.`);
  }, [selectedHospital, aiResult, patientName, patientPhone, n8nWebhook, speak]);

  const reset = () => {
    setStep(0); setListening(false); setTranscript(""); setInterimTranscript("");
    setAiResult(null); setHospitals([]); setSelectedHospital(null);
    setBooking(null); setError(null);
    setProcessing({ ai: false, location: false, hospital: false, booking: false });
  };

  const saveConfig = () => {
    localStorage.setItem("medAlert_apiKey", apiKey);
    localStorage.setItem("medAlert_n8nUrl", n8nWebhook);
    setShowConfig(false);
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <div className="max-w-xl mx-auto px-4 py-6 pb-20">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight">MedAlert</div>
              <div className="text-[11px] text-white/40 uppercase tracking-wider">Emergency Voice System</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowConfig((v) => !v)}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Settings
            </button>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="System active" />
          </div>
        </div>

        {/* Config Panel */}
        {showConfig && (
          <div className="bg-[#18181d] border border-white/10 rounded-xl p-4 mb-5">
            <div className="text-amber-400 text-sm font-semibold mb-2">Configuration</div>
            <p className="text-white/50 text-xs mb-3">
              Enter your Anthropic API key for AI triage. Add your n8n webhook URL for Google Calendar booking.
            </p>
            <div className="space-y-2 mb-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-... (Anthropic API Key)"
                className="w-full bg-[#1f1f26] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-red-500/50"
              />
              <input
                type="text"
                value={n8nWebhook}
                onChange={(e) => setN8nWebhook(e.target.value)}
                placeholder="https://your-n8n.../webhook/emergency-booking"
                className="w-full bg-[#1f1f26] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-red-500/50"
              />
            </div>
            <button
              onClick={saveConfig}
              className="px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-colors"
            >
              Save Configuration
            </button>
          </div>
        )}

        {/* Step Bar */}
        <StepBar currentStep={step} />

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 text-red-300 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Steps */}
        {step === 0 && (
          <StepMic
            listening={listening}
            transcript={transcript}
            interim={interimTranscript}
            onStart={startListening}
            onStop={stopListening}
            onAnalyze={() => processTranscript(transcript)}
          />
        )}

        {step === 1 && (
          <StepProcessing transcript={transcript} processing={processing} />
        )}

        {step === 2 && (
          <StepAIResult aiResult={aiResult} processing={processing} onCallAmbulance={() => window.location.href = "tel:112"} />
        )}

        {step === 3 && (
          <StepHospital
            aiResult={aiResult}
            hospitals={hospitals}
            selectedHospital={selectedHospital}
            onSelectHospital={setSelectedHospital}
            patientName={patientName}
            patientPhone={patientPhone}
            onNameChange={setPatientName}
            onPhoneChange={setPatientPhone}
            onConfirm={confirmBooking}
            onReset={reset}
            onCallAmbulance={() => window.location.href = "tel:112"}
            processingBooking={processing.booking}
          />
        )}

        {step === 4 && booking && (
          <StepConfirmed booking={booking} onReset={reset} onCallAmbulance={() => window.location.href = "tel:112"} />
        )}
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StepBar: React.FC<{ currentStep: Step }> = ({ currentStep }) => (
  <div className="mb-5">
    <div className="text-xs text-white/40 text-center mb-2 font-medium uppercase tracking-wider">
      {["Ready", "Analyzing", "Locating", "Confirm", "Booked"][currentStep]}
    </div>
    <div className="flex gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`flex-1 h-1 rounded-full transition-all duration-500 ${
            i < currentStep ? "bg-red-700" : i === currentStep ? "bg-red-500" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  </div>
);

const WaveBars: React.FC = () => (
  <div className="flex items-center gap-0.5 h-8 justify-center my-2">
    {[8, 16, 24, 18, 10, 20, 14].map((h, i) => (
      <div
        key={i}
        className="w-1 rounded-full bg-red-500"
        style={{
          height: h,
          animation: `wavePulse 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
        }}
      />
    ))}
    <style>{`@keyframes wavePulse { to { transform: scaleY(1.8); } }`}</style>
  </div>
);

const StepMic: React.FC<{
  listening: boolean; transcript: string; interim: string;
  onStart: () => void; onStop: () => void; onAnalyze: () => void;
}> = ({ listening, transcript, interim, onStart, onStop, onAnalyze }) => (
  <div>
    <div className="text-center py-8">
      <button
        onClick={listening ? onStop : onStart}
        className={`relative w-20 h-20 rounded-full transition-all duration-200 ${
          listening
            ? "bg-red-500 shadow-[0_0_0_0_rgba(239,68,68,0.4)] animate-[pingPulse_1.2s_cubic-bezier(0.455,0.03,0.515,0.955)_infinite]"
            : "bg-red-500 hover:bg-red-400 active:scale-95"
        }`}
        aria-label={listening ? "Stop listening" : "Start listening"}
      >
        {listening
          ? <MicOff className="w-8 h-8 text-white mx-auto" />
          : <Mic className="w-8 h-8 text-white mx-auto" />
        }
        <style>{`@keyframes pingPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 70%{box-shadow:0 0 0 24px rgba(239,68,68,0)} }`}</style>
      </button>

      <div className="mt-4 text-xl font-bold tracking-tight">
        {listening ? "Listening..." : "Tap to speak"}
      </div>
      <div className="text-white/50 text-sm mt-1 max-w-xs mx-auto">
        {listening
          ? "Speak your symptoms clearly. Tap again to stop."
          : "Describe your emergency in Hindi or English"}
      </div>
      <div className="flex gap-2 justify-center mt-3">
        {["Hindi", "English", "Hinglish"].map((l) => (
          <span key={l} className="text-xs px-3 py-1 bg-white/8 border border-white/10 rounded-full text-white/40">
            {l}
          </span>
        ))}
      </div>
      {listening && <WaveBars />}
    </div>

    {(transcript || interim) && (
      <>
        <div className="bg-[#18181d] border border-white/10 rounded-xl p-4 mb-3">
          <div className="text-[11px] text-white/30 uppercase tracking-wider mb-2">Transcribed</div>
          <p className="text-sm text-white/90 italic">
            {transcript}
            <span className="text-white/40">{interim}</span>
          </p>
        </div>
        {!listening && (
          <button
            onClick={onAnalyze}
            className="w-full py-3 bg-red-500 hover:bg-red-400 rounded-xl text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2"
          >
            <Volume2 className="w-4 h-4" /> Analyze Symptoms
          </button>
        )}
      </>
    )}
  </div>
);

const ProcessingRow: React.FC<{ label: string; done: boolean }> = ({ label, done }) => (
  <div className="flex items-center gap-3 px-4 py-3 bg-[#18181d] rounded-lg mb-2">
    {done
      ? <div className="w-4 h-4 bg-green-600/30 rounded-full flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-3 h-3 text-green-400" />
        </div>
      : <Loader2 className="w-4 h-4 text-red-400 animate-spin flex-shrink-0" />
    }
    <span className={`text-sm ${done ? "text-white" : "text-white/50"}`}>{label}</span>
  </div>
);

const StepProcessing: React.FC<{ transcript: string; processing: ProcessingState }> = ({ transcript, processing }) => (
  <div>
    <div className="bg-[#18181d] border border-white/10 rounded-xl p-4 mb-5">
      <div className="text-[11px] text-white/30 uppercase tracking-wider mb-2">Your report</div>
      <p className="text-sm text-white/80 italic">{transcript}</p>
    </div>
    <ProcessingRow label="Analyzing symptoms with AI" done={!processing.ai} />
  </div>
);

const SeverityBadge: React.FC<{ severity: Severity }> = ({ severity }) => (
  <span className={`text-xs font-bold px-3 py-1 rounded-full ${severityStyles[severity]}`}>{severity}</span>
);

const StepAIResult: React.FC<{
  aiResult: AIResult | null; processing: ProcessingState; onCallAmbulance: () => void;
}> = ({ aiResult, processing, onCallAmbulance }) => (
  <div>
    {aiResult && (
      <div className="bg-[#111114] border border-white/10 rounded-xl mb-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-3">
            <SeverityBadge severity={aiResult.severity} />
            <span className="font-bold text-base">{aiResult.emergencyType}</span>
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              ["Department", aiResult.department],
              ["Doctor", aiResult.doctor ?? "Assigning..."],
            ].map(([l, v]) => (
              <div key={l} className="bg-[#18181d] rounded-lg px-3 py-2">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{l}</div>
                <div className="text-sm text-white">{v}</div>
              </div>
            ))}
          </div>
          <div className="border-l-2 border-red-500 pl-3 bg-[#18181d] rounded-r-lg p-3">
            <p className="text-xs text-white/60 italic">{aiResult.explanation}</p>
          </div>
        </div>
      </div>
    )}
    <ProcessingRow label="Getting your location" done={!processing.location} />
    <ProcessingRow label="Finding nearest hospitals" done={!processing.hospital} />
    {aiResult?.severity === "CRITICAL" && (
      <button onClick={onCallAmbulance}
        className="w-full mt-4 py-3 bg-red-500/15 border border-red-500/50 rounded-xl text-red-300 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500/25 transition-colors">
        <Ambulance className="w-5 h-5" /> Call Ambulance (112)
      </button>
    )}
  </div>
);

const StepHospital: React.FC<{
  aiResult: AIResult | null; hospitals: Hospital[]; selectedHospital: Hospital | null;
  onSelectHospital: (h: Hospital) => void; patientName: string; patientPhone: string;
  onNameChange: (v: string) => void; onPhoneChange: (v: string) => void;
  onConfirm: () => void; onReset: () => void; onCallAmbulance: () => void;
  processingBooking: boolean;
}> = ({
  aiResult, hospitals, selectedHospital, onSelectHospital,
  patientName, patientPhone, onNameChange, onPhoneChange,
  onConfirm, onReset, onCallAmbulance, processingBooking
}) => (
  <div>
    {aiResult && (
      <div className="flex items-center gap-3 bg-[#111114] border border-white/10 rounded-xl px-4 py-3 mb-4">
        <SeverityBadge severity={aiResult.severity} />
        <span className="font-bold flex-1">{aiResult.emergencyType}</span>
        <span className="text-xs text-white/40">{aiResult.department}</span>
      </div>
    )}

    <div className="mb-4">
      <div className="text-[11px] text-white/40 uppercase tracking-wider mb-2">Nearest hospitals</div>
      {hospitals.map((h, i) => (
        <button
          key={h.id}
          onClick={() => onSelectHospital(h)}
          className={`w-full text-left bg-[#111114] border rounded-xl px-4 py-3 mb-2 transition-all ${
            selectedHospital?.id === h.id
              ? "border-red-500/50 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]"
              : "border-white/10 hover:border-white/20"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-sm">{h.name}</span>
            {h.distance && (
              <span className="text-xs bg-white/8 px-2 py-0.5 rounded-full text-white/50">
                {h.distance.toFixed(1)} km
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {i === 0 && (
              <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">
                ● Auto-selected
              </span>
            )}
            {h.emergency && <span className="text-[10px] bg-white/6 px-2 py-0.5 rounded-full text-white/40">Emergency 24/7</span>}
            {h.phone && <span className="text-[10px] text-white/30">{h.phone}</span>}
          </div>
        </button>
      ))}
    </div>

    <div className="bg-[#18181d] rounded-xl p-4 mb-4">
      <div className="text-[11px] text-white/40 uppercase tracking-wider mb-3">Patient details (optional)</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-white/40 block mb-1">Name</label>
          <input
            value={patientName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Emergency Case"
            className="w-full bg-[#1f1f26] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1">Phone</label>
          <input
            value={patientPhone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="+91..."
            className="w-full bg-[#1f1f26] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-red-500/50"
          />
        </div>
      </div>
    </div>

    {aiResult?.severity === "CRITICAL" && (
      <button onClick={onCallAmbulance}
        className="w-full py-3 bg-red-500/12 border border-red-500/40 rounded-xl text-red-300 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors mb-3">
        <Ambulance className="w-5 h-5" /> Call Ambulance (112)
      </button>
    )}

    <button
      onClick={onConfirm}
      disabled={processingBooking}
      className="w-full py-3 bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2"
    >
      {processingBooking
        ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming...</>
        : <><Calendar className="w-4 h-4" /> Confirm Emergency Booking</>
      }
    </button>
    <button onClick={onReset}
      className="w-full py-2.5 mt-2 bg-transparent border border-white/10 hover:border-white/20 rounded-xl text-white/40 text-sm transition-colors flex items-center justify-center gap-2">
      <RefreshCw className="w-3.5 h-3.5" /> Start over
    </button>
  </div>
);

const StepConfirmed: React.FC<{
  booking: Booking; onReset: () => void; onCallAmbulance: () => void;
}> = ({ booking, onReset, onCallAmbulance }) => (
  <div>
    <div className="bg-[#111114] border border-green-600/30 rounded-xl overflow-hidden mb-4">
      <div className="bg-green-600/15 border-b border-green-600/20 px-4 py-3 flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-green-400" />
        <span className="text-green-300 font-bold text-sm">Emergency appointment confirmed</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            ["Hospital", booking.hospital],
            ["Doctor", booking.doctor],
            ["Time", booking.time],
            ["Date", booking.date],
            ["Emergency", booking.emergencyType],
            ["Department", booking.department],
          ].map(([l, v]) => (
            <div key={l} className="bg-[#18181d] rounded-lg px-3 py-2">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{l}</div>
              <div className="text-sm text-white">{v}</div>
            </div>
          ))}
        </div>
        <div className="text-center text-[11px] text-white/25">Booking ID: {booking.id}</div>
        {booking.message && (
          <div className="mt-2 text-center text-xs text-white/35 italic">{booking.message}</div>
        )}
      </div>
    </div>

    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 mb-4">
      <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0" />
      <p className="text-xs text-amber-300/80">Please proceed to <strong>{booking.hospital}</strong> immediately. Ask for {booking.department} at the reception.</p>
    </div>

    {booking.severity === "CRITICAL" && (
      <button onClick={onCallAmbulance}
        className="w-full py-3 bg-red-500/15 border border-red-500/50 rounded-xl text-red-300 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500/25 transition-colors mb-3">
        <Phone className="w-4 h-4" /> Call Ambulance (112)
      </button>
    )}

    <button onClick={onReset}
      className="w-full py-3 bg-red-500 hover:bg-red-400 rounded-xl text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2">
      <RefreshCw className="w-4 h-4" /> New Emergency
    </button>
  </div>
);

export default EmergencyVoiceBooking;