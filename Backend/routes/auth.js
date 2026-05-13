// Backend/routes/auth.js
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/authController");
const auth    = require("../middleware/auth");
const allow   = require("../middleware/roleGuard");

router.post("/signup/patient", ctrl.signupPatient);
router.post("/signup/doctor",  auth, allow("admin"), ctrl.signupDoctor);
router.post("/signup/nurse",   auth, allow("admin"), ctrl.signupNurse);
router.post("/signup/admin",   ctrl.signupAdmin);
router.post("/register",       ctrl.signupPatient);  // alias
router.post("/login",          ctrl.login);
router.post("/google",         ctrl.googleAuth);     // Google OAuth
router.post("/forgot-password", ctrl.forgotPassword);
router.post("/reset-password",  ctrl.resetPassword);
router.get( "/me",  auth,      ctrl.getMe);

module.exports = router;
