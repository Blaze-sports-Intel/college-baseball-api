/**
 * College Baseball Savant — Metric Engine
 *
 * Pure math functions for advanced baseball analytics. No side effects,
 * no API calls, no D1/KV dependencies. Feed it numbers, get numbers back.
 *
 * Batting:  wOBA, ISO, BABIP, K%, BB%, wRC, wRC+, OPS+
 * Pitching: FIP, xFIP, ERA-, K/9, BB/9, HR/9, K/BB, LOB%
 * Estimated: eBA, eSLG, ewOBA (regression from box-score proxies)
 * Park/Conference: single-factor park adjustment, conference strength index
 */

import type {
  WOBAWeights,
  BattingLine,
  PitchingLine,
  LeagueContext,
  AdvancedBattingLine,
  AdvancedPitchingLine,
  EstimatedBattingLine,
} from './types';
import { MLB_WOBA_WEIGHTS, getD1WOBAWeights, D1_LATEST_CALIBRATED_SEASON } from './weights';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// Batting — Rate Stats
// ---------------------------------------------------------------------------

/** Isolated power: raw power production divorced from batting average. */
export function calculateISO(slg: number, avg: number): number {
  return safe(slg - avg);
}

/**
 * BABIP — Batting Average on Balls in Play.
 * Measures how often batted balls (excluding HR and K) become hits.
 * League average ~.300. Extreme deviation suggests luck or skill.
 */
export function calculateBABIP(h: number, hr: number, ab: number, so: number, sf: number): number {
  const denom = ab - so - hr + sf;
  if (denom <= 0) return 0;
  return safe((h - hr) / denom);
}

/** Strikeout rate — fraction of plate appearances ending in strikeout. */
export function calculateKPct(so: number, pa: number): number {
  if (pa <= 0) return 0;
  return safe(so / pa);
}

/** Walk rate — fraction of plate appearances ending in walk. */
export function calculateBBPct(bb: number, pa: number): number {
  if (pa <= 0) return 0;
  return safe(bb / pa);
}

// ---------------------------------------------------------------------------
// Batting — Weighted Metrics
// ---------------------------------------------------------------------------

/**
 * Weighted On-Base Average.
 * The single best publicly available batting metric. Weights each method
 * of reaching base by its run-production value rather than treating all
 * hits and walks equally.
 */
export function calculateWOBA(stats: BattingLine, weights: WOBAWeights = MLB_WOBA_WEIGHTS): number {
  if (stats.pa <= 0) return 0;
  const singles = Math.max(0, stats.h - stats.doubles - stats.triples - stats.hr);
  const num =
    weights.wBB * stats.bb +
    weights.wHBP * stats.hbp +
    weights.w1B * singles +
    weights.w2B * stats.doubles +
    weights.w3B * stats.triples +
    weights.wHR * stats.hr;
  return safe(num / stats.pa);
}

/**
 * wRC+ — Weighted Runs Created Plus.
 * 100 = league average. 150 = 50% better than average.
 * The gold standard for comparing hitters across contexts.
 */
export function calculateWRCPlus(
  woba: number,
  league: LeagueContext,
  parkFactor: number = 1.0,
): number {
  if (league.runsPerPA <= 0 || league.wobaScale <= 0) return 100;
  const wrcPerPA = ((woba - league.woba) / league.wobaScale + league.runsPerPA) / parkFactor;
  return safe((wrcPerPA / league.runsPerPA) * 100);
}

/**
 * OPS+ — Adjusted OPS.
 * 100 = league average. Park-adjusted. Simpler than wRC+ but less precise.
 */
export function calculateOPSPlus(
  obp: number,
  slg: number,
  leagueOBP: number,
  leagueSLG: number,
  parkFactor: number = 1.0,
): number {
  if (leagueOBP <= 0 || leagueSLG <= 0) return 100;
  return safe(100 * (obp / (leagueOBP * parkFactor) + slg / (leagueSLG * parkFactor) - 1));
}

// ---------------------------------------------------------------------------
// Pitching — Core Metrics
// ---------------------------------------------------------------------------

/**
 * FIP — Fielding Independent Pitching.
 * Isolates what a pitcher controls: strikeouts, walks, HBP, home runs.
 * Strips out luck on balls in play and defensive quality.
 *
 * Clamped to >= 0 — negative FIP is mathematically possible in small samples
 * (dominant K rate with zero HR/BB) but misleading to readers.
 */
