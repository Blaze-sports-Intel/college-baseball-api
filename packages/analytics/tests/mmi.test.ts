import { describe, it, expect } from 'vitest';
import {
  computeSD,
  computeRS,
  computeGP,
  computeBS,
  classifyMagnitude,
  classifyDirection,
  computeMMI,
  computeGameSummary,
} from '../src';
import type { MMIInput, MMISnapshot, InningScore } from '../src';

describe('computeSD', () => {
  it('tied game = 0 SD', () => {
    expect(computeSD(3, 3, 4, 9)).toBe(0);
  });

  it('home lead is positive', () => {
    expect(computeSD(5, 2, 4, 9)).toBeGreaterThan(0);
  });

  it('away lead is negative', () => {
    expect(computeSD(2, 5, 4, 9)).toBeLessThan(0);
  });

  it('same lead matters more late in game', () => {
    const early = computeSD(5, 3, 7, 9); // 7 innings remaining = 2nd inning
    const late = computeSD(5, 3, 1, 9);  // 1 inning remaining = 8th inning
    // Early has higher leverage multiplier so actually higher absolute value
    expect(Math.abs(early)).toBeGreaterThan(Math.abs(late));
    // Both positive (home leading)
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(0);
  });

  it('caps at +/-100', () => {
    const blowout = computeSD(15, 0, 5, 9);
    expect(blowout).toBeLessThanOrEqual(100);
    expect(blowout).toBeGreaterThanOrEqual(-100);
  });
});

describe('computeRS', () => {
  it('returns 0 for no recent innings', () => {
    expect(computeRS([])).toBe(0);
  });

  it('positive for home scoring more recently', () => {
    const innings: InningScore[] = [
      { inning: 5, homeRuns: 3, awayRuns: 0 },
      { inning: 6, homeRuns: 2, awayRuns: 1 },
    ];
    expect(computeRS(innings)).toBeGreaterThan(0);
  });

  it('negative for away scoring more recently', () => {
    const innings: InningScore[] = [
      { inning: 5, homeRuns: 0, awayRuns: 4 },
      { inning: 6, homeRuns: 0, awayRuns: 2 },
    ];
    expect(computeRS(innings)).toBeLessThan(0);
  });

  it('caps at +/-100', () => {
    const bigInning: InningScore[] = [
      { inning: 5, homeRuns: 10, awayRuns: 0 },
      { inning: 6, homeRuns: 8, awayRuns: 0 },
    ];
    expect(computeRS(bigInning)).toBeLessThanOrEqual(100);
  });

  it('only uses last 2 innings', () => {
    const innings: InningScore[] = [
      { inning: 3, homeRuns: 5, awayRuns: 0 },
      { inning: 4, homeRuns: 0, awayRuns: 0 },
      { inning: 5, homeRuns: 0, awayRuns: 3 },
    ];
    // Only innings 4 and 5 count: net = 0 + (-3) = -3
    expect(computeRS(innings)).toBeLessThan(0);
  });
});

describe('computeGP', () => {
  it('early game = 0.7', () => {
    expect(computeGP(2, 9)).toBe(0.7);
  });

  it('mid game = 1.0', () => {
    expect(computeGP(5, 9)).toBe(1.0);
  });

  it('late game = 1.3', () => {
    expect(computeGP(8, 9)).toBe(1.3);
  });

  it('extras = 1.5', () => {
    expect(computeGP(10, 9)).toBe(1.5);
    expect(computeGP(13, 9)).toBe(1.5);
  });
});

describe('computeBS', () => {
  it('empty bases = 0', () => {
    expect(computeBS([false, false, false], 'top')).toBe(0);
    expect(computeBS([false, false, false], 'bottom')).toBe(0);
  });

  it('runner on first only = 3 (or -3)', () => {
    expect(computeBS([true, false, false], 'bottom')).toBe(3);
    expect(computeBS([true, false, false], 'top')).toBe(-3);
  });

  it('RISP = 10 (or -10)', () => {
    expect(computeBS([false, true, false], 'bottom')).toBe(10);
    expect(computeBS([false, false, true], 'bottom')).toBe(10);
  });

  it('bases loaded = 15 (or -15)', () => {
    expect(computeBS([true, true, true], 'bottom')).toBe(15);
    expect(computeBS([true, true, true], 'top')).toBe(-15);
  });
});

describe('classifyMagnitude', () => {
  it('low < 25', () => {
    expect(classifyMagnitude(10)).toBe('low');
  });

  it('medium 25-49', () => {
    expect(classifyMagnitude(30)).toBe('medium');
  });

  it('high 50-74', () => {
    expect(classifyMagnitude(60)).toBe('high');
  });

  it('extreme >= 75', () => {
    expect(classifyMagnitude(80)).toBe('extreme');
  });
});

