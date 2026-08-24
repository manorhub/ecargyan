/**
 * Server-side Admin Route Protection Guard
 * Validates session in locals or cookie, redirects unauthorized requests.
 */

import { verifySessionToken, getSessionCookieFromRequest } from './session';
import type { AdminSession } from './session';

export interface AuthGuardResult {
  isAuthenticated: boolean;
  admin: AdminSession | null;
  redirectResponse: Response | null;
}

/**
 * Protect an admin route. If the session is invalid, returns a redirect response to /admin/login.
 */
export async function requireAdminAuth(
  request: Request,
  runtimeEnv?: { SESSION_SECRET?: string } | null,
  localsAdmin?: { id: string; email: string; role: string } | null
): Promise<AuthGuardResult> {
  // If locals already populated valid admin
  if (localsAdmin) {
    return {
      isAuthenticated: true,
      admin: {
        adminId: localsAdmin.id,
        email: localsAdmin.email,
        role: localsAdmin.role,
        expiresAt: Date.now() + 1000 * 60 * 60,
      },
      redirectResponse: null,
    };
  }

  const token = getSessionCookieFromRequest(request);
  if (!token) {
    const url = new URL(request.url);
    const redirectUrl = `/admin/login?redirect=${encodeURIComponent(url.pathname)}`;
    return {
      isAuthenticated: false,
      admin: null,
      redirectResponse: new Response(null, {
        status: 302,
        headers: { Location: redirectUrl },
      }),
    };
  }

  const session = await verifySessionToken(token, runtimeEnv?.SESSION_SECRET);
  if (!session) {
    const url = new URL(request.url);
    const redirectUrl = `/admin/login?redirect=${encodeURIComponent(url.pathname)}`;
    return {
      isAuthenticated: false,
      admin: null,
      redirectResponse: new Response(null, {
        status: 302,
        headers: { Location: redirectUrl },
      }),
    };
  }

  return {
    isAuthenticated: true,
    admin: session,
    redirectResponse: null,
  };
}
