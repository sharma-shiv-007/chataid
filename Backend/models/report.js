// Backend/models/report.js
const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  patientId:  {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "Patient",
    required: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  "Doctor",
  },
  type:        {
    type: String,
    enum: ["lab", "imaging", "ECG", "other"],
    default: "other",
  },
  title:       { type: String, default: "" },
  description: { type: String, default: "" },
  fileUrl:     { type: String, default: "" },   // Cloudinary / S3 URL
  fileType:    {
    type: String,
    enum: ["pdf", "jpg", "png", "other"],
    default: "pdf",
  },
  date:        { type: Date },                  // date of test
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.models.Report ||
  mongoose.model("Report", reportSchema);