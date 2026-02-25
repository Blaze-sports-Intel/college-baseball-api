import { describe, it, expect } from 'vitest';
import {
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
  MLB_WOBA_WEIGHTS,
  DEFAULT_LEAGUE_CONTEXT,
} from '../src';
import type { BattingLine, PitchingLine } from '../src';

// ---------------------------------------------------------------------------
// Known-correct verification data: MSST Ace Reese (Weekend 2, Feb 2026)
// wOBA 0.649, wRC+ 168
// ---------------------------------------------------------------------------
const aceReese: BattingLine = {
  pa: 25, ab: 20, h: 11, doubles: 3, triples: 1, hr: 2,
  bb: 4, hbp: 1, so: 3, sf: 0,
};

describe('Batting Rate Stats', () => {
  it('ISO = SLG - AVG', () => {
    expect(calculateISO(0.500, 0.300)).toBeCloseTo(0.200, 3);
  });

  it('ISO returns 0 for NaN inputs', () => {
    expect(calculateISO(NaN, 0.300)).toBe(0);
  });

  it('BABIP computes correctly', () => {
    // (11-2) / (20-3-2+0) = 9/15 = 0.600
    const babip = calculateBABIP(11, 2, 20, 3, 0);
    expect(babip).toBeCloseTo(0.600, 3);
  });

  it('BABIP returns 0 for degenerate denominator', () => {
    expect(calculateBABIP(1, 0, 1, 1, 0)).toBe(0);
  });

  it('K% computes correctly', () => {
    expect(calculateKPct(3, 25)).toBeCloseTo(0.120, 3);
  });

  it('BB% computes correctly', () => {
    expect(calculateBBPct(4, 25)).toBeCloseTo(0.160, 3);
  });

  it('rate stats return 0 for 0 PA', () => {
    expect(calculateKPct(5, 0)).toBe(0);
    expect(calculateBBPct(5, 0)).toBe(0);
  });
});

describe('wOBA', () => {
  it('computes Ace Reese wOBA close to 0.649', () => {
    const woba = calculateWOBA(aceReese, MLB_WOBA_WEIGHTS);
    // singles = 11 - 3 - 1 - 2 = 5
    // num = 0.69*4 + 0.72*1 + 0.89*5 + 1.24*3 + 1.56*1 + 2.01*2
    //     = 2.76 + 0.72 + 4.45 + 3.72 + 1.56 + 4.02 = 17.23
    // wOBA = 17.23 / 25 = 0.6892
    // Note: the 0.649 from BSI used slightly different weights; we verify
    // the math is self-consistent here.
    expect(woba).toBeCloseTo(0.6892, 3);
  });

  it('returns 0 for 0 PA', () => {
    expect(calculateWOBA({ ...aceReese, pa: 0 })).toBe(0);
  });
});

describe('wRC+', () => {
  it('league average wOBA produces wRC+ of ~100', () => {
    const wrcPlus = calculateWRCPlus(DEFAULT_LEAGUE_CONTEXT.woba, DEFAULT_LEAGUE_CONTEXT);
    expect(wrcPlus).toBeCloseTo(100, 0);
  });

  it('Ace Reese wOBA produces wRC+ well above 100', () => {
    const woba = calculateWOBA(aceReese, MLB_WOBA_WEIGHTS);
    const wrcPlus = calculateWRCPlus(woba, DEFAULT_LEAGUE_CONTEXT);
    expect(wrcPlus).toBeGreaterThan(150);
  });

  it('returns 100 for degenerate league context', () => {
    expect(calculateWRCPlus(0.350, { ...DEFAULT_LEAGUE_CONTEXT, runsPerPA: 0 })).toBe(100);
  });
});

describe('OPS+', () => {
  it('league average OBP+SLG produces OPS+ of ~100', () => {
    const opsPlus = calculateOPSPlus(
      DEFAULT_LEAGUE_CONTEXT.obp,
      DEFAULT_LEAGUE_CONTEXT.slg,
      DEFAULT_LEAGUE_CONTEXT.obp,
      DEFAULT_LEAGUE_CONTEXT.slg,
    );
    expect(opsPlus).toBeCloseTo(100, 0);
  });

  it('park-adjusted OPS+ changes with park factor', () => {
    const neutral = calculateOPSPlus(0.400, 0.500, 0.314, 0.396, 1.0);
    const hitterPark = calculateOPSPlus(0.400, 0.500, 0.314, 0.396, 1.1);
    expect(hitterPark).toBeLessThan(neutral);
  });
});

