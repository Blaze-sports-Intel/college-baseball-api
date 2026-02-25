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
import { MLB_WOBA_WEIGHTS } from './weights';

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
  return safe((13 * hr + 3 * (bb + hbp) - 2 * so) / ip + fipConstant);
}

/**
 * xFIP — Expected FIP.
 * Replaces actual HR with expected HR based on league HR/FB rate.
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
 */
export function calculateEBA(
  babip: number,
  hrRate: number,
  kPct: number,
  confStrength: number = 50,
): number {
  const expectedBABIP = 0.3 + (babip - 0.3) * 0.6;
  const confAdj = (confStrength - 50) * -0.001;
  return safe(expectedBABIP * (1 - kPct) + hrRate + confAdj);
}

/** eSLG — Estimated Slugging. Derived from ISO and eBA. */
export function calculateESLG(iso: number, eBA: number): number {
  return safe(eBA + iso);
}

/**
 * ewOBA — Estimated Weighted On-Base Average.
 * Combines eBA, eSLG, and BB% through simplified wOBA-like weighting.
 */
export function calculateEWOBA(
  eBA: number,
  eSLG: number,
  bbPct: number,
  weights: WOBAWeights = MLB_WOBA_WEIGHTS,
): number {
  const approxOBP = eBA + bbPct;
  return safe(weights.wBB * bbPct + 0.5 * (approxOBP + eSLG * 0.8));
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
