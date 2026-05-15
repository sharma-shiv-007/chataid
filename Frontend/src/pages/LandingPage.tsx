import { motion, type Variants, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  HeartPulse, Mic, AlertTriangle, Menu, X,
  Stethoscope, LayoutGrid, ArrowRight, Bot, FileText,
  Activity, Pill, BarChart2, Star, ChevronLeft, ChevronRight,
  Twitter, Github, Linkedin, Mail, Phone, Shield, Clock, Users,
  Info, Home,
} from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import { useTheme } from "../contexts/ThemeContext";

// ─── Types / constants ────────────────────────────────────────────────────────
type CubicBezier = [number, number, number, number];
const EASE: CubicBezier = [0.25, 0.1, 0.25, 1];

// ─── Shared animation variants ────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, ease: EASE, delay: i * 0.09 },
  }),
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: "Home",     href: "#hero" },
  { label: "Doctors",  href: "#specialties" },
  { label: "Services", href: "#features" },
  { label: "About",    href: "#cta" },
];

const FEATURES = [
  { icon: Mic,           color: "#06b6d4", title: "Voice Booking",    desc: "Book appointments hands-free. Just speak your symptoms and let AI handle the rest." },
  { icon: AlertTriangle, color: "#ef4444", title: "Emergency SOS",    desc: "One tap connects you to the nearest available emergency doctor within seconds." },
  { icon: Bot,           color: "#8b5cf6", title: "AI Assistant",     desc: "24/7 symptom checker, triage, and health Q&A powered by medical-grade AI." },
  { icon: FileText,      color: "#10b981", title: "Digital Records",  desc: "Aadhaar-linked UHID stores your entire health history, accessible anywhere." },
  { icon: Pill,          color: "#f59e0b", title: "Prescriptions",    desc: "Receive, store, and refill prescriptions digitally — no paper slips needed." },
  { icon: BarChart2,     color: "#ec4899", title: "Health Analytics", desc: "Track vitals, lab trends, and visit history with interactive dashboards." },
];

const SPECIALTIES = [
  { name: "Cardiology",    count: 124, emoji: "❤️" },
  { name: "Neurology",     count: 87,  emoji: "🧠" },
  { name: "Dermatology",   count: 96,  emoji: "🩺" },
  { name: "Pediatrics",    count: 113, emoji: "👶" },
  { name: "Orthopedics",   count: 78,  emoji: "🦴" },
  { name: "Oncology",      count: 62,  emoji: "🔬" },
  { name: "Ophthalmology", count: 55,  emoji: "👁️" },
  { name: "Psychiatry",    count: 44,  emoji: "🧘" },
  { name: "Gynecology",    count: 91,  emoji: "🌸" },
  { name: "ENT",           count: 68,  emoji: "👂" },
];

const STEPS = [
  { num: "01", title: "Register & Complete Profile",        desc: "Create your account with Aadhaar verification. Add your health history, allergies, and insurance in under 3 minutes." },
  { num: "02", title: "Voice-Book or Browse Doctors",       desc: "Say \"Book a cardiologist near me\" or browse by specialty, rating, and availability. AI finds the best match." },
  { num: "03", title: "Attend & Get Your Records",          desc: "Visit the clinic or join a video call. Your prescription, reports, and next steps are instantly in your dashboard." },
];

const TESTIMONIALS = [
  { name: "Priya Sharma",  city: "Delhi",     rating: 5, avatar: "PS", text: "Booked an emergency slot for my father at 2 AM using just my voice. The doctor was ready when we arrived. Absolutely life-saving." },
  { name: "Rahul Mehta",   city: "Mumbai",    rating: 5, avatar: "RM", text: "The AI assistant caught a drug interaction my pharmacist missed. ChatAid isn't just convenient — it's genuinely smart." },
  { name: "Ananya Iyer",   city: "Chennai",   rating: 5, avatar: "AI", text: "Finally an app that works in Tamil! Booked my OB appointment in my language. The digital prescription was ready the same day." },
  { name: "Suresh Patel",  city: "Ahmedabad", rating: 4, avatar: "SP", text: "Managing my father's diabetes follow-ups used to be a nightmare. Now I get reminders, track his vitals, and video-consult in one place." },
  { name: "Kavitha Reddy", city: "Hyderabad", rating: 5, avatar: "KR", text: "Switched from three different apps to just ChatAid. The health analytics dashboard showed me patterns in my BP I'd never noticed." },
];

