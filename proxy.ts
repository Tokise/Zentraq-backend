import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

function setNoCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0")
  response.headers.set("Pragma", "no-cache")
  response.headers.set("Expires", "0")
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip public routes and static assets
  if (
    pathname === "/login" ||
    pathname.startsWith("/rfid-kiosk") ||
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

  // Create Supabase client for middleware (Edge-compatible)
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

  // Verify session with the Supabase Auth server (secure check)
  const { data: { user }, error } = await supabase.auth.getUser()

  // If no session / unauthenticated user, force redirect to /login
  if (!user || error) {
    const loginUrl = new URL("/login", request.url)
    const redirectResponse = NextResponse.redirect(loginUrl)
    return setNoCacheHeaders(redirectResponse)
  }

  // Lightweight role check using admin client (Edge-compatible, uses env vars only)
  try {
    const { createClient } = await import("@supabase/supabase-js")
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      // Check clinic_accounts for role
      const { data: clinicData } = await admin
        .from("clinic_accounts")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()

      let userRole: string = "nurse"

      if (clinicData?.role) {
        userRole = String(clinicData.role).toLowerCase()
      } else {
        // Check if student
        const { data: studentData } = await admin
          .from("student_accounts")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle()

        if (studentData) {
          userRole = "student"
        }
      }

      // Role-based access control
      if (userRole === "student") {
        // Students can only access /student routes
        if (!pathname.startsWith("/student")) {
          const studentUrl = new URL("/student", request.url)
          return setNoCacheHeaders(NextResponse.redirect(studentUrl))
        }
      } else {
        // Clinic staff trying to access /student route -> redirect to home
        if (pathname.startsWith("/student")) {
          const rootUrl = new URL("/", request.url)
          return setNoCacheHeaders(NextResponse.redirect(rootUrl))
        }

        // Non-admin trying to access admin routes -> redirect to home
        if (pathname.startsWith("/admin") && userRole !== "admin") {
          const rootUrl = new URL("/", request.url)
          return setNoCacheHeaders(NextResponse.redirect(rootUrl))
        }
      }
    }
  } catch {
    // If role check fails, allow through — layouts will catch it
  }

  // Apply anti-cache headers to all protected pages
  return setNoCacheHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
