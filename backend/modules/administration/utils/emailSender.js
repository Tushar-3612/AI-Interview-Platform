import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import dns from "dns/promises";
import net from "net";
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

/**
 * Dynamically resolves SMTP hostname to an IPv4 address to prevent ENETUNREACH on cloud IPv6 networks.
 * Bypasses Nodemailer's internal dual-stack DNS resolution.
 * If hostname is already an IPv4 address, it is returned directly.
 *
 * @param {string} hostname - Target SMTP hostname (e.g. smtp.gmail.com).
 * @returns {Promise<string>} - Resolved IPv4 address.
 */
export const resolveSMTPHostToIPv4 = async (hostname) => {
  if (!hostname || typeof hostname !== "string") {
    throw new Error("SMTP hostname is required for IPv4 DNS resolution");
  }

  // If already an IPv4 address, return directly
  if (net.isIPv4(hostname)) {
    return hostname;
  }

  try {
    const addresses = await dns.resolve4(hostname);
    if (!addresses || addresses.length === 0) {
      throw new Error(`No IPv4 (A) records returned for host: ${hostname}`);
    }
    return addresses[0];
  } catch (error) {
    console.error(`❌ DNS IPv4 resolution failed for SMTP host ${hostname}:`, error.message);
    throw new Error(`Failed to resolve IPv4 address for SMTP host ${hostname}: ${error.message}`);
  }
};

let cachedTransporter = null;

/**
 * Returns a singleton pooled Nodemailer transporter instance with dynamic IPv4 host and TLS SNI.
 *
 * @returns {Promise<nodemailer.Transporter|null>}
 */
export const getTransporter = async () => {
  if (cachedTransporter) return cachedTransporter;

  if (!isSMTPConfigured()) {
    return null;
  }

  const { host, port, secure, user, pass } = getSMTPConfig();

  // Dynamically resolve hostname to IPv4 to eliminate IPv6 ENETUNREACH on Render
  const ipv4Host = await resolveSMTPHostToIPv4(host);

  console.log(`📡 SMTP IPv4 Host Resolved: ${ipv4Host} (Target: ${host}:${port}, Secure: ${secure})`);

  cachedTransporter = nodemailer.createTransport({
    host: ipv4Host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      servername: host, // Explicit TLS SNI ensures SSL certificate matches smtp.gmail.com
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
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

  try {
    const transporter = await getTransporter();
    if (!transporter) {
      return {
        configured: false,
        message: "Failed to initialize SMTP transporter.",
      };
    }
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
  const transporter = await getTransporter();

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
  resolveSMTPHostToIPv4,
  maskEmail,
};
