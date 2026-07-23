export async function computeRankings(testId, userId, department, TestResultModel) {
  const allResults = await TestResultModel.find({
    testId,
    processedAt: { $ne: null },
  })
    .populate("userId", "department")
    .lean();

  const sorted = allResults
    .filter(r => r.percentage != null)
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

  const totalParticipants = sorted.length;

  const userResultIndex = sorted.findIndex(
    r => r.userId && (r.userId._id ? r.userId._id.toString() === userId.toString() : r.userId.toString() === userId.toString())
  );

  const testRank = userResultIndex >= 0 ? userResultIndex + 1 : 0;

  const deptResults = sorted.filter(r => {
    const rDept = r.studentInfo?.department || (r.userId && r.userId.department) || "";
    return rDept === department;
  });

  const departmentParticipants = deptResults.length;
  const deptUserIndex = deptResults.findIndex(
    r => r.userId && (r.userId._id ? r.userId._id.toString() === userId.toString() : r.userId.toString() === userId.toString())
  );
  const departmentRank = deptUserIndex >= 0 ? deptUserIndex + 1 : 0;

  const overallResults = await TestResultModel.find({
    processedAt: { $ne: null },
  })
    .lean();

  const overallSorted = overallResults
    .filter(r => r.percentage != null)
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

  const overallIndex = overallSorted.findIndex(
    r => r.userId && (r.userId._id ? r.userId._id.toString() === userId.toString() : r.userId.toString() === userId.toString())
  );
  const overallRank = overallIndex >= 0 ? overallIndex + 1 : 0;

  return {
    testRank,
    departmentRank,
    overallRank,
    totalParticipants,
    departmentParticipants,
  };
}

export async function computeAllTestRankings(testId, TestResultModel) {
  const allResults = await TestResultModel.find({
    testId,
    processedAt: { $ne: null },
  })
    .populate("userId", "department")
    .lean();

  const sorted = allResults
    .filter(r => r.percentage != null)
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

  const totalParticipants = sorted.length;

  const departmentGroups = {};
  sorted.forEach(r => {
    const dept = r.studentInfo?.department || (r.userId && r.userId.department) || "unknown";
    if (!departmentGroups[dept]) departmentGroups[dept] = [];
    departmentGroups[dept].push(r);
  });

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const dept = r.studentInfo?.department || (r.userId && r.userId.department) || "unknown";
    const deptRank = (departmentGroups[dept] || []).findIndex(dr => {
      const drId = dr._id ? dr._id.toString() : "";
      const rId = r._id ? r._id.toString() : "";
      return drId === rId;
    }) + 1;

    const rid = r._id ? r._id.toString() : null;
    if (rid) {
      await TestResultModel.findByIdAndUpdate(rid, {
        "ranking.testRank": i + 1,
        "ranking.departmentRank": deptRank,
        "ranking.totalParticipants": totalParticipants,
        "ranking.departmentParticipants": (departmentGroups[dept] || []).length,
      });
    }
  }

  return { totalParticipants, updatedCount: sorted.length };
}
