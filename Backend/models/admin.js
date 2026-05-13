// Backend/models/admin.js
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const adminSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, select: false },
  role:      { type: String, default: "admin" },
  hospitalId:{ type: String, default: "" },   // e.g. "aiims_vijaypur"
  createdAt: { type: Date, default: Date.now },
});

// Hash password before save — same pattern as Patient / Doctor
adminSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

adminSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

adminSchema.methods.toSafeObject = function () {
  return {
    id:         this._id,
    name:       this.name,
    email:      this.email,
    role:       "admin",
    hospitalId: this.hospitalId,
  };
};

module.exports = mongoose.models.Admin || mongoose.model("Admin", adminSchema);