export function calculateFIP(
  hr: number,
  bb: number,
  hbp: number,
  so: number,
  ip: number,
  fipConstant: number,
): number {
  if (ip <= 0) return 0;
  return Math.max(0, safe((13 * hr + 3 * (bb + hbp) - 2 * so) / ip + fipConstant));
}

/**
 * xFIP — Expected FIP.
 * Replaces actual HR with expected HR based on league HR/FB rate.
 * Smooths home run luck.
 */
export function calculateXFIP(
  fb: number,
  leagueHRFBRate: number,
  bb: number,
  hbp: number,
  so: number,
  ip: number,
  fipConstant: number,
): number {
  if (ip <= 0 || fb <= 0) return 0;
  const expectedHR = fb * leagueHRFBRate;
  return safe((13 * expectedHR + 3 * (bb + hbp) - 2 * so) / ip + fipConstant);
}

/**
 * xFIP (estimated) — Expected FIP without fly ball tracking.
 * Replaces individual HR with expected HR based on league HR/9 rate.
 * Used when batted-ball data (fly balls) is not available from the data source.
 * Approximation: expectedHR = (IP / 9) * leagueHR9.
 */
export function calculateXFIPFromHR9(
  leagueHR9: number,
  bb: number,
  hbp: number,
  so: number,
  ip: number,
  fipConstant: number,
): number {
  if (ip <= 0) return 0;
  const expectedHR = (ip / 9) * leagueHR9;
  return Math.max(0, safe((13 * expectedHR + 3 * (bb + hbp) - 2 * so) / ip + fipConstant));
}

/**
 * ERA- (ERA Minus).
 * 100 = league average. Lower is better. 80 = 20% better than league.
 */
export function calculateERAMinus(
  era: number,
  leagueERA: number,
  parkFactor: number = 1.0,
): number {
  if (leagueERA <= 0) return 100;
  return safe(100 * (era / leagueERA) / parkFactor);
}

// ---------------------------------------------------------------------------
// Pitching — Rate Stats
// ---------------------------------------------------------------------------

export function calculateK9(so: number, ip: number): number {
  if (ip <= 0) return 0;
  return safe((so * 9) / ip);
}

export function calculateBB9(bb: number, ip: number): number {
  if (ip <= 0) return 0;
  return safe((bb * 9) / ip);
}

export function calculateHR9(hr: number, ip: number): number {
  if (ip <= 0) return 0;
  return safe((hr * 9) / ip);
}

export function calculateKBB(so: number, bb: number): number {
  if (bb <= 0) return so > 0 ? Infinity : 0;
  return safe(so / bb);
}

/**
 * LOB% — Left On Base Percentage.
 * How well a pitcher strands baserunners. League average ~72%.
 */
export function calculateLOBPct(
  h: number,
  bb: number,
  hbp: number,
  er: number,
  hr: number,
): number {
  const runners = h + bb + hbp - hr;
  if (runners <= 0) return 0;
  return safe((runners - er) / runners);
}

// ---------------------------------------------------------------------------
// Estimated Stats (e-prefix) — box-score regression proxies
// ---------------------------------------------------------------------------

/**
 * eBA — Estimated Batting Average.
 * Regresses BABIP toward .300, adjusts for K rate, HR rate, and conf strength.
 * Clamped to [0.100, 0.500] so extreme early-season BABIP samples don't
 * produce impossible values.
 */
export function calculateEBA(
  babip: number,
  hrRate: number,
  kPct: number,
  confStrength: number = 50,
): number {
  const expectedBABIP = 0.3 + (babip - 0.3) * 0.6;
  const confAdj = (confStrength - 50) * -0.001;
  return clamp(safe(expectedBABIP * (1 - kPct) + hrRate + confAdj), 0.100, 0.500);
}

/** eSLG — Estimated Slugging. Clamped to [0.200, 0.900]. */
export function calculateESLG(iso: number, eBA: number): number {
  return clamp(safe(eBA + iso), 0.200, 0.900);
}

