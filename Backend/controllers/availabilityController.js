// Backend/controllers/availabilityController.js
const DoctorAvailability = require("../models/doctorAvailability");
const Appointment        = require("../models/appointment");
const Doctor             = require("../models/doctor");
const Admin              = require("../models/admin");
const { createNotif }    = require("../services/notificationService");

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

// Helper: generate time slots between startTime and endTime
function generateSlots(startTime, endTime, durationMins) {
  const slots = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let cur = sh * 60 + sm;
  const end = eh * 60 + em;
  while (cur + durationMins <= end) {
    const h = String(Math.floor(cur / 60)).padStart(2, "0");
    const m = String(cur % 60).padStart(2, "0");
    slots.push({ time: `${h}:${m}`, booked: false });
    cur += durationMins;
  }
  return slots;
}

function buildWeeklySchedule(weeklySchedule) {
  const built = {};
  for (const day of DAYS) {
    const d = weeklySchedule?.[day];
    if (!d) { built[day] = { active: false, slots: [], slotDurationMins: 30 }; continue; }
    if (!d.active) { built[day] = { active: false, slots: [], slotDurationMins: d.slotDurationMins || 30 }; continue; }
    const slots = generateSlots(d.startTime, d.endTime, d.slotDurationMins || 30);
    built[day] = { active: true, slots, slotDurationMins: d.slotDurationMins || 30 };
  }
  return built;
}

async function saveScheduleForDoctor(doctorId, weeklySchedule) {
  if (!weeklySchedule) {
    const err = new Error("weeklySchedule is required.");
    err.statusCode = 400;
    throw err;
  }

  return DoctorAvailability.findOneAndUpdate(
    { doctorId },
    { $set: { weeklySchedule: buildWeeklySchedule(weeklySchedule), isAvailable: true } },
    { upsert: true, new: true }
  );
}

// ── GET /api/availability/me  (doctor gets their own schedule) ────────────────
exports.getMyAvailability = async (req, res) => {
  try {
    let avail = await DoctorAvailability.findOne({ doctorId: req.user.id });
    if (!avail) {
      // Return a blank template
      avail = { doctorId: req.user.id, weeklySchedule: {}, leaves: [], isAvailable: true };
    }
    res.json({ availability: avail });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch availability." });
  }
};

// ── PUT /api/availability/schedule  (doctor sets weekly schedule) ─────────────
// Body: { weeklySchedule: { monday: { active, startTime, endTime, slotDurationMins }, ... } }
exports.setSchedule = async (req, res) => {
  try {
    const { weeklySchedule } = req.body;
    const avail = await saveScheduleForDoctor(req.user.id, weeklySchedule);
    res.json({ availability: avail });
  } catch (err) {
    console.error("setSchedule:", err);
    res.status(err.statusCode || 500).json({ error: err.message || "Could not save schedule." });
  }
};

exports.getDoctorAvailabilityForAdmin = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.doctorId).select("name email specialisation hospital");
    if (!doctor) return res.status(404).json({ error: "Doctor not found." });

    let availability = await DoctorAvailability.findOne({ doctorId: doctor._id });
    if (!availability) {
      availability = { doctorId: doctor._id, weeklySchedule: {}, leaves: [], leaveRequests: [], isAvailable: true };
    }

    res.json({ doctor, availability });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch doctor availability." });
  }
};

exports.setDoctorScheduleForAdmin = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.doctorId).select("_id name");
    if (!doctor) return res.status(404).json({ error: "Doctor not found." });

    const availability = await saveScheduleForDoctor(doctor._id, req.body.weeklySchedule);
    res.json({ doctor, availability });
  } catch (err) {
    console.error("setDoctorScheduleForAdmin:", err);
    res.status(err.statusCode || 500).json({ error: err.message || "Could not save doctor schedule." });
  }
};

