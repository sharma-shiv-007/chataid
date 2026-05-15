// backend/controllers/appointmentController.js
const Appointment        = require("../models/appointment");
const DoctorAvailability = require("../models/doctorAvailability");
const Patient            = require("../models/patient");
const Doctor             = require("../models/doctor");
const catchAsync         = require("../utils/catchAsync");
const { createNotif }    = require("../services/notificationService");
const n8n                = require("../services/n8nService");

const appointmentResponse = (a) => ({
  ...a.toObject(),
  patientName: a.patientId?.name || a.patient?.name || a.patientName || "Unknown",
  patientId:   a.patientId?._id || a.patientId,
});

// GET /api/appointments/admin  — admin appointment list
exports.getAdminAppointments = catchAsync(async (req, res) => {
  const appointments = await Appointment.find({})
    .populate("doctorId", "name specialisation hospital")
    .populate("doctor", "name specialisation hospital")
    .populate("patientId", "name phone email")
    .populate("patient", "name phone email")
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ appointments: appointments.map(appointmentResponse) });
});

// GET /api/appointments/my  — patient's own appointments
exports.getMyAppointments = catchAsync(async (req, res) => {
  const appointments = await Appointment.find({
    $or: [{ patient: req.user.id }, { patientId: req.user.id }],
  })
    .populate("doctor", "name specialisation hospital")
    .populate("doctorId", "name specialisation hospital phone")
    .sort({ date: -1 });
  res.json({ appointments });
});

// GET /api/appointments/doctor  — doctor's appointments
exports.getDoctorAppointments = catchAsync(async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const appointments = await Appointment.find({
    $or: [{ doctor: req.user.id }, { doctorId: req.user.id }],
    dateKey: today,
  })
    .populate("patient", "name phone age email vitals")
    .populate("patientId", "name phone age email vitals")
    .sort({ aiSeverityScore: -1, time: 1 });
  res.json({ appointments: appointments.map(appointmentResponse) });
});

// POST /api/appointments  — book a regular appointment
exports.bookAppointment = catchAsync(async (req, res) => {
  const {
    doctorId, date, dateKey: requestedDateKey, time, symptoms,
    chiefComplaint, appointmentType, notes,
    patientName, fullName, phone, age, specialty,
    reason,
    hospitalName, hospitalAddress, hospitalPhone,
    paymentStatus, paymentMethod, consultationFee,
  } = req.body;

  const isSlotBooking = Boolean(doctorId && requestedDateKey);
  const dateKey = requestedDateKey || new Date(date).toISOString().split("T")[0];

  if (isSlotBooking) {
    if (!req.user?.id) return res.status(401).json({ error: "Please log in to book a slot." });

    const avail = await DoctorAvailability.findOne({ doctorId });
    if (!avail || !avail.isAvailable)
      return res.status(400).json({ error: "This doctor is currently not available." });

    if (avail.leaves.includes(dateKey))
      return res.status(400).json({ error: "Doctor is on leave on this date." });

    const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const dayOfWeek = dayNames[new Date(`${dateKey}T12:00:00`).getDay()];
    const daySchedule = avail.weeklySchedule?.[dayOfWeek];
    if (!daySchedule?.active)
      return res.status(400).json({ error: "Doctor does not have slots on this day." });

    const slotExists = daySchedule.slots.some(s => s.time === time);
    if (!slotExists)
      return res.status(400).json({ error: "This time slot does not exist in doctor's schedule." });

    // Reject if the slot is in the past (today only)
    const todayKey = new Date().toISOString().split("T")[0];
    if (dateKey === todayKey && time) {
      const now     = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = time.split(":").map(Number);
      if (sh * 60 + sm <= nowMins) {
        return res.status(400).json({ error: "This time slot has already passed. Please choose a future slot." });
      }
    }
  }

  const patient = req.user?.id
    ? await Patient.findById(req.user.id).select("name phone age email")
    : { name: patientName || fullName, phone, age, email: req.body.email || "" };
  const resolvedPatientName = patientName || fullName || patient?.name || "";

  let appointment;
  try {
    appointment = await Appointment.create({
      patient:         req.user?.id || undefined,
      patientId:       req.user?.id || undefined,
      doctor:          doctorId,
      doctorId:        doctorId || undefined,
    patientName:     resolvedPatientName,
    phone:           phone || patient?.phone || "",
    age:             age || patient?.age || "",
    specialty:       specialty || "",
    date:            new Date(date || `${dateKey}T00:00:00`),
    dateKey,
    time,
    symptoms:        symptoms || [],
    chiefComplaint:  chiefComplaint || "",
    appointmentType: appointmentType || "in-person",
    notes:           notes || reason || "",
    bookedVia:       "manual",
    urgency:         "routine",
    status:          "pending",
    paymentStatus:   paymentStatus === "paid" ? "paid" : "pending",
    paymentMethod:   paymentMethod || "",
    consultationFee: Number(consultationFee) || 0,
    hospitalName:    hospitalName || "",
    hospitalAddress: hospitalAddress || "",
    hospitalPhone:   hospitalPhone || "",
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "This slot is already booked. Please choose another." });
    }
    throw err;
  }

  // Fire n8n -> Google Calendar
  const doctor  = doctorId ? await Doctor.findById(doctorId) : null;
  if (!req.body.skipN8n) {
    try {
      const n8nResponse = await n8n.notifyBooked(appointment, patient, doctor);
      const calendarEventId =
        n8nResponse?.calendarEventId ||
        n8nResponse?.eventId ||
        n8nResponse?.id ||
        n8nResponse?.[0]?.calendarEventId ||
        n8nResponse?.[0]?.eventId ||
        n8nResponse?.[0]?.id;

      if (calendarEventId) {
        await Appointment.findByIdAndUpdate(appointment._id, { calendarEventId });
        appointment.calendarEventId = calendarEventId;
        console.log("[n8n] Saved calendarEventId:", calendarEventId);
      }
    } catch (err) {
      console.warn("[n8n] Could not save calendarEventId:", err.message);
    }
  }

  if (req.user?.id) {
    await createNotif(
      req.user.id, "Patient", "appt_booked",
      `Your appointment on ${dateKey} at ${time} is booked.`,
      `/appointments/${appointment._id}`
    );
  }

  const populated = doctorId
    ? await Appointment.findById(appointment._id)
        .populate("doctorId", "name specialisation hospital")
        .populate("patientId", "name email")
    : appointment;

  res.status(201).json({ appointment: populated });
});

