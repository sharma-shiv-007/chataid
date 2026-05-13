const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const nurseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  phone: { type: String, default: "" },
  hospital: { type: String, default: "" },
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
  role: { type: String, default: "nurse" },
  createdAt: { type: Date, default: Date.now },
});

nurseSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

nurseSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

nurseSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    hospital: this.hospital,
    assignedDoctor: this.assignedDoctor,
    role: "nurse",
  };
};

module.exports = mongoose.models.Nurse || mongoose.model("Nurse", nurseSchema);
