const Anthropic   = require("@anthropic-ai/sdk");
const Appointment = require("../models/appointment");
const Patient     = require("../models/patient");
const Doctor      = require("../models/doctor");

const hasAnthropicKey = Boolean(
  process.env.ANTHROPIC_API_KEY &&
  !process.env.ANTHROPIC_API_KEY.includes("sk-anthropic-api-key")
);
const client = hasAnthropicKey
  ? new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ── System prompt (Q&A pipe-separated format) ────────────────────────────────
const buildSystemPrompt = (lang = "en-IN") => {
  const langHint = lang === "hi-IN"
    ? "The patient answered in Hindi. Understand Hindi and extract all fields. Return ALL values in English."
    : "Extract details from the patient's answers.";

  return `You are a medical intake AI. ${langHint}

The transcript has 7 answers separated by '|' in this order:
1. Patient full name
2. Age
3. Gender
4. Symptoms description
5. Symptom duration
6. Urgency level (emergency / urgent / routine)
7. Extra notes / allergies / medications

Extract and return ONLY valid JSON with these exact keys:
patientName, age, gender, symptoms (array), symptomDuration, urgency, preferredSpecialty, appointmentType, notes

Rules:
- urgency must be exactly: "emergency", "urgent", or "routine"
- preferredSpecialty: infer from symptoms (e.g. chest pain → Cardiology)
- appointmentType: "in-person" unless patient says video/online
- No explanation, no markdown, just JSON.`;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

// Remove conversational prefixes from name
const cleanName = (value = "") =>
  String(value)
    .replace(/^(my name is|i am called|i am|i'm|mera naam|naam hai mera|mera naam hai|naam hai|naam)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

// Extract just the number from "I am 22 years old", "22 saal", "age is 22", etc.
const cleanAge = (value = "") => {
  const match = String(value).match(/\b(\d{1,3})\b/);
  return match ? match[1] : String(value).trim();
};

// Extract male/female/other regardless of phrasing
const cleanGender = (value = "") => {
  const t = String(value).toLowerCase();
  if (/\b(male|man|boy|ladka|purush|m)\b/.test(t))   return "Male";
  if (/\b(female|woman|girl|ladki|mahila|f)\b/.test(t)) return "Female";
  if (/\b(other|non.?binary|prefer not)\b/.test(t))  return "Other";
  return String(value).trim();
};

// Clean symptom answer — strip leading filler phrases
const cleanSymptomText = (value = "") =>
  String(value)
    .replace(/^(i have|i am having|i am suffering from|suffering from|mujhe|mujhko|mere ko)\s+/i, "")
    .trim();

// Clean duration — strip filler
const cleanDuration = (value = "") =>
  String(value)
    .replace(/^(for|since|from|se|pichle|last)\s+/i, "")
    .replace(/^(it has been|its been|iske liye)\s+/i, "")
    .trim();

const normalizeUrgency = (value = "") => {
  const t = String(value).toLowerCase();
  if (/(emergency|can't breathe|chest pain|stroke|bleeding|severe|unconscious|behosh|seene mein dard|zyada khoon)/.test(t)) return "emergency";
  if (/(urgent|high fever|bad pain|persistent|tez bukhar|bahut dard|saans.*takleef)/.test(t)) return "urgent";
  return "routine";
};

const splitSymptoms = (value = "") =>
  String(value).split(/,| and | with | also |\n/i).map(s => s.trim()).filter(Boolean);

const normalizeSpecialty = (value = "", symptoms = []) => {
  const t = `${value} ${symptoms.join(" ")}`.toLowerCase();
  if (/cardio|heart|chest|dil|seena/.test(t))          return "Cardiology";
  if (/child|kid|pediatric|bachcha/.test(t))            return "Pediatrics";
  if (/skin|rash|derma|khujli/.test(t))                 return "Dermatology";
  if (/bone|joint|fracture|ortho|haddi/.test(t))        return "Orthopedics";
  if (/neuro|brain|nerve|dimag|migraine/.test(t))       return "Neurology";
  if (/eye|vision|aankh/.test(t))                       return "Ophthalmology";
  if (/ear|nose|throat|ent|kaan|naak|gala/.test(t))     return "ENT";
  if (/stomach|gastro|pet|ulcer|acidity/.test(t))       return "Gastroenterology";
  if (/breath|lung|pulmo|asthma|saans/.test(t))         return "Pulmonology";
  return String(value).trim() || "General Medicine";
};

// Q&A positional fallback — answers joined by '|'
const fallbackExtract = (transcript = "") => {
  const answers = transcript.split("|").map(a => a.trim());
  const rawSymptoms = cleanSymptomText(answers[3] || "");
  const symptoms = splitSymptoms(rawSymptoms);
  return {
    patientName:        cleanName(answers[0] || ""),
    age:                cleanAge(answers[1] || ""),
    gender:             cleanGender(answers[2] || ""),
    symptoms,
    symptomDuration:    cleanDuration(answers[4] || ""),
    urgency:            normalizeUrgency(answers[5] || transcript),
    preferredSpecialty: normalizeSpecialty("", symptoms),
    appointmentType:    "in-person",
    notes:              answers[6] || "",
  };
};

const cleanExtracted = (raw = {}, transcript = "") => {
  const fb  = fallbackExtract(transcript);
  const sym = Array.isArray(raw.symptoms)
    ? raw.symptoms.filter(Boolean)
    : splitSymptoms(raw.symptoms || fb.symptoms.join(", "));
  return {
    patientName:        cleanName(raw.patientName || fb.patientName),
    age:                cleanAge(String(raw.age || fb.age || "")),
    gender:             cleanGender(raw.gender || fb.gender),
    symptoms:           sym,
    symptomDuration:    raw.symptomDuration    || fb.symptomDuration,
    urgency:            normalizeUrgency(raw.urgency || fb.urgency),
    preferredSpecialty: normalizeSpecialty(raw.preferredSpecialty || fb.preferredSpecialty, sym),
    appointmentType:    raw.appointmentType === "video" ? "video" : "in-person",
    notes:              raw.notes              || fb.notes,
  };
};

const normalizeDateKey = (value) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
};

// ── GET /api/voice/doctors ────────────────────────────────────────────────────
exports.getDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ name: { $exists: true, $ne: "" } })
      .select("name specialisation hospital consultationFee")
      .sort({ name: 1 });
    res.json({ doctors });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch doctors." });
  }
};

