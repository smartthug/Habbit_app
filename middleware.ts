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
  
  // Check authentication status and handle token refresh
  let isAuthenticated = false;
  let response = NextResponse.next();

  // Try to verify access token first
  if (accessToken) {
    try {
      await verifyAccessTokenEdge(accessToken);
      isAuthenticated = true;
    } catch {
      // Access token expired, try to refresh using refresh token
      if (refreshToken) {
        try {
          const refreshPayload = await verifyRefreshTokenEdge(refreshToken);
          
          // Generate new access token
          const newAccessToken = await generateAccessTokenEdge({
            userId: refreshPayload.userId,
            email: refreshPayload.email,
          });

          // Set new access token cookie
          response.cookies.set("accessToken", newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 15, // 15 minutes
          });

          isAuthenticated = true;
          console.log("[MIDDLEWARE] Token refreshed automatically");
        } catch {
          // Refresh token also expired, clear cookies
          response.cookies.delete("accessToken");
          response.cookies.delete("refreshToken");
          isAuthenticated = false;
        }
      }
    }
  } else if (refreshToken) {
    // No access token but have refresh token, try to refresh
    try {
      const refreshPayload = await verifyRefreshTokenEdge(refreshToken);
      
      // Generate new access token
      const newAccessToken = await generateAccessTokenEdge({
        userId: refreshPayload.userId,
        email: refreshPayload.email,
      });

      // Set new access token cookie
      response.cookies.set("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 15, // 15 minutes
      });

      isAuthenticated = true;
      console.log("[MIDDLEWARE] Token refreshed from refresh token");
    } catch {
      // Refresh token expired, clear cookies
      response.cookies.delete("accessToken");
      response.cookies.delete("refreshToken");
      isAuthenticated = false;
    }
  }

  // If authenticated and on auth page → redirect to dashboard
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If not authenticated and on protected route → redirect to login
  if (!isAuthenticated && !isAuthRoute && !isProfileSetupRoute) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Return response with potentially updated cookies
  return response;
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
