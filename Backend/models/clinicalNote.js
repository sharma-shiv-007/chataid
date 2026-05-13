// Backend/models/clinicalNote.js
const mongoose = require("mongoose");

const clinicalNoteSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  doctorId:  { type: mongoose.Schema.Types.ObjectId, ref: "Doctor",  required: true },
  note:      { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("ClinicalNote", clinicalNoteSchema);