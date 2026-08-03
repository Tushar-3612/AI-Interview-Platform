import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Results — placement interview performance summary.
 */
function Results() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const res = await fetch("http://localhost:5000/api/interview/user/results", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (!res.ok) throw new Error("Failed to fetch results");
        
        const data = await res.json();
        setResults(data);
      } catch (error) {
        console.error(error);
        toast.error("Could not load interview results");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchResults();
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">No Results Yet</h2>
        <p className="text-sm text-slate-500">Complete an interview to see your performance metrics here.</p>
      </div>
    );
  }

  // Use the most recent result for the main display
  const latestResult = results[0];

  const chartData = [
    { category: "Technical", score: latestResult.technicalScore || 0, max: 100 },
    { category: "Resume", score: latestResult.resumeScore || 0, max: 100 },
    { category: "Coding", score: latestResult.codingScore || 0, max: 100 },
  ];

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
          <p className="text-4xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>{latestResult.overallScore}%</p>
          <div className="flex items-center justify-center gap-1 mt-2 text-xs" style={{ color: "var(--success)" }}>
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{latestResult.recommendation}</span>
          </div>
        </div>

        <div className="space-y-4">
          {chartData.map((item, i) => (
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
        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="student-card p-5 border-l-4" style={{ borderLeftColor: "var(--success)" }}>
            <h3 className="font-semibold mb-2">Strengths</h3>
            <ul className="text-sm list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
              {latestResult.strengths?.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div className="student-card p-5 border-l-4" style={{ borderLeftColor: "var(--error)" }}>
            <h3 className="font-semibold mb-2">Areas for Improvement</h3>
            <ul className="text-sm list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
              {latestResult.weaknesses?.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Results;
