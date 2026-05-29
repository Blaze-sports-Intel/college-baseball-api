/**
 * @bsi/college-baseball-analytics
 *
 * Pure math functions for college baseball sabermetrics.
 * No side effects, no API calls, no runtime dependencies.
 */

// Types
export type {
  WOBAWeights,
  BattingLine,
  PitchingLine,
  LeagueContext,
  AdvancedBattingLine,
  AdvancedPitchingLine,
  EstimatedBattingLine,
  HAVFInput,
  HAVFResult,
  HAVFComponentBreakdown,
  PercentileTable,
  InningScore,
  MMIInput,
  MMISnapshot,
  MMIComponents,
  MMIGameSummary,
} from './types';

// Weights & Constants
export {
  MLB_WOBA_WEIGHTS,
  D1_WOBA_WEIGHTS_BY_SEASON,
  D1_LEAGUE_PRIORS_BY_SEASON,
  D1_LATEST_CALIBRATED_SEASON,
  getD1WOBAWeights,
  getD1LeaguePriors,
  DEFAULT_LEAGUE_CONTEXT,
  HAVF_WEIGHTS,
  MMI_WEIGHTS,
  MAGNITUDE_THRESHOLDS,
  METRIC_GLOSSARY,
  METHODOLOGY,
} from './weights';

// Savant Metrics
export {
  calculateISO,
  calculateBABIP,
  calculateKPct,
  calculateBBPct,
  calculateWOBA,
  calculateWRCPlus,
  calculateOPSPlus,
  calculateFIP,
  calculateXFIP,
  calculateXFIPFromHR9,
  calculateERAMinus,
  calculateK9,
  calculateBB9,
  calculateHR9,
  calculateKBB,
  calculateLOBPct,
  calculateEBA,
  calculateESLG,
  calculateEWOBA,
  calculateParkFactor,
  calculateConferenceStrength,
  calculateFIPConstant,
  calculateWOBAScale,
  computeFullBattingLine,
  computeFullPitchingLine,
  computeEstimatedBatting,
  calculateContactRate,
  calculatePlateDiscipline,
  calculateLinearWeightRuns,
  calculateSIERALite,
  calculateWorkloadScore,
  calculatePythagoreanWinPct,
  calculateLuckIndex,
  calculateWOBAAgainst,
  calculateWOBAAgainstDelta,
  fitBetaBinomial,
  applyEmpiricalBayes,
  shrinkRate,
  findStreaks,
  findLongestStreak,
  findCurrentStreak,
  findCurrentColdStreak,
  calculateRollingRateAverage,
  fitPythagoreanExponent,
  calculateRunsPerWin,
  calculateRunsFromOPS,
} from './savant-metrics';
export type { PitcherAllowedLine, RateObservation, BetaBinomialFit, TeamSeasonRecord } from './savant-metrics';

// HAV-F
export {
  percentileRank,
  computeHScore,
  computeAScore,
  computeVScore,
  computeFScore,
  computeHAVF,
  buildPercentileTable,
  batchComputeHAVF,
} from './havf';

// MMI
export {
  computeSD,
  computeRS,
  computeGP,
  computeBS,
  classifyMagnitude,
  classifyDirection,
  computeMMI,
  computeGameSummary,
} from './mmi';

// League Context
export {
  deriveLeagueContext,
} from './league-context';
export type { LeagueAggregates } from './league-context';
