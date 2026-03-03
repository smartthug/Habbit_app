import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const AUTH_ROUTES = ["/auth/login", "/auth/signup"];

// Routes that require authentication but not profile setup
const PROFILE_SETUP_ROUTE = "/profile-setup";

// Routes that should be excluded from middleware
const EXCLUDED_PATHS = [
  "/_next",
  "/api",
  "/favicon",
];

/**
 * Minimal middleware for Vercel Edge Runtime
 * Only checks for cookie existence - actual authentication happens in server components
 * This keeps middleware lightweight and compatible with Edge Runtime
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for excluded paths
  if (EXCLUDED_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for authentication cookies (no verification - that happens in server components)
  const hasAccessToken = request.cookies.has("accessToken");
  const hasRefreshToken = request.cookies.has("refreshToken");
  const hasAuthCookies = hasAccessToken || hasRefreshToken;
  
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isProfileSetupRoute = pathname === PROFILE_SETUP_ROUTE;

  // If authenticated (has cookies) and on auth page → redirect to dashboard
  if (hasAuthCookies && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If not authenticated (no cookies) and on protected route → redirect to login
  if (!hasAuthCookies && !isAuthRoute && !isProfileSetupRoute) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
