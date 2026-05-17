// Backend/controllers/doctorController.js  ── complete drop-in replacement
const path         = require("path");
const Patient      = require("../models/patient");
const Doctor       = require("../models/doctor");
const Nurse        = require("../models/nurse");
const Appointment  = require("../models/appointment");
const Prescription = require("../models/prescription");
const ClinicalNote = require("../models/clinicalNote");
const LabOrder     = require("../models/labOrder");
const n8n          = require("../services/n8nService");
const { createNotif } = require("../services/notificationService");
const { generatePrescriptionPdf } = require("../services/prescriptionPdfService");
const { sendPrescriptionEmail }   = require("../services/emailService");

// ── Helper ─────────────────────────────────────────────────────────────────
const todayRange = () => {
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const e = new Date(); e.setHours(23, 59, 59, 999);
  return { $gte: s, $lte: e };
};

const todayKey = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().split("T")[0];
};

const todayAppointmentFilter = (doctorId) => ({
  $and: [
    {
      $or: [
        { doctorId },
        { doctor: doctorId },
      ],
    },
    {
      $or: [
        { dateKey: todayKey() },
        { date: todayRange() },
      ],
    },
  ],
});

const prescriptionSignature = ({ medications = [], followUpRemark = "" }) =>
  JSON.stringify({
    medications: medications.map((m) => ({
      name: String(m.name || "").trim().toLowerCase(),
      dose: String(m.dose || "").trim().toLowerCase(),
      frequency: String(m.frequency || "").trim().toLowerCase(),
      duration: String(m.duration || "").trim().toLowerCase(),
      instructions: String(m.instructions || "").trim().toLowerCase(),
    })),
    followUpRemark: String(followUpRemark || "").trim().toLowerCase(),
  });

const doctorAppointmentFilter = (doctorId) => ({
  $or: [
    { doctorId },
    { doctor: doctorId },
  ],
});

const normalizePhone = (phone = "") => String(phone).replace(/\D/g, "");

async function attachAppointmentNames(appts) {
  const phones = [...new Set(appts.map(a => normalizePhone(a.phone)).filter(Boolean))];
  const phonePatients = phones.length
    ? await Patient.find({ phone: { $in: phones } }).select("name phone").lean()
    : [];
  const patientByPhone = new Map(phonePatients.map(p => [normalizePhone(p.phone), p]));
  const backfills = [];

  const normalized = appts.map(a => {
    const phoneMatch = patientByPhone.get(normalizePhone(a.phone));
    const patientName = a.patientName || a.patientId?.name || a.patient?.name || phoneMatch?.name || "Unknown";
    if (!a.patientName && patientName !== "Unknown") {
      backfills.push(
        Appointment.updateOne({ _id: a._id, patientName: "" }, { $set: { patientName } })
      );
    }

    return {
      _id:         a._id,
      patientName,
      patientId:   a.patientId?._id || a.patientId || a.patient?._id || a.patient,
      date:        a.date,
      dateKey:     a.dateKey,
      time:        a.time,
      reason:      a.reason || (a.symptoms || []).join(", ") || a.notes,
      specialty:   a.specialty,
      status:      a.status,
      paymentStatus: a.paymentStatus,
      refundStatus: a.refundStatus,
      patientChoice: a.patientChoice,
      consultationFee: a.consultationFee,
      cancellationRemark: a.cancellationRemark,
      bookedVia:    a.bookedVia,
      priority:     a.priority,
      severity:     a.severity,
      aiSeverityScore: a.aiSeverityScore,
      chiefComplaint: a.chiefComplaint,
      phone:       a.phone,
    };
  });

  Promise.all(backfills).catch(err => console.error("appointmentNameBackfill:", err));
  return normalized;
}

// ── Dashboard ──────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user.id).select("-password");
    if (!doctor) return res.status(404).json({ error: "Doctor not found." });

    const [totalPatients, appointmentsToday] = await Promise.all([
      Patient.countDocuments(),
      Appointment.countDocuments(todayAppointmentFilter(req.user.id)),
    ]);

    res.json({ doctor, stats: { totalPatients, appointmentsToday } });
  } catch (err) {
    console.error("getDashboard:", err);
    res.status(500).json({ error: "Could not load dashboard." });
  }
};

// ── Appointments ───────────────────────────────────────────────────────────
exports.getTodayAppointments = async (req, res) => {
  try {
    const appts = await Appointment.find(todayAppointmentFilter(req.user.id))
      .populate("patient", "name email age gender")
      .populate("patientId", "name email age gender")
      .sort({ time: 1 });

    res.json({ appointments: await attachAppointmentNames(appts) });
  } catch (err) {
    console.error("getTodayAppointments:", err);
    res.status(500).json({ error: "Could not fetch appointments." });
  }
};

