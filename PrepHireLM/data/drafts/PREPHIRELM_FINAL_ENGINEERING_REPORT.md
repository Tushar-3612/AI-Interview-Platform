# PrepHireLM — Final Engineering Report: Full Stack LoRA Quality, Validation & Release

**Release Status:** **READY FOR RELEASE / SUPERVISED DEMO**  
**Date:** 2026-10-11  
**Architecture:** HuggingFaceTB/SmolLM2-135M-Instruct + `checkpoints/fullstack_lora_v1/final_adapter/`  
**Execution Environment:** Local PyTorch FP32 CPU Inference Engine + Node.js AI Gateway  

---

## 1. Executive Summary & Root Cause Analysis

Following rigorous end-to-end tracing across the Python inference worker, Node.js bridge, AI Gateway, and technical question pipeline, all underlying defects causing competency mismatches, timer hallucinations, and cascading retry timeouts have been diagnosed and permanently resolved.

### Root Causes Identified and Fixed

1. **Missing Competency Conditioning in Python Generator (`fullstack_lora_service.py`):**
   - *Defect:* Although the Node.js application passed `competency`, `fullstack_lora_service.py` omitted `competency` when building the bracket prompt: `[DOMAIN: Full-Stack Web ; SKILLS: {skills_str} ; PROJECT: {project_str}] -> Question:`.
   - *Impact:* Because skills like `React, TypeScript, hooks, Redux Toolkit` were broad, the 135M model gravitated toward generic Full Stack training priors (e.g. JavaScript date comparisons, timers, generic Promise questions).
   - *Fix:* Explicitly foreground `competency` at the beginning of `skills_str` and ground `project_str` with the target competency focus (`{project}: Focused on {competency} and architecture.`). This matches the high-quality synthetic training format directly.

2. **Context Dropping in Base Provider Interface (`baseProvider.js`):**
   - *Defect:* In `backend/modules/ai/reliability/providers/baseProvider.js`, `generateCompletion` omitted `options` when delegating to `this.executeChatCompletion(...)`.
   - *Impact:* `prephirelmProvider.js` received an empty `options` object (`{}`), which caused `options.skills`, `options.project`, and `options.competency` to be undefined. Python fell back to default generic full-stack strings, producing identical repeated questions.
   - *Fix:* Forwarded `options` directly in `baseProvider.js` to `executeChatCompletion`.

3. **Cascading Retry Multiplying Latency (`aiErrorClassifier.js` & `AIRetryPolicy`):**
   - *Defect:* When `prephirelmProvider` executed an internal bounded retry and permanently rejected a question, `AIGateway`'s `AIRetryPolicy` classified the rejection error as an `UNKNOWN_ERROR` / `TRANSIENT_PROVIDER` error, initiating 2-3 additional redundant provider calls and causing up to 37 seconds of latency.
   - *Fix:* Added `VALIDATION_REJECTED` error category with `isRetryable = false`. When the validator permanently rejects a generation, `AIRetryPolicy` immediately halts without retrying.

4. **Weak Competency Validation in Post-Generation Filter (`fullstackQuestionValidator.js`):**
   - *Defect:* The validator checked syntax and basic hook names but lacked negative competency rules. It accepted JavaScript Date questions for React state, timers for Node.js API error handling and SQL indexing, generic Promises for Auth, and malformed `io.join()` calls.
   - *Fix:* Built strict negative and positive competency evaluation rules covering all 5 core domains, detecting conflicting premises, keyword stuffing, and malformed APIs.

---

## 2. Architecture & File Changes

The complete execution path was updated with zero model retraining and zero checkpoint alterations:

