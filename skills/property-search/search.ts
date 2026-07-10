// skills/property-search/search.ts
// Week 3 — query layer over both MLS tables.
import { query } from "./db.ts";
import { fileURLToPath } from "node:url";
import type { PropertyFilters } from "./parse.ts";

type ListingRow = {
  L_ListingID: string; L_Address: string; L_City: string;
  price: number; beds: number; baths: number; sqft: number;
  type: string; PoolPrivateYN: string; ViewYN: string;
};

type SoldRow = {
  UnparsedAddress: string; City: string; CloseDate: string; ClosePrice: number;
  DaysOnMarket: number; BedroomsTotal: number; BathroomsTotalInteger: number;
  LivingArea: number; PropertySubType: string;
};

export async function searchActiveListings(
  filters: PropertyFilters, page = 1, limit = 10
): Promise<ListingRow[]> {
  let sql = `
    SELECT
      L_ListingID, L_Address, L_City,
      L_SystemPrice AS price, L_Keyword2 AS beds, LM_Dec_3 AS baths,
      LM_Int2_3 AS sqft, L_Type_ AS type, PoolPrivateYN, ViewYN
    FROM rets_property
    WHERE L_Status = 'Active'
  `;
  const params: any[] = [];
  if (filters.city)     { sql += " AND L_City = ?";         params.push(filters.city); }
  if (filters.maxPrice) { sql += " AND L_SystemPrice <= ?"; params.push(filters.maxPrice); }
  if (filters.minBeds)  { sql += " AND L_Keyword2 >= ?";    params.push(filters.minBeds); }
  if (filters.minBaths) { sql += " AND LM_Dec_3 >= ?";      params.push(filters.minBaths); }
  if (filters.minSqft)  { sql += " AND LM_Int2_3 >= ?";     params.push(filters.minSqft); }
  if (filters.type)     { sql += " AND L_Type_ = ?";        params.push(filters.type); }
  if (filters.pool)     { sql += " AND PoolPrivateYN = ?";  params.push(filters.pool); }
  if (filters.hasView)  { sql += " AND ViewYN = ?";         params.push(filters.hasView); }

  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const safeOffset = Math.max(0, (page - 1) * safeLimit);
  sql += ` ORDER BY L_SystemPrice ASC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
  return query<ListingRow>(sql, params);
}

export async function getSoldComps(city: string, months = 12): Promise<SoldRow[]> {
  const safeMonths = Math.max(1, Math.min(120, Math.floor(months)));
  const sql = `
    SELECT
      UnparsedAddress, City, CloseDate, ClosePrice, DaysOnMarket,
      BedroomsTotal, BathroomsTotalInteger, LivingArea, PropertySubType
    FROM california_sold
    WHERE City = ?
      AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL ${safeMonths} MONTH)
      AND PropertyType = 'Residential'
    ORDER BY CloseDate DESC
    LIMIT 50
  `;
  return query<SoldRow>(sql, [city]);
}

// --- Demo: runs ONLY when this file is executed directly ---
const runDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (runDirectly) {
  const comps = await getSoldComps("Irvine", 60);
  console.log(`Recent sold comps in Irvine (${comps.length}):`);
  for (const c of comps.slice(0, 5)) {
    console.log(`- ${c.UnparsedAddress} | sold $${c.ClosePrice?.toLocaleString()} on ${c.CloseDate}`);
  }
  process.exit(0);
}
