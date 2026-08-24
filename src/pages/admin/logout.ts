import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../lib/auth/session';

export const POST: APIRoute = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/admin/login',
      'Set-Cookie': clearSessionCookie(),
    },
  });
};

export const GET: APIRoute = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/admin/login',
      'Set-Cookie': clearSessionCookie(),
    },
  });
};
