import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowLeft, Play, Send, Loader2, Copy, Check, Maximize2, Minimize2,
  Code2, Save, CheckCircle2, XCircle, Timer, AlertTriangle,
  Bookmark, BookmarkCheck, ChevronDown, Terminal, FileText,
  History as HistoryIcon, ClipboardList,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import Button from "../../components/ui/Button";
import { SkeletonCodingRound, ErrorState } from "../../components/ui/Skeleton";

// ─── Language Configuration ──────────────────────────────────────────────────
const LANGUAGES = [
  { id: "javascript", label: "JavaScript", ext: "js" },
  { id: "python",     label: "Python",     ext: "py" },
  { id: "java",       label: "Java",       ext: "java" },
  { id: "c",          label: "C",          ext: "c" },
  { id: "cpp",        label: "C++",        ext: "cpp" },
  { id: "csharp",     label: "C#",         ext: "cs" },
  { id: "go",         label: "Go",         ext: "go" },
  { id: "rust",       label: "Rust",       ext: "rs" },
  { id: "kotlin",     label: "Kotlin",     ext: "kt" },
  { id: "php",        label: "PHP",        ext: "php" },
];

const STARTER_CODE = {
  javascript: `/**
 * @param {...any} args - Input arguments
 * @return {any}
 */
function solution(...args) {
  // Write your solution here
  
}`,
  python: `def solution(*args):
    """
    Write your solution here.
    """
    pass`,
  java: `import java.util.*;

public class Solution {
    public static Object solve(Object... args) {
        // Write your solution here
        return null;
    }
    
    public static void main(String[] args) {
        // Test your solution
        System.out.println(solve());
    }
}`,
  c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Write your solution here
int main() {
    // Read input and print output
    return 0;
}`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

// Write your solution here
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Read input and print output
    
    return 0;
}`,
  csharp: `using System;
using System.Collections.Generic;
using System.Linq;

public class Solution {
    public static object Solve(params object[] args) {
        // Write your solution here
        return null;
    }
    
    public static void Main(string[] args) {
        Console.WriteLine(Solve());
    }
}`,
  go: `package main

import "fmt"

// Write your solution here
func solution(args ...interface{}) interface{} {
    return nil
}

func main() {
    result := solution()
    fmt.Println(result)
}`,
  rust: `fn solution(args: Vec<i64>) -> i64 {
    // Write your solution here
    0
}

fn main() {
    let result = solution(vec![]);
    println!("{}", result);
}`,
  kotlin: `fun solution(vararg args: Any): Any? {
    // Write your solution here
    return null
}

fun main() {
    println(solution())
}`,
  php: `<?php

function solution(...$args) {
    // Write your solution here
    return null;
}

// Test
$result = solution();
echo $result . PHP_EOL;`,
};

const SERVER_EXECUTABLE = "javascript"; // only language that runs server-side
const DIFFICULTY_COLORS = { easy: "#22c55e", medium: "#eab308", hard: "#ef4444" };
const BOTTOM_TABS = ["Test Cases", "Custom Input", "Output", "Submissions"];