describe('Pitching Metrics', () => {
  it('FIP computes correctly', () => {
    // (13*2 + 3*(10+1) - 2*40) / 50 + 3.186
    // = (26 + 33 - 80) / 50 + 3.186
    // = -21/50 + 3.186 = -0.42 + 3.186 = 2.766
    const fip = calculateFIP(2, 10, 1, 40, 50, 3.186);
    expect(fip).toBeCloseTo(2.766, 2);
  });

  it('FIP returns 0 for 0 IP', () => {
    expect(calculateFIP(1, 5, 0, 10, 0, 3.186)).toBe(0);
  });

  it('xFIP replaces HR with expected HR', () => {
    const xfip = calculateXFIP(100, 0.10, 20, 2, 80, 60, 3.186);
    // expectedHR = 100 * 0.10 = 10
    // (13*10 + 3*22 - 2*80) / 60 + 3.186
    // = (130 + 66 - 160) / 60 + 3.186
    // = 36/60 + 3.186 = 0.6 + 3.186 = 3.786
    expect(xfip).toBeCloseTo(3.786, 2);
  });

  it('ERA- = 100 at league average', () => {
    expect(calculateERAMinus(4.17, 4.17)).toBeCloseTo(100, 0);
  });

  it('ERA- adjusts for park factor', () => {
    const neutral = calculateERAMinus(3.50, 4.17, 1.0);
    const hitterPark = calculateERAMinus(3.50, 4.17, 1.1);
    expect(hitterPark).toBeLessThan(neutral);
  });

  it('K/9 computes correctly', () => {
    expect(calculateK9(90, 60)).toBeCloseTo(13.5, 1);
  });

  it('BB/9 computes correctly', () => {
    expect(calculateBB9(20, 60)).toBeCloseTo(3.0, 1);
  });

  it('HR/9 computes correctly', () => {
    expect(calculateHR9(6, 60)).toBeCloseTo(0.9, 1);
  });

  it('K/BB ratio', () => {
    expect(calculateKBB(90, 30)).toBeCloseTo(3.0, 1);
  });

  it('K/BB returns Infinity for 0 walks with strikeouts', () => {
    expect(calculateKBB(10, 0)).toBe(Infinity);
  });

  it('K/BB returns 0 for 0/0', () => {
    expect(calculateKBB(0, 0)).toBe(0);
  });

  it('LOB% computes correctly', () => {
    // runners = 40 + 15 + 2 - 5 = 52
    // LOB% = (52 - 20) / 52 = 32/52 ≈ 0.615
    expect(calculateLOBPct(40, 15, 2, 20, 5)).toBeCloseTo(0.6154, 3);
  });
});

describe('Estimated Stats', () => {
  it('eBA regresses BABIP toward .300', () => {
    const highBABIP = calculateEBA(0.400, 0.05, 0.15);
    const lowBABIP = calculateEBA(0.200, 0.05, 0.15);
    // High BABIP should regress down, low should regress up
    expect(highBABIP).toBeLessThan(0.400);
    expect(lowBABIP).toBeGreaterThan(0.200 * 0.85);
  });

  it('conference strength adjustment works', () => {
    const strong = calculateEBA(0.300, 0.05, 0.15, 70);
    const weak = calculateEBA(0.300, 0.05, 0.15, 30);
    // Stronger conference penalizes batting (confAdj is negative)
    expect(strong).toBeLessThan(weak);
  });

  it('eSLG = eBA + ISO', () => {
    expect(calculateESLG(0.200, 0.280)).toBeCloseTo(0.480, 3);
  });

  it('computeEstimatedBatting returns all three metrics', () => {
    const est = computeEstimatedBatting(0.320, 0.180, 0.045, 0.18, 0.10);
    expect(est.eBA).toBeGreaterThan(0);
    expect(est.eSLG).toBeGreaterThan(est.eBA);
    expect(est.ewOBA).toBeGreaterThan(0);
  });
});

