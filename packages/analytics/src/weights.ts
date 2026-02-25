/**
 * Default weights and league context constants.
 *
 * MLB-derived until D1-specific calibration is available.
 * Documented as a known caveat — the methodology page explains the gap
 * and the plan to close it with D1 play-by-play data.
 */

import type { WOBAWeights, LeagueContext } from './types';

/**
 * MLB linear weights (2024 season). Used as proxy for D1.
 * Ships with V1; D1-specific weights are a V2 deliverable.
 */
export const MLB_WOBA_WEIGHTS: WOBAWeights = {
  wBB: 0.69,
  wHBP: 0.72,
  w1B: 0.89,
  w2B: 1.24,
  w3B: 1.56,
  wHR: 2.01,
};

/**
 * Default league context — MLB 2024 as baseline.
 * Used when D1 league-wide aggregates are unavailable.
 * The sync worker will compute actual D1 context once data accumulates.
 */
export const DEFAULT_LEAGUE_CONTEXT: LeagueContext = {
  woba: 0.310,
  obp: 0.314,
  avg: 0.243,
  slg: 0.396,
  era: 4.17,
  runsPerPA: 0.112,
  wobaScale: 1.194,
  fipConstant: 3.186,
  hrFBRate: 0.116,
};

/** HAV-F component weights. */
export const HAVF_WEIGHTS = {
  H: 0.30,
  A: 0.25,
  V: 0.25,
  F: 0.20,
} as const;

/** MMI component weights. */
export const MMI_WEIGHTS = {
  SD: 0.40,
  RS: 0.30,
  GP: 0.15,
  BS: 0.15,
} as const;

/** MMI magnitude classification thresholds. */
export const MAGNITUDE_THRESHOLDS = {
  low: 25,
  medium: 50,
  high: 75,
} as const;

/**
 * Metric glossary — human-readable definitions for every metric.
 * Consumed by /v1/meta/glossary and cbb_glossary MCP tool.
 */
