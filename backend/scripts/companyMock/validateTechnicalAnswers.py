#!/usr/bin/env python3
"""
Validate Company Mock technical reference answers.

Usage:
    python validateTechnicalAnswers.py
    python validateTechnicalAnswers.py --json ../data/companyMock/celebal/technical.json

Checks:
  1. All 210 questions present
  2. Each question has expectedAnswer, explanation, betterAnswer
  3. No empty or suspiciously short fields
  4. No duplicate questionIds
  5. ExpectedAnswer length is reasonable (5–500 chars)
  6. Report summary with pass/fail
"""

import json
import sys
import os
from collections import Counter

DEFAULT_PATH = os.path.join(
    os.path.dirname(__file__),
    "..", "..", "data", "companyMock", "celebal", "technical.json"
)

REQUIRED_FIELDS = ["expectedAnswer", "explanation", "betterAnswer"]
MIN_ANSWER_LEN = 5
MAX_ANSWER_LEN = 1500  # Reference answers can be detailed
EXPECTED_COUNT = 210


def load_questions(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Handle both array and { questions: [...] } shapes
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "questions" in data:
        return data["questions"]
    raise ValueError("Unrecognised JSON structure — expected array or { questions: [...] }")


def validate(questions):
    errors = []
    warnings = []

    # 1. Count
    if len(questions) != EXPECTED_COUNT:
        errors.append(f"Expected {EXPECTED_COUNT} questions, found {len(questions)}")

    # 2. Duplicate check
    id_counts = Counter(q.get("questionId") or q.get("_id") or q.get("id") for q in questions)
    dupes = {qid: cnt for qid, cnt in id_counts.items() if cnt > 1}
    if dupes:
        for qid, cnt in dupes.items():
            errors.append(f"Duplicate questionId '{qid}' appears {cnt} times")

    # 3. Per-question validation
    for i, q in enumerate(questions):
        qid = q.get("questionId") or q.get("_id") or q.get("id") or f"(index {i})"
        tag = f"Q{i+1} [{qid}]"

        for field in REQUIRED_FIELDS:
            val = q.get(field)
            if val is None:
                errors.append(f"{tag}: missing '{field}'")
            elif not isinstance(val, str):
                errors.append(f"{tag}: '{field}' is not a string")
            elif len(val.strip()) == 0:
                errors.append(f"{tag}: '{field}' is empty")
            elif field == "expectedAnswer" and len(val.strip()) < MIN_ANSWER_LEN:
                warnings.append(f"{tag}: expectedAnswer very short ({len(val.strip())} chars)")
            elif field == "expectedAnswer" and len(val.strip()) > MAX_ANSWER_LEN:
                warnings.append(f"{tag}: expectedAnswer very long ({len(val.strip())} chars)")

        # Check question text exists
        text = q.get("question") or q.get("questionText") or q.get("text")
        if not text or (isinstance(text, str) and len(text.strip()) == 0):
            warnings.append(f"{tag}: missing or empty question text")

    return errors, warnings


def main():
    path = DEFAULT_PATH
    if len(sys.argv) > 2 and sys.argv[1] == "--json":
        path = sys.argv[2]

    print(f"Loading: {os.path.abspath(path)}")
    questions = load_questions(path)
    print(f"Loaded {len(questions)} questions\n")

    errors, warnings = validate(questions)

    if warnings:
        print("=== WARNINGS ===")
        for w in warnings:
            print(f"  [WARN] {w}")
        print()

    if errors:
        print("=== ERRORS ===")
        for e in errors:
            print(f"  [FAIL] {e}")
        print(f"\nResult: FAILED — {len(errors)} error(s), {len(warnings)} warning(s)")
        sys.exit(1)
    else:
        print(f"Result: PASSED — {len(questions)} questions, 0 errors, {len(warnings)} warning(s)")
        sys.exit(0)


if __name__ == "__main__":
    main()
