# Miracolo Lab — Project Context

Updated: 2026-10-23

## Purpose and working rules
Miracolo Lab is a market-intelligence and paper-trading web app. Keep the interface mobile-friendly, readable, simple, and in Italian. Preserve existing user-facing tabs and features unless the product decision explicitly consolidates them. Prefer complete-file replacements over partial snippets when editing code. Work autonomously where possible; run checks before deployment and report precisely what was and was not tested. Do not claim a deployment or runtime test succeeded without evidence. The app is for analysis and paper trading, not autonomous real-money execution.

## Repository and hosting
- GitHub repository: https://github.com/Parontv/Miracolo-lab
- Cloudflare Worker: `miracolo-lab`
- Historical public endpoint: https://miracolo-lab.listaconcerti.workers.dev
- Current Worker entrypoint: `live-worker.js`.
- Static assets: `./public` through `ASSETS`.
- KV binding: `ML_KV`; namespace ID and deployment credentials must be verified from the deployment environment and must never be committed.
- Cron: every 5 minutes.

## Current Bot architecture
- `live-worker.js` is the production entrypoint and routes `/api/bot/run` and `/api/bot/decision` to the server-side Bot engine.
- `bot-server-engine-v9.js` is the current server-side decision engine. It is PAPER only.
- `public/v1/bot-engine.js` is a client controller only: it starts a server scan, receives the result and emits `miracolo:botdecision` for the UI.
- `public/v1/bot-workspace-v1.js` is the Bot UI. Strategy Lab analysis is consolidated into this Bot rather than being a second operational decision surface.
- Strategy modules remain reusable internally; they must not create independent Bot decisions or competing UI pipelines.
- The server decision contract is based on module records containing direction, strength, confidence, coverage, evidence and asOf.
- WAIT is the default when evidence, freshness or independent-family coverage is insufficient.

## Product requirements
- Analysis and PAPER trading only. Never implement or invoke real-money orders.
- No API keys, Cloudflare tokens, account identifiers or other secrets in source control.
- Use free data sources and disclose source limitations.
- Target at most 2–3 paper trades/day.
- Keep crypto and long-term investments monitoring separate from active trading; crypto alerts only for black-swan events.
- Explain actions and signals in simple Italian; use clear typography and simple controls.
- Strategy analysis can include Polymarket-related information but must never present probabilities as guaranteed forecasts.

## Data and intelligence
- Market sources include Yahoo Finance-derived daily history and the existing live market pipeline.
- News/RSS integrations include GDELT/Google News/CNBC/MarketWatch and institutional/social feeds where available; availability and freshness vary by provider.
- FRED quantitative data is exposed under `market.quantitative.groups` and includes inflation, unemployment, payrolls, GDP, industrial production, M2, Fed Funds, Treasury yields, credit spreads and financial conditions.
- News processing should deduplicate, apply time decay, weight institutional/social categories differently and avoid naive keyword-only conclusions.
- Gemini, when configured, is an auxiliary structured intelligence source and must never be the sole decision maker.

## Bot operating model
- Capital: €2,000 paper.
- Risk budget: €10 per trade.
- Maximum: 3 trades/day and 3 concurrent paper positions.
- Stops/targets are derived from ATR rather than fixed percentages.
- Costs and slippage are simulated.
- Open paper positions are updated server-side from cached watchlist history; stop, target and time expiry can close them.
- Decision snapshots are stored separately from the execution journal for later learning.
- Learning is informational until the sample is sufficient; weights must not be aggressively changed from small samples.

## Verification and deployment
- Run syntax/build/behavioral checks before deployment.
- `tests/bot-engine-v9.test.mjs` covers numeric null handling, RSI minimum sample, technical minimum history and structured technical output.
- `.github/workflows/bot-validation.yml` validates Bot V9 syntax and behavioral tests on relevant changes.
- After deployment, verify `/api/bot/decision`, `/api/bot/run`, key payload contracts and the UI click path before declaring success.
- Historical deployment reports are not current-status evidence. Always verify the current workflow run and live endpoint.
