const Appointment = require("../models/appointment");
const Wallet = require("../models/wallet");
const Notification = require("../models/notification");
const Admin = require("../models/admin");
const Patient = require("../models/patient");
const Doctor = require("../models/doctor");
const n8n = require("../services/n8nService");

const getPatientId = (appointment) =>
  appointment.patient?._id || appointment.patient || appointment.patientId?._id || appointment.patientId;

const getDoctorId = (appointment) =>
  appointment.doctor?._id || appointment.doctor || appointment.doctorId?._id || appointment.doctorId;

const getPatientName = (appointment) =>
  appointment.patient?.name || appointment.patientId?.name || appointment.patientName || "Patient";

const getDoctorName = (appointment) =>
  appointment.doctor?.name || appointment.doctorId?.name || appointment.doctorName || "Doctor";

const notify = async ({ userId, userRole, type, title, message, link = "" }) => {
  if (!userId) return;
  try {
    await Notification.create({ userId, userRole, type, title, message, link });
  } catch (err) {
    console.error("cancellation notify:", err.message);
  }
};

const notifyAdmins = async ({ type, title, message, link = "" }) => {
  const admins = await Admin.find({}).select("_id");
  await Promise.all(admins.map(admin => notify({
    userId: admin._id,
    userRole: "Admin",
    type,
    title,
    message,
    link,
  })));
};

const creditRefundToWallet = async (appointment, patientId) => {
  const amount = Number(appointment.consultationFee) || 0;
  let wallet = await Wallet.findOne({ patient: patientId });
  if (!wallet) wallet = new Wallet({ patient: patientId, balance: 0, transactions: [] });

  const alreadyCredited = wallet.transactions.some((transaction) =>
    transaction.type === "credit" &&
    String(transaction.appointmentId || "") === String(appointment._id)
  );

  if (!alreadyCredited && amount > 0) {
    wallet.balance += amount;
    wallet.transactions.push({
      type: "credit",
      amount,
      description: "Refund for cancelled appointment",
      appointmentId: appointment._id,
    });
    await wallet.save();
  }

  return wallet;
};

const findAppointment = (id) =>
  Appointment.findById(id)
    .populate("patient", "name email")
    .populate("patientId", "name email")
    .populate("doctor", "name specialisation specialization")
    .populate("doctorId", "name specialisation specialization");

exports.doctorCancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { remark } = req.body;

    if (!remark?.trim()) {
      return res.status(400).json({ error: "Cancellation remark is required." });
    }

    const appointment = await findAppointment(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found." });

    const doctorId = String(getDoctorId(appointment) || "");
    if (req.user?.role === "doctor" && doctorId && doctorId !== String(req.user.id)) {
      return res.status(403).json({ error: "Not authorized to cancel this appointment." });
    }

    appointment.status = "cancelled";
    appointment.cancelledBy = "doctor";
    appointment.cancellationRemark = remark.trim();
    appointment.updatedAt = new Date();

    if (appointment.paymentStatus === "paid") {
      appointment.paymentStatus = "refund_requested";
      appointment.refundStatus = "requested";
    }

    await appointment.save();

    const patientId = getPatientId(appointment);
    const message = `Dr. ${getDoctorName(appointment)} cancelled appointment for ${getPatientName(appointment)}. Reason: ${appointment.cancellationRemark}`;

    await notifyAdmins({
      type: "cancellation",
      title: "Doctor Cancelled Appointment",
      message,
      link: "/admin-dashboard",
    });

    await notify({
      userId: patientId,
      userRole: "Patient",
      type: "cancellation",
      title: "Appointment Cancelled by Doctor",
      message: `Your appointment was cancelled. Reason: ${appointment.cancellationRemark}. Please choose refund or reschedule from your dashboard.`,
      link: "/dashboard",
    });

    const patient = patientId ? await Patient.findById(patientId) : null;
    n8n.notifyCancelled(appointment, patient);

    res.json({ success: true, appointment, message: "Appointment cancelled successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not cancel appointment." });
  }
};

