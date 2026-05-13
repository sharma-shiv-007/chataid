// Backend/models/doctorAvailability.js
const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema({
  time:   { type: String, required: true }, // "09:00", "09:30", etc.
  booked: { type: Boolean, default: false },
}, { _id: false });

const dayScheduleSchema = new mongoose.Schema({
  active:          { type: Boolean, default: false },
  slots:           { type: [slotSchema], default: [] },
  slotDurationMins:{ type: Number, default: 30 },
}, { _id: false });

const doctorAvailabilitySchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
    unique: true,
  },

  // Weekly recurring schedule
  weeklySchedule: {
    monday:    { type: dayScheduleSchema, default: () => ({}) },
    tuesday:   { type: dayScheduleSchema, default: () => ({}) },
    wednesday: { type: dayScheduleSchema, default: () => ({}) },
    thursday:  { type: dayScheduleSchema, default: () => ({}) },
    friday:    { type: dayScheduleSchema, default: () => ({}) },
    saturday:  { type: dayScheduleSchema, default: () => ({}) },
    sunday:    { type: dayScheduleSchema, default: () => ({}) },
  },

  // Specific dates the doctor has marked as leave  e.g. ["2025-06-20", "2025-07-04"]
  leaves: { type: [String], default: [] },

  // isAvailable: global toggle — doctor can go "on leave" instantly
  isAvailable: { type: Boolean, default: true },

}, { timestamps: true });

module.exports = mongoose.models.DoctorAvailability
  || mongoose.model("DoctorAvailability", doctorAvailabilitySchema);
