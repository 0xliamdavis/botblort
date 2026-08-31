# BLORT BOT

<p align="center">
  <img src="https://iili.io/CpjSv8x.md.jpg" alt="Blort Bot Logo" width="120" height="120" style="border-radius:12px;" />
</p>

<p align="center">
  <strong>Serverless telemetry & risk terminal for tokens deployed by <a href="https://x.com/bankrbot">@bankrbot</a> on Base via Doppler Protocol.</strong>
</p>

<p align="center">
  <a href="https://0xliamdavis.github.io/botblort/"><img src="https://img.shields.io/badge/Live-Dashboard-2DD4BF?style=for-the-badge&logo=github&logoColor=white" alt="Live Dashboard" /></a>
  <a href="https://0xliamdavis.github.io/botblort/terminal.html"><img src="https://img.shields.io/badge/Open-Terminal-C84B31?style=for-the-badge&logo=terminal&logoColor=white" alt="Open Terminal" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.6.0-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/chain-Base-0052FF?style=flat-square&logo=ethereum&logoColor=white" alt="Base" />
  <img src="https://img.shields.io/badge/protocol-Doppler-7B61FF?style=flat-square" alt="Doppler" />
  <img src="https://img.shields.io/badge/infra-Serverless-orange?style=flat-square&logo=githubactions&logoColor=white" alt="Serverless" />
  <img src="https://img.shields.io/badge/update-every%2010%20min-lightgrey?style=flat-square" alt="Update" />
  <a href="https://github.com/0xliamdavis/botblort/actions"><img src="https://img.shields.io/github/actions/workflow/status/0xliamdavis/botblort/fetch-data.yml?style=flat-square&label=telemetry" alt="Telemetry Status" /></a>
</p>

---

## Live Links

