import sqlite3
import os
from typing import List, Dict, Any
from datetime import datetime, timedelta


DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "market.db")

def get_db_connection():
    """Establishes and returns a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Enables access by column name
    return conn

def init_db():
    """Initializes the database and creates necessary tables if they do not exist."""
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS signals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                price REAL NOT NULL,
                headline TEXT UNIQUE NOT NULL,
                sentiment_score REAL NOT NULL,
                explanation TEXT,
                timestamp TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS politician_trades (
                id TEXT PRIMARY KEY,
                filer_name TEXT NOT NULL,
                chamber TEXT,
                party TEXT,
                state TEXT,
                ticker TEXT,
                asset_name TEXT,
                transaction_date TEXT NOT NULL,
                filing_date TEXT,
                transaction_type TEXT,
                amount_range TEXT,
                amount_low REAL,
                amount_high REAL,
                doc_url TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS stock_analysis (
                ticker TEXT PRIMARY KEY,
                price REAL NOT NULL,
                rsi REAL,
                sma_50 REAL,
                sma_200 REAL,
                peg_ratio REAL,
                pe_ratio REAL,
                recommendation TEXT,
                last_updated TEXT NOT NULL
            )
        """)
        conn.commit()
    seed_mock_data()
    # Prune old data on initialization to maintain strict 2-4 day limit (4 days max)
    prune_old_data()

def seed_mock_data():
    """Seeds a few mock politician trades in the last 2 days to demonstrate functionality when the raw feed is outdated."""
    today = datetime.now()
    date_1 = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    date_2 = (today - timedelta(days=2)).strftime("%Y-%m-%d")
    
    mock_trades = [
        ("mock_1", "Nancy Pelosi", "senate", "D", "CA", "NVDA", "NVIDIA Corporation Common Stock", date_1, date_1, "Purchase", "$500,001 - $1,000,000", 500001, 1000000, "https://disclosures-clerk.house.gov/"),
        ("mock_2", "Tommy Tuberville", "senate", "R", "AL", "TSLA", "Tesla Inc. Common Stock", date_1, date_1, "Purchase", "$100,001 - $250,000", 100001, 250000, "https://disclosures-clerk.house.gov/"),
        ("mock_3", "Michael McCaul", "house", "R", "TX", "MSFT", "Microsoft Corporation Common Stock", date_2, date_2, "Purchase", "$50,001 - $100,000", 50001, 100000, "https://disclosures-clerk.house.gov/"),
        ("mock_4", "Ro Khanna", "house", "D", "CA", "AAPL", "Apple Inc. Common Stock", date_2, date_2, "Purchase", "$15,001 - $50,000", 15001, 50000, "https://disclosures-clerk.house.gov/"),
        ("mock_5", "Josh Gottheimer", "house", "D", "NJ", "GOOGL", "Alphabet Inc. Common Stock", date_1, date_1, "Purchase", "$1,001 - $15,000", 1001, 15000, "https://disclosures-clerk.house.gov/"),
        ("mock_6", "Nancy Pelosi", "senate", "D", "CA", "AAPL", "Apple Inc. Common Stock", date_1, date_1, "Sale (Full)", "$100,001 - $250,000", 100001, 250000, "https://disclosures-clerk.house.gov/"),
    ]
    
    try:
        with get_db_connection() as conn:
            # Check if empty
            cursor = conn.execute("SELECT COUNT(*) FROM politician_trades;")
            count = cursor.fetchone()[0]
            if count == 0:
                conn.executemany(
                    """
                    INSERT OR IGNORE INTO politician_trades (
                        id, filer_name, chamber, party, state, ticker, asset_name,
                        transaction_date, filing_date, transaction_type, amount_range,
                        amount_low, amount_high, doc_url
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    mock_trades
                )
                conn.commit()
                print("Mock politician trades seeded successfully.")
    except Exception as e:
        print(f"Error seeding mock data: {e}")

def prune_old_data(days_limit: int = 5):
    """Deletes politician trades, news signals, and cached analyses older than `days_limit` days relative to current time."""
    threshold_datetime = datetime.now() - timedelta(days=days_limit)
    threshold_date_str = threshold_datetime.strftime("%Y-%m-%d")
    threshold_iso = threshold_datetime.isoformat()
    
    try:
        with get_db_connection() as conn:
            cursor1 = conn.execute("DELETE FROM politician_trades WHERE transaction_date < ?", (threshold_date_str,))
            cursor2 = conn.execute("DELETE FROM signals WHERE timestamp < ?", (threshold_iso,))
            cursor3 = conn.execute("DELETE FROM stock_analysis WHERE last_updated < ?", (threshold_iso,))
            conn.commit()
    except Exception as e:
        print(f"Error pruning database: {str(e)}")

def save_stock_analysis(ticker: str, price: float, rsi: float, sma_50: float, sma_200: float, peg_ratio: float, pe_ratio: float, recommendation: str) -> bool:
    """Saves or updates technical and fundamental indicators for a ticker."""
    init_db()
    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO stock_analysis (ticker, price, rsi, sma_50, sma_200, peg_ratio, pe_ratio, recommendation, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(ticker) DO UPDATE SET
                    price=excluded.price,
                    rsi=excluded.rsi,
                    sma_50=excluded.sma_50,
                    sma_200=excluded.sma_200,
                    peg_ratio=excluded.peg_ratio,
                    pe_ratio=excluded.pe_ratio,
                    recommendation=excluded.recommendation,
                    last_updated=excluded.last_updated
                """,
                (
                    ticker.upper().strip(),
                    price,
                    rsi,
                    sma_50,
                    sma_200,
                    peg_ratio,
                    pe_ratio,
                    recommendation,
                    datetime.now().isoformat()
                )
            )
            conn.commit()
            return True
    except Exception as e:
        print(f"Error saving stock analysis for {ticker}: {str(e)}")
        return False

