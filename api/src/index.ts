/**
 * College Baseball Sabermetrics API
 *
 * REST API + MCP server for college baseball analytics.
 * First sports analytics MCP. Powered by BSI's Savant engine.
 *
 * Routes:
 *   /v1/meta/*         — Weights, methodology, glossary (no auth)
 *   /v1/players/*      — Player lookup and stats
 *   /v1/leaderboards/* — Batting and pitching leaderboards
 *   /v1/teams/*        — Team listings and detail
 *   /v1/conferences/*  — Conference strength rankings
 *   /v1/park-factors   — Venue park factors
 *   /v1/compare/*      — Head-to-head comparison (pro)
 *   /v1/havf/*         — HAV-F composite metric (pro)
 *   /v1/mmi/*          — Momentum index (pro)
 *   /v1/compute/*      — Stateless metric computation (pro)
 *   /mcp               — MCP JSON-RPC 2.0 endpoint
 *   /health            — Health check
 */

import { Hono } from 'hono';
import type { Env, Tier } from './shared/types';
import { cors } from './middleware/cors';
import { auth } from './middleware/auth';
import { rateLimit } from './middleware/rate-limit';
import { requireTier } from './middleware/auth';
import { buildMeta } from './shared/helpers';

// Route modules
import meta from './routes/v1/meta';
import players from './routes/v1/players';
import leaderboards from './routes/v1/leaderboards';
import teams from './routes/v1/teams';
import conferences from './routes/v1/conferences';
import parkFactors from './routes/v1/park-factors';
import compare from './routes/v1/compare';
import havf from './routes/v1/havf';
import mmi from './routes/v1/mmi';
import compute from './routes/v1/compute';

// MCP
import { handleMcpRequest } from './mcp/handler';

const app = new Hono<{ Bindings: Env; Variables: { tier: Tier; apiKey?: string } }>();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use('*', cors);

// ---------------------------------------------------------------------------
// Health check (no auth, no rate limit)
// ---------------------------------------------------------------------------

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: c.env.API_VERSION || 'v1',
    environment: c.env.ENVIRONMENT || 'unknown',
    meta: buildMeta('bsi-cbb-api'),
  });
});

// ---------------------------------------------------------------------------
// Meta routes — no auth required
// ---------------------------------------------------------------------------

app.route('/v1/meta', meta);

// ---------------------------------------------------------------------------
// Auth + rate limit for all other v1 routes
// ---------------------------------------------------------------------------

app.use('/v1/*', auth);
app.use('/v1/*', rateLimit);

// ---------------------------------------------------------------------------
// Free + Pro routes (tier gating handled in route handlers)
// ---------------------------------------------------------------------------

app.route('/v1/players', players);
app.route('/v1/leaderboards', leaderboards);
app.route('/v1/teams', teams);
app.route('/v1/conferences', conferences);
app.route('/v1/park-factors', parkFactors);

// ---------------------------------------------------------------------------
// Pro-only routes
// ---------------------------------------------------------------------------

app.use('/v1/compare/*', requireTier('pro'));
app.route('/v1/compare', compare);

app.use('/v1/havf/*', requireTier('pro'));
app.route('/v1/havf', havf);

app.use('/v1/mmi/*', requireTier('pro'));
app.route('/v1/mmi', mmi);

app.use('/v1/compute/*', requireTier('pro'));
app.route('/v1/compute', compute);

// ---------------------------------------------------------------------------
// MCP endpoint
// ---------------------------------------------------------------------------

app.post('/mcp', async (c) => {
  return handleMcpRequest(c.req.raw, c.env);
});

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------

app.notFound((c) => {
  return c.json({
    error: 'Not found',
    docs: '/v1/meta/methodology',
    health: '/health',
  }, 404);
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  console.error('[cbb-api] Unhandled error:', err.message);
  return c.json({
    error: 'Internal server error',
    detail: c.env.ENVIRONMENT === 'development' ? err.message : undefined,
  }, 500);
});

export default app;
