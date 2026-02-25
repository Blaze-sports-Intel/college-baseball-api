import { describe, it, expect } from 'vitest';
import {
  percentileRank,
  computeHScore,
  computeAScore,
  computeVScore,
  computeFScore,
  computeHAVF,
  buildPercentileTable,
  batchComputeHAVF,
  HAVF_WEIGHTS,
} from '../src';
import type { HAVFInput, PercentileTable } from '../src';

// ---------------------------------------------------------------------------
// Test cohort: 5 players with varied profiles
// ---------------------------------------------------------------------------
const cohort: HAVFInput[] = [
  {
    playerID: 'p1', name: 'Elite Hitter', team: 'Team A', league: 'SEC', season: 2026,
    avg: 0.380, obp: 0.460, slg: 0.650, woba: 0.480, iso: 0.270,
    bbPct: 0.14, kPct: 0.12, babip: 0.350, hrPct: 0.08,
    fieldingPct: 0.985, rangeFactor: 4.5, games: 30,
  },
  {
    playerID: 'p2', name: 'Contact Guy', team: 'Team B', league: 'Big 12', season: 2026,
    avg: 0.330, obp: 0.380, slg: 0.420, woba: 0.360, iso: 0.090,
    bbPct: 0.08, kPct: 0.08, babip: 0.330, hrPct: 0.02,
    fieldingPct: 0.990, rangeFactor: 5.0, games: 30,
  },
  {
    playerID: 'p3', name: 'Power Masher', team: 'Team C', league: 'ACC', season: 2026,
    avg: 0.260, obp: 0.340, slg: 0.580, woba: 0.400, iso: 0.320,
    bbPct: 0.10, kPct: 0.28, babip: 0.290, hrPct: 0.12,
    fieldingPct: 0.960, rangeFactor: 3.0, games: 30,
  },
  {
    playerID: 'p4', name: 'Average Joe', team: 'Team D', league: 'Big Ten', season: 2026,
    avg: 0.280, obp: 0.350, slg: 0.400, woba: 0.340, iso: 0.120,
    bbPct: 0.09, kPct: 0.18, babip: 0.310, hrPct: 0.04,
    fieldingPct: 0.975, rangeFactor: 4.0, games: 30,
  },
  {
    playerID: 'p5', name: 'No Glove', team: 'Team E', league: 'PAC-12', season: 2026,
    avg: 0.300, obp: 0.370, slg: 0.450, woba: 0.370, iso: 0.150,
    bbPct: 0.11, kPct: 0.15, babip: 0.320, hrPct: 0.05,
    fieldingPct: null, rangeFactor: null, games: null,
  },
];

const percentiles = buildPercentileTable(cohort);

describe('percentileRank', () => {
  it('returns 50 for empty distribution', () => {
    expect(percentileRank(0.300, [])).toBe(50);
  });

  it('returns 0 for value below entire distribution', () => {
    const dist = [10, 20, 30, 40, 50];
    expect(percentileRank(5, dist)).toBe(0);
  });

  it('returns 100 for value above entire distribution', () => {
    const dist = [10, 20, 30, 40, 50];
    expect(percentileRank(60, dist)).toBe(100);
  });

  it('handles ties with midpoint adjustment', () => {
    const dist = [10, 20, 20, 20, 30];
    const rank = percentileRank(20, dist);
    // 1 below, 3 equal: (1 + 0.5*3) / 5 * 100 = 50
    expect(rank).toBeCloseTo(50, 0);
  });

  it('returns consistent percentiles for sorted values', () => {
    const dist = [1, 2, 3, 4, 5];
    // 1 should be lowest
    expect(percentileRank(1, dist)).toBeLessThan(percentileRank(3, dist));
    expect(percentileRank(3, dist)).toBeLessThan(percentileRank(5, dist));
  });
});