def save_signal(ticker: str, price: float, headline: str, sentiment_score: float, explanation: str, timestamp: str) -> bool:
    """
    Saves a financial signal to the database.
    Returns True if saved successfully, False if it was a duplicate headline.
    """
    init_db()  # Ensure table exists
    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO signals (ticker, price, headline, sentiment_score, explanation, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (ticker, price, headline, sentiment_score, explanation, timestamp)
            )
            conn.commit()
            return True
    except sqlite3.IntegrityError:
        # Expected if headline violates UNIQUE constraint
        return False
    except Exception as e:
        # Log error securely without exposing sensitive details
        # TODO(security): Log detailed error system-side in a production environment
        print(f"Error saving signal: {str(e)}")
        return False

def get_all_signals(limit: int = 100) -> List[Dict[str, Any]]:
    """Retrieves all signals sorted by timestamp descending, joining the latest stock analysis recommendation."""
    init_db()
    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            SELECT s.id, s.ticker, s.price, s.headline, s.sentiment_score, s.explanation, s.timestamp,
                   a.recommendation, a.rsi, a.sma_50, a.sma_200, a.peg_ratio, a.pe_ratio, a.price as last_price
            FROM signals s
            LEFT JOIN stock_analysis a ON s.ticker = a.ticker
            ORDER BY s.timestamp DESC LIMIT ?
            """,
            (limit,)
        )
        results = []
        for row in cursor.fetchall():
            d = dict(row)
            d["option_strategy"] = calculate_option_recommendation(
                ticker=d.get("ticker"),
                price=d.get("price"),
                recommendation=d.get("recommendation"),
                sentiment_score=d.get("sentiment_score"),
                ref_date_str=d.get("timestamp")
            )
            results.append(d)
        return results

def get_stats() -> Dict[str, Any]:
    """Computes basic financial signals statistics."""
    init_db()
    with get_db_connection() as conn:
        # Total counts and averages
        cursor = conn.execute("SELECT COUNT(*), AVG(sentiment_score) FROM signals")
        total_count, avg_sentiment = cursor.fetchone()
        
        # Ticker breakdowns
        cursor = conn.execute("SELECT ticker, COUNT(*), AVG(sentiment_score), AVG(price) FROM signals GROUP BY ticker")
        ticker_breakdown = {}
        for row in cursor.fetchall():
            ticker_breakdown[row[0]] = {
                "count": row[1],
                "avg_sentiment": row[2] if row[2] is not None else 0.0,
                "avg_price": row[3] if row[3] is not None else 0.0
            }
            
        return {
            "total_count": total_count,
            "avg_sentiment": avg_sentiment if avg_sentiment is not None else 0.0,
            "tickers": ticker_breakdown
        }

def save_politician_trade(trade_data: dict) -> bool:
    """
    Saves a politician stock trade to the database.
    Returns True if saved successfully, False if it was already in the database.
    """
    init_db()
    
    # Restrict to last 5 days (not more than that)
    trade_date_str = trade_data.get("transaction_date")
    if trade_date_str:
        try:
            trade_date = datetime.strptime(trade_date_str, "%Y-%m-%d")
            # Clear time part for accurate date comparison
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            if trade_date < today - timedelta(days=5):
                return False
        except Exception:
            pass

    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO politician_trades (
                    id, filer_name, chamber, party, state, ticker, asset_name,
                    transaction_date, filing_date, transaction_type, amount_range,
                    amount_low, amount_high, doc_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    trade_data.get("id"),
                    trade_data.get("filer_name"),
                    trade_data.get("chamber"),
                    trade_data.get("party"),
                    trade_data.get("state"),
                    trade_data.get("ticker"),
                    trade_data.get("asset_name"),
                    trade_data.get("transaction_date"),
                    trade_data.get("filing_date"),
                    trade_data.get("transaction_type"),
                    trade_data.get("amount_range_label"),
                    trade_data.get("amount_range_low"),
                    trade_data.get("amount_range_high"),
                    trade_data.get("doc_url")
                )
            )
            conn.commit()
            return True
    except sqlite3.IntegrityError:
        return False
    except Exception as e:
        # TODO(security): Log detailed error system-side in a production environment
        print(f"Error saving politician trade: {str(e)}")
        return False

PROMINENT_PATTERNS = [
    "%Pelosi%", "%Khanna%", "%McCaul%", "%Tuberville%", "%Gottheimer%", 
    "%Blumenthal%", "%Shreve%", "%Justice%", "%Rick%Scott%", "%Romney%", 
    "%McCormick%", "%Marjorie%Greene%", "%Crenshaw%", "%Whitehouse%", 
    "%Mark%Green%", "%Frankel%", "%Rutherford%", "%Susie%Lee%", "%Blumenauer%"
]

def get_recent_politician_trades(limit: int = 100, ticker: str = None, party: str = None, tx_type: str = None, prominent_only: bool = True) -> List[Dict[str, Any]]:
    """Retrieves recent politician trades, sorted by transaction_date descending, joining stock analysis recommendations."""
    init_db()
    
    threshold_date_str = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
    query = """
        SELECT t.id, t.filer_name, t.chamber, t.party, t.state, t.ticker, t.asset_name,
               t.transaction_date, t.filing_date, t.transaction_type, t.amount_range,
               t.amount_low, t.amount_high, t.doc_url,
               a.recommendation, a.price as last_price,
               a.rsi, a.sma_50, a.sma_200, a.peg_ratio, a.pe_ratio
        FROM politician_trades t
        LEFT JOIN stock_analysis a ON t.ticker = a.ticker
        WHERE t.transaction_date >= ?
    """
    params = [threshold_date_str]
    
    # Filter by prominent figures if prominent_only is True
    if prominent_only:
        like_clauses = " AND (" + " OR ".join(["t.filer_name LIKE ?" for _ in PROMINENT_PATTERNS]) + ")"
        query += like_clauses
        params.extend(PROMINENT_PATTERNS)

    # Input validation & sanitization check
    import re
    if ticker and isinstance(ticker, str) and re.match(r"^[A-Za-z0-9\.\-^=]{1,20}$", ticker):
        query += " AND t.ticker = ?"
        params.append(ticker.upper())
    if party and isinstance(party, str) and party.isalpha() and len(party) == 1:
        query += " AND t.party = ?"
        params.append(party.upper())
    if tx_type and isinstance(tx_type, str) and tx_type in ("Purchase", "Sale", "Exchange"):
        query += " AND t.transaction_type = ?"
        params.append(tx_type)
        
    query += " ORDER BY transaction_date DESC, filing_date DESC LIMIT ?"
    # Input validation for limit to prevent injection or negative/outsized queries
    try:
        limit_val = min(max(int(limit), 1), 500)
    except (ValueError, TypeError):
        limit_val = 100
        
    params.append(limit_val)
    
    with get_db_connection() as conn:
        cursor = conn.execute(query, params)
        results = []
        for row in cursor.fetchall():
            d = dict(row)
            d["option_strategy"] = calculate_option_recommendation(
                ticker=d.get("ticker"),
                price=d.get("last_price") or 0.0,
                recommendation=d.get("recommendation"),
                sentiment_score=None,
                ref_date_str=d.get("transaction_date")
            )
            results.append(d)
        return results

SECTOR_MAP = {
    "AAPL": "Technology", "MSFT": "Technology", "NVDA": "Technology", "AMD": "Technology",
    "AVGO": "Technology", "GOOGL": "Technology", "META": "Technology", "NFLX": "Technology",
    "SMCI": "Technology", "ANET": "Technology",
    "JPM": "Financial Services", "GS": "Financial Services", "V": "Financial Services",
    "MA": "Financial Services", "BAC": "Financial Services", "MS": "Financial Services",
    "MSTR": "Financial Services", "COIN": "Financial Services",
    "TSLA": "Consumer Cyclical", "HD": "Consumer Cyclical", "AMZN": "Consumer Cyclical",
    "WMT": "Consumer Defensive",
    "T": "Communication Services", "VZ": "Communication Services",
    "XOM": "Energy", "CVX": "Energy", "SHEL": "Energy", "BP": "Energy",
    "SMR": "Energy", "OKLO": "Energy", "CEG": "Energy", "VST": "Energy",
    "PH": "Industrials", "GE": "Industrials", "CAT": "Industrials", "HON": "Industrials",
    "VRT": "Industrials",
    "SPG": "Real Estate", "PLD": "Real Estate", "AMT": "Real Estate",
    "MEDP": "Healthcare", "LLY": "Healthcare", "UNH": "Healthcare", "JNJ": "Healthcare",
    "PFE": "Healthcare", "ABBV": "Healthcare", "MRK": "Healthcare",
    "BTC-USD": "Cryptocurrency", "ETH-USD": "Cryptocurrency"
}

def get_sector_for_ticker(ticker: str) -> str:
    """Resolves the industry sector for a given stock ticker with local cache and dynamic fallback."""
    if not ticker or not isinstance(ticker, str):
        return "Other"
    ticker_upper = ticker.upper().strip()
    if ticker_upper in SECTOR_MAP:
        return SECTOR_MAP[ticker_upper]
    try:
        import yfinance as yf
        t = yf.Ticker(ticker_upper)
        sector = t.info.get("sector")
        if sector:
            if "Technology" in sector: return "Technology"
            if "Financial" in sector: return "Financial Services"
            if "Energy" in sector: return "Energy"
            if "Healthcare" in sector: return "Healthcare"
            if "Industrial" in sector: return "Industrials"
            if "Real Estate" in sector: return "Real Estate"
            if "Communication" in sector: return "Communication Services"
            if "Consumer Cyclical" in sector: return "Consumer Cyclical"
            return sector
    except Exception:
        pass
    return "Other"

def get_investment_signal(buy_count: int, sell_count: int, avg_sentiment: float) -> str:
    """Computes a rule-based Buy/Sell recommendation signal based on politician trading and sentiment."""
    net_buys = buy_count - sell_count
    
    if net_buys >= 2 and avg_sentiment > 0.1:
        return "Strong Buy"
    elif net_buys >= 1 or (net_buys == 0 and avg_sentiment > 0.15):
        return "Buy"
    elif net_buys <= -2 and avg_sentiment < -0.1:
        return "Strong Sell"
    elif net_buys <= -1 or (net_buys == 0 and avg_sentiment < -0.15):
        return "Sell"
    else:
        return "Hold"

def calculate_option_recommendation(ticker: str, price: float, recommendation: str, sentiment_score: float = None, ref_date_str: str = None) -> dict:
    """
    Calculates option strategy recommendation based on stock price, overall recommendation, and optional sentiment.
    """
    if not ticker or "USD" in ticker.upper() or "-" in ticker:
        return {
            "type": "N/A",
            "strike": 0.0,
            "expiration": "N/A",
            "premium": 0.0,
            "amount": 0.0
        }
        
    if not price or price <= 0:
        return {
            "type": "N/A",
            "strike": 0.0,
            "expiration": "N/A",
            "premium": 0.0,
            "amount": 0.0
        }

    opt_type = "Hold"
    if recommendation in ["Strong Buy", "Buy"]:
        if sentiment_score is not None and sentiment_score < -0.15:
            opt_type = "Hold"
        else:
            opt_type = "Call"
    elif recommendation in ["Strong Sell", "Sell"]:
        if sentiment_score is not None and sentiment_score > 0.15:
            opt_type = "Hold"
        else:
            opt_type = "Put"

    if opt_type == "Call":
        # Refined strike based on recommendation strength
        if recommendation == "Strong Buy":
            offset = 1.06  # 6% out of the money
            premium_pct = 0.025  # Premium is cheaper further out of the money
        else:
            offset = 1.03  # 3% out of the money
            premium_pct = 0.04  # Premium is more expensive closer to the money
        strike = round(price * offset)
        if strike == round(price):
            strike += 1.0
        premium = round(price * premium_pct, 2)
    elif opt_type == "Put":
        # Refined strike based on recommendation strength
        if recommendation == "Strong Sell":
            offset = 0.94  # 6% out of the money
            premium_pct = 0.02  # Premium is cheaper further out of the money
        else:
            offset = 0.97  # 3% out of the money
            premium_pct = 0.035  # Premium is more expensive closer to the money
        strike = round(price * offset)
        if strike == round(price):
            strike -= 1.0
        premium = round(price * premium_pct, 2)
    else:
        return {
            "type": "Hold",
            "strike": 0.0,
            "expiration": "N/A",
            "premium": 0.0,
            "amount": 0.0
        }

    ref_dt = None
    if ref_date_str:
        try:
            if "T" in ref_date_str:
                ref_dt = datetime.fromisoformat(ref_date_str.split(".")[0])
            else:
                ref_dt = datetime.strptime(ref_date_str.strip(), "%Y-%m-%d")
        except Exception:
            pass
            
    if not ref_dt:
        ref_dt = datetime.now()

    # Find the Friday of the week ~30 days out for standard monthly options
    target_dt = ref_dt + timedelta(days=30)
    days_to_friday = (4 - target_dt.weekday()) % 7
    exp_dt = target_dt + timedelta(days=days_to_friday)
    expiration_str = exp_dt.strftime("%Y-%m-%d 16:00")
    amount = round(premium * 100, 2)

    return {
        "type": opt_type,
        "strike": float(strike),
        "expiration": expiration_str,
        "premium": premium,
        "amount": amount
    }

def calculate_long_short_signals(d: dict) -> dict:
    """
    Computes distinct short-term momentum/sentiment and long-term value/growth
    recommendations based on technical indicators, news sentiment, politician activity,
    and financial ratios (P/E, PEG).
    """
    price = d.get('last_price') or 0.0
    rsi = d.get('rsi')
    sma_50 = d.get('sma_50')
    sma_200 = d.get('sma_200')
    peg_ratio = d.get('peg_ratio')
    pe_ratio = d.get('pe_ratio')
    buy_count = d.get('buy_count') or 0
    sell_count = d.get('sell_count') or 0
    avg_sentiment = d.get('avg_news_sentiment') or 0.0

    # --- Short-Term Momentum & Sentiment Score ---
    st_score = 0.0
    
    # 1. RSI Indicator (Short-Term momentum/reversal)
    if rsi is not None:
        if rsi < 35:
            st_score += 2.5  # Highly oversold - short term rebound opportunity
        elif rsi < 45:
            st_score += 1.0  # Mildly oversold
        elif rsi > 70:
            st_score -= 2.0  # Overbought
        elif rsi > 60:
            st_score -= 1.0  # Slightly overbought

    # 2. News Sentiment (Short-Term catalyst)
    if avg_sentiment > 0.15:
        st_score += 2.0
    elif avg_sentiment > 0.05:
        st_score += 1.0
    elif avg_sentiment < -0.15:
        st_score -= 2.0
    elif avg_sentiment < -0.05:
        st_score -= 1.0

    # 3. Short-Term Trend Crossover
    if price and sma_50:
        if price > sma_50:
            st_score += 1.0  # Above 50 SMA is bullish momentum
        else:
            st_score -= 1.0

    # 4. Immediate Politician buying activity (Short-term flow)
    net_buys = buy_count - sell_count
    if net_buys > 0:
        st_score += 1.5
    elif net_buys < 0:
        st_score -= 1.5

    # Short-Term Signal classification
    if st_score >= 2.5:
        st_signal = "Strong Buy"
    elif st_score >= 1.0:
        st_signal = "Buy"
    elif st_score <= -2.5:
        st_signal = "Strong Sell"
    elif st_score <= -1.0:
        st_signal = "Sell"
    else:
        st_signal = "Hold"

    # --- Long-Term Value & Growth Score ---
    lt_score = 0.0

    # 1. PEG Ratio (Growth valuation) - Key metric for long term
    if peg_ratio is not None:
        if 0.0 < peg_ratio < 1.0:
            lt_score += 3.5  # Cheap relative to earnings growth
        elif 1.0 <= peg_ratio < 1.5:
            lt_score += 1.5  # Fairly priced relative to growth
        elif peg_ratio > 2.0:
            lt_score -= 2.0  # Very expensive relative to growth

    # 2. P/E Ratio (Valuation Multiple) - Sector-Specific Benchmarked
    sector = d.get('sector', 'Other')
    pe_benchmarks = {
        "Technology": 30.0,
        "Financial Services": 16.0,
        "Energy": 18.0,
        "Healthcare": 22.0,
        "Industrials": 20.0,
        "Consumer Cyclical": 22.0,
        "Communication Services": 22.0,
        "Real Estate": 20.0,
        "Cryptocurrency": 35.0,
        "Other": 20.0
    }
    benchmark = pe_benchmarks.get(sector, 20.0)
    
    if pe_ratio is not None:
        if pe_ratio <= 0.0:
            pass
        elif pe_ratio < benchmark * 0.7:
            lt_score += 2.0  # Deep sector undervaluation
        elif pe_ratio < benchmark:
            lt_score += 1.0  # Moderate undervaluation
        elif pe_ratio > benchmark * 1.5:
            lt_score -= 1.5  # High multiplier compared to sector peers

    # 3. Structural Trend Alignment (Golden Cross / 50 vs 200 SMA)
    if sma_50 and sma_200:
        if sma_50 > sma_200:
            lt_score += 1.5  # Long term structural uptrend
        else:
            lt_score -= 1.5  # Structural downtrend

    # 4. Politician Accumulation
    if net_buys > 1:
        lt_score += 2.0  # Heavy insider accumulation
    elif net_buys > 0:
        lt_score += 1.0
    elif net_buys < -1:
        lt_score -= 1.5

    # 5. News Sentiment (Long-Term structural outlook)
    if avg_sentiment > 0.1:
        lt_score += 1.0
    elif avg_sentiment < -0.1:
        lt_score -= 1.0

    # Long-Term Signal classification
    if lt_score >= 3.5:
        lt_signal = "Strong Buy"
    elif lt_score >= 1.5:
        lt_signal = "Buy"
    elif lt_score <= -3.0:
        lt_signal = "Strong Sell"
    elif lt_score <= -1.5:
        lt_signal = "Sell"
    else:
        lt_signal = "Hold"

    # Explanatory reasons for recommendations
    st_reason = ""
    if st_signal.endswith("Buy"):
        if rsi and rsi < 35:
            st_reason += f"Oversold RSI ({rsi:.1f}) indicates potential price rebound. "
        if avg_sentiment > 0.15:
            st_reason += f"Highly positive news sentiment (+{avg_sentiment:.2f}) acts as a catalyst. "
        if net_buys > 0:
            st_reason += f"Recent politician buying pressure. "
    elif st_signal.endswith("Sell"):
        if rsi and rsi > 70:
            st_reason += f"Overbought RSI ({rsi:.1f}) indicates correction risk. "
        if avg_sentiment < -0.15:
            st_reason += f"Negative news sentiment ({avg_sentiment:.2f}) weighs on price. "
    else:
        st_reason = "Technical indicators and sentiment are currently neutral."

    lt_reason = ""
    if lt_signal.endswith("Buy"):
        if peg_ratio and peg_ratio < 1.0:
            lt_reason += f"Highly undervalued growth play with PEG ratio of {peg_ratio:.2f}. "
        if pe_ratio and pe_ratio < 20:
            lt_reason += f"Low P/E ratio of {pe_ratio:.1f} indicates strong value multiple. "
        if sma_50 and sma_200 and sma_50 > sma_200:
            lt_reason += f"Positive structural uptrend (50 SMA > 200 SMA). "
        if net_buys > 0:
            lt_reason += f"Accumulated by politicians recently. "
    elif lt_signal.endswith("Sell"):
        if peg_ratio and peg_ratio > 2.0:
            lt_reason += f"Growth growth looks expensive with PEG ratio of {peg_ratio:.2f}. "
        if pe_ratio and pe_ratio > 45:
            lt_reason += f"High price multiple (P/E of {pe_ratio:.1f}) poses valuation risk. "
    else:
        lt_reason = "Fundamentals and structural trends are in equilibrium."

    d['short_term_score'] = st_score
    d['short_term_signal'] = st_signal
    d['short_term_reason'] = st_reason.strip() or "Indicators are neutral."
    d['long_term_score'] = lt_score
    d['long_term_signal'] = lt_signal
    d['long_term_reason'] = lt_reason.strip() or "Fundamentals are balanced."

    return d

def get_top_politician_stocks(limit: int = 10, prominent_only: bool = True) -> List[Dict[str, Any]]:
    """Retrieves top stocks bought by politicians with sectors, prices, and investment signals."""
    init_db()
    
    try:
        limit_val = min(max(int(limit), 1), 100)
    except (ValueError, TypeError):
        limit_val = 10
        
    threshold_date_str = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
    query = """
        SELECT t.ticker, COUNT(t.id) as trade_count, 
               SUM(CASE WHEN t.transaction_type = 'Purchase' THEN 1 ELSE 0 END) as buy_count,
               SUM(CASE WHEN t.transaction_type LIKE 'Sale%' THEN 1 ELSE 0 END) as sell_count,
               AVG(t.amount_low) as avg_amount_low,
               AVG(t.amount_high) as avg_amount_high,
               IFNULL(s.avg_sentiment, 0.0) as avg_news_sentiment,
               IFNULL(a.price, IFNULL(s.last_price, 0.0)) as last_price,
               a.rsi, a.sma_50, a.sma_200, a.peg_ratio, a.pe_ratio,
               a.recommendation as calculated_recommendation
         FROM politician_trades t
         LEFT JOIN (
             SELECT ticker, AVG(sentiment_score) as avg_sentiment, AVG(price) as last_price
             FROM signals
             GROUP BY ticker
         ) s ON t.ticker = s.ticker
         LEFT JOIN stock_analysis a ON t.ticker = a.ticker
         WHERE t.ticker IS NOT NULL AND t.ticker != '' AND t.transaction_date >= ?
    """
    
    params = [threshold_date_str]
    if prominent_only:
        like_clauses = " AND (" + " OR ".join(["t.filer_name LIKE ?" for _ in PROMINENT_PATTERNS]) + ")"
        query += like_clauses
        params.extend(PROMINENT_PATTERNS)
        
    query += """
        GROUP BY t.ticker
        ORDER BY buy_count DESC, trade_count DESC
        LIMIT ?
    """
    params.append(limit_val)
    
    with get_db_connection() as conn:
        cursor = conn.execute(query, params)
        res = []
        for row in cursor.fetchall():
            d = dict(row)
            ticker = d['ticker']
            d['sector'] = get_sector_for_ticker(ticker)
            d['signal'] = d.get('calculated_recommendation') or get_investment_signal(d['buy_count'], d['sell_count'], d['avg_news_sentiment'])
            d = calculate_long_short_signals(d)
            d["option_strategy"] = calculate_option_recommendation(
                ticker=ticker,
                price=d.get("last_price") or 0.0,
                recommendation=d['signal'],
                sentiment_score=d.get("avg_news_sentiment"),
                ref_date_str=None
            )
            res.append(d)
        return res

def get_active_politician_tickers(limit: int = 10) -> List[str]:
    """Retrieves the list of tickers that politicians have actively bought recently."""
    init_db()
    
    try:
        limit_val = min(max(int(limit), 1), 50)
    except (ValueError, TypeError):
        limit_val = 10
        
    threshold_date_str = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
    query = """
        SELECT ticker
        FROM politician_trades
        WHERE ticker IS NOT NULL AND ticker != '' AND transaction_type = 'Purchase' AND transaction_date >= ?
        GROUP BY ticker
        ORDER BY COUNT(*) DESC
        LIMIT ?
    """
    with get_db_connection() as conn:
        cursor = conn.execute(query, (threshold_date_str, limit_val))
        return [row['ticker'] for row in cursor.fetchall()]
