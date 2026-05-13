// backend/controllers/reportController.js
const Report          = require("../models/report");
const catchAsync      = require("../utils/catchAsync");
const { createNotif } = require("../services/notificationService");

// POST /api/reports
exports.upload = catchAsync(async (req, res) => {
  const { patientId, type, title, description, fileUrl, fileType, date } = req.body;

  const report = await Report.create({
    patientId,
    uploadedBy:  req.user.id,
    type:        type || "other",
    title:       title || "",
    description: description || "",
    fileUrl:     fileUrl || "",
    fileType:    fileType || "pdf",
    date:        date ? new Date(date) : new Date(),
  });

  await createNotif(
    patientId, "Patient", "report_uploaded",
    `A new ${type || "report"} has been uploaded for you.`,
    `/reports/${report._id}`
  );

  res.status(201).json({ report });
});

// GET /api/reports/patient/:id
exports.getForPatient = catchAsync(async (req, res) => {
  const reports = await Report.find({ patientId: req.params.id })
    .sort({ createdAt: -1 });
  res.json({ reports });
});

// GET /api/reports/my
exports.getMine = catchAsync(async (req, res) => {
  const reports = await Report.find({ patientId: req.user.id })
    .sort({ createdAt: -1 });
  res.json({ reports });
});