describe('buildPercentileTable', () => {
  it('builds sorted distributions for all tracked stats', () => {
    expect(percentiles['avg']).toBeDefined();
    expect(percentiles['avg']!.length).toBe(5);
    // Should be sorted ascending
    for (let i = 1; i < percentiles['avg']!.length; i++) {
      expect(percentiles['avg']![i]).toBeGreaterThanOrEqual(percentiles['avg']![i - 1]);
    }
  });

  it('excludes null fielding values', () => {
    // p5 has null fielding, so only 4 entries
    expect(percentiles['fieldingPct']!.length).toBe(4);
    expect(percentiles['rangeFactor']!.length).toBe(4);
  });
});

describe('Component Scores', () => {
  it('H-Score: elite hitter scores highest', () => {
    const elite = computeHScore(cohort[0], percentiles);
    const avg = computeHScore(cohort[3], percentiles);
    expect(elite).toBeGreaterThan(avg);
    expect(elite).toBeGreaterThan(50);
  });

  it('A-Score: contact guy with low K% scores well', () => {
    const contact = computeAScore(cohort[1], percentiles);
    const masher = computeAScore(cohort[2], percentiles);
    // Contact guy has low K%, masher has high K%
    expect(contact).toBeGreaterThan(masher);
  });

  it('V-Score: power masher scores highest', () => {
    const masher = computeVScore(cohort[2], percentiles);
    const contact = computeVScore(cohort[1], percentiles);
    expect(masher).toBeGreaterThan(contact);
  });

  it('F-Score: returns 50 for null fielding data', () => {
    const noGlove = computeFScore(cohort[4], percentiles);
    expect(noGlove).toBe(50);
  });

  it('F-Score: good fielder scores above poor fielder', () => {
    const good = computeFScore(cohort[1], percentiles);
    const poor = computeFScore(cohort[2], percentiles);
    expect(good).toBeGreaterThan(poor);
  });
});

describe('computeHAVF', () => {
  it('returns all fields populated', () => {
    const result = computeHAVF(cohort[0], percentiles);
    expect(result.playerID).toBe('p1');
    expect(result.name).toBe('Elite Hitter');
    expect(result.h_score).toBeGreaterThan(0);
    expect(result.a_score).toBeGreaterThan(0);
    expect(result.v_score).toBeGreaterThan(0);
    expect(result.f_score).toBeGreaterThan(0);
    expect(result.havf_composite).toBeGreaterThan(0);
    expect(result.breakdown).toBeDefined();
  });

  it('composite is weighted sum of components', () => {
    const result = computeHAVF(cohort[0], percentiles);
    const expected =
      HAVF_WEIGHTS.H * result.h_score +
      HAVF_WEIGHTS.A * result.a_score +
      HAVF_WEIGHTS.V * result.v_score +
      HAVF_WEIGHTS.F * result.f_score;
    expect(result.havf_composite).toBeCloseTo(expected, 1);
  });

  it('breakdown contains sub-stat percentiles', () => {
    const result = computeHAVF(cohort[0], percentiles);
    expect(result.breakdown.h.avg).toBeGreaterThan(0);
    expect(result.breakdown.a.kPctInv).toBeGreaterThan(0);
    expect(result.breakdown.v.iso).toBeGreaterThan(0);
    expect(result.breakdown.f.fieldingPct).not.toBeNull();
  });

  it('null fielding breakdown for player with no fielding data', () => {
    const result = computeHAVF(cohort[4], percentiles);
    expect(result.breakdown.f.fieldingPct).toBeNull();
    expect(result.breakdown.f.rangeFactor).toBeNull();
  });
});

describe('batchComputeHAVF', () => {
  it('computes HAV-F for entire cohort', () => {
    const results = batchComputeHAVF(cohort);
    expect(results).toHaveLength(5);
    // Every player should have a composite score
    for (const r of results) {
      expect(r.havf_composite).toBeGreaterThanOrEqual(0);
      expect(r.havf_composite).toBeLessThanOrEqual(100);
    }
  });

  it('elite hitter has highest composite', () => {
    const results = batchComputeHAVF(cohort);
    const elite = results.find(r => r.playerID === 'p1')!;
    const others = results.filter(r => r.playerID !== 'p1');
    for (const other of others) {
      expect(elite.havf_composite).toBeGreaterThanOrEqual(other.havf_composite);
    }
  });

  it('returns empty array for empty input', () => {
    expect(batchComputeHAVF([])).toEqual([]);
  });
});
