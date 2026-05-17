// backend/services/prescriptionPdfService.js
const PDFDocument = require("pdfkit");

function bufferFromDoc(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data",  (c) => chunks.push(c));
    doc.on("end",   ()  => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

exports.generatePrescriptionPdf = async (prescription, patient, doctor) => {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const promise = bufferFromDoc(doc);

  const TEAL   = "#0e7490";
  const DARK   = "#0f172a";
  const MID    = "#475569";
  const LIGHT  = "#f0f9ff";
  const BORDER = "#bae6fd";
  const W      = 595 - 100; // usable width

  const hospitalName = doctor?.hospital || process.env.HOSPITAL_NAME || "ChatAid Clinic";
  const doctorName   = `Dr. ${doctor?.name || "Doctor"}`;
  const specialty    = doctor?.specialisation || doctor?.specialization || "General Physician";
  const patientName  = patient?.name  || prescription.patientName || "Patient";
  const patientAge   = patient?.age   || "";
  const patientPhone = patient?.phone || "";
  const issuedAt     = new Date(prescription.issuedAt || Date.now())
    .toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.rect(50, 50, W, 70).fill(TEAL);

  doc.fillColor("#ffffff")
     .font("Helvetica-Bold").fontSize(18)
     .text(hospitalName, 65, 65, { width: W - 20 });

  doc.font("Helvetica").fontSize(10)
     .text(`${doctorName}  ·  ${specialty}`, 65, 90, { width: W - 20 });

  // ── Rx badge ────────────────────────────────────────────────────────────────
  doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(32)
     .text("Rx", 50, 135);

  // ── Patient info row ────────────────────────────────────────────────────────
  doc.rect(50, 175, W, 48).fill(LIGHT).stroke(BORDER);

  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
     .text("PATIENT", 60, 183)
     .text("DATE", 290, 183)
     .text("CONTACT", 420, 183);

  doc.font("Helvetica").fontSize(11)
     .text(patientName + (patientAge ? `, ${patientAge} yrs` : ""), 60, 196, { width: 220 })
     .text(issuedAt, 290, 196)
     .text(patientPhone, 420, 196);

  let y = 240;

  // ── Diagnosis ───────────────────────────────────────────────────────────────
  if (prescription.diagnosis) {
    doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(9)
       .text("DIAGNOSIS", 50, y);
    y += 14;
    doc.fillColor(DARK).font("Helvetica").fontSize(11)
       .text(prescription.diagnosis, 50, y, { width: W });
    y += doc.heightOfString(prescription.diagnosis, { width: W }) + 16;
  }

  // ── Medications table ───────────────────────────────────────────────────────
  doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(9)
     .text("MEDICATIONS", 50, y);
  y += 12;

  // Table header
  doc.rect(50, y, W, 22).fill(TEAL);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
  const cols = { name: 55, dose: 210, freq: 295, dur: 375, inst: 450 };
  doc.text("Medicine",     cols.name, y + 7)
     .text("Dose",         cols.dose, y + 7)
     .text("Frequency",    cols.freq, y + 7)
     .text("Duration",     cols.dur,  y + 7)
     .text("Instructions", cols.inst, y + 7);
  y += 22;

  const meds = prescription.medications || [];
  meds.forEach((m, i) => {
    const rowH = 24;
    doc.rect(50, y, W, rowH).fill(i % 2 === 0 ? "#f8fafc" : "#ffffff").stroke(BORDER);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9)
       .text(m.name || "—", cols.name, y + 8, { width: 148 });
    doc.font("Helvetica").fontSize(9)
       .text(m.dose        || "—", cols.dose, y + 8, { width: 78 })
       .text(m.frequency   || "—", cols.freq, y + 8, { width: 73 })
       .text(m.duration    || "—", cols.dur,  y + 8, { width: 68 })
       .text(m.instructions|| "—", cols.inst, y + 8, { width: 95 });
    y += rowH;
  });

  y += 20;

  // ── Advice ──────────────────────────────────────────────────────────────────
  if (prescription.advice) {
    doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(9)
       .text("ADVICE", 50, y);
    y += 14;
    doc.fillColor(DARK).font("Helvetica").fontSize(10)
       .text(prescription.advice, 50, y, { width: W });
    y += doc.heightOfString(prescription.advice, { width: W }) + 16;
  }

  // ── Follow-up ───────────────────────────────────────────────────────────────
  if (prescription.followUpDate) {
    const fuDate = new Date(prescription.followUpDate)
      .toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    doc.rect(50, y, W, 36).fill(LIGHT).stroke(BORDER);
    doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(9)
       .text("FOLLOW-UP", 60, y + 6);
    doc.fillColor(DARK).font("Helvetica").fontSize(10)
       .text(`${fuDate}${prescription.followUpRemark ? " — " + prescription.followUpRemark : ""}`, 60, y + 18, { width: W - 20 });
    y += 50;
  }

  // ── Signature ───────────────────────────────────────────────────────────────
  const sigY = doc.page.height - 100;
  doc.moveTo(350, sigY).lineTo(540, sigY).stroke(MID);
  doc.fillColor(MID).font("Helvetica").fontSize(9)
     .text(doctorName, 350, sigY + 5, { width: 190, align: "center" })
     .text(specialty,  350, sigY + 18, { width: 190, align: "center" });

  // ── Footer ──────────────────────────────────────────────────────────────────
  doc.rect(50, doc.page.height - 40, W, 1).fill(TEAL);
  doc.fillColor(MID).font("Helvetica").fontSize(8)
     .text(
       `This prescription was issued digitally by ${hospitalName}. Valid only with doctor's authorisation.`,
       50, doc.page.height - 30, { width: W, align: "center" }
     );

  doc.end();
  return promise;
};
