// Frontend/src/pages/Login.tsx
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { AuthUser } from "../auth/AuthContext";

import API_BASE from "../config/api";
const GOOGLE_CLIENT_ID = "639757510544-sr6f7jfs3fab6sve0vftgcv8sv0gnc29.apps.googleusercontent.com";
const API = `${API_BASE}/auth`;

type Screen = "select" | "patient" | "doctor" | "nurse" | "admin" | "forgot" | "resetSent";

// ── Styles (module-level so they never recreate) ───────────────────────────────
const inp: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(15,23,42,0.9)",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 10, padding: "0.7rem 0.9rem",
  color: "#f1f5f9", fontFamily: "inherit", fontSize: 13.5,
  outline: "none",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 11, color: "#475569",
  fontWeight: 600, letterSpacing: 0.6,
  textTransform: "uppercase", marginBottom: 6,
};
const spnStyle: React.CSSProperties = {
  width: 14, height: 14,
  border: "2px solid rgba(255,255,255,0.15)",
  borderTopColor: "#2dd4bf", borderRadius: "50%",
  animation: "spin 0.6s linear infinite", display: "inline-block",
};
const tealBtn: React.CSSProperties = {
  width: "100%", padding: "0.78rem", borderRadius: 11,
  fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
  background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.3)", color: "#2dd4bf",
  transition: "all 0.18s",
};
const ghostBtn: React.CSSProperties = {
  ...tealBtn,
  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.1)", color: "#64748b",
};
const eyeStyle: React.CSSProperties = {
  position: "absolute", right: 10, top: "50%",
  transform: "translateY(-50%)",
  background: "none", border: "none", color: "#475569",
  cursor: "pointer", fontSize: 11, fontFamily: "inherit",
};
const hintBox: React.CSSProperties = {
  marginTop: 14, background: "rgba(255,255,255,0.015)",
  border: "1px solid rgba(148,163,184,0.07)",
  borderRadius: 10, padding: "0.75rem 0.9rem",
};
const backBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  background: "none", border: "none", color: "#475569",
  cursor: "pointer", fontSize: 13, fontFamily: "inherit",
  padding: 0, marginBottom: "1.5rem",
};

// ── Shared components (OUTSIDE Login — critical for stable focus) ──────────────
function Spinner() {
  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={spnStyle} />
    </>
  );
}

function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{ marginTop: 10, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "0.65rem 0.9rem", color: "#fca5a5", fontSize: 12 }}>
      ⚠ {msg}
    </div>
  );
}

// Field is outside Login so it never remounts on re-render (fixes focus-loss bug)
function Field({ label: fl, type = "text", value, onChange, placeholder, onEnter, suffix }: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; onEnter?: () => void; suffix?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={lbl}>{fl}</label>
      <div style={{ position: "relative" }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => e.key === "Enter" && onEnter?.()}
          style={inp}
          autoComplete={type === "password" ? "current-password" : "email"}
        />
        {suffix}
      </div>
    </div>
  );
}

