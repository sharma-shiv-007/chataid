const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const allow   = require("../middleware/roleGuard");
const ctrl    = require("../controllers/adminController");

router.use(auth, allow("admin"));

router.get("/patients",                   ctrl.listPatients);
router.get("/patients/:id",              ctrl.getPatient);
router.patch("/patients/:id/deactivate", ctrl.toggleDeactivate);

module.exports = router;