// ── PATCH /api/availability/toggle  (global available/on-leave toggle) ────────
exports.toggleAvailability = async (req, res) => {
  try {
    let avail = await DoctorAvailability.findOne({ doctorId: req.user.id });

    if (!avail) {
      try {
        avail = await DoctorAvailability.create({
          doctorId: req.user.id,
          isAvailable: false,
        });
      } catch (err) {
        if (err?.code !== 11000) throw err;
        avail = await DoctorAvailability.findOne({ doctorId: req.user.id });
        avail.isAvailable = !avail.isAvailable;
        await avail.save();
      }
    } else {
      avail.isAvailable = !avail.isAvailable;
      await avail.save();
    }

    res.json({ isAvailable: avail.isAvailable, availability: avail });
  } catch (err) {
    console.error("toggleAvailability:", err);
    res.status(500).json({
      error: "Could not toggle availability.",
      details: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
};

// ── POST /api/availability/leave  (mark specific date as leave) ───────────────
// Body: { date: "2025-06-20" }
exports.addLeave = async (req, res) => {
  try {
    const { date, reason = "", notifyAdmin = false } = req.body;
    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)." });
    if (notifyAdmin && !String(reason).trim()) {
      return res.status(400).json({ error: "Reason is required when notifying admin." });
    }

    const update = { $addToSet: { leaves: date } };
    if (notifyAdmin || String(reason).trim()) {
      update.$push = {
        leaveRequests: {
          date,
          reason: String(reason).trim(),
          status: "pending",
          requestedAt: new Date(),
        },
      };
    }

    const avail = await DoctorAvailability.findOneAndUpdate(
      { doctorId: req.user.id },
      update,
      { upsert: true, new: true }
    );

    if (notifyAdmin || String(reason).trim()) {
      const doctor = await Doctor.findById(req.user.id).select("name specialisation");
      const admins = await Admin.find({}).select("_id");
      await Promise.all(admins.map(admin => createNotif(
        admin._id,
        "Admin",
        "leave_request",
        `Dr. ${doctor?.name || "Doctor"} requested leave on ${date}: ${String(reason).trim()}`,
        "/admin-dashboard"
      )));
    }

    res.json({ leaves: avail.leaves, leaveRequests: avail.leaveRequests || [] });
  } catch (err) {
    res.status(500).json({ error: "Could not add leave." });
  }
};

exports.getLeaveRequestsForAdmin = async (_req, res) => {
  try {
    const requests = await DoctorAvailability.find({ "leaveRequests.0": { $exists: true } })
      .select("doctorId leaveRequests")
      .populate("doctorId", "name email specialisation hospital")
      .sort({ updatedAt: -1 });

    res.json({
      requests: requests.flatMap(av => (av.leaveRequests || []).map(request => ({
        ...request.toObject(),
        doctor: av.doctorId,
      }))).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)),
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load leave requests." });
  }
};

exports.reviewLeaveRequestForAdmin = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision } = req.body;
    if (!["approved", "cancelled"].includes(decision)) {
      return res.status(400).json({ error: "decision must be approved or cancelled." });
    }

    const availability = await DoctorAvailability.findOne({ "leaveRequests._id": requestId })
      .populate("doctorId", "name email specialisation");
    if (!availability) return res.status(404).json({ error: "Leave request not found." });

    const request = availability.leaveRequests.id(requestId);
    if (!request) return res.status(404).json({ error: "Leave request not found." });

    request.status = decision;
    request.reviewedAt = new Date();
    request.reviewedBy = req.user.id;

    if (decision === "approved") {
      if (!availability.leaves.includes(request.date)) availability.leaves.push(request.date);
    } else {
      availability.leaves = availability.leaves.filter(date => date !== request.date);
    }

    await availability.save();

    const doctorName = availability.doctorId?.name || "Doctor";
    const message = decision === "approved"
      ? `Your leave request for ${request.date} was approved by admin.`
      : `Your leave request for ${request.date} was cancelled by admin.`;

    await createNotif(
      availability.doctorId._id || availability.doctorId,
      "Doctor",
      "leave_request",
      message,
      "/doctor-dashboard"
    );

    res.json({
      success: true,
      request: {
        ...request.toObject(),
        doctor: availability.doctorId,
      },
      message: `Leave request for Dr. ${doctorName} ${decision}.`,
    });
  } catch (err) {
    console.error("reviewLeaveRequestForAdmin:", err);
    res.status(500).json({ error: "Could not update leave request." });
  }
};