export const METRIC_GLOSSARY: Record<string, { name: string; formula: string; description: string; tier: 'free' | 'pro' }> = {
  avg: { name: 'Batting Average', formula: 'H / AB', description: 'Hits per at-bat. A traditional measure of batting ability.', tier: 'free' },
  obp: { name: 'On-Base Percentage', formula: '(H + BB + HBP) / PA', description: 'Rate at which a batter reaches base. More predictive of runs scored than AVG.', tier: 'free' },
  slg: { name: 'Slugging Percentage', formula: 'Total Bases / AB', description: 'Average number of bases per at-bat. Measures raw power output.', tier: 'free' },
  ops: { name: 'OPS', formula: 'OBP + SLG', description: 'On-base plus slugging. A simple composite of reaching base and power.', tier: 'free' },
  iso: { name: 'Isolated Power', formula: 'SLG - AVG', description: 'Measures extra-base power by removing singles from slugging.', tier: 'free' },
  babip: { name: 'BABIP', formula: '(H - HR) / (AB - SO - HR + SF)', description: 'Batting average on balls in play. Extreme values suggest luck or defensive influence.', tier: 'free' },
  kPct: { name: 'Strikeout Rate', formula: 'SO / PA', description: 'Fraction of plate appearances ending in a strikeout.', tier: 'free' },
  bbPct: { name: 'Walk Rate', formula: 'BB / PA', description: 'Fraction of plate appearances ending in a walk. Measures plate discipline.', tier: 'free' },
  woba: { name: 'Weighted On-Base Average', formula: '(wBB*BB + wHBP*HBP + w1B*1B + w2B*2B + w3B*3B + wHR*HR) / PA', description: 'Weights each method of reaching base by its run-production value. The single best publicly available batting metric.', tier: 'pro' },
  wrcPlus: { name: 'Weighted Runs Created Plus', formula: '((wOBA - lgwOBA) / wobaScale + lgR/PA) / parkFactor / lgR/PA * 100', description: '100 = league average. Park- and league-adjusted. The gold standard for comparing hitters across contexts.', tier: 'pro' },
  opsPlus: { name: 'OPS+', formula: '100 * (OBP / (lgOBP * PF) + SLG / (lgSLG * PF) - 1)', description: '100 = league average. Park-adjusted OPS relative to league. Simpler than wRC+ but less precise.', tier: 'pro' },
  era: { name: 'Earned Run Average', formula: '(ER * 9) / IP', description: 'Earned runs allowed per nine innings. The traditional pitching measure.', tier: 'free' },
  whip: { name: 'WHIP', formula: '(H + BB) / IP', description: 'Walks and hits per inning pitched. Measures baserunner volume.', tier: 'free' },
  k9: { name: 'K/9', formula: '(SO * 9) / IP', description: 'Strikeouts per nine innings. Measures a pitcher\'s swing-and-miss ability.', tier: 'free' },
  bb9: { name: 'BB/9', formula: '(BB * 9) / IP', description: 'Walks per nine innings. Lower is better — measures control.', tier: 'free' },
  hr9: { name: 'HR/9', formula: '(HR * 9) / IP', description: 'Home runs per nine innings. Measures a pitcher\'s vulnerability to the long ball.', tier: 'free' },
  fip: { name: 'Fielding Independent Pitching', formula: '(13*HR + 3*(BB+HBP) - 2*SO) / IP + cFIP', description: 'Isolates what a pitcher controls: strikeouts, walks, HBP, home runs. Strips out defense and luck on balls in play.', tier: 'pro' },
  xFip: { name: 'Expected FIP', formula: 'FIP with expected HR from league HR/FB rate', description: 'FIP with home run luck removed. Smooths variation from HR-per-fly-ball rate.', tier: 'pro' },
  eraMinus: { name: 'ERA-', formula: '100 * (ERA / lgERA) / PF', description: '100 = league average, lower is better. 80 ERA- means 20% better than league average.', tier: 'pro' },
  kBB: { name: 'K/BB', formula: 'SO / BB', description: 'Strikeout-to-walk ratio. Measures a pitcher\'s command efficiency.', tier: 'pro' },
  lobPct: { name: 'LOB%', formula: '(H + BB + HBP - HR - ER) / (H + BB + HBP - HR)', description: 'Left on base percentage. How well a pitcher strands baserunners. Very high LOB% tends to regress.', tier: 'pro' },
  eBA: { name: 'Estimated Batting Average', formula: 'BABIP regression + HR rate + K rate + conf adj', description: 'Box-score regression estimate of expected AVG. Regresses BABIP toward .300 with skill adjustments.', tier: 'pro' },
  eSLG: { name: 'Estimated Slugging', formula: 'eBA + ISO', description: 'Estimated slugging percentage derived from eBA and isolated power.', tier: 'pro' },
  ewOBA: { name: 'Estimated wOBA', formula: 'wBB*BB% + 0.5*(approxOBP + eSLG*0.8)', description: 'Estimated wOBA from box-score proxies. Transparently an estimate, not a measurement.', tier: 'pro' },
  havf: { name: 'HAV-F', formula: '0.30*H + 0.25*A + 0.25*V + 0.20*F', description: 'Hits / At-Bat Quality / Velocity Proxy / Fielding. BSI composite player evaluation on a 0-100 percentile scale.', tier: 'pro' },
  mmi: { name: 'MMI', formula: '(SD*0.40 + RS*0.30 + BS*0.15) * GP', description: 'Momentum Magnitude Index. Signed -100 to +100 reading of in-game momentum direction and intensity.', tier: 'pro' },
};

/**
 * Methodology descriptions — longer-form explanations for /v1/meta/methodology.
 */
