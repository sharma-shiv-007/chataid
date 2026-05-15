// Backend/models/appointment.js
const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  patientId:     { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
  doctorId:      { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  patient: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "Patient",
    required: function () {
      return this.bookedVia !== "emergency" && !this.patientName; // guests allowed when form details are present
    },
  },
  patientName:    { type: String, default: "" },
  doctor:         { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  doctorName:     { type: String, default: "" },
  specialty:      { type: String, default: "" },
  symptoms:       { type: [String], default: [] },
  urgency:        { type: String, enum: ["routine", "urgent", "emergency"], default: "routine" },
  appointmentType:{ type: String, enum: ["in-person", "video"], default: "in-person" },
  date:           { type: Date, required: true },
  dateKey:        { type: String, default: "" },
  time:           { type: String, required: true },
  notes:          { type: String, default: "" },
  status:         { type: String, enum: ["pending", "confirmed", "cancelled", "completed", "rescheduled", "no-show", "acknowledged"], default: "pending" },
  paymentStatus:  { type: String, enum: ["pending", "paid", "refunded", "refund_requested"], default: "pending" },
  paymentMethod:  { type: String, default: "" },
  consultationFee:{ type: Number, default: 0 },
  cancelledBy:    { type: String, enum: ["doctor", "patient", "admin", null], default: null },
  cancellationRemark: { type: String, default: "" },
  refundStatus:   { type: String, enum: ["none", "requested", "approved", "rejected"], default: "none" },
  patientChoice:  { type: String, enum: ["none", "refund", "reschedule"], default: "none" },
  rescheduleDate: { type: String, default: "" },
  rescheduleTime: { type: String, default: "" },
  bookedVia:      { type: String, enum: ["voice", "manual", "emergency"], default: "manual" },
  // Emergency-specific fields
  type:           { type: String, default: "" },
  priority:       { type: String, default: "" },
  severity:       { type: String, default: "" },
  aiSeverityScore:{ type: Number, default: 0 },
  chiefComplaint: { type: String, default: "" },
  location:       { type: Object, default: null },
  hospitalName:   { type: String, default: "" },
  hospitalAddress:{ type: String, default: "" },
  hospitalPhone:  { type: String, default: "" },
  calendarEventId:{ type: String, default: "" },
  phone:          { type: String, default: "" },
  age:            { type: String, default: "" },
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      { type: Date, default: Date.now },
});

// Prevent double-booking active slots while allowing cancelled slots to be reused.
appointmentSchema.index(
  { doctorId: 1, dateKey: 1, time: 1 },
  {
    unique: true,
    partialFilterExpression: {
      doctorId: { $exists: true },
      status: { $in: ["pending", "confirmed"] },
    },
  }
);

module.exports = mongoose.models.Appointment ||
  mongoose.model("Appointment", appointmentSchema);
