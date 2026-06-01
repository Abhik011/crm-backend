export function issuePrefixFromName(name) {
  const raw = String(name || "PRJ")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let prefix = raw.map((w) => w[0]).join("").slice(0, 5);
  if (prefix.length < 2) {
    prefix = String(name || "PRJ")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 5);
  }
  if (prefix.length < 2) prefix = "PRJ";
  return prefix.slice(0, 8);
}

export function normalizeIssuePrefix(input, fallbackName) {
  const fromInput = String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8)
    .trim();
  if (fromInput.length >= 2) return fromInput;
  return issuePrefixFromName(fallbackName);
}