exports.getUpcomingAppointments = async (req, res) => {
  try {
    const today = todayKey();
    const appts = await Appointment.find({
      ...doctorAppointmentFilter(req.user.id),
      dateKey: { $gt: today },
      status: { $nin: ["cancelled"] },
    })
      .populate("patient", "name email age gender")
      .populate("patientId", "name email age gender")
      .sort({ dateKey: 1, time: 1 });

    res.json({ appointments: await attachAppointmentNames(appts) });
  } catch (err) {
    console.error("getUpcomingAppointments:", err);
    res.status(500).json({ error: "Could not fetch upcoming appointments." });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const appts = await Appointment.find(doctorAppointmentFilter(req.user.id))
      .populate("patient", "name email age gender")
      .populate("patientId", "name email age gender")
      .sort({ date: 1, time: 1 });

    res.json({ appointments: await attachAppointmentNames(appts) });
  } catch (err) {
    console.error("getAppointments:", err);
    res.status(500).json({ error: "Could not fetch appointments." });
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!appointment) return res.status(404).json({ error: "Appointment not found." });

    console.log("[debug] status:", status, "| calendarEventId:", appointment?.calendarEventId);

    if (status === "cancelled") {
      const patient = await Patient.findById(appointment.patient || appointment.patientId);
      n8n.notifyCancelled(appointment, patient);
    }

    res.json({ appointment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Patients ───────────────────────────────────────────────────────────────
exports.listPatients = async (req, res) => {
  try {
    const q     = req.query.q || req.query.search || "";
    const regex = new RegExp(q, "i");
    const filters = [{ name: regex }, { email: regex }];

    if (/^[0-9a-fA-F]{24}$/.test(q)) {
      filters.push({ _id: q });
    }

    const patients = await Patient.find({
      $or: filters,
    })
      .select("name email age gender blood vitals symptoms conditions")
      .limit(50);
    res.json({ patients });
  } catch (err) {
    console.error("listPatients:", err);
    res.status(500).json({ error: "Could not fetch patients." });
  }
};

exports.getMyPatients = async (req, res) => {
  try {
    const appts = await Appointment.find({
      $or: [{ doctorId: req.user.id }, { doctor: req.user.id }],
    })
      .select("patientId patient")
      .lean();

    // Collect patientId and patient (both fields used across booking paths),
    // then drop nulls and non-ObjectId strings before querying.
    const rawIds = appts.flatMap(a => [a.patientId, a.patient]).filter(Boolean);
    const ids = [...new Set(
      rawIds.map(id => String(id)).filter(id => /^[a-f\d]{24}$/i.test(id))
    )];

    if (!ids.length) return res.json({ patients: [] });

    const patients = await Patient.find({ _id: { $in: ids } })
      .select("name email age gender blood vitals symptoms conditions")
      .lean();

    res.json({ patients });
  } catch (err) {
    console.error("getMyPatients:", err);
    res.status(500).json({ error: "Could not fetch your patients." });
  }
};

exports.getPatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).select("-password");
    if (!patient) return res.status(404).json({ error: "Patient not found." });

    const [prescriptions, clinicalNotes] = await Promise.all([
      Prescription.find({ patientId: patient._id })
        .populate("doctorId", "name specialization")
        .sort({ createdAt: -1 })
        .limit(20),
      ClinicalNote.find({ patientId: patient._id })
        .populate("doctorId", "name specialization")
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    res.json({
      patient: { ...patient.toObject(), prescriptions, clinicalNotes },
    });
  } catch (err) {
    console.error("getPatient:", err);
    res.status(500).json({ error: "Could not fetch patient." });
  }
};

// ── Vitals ─────────────────────────────────────────────────────────────────
exports.updateVitals = async (req, res) => {
  try {
    const { bloodPressure, heartRate, temperature, status } = req.body;

    // Fetch doctor name to store with vitals
    const doctor = await Doctor.findById(req.user.id).select("name");

    await Patient.updateOne(
      { _id: req.params.id, vitals: { $type: "array" } },
      { $set: { vitals: {} } }
    );

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          "vitals.bloodPressure":  bloodPressure,
          "vitals.heartRate":      heartRate,
          "vitals.temperature":    temperature,
          "vitals.status":         status,
          "vitals.updatedBy":      req.user.id,
          "vitals.updatedByName":  doctor?.name || "",
          "vitals.updatedAt":      new Date(),
        },
        $push: {
          notifications: {
            type: "vitals",
            title: "Vitals updated",
            message: `${doctor?.name || "Your doctor"} updated your vitals.`,
            doctorId: req.user.id,
            createdAt: new Date(),
            read: false,
          },
        },
      },
      { new: true, runValidators: false }
    ).select("-password");

    if (!patient) return res.status(404).json({ error: "Patient not found." });
    await createNotif(
      patient._id,
      "Patient",
      "vitals_updated",
      `${doctor?.name || "Your doctor"} updated your vitals.`,
      "/patient/dashboard"
    );
    res.json({ patient });
  } catch (err) {
    console.error("updateVitals:", err);
    res.status(500).json({ error: "Could not update vitals." });
  }
};

