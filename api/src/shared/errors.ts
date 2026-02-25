import { json } from './helpers';

/** Standard error response. */
export function errorResponse(message: string, status: number, detail?: string): Response {
  return json({ error: message, ...(detail && { detail }) }, status);
}

export function notFound(resource: string, id: string): Response {
  return errorResponse(`${resource} not found`, 404, `id: ${id}`);
}

export function badRequest(message: string): Response {
  return errorResponse(message, 400);
}

export function unauthorized(message: string = 'API key required'): Response {
  return json({ error: message, docs: 'https://api.blazesportsintel.com/v1/meta/methodology' }, 401);
}

export function forbidden(message: string = 'Invalid API key'): Response {
  return errorResponse(message, 403);
}

export function paymentRequired(message: string = 'Pro tier required'): Response {
  return json({ error: message, upgrade: 'https://blazesportsintel.com/pro' }, 402);
}

export function rateLimited(retryAfter: number): Response {
  return json(
    { error: 'Rate limit exceeded', retry_after_seconds: retryAfter },
    429,
    { 'Retry-After': String(retryAfter) },
  );
}

export function serverError(message: string): Response {
  return errorResponse('Internal server error', 500, message);
}
