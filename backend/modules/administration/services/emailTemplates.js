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
