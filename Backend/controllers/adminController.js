const Patient     = require("../models/patient");
const Appointment = require("../models/appointment");

// GET /api/admin/patients?q=&page=1&limit=20
exports.listPatients = async (req, res) => {
  try {
    const q     = String(req.query.q || "").trim();
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = q
      ? { $or: [
          { name:  { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
          { phone: { $regex: q, $options: "i" } },
        ] }
      : {};

    const [patients, total] = await Promise.all([
      Patient.find(filter)
        .select("name email phone age gender city state blood profileComplete deactivated createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Patient.countDocuments(filter),
    ]);

    res.json({ patients, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not load patients." });
  }
};

// GET /api/admin/patients/:id
exports.getPatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .select("-password");
    if (!patient) return res.status(404).json({ error: "Patient not found." });

    const [appointments, labCount] = await Promise.all([
      Appointment.find({
        $or: [{ patient: req.params.id }, { patientId: req.params.id }],
      }).select("dateKey time status specialty bookedVia").sort({ createdAt: -1 }).limit(5),
      Appointment.countDocuments({
        $or: [{ patient: req.params.id }, { patientId: req.params.id }],
      }),
    ]);

    res.json({ patient, appointments, appointmentCount: labCount });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not load patient." });
  }
};

// PATCH /api/admin/patients/:id/deactivate
exports.toggleDeactivate = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).select("name deactivated");
    if (!patient) return res.status(404).json({ error: "Patient not found." });

    patient.deactivated = !patient.deactivated;
    await patient.save();

    res.json({ success: true, deactivated: patient.deactivated });
  } catch (err) {
    res.status(500).json({ error: err.message || "Could not update patient." });
  }
};
