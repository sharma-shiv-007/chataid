const mongoose = require("mongoose");

const TEST_PRICES = {
  CBC: 350,
  "Blood Sugar": 200,
  "Liver Function": 800,
  "Kidney Function": 750,
  "Lipid Profile": 900,
  "Thyroid Profile": 700,
  "Urine Routine": 250,
  HbA1c: 500,
  Electrolytes: 600,
  CRP: 650,
};

const labResultSchema = new mongoose.Schema({
  testName:    { type: String, required: true },
  value:       { type: String, default: "" },
  unit:        { type: String, default: "" },
  normalRange: { type: String, default: "" },
  flag:        { type: String, enum: ["normal", "low", "high", "critical", ""], default: "" },
  values:      { type: String, default: "" },
}, { _id: false });

const labOrderSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  doctorId:  { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  tests:     { type: [String], required: true },
  department:{ type: String, default: "" },
  priority:  { type: String, enum: ["Normal", "Urgent"], default: "Normal" },
  notes:     { type: String, default: "" },
  billItems: [{
    testName: { type: String, required: true },
    price:    { type: Number, default: 0 },
  }],
  billAmount:    { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ["unpaid", "paid_online", "cash_paid"], default: "unpaid" },
  paymentMethod: { type: String, default: "" },
  paidAt:        { type: Date },
  status:    { type: String, enum: ["pending", "in_progress", "completed", "cancelled"], default: "pending" },
  results:   { type: [labResultSchema], default: [] },
  resultPdfUrl: { type: String, default: "" },
  completedAt:  { type: Date },
}, { timestamps: true });

labOrderSchema.index({ status: 1, createdAt: -1 });
labOrderSchema.index({ patientId: 1, createdAt: -1 });
labOrderSchema.index({ doctorId: 1, createdAt: -1 });
labOrderSchema.index({ paymentStatus: 1, createdAt: -1 });

labOrderSchema.pre("validate", function buildBill() {
  if (!this.isModified("tests") && this.billItems?.length) return;

  const tests = Array.isArray(this.tests) ? this.tests : [];
  this.billItems = tests.map((testName) => ({
    testName,
    price: TEST_PRICES[testName] || 500,
  }));
  this.billAmount = this.billItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
});

module.exports = mongoose.models.LabOrder || mongoose.model("LabOrder", labOrderSchema);
module.exports.TEST_PRICES = TEST_PRICES;
