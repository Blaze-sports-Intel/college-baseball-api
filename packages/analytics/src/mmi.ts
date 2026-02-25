/**
 * MMI (Momentum Magnitude Index) — in-game momentum computation for baseball.
 *
 * Pure math. No fetch, no KV, no D1. Takes a game state snapshot,
 * returns a signed momentum reading from -100 (away dominant) to +100
 * (home dominant).
 *
 * Formula:
 *   MMI = clamp(-100, 100, SD * 0.40 + RS * 0.30 + BS * 0.15) * GP
 *
 * Components:
 *   SD — Score Differential (leverage-adjusted by innings remaining)
 *   RS — Recent Scoring (net runs in last 2 innings)
 *   GP — Game Phase (multiplier: early=0.7, mid=1.0, late=1.3, extras=1.5)
 *   BS — Base Situation (runners on base, sign depends on who's batting)
 */

import type {
  InningScore,
  MMIInput,
  MMISnapshot,
  MMIComponents,
  MMIGameSummary,
} from './types';
import { MMI_WEIGHTS, MAGNITUDE_THRESHOLDS } from './weights';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max run differential that maps to the +/-100 boundary for SD. */
const SD_CAP = 10;

/** Max net recent-inning runs that maps to the +/-100 boundary for RS. */
const RS_CAP = 6;

// ---------------------------------------------------------------------------
// Component Functions
// ---------------------------------------------------------------------------

/**
 * Score Differential — the raw lead/deficit, amplified by innings remaining.
 * A 3-run lead in the 2nd means less than a 3-run lead in the 8th.
 */
export function computeSD(
  homeScore: number,
  awayScore: number,
  inningsRemaining: number,
  _totalInnings: number,
): number {
  const diff = homeScore - awayScore;
  const leverageMultiplier = 1 + 0.1 * inningsRemaining;
  const raw = diff * leverageMultiplier;
  const capped = clamp(-SD_CAP, SD_CAP, raw);
  return (capped / SD_CAP) * 100;
}

/**
 * Recent Scoring — net runs in the last 2 completed innings.
 * Captures who has the hot hand right now.
 */
export function computeRS(recentInnings: InningScore[]): number {
  if (recentInnings.length === 0) return 0;

  const sliced = recentInnings.slice(-2);
  let net = 0;
  for (const inn of sliced) {
    net += inn.homeRuns - inn.awayRuns;
  }

  const capped = clamp(-RS_CAP, RS_CAP, net);
  return (capped / RS_CAP) * 100;
}

/**
 * Game Phase — a multiplier that increases momentum weight as the game progresses.
 */
export function computeGP(inning: number, totalInnings: number): number {
  const regulation = totalInnings;
  const earlyEnd = Math.ceil(regulation / 3);
  const midEnd = Math.ceil((regulation * 2) / 3);

  if (inning > regulation) return 1.5;
  if (inning > midEnd) return 1.3;
  if (inning > earlyEnd) return 1.0;
  return 0.7;
}

/**
 * Base Situation — current baserunner state contributes to momentum.
 * Bottom half = home batting = positive. Top half = away batting = negative.
 */
export function computeBS(
  runnersOn: [boolean, boolean, boolean],
  inningHalf: 'top' | 'bottom',
): number {
  const [first, second, third] = runnersOn;
  const basesLoaded = first && second && third;
  const risp = second || third;

  let magnitude = 0;

  if (basesLoaded) {
    magnitude = 15;
  } else if (risp) {
    magnitude = 10;
  } else if (first && !second && !third) {
    magnitude = 3;
  }

  if (magnitude === 0) return 0;
  return inningHalf === 'bottom' ? magnitude : -magnitude;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export function classifyMagnitude(absValue: number): 'low' | 'medium' | 'high' | 'extreme' {
  const v = Math.abs(absValue);
  if (v >= MAGNITUDE_THRESHOLDS.high) return 'extreme';
  if (v >= MAGNITUDE_THRESHOLDS.medium) return 'high';
  if (v >= MAGNITUDE_THRESHOLDS.low) return 'medium';
  return 'low';
}

export function classifyDirection(value: number): 'home' | 'away' | 'neutral' {
  if (Math.abs(value) < 5) return 'neutral';
  return value > 0 ? 'home' : 'away';
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/** Compute a single MMI snapshot from current game state. */
export function computeMMI(input: MMIInput): MMISnapshot {
  const totalInnings = input.totalInnings ?? 9;
  const inningsRemaining = Math.max(0, totalInnings - input.inning);

  const sdRaw = computeSD(input.homeScore, input.awayScore, inningsRemaining, totalInnings);
  const rsRaw = computeRS(input.recentInnings);
  const gpMultiplier = computeGP(input.inning, totalInnings);
  const bsRaw = computeBS(input.runnersOn, input.inningHalf);

  const weighted =
    (sdRaw * MMI_WEIGHTS.SD + rsRaw * MMI_WEIGHTS.RS + bsRaw * MMI_WEIGHTS.BS) * gpMultiplier;

  const value = round1(clamp(-100, 100, weighted));

  return {
    value,
    direction: classifyDirection(value),
    magnitude: classifyMagnitude(value),
    components: {
      sd: round2(sdRaw),
      rs: round2(rsRaw),
      gp: round2(gpMultiplier),
      bs: round2(bsRaw),
    },
  };
}

// ---------------------------------------------------------------------------
// Game Summary
// ---------------------------------------------------------------------------

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function classifyExcitement(
  volatility: number,
  leadChanges: number,
  maxSwing: number,
): MMIGameSummary['excitementRating'] {
  const score = volatility * 0.4 + leadChanges * 8 + maxSwing * 0.3;
  if (score >= 80) return 'instant-classic';
  if (score >= 50) return 'thriller';
  if (score >= 25) return 'competitive';
  return 'routine';
}

/** Aggregate a sequence of MMI snapshots into a game-level summary. */
export function computeGameSummary(
  gameId: string,
  snapshots: MMISnapshot[],
): MMIGameSummary {
  if (snapshots.length === 0) {
    return {
      gameId, snapshots,
      maxMmi: 0, minMmi: 0, avgMmi: 0,
      volatility: 0, leadChanges: 0,
      maxSwing: 0, swingInning: null,
      excitementRating: 'routine',
    };
  }

  const values = snapshots.map((s) => s.value);
  const maxMmi = round1(Math.max(...values));
  const minMmi = round1(Math.min(...values));
  const avgMmi = round1(values.reduce((a, b) => a + b, 0) / values.length);
  const volatility = round2(stddev(values));

  let leadChanges = 0;
  let prevSign: 'home' | 'away' | null = null;
  for (const snap of snapshots) {
    if (snap.direction === 'neutral') continue;
    if (prevSign !== null && snap.direction !== prevSign) {
      leadChanges++;
    }
    prevSign = snap.direction;
  }

  let maxSwing = 0;
  let swingIndex: number | null = null;
  for (let i = 1; i < snapshots.length; i++) {
    const swing = Math.abs(snapshots[i].value - snapshots[i - 1].value);
    if (swing > maxSwing) {
      maxSwing = round1(swing);
      swingIndex = i;
    }
  }

  const swingInning = swingIndex !== null ? swingIndex + 1 : null;
  const excitementRating = classifyExcitement(volatility, leadChanges, maxSwing);

  return {
    gameId, snapshots,
    maxMmi, minMmi, avgMmi,
    volatility, leadChanges,
    maxSwing, swingInning,
    excitementRating,
  };
}
