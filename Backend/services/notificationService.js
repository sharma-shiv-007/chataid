// backend/services/notificationService.js
const Notification = require("../models/notification");

const NOTIF_TITLES = {
  appt_booked:         "Appointment Booked",
  appt_confirmed:      "Appointment Confirmed",
  appt_cancelled:      "Appointment Cancelled",
  appt_completed:      "Appointment Completed",
  vitals_updated:      "Vitals Updated",
  nurse_vitals_checked:"Vitals Checked",
  prescription_issued: "Prescription Issued",
  clinical_note_added: "Clinical Note Added",
  emergency_raised:    "Emergency Alert",
  report_uploaded:     "Report Uploaded",
  lab_result_ready:    "Lab Result Ready",
  reminder:            "Reminder",
  cancellation:         "Appointment Cancelled",
  patient_choice:       "Patient Response",
  refund:               "Refund Update",
  reschedule:           "Appointment Rescheduled",
  general:             "Notification",
};

const createNotif = async (userId, userRole, type, message, link = "") => {
  try {
    await Notification.create({
      userId,
      userRole,
      type,
      title:   NOTIF_TITLES[type] || "Notification",
      message,
      link,
    });
  } catch (err) {
    console.error("createNotif error:", err.message);
  }
};

module.exports = { createNotif };
