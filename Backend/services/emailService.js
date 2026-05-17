// backend/services/emailService.js
const nodemailer = require("nodemailer");

function createTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

exports.sendPrescriptionEmail = async ({ toEmail, toName, doctorName, pdfBuffer }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("[Email] EMAIL_USER or EMAIL_PASS not set — skipping prescription email.");
    return;
  }

  const transporter = createTransport();

  await transporter.sendMail({
    from:    `"ChatAid Clinic" <${process.env.EMAIL_USER}>`,
    to:      toEmail,
    subject: `Your Prescription from ${doctorName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#0e7490;padding:24px;border-radius:8px 8px 0 0;">
          <h2 style="color:#fff;margin:0;">ChatAid Clinic</h2>
          <p style="color:#bae6fd;margin:4px 0 0;">Digital Prescription</p>
        </div>
        <div style="background:#f8fafc;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;">
          <p style="color:#0f172a;font-size:15px;">Dear <strong>${toName}</strong>,</p>
          <p style="color:#475569;font-size:14px;">
            Your prescription from <strong>${doctorName}</strong> has been issued.
            Please find the PDF attached — you can download it and show it at any pharmacy.
          </p>
          <p style="color:#475569;font-size:13px;margin-top:20px;">
            If you have any questions, please contact the clinic.
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
          <p style="color:#94a3b8;font-size:12px;">
            This is an automated message from ChatAid Clinic. Please do not reply to this email.
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename:    "prescription.pdf",
        content:     pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  console.log(`[Email] Prescription sent to ${toEmail}`);
};
