// backend/index.js
require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const path     = require("path");
const connectDB = require("./config/db");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));
app.use(express.json({ limit: "10kb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Debug logger (remove in production) ──────────────────────────
app.use((req, res, next) => { console.log(">>", req.method, req.path); next(); });

// ── Routes ────────────────────────────────────────────────────────
app.use("/api/auth",          require("./routes/auth"));
app.use("/api/patient",       require("./routes/patients"));
app.use("/api/patients",      require("./routes/patients"));
app.use("/api/doctor",        require("./routes/doctors"));
app.use("/api/voice",         require("./routes/voice"));
app.use("/api/emergency",     require("./routes/emergency"));
app.use("/api/availability",  require("./routes/availability"));
app.use("/api/appointments",  require("./routes/appointments"));
app.use("/api/cancellation",  require("./routes/cancellationRoutes"));
app.use("/api/prescriptions", require("./routes/prescriptions"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/reports",       require("./routes/reports"));
app.use("/api/nurses",        require("./routes/nurses"));
app.use("/api/lab",           require("./routes/lab"));
app.use("/api/admin",         require("./routes/admin"));

// ── Legacy direct routes (keep for backward compat) ───────────────
const doctorCtrl = require("./controllers/doctorController");
const appointmentCtrl = require("./controllers/appointmentController");
const auth       = require("./middleware/auth");
const allow      = require("./middleware/roleGuard");
app.get("/api/appointments/admin", auth, allow("admin"), appointmentCtrl.getAdminAppointments);
app.get("/api/admin/appointments", auth, allow("admin"), appointmentCtrl.getAdminAppointments);
app.put("/api/patient/vitals/:id", auth, doctorCtrl.updateVitals);

// ── Health check ──────────────────────────────────────────────────
app.get("/api/health", (_, res) => res.json({ status: "ok", time: new Date() }));

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found." }));

// ── Global error handler ──────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ error: err.message || "Something went wrong." });
});

// ── Startup migration: backfill missing uhid on all patients ─────────────────
async function backfillUhid() {
  try {
    const Patient = require("./models/patient");

    // Drop the old plain unique index (uhid_1) if it exists — it blocks null docs
    try {
      await Patient.collection.dropIndex("uhid_1");
      console.log("[migration] Dropped old uhid_1 index");
    } catch (_) { /* index didn't exist, that's fine */ }

    // Find every patient without a proper string uhid
    const patients = await Patient.find({
      $or: [{ uhid: { $exists: false } }, { uhid: null }, { uhid: "" }],
    }).select("_id");

    if (patients.length === 0) {
      console.log("[migration] All patients already have a uhid — nothing to do");
      return;
    }

    const ops = patients.map(p => ({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { uhid: `UH-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` } },
      },
    }));
    const result = await Patient.bulkWrite(ops);
    console.log(`[migration] Backfilled uhid on ${result.modifiedCount} patient(s)`);
  } catch (err) {
    console.error("[migration] uhid backfill failed:", err.message);
  }
}

// ── Connect DB & Start ────────────────────────────────────────────
connectDB().then(async () => {
  await backfillUhid();
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
});
