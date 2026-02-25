# Methodology

College Baseball Sabermetrics API — formula reference and derivation notes.

## Batting Metrics

### wOBA (Weighted On-Base Average)

The single best publicly available batting metric. Weights each method of reaching base by its run-production value, derived from run expectancy matrices.

```
wOBA = (wBB*BB + wHBP*HBP + w1B*1B + w2B*2B + w3B*3B + wHR*HR) / PA
```

**Current weights (MLB-derived):**

| Event | Weight |
|-------|--------|
| Walk (wBB) | 0.69 |
| HBP (wHBP) | 0.72 |
| Single (w1B) | 0.89 |
| Double (w2B) | 1.24 |
| Triple (w3B) | 1.56 |
| Home Run (wHR) | 2.01 |

**Caveat:** V1 ships with MLB weights as proxy. D1-specific weights require play-by-play run expectancy data. The relative ordering of outcomes is stable across levels; the absolute magnitudes may differ slightly.

### wRC+ (Weighted Runs Created Plus)

Converts wOBA into a runs-above-average rate, adjusts for park and league. 100 = league average. 150 means 50% better than average.

```
wRC/PA = (wOBA - lgwOBA) / wobaScale + lgR/PA
wRC+ = (wRC/PA / parkFactor) / lgR/PA * 100
```

**wobaScale** = (lgOBP - lgwOBA) / (lgOBP - lgAVG), clamped [0.8, 1.4]

### OPS+ (Adjusted OPS)

Simpler park-adjusted metric. 100 = league average.

```
OPS+ = 100 * (OBP / (lgOBP * PF) + SLG / (lgSLG * PF) - 1)
```

### ISO (Isolated Power)

Raw power production divorced from batting average.

```
ISO = SLG - AVG
```

### BABIP (Batting Average on Balls in Play)

How often batted balls (excluding HR and K) become hits. League average ~.300. Extreme deviation suggests luck, defensive quality, or genuine skill.

```
BABIP = (H - HR) / (AB - SO - HR + SF)
```

## Pitching Metrics

### FIP (Fielding Independent Pitching)

Isolates what a pitcher controls: strikeouts, walks/HBP, home runs. Strips out luck on balls in play and defensive quality.

```
FIP = (13*HR + 3*(BB+HBP) - 2*SO) / IP + cFIP
```

**FIP Constant (cFIP):**

```
cFIP = lgERA - (13*lgHR + 3*lgBB - 2*lgK) / lgIP
```

Clamped to [3.0, 5.0] to guard against thin early-season samples.

### xFIP (Expected FIP)

Replaces actual HR with expected HR based on league fly ball/HR rate. Smooths home run luck.

```
xFIP = (13 * (FB * lgHR/FB) + 3*(BB+HBP) - 2*SO) / IP + cFIP
```

**Note:** Requires fly ball data, which is unavailable for most college teams in V1.

### ERA- (ERA Minus)

100 = league average. Lower is better. 80 ERA- = 20% better than league.

```
ERA- = 100 * (ERA / lgERA) / parkFactor
```

### LOB% (Left On Base Percentage)

How well a pitcher strands baserunners. League average ~72%. Very high LOB% tends to regress.

```
LOB% = (H + BB + HBP - HR - ER) / (H + BB + HBP - HR)
```

## Estimated Metrics (e-prefix)

College baseball lacks Statcast data. These regressions estimate expected metrics from observable box-score outputs. Transparently labeled with 'e' prefix — estimates, not measurements.

### eBA (Estimated Batting Average)

Regresses BABIP 40% toward .300 (D1 mean), adjusts for K rate, HR rate, and conference strength.

```
expectedBABIP = 0.3 + (BABIP - 0.3) * 0.6
confAdj = (confStrength - 50) * -0.001
eBA = expectedBABIP * (1 - K%) + HR_rate + confAdj
```

### eSLG (Estimated Slugging)

```
eSLG = eBA + ISO
```

### ewOBA (Estimated wOBA)

```
ewOBA = wBB * BB% + 0.5 * (approxOBP + eSLG * 0.8)
```

## BSI Proprietary Metrics

### HAV-F (Hits / At-Bat Quality / Velocity / Fielding)

Composite player evaluation. Each component scores 0-100 via percentile rank against the D1 cohort, then weighted:

```
HAV-F = 0.30*H + 0.25*A + 0.25*V + 0.20*F
```

**H-Score (Hitting):** AVG 25%, OBP 25%, SLG 20%, wOBA 20%, ISO 10%

**A-Score (At-Bat Quality):** BB% 30%, inverse K% 30%, BABIP 20%, HR% 20%

**V-Score (Velocity proxy):** ISO 40%, SLG 35%, HR% 25%. Without exit velocity data, power metrics serve as the proxy.

**F-Score (Fielding):** Fielding% 60%, Range Factor 40%. Players without fielding data receive a neutral 50.

Percentile ranks are computed against the current D1 cohort. A player's HAV-F reflects where they stand relative to their peers this season.

### MMI (Momentum Magnitude Index)

In-game momentum computation. Signed -100 (away dominant) to +100 (home dominant).

```
MMI = clamp(-100, 100, (SD*0.40 + RS*0.30 + BS*0.15) * GP)
```

**SD (Score Differential):** Raw lead/deficit, amplified by innings remaining. A 3-run lead matters more in the 8th than the 2nd.

```
SD = (homeScore - awayScore) * (1 + 0.1 * inningsRemaining) / 10 * 100
```

**RS (Recent Scoring):** Net runs in last 2 completed innings. Captures who has the hot hand.

**GP (Game Phase):** Multiplier that amplifies momentum as the game progresses.
- Early (innings 1-3): 0.7
- Mid (innings 4-6): 1.0
- Late (innings 7-9): 1.3
- Extras: 1.5

**BS (Base Situation):** Baserunner threat. Bases loaded = 15, RISP = 10, runner on first = 3. Sign flips based on who's batting (bottom = home positive, top = away negative).

**Magnitude Classification:**
- Low: |MMI| < 25
- Medium: 25-49
- High: 50-74
- Extreme: 75+

**Excitement Rating (game-level):**
- Routine, Competitive, Thriller, Instant-Classic — derived from volatility, lead changes, and max swing.

## League Context

All relative metrics (wRC+, OPS+, ERA-, FIP) require league-wide baselines. These are derived from aggregate D1 statistics:

```
lgAVG = totalH / totalAB
lgOBP = (totalH + totalBB + totalHBP) / totalPA
lgSLG = (total1B + 2*total2B + 3*total3B + 4*totalHR) / totalAB
lgERA = (totalER * 9) / totalIP
lgR/PA = totalR / totalPA
```

V1 uses MLB 2024 baselines as proxy. The sync worker will compute actual D1 context once sufficient season data accumulates.

## Park Factors

Single-factor adjustment. 1.0 = neutral. >1.0 = hitter-friendly. <1.0 = pitcher-friendly.

```
Park Factor = (homeRPG) / (awayRPG)
```

V1 defaults to 1.0 (neutral) for all parks. Real park factors require 20+ home games for stability.
