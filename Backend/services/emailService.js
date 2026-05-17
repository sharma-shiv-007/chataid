// backend/services/emailService.js
const { Resend } = require("resend");

exports.sendPrescriptionEmail = async ({ toEmail, toName, doctorName, pdfBuffer }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not set — skipping prescription email.");
    return;
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from:    "ChatAid Clinic <onboarding@resend.dev>",
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
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
          <p style="color:#94a3b8;font-size:12px;">This is an automated message from ChatAid Clinic.</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename:    "prescription.pdf",
        content:     pdfBuffer.toString("base64"),
      },
    ],
  });

  if (error) {
    throw new Error(error.message || "Resend API error");
  }

  console.log(`[Email] Prescription sent to ${toEmail}`);
};