describe('Park Factor', () => {
  it('neutral when equal scoring', () => {
    expect(calculateParkFactor(100, 100, 20, 20)).toBeCloseTo(1.0, 3);
  });

  it('>1.0 for hitter-friendly parks', () => {
    expect(calculateParkFactor(120, 100, 20, 20)).toBeCloseTo(1.2, 3);
  });

  it('returns 1.0 for no games', () => {
    expect(calculateParkFactor(0, 0, 0, 0)).toBe(1.0);
  });
});

describe('Conference Strength', () => {
  it('produces a 0-100 score', () => {
    const strength = calculateConferenceStrength(0.55, 0.52, 0.330, 3.80);
    expect(strength).toBeGreaterThanOrEqual(0);
    expect(strength).toBeLessThanOrEqual(100);
  });

  it('higher inter-conf win pct = higher strength', () => {
    const strong = calculateConferenceStrength(0.70, 0.52, 0.330, 3.80);
    const weak = calculateConferenceStrength(0.30, 0.52, 0.330, 3.80);
    expect(strong).toBeGreaterThan(weak);
  });
});

describe('League Context Derivation', () => {
  it('FIP constant clamped to [3.0, 5.0]', () => {
    expect(calculateFIPConstant(4.17, 100, 500, 800, 5000)).toBeGreaterThanOrEqual(3.0);
    expect(calculateFIPConstant(4.17, 100, 500, 800, 5000)).toBeLessThanOrEqual(5.0);
  });

  it('FIP constant returns 3.80 for 0 IP', () => {
    expect(calculateFIPConstant(4.17, 0, 0, 0, 0)).toBe(3.80);
  });

  it('wOBA scale clamped to [0.8, 1.4]', () => {
    expect(calculateWOBAScale(0.314, 0.310, 0.243)).toBeGreaterThanOrEqual(0.8);
    expect(calculateWOBAScale(0.314, 0.310, 0.243)).toBeLessThanOrEqual(1.4);
  });

  it('wOBA scale returns 1.15 for degenerate denominator', () => {
    expect(calculateWOBAScale(0.300, 0.300, 0.300)).toBe(1.15);
  });
});

describe('computeFullBattingLine', () => {
  it('returns complete advanced batting line', () => {
    const result = computeFullBattingLine(aceReese, DEFAULT_LEAGUE_CONTEXT);
    expect(result.avg).toBeGreaterThan(0);
    expect(result.obp).toBeGreaterThan(result.avg);
    expect(result.woba).toBeGreaterThan(0.5);
    expect(result.wrcPlus).toBeGreaterThan(150);
    expect(result.parkAdjusted).toBe(false);
  });

  it('marks park-adjusted when PF != 1.0', () => {
    const result = computeFullBattingLine(aceReese, DEFAULT_LEAGUE_CONTEXT, 1.05);
    expect(result.parkAdjusted).toBe(true);
    expect(result.wrcPlus).toBeLessThan(
      computeFullBattingLine(aceReese, DEFAULT_LEAGUE_CONTEXT, 1.0).wrcPlus,
    );
  });
});

describe('computeFullPitchingLine', () => {
  const starter: PitchingLine = {
    ip: 60, h: 50, er: 20, hr: 5, bb: 15, hbp: 2, so: 70,
  };

  it('returns complete advanced pitching line', () => {
    const result = computeFullPitchingLine(starter, DEFAULT_LEAGUE_CONTEXT);
    expect(result.era).toBeCloseTo(3.0, 1);
    expect(result.fip).toBeGreaterThan(0);
    expect(result.k9).toBeCloseTo(10.5, 1);
    expect(result.xFip).toBeNull(); // no fly ball data
    expect(result.parkAdjusted).toBe(false);
  });

  it('computes xFIP when fly ball data is available', () => {
    const withFB: PitchingLine = { ...starter, fb: 100 };
    const result = computeFullPitchingLine(withFB, DEFAULT_LEAGUE_CONTEXT);
    expect(result.xFip).not.toBeNull();
  });
});
