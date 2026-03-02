import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessTokenEdge, verifyRefreshTokenEdge } from "./lib/jwt-edge";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for excluded paths
  if (EXCLUDED_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("accessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isProfileSetupRoute = pathname === PROFILE_SETUP_ROUTE;
  
  let isAuthenticated = false;

  // Verify access token
  if (accessToken) {
    try {
      await verifyAccessTokenEdge(accessToken);
      isAuthenticated = true;
    } catch {
      // Access token expired, check if refresh token exists
      // Token refresh will be handled by getCurrentUser() in server components
      if (refreshToken) {
        try {
          await verifyRefreshTokenEdge(refreshToken);
          isAuthenticated = true; // Refresh token valid, allow through
        } catch {
          isAuthenticated = false;
        }
      }
    }
  } else if (refreshToken) {
    // No access token, check refresh token
    try {
      await verifyRefreshTokenEdge(refreshToken);
      isAuthenticated = true; // Refresh token valid, allow through
    } catch {
      isAuthenticated = false;
    }
  }

  // Handle redirects
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isAuthenticated && !isAuthRoute && !isProfileSetupRoute) {
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
