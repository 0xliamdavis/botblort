const fs = require('fs');
const path = require('path');

function formatPrice(value) {
  const p = parseFloat(value);
  if (!p || p <= 0) return "0";

  if (p >= 1) return p.toFixed(4);
  if (p >= 0.01) return p.toFixed(6);
  if (p >= 0.0001) return p.toFixed(8);
  if (p >= 0.000001) return p.toFixed(10);

  return p.toExponential(4);
}

function calculateRiskMetrics(tokenData, isVeryNew) {
  let score = 100;
  const flags = [];

  const liquidity = tokenData.liquidityUsd || 0;
  const volume24h = tokenData.volume24h || 0;
  const fdv = tokenData.fdv || 0;
  const txns24h = (tokenData.txns24h?.buys || 0) + (tokenData.txns24h?.sells || 0);

  if (isVeryNew && liquidity === 0 && volume24h === 0) {
    return {
      safetyScore: 35,
      status: "CAUTION",
      flags: ["NEW_LAUNCH", "NO_MARKET_DATA_YET"]
    };
  }

  if (liquidity < 1000) {
    score -= 45;
    flags.push("CRITICAL_LOW_LIQUIDITY");
  } else if (liquidity < 5000) {
    score -= 25;
    flags.push("LOW_LIQUIDITY");
  } else if (liquidity < 20000) {
    score -= 10;
    flags.push("MEDIUM_LIQUIDITY");
  }

  if (liquidity > 0 && volume24h / liquidity > 8) {
    score -= 20;
    flags.push("HIGH_VOLATILITY_RATIO");
  }

  if (txns24h < 10 && liquidity < 10000) {
    score -= 15;
    flags.push("LOW_TRANSACTION_COUNT");
  }

  if (fdv > 0 && liquidity > 0 && (fdv / liquidity > 150)) {
    score -= 15;
    flags.push("HIGH_FDV_DISPARITY");
  }

  score = Math.max(5, Math.min(100, score));

  let status = "SAFE";
  if (score < 45) status = "HIGH_RISK";
  else if (score < 70) status = "CAUTION";

  return { safetyScore: score, status, flags };
}

async function fetchBankrLaunches() {
  console.log("[BLORT BOT] Fetching BankrBot launches...");

  try {
    const response = await fetch("https://api.bankr.bot/token-launches");
    if (!response.ok) throw new Error("Bankr API status " + response.status);

    const data = await response.json();
    const launches = (data.launches || []).filter(function(l) {
      return l.chain === "base" && l.status === "deployed" && l.tokenAddress;
    });

    console.log("Found " + launches.length + " deployed Bankr tokens on Base");
    return launches;
  } catch (err) {
    console.error("Bankr API failed:", err.message);
    return [];
  }
}

async function fetchDexScreenerData(addresses) {
  if (!addresses.length) return new Map();

  const pairMap = new Map();
  const chunkSize = 15;

  for (let i = 0; i < addresses.length; i += chunkSize) {
    const chunk = addresses.slice(i, i + chunkSize);

    try {
      const url1 = "https://api.dexscreener.com/tokens/v1/base/" + chunk.join(",");
      const res1 = await fetch(url1);
      if (res1.status === 429) {
        console.warn("DexScreener rate limited (tokens/v1), waiting 2s...");
        await new Promise(function(r) { setTimeout(r, 2000); });
      } else if (res1.ok) {
        const data1 = await res1.json();
        const pairs = Array.isArray(data1) ? data1 : (data1.pairs || []);
        pairs.forEach(function(pair) {
          if (!pair || !pair.baseToken) return;
          const addr = (pair.baseToken.address || "").toLowerCase();
          if (!addr) return;
          const existing = pairMap.get(addr);
          const liq = pair.liquidity?.usd || 0;
          if (!existing || liq > (existing.liquidity?.usd || 0)) {
            pairMap.set(addr, pair);
          }
        });
      }
    } catch (e) {
      console.warn("DexScreener tokens/v1 error:", e.message || e);
    }

    try {
      const url2 = "https://api.dexscreener.com/latest/dex/tokens/" + chunk.join(",");
      const res2 = await fetch(url2);
      if (res2.status === 429) {
        console.warn("DexScreener rate limited (latest/dex), waiting 2s...");
        await new Promise(function(r) { setTimeout(r, 2000); });
      } else if (res2.ok) {
        const data2 = await res2.json();
        const pairs = data2.pairs || [];
        pairs.forEach(function(pair) {
          if (!pair || pair.chainId !== "base" || !pair.baseToken) return;
          const addr = (pair.baseToken.address || "").toLowerCase();
          if (!addr) return;
          const existing = pairMap.get(addr);
          const liq = pair.liquidity?.usd || 0;
          if (!existing || liq > (existing.liquidity?.usd || 0)) {
            pairMap.set(addr, pair);
          }
        });
      }
    } catch (e) {
      console.warn("DexScreener latest/dex error:", e.message || e);
    }

    if (i + chunkSize < addresses.length) {
      await new Promise(function(r) { setTimeout(r, 500); });
    }
  }

  console.log("DexScreener found market data for " + pairMap.size + " tokens");
  return pairMap;
}

