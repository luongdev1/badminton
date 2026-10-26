import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedPath = request.nextUrl.searchParams.get("next");
  const next = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/admin/login?error=link", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/admin/login?error=link", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
