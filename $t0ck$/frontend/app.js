const { useState, useEffect, useMemo } = React;

// Custom UI Icons rendered as inline SVGs for security and zero-overhead performance
const Icons = {
  TrendingUp: ({ className, size = 18 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
  ),
  TrendingDown: ({ className, size = 18 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
      <polyline points="17 18 23 18 23 12"></polyline>
    </svg>
  ),
  TrendingFlat: ({ className, size = 18 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  ),
  Refresh: ({ className, size = 18 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
    </svg>
  ),
  Search: ({ className, size = 16 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  ),
  Alert: ({ className, size = 20 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  ),
  Activity: ({ className, size = 20 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  ),
  Database: ({ className, size = 18 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path>
    </svg>
  ),
  Dollar: ({ className, size = 20 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  ),
  BookOpen: ({ className, size = 18 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
    </svg>
  ),
  Clock: ({ className, size = 16 }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  )
};

function StockAnalysisDrawerContent({ stock: initialStock, formatFloat, getSignalBadge, getOptionStrategyDrawerBlock }) {
  const chartContainerRef = React.useRef(null);
  const [chartLoading, setChartLoading] = React.useState(true);
  const [chartError, setChartError] = React.useState(null);
  const [stock, setStock] = React.useState(initialStock);

  React.useEffect(() => {
    setStock(initialStock);
  }, [initialStock]);

  React.useEffect(() => {
    let isMounted = true;
    const fetchAnalysisData = async () => {
      try {
        const res = await fetch(`/api/stock-analysis?ticker=${initialStock.ticker}`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.status === "success" && json.data) {
            setStock(prev => ({
              ...prev,
              ...json.data,
              last_price: prev.last_price || json.data.price
            }));
          }
        }
      } catch (err) {
        console.error("Error fetching stock analysis details:", err);
      }
    };
    fetchAnalysisData();
    return () => {
      isMounted = false;
    };
  }, [initialStock.ticker]);

  React.useEffect(() => {
    let isMounted = true;
    let chartInstance = null;

    const renderChart = async () => {
      setChartLoading(true);
      setChartError(null);
      try {
        const res = await fetch(`/api/stock-chart?ticker=${stock.ticker}`);
        if (!res.ok) throw new Error("Failed to fetch chart data");
        const json = await res.json();
        
        if (!isMounted) return;
        
        if (json.status === "success" && json.data && json.data.length > 0) {
          if (chartContainerRef.current) {
            chartContainerRef.current.innerHTML = "";
            
            chartInstance = LightweightCharts.createChart(chartContainerRef.current, {
              width: chartContainerRef.current.clientWidth || 600,
              height: 300,
              layout: {
                background: { type: 'solid', color: '#1f2937' },
                textColor: '#9ca3af',
              },
              grid: {
                vertLines: { color: '#374151' },
                horzLines: { color: '#374151' },
              },
              timeScale: {
                borderColor: '#4b5563',
              },
            });

            const candlestickSeries = chartInstance.addCandlestickSeries({
              upColor: '#10b981',
              downColor: '#ef4444',
              borderVisible: false,
              wickUpColor: '#10b981',
              wickDownColor: '#ef4444',
            });

            const dataSorted = [...json.data].sort((a, b) => a.time.localeCompare(b.time));
            candlestickSeries.setData(dataSorted.map(c => ({
              time: c.time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close
            })));

            chartInstance.timeScale().fitContent();

            const handleResize = () => {
              if (chartInstance && chartContainerRef.current) {
                chartInstance.applyOptions({ width: chartContainerRef.current.clientWidth });
              }
            };
            window.addEventListener('resize', handleResize);
            
            return () => {
              window.removeEventListener('resize', handleResize);
            };
          }
        } else {
          setChartError("No historical data available for this ticker.");
        }
      } catch (err) {
        console.error("Error creating chart:", err);
        setChartError("Could not load chart. Market data may be delayed or unavailable.");
      } finally {
        if (isMounted) {
          setChartLoading(false);
        }
      }
    };

    // Wait a brief tick for the DOM elements in the drawer to mount before rendering
    const timer = setTimeout(renderChart, 50);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (chartInstance) {
        chartInstance.remove();
      }
    };
  }, [stock.ticker]);

  const getTrendText = () => {
    if (stock.sma_50 && stock.sma_200) {
      if (stock.sma_50 > stock.sma_200) return <span className="trend-up">Bullish Trend (Golden Cross alignment)</span>;
      if (stock.sma_50 < stock.sma_200) return <span className="trend-down">Bearish Trend (Death Cross alignment)</span>;
    }
    return <span className="trend-neutral">Neutral Trend</span>;
  };

  return (
    <div className="drawer-body">
      <div className="drawer-section">
        <span className="drawer-section-label">Quantitative Synthesis Recommendation</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', margin: '0.5rem 0' }}>
          {getSignalBadge(stock.signal)}
          <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>
            Current Market Price: ${formatFloat(stock.last_price)}
          </span>
        </div>
        {stock.option_strategy && stock.option_strategy.type !== "N/A" && (
          <div style={{ marginTop: '0.5rem' }}>
            {getOptionStrategyDrawerBlock(stock.option_strategy)}
          </div>
        )}
      </div>

      <div className="drawer-section">
        <span className="drawer-section-label">6-Month Candlestick Price History</span>
        <div className="chart-wrapper-container" style={{ position: 'relative', marginTop: '0.75rem', minHeight: '300px', background: '#1f2937', borderRadius: '8px' }}>
          {chartLoading && (
            <div className="chart-overlay-loader" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(31,41,55,0.8)', zIndex: 10, borderRadius: '8px' }}>
              <div className="loading-spinner"></div>
              <p style={{ marginTop: '0.5rem', color: '#9ca3af' }}>Loading market candles...</p>
            </div>
          )}
          {chartError && (
            <div className="chart-overlay-error" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <p style={{ marginTop: '0.5rem', color: '#ef4444' }}>{chartError}</p>
            </div>
          )}
          <div ref={chartContainerRef} style={{ width: '100%', height: '300px', borderRadius: '8px', overflow: 'hidden' }}></div>
        </div>
      </div>

      <div className="drawer-section">
        <span className="drawer-section-label">Scorecard Indicators</span>
        <div className="indicators-panel-grid">
          
          <div className="indicator-card">
            <h4>Technical Analysis</h4>
            <div className="indicator-row">
              <span>RSI (14):</span>
              <strong className={stock.rsi < 30 ? "trend-up" : stock.rsi > 70 ? "trend-down" : "trend-neutral"}>
                {stock.rsi !== undefined && stock.rsi !== null ? formatFloat(stock.rsi, 1) : "N/A"}
              </strong>
            </div>
            <div className="indicator-row">
              <span>50-Day SMA:</span>
              <strong>{stock.sma_50 !== undefined && stock.sma_50 !== null ? `$${formatFloat(stock.sma_50)}` : "N/A"}</strong>
            </div>
            <div className="indicator-row">
              <span>200-Day SMA:</span>
              <strong>{stock.sma_200 !== undefined && stock.sma_200 !== null ? `$${formatFloat(stock.sma_200)}` : "N/A"}</strong>
            </div>
            <div className="indicator-row">
              <span>Trend Structure:</span>
              <strong>{getTrendText()}</strong>
            </div>
          </div>

          <div className="indicator-card">
            <h4>Fundamental Valuation</h4>
            <div className="indicator-row">
              <span>PEG Ratio:</span>
              <strong className={stock.peg_ratio > 0 && stock.peg_ratio < 1.0 ? "trend-up" : "trend-neutral"}>
                {stock.peg_ratio !== undefined && stock.peg_ratio !== null ? formatFloat(stock.peg_ratio) : "N/A"}
              </strong>
            </div>
            <div className="indicator-row">
              <span>P/E Ratio:</span>
              <strong>{stock.pe_ratio !== undefined && stock.pe_ratio !== null ? formatFloat(stock.pe_ratio) : "N/A"}</strong>
            </div>
            <div className="indicator-row">
              <span>Estimated Transaction:</span>
              <strong style={{ fontSize: '0.85rem' }}>
                ${formatFloat(stock.avg_amount_low/1000, 0)}k - ${formatFloat(stock.avg_amount_high/1000, 0)}k
              </strong>
            </div>
          </div>

          <div className="indicator-card">
            <h4>Context & Sentiment</h4>
            <div className="indicator-row">
              <span>Politician Buy/Sell:</span>
              <strong>
                <span className="tx-buy">{stock.buy_count}</span> / <span className="tx-sell">{stock.sell_count}</span>
              </strong>
            </div>
            <div className="indicator-row">
              <span>News Sentiment:</span>
              <strong className={stock.avg_news_sentiment > 0.15 ? "trend-up" : stock.avg_news_sentiment < -0.15 ? "trend-down" : "trend-neutral"}>
                {stock.avg_news_sentiment > 0 ? "+" : ""}{formatFloat(stock.avg_news_sentiment)}
              </strong>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function calculateTradeSetup(stock) {
  if (!stock) return null;
  
  const price = stock.last_price || stock.price || 0.0;
  if (price <= 0) return null;
  
  const rec = stock.signal || stock.recommendation || "Hold";
  const rsi = stock.rsi;
  const sma_50 = stock.sma_50;
  const sma_200 = stock.sma_200;
  
  let setupType = "Hold";
  if (rec.includes("Buy")) setupType = "Long";
  else if (rec.includes("Sell")) setupType = "Short";
  
  let entry = price;
  let stopLoss = price;
  let target1 = price;
  let target2 = price;
  let pattern = "Horizontal Consolidation";
  let patternDesc = "Price is moving sideways within a tight range with neutral momentum.";
  
  // Pattern identification logic based on RSI and SMAs
  if (rsi !== null && rsi < 30) {
    pattern = "Double Bottom Reversal";
    patternDesc = "Oversold RSI indicates severe seller exhaustion near key historical support, favoring a bullish trend reversal.";
  } else if (rsi !== null && rsi > 70) {
    pattern = "Double Top Pullback";
    patternDesc = "Overbought RSI suggests buyer exhaustion near overhead resistance, favoring a short-term correction.";
  } else if (sma_50 && sma_200 && sma_50 > sma_200 && price > sma_50) {
    if (rsi !== null && rsi >= 55) {
      pattern = "Bullish Ascending Channel";
      patternDesc = "Strong structural uptrend with aligned SMAs and positive momentum, suggesting continuation of buy pressure.";
    } else {
      pattern = "Bullish Cup & Handle";
      patternDesc = "Short-term pullback consolidation within a major structural uptrend, creating an ideal accumulation pattern.";
    }
  } else if (sma_50 && sma_200 && sma_50 <= sma_200 && price < sma_50) {
    if (rsi !== null && rsi <= 45) {
      pattern = "Bearish Descending Channel";
      patternDesc = "Consistent lower highs and lower lows with descending moving averages, favoring short entries on bounces.";
    } else {
      pattern = "Bearish Head & Shoulders";
      patternDesc = "Reversal pattern indicating local peak consolidation before a potential major breakdown below support.";
    }
  } else {
    pattern = "Horizontal Range-Bound";
    patternDesc = "Indicators are in equilibrium. Support and resistance levels are clear, favoring range-bound swing trades.";
  }
  
  // Trade targets logic
  if (setupType === "Long") {
    entry = price * 0.99; // Buy pullback at 1.0% below price
    stopLoss = entry * 0.965; // 3.5% stop loss
    target1 = entry * 1.05; // 5% Target 1
    target2 = entry * 1.10; // 10% Target 2
  } else if (setupType === "Short") {
    entry = price * 1.01; // Short bounce at 1.0% above price
    stopLoss = entry * 1.035; // 3.5% stop loss
    target1 = entry * 0.95; // 5% Target 1
    target2 = entry * 0.90; // 10% Target 2
  } else {
    entry = price * 0.985;
    stopLoss = entry * 0.98;
    target1 = entry * 1.03;
    target2 = entry * 1.06;
  }
  
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(target2 - entry);
  const rr = risk > 0 ? (reward / risk) : 2.86;
  
  return {
    type: setupType,
    entry,
    stopLoss,
    target1,
    target2,
    pattern,
    patternDesc,
    rr
  };
}

function App() {
  const [signals, setSignals] = useState([]);
  const [stats, setStats] = useState({ total_count: 0, avg_sentiment: 0.0, tickers: {} });
  const [health, setHealth] = useState({ status: "loading", scheduler_running: false });
  const [politicianTrades, setPoliticianTrades] = useState([]);
  const [topPoliticianStocks, setTopPoliticianStocks] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [selectedAnalysisStock, setSelectedAnalysisStock] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState("sentiment");
  const [prominentOnly, setProminentOnly] = useState(true);
  
  // Yahoo Finance Trends State
  const [trendingTickers, setTrendingTickers] = useState([]);
  const [topGainers, setTopGainers] = useState([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  
  // On-demand Ticker Search State
  const [searchTicker, setSearchTicker] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Market VIX Analysis State
  const [vixData, setVixData] = useState(null);
  const [vixLoading, setVixLoading] = useState(true);
  const [vixError, setVixError] = useState("");

  // Handle On-demand Ticker Search
  const handleTickerSearch = async (e, tickerStr = null) => {
    if (e) e.preventDefault();
    const query = (tickerStr || searchTicker).toUpperCase().trim();
    if (!query) return;
    
    setSearchLoading(true);
    setSearchError("");
    setSearchResult(null);
    
    try {
      const res = await fetch(`/api/stock-analysis?ticker=${encodeURIComponent(query)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === "success" && json.data) {
          setSearchResult(json.data);
        } else {
          setSearchError(`Ticker "${query}" not found or has no available data.`);
        }
      } else {
        setSearchError("Failed to fetch ticker intelligence. Please try again.");
      }
    } catch (err) {
      console.error("Search error:", err);
      setSearchError("Network error. Please check your connection.");
    } finally {
      setSearchLoading(false);
    }
  };
  
  // Filters State for Signals
  const [searchQuery, setSearchQuery] = useState("");
  const [tickerFilter, setTickerFilter] = useState("ALL");
  const [sentimentFilter, setSentimentFilter] = useState("ALL");

  // Filters State for Politician Trades
  const [politicianSearchQuery, setPoliticianSearchQuery] = useState("");
  const [politicianPartyFilter, setPoliticianPartyFilter] = useState("ALL");
  const [politicianTxTypeFilter, setPoliticianTxTypeFilter] = useState("ALL");

  // Fetch all dashboard data from backend
  const fetchData = async (showLocalLoader = true) => {
    if (showLocalLoader) {
      setLoading(true);
      setVixLoading(true);
    }
    try {
      // Parallel fetch endpoints
      const [signalsRes, statsRes, healthRes, tradesRes, topStocksRes, vixRes] = await Promise.all([
        fetch("/api/signals?limit=150"),
        fetch("/api/stats"),
        fetch("/api/health"),
        fetch(`/api/politician-trades?limit=250&prominent_only=${prominentOnly}`),
        fetch(`/api/politician-top-stocks?limit=20&prominent_only=${prominentOnly}`),
        fetch("/api/market-vix-analysis")
      ]);

      if (signalsRes.ok && statsRes.ok && healthRes.ok && tradesRes.ok && topStocksRes.ok) {
        const signalsData = await signalsRes.json();
        const statsData = await statsRes.json();
        const healthData = await healthRes.json();
        const tradesData = await tradesRes.json();
        const topStocksData = await topStocksRes.json();
        
        setSignals(signalsData.data);
        setStats(statsData.data);
        setHealth(healthData);
        setPoliticianTrades(tradesData.data);
        setTopPoliticianStocks(topStocksData.data);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        console.error("Non-200 response received from backend endpoints.");
      }

      if (vixRes && vixRes.ok) {
        const vixJson = await vixRes.json();
        if (vixJson.status === "success" && vixJson.data) {
          setVixData(vixJson.data);
          setVixError("");
        } else {
          setVixError("Failed to parse VIX volatility statistics.");
        }
      } else {
        setVixError("VIX API failed to load.");
      }
    } catch (err) {
      console.error("Network error fetching dashboard data:", err);
      setHealth({ status: "offline", scheduler_running: false });
      setVixError("Failed to reach VIX API.");
    } finally {
      setLoading(false);
      setVixLoading(false);
    }
  };

  // Fetch Yahoo Finance trends
  const fetchTrendsData = async (showLocalLoader = true) => {
    if (showLocalLoader) setTrendsLoading(true);
    try {
      const [trendingRes, gainersRes] = await Promise.all([
        fetch("/api/market-trends/trending"),
        fetch("/api/market-trends/gainers")
      ]);
      
      if (trendingRes.ok && gainersRes.ok) {
        const trendingData = await trendingRes.json();
        const gainersData = await gainersRes.json();
        
        setTrendingTickers(trendingData.data);
        setTopGainers(gainersData.data);
      } else {
        console.error("Failed to fetch market trends from backend.");
      }
    } catch (err) {
      console.error("Network error fetching trends:", err);
    } finally {
      setTrendsLoading(false);
    }
  };

  // Perform initial fetch on mount, and re-fetch when prominentOnly toggles
  useEffect(() => {
    fetchData();
  }, [prominentOnly]);

  // Fetch trends when trends tab is selected
  useEffect(() => {
    if (activeTab === "trends") {
      fetchTrendsData();
    }
  }, [activeTab]);

  // Handle Manual Data Refresh
  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (res.ok) {
        const refreshStats = await res.json();
        console.log("Manual refresh complete:", refreshStats);
        // Reload appropriate data based on active tab
        if (activeTab === "trends") {
          await fetchTrendsData(false);
        } else {
          await fetchData(false);
        }
      } else {
        console.error("Refresh request failed on API server.");
      }
    } catch (err) {
      console.error("Network error during manual refresh:", err);
    } finally {
      setRefreshing(false);
    }
  };

  // Filter signals list based on user selections
  const filteredSignals = useMemo(() => {
    return signals.filter(signal => {
      const matchesTicker = tickerFilter === "ALL" || signal.ticker === tickerFilter;
      
      let matchesSentiment = true;
      if (sentimentFilter === "POSITIVE") matchesSentiment = signal.sentiment_score > 0.15;
      else if (sentimentFilter === "NEGATIVE") matchesSentiment = signal.sentiment_score < -0.15;
      else if (sentimentFilter === "NEUTRAL") matchesSentiment = Math.abs(signal.sentiment_score) <= 0.15;
      
      const matchesSearch = searchQuery.trim() === "" || 
        signal.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        signal.explanation.toLowerCase().includes(searchQuery.toLowerCase());
        
      return matchesTicker && matchesSentiment && matchesSearch;
    });
  }, [signals, tickerFilter, sentimentFilter, searchQuery]);

  // Filter politician trades list based on user selections
  const filteredPoliticianTrades = useMemo(() => {
    return politicianTrades.filter(trade => {
      const matchesParty = politicianPartyFilter === "ALL" || trade.party === politicianPartyFilter;
      const matchesTxType = politicianTxTypeFilter === "ALL" || trade.transaction_type === politicianTxTypeFilter;
      
      const searchLower = politicianSearchQuery.trim().toLowerCase();
      const matchesSearch = searchLower === "" || 
        trade.filer_name.toLowerCase().includes(searchLower) ||
        (trade.ticker && trade.ticker.toLowerCase().includes(searchLower)) ||
        (trade.asset_name && trade.asset_name.toLowerCase().includes(searchLower));
        
      return matchesParty && matchesTxType && matchesSearch;
    });
  }, [politicianTrades, politicianPartyFilter, politicianTxTypeFilter, politicianSearchQuery]);

  // Group top stocks by sector
  const groupedSectors = useMemo(() => {
    const groups = {};
    topPoliticianStocks.forEach(stock => {
      const sector = stock.sector || "Other";
      if (!groups[sector]) {
        groups[sector] = [];
      }
      groups[sector].push(stock);
    });
    return groups;
  }, [topPoliticianStocks]);

  // Filter top short term opportunities (Momentum & Sentiment driven)
  const shortTermOpportunities = useMemo(() => {
    return topPoliticianStocks
      .filter(stock => stock.short_term_signal === "Buy" || stock.short_term_signal === "Strong Buy")
      .sort((a, b) => (b.short_term_score || 0) - (a.short_term_score || 0));
  }, [topPoliticianStocks]);

  // Filter top long term opportunities (Value & Growth driven)
  const longTermOpportunities = useMemo(() => {
    return topPoliticianStocks
      .filter(stock => stock.long_term_signal === "Buy" || stock.long_term_signal === "Strong Buy")
      .sort((a, b) => (b.long_term_score || 0) - (a.long_term_score || 0));
  }, [topPoliticianStocks]);

  // Find the single top buy stock based on maximum overall score
  const topBuyStock = useMemo(() => {
    if (!topPoliticianStocks || topPoliticianStocks.length === 0) return null;
    const buys = topPoliticianStocks.filter(s => s.signal === "Strong Buy" || s.signal === "Buy");
    if (buys.length === 0) return null;
    return [...buys].sort((a, b) => {
      const scoreA = Math.max(a.short_term_score || 0, a.long_term_score || 0);
      const scoreB = Math.max(b.short_term_score || 0, b.long_term_score || 0);
      return scoreB - scoreA;
    })[0];
  }, [topPoliticianStocks]);

  // Filter the top 10 best buy opportunities for the trade execution list
  const top10BestStocks = useMemo(() => {
    if (!topPoliticianStocks || topPoliticianStocks.length === 0) return [];
    const validStocks = topPoliticianStocks.filter(s => (s.last_price || s.price || 0) > 0);
    const buys = validStocks.filter(s => s.signal === "Strong Buy" || s.signal === "Buy");
    const listToProcess = buys.length > 0 ? buys : validStocks;
    return [...listToProcess].sort((a, b) => {
      const scoreA = Math.max(a.short_term_score || 0, a.long_term_score || 0);
      const scoreB = Math.max(b.short_term_score || 0, b.long_term_score || 0);
      return scoreB - scoreA;
    }).slice(0, 10);
  }, [topPoliticianStocks]);

  // Find the single top sell stock based on minimum overall score
  const topSellStock = useMemo(() => {
    if (!topPoliticianStocks || topPoliticianStocks.length === 0) return null;
    const sells = topPoliticianStocks.filter(s => s.signal === "Strong Sell" || s.signal === "Sell" || s.signal === "Hold");
    if (sells.length === 0) return null;
    return [...sells].sort((a, b) => {
      const scoreA = Math.min(a.short_term_score || 0, a.long_term_score || 0);
      const scoreB = Math.min(b.short_term_score || 0, b.long_term_score || 0);
      return scoreA - scoreB;
    })[0];
  }, [topPoliticianStocks]);

  // Format Helper for Timestamps
  const formatTimestamp = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric' 
      }) + ' ' + date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  // Helper for Sentiment Categorization Badge
  const getSentimentPill = (score) => {
    if (score > 0.15) {
      return <span className="sentiment-pill positive"><Icons.TrendingUp size={12} /> Positive</span>;
    } else if (score < -0.15) {
      return <span className="sentiment-pill negative"><Icons.TrendingDown size={12} /> Negative</span>;
    } else {
      return <span className="sentiment-pill neutral"><Icons.TrendingFlat size={12} /> Neutral</span>;
    }
  };

  // Helper for recommendation signal badge
  const getSignalBadge = (signal) => {
    if (signal === "Strong Buy") {
      return <span className="signal-badge signal-strong-buy">▲▲ Strong Buy</span>;
    } else if (signal === "Buy") {
      return <span className="signal-badge signal-buy">▲ Buy</span>;
    } else if (signal === "Strong Sell") {
      return <span className="signal-badge signal-strong-sell">▼▼ Strong Sell</span>;
    } else if (signal === "Sell") {
      return <span className="signal-badge signal-sell">▼ Sell</span>;
    } else {
      return <span className="signal-badge signal-hold">▬ Hold</span>;
    }
  };

  // Helper to render Option Strategy column cell
  const getOptionStrategyCell = (strategy) => {
    if (!strategy || strategy.type === "N/A") {
      return <span style={{ color: 'var(--text-muted)' }}>N/A</span>;
    }

    if (strategy.type === "Hold") {
      return (
        <div className="option-strategy-cell">
          <span className="option-badge option-hold">Hold</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No trade recommended</span>
        </div>
      );
    }

    const badgeClass = strategy.type === "Call" ? "option-badge option-call" : "option-badge option-put";
    const prefix = strategy.type === "Call" ? "▲" : "▼";

    return (
      <div className="option-strategy-cell">
        <span className={badgeClass}>{prefix} {strategy.type}</span>
        <div className="option-details-row">
          <span>Strike: <strong>${formatFloat(strategy.strike, 0)}</strong></span>
          <span>Cost: <strong>${formatFloat(strategy.amount, 0)}</strong></span>
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Exp: {strategy.expiration}
        </span>
      </div>
    );
  };

  // Helper to render Option Strategy in detail drawers
  const getOptionStrategyDrawerBlock = (strategy) => {
    if (!strategy || strategy.type === "N/A") {
      return null;
    }

    const isHold = strategy.type === "Hold";
    const badgeClass = isHold ? "option-badge option-hold" : (strategy.type === "Call" ? "option-badge option-call" : "option-badge option-put");
    const prefix = isHold ? "▬" : (strategy.type === "Call" ? "▲" : "▼");

    return (
      <div className="option-drawer-card" style={{ borderLeft: `4px solid ${isHold ? 'var(--neutral)' : (strategy.type === 'Call' ? 'var(--success)' : 'var(--danger)')}` }}>
        <div className="option-drawer-header">
          <span className="drawer-section-label" style={{ marginBottom: 0 }}>Option Trading Strategy</span>
          <span className={badgeClass}>{prefix} {strategy.type} Strategy</span>
        </div>
        
        {isHold ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            No derivative trade is recommended at this time due to neutral indicators or short-term sentiment/recommendation conflict.
          </p>
        ) : (
          <div className="option-drawer-grid">
            <div className="option-drawer-item">
              <span>Contract Type</span>
              <strong>Standard Equity {strategy.type}</strong>
            </div>
            <div className="option-drawer-item">
              <span>Recommended Strike</span>
              <strong>${formatFloat(strategy.strike, 2)}</strong>
            </div>
            <div className="option-drawer-item">
              <span>Estimated Cost / Premium</span>
              <strong>${formatFloat(strategy.premium, 2)}/share (${formatFloat(strategy.amount, 0)}/contract)</strong>
            </div>
            <div className="option-drawer-item">
              <span>Expiration Date & Time</span>
              <strong>{strategy.expiration} EST</strong>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Safe display float utility
  const formatFloat = (val, decimals = 2) => {
    if (val === undefined || val === null) return "0.00";
    return Number(val).toFixed(decimals);
  };

  return (
    <div className="app-container">
      {/* Header Panel */}
      <header className="app-header">
        <div className="logo-section">
          <Icons.Activity size={26} className="trend-up" />
          <h1>CapitalIntel Dashboard</h1>
          <div className="status-badge">
            <span className={`status-indicator ${refreshing ? "syncing" : ""}`} />
            {health.status === "healthy" ? "Live Feed Active" : "Offline Mode"}
          </div>
        </div>
        
        <div className="actions-section">
          {lastUpdated && (
            <div className="timestamp-info">
              <p>Last Sync: <strong>{lastUpdated}</strong></p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manual Refresh Only</p>
            </div>
          )}
          <button 
            className="btn btn-primary" 
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
          >
            <Icons.Refresh className={refreshing ? "syncing" : ""} size={16} />
            {refreshing ? "Scanning Market..." : "Refresh Data"}
          </button>
        </div>
      </header>

      {/* Executive Market Summary Spotlights */}
      <section className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        
        {/* Top Buy Summary Card */}
        <div className="glass-card metric-card buy-spotlight" style={{ borderLeft: '4px solid var(--success)', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '160px' }}>
          <div className="metric-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
            <span className="metric-title" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
              <Icons.TrendingUp size={16} /> Top Buy Spotlight (7 Days Analysis)
            </span>
            {topBuyStock && getSignalBadge(topBuyStock.signal)}
          </div>
          {topBuyStock ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: '700', fontFamily: 'var(--font-display)' }}>
                  {topBuyStock.ticker}
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Price: ${formatFloat(topBuyStock.last_price)}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', background: 'rgba(16, 185, 129, 0.05)', padding: '0.65rem', borderRadius: '8px', borderLeft: '2px solid var(--success)' }}>
                <strong>Catalyst:</strong> {topBuyStock.long_term_reason || topBuyStock.short_term_reason || "Strong technical trends and insider buy indicators."}
              </p>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>PEG Ratio: <strong style={{ color: 'var(--text-primary)' }}>{topBuyStock.peg_ratio !== null ? formatFloat(topBuyStock.peg_ratio) : "N/A"}</strong></span>
                <span>P/E Ratio: <strong style={{ color: 'var(--text-primary)' }}>{topBuyStock.pe_ratio !== null ? formatFloat(topBuyStock.pe_ratio, 1) : "N/A"}</strong></span>
                <span>RSI (14): <strong style={{ color: 'var(--text-primary)' }}>{topBuyStock.rsi !== null ? formatFloat(topBuyStock.rsi, 1) : "N/A"}</strong></span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>No active buy opportunities detected in recent analyses.</p>
          )}
        </div>

        {/* Top Sell Summary Card */}
        <div className="glass-card metric-card sell-spotlight" style={{ borderLeft: '4px solid var(--danger)', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '160px' }}>
          <div className="metric-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
            <span className="metric-title" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
              <Icons.TrendingDown size={16} /> Top Sell Spotlight (7 Days Analysis)
            </span>
            {topSellStock && getSignalBadge(topSellStock.signal)}
          </div>
          {topSellStock ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: '700', fontFamily: 'var(--font-display)' }}>
                  {topSellStock.ticker}
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Price: ${formatFloat(topSellStock.last_price)}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', background: 'rgba(244, 63, 94, 0.05)', padding: '0.65rem', borderRadius: '8px', borderLeft: '2px solid var(--danger)' }}>
                <strong>Catalyst:</strong> {topSellStock.long_term_reason || topSellStock.short_term_reason || "Significant high multiple valuation or overbought conditions detected."}
              </p>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>PEG Ratio: <strong style={{ color: 'var(--text-primary)' }}>{topSellStock.peg_ratio !== null ? formatFloat(topSellStock.peg_ratio) : "N/A"}</strong></span>
                <span>P/E Ratio: <strong style={{ color: 'var(--text-primary)' }}>{topSellStock.pe_ratio !== null ? formatFloat(topSellStock.pe_ratio, 1) : "N/A"}</strong></span>
                <span>RSI (14): <strong style={{ color: 'var(--text-primary)' }}>{topSellStock.rsi !== null ? formatFloat(topSellStock.rsi, 1) : "N/A"}</strong></span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>No active sell recommendations detected in recent analyses.</p>
          )}
        </div>

      </section>

      <div className="search-vix-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginTop: '-0.5rem' }}>
        
      {/* On-Demand Ticker Intelligence Search Panel */}
      <section className="glass-card search-box-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%', margin: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Icons.Search size={18} className="trend-up" /> Real-time Ticker Intelligence
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Search any stock ticker symbol (e.g. AMD, MSFT, AMZN, NFLX, JPM) to compute real-time indicators, option strategies, and news sentiment.
          </p>
        </div>

        <form onSubmit={(e) => handleTickerSearch(e)} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="search-wrapper" style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Enter ticker symbol (e.g. AMD)..." 
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value)}
              style={{ textTransform: 'uppercase', width: '100%', paddingLeft: '2.5rem' }}
            />
            <Icons.Search className="search-icon-svg" size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={searchLoading || !searchTicker.trim()}
            style={{ minWidth: '120px', justifyContent: 'center' }}
          >
            {searchLoading ? <div className="loading-spinner" style={{ width: '14px', height: '14px', borderTopColor: '#ffffff', margin: 0 }}></div> : "Search"}
          </button>
        </form>

        {/* Quick Ticker Tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Popular Lookups:</span>
          {["AMD", "MSFT", "AMZN", "NFLX", "JPM", "COIN"].map(t => (
            <button 
              key={t}
              className="badge"
              onClick={(e) => {
                setSearchTicker(t);
                handleTickerSearch(e, t);
              }}
              style={{ 
                background: 'rgba(255, 255, 255, 0.03)', 
                border: '1px solid rgba(255, 255, 255, 0.05)', 
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)'
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = 'var(--primary)';
                e.target.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                e.target.style.color = 'var(--text-secondary)';
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {searchError && (
          <div className="sentiment-pill negative" style={{ padding: '0.65rem 1rem', borderRadius: '8px', borderLeft: '3px solid var(--danger)', background: 'rgba(244, 63, 94, 0.05)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', width: 'fit-content' }}>
            <span>⚠️</span> {searchError}
          </div>
        )}

        {searchResult && (
          <div className="ticker-search-details" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                    {searchResult.ticker}
                  </span>
                  <span className="badge badge-aapl" style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>
                    {searchResult.sector}
                  </span>
                  {getSignalBadge(searchResult.signal)}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem', marginBottom: 0 }}>
                  Last Updated: {formatTimestamp(searchResult.last_updated)}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                  ${formatFloat(searchResult.price)}
                </span>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Real-time Quote</p>
              </div>
            </div>

            {/* Visual Speedometer Scale for Opportunity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                <span>Strong Sell</span>
                <span>Sell</span>
                <span>Hold</span>
                <span>Buy</span>
                <span>Strong Buy</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', position: 'relative' }}>
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: '-4px', 
                    left: searchResult.signal === "Strong Buy" ? '90%' : searchResult.signal === "Buy" ? '70%' : searchResult.signal === "Hold" ? '50%' : searchResult.signal === "Sell" ? '30%' : '10%',
                    width: '14px', 
                    height: '14px', 
                    background: searchResult.signal.includes("Buy") ? 'var(--success)' : searchResult.signal.includes("Sell") ? 'var(--danger)' : 'var(--neutral)', 
                    borderRadius: '50%', 
                    boxShadow: `0 0 10px ${searchResult.signal.includes("Buy") ? 'var(--success)' : searchResult.signal.includes("Sell") ? 'var(--danger)' : 'var(--neutral)'}`,
                    transition: 'left 0.5s ease-in-out'
                  }}
                />
              </div>
            </div>

            {/* Visual Sentiment Meter */}
            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>News Sentiment Indicator</span>
                <strong style={{ fontSize: '0.85rem', margin: 0 }} className={searchResult.avg_news_sentiment > 0.15 ? "trend-up" : searchResult.avg_news_sentiment < -0.15 ? "trend-down" : "trend-neutral"}>
                  {searchResult.avg_news_sentiment > 0 ? "+" : ""}{formatFloat(searchResult.avg_news_sentiment)}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--danger)', width: '40px', textAlign: 'left' }}>Bearish</span>
                <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', position: 'relative', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      position: 'absolute', 
                      height: '100%', 
                      background: searchResult.avg_news_sentiment > 0 ? 'var(--success)' : 'var(--danger)', 
                      left: '50%',
                      width: `${Math.min(Math.abs(searchResult.avg_news_sentiment) * 50, 50)}%`,
                      transform: searchResult.avg_news_sentiment < 0 ? 'translateX(-100%)' : 'none',
                      transition: 'width 0.5s ease-in-out'
                    }}
                  />
                  <div style={{ position: 'absolute', left: '50%', top: 0, width: '2px', height: '100%', background: 'rgba(255,255,255,0.2)' }} />
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--success)', width: '40px', textAlign: 'right' }}>Bullish</span>
              </div>
            </div>

            {/* Scorecard and metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              
              {/* Technical Indicator Card */}
              <div className="indicator-card" style={{ margin: 0 }}>
                <h4 style={{ margin: '0 0 0.75rem 0' }}>Technical Momentum</h4>
                <div className="indicator-row">
                  <span>RSI (14):</span>
                  <strong className={searchResult.rsi < 30 ? "trend-up" : searchResult.rsi > 70 ? "trend-down" : "trend-neutral"}>
                    {searchResult.rsi !== null ? formatFloat(searchResult.rsi, 1) : "N/A"}
                  </strong>
                </div>
                <div className="indicator-row">
                  <span>50-Day SMA:</span>
                  <strong>{searchResult.sma_50 !== null ? `$${formatFloat(searchResult.sma_50)}` : "N/A"}</strong>
                </div>
                <div className="indicator-row">
                  <span>200-Day SMA:</span>
                  <strong>{searchResult.sma_200 !== null ? `$${formatFloat(searchResult.sma_200)}` : "N/A"}</strong>
                </div>
                <div className="indicator-row" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                  <span>Short Term:</span>
                  <strong className={searchResult.short_term_signal.includes("Buy") ? "trend-up" : searchResult.short_term_signal.includes("Sell") ? "trend-down" : "trend-neutral"}>
                    {searchResult.short_term_signal}
                  </strong>
                </div>
              </div>

              {/* Fundamental Valuation Card */}
              <div className="indicator-card" style={{ margin: 0 }}>
                <h4 style={{ margin: '0 0 0.75rem 0' }}>Fundamental Ratios</h4>
                <div className="indicator-row">
                  <span>PEG Ratio:</span>
                  <strong className={searchResult.peg_ratio > 0 && searchResult.peg_ratio < 1.0 ? "trend-up" : "trend-neutral"}>
                    {searchResult.peg_ratio !== null ? formatFloat(searchResult.peg_ratio) : "N/A"}
                  </strong>
                </div>
                <div className="indicator-row">
                  <span>P/E Ratio:</span>
                  <strong>{searchResult.pe_ratio !== null ? formatFloat(searchResult.pe_ratio, 1) : "N/A"}</strong>
                </div>
                <div className="indicator-row">
                  <span>Politician Buy/Sell:</span>
                  <strong style={{ fontSize: '0.85rem' }}>
                    <span className="tx-buy">{searchResult.buy_count}</span> / <span className="tx-sell">{searchResult.sell_count}</span>
                  </strong>
                </div>
                <div className="indicator-row" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                  <span>Long Term:</span>
                  <strong className={searchResult.long_term_signal.includes("Buy") ? "trend-up" : searchResult.long_term_signal.includes("Sell") ? "trend-down" : "trend-neutral"}>
                    {searchResult.long_term_signal}
                  </strong>
                </div>
              </div>
            </div>

            {/* Entry, Stop Loss, R/R, and Pattern for Search Ticker */}
            {(() => {
              const setup = calculateTradeSetup(searchResult);
              if (!setup) return null;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>Execution Targets & Pattern</span>
                    <span className={`option-badge ${setup.type === 'Long' ? 'option-call' : setup.type === 'Short' ? 'option-put' : 'option-hold'}`} style={{ fontSize: '0.7rem' }}>
                      {setup.type === 'Long' ? '▲ LONG SETUP' : setup.type === 'Short' ? '▼ SHORT SETUP' : '▬ SWING SETUP'}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <strong>Pattern:</strong> 🔍 {setup.pattern} — <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{setup.patternDesc}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center', fontSize: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.65rem' }}>
                    <div>
                      <span style={{ color: 'var(--danger)', display: 'block', fontSize: '0.65rem', fontWeight: '600', textTransform: 'uppercase' }}>Stop Loss</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>${formatFloat(setup.stopLoss)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--success)', display: 'block', fontSize: '0.65rem', fontWeight: '600', textTransform: 'uppercase' }}>Ideal Entry</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>${formatFloat(setup.entry)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--primary)', display: 'block', fontSize: '0.65rem', fontWeight: '600', textTransform: 'uppercase' }}>Target 2</span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>${formatFloat(setup.target2)}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Favorable R/R Ratio:</span>
                    <strong style={{ color: setup.rr >= 2.0 ? 'var(--success)' : 'var(--warning)' }}>1 : {formatFloat(setup.rr)}</strong>
                  </div>
                </div>
              );
            })()}

            {/* Catalyst & Strategy Explanation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '0.85rem 1rem', borderRadius: '10px' }}>
                <p style={{ marginBottom: '0.35rem', marginTop: 0 }}>
                  <strong>Short-Term Logic:</strong> {searchResult.short_term_reason}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Long-Term Value Logic:</strong> {searchResult.long_term_reason}
                </p>
              </div>
            </div>

            {/* Option Strategy recommendation panel */}
            {searchResult.option_strategy && searchResult.option_strategy.type !== "N/A" && (
              <div style={{ background: 'rgba(99, 102, 241, 0.02)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.08)' }}>
                {getOptionStrategyDrawerBlock(searchResult.option_strategy)}
                {/* Explain Option Logic tooltip style text */}
                <div style={{ padding: '0 1.25rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  💡 <strong>Contract Strategy:</strong> Expiration is scheduled for monthly standard options ~30 days out ({searchResult.option_strategy.expiration.split(" ")[0]}), automatically adjusted to land on the nearest active US market trading day (shifting backwards if falling on a weekend or public holiday).
                </div>
              </div>
            )}

            {/* CTA Buttons */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
              <button 
                className="btn btn-primary"
                onClick={() => setSelectedAnalysisStock(searchResult)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Icons.Activity size={16} /> View Interactive Candle Chart
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setTickerFilter(searchResult.ticker);
                  setActiveTab("sentiment");
                }}
                style={{ justifyContent: 'center' }}
                title="Go to Sentiment Feed"
              >
                Go to News Feed
              </button>
            </div>

          </div>
        )}
      </section>

      {/* Trade Execution Setup & Dynamic Pattern Card */}
      {(() => {
        return (
          <section className="glass-card execution-box-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%', margin: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Icons.TrendingUp size={18} className="trend-up" /> Top 10 Trade Execution Setups
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Automated target entry calculations, stops, and dynamic technical pattern classification.
              </p>
            </div>

            {!top10BestStocks || top10BestStocks.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 0', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No trade execution data available.</p>
              </div>
            ) : (
              <div className="trade-setup-list">
                {top10BestStocks.map((stock) => {
                  const tradeSetup = calculateTradeSetup(stock);
                  if (!tradeSetup) return null;
                  return (
                    <div key={stock.ticker} className="trade-setup-row">
                      {/* Top row: Symbol, Sector, Price, Type Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                            {stock.ticker}
                          </strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.05)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                            {stock.sector || "Other"}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            ${formatFloat(stock.last_price || stock.price)}
                          </strong>
                          <span className={`option-badge ${tradeSetup.type === 'Long' ? 'option-call' : tradeSetup.type === 'Short' ? 'option-put' : 'option-hold'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                            {tradeSetup.type === 'Long' ? '▲ BUY' : tradeSetup.type === 'Short' ? '▼ SHORT' : '▬ SWING'}
                          </span>
                        </div>
                      </div>

                      {/* Pattern Identification Section */}
                      <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.03)', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          🔍 {tradeSetup.pattern}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', lineHeight: '1.3' }}>
                          {tradeSetup.patternDesc}
                        </div>
                      </div>

                      {/* Execution Targets section */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.03)', paddingTop: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                          <div>
                            <span style={{ color: 'var(--success)', display: 'block', fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase' }}>Entry</span>
                            <strong style={{ color: 'var(--text-primary)' }}>${formatFloat(tradeSetup.entry)}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--danger)', display: 'block', fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase' }}>Stop Loss</span>
                            <strong style={{ color: 'var(--text-primary)' }}>${formatFloat(tradeSetup.stopLoss)}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase' }}>R/R Ratio</span>
                            <strong style={{ color: tradeSetup.rr >= 2.0 ? 'var(--success)' : 'var(--warning)' }}>1:{formatFloat(tradeSetup.rr)}</strong>
                          </div>
                        </div>

                        <button 
                          className="btn btn-primary"
                          onClick={() => setSelectedAnalysisStock(stock)}
                          style={{ fontSize: '0.7rem', padding: '0.35rem 0.65rem', minHeight: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Icons.Activity size={12} />
                          Analyze Chart
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })()}

      {/* Market Volatility & Downside Protection (VIX) Panel */}
      <section className="glass-card vix-box-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Icons.Activity size={18} className="trend-down" /> Volatility & Downside Analytics
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Real-time market fear indexing (VIX) and statistical S&P 500 downside risk projection boundaries.
          </p>
        </div>

        {vixLoading ? (
          <div className="empty-state" style={{ padding: '2rem 0' }}>
            <div className="loading-spinner"></div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Analyzing market volatility index (VIX)...</p>
          </div>
        ) : vixError ? (
          <div className="sentiment-pill negative" style={{ padding: '0.65rem 1rem', borderRadius: '8px', borderLeft: '3px solid var(--danger)', background: 'rgba(244, 63, 94, 0.05)', fontSize: '0.85rem' }}>
            ⚠️ {vixError}
          </div>
        ) : vixData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* VIX & S&P 500 prices row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              
              {/* VIX Column */}
              <div style={{ flex: 1, minWidth: '140px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>CBOE VIX Index</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {formatFloat(vixData.vix_price)}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: '600' }} className={vixData.vix_change >= 0 ? "trend-down" : "trend-up"}>
                    {vixData.vix_change >= 0 ? "▲" : "▼"} {formatFloat(Math.abs(vixData.vix_change))} ({formatFloat(vixData.vix_change_pct)}%)
                  </span>
                </div>
              </div>

              {/* S&P 500 Column */}
              <div style={{ flex: 1, minWidth: '140px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>S&P 500 Index</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    ${formatFloat(vixData.sp500_price, 0)}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: '600' }} className={vixData.sp500_change >= 0 ? "trend-up" : "trend-down"}>
                    {vixData.sp500_change >= 0 ? "▲" : "▼"} {formatFloat(Math.abs(vixData.sp500_change_pct))}%
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Speedometer VIX Gauge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  Volatility State: <strong style={{ color: `var(--${vixData.color_theme})` }}>{vixData.fear_level}</strong>
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>20-Day SMA: {formatFloat(vixData.vix_sma_20)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                <span>{"Complacency (<12)"}</span>
                <span>{"Normal (12-20)"}</span>
                <span>{"Elevated (20-30)"}</span>
                <span>{"Panic (>=30)"}</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', position: 'relative' }}>
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: '-4px', 
                    left: vixData.vix_price < 12 ? `${(vixData.vix_price / 12) * 25}%` :
                          vixData.vix_price < 20 ? `${25 + ((vixData.vix_price - 12) / 8) * 25}%` :
                          vixData.vix_price < 30 ? `${50 + ((vixData.vix_price - 20) / 10) * 25}%` :
                          `${Math.min(75 + ((vixData.vix_price - 30) / 20) * 25, 96)}%`,
                    width: '14px', 
                    height: '14px', 
                    background: `var(--${vixData.color_theme})`,
                    borderRadius: '50%', 
                    boxShadow: `0 0 10px var(--${vixData.color_theme})`,
                    transition: 'left 0.5s ease-in-out'
                  }}
                />
              </div>
            </div>

            {/* Expected Downside Drawdown scorecard */}
            <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>Expected S&P 500 30-Day Drawdown Boundaries</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Risk Range</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Expected Monthly Low</span>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--warning)' }}>
                    {formatFloat(vixData.expected_low_pct_1sd)}%
                  </strong>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>1-Std Dev (68% Probability)</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Extreme Tail-Risk Stress Low</span>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--danger)' }}>
                    {formatFloat(vixData.expected_low_pct_2sd)}%
                  </strong>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>2-Std Dev (95% Probability)</span>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.45', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                💡 <strong>Mathematical Volatility Index Pricing</strong>: Division by the square root of 12 translates annualized VIX volatility into a monthly expected index trading range. Under standard probability distributions, there is a 95% likelihood the S&P 500 remains above the extreme tail-risk low.
              </div>
            </div>

            {/* Macro Volatility Trend Sentiment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.05em' }}>
                Volatility Trend & Bias Indicator
              </span>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '0.85rem 1rem', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ 
                    display: 'inline-block', 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    background: vixData.market_bias.includes("Bearish") || vixData.market_bias.includes("Rising") ? 'var(--danger)' : 'var(--success)',
                    boxShadow: `0 0 6px ${vixData.market_bias.includes("Bearish") || vixData.market_bias.includes("Rising") ? 'var(--danger)' : 'var(--success)'}`
                  }} />
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{vixData.market_bias}</strong>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
                  {vixData.bias_desc} {vixData.fear_desc}
                </p>
              </div>
            </div>

          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>No volatility analytics data loaded.</p>
        )}
      </section>

      </div>

      {/* Tabs Navigation */}
      <div className="glass-card" style={{ padding: '0.25rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <nav className="tabs-navigation" style={{ borderBottom: 'none', marginBottom: 0 }}>
          <button 
            className={`tab-btn ${activeTab === "sentiment" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("sentiment");
              setTickerFilter("ALL");
            }}
          >
            Market Sentiment Feed
          </button>
          <button 
            className={`tab-btn ${activeTab === "trades" ? "active" : ""}`}
            onClick={() => setActiveTab("trades")}
          >
            Congressional Trades
          </button>
          <button 
            className={`tab-btn ${activeTab === "opportunities" ? "active" : ""}`}
            onClick={() => setActiveTab("opportunities")}
          >
            Stock Opportunities
          </button>
          <button 
            className={`tab-btn ${activeTab === "trends" ? "active" : ""}`}
            onClick={() => setActiveTab("trends")}
          >
            Yahoo Finance Trends
          </button>
        </nav>
        
        {/* Prominent Politician Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
            <input 
              type="checkbox" 
              checked={prominentOnly} 
              onChange={(e) => setProminentOnly(e.target.checked)} 
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <span>Big Names (High Net Worth Only)</span>
          </label>
        </div>
      </div>

      {/* Dynamic Content Sections */}
      {activeTab === "sentiment" && (
        <>
          {/* Control Filters panel */}
          <section className="glass-card controls-panel">
            <div className="search-wrapper">
              <Icons.Search className="search-icon-svg" size={16} />
              <input 
                type="text" 
                placeholder="Search news headlines or analysis..." 
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="filters-wrapper">
              <select 
                className="select-filter" 
                value={tickerFilter}
                onChange={(e) => setTickerFilter(e.target.value)}
              >
                <option value="ALL">All Tickers</option>
                {Object.keys(stats.tickers).map(ticker => (
                  <option key={ticker} value={ticker}>{ticker}</option>
                ))}
              </select>
              
              <select 
                className="select-filter" 
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
              >
                <option value="ALL">All Sentiments</option>
                <option value="POSITIVE">Positive Signals</option>
                <option value="NEUTRAL">Neutral Signals</option>
                <option value="NEGATIVE">Negative Signals</option>
              </select>
            </div>
          </section>

          {/* Signals Table Card */}
          <section className="glass-card" style={{ padding: '1rem' }}>
            {loading ? (
              <div className="empty-state">
                <div className="loading-spinner"></div>
                <p>Initializing dashboard feed...</p>
              </div>
            ) : filteredSignals.length === 0 ? (
              <div className="empty-state">
                <Icons.Alert className="trend-neutral" size={40} />
                <h3 style={{ marginTop: '1rem' }}>No signals found</h3>
                <p>Try resetting filters or click "Refresh Data" to parse new news articles.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="signals-table">
                  <thead>
                    <tr>
                      <th style={{ width: '180px' }}>Date</th>
                      <th style={{ width: '90px' }}>Ticker</th>
                      <th style={{ width: '100px' }}>Price</th>
                      <th>Headline</th>
                      <th style={{ width: '180px' }}>Sentiment Indicator</th>
                      <th style={{ width: '120px' }}>Sentiment</th>
                      <th style={{ width: '130px' }}>Dashboard Rec</th>
                      <th style={{ width: '160px' }}>Options Strategy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSignals.map((signal) => (
                      <tr 
                        key={signal.id} 
                        onClick={() => setSelectedSignal(signal)} 
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {formatTimestamp(signal.timestamp)}
                        </td>
                        <td>
                          <span className="badge badge-tsla">
                            {signal.ticker}
                          </span>
                        </td>
                        <td style={{ fontWeight: '500' }}>
                          ${formatFloat(signal.price)}
                        </td>
                        <td style={{ fontWeight: '500', color: 'var(--text-primary)' }} className="headline-cell">
                          {signal.headline}
                        </td>
                        <td>
                          <div className="sentiment-bar-container">
                            <div className="sentiment-bar-bg">
                              <div 
                                className={`sentiment-bar-fill ${signal.sentiment_score >= 0 ? "positive" : "negative"}`}
                                style={{ 
                                  width: `${Math.abs(signal.sentiment_score) * 50}%`,
                                  left: signal.sentiment_score >= 0 ? '50%' : 'auto',
                                  right: signal.sentiment_score < 0 ? '50%' : 'auto'
                                }}
                              />
                            </div>
                            <span className={`sentiment-score-val ${signal.sentiment_score > 0.15 ? "trend-up" : "trend-down" ? "trend-down" : "trend-neutral"}`}>
                              {signal.sentiment_score > 0 ? "+" : ""}{formatFloat(signal.sentiment_score)}
                            </span>
                          </div>
                        </td>
                        <td>
                          {getSentimentPill(signal.sentiment_score)}
                        </td>
                        <td>
                          {signal.recommendation ? getSignalBadge(signal.recommendation) : <span style={{color: 'var(--text-muted)'}}>-</span>}
                        </td>
                        <td>
                          {getOptionStrategyCell(signal.option_strategy)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === "trades" && (
        <>
          {/* Politician Controls Panel */}
          <section className="glass-card controls-panel">
            <div className="search-wrapper">
              <Icons.Search className="search-icon-svg" size={16} />
              <input 
                type="text" 
                placeholder="Search politician name, ticker or asset..." 
                className="search-input"
                value={politicianSearchQuery}
                onChange={(e) => setPoliticianSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="filters-wrapper">
              <select 
                className="select-filter" 
                value={politicianPartyFilter}
                onChange={(e) => setPoliticianPartyFilter(e.target.value)}
              >
                <option value="ALL">All Parties</option>
                <option value="D">Democrat</option>
                <option value="R">Republican</option>
              </select>
              
              <select 
                className="select-filter" 
                value={politicianTxTypeFilter}
                onChange={(e) => setPoliticianTxTypeFilter(e.target.value)}
              >
                <option value="ALL">All Trades</option>
                <option value="Purchase">Purchase (Buy)</option>
                <option value="Sale">Sale</option>
                <option value="Exchange">Exchange</option>
              </select>
            </div>
          </section>

          {/* Politician Trades Table Card */}
          <section className="glass-card" style={{ padding: '1rem' }}>
            {loading ? (
              <div className="empty-state">
                <div className="loading-spinner"></div>
                <p>Fetching Congressional disclosures...</p>
              </div>
            ) : filteredPoliticianTrades.length === 0 ? (
              <div className="empty-state">
                <Icons.Alert className="trend-neutral" size={40} />
                <h3 style={{ marginTop: '1rem' }}>No disclosures found</h3>
                <p>Try resetting filters or click "Refresh Data" to scan the latest filings.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="signals-table">
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Date</th>
                      <th style={{ width: '180px' }}>Politician</th>
                      <th style={{ width: '80px' }}>Party</th>
                      <th style={{ width: '90px' }}>Ticker</th>
                      <th style={{ width: '130px' }}>Dashboard Rec</th>
                      <th style={{ width: '160px' }}>Options Strategy</th>
                      <th style={{ width: '100px' }}>Type</th>
                      <th>Asset Class / Name</th>
                      <th style={{ width: '180px' }}>Transaction Size</th>
                      <th style={{ width: '80px' }}>Filing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPoliticianTrades.map((trade) => (
                      <tr 
                        key={trade.id} 
                        onClick={() => setSelectedTrade(trade)} 
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {trade.transaction_date}
                        </td>
                        <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                          {trade.filer_name}
                          <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                            {trade.chamber === 'senate' ? 'U.S. Senator' : 'U.S. Representative'} • {trade.state}
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-${trade.party === 'R' ? 'rep' : trade.party === 'D' ? 'dem' : 'ind'}`}>
                            {trade.party || 'I'}
                          </span>
                        </td>
                        <td style={{ fontWeight: '700' }}>
                          {trade.ticker || "N/A"}
                        </td>
                        <td>
                          {trade.recommendation ? getSignalBadge(trade.recommendation) : <span style={{color: 'var(--text-muted)'}}>-</span>}
                        </td>
                        <td>
                          {getOptionStrategyCell(trade.option_strategy)}
                        </td>
                        <td>
                          <span className={trade.transaction_type === 'Purchase' ? 'tx-buy' : trade.transaction_type === 'Sale' ? 'tx-sell' : 'trend-neutral'}>
                            {trade.transaction_type}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{trade.asset_name}</span>
                        </td>
                        <td style={{ fontWeight: '500', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {trade.amount_range || "N/A"}
                        </td>
                        <td>
                          {trade.doc_url ? (
                            <a 
                              href={trade.doc_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="doc-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Icons.BookOpen size={14} /> PDF
                            </a>
                          ) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === "opportunities" && (
        <>
          {/* Top Recommendations: Short-term and Long-term grids */}
          <div className="opportunities-dashboard-grid">
            
            {/* Short-Term Momentum Column */}
            <section className="glass-card opportunities-column-section">
              <div>
                <h3 className="column-heading" style={{ color: 'var(--primary)', borderBottom: '1px solid rgba(99, 102, 241, 0.2)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                  🔥 Short-Term Momentum Buys
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Driven by oversold RSI indicators, immediate bullish news sentiment, and positive trade catalysts.
                </p>
              </div>

              {loading ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <div className="loading-spinner"></div>
                  <p>Calculating momentum indicators...</p>
                </div>
              ) : shortTermOpportunities.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <Icons.Alert className="trend-neutral" size={24} />
                  <p style={{ fontSize: '0.85rem' }}>No immediate short-term buy triggers detected.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {shortTermOpportunities.map((stock) => (
                    <div key={stock.ticker} className="glass-card opportunity-sub-card" style={{ borderLeft: '4px solid var(--success)', background: 'rgba(255, 255, 255, 0.01)', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{stock.ticker}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{stock.sector}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <span className="signal-badge signal-strong-buy" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                            {stock.short_term_signal}
                          </span>
                        </div>
                      </div>

                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0', background: 'rgba(16, 185, 129, 0.05)', padding: '0.5rem', borderRadius: '4px', borderLeft: '2px solid var(--success)' }}>
                        {stock.short_term_reason}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <div>Price: <strong style={{ color: 'var(--text-primary)' }}>${formatFloat(stock.last_price)}</strong></div>
                        <div>RSI (14): <strong className={stock.rsi < 35 ? "trend-up" : "trend-neutral"}>{formatFloat(stock.rsi, 1)}</strong></div>
                        <div>Sentiment: <strong className={stock.avg_news_sentiment > 0.15 ? "trend-up" : "trend-neutral"}>{stock.avg_news_sentiment > 0 ? "+" : ""}{formatFloat(stock.avg_news_sentiment)}</strong></div>
                        <div>Insider Buys: <strong className="tx-buy">{stock.buy_count} Purchases</strong></div>
                      </div>

                      {stock.option_strategy && stock.option_strategy.type !== "N/A" && (
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Recommended Option</span>
                            <span className={`option-badge ${stock.option_strategy.type === 'Call' ? 'option-call' : stock.option_strategy.type === 'Put' ? 'option-put' : 'option-hold'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                              {stock.option_strategy.type}
                            </span>
                          </div>
                          {stock.option_strategy.type !== "Hold" && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              <span>Strike: <strong style={{ color: 'var(--text-primary)' }}>${formatFloat(stock.option_strategy.strike, 0)}</strong></span>
                              <span>Cost: <strong style={{ color: 'var(--text-primary)' }}>${formatFloat(stock.option_strategy.amount, 0)}</strong></span>
                              <span>Exp: <strong style={{ color: 'var(--text-primary)' }}>{stock.option_strategy.expiration.split(" ")[0]}</strong></span>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                          onClick={() => setSelectedAnalysisStock(stock)}
                        >
                          <Icons.Activity size={10} /> Analyze Chart
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ justifyContent: 'center', padding: '0.35rem' }}
                          title="View Sentiment Feed"
                          onClick={() => {
                            setTickerFilter(stock.ticker);
                            setActiveTab("sentiment");
                          }}
                        >
                          <Icons.BookOpen size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Long-Term Value Column */}
            <section className="glass-card opportunities-column-section">
              <div>
                <h3 className="column-heading" style={{ color: 'var(--secondary)', borderBottom: '1px solid rgba(6, 182, 212, 0.2)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                  💎 Long-Term Value & Growth Buys
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Selected based on low P/E ratio, PEG growth multiple (&lt; 1.0), and insider accumulation trends.
                </p>
              </div>

              {loading ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <div className="loading-spinner"></div>
                  <p>Analyzing company growth valuations...</p>
                </div>
              ) : longTermOpportunities.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <Icons.Alert className="trend-neutral" size={24} />
                  <p style={{ fontSize: '0.85rem' }}>No deep valuation buy signals identified.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {longTermOpportunities.map((stock) => (
                    <div key={stock.ticker} className="glass-card opportunity-sub-card" style={{ borderLeft: '4px solid var(--secondary)', background: 'rgba(255, 255, 255, 0.01)', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{stock.ticker}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{stock.sector}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <span className="signal-badge" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', background: 'linear-gradient(135deg, var(--secondary) 0%, #0891b2 100%)', color: '#ffffff', boxShadow: '0 2px 8px rgba(6, 182, 212, 0.3)' }}>
                            {stock.long_term_signal}
                          </span>
                        </div>
                      </div>

                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0', background: 'rgba(6, 182, 212, 0.05)', padding: '0.5rem', borderRadius: '4px', borderLeft: '2px solid var(--secondary)' }}>
                        {stock.long_term_reason}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <div>Price: <strong style={{ color: 'var(--text-primary)' }}>${formatFloat(stock.last_price)}</strong></div>
                        <div>PEG Ratio: <strong className={stock.peg_ratio < 1.0 ? "trend-up" : "trend-neutral"}>{formatFloat(stock.peg_ratio)}</strong></div>
                        <div>P/E Ratio: <strong style={{ color: 'var(--text-primary)' }}>{formatFloat(stock.pe_ratio, 1)}</strong></div>
                        <div>Accumulation: <strong className="tx-buy">{stock.buy_count} Insiders</strong></div>
                      </div>

                      {stock.option_strategy && stock.option_strategy.type !== "N/A" && (
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Recommended Option</span>
                            <span className={`option-badge ${stock.option_strategy.type === 'Call' ? 'option-call' : stock.option_strategy.type === 'Put' ? 'option-put' : 'option-hold'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                              {stock.option_strategy.type}
                            </span>
                          </div>
                          {stock.option_strategy.type !== "Hold" && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              <span>Strike: <strong style={{ color: 'var(--text-primary)' }}>${formatFloat(stock.option_strategy.strike, 0)}</strong></span>
                              <span>Cost: <strong style={{ color: 'var(--text-primary)' }}>${formatFloat(stock.option_strategy.amount, 0)}</strong></span>
                              <span>Exp: <strong style={{ color: 'var(--text-primary)' }}>{stock.option_strategy.expiration.split(" ")[0]}</strong></span>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                          onClick={() => setSelectedAnalysisStock(stock)}
                        >
                          <Icons.Activity size={10} /> Analyze Chart
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ justifyContent: 'center', padding: '0.35rem' }}
                          title="View Sentiment Feed"
                          onClick={() => {
                            setTickerFilter(stock.ticker);
                            setActiveTab("sentiment");
                          }}
                        >
                          <Icons.BookOpen size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Sector Opportunities Watchlist */}
          <section className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>
                Congressional Opportunities by Sector
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Review complete sector groupings showing dual short-term momentum and long-term value signals.
              </p>
            </div>
            
            {loading ? (
              <div className="empty-state">
                <div className="loading-spinner"></div>
                <p>Analyzing stock watchlists...</p>
              </div>
            ) : Object.keys(groupedSectors).length === 0 ? (
              <div className="empty-state">
                <Icons.Alert className="trend-neutral" size={40} />
                <h3 style={{ marginTop: '1rem' }}>No opportunities computed</h3>
                <p>Run a manual refresh to scan congressional filings and generate opportunities.</p>
              </div>
            ) : (
              <div>
                {Object.keys(groupedSectors).map(sector => (
                  <div key={sector} className="sector-group">
                    <h3 className="sector-heading">{sector}</h3>
                    <div className="opportunities-grid">
                      {groupedSectors[sector].map((stock) => (
                        <div key={stock.ticker} className="glass-card opportunity-card" style={{ borderLeft: stock.signal.includes("Buy") ? "3px solid var(--success)" : stock.signal.includes("Sell") ? "3px solid var(--danger)" : "3px solid var(--text-muted)" }}>
                          <div className="opportunity-title">
                            <span>{stock.ticker}</span>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>${formatFloat(stock.last_price)}</span>
                          </div>
                          
                          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.03)', paddingBottom: '0.25rem' }}>
                              <span>Short-Term Signal:</span>
                              <span className={`trend-${stock.short_term_signal.includes("Buy") ? "up" : stock.short_term_signal.includes("Sell") ? "down" : "neutral"}`} style={{ fontWeight: '700' }}>
                                {stock.short_term_signal}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.03)', paddingBottom: '0.25rem' }}>
                              <span>Long-Term Signal:</span>
                              <span className={`trend-${stock.long_term_signal.includes("Buy") ? "up" : stock.long_term_signal.includes("Sell") ? "down" : "neutral"}`} style={{ fontWeight: '700' }}>
                                {stock.long_term_signal}
                              </span>
                            </div>
                          </div>

                          <div style={{ marginTop: '0.5rem' }}>
                            <div className="opportunity-metric">
                              <span>Net buys (Buy/Sell):</span>
                              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                <span className="tx-buy">{stock.buy_count}</span> / <span className="tx-sell">{stock.sell_count}</span>
                              </span>
                            </div>
                            <div className="opportunity-metric">
                              <span>Avg News Sentiment:</span>
                              <span className={stock.avg_news_sentiment > 0.15 ? "trend-up" : stock.avg_news_sentiment < -0.15 ? "trend-down" : "trend-neutral"} style={{ fontWeight: '600' }}>
                                {stock.avg_news_sentiment > 0 ? "+" : ""}{formatFloat(stock.avg_news_sentiment)}
                              </span>
                            </div>
                            {stock.pe_ratio !== undefined && stock.pe_ratio !== null && (
                              <div className="opportunity-metric">
                                <span>P/E Ratio:</span>
                                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                  {formatFloat(stock.pe_ratio, 1)}
                                </span>
                              </div>
                            )}
                            {stock.peg_ratio !== undefined && stock.peg_ratio !== null && (
                              <div className="opportunity-metric">
                                <span>PEG Ratio:</span>
                                <span className={stock.peg_ratio > 0 && stock.peg_ratio < 1.0 ? "trend-up" : "trend-neutral"} style={{ fontWeight: '600' }}>
                                  {formatFloat(stock.peg_ratio)} {stock.peg_ratio > 0 && stock.peg_ratio < 1.0 ? "(Undervalued)" : ""}
                                </span>
                              </div>
                            )}
                            {stock.rsi !== undefined && stock.rsi !== null && (
                              <div className="opportunity-metric">
                                <span>RSI (14):</span>
                                <span className={stock.rsi < 35 ? "trend-up" : stock.rsi > 70 ? "trend-down" : "trend-neutral"} style={{ fontWeight: '600' }}>
                                  {formatFloat(stock.rsi, 1)}
                                </span>
                              </div>
                            )}
                          </div>

                          {stock.option_strategy && stock.option_strategy.type !== "N/A" && (
                            <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Recommended Option</span>
                                <span className={`option-badge ${stock.option_strategy.type === 'Call' ? 'option-call' : stock.option_strategy.type === 'Put' ? 'option-put' : 'option-hold'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                                  {stock.option_strategy.type}
                                </span>
                              </div>
                              {stock.option_strategy.type !== "Hold" && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  <span>Strike: <strong style={{ color: 'var(--text-primary)' }}>${formatFloat(stock.option_strategy.strike, 0)}</strong></span>
                                  <span>Cost: <strong style={{ color: 'var(--text-primary)' }}>${formatFloat(stock.option_strategy.amount, 0)}</strong></span>
                                  <span>Exp: <strong style={{ color: 'var(--text-primary)' }}>{stock.option_strategy.expiration.split(" ")[0]}</strong></span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                            <button 
                              className="btn btn-primary" 
                              style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                              onClick={() => setSelectedAnalysisStock(stock)}
                            >
                              <Icons.Activity size={12} /> Analyze Chart
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ justifyContent: 'center', padding: '0.45rem' }}
                              title="View Sentiment Feed"
                              onClick={() => {
                                setTickerFilter(stock.ticker);
                                setActiveTab("sentiment");
                              }}
                            >
                              <Icons.BookOpen size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === "trends" && (
        <>
          <section className="glass-card trends-container" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>
                Yahoo Finance Market Movers
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Real-time trending tickers and day gainers direct from Yahoo Finance APIs. Click any card to launch Technical Chart & Indicator scoring.
              </p>
            </div>
            
            {trendsLoading ? (
              <div className="empty-state">
                <div className="loading-spinner"></div>
                <p>Loading Yahoo Finance trends data...</p>
              </div>
            ) : (
              <div className="trends-columns-grid">
                
                {/* Trending Tickers Column */}
                <div className="trends-column">
                  <h3 className="column-heading trending-header" style={{ color: 'var(--primary)' }}>
                    <span style={{ marginRight: '0.5rem' }}>🔥</span> Trending Tickers
                  </h3>
                  <div className="trends-list">
                    {trendingTickers.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem 0' }}>No trending tickers available.</p>
                    ) : (
                      trendingTickers.map((ticker) => (
                        <div key={ticker.symbol} className="glass-card trend-item-card">
                          <div className="trend-item-header">
                            <div className="trend-item-title">
                              <span className="trend-item-symbol">{ticker.symbol}</span>
                              <span className="trend-item-name" title={ticker.name}>{ticker.name}</span>
                            </div>
                            <span className={`trend-item-price-change ${ticker.change_percent >= 0 ? "trend-up" : "trend-down"}`} style={{ fontWeight: '700' }}>
                              {ticker.change_percent >= 0 ? "+" : ""}{formatFloat(ticker.change_percent)}%
                            </span>
                          </div>
                          <div className="trend-item-body">
                            <div className="trend-item-detail">
                              <span>Price:</span>
                              <strong>${formatFloat(ticker.price)}</strong>
                            </div>
                            <div className="trend-item-detail">
                              <span>Volume:</span>
                              <span>{ticker.volume}</span>
                            </div>
                            <div className="trend-item-detail">
                              <span>Market Cap:</span>
                              <span>{ticker.market_cap}</span>
                            </div>
                          </div>
                          <button 
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '0.45rem', marginTop: '0.5rem' }}
                            onClick={() => setSelectedAnalysisStock({
                              ticker: ticker.symbol,
                              last_price: ticker.price,
                              buy_count: 0,
                              sell_count: 0,
                              avg_news_sentiment: 0.0,
                              rsi: null,
                              sma_50: null,
                              sma_200: null,
                              peg_ratio: null,
                              pe_ratio: null,
                              signal: ticker.change_percent >= 2.0 ? "Buy" : ticker.change_percent <= -2.0 ? "Sell" : "Hold"
                            })}
                          >
                            <Icons.Activity size={12} /> Analyze Chart
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Top Gainers Column */}
                <div className="trends-column">
                  <h3 className="column-heading gainers-header" style={{ color: 'var(--success)' }}>
                    <span style={{ marginRight: '0.5rem' }}>📈</span> Day Gainers
                  </h3>
                  <div className="trends-list">
                    {topGainers.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem 0' }}>No top gainers available.</p>
                    ) : (
                      topGainers.map((gainer) => (
                        <div key={gainer.symbol} className="glass-card trend-item-card" style={{ borderLeft: '3px solid var(--success)' }}>
                          <div className="trend-item-header">
                            <div className="trend-item-title">
                              <span className="trend-item-symbol">{gainer.symbol}</span>
                              <span className="trend-item-name" title={gainer.name}>{gainer.name}</span>
                            </div>
                            <span className="trend-item-price-change trend-up" style={{ fontWeight: '700' }}>
                              +{formatFloat(gainer.change_percent)}%
                            </span>
                          </div>
                          <div className="trend-item-body">
                            <div className="trend-item-detail">
                              <span>Price:</span>
                              <strong>${formatFloat(gainer.price)}</strong>
                            </div>
                            <div className="trend-item-detail">
                              <span>Volume:</span>
                              <span>{gainer.volume}</span>
                            </div>
                            <div className="trend-item-detail">
                              <span>Market Cap:</span>
                              <span>{gainer.market_cap}</span>
                            </div>
                          </div>
                          <button 
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '0.45rem', marginTop: '0.5rem' }}
                            onClick={() => setSelectedAnalysisStock({
                              ticker: gainer.symbol,
                              last_price: gainer.price,
                              buy_count: 0,
                              sell_count: 0,
                              avg_news_sentiment: 0.0,
                              rsi: null,
                              sma_50: null,
                              sma_200: null,
                              peg_ratio: null,
                              pe_ratio: null,
                              signal: "Strong Buy"
                            })}
                          >
                            <Icons.Activity size={12} /> Analyze Chart
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}
          </section>
        </>
      )}

      {/* Signal Row detail drawer/modal */}
      <div 
        className={`drawer-backdrop ${selectedSignal ? "open" : ""}`}
        onClick={() => setSelectedSignal(null)}
      >
        <div 
          className="drawer-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="drawer-header">
            <h2 className="drawer-title">Signal Intelligence</h2>
            <button className="drawer-close" onClick={() => setSelectedSignal(null)}>&times;</button>
          </div>
          
          {selectedSignal && (
            <div className="drawer-body">
              <div className="drawer-section">
                <span className="drawer-section-label">Stock Ticker</span>
                <div>
                  <span className="badge badge-tsla" style={{ fontSize: '0.9rem', padding: '0.35rem 0.75rem' }}>
                    {selectedSignal.ticker}
                  </span>
                  <span style={{ marginLeft: '1rem', fontWeight: '600', fontSize: '1.1rem' }}>
                    ${formatFloat(selectedSignal.price)}
                  </span>
                </div>
              </div>

              <div className="drawer-section">
                <span className="drawer-section-label">Scanned Date</span>
                <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icons.Clock size={14} className="trend-neutral" />
                  {formatTimestamp(selectedSignal.timestamp)}
                </div>
              </div>
              
              <div className="drawer-section">
                <span className="drawer-section-label">News Headline</span>
                <p className="drawer-headline">{selectedSignal.headline}</p>
              </div>

              <div className="drawer-section">
                <span className="drawer-section-label">Sentiment Score</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {getSentimentPill(selectedSignal.sentiment_score)}
                  <span style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: '700' }}>
                    {selectedSignal.sentiment_score > 0 ? "+" : ""}{formatFloat(selectedSignal.sentiment_score)}
                  </span>
                </div>
              </div>
              
              <div className="drawer-section">
                <span className="drawer-section-label">AI Reasoning & Analysis</span>
                <p className="drawer-explanation-box">
                  {selectedSignal.explanation || "No explanation provided."}
                </p>
              </div>

              {selectedSignal.option_strategy && selectedSignal.option_strategy.type !== "N/A" && (
                <div className="drawer-section">
                  {getOptionStrategyDrawerBlock(selectedSignal.option_strategy)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Politician Trade Row detail drawer/modal */}
      <div 
        className={`drawer-backdrop ${selectedTrade ? "open" : ""}`}
        onClick={() => setSelectedTrade(null)}
      >
        <div 
          className="drawer-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="drawer-header">
            <h2 className="drawer-title">Congressional Trade Details</h2>
            <button className="drawer-close" onClick={() => setSelectedTrade(null)}>&times;</button>
          </div>
          
          {selectedTrade && (
            <div className="drawer-body">
              <div className="drawer-section">
                <span className="drawer-section-label">Politician</span>
                <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {selectedTrade.filer_name}
                  <div style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {selectedTrade.chamber === 'senate' ? 'U.S. Senator' : 'U.S. Representative'} • {selectedTrade.state} ({selectedTrade.party === 'R' ? 'Republican' : selectedTrade.party === 'D' ? 'Democrat' : 'Independent'})
                  </div>
                </div>
              </div>

              <div className="drawer-section">
                <span className="drawer-section-label">Asset Traded</span>
                <div>
                  {selectedTrade.ticker && (
                    <span className="badge badge-aapl" style={{ fontSize: '0.9rem', padding: '0.35rem 0.75rem', marginRight: '0.75rem' }}>
                      {selectedTrade.ticker}
                    </span>
                  )}
                  <span style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {selectedTrade.asset_name}
                  </span>
                </div>
              </div>

              <div className="drawer-section">
                <span className="drawer-section-label">Transaction Type</span>
                <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                  <span className={selectedTrade.transaction_type === 'Purchase' ? 'tx-buy' : selectedTrade.transaction_type === 'Sale' ? 'tx-sell' : ''}>
                    {selectedTrade.transaction_type}
                  </span>
                </div>
              </div>

              <div className="drawer-section">
                <span className="drawer-section-label">Transaction Size Range</span>
                <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {selectedTrade.amount_range || "N/A"}
                </div>
              </div>

              <div className="drawer-section">
                <span className="drawer-section-label">Filing Dates</span>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <p>Traded On: <strong style={{ color: 'var(--text-primary)' }}>{selectedTrade.transaction_date}</strong></p>
                  <p>Disclosed On: <strong style={{ color: 'var(--text-primary)' }}>{selectedTrade.filing_date}</strong></p>
                </div>
              </div>

              {selectedTrade.option_strategy && selectedTrade.option_strategy.type !== "N/A" && (
                <div className="drawer-section">
                  {getOptionStrategyDrawerBlock(selectedTrade.option_strategy)}
                </div>
              )}

              {selectedTrade.doc_url && (
                <div className="drawer-section" style={{ marginTop: '1rem' }}>
                  <span className="drawer-section-label">Original Disclosure Document</span>
                  <div>
                    <a 
                      href={selectedTrade.doc_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-primary"
                      style={{ fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}
                    >
                      <Icons.BookOpen size={16} /> View Official PDF/Filing
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Technical Analysis & Chart detail drawer/modal */}
      <div 
        className={`drawer-backdrop ${selectedAnalysisStock ? "open" : ""}`}
        onClick={() => setSelectedAnalysisStock(null)}
      >
        <div 
          className="drawer-content"
          style={{ maxWidth: '650px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="drawer-header">
            <h2 className="drawer-title">{selectedAnalysisStock?.ticker} Chart & Quantitative Analytics</h2>
            <button className="drawer-close" onClick={() => setSelectedAnalysisStock(null)}>&times;</button>
          </div>
          
          {selectedAnalysisStock && (
            <StockAnalysisDrawerContent 
              stock={selectedAnalysisStock} 
              formatFloat={formatFloat}
              getSignalBadge={getSignalBadge}
              getOptionStrategyDrawerBlock={getOptionStrategyDrawerBlock}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Render the application to DOM
const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
