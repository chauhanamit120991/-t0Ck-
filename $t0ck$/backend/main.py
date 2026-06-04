import os
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables from .env file (if present)
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from database import init_db, get_all_signals, get_stats, get_recent_politician_trades, get_top_politician_stocks
from scheduler import scheduler, run_update_cycle, fetch_and_process_politician_trades

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger = app.extra.get("logger")
    if logger:
        logger.info("Initializing database...")
    init_db()
    
    # Start the background news parsing scheduler
    scheduler.start()
    yield
    # Shutdown actions
    scheduler.stop()

app = FastAPI(
    title="CapitalIntel Financial Intelligence API",
    description="Backend API serving stock market sentiment signals and background analytics",
    version="1.0.0",
    lifespan=lifespan
)

# Set up logging on app instance for lifecycle access
import logging
logging.basicConfig(level=logging.INFO)
app.extra["logger"] = logging.getLogger("api")

# CORS setup for local React/Vite development frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/api/signals")
async def read_signals(limit: int = 100):
    """Retrieves list of latest signals from the SQLite database."""
    try:
        signals = get_all_signals(limit=limit)
        return {"status": "success", "data": signals}
    except Exception as e:
        # TODO(security): Log detailed error system-side
        raise HTTPException(status_code=500, detail="Failed to fetch signals.")

@app.get("/api/stats")
async def read_stats():
    """Retrieves statistical aggregates of tracked stock tickers."""
    try:
        stats = get_stats()
        return {"status": "success", "data": stats}
    except Exception as e:
        # TODO(security): Log detailed error system-side
        raise HTTPException(status_code=500, detail="Failed to fetch statistics.")

@app.post("/api/refresh")
async def refresh_signals():
    """Triggers an immediate update cycle for stock prices/news AND politician trades."""
    try:
        # Sync politician trades first
        new_trades = fetch_and_process_politician_trades()
        # Run the stock price & news update cycle
        stats = run_update_cycle()
        stats["new_trades"] = new_trades
        return stats
    except Exception as e:
        # TODO(security): Log detailed error system-side in a production environment
        raise HTTPException(status_code=500, detail=f"Refresh failed: {str(e)}")

@app.get("/api/politician-trades")
async def read_politician_trades(limit: int = 100, ticker: str = None, party: str = None, tx_type: str = None, prominent_only: bool = True):
    """Retrieves list of latest politician stock trades from the SQLite database."""
    try:
        trades = get_recent_politician_trades(limit=limit, ticker=ticker, party=party, tx_type=tx_type, prominent_only=prominent_only)
        return {"status": "success", "data": trades}
    except Exception as e:
        # TODO(security): Log detailed error system-side in a production environment
        raise HTTPException(status_code=500, detail="Failed to fetch politician trades.")

@app.get("/api/politician-top-stocks")
async def read_politician_top_stocks(limit: int = 10, prominent_only: bool = True):
    """Retrieves the list of most bought stock tickers by politicians."""
    try:
        stocks = get_top_politician_stocks(limit=limit, prominent_only=prominent_only)
        return {"status": "success", "data": stocks}
    except Exception as e:
        # TODO(security): Log detailed error system-side in a production environment
        raise HTTPException(status_code=500, detail="Failed to fetch top politician stocks.")

@app.get("/api/stock-chart")
async def get_stock_chart(ticker: str):
    """Retrieves 6 months of historical daily stock candles for charting."""
    import re
    if not ticker or not isinstance(ticker, str) or not re.match(r"^[A-Za-z0-9\.\-^=]{1,20}$", ticker):
        raise HTTPException(status_code=400, detail="Invalid ticker symbol.")
    try:
        import yfinance as yf
        t = yf.Ticker(ticker.upper())
        hist = t.history(period="6mo")
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No chart data found for {ticker}")
        
        # Format for lightweight charts: array of objects with time (YYYY-MM-DD), open, high, low, close
        data = []
        for index, row in hist.iterrows():
            data.append({
                "time": index.strftime("%Y-%m-%d"),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": int(row["Volume"])
            })
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch chart data.")

