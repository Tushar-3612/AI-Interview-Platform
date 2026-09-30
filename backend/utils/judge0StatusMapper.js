/**
 * Centralized Judge0 status mapper
 * Standardizes Judge0 execution results into platform-wide status constants.
 */
export const STATUS_CODES = {
  ACCEPTED: "ACCEPTED",
  WRONG_ANSWER: "WRONG_ANSWER",
  TIME_LIMIT_EXCEEDED: "TIME_LIMIT_EXCEEDED",
  COMPILATION_ERROR: "COMPILATION_ERROR",
  RUNTIME_ERROR: "RUNTIME_ERROR",
  MEMORY_LIMIT_EXCEEDED: "MEMORY_LIMIT_EXCEEDED",
  EXECUTION_ERROR: "EXECUTION_ERROR",
};

export function mapJudge0Status(statusId, description = "") {
  const id = Number(statusId);

  switch (id) {
    case 3:
      return STATUS_CODES.ACCEPTED;
    case 4:
      return STATUS_CODES.WRONG_ANSWER;
    case 5:
      return STATUS_CODES.TIME_LIMIT_EXCEEDED;
    case 6:
      return STATUS_CODES.COMPILATION_ERROR;
    case 7: // Runtime Error (SIGSEGV)
    case 8: // Runtime Error (SIGXFSZ)
    case 9: // Runtime Error (SIGFPE)
    case 10: // Runtime Error (SIGABRT)
    case 11: // Runtime Error (NZEC)
    case 12: // Runtime Error (Other)
      return STATUS_CODES.RUNTIME_ERROR;
    case 14:
      return STATUS_CODES.MEMORY_LIMIT_EXCEEDED;
    default:
      if (String(description).toLowerCase().includes("memory")) {
        return STATUS_CODES.MEMORY_LIMIT_EXCEEDED;
      }
      if (String(description).toLowerCase().includes("time")) {
        return STATUS_CODES.TIME_LIMIT_EXCEEDED;
      }
      return STATUS_CODES.EXECUTION_ERROR;
  }
}
