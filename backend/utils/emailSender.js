import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sends an email with attachments (PDF & CSV).
 * Falls back to saving files locally in exports folder if SMTP configuration is absent.
 * @param {string} to - Recipient email.
 * @param {string} subject - Email subject.
 * @param {string} text - Plain text body.
 * @param {string} html - HTML body.
 * @param {Array} attachments - Attachments list [{filename, content}].
 * @returns {Promise<Object>} - Status object.
 */
export const sendReportEmail = async (to, subject, text, html, attachments = []) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  const hasSMTP = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS;

  if (!hasSMTP) {
    console.warn("⚠️ SMTP Credentials missing in environment (.env). Simulating email delivery...");
    
    // Save attachments to exports folder for admin visual review
    const backupDir = path.join(__dirname, "..", "exports", "simulated_emails");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const emailLogPath = path.join(backupDir, `email_${Date.now()}_to_${to.replace(/[@.]/g, "_")}.txt`);
    
    let logContent = `To: ${to}\nSubject: ${subject}\n\nBody:\n${text}\n\n`;
    
    attachments.forEach((att) => {
      const filePath = path.join(backupDir, `${Date.now()}_${att.filename}`);
      fs.writeFileSync(filePath, att.content);
      logContent += `Attachment saved: ${filePath}\n`;
    });

    fs.writeFileSync(emailLogPath, logContent);

    console.log(`✅ Simulated email details logged to: ${emailLogPath}`);
    return {
      success: true,
      simulated: true,
      logPath: emailLogPath,
    };
  }

  // Set up transporter
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"Placement Portal" <${SMTP_USER}>`,
      to,
      subject,
      text,
      html,
      attachments,
    });

    console.log(`✉️ Email successfully sent to ${to}. MessageId: ${info.messageId}`);
    return {
      success: true,
      simulated: false,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("❌ NodeMailer Send Error:", error.message);
    throw error;
  }
};

export default {
  sendReportEmail,
};
