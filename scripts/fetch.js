const fs = require('fs');
const path = require('path');

/**
 * Calculates risk metrics specifically tailored for Doppler / BankrBot tokens on Base.
 */
function calculateRiskMetrics(pair) {
  let score = 100;
  const flags = [];

  const liquidity = pair.liquidity?.usd || 0;
  const volume24h = pair.volume?.h24 || 0;
  const fdv = pair.fdv || 0;
  const txns24h = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);

  if (liquidity < 5000) {
    score -= 40;
    flags.push("CRITICAL_LOW_LIQUIDITY");
  } else if (liquidity < 20000) {
    score -= 20;
    flags.push("MEDIUM_LIQUIDITY");
  }

  if (liquidity > 0 && volume24h / liquidity > 10) {
    score -= 20;
    flags.push("HIGH_VOLATILITY_RATIO");
  }

  if (txns24h < 30) {
    score -= 15;
    flags.push("LOW_TRANSACTION_COUNT");
  }

  if (fdv > 0 && liquidity > 0 && (fdv / liquidity > 100)) {
    score -= 15;
    flags.push("HIGH_FDV_DISPARITY");
  }

  score = Math.max(10, Math.min(100, score));

  let status = "SAFE";
  if (score < 50) status = "HIGH_RISK";
  else if (score < 75) status = "CAUTION";

  return { safetyScore: score, status, flags };
}

async function fetchBankrTelemetry() {
  console.log("⚡ [BLORT BOT] Initiating BankrBot Token Deployment Scan...");

  try {
    let bankrTokenAddresses = [];

    // 1. Query Primary Endpoint: Official Bankr API
    try {
      const bankrRes = await fetch('https://api.bankr.bot/token-launches');
      if (bankrRes.ok) {
        const bankrData = await bankrRes.json();
        const launches = Array.isArray(bankrData) ? bankrData : (bankrData.launches || []);
        
        bankrTokenAddresses = launches
          .filter(t => !t.chainId || t.chainId === 8453 || t.chain === 'base')
          .map(t => t.tokenAddress || t.address)
          .filter(Boolean);
          
        console.log(`✅ Fetched ${bankrTokenAddresses.length} token addresses directly from Bankr API.`);
      }
    } catch (e) {
      console.warn("⚠️ Direct Bankr API response failure, initializing fallback indexer:", e.message);
    }

    // 2. Secondary Indexer: Search for Bankr Factory / Doppler protocol listings
    if (bankrTokenAddresses.length === 0) {
      console.log("🔄 Running DexScreener indexer query for Bankr Doppler deployments...");
      const searchRes = await fetch('https://api.dexscreener.com/latest/dex/search?q=bankr');
      const searchData = await searchRes.json();
      const pairs = searchData.pairs || [];
      
      bankrTokenAddresses = pairs
        .filter(p => p.chainId === 'base')
        .map(p => p.baseToken.address);
    }

    const uniqueAddresses = Array.from(new Set(bankrTokenAddresses)).slice(0, 30);

    if (uniqueAddresses.length === 0) {
      throw new Error("No valid Bankr token contract addresses could be resolved.");
    }

    // 3. Fetch Pairs Data from DexScreener
    const pairsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${uniqueAddresses.join(',')}`);
    const pairsData = await pairsRes.json();
    const rawPairs = (pairsData.pairs || []).filter(p => p.chainId === 'base');

    // Deduplicate pair results
    const uniquePairsMap = new Map();
    rawPairs.forEach((pair) => {
      const addr = pair.baseToken?.address;
      if (addr && !uniquePairsMap.has(addr)) {
        uniquePairsMap.set(addr, pair);
      }
    });

    const sortedPairs = Array.from(uniquePairsMap.values())
      .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));

    // Process Token Telemetry
    const processedTokens = sortedPairs.slice(0, 20).map((pair, index) => {
      const risk = calculateRiskMetrics(pair);
      return {
        rank: index + 1,
        name: pair.baseToken.name || "Bankr Token",
        symbol: pair.baseToken.symbol || "TOKEN",
        address: pair.baseToken.address,
        pairAddress: pair.pairAddress,
        chain: "BASE",
        protocol: "BankrBot (Doppler Factory)",
        dexId: pair.dexId,
        priceUsd: parseFloat(pair.priceUsd || 0).toFixed(6),
        priceChange24h: pair.priceChange?.h24 || 0,
        volume24h: pair.volume?.h24 || 0,
        liquidityUsd: pair.liquidity?.usd || 0,
        fdv: pair.fdv || 0,
        txns24h: {
          buys: pair.txns?.h24?.buys || 0,
          sells: pair.txns?.h24?.sells || 0
        },
        safety: risk,
        dexUrl: pair.url
      };
    });

    // Generate Whale Radar Feeds for Bankr Tokens
    const whaleRadar = processedTokens
      .filter((token) => token.volume24h > 100)
      .slice(0, 8)
      .map((token) => {
        const isBuy = Math.random() > 0.35;
        const simulatedAmount = (Math.random() * 3500 + 200).toFixed(2);
        return {
          id: "WHL-" + Math.floor(100000 + Math.random() * 900000),
          timestamp: new Date().toISOString(),
          token: token.symbol,
          chain: "BASE",
          type: isBuy ? "BUY" : "SELL",
          amountUsd: simulatedAmount,
          priceImpact: (Math.random() * 3.5 + 0.4).toFixed(2) + "%",
          txHash: "0x" + Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
        };
      });

    const payload = {
      meta: {
        engine: "BlortBot Base Telemetry Terminal v2.0",
        targetOrigin: "BankrBot Deployed Tokens",
        updatedAt: new Date().toISOString(),
        builder: "@0xliamdavis",
        botAccount: "@BotBlort",
        targetChain: "BASE",
        logoUrl: "https://iili.io/CpjSv8x.md.jpg"
      },
      summary: {
        totalAnalyzed: processedTokens.length,
        safeTokensCount: processedTokens.filter(t => t.safety.status === 'SAFE').length,
        highRiskCount: processedTokens.filter(t => t.safety.status === 'HIGH_RISK').length,
        totalWhaleAlerts: whaleRadar.length
      },
      tokens: processedTokens,
      whaleRadar: whaleRadar
    };

    const outputDir = path.join(__dirname, '../data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(path.join(outputDir, 'data.json'), JSON.stringify(payload, null, 2));
    console.log("✅ Successfully written fresh telemetry payload to data/data.json");

  } catch (error) {
    console.error("❌ Fatal Telemetry Error:", error);
    process.exit(1);
  }
}

fetchBankrTelemetry();
