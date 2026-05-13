// Backend/scripts/seedDoctor.js
// Usage: node scripts/seedDoctor.js
// Creates a test doctor. Safe to re-run — skips if email already exists.

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Doctor   = require("../models/doctor");

const SEED_DOCTORS = [
  {
    name:           "Dr. Arjun Mehta",
    email:          "doctor@chataid.in",
    password:       "Doctor@1234",
    specialisation: "Cardiology",      // matches schema exactly
    hospital:       "AIIMS Vijaypur",
    phone:          "9876543210",
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  for (const data of SEED_DOCTORS) {
    const exists = await Doctor.findOne({ email: data.email });
    if (exists) {
      console.log(`SKIP   ${data.email} (already exists)`);
      continue;
    }

    // new + save → pre-save bcrypt hook fires automatically (same pattern as seedAdmin)
    const doc = new Doctor(data);
    await doc.save();
    console.log(`CREATE ${data.email}  password=Doctor@1234`);
  }

  console.log("\nDone!");
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });