const express = require("express");
const auth = require("../middleware/auth");
const allow = require("../middleware/roleGuard");
const ctrl = require("../controllers/nurseController");

const router = express.Router();

router.get("/", auth, allow("admin"), ctrl.getAdminNurses);
router.patch("/:nurseId",        auth, allow("admin"), ctrl.updateNurse);
router.delete("/:nurseId",       auth, allow("admin"), ctrl.deleteNurse);
router.patch("/:nurseId/assign", auth, allow("admin"), ctrl.assignNurse);
router.get("/my-appointments", auth, allow("nurse"), ctrl.getMyAppointments);
router.put("/patients/:patientId/vitals", auth, allow("nurse"), ctrl.updatePatientVitals);

module.exports = router;
