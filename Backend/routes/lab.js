const router = require("express").Router();
const auth = require("../middleware/auth");
const allow = require("../middleware/roleGuard");
const upload = require("../middleware/upload");
const ctrl = require("../controllers/labController");

router.post("/orders", auth, allow("doctor"), ctrl.createOrder);
router.get("/reports", auth, allow("patient"), ctrl.getMyReports);
router.get("/doctor/reports", auth, allow("doctor"), ctrl.getDoctorReports);
router.get("/admin/stats", auth, allow("admin"), ctrl.getAdminStats);
router.get("/orders", auth, allow("admin", "nurse"), ctrl.getOrders);
router.patch("/orders/:id/results", auth, allow("admin", "nurse"), upload.single("resultPdf"), ctrl.saveResults);
router.patch("/orders/:id/complete", auth, allow("admin", "nurse"), ctrl.markComplete);

module.exports = router;
