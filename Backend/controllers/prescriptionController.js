// backend/controllers/prescriptionController.js
const Prescription    = require("../models/prescription");
const Doctor          = require("../models/doctor");
const LabOrder        = require("../models/labOrder");
const catchAsync      = require("../utils/catchAsync");
const { createNotif } = require("../services/notificationService");

// POST /api/prescriptions
exports.create = catchAsync(async (req, res) => {
  const {
    patientId,
    appointmentId,
    medications,
    diagnosis,
    advice,
    followUpDate,
    followUpRemark,
    needsLabTest,
    labPriority = "Normal",
    labNotes = "",
  } = req.body;
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
  const labTests = Array.isArray(req.body.labTests)
    ? req.body.labTests.map((test) => String(test || "").trim()).filter(Boolean)
    : [];
  const shouldCreateLabOrder = Boolean(needsLabTest) || labTests.length > 0;

  if (shouldCreateLabOrder && !labTests.length) {
    return res.status(400).json({ error: "Select at least one lab test." });
  }
  if (!["Normal", "Urgent"].includes(labPriority)) {
    return res.status(400).json({ error: "labPriority must be Normal or Urgent." });
  }

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
    needsLabTest:  shouldCreateLabOrder,
    labTests,
    labPriority,
    labNotes:      String(labNotes || "").trim(),
  });

  let labOrder = null;
  if (shouldCreateLabOrder) {
    const doctor = await Doctor.findById(req.user.id).select("name specialisation specialization");
    labOrder = await LabOrder.create({
      patientId,
      doctorId: req.user.id,
      tests: labTests,
      department: doctor?.specialisation || doctor?.specialization || "General",
      priority: labPriority,
      notes: String(labNotes || followUpRemark || advice || "").trim(),
    });
    prescription.labOrderId = labOrder._id;
    await prescription.save();
    labOrder = await LabOrder.findById(labOrder._id)
      .populate("patientId", "name email phone age gender")
      .populate("doctorId", "name email specialisation specialization");
  }

  await createNotif(
    patientId, "Patient", "prescription_issued",
    "Your doctor has issued a new prescription.",
    `/prescriptions/${prescription._id}`
  );

  res.status(201).json({ prescription, labOrder });
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
