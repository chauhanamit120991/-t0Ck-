import os
import json
import logging
from pydantic import BaseModel, Field
from typing import Tuple

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic schema for structured output from Gemini
class SentimentResponse(BaseModel):
    sentiment_score: float = Field(..., description="Sentiment score between -1.0 (extremely negative) and 1.0 (extremely positive)")
    explanation: str = Field(..., description="A brief 1-sentence explanation of the sentiment analysis")

def get_mock_sentiment(headline: str, ticker: str) -> Tuple[float, str]:
    """
    Fallback rule-based sentiment analysis when Gemini API is unavailable.
    Provides deterministic and realistic results based on common financial terms.
    """
    headline_lower = headline.lower()
    positive_words = ["rise", "gains", "up", "surge", "grow", "growth", "higher", "beat", "positive", "bullish", "profit", "succeed", "buy", "outperform", "expand", "strong", "jump"]
    negative_words = ["drop", "falls", "down", "slump", "decline", "lower", "miss", "negative", "bearish", "loss", "fail", "sell", "underperform", "shrink", "weak", "plunge", "sue", "lawsuit", "investigation"]
    
    pos_count = sum(1 for word in positive_words if word in headline_lower)
    neg_count = sum(1 for word in negative_words if word in headline_lower)
    
    # Calculate a score based on matches
    if pos_count > neg_count:
        score = min(0.15 * (pos_count - neg_count), 1.0)
        explanation = f"Detected positive terms related to {ticker} (e.g. {[w for w in positive_words if w in headline_lower][0]})."
    elif neg_count > pos_count:
        score = max(-0.15 * (neg_count - pos_count), -1.0)
        explanation = f"Detected negative terms related to {ticker} (e.g. {[w for w in negative_words if w in headline_lower][0]})."
    else:
        # Default or slight bias based on ticker
        score = 0.0
        explanation = f"Headline appears neutral or balanced regarding {ticker}."
        
    return score, explanation

def analyze_sentiment(headline: str, ticker: str) -> Tuple[float, str]:
    """
    Analyzes the sentiment of a financial headline for a given stock ticker using Gemini 2.5 Flash.
    Falls back to a local heuristic analyzer if the API key is not configured or if the request fails.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning(
            "GEMINI_API_KEY environment variable is not set. "
            "Falling back to local heuristic sentiment analyzer."
        )
        return get_mock_sentiment(headline, ticker)

    try:
        from google import genai
        from google.genai import types

        # Initialize the Google GenAI client explicitly using the loaded API key
        client = genai.Client(api_key=api_key)

        prompt = f"""
        Analyze the sentiment of the following stock news headline for the ticker: {ticker}.
        
        Headline: "{headline}"
        
        Assign a sentiment score from -1.0 (extremely negative / bearish) to +1.0 (extremely positive / bullish).
        Provide a concise, 1-sentence explanation of why you chose this score.
        """

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=SentimentResponse,
                temperature=0.1
            )
        )

        # Parse the structured response
        data = json.loads(response.text)
        sentiment_score = float(data.get("sentiment_score", 0.0))
        explanation = data.get("explanation", "Analyzed using Gemini Flash API.")
        
        # Clamp score between -1.0 and 1.0
        sentiment_score = max(-1.0, min(1.0, sentiment_score))
        
        logger.info(f"Gemini analysis success for {ticker}: score={sentiment_score}")
        return sentiment_score, explanation

    except Exception as e:
        logger.error(f"Gemini Flash API analysis failed: {str(e)}. Falling back to local analyzer.")
        return get_mock_sentiment(headline, ticker)
