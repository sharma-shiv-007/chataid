// Backend/scripts/setDefaultDoctorSlots.js
// Usage: node scripts/setDefaultDoctorSlots.js
// Marks all doctors available and gives them default weekday slots.

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Doctor = require("../models/doctor");
const DoctorAvailability = require("../models/doctorAvailability");

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const ACTIVE_DAYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday"]);
const START_TIME = "09:00";
const END_TIME = "17:00";
const SLOT_DURATION_MINS = 30;

function generateSlots(startTime, endTime, durationMins) {
  const slots = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let cur = sh * 60 + sm;
  const end = eh * 60 + em;

  while (cur + durationMins <= end) {
    const h = String(Math.floor(cur / 60)).padStart(2, "0");
    const m = String(cur % 60).padStart(2, "0");
    slots.push({ time: `${h}:${m}`, booked: false });
    cur += durationMins;
  }

  return slots;
}

function defaultWeeklySchedule() {
  return Object.fromEntries(
    DAYS.map(day => {
      const active = ACTIVE_DAYS.has(day);
      return [
        day,
        {
          active,
          slots: active ? generateSlots(START_TIME, END_TIME, SLOT_DURATION_MINS) : [],
          slotDurationMins: SLOT_DURATION_MINS,
        },
      ];
    })
  );
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const doctors = await Doctor.find({}).select("_id name email").lean();
  const weeklySchedule = defaultWeeklySchedule();
  let created = 0;
  let updated = 0;

  for (const doctor of doctors) {
    const result = await DoctorAvailability.updateOne(
      { doctorId: doctor._id },
      {
        $set: {
          isAvailable: true,
          weeklySchedule,
        },
        $setOnInsert: {
          doctorId: doctor._id,
          leaves: [],
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount) created += 1;
    else if (result.modifiedCount) updated += 1;
  }

  console.log(`Doctors found: ${doctors.length}`);
  console.log(`Availability records created: ${created}`);
  console.log(`Availability records updated: ${updated}`);
  console.log(`Default slots: Monday-Friday, ${START_TIME}-${END_TIME}, every ${SLOT_DURATION_MINS} minutes`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
