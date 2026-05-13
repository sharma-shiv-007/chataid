// Backend/routes/patient.js  ── complete drop-in replacement
const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const ctrl    = require("../controllers/patientController");

// All patient routes require a valid JWT
router.use(auth);

router.get("/me",            ctrl.getMe);             // GET  /api/patient/me
router.get("/dashboard",     ctrl.getDashboard);      // GET  /api/patient/dashboard
router.put("/profile",       ctrl.updateProfile);     // PUT  /api/patient/profile
router.patch("/profile",     ctrl.updateProfile);     // PATCH /api/patient/profile (alias)

// Doctor-written data visible to patient
router.get("/prescriptions", ctrl.getMyPrescriptions); // GET /api/patient/prescriptions
router.get("/notes",         ctrl.getMyNotes);         // GET /api/patient/notes
router.get("/reports",       ctrl.getMyReports);       // GET /api/patient/reports
router.get("/appointments",  ctrl.getMyAppointments);  // GET /api/patient/appointments

module.exports = router;