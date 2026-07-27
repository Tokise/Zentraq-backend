import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isStudent, isAdmin } from "@/lib/auth/roles"
import { NextResponse } from "next/server"

export async function proxy(request: Request) {
  const { pathname } = new URL(request.url)

  // Skip public routes
  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg")
  ) {
    return NextResponse.next()
  }

  // For dashboard routes, check auth and redirect accordingly
  if (pathname.startsWith("/dashboard")) {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    const userRole = await getUserRole(user.id)

    if (isStudent(userRole)) {
      // If student tries to access /admin, redirect to student portal
      if (pathname.startsWith("/dashboard/admin")) {
        return NextResponse.redirect(new URL("/student", request.url))
      }
      return NextResponse.next()
    }

    if (isAdmin(userRole)) {
      return NextResponse.next()
    }

    // For nurse/doctor, continue
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/student/:path*"],
}
