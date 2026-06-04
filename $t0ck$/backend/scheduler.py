import time
import logging
import threading
from datetime import datetime, timezone, timedelta
import json
import urllib.request
import ssl
import yfinance as yf
import pandas as pd
from database import (
    save_signal, 
    get_db_connection, 
    save_politician_trade, 
    get_active_politician_tickers,
    prune_old_data,
    save_stock_analysis,
    get_sector_for_ticker
)
from gemini_client import analyze_sentiment

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Fallback base tickers to always track
DEFAULT_TICKERS = [
    # Baseline & AI Giants
    "AAPL", "TSLA", "MSFT", "NVDA", "GOOGL", "META", "AMZN",
    # Data Centers & AI Infrastructure
    "AVGO", "SMCI", "ANET", "VRT",
    # Nuclear Energy & AI Power
    "SMR", "OKLO", "CEG", "VST",
    # Crypto & Finance
    "MSTR", "COIN", "JPM", "GS", "BAC", "BTC-USD", "ETH-USD",
    # Healthcare & Biotech
    "LLY", "UNH",
    # Energy, Retail & Industrials
    "XOM", "CVX", "WMT", "CAT"
]

def get_tracked_tickers() -> list:
    """Combines default tickers with the most active tickers traded by politicians."""
    try:
        active = get_active_politician_tickers(limit=10)
        tickers = list(DEFAULT_TICKERS)
        for t in active:
            if t not in tickers:
                tickers.append(t)
        return tickers
    except Exception as e:
        logger.error(f"Error fetching active politician tickers: {e}")
        return DEFAULT_TICKERS

def get_stock_price(ticker_symbol: str) -> float:
    """Fetches the current price of a ticker with robust fallbacks."""
    ticker = yf.Ticker(ticker_symbol)
    try:
        price = ticker.fast_info.get('lastPrice', None)
        if price is not None:
            return float(price)
    except Exception as e:
        logger.warning(f"Failed to fetch fast_info price for {ticker_symbol}: {e}")
        
    try:
        hist = ticker.history(period="1d")
        if not hist.empty:
            return float(hist['Close'].iloc[-1])
    except Exception as e:
        logger.error(f"Failed to fetch history price for {ticker_symbol}: {e}")
        
    # Standard realistic default pricing for fallback
    defaults = {"AAPL": 180.50, "TSLA": 175.20}
    return defaults.get(ticker_symbol, 100.0)

def fetch_and_process_news(ticker_symbol: str, current_price: float) -> int:
    """
    Fetches recent news for a ticker, filters out already parsed articles,
    analyzes sentiment, and saves them to the database.
    Returns the number of new articles processed.
    """
    ticker = yf.Ticker(ticker_symbol)
    try:
        news_items = ticker.news
    except Exception as e:
        logger.error(f"Failed to fetch news for {ticker_symbol}: {e}")
        return 0
        
    if not news_items:
        logger.info(f"No news articles found for {ticker_symbol}.")
        return 0

    new_signals_count = 0
    conn = get_db_connection()
    try:
        # Process up to 8 of the latest news items
        for item in news_items[:8]:
            try:
                content = item.get("content", {})
                headline = content.get("title", "").strip()
                
                if not headline:
                    continue

                # Standardize timestamp to ISO format
                pub_date = content.get("pubDate") or content.get("displayTime")
                if pub_date:
                    # Keep it as is or parse if needed. ISO format is best.
                    timestamp = pub_date
                else:
                    timestamp = datetime.now(timezone.utc).isoformat()

                # Check if this headline already exists in database
                cursor = conn.execute("SELECT 1 FROM signals WHERE headline = ?", (headline,))
                if cursor.fetchone():
                    # Already exists, skip
                    continue

                # This is a new headline, process with Gemini Flash API
                logger.info(f"Analyzing new headline for {ticker_symbol}: {headline[:50]}...")
                sentiment, explanation = analyze_sentiment(headline, ticker_symbol)
                
                # Save to SQLite
                saved = save_signal(
                    ticker=ticker_symbol,
                    price=current_price,
                    headline=headline,
                    sentiment_score=sentiment,
                    explanation=explanation,
                    timestamp=timestamp
                )
                if saved:
                    new_signals_count += 1
                    logger.info(f"Successfully stored signal for {ticker_symbol}: {sentiment}")
            except Exception as e:
                logger.error(f"Error processing news item: {e}")
                continue
    finally:
        conn.close()
            
    return new_signals_count