// ── POST /api/voice/extract ───────────────────────────────────────────────────
exports.extractFromSpeech = async (req, res) => {
  const { transcript, lang = "en-IN" } = req.body;
  if (!transcript?.trim()) return res.status(400).json({ error: "No transcript provided." });

  if (!client) return res.json({ extracted: cleanExtracted({}, transcript) });

  try {
    const response = await client.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 500,
      system:     buildSystemPrompt(lang),
      messages:   [{ role: "user", content: transcript }],
    });
    const raw     = response.content[0]?.text || "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    let parsed = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = {}; }
    res.json({ extracted: cleanExtracted(parsed, transcript) });
  } catch (err) {
    console.error("extractFromSpeech:", err.message);
    res.json({ extracted: cleanExtracted({}, transcript) });
  }
};

// ── GET /api/voice/slots ──────────────────────────────────────────────────────
exports.getSlots = async (req, res) => {
  try {
    const { date, doctorId } = req.query;
    if (!date) return res.status(400).json({ error: "date query param required." });

    const booked = await Appointment.find({
      dateKey: date,
      ...(doctorId ? { $or: [{ doctorId }, { doctor: doctorId }] } : {}),
      status: { $nin: ["cancelled"] },
    }).select("time").lean();
    const bookedTimes = new Set(booked.map(a => a.time));

    // For today, mark slots whose time has already passed as unavailable
    const todayKey = new Date().toISOString().split("T")[0];
    const isToday  = date === todayKey;
    const now      = new Date();
    const nowMins  = now.getHours() * 60 + now.getMinutes();

    const slots = [];
    for (let h = 9; h < 17; h++) {
      for (const m of [0, 30]) {
        const time      = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const slotMins  = h * 60 + m;
        const isPast    = isToday && slotMins <= nowMins;
        slots.push({ time, available: !bookedTimes.has(time) && !isPast, past: isPast });
      }
    }
    res.json({ date, slots });
  } catch (err) {
    res.status(500).json({ error: "Could not load slots." });
  }
};