/**
 * ewOBA — Estimated Weighted On-Base Average.
 * Combines eBA, eSLG, and BB% through simplified wOBA-like weighting.
 * Clamped to [0.180, 0.550] — plausible college wOBA range. Prevents
 * extreme-ISO samples producing physically impossible 0.9+ ewOBA.
 */
export function calculateEWOBA(
  eBA: number,
  eSLG: number,
  bbPct: number,
  weights: WOBAWeights = MLB_WOBA_WEIGHTS,
): number {
  const approxOBP = eBA + bbPct;
  return clamp(safe(weights.wBB * bbPct + 0.5 * (approxOBP + eSLG * 0.8)), 0.180, 0.550);
}

// ---------------------------------------------------------------------------
// Park & Conference
// ---------------------------------------------------------------------------

/**
 * Single-factor park adjustment.
 * 1.0 = neutral. >1.0 = hitter-friendly. <1.0 = pitcher-friendly.
 */
export function calculateParkFactor(
  homeRuns: number,
  awayRuns: number,
  homeGames: number,
  awayGames: number,
): number {
  if (homeGames <= 0 || awayGames <= 0) return 1.0;
  const homeRPG = homeRuns / homeGames;
  const awayRPG = awayRuns / awayGames;
  if (awayRPG <= 0) return 1.0;
  return safe(homeRPG / awayRPG);
}

/**
 * Conference Strength Index — composite 0-100 scale.
 */
export function calculateConferenceStrength(
  interConfWinPct: number,
  avgRPI: number,
  avgWOBA: number,
  avgERA: number,
): number {
  const rpiScore = clamp((1 - avgRPI) * 200, 0, 100);
  const winScore = clamp(interConfWinPct * 200, 0, 100);
  const offScore = clamp((avgWOBA / 0.400) * 50, 0, 100);
  const pitchScore = clamp((1 - avgERA / 10) * 100, 0, 100);

  return clamp(
    winScore * 0.40 + rpiScore * 0.30 + offScore * 0.15 + pitchScore * 0.15,
    0,
    100,
  );
}

// ---------------------------------------------------------------------------
// League Context Derivation
// ---------------------------------------------------------------------------

/**
 * FIP constant from league-wide pitching aggregates.
 * Clamped to [3.0, 5.0] to guard against thin samples.
 */
export function calculateFIPConstant(
  leagueERA: number,
  leagueHR: number,
  leagueBB: number,
  leagueK: number,
  leagueIP: number,
): number {
  if (leagueIP <= 0) return 3.80;
  const raw = leagueERA - (13 * leagueHR + 3 * leagueBB - 2 * leagueK) / leagueIP;
  return clamp(raw, 3.0, 5.0);
}

/**
 * wOBA scale from league-wide OBP, wOBA, and AVG.
 * Clamped to [0.8, 1.4].
 */
export function calculateWOBAScale(
  leagueOBP: number,
  leagueWOBA: number,
  leagueAVG: number,
): number {
  const denom = leagueOBP - leagueAVG;
  if (denom <= 0.01) return 1.15;
  const raw = (leagueOBP - leagueWOBA) / denom;
  return clamp(raw, 0.8, 1.4);
}

// ---------------------------------------------------------------------------
// Composite helpers — full advanced lines from raw stats
// ---------------------------------------------------------------------------

/**
 * Compute a full advanced batting line from raw stats + league context.
 */
export function computeFullBattingLine(
  stats: BattingLine,
  league: LeagueContext,
  parkFactor: number = 1.0,
  weights: WOBAWeights = MLB_WOBA_WEIGHTS,
): AdvancedBattingLine {
  const avg = stats.avg ?? (stats.ab > 0 ? stats.h / stats.ab : 0);
  const singles = Math.max(0, stats.h - stats.doubles - stats.triples - stats.hr);
  const slg = stats.slg ?? (stats.ab > 0
    ? (singles + 2 * stats.doubles + 3 * stats.triples + 4 * stats.hr) / stats.ab
    : 0);
  const obp = stats.obp ?? (stats.pa > 0 ? (stats.h + stats.bb + stats.hbp) / stats.pa : 0);
  const ops = obp + slg;

  const iso = calculateISO(slg, avg);
  const babip = calculateBABIP(stats.h, stats.hr, stats.ab, stats.so, stats.sf);
  const kPct = calculateKPct(stats.so, stats.pa);
  const bbPct = calculateBBPct(stats.bb, stats.pa);
  const woba = calculateWOBA(stats, weights);
  const wrcPlus = calculateWRCPlus(woba, league, parkFactor);
  const opsPlus = calculateOPSPlus(obp, slg, league.obp, league.slg, parkFactor);

  return {
    avg, obp, slg, ops,
    kPct, bbPct, iso, babip, woba,
    wrcPlus, opsPlus,
    parkAdjusted: parkFactor !== 1.0,
  };
}