export const METHODOLOGY: Record<string, { title: string; description: string; formula: string; notes: string }> = {
  woba: {
    title: 'Weighted On-Base Average (wOBA)',
    description: 'wOBA weights each method of reaching base by its run-production value, using linear weights derived from run expectancy matrices. Unlike OPS, which simply adds OBP and SLG (mixing different denominators), wOBA properly weights outcomes relative to each other.',
    formula: 'wOBA = (wBB*BB + wHBP*HBP + w1B*1B + w2B*2B + w3B*3B + wHR*HR) / PA',
    notes: 'V1 ships with MLB linear weights as proxy. D1-specific weights require play-by-play data (future calibration). The relative ordering of outcomes is stable across levels; the absolute magnitudes may differ.',
  },
  wrcPlus: {
    title: 'Weighted Runs Created Plus (wRC+)',
    description: 'wRC+ converts wOBA into a runs-above-average rate, adjusts for park factor, and scales to 100 = league average. It is the gold standard for comparing hitters across different parks and leagues.',
    formula: 'wRC/PA = (wOBA - lgwOBA) / wobaScale + lgR/PA\nwRC+ = (wRC/PA / parkFactor) / lgR/PA * 100',
    notes: 'Park factors default to 1.0 (neutral) in V1 — real park factors require 20+ home games for stability.',
  },
  fip: {
    title: 'Fielding Independent Pitching (FIP)',
    description: 'FIP isolates the three outcomes a pitcher most directly controls: strikeouts, walks/HBP, and home runs. By removing balls in play from the equation, it strips out luck and defensive quality to measure true pitching skill.',
    formula: 'FIP = (13*HR + 3*(BB+HBP) - 2*SO) / IP + cFIP\ncFIP = lgERA - (13*lgHR + 3*lgBB - 2*lgK) / lgIP',
    notes: 'FIP constant (cFIP) is clamped to [3.0, 5.0] to guard against thin early-season samples. The constant scales FIP to the ERA scale for intuitive comparison.',
  },
  havf: {
    title: 'HAV-F (Hits / At-Bat Quality / Velocity / Fielding)',
    description: 'BSI proprietary composite. Each component scores 0-100 via percentile rank against the D1 cohort, then the four components are weighted into a single composite. H-Score measures batting production, A-Score measures approach quality, V-Score proxies exit velocity through power metrics (no Statcast in college), F-Score captures defensive contribution.',
    formula: 'HAV-F = 0.30*H + 0.25*A + 0.25*V + 0.20*F\nH = 0.25*pAVG + 0.25*pOBP + 0.20*pSLG + 0.20*pwOBA + 0.10*pISO\nA = 0.30*pBB% + 0.30*p(inv K%) + 0.20*pBABIP + 0.20*pHR%\nV = 0.40*pISO + 0.35*pSLG + 0.25*pHR%\nF = 0.60*pFielding% + 0.40*pRangeFactor',
    notes: 'Percentile ranks computed against the current D1 cohort, not historical data. Players without fielding data receive a neutral 50 F-Score.',
  },
  mmi: {
    title: 'Momentum Magnitude Index (MMI)',
    description: 'In-game momentum computation. Takes a game state snapshot and returns a signed reading from -100 (away dominant) to +100 (home dominant). The game phase multiplier amplifies whatever momentum exists as the game progresses — early-game signals are dampened, late-game and extras are amplified.',
    formula: 'MMI = clamp(-100, 100, (SD*0.40 + RS*0.30 + BS*0.15) * GP)\nSD = scoreDiff * (1 + 0.1 * inningsRemaining) / 10 * 100\nRS = netRecentRuns / 6 * 100\nGP = {early: 0.7, mid: 1.0, late: 1.3, extras: 1.5}\nBS = {basesLoaded: 15, RISP: 10, firstOnly: 3} * sign(battingTeam)',
    notes: 'Different from Sandlot-Sluggers\' pitch-level Moment Mentality Index. MMI is macro-level game momentum; MoMI is micro-level per-pitch difficulty.',
  },
};
