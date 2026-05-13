const Anthropic = require("@anthropic-ai/sdk");
const Appointment = require("../models/appointment");
const Patient = require("../models/patient");
const Doctor = require("../models/doctor");

const hasAnthropicKey = Boolean(
  process.env.ANTHROPIC_API_KEY &&
  !process.env.ANTHROPIC_API_KEY.includes("sk-anthropic-api-key")
);
const client = hasAnthropicKey
  ? new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_PROMPT = `You are a medical intake AI. Extract from the patient's speech:
- patientName
- age
- gender
- symptoms as an array
- symptomDuration
- urgency as emergency, urgent, or routine
- preferredSpecialty
- appointmentType as in-person or video
- notes

Return ONLY valid JSON. No prose.`;

const normalizeUrgency = (value = "") => {
  const text = String(value).toLowerCase();
  if (/(emergency|can't breathe|cannot breathe|chest pain|stroke|bleeding|severe)/.test(text)) return "emergency";
  if (/(urgent|worse|high fever|bad pain|persistent)/.test(text)) return "urgent";
  return "routine";
};

const splitSymptoms = (value = "") =>
  String(value)
    .split(/,| and | with |\n/i)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeSpecialty = (value = "", symptoms = []) => {
  const text = `${value} ${symptoms.join(" ")}`.toLowerCase();
  if (/cardio|heart|chest/.test(text)) return "Cardiology";
  if (/child|kid|pediatric/.test(text)) return "Pediatrics";
  if (/skin|rash|derma/.test(text)) return "Dermatology";
  if (/bone|joint|fracture|ortho/.test(text)) return "Orthopedics";
  if (/journal medicine|general medicine|general|routine|fever|cold|cough|headache/.test(text)) return "General Medicine";
  return String(value).trim() || "General Medicine";
};

const fallbackExtract = (transcript = "") => {
  const answers = transcript.split("|").map((item) => item.trim());
  const symptoms = splitSymptoms(answers[3] || "");

  return {
    patientName: answers[0] || "",
    age: answers[1] || "",
    gender: answers[2] || "",
    symptoms,
    symptomDuration: answers[4] || "",
    urgency: normalizeUrgency(answers[5] || transcript),
    preferredSpecialty: normalizeSpecialty(answers[6] || "", symptoms),
    appointmentType: "in-person",
    notes: answers[7] || "",
  };
};

const cleanExtracted = (raw = {}, transcript = "") => {
  const fallback = fallbackExtract(transcript);
  const symptoms = Array.isArray(raw.symptoms)
    ? raw.symptoms.filter(Boolean)
    : splitSymptoms(raw.symptoms || fallback.symptoms.join(", "));

  return {
    patientName: raw.patientName || fallback.patientName,
    age: String(raw.age || fallback.age || ""),
    gender: raw.gender || fallback.gender,
    symptoms,
    symptomDuration: raw.symptomDuration || fallback.symptomDuration,
    urgency: normalizeUrgency(raw.urgency || fallback.urgency),
    preferredSpecialty: normalizeSpecialty(raw.preferredSpecialty || fallback.preferredSpecialty, symptoms),
    appointmentType: raw.appointmentType === "video" ? "video" : "in-person",
    notes: raw.notes || fallback.notes,
  };
};

const findDoctorForSpecialty = async (specialty) => {
  const specialtyRegex = new RegExp(specialty, "i");

  const matched = await Doctor.findOne({
    name: { $exists: true, $ne: "" },
    $or: [
      { specialisation: specialtyRegex },
      { specialization: specialtyRegex },
    ],
  }).select("name specialisation specialization");
  if (matched) return matched;

  const demoDoctor = await Doctor.findOne({
    name: /Dr\.\s*Arjun\s*Mehta/i,
  }).select("name specialisation specialization");
  if (demoDoctor) return demoDoctor;

  return Doctor.findOne({
    name: { $exists: true, $ne: "" },
  }).select("name specialisation specialization");
};

const normalizeDateKey = (value) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

exports.extractFromSpeech = async (req, res) => {
  const { transcript } = req.body;

  if (!transcript?.trim()) {
    return res.status(400).json({ error: "No transcript provided." });
  }

  if (!client) {
    return res.json({ extracted: cleanExtracted({}, transcript) });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: transcript }],
    });

    const raw = response.content[0]?.text || "{}";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    let parsed = {};

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {};
    }

    res.json({ extracted: cleanExtracted(parsed, transcript) });
  } catch (err) {
    console.error("extractFromSpeech error:", err.message);
    res.json({ extracted: cleanExtracted({}, transcript) });
  }
};