// PATCH /api/appointments/:id/status  — doctor confirms/cancels
exports.updateStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    { status, updatedAt: new Date() },
    { new: true }
  );
  if (!appointment) return res.status(404).json({ error: "Appointment not found." });

  console.log("[debug] status received:", status, "| patient:", appointment?.patient, "| calendarEventId:", appointment?.calendarEventId);

  if (status === "cancelled") {
    const patient = await Patient.findById(appointment.patient);
    n8n.notifyCancelled(appointment, patient);
  }

  if (appointment.patient) {
    await createNotif(
      appointment.patient, "Patient",
      status === "confirmed" ? "appt_confirmed" : "appt_cancelled",
      `Your appointment has been ${status}.`,
      `/appointments/${appointment._id}`
    );
  }

  res.json({ appointment });
});

// GET /api/appointments/emergencies  — today's emergencies sorted by severity
exports.getEmergencies = catchAsync(async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const emergencies = await Appointment.find({
    bookedVia: "emergency",
    dateKey:   today,
  }).sort({ aiSeverityScore: -1, createdAt: 1 });
  res.json({ emergencies });
});

exports.updateAppointmentStatus = exports.updateStatus;

exports.cancelAppointment = catchAsync(async (req, res) => {
  const appointment = await Appointment.findOneAndUpdate(
    {
      _id: req.params.id,
      $or: [{ patient: req.user.id }, { patientId: req.user.id }],
      status: { $in: ["pending", "confirmed"] },
    },
    { status: "cancelled" },
    { new: true }
  );
  if (!appointment) {
    return res.status(404).json({ error: "Appointment not found or already cancelled." });
  }

  const patient = req.user?.id ? await Patient.findById(req.user.id) : null;
  n8n.notifyCancelled(appointment, patient);

  res.json({ appointment });
});

exports.rescheduleAppointment = catchAsync(async (req, res) => {
  const { newDate, newTime } = req.body;
  if (!newDate || !newTime)
    return res.status(400).json({ error: "New date and time required." });

  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    {
      date:    new Date(newDate),
      dateKey: newDate,
      time:    newTime,
      status:  "pending",
    },
    { new: true }
  );
  if (!appointment)
    return res.status(404).json({ error: "Appointment not found." });

  const patient = await Patient.findById(appointment.patient);
  const doctor  = await Doctor.findById(appointment.doctor);
  n8n.notifyRescheduled(appointment, patient, doctor, newDate, newTime);

  res.json({ appointment });
});
