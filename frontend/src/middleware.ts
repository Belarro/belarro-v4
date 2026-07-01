import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and public routes
  if (pathname === '/login' || pathname === '/' || pathname.startsWith('/api/auth/login')) {
    return NextResponse.next();
  }

  // Check for session cookie on protected routes
  const sessionToken = request.cookies.get('belarro_session')?.value;

  if (!sessionToken && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)',
  ],
};
