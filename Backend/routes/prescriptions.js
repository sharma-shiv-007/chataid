// backend/routes/prescriptions.js
const router = require("express").Router();
const ctrl   = require("../controllers/prescriptionController");
const auth   = require("../middleware/auth");
const allow  = require("../middleware/roleGuard");

router.post("/",              auth, allow("doctor"), ctrl.create);
router.get("/my",             auth, ctrl.getMine);
router.get("/patient/:id",    auth, allow("doctor"), ctrl.getForPatient);

module.exports = router;