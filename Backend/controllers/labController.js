const LabOrder = require("../models/labOrder");
const Patient = require("../models/patient");
const Doctor = require("../models/doctor");
const { createNotif } = require("../services/notificationService");
const { generateLabReportPdf, generateLabReportPdfBuffer } = require("../services/labReportPdfService");

const autoFlag = (value, normalRange) => {
  const num = parseFloat(value);
  if (isNaN(num) || !normalRange) return "";
  const rangeMatch = normalRange.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (num < min) return "low";
    if (num > max) return "high";
    return "normal";
  }
  const ltMatch = normalRange.match(/^[<≤]([\d.]+)$/);
  if (ltMatch) return num <= parseFloat(ltMatch[1]) ? "normal" : "high";
  const gtMatch = normalRange.match(/^[>≥]([\d.]+)$/);
  if (gtMatch) return num >= parseFloat(gtMatch[1]) ? "normal" : "low";
  return "";
};

exports.createOrder = async (req, res) => {
  try {
    const { patientId, tests, priority = "Normal", notes = "" } = req.body;

    if (!patientId) return res.status(400).json({ error: "patientId is required." });
    if (!Array.isArray(tests) || tests.length === 0) {
      return res.status(400).json({ error: "Choose at least one lab test." });
    }
    if (!["Normal", "Urgent"].includes(priority)) {
      return res.status(400).json({ error: "priority must be Normal or Urgent." });
    }

    const [patient, doctor] = await Promise.all([
      Patient.findById(patientId).select("name"),
      Doctor.findById(req.user.id).select("name specialisation"),
    ]);
    if (!patient) return res.status(404).json({ error: "Patient not found." });
    if (!doctor) return res.status(404).json({ error: "Doctor not found." });

    const order = await LabOrder.create({
      patientId,
      doctorId: req.user.id,
      tests: tests.map(t => String(t).trim()).filter(Boolean),
      department: doctor.specialisation || "General",
      priority,
      notes: String(notes || "").trim(),
    });

    const populated = await LabOrder.findById(order._id)
      .populate("patientId", "name email phone age gender")
      .populate("doctorId", "name email specialisation");

    res.status(201).json({ order: populated });
  } catch (err) {
    console.error("createLabOrder:", err);
    res.status(500).json({ error: "Could not create lab order." });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { status, date, department } = req.query;
    const filter = {};
    if (status) {
      const statuses = String(status).split(",").map(s => s.trim()).filter(Boolean);
      filter.status = { $in: statuses };
    }
    if (department) filter.department = new RegExp(String(department), "i");
    if (date) {
      filter.createdAt = {
        $gte: new Date(`${date}T00:00:00.000Z`),
        $lte: new Date(`${date}T23:59:59.999Z`),
      };
    }

    const orders = await LabOrder.find(filter)
      .populate("patientId", "name email phone age gender")
      .populate("doctorId", "name email specialisation")
      .sort({ priority: -1, createdAt: -1 })
      .limit(200);

    res.json({ orders });
  } catch (err) {
    console.error("getLabOrders:", err);
    res.status(500).json({ error: "Could not load lab orders." });
  }
};

exports.getMyBills = async (req, res) => {
  try {
    const bills = await LabOrder.find({ patientId: req.user.id })
      .populate("patientId", "name email phone age gender")
      .populate("doctorId", "name email specialisation")
      .sort({ createdAt: -1 });

    res.json({ bills });
  } catch (err) {
    console.error("getMyLabBills:", err);
    res.status(500).json({ error: "Could not load lab bills." });
  }
};

exports.payBill = async (req, res) => {
  try {
    const { method = "online" } = req.body;
    const paymentStatus = method === "cash" ? "cash_paid" : "paid_online";
    const paymentMethod = method === "cash" ? "cash" : "online";

    const order = await LabOrder.findOneAndUpdate(
      { _id: req.params.id, patientId: req.user.id },
      { paymentStatus, paymentMethod, paidAt: new Date() },
      { new: true }
    )
      .populate("patientId", "name email phone age gender")
      .populate("doctorId", "name email specialisation");

    if (!order) return res.status(404).json({ error: "Lab bill not found." });

    res.json({ bill: order });
  } catch (err) {
    console.error("payLabBill:", err);
    res.status(500).json({ error: "Could not update lab bill payment." });
  }
};

