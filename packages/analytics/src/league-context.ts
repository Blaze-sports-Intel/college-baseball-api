/**
 * League Context Derivation
 *
 * Functions to compute league-wide baselines from aggregate data.
 * These baselines feed wRC+, OPS+, ERA-, FIP, and all relative metrics.
 *
 * Re-exports the individual derivation functions from savant-metrics
 * and adds a convenience builder for the full LeagueContext object.
 */

import type { LeagueContext } from './types';
import { calculateFIPConstant, calculateWOBAScale } from './savant-metrics';

export { calculateFIPConstant, calculateWOBAScale };

/** Raw league-wide aggregates needed to derive a full LeagueContext. */
export interface LeagueAggregates {
  // Batting
  totalPA: number;
  totalAB: number;
  totalH: number;
  totalBB: number;
  totalHBP: number;
  totalHR: number;
  totalR: number;
  total1B: number;
  total2B: number;
  total3B: number;
  totalSO: number;
  totalSF: number;

  // Pitching
  totalIP: number;
  totalER: number;
  totalPitchingHR: number;
  totalPitchingBB: number;
  totalPitchingK: number;
  totalFB?: number;
}

/**
 * Derive a full LeagueContext from aggregate statistics.
 * This is the single function the sync worker calls after aggregating
 * all D1 data for the current season.
 */
export function deriveLeagueContext(agg: LeagueAggregates): LeagueContext {
  const avg = agg.totalAB > 0 ? agg.totalH / agg.totalAB : 0.243;
  const obp = agg.totalPA > 0
    ? (agg.totalH + agg.totalBB + agg.totalHBP) / agg.totalPA
    : 0.314;
  const slg = agg.totalAB > 0
    ? (agg.total1B + 2 * agg.total2B + 3 * agg.total3B + 4 * agg.totalHR) / agg.totalAB
    : 0.396;
  const era = agg.totalIP > 0 ? (agg.totalER * 9) / agg.totalIP : 4.17;
  const runsPerPA = agg.totalPA > 0 ? agg.totalR / agg.totalPA : 0.112;

  // wOBA for the league
  const wBB = 0.69, wHBP = 0.72, w1B = 0.89, w2B = 1.24, w3B = 1.56, wHR = 2.01;
  const wobaNum = wBB * agg.totalBB + wHBP * agg.totalHBP + w1B * agg.total1B +
    w2B * agg.total2B + w3B * agg.total3B + wHR * agg.totalHR;
  const woba = agg.totalPA > 0 ? wobaNum / agg.totalPA : 0.310;

  const wobaScale = calculateWOBAScale(obp, woba, avg);
  const fipConstant = calculateFIPConstant(era, agg.totalPitchingHR, agg.totalPitchingBB, agg.totalPitchingK, agg.totalIP);

  let hrFBRate: number | undefined;
  if (agg.totalFB != null && agg.totalFB > 0) {
    hrFBRate = agg.totalPitchingHR / agg.totalFB;
  }

  return { woba, obp, avg, slg, era, runsPerPA, wobaScale, fipConstant, hrFBRate };
}