exports.getSlots = async (req, res) => {
  try {
    const { date, doctorId } = req.query;
    if (!date) return res.status(400).json({ error: "date query param required." });

    const booked = await Appointment.find({
      dateKey: date,
      ...(doctorId ? { doctorId } : {}),
      status: { $nin: ["cancelled"] },
    }).select("time").lean();
    const bookedTimes = new Set(booked.map((appt) => appt.time));

    const slots = [];
    for (let h = 9; h < 17; h++) {
      for (const m of [0, 30]) {
        const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        slots.push({ time, available: !bookedTimes.has(time) });
      }
    }

    res.json({ date, slots });
  } catch (err) {
    console.error("getSlots error:", err);
    res.status(500).json({ error: "Could not load slots." });
  }
};

exports.bookAppointment = async (req, res) => {
  try {
    const {
      patientName, age, gender, symptoms, symptomDuration, urgency,
      preferredSpecialty, appointmentType, notes, date, time,
    } = req.body;

    if (!date || !time) {
      return res.status(400).json({ error: "Date and time are required." });
    }

    const patient = await Patient.findById(req.user.id).select("name");
    if (!patient) return res.status(404).json({ error: "Patient not found." });

    const specialty = preferredSpecialty || "General Medicine";
    const dateKey = normalizeDateKey(date);
    if (!dateKey) {
      return res.status(400).json({ error: "Valid date is required." });
    }

    const doctor = await findDoctorForSpecialty(specialty);
    if (!doctor?._id) {
      return res.status(409).json({ error: "No available doctor found. Please add a doctor in the backend first." });
    }

    const appointment = await Appointment.create({
      patientId: req.user.id,
      patient: req.user.id,
      patientName: patientName || patient.name,
      doctorId: doctor?._id,
      doctor: doctor?._id,
      doctorName: doctor?.name || "",
      specialty,
      symptoms: symptoms || [],
      urgency: urgency || "routine",
      appointmentType: appointmentType || "in-person",
      date: new Date(`${dateKey}T00:00:00.000Z`),
      dateKey,
      time,
      notes: [
        age ? `Age: ${age}` : "",
        gender ? `Gender: ${gender}` : "",
        symptomDuration ? `Duration: ${symptomDuration}` : "",
        notes || "",
      ].filter(Boolean).join(". "),
      status: urgency === "emergency" ? "confirmed" : "pending",
      bookedVia: "voice",
    });

    await Patient.findByIdAndUpdate(req.user.id, {
      $push: {
        notifications: {
          type: "appointment",
          title: "Appointment booked",
          message: `Voice booking created for ${dateKey} at ${time}.`,
          doctorId: doctor?._id,
          createdAt: new Date(),
          read: false,
        },
      },
    });

    if (doctor?._id) {
      await Doctor.findByIdAndUpdate(doctor._id, {
        $push: {
          notifications: {
            type: "appointment",
            title: "New voice booking",
            message: `${patientName || patient.name} booked ${dateKey} at ${time}.`,
            patientId: req.user.id,
            createdAt: new Date(),
            read: false,
          },
        },
      });
    }

    res.status(201).json({
      appointment: { ...appointment.toObject(), date: dateKey },
      message: `Appointment ${urgency === "emergency" ? "confirmed" : "pending confirmation"} for ${dateKey} at ${time}.`,
    });
  } catch (err) {
    console.error("bookAppointment error:", err);
    res.status(500).json({ error: "Could not create appointment." });
  }
};

exports.getMyAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user.id })
      .sort({ date: 1, time: 1 });
    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch appointments." });
  }
};
