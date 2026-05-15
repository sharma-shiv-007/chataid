// Backend/controllers/emergencyController.js
const Appointment = require("../models/appointment");
const Patient     = require("../models/patient");
const n8n         = require("../services/n8nService");

// ── Rule-based triage classifier (no API key needed) ─────────────────────────
function classifyLocally(chiefComplaint) {
  const text = chiefComplaint.toLowerCase();

  const rules = [
    {
      priority: "CRITICAL", score: 9,
      keywords: [
        "chest pain", "heart attack", "cardiac arrest", "not breathing",
        "unconscious", "no pulse", "stopped breathing", "stroke",
        "radiating", "left arm", "crushing pain", "seizure",
        "severe bleeding", "heavy bleeding", "unresponsive"
      ],
      severity: "chest_pain",
      specialty: "Emergency Medicine",
      note: "Immediate intervention required — prioritise resuscitation bay."
    },
    {
      priority: "HIGH", score: 7,
      keywords: [
        "difficulty breathing", "shortness of breath", "breathless",
        "high fever", "fever 104", "fever 105", "vomiting blood",
        "head injury", "broken bone", "fracture", "dislocation",
        "allergic reaction", "swelling throat", "appendix",
        "overdose", "poisoning", "deep cut", "severe headache",
        "blurred vision", "confusion", "weakness one side"
      ],
      severity: "breathing",
      specialty: "General Surgery",
      note: "Urgent assessment needed within 15 minutes. Monitor for deterioration."
    },
    {
      priority: "MEDIUM", score: 5,
      keywords: [
        "fever", "vomiting", "diarrhea", "abdominal pain", "stomach pain",
        "back pain", "kidney pain", "urinary", "infection", "sprain",
        "moderate pain", "persistent cough", "high bp", "blood pressure"
      ],
      severity: "pain",
      specialty: "General Medicine",
      note: "Assess within 30 minutes and monitor vitals regularly."
    },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(k => text.includes(k))) {
      return {
        severity:           rule.severity,
        priority:           rule.priority,
        aiSeverityScore:    rule.score,
        triageNote:         rule.note,
        suggestedSpecialty: rule.specialty,
      };
    }
  }

  // Default fallback
  return {
    severity:           "other",
    priority:           "MEDIUM",
    aiSeverityScore:    4,
    triageNote:         "Standard triage — await physician assessment.",
    suggestedSpecialty: "General Medicine",
  };
}

// ── POST /api/emergency/classify ─────────────────────────────────────────────
exports.classifySeverity = async (req, res) => {
  try {
    const { chiefComplaint } = req.body;
    if (!chiefComplaint?.trim()) {
      return res.status(400).json({ error: "Chief complaint is required." });
    }
    const classification = classifyLocally(chiefComplaint);
    res.json({ classification });
  } catch (err) {
    console.error("classifySeverity error:", err);
    res.json({
      classification: {
        severity:           "other",
        priority:           "HIGH",
        aiSeverityScore:    5,
        triageNote:         req.body.chiefComplaint || "",
        suggestedSpecialty: "General Medicine",
      },
    });
  }
};

// ── POST /api/emergency/book ──────────────────────────────────────────────────
exports.bookEmergency = async (req, res) => {
  try {
    const {
      patientName, phone, age,
      chiefComplaint,
      severity, priority, aiSeverityScore, triageNote, suggestedSpecialty,
      hospital, location,
    } = req.body;

    if (!patientName?.trim() || !phone?.trim() || !chiefComplaint?.trim()) {
      return res.status(400).json({ error: "Name, phone and chief complaint are required." });
    }

    const now     = new Date();
    const dateKey = now.toISOString().split("T")[0];
    const time    = now.toTimeString().slice(0, 5);

    // Try to link to patient account if logged in
    let patientId = null;
    if (req.user?.id) {
      const p = await Patient.findById(req.user.id);
      if (p) patientId = p._id;
    }

    const appointment = await Appointment.create({
      patient:         patientId,          // null for guests — now allowed
      patientName:     patientName.trim(),
      phone:           phone.trim(),
      age:             age || "",
      specialty:       suggestedSpecialty || "Emergency Medicine",
      symptoms:        [chiefComplaint.trim()],
      urgency:         "emergency",
      appointmentType: "in-person",
      date:            now,
      dateKey,
      time,
      notes:           triageNote || chiefComplaint,
      status:          priority === "CRITICAL" ? "confirmed" : "pending",
      bookedVia:       "emergency",
      type:            "emergency",
      priority:        priority || "HIGH",
      severity:        severity || "other",
      aiSeverityScore: aiSeverityScore || 5,
      chiefComplaint:  chiefComplaint.trim(),
      location:        location || null,
      hospitalName:    hospital?.name || "",
      hospitalAddress: hospital?.address || "",
      hospitalPhone:   hospital?.phone || "",
    });

    // Fire n8n -> Google Calendar for emergency
    n8n.notifyBooked(appointment, {
      name:  patientName,
      email: req.body.email || "",
      phone: phone,
      age:   age,
    }, {
      name:           "",
      hospital:       hospital?.name || "",
      specialisation: suggestedSpecialty || "Emergency Medicine",
    });

    res.status(201).json({
      appointment,
      token:   `EMG-${Math.floor(1000 + Math.random() * 9000)}`,
      message: priority === "CRITICAL"
        ? "CRITICAL emergency confirmed. Proceed immediately to the ER."
        : "Emergency appointment created. You will be contacted shortly.",
    });
  } catch (err) {
    console.error("bookEmergency error:", err);
    res.status(500).json({ error: "Could not create emergency appointment." });
  }
};

// ── GET /api/emergency/list ───────────────────────────────────────────────────
exports.listEmergencies = async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const emergencies = await Appointment.find({
      bookedVia: "emergency",
      createdAt: { $gte: since },
      status: { $ne: "acknowledged" },
    }).sort({ aiSeverityScore: -1, createdAt: -1 });

    res.json({ emergencies });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch emergencies." });
  }
};
