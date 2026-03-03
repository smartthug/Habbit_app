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
 * Validates cookie existence and format (non-empty strings) without heavy JWT verification
 * Actual token verification happens in server components for better error handling
 * This keeps middleware lightweight and compatible with Edge Runtime
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for excluded paths
  if (EXCLUDED_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for authentication cookies and validate they're non-empty strings
  // This prevents invalid/empty cookies from passing through
  const accessToken = request.cookies.get("accessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;
  const hasValidAccessToken = accessToken && accessToken.length > 0;
  const hasValidRefreshToken = refreshToken && refreshToken.length > 0;
  const hasAuthCookies = hasValidAccessToken || hasValidRefreshToken;
  
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isProfileSetupRoute = pathname === PROFILE_SETUP_ROUTE;

  // If authenticated (has valid cookies) and on auth page → redirect to dashboard
  if (hasAuthCookies && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If not authenticated (no valid cookies) and on protected route → redirect to login
  // Also clear invalid cookies if they exist
  if (!hasAuthCookies && !isAuthRoute && !isProfileSetupRoute) {
    const response = NextResponse.redirect(new URL("/auth/login", request.url));
    
    // Clear invalid/empty cookies if they exist
    if (accessToken === "" || refreshToken === "") {
      response.cookies.delete("accessToken");
      response.cookies.delete("refreshToken");
    }
    
    return response;
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