def fetch_and_process_politician_trades() -> int:
    """
    Fetches the latest Congressional stock trades from the raw GitHub JSON,
    filters them, and saves new ones to SQLite.
    Returns the number of new transactions saved.
    """
    url = "https://raw.githubusercontent.com/kadoa-org/congress-trading-monitor/main/public/data/trades.json"
    logger.info("Fetching Congressional stock disclosures...")
    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context) as response:
            raw_data = response.read()
            trades = json.loads(raw_data.decode('utf-8'))
    except Exception as e:
        logger.error(f"Failed to fetch Congressional stock trades: {e}")
        return 0

    new_trades_count = 0
    # Process the latest 200 trades (to keep it fast and responsive)
    # The JSON is sorted descending by transaction/filing date
    for trade in trades[:200]:
        # We only save if there is a ticker symbol
        ticker = trade.get("ticker")
        if not ticker or not isinstance(ticker, str) or not ticker.isalnum():
            continue
            
        # Clean up ticker
        trade["ticker"] = ticker.upper().strip()
        
        # Save to database
        saved = save_politician_trade(trade)
        if saved:
            new_trades_count += 1
            
    # Run database pruning to ensure strict compliance with the 4-day maximum limit
    prune_old_data()
    logger.info(f"Congressional trades updated. Added {new_trades_count} new trades.")
    return new_trades_count

def calculate_rsi(prices_series: pd.Series, period: int = 14) -> float:
    """Calculates the Relative Strength Index (RSI) using Wilder's smoothed method."""
    if len(prices_series) <= period:
        return None
    try:
        delta = prices_series.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        
        avg_gain = gain.ewm(com=period - 1, adjust=False).mean()
        avg_loss = loss.ewm(com=period - 1, adjust=False).mean()
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        val = rsi.iloc[-1]
        return float(val) if not pd.isna(val) else None
    except Exception as e:
        logger.error(f"Error calculating RSI: {e}")
        return None

def get_ticker_trade_and_sentiment_stats(ticker: str) -> tuple:
    """Retrieves buy_count, sell_count, and avg_sentiment from the database for a ticker."""
    conn = get_db_connection()
    try:
        # 60-day threshold for politician trades
        threshold_date = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
        cursor = conn.execute(
            """
            SELECT 
                SUM(CASE WHEN transaction_type = 'Purchase' THEN 1 ELSE 0 END) as buy_count,
                SUM(CASE WHEN transaction_type LIKE 'Sale%' THEN 1 ELSE 0 END) as sell_count
            FROM politician_trades
            WHERE ticker = ? AND transaction_date >= ?
            """,
            (ticker, threshold_date)
        )
        row = cursor.fetchone()
        buy_count = row[0] if row and row[0] is not None else 0
        sell_count = row[1] if row and row[1] is not None else 0
        
        # Avg sentiment from signals
        cursor = conn.execute(
            "SELECT AVG(sentiment_score) FROM signals WHERE ticker = ?",
            (ticker,)
        )
        row = cursor.fetchone()
        avg_sentiment = row[0] if row and row[0] is not None else 0.0
        
        return buy_count, sell_count, avg_sentiment
    except Exception as e:
        logger.error(f"Error fetching ticker database stats for {ticker}: {e}")
        return 0, 0, 0.0
    finally:
        conn.close()

