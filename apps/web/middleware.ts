import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    // TODO: Check session cookie / JWT
    // const session = request.cookies.get("pj-session");
    // if (!session) return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
