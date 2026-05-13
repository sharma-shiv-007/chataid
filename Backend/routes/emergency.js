// Backend/routes/emergency.js
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/emergencyController");

// Optional auth middleware — attaches req.user if token present, doesn't block if missing
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  try {
    const jwt     = require("jsonwebtoken");
    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    req.user = decoded;
  } catch {
    // invalid token — just continue as guest
  }
  next();
};

const strictAuth = require("../middleware/auth");

router.post("/classify", optionalAuth, ctrl.classifySeverity);  // POST /api/emergency/classify
router.post("/book",     optionalAuth, ctrl.bookEmergency);     // POST /api/emergency/book
router.get("/list",      strictAuth,   ctrl.listEmergencies);   // GET  /api/emergency/list (doctors)

module.exports = router;