// ─── Component ────────────────────────────────────────────────────────────────
function CodingRound() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };

  // Data state
  const [questions, setQuestions]       = useState([]);
  const [activeIndex, setActiveIndex]   = useState(0);
  const [solved, setSolved]             = useState(new Set());
  const [submissions, setSubmissions]   = useState([]);

  // Editor state
  const [code, setCode]                 = useState(STARTER_CODE.javascript);
  const [language, setLanguage]         = useState("javascript");
  const [input, setInput]               = useState("");
  const [output, setOutput]             = useState(null);
  const [bottomTab, setBottomTab]       = useState("Test Cases");

  // UI state
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(false);
  const [running, setRunning]           = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [copied, setCopied]             = useState(false);
  const [fullscreen, setFullscreen]     = useState(false);
  const [draftState, setDraftState]     = useState("idle");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [langDropOpen, setLangDropOpen] = useState(false);
  const [startTime]                     = useState(Date.now());

  const draftTimerRef = useRef(null);
  const codeRef       = useRef(code);
  const langDropRef   = useRef(null);
  codeRef.current = code;

  // ─── Close lang dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (langDropRef.current && !langDropRef.current.contains(e.target)) {
        setLangDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Fetch questions ────────────────────────────────────────────────────────
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/api/coding-questions", {
        headers,
        params: { companyId: companyId || "", limit: 100 },
      });
      const list = res.data?.questions || [];
      if (list.length === 0) { setError(true); setLoading(false); return; }
      setQuestions(list);
      setActiveIndex(0);
      setCode(list[0]?.starterCode || STARTER_CODE.javascript);
      setInput(list[0]?.sampleInput || "");
      setOutput(null);

      const histRes = await api.get("/api/practice/coding/history", {
        headers,
        params: { limit: 200 },
      });
      const subs = histRes.data?.submissions || [];
      const acceptedIds = new Set(
        subs.filter((s) => s.status === "accepted").map((s) => s.questionId)
      );
      setSolved(acceptedIds);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // ─── Load draft on question change ─────────────────────────────────────────
  const loadDraft = useCallback(async (questionId, starterCode) => {
    if (!questionId) return;
    try {
      const res = await api.get(`/api/practice/coding/draft/${questionId}`, { headers });
      if (res.data?.code) {
        setCode(res.data.code);
        if (res.data.language) setLanguage(res.data.language);
      } else {
        setCode(starterCode || STARTER_CODE.javascript);
      }
    } catch {
      setCode(starterCode || STARTER_CODE.javascript);
    }
  }, []);

  useEffect(() => {
    if (questions.length === 0) return;
    const q = questions[activeIndex];
    setOutput(null);
    setBottomTab("Test Cases");
    if (q) {
      setInput(q.sampleInput || "");
      loadDraft(q._id, q.starterCode);
    }
  }, [activeIndex, questions]);

  // ─── Sync bookmark state ────────────────────────────────────────────────────
  const activeQuestion = questions[activeIndex];
  const isSolved = activeQuestion && solved.has(activeQuestion._id);

  useEffect(() => {
    if (!activeQuestion) return;
    try {
      const saved = JSON.parse(localStorage.getItem("coding_bookmarks") || "[]");
      setIsBookmarked(saved.some((q) => q._id === activeQuestion._id));
    } catch { setIsBookmarked(false); }
  }, [activeQuestion]);

  // ─── Auto-save draft ────────────────────────────────────────────────────────
  useEffect(() => {
    if (draftState === "saving" || !questions[activeIndex]) return;
    setDraftState("dirty");
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(async () => {
      try {
        setDraftState("saving");
        await api.post(
          "/api/practice/coding/draft",
          { questionId: questions[activeIndex]._id, language, code: codeRef.current },
          { headers }
        );
        setDraftState("saved");
      } catch { setDraftState("dirty"); }
    }, 1500);
  }, [code, language, activeIndex]);

  // ─── Language change — set starter code only if code is unchanged ───────────
  const handleLanguageChange = (langId) => {
    setLangDropOpen(false);
    const prevStarter = STARTER_CODE[language] || "";
    const isDefault = code.trim() === "" || code === prevStarter || code === (questions[activeIndex]?.starterCode || "");
    setLanguage(langId);
    if (isDefault) {
      setCode(STARTER_CODE[langId] || "");
    }
  };

  // ─── Bookmark toggle ────────────────────────────────────────────────────────
  const toggleBookmark = () => {
    if (!activeQuestion) return;
    try {
      const saved = JSON.parse(localStorage.getItem("coding_bookmarks") || "[]");
      const exists = saved.some((q) => q._id === activeQuestion._id);
      const updated = exists
        ? saved.filter((q) => q._id !== activeQuestion._id)
        : [...saved, {
            _id: activeQuestion._id,
            title: activeQuestion.title,
            problemStatement: activeQuestion.problemStatement,
            difficulty: activeQuestion.difficulty || "medium",
            companyId: companyId || "",
            companyName: activeQuestion.companyName || "Practice",
            tags: activeQuestion.tags || [],
          }];
      localStorage.setItem("coding_bookmarks", JSON.stringify(updated));
      setIsBookmarked(!exists);
      toast.success(exists ? "Bookmark removed" : "Question bookmarked!");
      api.post("/api/practice/bookmark", { questionId: activeQuestion._id }, { headers }).catch(() => null);
    } catch { toast.error("Failed to toggle bookmark"); }
  };

  // ─── Run code ───────────────────────────────────────────────────────────────
  const handleRun = async () => {
    setRunning(true);
    setOutput(null);
    setBottomTab("Output");
    try {
      const res = await api.post(
        "/api/practice/coding/run",
        { language, code, input },
        { headers }
      );
      setOutput({ type: "run", data: res.data });
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to run code";
      setOutput({ type: "run", data: { type: "error", output: msg, timeMs: 0 } });
    } finally { setRunning(false); }
  };

  // ─── Submit code ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!activeQuestion) return;
    setSubmitting(true);
    setOutput(null);
    setBottomTab("Output");
    try {
      const res = await api.post(
        "/api/practice/coding/submit",
        { questionId: activeQuestion._id, language, code, timeTakenMs: Date.now() - startTime },
        { headers }
      );
      setOutput({ type: "submit", data: res.data });
      if (res.data.status === "accepted") {
        toast.success("✅ All test cases passed!");
        setSolved((prev) => new Set(prev).add(activeQuestion._id));
      } else if (res.data.status === "unsupported") {
        toast.error("Server evaluation supports JavaScript. Switch to JavaScript to get a verdict.");
      }
      // refresh submissions list
      fetchSubmissionsForQuestion(activeQuestion._id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit solution");
    } finally { setSubmitting(false); }
  };

  // ─── Fetch question submissions ─────────────────────────────────────────────
  const fetchSubmissionsForQuestion = useCallback(async (questionId) => {
    if (!questionId) return;
    try {
      const res = await api.get("/api/practice/coding/history", {
        headers,
        params: { questionId, limit: 20 },
      });
      setSubmissions(res.data?.submissions || []);
    } catch { setSubmissions([]); }
  }, []);

  useEffect(() => {
    if (activeQuestion?._id) fetchSubmissionsForQuestion(activeQuestion._id);
  }, [activeQuestion]);

  // ─── Copy link ──────────────────────────────────────────────────────────────
  const copyLink = () => {
    if (!activeQuestion) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/interview-practice/${companyId}/coding?q=${activeQuestion._id}`
    ).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  // ─── Elapsed time display (live) ────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 60000)), 10000);
    return () => clearInterval(t);
  }, [startTime]);

  // ─── Loading / error states ─────────────────────────────────────────────────
  if (loading) return <SkeletonCodingRound />;

  if (error && questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorState
          statusCode="network_failure"
          message="No coding questions found for this company, or the server is unreachable."
          onRetry={fetchQuestions}
          onGoBack={() => navigate(`/interview-practice/${companyId}`)}
        />
      </div>
    );
  }

  // ─── Active language label ──────────────────────────────────────────────────
  const activeLang = LANGUAGES.find((l) => l.id === language) || LANGUAGES[0];

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col overflow-hidden"
          : "flex flex-col"
      }
      style={{
        background: "var(--bg-color)",
        height: fullscreen ? "100vh" : "calc(100vh - 64px)",
        minHeight: 0,
      }}
    >
      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2 border-b shrink-0 flex-wrap"
        style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
      >
        <button
          type="button"
          onClick={() => navigate(`/interview-practice/${companyId}`)}
          className="flex items-center gap-1.5 text-sm font-medium cursor-pointer hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Rounds
        </button>

        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1">
            <Timer className="w-3.5 h-3.5" />
            {elapsed} min
          </span>
          {draftState === "saved" && (
            <span className="flex items-center gap-1 text-green-500 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          {draftState === "dirty" && (
            <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <Save className="w-3.5 h-3.5" /> Saving…
            </span>
          )}
          <button
            type="button"
            onClick={copyLink}
            className="p-1.5 rounded-lg cursor-pointer hover:opacity-80"
            title="Copy problem link"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            className="p-1.5 rounded-lg cursor-pointer hover:opacity-80"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen
              ? <Minimize2 className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              : <Maximize2 className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            }
          </button>
        </div>
      </div>

      {/* ── Main split layout ── */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── LEFT: Problem statement ── */}
        <div
          className="lg:w-[42%] flex flex-col overflow-y-auto border-r"
          style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
        >
          {/* Question tabs */}
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-0 flex-wrap shrink-0">
            {questions.map((q, idx) => {
              const active = idx === activeIndex;
              const done = solved.has(q._id);
              return (
                <button
                  key={q._id || idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className="w-8 h-8 rounded-lg text-xs font-bold cursor-pointer transition mb-2"
                  style={{
                    background: active ? "#6366f1" : done ? "rgba(34,197,94,0.12)" : "var(--input-bg)",
                    color: active ? "#fff" : done ? "#22c55e" : "var(--text-secondary)",
                    border: active ? "2px solid #6366f1" : "1px solid var(--border)",
                  }}
                  title={q.title}
                >
                  {done && !active ? "✓" : idx + 1}
                </button>
              );
            })}
          </div>

          {/* Problem details */}
          {activeQuestion && (
            <div className="px-4 py-3 flex-1">
              {/* Title row */}
              <div className="flex items-start gap-2 mb-3 flex-wrap">
                <h1 className="text-base font-bold flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>
                  {activeQuestion.title}
                </h1>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-lg capitalize"
                    style={{
                      background: `${DIFFICULTY_COLORS[(activeQuestion.difficulty || "easy").toLowerCase()]}18`,
                      color: DIFFICULTY_COLORS[(activeQuestion.difficulty || "easy").toLowerCase()],
                    }}
                  >
                    {activeQuestion.difficulty}
                  </span>
                  {isSolved && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
                      <CheckCircle2 className="w-3 h-3 inline mr-0.5" />Solved
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={toggleBookmark}
                    className="p-1.5 rounded-lg cursor-pointer transition hover:scale-110"
                    aria-label="Bookmark question"
                  >
                    {isBookmarked
                      ? <BookmarkCheck className="w-4 h-4" style={{ color: "var(--primary)" }} />
                      : <Bookmark className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                    }
                  </button>
                </div>
              </div>

              {/* Problem statement */}
              <p className="text-sm mb-4 leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
                {activeQuestion.problemStatement}
              </p>

              {/* Constraints */}
              {activeQuestion.constraints && (
                <div className="p-3 rounded-xl mb-4 text-xs whitespace-pre-wrap" style={{ background: "var(--input-bg)", color: "var(--text-secondary)" }}>
                  <span className="font-semibold block mb-1" style={{ color: "var(--text-primary)" }}>Constraints</span>
                  {activeQuestion.constraints}
                </div>
              )}

              {/* Sample I/O */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl text-xs" style={{ background: "var(--input-bg)" }}>
                  <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Sample Input</p>
                  <pre className="overflow-x-auto" style={{ color: "var(--text-secondary)" }}>{activeQuestion.sampleInput || "—"}</pre>
                </div>
                <div className="p-3 rounded-xl text-xs" style={{ background: "var(--input-bg)" }}>
                  <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Sample Output</p>
                  <pre className="overflow-x-auto" style={{ color: "var(--text-secondary)" }}>{activeQuestion.sampleOutput || "—"}</pre>
                </div>
              </div>

              {/* Tags */}
              {activeQuestion.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {activeQuestion.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--input-bg)", color: "var(--text-muted)" }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Editor + bottom panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>

          {/* Editor toolbar */}
          <div
            className="flex items-center justify-between px-3 py-1.5 border-b shrink-0"
            style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
          >
            {/* Language selector */}
            <div className="relative" ref={langDropRef}>
              <button
                type="button"
                onClick={() => setLangDropOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-80 transition border"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                }}
              >
                <Code2 className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                {activeLang.label}
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>

              <AnimatePresence>
                {langDropOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.1 }}
                    className="absolute left-0 top-full mt-1 z-50 rounded-xl border shadow-xl py-1 min-w-[130px]"
                    style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
                  >
                    {LANGUAGES.map((lang) => {
                      const isServerSupported = lang.id === SERVER_EXECUTABLE;
                      return (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => handleLanguageChange(lang.id)}
                          className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-[var(--border)]/30 transition flex items-center justify-between gap-2"
                          style={{
                            color: language === lang.id ? "var(--primary)" : "var(--text-primary)",
                            background: language === lang.id ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "transparent",
                          }}
                        >
                          <span>{lang.label}</span>
                          {isServerSupported && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                              RUN
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Run / Submit buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRun}
                disabled={running || !activeQuestion}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-85 transition disabled:opacity-50"
                style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}
              >
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {running ? "Running…" : "Run"}
              </button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || running || !activeQuestion}
                className="px-3 py-1.5 text-xs"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 inline" /> : <Send className="w-3.5 h-3.5 mr-1 inline" />}
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            </div>
          </div>

          {/* Code editor area */}
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="w-full h-full resize-none outline-none p-4 font-mono text-[13px] leading-6"
              style={{
                background: "var(--code-bg, #0d0d0d)",
                color: "#e2e8f0",
                minHeight: 0,
                display: "block",
              }}
              placeholder="// Write your solution here"
            />
          </div>

          {/* ── Bottom tabbed panel ── */}
          <div
            className="shrink-0 border-t flex flex-col"
            style={{ borderColor: "var(--border)", background: "var(--card-bg)", height: 200 }}
          >
            {/* Tab bar */}
            <div className="flex items-center border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              {BOTTOM_TABS.map((tab) => {
                const icons = {
                  "Test Cases":   <ClipboardList className="w-3.5 h-3.5" />,
                  "Custom Input": <FileText       className="w-3.5 h-3.5" />,
                  "Output":       <Terminal       className="w-3.5 h-3.5" />,
                  "Submissions":  <HistoryIcon    className="w-3.5 h-3.5" />,
                };
                const active = bottomTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setBottomTab(tab)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium cursor-pointer transition border-b-2"
                    style={{
                      borderBottomColor: active ? "var(--primary)" : "transparent",
                      color: active ? "var(--primary)" : "var(--text-muted)",
                    }}
                  >
                    {icons[tab]} {tab}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-3" style={{ minHeight: 0 }}>
              {/* ── Test Cases ── */}
              {bottomTab === "Test Cases" && (
                <div className="space-y-1.5">
                  {(activeQuestion?.testCases || []).filter((tc) => !tc.isHidden).length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>No visible test cases for this question.</p>
                  ) : (
                    (activeQuestion?.testCases || []).filter((tc) => !tc.isHidden).map((tc, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--input-bg)", color: "var(--text-secondary)" }}>
                        <Code2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                        <span className="font-mono truncate">In: {tc.input}</span>
                        <span className="mx-1">→</span>
                        <span className="font-mono truncate">Out: {tc.expected}</span>
                      </div>
                    ))
                  )}
                  {(activeQuestion?.testCases || []).some((tc) => tc.isHidden) && (
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                      + Hidden test cases are evaluated on submit.
                    </p>
                  )}
                </div>
              )}

              {/* ── Custom Input ── */}
              {bottomTab === "Custom Input" && (
                <div className="space-y-2">
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {language === SERVER_EXECUTABLE
                      ? "Pass args as JSON array, e.g. [12, 35, 1]"
                      : `Custom input is for JavaScript only. Switch to JavaScript to run.`}
                  </p>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    spellCheck={false}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none"
                    style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    placeholder='[12, 35, 1, 10, 34, 1]'
                  />
                  <button
                    type="button"
                    onClick={handleRun}
                    disabled={running || !activeQuestion}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-85 transition disabled:opacity-50"
                    style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}
                  >
                    {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {running ? "Running…" : "Run with Input"}
                  </button>
                </div>
              )}

              {/* ── Output ── */}
              {bottomTab === "Output" && (
                output === null ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Run your code to see output here. Submit to evaluate against all test cases.
                  </p>
                ) : output.type === "run" ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                      <Play className="w-3.5 h-3.5" style={{ color: "#6366f1" }} />
                      Run Result
                      {output.data.timeMs > 0 && (
                        <span className="font-normal" style={{ color: "var(--text-muted)" }}>({output.data.timeMs}ms)</span>
                      )}
                    </p>
                    {output.data.type === "info" ? (
                      <pre className="text-xs font-mono whitespace-pre-wrap rounded-lg p-3" style={{ background: "rgba(234,179,8,0.08)", color: "#eab308" }}>
                        {output.data.output}
                      </pre>
                    ) : output.data.type === "success" ? (
                      <pre className="text-xs font-mono whitespace-pre-wrap rounded-lg p-3" style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e" }}>
                        {output.data.output || "(empty output)"}
                      </pre>
                    ) : (
                      <pre className="text-xs font-mono whitespace-pre-wrap rounded-lg p-3" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                        {output.data.output || "Error"}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p
                      className="text-xs font-semibold flex items-center gap-1.5"
                      style={{ color: output.data.status === "accepted" ? "#22c55e" : "var(--text-primary)" }}
                    >
                      {output.data.status === "accepted"
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <XCircle className="w-4 h-4 text-red-500" />}
                      {output.data.status === "accepted" ? "Accepted" : "Wrong Answer"}
                      {" · "}{output.data.passedCount}/{output.data.totalCount} passed
                    </p>
                    {(output.data.results || []).map((tc, idx) => (
                      <div
                        key={idx}
                        className="text-xs rounded-lg p-2.5"
                        style={{
                          background: tc.passed ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
                          color: tc.passed ? "#22c55e" : "#ef4444",
                        }}
                      >
                        <span className="font-semibold">
                          Test {idx + 1} {tc.isHidden ? "(Hidden)" : ""} · {tc.passed ? "Passed" : "Failed"}
                          {tc.timeMs > 0 && <span className="font-normal opacity-80"> · {tc.timeMs}ms</span>}
                        </span>
                        {!tc.passed && (
                          <div className="mt-1 font-mono whitespace-pre-wrap opacity-90 text-[11px]">
                            {tc.error ? <span>{tc.error}</span> : (
                              <>
                                <div>Input: {tc.input}</div>
                                <div>Expected: {tc.expected}</div>
                                <div>Got: {tc.actual}</div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {output.data.status === "unsupported" && (
                      <p className="text-xs flex items-center gap-1.5 mt-2" style={{ color: "#eab308" }}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Server evaluation supports JavaScript only. Switch to JavaScript for full verdict.
                      </p>
                    )}
                  </div>
                )
              )}

              {/* ── Submissions ── */}
              {bottomTab === "Submissions" && (
                submissions.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>No submissions for this question yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {submissions.map((sub, idx) => (
                      <div
                        key={sub._id || idx}
                        className="flex items-center gap-3 text-xs px-3 py-2 rounded-lg"
                        style={{ background: "var(--input-bg)" }}
                      >
                        {sub.status === "accepted"
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                        <span
                          className="font-semibold capitalize"
                          style={{ color: sub.status === "accepted" ? "#22c55e" : "#ef4444" }}
                        >
                          {sub.status}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>{sub.language}</span>
                        <span style={{ color: "var(--text-muted)" }}>{sub.passedCount}/{sub.totalCount}</span>
                        <span className="ml-auto" style={{ color: "var(--text-muted)" }}>
                          {new Date(sub.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CodingRound;