def compute_synthesis_signal(buy_count: int, sell_count: int, avg_news_sentiment: float, rsi: float, price: float, sma_50: float, sma_200: float, peg_ratio: float, pe_ratio: float = None, ticker: str = None) -> str:
    """Computes a quantitative weighted synthesis recommendation signal."""
    # 1. Political score
    net_buys = buy_count - sell_count
    # Limit extreme outliers from single stocks
    political_score = max(min(0.5 * net_buys, 2.0), -2.0)
    
    # 2. Sentiment score
    sentiment_score = 2.0 * avg_news_sentiment
    
    # 3. Technical score
    technical_score = 0.0
    if rsi is not None:
        if rsi < 25:
            technical_score += 2.0  # Extremely oversold (highly bullish reversal potential)
        elif rsi < 35:
            technical_score += 1.0  # Oversold (bullish)
        elif rsi > 75:
            technical_score -= 2.0  # Extremely overbought (highly bearish pullback potential)
        elif rsi > 65:
            technical_score -= 1.0  # Overbought (bearish)
            
    if price and sma_50 and sma_200:
        if sma_50 > sma_200:
            # Bullish Golden Cross structural trend
            technical_score += 0.5
            if price > sma_50:
                technical_score += 1.0  # Above 50 SMA (short-term uptrend)
        else:
            # Bearish Death Cross structural trend
            technical_score -= 0.5
            if price < sma_50:
                technical_score -= 1.0  # Below 50 SMA (short-term downtrend)
            
    # 4. Fundamental valuation score (PEG & P/E Ratios)
    fundamental_score = 0.0
    if peg_ratio is not None:
        if 0.0 < peg_ratio < 1.0:
            fundamental_score += 1.5  # Undervalued relative to growth (bullish)
        elif 1.0 <= peg_ratio < 1.5:
            fundamental_score += 0.5  # Fairly valued relative to growth
        elif peg_ratio > 2.0:
            fundamental_score -= 1.5  # Overvalued relative to growth (bearish)
            
    if pe_ratio is not None and ticker:
        sector = get_sector_for_ticker(ticker)
        pe_benchmarks = {
            "Technology": 30.0,
            "Financial Services": 16.0,
            "Energy": 18.0,
            "Healthcare": 22.0,
            "Industrials": 20.0,
            "Consumer Cyclical": 22.0,
            "Consumer Defensive": 18.0,
            "Communication Services": 22.0,
            "Real Estate": 20.0,
            "Cryptocurrency": 35.0,
            "Other": 20.0
        }
        benchmark = pe_benchmarks.get(sector, 20.0)
        if pe_ratio <= 0.0:
            pass
        elif pe_ratio < benchmark * 0.7:
            fundamental_score += 1.0  # Significantly undervalued relative to sector
        elif pe_ratio < benchmark:
            fundamental_score += 0.5  # Moderately undervalued relative to sector
        elif pe_ratio > benchmark * 1.5:
            fundamental_score -= 1.0  # Overvalued relative to sector
            
    total_score = political_score + sentiment_score + technical_score + fundamental_score
    
    if total_score >= 1.75:
        return "Strong Buy"
    elif total_score >= 0.75:
        return "Buy"
    elif total_score <= -1.75:
        return "Strong Sell"
    elif total_score <= -0.75:
        return "Sell"
    else:
        return "Hold"