/**
 * Compute a full advanced pitching line from raw stats + league context.
 */
export function computeFullPitchingLine(
  stats: PitchingLine,
  league: LeagueContext,
  parkFactor: number = 1.0,
): AdvancedPitchingLine {
  const era = stats.ip > 0 ? (stats.er * 9) / stats.ip : 0;
  const whip = stats.ip > 0 ? (stats.h + stats.bb) / stats.ip : 0;
  const k9 = calculateK9(stats.so, stats.ip);
  const bb9 = calculateBB9(stats.bb, stats.ip);
  const hr9 = calculateHR9(stats.hr, stats.ip);
  const kBB = calculateKBB(stats.so, stats.bb);
  const fip = calculateFIP(stats.hr, stats.bb, stats.hbp, stats.so, stats.ip, league.fipConstant);
  const lobPct = calculateLOBPct(stats.h, stats.bb, stats.hbp, stats.er, stats.hr);
  const eraMinus = calculateERAMinus(era, league.era, parkFactor);

  const bfEst = stats.bf ?? Math.round(stats.ip * 3 + stats.h + stats.bb);
  const babip = calculateBABIP(stats.h, stats.hr, bfEst, stats.so, 0);

  let xFip: number | null = null;
  if (stats.fb != null && stats.fb > 0 && league.hrFBRate != null) {
    xFip = calculateXFIP(stats.fb, league.hrFBRate, stats.bb, stats.hbp, stats.so, stats.ip, league.fipConstant);
  }

  return {
    era, whip, k9, bb9, hr9, kBB, fip, xFip, eraMinus, lobPct, babip,
    parkAdjusted: parkFactor !== 1.0,
  };
}

/**
 * Compute estimated batting metrics from box-score data.
 */
export function computeEstimatedBatting(
  babip: number,
  iso: number,
  hrRate: number,
  kPct: number,
  bbPct: number,
  confStrength?: number,
  weights?: WOBAWeights,
): EstimatedBattingLine {
  const eBA = calculateEBA(babip, hrRate, kPct, confStrength);
  const eSLG = calculateESLG(iso, eBA);
  const ewOBA = calculateEWOBA(eBA, eSLG, bbPct, weights);
  return { eBA, eSLG, ewOBA };
}

// ---------------------------------------------------------------------------
// Additional Metrics — contact, discipline, run estimation, workload
// (Synced from canonical BSI repo, lib/analytics/savant-metrics.ts)
// ---------------------------------------------------------------------------

/**
 * Contact Rate — fraction of plate appearances NOT ending in strikeout.
 * Complement of K%. D1 average ~75–80%.
 */
export function calculateContactRate(so: number, pa: number): number {
  if (pa <= 0) return 0;
  return safe(1 - so / pa);
}

/**
 * Plate Discipline Score — walk rate as a fraction of all walk-or-strikeout outcomes.
 * BB% / (BB% + K%). Higher = more selective. ~0.30 is average D1 hitter.
 */
export function calculatePlateDiscipline(bb: number, so: number, pa: number): number {
  if (pa <= 0) return 0;
  const bbPct = bb / pa;
  const kPct = so / pa;
  const denom = bbPct + kPct;
  if (denom <= 0) return 0;
  return safe(bbPct / denom);
}

/**
 * Linear Weight Runs (LwR) — run value from raw batting events.
 * Simplified BaseRuns using MLB run weights.
 *
 * Weights approximate: 1B=0.47, 2B=0.77, 3B=1.04, HR=1.42, BB=0.33, HBP=0.34, Out=-0.27
 */
