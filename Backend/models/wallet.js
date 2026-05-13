const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ["credit", "debit"], required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
  date: { type: Date, default: Date.now },
});

const walletSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
    unique: true,
  },
  balance: { type: Number, default: 0 },
  transactions: [transactionSchema],
}, { timestamps: true });

module.exports = mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);
