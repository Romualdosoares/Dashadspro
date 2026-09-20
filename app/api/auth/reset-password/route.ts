import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "E-mail é obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/update-password`,
  });

  if (error) {
    return NextResponse.json({ error: "Erro ao enviar e-mail de redefinição." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
