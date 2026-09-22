import type { PlatformRole } from "./auth-role";

export type DashboardHeaderAction = "admin" | "crm" | "logout";

export function getDashboardHeaderActions(role: PlatformRole | undefined): DashboardHeaderAction[] {
  return role === "admin" ? ["admin", "crm", "logout"] : ["crm", "logout"];
}
