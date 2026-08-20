import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = (request: NextRequest) => {
  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  );

  return { supabase, supabaseResponse };
};

export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse } = createClient(request);

  // IMPORTANT: Use getUser() instead of getSession() for security.
  // getUser() verifies the JWT with the Supabase Auth server.
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    // error is ignored
  }

  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  const isKioskPage = request.nextUrl.pathname.startsWith('/rfid-kiosk');
  const isProtectedPage = !isAuthPage && !isKioskPage;

  // If no user and trying to access protected pages, redirect to login
  if (!user && isProtectedPage) {
     return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user is authenticated and trying to access login, redirect to root
  if (user && isAuthPage) {
     return NextResponse.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};