export type PlatformRole = "admin" | "user";

export type RoleUser = {
  app_metadata?: unknown;
  user_metadata?: unknown;
};

export function getPlatformRole(user: RoleUser): PlatformRole {
  if (!Object.prototype.hasOwnProperty.call(user, "app_metadata")) {
    return "user";
  }

  const appMetadata = user.app_metadata;

  if (
    typeof appMetadata === "object" &&
    appMetadata !== null &&
    Object.prototype.hasOwnProperty.call(appMetadata, "role") &&
    (appMetadata as { role?: unknown }).role === "admin"
  ) {
    return "admin";
  }

  return "user";
}
