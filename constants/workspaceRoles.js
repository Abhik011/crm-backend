/** All valid Mongo `User.role` values for a workspace. */
export const WORKSPACE_ROLES = [
  "super_admin",
  "admin",
  "manager",
  "employee",
  "viewer",
  "sales",
  "developer",
  "finance",
];

/** Roles a super admin may assign when inviting (cannot bootstrap another super admin via API). */
export const INVITE_ROLES = [
  "admin",
  "manager",
  "employee",
  "viewer",
  "sales",
  "developer",
  "finance",
];