| Page | URL |
| --- | --- |
| **Landing Page** | [0xliamdavis.github.io/botblort](https://0xliamdavis.github.io/botblort/) |
| **Terminal Dashboard** | [0xliamdavis.github.io/botblort/terminal.html](https://0xliamdavis.github.io/botblort/terminal.html) |
| **GitHub Repo** | [github.com/0xliamdavis/botblort](https://github.com/0xliamdavis/botblort) |

---

## Social

| Account | Link |
| --- | --- |
| Bot | [@BotBlort](https://x.com/BotBlort) |
| Builder | [@0xliamdavis](https://x.com/0xliamdavis) |
| Ecosystem | [@bankrbot](https://x.com/bankrbot) |

---

## What is Blort Bot?

Blort Bot is a **serverless on-chain telemetry terminal** focused on tokens launched by [@bankrbot](https://x.com/bankrbot) on **Base** using the **Doppler Protocol**.

It automatically:

- Fetches real token launches from the official Bankr API
- Filters only **deployed** tokens on **Base**
- Enriches market data (price, volume, liquidity, txns) via DexScreener
- Calculates heuristic risk scores
- Surfaces activity signals (volume pressure, buy/sell imbalance)
- Auto-updates every **~10 minutes** via GitHub Actions
- Serves a clean terminal-style dashboard on GitHub Pages

No VPS. No paid backend. Fully free & serverless.

---

## Features

| Feature | Description |
| --- | --- |
| **Live Bankr Launches** | Only real `@bankrbot` deployments on Base (Doppler) |
| **Risk Scoring** | Heuristic score based on liquidity, volume ratio, tx count, FDV disparity |
| **Activity Radar** | Real signals from volume intensity, buy/sell pressure & avg trade size |
| **Smart New Token Handling** | New launches appear immediately (even before DexScreener indexes) with clear `NEW` / `NO DATA` badges |
| **One-Click Trade** | Direct link into Bankr Terminal + Basescan |
| **Fully Serverless** | GitHub Actions + GitHub Pages only |

---

## Architecture

```text
GitHub Actions (every ~10 min)
        │
        ▼
  scripts/fetch.js
        │
        ▼
   data/data.json
        │
        ▼
   GitHub Pages
   ├── index.html      → Landing page
   └── terminal.html   → Live dashboard
```

**Data flow**

1. Pull launches from `api.bankr.bot`
2. Enrich with DexScreener (price / volume / liquidity / txns)
3. Score risk + generate activity signals
4. Write `data/data.json`
5. Dashboard reads JSON client-side (auto refresh every 30s)

---

## Data Sources

| Source | Purpose |
| --- | --- |
| [api.bankr.bot/token-launches](https://api.bankr.bot/token-launches) | Official list of Bankr token launches |
| [DexScreener API](https://docs.dexscreener.com) | Price, volume, liquidity, transactions |

---

## Risk Scoring

Score starts at **100** and is reduced based on:

| Condition | Penalty |
| --- | --- |
| Critical low liquidity (`< $1k`) | −45 |
| Low liquidity (`< $5k`) | −25 |
| Medium liquidity (`< $20k`) | −10 |
| High volume / liquidity ratio (`> 8×`) | −20 |
| Low transaction count | −15 |
| Extreme FDV vs liquidity (`> 150×`) | −15 |
| New launch + no market data yet | Special **CAUTION** flag |

**Status labels**

| Status | Score range |
| --- | --- |
| **SAFE** | ≥ 70 |
| **CAUTION** | 45 – 69 |
| **HIGH_RISK** | < 45 |

> This is a **heuristic** model for quick screening — not financial advice and not a full audit.

---

## Activity Radar

Activity Radar ranks tokens using **real DexScreener metrics** (not fake/random data):

- **AVG TRADE** — high average $ per transaction
- **BUY PRESSURE** — strong buy-side txn dominance
- **SELL PRESSURE** — strong sell-side txn dominance
- **HIGH VOLUME** — elevated volume relative to liquidity

It highlights where activity is concentrating. It is **not** individual whale transaction tracking.

---

## Filter Logic (v2.6)

Designed so the dashboard **does not go empty** during active launch windows:

| Rule | Behavior |
| --- | --- |
| Has market data (volume or liquidity > 0) | Always shown |
| New launch (`< 6 hours`) | Always shown (even if DexScreener not indexed yet) |
| Mid-age (`≤ 48 hours`) without data | Still shown (index lag tolerance) |
| Very old (`> 48 hours`) + zero activity | Dropped as noise |

Tokens are sorted by: **volume → liquidity → newest launch**.

---

## Project Structure

```text
botblort/
├── .github/workflows/
│   └── fetch-data.yml      # Auto update every ~10 minutes
├── data/
│   └── data.json           # Generated telemetry payload
├── scripts/
│   └── fetch.js            # Core engine (v2.6)
├── index.html              # Landing page
├── terminal.html           # Live dashboard
├── package.json
└── README.md
```

---

## Local Development

```bash
# Clone
git clone https://github.com/0xliamdavis/botblort.git
cd botblort

# Run telemetry once
node scripts/fetch.js

# Open in browser
# index.html or terminal.html
```

No external npm dependencies required (uses native Node.js `fetch`).

### Manual workflow trigger

Go to **Actions → Blort Bot Telemetry Engine Pipeline → Run workflow**.

---

## Notes & Limitations

- Very new Doppler (Uniswap V4) tokens may take time to appear on DexScreener. Until then, price/volume show as `—` and tokens are marked `NO DATA`.
- Activity Radar is derived from aggregated market metrics, not real-time individual whale feeds.
- GitHub Actions scheduled runs are best-effort and can be delayed under platform load.
- This is an **unofficial community tool** built for the Bankr ecosystem.  
  **Not affiliated with or endorsed by Bankr.**

---

## Roadmap (ideas)

- [ ] Volume spike detection vs previous snapshot
- [ ] Optional holder / deployer signals
- [ ] Auto posts from [@BotBlort](https://x.com/BotBlort) on high-activity events
- [ ] Sort / filter controls on the terminal UI
- [ ] More resilient external cron fallback

---

## License

MIT

---

<p align="center">
  Built by <a href="https://x.com/0xliamdavis">@0xliamdavis</a>
  · Bot account <a href="https://x.com/BotBlort">@BotBlort</a>
  · For the <a href="https://x.com/bankrbot">@bankrbot</a> ecosystem
</p>
```
