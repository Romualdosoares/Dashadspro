type CrmPageUser = {
  email?: string | null;
  user_metadata?: {
    full_name?: unknown;
    name?: unknown;
  } | null;
};

export type CrmPageState =
  | { kind: "redirect"; href: "/login" }
  | { kind: "content"; userName: string; userEmail: string | null };

export function getCrmPageState(user: CrmPageUser | null): CrmPageState {
  if (!user) {
    return { kind: "redirect", href: "/login" };
  }

  const metadata = user.user_metadata ?? {};
  const userName = [metadata.full_name, metadata.name, user.email].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  )?.trim() ?? "Usuário";

  return {
    kind: "content",
    userName,
    userEmail: typeof user.email === "string" ? user.email : null,
  };
}
