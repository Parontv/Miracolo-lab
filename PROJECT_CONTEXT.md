# Miracolo Lab — Project Context

Updated: 2026-10-28

## Purpose and working rules
Miracolo Lab is a market-intelligence and paper-trading web app. Keep the interface mobile-friendly, readable, simple, and in Italian. Preserve existing user-facing tabs and features unless the product decision explicitly consolidates them. Prefer complete-file replacements over partial snippets when editing code. Work autonomously where possible; run checks before deployment and report precisely what was and was not tested. Do not claim a deployment or runtime test succeeded without evidence. The app is for analysis and paper trading, not autonomous real-money execution.

## Repository and hosting
- GitHub repository: https://github.com/Parontv/Miracolo-lab
- Cloudflare Worker: `miracolo-lab`
- Historical public endpoint: https://miracolo-lab.listaconcerti.workers.dev
- Current Wrangler entrypoint: `bot-live-router.js` (`live-worker.js` remains a legacy production worker module).
- Static assets: `./public` through `ASSETS`.
- KV binding: `ML_KV`; namespace ID and deployment credentials must be verified from the deployment environment and must never be committed.
- Cron: every 5 minutes.

## Current Bot architecture
- `bot-live-router.js` is the current Worker entrypoint and routes `/api/bot/run`, `/api/bot/decision`, `/api/bot/health` and `/api/bot/eval` to the server-side Bot engine.
- `bot-server-engine.js` is the current server-side decision engine. It is PAPER only.
- `public/bot-controller.js` is a client controller only: it starts a server scan, receives the result and emits `miracolo:botdecision` for the UI.
- `public/bot-workspace.js` is the canonical Bot UI. Strategy Lab analysis is consolidated into this Bot rather than being a second operational decision surface.
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
- Maximum: 3 trades/day and 3 concurrent paper positions.
- **Non-implemented controls:** ATR-derived stop/target automation is not implemented as a validated production control; costs and slippage are not yet simulated/validated; the €10 risk-per-operation rule is not yet implemented as an enforced production guardrail.
- Open paper positions are updated server-side from cached watchlist history; stop, target and time expiry must not be described as production guarantees until validated.
- Decision snapshots are stored separately from the execution journal for later learning.
- Learning is informational until the sample is sufficient; suggested weights are measurement-only and are not applied automatically. Automatic application is disabled by default and requires `BOT_AUTO_WEIGHTS="true"` plus at least 100 samples per module.

## Bot evaluation / measurement
- `bot-evaluation.js` records one compact signal snapshot per 15-minute window, shared by cron and the `Avvia tutto` button.
- Signal history is stored in `bot/signals/v1` and capped at 600 records.
- Evaluation horizons are 1 hour, 1 day and 5 days. Equity modules and consensus are evaluated against SPY; the crypto module is evaluated against BTC/USD.
- Records created outside NYSE 09:30–16:00 America/New_York are excluded from equity evaluation; weekends and the implemented US market-holiday calendar are annotated as `MARKET_CLOSED_IGNORED` without a fetch.
- `bot/eval/v1` stores aggregate module statistics, baselines, edges, evaluation marks and suggested weights. A module with fewer than 30 evaluated samples is labelled `Campione insufficiente`; hit rate is not displayed as a probability.
- `bot/journal/v1` stores PAPER order metadata linked to the signal record; the next cron synchronizes fill price/status using one `GET /v2/orders?status=closed&limit=20` request.
- New evaluation data is measurement-only: it does not change consensus logic in this task.

## New KV keys
- `bot/signals/v1` — bounded array of signal snapshots (max 600).
- `bot/eval/v1` — evaluation report for 1h/24h/5d, baseline, edge, evaluation marks and suggested weights.
- `bot/journal/v1` — PAPER order journal with signal record linkage and fill/status updates.
- `bot/last-run` — cron phase telemetry, fetch counts, errors and duration; existing key, now also includes evaluation/journal phases.

## Verification and deployment
- Run syntax/build/behavioral checks before deployment.
- `tests/bot-evaluation.test.mjs` covers 15-minute dedupe, 600-record cap, 1h/24h/5d evaluation, hit/miss, neutral modules, baseline, insufficient sample, closed market and missing price.
- `tests/bot-subrequest-contract.test.mjs` verifies the evaluation path adds no external fetches and keeps the market/crypto/position/journal budgets bounded.
- `.github/workflows/deploy-miracolo-fixed.yml` validates the evaluation test before deployment; feature-branch validation does not deploy to production.
- After deployment, verify `/api/bot/decision`, `/api/bot/eval`, `/api/bot/health`, `/api/bot/run`, key payload contracts and the UI click path before declaring success.
- Historical deployment reports are not current-status evidence. Always verify the current workflow run and live endpoint.