const FOOTER_COLS = [
  { heading: "About",    links: ["Our Story", "Team", "Careers", "Press Kit"] },
  { heading: "Features", links: ["Voice Booking", "Emergency SOS", "AI Assistant", "Digital Records"] },
  { heading: "Legal",    links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "HIPAA Compliance"] },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────
function useScrolled(threshold = 10) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, [threshold]);
  return scrolled;
}

// ─── Floating icon ────────────────────────────────────────────────────────────
function FloatingIcon({ icon: Icon, color, style }: { icon: React.ElementType; color: string; style: React.CSSProperties }) {
  return (
    <motion.div
      animate={{ y: [0, -14, 0], opacity: [0.2, 0.5, 0.2] }}
      transition={{ repeat: Infinity, duration: 3.8, ease: "easeInOut" }}
      style={{ position: "absolute", pointerEvents: "none", ...style }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}16`, border: `1px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={20} color={color} />
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · NAVBAR
// ═══════════════════════════════════════════════════════════════════════════════
function Navbar() {
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);

  const go = (href: string) => {
    setOpen(false);
    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(href);
    }
  };

  return (
    <>
      <motion.nav
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: EASE }}
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
          background: scrolled ? "var(--nav-bg, rgba(2,8,23,0.94))" : "var(--page-bg-alpha, rgba(2,8,23,0.6))",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${scrolled ? "rgba(6,182,212,0.18)" : "rgba(148,163,184,0.07)"}`,
          transition: "background 0.3s, border-color 0.3s",
          padding: "0 24px",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>

          {/* ── Logo (left) ── */}
          <div onClick={() => go("#hero")} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", flexShrink: 0 }}>
            <motion.div animate={{ scale: [1, 1.18, 1] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}>
              <HeartPulse size={23} color="#06b6d4" />
            </motion.div>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.4px", color: "var(--text, #e2e8f0)" }}>
              Chat<span style={{ color: "#06b6d4" }}>Aid</span>
            </span>
          </div>

          {/* ── Nav links (centre, desktop) ── */}
          <div className="ca-desktop" style={{ display: "flex", gap: 2 }}>
            {NAV_LINKS.map(({ label, href }) => (
              <button key={label} onClick={() => go(href)}
                style={{ background: "transparent", border: "none", color: "var(--text-dim, #94a3b8)", fontSize: 14, fontWeight: 500, padding: "8px 14px", borderRadius: 8, cursor: "pointer", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e2e8f0")}
                onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
              >{label}</button>
            ))}
          </div>

          {/* ── Right actions (desktop) ── */}
          <div className="ca-desktop" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <ThemeToggle size={15} />
            <button onClick={() => navigate("/login")}
              style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.22)", color: "var(--text, #e2e8f0)", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              Login
            </button>
            <button onClick={() => navigate("/signup")}
              style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Sign Up
            </button>
          </div>

          {/* ── Hamburger (mobile) ── */}
          <div className="ca-mobile" style={{ display: "none", alignItems: "center", gap: 8 }}>
            <ThemeToggle size={15} />
            <button onClick={() => setOpen(true)}
              style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.2)", color: "var(--text, #e2e8f0)", borderRadius: 8, padding: "8px", cursor: "pointer" }}>
              <Menu size={20} />
            </button>
          </div>
        </div>
      </motion.nav>

      {/* ── Mobile Drawer ── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300 }} />
            <motion.div key="dr"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 272, background: "var(--surface-2, #0f172a)", borderLeft: "1px solid rgba(148,163,184,0.1)", zIndex: 400, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 6 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text, #e2e8f0)" }}>Chat<span style={{ color: "#06b6d4" }}>Aid</span></span>
                <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: "var(--text-dim, #94a3b8)", cursor: "pointer" }}><X size={21} /></button>
              </div>
              {NAV_LINKS.map(({ label, href }) => (
                <button key={label} onClick={() => go(href)}
                  style={{ background: "transparent", border: "none", color: "var(--text-dim, #94a3b8)", fontSize: 15, fontWeight: 500, padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
                  {label}
                </button>
              ))}
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => { setOpen(false); navigate("/login"); }}
                  style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.22)", color: "var(--text, #e2e8f0)", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Login</button>
                <button onClick={() => { setOpen(false); navigate("/signup"); }}
                  style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", border: "none", color: "#fff", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Sign Up</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .ca-desktop { display: none !important; }
          .ca-mobile  { display: flex !important; }
        }
      `}</style>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · HERO
