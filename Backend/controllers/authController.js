// Backend/controllers/authController.js
const jwt     = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const Patient = require("../models/patient");
const Doctor  = require("../models/doctor");
const Admin   = require("../models/admin");
const Nurse   = require("../models/nurse");

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── POST /api/auth/signup/patient ─────────────────────────────────────────────
exports.signupPatient = async (req, res) => {
  try {
    const name = req.body.fullName || req.body.name;
    const { email, password, age, gender, phone, dob, blood,
            symptoms, symptomsSince, conditions, allergies, medications } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email and password are required." });
    const exists = await Patient.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: "Email already registered." });
    const patient = await Patient.create({
      name, email, password,
      age: age || null, gender: gender || "", phone: phone || "",
      dob: dob || "", blood: blood || "",
      symptoms:      Array.isArray(symptoms)    ? symptoms    : symptoms    ? [symptoms]    : [],
      symptomsSince: symptomsSince || "",
      conditions:    Array.isArray(conditions)  ? conditions  : conditions  ? [conditions]  : [],
      allergies:     Array.isArray(allergies)   ? allergies   : allergies   ? [allergies]   : [],
      medications:   Array.isArray(medications) ? medications : medications ? [medications] : [],
    });
    const token = signToken(patient._id, "patient");
    return res.status(201).json({ token, user: patient.toSafeObject() });
  } catch (err) {
    console.error("signupPatient error:", err);
    return res.status(500).json({ error: "Registration failed. Please try again." });
  }
};

// ── POST /api/auth/signup/doctor ──────────────────────────────────────────────
exports.signupDoctor = async (req, res) => {
  try {
    const name = req.body.name || req.body.fullName;
    const { email, password, specialisation, hospital, phone } = req.body;
    const medRegNo = (req.body.medRegNo || req.body.regNo || `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`).trim();

    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email and password are required." });
    const exists = await Doctor.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: "Email already registered." });
    const regExists = await Doctor.findOne({ medRegNo });
    if (regExists) return res.status(409).json({ error: "Medical registration number already registered." });

    const doctor = await Doctor.create({ name, email, password, specialisation, hospital, phone, medRegNo });
    const token  = signToken(doctor._id, "doctor");
    return res.status(201).json({ token, user: doctor.toSafeObject() });
  } catch (err) {
    console.error("signupDoctor error:", err);
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Doctor email or registration number already exists." });
    }
    return res.status(500).json({ error: err.message || "Registration failed." });
  }
};

// ── POST /api/auth/signup/admin ───────────────────────────────────────────────
exports.signupNurse = async (req, res) => {
  try {
    const name = req.body.name || req.body.fullName;
    const { email, password, phone, hospital } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required." });
    }

    const lowerEmail = email.toLowerCase();
    const matches = await Promise.all([
      Patient.findOne({ email: lowerEmail }),
      Doctor.findOne({ email: lowerEmail }),
      Admin.findOne({ email: lowerEmail }),
      Nurse.findOne({ email: lowerEmail }),
    ]);
    if (matches.some(Boolean)) return res.status(409).json({ error: "Email already registered." });

    const nurse = await Nurse.create({ name, email: lowerEmail, password, phone, hospital });
    const token = signToken(nurse._id, "nurse");
    return res.status(201).json({ token, user: nurse.toSafeObject() });
  } catch (err) {
    console.error("signupNurse error:", err);
    return res.status(500).json({ error: err.message || "Registration failed." });
  }
};

exports.signupAdmin = async (req, res) => {
  try {
    const { name, email, password, hospitalId } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email and password are required." });
    const exists = await Admin.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: "Email already registered." });
    const admin = await Admin.create({ name, email, password, hospitalId: hospitalId || "" });
    const token = signToken(admin._id, "admin");
    return res.status(201).json({ token, user: admin.toSafeObject() });
  } catch (err) {
    console.error("signupAdmin error:", err);
    return res.status(500).json({ error: "Registration failed." });
  }
};

// ── POST /api/auth/login — Patient → Doctor → Admin ──────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required." });

    let user = null;
    let role = "patient";

    user = await Patient.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      user = await Doctor.findOne({ email: email.toLowerCase() }).select("+password");
      if (user) role = "doctor";
    }
    if (!user) {
      user = await Nurse.findOne({ email: email.toLowerCase() }).select("+password");
      if (user) role = "nurse";
    }
    if (!user) {
      user = await Admin.findOne({ email: email.toLowerCase() }).select("+password");
      if (user) role = "admin";
    }
    if (!user) return res.status(401).json({ error: "Invalid email or password." });

    const ok = await user.comparePassword(password);
    if (!ok)  return res.status(401).json({ error: "Invalid email or password." });

    const token = signToken(user._id, role);
    return res.json({
      token,
      user: user.toSafeObject ? user.toSafeObject() : { id: user._id, name: user.name, email: user.email, role },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Login failed." });
  }
};

