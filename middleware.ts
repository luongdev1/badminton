import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "./lib/admin-session";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/admin/login" || pathname === "/auth/callback") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login") return NextResponse.next({ request });

  if (pathname === "/share" || pathname.startsWith("/share/") || pathname === "/api/public-share") {
    const response = NextResponse.next({ request });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!await verifyAdminSessionToken(token)) return redirectToLogin(request);

  const response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "login");
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (next !== "/") loginUrl.searchParams.set("next", next);
  const response = NextResponse.redirect(loginUrl);
  response.headers.set("Cache-Control", "private, no-store");
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
