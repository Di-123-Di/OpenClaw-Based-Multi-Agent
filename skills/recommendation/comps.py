# skills/recommendation/comps.py
# Week 7 -- validate a recommended listing's price against recent nearby sold
# comps in california_sold.

import os

import mysql.connector
from dotenv import load_dotenv

load_dotenv()


def validate_with_comps(city: str, sqft: int, price: int, months: int = 6) -> dict:
    """Compare `price` to the average $/sqft of similar-sized Residential comps
    sold in `city` over the trailing `months`. A positive delta_pct means the
    listing is priced above what recent comps support; negative means below.
    Returns delta_pct=None when there are no comps to validate against."""
    safe_months = max(1, min(60, int(months)))

    conn = mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE"),
    )
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """
        SELECT
            AVG(ClosePrice / NULLIF(LivingArea, 0)) AS avg_ppsf,
            COUNT(*) AS comp_count
        FROM california_sold
        WHERE City = %s
          AND PropertyType = 'Residential'
          AND LivingArea BETWEEN %s AND %s
          AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
        """,
        (city, sqft * 0.8, sqft * 1.2, safe_months),
    )
    result = cursor.fetchone()
    cursor.close()
    conn.close()

    avg_ppsf = float(result["avg_ppsf"]) if result["avg_ppsf"] else 0.0
    comp_count = result["comp_count"]
    comp_price = avg_ppsf * sqft

    return {
        "comp_price": round(comp_price) if comp_price else None,
        "list_price": price,
        "comp_count": comp_count,
        "delta_pct": round((price - comp_price) / comp_price * 100, 1) if comp_price else None,
    }
