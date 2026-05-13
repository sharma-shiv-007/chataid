// Backend/models/prescription.js
const mongoose = require("mongoose");

const medicationSchema = new mongoose.Schema({
  name:         { type: String, default: "" },
  dose:         { type: String, default: "" },
  frequency:    { type: String, default: "" },
  duration:     { type: String, default: "" },
  instructions: { type: String, default: "" },
});

const prescriptionSchema = new mongoose.Schema({
  patientId:     { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  doctorId:      { type: mongoose.Schema.Types.ObjectId, ref: "Doctor",  required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" }, // optional

  // ── Medications array (replaces single drug fields) ────────────
  medications:   { type: [medicationSchema], default: [] },

  // ── Keep old single-drug fields for backward compatibility ─────
  drugName:      { type: String, default: "" },
  dose:          { type: String, default: "" },
  frequency:     { type: String, default: "" },
  duration:      { type: String, default: "" },
  instructions:  { type: String, default: "" },

  diagnosis:     { type: String, default: "" },
  advice:        { type: String, default: "" },
  followUpRemark:{ type: String, default: "" },
  followUpDate:  { type: Date },
  issuedAt:      { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.models.Prescription ||
  mongoose.model("Prescription", prescriptionSchema);