export function calculateLinearWeightRuns(
  singles: number,
  doubles: number,
  triples: number,
  hr: number,
  bb: number,
  hbp: number,
  outs: number,
): number {
  return safe(
    0.47 * singles +
    0.77 * doubles +
    1.04 * triples +
    1.42 * hr +
    0.33 * bb +
    0.34 * hbp -
    0.27 * outs,
  );
}

/**
 * SIERA-Lite — simplified Skill-Interactive ERA.
 * Full SIERA requires batted-ball data (GB%, FB%) unavailable in D1 box scores.
 * This version uses K%, BB%, and HR rate as proxies and produces a comparable scale.
 *
 * Formula: 6.145 - 16.986*(K/BF) + 11.434*(BB/BF) + 1.858*(HR/BF)*9
 * Clamped [0, 12].
 */
export function calculateSIERALite(so: number, bb: number, hr: number, ip: number): number {
  if (ip <= 0) return 0;
  const bfEst = Math.max(ip * 3 + bb + hr, 1);
  const kPct = so / bfEst;
  const bbPct = bb / bfEst;
  const hrPer9 = (hr / ip) * 9;
  const raw = 6.145 - 16.986 * kPct + 11.434 * bbPct + 1.858 * (hrPer9 / 9);
  return clamp(safe(raw), 0, 12);
}

/**
 * Workload Score — pitching fatigue index on a 0–100 scale.
 * Combines IP density (IP per start/appearance) with recent-week appearance
 * frequency. Lower is lower workload. 50 = average starter load.
 */
export function calculateWorkloadScore(
  g: number,
  gs: number,
  ip: number,
  last7dAppearances: number,
): number {
  if (g <= 0) return 0;
  const ipPerApp = ip / g;
  const isStarter = gs / g >= 0.5;
  const baseline = isStarter ? 6 : 1;
  const densityScore = clamp((ipPerApp / baseline) * 50, 0, 80);
  const recentPenalty = clamp(last7dAppearances * 6, 0, 20);
  return clamp(safe(densityScore + recentPenalty), 0, 100);
}

// ---------------------------------------------------------------------------
// Pythagorean Win Expectation
// (Lifted from CodeMateo15/CollegeBaseballStatsPackage)
// ---------------------------------------------------------------------------

/**
 * Pythagorean win percentage — expected W% from runs scored vs. runs allowed.
 * Returns 0.500 when both totals are zero (no games played).
 *
 * @param runsScored  total runs scored
 * @param runsAllowed total runs allowed
 * @param exponent    1.83 (baseball-tuned, default) or 2.00 (textbook)
 */
export function calculatePythagoreanWinPct(
  runsScored: number,
  runsAllowed: number,
  exponent: number = 1.83,
): number {
  if (runsScored <= 0 && runsAllowed <= 0) return 0.5;
  if (runsAllowed <= 0) return 1.0;
  const rsExp = Math.pow(runsScored, exponent);
  const denom = rsExp + Math.pow(runsAllowed, exponent);
  if (denom <= 0) return 0.5;
  return clamp(safe(rsExp / denom), 0, 1);
}

/**
 * Luck index — actual win percentage minus Pythagorean expectation.
 * Positive = team won more than its run differential predicts.
 * Negative = team underperformed its run differential.
 */
export function calculateLuckIndex(
  actualWinPct: number,
  runsScored: number,
  runsAllowed: number,
): number {
  return safe(actualWinPct - calculatePythagoreanWinPct(runsScored, runsAllowed));
}

// ---------------------------------------------------------------------------
// Pitcher wOBA-against
// (Lifted from Blumenfeld's `_calculate_woba_against`)
// ---------------------------------------------------------------------------

/** Pitcher allowed-batting line — what hitters did against this pitcher. */
export interface PitcherAllowedLine {
  bf: number;          // batters faced
  hAllowed: number;    // total hits allowed
  doublesAllowed: number;
  triplesAllowed: number;
  hrAllowed: number;
  bbAllowed: number;
  hbpAllowed: number;
}

/**
 * wOBA-against — pitcher's allowed wOBA, framed on the same scale as a hitter's wOBA.
 * Lower = better pitching. D1 league baseline ~0.350; elite arms suppress to <0.300.
 */