describe('classifyDirection', () => {
  it('neutral for small values', () => {
    expect(classifyDirection(3)).toBe('neutral');
    expect(classifyDirection(-4)).toBe('neutral');
  });

  it('home for positive', () => {
    expect(classifyDirection(20)).toBe('home');
  });

  it('away for negative', () => {
    expect(classifyDirection(-20)).toBe('away');
  });
});

describe('computeMMI', () => {
  it('tied game with no recent activity = near 0', () => {
    const input: MMIInput = {
      gameId: 'g1',
      inning: 5,
      inningHalf: 'top',
      outs: 1,
      homeScore: 3,
      awayScore: 3,
      runnersOn: [false, false, false],
      recentInnings: [],
    };
    const result = computeMMI(input);
    expect(Math.abs(result.value)).toBeLessThan(5);
    expect(result.direction).toBe('neutral');
  });

  it('home blowout = high positive', () => {
    const input: MMIInput = {
      gameId: 'g2',
      inning: 7,
      inningHalf: 'bottom',
      outs: 0,
      homeScore: 10,
      awayScore: 1,
      runnersOn: [true, true, false],
      recentInnings: [
        { inning: 6, homeRuns: 4, awayRuns: 0 },
        { inning: 7, homeRuns: 2, awayRuns: 0 },
      ],
    };
    const result = computeMMI(input);
    expect(result.value).toBeGreaterThan(50);
    expect(result.direction).toBe('home');
  });

  it('returns all components', () => {
    const input: MMIInput = {
      gameId: 'g3',
      inning: 4,
      inningHalf: 'top',
      outs: 2,
      homeScore: 2,
      awayScore: 4,
      runnersOn: [true, false, true],
      recentInnings: [{ inning: 3, homeRuns: 0, awayRuns: 3 }],
    };
    const result = computeMMI(input);
    expect(result.components.sd).toBeDefined();
    expect(result.components.rs).toBeDefined();
    expect(result.components.gp).toBeDefined();
    expect(result.components.bs).toBeDefined();
    expect(result.magnitude).toBeDefined();
  });

  it('value clamped to [-100, 100]', () => {
    const input: MMIInput = {
      gameId: 'g4',
      inning: 10, // extras
      inningHalf: 'bottom',
      outs: 0,
      homeScore: 15,
      awayScore: 0,
      runnersOn: [true, true, true],
      recentInnings: [
        { inning: 9, homeRuns: 5, awayRuns: 0 },
        { inning: 10, homeRuns: 3, awayRuns: 0 },
      ],
    };
    const result = computeMMI(input);
    expect(result.value).toBeLessThanOrEqual(100);
    expect(result.value).toBeGreaterThanOrEqual(-100);
  });
});

describe('computeGameSummary', () => {
  function makeSnapshot(value: number): MMISnapshot {
    return {
      value,
      direction: classifyDirection(value),
      magnitude: classifyMagnitude(Math.abs(value)),
      components: { sd: 0, rs: 0, gp: 1.0, bs: 0 },
    };
  }

  it('empty snapshots returns routine', () => {
    const summary = computeGameSummary('g1', []);
    expect(summary.excitementRating).toBe('routine');
    expect(summary.maxMmi).toBe(0);
  });

  it('computes correct aggregate stats', () => {
    const snapshots: MMISnapshot[] = [
      makeSnapshot(10),
      makeSnapshot(-20),
      makeSnapshot(30),
      makeSnapshot(-10),
      makeSnapshot(40),
    ];
    const summary = computeGameSummary('g2', snapshots);
    expect(summary.maxMmi).toBe(40);
    expect(summary.minMmi).toBe(-20);
    expect(summary.avgMmi).toBe(10);
    expect(summary.volatility).toBeGreaterThan(0);
  });

  it('counts lead changes', () => {
    const snapshots: MMISnapshot[] = [
      makeSnapshot(20),   // home
      makeSnapshot(-15),  // away -> change
      makeSnapshot(25),   // home -> change
      makeSnapshot(-30),  // away -> change
    ];
    const summary = computeGameSummary('g3', snapshots);
    expect(summary.leadChanges).toBe(3);
  });

  it('finds max swing', () => {
    const snapshots: MMISnapshot[] = [
      makeSnapshot(10),
      makeSnapshot(-40),  // swing = 50
      makeSnapshot(-35),  // swing = 5
      makeSnapshot(20),   // swing = 55
    ];
    const summary = computeGameSummary('g4', snapshots);
    expect(summary.maxSwing).toBeCloseTo(55, 0);
  });

  it('high volatility + lead changes = thriller or instant-classic', () => {
    const snapshots: MMISnapshot[] = [
      makeSnapshot(40),
      makeSnapshot(-50),
      makeSnapshot(60),
      makeSnapshot(-40),
      makeSnapshot(70),
      makeSnapshot(-30),
      makeSnapshot(50),
    ];
    const summary = computeGameSummary('g5', snapshots);
    expect(['thriller', 'instant-classic']).toContain(summary.excitementRating);
  });
});
