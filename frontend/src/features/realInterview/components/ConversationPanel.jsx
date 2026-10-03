import React, { useEffect, useRef } from "react";
import { MessageSquareText, Bot, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ConversationPanel — Dark live transcript / closed-captioning box.
 *
 * Props:
 *   logs  {Array<{sender: string, text: string, time: string}>}
 */
function ConversationPanel({ logs = [] }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div
      className="flex flex-col h-full overflow-hidden rounded-2xl"
      style={{
        background: "rgba(8, 10, 18, 0.9)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <MessageSquareText className="w-3.5 h-3.5 text-blue-400" />
        <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
          Live Transcript
        </h3>
        {logs.length > 0 && (
          <span
            className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(37,99,235,0.15)",
              color: "rgba(96,165,250,0.9)",
            }}
          >
            {logs.length}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        <AnimatePresence initial={false}>
          {logs.length > 0 ? (
            logs.map((log, idx) => {
              const isAI = log.sender !== "Candidate";
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`flex flex-col ${isAI ? "items-start" : "items-end"}`}
                >
                  {/* Sender + time */}
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    {isAI ? (
                      <Bot className="w-3 h-3 text-blue-400" />
                    ) : (
                      <User className="w-3 h-3 text-emerald-400" />
                    )}
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: isAI ? "rgba(96,165,250,0.8)" : "rgba(52,211,153,0.8)" }}
                    >
                      {isAI ? "Alex AI" : "You"}
                    </span>
                    <span className="text-[9px] text-white/25">{log.time}</span>
                  </div>

                  {/* Bubble */}
                  <div
                    className={`text-[11px] leading-relaxed px-3 py-2.5 max-w-[88%] ${
                      isAI ? "caption-ai" : "caption-user"
                    }`}
                  >
                    <span className="text-white/80">{log.text}</span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 py-8">
              <MessageSquareText className="w-8 h-8 text-white/10" />
              <p className="text-[11px] text-white/25 text-center">
                Conversation will appear here in real-time…
              </p>
            </div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default ConversationPanel;
