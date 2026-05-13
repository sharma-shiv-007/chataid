const Nurse = require("../models/nurse");
const Doctor = require("../models/doctor");
const Appointment = require("../models/appointment");
const Patient = require("../models/patient");
const { createNotif } = require("../services/notificationService");

exports.getAdminNurses = async (_req, res) => {
  try {
    const [nurses, doctors] = await Promise.all([
      Nurse.find({}).select("-password").populate("assignedDoctor", "name specialisation email").sort({ createdAt: -1 }),
      Doctor.find({}).select("name email specialisation hospital").sort({ name: 1 }),
    ]);

    res.json({ nurses, doctors });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not load nurses." });
  }
};

exports.assignNurse = async (req, res) => {
  try {
    const { nurseId } = req.params;
    const { doctorId } = req.body;

    const doctor = doctorId ? await Doctor.findById(doctorId).select("_id") : null;
    if (doctorId && !doctor) return res.status(404).json({ error: "Doctor not found." });

    const nurse = await Nurse.findByIdAndUpdate(
      nurseId,
      { assignedDoctor: doctorId || null },
      { new: true }
    )
      .select("-password")
      .populate("assignedDoctor", "name specialisation email");

    if (!nurse) return res.status(404).json({ error: "Nurse not found." });

    res.json({ success: true, nurse });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not assign nurse." });
  }
};

const appointmentPatientId = (appointment) =>
  appointment.patient?._id || appointment.patient || appointment.patientId?._id || appointment.patientId;

const appointmentDoctorId = (appointment) =>
  appointment.doctor?._id || appointment.doctor || appointment.doctorId?._id || appointment.doctorId;

exports.getMyAppointments = async (req, res) => {
  try {
    const nurse = await Nurse.findById(req.user.id)
      .select("-password")
      .populate("assignedDoctor", "name email specialisation hospital");

    if (!nurse) return res.status(404).json({ error: "Nurse not found." });
    if (!nurse.assignedDoctor) {
      return res.json({ nurse, assignedDoctor: null, appointments: [] });
    }

    const doctorId = nurse.assignedDoctor._id || nurse.assignedDoctor;
    const appointments = await Appointment.find({
      $or: [{ doctor: doctorId }, { doctorId }],
    })
      .populate("patient", "name email phone age gender vitals")
      .populate("patientId", "name email phone age gender vitals")
      .populate("doctor", "name specialisation")
      .populate("doctorId", "name specialisation")
      .sort({ dateKey: -1, date: -1, time: 1 })
      .limit(100);

    res.json({ nurse, assignedDoctor: nurse.assignedDoctor, appointments });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not load assigned appointments." });
  }
};

exports.updatePatientVitals = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { bloodPressure, heartRate, temperature, status } = req.body;

    const nurse = await Nurse.findById(req.user.id).select("name assignedDoctor");
    if (!nurse) return res.status(404).json({ error: "Nurse not found." });
    if (!nurse.assignedDoctor) return res.status(403).json({ error: "No doctor assigned to this nurse." });

    const appointment = await Appointment.findOne({
      $or: [{ doctor: nurse.assignedDoctor }, { doctorId: nurse.assignedDoctor }],
      $and: [{ $or: [{ patient: patientId }, { patientId }] }],
    });
    if (!appointment) {
      return res.status(403).json({ error: "This patient is not booked with your assigned doctor." });
    }

    const checkedAt = new Date();
    await Patient.updateOne(
      { _id: patientId, vitals: { $type: "array" } },
      { $set: { vitals: {} } }
    );

    const patient = await Patient.findByIdAndUpdate(
      patientId,
      {
        $set: {
          "vitals.bloodPressure": bloodPressure,
          "vitals.heartRate": heartRate ? Number(heartRate) : null,
          "vitals.temperature": temperature ? Number(temperature) : null,
          "vitals.status": status || "Normal",
          "vitals.updatedBy": nurse._id,
          "vitals.updatedByName": nurse.name,
          "vitals.updatedByRole": "nurse",
          "vitals.nurseChecked": true,
          "vitals.checkedByNurse": nurse._id,
          "vitals.checkedByNurseName": nurse.name,
          "vitals.checkedAt": checkedAt,
          "vitals.assignedDoctor": nurse.assignedDoctor,
          "vitals.updatedAt": checkedAt,
        },
        $push: {
          notifications: {
            type: "vitals",
            title: "Vitals checked",
            message: `${nurse.name} checked your vitals before the doctor visit.`,
            createdAt: checkedAt,
            read: false,
          },
        },
      },
      { new: true, runValidators: false }
    ).select("-password");

    if (!patient) return res.status(404).json({ error: "Patient not found." });

    await Doctor.findByIdAndUpdate(nurse.assignedDoctor, {
      $push: {
        notifications: {
          type: "nurse_vitals_checked",
          title: "Vitals checked by nurse",
          message: `${nurse.name} checked vitals for ${patient.name}.`,
          patientId: patient._id,
          createdAt: checkedAt,
          read: false,
        },
      },
    });

    await createNotif(
      nurse.assignedDoctor,
      "Doctor",
      "nurse_vitals_checked",
      `${nurse.name} checked vitals for ${patient.name}.`,
      "/doctor-dashboard"
    );

    res.json({ success: true, patient, appointmentId: appointment._id });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not update vitals." });
  }
};