// ── POST /api/auth/google ─────────────────────────────────────────────────────
// Frontend sends the Google ID token. We verify it, then:
//   1. Check if email exists in Admin → Doctor → Patient
//   2. If found: log them in with correct role
//   3. If not found: auto-create as Patient (Google signup)
exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ error: "Google credential required." });

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { name, email, picture } = payload;

    if (!email)
      return res.status(400).json({ error: "Could not retrieve email from Google." });

    const lowerEmail = email.toLowerCase();

    // Check collections in priority order: Admin → Doctor → Patient
    let user = await Admin.findOne({ email: lowerEmail });
    let role = "admin";

    if (!user) {
      user = await Doctor.findOne({ email: lowerEmail });
      role = "doctor";
    }
    if (!user) {
      user = await Nurse.findOne({ email: lowerEmail });
      role = "nurse";
    }
    if (!user) {
      user = await Patient.findOne({ email: lowerEmail });
      role = "patient";
    }

    // Not found anywhere — auto-register as patient
    if (!user) {
      role = "patient";
      user = await Patient.create({
        name:  name || email.split("@")[0],
        email: lowerEmail,
        password: `google_${Date.now()}_${Math.random()}`, // random, can't be used to login with password
        googleAuth: true,
      });
    }

    const token = signToken(user._id, role);
    const safeUser = user.toSafeObject
      ? { ...user.toSafeObject(), role }
      : { id: user._id, name: user.name, email: user.email, role, hospitalId: user.hospitalId };

    // Add photo from Google if available
    if (picture) safeUser.photo = picture;

    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error("googleAuth error:", err);
    return res.status(401).json({ error: "Google authentication failed. Please try again." });
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const safeUser = req.user.data.toSafeObject
      ? req.user.data.toSafeObject()
      : { ...(req.user.data.toObject ? req.user.data.toObject() : req.user.data) };
    const responseUser = { ...safeUser, role: req.user.role };
    delete responseUser.password;
    res.json({ user: responseUser });
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({ error: "Could not fetch user." });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const lowerEmail = email.toLowerCase();

    // Find user in any collection
    let user = await Patient.findOne({ email: lowerEmail }).select("+password");
    if (!user) user = await Doctor.findOne({ email: lowerEmail }).select("+password");
    if (!user) user = await Nurse.findOne({ email: lowerEmail }).select("+password");
    if (!user) user = await Admin.findOne({ email: lowerEmail }).select("+password");

    // Always return success (don't reveal if email exists)
    if (!user) {
      return res.json({ message: "If this email exists, a reset link has been sent." });
    }

    // Generate a reset token (valid 1 hour)
    const resetToken = jwt.sign(
      { id: user._id, email: lowerEmail },
      process.env.JWT_SECRET + user.password, // invalidates if password changes
      { expiresIn: "1h" }
    );

    // In production: send email via nodemailer/sendgrid
    // For now: return token directly (dev mode)
    const resetLink = `http://localhost:8080/reset-password?token=${resetToken}&email=${lowerEmail}`;

    console.log("Password reset link:", resetLink); // visible in terminal

    return res.json({
      message: "If this email exists, a reset link has been sent.",
      // Remove devLink in production:
      devLink: resetLink,
    });
  } catch (err) {
    console.error("forgotPassword error:", err);
    res.status(500).json({ error: "Could not process request." });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword)
      return res.status(400).json({ error: "Email, token and new password are required." });
    if (newPassword.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    const lowerEmail = email.toLowerCase();

    // Find user
    let user = await Patient.findOne({ email: lowerEmail }).select("+password");
    if (!user) user = await Doctor.findOne({ email: lowerEmail }).select("+password");
    if (!user) user = await Nurse.findOne({ email: lowerEmail }).select("+password");
    if (!user) user = await Admin.findOne({ email: lowerEmail }).select("+password");
    if (!user) return res.status(404).json({ error: "Invalid reset link." });

    // Verify token (signed with current password, so old links die after password change)
    try {
      jwt.verify(token, process.env.JWT_SECRET + user.password);
    } catch {
      return res.status(400).json({ error: "Reset link is invalid or has expired." });
    }

    // Hash manually (avoid full document validation on save)
    const bcrypt = require("bcryptjs");
    const hashed = await bcrypt.hash(newPassword, 12);

    await user.constructor.updateOne(
      { _id: user._id },
      { $set: { password: hashed } }
    );

    return res.json({ message: "Password reset successful. You can now log in." });
  } catch (err) {
    console.error("resetPassword error:", err);
    res.status(500).json({ error: "Could not reset password." });
  }
};
