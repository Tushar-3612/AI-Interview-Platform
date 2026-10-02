import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  verifyEmailTransporter,
  sendReportEmail,
  getSMTPConfig,
  maskEmail,
} from "../utils/emailSender.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

async function runTest() {
  console.log("==========================================");
  console.log(" 🔍 PrepHire SMTP Diagnostic Test");
  console.log("==========================================");

  const config = getSMTPConfig();
  console.log("Configuration Status:");
  console.log(` • SMTP Host:        ${config.host}`);
  console.log(` • SMTP Port:        ${config.port}`);
  console.log(` • SMTP Secure:      ${config.secure}`);
  console.log(` • Sender Name:      ${config.fromName}`);
  console.log(` • Sender Email:     ${maskEmail(config.user)}`);
  console.log(` • Password Set:     ${config.pass ? "✅ Yes (length " + config.pass.length + ")" : "❌ No"}`);
  console.log("------------------------------------------");

  console.log("Testing SMTP Handshake...");
  const verification = await verifyEmailTransporter();

  if (!verification.success) {
    console.error("❌ Transporter verification failed:", verification.error);
    process.exit(1);
  }

  console.log("✅ Transporter verified successfully!");
  console.log(`   Connected to ${verification.host}:${verification.port} as ${verification.user}`);

  // Test sending an email if --send flag is provided
  if (process.argv.includes("--send")) {
    const targetEmail = process.env.SMTP_USER;
    console.log(`------------------------------------------`);
    console.log(`Attempting to send test email to ${maskEmail(targetEmail)}...`);

    const result = await sendReportEmail(
      targetEmail,
      "Test Email - PrepHire Platform SMTP Verification",
      "This is a test email sent from the PrepHire AI Interview Platform to verify SMTP connectivity.",
      `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #FF6B35;">PrepHire SMTP Verification</h2>
          <p>Congratulations! Your Google Workspace SMTP configuration is working perfectly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p style="font-size: 12px; color: #64748b;">AI Interview Platform &copy; 2026</p>
        </div>
      `
    );

    console.log("✅ Test email result:", {
      success: result.success,
      simulated: result.simulated,
      messageId: result.messageId,
    });
  } else {
    console.log("ℹ️ Skipping email send. Pass '--send' flag to dispatch a real test email.");
  }

  console.log("==========================================");
}

runTest().catch((err) => {
  console.error("❌ Test script error:", err.message);
  process.exit(1);
});
