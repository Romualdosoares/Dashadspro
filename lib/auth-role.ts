export type PlatformRole = "admin" | "user";

type UserMetadata = { role?: unknown };

export type RoleUser = {
  app_metadata?: UserMetadata | null;
  user_metadata?: UserMetadata | null;
};

export function getPlatformRole(user: RoleUser): PlatformRole {
  return user.app_metadata?.role === "admin" ? "admin" : "user";
}
