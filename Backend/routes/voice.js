// Backend/routes/voice.js
const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const ctrl    = require("../controllers/voiceBookingController");

router.post("/extract",       auth, ctrl.extractFromSpeech);   // POST /api/voice/extract
router.get("/slots",          auth, ctrl.getSlots);            // GET  /api/voice/slots?date=
router.post("/book",          auth, ctrl.bookAppointment);     // POST /api/voice/book
router.get("/appointments",   auth, ctrl.getMyAppointments);   // GET  /api/voice/appointments

module.exports = router;