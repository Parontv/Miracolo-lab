# Macro/FRED contract

The Bot context phase uses up to 3 news fetches plus 8 FRED series fetches: 11 external fetches, below the Worker per-invocation limit of 40.

FRED observations are written to `quantitative/latest-v2` under `groups.macro` and copied to `state/latest.market.quantitative.groups.macro`. The server engine reads `quantitative/latest-v2` first and falls back to the state copy.
