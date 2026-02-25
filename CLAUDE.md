# College Baseball Sabermetrics API

## What This Is

A standalone, developer-facing API for college baseball advanced analytics. REST + MCP server on a single Cloudflare Worker. The first sports analytics MCP.

**Owner:** Austin Humphrey — Austin@BlazeSportsIntel.com
**Repo:** github.com/Blaze-sports-Intel/college-baseball-api
**Production:** api.blazesportsintel.com (cbb-api worker)

## Architecture

```
packages/analytics/     Pure math — wOBA, wRC+, FIP, HAV-F, MMI. No side effects.
api/                    Hono worker — REST routes + MCP JSON-RPC handler
sync/                   Cron worker — replicates BSI's D1 → API's D1 every 5 min
migrations/             D1 schema for cbb-api-db
```

**Cloudflare Resources:**
- Worker: `cbb-api` (REST + MCP)
- Worker: `cbb-api-sync` (cron replication)
- D1: `cbb-api-db` (player stats, metrics, park factors, conferences)
- KV: `CBB_API_CACHE` (response cache)
- KV: `CBB_API_KEYS` (auth keys + rate limit)

**Data flows one direction:** BSI's `bsi-prod-db` → sync worker → `cbb-api-db` → API.

## Commands

```bash
npm test                   # Vitest — analytics + API tests
npm run typecheck          # TypeScript check across workspaces
cd api && npm run dev      # Wrangler dev server for API
cd api && npm run deploy   # Deploy API worker
cd sync && npm run deploy  # Deploy sync worker
```

## Conventions

Same as BSI main repo:
- Files: kebab-case
- Functions: camelCase, verb-first
- Types: PascalCase
- Constants: SCREAMING_SNAKE
- Commits: `type(scope): description`

## Tier Model

| Tier | Rate Limit | Leaderboard Rows | Advanced Metrics | Compute |
|------|-----------|------------------|------------------|---------|
| Free | 30/min | 10 | Basic only | No |
| Pro | 120/min | 100 | Full | Yes |
| Enterprise | 600/min | Unlimited | Full + bulk | Yes |

Free tier includes: AVG, OBP, SLG, OPS, K%, BB%, ISO, BABIP, ERA, WHIP, K/9, BB/9.
Pro adds: wOBA, wRC+, OPS+, FIP, xFIP, ERA-, eBA, eSLG, ewOBA, HAV-F, MMI, K/BB, LOB%.

## Known Caveats (V1)

- Linear weights are MLB-derived, not D1-specific (documented in /v1/meta/weights)
- Park factors default to 1.0 (real park factors need 20+ home games)
- Conference strength uses placeholder data until inter-conf records populate
- xFIP requires fly ball data (not available for most college teams)
- Current season only — no historical multi-season data
