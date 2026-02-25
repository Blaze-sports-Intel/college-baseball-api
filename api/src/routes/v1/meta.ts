import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import {
  MLB_WOBA_WEIGHTS,
  DEFAULT_LEAGUE_CONTEXT,
  HAVF_WEIGHTS,
  MMI_WEIGHTS,
  METRIC_GLOSSARY,
  METHODOLOGY,
} from '@bsi/college-baseball-analytics';
import { buildMeta, cachedJson } from '../../shared/helpers';
import { badRequest } from '../../shared/errors';

const meta = new Hono<{ Bindings: Env }>();

/**
 * GET /v1/meta/weights
 * Current wOBA linear weights, FIP constant, league context, and component weights.
 * No auth required — public reference data.
 */
meta.get('/weights', (c) => {
  return cachedJson({
    data: {
      woba_weights: MLB_WOBA_WEIGHTS,
      league_context: DEFAULT_LEAGUE_CONTEXT,
      havf_weights: HAVF_WEIGHTS,
      mmi_weights: MMI_WEIGHTS,
      caveat: 'V1 ships with MLB-derived weights as D1 proxy. D1-specific calibration is a future deliverable.',
    },
    meta: buildMeta('bsi-cbb-api'),
  }, 200, 3600);
});

/**
 * GET /v1/meta/methodology
 * Detailed formulas and explanations for every metric.
 */
meta.get('/methodology', (c) => {
  return cachedJson({
    data: METHODOLOGY,
    meta: buildMeta('bsi-cbb-api'),
  }, 200, 3600);
});

/**
 * GET /v1/meta/methodology/:metric
 * Methodology for a single metric.
 */
meta.get('/methodology/:metric', (c) => {
  const metric = c.req.param('metric');
  const entry = METHODOLOGY[metric];
  if (!entry) {
    return badRequest(`Unknown metric: ${metric}. Available: ${Object.keys(METHODOLOGY).join(', ')}`);
  }
  return cachedJson({
    data: entry,
    meta: buildMeta('bsi-cbb-api'),
  }, 200, 3600);
});

/**
 * GET /v1/meta/glossary
 * Human-readable definitions for all metrics.
 */
meta.get('/glossary', (c) => {
  return cachedJson({
    data: METRIC_GLOSSARY,
    meta: buildMeta('bsi-cbb-api'),
  }, 200, 3600);
});

/**
 * GET /v1/meta/glossary/:metric
 * Glossary entry for a single metric.
 */
meta.get('/glossary/:metric', (c) => {
  const metric = c.req.param('metric');
  const entry = METRIC_GLOSSARY[metric];
  if (!entry) {
    return badRequest(`Unknown metric: ${metric}. Available: ${Object.keys(METRIC_GLOSSARY).join(', ')}`);
  }
  return cachedJson({
    data: entry,
    meta: buildMeta('bsi-cbb-api'),
  }, 200, 3600);
});

export default meta;