def run_update_cycle() -> dict:
    """Runs a single manual update cycle for dynamic tickers and returns stats."""
    start_time = time.time()
    results = {}
    total_new = 0
    
    tickers = get_tracked_tickers()
    logger.info(f"Running update cycle for tickers: {tickers}")
    
    for ticker in tickers:
        price = get_stock_price(ticker)
        new_count = fetch_and_process_news(ticker, price)
        total_new += new_count
        
        # Perform technical and fundamental analysis
        try:
            t = yf.Ticker(ticker)
            # Fetch 6 months of daily candles
            hist = t.history(period="1y")
            rsi = None
            sma_50 = None
            sma_200 = None
            
            if not hist.empty and len(hist) >= 50:
                close_prices = hist['Close']
                rsi = calculate_rsi(close_prices)
                sma_50 = float(close_prices.rolling(window=50).mean().iloc[-1])
                if len(hist) >= 200:
                    sma_200 = float(close_prices.rolling(window=200).mean().iloc[-1])
                    
            # Fetch fundamental stats from yfinance info dictionary
            info = t.info
            peg_ratio = info.get("pegRatio")
            pe_ratio = info.get("trailingPE")
            
            if peg_ratio is not None:
                peg_ratio = float(peg_ratio)
            if pe_ratio is not None:
                pe_ratio = float(pe_ratio)
                
            # Fetch trade and sentiment stats from database
            buy_count, sell_count, avg_sentiment = get_ticker_trade_and_sentiment_stats(ticker)
            
            # Compute quantitative synthesis signal
            recommendation = compute_synthesis_signal(
                buy_count=buy_count,
                sell_count=sell_count,
                avg_news_sentiment=avg_sentiment,
                rsi=rsi,
                price=price,
                sma_50=sma_50,
                sma_200=sma_200,
                peg_ratio=peg_ratio,
                pe_ratio=pe_ratio,
                ticker=ticker
            )
            
            # Save analysis results to database
            save_stock_analysis(
                ticker=ticker,
                price=price,
                rsi=rsi,
                sma_50=sma_50,
                sma_200=sma_200,
                peg_ratio=peg_ratio,
                pe_ratio=pe_ratio,
                recommendation=recommendation
            )
            logger.info(f"Analyzed {ticker}: Price={price}, RSI={rsi}, PEG={peg_ratio}, Signal={recommendation}")
            
        except Exception as e:
            logger.error(f"Failed to perform analysis for {ticker}: {e}")
            
        results[ticker] = {
            "price": price,
            "new_articles": new_count
        }
        
    duration = time.time() - start_time
    logger.info(f"Update cycle completed in {duration:.2f}s. New signals added: {total_new}")
    prune_old_data()
    return {
        "status": "success",
        "new_records": total_new,
        "ticker_data": results,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

def analyze_ticker_on_demand(ticker_symbol: str) -> dict:
    """
    Fetches the stock price, runs news/sentiment parsing,
    calculates RSI/SMAs/PEG/PE, computes synthesis signal,
    caches it in stock_analysis, and returns the analysis data.
    """
    ticker_symbol = ticker_symbol.upper().strip()
    t = yf.Ticker(ticker_symbol)
    
    price = None
    try:
        price = t.fast_info.get('lastPrice', None)
        if price is not None:
            price = float(price)
    except Exception:
        pass
        
    hist = None
    try:
        hist = t.history(period="1y")
    except Exception as e:
        logger.error(f"Failed to fetch history for on-demand ticker {ticker_symbol}: {e}")
        
    if (price is None or price <= 0) and (hist is None or hist.empty):
        return None
        
    if price is None or price <= 0:
        if not hist.empty:
            price = float(hist['Close'].iloc[-1])
        else:
            price = 100.0
            
    # Fetch news to populate signals
    try:
        fetch_and_process_news(ticker_symbol, price)
    except Exception as e:
        logger.error(f"Failed to fetch news for on-demand ticker {ticker_symbol}: {e}")
        
    rsi = None
    sma_50 = None
    sma_200 = None
    
    if hist is not None and not hist.empty and len(hist) >= 50:
        close_prices = hist['Close']
        rsi = calculate_rsi(close_prices)
        sma_50 = float(close_prices.rolling(window=50).mean().iloc[-1])
        if len(hist) >= 200:
            sma_200 = float(close_prices.rolling(window=200).mean().iloc[-1])
            
    peg_ratio = None
    pe_ratio = None
    try:
        info = t.info
        peg_ratio = info.get("pegRatio")
        pe_ratio = info.get("trailingPE")
        if peg_ratio is not None:
            peg_ratio = float(peg_ratio)
        if pe_ratio is not None:
            pe_ratio = float(pe_ratio)
    except Exception as e:
        logger.error(f"Failed to fetch fundamental info for on-demand ticker {ticker_symbol}: {e}")
        
    buy_count, sell_count, avg_sentiment = get_ticker_trade_and_sentiment_stats(ticker_symbol)
    
    recommendation = compute_synthesis_signal(
        buy_count=buy_count,
        sell_count=sell_count,
        avg_news_sentiment=avg_sentiment,
        rsi=rsi,
        price=price,
        sma_50=sma_50,
        sma_200=sma_200,
        peg_ratio=peg_ratio,
        pe_ratio=pe_ratio,
        ticker=ticker_symbol
    )
    
    save_stock_analysis(
        ticker=ticker_symbol,
        price=price,
        rsi=rsi,
        sma_50=sma_50,
        sma_200=sma_200,
        peg_ratio=peg_ratio,
        pe_ratio=pe_ratio,
        recommendation=recommendation
    )
    
    # Read back from database to get correct structure
    conn = get_db_connection()
    try:
        cursor = conn.execute("SELECT * FROM stock_analysis WHERE ticker = ?", (ticker_symbol,))
        row = cursor.fetchone()
        if row:
            return dict(row)
    finally:
        conn.close()
        
    return {
        "ticker": ticker_symbol,
        "price": price,
        "rsi": rsi,
        "sma_50": sma_50,
        "sma_200": sma_200,
        "peg_ratio": peg_ratio,
        "pe_ratio": pe_ratio,
        "recommendation": recommendation,
        "last_updated": datetime.now().isoformat()
    }

class BackgroundScheduler:
    """Manages the background loop running every 10 minutes and updating politician trades."""
    def __init__(self, interval_seconds: int = 600):
        self.interval = interval_seconds
        self.running = False
        self.thread = None
        
    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()
        logger.info("Background scheduler started successfully.")
        
    def stop(self):
        self.running = False
        logger.info("Background scheduler stopping...")

    def _loop(self):
        # Run initial update cycles on startup
        try:
            logger.info("Running initial database sync on startup.")
            fetch_and_process_politician_trades()
            run_update_cycle()
        except Exception as e:
            logger.error(f"Error during initial startup sync: {e}")
            
        # No periodic auto-sync. Updates are only triggered manually via the UI.
        while self.running:
            time.sleep(1)

# Global scheduler instance
scheduler = BackgroundScheduler()
