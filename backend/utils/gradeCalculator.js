const GRADE_THRESHOLDS = [
  { min: 90, grade: "A+" },
  { min: 75, grade: "A" },
  { min: 65, grade: "B+" },
  { min: 55, grade: "B" },
  { min: 40, grade: "C" },
];

export function calculateGrade(percentage) {
  if (percentage == null || isNaN(percentage)) return "Fail";
  for (const t of GRADE_THRESHOLDS) {
    if (percentage >= t.min) return t.grade;
  }
  return "Fail";
}

export function calculatePassFail(percentage, passingMarks) {
  return percentage >= (passingMarks || 40);
}

export { GRADE_THRESHOLDS };
