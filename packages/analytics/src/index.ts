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
} from './savant-metrics';

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
