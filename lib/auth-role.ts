export type PlatformRole = "admin" | "user";

export type RoleUser = {
  app_metadata?: unknown;
  user_metadata?: unknown;
};

export function getPlatformRole(user: RoleUser): PlatformRole {
  if (
    typeof user.app_metadata === "object" &&
    user.app_metadata !== null &&
    "role" in user.app_metadata &&
    user.app_metadata.role === "admin"
  ) {
    return "admin";
  }

  return "user";
}
