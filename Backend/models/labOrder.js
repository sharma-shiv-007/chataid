const mongoose = require("mongoose");

const labResultSchema = new mongoose.Schema({
  testName:    { type: String, required: true },
  value:       { type: String, default: "" },
  unit:        { type: String, default: "" },
  normalRange: { type: String, default: "" },
  flag:        { type: String, enum: ["normal", "low", "high", "critical", ""], default: "" },
  values:      { type: String, default: "" },
}, { _id: false });

const labOrderSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  doctorId:  { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  tests:     { type: [String], required: true },
  department:{ type: String, default: "" },
  priority:  { type: String, enum: ["Normal", "Urgent"], default: "Normal" },
  notes:     { type: String, default: "" },
  status:    { type: String, enum: ["pending", "in_progress", "completed", "cancelled"], default: "pending" },
  results:   { type: [labResultSchema], default: [] },
  resultPdfUrl: { type: String, default: "" },
  completedAt:  { type: Date },
}, { timestamps: true });

labOrderSchema.index({ status: 1, createdAt: -1 });
labOrderSchema.index({ patientId: 1, createdAt: -1 });
labOrderSchema.index({ doctorId: 1, createdAt: -1 });

module.exports = mongoose.models.LabOrder || mongoose.model("LabOrder", labOrderSchema);
