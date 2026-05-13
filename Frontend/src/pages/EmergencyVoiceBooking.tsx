// Frontend/src/pages/EmergencyVoiceBooking.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Send, HeartPulse, Sparkles, RotateCcw,
  CheckCircle2, Calendar, Clock, ChevronRight, AlertTriangle,
  ArrowLeft, Loader2, Edit2, X, Volume2, VolumeX,
} from "lucide-react";

// ─── Speech API types ─────────────────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((e: Event) => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  start(): void; stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = "intro" | "recording" | "processing" | "review" | "slots" | "confirmed";
interface Extracted {
  patientName: string;
  age: string;
  gender: string;
  symptoms: string[];
  symptomDuration: string;
  urgency: "routine" | "urgent" | "emergency";
  preferredSpecialty: string;
  appointmentType: "in-person" | "video";
  notes: string;
}
interface Slot { time: string; available: boolean; }

// ─── Tokens ───────────────────────────────────────────────────────────────────
const CYAN = "#06b6d4"; const CYAN_BG = "rgba(6,182,212,0.1)"; const CYAN_BDR = "rgba(6,182,212,0.25)";
const BG = "#020817"; const SURFACE = "rgba(15,23,42,0.8)"; const BORDER = "rgba(148,163,184,0.08)";
const TEXT = "#e2e8f0"; const DIM = "#64748b";
const GREEN = "#10b981"; const RED = "#ef4444"; const VIOLET = "#8b5cf6"; const AMBER = "#f59e0b";

const BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:5000/api";
async function req(method: string, path: string, body?: object) {
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

// ─── Questions — name/age/gender FIRST, then medical ─────────────────────────
const QUESTIONS = [
  "Hi! I'm your ChatAid health assistant. I'll help you book an appointment in just a minute. First, what is your full name?",
  "Thank you! How old are you?",
  "Got it. What is your gender — Male, Female, or Other?",
  "What brings you in today? Please describe your symptoms.",
  "How long have you been experiencing these symptoms?",
  "Is this an emergency, urgent, or can it wait a few days for a routine visit?",
  "Do you have a preferred specialty? For example, General Medicine, Cardiology, or Pediatrics.",
  "Any allergies, current medications, or extra notes for the doctor?",
];

// ─── Text-to-Speech ───────────────────────────────────────────────────────────
function speak(text: string, muted: boolean) {
  if (muted || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang  = "en-IN";
  u.rate  = 0.92;
  u.pitch = 1.05;
  // prefer a female voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("female"))
    || voices.find(v => v.lang.startsWith("en-IN"))
    || voices.find(v => v.lang.startsWith("en"));
  if (preferred) u.voice = preferred;
  window.speechSynthesis.speak(u);
}

const urgencyColor = (u: string) =>
  u === "emergency" ? RED : u === "urgent" ? AMBER : GREEN;
const urgencyLabel = (u: string) =>
  u === "emergency" ? "🚨 Emergency" : u === "urgent" ? "⚡ Urgent" : "📅 Routine";

function getDateOptions() {
  const options = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const value = d.toISOString().split("T")[0];
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow"
      : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    options.push({ value, label });
  }
  return options;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function EmergencyVoiceBooking() {
  const navigate = useNavigate();

  const [stage,        setStage]        = useState<Stage>("intro");
  const [listening,    setListening]    = useState(false);
  const [interim,      setInterim]      = useState("");
  const [messages,     setMessages]     = useState<{ role: "ai" | "user"; text: string }[]>([]);
  const [userAnswers,  setUserAnswers]  = useState<string[]>([]);
  const [questionIdx,  setQuestionIdx]  = useState(0);
  const [typedInput,   setTypedInput]   = useState("");
  const [extracted,    setExtracted]    = useState<Extracted | null>(null);
  const [editField,    setEditField]    = useState<string | null>(null);
  const [slots,        setSlots]        = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState(getDateOptions()[0].value);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking,      setBooking]      = useState(false);
  const [booked,       setBooked]       = useState<any>(null);
  const [error,        setError]        = useState("");
  const [noSpeech,     setNoSpeech]     = useState(false);
  const [muted,        setMuted]        = useState(false);   // TTS mute toggle

  const recogRef  = useRef<SpeechRecognition | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const dateOpts  = getDateOptions();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, interim]);

  // Load voices (Chrome needs this trigger)
  useEffect(() => {
    window.speechSynthesis?.getVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", () => window.speechSynthesis.getVoices());
  }, []);

  // Stop TTS when component unmounts
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const getSpeech = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setNoSpeech(true); return null; }
    const r = new SR();
    r.continuous = false; r.interimResults = true; r.lang = "en-IN";
    return r;
  }, []);

  // ── addAI now speaks the message ──
  const addAI = useCallback((text: string) => {
    setMessages(m => [...m, { role: "ai", text }]);
    speak(text, muted);
  }, [muted]);

  const addUser = (text: string) => setMessages(m => [...m, { role: "user", text }]);

  const startListening = useCallback(() => {
    const r = getSpeech();
    if (!r) return;
    recogRef.current = r;
    let finalText = "";

    r.onstart = () => {
      window.speechSynthesis?.cancel(); // stop AI talking when mic opens
      setListening(true);
    };
    r.onresult = (e: SpeechRecognitionEvent) => {
      let interim_ = ""; let final_ = "";
      for (let i = e.results.length - 1; i >= 0; i--) {
        if (e.results[i].isFinal) { final_ = e.results[i][0].transcript; break; }
        else interim_ = e.results[i][0].transcript;
      }
      if (final_) finalText = final_;
      setInterim(interim_ || final_);
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      if (finalText.trim()) submitAnswer(finalText.trim());
    };
    r.onerror = () => { setListening(false); setInterim(""); };
    r.start();
  }, [questionIdx, userAnswers]); // eslint-disable-line

  const stopListening = () => { recogRef.current?.stop(); };

  const submitAnswer = useCallback(async (text: string) => {
    addUser(text);
    const newAnswers = [...userAnswers, text];
    setUserAnswers(newAnswers);

    const next = questionIdx + 1;
    setQuestionIdx(next);

    if (next < QUESTIONS.length) {
      setTimeout(() => addAI(QUESTIONS[next]), 450);
    } else {
      setStage("processing");
      try {
        const fullTranscript = newAnswers.join(" | ");
        const data = await req("POST", "/voice/extract", { transcript: fullTranscript });
        setExtracted(data.extracted);
        setStage("review");
        const doneMsg = "Perfect! I've captured all your details. Please review them below and make any edits before picking a time slot.";
        addAI(doneMsg);
      } catch (err: any) {
        setError(err.message);
        setStage("recording");
        addAI("Sorry, I had trouble processing that. Let's try again.");
      }
    }
  }, [userAnswers, questionIdx, addAI]);

  const handleTyped = () => {
    const t = typedInput.trim();
    if (!t) return;
    setTypedInput("");
    submitAnswer(t);
  };

  const startConversation = () => {
    window.speechSynthesis?.cancel();
    setStage("recording");
    setMessages([]);
    setUserAnswers([]);
    setQuestionIdx(0);
    setExtracted(null);
    setError("");
    setTimeout(() => addAI(QUESTIONS[0]), 300);
  };

  useEffect(() => {
    if (stage !== "slots") return;
    setSlots([]); setSelectedSlot(null);
    req("GET", `/voice/slots?date=${selectedDate}`)
      .then((d: any) => setSlots(d.slots || []))
      .catch(() => {});
  }, [selectedDate, stage]);

  const confirmBooking = async () => {
    if (!selectedSlot || !extracted) return;
    setBooking(true); setError("");
    try {
      const data = await req("POST", "/voice/book", {
        ...extracted,
        date: selectedDate,
        time: selectedSlot,
      });
      setBooked(data.appointment);
      setStage("confirmed");
      speak("Your appointment has been booked successfully!", muted);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBooking(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(6,182,212,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.025) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0 }} />

      {/* Navbar */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(2,8,23,0.9)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${BORDER}`, padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => { window.speechSynthesis?.cancel(); navigate(-1); }}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: DIM, cursor: "pointer", fontSize: 13 }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HeartPulse size={18} color={CYAN} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Chat<span style={{ color: CYAN }}>Aid</span></span>
          <span style={{ fontSize: 12, color: DIM, marginLeft: 4 }}>Voice Booking</span>
        </div>
        {/* Mute toggle */}
        <button onClick={() => { setMuted(m => !m); if (!muted) window.speechSynthesis?.cancel(); }}
          title={muted ? "Unmute AI voice" : "Mute AI voice"}
          style={{ display: "flex", alignItems: "center", gap: 5, background: muted ? "rgba(239,68,68,0.08)" : CYAN_BG, border: `1px solid ${muted ? "rgba(239,68,68,0.2)" : CYAN_BDR}`, color: muted ? RED : CYAN, padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          {muted ? "Muted" : "Voice On"}
        </button>
      </nav>

      <main style={{ flex: 1, maxWidth: 720, margin: "0 auto", width: "100%", padding: "2rem 1rem", position: "relative", zIndex: 1 }}>
        <AnimatePresence mode="wait">

        {/* ══ INTRO ══════════════════════════════════════════════════════════ */}
        {stage === "intro" && (
          <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            style={{ textAlign: "center", paddingTop: "4rem" }}>
            <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 2rem" }}>
              {[1, 1.4, 1.8].map((s, i) => (
                <motion.div key={i} animate={{ scale: [1, s], opacity: [0.3, 0] }} transition={{ repeat: Infinity, duration: 2, delay: i * 0.4 }}
                  style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${CYAN}` }} />
              ))}
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: CYAN_BG, border: `2px solid ${CYAN_BDR}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Mic size={40} color={CYAN} />
              </div>
            </div>

            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, color: CYAN, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", padding: "5px 14px", borderRadius: 20, marginBottom: 20 }}>
              <Sparkles size={11} /> AI Voice Booking
            </span>

            <h1 style={{ fontSize: "clamp(26px, 5vw, 44px)", fontWeight: 400, lineHeight: 1.1, marginBottom: 16, fontFamily: "'DM Serif Display', serif" }}>
              Book your appointment<br />by just speaking
            </h1>
            <p style={{ color: DIM, fontSize: 15, lineHeight: 1.7, maxWidth: 480, margin: "0 auto 12px" }}>
              Our AI assistant will ask your name, age, gender, symptoms and preferences — then help you pick the perfect slot.
            </p>
            <p style={{ color: DIM, fontSize: 13, marginBottom: 36 }}>
              🔊 The assistant will also <strong style={{ color: TEXT }}>speak each question out loud.</strong> Use the mute button in the top-right to silence it.
            </p>

            {noSpeech && (
              <p style={{ color: AMBER, fontSize: 13, marginBottom: 16 }}>
                ⚠️ Your browser doesn't support voice input — you can still type your answers.
              </p>
            )}

            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={startConversation}
              style={{ background: `linear-gradient(135deg, ${CYAN}, #0891b2)`, border: "none", color: "#fff", borderRadius: 14, padding: "16px 40px", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10, boxShadow: "0 0 40px rgba(6,182,212,0.25)" }}>
              <Mic size={18} /> Start Voice Booking
            </motion.button>
            <p style={{ marginTop: 14, fontSize: 12, color: DIM }}>Or type your answers — both work.</p>
          </motion.div>
        )}

        {/* ══ CHAT / RECORDING ═══════════════════════════════════════════════ */}
        {(stage === "recording" || stage === "processing") && (
          <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)" }}>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingBottom: 16 }}>
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: "flex", justifyContent: m.role === "ai" ? "flex-start" : "flex-end" }}>
                  {m.role === "ai" && (
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 8, marginTop: 4 }}>
                      <HeartPulse size={13} color={CYAN} />
                    </div>
                  )}
                  <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: m.role === "ai" ? "4px 14px 14px 14px" : "14px 4px 14px 14px", background: m.role === "ai" ? SURFACE : CYAN_BG, border: `1px solid ${m.role === "ai" ? BORDER : CYAN_BDR}`, fontSize: 14, lineHeight: 1.65, color: TEXT }}>
                    {m.text}
                    {/* Replay button on AI messages */}
                    {m.role === "ai" && (
                      <button onClick={() => speak(m.text, false)}
                        title="Replay this message"
                        style={{ display: "inline-flex", marginLeft: 8, background: "transparent", border: "none", color: DIM, cursor: "pointer", verticalAlign: "middle" }}>
                        <Volume2 size={11} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}

              {interim && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: "14px 4px 14px 14px", background: "rgba(6,182,212,0.06)", border: `1px dashed ${CYAN_BDR}`, fontSize: 14, color: DIM, fontStyle: "italic" }}>
                    {interim}…
                  </div>
                </div>
              )}

              {stage === "processing" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Loader2 size={13} color={CYAN} style={{ animation: "spin 1s linear infinite" }} />
                  </div>
                  <div style={{ padding: "10px 14px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "4px 14px 14px 14px", fontSize: 13, color: DIM }}>
                    AI is processing your responses…
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {stage === "recording" && (
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <textarea value={typedInput} onChange={e => setTypedInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTyped(); } }}
                    placeholder="Type your answer or press the mic to speak…" rows={2}
                    style={{ flex: 1, background: "transparent", border: "none", color: TEXT, fontSize: 14, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5 }} />
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <motion.button whileTap={{ scale: 0.92 }} onClick={listening ? stopListening : startListening}
                      animate={listening ? { boxShadow: ["0 0 0 0 rgba(6,182,212,0.5)", "0 0 0 12px rgba(6,182,212,0)", "0 0 0 0 rgba(6,182,212,0)"] } : {}}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      style={{ width: 44, height: 44, borderRadius: 12, background: listening ? CYAN : CYAN_BG, border: `1px solid ${CYAN_BDR}`, color: listening ? "#020817" : CYAN, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {listening ? <MicOff size={18} /> : <Mic size={18} />}
                    </motion.button>
                    <button onClick={handleTyped} disabled={!typedInput.trim()}
                      style={{ width: 44, height: 44, borderRadius: 12, background: typedInput.trim() ? CYAN_BG : "rgba(255,255,255,0.03)", border: `1px solid ${typedInput.trim() ? CYAN_BDR : BORDER}`, color: typedInput.trim() ? CYAN : DIM, cursor: typedInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Send size={16} />
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 10, color: DIM, marginTop: 6 }}>
                  Question {Math.min(questionIdx + 1, QUESTIONS.length)} of {QUESTIONS.length}
                  {listening && <span style={{ color: CYAN, marginLeft: 8 }}>● Recording…</span>}
                  {!listening && !noSpeech && <span style={{ color: DIM, marginLeft: 8 }}>Click 🎤 or type to answer</span>}
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ══ REVIEW ═════════════════════════════════════════════════════════ */}
        {stage === "review" && extracted && (
          <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: GREEN, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", padding: "5px 14px", borderRadius: 20 }}>
                <CheckCircle2 size={11} /> AI Extraction Complete
              </span>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>Review your booking details</h2>
              <p style={{ color: DIM, fontSize: 13 }}>Edit anything before confirming.</p>
            </div>

            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "1.5rem", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Urgency banner */}
              <div style={{ padding: "10px 14px", borderRadius: 10, background: `${urgencyColor(extracted.urgency)}12`, border: `1px solid ${urgencyColor(extracted.urgency)}30`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: urgencyColor(extracted.urgency) }}>{urgencyLabel(extracted.urgency)}</span>
                <select value={extracted.urgency} onChange={e => setExtracted({ ...extracted, urgency: e.target.value as any })}
                  style={{ background: "transparent", border: "none", color: urgencyColor(extracted.urgency), fontSize: 12, fontWeight: 600, cursor: "pointer", outline: "none" }}>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>

              {/* All extracted fields including name/age/gender */}
              {[
                { label: "Name",       value: extracted.patientName,             field: "patientName",        placeholder: "Your full name" },
                { label: "Age",        value: extracted.age,                     field: "age",                placeholder: "e.g. 28" },
                { label: "Gender",     value: extracted.gender,                  field: "gender",             placeholder: "Male / Female / Other" },
                { label: "Symptoms",   value: extracted.symptoms.join(", "),     field: "symptoms",           placeholder: "e.g. fever, headache" },
                { label: "Duration",   value: extracted.symptomDuration,         field: "symptomDuration",    placeholder: "e.g. 3 days" },
                { label: "Specialty",  value: extracted.preferredSpecialty,      field: "preferredSpecialty", placeholder: "e.g. Cardiology" },
                { label: "Visit type", value: extracted.appointmentType,         field: "appointmentType",    placeholder: "in-person or video" },
                { label: "Notes",      value: extracted.notes,                   field: "notes",              placeholder: "Any extra details" },
              ].map(({ label, value, field, placeholder }) => (
                <div key={field} style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingBottom: 12, borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 11, color: DIM, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", width: 80, flexShrink: 0, paddingTop: 6 }}>{label}</span>
                  {editField === field ? (
                    <div style={{ flex: 1, display: "flex", gap: 6 }}>
                      <input autoFocus defaultValue={value}
                        onBlur={e => {
                          const v = e.target.value;
                          if (field === "symptoms") setExtracted({ ...extracted, symptoms: v.split(",").map(s => s.trim()).filter(Boolean) });
                          else setExtracted({ ...extracted, [field]: v } as any);
                          setEditField(null);
                        }}
                        style={{ flex: 1, background: "rgba(6,182,212,0.05)", border: `1px solid ${CYAN_BDR}`, borderRadius: 8, padding: "5px 10px", color: TEXT, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                      <button onClick={() => setEditField(null)} style={{ background: "transparent", border: "none", color: DIM, cursor: "pointer" }}><X size={14} /></button>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13, color: value ? TEXT : DIM, fontStyle: value ? "normal" : "italic" }}>{value || placeholder}</span>
                      <button onClick={() => setEditField(field)} style={{ background: "transparent", border: "none", color: DIM, cursor: "pointer", flexShrink: 0 }}><Edit2 size={13} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && <p style={{ color: RED, fontSize: 13 }}>{error}</p>}

            <div style={{ display: "flex", gap: 10 }}>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setStage("slots")}
                style={{ flex: 1, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, color: CYAN, padding: "13px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Calendar size={15} /> Pick a Time Slot
              </motion.button>
              <button onClick={startConversation} style={{ padding: "13px 16px", background: "transparent", border: `1px solid ${BORDER}`, color: DIM, borderRadius: 12, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <RotateCcw size={13} /> Redo
              </button>
            </div>
          </motion.div>
        )}

        {/* ══ SLOT PICKER ════════════════════════════════════════════════════ */}
        {stage === "slots" && extracted && (
          <motion.div key="slots" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Pick your slot</h2>
              <p style={{ color: DIM, fontSize: 13 }}>{extracted.preferredSpecialty} · {extracted.appointmentType}</p>
            </div>

            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
              {dateOpts.map(({ value, label }) => (
                <button key={value} onClick={() => setSelectedDate(value)}
                  style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 10, border: `1px solid ${selectedDate === value ? CYAN_BDR : BORDER}`, background: selectedDate === value ? CYAN_BG : "rgba(255,255,255,0.02)", color: selectedDate === value ? CYAN : DIM, cursor: "pointer", fontSize: 13, fontWeight: selectedDate === value ? 700 : 400 }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "1.25rem" }}>
              <p style={{ fontSize: 12, color: DIM, marginBottom: 12, fontWeight: 600 }}>Available Times</p>
              {slots.length === 0
                ? <div style={{ textAlign: "center", padding: "2rem 0" }}>
                    <Loader2 size={24} color={DIM} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
                    <p style={{ color: DIM, fontSize: 13 }}>Loading slots…</p>
                  </div>
                : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
                    {slots.map(({ time, available }) => (
                      <button key={time} disabled={!available} onClick={() => setSelectedSlot(time)}
                        style={{ padding: "10px 6px", borderRadius: 10, border: `1px solid ${!available ? BORDER : selectedSlot === time ? CYAN_BDR : "rgba(148,163,184,0.15)"}`, background: !available ? "rgba(255,255,255,0.01)" : selectedSlot === time ? CYAN_BG : "rgba(255,255,255,0.03)", color: !available ? DIM : selectedSlot === time ? CYAN : TEXT, cursor: available ? "pointer" : "not-allowed", fontSize: 13, fontWeight: selectedSlot === time ? 700 : 400, opacity: available ? 1 : 0.4 }}>
                        {time}
                      </button>
                    ))}
                  </div>
              }
            </div>

            {error && <p style={{ color: RED, fontSize: 13 }}>{error}</p>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStage("review")} style={{ padding: "13px 16px", background: "transparent", border: `1px solid ${BORDER}`, color: DIM, borderRadius: 12, cursor: "pointer", fontSize: 13 }}>
                ← Back
              </button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={confirmBooking} disabled={!selectedSlot || booking}
                style={{ flex: 1, background: selectedSlot ? `linear-gradient(135deg, ${CYAN}, #0891b2)` : "rgba(255,255,255,0.04)", border: `1px solid ${selectedSlot ? CYAN_BDR : BORDER}`, color: selectedSlot ? "#fff" : DIM, padding: "13px", borderRadius: 12, cursor: selectedSlot ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {booking ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Booking…</> : <><CheckCircle2 size={15} /> Confirm Appointment</>}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ══ CONFIRMED ══════════════════════════════════════════════════════ */}
        {stage === "confirmed" && booked && (
          <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            style={{ textAlign: "center", paddingTop: "3rem" }}>
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.5 }}
              style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "2px solid rgba(16,185,129,0.35)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
              <CheckCircle2 size={36} color={GREEN} />
            </motion.div>

            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Appointment Booked!</h2>
            <p style={{ color: DIM, fontSize: 14, marginBottom: 28 }}>
              {booked.status === "confirmed" ? "Your appointment is confirmed." : "Pending confirmation from the clinic."}
            </p>

            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "1.5rem", maxWidth: 380, margin: "0 auto 28px", textAlign: "left" }}>
              {[
                { icon: HeartPulse,    label: "Patient",   val: booked.patientName || extracted?.patientName },
                { icon: Calendar,      label: "Date",      val: booked.date },
                { icon: Clock,         label: "Time",      val: booked.time },
                { icon: HeartPulse,    label: "Specialty", val: booked.specialty },
                { icon: CheckCircle2,  label: "Status",    val: booked.status.charAt(0).toUpperCase() + booked.status.slice(1) },
              ].map(({ icon: Icon, label, val }) => val ? (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <Icon size={14} color={CYAN} />
                  <span style={{ fontSize: 11, color: DIM, width: 70, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</span>
                  <span style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{val}</span>
                </div>
              ) : null)}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => navigate("/dashboard")}
                style={{ display: "flex", alignItems: "center", gap: 7, background: CYAN_BG, border: `1px solid ${CYAN_BDR}`, color: CYAN, padding: "12px 24px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
                View Dashboard <ChevronRight size={15} />
              </button>
              <button onClick={startConversation}
                style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: `1px solid ${BORDER}`, color: DIM, padding: "12px 24px", borderRadius: 12, cursor: "pointer", fontSize: 14 }}>
                Book Another
              </button>
            </div>
          </motion.div>
        )}

        </AnimatePresence>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0 }
        textarea { font-family: inherit }
        ::-webkit-scrollbar { width: 4px; height: 4px }
        ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.15); border-radius: 4px }
        select option { background: #0f172a; color: #e2e8f0 }
      `}</style>
    </div>
  );
}