exports.patientChoice = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { choice, rescheduleDate, rescheduleTime } = req.body;

    if (!["refund", "reschedule"].includes(choice)) {
      return res.status(400).json({ error: "Choose refund or reschedule." });
    }

    if (choice === "reschedule" && (!rescheduleDate || !rescheduleTime)) {
      return res.status(400).json({ error: "New date and time are required." });
    }

    const appointment = await findAppointment(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found." });

    const patientId = getPatientId(appointment);
    if (String(patientId) !== String(req.user.id)) {
      return res.status(403).json({ error: "Not authorized for this appointment." });
    }

    appointment.patientChoice = choice;
    if (choice === "reschedule") {
      if (["paid", "refund_requested"].includes(appointment.paymentStatus)) {
        appointment.paymentStatus = "refund_requested";
      }
      if (appointment.refundStatus === "none") appointment.refundStatus = "requested";
      appointment.rescheduleDate = rescheduleDate;
      appointment.rescheduleTime = rescheduleTime;
    } else {
      const wasPaid = ["paid", "refund_requested"].includes(appointment.paymentStatus);
      appointment.paymentStatus = "refunded";
      appointment.refundStatus = "approved";
      await creditRefundToWallet(appointment, patientId);

      if (wasPaid) {
        await notify({
          userId: patientId,
          userRole: "Patient",
          type: "refund",
          title: "Refund Added to Wallet",
          message: `INR ${Number(appointment.consultationFee) || 0} has been refunded to your wallet.`,
          link: "/dashboard",
        });
      }
    }
    appointment.updatedAt = new Date();
    await appointment.save();

    await notifyAdmins({
      type: "patient_choice",
      title: `Patient chose ${choice === "refund" ? "Refund" : "Reschedule"}`,
      message: `${getPatientName(appointment)} chose ${choice} for their cancelled appointment with Dr. ${getDoctorName(appointment)}.${choice === "refund" ? " Refund was credited to the patient wallet." : ""}`,
      link: "/admin-dashboard",
    });

    res.json({ success: true, appointment, message: `${choice} request submitted.` });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not submit choice." });
  }
};

exports.adminApproveRefund = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const appointment = await findAppointment(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found." });

    const patientId = getPatientId(appointment);
    const amount = Number(appointment.consultationFee) || 0;

    const wallet = await creditRefundToWallet(appointment, patientId);

    appointment.paymentStatus = "refunded";
    appointment.refundStatus = "approved";
    appointment.updatedAt = new Date();
    await appointment.save();

    await notify({
      userId: patientId,
      userRole: "Patient",
      type: "refund",
      title: "Refund Approved",
      message: `INR ${amount} has been refunded to your wallet.`,
      link: "/dashboard",
    });

    res.json({ success: true, appointment, wallet, message: "Refund approved and wallet updated." });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not approve refund." });
  }
};

exports.adminApproveReschedule = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const appointment = await findAppointment(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found." });

    if (!appointment.rescheduleDate || !appointment.rescheduleTime) {
      return res.status(400).json({ error: "Patient has not selected a reschedule date and time." });
    }

    appointment.status = "confirmed";
    appointment.date = new Date(`${appointment.rescheduleDate}T00:00:00`);
    appointment.dateKey = appointment.rescheduleDate;
    appointment.time = appointment.rescheduleTime;
    appointment.patientChoice = "none";
    appointment.paymentStatus = "paid";
    appointment.refundStatus = "none";
    appointment.rescheduleDate = "";
    appointment.rescheduleTime = "";
    appointment.updatedAt = new Date();
    await appointment.save();

    const patientId = getPatientId(appointment);
    await notify({
      userId: patientId,
      userRole: "Patient",
      type: "reschedule",
      title: "Appointment Rescheduled",
      message: `Your appointment with Dr. ${getDoctorName(appointment)} has been rescheduled to ${appointment.dateKey} at ${appointment.time}.`,
      link: "/dashboard",
    });

    res.json({ success: true, appointment, message: "Appointment rescheduled successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not approve reschedule." });
  }
};

exports.getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ patient: req.user.id }).lean();
    res.json({ success: true, wallet: wallet || { balance: 0, transactions: [] } });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not fetch wallet." });
  }
};

exports.deductWallet = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const description = req.body.description || "Wallet payment";
    const appointmentId = req.body.appointmentId || undefined;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required." });
    }

    const wallet = await Wallet.findOne({ patient: req.user.id });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ error: "Insufficient wallet balance." });
    }

    wallet.balance -= amount;
    wallet.transactions.push({
      type: "debit",
      amount,
      description,
      appointmentId,
    });
    await wallet.save();

    res.json({ success: true, wallet, newBalance: wallet.balance });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not deduct wallet balance." });
  }
};

exports.getCancelledAppointments = async (_req, res) => {
  try {
    const appointments = await Appointment.find({
      status: "cancelled",
      cancelledBy: "doctor",
    })
      .populate("patient", "name email")
      .populate("patientId", "name email")
      .populate("doctor", "name specialisation specialization")
      .populate("doctorId", "name specialisation specialization")
      .sort({ updatedAt: -1, createdAt: -1 });

    res.json({ success: true, appointments });
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not fetch cancelled appointments." });
  }
};
