import {
  sendReportEmail as sendMail,
  isSMTPConfigured,
  verifyEmailTransporter,
  getSMTPConfig,
  maskEmail,
} from "./emailSender.js";

/**
 * Compatibility wrapper for the legacy emailService signature:
 * sendReportEmail({ to, subject, text, pdfBuffer, filename })
 */
export async function sendReportEmail({ to, subject, text, pdfBuffer, filename }) {
  const attachments = pdfBuffer
    ? [{ filename: filename || "report.pdf", content: pdfBuffer }]
    : [];
  return sendMail(to, subject, text, null, attachments);
}

export const validateEmailConfig = isSMTPConfigured;

export {
  isSMTPConfigured,
  verifyEmailTransporter,
  getSMTPConfig,
  maskEmail,
};

export default {
  sendReportEmail,
  validateEmailConfig,
  verifyEmailTransporter,
  isSMTPConfigured,
  getSMTPConfig,
  maskEmail,
};
