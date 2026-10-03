import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Mask an email address for safe logging without exposing full identity.
 * Example: tusharnagare2324_co@sanjivanicoe.org.in -> tu***@sanjivanicoe.org.in
 */
export const maskEmail = (email) => {
  if (!email || typeof email !== "string" || !email.includes("@")) return "invalid-email";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
};

/**
 * Reads and standardizes SMTP configuration from environment variables.
 * Resolves defaults for Google Workspace / Gmail infrastructure.
 */
export const getSMTPConfig = () => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = (process.env.SMTP_USER || process.env.SMTP_EMAIL || "").trim();
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "").trim();
  const fromName = process.env.SMTP_FROM_NAME || "PrepHire - AI Interview Platform";

  return { host, port, secure, user, pass, fromName };
};

/**
 * Validates whether required SMTP credentials are present and correctly formatted.
 */
export const isSMTPConfigured = () => {
  const { user, pass } = getSMTPConfig();
  return Boolean(user && pass && user.includes("@"));
};

let cachedTransporter = null;

/**
 * Returns a singleton pooled Nodemailer transporter instance.
 */
export const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  if (!isSMTPConfigured()) {
    return null;
  }

  const { host, port, secure, user, pass } = getSMTPConfig();

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });

  return cachedTransporter;
};

/**
 * Verifies SMTP connection without exposing passwords or credentials.
 * @returns {Promise<Object>}
 */
export const verifyEmailTransporter = async () => {
  const config = getSMTPConfig();
  if (!isSMTPConfigured()) {
    return {
      configured: false,
      message: "SMTP is not configured or SMTP_USER is not a valid email address.",
    };
  }

  const transporter = getTransporter();
  try {
    await transporter.verify();
    return {
      configured: true,
      success: true,
      host: config.host,
      port: config.port,
      user: maskEmail(config.user),
    };
  } catch (error) {
    console.error("❌ SMTP Transporter Verification Failed:", error.message);
    return {
      configured: true,
      success: false,
      error: error.message,
    };
  }
};

/**
 * Sends an email with optional attachments.
 * Falls back to saving files locally in exports folder if SMTP configuration is absent.
 * 
 * @param {string} to - Recipient email.
 * @param {string} subject - Email subject.
 * @param {string} text - Plain text body.
 * @param {string} html - HTML body.
 * @param {Array} attachments - Attachments list [{filename, content}].
 * @returns {Promise<Object>} - Status object.
 */
export const sendReportEmail = async (to, subject, text, html, attachments = []) => {
  if (!to) {
    throw new Error("Recipient email is required");
  }

  const config = getSMTPConfig();
  const transporter = getTransporter();

  // Fallback to simulation mode if SMTP credentials are missing or invalid
  if (!transporter) {
    console.warn("⚠️ SMTP credentials missing or invalid in environment (.env). Simulating email delivery...");

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

  const mailOptions = {
    from: `"${config.fromName}" <${config.user}>`,
    to,
    subject,
    text,
    html,
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email successfully sent to ${maskEmail(to)}. MessageId: ${info.messageId}`);
    return {
      success: true,
      simulated: false,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(`❌ NodeMailer Send Error (recipient: ${maskEmail(to)}):`, error.message);
    throw error;
  }
};

export default {
  sendReportEmail,
  verifyEmailTransporter,
  isSMTPConfigured,
  getSMTPConfig,
  maskEmail,
};
