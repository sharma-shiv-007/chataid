import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { useAuth } from "../auth/AuthContext";
import type { AuthUser } from "../auth/AuthContext";
import API_BASE from "../config/api";
import {
  HeartPulse,
  PhoneCall,
  Search,
  ShieldCheck,
  FileText,
  Bot,
  Mail,
  MapPin,
  ChevronDown,
  X,
  CheckCircle2,
  Building2,
  Bed,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Activity,
  Clock,
  Star,
  Mic,
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const N8N_WEBHOOK_URL = "http://localhost:5678/webhook/patient-intake";

// ─── Types ────────────────────────────────────────────────────────────────────
type HospitalType = "AIIMS" | "Government" | "Private" | "Defence" | "District";
type FilterType = "All" | HospitalType;

interface Hospital {
  id: string;
  name: string;
  city: string;
  state: string;
  type: HospitalType;
  beds: number;
  depts: string[];
  phone?: string;
  address?: string;
}

interface FormData {
  name: string;
  age: string;
  gender: string;
  aadhaar: string;
  phone: string;
  email: string;
  department: string;
  symptoms: string;
  days: string;
  uhid: string;
  referredBy: string;
  date: string;
  emergencyContact: string;
}

const EMPTY_FORM: FormData = {
  name: "", age: "", gender: "", aadhaar: "", phone: "",
  email: "", department: "", symptoms: "", days: "",
  uhid: "", referredBy: "", date: "", emergencyContact: "",
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const STATES = [
  { value: "jk",    label: "Jammu & Kashmir" },
  { value: "delhi", label: "Delhi" },
  { value: "mh",    label: "Maharashtra" },
  { value: "ka",    label: "Karnataka" },
  { value: "up",    label: "Uttar Pradesh" },
  { value: "rj",    label: "Rajasthan" },
  { value: "pb",    label: "Punjab / Chandigarh" },
  { value: "hp",    label: "Himachal Pradesh" },
  { value: "hr",    label: "Haryana" },
  { value: "tn",    label: "Tamil Nadu" },
];

const CITIES: Record<string, string[]> = {
  jk:    ["Jammu","Srinagar","Vijaypur","Kathua","Udhampur","Rajouri","Poonch","Anantnag","Baramulla","Leh","Kargil","Reasi","Kishtwar","Katra"],
  delhi: ["New Delhi","South Delhi","North Delhi","Dwarka","Rohini","Saket","Vasant Kunj"],
  mh:    ["Mumbai","Pune","Nagpur","Nashik","Thane","Navi Mumbai","Aurangabad"],
  ka:    ["Bengaluru","Mysuru","Hubballi","Mangaluru","Belagavi"],
  up:    ["Lucknow","Varanasi","Agra","Kanpur","Prayagraj","Meerut","Gorakhpur"],
  rj:    ["Jaipur","Jodhpur","Udaipur","Kota","Ajmer","Bikaner"],
  pb:    ["Chandigarh","Amritsar","Ludhiana","Jalandhar","Patiala","Mohali"],
  hp:    ["Shimla","Dharamshala","Manali","Solan","Mandi"],
  hr:    ["Gurugram","Faridabad","Hisar","Rohtak","Panipat","Ambala"],
  tn:    ["Chennai","Coimbatore","Madurai","Tiruchirappalli","Salem","Vellore"],
};

const ALL_DEPARTMENTS = [
  "General Medicine","Cardiology","Cardiac Surgery","Neurology","Neurosurgery",
  "Oncology","Radiation Oncology","Orthopaedics","Spine Surgery",
  "Gynaecology & Obstetrics","Paediatrics","Neonatology","Psychiatry",
  "Gastroenterology","Hepatology","Pulmonology","Nephrology","Urology",
  "Ophthalmology","ENT","Dermatology","Endocrinology","Haematology",
  "Rheumatology","Immunology","Emergency / Trauma","General Surgery",
  "Plastic Surgery","Transplant","ICU / Critical Care","Altitude Medicine",
  "Dental / Oral Surgery","Radiology & Imaging","Pathology & Lab",
];

const HOSPITALS: Hospital[] = [
  { id:"aiims-vijaypur",   name:"AIIMS Vijaypur",              city:"Vijaypur",    state:"jk",    type:"AIIMS",      beds:720,  phone:"01923-234701", address:"Vijaypur, Samba, J&K 184120",      depts:["Cardiology","Neurology","Oncology","Trauma","Orthopaedics","Pulmonology","General Medicine","Paediatrics"] },
  { id:"aiims-jammu",      name:"AIIMS Jammu",                 city:"Jammu",       state:"jk",    type:"AIIMS",      beds:960,  phone:"0191-2979500",  address:"Bakshinagar, Jammu, J&K 180001",   depts:["All Departments","Super-Speciality","Cardiology","Neurology","Oncology","Transplant"] },
  { id:"narayana-jammu",   name:"Narayana Hospital",           city:"Jammu",       state:"jk",    type:"Private",    beds:350,  phone:"0191-2520303",  address:"Karan Nagar, Jammu, J&K 180001",   depts:["Cardiology","Cardiac Surgery","Neurosurgery","Oncology","Nephrology","Gastroenterology"] },
  { id:"gmc-jammu",        name:"Government Medical College",  city:"Jammu",       state:"jk",    type:"Government", beds:1200, phone:"0191-2547327",  address:"Gandhi Nagar, Jammu, J&K 180004",  depts:["General Medicine","Surgery","Paediatrics","Gynaecology","Orthopaedics","Dermatology","Psychiatry"] },
  { id:"smgs-jammu",       name:"SMGS Hospital",               city:"Jammu",       state:"jk",    type:"Government", beds:850,  phone:"0191-2544439",  address:"Shalamar Road, Jammu, J&K 180001", depts:["Emergency","Trauma","General Surgery","ENT","Dermatology","Paediatrics"] },
  { id:"fortis-jammu",     name:"Fortis Escorts Hospital",     city:"Jammu",       state:"jk",    type:"Private",    beds:400,  phone:"0191-2436555",  address:"Paloura, Jammu, J&K 181121",       depts:["Cardiology","Nephrology","Neurology","Gastroenterology","Orthopaedics"] },
  { id:"army-jammu",       name:"Army Base Hospital Jammu",    city:"Jammu",       state:"jk",    type:"Defence",    beds:600,  phone:"0191-2547200",  address:"Satwari Cantonment, Jammu",        depts:["All Specialities","Trauma","ICU","Orthopaedics","General Medicine"] },
  { id:"bakshi-jammu",     name:"Bakshi Nagar Hospital",       city:"Jammu",       state:"jk",    type:"Government", beds:280,  phone:"0191-2579100",  address:"Bakshi Nagar, Jammu, J&K 180001",  depts:["General Medicine","Gynaecology","Paediatrics","Surgery"] },
  { id:"apollo-jammu",     name:"Apollo Clinic Jammu",         city:"Jammu",       state:"jk",    type:"Private",    beds:90,   phone:"0191-2460000",  address:"Gandhi Nagar, Jammu, J&K 180004",  depts:["Cardiology","General Medicine","Diagnostics","Radiology & Imaging"] },
  { id:"skims-soura",      name:"SKIMS Soura",                 city:"Srinagar",    state:"jk",    type:"Government", beds:1500, phone:"0194-2401013",  address:"Soura, Srinagar, J&K 190011",      depts:["Cardiology","Neurology","Nephrology","Gastroenterology","Oncology","Transplant"] },
  { id:"smhs-srinagar",    name:"SMHS Hospital",               city:"Srinagar",    state:"jk",    type:"Government", beds:1100, phone:"0194-2452842",  address:"Karan Nagar, Srinagar, J&K 190010",depts:["General Medicine","Surgery","Orthopaedics","ENT","Ophthalmology"] },
  { id:"bonejoint-sgr",    name:"Bone & Joint Hospital",       city:"Srinagar",    state:"jk",    type:"Government", beds:350,  phone:"0194-2501900",  address:"Barzulla, Srinagar, J&K 190005",   depts:["Orthopaedics","Spine Surgery","Rheumatology","Physiotherapy"] },
  { id:"lalded-sgr",       name:"Lal Ded Hospital",            city:"Srinagar",    state:"jk",    type:"Government", beds:500,  phone:"0194-2460003",  address:"Rainawari, Srinagar, J&K 190003",  depts:["Obstetrics","Gynaecology","Neonatology","Paediatrics"] },
  { id:"apollo-sgr",       name:"Apollo Clinic Srinagar",      city:"Srinagar",    state:"jk",    type:"Private",    beds:80,   phone:"0194-2439900",  address:"Gogji Bagh, Srinagar, J&K 190008", depts:["Cardiology","General Medicine","Diagnostics","ENT"] },
  { id:"aiims-vijaypur2",  name:"CHC Vijaypur",                city:"Vijaypur",    state:"jk",    type:"Government", beds:100,  phone:"01923-220100",  address:"Vijaypur Town, Samba, J&K",        depts:["General Medicine","Paediatrics","Maternity","Emergency"] },
  { id:"dh-kathua",        name:"District Hospital Kathua",    city:"Kathua",      state:"jk",    type:"District",   beds:200,  phone:"01922-232101",  address:"Civil Lines, Kathua, J&K 184141",  depts:["General Medicine","Surgery","Paediatrics","Maternity","Emergency"] },
  { id:"dh-udhampur",      name:"District Hospital Udhampur",  city:"Udhampur",    state:"jk",    type:"District",   beds:180,  phone:"01992-270102",  address:"Hospital Road, Udhampur, J&K",     depts:["General Medicine","Surgery","Emergency","Paediatrics"] },
  { id:"dh-rajouri",       name:"District Hospital Rajouri",   city:"Rajouri",     state:"jk",    type:"District",   beds:160,  phone:"01962-262021",  address:"Main Road, Rajouri, J&K 185131",   depts:["General Medicine","Surgery","Gynaecology","Emergency"] },
  { id:"dh-poonch",        name:"District Hospital Poonch",    city:"Poonch",      state:"jk",    type:"District",   beds:150,  phone:"01965-220022",  address:"Hospital Road, Poonch, J&K 185101",depts:["General Medicine","Surgery","Paediatrics","Emergency"] },
  { id:"snm-leh",          name:"SNM Hospital Leh",            city:"Leh",         state:"jk",    type:"Government", beds:250,  phone:"01982-252012",  address:"Fort Road, Leh, Ladakh 194101",    depts:["General Medicine","Surgery","Paediatrics","Altitude Medicine","Emergency"] },
  { id:"dh-kargil",        name:"District Hospital Kargil",    city:"Kargil",      state:"jk",    type:"District",   beds:120,  phone:"01985-232015",  address:"Main Bazaar, Kargil, Ladakh 194103",depts:["General Medicine","Surgery","Emergency","Altitude Medicine"] },
  { id:"chc-katra",        name:"CHC Katra",                   city:"Katra",       state:"jk",    type:"Government", beds:80,   phone:"01991-232200",  address:"Katra Town, Reasi, J&K 182301",    depts:["General Medicine","Paediatrics","Maternity","Emergency"] },
  { id:"dh-reasi",         name:"District Hospital Reasi",     city:"Reasi",       state:"jk",    type:"District",   beds:130,  phone:"01991-244021",  address:"Civil Lines, Reasi, J&K 182301",   depts:["General Medicine","Surgery","Emergency","Paediatrics"] },
  { id:"dh-kishtwar",      name:"District Hospital Kishtwar",  city:"Kishtwar",    state:"jk",    type:"District",   beds:120,  phone:"01995-240015",  address:"Kishtwar Town, J&K 182204",        depts:["General Medicine","Surgery","Emergency","Paediatrics"] },
  { id:"dh-anantnag",      name:"District Hospital Anantnag",  city:"Anantnag",    state:"jk",    type:"District",   beds:200,  phone:"01932-222301",  address:"Hospital Road, Anantnag, J&K",     depts:["General Medicine","Surgery","Gynaecology","Paediatrics","Emergency"] },
  { id:"dh-baramulla",     name:"District Hospital Baramulla", city:"Baramulla",   state:"jk",    type:"District",   beds:190,  phone:"01952-236021",  address:"Hospital Road, Baramulla, J&K",    depts:["General Medicine","Surgery","Paediatrics","Emergency"] },
  { id:"aiims-delhi",      name:"AIIMS New Delhi",             city:"New Delhi",   state:"delhi", type:"AIIMS",      beds:2400, phone:"011-26588500",  address:"Ansari Nagar, New Delhi 110029",   depts:["All Super-Specialities","Trauma","Oncology","Transplant","Cardiology","Neurology"] },
  { id:"safdarjung",       name:"Safdarjung Hospital",         city:"New Delhi",   state:"delhi", type:"Government", beds:1531, phone:"011-26165060",  address:"Ansari Nagar West, New Delhi 110029",depts:["Trauma","Burns","General Surgery","General Medicine","Orthopaedics"] },
  { id:"rml-delhi",        name:"RML Hospital",                city:"New Delhi",   state:"delhi", type:"Government", beds:1532, phone:"011-23365525",  address:"Park Street, New Delhi 110001",    depts:["General Medicine","Surgery","Paediatrics","Obstetrics","ENT"] },
  { id:"max-saket",        name:"Max Super Speciality Saket",  city:"South Delhi", state:"delhi", type:"Private",    beds:500,  phone:"011-26515050",  address:"Press Enclave Road, Saket, New Delhi 110017",depts:["Cardiology","Neurology","Oncology","Nephrology","Gastroenterology"] },
  { id:"fortis-vasant",    name:"Fortis Vasant Kunj",          city:"Vasant Kunj", state:"delhi", type:"Private",    beds:310,  phone:"011-42776222",  address:"Sector B, Vasant Kunj, New Delhi 110070",depts:["Cardiology","Orthopaedics","Neurology","Oncology","Urology"] },
  { id:"apollo-delhi",     name:"Apollo Hospital Delhi",        city:"Saket",       state:"delhi", type:"Private",    beds:710,  phone:"011-71791090",  address:"Sarita Vihar, New Delhi 110076",   depts:["Cardiology","Neurosciences","Orthopaedics","Oncology","Transplant"] },
  { id:"kem-mumbai",       name:"KEM Hospital",                city:"Mumbai",      state:"mh",    type:"Government", beds:1854, phone:"022-24136051",  address:"Acharya Donde Marg, Parel, Mumbai 400012",depts:["All Specialities","Trauma","Burns","Transplant","Paediatrics"] },
  { id:"tata-mumbai",      name:"Tata Memorial Centre",        city:"Mumbai",      state:"mh",    type:"Government", beds:629,  phone:"022-24177000",  address:"Dr E Borges Road, Parel, Mumbai 400012",depts:["Oncology","Radiation Oncology","Haematology","Bone Marrow Transplant"] },
  { id:"kokilaben-mumbai", name:"Kokilaben Ambani Hospital",   city:"Mumbai",      state:"mh",    type:"Private",    beds:750,  phone:"022-30999999",  address:"Rao Saheb, Andheri West, Mumbai 400053",depts:["Cardiology","Neurology","Nephrology","Orthopaedics","Oncology"] },
  { id:"ruby-pune",        name:"Ruby Hall Clinic",            city:"Pune",        state:"mh",    type:"Private",    beds:450,  phone:"020-66455000",  address:"Sassoon Road, Pune 411001",        depts:["Cardiology","Neurology","Orthopaedics","Oncology","Gastroenterology"] },
  { id:"sassoon-pune",     name:"Sassoon General Hospital",    city:"Pune",        state:"mh",    type:"Government", beds:1400, phone:"020-26128000",  address:"Jai Prakash Narayan Road, Pune 411001",depts:["General Medicine","Surgery","Trauma","Paediatrics","Gynaecology"] },
  { id:"nimhans",          name:"NIMHANS",                     city:"Bengaluru",   state:"ka",    type:"Government", beds:800,  phone:"080-46110007",  address:"Hosur Road, Bengaluru 560029",     depts:["Psychiatry","Neurology","Neurosurgery","Sleep Medicine","Psychology"] },
  { id:"victoria-blr",     name:"Victoria Hospital",           city:"Bengaluru",   state:"ka",    type:"Government", beds:1200, phone:"080-26703600",  address:"Fort Road, Bengaluru 560002",      depts:["Trauma","General Surgery","Orthopaedics","General Medicine","Dermatology"] },
  { id:"manipal-blr",      name:"Manipal Hospital",            city:"Bengaluru",   state:"ka",    type:"Private",    beds:600,  phone:"080-25023400",  address:"Old Airport Road, Bengaluru 560017",depts:["Multi-Speciality","Transplant","Cardiology","Neurology","Oncology"] },
  { id:"kgmu-lko",         name:"KGMU Lucknow",                city:"Lucknow",     state:"up",    type:"Government", beds:3000, phone:"0522-2257540",  address:"Shah Mina Road, Lucknow 226003",   depts:["All Specialities","Trauma","Transplant","Oncology","Neurology"] },
  { id:"medanta-lko",      name:"Medanta Lucknow",             city:"Lucknow",     state:"up",    type:"Private",    beds:450,  phone:"0522-4500000",  address:"Amar Shaheed Path, Lucknow 226030",depts:["Cardiology","Neurology","Gastroenterology","Nephrology","Orthopaedics"] },
  { id:"bhu-varanasi",     name:"BHU Sir Sunderlal Hospital",  city:"Varanasi",    state:"up",    type:"Government", beds:1200, phone:"0542-2367568",  address:"BHU Campus, Varanasi 221005",      depts:["General Medicine","Surgery","Oncology","Neurology","Paediatrics"] },
  { id:"sms-jaipur",       name:"SMS Hospital",                city:"Jaipur",      state:"rj",    type:"Government", beds:3000, phone:"0141-2518352",  address:"JLN Marg, Jaipur 302004",          depts:["All Specialities","Trauma","Burns","Transplant","Oncology"] },
  { id:"fortis-jaipur",    name:"Fortis Jaipur",               city:"Jaipur",      state:"rj",    type:"Private",    beds:360,  phone:"0141-2547000",  address:"Jawahar Lal Nehru Marg, Jaipur 302017",depts:["Cardiology","Neurology","Oncology","Gastroenterology","Orthopaedics"] },
  { id:"pgi-chd",          name:"PGI Chandigarh",              city:"Chandigarh",  state:"pb",    type:"Government", beds:2600, phone:"0172-2755555",  address:"Sector 12, Chandigarh 160012",     depts:["All Super-Specialities","Transplant","Oncology","Neurology","Cardiology"] },
  { id:"gmch32-chd",       name:"GMCH-32 Chandigarh",          city:"Chandigarh",  state:"pb",    type:"Government", beds:500,  phone:"0172-2665253",  address:"Sector 32, Chandigarh 160030",     depts:["General Medicine","Surgery","Paediatrics","Orthopaedics","ENT"] },
  { id:"fortis-mohali",    name:"Fortis Hospital Mohali",      city:"Mohali",      state:"pb",    type:"Private",    beds:340,  phone:"0172-4692222",  address:"Sector 62, Phase 8, Mohali 160062",depts:["Cardiology","Oncology","Neurology","Orthopaedics","Transplant"] },
  { id:"igmc-shimla",      name:"IGMC Shimla",                 city:"Shimla",      state:"hp",    type:"Government", beds:700,  phone:"0177-2804251",  address:"Ridge, Shimla, HP 171001",         depts:["General Medicine","Surgery","Oncology","Paediatrics","Orthopaedics"] },
  { id:"zonal-dharamshala",name:"Zonal Hospital Dharamshala",  city:"Dharamshala", state:"hp",    type:"Government", beds:200,  phone:"01892-224451",  address:"Kotwali Bazaar, Dharamshala, HP 176215",depts:["General Medicine","Surgery","Paediatrics","Emergency"] },
  { id:"medanta-gurgaon",  name:"Medanta The Medicity",        city:"Gurugram",    state:"hr",    type:"Private",    beds:1250, phone:"0124-4141414",  address:"Sector 38, Gurugram, Haryana 122001",depts:["Cardiology","Neurology","Oncology","Transplant","Gastroenterology"] },
  { id:"civil-rohtak",     name:"PGIMS Rohtak",                city:"Rohtak",      state:"hr",    type:"Government", beds:3000, phone:"01262-211307",  address:"Medical Road, Rohtak, Haryana 124001",depts:["All Specialities","Trauma","Oncology","Neurology","Paediatrics"] },
  { id:"cmc-vellore",      name:"CMC Hospital Vellore",        city:"Vellore",     state:"tn",    type:"Private",    beds:2600, phone:"0416-2281000",  address:"Ida Scudder Road, Vellore, TN 632004",depts:["All Super-Specialities","Transplant","Oncology","Cardiology","Neurology"] },
  { id:"gh-chennai",       name:"Govt General Hospital Chennai",city:"Chennai",    state:"tn",    type:"Government", beds:2600, phone:"044-25305000",  address:"Park Town, Chennai, TN 600003",    depts:["All Specialities","Trauma","Burns","Transplant","Oncology"] },
  { id:"apollo-chennai",   name:"Apollo Hospital Chennai",      city:"Chennai",     state:"tn",    type:"Private",    beds:560,  phone:"044-28290200",  address:"Greams Road, Chennai, TN 600006",  depts:["Cardiology","Neurology","Oncology","Transplant","Orthopaedics"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function typeConfig(type: HospitalType) {
  const map: Record<HospitalType, { bg: string; text: string; border: string; accent: string; dot: string }> = {
    AIIMS:      { bg:"rgba(6,182,212,0.08)",   text:"#06b6d4", border:"rgba(6,182,212,0.25)",   accent:"#06b6d4", dot:"#06b6d4" },
    Government: { bg:"rgba(16,185,129,0.08)",  text:"#10b981", border:"rgba(16,185,129,0.25)",  accent:"#10b981", dot:"#10b981" },
    Private:    { bg:"rgba(139,92,246,0.08)",  text:"#8b5cf6", border:"rgba(139,92,246,0.25)",  accent:"#8b5cf6", dot:"#8b5cf6" },
    Defence:    { bg:"rgba(245,158,11,0.08)",  text:"#f59e0b", border:"rgba(245,158,11,0.25)",  accent:"#f59e0b", dot:"#f59e0b" },
    District:   { bg:"rgba(249,115,22,0.08)",  text:"#f97316", border:"rgba(249,115,22,0.25)",  accent:"#f97316", dot:"#f97316" },
  };
  return map[type];
}

function genBookingId() {
  return "APT-" + Date.now().toString(36).toUpperCase().slice(-6);
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function fmtDate(iso: string) {
  if (!iso) return "Next available slot";
  return new Date(iso).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const glassCard: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.6)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(148, 163, 184, 0.08)",
  borderRadius: 20,
};

// ─── Hospital Card ────────────────────────────────────────────────────────────
const HospitalCard = ({ h, onBook }: { h: Hospital; onBook: (h: Hospital) => void }) => {
  const col = typeConfig(h.type);
  const shownDepts = h.depts.slice(0, 3);
  const extra = h.depts.length - 3;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => onBook(h)}
      style={{
        ...glassCard, padding: "1.5rem", display: "flex", flexDirection: "column",
        gap: 0, cursor: "pointer", position: "relative", overflow: "hidden",
        borderColor: hovered ? col.border : "rgba(148, 163, 184, 0.08)", transition: "border-color 0.22s",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: hovered ? `linear-gradient(90deg, transparent, ${col.accent}, transparent)` : "transparent",
        transition: "background 0.3s",
      }} />
      <div style={{
        position: "absolute", top: 16, right: 16, width: 8, height: 8,
        borderRadius: "50%", background: col.dot, opacity: 0.6, boxShadow: `0 0 8px ${col.dot}`,
      }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600,
          letterSpacing: 0.4, background: col.bg, color: col.text, border: `1px solid ${col.border}`,
        }}>{h.type}</span>
        <span style={{
          fontSize: 11, padding: "3px 10px", borderRadius: 20,
          background: "rgba(255,255,255,0.04)", color: "#64748b",
          border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 4,
        }}><Bed size={10} /> {h.beds.toLocaleString()} beds</span>
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.3, lineHeight: 1.35, marginBottom: 8 }}>{h.name}</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#475569", marginBottom: 14 }}>
        <MapPin size={11} style={{ flexShrink: 0, color: col.accent, opacity: 0.7 }} />
        {h.city}{h.state === "jk" ? ", J&K" : ""}
        {h.address && <span style={{ color: "#334155" }}> · {h.address.split(",").slice(-1)[0].trim()}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {shownDepts.map(d => (
          <span key={d} style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 12,
            background: "rgba(248,250,252,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.05)",
          }}>{d}</span>
        ))}
        {extra > 0 && (
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>+{extra}</span>
        )}
      </div>
      {h.phone && (
        <div style={{ fontSize: 11, color: "#475569", marginBottom: 16, display: "flex", alignItems: "center", gap: 5 }}>
          <PhoneCall size={10} style={{ color: col.accent, opacity: 0.7 }} /> {h.phone}
        </div>
      )}
      <motion.button
        onClick={(e) => { e.stopPropagation(); onBook(h); }}
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        style={{
          width: "100%", padding: "0.7rem",
          background: hovered ? `linear-gradient(135deg, ${col.accent}22, ${col.accent}11)` : "rgba(255,255,255,0.03)",
          border: `1px solid ${hovered ? col.border : "rgba(255,255,255,0.08)"}`,
          borderRadius: 12, color: hovered ? col.text : "#94a3b8",
          fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
          letterSpacing: 0.2, marginTop: "auto",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.22s",
        }}
      >Book Appointment <ArrowRight size={13} /></motion.button>
    </motion.div>
  );
};

