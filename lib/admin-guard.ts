import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Returns the current user if they are an admin, otherwise returns a 403 response.
 * Usage: const { user, error } = await requireAdmin();
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (user.app_metadata?.role !== "admin") {
    return { user: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, response: null };
}
