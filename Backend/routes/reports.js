// backend/routes/reports.js
const router = require("express").Router();
const ctrl   = require("../controllers/reportController");
const auth   = require("../middleware/auth");
const allow  = require("../middleware/roleGuard");

router.post("/",           auth, allow("doctor"), ctrl.upload);
router.get("/my",          auth, ctrl.getMine);
router.get("/patient/:id", auth, allow("doctor"), ctrl.getForPatient);

module.exports = router;