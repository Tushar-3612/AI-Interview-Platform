import { motion } from "framer-motion";
import { BarChart3, TrendingUp } from "lucide-react";

const MOCK_RESULTS = [
  { category: "Technical", score: 82, max: 100 },
  { category: "Communication", score: 78, max: 100 },
  { category: "Problem Solving", score: 85, max: 100 },
  { category: "Coding", score: 75, max: 100 },
];

/**
 * Results — placement interview performance summary.
 */
function Results() {
  const overall = Math.round(MOCK_RESULTS.reduce((a, b) => a + b.score, 0) / MOCK_RESULTS.length);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Results
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Your latest interview performance breakdown.
        </p>

        <div className="student-card p-6 mb-6 text-center">
          <BarChart3 className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--primary)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Overall Score</p>
          <p className="text-4xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>{overall}%</p>
          <div className="flex items-center justify-center gap-1 mt-2 text-xs" style={{ color: "var(--success)" }}>
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+12% from last attempt</span>
          </div>
        </div>

        <div className="space-y-4">
          {MOCK_RESULTS.map((item, i) => (
            <motion.div
              key={item.category}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="student-card p-5"
            >
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>{item.category}</span>
                <span className="font-semibold" style={{ color: "var(--primary)" }}>{item.score}/{item.max}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.score}%`, background: "var(--primary)" }} />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default Results;
