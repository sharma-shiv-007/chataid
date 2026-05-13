// Backend/models/doctor.js
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const doctorSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  email:           { type: String, required: true, unique: true, lowercase: true },
  password:        { type: String, required: true, select: false },
  specialisation:  { type: String, default: "" },
  medRegNo:        { type: String, default: "" },
  hospital:        { type: String, default: "" },
  phone:           { type: String, default: "" },
  role:            { type: String, default: "doctor" },

  // ── Profile additions ──────────────────────────────────────────
  bio:             { type: String, default: "" },
  avatar:          { type: String, default: "" },        // Cloudinary URL
  consultationFee: { type: Number, default: 0 },
  rating:          { type: Number, default: 0 },
  reviewCount:     { type: Number, default: 0 },

  // ── Availability slots ─────────────────────────────────────────
  availability: [{
    day:       { type: String, default: "" },   // "Monday", "Tuesday" etc.
    startTime: { type: String, default: "" },   // "09:00"
    endTime:   { type: String, default: "" },   // "17:00"
    slotDurationMins: { type: Number, default: 30 },
  }],

  // ── Inline notifications (keep existing) ──────────────────────
  notifications: [{
    type:      { type: String, default: "general" },
    title:     { type: String, default: "" },
    message:   { type: String, default: "" },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
    createdAt: { type: Date, default: Date.now },
    read:      { type: Boolean, default: false },
  }],

  createdAt: { type: Date, default: Date.now },
});

doctorSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

doctorSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

doctorSchema.methods.toSafeObject = function () {
  return {
    id:              this._id,
    name:            this.name,
    email:           this.email,
    specialisation:  this.specialisation,
    medRegNo:        this.medRegNo,
    hospital:        this.hospital,
    phone:           this.phone,
    bio:             this.bio,
    avatar:          this.avatar,
    consultationFee: this.consultationFee,
    rating:          this.rating,
    reviewCount:     this.reviewCount,
    availability:    this.availability,
    role:            "doctor",
  };
};

module.exports = mongoose.models.Doctor || mongoose.model("Doctor", doctorSchema);