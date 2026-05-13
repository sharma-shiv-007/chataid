// src/pages/SignupWizard.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse, AlertCircle, Plus, Trash2, ChevronDown,
  Eye, EyeOff, CheckCircle2, User, Stethoscope, Shield, Heart,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

const STEPS = [
  { id:1, label:"Account",   icon:User,        title:"Create your account",    sub:"Basic login credentials and personal details" },
  { id:2, label:"Medical",   icon:Stethoscope, title:"Medical history",        sub:"Conditions, allergies, medications & immunizations" },
  { id:3, label:"Insurance", icon:Shield,      title:"Insurance & care team",  sub:"Coverage details and preferred doctors" },
  { id:4, label:"Lifestyle", icon:Heart,       title:"Lifestyle & background", sub:"Help your doctors understand you better" },
];

const BLOOD_GROUPS  = ["A+","A−","B+","B−","AB+","AB−","O+","O−","Unknown"];
const STATES_LIST   = ["Jammu & Kashmir","Delhi","Maharashtra","Karnataka","Uttar Pradesh","Rajasthan","Punjab","Himachal Pradesh","Haryana","Tamil Nadu","Other"];
const SEVERITY_OPTS = ["Mild","Moderate","Severe"];
const MED_FREQ_OPTS = ["Once daily","Twice daily","Three times daily","Once at night","Before meals","After meals","As needed"];
const IMMUN_STATUS  = ["done","due","scheduled"];
const ACTIVITY_OPTS = ["Sedentary","Light","Moderate","Active","Very active"];

const inp = (error?: boolean): React.CSSProperties => ({
  width:"100%", boxSizing:"border-box" as const,
  background:"rgba(15,23,42,0.8)",
  border:`1px solid ${error ? "rgba(239,68,68,0.4)" : "rgba(148,163,184,0.1)"}`,
  borderRadius:10, padding:"0.65rem 0.9rem",
  color:"#f1f5f9", fontFamily:"inherit", fontSize:13, outline:"none",
  transition:"border-color .2s",
});
const lbl: React.CSSProperties = {
  fontSize:11, color:"#64748b", fontWeight:600, letterSpacing:0.5,
  textTransform:"uppercase" as const, display:"block", marginBottom:5,
};
const errTxt: React.CSSProperties = { fontSize:11, color:"#ef4444", marginTop:3 };
const selStyle: React.CSSProperties = { ...inp(), appearance:"none" as const, cursor:"pointer" };
const accentColor  = "#06b6d4";
const accentBorder = "rgba(6,182,212,0.3)";
const accentBg     = "rgba(6,182,212,0.1)";

