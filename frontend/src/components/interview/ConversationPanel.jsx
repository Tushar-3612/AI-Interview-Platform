import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";

/**
 * ConversationPanel Component
 * Displays a rolling dialogue history between the AI interviewer and the candidate.
 * Auto-scrolls to the bottom on new turns.
 */
function ConversationPanel({ logs = [] }) {
  const scrollRef = useRef(null);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-card rounded-[16px] p-3 flex flex-col h-full w-full min-h-0">
      <div className="border-b pb-1 mb-2 flex items-center justify-between shrink-0" style={{ borderColor: "var(--border)" }}>
        <h3 className="font-bold text-[10px] tracking-wider uppercase text-muted">
          Conversation Log
        </h3>
        <span className="text-[8px] bg-slate-100 dark:bg-zinc-800 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0">
          Saved
        </span>
      </div>

      {/* Message scrolling panel */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted text-[10px] text-center py-4">
            <p>No speech history logged yet.</p>
          </div>
        ) : (
          logs.map((log, index) => {
            const isAI = log.sender === "AI";
            return (
              <div 
                key={index} 
                className={`flex gap-2 items-start ${isAI ? "justify-start" : "justify-end"}`}
              >
                {/* AI Icon */}
                {isAI && (
                  <div 
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-xs"
                    style={{ 
                      background: "rgba(37, 99, 235, 0.1)", 
                      borderColor: "rgba(37, 99, 235, 0.2)",
                      color: "var(--primary)"
                    }}
                  >
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Bubble content */}
                <div 
                  className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs leading-normal ${
                    isAI 
                      ? "bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-tl-sm"
                      : "bg-blue-600 text-white rounded-tr-sm"
                  }`}
                >
                  <div className="flex justify-between items-center gap-3 mb-0.5">
                    <span className={`text-[9px] font-bold tracking-wider ${isAI ? "text-slate-400" : "text-blue-200"}`}>
                      {isAI ? "INTERVIEW BOT" : "YOU"}
                    </span>
                    <span className={`text-[8px] ${isAI ? "text-slate-400" : "text-blue-200"}`}>
                      {log.time || "Just now"}
                    </span>
                  </div>
                  <p>{log.text}</p>
                </div>

                {/* Candidate Icon */}
                {!isAI && (
                  <div 
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border text-xs"
                    style={{ 
                      background: "rgba(16, 185, 129, 0.1)", 
                      borderColor: "rgba(16, 185, 129, 0.2)",
                      color: "var(--success)"
                    }}
                  >
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ConversationPanel;