// EmailForm is outside Login so it never remounts on re-render (fixes focus-loss bug)
function EmailForm({ role, hint, email, setEmail, password, setPassword, showPw, setShowPw, error, loading, onSubmit, onForgotPassword }: {
  role: "patient" | "doctor" | "nurse" | "admin";
  hint: string;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPw: boolean;
  setShowPw: (v: boolean) => void;
  error: string;
  loading: boolean;
  onSubmit: () => void;
  onForgotPassword: () => void;
}) {
  return (
    <>
      <Field
        label="Email address"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@email.com"
        onEnter={onSubmit}
      />
      <Field
        label="Password"
        type={showPw ? "text" : "password"}
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
        onEnter={onSubmit}
        suffix={
          <button onClick={() => setShowPw(!showPw)} style={eyeStyle}>
            {showPw ? "hide" : "show"}
          </button>
        }
      />
      <Err msg={error} />
      <button
        onClick={onSubmit}
        disabled={loading}
        style={{ ...tealBtn, marginTop: 16, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? <><Spinner /> Signing in…</> : "Sign In →"}
      </button>
      <div style={{ textAlign: "right", marginTop: 8 }}>
        <button
          onClick={onForgotPassword}
          style={{ background: "none", border: "none", color: "#06b6d4", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
        >
          Forgot password?
        </button>
      </div>
      <div style={hintBox}>
        <p style={{ fontSize: 11, color: "#334155", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Demo credentials
        </p>
        <p style={{ fontSize: 12, color: "#475569", fontFamily: "monospace", margin: 0 }}>{hint}</p>
      </div>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN LOGIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname;

  const [screen,      setScreen]      = useState<Screen>("select");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [resetEmail,  setResetEmail]  = useState("");
  const [resetToken,  setResetToken]  = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetSuccess,setResetSuccess]= useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Load Google SDK
  useEffect(() => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) { initGoogle(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true; script.defer = true;
    script.onload = () => { setGoogleReady(true); initGoogle(); };
    script.onerror = () => console.warn("Google GSI failed to load");
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  useEffect(() => {
    if (screen === "select" && (window as any).google) setTimeout(renderGoogleButton, 100);
  }, [screen]);

  function initGoogle() {
    if (!(window as any).google?.accounts?.id) return;
    (window as any).google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    setGoogleReady(true);
    renderGoogleButton();
  }

  function renderGoogleButton() {
    if (!googleBtnRef.current || !(window as any).google?.accounts?.id) return;
    googleBtnRef.current.innerHTML = "";
    (window as any).google.accounts.id.renderButton(googleBtnRef.current, {
      theme: "outline", size: "large",
      width: googleBtnRef.current.offsetWidth || 380,
      text: "continue_with", shape: "rectangular", logo_alignment: "left",
    });
  }

  function doRedirect(role: string) {
    if (role === "doctor") navigate("/doctor-dashboard", { replace: true });
    else if (role === "nurse") navigate("/nurse-dashboard", { replace: true });
    else if (role === "admin") navigate("/admin-dashboard", { replace: true });
    else navigate(from && from !== "/login" ? from : "/dashboard", { replace: true });
  }

  async function handleGoogleResponse(response: any) {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Google login failed."); return; }
      const u: AuthUser = {
        id: data.user.id, name: data.user.name,
        email: data.user.email, role: data.user.role,
        photo: data.user.photo, hospitalId: data.user.hospitalId,
      };
      login(data.token, u);
      doRedirect(u.role);
    } catch {
      setError("Google login failed. Try email login instead.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin(expectedRole?: string) {
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields."); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError("Enter a valid email address."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid email or password."); return; }

      if (expectedRole && data.user.role !== expectedRole) {
        setError(`This account is a ${data.user.role}, not a ${expectedRole}. Redirecting correctly…`);
        await new Promise(r => setTimeout(r, 1500));
      }

      const u: AuthUser = {
        id: data.user._id ?? data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        hospitalId: data.user.hospitalId,
      };
      login(data.token, u);
      doRedirect(u.role);
    } catch {
      setError("Cannot connect to server. Is your backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!resetEmail.trim() || !/\S+@\S+\.\S+/.test(resetEmail)) {
      setError("Enter a valid email address."); return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Request failed."); return; }

      // Dev mode: auto-fill token from response
      if (data.devLink) {
        const url = new URL(data.devLink);
        const tok = url.searchParams.get("token") || "";
        setResetToken(tok);
      }
      setScreen("resetSent");
    } catch {
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!newPassword.trim() || newPassword.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Reset failed."); return; }
      setResetSuccess("Password reset! You can now log in.");
      setTimeout(() => goTo("select"), 2000);
    } catch {
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  }

  const goTo = (s: Screen) => {
    setScreen(s); setError(""); setEmail(""); setPassword(""); setShowPw(false);
    setNewPassword(""); setResetSuccess("");
  };

  // ── Shared email form props ────────────────────────────────────────────────
  const emailFormProps = {
    email, setEmail, password, setPassword,
    showPw, setShowPw, error, loading,
  };

  const page: React.CSSProperties = {
    minHeight: "100vh", background: "#020817",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "2.5rem 1rem",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    position: "relative", overflow: "hidden",
  };
  const cardStyle: React.CSSProperties = {
    background: "rgba(10,20,40,0.97)",
    border: "1px solid rgba(148,163,184,0.1)",
    borderRadius: 24, padding: "2rem",
    backdropFilter: "blur(24px)",
    boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
  };

  return (
    <div style={page}>
      {/* Background glows */}
      <div style={{ position: "absolute", top: "-20%", left: "20%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-15%", right: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 430, position: "relative", zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 40, height: 40, background: "linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 19, color: "#fff", boxShadow: "0 0 20px rgba(20,184,166,0.3)" }}>H</div>
            <span style={{ fontSize: 23, fontWeight: 700, color: "#f8fafc", letterSpacing: -0.5 }}>Healthify <span style={{ color: "#2dd4bf" }}>AI</span></span>
          </div>
          <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>Your intelligent healthcare companion</p>
        </div>

        <div style={cardStyle}>
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #14b8a6 30%, #0ea5e9 70%, transparent)", borderRadius: "2px 2px 0 0", marginBottom: "1.75rem" }} />

          {/* ── SELECT ── */}
          {screen === "select" && (
            <>
              <p style={{ fontSize: 21, fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.4, margin: "0 0 4px" }}>Welcome back</p>
              <p style={{ fontSize: 13, color: "#475569", margin: "0 0 1.5rem" }}>Sign in to continue</p>

              <div style={{ marginBottom: 10 }}>
                <div ref={googleBtnRef} style={{ width: "100%", minHeight: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 11, overflow: "hidden" }} />
                {!googleReady && (
                  <button disabled style={{ ...ghostBtn, opacity: 0.45, cursor: "not-allowed" }}>
                    <GoogleIcon /> Loading Google…
                  </button>
                )}
              </div>

              {loading && <p style={{ textAlign: "center", color: "#2dd4bf", fontSize: 13 }}><Spinner /> Signing in with Google…</p>}
              <Err msg={error} />

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(148,163,184,0.1)" }} />
                <span style={{ fontSize: 11, color: "#334155", letterSpacing: 0.5, textTransform: "uppercase" }}>or sign in as</span>
                <div style={{ flex: 1, height: 1, background: "rgba(148,163,184,0.1)" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 12 }}>
                {([
                  { icon: "👤", label: "Patient", screen: "patient" as Screen, color: "#2dd4bf", border: "rgba(20,184,166,0.3)"  },
                  { icon: "🩺", label: "Doctor",  screen: "doctor"  as Screen, color: "#60a5fa", border: "rgba(96,165,250,0.3)"  },
                  { icon: "🏥", label: "Admin",   screen: "admin"   as Screen, color: "#a78bfa", border: "rgba(167,139,250,0.3)" },
                  { icon: "N", label: "Nurse", screen: "nurse" as Screen, color: "#34d399", border: "rgba(52,211,153,0.3)" },
                ] as const).map(r => (
                  <button key={r.label} onClick={() => goTo(r.screen)}
                    style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${r.border}`, borderRadius: 14, padding: "1rem 0.5rem", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{r.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.label}</div>
                    <div style={{ fontSize: 10, color: "#334155", marginTop: 3 }}>Sign in</div>
                  </button>
                ))}
              </div>

            </>
          )}

          {/* ── PATIENT ── */}
          {screen === "patient" && (
            <>
              <button style={backBtnStyle} onClick={() => goTo("select")}>← back</button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem" }}>
                <span style={{ fontSize: 28 }}>👤</span>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Patient Login</p>
                  <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Access your health dashboard</p>
                </div>
              </div>
              <EmailForm {...emailFormProps} role="patient"
                hint="Any email you registered as a patient"
                onSubmit={() => handleEmailLogin("patient")}
                onForgotPassword={() => { setResetEmail(email); goTo("forgot"); }} />
            </>
          )}

          {/* ── DOCTOR ── */}
          {screen === "doctor" && (
            <>
              <button style={backBtnStyle} onClick={() => goTo("select")}>← back</button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem" }}>
                <span style={{ fontSize: 28 }}>🩺</span>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Doctor Login</p>
                  <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Access your clinic dashboard</p>
                </div>
              </div>
              <EmailForm {...emailFormProps} role="doctor"
                hint="doctor@chataid.in / Doctor@1234"
                onSubmit={() => handleEmailLogin("doctor")}
                onForgotPassword={() => { setResetEmail(email); goTo("forgot"); }} />
            </>
          )}

          {screen === "nurse" && (
            <>
              <button style={backBtnStyle} onClick={() => goTo("select")}>back</button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem" }}>
                <span style={{ fontSize: 28, color: "#34d399", fontWeight: 800 }}>N</span>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Nurse Login</p>
                  <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Access your nurse account</p>
                </div>
              </div>
              <EmailForm {...emailFormProps} role="nurse"
                hint="Use the nurse account you created"
                onSubmit={() => handleEmailLogin("nurse")}
                onForgotPassword={() => { setResetEmail(email); goTo("forgot"); }} />
            </>
          )}

          {screen === "admin" && (
            <>
              <button style={backBtnStyle} onClick={() => goTo("select")}>← back</button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem" }}>
                <span style={{ fontSize: 28 }}>🏥</span>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Admin Login</p>
                  <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Access hospital management</p>
                </div>
              </div>
              <EmailForm {...emailFormProps} role="admin"
                hint="admin@aiimsvijaypur.in / Admin@123"
                onSubmit={() => handleEmailLogin("admin")}
                onForgotPassword={() => { setResetEmail(email); goTo("forgot"); }} />
            </>
          )}

          {/* FORGOT PASSWORD */}
          {screen === "forgot" && (
            <>
              <button style={backBtnStyle} onClick={() => goTo("select")}>← back</button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem" }}>
                <span style={{ fontSize: 28 }}>🔑</span>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Forgot Password</p>
                  <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Enter your email to get a reset link</p>
                </div>
              </div>
              <Field
                label="Email address"
                type="email"
                value={resetEmail}
                onChange={setResetEmail}
                placeholder="you@email.com"
                onEnter={handleForgotPassword}
              />
              <Err msg={error} />
              <button
                onClick={handleForgotPassword}
                disabled={loading}
                style={{ ...tealBtn, marginTop: 16, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              >
                {loading ? <><Spinner /> Sending…</> : "Send Reset Link →"}
              </button>
            </>
          )}

          {/* RESET PASSWORD */}
          {screen === "resetSent" && (
            <>
              <button style={backBtnStyle} onClick={() => goTo("forgot")}>← back</button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem" }}>
                <span style={{ fontSize: 28 }}>🔒</span>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Reset Password</p>
                  <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Enter your new password</p>
                </div>
              </div>
              <div style={{ background: "rgba(6,182,212,0.07)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 8, padding: "0.65rem 0.9rem", color: "#67e8f9", fontSize: 12, marginBottom: 14 }}>
                ✅ Reset link generated for <strong>{resetEmail}</strong>
              </div>
              <Field
                label="New Password"
                type={showPw ? "text" : "password"}
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Min 6 characters"
                onEnter={handleResetPassword}
                suffix={
                  <button onClick={() => setShowPw(!showPw)} style={eyeStyle}>
                    {showPw ? "hide" : "show"}
                  </button>
                }
              />
              {resetSuccess && (
                <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "0.65rem 0.9rem", color: "#6ee7b7", fontSize: 12, marginTop: 8 }}>
                  ✅ {resetSuccess}
                </div>
              )}
              <Err msg={error} />
              <button
                onClick={handleResetPassword}
                disabled={loading}
                style={{ ...tealBtn, marginTop: 16, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              >
                {loading ? <><Spinner /> Resetting…</> : "Reset Password →"}
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", color: "#1e293b", fontSize: 11, marginTop: 20 }}>
          By continuing you agree to Healthify AI's Terms of Service
        </p>
      </div>
    </div>
  );
}
