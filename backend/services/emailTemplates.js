export function getTestAssignmentEmail(studentName, testName, company, date, duration, startLink) {
  return {
    subject: `Test Assigned: ${testName}`,
    html: `
      <h2>Hello ${studentName},</h2>
      <p>You have been assigned a new test.</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px;">
        <tr><td style="padding:8px;font-weight:bold;">Test:</td><td>${testName}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Company:</td><td>${company || "N/A"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Date:</td><td>${date || "N/A"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Duration:</td><td>${duration} min</td></tr>
      </table>
      <p><a href="${startLink}" style="display:inline-block;padding:10px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Start Test</a></p>
      <p style="color:#666;font-size:12px;">AI Interview Platform</p>
    `,
  };
}

export function getResultEmail(studentName, testName, percentage, grade, passed, sectionScores) {
  const sectionRows = (sectionScores || []).map(s =>
    `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${s.section}</td><td style="padding:4px 8px;text-align:center;">${s.obtainedMarks}/${s.totalMarks}</td><td style="padding:4px 8px;text-align:center;">${s.percentage}%</td></tr>`
  ).join("");

  return {
    subject: `Test Result: ${testName} - ${grade}`,
    html: `
      <h2>Hello ${studentName},</h2>
      <p>Your test result is ready.</p>
      <div style="text-align:center;padding:20px;background:${passed ? '#dcfce7' : '#fee2e2'};border-radius:12px;margin:16px 0;">
        <h1 style="margin:0;font-size:36px;color:${passed ? '#16a34a' : '#dc2626'};">${percentage}%</h1>
        <p style="margin:4px 0;font-size:18px;font-weight:bold;">Grade: ${grade}</p>
        <p style="margin:0;font-weight:${passed ? 'bold' : 'normal'};color:${passed ? '#16a34a' : '#dc2626'};">${passed ? 'PASSED' : 'FAILED'}</p>
      </div>
      <table style="border-collapse:collapse;width:100%;max-width:500px;">
        <tr style="background:#f8fafc;"><th style="padding:8px;text-align:left;">Section</th><th style="padding:8px;">Marks</th><th style="padding:8px;">%</th></tr>
        ${sectionRows}
      </table>
      <p style="color:#666;font-size:12px;margin-top:16px;">AI Interview Platform</p>
    `,
  };
}

export function getReminderEmail(studentName, testName, hoursBefore, startLink) {
  const timeText = hoursBefore >= 24 ? "tomorrow" : hoursBefore >= 1 ? "in a few hours" : "shortly";
  return {
    subject: `Reminder: ${testName} starts ${timeText}`,
    html: `
      <h2>Reminder: ${testName}</h2>
      <p>Hello ${studentName},</p>
      <p>This is a reminder that your test <strong>${testName}</strong> is starting ${timeText}.</p>
      <p><a href="${startLink}" style="display:inline-block;padding:10px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Go to Test</a></p>
      <p style="color:#666;font-size:12px;">AI Interview Platform</p>
    `,
  };
}

export function getWelcomeEmail(studentName, email) {
  return {
    subject: `Welcome to AI Interview Platform, ${studentName}!`,
    html: `
      <h2>Welcome ${studentName}!</h2>
      <p>Your account has been created successfully.</p>
      <p><strong>Email:</strong> ${email}</p>
      <p>Start practicing with mock interviews and tests to prepare for your placements.</p>
      <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="display:inline-block;padding:10px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Go to Dashboard</a></p>
      <p style="color:#666;font-size:12px;">AI Interview Platform</p>
    `,
  };
}

export function getPasswordResetEmail(studentName, resetLink) {
  return {
    subject: "Password Reset - AI Interview Platform",
    html: `
      <h2>Password Reset</h2>
      <p>Hello ${studentName},</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetLink}" style="display:inline-block;padding:10px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Reset Password</a></p>
      <p style="color:#666;font-size:12px;">If you did not request this, please ignore this email.</p>
      <p style="color:#666;font-size:12px;">AI Interview Platform</p>
    `,
  };
}

export function getForgotPasswordOtpEmail(studentName, otp) {
  return {
    subject: "Password Reset OTP - AI Interview Platform",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 32px 16px; color: #1e293b; line-height: 1.6; margin: 0;">
        <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <div style="padding: 32px 32px 24px; border-bottom: 1px solid #f1f5f9; text-align: left;">
            <div style="font-size: 20px; font-weight: 700; color: #FF6B35; letter-spacing: -0.5px;">AI Interview Platform</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Practice smarter. Prepare confidently for placements.</div>
          </div>
          
          <!-- Body Content -->
          <div style="padding: 32px;">
            <h2 style="margin-top: 0; margin-bottom: 20px; font-size: 20px; font-weight: 600; color: #0f172a;">Password Reset Verification</h2>
            
            <p style="margin: 0 0 24px; font-size: 15px; color: #334155;">Hello ${studentName},</p>
            
            <p style="margin: 0 0 24px; font-size: 15px; color: #334155;">We received a request to reset your password.</p>
            
            <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">Your verification code:</p>
            
            <!-- OTP Card -->
            <div style="background-color: #fff9f6; border: 1px dashed #ffdcd0; padding: 20px; border-radius: 12px; font-size: 32px; font-weight: 700; text-align: center; letter-spacing: 6px; color: #FF6B35; margin-bottom: 24px;">
              ${otp}
            </div>
            
            <p style="margin: 0 0 8px; font-size: 14px; color: #475569; font-weight: 500;">This code is valid for 10 minutes.</p>
            <p style="margin: 0 0 24px; font-size: 13px; color: #ef4444; font-weight: 500;">Never share this verification code with anyone.</p>
            
            <p style="margin: 0; font-size: 14px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 20px;">If you did not request this password reset, you can safely ignore this email.</p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #f1f5f9;">
            <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2026 AI Interview Platform. All rights reserved.</p>
          </div>
          
        </div>
      </div>
    `,
  };
}
