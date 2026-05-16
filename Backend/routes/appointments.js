// backend/routes/appointments.js
const router = require("express").Router();
const ctrl   = require("../controllers/appointmentController");
const auth   = require("../middleware/auth");
const allow  = require("../middleware/roleGuard");

// Optional auth attaches req.user when a valid token is present, but allows guest bookings.
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
  } catch {
    // Continue as guest when the token is absent or invalid.
  }
  next();
};

router.get("/my",          auth, ctrl.getMyAppointments);
router.get("/doctor",      auth, allow("doctor"), ctrl.getDoctorAppointments);
router.get("/emergencies", auth, allow("doctor"), ctrl.getEmergencies);
router.get("/admin",       auth, allow("admin"), ctrl.getAdminAppointments);
router.post("/book",       auth, ctrl.bookAppointment);
router.post("/",           optionalAuth, ctrl.bookAppointment);
router.patch("/:id/status",auth, allow("doctor", "admin"), ctrl.updateStatus);
router.patch("/:id/reschedule", auth, ctrl.rescheduleAppointment);
router.delete("/:id",      auth, ctrl.cancelAppointment);

module.exports = router;