// ── DELETE /api/availability/leave/:date  (remove a leave date) ───────────────
exports.removeLeave = async (req, res) => {
  try {
    const { date } = req.params;
    const avail = await DoctorAvailability.findOneAndUpdate(
      { doctorId: req.user.id },
      { $pull: { leaves: date } },
      { new: true }
    );
    res.json({ leaves: avail?.leaves || [] });
  } catch (err) {
    res.status(500).json({ error: "Could not remove leave." });
  }
};

// ── GET /api/availability/slots?doctorId=&date=  (patient fetches open slots) ─
exports.getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return res.status(400).json({ error: "doctorId and date are required." });

    const avail = await DoctorAvailability.findOne({ doctorId });
    if (!avail || !avail.isAvailable) return res.json({ slots: [], reason: "Doctor is not available." });

    // Check if date is on leave
    if (avail.leaves.includes(date)) return res.json({ slots: [], reason: "Doctor is on leave this day." });

    // Get day of week from date string
    const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const dayOfWeek = dayNames[new Date(`${date}T12:00:00`).getDay()];
    const daySchedule = avail.weeklySchedule?.[dayOfWeek];

    if (!daySchedule?.active) return res.json({ slots: [], reason: "Doctor does not work on this day." });

    // Get all booked slots for this doctor on this date
    const booked = await Appointment.find({
      doctorId,
      dateKey: date,
      status: { $in: ["pending", "confirmed"] },
    }).select("time");
    const bookedTimes = new Set(booked.map(a => a.time));

    // Return slots with booked flag
    const slots = daySchedule.slots.map(s => ({
      time:   s.time,
      booked: bookedTimes.has(s.time),
    }));

    res.json({ slots, day: dayOfWeek });
  } catch (err) {
    console.error("getAvailableSlots:", err);
    res.status(500).json({ error: "Could not fetch slots." });
  }
};

// ── GET /api/availability/doctors  (patient sees doctors they can choose from) ────────
exports.getAvailableDoctors = async (req, res) => {
  try {
    const Doctor = require("../models/doctor");

    const [doctors, availDocs] = await Promise.all([
      Doctor.find({})
        .select("name specialisation hospital phone consultationFee rating avatar availability")
        .sort({ name: 1 }),
      DoctorAvailability.find({}).select("doctorId isAvailable leaves weeklySchedule"),
    ]);

    const availabilityByDoctor = new Map(
      availDocs.map(a => [String(a.doctorId), a])
    );

    // Attach availability info to each doctor
    const result = doctors
      // Hide only doctors who explicitly toggled themselves unavailable.
      // Doctors without a DoctorAvailability doc are still valid doctors and
      // should not disappear from the patient booking screen.
      .filter(doc => availabilityByDoctor.get(String(doc._id))?.isAvailable !== false)
      .map(doc => {
        const av = availabilityByDoctor.get(String(doc._id));
        const activeDays = Object.entries(av?.weeklySchedule || {})
          .filter(([, v]) => v?.active)
          .map(([day]) => day);
        const legacyActiveDays = (doc.availability || [])
          .map(a => String(a.day || "").toLowerCase())
          .filter(Boolean);

        return {
          ...doc.toObject(),
          activeDays: activeDays.length ? activeDays : legacyActiveDays,
          isAvailable: av?.isAvailable ?? true,
          leaveDates: av?.leaves || [],
        };
      });

    res.json({ doctors: result });
  } catch (err) {
    console.error("getAvailableDoctors:", err);
    res.status(500).json({ error: "Could not fetch doctors." });
  }
};
