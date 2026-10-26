# Miracolo Lab — Project Context

Updated: 2026-10-27

## Purpose and working rules
Miracolo Lab is a market-intelligence and paper-trading web app. Keep the interface mobile-friendly, readable, simple, and in Italian. Prefer complete-file replacements over partial snippets when editing code. Work autonomously where possible; run checks before deployment and report precisely what was and was not tested. Do not claim a deployment or runtime test succeeded without evidence. The app is for analysis and PAPER trading only; never implement or invoke real-money execution.

## Repository and hosting
- GitHub repository: https://github.com/Parontv/Miracolo-lab
- Cloudflare Worker: `miracolo-lab`
- Public endpoint: https://miracolo-lab.listaconcerti.workers.dev
- Production entrypoint: `live-worker.js`.
- Static assets: `./public` through `ASSETS`.
- KV binding: `ML_KV`. The namespace ID is deployment configuration only and must never be committed.
- Cron: every 5 minutes.
- Current fix branch: `fix/paper-execution`; production deploy is triggered from `main` only.

## Current Bot architecture
- `live-worker.js` is the production entrypoint and routes `/api/bot/plan`, `/api/bot/run` and `/api/bot/decision` to `bot-server-engine.js` / `bot-paper-auto.js`.
- `bot-server-engine.js` is the current server-side decision engine. `bot-server-engine-v9.js` does not exist and must not be referenced as the current engine.
- `public/bot-workspace.js` is the current Bot UI. It is the single operational decision surface; Strategy Lab analysis is consolidated into the Bot.
- Strategy modules remain reusable internally and must not create competing operational decisions.
- The server decision contract uses module records containing direction, strength, confidence, coverage, evidence and asOf.
- WAIT is the default when evidence, freshness or independent-family coverage is insufficient.

## Product requirements
- Analysis and PAPER trading only. Never implement or invoke real-money orders.
- No API keys, Cloudflare tokens, account identifiers or other secrets in source control.
- Use free data sources where practical and disclose source limitations.
- Target at most 2–3 paper trades/day; the hard BUY guardrail is 3 buys/day.
- Maximum 3 concurrent paper positions and a configurable maximum exposure.
- Keep crypto and long-term investments monitoring separate from active trading; crypto alerts only for black-swan events.
- Explain actions and signals in simple Italian; use clear typography and simple controls.
- Strategy analysis can include Polymarket-related information but must never present probabilities as guaranteed forecasts.

## Data and intelligence
- Market sources include the existing live market pipeline, Alpaca Paper market data and Yahoo Finance-derived fallback data.
- News/RSS integrations include GDELT/Google News/CNBC/MarketWatch and institutional/social feeds where available; availability and freshness vary by provider.
- FRED quantitative data is exposed under `market.quantitative.groups` and includes inflation, unemployment, payrolls, GDP, industrial production, M2, Fed Funds, Treasury yields, credit spreads and financial conditions.
- News processing should deduplicate, apply time decay, weight institutional/social categories differently and avoid naive keyword-only conclusions.
- Gemini, when configured, is an auxiliary structured intelligence source and must never be the sole decision maker.

## Bot operating model
- Capital: €2,000 paper.
- Risk budget: €10 per trade.
- Maximum: 3 BUYs/day and 3 concurrent paper positions.
- Stops/targets are derived from ATR rather than fixed percentages.
- Costs and slippage are simulated.
- Alpaca GET `/v2/orders`, `/v2/positions` and `/v2/clock` are the execution guardrail sources of truth.
- `client_order_id` is deterministic for signal/day to prevent duplicate submissions across the 5-minute cron.
- Execution records are stored in KV under `bot/execution/latest` plus a rolling log of the latest 50 executions.
- Decision snapshots and the execution journal remain separate for later learning.
- Learning is informational until the sample is sufficient; weights must not be aggressively changed from small samples.

## Verification and deployment
- Run syntax/build/behavioral checks before deployment.
- Existing Bot tests remain required; paper execution tests cover BTCUSD symbol normalization, BUY/day limits, missing KV, Alpaca 403/422 rejection and deterministic client order IDs.
- `.github/workflows/bot-validation.yml` validates Bot behavior on relevant changes.
- `.github/workflows/deploy-miracolo-fixed.yml` deploys only from `main`; it requires repository variable `ML_KV_NAMESPACE_ID` and injects the ID into a temporary deployment config.
- After deployment, verify `/api/alpaca/status`, `/api/bot/plan`, `/api/bot/decision` and the Bot UI click path. `/api/bot/plan` is dry-run and must never submit an order.
- Historical workflow reports are not current-status evidence. Always verify the current workflow run and live endpoint before declaring deployment success.
