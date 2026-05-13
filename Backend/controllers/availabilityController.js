// Backend/controllers/availabilityController.js
const DoctorAvailability = require("../models/doctorAvailability");
const Appointment        = require("../models/appointment");

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
    if (!weeklySchedule) return res.status(400).json({ error: "weeklySchedule is required." });

    // Build the schedule with generated slots
    const built = {};
    for (const day of DAYS) {
      const d = weeklySchedule[day];
      if (!d) { built[day] = { active: false, slots: [], slotDurationMins: 30 }; continue; }
      if (!d.active) { built[day] = { active: false, slots: [], slotDurationMins: d.slotDurationMins || 30 }; continue; }
      const slots = generateSlots(d.startTime, d.endTime, d.slotDurationMins || 30);
      built[day] = { active: true, slots, slotDurationMins: d.slotDurationMins || 30 };
    }

    const avail = await DoctorAvailability.findOneAndUpdate(
      { doctorId: req.user.id },
      { $set: { weeklySchedule: built } },
      { upsert: true, new: true }
    );
    res.json({ availability: avail });
  } catch (err) {
    console.error("setSchedule:", err);
    res.status(500).json({ error: "Could not save schedule." });
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
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)." });
    const avail = await DoctorAvailability.findOneAndUpdate(
      { doctorId: req.user.id },
      { $addToSet: { leaves: date } },
      { upsert: true, new: true }
    );
    res.json({ leaves: avail.leaves });
  } catch (err) {
    res.status(500).json({ error: "Could not add leave." });
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
