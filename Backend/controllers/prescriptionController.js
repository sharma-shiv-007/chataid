// backend/controllers/prescriptionController.js
const Prescription    = require("../models/prescription");
const catchAsync      = require("../utils/catchAsync");
const { createNotif } = require("../services/notificationService");

// POST /api/prescriptions
exports.create = catchAsync(async (req, res) => {
  const { patientId, appointmentId, medications, diagnosis, advice, followUpDate, followUpRemark } = req.body;
  const cleanMedications = Array.isArray(medications)
    ? medications
        .map((m) => ({
          name: String(m.name || "").trim(),
          dose: String(m.dose || "").trim(),
          frequency: String(m.frequency || m.freq || "").trim(),
          duration: String(m.duration || "").trim(),
          instructions: String(m.instructions || "").trim(),
        }))
        .filter((m) => m.name)
    : [];
  const firstMedication = cleanMedications[0] || {};

  const prescription = await Prescription.create({
    patientId,
    doctorId:      req.user.id,
    appointmentId: appointmentId || null,
    medications:   cleanMedications,
    drugName:      firstMedication.name || "",
    dose:          firstMedication.dose || "",
    frequency:     firstMedication.frequency || "",
    duration:      firstMedication.duration || "",
    instructions:  firstMedication.instructions || "",
    diagnosis:     diagnosis || "",
    advice:        advice || "",
    followUpRemark: followUpRemark || "",
    followUpDate:  followUpDate || null,
  });

  await createNotif(
    patientId, "Patient", "prescription_issued",
    "Your doctor has issued a new prescription.",
    `/prescriptions/${prescription._id}`
  );

  res.status(201).json({ prescription });
});

// GET /api/prescriptions/patient/:id
exports.getForPatient = catchAsync(async (req, res) => {
  const prescriptions = await Prescription.find({ patientId: req.params.id })
    .populate("doctorId", "name specialisation")
    .sort({ issuedAt: -1 });
  res.json({ prescriptions });
});

// GET /api/prescriptions/my  — patient's own
exports.getMine = catchAsync(async (req, res) => {
  const prescriptions = await Prescription.find({ patientId: req.user.id })
    .populate("doctorId", "name specialisation hospital")
    .sort({ issuedAt: -1 });
  res.json({ prescriptions });
});
