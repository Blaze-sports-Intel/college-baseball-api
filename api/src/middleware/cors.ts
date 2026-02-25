import type { Context, Next } from 'hono';

/** CORS middleware — open for API consumption. */
export async function cors(c: Context, next: Next) {
  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  await next();

  c.res.headers.set('Access-Control-Allow-Origin', '*');
}
