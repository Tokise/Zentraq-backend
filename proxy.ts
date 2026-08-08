import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getDefaultRouteForRole,
  isRoleRoute,
} from "@/lib/auth/role-routes";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const COOKIE_NAME = "zentraq_session_token";

function setSecurityHeaders(response: NextResponse): NextResponse {
  // Anti-cache headers for sensitive medical/clinic pages
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js")
  ) {
    return NextResponse.next();
  }

  // Create Edge-compatible Supabase client
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // 1. Verify session with the Supabase Auth server (JWT validation)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const isAuthPage = pathname === "/login";
  const isKioskPage = pathname.startsWith("/rfid-kiosk");
  const isUnauthorizedPage = pathname === "/unauthorized";
  const isSettingsPage = pathname.startsWith("/settings");
  // Routes accessible by ALL authenticated roles (SAD §5.2)
  const isSharedRoute =
    isKioskPage || isUnauthorizedPage || isSettingsPage || isAuthPage;

  // Unauthenticated access check
  if (!user || error) {
    if (!isAuthPage && !isKioskPage && !isUnauthorizedPage) {
      const loginUrl = new URL("/login", request.url);
      const redirectResponse = NextResponse.redirect(loginUrl);
      return setSecurityHeaders(redirectResponse);
    }
    return supabaseResponse;
  }

  // Extract HttpOnly session token cookie
  const clientSessionToken = request.cookies.get(COOKIE_NAME)?.value;

  // 2. Validate one-device login session token & determine role via SAD tables.
  let userRole:
    | "admin"
    | "doctor"
    | "nurse"
    | "student"
    | "faculty"
    | "staff"
    | null = null;
  let isValidSessionToken = false;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const [{ data: session }, { data: assignments }] = await Promise.all([
        admin
          .from("user_sessions")
          .select("id")
          .eq("user_id", user.id)
          .eq("session_token", clientSessionToken ?? "")
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle(),
        admin
          .from("user_roles")
          .select("role:roles(name)")
          .eq("user_id", user.id)
          .limit(1),
      ]);
      isValidSessionToken = Boolean(session);
      const relation = assignments?.[0]?.role as unknown;
      const role = Array.isArray(relation) ? relation[0] : relation;
      const name =
        typeof role === "object" && role !== null && "name" in role
          ? (role as { name?: unknown }).name
          : null;
      if (
        name === "admin" ||
        name === "doctor" ||
        name === "nurse" ||
        name === "student" ||
        name === "faculty" ||
        name === "staff"
      )
        userRole = name;
    }
  } catch {
    // If DB check fails due to connectivity, allow basic session check to proceed
    isValidSessionToken = true;
  }

  // 3. Handle One-Device Session Invalidation
  if (
    (!isValidSessionToken || !userRole) &&
    !isAuthPage &&
    !isKioskPage &&
    !isUnauthorizedPage
  ) {
    // Session token mismatched or cleared elsewhere -> force logout and redirect to login
    const loginUrl = new URL("/login?reason=session_invalidated", request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.cookies.delete(COOKIE_NAME);
    return setSecurityHeaders(redirectResponse);
  }

  // Redirect authenticated users away from login to their own dashboard.
  if (isAuthPage) {
    if (!userRole) {
      return setSecurityHeaders(supabaseResponse);
    }
    return setSecurityHeaders(
      NextResponse.redirect(
        new URL(getDefaultRouteForRole(userRole), request.url),
      ),
    );
  }

  // 4. Role-Based Access Control (RBAC) Enforcement per SAD §5.2
  // Each role can only access its own top-level route tree

  // Shared routes (settings, kiosk, unauthorized) are allowed for all authenticated users
  if (isSharedRoute) {
    return setSecurityHeaders(supabaseResponse);
  }

  if (userRole) {
    if (isRoleRoute(userRole, pathname)) {
      return setSecurityHeaders(supabaseResponse);
    }
    return setSecurityHeaders(
      NextResponse.redirect(
        new URL(getDefaultRouteForRole(userRole), request.url),
      ),
    );
  }

  return setSecurityHeaders(supabaseResponse);
}

// Export middleware as alias for Next.js convention while retaining proxy
export { proxy as middleware };

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