function buildToken(launch, rank, pair) {
  const isVeryNew = !pair;
  const now = Date.now();
  const launchAge = launch.timestamp ? (now - launch.timestamp) : null;
  const isFresh = launchAge !== null && launchAge < 1000 * 60 * 60 * 6;

  let volume24h = 0;
  let volume1h = 0;
  let liquidityUsd = 0;
  let priceUsd = "0";
  let priceChange24h = 0;
  let fdv = 0;
  let txns24h = { buys: 0, sells: 0 };
  let dexUrl = "https://bankr.bot/terminal/trade?out=" + launch.tokenAddress + "&chain=base";
  let pairAddress = null;
  let dexId = "doppler";

  if (pair) {
    volume24h = pair.volume?.h24 || 0;
    volume1h = pair.volume?.h1 || 0;
    liquidityUsd = pair.liquidity?.usd || 0;
    priceUsd = formatPrice(pair.priceUsd);
    priceChange24h = Number((pair.priceChange?.h24 || 0).toFixed(2));
    fdv = pair.fdv || 0;
    txns24h = {
      buys: pair.txns?.h24?.buys || 0,
      sells: pair.txns?.h24?.sells || 0
    };
    pairAddress = pair.pairAddress || null;
    dexId = pair.dexId || "uniswap";
    if (pair.url) dexUrl = pair.url;
  }

  const tokenData = { liquidityUsd, volume24h, fdv, txns24h };
  const safety = calculateRiskMetrics(tokenData, isVeryNew || isFresh);

  return {
    rank: rank,
    name: launch.tokenName || (pair && pair.baseToken && pair.baseToken.name) || "Unknown",
    symbol: launch.tokenSymbol || (pair && pair.baseToken && pair.baseToken.symbol) || "???",
    address: launch.tokenAddress,
    pairAddress: pairAddress,
    chain: "BASE",
    protocol: "DOPPLER",
    dexId: dexId,
    priceUsd: priceUsd,
    priceChange24h: priceChange24h,
    volume24h: volume24h,
    volume1h: volume1h,
    liquidityUsd: liquidityUsd,
    fdv: fdv,
    txns24h: txns24h,
    safety: safety,
    dexUrl: dexUrl,
    poolId: launch.poolId || null,
    deployer: (launch.deployer && launch.deployer.walletAddress) || null,
    feeRecipient: (launch.feeRecipient && launch.feeRecipient.walletAddress) || null,
    launchTimestamp: launch.timestamp || null,
    isNew: isVeryNew || isFresh,
    hasMarketData: !!(pair && (volume24h > 0 || liquidityUsd > 0))
  };
}

function generateWhaleRadar(tokens) {
  const alerts = [];

  tokens.forEach(function(token) {
    const volume24h = token.volume24h || 0;
    const liquidity = token.liquidityUsd || 0;
    const buys = (token.txns24h && token.txns24h.buys) || 0;
    const sells = (token.txns24h && token.txns24h.sells) || 0;
    const totalTx = buys + sells;
    const priceChange = token.priceChange24h || 0;

    if (volume24h < 300 && totalTx < 5) return;

    const avgTrade = totalTx > 0 ? volume24h / totalTx : 0;
    const buyPressure = totalTx > 0 ? (buys / totalTx) * 100 : 50;

    if (avgTrade >= 80) {
      alerts.push({
        id: "ACT-" + (token.symbol || "TKN") + "-AVG",
        timestamp: new Date().toISOString(),
        token: token.symbol,
        chain: "BASE",
        type: buyPressure >= 55 ? "BUY" : (buyPressure <= 45 ? "SELL" : "MIXED"),
        amountUsd: avgTrade.toFixed(2),
        priceImpact: null,
        txHash: null,
        label: "AVG TRADE",
        detail: "Avg $" + avgTrade.toFixed(0) + " / tx · " + totalTx + " txns",
        address: token.address
      });
    }

    if (buys >= 8 && buyPressure >= 65 && volume24h >= 400) {
      alerts.push({
        id: "ACT-" + (token.symbol || "TKN") + "-BUY",
        timestamp: new Date().toISOString(),
        token: token.symbol,
        chain: "BASE",
        type: "BUY",
        amountUsd: volume24h.toFixed(2),
        priceImpact: null,
        txHash: null,
        label: "BUY PRESSURE",
        detail: buys + " buys / " + sells + " sells · " + buyPressure.toFixed(0) + "% buy",
        address: token.address
      });
    }

    if (sells >= 8 && buyPressure <= 35 && volume24h >= 400) {
      alerts.push({
        id: "ACT-" + (token.symbol || "TKN") + "-SELL",
        timestamp: new Date().toISOString(),
        token: token.symbol,
        chain: "BASE",
        type: "SELL",
        amountUsd: volume24h.toFixed(2),
        priceImpact: null,
        txHash: null,
        label: "SELL PRESSURE",
        detail: buys + " buys / " + sells + " sells · " + (100 - buyPressure).toFixed(0) + "% sell",
        address: token.address
      });
    }

    if (liquidity > 0 && volume24h / liquidity >= 1.5 && volume24h >= 500) {
      alerts.push({
        id: "ACT-" + (token.symbol || "TKN") + "-VOL",
        timestamp: new Date().toISOString(),
        token: token.symbol,
        chain: "BASE",
        type: priceChange >= 0 ? "BUY" : "SELL",
        amountUsd: volume24h.toFixed(2),
        priceImpact: null,
        txHash: null,
        label: "HIGH VOLUME",
        detail: "Vol $" + Math.round(volume24h) + " · Liq $" + Math.round(liquidity),
        address: token.address
      });
    }
  });

  alerts.sort(function(a, b) {
    return parseFloat(b.amountUsd) - parseFloat(a.amountUsd);
  });

  return alerts.slice(0, 10);
}

