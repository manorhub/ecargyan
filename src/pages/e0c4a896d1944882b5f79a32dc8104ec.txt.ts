import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  return new Response('e0c4a896d1944882b5f79a32dc8104ec', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
