import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/server";

// GET /api/admin/users — lista todos os usuários
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? "",
    role: u.app_metadata?.role ?? u.user_metadata?.role ?? "user",
    provider: u.app_metadata?.provider ?? "email",
    confirmed: !!u.email_confirmed_at,
    created_at: u.created_at,
    last_sign_in: u.last_sign_in_at ?? null,
  }));

  return NextResponse.json({ users });
}

// POST /api/admin/users — cria um novo usuário
export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { name, email, password, role = "user" } = await request.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nome, e-mail e senha são obrigatórios" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
    app_metadata: { role },
  });
  if (error) {
    const msg = error.message.includes("already registered")
      ? "Este e-mail já está cadastrado"
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ user: { id: data.user.id, email, name, role } });
}
