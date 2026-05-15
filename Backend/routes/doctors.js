// Backend/routes/doctor.js  ── complete drop-in replacement
const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const upload  = require("../middleware/upload");
const ctrl    = require("../controllers/doctorController");

const allow = require("../middleware/roleGuard");

// All routes require a valid JWT
router.use(auth);

// ── Admin only ─────────────────────────────────────────────────────────────
router.patch("/:id",  allow("admin"), ctrl.updateDoctor);
router.delete("/:id", allow("admin"), ctrl.deleteDoctor);

// ── Dashboard ──────────────────────────────────────────────────────────────
router.get("/dashboard", ctrl.getDashboard);

// ── Appointments ───────────────────────────────────────────────────────────
router.get("/appointments",       ctrl.getAppointments);
router.get("/appointments/today", ctrl.getTodayAppointments);
router.patch("/appointments/:id/status", ctrl.updateAppointmentStatus);

// ── Patients ───────────────────────────────────────────────────────────────
router.get("/patients",        ctrl.listPatients);      // ?q=search
router.get("/my-patients",     ctrl.getMyPatients);     // only this doctor's patients
router.get("/patients/:id",    ctrl.getPatient);        // full patient record

// ── Vitals ─────────────────────────────────────────────────────────────────
router.put("/patients/:id/vitals", ctrl.updateVitals);

// ── Prescriptions ──────────────────────────────────────────────────────────
router.post("/prescriptions",              ctrl.writePrescription);
router.get ("/prescriptions/:patientId",   ctrl.getPatientPrescriptions);

// ── Clinical Notes ─────────────────────────────────────────────────────────
router.post("/notes",                ctrl.addClinicalNote);
router.get ("/notes/:patientId",     ctrl.getPatientNotes);

// ── Report Upload ──────────────────────────────────────────────────────────
router.post("/reports", upload.single("file"), ctrl.uploadReport);

module.exports = router;
