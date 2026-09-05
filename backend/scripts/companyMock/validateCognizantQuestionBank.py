#!/usr/bin/env python3
"""
Validation script for Cognizant Company Mock Question Bank.

Usage:
    python backend/scripts/companyMock/validateCognizantQuestionBank.py
"""

import json
import os
import sys
import re
from collections import Counter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
COGNIZANT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "../../data/companyMock/cognizant"))

MCQ_FILE = os.path.join(COGNIZANT_DIR, "mcq.json")
TECH_FILE = os.path.join(COGNIZANT_DIR, "technical.json")
CODING_FILE = os.path.join(COGNIZANT_DIR, "coding.json")

FORBIDDEN_PROJECT_PATTERNS = [
    r"\byour project\b",
    r"\bin your project\b",
    r"\btell me about your\b",
    r"\bin your resume\b",
    r"\byour experience\b",
    r"\bwhat was your role\b",
    r"\bdescribe a project\b",
    r"\bpersonal experience\b",
    r"\bin your opinion\b",
    r"\bwhy did you choose\b",
]


def load_json(filepath):
    if not os.path.exists(filepath):
        print(f"[FAIL] Missing file: {filepath}")
        sys.exit(1)
    with open(filepath, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            return data
        except json.JSONDecodeError as e:
            print(f"[FAIL] JSON Decode Error in {filepath}: {e}")
            sys.exit(1)


def main():
    print("=== Validating Cognizant Company Mock Question Bank ===\n")
    errors = []
    warnings = []

    mcqs = load_json(MCQ_FILE)
    techs = load_json(TECH_FILE)
    codings = load_json(CODING_FILE)

    print(f"Loaded: {len(mcqs)} MCQs, {len(techs)} Technical questions, {len(codings)} Coding questions.")

    # 1. Target counts
    if len(mcqs) < 200:
        errors.append(f"MCQ bank has {len(mcqs)} questions, expected at least 200.")
    if len(techs) < 150:
        errors.append(f"Technical bank has {len(techs)} questions, expected at least 150.")
    if len(codings) < 30:
        errors.append(f"Coding bank has {len(codings)} questions, expected at least 30.")

    # 2. Unique IDs across all files
    all_questions = []
    for q in mcqs:
        all_questions.append(("mcq", q))
    for q in techs:
        all_questions.append(("technical", q))
    for q in codings:
        all_questions.append(("coding", q))

    id_counter = Counter()
    for category, q in all_questions:
        qid = q.get("questionId") or q.get("id")
        if not qid:
            errors.append(f"[{category}] Missing questionId: {q}")
        else:
            id_counter[qid] += 1

    for qid, count in id_counter.items():
        if count > 1:
            errors.append(f"Duplicate questionId '{qid}' found {count} times across banks.")

    # 3. Validate MCQs
    valid_marks = {"Easy": 2, "Medium": 3, "Hard": 5}
    mcq_diff_counts = Counter()
    mcq_sources = Counter()
    mcq_topics = Counter()

    for i, q in enumerate(mcqs):
        qid = q.get("questionId", f"mcq-{i}")
        diff = q.get("difficulty")
        if diff not in valid_marks:
            errors.append(f"[MCQ: {qid}] Invalid difficulty '{diff}'")
        else:
            mcq_diff_counts[diff] += 1
            if q.get("marks") != valid_marks[diff]:
                errors.append(f"[MCQ: {qid}] Marks {q.get('marks')} does not match difficulty {diff} (expected {valid_marks[diff]})")

        opts = q.get("options")
        if not isinstance(opts, list) or len(opts) != 4:
            errors.append(f"[MCQ: {qid}] Must have exactly 4 options, got {len(opts) if isinstance(opts, list) else opts}")

        ans = q.get("correctAnswer")
        if not ans or (isinstance(opts, list) and ans not in opts):
            errors.append(f"[MCQ: {qid}] correctAnswer '{ans}' must be present in options list.")

        src = q.get("source")
        if src not in ["interview_reported", "practice"]:
            errors.append(f"[MCQ: {qid}] Invalid source '{src}'. Must be 'interview_reported' or 'practice'.")
        else:
            mcq_sources[src] += 1

        if q.get("companyId") != "cognizant":
            errors.append(f"[MCQ: {qid}] companyId must be 'cognizant', got '{q.get('companyId')}'")

        cids = q.get("companyIds")
        if not isinstance(cids, list) or cids != ["cognizant"]:
            errors.append(f"[MCQ: {qid}] companyIds must be ['cognizant'], got {cids}")

        if not q.get("question") or len(q.get("question").strip()) < 10:
            errors.append(f"[MCQ: {qid}] Question text missing or too short.")

        if not q.get("explanation") or len(q.get("explanation").strip()) < 5:
            errors.append(f"[MCQ: {qid}] Missing or empty explanation.")

        topic = q.get("topic")
        if topic:
            mcq_topics[topic] += 1

    # 4. Validate Technical / TITA Questions
    tech_diff_counts = Counter()
    tech_sources = Counter()
    tech_topics = Counter()

    for i, q in enumerate(techs):
        qid = q.get("questionId", f"tech-{i}")
        diff = q.get("difficulty")
        if diff not in valid_marks:
            errors.append(f"[Technical: {qid}] Invalid difficulty '{diff}'")
        else:
            tech_diff_counts[diff] += 1
            if q.get("marks") != valid_marks[diff]:
                errors.append(f"[Technical: {qid}] Marks {q.get('marks')} does not match difficulty {diff} (expected {valid_marks[diff]})")

        if q.get("questionType") != "Technical":
            errors.append(f"[Technical: {qid}] questionType must be 'Technical', got '{q.get('questionType')}'")

        opts = q.get("options")
        if opts is not None and isinstance(opts, list) and len(opts) > 0:
            errors.append(f"[Technical: {qid}] Technical question must not have options (found {len(opts)} options).")

        expected = q.get("expectedAnswer")
        if not expected or len(str(expected).strip()) < 10:
            errors.append(f"[Technical: {qid}] expectedAnswer missing or too short (length: {len(str(expected).strip()) if expected else 0}).")

        explanation = q.get("explanation")
        if not explanation or len(str(explanation).strip()) < 10:
            errors.append(f"[Technical: {qid}] explanation missing or too short.")

        better = q.get("betterAnswer")
        if not better or len(str(better).strip()) < 10:
            errors.append(f"[Technical: {qid}] betterAnswer missing or too short.")

        src = q.get("source")
        if src not in ["interview_reported", "practice"]:
            errors.append(f"[Technical: {qid}] Invalid source '{src}'. Must be 'interview_reported' or 'practice'.")
        else:
            tech_sources[src] += 1

        if q.get("companyId") != "cognizant":
            errors.append(f"[Technical: {qid}] companyId must be 'cognizant', got '{q.get('companyId')}'")

        cids = q.get("companyIds")
        if not isinstance(cids, list) or cids != ["cognizant"]:
            errors.append(f"[Technical: {qid}] companyIds must be ['cognizant'], got {cids}")

        q_text = str(q.get("question", "")).lower()
        for pat in FORBIDDEN_PROJECT_PATTERNS:
            if re.search(pat, q_text, re.IGNORECASE):
                errors.append(f"[Technical: {qid}] Personal/project pattern detected: '{pat}' in '{q.get('question')}'")

        topic = q.get("topic")
        if topic:
            tech_topics[topic] += 1

    # 5. Validate Coding Questions
    coding_diff_counts = Counter()
    coding_sources = Counter()

    for i, q in enumerate(codings):
        qid = q.get("questionId") or q.get("id", f"coding-{i}")
        diff = q.get("difficulty")
        if diff not in ["Easy", "Medium", "Hard"]:
            errors.append(f"[Coding: {qid}] Invalid difficulty '{diff}'")
        else:
            coding_diff_counts[diff] += 1

        if q.get("marks") != 10:
            errors.append(f"[Coding: {qid}] Coding marks must be 10, got {q.get('marks')}")

        if q.get("company") != "cognizant":
            errors.append(f"[Coding: {qid}] company must be 'cognizant', got '{q.get('company')}'")

        if not q.get("title") and not q.get("problemStatement"):
            errors.append(f"[Coding: {qid}] Missing title/problemStatement.")

        if not q.get("starterCode"):
            errors.append(f"[Coding: {qid}] Missing starterCode.")

        langs = q.get("supportedLanguages")
        if not isinstance(langs, list) or len(langs) == 0:
            errors.append(f"[Coding: {qid}] Missing or empty supportedLanguages.")

        pub_tc = q.get("publicTestCases")
        if not isinstance(pub_tc, list) or len(pub_tc) < 2:
            errors.append(f"[Coding: {qid}] publicTestCases must contain >= 2 test cases, got {len(pub_tc) if isinstance(pub_tc, list) else 0}")

        hid_tc = q.get("hiddenTestCases")
        if not isinstance(hid_tc, list) or len(hid_tc) < 2:
            errors.append(f"[Coding: {qid}] hiddenTestCases must contain >= 2 test cases, got {len(hid_tc) if isinstance(hid_tc, list) else 0}")

        src = q.get("source")
        if src and src not in ["interview_reported", "practice"]:
            errors.append(f"[Coding: {qid}] Invalid source '{src}'. Must be 'interview_reported' or 'practice'.")
        elif src:
            coding_sources[src] += 1

        tl = q.get("timeLimit")
        if tl != 1000:
            errors.append(f"[Coding: {qid}] timeLimit must be 1000, got {tl}")

        ml = q.get("memoryLimit")
        if ml != 256:
            errors.append(f"[Coding: {qid}] memoryLimit must be 256, got {ml}")

    # Print Summary
    print("\n--- Question Bank Summary ---")
    print(f"MCQ Total: {len(mcqs)}")
    for d, c in sorted(mcq_diff_counts.items()):
        print(f"  - {d}: {c} ({c/len(mcqs)*100:.1f}%)")
    print(f"  Topics: {dict(mcq_topics)}")
    print(f"  Sources: interview_reported={mcq_sources.get('interview_reported', 0)}, practice={mcq_sources.get('practice', 0)}")

    print(f"\nTechnical/TITA Total: {len(techs)}")
    for d, c in sorted(tech_diff_counts.items()):
        print(f"  - {d}: {c} ({c/len(techs)*100:.1f}%)")
    print(f"  Topics: {dict(tech_topics)}")
    print(f"  Sources: interview_reported={tech_sources.get('interview_reported', 0)}, practice={tech_sources.get('practice', 0)}")

    print(f"\nCoding Total: {len(codings)}")
    for d, c in sorted(coding_diff_counts.items()):
        print(f"  - {d}: {c} ({c/len(codings)*100:.1f}%)")
    print(f"  Sources: interview_reported={coding_sources.get('interview_reported', 0)}, practice={coding_sources.get('practice', 0)}")

    print("\n--- Validation Results ---")
    if errors:
        print(f"[FAIL] Found {len(errors)} errors:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("[PASS] All validations passed successfully with 0 errors!")
        if warnings:
            print(f"Warnings ({len(warnings)}):")
            for w in warnings:
                print(f"  - {w}")
        sys.exit(0)


if __name__ == "__main__":
    main()