// ─── Registration Modal ───────────────────────────────────────────────────────
const RegistrationModal = ({ hospital: h, onClose }: { hospital: Hospital; onClose: () => void }) => {
  const [form, setForm]       = useState<FormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<{ id: string; date: string } | null>(null);
  const [errors, setErrors]   = useState<Partial<FormData>>({});
  const [step, setStep]       = useState<1 | 2>(1);
  const col = typeConfig(h.type);

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const deptOptions = useMemo(() => {
    const hasAll = h.depts.some(d => d.toLowerCase().includes("all"));
    return hasAll ? ALL_DEPARTMENTS : h.depts;
  }, [h]);

  const validateStep1 = () => {
    const e: Partial<FormData> = {};
    if (!form.name.trim())  e.name   = "Required";
    if (!form.phone.trim()) e.phone  = "Required";
    if (!form.age.trim())   e.age    = "Required";
    if (!form.gender)       e.gender = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Partial<FormData> = {};
    if (!form.department) e.department = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validateStep1()) setStep(2); };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    setLoading(true);
    const bookingId = genBookingId();
    const payload = {
      action: "book", bookingId, bookedAt: new Date().toISOString(),
      source: "patient-intake-web", hospital: h.name, hospitalType: h.type,
      hospitalCity: h.city, hospitalState: h.state, hospitalAddress: h.address ?? "",
      hospitalPhone: h.phone ?? "", hospitalBeds: h.beds,
      fullName: form.name, age: form.age, gender: form.gender, aadhaar: form.aadhaar,
      contact: form.phone, email: form.email, emergencyContact: form.emergencyContact,
      department: form.department, symptoms: form.symptoms, symptomDays: form.days,
      uhid: form.uhid, referral: form.referredBy, preferredDate: form.date,
    };
    const saveToSession = (id: string, doctor = "") => {
      const newBooking = {
        bookingId: id, hospital: h.name, department: form.department, doctor,
        preferredDate: form.date, bookedAt: new Date().toISOString(), status: "confirmed",
      };
      const existing = JSON.parse(sessionStorage.getItem("patient_bookings") ?? "[]");
      sessionStorage.setItem("patient_bookings", JSON.stringify([newBooking, ...existing]));
    };
    try {
      // Step 1: Save to your backend (MongoDB)
      const token = localStorage.getItem("medicare_token") ||
                    localStorage.getItem("authToken") || "";

      const backendPayload = {
        patientName:     form.name,
        phone:           form.phone,
        age:             form.age,
        chiefComplaint:  form.symptoms || form.department,
        symptoms:        form.symptoms ? [form.symptoms] : [],
        specialty:       form.department,
        appointmentType: "in-person",
        date:            form.date || new Date().toISOString(),
        time:            "09:00",
        notes:           form.symptoms,
        bookedVia:       "manual",
        urgency:         "routine",
        hospitalName:    h.name,
        hospitalAddress: h.address || "",
        hospitalPhone:   h.phone || "",
        skipN8n:         true,
      };

      let finalId = bookingId;
      let savedAppointment: any = null;

      try {
        const backendRes = await fetch(`${API_BASE}/appointments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(backendPayload),
        });

        if (backendRes.ok) {
          const backendData = await backendRes.json();
          savedAppointment = backendData.appointment;
          finalId = savedAppointment?._id || bookingId;
          console.log("Saved to MongoDB:", finalId);
        } else {
          console.warn("Backend save failed - continuing with n8n only");
        }
      } catch (backendErr) {
        console.warn("Backend unreachable - continuing with n8n only", backendErr);
      }

      // Step 2: Fire n8n -> Google Calendar
      try {
        const n8nPayload = {
          ...payload,
          bookingId: finalId,
        };
        await fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(n8nPayload),
        });
        console.log("n8n webhook fired");
      } catch (n8nErr) {
        console.warn("n8n webhook failed - booking still saved", n8nErr);
      }

      saveToSession(finalId, "");
      setBooking({ id: finalId, date: form.date });
    } catch (err) {
      console.warn("n8n webhook unreachable — using local fallback.", err);
      saveToSession(bookingId);
      setBooking({ id: bookingId, date: form.date });
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(148, 163, 184, 0.1)",
    borderRadius: 12, padding: "0.7rem 1rem", color: "#f1f5f9",
    fontFamily: "inherit", fontSize: 14, outline: "none", transition: "border-color 0.2s",
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, color: "#64748b", fontWeight: 600,
    letterSpacing: 0.6, textTransform: "uppercase" as const, display: "block", marginBottom: 6,
  };
  const errStyle: React.CSSProperties = { fontSize: 11, color: "#f87171", marginTop: 4 };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
        style={{
          position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.85)",
          zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center",
          padding: "2rem 1rem", overflowY: "auto", backdropFilter: "blur(12px)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: "rgba(10, 15, 30, 0.95)", border: "1px solid rgba(148, 163, 184, 0.1)",
            backdropFilter: "blur(24px)", borderRadius: 24, width: "100%", maxWidth: 600,
            overflow: "hidden", position: "relative",
          }}
        >
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, transparent 0%, ${col.accent} 40%, ${col.accent} 60%, transparent 100%)`,
          }} />
          <div style={{
            padding: "1.5rem 1.5rem 1.25rem", borderBottom: "1px solid rgba(148, 163, 184, 0.06)",
            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem",
          }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.4, marginBottom: 6, color: "#f1f5f9" }}>{h.name}</div>
              <div style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={11} style={{ color: col.accent }} /> {h.city}
                </span>
                <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>{h.type}</span>
                {h.phone && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><PhoneCall size={11} /> {h.phone}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#64748b",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s",
            }}><X size={15} /></button>
          </div>
          {!booking && (
            <div style={{ padding: "1rem 1.5rem 0", display: "flex", alignItems: "center", gap: 10 }}>
              {[1, 2].map((s) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700,
                    background: step >= s ? `linear-gradient(135deg, ${col.accent}33, ${col.accent}22)` : "rgba(255,255,255,0.04)",
                    color: step >= s ? col.text : "#334155",
                    border: `1px solid ${step >= s ? col.border : "rgba(255,255,255,0.06)"}`,
                  }}>{s}</div>
                  <span style={{ fontSize: 12, color: step >= s ? "#94a3b8" : "#334155" }}>
                    {s === 1 ? "Patient details" : "Medical details"}
                  </span>
                  {s < 2 && <div style={{ width: 32, height: 1, background: "rgba(255,255,255,0.06)", margin: "0 2px" }} />}
                </div>
              ))}
            </div>
          )}
          {booking ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1.75rem" }}>
              <motion.div
                initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                style={{
                  width: 72, height: 72, background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 1.5rem", boxShadow: "0 0 40px rgba(16, 185, 129, 0.15)",
                }}
              ><CheckCircle2 size={32} color="#10b981" /></motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: 20, padding: "5px 16px", fontSize: 12, color: "#10b981", marginBottom: 14,
                }}><Sparkles size={12} /> Booking Confirmed</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#f1f5f9", letterSpacing: -0.4 }}>Registration Successful!</div>
                <div style={{ fontSize: 14, color: "#64748b", marginBottom: "1.75rem", lineHeight: 1.7 }}>
                  Your appointment has been received. Confirmation will be sent via email.
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                style={{ textAlign: "left", background: "rgba(15, 23, 42, 0.8)", borderRadius: 16, padding: "1.25rem", border: "1px solid rgba(148, 163, 184, 0.08)" }}
              >
                {[
                  ["Booking ID", booking.id], ["Hospital", h.name], ["Department", form.department],
                  ["Patient", form.name], ["Age / Gender", `${form.age} yrs / ${form.gender}`],
                  ["Contact", form.phone], ["Appointment Date", fmtDate(booking.date)],
                ].map(([label, val]) => (
                  <div key={label} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                    fontSize: 13, gap: 12,
                  }}>
                    <span style={{ color: "#475569", flexShrink: 0 }}>{label}</span>
                    <span style={{ fontWeight: 600, textAlign: "right", color: "#94a3b8" }}>{val}</span>
                  </div>
                ))}
              </motion.div>
              <div style={{ fontSize: 12, color: "#334155", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <AlertCircle size={11} /> Save your Booking ID for reference
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClose}
                style={{
                  marginTop: "1.5rem", width: "100%", padding: "0.8rem",
                  background: `linear-gradient(135deg, ${col.accent}22, ${col.accent}11)`,
                  border: `1px solid ${col.border}`, borderRadius: 12, color: col.text,
                  fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}>Done</motion.button>
            </div>
          ) : step === 1 ? (
            <div style={{ padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>Full Name *</label>
                  <input style={{ ...inp, borderColor: errors.name ? "rgba(248,113,113,0.4)" : undefined }} value={form.name} onChange={set("name")} placeholder="Your full name" />
                  {errors.name && <p style={errStyle}>{errors.name}</p>}
                </div>
                <div>
                  <label style={lbl}>Age *</label>
                  <input style={{ ...inp, borderColor: errors.age ? "rgba(248,113,113,0.4)" : undefined }} value={form.age} onChange={set("age")} placeholder="e.g. 34" type="number" min={0} max={120} />
                  {errors.age && <p style={errStyle}>{errors.age}</p>}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Gender *</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["Male", "Female", "Other"].map(g => (
                    <button key={g} onClick={() => setForm(f => ({ ...f, gender: g }))} style={{
                      flex: 1, padding: "0.65rem", borderRadius: 12, fontFamily: "inherit", fontSize: 13, cursor: "pointer",
                      background: form.gender === g ? col.bg : "rgba(255,255,255,0.03)",
                      border: `1px solid ${form.gender === g ? col.border : "rgba(255,255,255,0.08)"}`,
                      color: form.gender === g ? col.text : "#475569",
                      fontWeight: form.gender === g ? 600 : 400, transition: "all 0.18s",
                    }}>{g}</button>
                  ))}
                </div>
                {errors.gender && <p style={errStyle}>{errors.gender}</p>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>Contact Number *</label>
                  <input style={{ ...inp, borderColor: errors.phone ? "rgba(248,113,113,0.4)" : undefined }} value={form.phone} onChange={set("phone")} placeholder="+91 XXXXX XXXXX" type="tel" />
                  {errors.phone && <p style={errStyle}>{errors.phone}</p>}
                </div>
                <div>
                  <label style={lbl}>Emergency Contact</label>
                  <input style={inp} value={form.emergencyContact} onChange={set("emergencyContact")} placeholder="+91 XXXXX XXXXX" type="tel" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={lbl}>Aadhaar Number</label>
                  <input style={inp} value={form.aadhaar} onChange={set("aadhaar")} placeholder="XXXX XXXX XXXX" maxLength={14} />
                </div>
                <div>
                  <label style={lbl}>Email Address</label>
                  <input style={inp} value={form.email} onChange={set("email")} placeholder="you@email.com" type="email" />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: "1.25rem 1.5rem" }}>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Preferred Department *</label>
                <div style={{ position: "relative" }}>
                  <select style={{ ...inp, appearance: "none" as const, cursor: "pointer", paddingRight: "2.5rem", borderColor: errors.department ? "rgba(248,113,113,0.4)" : undefined }} value={form.department} onChange={set("department")}>
                    <option value="">Select department</option>
                    {deptOptions.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.3, pointerEvents: "none" }} />
                </div>
                {errors.department && <p style={errStyle}>{errors.department}</p>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>Symptoms / Complaint</label>
                  <input style={inp} value={form.symptoms} onChange={set("symptoms")} placeholder="Brief description" />
                </div>
                <div>
                  <label style={lbl}>Since how many days?</label>
                  <input style={inp} value={form.days} onChange={set("days")} placeholder="e.g. 5" type="number" min={0} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>Previous UHID / OPD No.</label>
                  <input style={inp} value={form.uhid} onChange={set("uhid")} placeholder="If applicable" />
                </div>
                <div>
                  <label style={lbl}>Referred By</label>
                  <input style={inp} value={form.referredBy} onChange={set("referredBy")} placeholder="Doctor / Hospital name" />
                </div>
              </div>
              <div>
                <label style={lbl}>Preferred Appointment Date</label>
                <input style={inp} value={form.date} onChange={set("date")} type="date" min={todayStr()} />
              </div>
            </div>
          )}
          {!booking && (
            <div style={{ padding: "1rem 1.5rem 1.5rem", display: "flex", gap: 10 }}>
              {step === 2 && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setStep(1)}
                  style={{ flex: 1, padding: "0.75rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#64748b", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>← Back</motion.button>
              )}
              {step === 1 && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClose}
                  style={{ flex: 1, padding: "0.75rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#64748b", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>Cancel</motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: `0 8px 32px ${col.accent}30` }}
                whileTap={{ scale: 0.98 }}
                onClick={step === 1 ? handleNext : handleSubmit}
                disabled={loading}
                style={{
                  flex: 2, padding: "0.75rem",
                  background: `linear-gradient(135deg, ${col.accent}33 0%, ${col.accent}18 100%)`,
                  border: `1px solid ${col.border}`, borderRadius: 12, color: col.text,
                  fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.22s",
                }}
              >
                {loading ? (
                  <><span style={{ width: 16, height: 16, border: `2px solid ${col.accent}33`, borderTopColor: col.accent, borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />Submitting...</>
                ) : step === 1 ? "Next →" : "Confirm Booking"}
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Specialisations ──────────────────────────────────────────────────────────
const SPECIALISATIONS = [
  "General Medicine","Cardiology","Neurology","Oncology","Orthopaedics",
  "Paediatrics","Gynaecology & Obstetrics","Psychiatry","Gastroenterology",
  "Pulmonology","Nephrology","Urology","Ophthalmology","ENT","Dermatology",
  "Endocrinology","Haematology","Emergency / Trauma","General Surgery",
  "Plastic Surgery","Radiology & Imaging","Anaesthesiology","ICU / Critical Care",
];

// ─── Login Modal ──────────────────────────────────────────────────────────────
const LoginModal = ({ onClose, onLogin }: {
  onClose: () => void;
  onLogin: (user: { name: string; email: string; role: string; token: string }) => void;
}) => {
  const [role, setRole]         = useState<"patient" | "doctor">("patient");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const accentColor  = role === "patient" ? "#06b6d4" : "#8b5cf6";
  const accentBorder = role === "patient" ? "rgba(6,182,212,0.3)" : "rgba(139,92,246,0.3)";
  const accentBg     = role === "patient" ? "rgba(6,182,212,0.1)" : "rgba(139,92,246,0.1)";

  const inp: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", background: "rgba(15,23,42,0.8)",
    border: "1px solid rgba(148,163,184,0.1)", borderRadius: 10, padding: "0.65rem 1rem",
    color: "#f1f5f9", fontFamily: "inherit", fontSize: 13, outline: "none",
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, color: "#64748b", fontWeight: 600,
    letterSpacing: 0.5, textTransform: "uppercase" as const, display: "block", marginBottom: 5,
  };

  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill all fields"); return; }
    setLoading(true); setError("");
    try {
      // ── THE FIX: role is sent to backend, backend returns it back correctly ──
      console.log("Sending role:", role);
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login failed"); return; }
      // WITH THIS:
localStorage.setItem("medicare_token", data.token);
localStorage.setItem("medicare_user", JSON.stringify(data.user));
onLogin({ name: data.user.name, email: data.user.email, role: data.user.role, token: data.token });
onClose();
    } catch {
      setError("Cannot connect to server. Is your backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={e => e.target === e.currentTarget && onClose()}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
          zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "2rem 1rem", backdropFilter: "blur(12px)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: "rgba(10,15,30,0.97)", border: "1px solid rgba(148,163,184,0.1)",
            backdropFilter: "blur(24px)", borderRadius: 24, width: "100%", maxWidth: 420,
            overflow: "hidden", position: "relative",
          }}
        >
          <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${accentColor},transparent)` }} />
          <div style={{
            padding: "1.4rem 1.5rem 1.1rem", borderBottom: "1px solid rgba(148,163,184,0.07)",
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, color: "#f1f5f9", letterSpacing: -0.4 }}>Welcome back</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Sign in to your MediCare AI account</div>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#64748b",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><X size={14} /></button>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "1rem 1.5rem 0" }}>
            {(["patient", "doctor"] as const).map(m => (
              <button key={m} onClick={() => setRole(m)} style={{
                flex: 1, padding: "9px", borderRadius: 10,
                background: role === m ? accentBg : "rgba(255,255,255,0.03)",
                border: `1px solid ${role === m ? accentBorder : "rgba(255,255,255,0.07)"}`,
                color: role === m ? accentColor : "#475569",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .18s",
              }}>{m === "patient" ? "🧑‍⚕️ Patient" : "👨‍⚕️ Doctor"}</button>
            ))}
          </div>
          <div style={{ padding: "1.1rem 1.5rem" }}>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Email Address</label>
              <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={lbl}>Password</label>
              <div style={{ position: "relative" }}>
                <input style={{ ...inp, paddingRight: 52 }} type={showPw ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Your password" onKeyDown={e => e.key === "Enter" && handleLogin()} />
                <button onClick={() => setShowPw(p => !p)} style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, fontFamily: "inherit",
                }}>{showPw ? "hide" : "show"}</button>
              </div>
            </div>
            {error && <p style={{ fontSize: 12, color: "#f87171", marginBottom: 8 }}>⚠️ {error}</p>}
          </div>
          <div style={{ padding: "0.5rem 1.5rem 1.4rem", display: "flex", gap: 8 }}>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClose}
              style={{ flex: 1, padding: "0.75rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#64748b", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>Cancel</motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleLogin} disabled={loading}
              style={{
                flex: 2, padding: "0.75rem", background: accentBg, border: `1px solid ${accentBorder}`,
                borderRadius: 12, color: accentColor, fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              {loading ? (<><span style={{ width: 14, height: 14, border: `2px solid ${accentColor}33`, borderTopColor: accentColor, borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />Signing in...</>) : "Sign In →"}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Signup Modal ─────────────────────────────────────────────────────────────
const SignupModal = ({ onClose }: { onClose: () => void }) => {
  const [mode, setMode]     = useState<"patient" | "doctor">("patient");
  const [gender, setGender] = useState("Male");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [showCPw, setShowCPw] = useState(false);
  const [form, setForm] = useState({
    name:"", age:"", phone:"", email:"", allergies:"", password:"", confirmPassword:"",
    specialisation:"", experience:"", regNo:"", hospital:"", bio:"",
  });
  const [errors, setErrors] = useState<Record<string,string>>({});

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const accentColor  = mode === "patient" ? "#06b6d4" : "#8b5cf6";
  const accentBorder = mode === "patient" ? "rgba(6,182,212,0.3)" : "rgba(139,92,246,0.3)";
  const accentBg     = mode === "patient" ? "rgba(6,182,212,0.1)" : "rgba(139,92,246,0.1)";

  const validate = () => {
    const e: Record<string,string> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.phone.trim()) e.phone = "Required";
    if (!form.email.trim()) e.email = "Required";
    if (!form.password) e.password = "Required";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    if (mode === "patient" && !form.age) e.age = "Required";
    if (mode === "doctor"  && !form.specialisation) e.specialisation = "Required";
    if (mode === "doctor"  && !form.regNo.trim()) e.regNo = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const endpoint = `${API_BASE}/auth/signup/patient`;
      const body = { fullName: form.name, age: Number(form.age), gender, phone: form.phone, email: form.email, allergies: form.allergies, password: form.password };
      const res  = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setErrors({ email: data.error || "Signup failed. Please try again." }); return; }
      setSuccess(true);
    } catch {
      setErrors({ email: "Cannot connect to server. Is your backend running?" });
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width:"100%", boxSizing:"border-box", background:"rgba(15,23,42,0.8)",
    border:"1px solid rgba(148,163,184,0.1)", borderRadius:10, padding:"0.65rem 1rem",
    color:"#f1f5f9", fontFamily:"inherit", fontSize:13, outline:"none", transition:"border-color 0.2s",
  };
  const lbl: React.CSSProperties = {
    fontSize:11, color:"#64748b", fontWeight:600,
    letterSpacing:0.5, textTransform:"uppercase" as const, display:"block", marginBottom:5,
  };
  const err: React.CSSProperties = { fontSize:11, color:"#f87171", marginTop:3 };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={e => e.target === e.currentTarget && onClose()}
        style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.85)",
          zIndex:300, display:"flex", alignItems:"flex-start", justifyContent:"center",
          padding:"2rem 1rem", overflowY:"auto", backdropFilter:"blur(12px)",
        }}
      >
        <motion.div
          initial={{ opacity:0, y:40, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:24 }}
          transition={{ duration:0.28, ease:[0.16,1,0.3,1] }}
          style={{
            background:"rgba(10,15,30,0.97)", border:"1px solid rgba(148,163,184,0.1)",
            backdropFilter:"blur(24px)", borderRadius:24, width:"100%", maxWidth:560, overflow:"hidden", position:"relative",
          }}
        >
          <div style={{ height:2, background:`linear-gradient(90deg,transparent,${accentColor},transparent)`, transition:"background 0.3s" }}/>
          <div style={{ padding:"1.4rem 1.5rem 1.1rem", borderBottom:"1px solid rgba(148,163,184,0.07)", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:19, fontWeight:700, color:"#f1f5f9", letterSpacing:-0.4 }}>Create your account</div>
              <div style={{ fontSize:12, color:"#475569", marginTop:4 }}>Join MediCare AI — free for patients &amp; providers</div>
            </div>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", cursor:"pointer", color:"#64748b", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={14}/></button>
          </div>
          <div style={{ display:"flex", gap:8, padding:"1rem 1.5rem 0" }}>
            {(["patient"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex:1, padding:"9px", borderRadius:10,
                background: mode===m ? accentBg : "rgba(255,255,255,0.03)",
                border:`1px solid ${mode===m ? accentBorder : "rgba(255,255,255,0.07)"}`,
                color: mode===m ? accentColor : "#475569",
                fontFamily:"inherit", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all .18s",
              }}>{m==="patient" ? "🧑‍⚕️ I'm a Patient" : "👨‍⚕️ I'm a Doctor"}</button>
            ))}
          </div>
          <div style={{ padding:"1.1rem 1.5rem" }}>
            {mode === "patient" ? (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={lbl}>Full Name *</label>
                    <input style={{ ...inp, borderColor:errors.name?"rgba(248,113,113,0.4)":undefined }} value={form.name} onChange={set("name")} placeholder="Your full name"/>
                    {errors.name && <p style={err}>{errors.name}</p>}
                  </div>
                  <div>
                    <label style={lbl}>Age *</label>
                    <input style={{ ...inp, borderColor:errors.age?"rgba(248,113,113,0.4)":undefined }} type="number" value={form.age} onChange={set("age")} placeholder="e.g. 28" min={0} max={120}/>
                    {errors.age && <p style={err}>{errors.age}</p>}
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={lbl}>Gender *</label>
                  <div style={{ display:"flex", gap:7 }}>
                    {["Male","Female","Other"].map(g => (
                      <button key={g} onClick={() => setGender(g)} style={{
                        flex:1, padding:"8px", borderRadius:10,
                        background: gender===g ? accentBg : "rgba(255,255,255,0.03)",
                        border:`1px solid ${gender===g ? accentBorder : "rgba(255,255,255,0.07)"}`,
                        color: gender===g ? accentColor : "#475569",
                        fontFamily:"inherit", fontSize:12, fontWeight: gender===g ? 600 : 400, cursor:"pointer", transition:"all .18s",
                      }}>{g}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={lbl}>Phone Number *</label>
                    <input style={{ ...inp, borderColor:errors.phone?"rgba(248,113,113,0.4)":undefined }} type="tel" value={form.phone} onChange={set("phone")} placeholder="+91 XXXXX XXXXX"/>
                    {errors.phone && <p style={err}>{errors.phone}</p>}
                  </div>
                  <div>
                    <label style={lbl}>Email Address *</label>
                    <input style={{ ...inp, borderColor:errors.email?"rgba(248,113,113,0.4)":undefined }} type="email" value={form.email} onChange={set("email")} placeholder="you@email.com"/>
                    {errors.email && <p style={err}>{errors.email}</p>}
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={lbl}>Known Allergies</label>
                  <textarea style={{ ...inp, height:60, resize:"none" }} value={form.allergies} onChange={set("allergies")} placeholder="e.g. Penicillin, pollen… (leave blank if none)"/>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div>
                    <label style={lbl}>Password *</label>
                    <div style={{ position:"relative" }}>
                      <input style={{ ...inp, paddingRight:52, borderColor:errors.password?"rgba(248,113,113,0.4)":undefined }} type={showPw?"text":"password"} value={form.password} onChange={set("password")} placeholder="Min 8 characters"/>
                      <button onClick={() => setShowPw(p=>!p)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>{showPw?"hide":"show"}</button>
                    </div>
                    {errors.password && <p style={err}>{errors.password}</p>}
                  </div>
                  <div>
                    <label style={lbl}>Confirm Password *</label>
                    <div style={{ position:"relative" }}>
                      <input style={{ ...inp, paddingRight:52, borderColor:errors.confirmPassword?"rgba(248,113,113,0.4)":undefined }} type={showCPw?"text":"password"} value={form.confirmPassword} onChange={set("confirmPassword")} placeholder="Repeat password"/>
                      <button onClick={() => setShowCPw(p=>!p)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>{showCPw?"hide":"show"}</button>
                    </div>
                    {errors.confirmPassword && <p style={err}>{errors.confirmPassword}</p>}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={lbl}>Full Name *</label>
                    <input style={{ ...inp, borderColor:errors.name?"rgba(248,113,113,0.4)":undefined }} value={form.name} onChange={set("name")} placeholder="Dr. First Last"/>
                    {errors.name && <p style={err}>{errors.name}</p>}
                  </div>
                  <div>
                    <label style={lbl}>Phone Number *</label>
                    <input style={{ ...inp, borderColor:errors.phone?"rgba(248,113,113,0.4)":undefined }} type="tel" value={form.phone} onChange={set("phone")} placeholder="+91 XXXXX XXXXX"/>
                    {errors.phone && <p style={err}>{errors.phone}</p>}
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={lbl}>Email Address *</label>
                  <input style={{ ...inp, borderColor:errors.email?"rgba(248,113,113,0.4)":undefined }} type="email" value={form.email} onChange={set("email")} placeholder="doctor@hospital.com"/>
                  {errors.email && <p style={err}>{errors.email}</p>}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={lbl}>Specialisation *</label>
                    <div style={{ position:"relative" }}>
                      <select style={{ ...inp, appearance:"none" as const, paddingRight:32, borderColor:errors.specialisation?"rgba(248,113,113,0.4)":undefined }} value={form.specialisation} onChange={set("specialisation")}>
                        <option value="">Select</option>
                        {SPECIALISATIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                      <ChevronDown size={12} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", opacity:0.3, pointerEvents:"none" }}/>
                    </div>
                    {errors.specialisation && <p style={err}>{errors.specialisation}</p>}
                  </div>
                  <div>
                    <label style={lbl}>Years of Experience</label>
                    <input style={inp} type="number" value={form.experience} onChange={set("experience")} placeholder="e.g. 8" min={0} max={60}/>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={lbl}>Medical Reg. No. *</label>
                    <input style={{ ...inp, borderColor:errors.regNo?"rgba(248,113,113,0.4)":undefined }} value={form.regNo} onChange={set("regNo")} placeholder="MCI / State council no."/>
                    {errors.regNo && <p style={err}>{errors.regNo}</p>}
                  </div>
                  <div>
                    <label style={lbl}>Affiliated Hospital</label>
                    <input style={inp} value={form.hospital} onChange={set("hospital")} placeholder="Current hospital name"/>
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={lbl}>Brief Bio / About</label>
                  <textarea style={{ ...inp, height:60, resize:"none" }} value={form.bio} onChange={set("bio")} placeholder="Short description of your expertise…"/>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div>
                    <label style={lbl}>Password *</label>
                    <div style={{ position:"relative" }}>
                      <input style={{ ...inp, paddingRight:52, borderColor:errors.password?"rgba(248,113,113,0.4)":undefined }} type={showPw?"text":"password"} value={form.password} onChange={set("password")} placeholder="Min 8 characters"/>
                      <button onClick={() => setShowPw(p=>!p)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>{showPw?"hide":"show"}</button>
                    </div>
                    {errors.password && <p style={err}>{errors.password}</p>}
                  </div>
                  <div>
                    <label style={lbl}>Confirm Password *</label>
                    <div style={{ position:"relative" }}>
                      <input style={{ ...inp, paddingRight:52, borderColor:errors.confirmPassword?"rgba(248,113,113,0.4)":undefined }} type={showCPw?"text":"password"} value={form.confirmPassword} onChange={set("confirmPassword")} placeholder="Repeat password"/>
                      <button onClick={() => setShowCPw(p=>!p)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>{showCPw?"hide":"show"}</button>
                    </div>
                    {errors.confirmPassword && <p style={err}>{errors.confirmPassword}</p>}
                  </div>
                </div>
              </>
            )}
          </div>
          {success ? (
            <div style={{ textAlign:"center", padding:"2rem 1.5rem 2rem" }}>
              <div style={{ width:64, height:64, borderRadius:"50%", background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.25)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1.25rem" }}>
                <CheckCircle2 size={28} color="#10b981" />
              </div>
              <div style={{ fontSize:18, fontWeight:700, color:"#f1f5f9", marginBottom:8 }}>Account Created!</div>
              <div style={{ fontSize:13, color:"#64748b", marginBottom:"1.5rem" }}>Welcome, {form.name}. You can now log in.</div>
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }} onClick={onClose}
                style={{ width:"100%", padding:"0.75rem", background: accentBg, border:`1px solid ${accentBorder}`, borderRadius:12, color:accentColor, fontFamily:"inherit", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                Go to Login →
              </motion.button>
            </div>
          ) : (
            <div style={{ padding:"1rem 1.5rem 1.4rem", display:"flex", gap:8 }}>
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }} onClick={onClose}
                style={{ flex:1, padding:"0.75rem", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, color:"#64748b", fontFamily:"inherit", fontSize:14, cursor:"pointer" }}>Cancel</motion.button>
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }} onClick={handleSubmit} disabled={loading}
                style={{ flex:2, padding:"0.75rem", background: accentBg, border:`1px solid ${accentBorder}`, borderRadius:12, color:accentColor, fontFamily:"inherit", fontSize:14, fontWeight:700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {loading ? (<><span style={{ width:14, height:14, border:`2px solid ${accentColor}33`, borderTopColor: accentColor, borderRadius:"50%", animation:"spin 0.6s linear infinite", display:"inline-block" }}/>Creating...</>) : `Create ${mode==="patient"?"Patient":"Doctor"} Account →`}
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const SelectHospital = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const homeRef     = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);
  const hospitalRef = useRef<HTMLDivElement>(null);
  const contactRef  = useRef<HTMLDivElement>(null);

  const [showLogin,  setShowLogin]  = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    name: string; email: string; role: string; token: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("medicare_user");
      const token = localStorage.getItem("medicare_token");
      if (!saved || !token) return null;
      const parsed = JSON.parse(saved);
      if (!parsed?.name) return null;
      return { ...parsed, token };
    } catch { return null; }
  });

  const handleLogout = () => {
    localStorage.removeItem("medicare_token");
    localStorage.removeItem("medicare_user");
    sessionStorage.clear();
    setCurrentUser(null);
  };

  const [selectedState, setSelectedState] = useState("");
  const [selectedCity,  setSelectedCity]  = useState("");
  const [filterType,    setFilterType]    = useState<FilterType>("All");
  const [search,        setSearch]        = useState("");
  const [activeHosp,   setActiveHosp]    = useState<Hospital | null>(null);
  const [showSignup,   setShowSignup]     = useState(false);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => ref.current?.scrollIntoView({ behavior: "smooth" });
  const cities = selectedState ? (CITIES[selectedState] ?? []) : [];

  const filteredHospitals = useMemo(() => {
    if (!selectedState) return [];
    let list = HOSPITALS.filter(h => h.state === selectedState);
    if (selectedCity)         list = list.filter(h => h.city === selectedCity);
    if (filterType !== "All") list = list.filter(h => h.type === filterType);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(h =>
        h.name.toLowerCase().includes(s) ||
        h.city.toLowerCase().includes(s) ||
        h.depts.some(d => d.toLowerCase().includes(s))
      );
    }
    return list;
  }, [selectedState, selectedCity, filterType, search]);

  const selBase: React.CSSProperties = {
    width: "100%", appearance: "none" as const,
    background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(12px)",
    border: "1px solid rgba(148, 163, 184, 0.1)", borderRadius: 14,
    padding: "0.8rem 2.5rem 0.8rem 1rem", color: "#e2e8f0",
    fontFamily: "inherit", fontSize: 14, cursor: "pointer", outline: "none", transition: "border-color 0.2s",
  };

  const FILTERS: FilterType[] = ["All", "AIIMS", "Government", "Private", "Defence", "District"];
  const filterColors: Record<string, { active: string; border: string }> = {
    All:        { active: "#94a3b8", border: "rgba(148,163,184,0.3)" },
    AIIMS:      { active: "#06b6d4", border: "rgba(6,182,212,0.3)" },
    Government: { active: "#10b981", border: "rgba(16,185,129,0.3)" },
    Private:    { active: "#8b5cf6", border: "rgba(139,92,246,0.3)" },
    Defence:    { active: "#f59e0b", border: "rgba(245,158,11,0.3)" },
    District:   { active: "#f97316", border: "rgba(249,115,22,0.3)" },
  };

  // ── THE KEY FIX: use role directly from backend response, not detectRole() ──
  const handleLoginSuccess = (user: { name: string; email: string; role: string; token: string }) => {
    const role = user.role as "patient" | "doctor" | "admin"; // ← from backend, always correct
    const authUser: AuthUser = {
      name: user.name,
      email: user.email,
      role,
    };
    login(user.token, authUser);
    setCurrentUser(user);
    setShowLogin(false);
    if (role === "doctor") navigate("/doctor-dashboard");
    else if (role === "admin") navigate("/admin-dashboard");
    else navigate("/dashboard");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#020817", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 80% 50% at 20% 20%, rgba(6,182,212,0.06) 0%, transparent 60%),radial-gradient(ellipse 60% 40% at 80% 80%, rgba(139,92,246,0.05) 0%, transparent 60%)`,
      }} />
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.015,
        backgroundImage: `linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      {/* ── NAVBAR ── */}
      <nav style={{
        position: "fixed", width: "100%", zIndex: 50,
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        background: "rgba(2, 8, 23, 0.8)", borderBottom: "1px solid rgba(148, 163, 184, 0.06)",
        padding: "0.9rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <motion.div whileHover={{ scale: 1.02 }}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => scrollTo(homeRef)}
        >
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HeartPulse color="#06b6d4" size={20} />
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.5, color: "#f1f5f9" }}>
            MediCare <span style={{ color: "#06b6d4" }}>AI</span>
          </span>
        </motion.div>

        <div style={{ display: "flex", alignItems: "center", gap: 32, fontSize: 13, fontWeight: 500, color: "#64748b" }}>
          {([["Home", homeRef], ["Services", servicesRef], ["Hospitals", hospitalRef], ["Contact", contactRef]] as const).map(([label, ref]) => (
            <motion.button key={label} whileHover={{ color: "#e2e8f0" }}
              onClick={() => scrollTo(ref as React.RefObject<HTMLDivElement>)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontFamily: "inherit", fontSize: 13, transition: "color 0.2s" }}
            >{label}</motion.button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {currentUser ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 10, padding: "0.4rem 0.9rem" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: currentUser.role === "patient" ? "rgba(6,182,212,0.15)" : "rgba(139,92,246,0.15)",
                  border: `1px solid ${currentUser.role === "patient" ? "rgba(6,182,212,0.3)" : "rgba(139,92,246,0.3)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  color: currentUser.role === "patient" ? "#06b6d4" : "#8b5cf6",
                }}>{currentUser.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{currentUser.name.split(" ")[0]}</div>
                  <div style={{ fontSize: 10, color: "#475569", textTransform: "capitalize" }}>{currentUser.role}</div>
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleLogout}
                style={{ border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", padding: "0.5rem 1.1rem", borderRadius: 10, background: "rgba(239,68,68,0.06)", fontFamily: "inherit", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Logout
              </motion.button>
            </>
          ) : (
            <>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowSignup(true)}
                style={{ border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", padding: "0.5rem 1.25rem", borderRadius: 10, background: "rgba(6,182,212,0.06)", fontFamily: "inherit", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Sign Up
              </motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowLogin(true)}
                style={{ border: "1px solid rgba(148,163,184,0.2)", color: "#94a3b8", padding: "0.5rem 1.25rem", borderRadius: 10, background: "rgba(255,255,255,0.03)", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>
                Login
              </motion.button>
            </>
          )}
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigate("/voice")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.12))", padding: "0.5rem 1.25rem", borderRadius: 10, border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4", fontFamily: "inherit", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            <Mic size={13} /> Voice Booking
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigate("/emergency")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #ef4444, #dc2626)", padding: "0.5rem 1.25rem", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", color: "white", fontFamily: "inherit", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            <PhoneCall size={13} /> Emergency
          </motion.button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section ref={homeRef} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "7rem 1.5rem 5rem", position: "relative" }}>
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} style={{ position: "relative", zIndex: 1, maxWidth: 700 }}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.5 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 20, padding: "6px 16px", fontSize: 12, color: "#06b6d4", fontWeight: 600, letterSpacing: 0.5, marginBottom: "1.75rem" }}>
            <Activity size={12} /> AI-Powered Healthcare Platform <Sparkles size={12} />
          </motion.div>
          <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 4rem)", fontWeight: 800, lineHeight: 1.12, letterSpacing: -2, marginBottom: "1.5rem", color: "#f8fafc" }}>
            AI Powered{" "}
            <span style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Hospital Intake</span>{" "}System
          </h1>
          <p style={{ fontSize: 17, color: "#64748b", maxWidth: 520, margin: "0 auto 2.5rem", lineHeight: 1.75 }}>
            Smart location-based hospital discovery with conversational registration — find the right hospital near you and book instantly.
          </p>
          <div style={{ display: "flex", gap: 32, justifyContent: "center", marginBottom: "2.5rem", flexWrap: "wrap" }}>
            {[["50+", "Hospitals"], ["10+", "States"], ["AI", "Powered"]].map(([num, label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#06b6d4", letterSpacing: -1 }}>{num}</div>
                <div style={{ fontSize: 11, color: "#475569", fontWeight: 500, letterSpacing: 0.5 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <motion.button whileHover={{ scale: 1.04, boxShadow: "0 0 40px rgba(6,182,212,0.25)" }} whileTap={{ scale: 0.97 }} onClick={() => scrollTo(hospitalRef)}
              style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)", padding: "0.9rem 2.25rem", borderRadius: 14, border: "none", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: -0.2, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 24px rgba(6,182,212,0.2)", transition: "all 0.22s" }}>
              Find Your Hospital <ArrowRight size={16} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => scrollTo(servicesRef)}
              style={{ background: "rgba(255,255,255,0.04)", padding: "0.9rem 2rem", borderRadius: 14, border: "1px solid rgba(148,163,184,0.1)", color: "#94a3b8", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.22s" }}>
              Learn More
            </motion.button>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)" }}>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, transparent, rgba(6,182,212,0.4))" }} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#06b6d4", opacity: 0.6 }} />
          </motion.div>
        </motion.div>
      </section>

      {/* ── SERVICES ── */}
      <section ref={servicesRef} style={{ padding: "6rem 1.5rem", borderTop: "1px solid rgba(148, 163, 184, 0.06)", position: "relative" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ textAlign: "center", marginBottom: "4rem" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 20, padding: "5px 14px", fontSize: 11, color: "#8b5cf6", fontWeight: 600, letterSpacing: 0.5, marginBottom: 16 }}><Star size={11} /> What We Offer</div>
            <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 800, letterSpacing: -1, color: "#f1f5f9" }}>Our Smart Services</h2>
          </motion.div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[
              { Icon: Bot,         title: "AI Chat Booking",       desc: "Describe your need — our AI finds the right hospital and department for you.", color: "#06b6d4" },
              { Icon: FileText,    title: "Auto Form Generation",  desc: "Hospital-specific intake forms generated and delivered to your email instantly.", color: "#8b5cf6" },
              { Icon: ShieldCheck, title: "Secure Data Handling",  desc: "Your medical data is encrypted end-to-end and never shared without consent.", color: "#10b981" },
              { Icon: MapPin,      title: "Location-Based Search", desc: "Find hospitals by state and city with real-time availability and bed counts.", color: "#f59e0b" },
            ].map(({ Icon, title, desc, color }, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -6 }} style={{ ...glassCard, padding: "1.75rem", textAlign: "center", transition: "all 0.22s", cursor: "default" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${color}12`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}><Icon size={22} color={color} /></div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: "#f1f5f9", letterSpacing: -0.3 }}>{title}</h3>
                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.75, margin: 0 }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOSPITAL FINDER ── */}
      <section ref={hospitalRef} style={{ padding: "6rem 1.5rem 8rem", position: "relative" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 20, padding: "5px 14px", fontSize: 11, color: "#06b6d4", fontWeight: 600, letterSpacing: 0.5, marginBottom: 16 }}><MapPin size={11} /> Hospital Finder</div>
            <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 800, letterSpacing: -1, marginBottom: "0.75rem", color: "#f1f5f9" }}>
              Find a Hospital{" "}<span style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Near You</span>
            </h2>
            <p style={{ fontSize: 15, color: "#475569", maxWidth: 460, margin: "0 auto", lineHeight: 1.7 }}>Select your state and city to discover nearby hospitals and book an appointment in minutes.</p>
          </motion.div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, maxWidth: 860, margin: "0 auto 1.5rem" }}>
            {[
              { id: "state", node: (
                <select style={{ ...selBase, color: selectedState ? "#e2e8f0" : "#475569" }} value={selectedState}
                  onChange={e => { setSelectedState(e.target.value); setSelectedCity(""); setFilterType("All"); setSearch(""); }}>
                  <option value="">Select State / UT</option>
                  {STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              )},
              { id: "city", node: (
                <select style={{ ...selBase, color: selectedCity ? "#e2e8f0" : "#475569", opacity: !selectedState ? 0.4 : 1 }}
                  value={selectedCity} disabled={!selectedState}
                  onChange={e => { setSelectedCity(e.target.value); setFilterType("All"); }}>
                  <option value="">Select City / District</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )},
            ].map(({ id, node }) => (
              <div key={id} style={{ position: "relative" }}>
                {node}
                <ChevronDown size={13} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.3, pointerEvents: "none" }} />
              </div>
            ))}
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} style={{ position: "absolute", left: 14, color: "#475569", pointerEvents: "none" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hospital or dept…"
                style={{ ...selBase, paddingLeft: "2.5rem", opacity: !selectedState ? 0.4 : 1 }} disabled={!selectedState} />
            </div>
          </div>
          {selectedState && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: "2.5rem" }}>
              {FILTERS.map(ft => {
                const fc = filterColors[ft];
                return (
                  <motion.button key={ft} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setFilterType(ft)}
                    style={{ padding: "6px 18px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, letterSpacing: 0.3, background: filterType === ft ? `${fc.active}14` : "rgba(15,23,42,0.7)", border: `1px solid ${filterType === ft ? fc.border : "rgba(255,255,255,0.07)"}`, color: filterType === ft ? fc.active : "#475569", backdropFilter: "blur(8px)", transition: "all 0.18s" }}>
                    {ft}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
          {selectedState && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center", fontSize: 13, color: "#334155", marginBottom: "1.75rem" }}>
              <span style={{ color: "#06b6d4", fontWeight: 700 }}>{filteredHospitals.length}</span>{" "}
              hospital{filteredHospitals.length !== 1 ? "s" : ""} found
              {selectedCity ? ` in ${selectedCity}` : ` in ${STATES.find(s => s.value === selectedState)?.label}`}
            </motion.p>
          )}
          {filteredHospitals.length > 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
              {filteredHospitals.map((h, i) => (
                <motion.div key={h.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.4 }}>
                  <HospitalCard h={h} onBook={setActiveHosp} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div style={{ textAlign: "center", padding: "5rem 1rem", color: "#1e293b" }}>
              <Building2 size={56} style={{ margin: "0 auto 1.25rem", opacity: 0.15, display: "block" }} />
              <p style={{ fontSize: 15, color: "#334155" }}>
                {!selectedState ? "Select your state to discover hospitals" : !selectedCity ? "Select a city to see available hospitals" : "No hospitals match the selected filters"}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section ref={contactRef} style={{ padding: "6rem 1.5rem", borderTop: "1px solid rgba(148, 163, 184, 0.06)", textAlign: "center", position: "relative" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 800, marginBottom: "1rem", letterSpacing: -1, color: "#f1f5f9" }}>Contact Us</h2>
            <p style={{ fontSize: 15, color: "#475569", marginBottom: "2.5rem", lineHeight: 1.7 }}>Have questions? Our team is here to help you navigate your healthcare journey.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: "2rem" }}>
              {([
                [Mail, "support@medicareai.com", "#06b6d4"],
                [PhoneCall, "+91 98765 43210", "#10b981"],
                [MapPin, "Jammu & Kashmir, India", "#8b5cf6"],
              ] as const).map(([Icon, text, color], i) => (
                <motion.div key={i} whileHover={{ y: -3 }}
                  style={{ ...glassCard, padding: "1.25rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transition: "all 0.22s" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}12`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={16} color={color} /></div>
                  <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.4 }}>{text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "rgba(2, 8, 23, 0.9)", color: "#1e293b", padding: "1.5rem 2rem", textAlign: "center", fontSize: 12, borderTop: "1px solid rgba(148, 163, 184, 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><HeartPulse size={14} color="#334155" /><span>© 2026 MediCare AI</span></div>
        <span>Intelligent Hospital Automation Platform</span>
        <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <span style={{ cursor: "pointer" }}>Privacy</span>
          <span style={{ cursor: "pointer" }}>Terms</span>
          <span style={{ cursor: "pointer" }}>Support</span>
        </div>
      </footer>

      {/* ── MODALS ── */}
      {activeHosp && <RegistrationModal hospital={activeHosp} onClose={() => setActiveHosp(null)} />}
      {showSignup  && <SignupModal onClose={() => setShowSignup(false)} />}
      {showLogin   && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={handleLoginSuccess}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: #0f172a; color: #e2e8f0; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.4); cursor: pointer; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(15,23,42,0.5); }
        ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.15); border-radius: 3px; }
        input::placeholder, textarea::placeholder { color: #334155; }
        input:focus, select:focus { border-color: rgba(6,182,212,0.3) !important; outline: none; box-shadow: 0 0 0 3px rgba(6,182,212,0.06); }
      `}</style>
    </div>
  );
};

export default SelectHospital;