// ── Prescriptions ──────────────────────────────────────────────────────────
exports.writePrescription = async (req, res) => {
  try {
    const {
      patientId,
      drugName,
      dose,
      frequency,
      duration,
      instructions,
      followUpRemark,
      needsLabTest,
      labPriority = "Normal",
      labNotes = "",
    } = req.body;
    const medications = Array.isArray(req.body.medications)
      ? req.body.medications
          .map((m) => ({
            name: String(m.name || "").trim(),
            dose: String(m.dose || "").trim(),
            frequency: String(m.frequency || m.freq || "").trim(),
            duration: String(m.duration || m.dur || "").trim(),
            instructions: String(m.instructions || m.notes || "").trim(),
          }))
          .filter((m) => m.name)
      : [];

    if (!patientId) return res.status(400).json({ error: "patientId is required." });

    if (!medications.length && drugName) {
      medications.push({ name: drugName, dose, frequency, duration, instructions });
    }

    if (!medications.length) {
      return res.status(400).json({ error: "Add at least one medicine." });
    }

    const incomplete = medications.find((m) => !m.dose || !m.frequency);
    if (incomplete) {
      return res.status(400).json({ error: `Dose and frequency are required for ${incomplete.name}.` });
    }

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

    const firstMedication = medications[0];
    const recentDuplicateWindow = new Date(Date.now() - 60 * 1000);
    const recentPrescriptions = await Prescription.find({
      patientId,
      doctorId: req.user.id,
      createdAt: { $gte: recentDuplicateWindow },
    }).sort({ createdAt: -1 });
    const nextSignature = prescriptionSignature({ medications, followUpRemark });
    const duplicateRx = recentPrescriptions.find((rx) =>
      prescriptionSignature({
        medications: rx.medications?.length
          ? rx.medications
          : [{ name: rx.drugName, dose: rx.dose, frequency: rx.frequency, duration: rx.duration, instructions: rx.instructions }],
        followUpRemark: rx.followUpRemark || rx.advice,
      }) === nextSignature
    );

    if (duplicateRx) {
      return res.status(200).json({ prescription: duplicateRx, duplicate: true });
    }

    const [rx, doctor] = await Promise.all([
      Prescription.create({
        patientId,
        doctorId: req.user.id,
        medications,
        drugName: firstMedication.name,
        dose: firstMedication.dose,
        frequency: firstMedication.frequency,
        duration: firstMedication.duration,
        instructions: firstMedication.instructions,
        followUpRemark: followUpRemark || "",
        advice: followUpRemark || "",
        needsLabTest: shouldCreateLabOrder,
        labTests,
        labPriority,
        labNotes: String(labNotes || "").trim(),
      }),
      Doctor.findById(req.user.id).select("name specialisation specialization"),
    ]);

    let labOrder = null;
    if (shouldCreateLabOrder) {
      labOrder = await LabOrder.create({
        patientId,
        doctorId: req.user.id,
        tests: labTests,
        department: doctor?.specialisation || doctor?.specialization || "General",
        priority: labPriority,
        notes: String(labNotes || followUpRemark || "").trim(),
      });
      rx.labOrderId = labOrder._id;
      await rx.save();
      labOrder = await LabOrder.findById(labOrder._id)
        .populate("patientId", "name email phone age gender")
        .populate("doctorId", "name email specialisation specialization");
    }

    const medSummary = medications.length === 1
      ? medications[0].name
      : `${medications.length} medicines`;

    await Patient.findByIdAndUpdate(patientId, {
      $push: {
        notifications: {
          type: "prescription",
          title: "New prescription added",
          message: `${doctor?.name || "Your doctor"} prescribed ${medSummary}.`,
          doctorId: req.user.id,
          createdAt: new Date(),
          read: false,
        },
      },
    });
    await createNotif(
      patientId,
      "Patient",
      "prescription_issued",
      `${doctor?.name || "Your doctor"} prescribed ${medSummary}.`,
      "/patient/dashboard"
    );

    // Generate PDF and email to patient (non-blocking)
    (async () => {
      try {
        console.log("[Prescription] Starting PDF+email for patient:", patientId);
        const patient = await Patient.findById(patientId).select("name email phone age");
        console.log("[Prescription] Patient email:", patient?.email || "NO EMAIL FOUND");
        if (!patient?.email) return;
        const fullDoctor = await Doctor.findById(req.user.id).select("name specialisation specialization hospital");
        console.log("[Prescription] Generating PDF...");
        const pdfBuffer  = await generatePrescriptionPdf(rx, patient, fullDoctor);
        console.log("[Prescription] PDF generated, size:", pdfBuffer.length);
        await sendPrescriptionEmail({
          toEmail:    patient.email,
          toName:     patient.name,
          doctorName: `Dr. ${fullDoctor?.name || "Doctor"}`,
          pdfBuffer,
        });
      } catch (emailErr) {
        console.error("[Prescription] PDF/email failed:", emailErr.message, emailErr.stack);
      }
    })();

    res.status(201).json({ prescription: rx, labOrder });
  } catch (err) {
    console.error("writePrescription:", err);
    res.status(500).json({ error: "Could not save prescription." });
  }
};

