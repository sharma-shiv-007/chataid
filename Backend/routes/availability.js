// Backend/routes/availability.js
const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const ctrl    = require("../controllers/availabilityController");

// Patient — no auth needed to browse doctors/slots
router.get("/doctors",         ctrl.getAvailableDoctors);  // GET /api/availability/doctors
router.get("/slots",           ctrl.getAvailableSlots);    // GET /api/availability/slots?doctorId=&date=

// Doctor — must be logged in
router.get   ("/me",           auth, ctrl.getMyAvailability);  // GET  /api/availability/me
router.put   ("/schedule",     auth, ctrl.setSchedule);        // PUT  /api/availability/schedule
router.patch ("/toggle",       auth, ctrl.toggleAvailability); // PATCH /api/availability/toggle
router.post  ("/leave",        auth, ctrl.addLeave);           // POST /api/availability/leave
router.delete("/leave/:date",  auth, ctrl.removeLeave);        // DELETE /api/availability/leave/:date

module.exports = router;
