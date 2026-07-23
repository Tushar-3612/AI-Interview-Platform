import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendReportEmail({ to, subject, text, pdfBuffer, filename }) {
  if (!to) throw new Error("Recipient email is required");
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP not configured. Skipping email send.");
    return { simulated: true, message: "Email not sent - SMTP not configured" };
  }

  const mailOptions = {
    from: `"AI Interview Platform" <${process.env.SMTP_USER}>`,
    to,
    subject: subject || "Your Performance Report - AI Interview Platform",
    text: text || "Please find attached your performance report from AI Interview Platform.",
    attachments: pdfBuffer
      ? [{ filename: filename || "report.pdf", content: pdfBuffer }]
      : [],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email send error:", error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export function validateEmailConfig() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}
