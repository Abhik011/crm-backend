/** Jira-style workflow statuses (canonical). */
export const ISSUE_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
];

const LEGACY_STATUS_MAP = {
  Todo: "todo",
  "In Progress": "in_progress",
  Done: "done",
};

export function normalizeStatus(status) {
  if (status == null || status === "") return "backlog";
  if (LEGACY_STATUS_MAP[status]) return LEGACY_STATUS_MAP[status];
  if (ISSUE_STATUSES.includes(status)) return status;
  return "backlog";
}

export function isDoneStatus(status) {
  return normalizeStatus(status) === "done";
}

export function coerceStatusForWrite(status) {
  const n = normalizeStatus(status);
  return ISSUE_STATUSES.includes(n) ? n : "backlog";
}
