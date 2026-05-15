// Backend/models/patient.js
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const patientSchema = new mongoose.Schema({
  // ── Auth ─────────────────────────────────────────────────────────────────
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role:     { type: String, default: "patient" },
  uhid: {
    type: String,
    index: {
      unique: true,
      partialFilterExpression: { uhid: { $type: "string" } },
    },
  },

  // ── Personal ──────────────────────────────────────────────────────────────
  age:              { type: Number },
  gender:           { type: String, default: "" },
  phone:            { type: String, default: "" },
  dob:              { type: String, default: "" },
  blood:            { type: String, default: "" },
  address:          { type: String, default: "" },
  city:             { type: String, default: "" },
  state:            { type: String, default: "" },
  aadhaar:          { type: String, default: "" },
  emergencyName:    { type: String, default: "" },
  emergencyContact: { type: String, default: "" },

  // ── Medical — stored as flexible mixed objects ─────────────────────────────
  conditions:    { type: mongoose.Schema.Types.Mixed, default: [] },
  allergies:     { type: mongoose.Schema.Types.Mixed, default: [] },
  medications:   { type: mongoose.Schema.Types.Mixed, default: [] },
  immunizations: { type: mongoose.Schema.Types.Mixed, default: [] },
  symptoms:      { type: [String], default: [] },
  symptomsSince: { type: String, default: "" },

  // ── Insurance (Step 3) ────────────────────────────────────────────────────
  insurance:         { type: String, default: "" },
  policyNo:          { type: String, default: "" },
  primaryDoctor:     { type: String, default: "" },
  preferredHospital: { type: String, default: "" },

  // ── Lifestyle (Step 4) ────────────────────────────────────────────────────
  smoker:        { type: String, default: "No" },
  alcohol:       { type: String, default: "No" },
  activityLevel: { type: String, default: "Moderate" },
  dietType:      { type: String, default: "" },
  occupation:    { type: String, default: "" },
  profileComplete: { type: Boolean, default: false },

  // ── Vitals (Doctor-updated) ───────────────────────────────────────────────
  vitals: {
    bloodPressure: { type: String,  default: "" },
    heartRate:     { type: Number,  default: null },
    temperature:   { type: Number,  default: null },
    status:        { type: String,  default: "" },
    updatedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    updatedByName: { type: String, default: "" },
    updatedByRole: { type: String, default: "" },
    nurseChecked:  { type: Boolean, default: false },
    checkedByNurse: { type: mongoose.Schema.Types.ObjectId, ref: "Nurse" },
    checkedByNurseName: { type: String, default: "" },
    checkedAt:     { type: Date },
    assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    updatedAt:     { type: Date },
  },
  notifications: [{
    type:      { type: String, default: "general" },
    title:     { type: String, default: "" },
    message:   { type: String, default: "" },
    doctorId:  { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    createdAt: { type: Date, default: Date.now },
    read:      { type: Boolean, default: false },
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { strict: false });   // strict:false lets any extra fields save without error

patientSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  this.updatedAt = new Date();
});

patientSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

patientSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.models.Patient || mongoose.model("Patient", patientSchema);
