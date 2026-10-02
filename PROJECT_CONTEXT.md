# Miracolo Lab — Project Context

Updated: 2026-10-02

## Purpose and working rules
Miracolo Lab is a market-intelligence and paper-trading web app. Keep the interface mobile-friendly, readable, simple, and in Italian. Preserve existing tabs and features. Prefer complete-file replacements over partial snippets when editing code. Work autonomously where possible; run checks before deployment and report precisely what was and was not tested. Do not claim a deployment or runtime test succeeded without evidence. The app is for analysis and paper trading, not autonomous real-money execution.

## Repository and hosting
- GitHub repository: https://github.com/Parontv/Miracolo-lab
- Cloudflare Worker: `miracolo-lab`
- Historical public endpoint: https://miracolo-lab.listaconcerti.workers.dev
- Worker config previously reported: entrypoint `ai-worker.js`, static assets in `./public`, KV binding `ML_KV`, cron every 5 minutes.
- Static asset binding `ASSETS` was previously restored.
- KV namespace association/configuration should be rechecked; a prior config had a KV declaration without an `id`.

## Historical deployment evidence (not a statement of current status)
- Around 2026-09-21, GitHub Actions workflow run #303 was reported SUCCESS, commit `073dd8e`; app URL above.
- At that time /api/chart reportedly passed with 131 candles, Memory API passed with at least one snapshot, and GOLD, BTC, ETH, News Core were working.
- A separate Listaconcerti production deploy (#44) failed because the Cloudflare token lacked KV creation/provisioning permissions.
- Earlier historical deployment on 2026-08-30: workflow run #213 succeeded, Worker V19.2, commit `6ed7fb1...`.
- These are historical reports. Current deploy, secrets, bindings, endpoints, and live runtime must be verified afresh.

## Cloud access status
GitHub repository access has been available through the GitHub integration, including file read/write. No direct Cloudflare management/deploy tool was identified in the available tools during the 2026-10-02 session. Cloudflare deployment may be possible indirectly through GitHub Actions if the repository workflow is configured and valid GitHub Secrets/Cloudflare credentials have the necessary permissions. Do not assume secrets are valid or reveal/store tokens. Verify workflow runs and live endpoints before stating current status.

## App structure and known areas
- Main backend historically discussed as `worker.js`; configuration points to `ai-worker.js` (confirm actual current source before editing).
- Static UI under `public/`; existing tabs to preserve include Dashboard, Market, Investimenti, Bot, Strategy Lab, Alert, Config, Learning.
- APIs previously mentioned: `/api/live`, `/api/full-scan`, `/api/market-monitor`, `/api/chart`, `/api/bot-monitor`, `/api/crypto`, `/api/prices`, `/api/universe`.
- FRED macro series intended: US CPI, core CPI, unemployment, nonfarm payrolls, real GDP, industrial production, M2, effective Fed Funds.
- News/RSS integrations previously included GDELT, Google News RSS, Yahoo Finance, CNBC and others; feed errors and 503s have occurred.
- Recent add-on: `public/v1/intelligence-dashboard.js`, commit `2d311e5b4a6980ceea4ec79e802a935651ec6683`; included in `public/index.html` by commit `675051b462e039760f82709514aafd07c5c0aca8`. It renders a market-intelligence panel and fetches /api/live and /api/market-monitor. Prior check confirmed script inclusion and refresh marker only; no browser runtime test was performed.

## Product requirements
- Keep crypto and long-term investments monitoring separate from active trading; crypto alerts only for black-swan events.
- Paper trading should support historical records, simulation, fees/taxes and execution-delay assumptions; target at most 2–3 trades/day.
- Explain actions and signals in simple Italian; use clear typography, light/readable palette, and simple controls.
- Strategy Lab has included a goal to integrate Polymarket-related analysis; avoid presenting probability signals as guaranteed forecasts.
- No initial spending preferred; favor free sources and disclose source limits.

## Security and deployment
Never commit API keys, Cloudflare tokens, account identifiers, or secrets. Use GitHub Actions Secrets/Cloudflare environment configuration. Before deploy: inspect current branch/files/workflow, run syntax/build checks available, verify asset paths and API contracts, then deploy only through an authorized workflow/tool. After deploy, verify HTTP responses and key API payloads; preserve rollback information.
