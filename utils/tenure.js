/**
 * Tenure from account createdAt: days + hour on a 1–24 clock (resets each day).
 */
export function companyTenureFromCreatedAt(createdAt, now = new Date()) {
  if (!createdAt) return null;
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return null;

  const ms = Math.max(0, now.getTime() - start.getTime());
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hour = (totalHours % 24) + 1;

  return {
    days,
    hour,
    label: `${days} ${days === 1 ? "day" : "days"} · ${hour} hr`,
    shortLabel: `${days}d · ${hour}h`,
  };
}
