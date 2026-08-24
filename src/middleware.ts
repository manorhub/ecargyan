import { defineMiddleware } from 'astro:middleware';
import { verifySessionToken, getSessionCookieFromRequest } from './lib/auth/session';
import { applySecurityHeaders } from './lib/utils/security';
import { logError } from './lib/utils/logger';

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, locals } = context;

  // 1. Session resolution from cookie
  const token = getSessionCookieFromRequest(request);
  const runtimeEnv = locals.runtime?.env;

  if (token) {
    try {
      const session = await verifySessionToken(token, runtimeEnv?.SESSION_SECRET as string | undefined);
      if (session) {
        locals.admin = {
          id: session.adminId,
          email: session.email,
          role: session.role,
        };
      } else {
        locals.admin = null;
      }
    } catch (err) {
      logError('Session verification error in middleware', err);
      locals.admin = null;
    }
  } else {
    locals.admin = null;
  }

  // 2. Admin Route Protection Check
  const pathname = url.pathname;
  const isAdminRoute = pathname.startsWith('/admin');
  const isAuthWhitelisted =
    pathname === '/admin/login' ||
    pathname === '/admin/setup' ||
    pathname.startsWith('/admin/logout');

  if (isAdminRoute && !isAuthWhitelisted && !locals.admin) {
    const loginUrl = new URL('/admin/login', url.origin);
    loginUrl.searchParams.set('redirect', pathname);
    return Response.redirect(loginUrl.toString(), 302);
  }

  // 3. 301/302 Redirect Rule Matching (Public Routes)
  const db = runtimeEnv?.DB;
  if (db && !isAdminRoute && !pathname.startsWith('/api') && !pathname.startsWith('/_')) {
    try {
      const { RedirectService } = await import('./lib/seo/redirects');
      const redirectService = new RedirectService(db);
      const matched = await redirectService.matchRedirect(pathname);
      if (matched) {
        const destUrl = matched.destination.startsWith('http')
          ? matched.destination
          : new URL(matched.destination, url.origin).toString();
        return Response.redirect(destUrl, matched.statusCode);
      }
    } catch {
      // Best-effort redirect resolution
    }
  }

  // 4. Process Request
  const response = await next();

  // 5. Apply standard security headers
  return applySecurityHeaders(response);
});
