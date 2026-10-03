export async function computeRankings(testId, userId, department, TestResultModel) {
  const userResult = await TestResultModel.findOne({ testId, userId }).select("percentage").lean();
  const userPercentage = userResult?.percentage ?? 0;

  const [
    totalParticipants,
    higherTestCount,
    departmentParticipants,
    higherDeptCount,
    higherOverallCount,
  ] = await Promise.all([
    TestResultModel.countDocuments({ testId, processedAt: { $ne: null } }),
    TestResultModel.countDocuments({ testId, processedAt: { $ne: null }, percentage: { $gt: userPercentage } }),
    department ? TestResultModel.countDocuments({ testId, processedAt: { $ne: null }, "studentInfo.department": department }) : Promise.resolve(0),
    department ? TestResultModel.countDocuments({ testId, processedAt: { $ne: null }, "studentInfo.department": department, percentage: { $gt: userPercentage } }) : Promise.resolve(0),
    TestResultModel.countDocuments({ processedAt: { $ne: null }, percentage: { $gt: userPercentage } }),
  ]);

  return {
    testRank: userResult ? higherTestCount + 1 : 0,
    departmentRank: userResult && department ? higherDeptCount + 1 : 0,
    overallRank: userResult ? higherOverallCount + 1 : 0,
    totalParticipants,
    departmentParticipants,
  };
}

export async function computeAllTestRankings(testId, TestResultModel) {
  const allResults = await TestResultModel.find({
    testId,
    processedAt: { $ne: null },
  })
    .select("_id userId percentage studentInfo.department")
    .lean();

  const sorted = allResults
    .filter(r => r.percentage != null)
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

  const totalParticipants = sorted.length;

  const departmentGroups = {};
  sorted.forEach(r => {
    const dept = r.studentInfo?.department || "unknown";
    if (!departmentGroups[dept]) departmentGroups[dept] = [];
    departmentGroups[dept].push(r);
  });

  const bulkOps = [];
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const dept = r.studentInfo?.department || "unknown";
    const deptRank = (departmentGroups[dept] || []).findIndex(dr => {
      const drId = dr._id ? dr._id.toString() : "";
      const rId = r._id ? r._id.toString() : "";
      return drId === rId;
    }) + 1;

    const rid = r._id ? r._id.toString() : null;
    if (rid) {
      bulkOps.push({
        updateOne: {
          filter: { _id: rid },
          update: {
            $set: {
              "ranking.testRank": i + 1,
              "ranking.departmentRank": deptRank,
              "ranking.totalParticipants": totalParticipants,
              "ranking.departmentParticipants": (departmentGroups[dept] || []).length,
            },
          },
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    await TestResultModel.bulkWrite(bulkOps, { ordered: false });
  }

  return { totalParticipants, updatedCount: sorted.length };
}

