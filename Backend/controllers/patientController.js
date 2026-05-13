// Backend/controllers/patientController.js  ── complete drop-in replacement
const Patient      = require("../models/patient");
const Prescription = require("../models/prescription");
const ClinicalNote = require("../models/clinicalNote");
const Appointment  = require("../models/appointment");

const getId = (req) => req.user.id;

// ── GET /api/patient/me ────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const patient = await Patient.findById(getId(req)).select("-password");
    if (!patient) return res.status(404).json({ error: "Patient not found." });
    res.json({ patient });
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({ error: "Could not fetch patient data." });
  }
};

// ── GET /api/patient/dashboard ─────────────────────────────────────────────
// Returns full patient + latest prescriptions, notes, reports, appointments
exports.getDashboard = async (req, res) => {
  try {
    const patientId = getId(req);

    const [patient, prescriptions, notes, appointments] = await Promise.all([
      Patient.findById(patientId).select("-password"),
      Prescription.find({ patientId })
        .populate("doctorId", "name specialization")
        .sort({ createdAt: -1 })
        .limit(10),
      ClinicalNote.find({ patientId })
        .populate("doctorId", "name specialization")
        .sort({ createdAt: -1 })
        .limit(10),
      Appointment.find({ $or: [{ patientId }, { patient: patientId }] })
        .populate("doctorId", "name specialization specialisation")
        .populate("doctor", "name specialization specialisation")
        .sort({ createdAt: -1, date: -1, time: -1 }),
    ]);

    if (!patient) return res.status(404).json({ error: "Patient not found." });

    // Reports are stored on the patient document (strict:false)
    const reports = (patient.reports || []).slice().reverse().slice(0, 10);

    res.json({ patient, prescriptions, notes, reports, appointments });
  } catch (err) {
    console.error("getDashboard error:", err);
    res.status(500).json({ error: "Could not fetch dashboard data." });
  }
};

// ── PUT/PATCH /api/patient/profile ─────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const allowed = [
      "name", "fullName", "age", "gender", "phone", "dob", "blood",
      "address", "city", "state", "aadhaar",
      "emergencyContact", "emergencyName",
      "conditions", "allergies", "medications", "immunizations",
      "insurance", "policyNo", "primaryDoctor", "preferredHospital",
      "smoker", "alcohol", "activityLevel", "dietType", "occupation",
      "profileComplete",
    ];

    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "fullName") updates["name"] = req.body[field];
        else updates[field] = req.body[field];
      }
    });
    updates.updatedAt = new Date();

    const patient = await Patient.findByIdAndUpdate(
      getId(req),
      { $set: updates },
      { new: true, runValidators: false }
    ).select("-password");

    if (!patient) return res.status(404).json({ error: "Patient not found." });
    res.json({ patient });
  } catch (err) {
    console.error("updateProfile error:", err);
    res.status(500).json({ error: "Could not update profile." });
  }
};

// ── GET /api/patient/prescriptions ─────────────────────────────────────────
exports.getMyPrescriptions = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientId: getId(req) })
      .populate("doctorId", "name specialization")
      .sort({ createdAt: -1 });
    res.json({ prescriptions });
  } catch (err) {
    console.error("getMyPrescriptions error:", err);
    res.status(500).json({ error: "Could not fetch prescriptions." });
  }
};

// ── GET /api/patient/notes ─────────────────────────────────────────────────
exports.getMyNotes = async (req, res) => {
  try {
    const notes = await ClinicalNote.find({ patientId: getId(req) })
      .populate("doctorId", "name specialization")
      .sort({ createdAt: -1 });
    res.json({ notes });
  } catch (err) {
    console.error("getMyNotes error:", err);
    res.status(500).json({ error: "Could not fetch notes." });
  }
};

// ── GET /api/patient/reports ───────────────────────────────────────────────
exports.getMyReports = async (req, res) => {
  try {
    const patient = await Patient.findById(getId(req)).select("reports");
    if (!patient) return res.status(404).json({ error: "Patient not found." });
    const reports = (patient.reports || []).slice().reverse();
    res.json({ reports });
  } catch (err) {
    console.error("getMyReports error:", err);
    res.status(500).json({ error: "Could not fetch reports." });
  }
};

// ── GET /api/patient/appointments ──────────────────────────────────────────
exports.getMyAppointments = async (req, res) => {
  try {
    const patientId = getId(req);
    const appointments = await Appointment.find({ $or: [{ patientId }, { patient: patientId }] })
      .populate("doctorId", "name specialization specialisation")
      .populate("doctor", "name specialization specialisation")
      .sort({ createdAt: -1, date: -1, time: -1 });
    res.json({ appointments });
  } catch (err) {
    console.error("getMyAppointments error:", err);
    res.status(500).json({ error: "Could not fetch appointments." });
  }
};