// ── POST /api/voice/book ──────────────────────────────────────────────────────
exports.bookAppointment = async (req, res) => {
  try {
    const {
      patientName, age, gender, symptoms, symptomDuration,
      urgency, appointmentType, notes, date, time,
      doctorId,           // ← selected by patient from doctor list
      preferredSpecialty,
    } = req.body;

    if (!date || !time)     return res.status(400).json({ error: "Date and time are required." });
    if (!doctorId)          return res.status(400).json({ error: "Please select a doctor." });

    // Reject booking if the slot is in the past
    const todayKey = new Date().toISOString().split("T")[0];
    const dateKey0 = normalizeDateKey(date);
    if (dateKey0 === todayKey) {
      const now     = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = time.split(":").map(Number);
      if (sh * 60 + sm <= nowMins) {
        return res.status(400).json({ error: "This time slot has already passed. Please choose a future slot." });
      }
    }

    const patient = await Patient.findById(req.user.id).select("name");
    if (!patient) return res.status(404).json({ error: "Patient not found." });

    const doctor = await Doctor.findById(doctorId).select("name specialisation specialization");
    if (!doctor) return res.status(404).json({ error: "Selected doctor not found." });

    const dateKey = normalizeDateKey(date);
    if (!dateKey) return res.status(400).json({ error: "Valid date is required." });

    const specialty = doctor.specialisation || doctor.specialization || preferredSpecialty || "General Medicine";

    const appointment = await Appointment.create({
      patientId:       req.user.id,
      patient:         req.user.id,
      patientName:     patientName || patient.name,
      doctorId:        doctor._id,
      doctor:          doctor._id,
      doctorName:      doctor.name || "",
      specialty,
      symptoms:        symptoms || [],
      urgency:         urgency  || "routine",
      appointmentType: appointmentType || "in-person",
      date:            new Date(`${dateKey}T00:00:00.000Z`),
      dateKey,
      time,
      notes: [
        age              ? `Age: ${age}`              : "",
        gender           ? `Gender: ${gender}`        : "",
        symptomDuration  ? `Duration: ${symptomDuration}` : "",
        notes            || "",
      ].filter(Boolean).join(". "),
      status:    urgency === "emergency" ? "confirmed" : "pending",
      bookedVia: "voice",
    });

    await Patient.findByIdAndUpdate(req.user.id, {
      $push: { notifications: {
        type: "appointment", title: "Appointment booked",
        message: `Voice booking with Dr. ${doctor.name} on ${dateKey} at ${time}.`,
        doctorId: doctor._id, createdAt: new Date(), read: false,
      }},
    });

    await Doctor.findByIdAndUpdate(doctor._id, {
      $push: { notifications: {
        type: "appointment", title: "New voice booking",
        message: `${patientName || patient.name} booked ${dateKey} at ${time}.`,
        patientId: req.user.id, createdAt: new Date(), read: false,
      }},
    });

    res.status(201).json({
      appointment: { ...appointment.toObject(), date: dateKey },
      message: `Appointment ${urgency === "emergency" ? "confirmed" : "pending"} with Dr. ${doctor.name} on ${dateKey} at ${time}.`,
    });
  } catch (err) {
    console.error("bookAppointment:", err);
    res.status(500).json({ error: "Could not create appointment." });
  }
};

exports.getMyAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user.id }).sort({ date: 1, time: 1 });
    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch appointments." });
  }
};
