// Backend/scripts/setAllDoctorsAvailable.js
// Usage: node scripts/setAllDoctorsAvailable.js
// Sets every doctor availability record to available, creating missing records.

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Doctor = require("../models/doctor");
const DoctorAvailability = require("../models/doctorAvailability");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const doctors = await Doctor.find({}).select("_id name email").lean();
  let created = 0;
  let updated = 0;

  for (const doctor of doctors) {
    const result = await DoctorAvailability.updateOne(
      { doctorId: doctor._id },
      {
        $set: { isAvailable: true },
        $setOnInsert: { doctorId: doctor._id, leaves: [] },
      },
      { upsert: true }
    );

    if (result.upsertedCount) created += 1;
    else if (result.modifiedCount) updated += 1;
  }

  console.log(`Doctors found: ${doctors.length}`);
  console.log(`Availability records created: ${created}`);
  console.log(`Availability records updated: ${updated}`);
  console.log("Done. All doctors are marked available.");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
