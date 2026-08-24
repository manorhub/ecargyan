import type { APIRoute } from 'astro';
import { getStorage } from '../../../lib/cloudflare/r2';

export const GET: APIRoute = async ({ params, locals }) => {
  const key = params.key;
  if (!key) {
    return new Response('Not Found', { status: 404 });
  }

  const storageService = getStorage(locals.runtime?.env);
  if (!storageService) {
    return new Response('Storage unavailable', { status: 503 });
  }

  const object = await storageService.get(key);
  if (!object) {
    return new Response('Media Not Found', { status: 404 });
  }

  const headers = new Headers();
  if (object.httpMetadata?.contentType) {
    headers.set('Content-Type', object.httpMetadata.contentType);
  } else {
    headers.set('Content-Type', 'application/octet-stream');
  }

  if (object.httpMetadata?.cacheControl) {
    headers.set('Cache-Control', object.httpMetadata.cacheControl);
  } else {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  headers.set('ETag', object.httpEtag);

  return new Response(object.body as unknown as BodyInit, {
    status: 200,
    headers,
  });
};
