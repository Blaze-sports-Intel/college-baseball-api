import { Hono } from 'hono';
import type { Env, Tier } from '../../shared/types';
import {
  computeFullBattingLine,
  computeFullPitchingLine,
  computeEstimatedBatting,
  DEFAULT_LEAGUE_CONTEXT,
  MLB_WOBA_WEIGHTS,
} from '@bsi/college-baseball-analytics';
import type { BattingLine, PitchingLine } from '@bsi/college-baseball-analytics';
import { buildMeta } from '../../shared/helpers';
import { badRequest } from '../../shared/errors';

const compute = new Hono<{ Bindings: Env; Variables: { tier: Tier } }>();

/**
 * POST /v1/compute/batting
 * Stateless: raw batting stats in → full advanced metrics out.
 * Pro tier required.
 *
 * Body: { pa, ab, h, doubles, triples, hr, bb, hbp, so, sf, parkFactor? }
 */
compute.post('/batting', async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const required = ['pa', 'ab', 'h', 'doubles', 'triples', 'hr', 'bb', 'hbp', 'so', 'sf'];
  for (const field of required) {
    if (typeof body[field] !== 'number') {
      return badRequest(`Missing or invalid field: ${field} (must be a number)`);
    }
  }

  const stats: BattingLine = {
    pa: body.pa as number,
    ab: body.ab as number,
    h: body.h as number,
    doubles: body.doubles as number,
    triples: body.triples as number,
    hr: body.hr as number,
    bb: body.bb as number,
    hbp: body.hbp as number,
    so: body.so as number,
    sf: body.sf as number,
  };

  const parkFactor = typeof body.parkFactor === 'number' ? body.parkFactor : 1.0;
  const advanced = computeFullBattingLine(stats, DEFAULT_LEAGUE_CONTEXT, parkFactor, MLB_WOBA_WEIGHTS);

  // Also compute estimated metrics
  const hrRate = stats.ab > 0 ? stats.hr / stats.ab : 0;
  const estimated = computeEstimatedBatting(
    advanced.babip,
    advanced.iso,
    hrRate,
    advanced.kPct,
    advanced.bbPct,
  );

  return c.json({
    data: {
      input: stats,
      advanced,
      estimated,
      weights_used: MLB_WOBA_WEIGHTS,
      league_context: DEFAULT_LEAGUE_CONTEXT,
      park_factor: parkFactor,
    },
    meta: buildMeta('bsi-cbb-api-compute', false, 'pro'),
  });
});

/**
 * POST /v1/compute/pitching
 * Stateless: raw pitching stats in → full advanced metrics out.
 * Pro tier required.
 *
 * Body: { ip, h, er, hr, bb, hbp, so, fb?, parkFactor? }
 */
compute.post('/pitching', async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const required = ['ip', 'h', 'er', 'hr', 'bb', 'hbp', 'so'];
  for (const field of required) {
    if (typeof body[field] !== 'number') {
      return badRequest(`Missing or invalid field: ${field} (must be a number)`);
    }
  }

  const stats: PitchingLine = {
    ip: body.ip as number,
    h: body.h as number,
    er: body.er as number,
    hr: body.hr as number,
    bb: body.bb as number,
    hbp: body.hbp as number,
    so: body.so as number,
    ...(typeof body.fb === 'number' && { fb: body.fb as number }),
  };

  const parkFactor = typeof body.parkFactor === 'number' ? body.parkFactor : 1.0;
  const advanced = computeFullPitchingLine(stats, DEFAULT_LEAGUE_CONTEXT, parkFactor);

  return c.json({
    data: {
      input: stats,
      advanced,
      league_context: DEFAULT_LEAGUE_CONTEXT,
      park_factor: parkFactor,
    },
    meta: buildMeta('bsi-cbb-api-compute', false, 'pro'),
  });
});

export default compute;
