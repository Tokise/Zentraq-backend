import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const COOKIE_NAME = "zentraq_session_token"

function setSecurityHeaders(response: NextResponse): NextResponse {
  // Anti-cache headers for sensitive medical/clinic pages
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0")
  response.headers.set("Pragma", "no-cache")
  response.headers.set("Expires", "0")
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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
    return NextResponse.next()
  }

  // Create Edge-compatible Supabase client
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // 1. Verify session with the Supabase Auth server (JWT validation)
  const { data: { user }, error } = await supabase.auth.getUser()

  const isAuthPage = pathname === "/login"
  const isKioskPage = pathname.startsWith("/rfid-kiosk")

  // Unauthenticated access check
  if (!user || error) {
    if (!isAuthPage && !isKioskPage) {
      const loginUrl = new URL("/login", request.url)
      const redirectResponse = NextResponse.redirect(loginUrl)
      return setSecurityHeaders(redirectResponse)
    }
    return supabaseResponse
  }

  // Extract HttpOnly session token cookie
  const clientSessionToken = request.cookies.get(COOKIE_NAME)?.value

  // 2. Validate one-device login session token & determine role via database
  let userRole = "nurse"
  let isValidSessionToken = false

  try {
    const { createClient } = await import("@supabase/supabase-js")
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      // Check clinic_accounts
      const { data: clinicData } = await admin
        .from("clinic_accounts")
        .select("role, current_session_token")
        .eq("id", user.id)
        .maybeSingle()

      if (clinicData) {
        userRole = String(clinicData.role).toLowerCase()
        isValidSessionToken = !!clientSessionToken && clinicData.current_session_token === clientSessionToken
      } else {
        // Check student_accounts
        const { data: studentData } = await admin
          .from("student_accounts")
          .select("id, current_session_token")
          .eq("user_id", user.id)
          .maybeSingle()

        if (studentData) {
          userRole = "student"
          isValidSessionToken = !!clientSessionToken && studentData.current_session_token === clientSessionToken
        }
      }
    }
  } catch {
    // If DB check fails due to connectivity, allow basic session check to proceed
    isValidSessionToken = true
  }

  // 3. Handle One-Device Session Invalidation
  if (!isValidSessionToken && !isAuthPage && !isKioskPage) {
    // Session token mismatched or cleared elsewhere -> force logout and redirect to login
    const loginUrl = new URL("/login?reason=session_invalidated", request.url)
    const redirectResponse = NextResponse.redirect(loginUrl)
    redirectResponse.cookies.delete(COOKIE_NAME)
    return setSecurityHeaders(redirectResponse)
  }

  // If user is authenticated and trying to access /login, redirect to their role dashboard
  if (isAuthPage) {
    const defaultRoute = userRole === "student" ? "/student" : userRole === "admin" ? "/admin/rfid-registration" : "/"
    return setSecurityHeaders(NextResponse.redirect(new URL(defaultRoute, request.url)))
  }

  // 4. Role-Based Access Control (RBAC) Enforcement
  if (userRole === "student") {
    // Students can ONLY access /student routes
    if (!pathname.startsWith("/student")) {
      return setSecurityHeaders(NextResponse.redirect(new URL("/student", request.url)))
    }
  } else {
    // Staff/Doctors/Nurses trying to access student portal -> redirect to main dashboard
    if (pathname.startsWith("/student")) {
      return setSecurityHeaders(NextResponse.redirect(new URL("/", request.url)))
    }

    // Non-admin staff trying to access /admin routes -> redirect to main dashboard
    if (pathname.startsWith("/admin") && userRole !== "admin") {
      return setSecurityHeaders(NextResponse.redirect(new URL("/", request.url)))
    }
  }

  return setSecurityHeaders(supabaseResponse)
}

// Export middleware as alias for Next.js convention while retaining proxy
export { proxy as middleware }

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
