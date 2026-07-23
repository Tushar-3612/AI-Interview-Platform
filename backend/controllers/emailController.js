import User from "../models/User.js";
import Test from "../models/Test.js";
import TestAssignment from "../models/TestAssignment.js";
import TestResult from "../models/TestResult.js";
import { sendReportEmail } from "../utils/emailSender.js";
import { createAuditLog } from "../middleware/auditMiddleware.js";
import { createNotification } from "../services/notificationService.js";
import {
  getTestAssignmentEmail,
  getResultEmail,
  getReminderEmail,
  getWelcomeEmail,
  getPasswordResetEmail,
} from "../services/emailTemplates.js";

export const sendTestAssignment = async (req, res) => {
  try {
    const { testId, studentIds } = req.body;
    if (!testId || !studentIds?.length) return res.status(400).json({ message: "Test ID and student IDs required" });
    const test = await Test.findById(testId).lean();
    if (!test) return res.status(404).json({ message: "Test not found" });
    const students = await User.find({ _id: { $in: studentIds } }).lean();
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const results = [];
    for (const student of students) {
      const startLink = `${baseUrl}/tests/attempt/${testId}`;
      const { subject, html } = getTestAssignmentEmail(student.name, test.title, test.companyId, test.scheduledAt?.toLocaleDateString(), test.duration, startLink);
      try {
        await sendReportEmail(student.email, subject, "", html);
        results.push({ email: student.email, status: "sent" });
        await createNotification({ userId: student._id, role: "student", type: "info", title: "Test Assigned", message: `You have been assigned: ${test.title}`, link: startLink });
      } catch {
        results.push({ email: student.email, status: "failed" });
      }
    }
    await createAuditLog({ userId: req.user.id, role: "admin", action: "send_test_assignment_email", resource: "Email", details: { testId, recipients: students.length }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ message: `Emails processed for ${students.length} students`, results });
  } catch (error) {
    console.error("Send Test Assignment Error:", error.message);
    res.status(500).json({ message: "Failed to send assignment emails" });
  }
};

export const sendResultEmail = async (req, res) => {
  try {
    const { testResultId } = req.params;
    const testResult = await TestResult.findById(testResultId).populate("testId").lean();
    if (!testResult) return res.status(404).json({ message: "Test result not found" });
    const user = await User.findById(testResult.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const { subject, html } = getResultEmail(user.name, testResult.testId?.title, testResult.percentage, testResult.grade, testResult.passed, testResult.sections);
    await sendReportEmail(user.email, subject, "", html);
    await createAuditLog({ userId: req.user.id, role: "admin", action: "send_result_email", resource: "Email", resourceId: testResultId, details: { email: user.email }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ message: "Result email sent", to: user.email });
  } catch (error) {
    console.error("Send Result Email Error:", error.message);
    res.status(500).json({ message: "Failed to send result email" });
  }
};

export const sendReminder = async (req, res) => {
  try {
    const { testId, hoursBefore } = req.body;
    if (!testId) return res.status(400).json({ message: "Test ID required" });
    const test = await Test.findById(testId).lean();
    if (!test) return res.status(404).json({ message: "Test not found" });
    const assignments = await TestAssignment.find({ testId }).lean();
    const studentIds = [...new Set(assignments.flatMap(a => a.studentIds))];
    const students = await User.find({ _id: { $in: studentIds } }).lean();
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const results = [];
    for (const student of students) {
      const startLink = `${baseUrl}/tests`;
      const { subject, html } = getReminderEmail(student.name, test.title, hoursBefore || 24, startLink);
      try {
        await sendReportEmail(student.email, subject, "", html);
        results.push({ email: student.email, status: "sent" });
      } catch {
        results.push({ email: student.email, status: "failed" });
      }
    }
    await createAuditLog({ userId: req.user.id, role: "admin", action: "send_reminder_email", resource: "Email", details: { testId, hoursBefore: hoursBefore || 24, recipients: students.length }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ message: `Reminders sent to ${students.length} students`, results });
  } catch (error) {
    console.error("Send Reminder Error:", error.message);
    res.status(500).json({ message: "Failed to send reminders" });
  }
};

export const sendWelcome = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const { subject, html } = getWelcomeEmail(user.name, user.email);
    await sendReportEmail(user.email, subject, "", html);
    await createAuditLog({ userId: req.user.id, role: "admin", action: "send_welcome_email", resource: "Email", resourceId: userId, details: { email: user.email }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ message: "Welcome email sent", to: user.email });
  } catch (error) {
    console.error("Send Welcome Error:", error.message);
    res.status(500).json({ message: "Failed to send welcome email" });
  }
};

export const sendPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    const resetToken = Math.random().toString(36).substring(2, 15);
    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;
    const { subject, html } = getPasswordResetEmail(user.name, resetLink);
    await sendReportEmail(user.email, subject, "", html);
    await createAuditLog({ userId: req.user.id, role: "admin", action: "send_password_reset_email", resource: "Email", resourceId: user._id.toString(), details: { email }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ message: "Password reset email sent", to: user.email });
  } catch (error) {
    console.error("Send Password Reset Error:", error.message);
    res.status(500).json({ message: "Failed to send password reset email" });
  }
};

export const getEmailStatus = async (req, res) => {
  const isConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  res.json({
    smtpConfigured: isConfigured,
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    user: process.env.SMTP_USER || "Not configured",
  });
};
