// backend/services/n8nService.js
// Direct Google Calendar integration — no n8n required.
const { google } = require("googleapis");

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const TIMEZONE    = "Asia/Kolkata";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key     = process.env.GOOGLE_PRIVATE_KEY || "";

  // Normalize: replace literal \n with real newlines, strip surrounding quotes
  key = key.replace(/\\n/g, "\n").replace(/^["']|["']$/g, "").trim();

  if (!email || !key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY not set.");
  }

  return new google.auth.GoogleAuth({
    credentials: { type: "service_account", client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
}

function calendarClient() {
  return google.calendar({ version: "v3", auth: getAuth() });
}

async function createCalendarEvent(appointment, patient, doctor) {
  const start       = new Date(`${appointment.dateKey}T${appointment.time}:00`);
  const end         = new Date(start.getTime() + 30 * 60000);
  const patientName = patient?.name || appointment.patientName || "Patient";
  const doctorName  = doctor?.name  || appointment.doctorName  || "Doctor";

  const { data } = await calendarClient().events.insert({
    calendarId: CALENDAR_ID,
    resource: {
      summary:     `Appointment: ${patientName} with Dr. ${doctorName}`,
      description: `Patient: ${patientName}\nDoctor: Dr. ${doctorName}\nReason: ${appointment.notes || appointment.chiefComplaint || ""}\nContact: ${patient?.phone || appointment.phone || ""}`,
      start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
      end:   { dateTime: end.toISOString(),   timeZone: TIMEZONE },
    },
  });

  return data;
}

// Book appointment → create Google Calendar event
exports.notifyBooked = async (appointment, patient, doctor) => {
  try {
    const event = await createCalendarEvent(appointment, patient, doctor);
    console.log("[Calendar] Event created:", event.id);
    return { calendarEventId: event.id };
  } catch (err) {
    console.warn("[Calendar] Failed to create event:", err.message);
    return null;
  }
};

// Cancel appointment → delete Google Calendar event
exports.notifyCancelled = async (appointment) => {
  const eventId = appointment.calendarEventId;
  if (!eventId) return;
  try {
    await calendarClient().events.delete({ calendarId: CALENDAR_ID, eventId });
    console.log("[Calendar] Event deleted:", eventId);
  } catch (err) {
    console.warn("[Calendar] Failed to delete event:", err.message);
  }
};

// Reschedule → update existing Google Calendar event
exports.notifyRescheduled = async (appointment, patient, doctor, newDate, newTime) => {
  const eventId = appointment.calendarEventId;
  const updated = { ...appointment.toObject?.() ?? appointment, dateKey: newDate, time: newTime };

  try {
    if (eventId) {
      const start = new Date(`${newDate}T${newTime}:00`);
      const end   = new Date(start.getTime() + 30 * 60000);
      const patientName = patient?.name || appointment.patientName || "Patient";
      const doctorName  = doctor?.name  || appointment.doctorName  || "Doctor";

      const { data } = await calendarClient().events.update({
        calendarId: CALENDAR_ID,
        eventId,
        resource: {
          summary:     `Rescheduled: ${patientName} with Dr. ${doctorName}`,
          description: `Patient: ${patientName}\nDoctor: Dr. ${doctorName}\nContact: ${patient?.phone || appointment.phone || ""}`,
          start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
          end:   { dateTime: end.toISOString(),   timeZone: TIMEZONE },
        },
      });

      console.log("[Calendar] Event updated:", data.id);
      return { calendarEventId: data.id };
    } else {
      return await exports.notifyBooked(updated, patient, doctor);
    }
  } catch (err) {
    console.warn("[Calendar] Failed to update event:", err.message);
    return null;
  }
};
