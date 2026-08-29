# BLORT BOT

**Serverless telemetry & risk terminal for tokens deployed by [@bankrbot](https://x.com/bankrbot) on Base via Doppler Protocol.**

Live dashboard: [https://0xliamdavis.github.io/botblort/](https://0xliamdavis.github.io/botblort/)

---

## What it does

- Fetches real token launches from the official **Bankr API**
- Filters only **deployed tokens on Base**
- Enriches market data (price, volume, liquidity) via **DexScreener**
- Calculates simple risk scores
- Auto-updates every 15 minutes via GitHub Actions
- Serves a clean terminal-style dashboard on GitHub Pages

---

## Architecture

```
GitHub Actions (every 15 min)
        ↓
scripts/fetch.js
        ↓
data/data.json
        ↓
index.html (GitHub Pages)
```

---

## Data Sources

| Source              | Purpose                          |
|---------------------|----------------------------------|
| `api.bankr.bot`     | Official list of Bankr launches  |
| DexScreener API     | Price, volume, liquidity, txns   |

---

## Local Development

```bash
# Clone
git clone https://github.com/0xliamdavis/botblort.git
cd botblort

# Run telemetry once
node scripts/fetch.js

# Then open index.html or serve it locally
```

No dependencies required (uses native Node.js `fetch`).

---

## Project Structure

```
botblort/
├── .github/workflows/
│   └── fetch-data.yml      # Auto update every 15 minutes
├── data/
│   └── data.json           # Generated telemetry payload
├── scripts/
│   └── fetch.js            # Core engine
├── index.html              # Frontend dashboard
├── package.json
└── README.md
```

---

## Risk Scoring (simple)

Score starts at 100 and is reduced based on:

- Very low liquidity
- High volume / low liquidity ratio
- Low transaction count
- Extreme FDV vs liquidity disparity
- Missing market data (new tokens)

Status labels:
- **SAFE** → score ≥ 70
- **CAUTION** → score 45–69
- **HIGH_RISK** → score < 45

---

## Notes

- Whale Radar is currently an approximation based on active tokens (not real-time whale transactions).
- Very new tokens may appear with limited market data until they get liquidity.
- This is an unofficial community tool built for the Bankr ecosystem.

---

Built by [@0xliamdavis](https://x.com/0xliamdavis) · Bot account: [@BotBlort](https://x.com/BotBlort)
```

---