export function calculateWOBAAgainst(
  allowed: PitcherAllowedLine,
  weights: WOBAWeights = MLB_WOBA_WEIGHTS,
): number {
  if (allowed.bf <= 0) return 0;
  const singlesAllowed = Math.max(
    0,
    allowed.hAllowed - allowed.doublesAllowed - allowed.triplesAllowed - allowed.hrAllowed,
  );
  const num =
    weights.wBB * allowed.bbAllowed +
    weights.wHBP * allowed.hbpAllowed +
    weights.w1B * singlesAllowed +
    weights.w2B * allowed.doublesAllowed +
    weights.w3B * allowed.triplesAllowed +
    weights.wHR * allowed.hrAllowed;
  return safe(num / allowed.bf);
}

/** wOBA-against minus league wOBA — direct "runs above league" rate for pitchers. */
export function calculateWOBAAgainstDelta(
  wobaAgainst: number,
  leagueWOBA: number,
): number {
  return safe(wobaAgainst - leagueWOBA);
}

// ---------------------------------------------------------------------------
// Empirical Bayes shrinkage (Marchi, baseball_R, 20140113_ShrinkingAveragesII.R)
// ---------------------------------------------------------------------------

/** A player's rate-stat observation: numerator, denominator. */
export interface RateObservation {
  n: number;
  d: number;
}

/** Beta-binomial fit result — pooled mean p and prior strength K. */
export interface BetaBinomialFit {
  pAll: number;
  K: number;
  cohortSize: number;
}

/**
 * Method-of-moments estimator for the beta-binomial prior strength K.
 * Returns pooled rate `pAll = Σn / Σd` and K such that the implied prior
 * has the observed cross-cohort variance. K = Infinity when cohort variance
 * ≤ binomial floor (no signal). Clamped to [10, 5000] otherwise.
 */
export function fitBetaBinomial(observations: RateObservation[]): BetaBinomialFit {
  const valid = observations.filter((o) => o.d > 0 && Number.isFinite(o.n) && Number.isFinite(o.d));
  if (valid.length < 2) {
    const pAll = valid.length === 1 && valid[0].d > 0 ? valid[0].n / valid[0].d : 0.300;
    return { pAll: safe(pAll), K: 100, cohortSize: valid.length };
  }
  const totalN = valid.reduce((s, o) => s + o.n, 0);
  const totalD = valid.reduce((s, o) => s + o.d, 0);
  const pAll = totalD > 0 ? totalN / totalD : 0.300;

  const observedVariance = valid.reduce((s, o) => {
    const rate = o.d > 0 ? o.n / o.d : 0;
    return s + (rate - pAll) ** 2;
  }, 0) / valid.length;

  const meanD = totalD / valid.length;
  const binomialVariance = meanD > 0 ? (pAll * (1 - pAll)) / meanD : 0;

  const betweenVariance = observedVariance - binomialVariance;
  if (betweenVariance <= 0) {
    return { pAll: safe(pAll), K: Number.POSITIVE_INFINITY, cohortSize: valid.length };
  }

  const K = clamp((pAll * (1 - pAll)) / betweenVariance - 1, 10, 5000);
  return { pAll: safe(pAll), K: safe(K), cohortSize: valid.length };
}

/**
 * Apply empirical Bayes shrinkage to a single player's rate.
 * `shrunk = (n + K · pAll) / (d + K)`
 */
export function applyEmpiricalBayes(
  n: number,
  d: number,
  pAll: number,
  K: number,
): number {
  if (d <= 0 && K <= 0) return safe(pAll);
  if (!Number.isFinite(K)) return safe(pAll);
  return safe((n + K * pAll) / (d + K));
}

/** Shrunk rate stat from raw counts + cohort fit. */
export function shrinkRate(n: number, d: number, fit: BetaBinomialFit): number {
  return applyEmpiricalBayes(n, d, fit.pAll, fit.K);
}

// ---------------------------------------------------------------------------
// Streakiness (Marchi, baseball_R, scripts/streaks.R + Chap10.streakiness.R)
// ---------------------------------------------------------------------------

/** Return all positive-run streak lengths in a binary sequence. */
export function findStreaks(sequence: ReadonlyArray<number>): number[] {
  const result: number[] = [];
  let run = 0;
  for (const v of sequence) {
    if (v > 0) {
      run += 1;
    } else if (run > 0) {
      result.push(run);
      run = 0;
    }
  }
  if (run > 0) result.push(run);
  return result;
}

