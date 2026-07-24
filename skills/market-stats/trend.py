# skills/market-stats/trend.py
# Week 5 -- monthly price-trend analysis over california_sold using pandas.
#
# Usage:
#   python3 skills/market-stats/trend.py "San Diego" 24

import sys
import os
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import create_engine, text

load_dotenv()

engine = create_engine(
    f"mysql+mysqlconnector://{os.getenv('MYSQL_USER')}:{os.getenv('MYSQL_PASSWORD')}"
    f"@{os.getenv('MYSQL_HOST')}/{os.getenv('MYSQL_DATABASE')}"
)


def get_price_trend(city: str, months: int = 24) -> pd.DataFrame:
    """Monthly sold count, average close price, and average days-on-market for
    one city, plus the month-over-month percent change in average price."""
    safe_months = max(1, min(120, int(months)))
    query = text(
        """
        SELECT
            DATE_FORMAT(CloseDate, '%Y-%m') AS month,
            COUNT(*) AS sales,
            ROUND(AVG(ClosePrice), 0) AS avg_price,
            ROUND(AVG(DaysOnMarket), 1) AS avg_dom
        FROM california_sold
        WHERE City = :city
          AND PropertyType = 'Residential'
          AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL :months MONTH)
        GROUP BY DATE_FORMAT(CloseDate, '%Y-%m')
        ORDER BY month
        """
    )
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"city": city, "months": safe_months})
    df["price_change_pct"] = df["avg_price"].pct_change().round(4) * 100
    return df


def get_city_market_summary(city: str, months: int = 12) -> pd.DataFrame:
    """Average price, price/sqft, days-on-market, and list-to-close ratio for
    one city -- the pandas-side equivalent of the Week 5 SQL city summary."""
    safe_months = max(1, min(120, int(months)))
    query = text(
        """
        SELECT
            City AS city,
            COUNT(*) AS sold_count,
            ROUND(AVG(ClosePrice), 0) AS avg_close_price,
            ROUND(AVG(ClosePrice / NULLIF(LivingArea, 0)), 0) AS avg_price_per_sqft,
            ROUND(AVG(DaysOnMarket), 1) AS avg_dom,
            ROUND(AVG(ClosePrice / NULLIF(ListPrice, 0)) * 100, 1) AS list_to_close_pct
        FROM california_sold
        WHERE City = :city
          AND PropertyType = 'Residential'
          AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL :months MONTH)
        GROUP BY City
        """
    )
    with engine.connect() as conn:
        return pd.read_sql(query, conn, params={"city": city, "months": safe_months})


if __name__ == "__main__":
    city = sys.argv[1] if len(sys.argv) > 1 else "San Diego"
    months = int(sys.argv[2]) if len(sys.argv) > 2 else 24

    print(f"City market summary -- {city}:")
    summary = get_city_market_summary(city, months=12)
    print(summary.to_string(index=False) if not summary.empty else "  no sold comps found")

    print(f"\nMonthly price trend -- {city} (last {months} months):")
    trend = get_price_trend(city, months=months)
    print(trend.to_string(index=False) if not trend.empty else "  no monthly data found")