exports.saveResults = async (req, res) => {
  try {
    const { id } = req.params;
    const rawResults = req.body.results || "[]";
    let results = [];

    try {
      results = typeof rawResults === "string" ? JSON.parse(rawResults) : rawResults;
    } catch {
      return res.status(400).json({ error: "results must be valid JSON." });
    }

    const order = await LabOrder.findById(id);
    if (!order) return res.status(404).json({ error: "Lab order not found." });

    order.results = Array.isArray(results)
      ? results.map(result => ({
          testName: String(result.testName || "").trim(),
          value: String(result.value || "").trim(),
          unit: String(result.unit || "").trim(),
          normalRange: String(result.normalRange || "").trim(),
          flag: ["normal", "low", "high", "critical"].includes(result.flag)
            ? result.flag
            : autoFlag(result.value, result.normalRange),
          values: String(result.values || "").trim(),
        })).filter(result => result.testName)
      : [];
    order.status = "in_progress";

    if (req.file) {
      order.resultPdfUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    }

    await order.save();

    const populated = await LabOrder.findById(order._id)
      .populate("patientId", "name email phone age gender")
      .populate("doctorId", "name email specialisation");

    res.json({ order: populated });
  } catch (err) {
    console.error("saveLabResults:", err);
    res.status(500).json({ error: "Could not save lab results." });
  }
};

exports.markComplete = async (req, res) => {
  try {
    let order = await LabOrder.findById(req.params.id)
      .populate("patientId", "name email phone age gender")
      .populate("doctorId", "name email specialisation specialization hospital");

    if (!order) return res.status(404).json({ error: "Lab order not found." });

    order.status = "completed";
    order.completedAt = new Date();

    order.resultPdfUrl = `generated:${order._id}`;
    await order.save();

    order = await LabOrder.findById(order._id)
      .populate("patientId", "name email phone age gender")
      .populate("doctorId", "name email specialisation specialization hospital");

    await Promise.all([
      createNotif(
        order.patientId._id,
        "Patient",
        "lab_result_ready",
        `Your lab results are ready for ${order.tests.join(", ")}.`,
        "/lab/reports"
      ),
      createNotif(
        order.doctorId._id,
        "Doctor",
        "lab_result_ready",
        `Lab results are ready for ${order.patientId.name}: ${order.tests.join(", ")}.`,
        "/lab/doctor-reports"
      ),
    ]);

    res.json({ order });
  } catch (err) {
    console.error("completeLabOrder:", err);
    res.status(500).json({ error: "Could not complete lab order." });
  }
};

exports.streamReportPdf = async (req, res) => {
  try {
    const order = await LabOrder.findById(req.params.id)
      .populate("patientId", "name email phone age gender")
      .populate("doctorId", "name email specialisation specialization hospital");

    if (!order || order.status !== "completed")
      return res.status(404).json({ error: "Report not found." });

    const buffer = generateLabReportPdfBuffer(order);
    const filename = `lab-report-${order._id}.pdf`;
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    res.send(buffer);
  } catch (err) {
    console.error("streamReportPdf:", err);
    res.status(500).json({ error: "Could not generate report PDF." });
  }
};

exports.getDoctorReports = async (req, res) => {
  try {
    const reports = await LabOrder.find({
      doctorId: req.user.id,
      status: "completed",
    })
      .populate("patientId", "name email phone age gender")
      .populate("doctorId", "name email specialisation")
      .sort({ completedAt: -1, updatedAt: -1 });

    res.json({ reports });
  } catch (err) {
    console.error("getDoctorLabReports:", err);
    res.status(500).json({ error: "Could not load lab reports." });
  }
};

exports.getMyReports = async (req, res) => {
  try {
    const reports = await LabOrder.find({
      patientId: req.user.id,
      status: "completed",
    })
      .populate("patientId", "name email phone age gender")
      .populate("doctorId", "name email specialisation")
      .sort({ completedAt: -1, updatedAt: -1 });

    res.json({ reports });
  } catch (err) {
    console.error("getMyLabReports:", err);
    res.status(500).json({ error: "Could not load lab reports." });
  }
};

exports.getAdminStats = async (req, res) => {
  try {
    const { date, department } = req.query;
    const base = {};
    if (department) base.department = new RegExp(String(department), "i");
    if (date) {
      base.createdAt = {
        $gte: new Date(`${date}T00:00:00.000Z`),
        $lte: new Date(`${date}T23:59:59.999Z`),
      };
    }

    const [total, pending, completed, urgent, departments] = await Promise.all([
      LabOrder.countDocuments(base),
      LabOrder.countDocuments({ ...base, status: "pending" }),
      LabOrder.countDocuments({ ...base, status: "completed" }),
      LabOrder.countDocuments({ ...base, priority: "Urgent" }),
      LabOrder.distinct("department", base),
    ]);

    res.json({
      stats: { total, pending, completed, urgent },
      departments: departments.filter(Boolean).sort(),
    });
  } catch (err) {
    console.error("getLabAdminStats:", err);
    res.status(500).json({ error: "Could not load lab stats." });
  }
};