/** Length of the longest positive streak in the sequence. */
export function findLongestStreak(sequence: ReadonlyArray<number>): number {
  const streaks = findStreaks(sequence);
  return streaks.length > 0 ? Math.max(...streaks) : 0;
}

/** Length of the trailing positive streak (0 if sequence ends in 0). */
export function findCurrentStreak(sequence: ReadonlyArray<number>): number {
  let run = 0;
  for (let i = sequence.length - 1; i >= 0; i--) {
    if (sequence[i] > 0) run += 1;
    else break;
  }
  return run;
}

/** Length of the trailing 0-fer (Marchi's `longest.ofer` framing). */
export function findCurrentColdStreak(sequence: ReadonlyArray<number>): number {
  let run = 0;
  for (let i = sequence.length - 1; i >= 0; i--) {
    if (sequence[i] === 0) run += 1;
    else break;
  }
  return run;
}

/**
 * Rolling moving average of a rate stat over a window.
 * Marchi's `moving.average(H, AB, width)`. Returns array aligned with input;
 * leading entries before window-1 are null.
 */
export function calculateRollingRateAverage(
  numerators: ReadonlyArray<number>,
  denominators: ReadonlyArray<number>,
  window: number,
): Array<number | null> {
  const len = Math.min(numerators.length, denominators.length);
  if (window <= 0 || len === 0) return [];
  const result: Array<number | null> = new Array(len).fill(null);
  let nSum = 0;
  let dSum = 0;
  for (let i = 0; i < len; i++) {
    nSum += numerators[i];
    dSum += denominators[i];
    if (i >= window) {
      nSum -= numerators[i - window];
      dSum -= denominators[i - window];
    }
    if (i >= window - 1 && dSum > 0) {
      result[i] = safe(nSum / dSum);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Pythagorean refinements (Marchi, baseball_R, Chap4.pythagoras.R)
// ---------------------------------------------------------------------------

/** A team-season pair: runs scored, runs allowed, wins, losses. */
export interface TeamSeasonRecord {
  rs: number;
  ra: number;
  w: number;
  l: number;
}

/**
 * Fit the Pythagorean exponent from a team cohort.
 * Marchi: `lm(log(W/L) ~ 0 + log(R/RA))` — zero-intercept OLS slope.
 * Returns 1.83 fallback for cohorts < 2 records or degenerate inputs.
 * Clamped to published range [1.5, 2.5].
 */
export function fitPythagoreanExponent(records: ReadonlyArray<TeamSeasonRecord>): number {
  const valid = records.filter((r) => r.rs > 0 && r.ra > 0 && r.w > 0 && r.l > 0);
  if (valid.length < 2) return 1.83;

  let sumXY = 0;
  let sumXX = 0;
  for (const r of valid) {
    const x = Math.log(r.rs / r.ra);
    const y = Math.log(r.w / r.l);
    sumXY += x * y;
    sumXX += x * x;
  }
  if (sumXX === 0) return 1.83;
  return clamp(safe(sumXY / sumXX), 1.5, 2.5);
}

/**
 * Marginal runs needed for one additional win at current run environment.
 * Marchi, Chap4.pythagoras.R Section 4.7: IR(RS, RA) = (RS² + RA²)² / (2·RS·RA²)
 */
export function calculateRunsPerWin(rs: number, ra: number): number {
  if (rs <= 0 || ra <= 0) return Number.POSITIVE_INFINITY;
  const numer = (rs * rs + ra * ra) ** 2;
  const denom = 2 * rs * ra * ra;
  if (denom <= 0) return Number.POSITIVE_INFINITY;
  return safe(numer / denom);
}

// ---------------------------------------------------------------------------
// Runs-from-OPS regression (Marchi, baseball_R, 20131218_OPSregression.R)
// ---------------------------------------------------------------------------

/**
 * OPS-component runs estimate — empirical regression weighting.
 * Coefficient 1.7 is the published Marchi value (2000-2011 MLB team data).
 * Better runs predictor than raw OPS.
 */
export function calculateRunsFromOPS(
  obp: number,
  slg: number,
  obpWeight: number = 1.7,
): number {
  return safe(obpWeight * obp + slg);
}