async function main() {
  console.log("[BLORT BOT] Starting BankrBot Base Telemetry Engine v2.6...");

  try {
    const launches = await fetchBankrLaunches();

    const addresses = launches.map(function(l) {
      return l.tokenAddress.toLowerCase();
    });

    const pairMap = await fetchDexScreenerData(addresses);

    let processedTokens = launches.map(function(launch, index) {
      const addr = launch.tokenAddress.toLowerCase();
      const pair = pairMap.get(addr) || null;
      return buildToken(launch, index + 1, pair);
    });

    // Filter v2.6 — cegah dashboard kosong
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
    const now = Date.now();

    processedTokens = processedTokens.filter(function(t) {
      const age = t.launchTimestamp ? (now - t.launchTimestamp) : null;
      const isNew = age !== null && age < SIX_HOURS;
      const isVeryOld = age !== null && age > FORTY_EIGHT_HOURS;
      const hasActivity = (t.volume24h || 0) > 0 || (t.liquidityUsd || 0) > 0;

      if (hasActivity) return true;
      if (isNew) return true;
      if (age !== null && age <= FORTY_EIGHT_HOURS) return true;
      if (isVeryOld && !hasActivity) return false;
      return true;
    });

    processedTokens.sort(function(a, b) {
      const volDiff = (b.volume24h || 0) - (a.volume24h || 0);
      if (volDiff !== 0) return volDiff;

      const liqDiff = (b.liquidityUsd || 0) - (a.liquidityUsd || 0);
      if (liqDiff !== 0) return liqDiff;

      return (b.launchTimestamp || 0) - (a.launchTimestamp || 0);
    });

    processedTokens = processedTokens.slice(0, 40);
    processedTokens.forEach(function(t, i) { t.rank = i + 1; });

    const whaleRadar = generateWhaleRadar(processedTokens);

    const withMarket = processedTokens.filter(function(t) {
      return t.hasMarketData;
    }).length;

    const payload = {
      meta: {
        engine: "BlortBot Bankr Telemetry Terminal v2.6",
        targetOrigin: "Bankr API + DexScreener",
        updatedAt: new Date().toISOString(),
        builder: "@0xliamdavis",
        botAccount: "@BotBlort",
        targetChain: "BASE",
        logoUrl: "https://iili.io/CpjSv8x.md.jpg"
      },
      summary: {
        totalAnalyzed: processedTokens.length,
        withMarketData: withMarket,
        safeTokensCount: processedTokens.filter(function(t) {
          return t.safety.status === "SAFE";
        }).length,
        highRiskCount: processedTokens.filter(function(t) {
          return t.safety.status === "HIGH_RISK";
        }).length,
        totalWhaleAlerts: whaleRadar.length
      },
      tokens: processedTokens,
      whaleRadar: whaleRadar
    };

    const outputDir = path.join(__dirname, "../data");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(outputDir, "data.json"),
      JSON.stringify(payload, null, 2)
    );

    console.log("Telemetry compiled successfully!");
    console.log("  Tokens analyzed  : " + processedTokens.length);
    console.log("  With market data : " + withMarket);
    console.log("  DexScreener hits : " + pairMap.size);
    console.log("  Safe tokens      : " + payload.summary.safeTokensCount);
    console.log("  High risk        : " + payload.summary.highRiskCount);
    console.log("  Activity alerts  : " + whaleRadar.length);

  } catch (error) {
    console.error("Telemetry compilation failed:", error);
    process.exit(1);
  }
}

main();
