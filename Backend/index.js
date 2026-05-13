// backend/index.js
require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const path     = require("path");
const connectDB = require("./config/db");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({
  origin:      ["http://localhost:5173", "http://localhost:8080", "http://localhost:3000"],
  credentials: true,
  methods:     ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

// ── Connect DB & Start ────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
});
