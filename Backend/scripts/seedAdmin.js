// Backend/scripts/seedAdmin.js
// Usage:  node scripts/seedAdmin.js
// Creates initial admin accounts. Safe to re-run — skips existing emails.

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Admin    = require("../models/admin");

const SEED_ADMINS = [
  { name: "AIIMS Vijaypur Admin", email: "admin@aiimsvijaypur.in", password: "Admin@123", hospitalId: "aiims_vijaypur" },
  { name: "AIIMS Jammu Admin",    email: "admin@aiimsjammu.in",    password: "Admin@123", hospitalId: "aiims_jammu"    },
  { name: "GMC Jammu Admin",      email: "admin@gmcjammu.in",      password: "Admin@123", hospitalId: "gmc_jammu"      },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  for (const data of SEED_ADMINS) {
    const exists = await Admin.findOne({ email: data.email });
    if (exists) {
      console.log(`SKIP   ${data.email} (already exists)`);
      continue;
    }
    await Admin.create(data);   // bcrypt pre-save hook fires automatically
    console.log(`CREATE ${data.email}  hospitalId=${data.hospitalId}`);
  }

  console.log("\nDone. Change default passwords before deploying to production!");
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });