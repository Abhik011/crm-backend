/**
 * @param {string[]} roles — allowed User.role values
 */
export default function requireRole(roles = []) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ message: "Access denied", code: "FORBIDDEN_ROLE" });
    }
    next();
  };
}