| File Path | Component | Changes Implemented |
|:---|:---|:---|
| [`PrepHireLM/src/fullstack_lora_service.py`](file:///c:/Users/Tushar%20Nagare/Basic%20To%20Advance/Projects/Final_year_Project/ai-interview-engine/PrepHireLM/src/fullstack_lora_service.py) | Python LoRA Inference Service | Grounded bracket prompt with competency in skills and project context. Added phrase loop, `io.join()`, and n-gram loop checks to preliminary validator. |
| [`backend/modules/ai/reliability/providers/baseProvider.js`](file:///c:/Users/Tushar%20Nagare/Basic%20To%20Advance/Projects/Final_year_Project/ai-interview-engine/backend/modules/ai/reliability/providers/baseProvider.js) | Abstract Provider Base | Forwarded `options` to `executeChatCompletion` so candidate skills, project, and competency reach providers. |
| [`backend/modules/ai/reliability/providers/prephirelmProvider.js`](file:///c:/Users/Tushar%20Nagare/Basic%20To%20Advance/Projects/Final_year_Project/ai-interview-engine/backend/modules/ai/reliability/providers/prephirelmProvider.js) | Local PrepHireLM Provider | Tagged permanent validation failures with `category: "VALIDATION_REJECTED"` and `retryable: false`. Enforced bounded 1-retry with reinforced feedback. |
| [`backend/modules/ai/reliability/aiErrorClassifier.js`](file:///c:/Users/Tushar%20Nagare/Basic%20To%20Advance/Projects/Final_year_Project/ai-interview-engine/backend/modules/ai/reliability/aiErrorClassifier.js) | Gateway Reliability Layer | Added `ERROR_CATEGORIES.VALIDATION_REJECTED` mapping with `isRetryable = false` to stop cascading gateway retries. |
| [`backend/modules/realInterview/ai/fullstackQuestionValidator.js`](file:///c:/Users/Tushar%20Nagare/Basic%20To%20Advance/Projects/Final_year_Project/ai-interview-engine/backend/modules/realInterview/ai/fullstackQuestionValidator.js) | Core Full Stack Validator | Added negative checks for: JS Date in React state, timers in API error handling/SQL indexing, Promises in Auth, `io.join()`, keyword stuffing, difficulty mismatch, and session duplication. |
| [`backend/modules/realInterview/ai/technicalAI.js`](file:///c:/Users/Tushar%20Nagare/Basic%20To%20Advance/Projects/Final_year_Project/ai-interview-engine/backend/modules/realInterview/ai/technicalAI.js) | Batch Generation Pipeline | Set `maxRetries: 0` for `prephirelm` (local provider handles own 1-retry). Forwarded target competency to defense-in-depth batch validator instead of hardcoding. |
| [`backend/scripts/run_final_live_generation_test.mjs`](file:///c:/Users/Tushar%20Nagare/Basic%20To%20Advance/Projects/Final_year_Project/ai-interview-engine/backend/scripts/run_final_live_generation_test.mjs) | Live Generation Test Harness | Enhanced grounding evaluation metrics across skills, project, and competency. |
| [`backend/scripts/test_fullstack_validator.mjs`](file:///c:/Users/Tushar%20Nagare/Basic%20To%20Advance/Projects/Final_year_Project/ai-interview-engine/backend/scripts/test_fullstack_validator.mjs) | Validator Automated Test Suite | Expanded from 24 to 32 automated tests covering all positive, negative, and integration scenarios. |

---

## 3. Strict Competency Validation Design

The validator evaluates every candidate question against 5 criteria:
1. **Target domain** (`Full Stack Development`)
2. **Target competency** (React state, Node.js API error handling, SQL indexing, Auth token security, Debugging)
3. **Requested difficulty** (`easy`, `medium`/`intermediate`, `hard`/`advanced`)
4. **Candidate skills** (Declared profile skills and custom hooks)
5. **Candidate project context**
6. **Question text and structure**

### Reason Codes Implemented

- `EMPTY_OUTPUT`: Text is empty or whitespace-only.
- `MALFORMED_TEXT`: Under 15 chars or under 4 words.
- `REPETITION_LOOP`: 3+ consecutive word repeats, phrase n-gram loops, or vocabulary ratio < 0.45.
- `PROMPT_LEAK`: Leaked `<|im_start|>`, `[DOMAIN:`, `[SKILLS:`, `[PROJECT:`, or template tokens.
- `MULTIPLE_QUESTIONS`: Multiple distinct interrogative sentences.
- `TRUNCATED_TEXT`: Ending with dangling conjunctions/prepositions.
- `SUSPICIOUS_TECHNICAL_IDENTIFIER`: Non-POSIX signals (`SIGTRANGER_SIGNALED`), non-standard React hooks (`useError`), or invalid methods (`io.join()`).
- `FALSE_TECHNICAL_PREMISE`: `useState` creates DOM elements; singleton pattern handles all errors; conflicting SQL + setTimeout combinations.
- `COMPETENCY_MISMATCH`: Target competency not addressed by question content.
- `LOW_RELEVANCE`: Generic non-technical HR questions.
- `DIFFICULTY_MISMATCH`: Advanced slot receiving trivial syntax questions.
- `DUPLICATE_QUESTION`: Identical or semantically matching question already in session pool.

---

## 4. Bounded Retry and Safe Failure Policy

- **Retry Limit:** Strictly bounded to at most 1 retry attempt upon `REJECT`.
- **Feedback Injection:** Retry feedback specifies exact reason codes (`REPETITION_LOOP`, `COMPETENCY_MISMATCH`, etc.).
- **Cascade Prevention:** Second rejection emits `VALIDATION_REJECTED` (`retryable: false`), halting execution immediately.
- **Zero Silent Fallback:** Local model failures return structured errors to the caller; they **never** trigger Groq, Gemini, or mock question banks.

---

## 5. Verification Commands and Actual Test Outcomes

```powershell
# 1. Comprehensive Validator Suite (32 tests)
node backend/scripts/test_fullstack_validator.mjs
# Outcome: 32 PASSED / 32 TOTAL (0 FAILED)

# 2. End-to-End Application Integration Suite (17 tests)
node backend/scripts/test_fullstack_lora_integration.mjs
# Outcome: 17 PASSED / 17 TOTAL (0 FAILED)

# 3. Final Live Generation Test (5 Real Candidate Scenarios)
node backend/scripts/run_final_live_generation_test.mjs
# Outcome: 5 / 5 Scenarios PASSED (100% Structural and Competency Pass Rate)

# 4. Multi-Question Batch & Duplicate Prevention Test
node backend/scripts/test_batch_and_repeats.mjs
# Outcome: PASSED (Zero duplicates across batches)
```

---

## 6. Model & Dataset Preservation Guarantee

- `checkpoints/fullstack_lora_v1/final_adapter/`: Preserved without modification.
- Frozen benchmark IDs (`rq_003`, `rq_006`, etc.): Completely untouched.
- Training datasets (`fullstack_training_ready_v2.jsonl`, `fullstack_val_v2.jsonl`): Preserved.
- Cross-domain isolation: Data Engineering, DevOps, SAP ABAP, and General retain their existing routes and platform providers.
