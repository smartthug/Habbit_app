import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessTokenEdge } from "./lib/jwt-edge";

// Public routes that don't require authentication
const AUTH_ROUTES = ["/auth/login", "/auth/signup"];

// Routes that require authentication but not profile setup
const PROFILE_SETUP_ROUTE = "/profile-setup";

// Routes that should be excluded from middleware
const EXCLUDED_PATHS = [
  "/_next",
  "/api/auth",
  "/favicon",
  "/api/auth/test-cookie",
  "/api/auth/debug-login",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for excluded paths
  if (EXCLUDED_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("accessToken")?.value;
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isProfileSetupRoute = pathname === PROFILE_SETUP_ROUTE;
  const isAuthenticated = token ? await verifyToken(token) : false;

  // If authenticated and on auth page → redirect to dashboard
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If not authenticated and on protected route → redirect to login
  if (!isAuthenticated && !isAuthRoute && !isProfileSetupRoute) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Allow request to proceed (profile setup check will be done in the page component)
  return NextResponse.next();
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    await verifyAccessTokenEdge(token);
    return true;
  } catch {
    return false;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
