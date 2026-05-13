// Backend/middleware/auth.js
const jwt     = require("jsonwebtoken");
const Patient = require("../models/patient");
const Doctor  = require("../models/doctor");
const Nurse   = require("../models/nurse");
const Admin   = require("../models/admin");   // ← ADD THIS

module.exports = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided. Please log in." });
    }

    const token   = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user = null;
    if (decoded.role === "doctor") {
      user = await Doctor.findById(decoded.id).select("-password");
    } else if (decoded.role === "nurse") {
      user = await Nurse.findById(decoded.id).select("-password");
    } else if (decoded.role === "admin") {                              // ← ADD THIS
      user = await Admin.findById(decoded.id).select("-password");     // ← ADD THIS
    } else {
      user = await Patient.findById(decoded.id).select("-password");
    }

    if (!user) {
      return res.status(401).json({ error: "User no longer exists." });
    }

    req.user = { id: user._id, role: decoded.role, data: user };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
    return res.status(401).json({ error: "Invalid token. Please log in again." });
  }
};
