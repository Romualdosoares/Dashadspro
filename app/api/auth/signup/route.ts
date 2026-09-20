import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { name, email, password } = await request.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Todos os campos são obrigatórios" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "A senha deve ter pelo menos 8 caracteres" }, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/login`,
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return NextResponse.json({ error: "Este e-mail já está cadastrado" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao criar conta. Tente novamente." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