exports.getPatientPrescriptions = async (req, res) => {
  try {
    const rxs = await Prescription.find({ patientId: req.params.patientId })
      .populate("doctorId", "name specialization")
      .sort({ createdAt: -1 });
    res.json({ prescriptions: rxs });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch prescriptions." });
  }
};

// ── Clinical Notes ─────────────────────────────────────────────────────────
exports.addClinicalNote = async (req, res) => {
  try {
    const { patientId, note } = req.body;
    if (!patientId || !note?.trim())
      return res.status(400).json({ error: "patientId and note are required." });

    const cn = await ClinicalNote.create({
      patientId,
      doctorId: req.user.id,
      note: note.trim(),
    });

    await Patient.findByIdAndUpdate(patientId, {
      $push: {
        notifications: {
          type: "clinical_note",
          title: "Clinical note added",
          message: "Your doctor added a new clinical note to your record.",
          doctorId: req.user.id,
          createdAt: new Date(),
          read: false,
        },
      },
    });
    await createNotif(
      patientId,
      "Patient",
      "clinical_note_added",
      "Your doctor added a new clinical note to your record.",
      "/patient/dashboard"
    );

    res.status(201).json({ clinicalNote: cn });
  } catch (err) {
    console.error("addClinicalNote:", err);
    res.status(500).json({ error: "Could not save note." });
  }
};

exports.getPatientNotes = async (req, res) => {
  try {
    const notes = await ClinicalNote.find({ patientId: req.params.patientId })
      .populate("doctorId", "name specialization")
      .sort({ createdAt: -1 });
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch notes." });
  }
};

// ── Report Upload ──────────────────────────────────────────────────────────
// Files saved to Backend/uploads/ and served as static files
exports.uploadReport = async (req, res) => {
  try {
    const { patientId, label } = req.body;
    if (!req.file)  return res.status(400).json({ error: "No file uploaded." });
    if (!patientId) return res.status(400).json({ error: "patientId is required." });

    // Build the public URL — served as static from Backend/uploads/
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    // Get doctor name
    const doctor = await Doctor.findById(req.user.id).select("name");

    const reportEntry = {
      url:          fileUrl,
      filename:     req.file.filename,
      originalName: req.file.originalname,
      label:        label || req.file.originalname,
      mimetype:     req.file.mimetype,
      uploadedBy:   req.user.id,
      doctorName:   doctor?.name || "",
      uploadedAt:   new Date(),
    };

    await Patient.findByIdAndUpdate(patientId, {
      $push: {
        reports: reportEntry,
        notifications: {
          type: "report",
          title: "Report uploaded",
          message: `${doctor?.name || "Your doctor"} uploaded ${reportEntry.label}.`,
          doctorId: req.user.id,
          createdAt: new Date(),
          read: false,
        },
      },
    });
    await createNotif(
      patientId,
      "Patient",
      "report_uploaded",
      `${doctor?.name || "Your doctor"} uploaded ${reportEntry.label}.`,
      "/patient/dashboard"
    );

    res.status(201).json({
      message: "Report uploaded successfully.",
      report:  reportEntry,
    });
  } catch (err) {
    console.error("uploadReport:", err);
    res.status(500).json({ error: "Upload failed." });
  }
};

exports.updateDoctor = async (req, res) => {
  try {
    const allowed = ["name", "email", "specialisation", "medRegNo", "hospital", "phone", "consultationFee", "bio"];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select("-password");
    if (!doctor) return res.status(404).json({ error: "Doctor not found." });
    res.json({ doctor });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not update doctor." });
  }
};

exports.deleteDoctor = async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found." });
    await Nurse.updateMany({ assignedDoctor: req.params.id }, { $set: { assignedDoctor: null } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not delete doctor." });
  }
};
