import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// PATCH /api/admin/users/[id] — edita nome, role ou senha
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const body = await request.json();

  const ALLOWED_ROLES = ["admin", "user"];
  if (body.role !== undefined && !ALLOWED_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Função inválida" }, { status: 400 });
  }
  if (body.password !== undefined && body.password.length < 8) {
    return NextResponse.json({ error: "Senha deve ter pelo menos 8 caracteres" }, { status: 400 });
  }

  const updates: Record<string, any> = {};
  const userMetaUpdates: Record<string, any> = {};
  const appMetaUpdates: Record<string, any> = {};

  if (body.password) updates.password = body.password;
  if (body.name !== undefined) userMetaUpdates.full_name = body.name;
  if (body.role !== undefined) appMetaUpdates.role = body.role;
  if (Object.keys(userMetaUpdates).length > 0) updates.user_metadata = userMetaUpdates;
  if (Object.keys(appMetaUpdates).length > 0) updates.app_metadata = appMetaUpdates;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.updateUserById(id, updates);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.full_name ?? "",
      role: data.user.app_metadata?.role ?? data.user.user_metadata?.role ?? "user",
    },
  });
}

// DELETE /api/admin/users/[id] — remove usuário
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: adminUser, response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;

  // Prevent admin from deleting themselves
  if (adminUser!.id === id) {
    return NextResponse.json({ error: "Não é possível excluir sua própria conta" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