@app.get("/api/stock-analysis")
async def get_stock_analysis_detail(ticker: str):
    """Retrieves the cached stock analysis (including RSI, SMA, etc.) for a specific ticker, fallback to on-demand calculation if not cached."""
    import re
    if not ticker or not isinstance(ticker, str) or not re.match(r"^[A-Za-z0-9\.\-^=]{1,20}$", ticker):
        raise HTTPException(status_code=400, detail="Invalid ticker symbol.")
    try:
        ticker_upper = ticker.upper().strip()
        from database import get_db_connection, calculate_option_recommendation, get_sector_for_ticker, calculate_long_short_signals
        
        conn = get_db_connection()
        data = None
        try:
            cursor = conn.execute("SELECT * FROM stock_analysis WHERE ticker = ?", (ticker_upper,))
            row = cursor.fetchone()
            if row:
                data = dict(row)
        finally:
            conn.close()
            
        if not data:
            from scheduler import analyze_ticker_on_demand
            data = analyze_ticker_on_demand(ticker_upper)
            
        if data:
            # Enrich with trade stats and option strategy
            from scheduler import get_ticker_trade_and_sentiment_stats
            buy_count, sell_count, avg_sentiment = get_ticker_trade_and_sentiment_stats(ticker_upper)
            
            # Fetch average transaction bounds if trade exists
            avg_amount_low = 0.0
            avg_amount_high = 0.0
            conn = get_db_connection()
            try:
                cursor_amt = conn.execute(
                    "SELECT AVG(amount_low), AVG(amount_high) FROM politician_trades WHERE ticker = ?",
                    (ticker_upper,)
                )
                row_amt = cursor_amt.fetchone()
                if row_amt:
                    avg_amount_low = row_amt[0] if row_amt[0] is not None else 0.0
                    avg_amount_high = row_amt[1] if row_amt[1] is not None else 0.0
            finally:
                conn.close()
                
            data["buy_count"] = buy_count
            data["sell_count"] = sell_count
            data["avg_news_sentiment"] = avg_sentiment
            data["avg_amount_low"] = avg_amount_low
            data["avg_amount_high"] = avg_amount_high
            data["sector"] = get_sector_for_ticker(ticker_upper)
            
            # Align key names to match expected top stocks / signals UI payload format
            data["last_price"] = data.get("price")
            data["signal"] = data.get("recommendation")
            
            # Compute long/short term recommendation breakdown details
            data = calculate_long_short_signals(data)
            
            # Option recommendation strategy contract
            data["option_strategy"] = calculate_option_recommendation(
                ticker=ticker_upper,
                price=data.get("price") or 0.0,
                recommendation=data.get("recommendation") or "Hold",
                sentiment_score=avg_sentiment,
                ref_date_str=None
            )
            return {"status": "success", "data": data}
        else:
            return {"status": "not_found", "data": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock analysis: {str(e)}")

@app.get("/api/market-trends/trending")
async def get_trending_tickers():
    """Fetches trending stock tickers from Yahoo Finance and downloads their details."""
    try:
        import urllib.request
        import ssl
        import json
        import yfinance as yf
        
        req = urllib.request.Request(
            "https://query1.finance.yahoo.com/v1/finance/trending/US",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        ctx = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=ctx) as r:
            data = json.loads(r.read().decode('utf-8'))
            symbols = [q['symbol'] for q in data['finance']['result'][0]['quotes']][:10]
            
        res = []
        for symbol in symbols:
            try:
                t = yf.Ticker(symbol)
                info = t.fast_info
                price = info.get('lastPrice') or 0.0
                prev_close = info.get('previousClose') or price
                change = price - prev_close
                change_percent = (change / prev_close * 100) if prev_close else 0.0
                
                name = symbol
                try:
                    name = t.info.get('shortName') or t.info.get('longName') or symbol
                except Exception:
                    pass
                
                res.append({
                    "symbol": symbol,
                    "name": name,
                    "price": price,
                    "change": change,
                    "change_percent": change_percent,
                    "market_cap": f"${info.get('marketCap')/1e9:.2f}B" if info.get('marketCap') else "N/A",
                    "volume": f"{info.get('lastVolume')/1e6:.2f}M" if info.get('lastVolume') else "N/A"
                })
            except Exception:
                res.append({
                    "symbol": symbol,
                    "name": symbol,
                    "price": 0.0,
                    "change": 0.0,
                    "change_percent": 0.0,
                    "market_cap": "N/A",
                    "volume": "N/A"
                })
        return {"status": "success", "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch trending tickers.")

@app.get("/api/market-trends/gainers")
async def get_top_gainers():
    """Fetches day gainers from Yahoo Finance screener endpoint."""
    try:
        import urllib.request
        import ssl
        import json
        
        req = urllib.request.Request(
            "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=true&scrIds=day_gainers",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        ctx = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=ctx) as r:
            data = json.loads(r.read().decode('utf-8'))
            quotes = data['finance']['result'][0].get('quotes', [])
            
        res = []
        for q in quotes[:10]:
            res.append({
                "symbol": q.get("symbol"),
                "name": q.get("shortName") or q.get("longName") or q.get("symbol"),
                "price": q.get("regularMarketPrice", {}).get("raw", 0.0),
                "change": q.get("regularMarketChange", {}).get("raw", 0.0),
                "change_percent": q.get("regularMarketChangePercent", {}).get("raw", 0.0),
                "market_cap": q.get("marketCap", {}).get("fmt", "N/A"),
                "volume": q.get("regularMarketVolume", {}).get("fmt", "N/A")
            })
        return {"status": "success", "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch top gainers.")

@app.get("/api/health")
async def health_check():
    """Simple API health check endpoint."""
    return {
        "status": "healthy",
        "scheduler_running": scheduler.running,
        "database_connected": True
    }
from fastapi.staticfiles import StaticFiles

# Serve static frontend files (must be mounted after API paths)
FRONTEND_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.exists(FRONTEND_PATH):
    app.mount("/", StaticFiles(directory=FRONTEND_PATH, html=True), name="frontend")
