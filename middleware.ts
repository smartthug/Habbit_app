import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessTokenEdge, verifyRefreshTokenEdge, generateAccessTokenEdge } from "./lib/jwt-edge";

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

// Helper function to refresh token and set cookie
async function refreshAndSetToken(
  refreshToken: string,
  response: NextResponse
): Promise<{ success: boolean; userId?: string; email?: string }> {
  try {
    const refreshPayload = await verifyRefreshTokenEdge(refreshToken);
    const newAccessToken = await generateAccessTokenEdge({
      userId: refreshPayload.userId,
      email: refreshPayload.email,
    });

    response.cookies.set("accessToken", newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });

    return { success: true, userId: refreshPayload.userId, email: refreshPayload.email };
  } catch {
    response.cookies.delete("accessToken");
    response.cookies.delete("refreshToken");
    return { success: false };
  }
}

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
  let response = NextResponse.next();

  // Verify access token
  if (accessToken) {
    try {
      await verifyAccessTokenEdge(accessToken);
      isAuthenticated = true;
    } catch {
      // Access token expired, try refresh
      if (refreshToken) {
        const refreshResult = await refreshAndSetToken(refreshToken, response);
        isAuthenticated = refreshResult.success;
      }
    }
  } else if (refreshToken) {
    // No access token, try refresh
    const refreshResult = await refreshAndSetToken(refreshToken, response);
    isAuthenticated = refreshResult.success;
  }

  // Handle redirects
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isAuthenticated && !isAuthRoute && !isProfileSetupRoute) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return response;
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
