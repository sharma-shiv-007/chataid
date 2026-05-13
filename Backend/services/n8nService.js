// backend/services/n8nService.js
const N8N_BASE = process.env.N8N_URL || "http://localhost:5678";

const WEBHOOKS = {
  book:       `${N8N_BASE}/webhook/patient-intake`,
  cancel:     `${N8N_BASE}/webhook/appointment-action`,
  reschedule: `${N8N_BASE}/webhook/do-reschedule`,
};

// Fire and forget; never block the main appointment response.
async function fireWebhook(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[n8n] Webhook failed [${url}] status=${res.status}:`, text);
      return;
    }

    console.log(`[n8n] Webhook OK [${url}]`);
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn(`[n8n] Webhook timed out after 5s. Is n8n running at ${N8N_BASE}?`);
      return;
    }

    console.warn(`[n8n] Webhook error [${url}]:`, err.message);
  } finally {
    clearTimeout(timeout);
  }
}

async function fireWebhookAndReturn(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[n8n] Book webhook failed [${url}] status=${res.status}:`, text);
      return null;
    }

    const data = await res.json().catch(() => null);
    console.log("[n8n] Book webhook response:", data);
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn(`[n8n] Book webhook timed out after 8s. Is n8n running at ${N8N_BASE}?`);
      return null;
    }

    console.warn("[n8n] Book webhook error:", err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Book appointment -> Google Calendar event created.
exports.notifyBooked = async (appointment, patient, doctor) => {
  const start = new Date(`${appointment.dateKey}T${appointment.time}:00`);
  const end   = new Date(start.getTime() + 30 * 60000);
  const patientName = patient?.name || appointment.patientName || "Patient";
  const doctorName = doctor?.name || appointment.doctorName || "Doctor";

  const payload = {
    action: "book",

    fullName: patientName,
    email:    patient?.email || "",
    contact:  patient?.phone || appointment.phone || "",
    age:      patient?.age || appointment.age || "",
    aadhaar:  patient?.aadhaar || "",

    bookingId:  appointment._id.toString(),
    doctor:     doctorName,
    hospital:   appointment.hospitalName || doctor?.hospital || "",
    department: appointment.specialty || doctor?.specialisation || "General",
    symptoms:   (appointment.symptoms || []).join(", ") || appointment.chiefComplaint || appointment.notes || "",
    symptomDays: "",

    preferredDate: appointment.dateKey,
    start:         start.toISOString(),
    end:           end.toISOString(),

    eventTitle:       `Appointment: ${patientName} with ${doctorName}`,
    eventDescription: `Patient: ${patientName}\nReason: ${appointment.notes || appointment.chiefComplaint || ""}\nContact: ${patient?.phone || appointment.phone || ""}`,
  };

  console.log("[n8n] Firing book webhook:", payload.bookingId);
  return fireWebhookAndReturn(WEBHOOKS.book, payload);
};

// Cancel appointment -> Google Calendar event deleted.
exports.notifyCancelled = (appointment, patient) => {
  const payload = {
    action:          "cancel",
    bookingId:       appointment._id.toString(),
    calendarEventId: appointment.calendarEventId || "",
    name:            patient?.name || appointment.patientName || "",
    email:           patient?.email || "",
  };

  console.log("[n8n] Firing cancel webhook:", payload.bookingId, "eventId:", payload.calendarEventId);
  fireWebhook(WEBHOOKS.cancel, payload);
};

// Reschedule -> old event deleted + new event created.
exports.notifyRescheduled = (appointment, patient, doctor, newDate, newTime) => {
  const start = new Date(`${newDate}T${newTime}:00`);
  const end   = new Date(start.getTime() + 30 * 60000);
  const patientName = patient?.name || appointment.patientName || "Patient";
  const doctorName = doctor?.name || appointment.doctorName || "Doctor";

  const payload = {
    action: "reschedule",

    bookingId:     appointment._id.toString(),
    fullName:      patientName,
    email:         patient?.email || "",
    contact:       patient?.phone || appointment.phone || "",
    age:           patient?.age || "",
    hospital:      doctor?.hospital || "",
    department:    doctor?.specialisation || appointment.specialty || "General",
    symptoms:      (appointment.symptoms || []).join(", ") || appointment.notes || "",
    doctor:        doctorName,
    start:         start.toISOString(),
    end:           end.toISOString(),
    preferredDate: newDate,
    eventTitle:    `Rescheduled: ${patientName} with ${doctorName}`,
  };

  console.log("[n8n] Firing reschedule webhook:", payload.bookingId);
  fireWebhook(WEBHOOKS.reschedule, payload);
};