export default function SignupWizard() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [apiErr,  setApiErr]  = useState("");
  const [errors,  setErrors]  = useState<Record<string,string>>({});
  const [showPw,  setShowPw]  = useState(false);

  // ── Step 1 fields ──────────────────────────────────────────────────────────
  const [s1, setS1] = useState({
    name:"", dob:"", age:"", gender:"", blood:"",
    phone:"", emergencyContact:"", emergencyName:"",
    address:"", city:"", state:"", aadhaar:"",
    email:"", password:"", confirmPassword:"",
  });

  // ── Step 2 fields ──────────────────────────────────────────────────────────
  const [conditions,    setConditions]    = useState([{ name:"", since:"", status:"Active" }]);
  const [allergies,     setAllergies]     = useState([{ name:"", severity:"Mild", reaction:"" }]);
  const [medications,   setMedications]   = useState([{ name:"", dose:"", freq:"Once daily", refillDate:"", remaining:30 }]);
  const [immunizations, setImmunizations] = useState([
    { name:"COVID-19 (Booster)", date:"", status:"due" },
    { name:"Influenza",          date:"", status:"due" },
    { name:"Hepatitis B",        date:"", status:"due" },
  ]);

  // ── Step 3 fields ──────────────────────────────────────────────────────────
  const [s3, setS3] = useState({ insurance:"", policyNo:"", primaryDoctor:"", preferredHospital:"" });

  // ── Step 4 fields ──────────────────────────────────────────────────────────
  const [s4, setS4] = useState({ smoker:"No", alcohol:"No", activityLevel:"Moderate", dietType:"", occupation:"" });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const set1 = (k: keyof typeof s1) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setS1(p => ({ ...p, [k]: e.target.value }));
  const set3 = (k: keyof typeof s3) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setS3(p => ({ ...p, [k]: e.target.value }));
  const set4 = (k: keyof typeof s4, v: string) => setS4(p => ({ ...p, [k]: v }));

  const updateList = <T,>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    idx: number, key: keyof T, val: string,
  ) => setter(prev => prev.map((item, i) => i === idx ? { ...item, [key]: val } : item));

  const addItem    = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, blank: T) =>
    setter(p => [...p, blank]);
  const removeItem = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, idx: number) =>
    setter(p => p.filter((_, i) => i !== idx));

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateStep1 = () => {
    const e: Record<string,string> = {};
    if (!s1.name.trim())    e.name     = "Required";
    if (!s1.dob)            e.dob      = "Required";
    if (!s1.age)            e.age      = "Required";
    if (!s1.gender)         e.gender   = "Required";
    if (!s1.phone.trim())   e.phone    = "Required";
    if (!s1.email.trim())   e.email    = "Required";
    if (!s1.password)       e.password = "Required";
    if (s1.password.length < 8)               e.password        = "Min 8 characters";
    if (s1.password !== s1.confirmPassword)   e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const next = async () => {
    setApiErr("");

    // ── STEP 1 → register account ──────────────────────────────────────────
    if (step === 1) {
      if (!validateStep1()) return;
      setLoading(true);
      try {
        // authController.signupPatient expects: fullName, email, password, age, gender, phone, dob
        const data = await api.register({
          fullName: s1.name,
          email:    s1.email,
          password: s1.password,
          age:      Number(s1.age),
          gender:   s1.gender,
          phone:    s1.phone,
          dob:      s1.dob,
        });

        // Save token + user so subsequent PATCH calls are authenticated
        localStorage.setItem("medicare_token",   data.token);
        localStorage.setItem("medicare_patient", JSON.stringify(data.user));
        login(data.token, { ...data.user, role: "patient" });
        setStep(2);
      } catch (err: any) {
        setApiErr(err.message || "Signup failed. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── STEP 2 → save medical history ──────────────────────────────────────
    if (step === 2) {
      setLoading(true);
      try {
        await api.updateProfile({
          blood:            s1.blood,
          emergencyContact: s1.emergencyContact,
          emergencyName:    s1.emergencyName,
          address:          s1.address,
          city:             s1.city,
          state:            s1.state,
          aadhaar:          s1.aadhaar,
          // filter out empty rows
          conditions:    conditions.filter(c => c.name.trim()),
          allergies:     allergies.filter(a => a.name.trim()),
          medications:   medications.filter(m => m.name.trim()),
          immunizations: immunizations.filter(im => im.name.trim()),
        });
        setStep(3);
      } catch (err: any) {
        setApiErr(err.message || "Could not save medical history.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── STEP 3 → save insurance & care team ────────────────────────────────
    if (step === 3) {
      setLoading(true);
      try {
        await api.updateProfile({ ...s3 });
        setStep(4);
      } catch (err: any) {
        setApiErr(err.message || "Could not save insurance details.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── STEP 4 → save lifestyle + mark complete ────────────────────────────
    if (step === 4) {
      setLoading(true);
      try {
        await api.updateProfile({ ...s4, profileComplete: true });
        navigate("/dashboard");
      } catch (err: any) {
        setApiErr(err.message || "Could not save lifestyle info.");
      } finally {
        setLoading(false);
      }
    }
  };

  const AddBtn = ({ onClick, color }: { onClick: () => void; color: string }) => (
    <button type="button" onClick={onClick} style={{
      display:"flex", alignItems:"center", gap:4, fontSize:11,
      padding:"4px 10px", borderRadius:8, cursor:"pointer",
      background:`rgba(${color},0.1)`, border:`1px solid rgba(${color},0.25)`,
      color:`rgb(${color})`, fontFamily:"inherit",
    }}>
      <Plus size={11}/> Add
    </button>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#020817", fontFamily:"system-ui, -apple-system, sans-serif", color:"#e2e8f0", padding:"2rem 1rem" }}>
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", background:"radial-gradient(ellipse 80% 50% at 30% 20%, rgba(6,182,212,0.05) 0%, transparent 60%)" }}/>

      <div style={{ maxWidth:700, margin:"0 auto", position:"relative", zIndex:1 }}>

        {/* Header */}
        <div style={{ textAlign:"center" as const, marginBottom:"2rem" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:16 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"rgba(6,182,212,0.12)", border:"1px solid rgba(6,182,212,0.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <HeartPulse color="#06b6d4" size={18}/>
            </div>
            <span style={{ fontSize:17, fontWeight:800, color:"#f1f5f9", letterSpacing:-0.4 }}>
              MediCare <span style={{ color:"#06b6d4" }}>AI</span>
            </span>
          </div>
          <div style={{ fontSize:24, fontWeight:800, color:"#f1f5f9", letterSpacing:-0.6, marginBottom:6 }}>{STEPS[step-1].title}</div>
          <div style={{ fontSize:13, color:"#475569" }}>{STEPS[step-1].sub}</div>
        </div>

        {/* Stepper */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"2rem" }}>
          {STEPS.map((s, i) => {
            const done = step > s.id, current = step === s.id;
            return (
              <div key={s.id} style={{ display:"flex", alignItems:"center" }}>
                <div style={{ display:"flex", flexDirection:"column" as const, alignItems:"center", gap:6 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background: done ? "rgba(16,185,129,0.15)" : current ? accentBg : "rgba(255,255,255,0.04)", border:`1px solid ${done ? "rgba(16,185,129,0.3)" : current ? accentBorder : "rgba(255,255,255,0.08)"}`, color: done ? "#10b981" : current ? accentColor : "#334155", fontSize:13, fontWeight:700, transition:"all .3s" }}>
                    {done ? <CheckCircle2 size={16}/> : <s.icon size={15}/>}
                  </div>
                  <span style={{ fontSize:10, color: current ? accentColor : done ? "#10b981" : "#334155", fontWeight:600, letterSpacing:0.3 }}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ width:60, height:1, margin:"0 8px 20px", background: step > s.id ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.06)" }}/>
                )}
              </div>
            );
          })}
        </div>

        {/* API Error */}
        {apiErr && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
            style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:"1rem", fontSize:13, color:"#ef4444" }}>
            <AlertCircle size={14} style={{ flexShrink:0 }}/> {apiErr}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.22 }}
            style={{ background:"rgba(15,23,42,0.6)", backdropFilter:"blur(20px)", border:"1px solid rgba(148,163,184,0.08)", borderRadius:16, overflow:"hidden" }}>

            <div style={{ height:2, background:`linear-gradient(90deg,transparent,${accentColor},transparent)` }}/>

            <div style={{ padding:"1.5rem" }}>

              {/* ── STEP 1 ── */}
              {step === 1 && (
                <div style={{ display:"flex", flexDirection:"column" as const, gap:14 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#64748b", letterSpacing:0.5, textTransform:"uppercase" as const }}>Account credentials</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <label style={lbl}>Email *</label>
                      <input style={inp(!!errors.email)} type="email" value={s1.email} onChange={set1("email")} placeholder="you@email.com"/>
                      {errors.email && <p style={errTxt}>{errors.email}</p>}
                    </div>
                    <div/>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <label style={lbl}>Password *</label>
                      <div style={{ position:"relative" }}>
                        <input style={{ ...inp(!!errors.password), paddingRight:44 }} type={showPw?"text":"password"} value={s1.password} onChange={set1("password")} placeholder="Min 8 characters"/>
                        <button type="button" onClick={()=>setShowPw(p=>!p)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#475569" }}>
                          {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                      </div>
                      {errors.password && <p style={errTxt}>{errors.password}</p>}
                    </div>
                    <div>
                      <label style={lbl}>Confirm Password *</label>
                      <input style={inp(!!errors.confirmPassword)} type="password" value={s1.confirmPassword} onChange={set1("confirmPassword")} placeholder="Repeat password"/>
                      {errors.confirmPassword && <p style={errTxt}>{errors.confirmPassword}</p>}
                    </div>
                  </div>

                  <div style={{ height:1, background:"rgba(255,255,255,0.05)" }}/>
                  <div style={{ fontSize:12, fontWeight:700, color:"#64748b", letterSpacing:0.5, textTransform:"uppercase" as const }}>Personal information</div>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <label style={lbl}>Full Name *</label>
                      <input style={inp(!!errors.name)} value={s1.name} onChange={set1("name")} placeholder="First Last"/>
                      {errors.name && <p style={errTxt}>{errors.name}</p>}
                    </div>
                    <div>
                      <label style={lbl}>Date of Birth *</label>
                      <input style={inp(!!errors.dob)} type="date" value={s1.dob} onChange={set1("dob")} max={new Date().toISOString().split("T")[0]}/>
                      {errors.dob && <p style={errTxt}>{errors.dob}</p>}
                    </div>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                    <div>
                      <label style={lbl}>Age *</label>
                      <input style={inp(!!errors.age)} type="number" value={s1.age} onChange={set1("age")} placeholder="e.g. 28" min={0} max={120}/>
                      {errors.age && <p style={errTxt}>{errors.age}</p>}
                    </div>
                    <div>
                      <label style={lbl}>Gender *</label>
                      <div style={{ display:"flex", gap:6 }}>
                        {["Male","Female","Other"].map(g => (
                          <button key={g} type="button" onClick={() => setS1(p=>({...p,gender:g}))}
                            style={{ flex:1, padding:"8px 4px", borderRadius:8, fontFamily:"inherit", fontSize:11, cursor:"pointer", fontWeight:s1.gender===g?700:400, background:s1.gender===g?accentBg:"rgba(255,255,255,0.03)", border:`1px solid ${s1.gender===g?accentBorder:"rgba(255,255,255,0.07)"}`, color:s1.gender===g?accentColor:"#475569", transition:"all .18s" }}>
                            {g}
                          </button>
                        ))}
                      </div>
                      {errors.gender && <p style={errTxt}>{errors.gender}</p>}
                    </div>
                    <div>
                      <label style={lbl}>Blood Group</label>
                      <div style={{ position:"relative" }}>
                        <select style={selStyle} value={s1.blood} onChange={set1("blood")}>
                          <option value="">Select</option>
                          {BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}
                        </select>
                        <ChevronDown size={12} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", opacity:0.3, pointerEvents:"none" }}/>
                      </div>
                    </div>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <label style={lbl}>Phone *</label>
                      <input style={inp(!!errors.phone)} type="tel" value={s1.phone} onChange={set1("phone")} placeholder="+91 XXXXX XXXXX"/>
                      {errors.phone && <p style={errTxt}>{errors.phone}</p>}
                    </div>
                    <div>
                      <label style={lbl}>Aadhaar Number</label>
                      <input style={inp()} value={s1.aadhaar} onChange={set1("aadhaar")} placeholder="XXXX XXXX XXXX" maxLength={14}/>
                    </div>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <label style={lbl}>Emergency Contact Name</label>
                      <input style={inp()} value={s1.emergencyName} onChange={set1("emergencyName")} placeholder="Full name"/>
                    </div>
                    <div>
                      <label style={lbl}>Emergency Contact Phone</label>
                      <input style={inp()} type="tel" value={s1.emergencyContact} onChange={set1("emergencyContact")} placeholder="+91 XXXXX XXXXX"/>
                    </div>
                  </div>

                  <div>
                    <label style={lbl}>Home Address</label>
                    <input style={inp()} value={s1.address} onChange={set1("address")} placeholder="House / Street / Colony"/>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <label style={lbl}>City</label>
                      <input style={inp()} value={s1.city} onChange={set1("city")} placeholder="e.g. Jammu"/>
                    </div>
                    <div>
                      <label style={lbl}>State</label>
                      <div style={{ position:"relative" }}>
                        <select style={selStyle} value={s1.state} onChange={set1("state")}>
                          <option value="">Select state</option>
                          {STATES_LIST.map(s=><option key={s}>{s}</option>)}
                        </select>
                        <ChevronDown size={12} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", opacity:0.3, pointerEvents:"none" }}/>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 2 ── */}
              {step === 2 && (
                <div style={{ display:"flex", flexDirection:"column" as const, gap:20 }}>

                  {/* Conditions */}
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <label style={{ ...lbl, margin:0 }}>Active Conditions</label>
                      <AddBtn onClick={() => addItem(setConditions, { name:"", since:"", status:"Active" })} color="6,182,212"/>
                    </div>
                    {conditions.map((c, i) => (
                      <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr auto", gap:8, marginBottom:8, alignItems:"center" }}>
                        <input style={inp()} value={c.name} onChange={e=>updateList(setConditions,i,"name",e.target.value)} placeholder="Condition (e.g. Diabetes)"/>
                        <input style={inp()} value={c.since} onChange={e=>updateList(setConditions,i,"since",e.target.value)} placeholder="Since (year)"/>
                        <div style={{ position:"relative" }}>
                          <select style={selStyle} value={c.status} onChange={e=>updateList(setConditions,i,"status",e.target.value)}>
                            {["Active","Managed","Resolved"].map(s=><option key={s}>{s}</option>)}
                          </select>
                          <ChevronDown size={11} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", opacity:0.3, pointerEvents:"none" }}/>
                        </div>
                        {conditions.length > 1 && (
                          <button type="button" onClick={()=>removeItem(setConditions,i)} style={{ background:"none", border:"none", cursor:"pointer", color:"#475569" }}><Trash2 size={13}/></button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Allergies */}
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <label style={{ ...lbl, margin:0 }}>Allergies</label>
                      <AddBtn onClick={() => addItem(setAllergies, { name:"", severity:"Mild", reaction:"" })} color="239,68,68"/>
                    </div>
                    {allergies.map((a, i) => (
                      <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 2fr auto", gap:8, marginBottom:8, alignItems:"center" }}>
                        <input style={inp()} value={a.name} onChange={e=>updateList(setAllergies,i,"name",e.target.value)} placeholder="Allergen (e.g. Penicillin)"/>
                        <div style={{ position:"relative" }}>
                          <select style={selStyle} value={a.severity} onChange={e=>updateList(setAllergies,i,"severity",e.target.value)}>
                            {SEVERITY_OPTS.map(s=><option key={s}>{s}</option>)}
                          </select>
                          <ChevronDown size={11} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", opacity:0.3, pointerEvents:"none" }}/>
                        </div>
                        <input style={inp()} value={a.reaction} onChange={e=>updateList(setAllergies,i,"reaction",e.target.value)} placeholder="Reaction (e.g. Rash)"/>
                        {allergies.length > 1 && (
                          <button type="button" onClick={()=>removeItem(setAllergies,i)} style={{ background:"none", border:"none", cursor:"pointer", color:"#475569" }}><Trash2 size={13}/></button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Medications */}
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <label style={{ ...lbl, margin:0 }}>Current Medications</label>
                      <AddBtn onClick={() => addItem(setMedications, { name:"", dose:"", freq:"Once daily", refillDate:"", remaining:30 })} color="139,92,246"/>
                    </div>
                    {medications.map((m, i) => (
                      <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1.5fr 1.2fr auto", gap:8, marginBottom:8, alignItems:"center" }}>
                        <input style={inp()} value={m.name} onChange={e=>updateList(setMedications,i,"name",e.target.value)} placeholder="Medicine name"/>
                        <input style={inp()} value={m.dose} onChange={e=>updateList(setMedications,i,"dose",e.target.value)} placeholder="Dose"/>
                        <div style={{ position:"relative" }}>
                          <select style={selStyle} value={m.freq} onChange={e=>updateList(setMedications,i,"freq",e.target.value)}>
                            {MED_FREQ_OPTS.map(f=><option key={f}>{f}</option>)}
                          </select>
                          <ChevronDown size={11} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", opacity:0.3, pointerEvents:"none" }}/>
                        </div>
                        <input style={inp()} type="date" value={m.refillDate} onChange={e=>updateList(setMedications,i,"refillDate",e.target.value)}/>
                        {medications.length > 1 && (
                          <button type="button" onClick={()=>removeItem(setMedications,i)} style={{ background:"none", border:"none", cursor:"pointer", color:"#475569" }}><Trash2 size={13}/></button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Immunizations */}
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <label style={{ ...lbl, margin:0 }}>Immunization Record</label>
                      <AddBtn onClick={() => addItem(setImmunizations, { name:"", date:"", status:"due" })} color="16,185,129"/>
                    </div>
                    {immunizations.map((im, i) => (
                      <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr auto", gap:8, marginBottom:8, alignItems:"center" }}>
                        <input style={inp()} value={im.name} onChange={e=>updateList(setImmunizations,i,"name",e.target.value)} placeholder="Vaccine name"/>
                        <input style={inp()} type="date" value={im.date} onChange={e=>updateList(setImmunizations,i,"date",e.target.value)}/>
                        <div style={{ position:"relative" }}>
                          <select style={selStyle} value={im.status} onChange={e=>updateList(setImmunizations,i,"status",e.target.value)}>
                            {IMMUN_STATUS.map(s=><option key={s}>{s}</option>)}
                          </select>
                          <ChevronDown size={11} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", opacity:0.3, pointerEvents:"none" }}/>
                        </div>
                        {immunizations.length > 1 && (
                          <button type="button" onClick={()=>removeItem(setImmunizations,i)} style={{ background:"none", border:"none", cursor:"pointer", color:"#475569" }}><Trash2 size={13}/></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STEP 3 ── */}
              {step === 3 && (
                <div style={{ display:"flex", flexDirection:"column" as const, gap:14 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <label style={lbl}>Insurance Provider</label>
                      <input style={inp()} value={s3.insurance} onChange={set3("insurance")} placeholder="e.g. Star Health, ECHS"/>
                    </div>
                    <div>
                      <label style={lbl}>Policy Number</label>
                      <input style={inp()} value={s3.policyNo} onChange={set3("policyNo")} placeholder="Policy / Member ID"/>
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Primary / Family Doctor</label>
                    <input style={inp()} value={s3.primaryDoctor} onChange={set3("primaryDoctor")} placeholder="Dr. Full Name"/>
                  </div>
                  <div>
                    <label style={lbl}>Preferred Hospital</label>
                    <input style={inp()} value={s3.preferredHospital} onChange={set3("preferredHospital")} placeholder="Hospital name"/>
                  </div>
                  <div style={{ background:"rgba(6,182,212,0.04)", border:"1px solid rgba(6,182,212,0.1)", borderRadius:12, padding:"1rem" }}>
                    <p style={{ fontSize:12, color:"#475569", lineHeight:1.7, margin:0 }}>
                      ℹ You can skip this step and fill in insurance details later from your dashboard.
                    </p>
                  </div>
                </div>
              )}

              {/* ── STEP 4 ── */}
              {step === 4 && (
                <div style={{ display:"flex", flexDirection:"column" as const, gap:16 }}>
                  {[
                    { label:"Do you smoke?",           key:"smoker",        opts:["No","Occasionally","Yes","Quit"] },
                    { label:"Do you drink alcohol?",   key:"alcohol",       opts:["No","Occasionally","Yes","Quit"] },
                    { label:"Physical activity level", key:"activityLevel", opts:ACTIVITY_OPTS },
                  ].map(({ label, key, opts }) => (
                    <div key={key}>
                      <label style={lbl}>{label}</label>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const }}>
                        {opts.map(o => (
                          <button key={o} type="button" onClick={()=>set4(key as keyof typeof s4, o)}
                            style={{ padding:"7px 18px", borderRadius:20, fontFamily:"inherit", fontSize:12, cursor:"pointer", fontWeight:s4[key as keyof typeof s4]===o?700:400, background:s4[key as keyof typeof s4]===o?accentBg:"rgba(255,255,255,0.03)", border:`1px solid ${s4[key as keyof typeof s4]===o?accentBorder:"rgba(255,255,255,0.07)"}`, color:s4[key as keyof typeof s4]===o?accentColor:"#475569", transition:"all .18s" }}>
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <label style={lbl}>Diet Type</label>
                      <input style={inp()} value={s4.dietType} onChange={e=>set4("dietType",e.target.value)} placeholder="e.g. Vegetarian"/>
                    </div>
                    <div>
                      <label style={lbl}>Occupation</label>
                      <input style={inp()} value={s4.occupation} onChange={e=>set4("occupation",e.target.value)} placeholder="e.g. Engineer"/>
                    </div>
                  </div>
                  <div style={{ background:"rgba(16,185,129,0.04)", border:"1px solid rgba(16,185,129,0.12)", borderRadius:12, padding:"1rem" }}>
                    <p style={{ fontSize:12, color:"#475569", lineHeight:1.7, margin:0 }}>
                      🎉 Almost done! Click <strong style={{ color:"#10b981" }}>Complete Setup</strong> to go to your dashboard.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:"1rem 1.5rem 1.5rem", display:"flex", gap:10, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
              {step > 1 && (
                <button type="button" onClick={()=>setStep(s=>s-1 as 1|2|3|4)}
                  style={{ flex:1, padding:"0.75rem", borderRadius:12, fontFamily:"inherit", fontSize:14, cursor:"pointer", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", color:"#64748b" }}>
                  ← Back
                </button>
              )}
              <motion.button type="button" whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
                onClick={next} disabled={loading}
                style={{ flex:2, padding:"0.75rem", borderRadius:12, fontFamily:"inherit", fontSize:14, fontWeight:700, background:"rgba(6,182,212,0.15)", border:"1px solid rgba(6,182,212,0.35)", color:"#06b6d4", cursor:loading?"not-allowed":"pointer", opacity:loading?0.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all .22s" }}>
                {loading
                  ? <><span style={{ width:15, height:15, border:"2px solid rgba(6,182,212,0.3)", borderTopColor:"#06b6d4", borderRadius:"50%", animation:"spin .6s linear infinite", display:"inline-block" }}/> Saving…</>
                  : step === 4 ? "Complete Setup ✓" : "Save & Continue →"
                }
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>

        <div style={{ textAlign:"center" as const, marginTop:"1.25rem", fontSize:13, color:"#334155" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color:"#06b6d4", fontWeight:600, textDecoration:"none" }}>Sign in →</Link>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box }
        input::placeholder { color: #334155 }
        input:focus, select:focus {
          border-color: rgba(6,182,212,0.35) !important;
          outline: none;
          box-shadow: 0 0 0 3px rgba(6,182,212,0.07)
        }
        select option { background: #0f172a; color: #e2e8f0 }
      `}</style>
    </div>
  );
}