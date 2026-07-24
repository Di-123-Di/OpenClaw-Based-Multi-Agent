// skills/market-stats/stats.ts
// Week 5 — market analytics query layer over california_sold (sold comps).
import { query } from "../property-search/db.ts";
import { fileURLToPath } from "node:url";

export type CityMarketSummary = {
  city: string;
  months: number;
  soldCount: number;
  avgClosePrice: number | null;
  medianClosePrice: number | null;
  avgPricePerSqft: number | null;
  avgDaysOnMarket: number | null;
  listToClosePct: number | null;
  activeListingCount: number;
};

export type MonthlyTrendRow = {
  month: string;
  sales: number;
  avgPrice: number | null;
  avgDom: number | null;
  priceChangePct: number | null;
};

export type CityLeaderboardRow = {
  city: string;
  soldCount: number;
  avgClosePrice: number | null;
  avgPricePerSqft: number | null;
  avgDom: number | null;
  listToClosePct: number | null;
};

function safeMonths(months: number): number {
  return Math.max(1, Math.min(120, Math.floor(months)));
}

// Average + median close price, price/sqft, DOM, and list-to-close ratio for one
// city, plus the current active listing count (inventory) from rets_property.
export async function getCityMarketSummary(
  city: string, months = 12
): Promise<CityMarketSummary> {
  const m = safeMonths(months);

  const [agg] = await query<any>(
    `
    SELECT
      COUNT(*) AS soldCount,
      ROUND(AVG(ClosePrice), 0) AS avgClosePrice,
      ROUND(AVG(ClosePrice / NULLIF(LivingArea, 0)), 0) AS avgPricePerSqft,
      ROUND(AVG(DaysOnMarket), 1) AS avgDaysOnMarket,
      ROUND(AVG(ClosePrice / NULLIF(ListPrice, 0)) * 100, 1) AS listToClosePct
    FROM california_sold
    WHERE City = ?
      AND PropertyType = 'Residential'
      AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL ${m} MONTH)
    `,
    [city]
  );

  // MySQL has no built-in MEDIAN(); the middle row(s) of the sorted price list
  // are located with ROW_NUMBER()/COUNT() window functions instead.
  const [med] = await query<any>(
    `
    SELECT AVG(ClosePrice) AS medianClosePrice FROM (
      SELECT ClosePrice,
             ROW_NUMBER() OVER (ORDER BY ClosePrice) AS rn,
             COUNT(*) OVER () AS cnt
      FROM california_sold
      WHERE City = ?
        AND PropertyType = 'Residential'
        AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL ${m} MONTH)
    ) ranked
    WHERE rn IN (FLOOR((cnt + 1) / 2), CEIL((cnt + 1) / 2))
    `,
    [city]
  );

  const [inv] = await query<any>(
    "SELECT COUNT(*) AS n FROM rets_property WHERE L_City = ? AND L_Status = 'Active'",
    [city]
  );

  return {
    city,
    months: m,
    soldCount: agg.soldCount,
    avgClosePrice: agg.avgClosePrice,
    medianClosePrice: med.medianClosePrice !== null ? Math.round(med.medianClosePrice) : null,
    avgPricePerSqft: agg.avgPricePerSqft,
    avgDaysOnMarket: agg.avgDaysOnMarket,
    listToClosePct: agg.listToClosePct,
    activeListingCount: inv.n,
  };
}

// Month-by-month sales volume, average price, average DOM, and the month-over-
// month price change (%) for one city — the trend series behind "is now a good
// time to buy" style questions.
export async function getMonthlyTrend(city: string, months = 24): Promise<MonthlyTrendRow[]> {
  const m = safeMonths(months);
  const rows = await query<any>(
    `
    SELECT
      DATE_FORMAT(CloseDate, '%Y-%m') AS month,
      COUNT(*) AS sales,
      ROUND(AVG(ClosePrice), 0) AS avgPrice,
      ROUND(AVG(DaysOnMarket), 1) AS avgDom
    FROM california_sold
    WHERE City = ?
      AND PropertyType = 'Residential'
      AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL ${m} MONTH)
    GROUP BY DATE_FORMAT(CloseDate, '%Y-%m')
    ORDER BY month
    `,
    [city]
  );

  let prevPrice: number | null = null;
  return rows.map((r: any) => {
    const priceChangePct =
      prevPrice && r.avgPrice ? Math.round(((r.avgPrice - prevPrice) / prevPrice) * 1000) / 10 : null;
    prevPrice = r.avgPrice;
    return { month: r.month, sales: r.sales, avgPrice: r.avgPrice, avgDom: r.avgDom, priceChangePct };
  });
}

// Top-N cities by sold volume, for a market overview across California
// (the multi-city leaderboard from the Week 5 handbook SQL).
export async function getTopMarkets(months = 12, limit = 25): Promise<CityLeaderboardRow[]> {
  const m = safeMonths(months);
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const rows = await query<any>(
    `
    SELECT
      City AS city,
      COUNT(*) AS soldCount,
      ROUND(AVG(ClosePrice), 0) AS avgClosePrice,
      ROUND(AVG(ClosePrice / NULLIF(LivingArea, 0)), 0) AS avgPricePerSqft,
      ROUND(AVG(DaysOnMarket), 1) AS avgDom,
      ROUND(AVG(ClosePrice / NULLIF(ListPrice, 0)) * 100, 1) AS listToClosePct
    FROM california_sold
    WHERE PropertyType = 'Residential'
      AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL ${m} MONTH)
    GROUP BY City
    ORDER BY soldCount DESC
    LIMIT ${safeLimit}
    `
  );
  return rows;
}

// --- Demo: runs ONLY when this file is executed directly ---
const runDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (runDirectly) {
  const city = process.argv[2] || "San Diego";

  const summary = await getCityMarketSummary(city, 12);
  console.log(`Market summary — ${city} (last ${summary.months} months):`);
  console.log(`  Sold transactions:    ${summary.soldCount}`);
  console.log(`  Avg close price:      $${summary.avgClosePrice?.toLocaleString() ?? "n/a"}`);
  console.log(`  Median close price:   $${summary.medianClosePrice?.toLocaleString() ?? "n/a"}`);
  console.log(`  Avg price / sqft:     $${summary.avgPricePerSqft ?? "n/a"}`);
  console.log(`  Avg days on market:   ${summary.avgDaysOnMarket ?? "n/a"}`);
  console.log(`  List-to-close ratio:  ${summary.listToClosePct ?? "n/a"}%`);
  console.log(`  Active listings now:  ${summary.activeListingCount}`);

  const trend = await getMonthlyTrend(city, 24);
  console.log(`\nMonthly trend (${trend.length} months):`);
  for (const t of trend) {
    const change = t.priceChangePct !== null ? `${t.priceChangePct > 0 ? "+" : ""}${t.priceChangePct}%` : "n/a";
    console.log(`  ${t.month}: ${t.sales} sales, avg $${t.avgPrice?.toLocaleString() ?? "n/a"}, ${t.avgDom ?? "n/a"} DOM (${change})`);
  }

  const top = await getTopMarkets(12, 10);
  console.log(`\nTop markets by sold volume (last 12 months):`);
  for (const c of top) {
    console.log(`  ${c.city}: ${c.soldCount} sold, avg $${c.avgClosePrice?.toLocaleString() ?? "n/a"}`);
  }

  process.exit(0);
}
