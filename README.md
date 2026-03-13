# College Baseball Sabermetrics API

Advanced analytics for D1 college baseball. REST API + MCP server.

Built by [Blaze Sports Intel](https://blazesportsintel.com).

## Quick Start

```bash
# Free tier — no key required
curl https://api.blazesportsintel.com/v1/meta/glossary
curl https://api.blazesportsintel.com/v1/leaderboards/batting?metric=woba

# Pro tier — include your API key
curl -H "X-API-Key: YOUR_KEY" \
  https://api.blazesportsintel.com/v1/players/123

# Stateless computation — pure math, no DB
curl -X POST -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pa":100,"ab":90,"h":30,"doubles":8,"triples":1,"hr":5,"bb":8,"hbp":2,"so":20,"sf":0}' \
  https://api.blazesportsintel.com/v1/compute/batting
```

## MCP Server

Connect any MCP-compatible client to `https://api.blazesportsintel.com/mcp`.

12 tools including `cbb_compute_batting`, `cbb_leaderboard`, `cbb_player_stats`, and `cbb_glossary`.

## Metrics

| Metric | What It Measures | Tier |
|--------|-----------------|------|
| wOBA | Run-weighted on-base value | Pro |
| wRC+ | Park/league-adjusted hitting (100 = avg) | Pro |
| FIP | Defense-independent pitching | Pro |
| HAV-F | BSI composite player eval (0-100) | Pro |
| MMI | In-game momentum (-100 to +100) | Pro |
| AVG, OBP, SLG, ERA, WHIP | Traditional stats | Free |

Full glossary at `/v1/meta/glossary`. Methodology at `/v1/meta/methodology`.

## License

Proprietary. Contact Austin@BlazeSportsIntel.com for licensing.

## Secret Hygiene

This repository does not store runtime secrets in source control. Keep sensitive values in Cloudflare Workers/Pages secret bindings (for example, `wrangler secret put <NAME>`), and keep browser-facing code limited to opaque API endpoints.

Before merging, run:

```bash
npm run security:smoke
```

CI also runs Gitleaks plus the same smoke check on every PR.
