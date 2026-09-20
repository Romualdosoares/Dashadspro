import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

const PUBLIC_PATHS = ["/login", "/register", "/reset-password", "/update-password", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas passam direto (sem verificar sessão)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Rotas de API nunca são redirecionadas para páginas
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Atualiza a sessão Supabase (renova token se necessário) e obtém o usuário
  const { supabaseResponse, user } = await updateSession(request);

  // Sem usuário autenticado → login
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Rota raiz com sessão → dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Rota /admin → apenas admins
  if (pathname.startsWith("/admin")) {
    if (user.app_metadata?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Usuário Facebook sem conta selecionada → forçar seleção
  const selectedAccountId = user.user_metadata?.selected_ad_account_id;
  const isFacebookUser = user.app_metadata?.provider === "facebook";
  if (
    isFacebookUser &&
    !selectedAccountId &&
    !pathname.startsWith("/select-account")
  ) {
    return NextResponse.redirect(new URL("/select-account", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico)$).*)",
  ],
};
