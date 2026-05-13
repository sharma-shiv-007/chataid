// Backend/models/notification.js
const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
  "appt_booked",
  "appt_confirmed",
  "appt_cancelled",
  "appt_completed",
  "vitals_updated",
  "nurse_vitals_checked",
  "prescription_issued",
  "clinical_note_added",
  "emergency_raised",
  "report_uploaded",
  "lab_result_ready",
  "reminder",
  "cancellation",
  "patient_choice",
  "leave_request",
  "refund",
  "reschedule",
  "general",
];

const notificationSchema = new mongoose.Schema({
  userId:   {
    type:     mongoose.Schema.Types.ObjectId,
    required: true,
    refPath:  "userRole",             // dynamic ref based on role
  },
  userRole: {
    type: String,
    enum: ["Patient", "Doctor", "Admin"],
    required: true,
  },
  type: {
    type: String,
    enum: NOTIFICATION_TYPES,
    default: "general",
  },
  title:   { type: String, default: "" },
  message: { type: String, default: "" },
  isRead:  { type: Boolean, default: false },
  link:    { type: String, default: "" },   // deep-link e.g. "/appointments/123"
  createdAt: { type: Date, default: Date.now },
});

// Index for fast unread queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
