/**
 * Shared types for college baseball analytics computation.
 * Every type here is a pure data shape — no behavior, no side effects.
 */

/** Linear weights for wOBA computation. */
export interface WOBAWeights {
  wBB: number;
  wHBP: number;
  w1B: number;
  w2B: number;
  w3B: number;
  wHR: number;
}

/** Batting stats needed for advanced metric computation. */
export interface BattingLine {
  pa: number;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  so: number;
  sf: number;
  r?: number;
  sb?: number;
  cs?: number;
  avg?: number;
  obp?: number;
  slg?: number;
}

/** Pitching stats needed for advanced metric computation. */
export interface PitchingLine {
  ip: number;       // Innings pitched as decimal (6.1 = 6 1/3)
  h: number;
  er: number;
  hr: number;
  bb: number;
  hbp: number;
  so: number;
  bf?: number;      // Batters faced
  fb?: number;      // Fly balls (for xFIP)
}

/** League-wide averages needed as baselines for relative metrics. */
export interface LeagueContext {
  woba: number;
  obp: number;
  avg: number;
  slg: number;
  era: number;
  runsPerPA: number;
  wobaScale: number;
  fipConstant: number;
  hrFBRate?: number;
}

/** Full computed batting line returned by computeFullBattingLine. */
export interface AdvancedBattingLine {
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  kPct: number;
  bbPct: number;
  iso: number;
  babip: number;
  woba: number;
  wrcPlus: number;
  opsPlus: number;
  parkAdjusted: boolean;
}

/** Full computed pitching line returned by computeFullPitchingLine. */
export interface AdvancedPitchingLine {
  era: number;
  whip: number;
  k9: number;
  bb9: number;
  hr9: number;
  kBB: number;
  fip: number;
  xFip: number | null;
  eraMinus: number;
  lobPct: number;
  babip: number;
  parkAdjusted: boolean;
}

/** Estimated batting metrics — box-score regression proxies. */
export interface EstimatedBattingLine {
  eBA: number;
  eSLG: number;
  ewOBA: number;
}

/** HAV-F input — raw stats needed for composite player evaluation. */
export interface HAVFInput {
  playerID: string;
  name: string;
  team: string;
  league: string;
  season: number;
  avg: number;
  obp: number;
  slg: number;
  woba: number;
  iso: number;
  bbPct: number;
  kPct: number;
  babip: number;
  hrPct: number;
  fieldingPct: number | null;
  rangeFactor: number | null;
  games: number | null;
}

/** Breakdown of sub-stat contributions within each HAV-F component. */
export interface HAVFComponentBreakdown {
  h: { avg: number; obp: number; slg: number; woba: number; iso: number };
  a: { bbPct: number; kPctInv: number; babip: number; hrPct: number };
  v: { iso: number; slg: number; hrPct: number };
  f: { fieldingPct: number | null; rangeFactor: number | null };
}

/** Full HAV-F result for a single player. */
export interface HAVFResult {
  playerID: string;
  name: string;
  team: string;
  league: string;
  season: number;
  h_score: number;
  a_score: number;
  v_score: number;
  f_score: number;
  havf_composite: number;
  breakdown: HAVFComponentBreakdown;
}

/** Sorted arrays of stat values for percentile lookup. */
export type PercentileTable = Record<string, number[]>;

/** Scoring breakdown for a single inning (MMI input). */
export interface InningScore {
  inning: number;
  homeRuns: number;
  awayRuns: number;
}

/** Game state snapshot for MMI computation. */
export interface MMIInput {
  gameId: string;
  inning: number;
  inningHalf: 'top' | 'bottom';
  outs: number;
  homeScore: number;
  awayScore: number;
  runnersOn: [boolean, boolean, boolean];
  recentInnings: InningScore[];
  totalInnings?: number;
}

/** MMI component values. */
export interface MMIComponents {
  sd: number;
  rs: number;
  gp: number;
  bs: number;
}

/** Single MMI snapshot. */
export interface MMISnapshot {
  value: number;
  direction: 'home' | 'away' | 'neutral';
  magnitude: 'low' | 'medium' | 'high' | 'extreme';
  components: MMIComponents;
}

/** Aggregated game-level MMI summary. */
export interface MMIGameSummary {
  gameId: string;
  snapshots: MMISnapshot[];
  maxMmi: number;
  minMmi: number;
  avgMmi: number;
  volatility: number;
  leadChanges: number;
  maxSwing: number;
  swingInning: number | null;
  excitementRating: 'routine' | 'competitive' | 'thriller' | 'instant-classic';
}