// ═══════════════════════════════════════════════════════════════════════════════
function Hero() {
  const navigate = useNavigate();
  return (
    <section id="hero" style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "120px 24px 80px" }}>
      {/* Glow */}
      <div style={{ position: "absolute", top: "35%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 480, background: "radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, rgba(139,92,246,0.07) 50%, transparent 70%)", pointerEvents: "none" }} />

      {/* Floating icons */}
      <FloatingIcon icon={HeartPulse}   color="#ef4444" style={{ left: "8%",  top: "20%" }} />
      <FloatingIcon icon={Stethoscope}  color="#06b6d4" style={{ left: "84%", top: "17%" }} />
      <FloatingIcon icon={Activity}     color="#10b981" style={{ left: "6%",  top: "64%" }} />
      <FloatingIcon icon={Pill}         color="#f59e0b" style={{ left: "87%", top: "60%" }} />
      <FloatingIcon icon={Shield}       color="#8b5cf6" style={{ left: "77%", top: "38%" }} />
      <FloatingIcon icon={FileText}     color="#ec4899" style={{ left: "13%", top: "43%" }} />

      <motion.div
        initial="hidden" animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 780 }}
      >
        <motion.div variants={fadeUp} custom={0}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", padding: "6px 16px", borderRadius: 20, marginBottom: 28 }}>
            <Mic size={12} /> Voice-First Healthcare Platform
          </span>
        </motion.div>

        <motion.h1 variants={fadeUp} custom={1}
          style={{ fontSize: "clamp(38px, 6.5vw, 72px)", fontWeight: 400, lineHeight: 1.06, marginBottom: 22, background: "linear-gradient(135deg, var(--text, #e2e8f0) 0%, #06b6d4 45%, #8b5cf6 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontFamily: "'DM Serif Display', serif" }}>
          AI-Powered Healthcare,<br />At Your Voice.
        </motion.h1>

        <motion.p variants={fadeUp} custom={2}
          style={{ fontSize: 17, color: "var(--text-dim, #64748b)", maxWidth: 520, margin: "0 auto 44px", lineHeight: 1.75 }}>
          Book doctors, file emergencies, and manage your health records — all by speaking. No forms. No queues. No friction.
        </motion.p>

        <motion.div variants={fadeUp} custom={3} style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 64 }}>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/voice")}
            style={{ background: "linear-gradient(135deg,#06b6d4,#0891b2)", border: "none", color: "#fff", borderRadius: 14, padding: "16px 36px", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 9, boxShadow: "0 0 48px rgba(6,182,212,0.3)" }}>
            <Mic size={18} /> Book via Voice
          </motion.button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            animate={{ boxShadow: ["0 0 0 0 rgba(239,68,68,0.5)", "0 0 0 10px rgba(239,68,68,0)", "0 0 0 0 rgba(239,68,68,0)"] }}
            transition={{ repeat: Infinity, duration: 2 }}
            onClick={() => navigate("/emergency")}
            style={{ background: "transparent", border: "2px solid #ef4444", color: "#ef4444", borderRadius: 14, padding: "16px 36px", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 9 }}>
            <AlertTriangle size={18} /> Emergency Booking
          </motion.button>
        </motion.div>

        {/* Stats row */}
        <motion.div variants={fadeUp} custom={4} style={{ display: "flex", justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { icon: Users,     val: "2,400+", label: "Doctors" },
            { icon: Clock,     val: "98%",    label: "Uptime" },
            { icon: HeartPulse,val: "50,000", label: "Patients" },
          ].map(({ icon: Icon, val, label }, i) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 28px", borderRight: i < 2 ? "1px solid rgba(148,163,184,0.15)" : "none" }}>
              <Icon size={16} color="#06b6d4" />
              <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text, #e2e8f0)" }}>{val}</span>
              <span style={{ fontSize: 13, color: "var(--text-dim, #64748b)" }}>{label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · FEATURES
// ═══════════════════════════════════════════════════════════════════════════════
function Features() {
  return (
    <section id="features" style={{ padding: "96px 24px", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} style={{ textAlign: "center", marginBottom: 56 }}>
          <span style={{ display: "inline-block", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "#8b5cf6", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", padding: "6px 16px", borderRadius: 20, marginBottom: 18 }}>Why ChatAid?</span>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 44px)", fontFamily: "'DM Serif Display', serif", fontWeight: 400, color: "var(--text, #e2e8f0)", marginBottom: 14 }}>Everything your health needs</h2>
          <p style={{ color: "var(--text-dim, #64748b)", fontSize: 15, maxWidth: 480, margin: "0 auto" }}>Six pillars that make ChatAid the last healthcare app you'll ever install.</p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {FEATURES.map(({ icon: Icon, color, title, desc }, i) => (
            <motion.div key={title}
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              whileHover={{ y: -4 }}
              style={{ background: "rgba(15,23,42,0.75)", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 18, padding: "28px", backdropFilter: "blur(20px)", transition: "border-color 0.25s" }}
            >
              <div style={{ width: 46, height: 46, borderRadius: 12, background: `${color}16`, border: `1px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                <Icon size={21} color={color} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text, #e2e8f0)", marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 13.5, color: "var(--text-dim, #64748b)", lineHeight: 1.72 }}>{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · SPECIALTIES
// ═══════════════════════════════════════════════════════════════════════════════
function Specialties() {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: "l" | "r") => ref.current?.scrollBy({ left: d === "r" ? 260 : -260, behavior: "smooth" });

  return (
    <section id="specialties" style={{ padding: "80px 0", background: "rgba(15,23,42,0.5)", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 36, flexWrap: "wrap", gap: 16 }}>
          <div>
            <span style={{ display: "inline-block", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", padding: "6px 16px", borderRadius: 20, marginBottom: 14 }}>Specialties</span>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontFamily: "'DM Serif Display', serif", fontWeight: 400, color: "var(--text, #e2e8f0)" }}>Find your specialist</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["l", "r"] as const).map(d => (
              <button key={d} onClick={() => scroll(d)} style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(15,23,42,0.8)", border: "1px solid rgba(148,163,184,0.15)", color: "var(--text-dim, #94a3b8)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {d === "l" ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      <div ref={ref} style={{ display: "flex", gap: 14, overflowX: "auto", padding: "4px 24px 12px", scrollbarWidth: "none" }}>
        {SPECIALTIES.map(({ name, count, emoji }, i) => (
          <motion.div key={name}
            initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.05, ease: EASE }}
            whileHover={{ scale: 1.05 }}
            onClick={() => navigate(`/doctors?specialty=${name.toLowerCase()}`)}
            style={{ flexShrink: 0, background: "var(--surface, rgba(15,23,42,0.85))", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 14, padding: "20px 22px", cursor: "pointer", minWidth: 158 }}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>{emoji}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text, #e2e8f0)", marginBottom: 4 }}>{name}</div>
            <div style={{ fontSize: 12, color: "#06b6d4" }}>{count} doctors</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · HOW IT WORKS
// ═══════════════════════════════════════════════════════════════════════════════
function HowItWorks() {
  return (
    <section id="how" style={{ padding: "96px 24px", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} style={{ textAlign: "center", marginBottom: 64 }}>
          <span style={{ display: "inline-block", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", padding: "6px 16px", borderRadius: 20, marginBottom: 18 }}>How It Works</span>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 44px)", fontFamily: "'DM Serif Display', serif", fontWeight: 400, color: "var(--text, #e2e8f0)" }}>Three steps to better care</h2>
        </motion.div>

        {STEPS.map(({ num, title, desc }, i) => (
          <motion.div key={num}
            initial={{ opacity: 0, x: i % 2 === 0 ? -28 : 28 }}
            whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.55, delay: i * 0.12, ease: EASE }}
            style={{ display: "flex", gap: 32, alignItems: "flex-start", padding: "36px 0", borderBottom: i < STEPS.length - 1 ? "1px solid rgba(148,163,184,0.08)" : "none" }}
          >
            <div style={{ flexShrink: 0, width: 72, height: 72, borderRadius: 18, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#06b6d4", fontFamily: "'DM Serif Display', serif" }}>{num}</span>
            </div>
            <div style={{ paddingTop: 6 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text, #e2e8f0)", marginBottom: 10 }}>{title}</h3>
              <p style={{ fontSize: 14.5, color: "var(--text-dim, #64748b)", lineHeight: 1.75, maxWidth: 560 }}>{desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · TESTIMONIALS
// ═══════════════════════════════════════════════════════════════════════════════
function Testimonials() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = TESTIMONIALS.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx(i => (i + 1) % total), 5000);
    return () => clearInterval(t);
  }, [paused, total]);

  const t = TESTIMONIALS[idx];

  return (
    <section style={{ padding: "80px 24px", background: "rgba(15,23,42,0.5)", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} style={{ marginBottom: 48 }}>
          <span style={{ display: "inline-block", background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#ec4899", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", padding: "6px 16px", borderRadius: 20, marginBottom: 18 }}>Testimonials</span>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontFamily: "'DM Serif Display', serif", fontWeight: 400, color: "var(--text, #e2e8f0)" }}>Patients love ChatAid</h2>
        </motion.div>

        <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <AnimatePresence mode="wait">
            <motion.div key={idx}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: EASE }}
              style={{ background: "var(--surface, rgba(15,23,42,0.85))", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 20, padding: "40px 36px", backdropFilter: "blur(20px)", marginBottom: 28 }}
            >
              <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 20 }}>
                {[...Array(t.rating)].map((_, i) => <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />)}
              </div>
              <p style={{ fontSize: 16, color: "var(--text, #cbd5e1)", lineHeight: 1.8, marginBottom: 28, fontStyle: "italic" }}>"{t.text}"</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#fff" }}>{t.avatar}</div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text, #e2e8f0)" }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim, #64748b)" }}>{t.city}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Progress dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            {TESTIMONIALS.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 4, background: i === idx ? "#06b6d4" : "rgba(148,163,184,0.25)", border: "none", cursor: "pointer", transition: "width 0.3s, background 0.3s", padding: 0 }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7 · FOOTER CTA + FOOTER
// ═══════════════════════════════════════════════════════════════════════════════
function Footer() {
  const navigate = useNavigate();
  return (
    <>
      {/* Pre-footer CTA */}
      <section id="cta" style={{ padding: "80px 24px", position: "relative", zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          style={{ maxWidth: 900, margin: "0 auto", background: "linear-gradient(135deg, rgba(6,182,212,0.1), rgba(139,92,246,0.12))", border: "1px solid rgba(6,182,212,0.22)", borderRadius: 22, padding: "60px 40px", textAlign: "center" }}
        >
          <h2 style={{ fontSize: "clamp(24px, 4vw, 42px)", fontFamily: "'DM Serif Display', serif", fontWeight: 400, color: "var(--text, #e2e8f0)", marginBottom: 16 }}>Ready to take control of your health?</h2>
          <p style={{ color: "var(--text-dim, #64748b)", fontSize: 15, marginBottom: 36 }}>Join 50,000+ patients already using ChatAid across India.</p>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => navigate("/signup")}
            style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", border: "none", color: "#fff", borderRadius: 12, padding: "15px 40px", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 9 }}>
            Create Free Account <ArrowRight size={16} />
          </motion.button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(148,163,184,0.08)", padding: "56px 24px 32px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 40, marginBottom: 48 }}>
            {/* Brand */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <HeartPulse size={20} color="#06b6d4" />
                <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text, #e2e8f0)" }}>Chat<span style={{ color: "#06b6d4" }}>Aid</span></span>
              </div>
              <p style={{ fontSize: 13.5, color: "var(--text-dim, #64748b)", lineHeight: 1.75, maxWidth: 220, marginBottom: 20 }}>AI-powered healthcare for Bharat. Voice-first. Secure. Always there when you need it.</p>
              <div style={{ display: "flex", gap: 8 }}>
                {[Twitter, Github, Linkedin, Mail].map((Icon, i) => (
                  <button key={i} style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(15,23,42,0.8)", border: "1px solid rgba(148,163,184,0.12)", color: "var(--text-dim, #64748b)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={15} />
                  </button>
                ))}
              </div>
            </div>

            {FOOTER_COLS.map(({ heading, links }) => (
              <div key={heading}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text-dim, #94a3b8)", marginBottom: 16 }}>{heading}</div>
                {links.map(l => (
                  <div key={l} style={{ fontSize: 13.5, color: "var(--text-dim, #64748b)", marginBottom: 10, cursor: "pointer", transition: "color 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#e2e8f0")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}>{l}</div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid rgba(148,163,184,0.08)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#475569" }}>© {new Date().getFullYear()} ChatAid Clinic. Built with care for India's patients.</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Phone size={12} color="#475569" />
              <span style={{ fontSize: 12, color: "#475569" }}>1800-CHATAID · Available 24/7</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--page-bg, #020817)", color: "var(--text, #e2e8f0)", fontFamily: "'DM Sans', sans-serif", position: "relative", overflowX: "hidden" }}>
      {/* Grid bg */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0 }} />
      <Navbar />
      <Hero />
      <Features />
      <Specialties />
      <HowItWorks />
      <Testimonials />
      <Footer />
    </div>
  );
}
