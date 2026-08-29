# BLORT BOT

<p align="center">
  <img src="https://iili.io/CpjSv8x.md.jpg" alt="Blort Bot Logo" width="120" />
</p>

<p align="center">
  <strong>Serverless telemetry & risk terminal for tokens deployed by <a href="https://x.com/bankrbot">@bankrbot</a> on Base via Doppler Protocol.</strong>
</p>

<p align="center">
  <a href="https://0xliamdavis.github.io/botblort/">
    <img src="https://img.shields.io/badge/Live_Dashboard-0d1117?style=for-the-badge&logo=github&logoColor=2DD4BF" alt="Live Dashboard" />
  </a>
  <a href="https://0xliamdavis.github.io/botblort/terminal.html">
    <img src="https://img.shields.io/badge/Open_Terminal-C84B31?style=for-the-badge&logo=terminal&logoColor=white" alt="Open Terminal" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chain-Base-0052FF?style=flat-square&logo=coinbase&logoColor=white" alt="Base" />
  <img src="https://img.shields.io/badge/Protocol-Doppler-2DD4BF?style=flat-square" alt="Doppler" />
  <img src="https://img.shields.io/badge/Update-Every_10_min-C84B31?style=flat-square" alt="Update" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT" />
  <img src="https://img.shields.io/github/last-commit/0xliamdavis/botblort?style=flat-square" alt="Last Commit" />
</p>

---

## Live Links

| Page | URL |
|------|-----|
| **Landing Page** | [0xliamdavis.github.io/botblort](https://0xliamdavis.github.io/botblort/) |
| **Terminal Dashboard** | [0xliamdavis.github.io/botblort/terminal.html](https://0xliamdavis.github.io/botblort/terminal.html) |
| **GitHub Repo** | [github.com/0xliamdavis/botblort](https://github.com/0xliamdavis/botblort) |

---

## Social

| Account | Link |
|---------|------|
| Bot | [@BotBlort](https://x.com/BotBlort) |
| Builder | [@0xliamdavis](https://x.com/0xliamdavis) |
| Ecosystem | [@bankrbot](https://x.com/bankrbot) |

---

## What is Blort Bot?

Blort Bot is a **serverless on-chain telemetry terminal** focused on tokens launched by [@bankrbot](https://x.com/bankrbot) on **Base** using the **Doppler Protocol**.

It automatically:

- Fetches real token launches from the official Bankr API
- Filters only **deployed** tokens on **Base**
- Enriches market data (price, volume, liquidity) via DexScreener
- Calculates simple risk scores
- Auto-updates every **10 minutes** via GitHub Actions
- Serves a clean terminal-style dashboard on GitHub Pages

---

## Features

- **Live Bankr Launches** — Only real `@bankrbot` deployments on Base
- **Risk Scoring** — Heuristic score based on liquidity, volume ratio, tx count, and FDV disparity
- **Whale Radar** — Highlights higher-activity tokens
- **Smart New Token Filter** — New tokens (< 6 hours) only appear after reaching ≥ $500 24h volume
- **One-Click Trade** — Direct link into Bankr Terminal
- **Fully Serverless** — No VPS, no backend, no paid infra

---

## Architecture

```
GitHub Actions (every 10 min)
        ↓
scripts/fetch.js
        ↓
data/data.json
        ↓
GitHub Pages
  ├── index.html      → Landing page
  └── terminal.html   → Live dashboard
```

---

## Data Sources

| Source | Purpose |
|--------|---------|
| [api.bankr.bot](https://api.bankr.bot/token-launches) | Official list of Bankr token launches |
| [DexScreener API](https://docs.dexscreener.com) | Price, volume, liquidity, transactions |

---

## Risk Scoring

Score starts at **100** and is reduced based on:

| Condition | Penalty |
|-----------|---------|
| Critical low liquidity (< $1k) | -45 |
| Low liquidity (< $5k) | -25 |
| Medium liquidity (< $20k) | -10 |
| High volume / liquidity ratio | -20 |
| Low transaction count | -15 |
| Extreme FDV vs liquidity | -15 |
| New launch + no market data | Special CAUTION flag |

**Status labels:**

- `SAFE` → score ≥ 70  
- `CAUTION` → score 45–69  
- `HIGH_RISK` → score < 45  

---

## Project Structure

```
botblort/
├── .github/workflows/
│   └── fetch-data.yml      # Auto update every 10 minutes
├── data/
│   └── data.json           # Generated telemetry payload
├── scripts/
│   └── fetch.js            # Core engine
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

# Then open index.html or terminal.html in browser
```

No external dependencies required (uses native Node.js `fetch`).

---

## Notes

- Very new Doppler (Uniswap V4) tokens may take time to appear on DexScreener. Until then, price/volume show as `—`.
- Whale Radar is an approximation based on active volume, not real-time whale transaction feeds.
- This is an **unofficial community tool** built for the Bankr ecosystem. Not affiliated with or endorsed by Bankr.

---

## License

MIT

---

<p align="center">
  Built by <a href="https://x.com/0xliamdavis">@0xliamdavis</a> · Bot account <a href="https://x.com/BotBlort">@BotBlort</a>
</p>
```

---
