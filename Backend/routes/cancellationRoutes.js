const express = require("express");
const auth = require("../middleware/auth");
const allow = require("../middleware/roleGuard");
const ctrl = require("../controllers/cancellationController");

const router = express.Router();

router.patch("/doctor-cancel/:appointmentId", auth, allow("doctor"), ctrl.doctorCancelAppointment);
router.patch("/patient-choice/:appointmentId", auth, allow("patient"), ctrl.patientChoice);
router.patch("/admin-refund/:appointmentId", auth, allow("admin"), ctrl.adminApproveRefund);
router.patch("/admin-reschedule/:appointmentId", auth, allow("admin"), ctrl.adminApproveReschedule);
router.get("/cancelled", auth, allow("admin"), ctrl.getCancelledAppointments);
router.get("/wallet", auth, allow("patient"), ctrl.getWallet);
router.post("/wallet/deduct", auth, allow("patient"), ctrl.deductWallet);

module.exports = router;
