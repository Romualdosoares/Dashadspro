import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

const PUBLIC_PATHS = ["/login", "/register", "/reset-password", "/update-password", "/api/auth"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const { supabaseResponse, user } = await updateSession(request);

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname.startsWith("/admin") && user.app_metadata?.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

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
