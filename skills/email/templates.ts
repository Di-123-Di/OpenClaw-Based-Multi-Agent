// skills/email/templates.ts
// Week 11 -- builds the four email use cases from the handbook, each one
// calling into the skill that already owns that data (property-search,
// market-stats, recommendation) instead of re-querying or re-formatting it.
// Every function here ends at draftEmail() -- never at the send step -- so
// nothing in this file can itself cause an email to leave the building;
// guardrails.test.ts checks that structurally, not just by convention.
import { draftEmail, type EmailDraft } from "./emailTool.ts";
import { getNewListings, getListingById, type ListingRow } from "../property-search/search.ts";
import type { PropertyFilters } from "../property-search/parse.ts";
import { getCityMarketSummary, getMonthlyTrend } from "../market-stats/stats.ts";
import { callPythonAgent } from "../orchestrator/pythonBridge.ts";

function listingLine(l: ListingRow): string {
  return `${l.L_Address}, ${l.L_City} — $${l.price.toLocaleString()} | ${l.beds}bd/${l.baths}ba | ${l.sqft} sqft`;
}

// Use case 1: new listing alert for a saved search.
export async function buildListingAlertEmail(
  to: string, filters: PropertyFilters, sinceDate: string
): Promise<{ draft: EmailDraft; matchCount: number }> {
  const listings = await getNewListings(filters, sinceDate, 10);
  const city = filters.city ?? "your saved search area";
  const subject = `${listings.length} new listing${listings.length === 1 ? "" : "s"} matching your search in ${city}`;
  const body = listings.length === 0
    ? `<p>No new listings matched your saved search since ${sinceDate}.</p>`
    : `<ul>${listings.map((l) => `<li>${listingLine(l)}</li>`).join("")}</ul>`;
  const { draft } = await draftEmail(to, subject, body);
  return { draft, matchCount: listings.length };
}

// Use case 2: weekly market report. This is the handbook's specifically-
// named deliverable, so it gets the richest template of the four.
export async function buildMarketReportEmail(to: string, city: string): Promise<EmailDraft> {
  const summary = await getCityMarketSummary(city, 12);
  const trend = await getMonthlyTrend(city, 6);
  const trendRows = trend.map((t) => {
    const change = t.priceChangePct !== null ? `${t.priceChangePct > 0 ? "+" : ""}${t.priceChangePct}%` : "n/a";
    return `<tr><td>${t.month}</td><td>${t.sales}</td><td>$${t.avgPrice?.toLocaleString() ?? "n/a"}</td><td>${change}</td></tr>`;
  }).join("");

  const subject = `Weekly market report — ${city}`;
  const body = `
    <h2>Market report for ${city}</h2>
    <p>Last ${summary.months} months, ${summary.soldCount} sold homes.</p>
    <ul>
      <li>Median close price: $${summary.medianClosePrice?.toLocaleString() ?? "n/a"}</li>
      <li>Average price per sqft: $${summary.avgPricePerSqft ?? "n/a"}</li>
      <li>Average days on market: ${summary.avgDaysOnMarket ?? "n/a"}</li>
      <li>List-to-close ratio: ${summary.listToClosePct ?? "n/a"}%</li>
      <li>Active listings now: ${summary.activeListingCount}</li>
    </ul>
    <h3>Recent monthly trend</h3>
    <table border="1" cellpadding="4">
      <tr><th>Month</th><th>Sales</th><th>Avg price</th><th>Change</th></tr>
      ${trendRows}
    </table>
  `.trim();

  const { draft } = await draftEmail(to, subject, body);
  return draft;
}

// Use case 3: property summary card -- address, price, and a comp-validated
// price check for one specific listing.
export async function buildPropertySummaryEmail(to: string, listingId: string): Promise<EmailDraft> {
  const listing = await getListingById(listingId);
  if (!listing) {
    throw new Error(`No listing found for ID ${listingId}`);
  }

  const compsResult = await callPythonAgent("skills/recommendation/comps_cli.py", [
    listing.L_City, String(listing.sqft), String(listing.price),
  ]);
  const comps = compsResult.ok ? compsResult.comps : null;
  const compLine = !comps || comps.delta_pct === null
    ? "Not enough recent comps in this area to validate the price."
    : `Priced ${Math.abs(comps.delta_pct)}% ${comps.delta_pct > 0 ? "above" : "below"} ` +
      `recent comps (based on ${comps.comp_count} comparable sales).`;

  const subject = `Property summary: ${listing.L_Address}, ${listing.L_City}`;
  const body = `
    <h2>${listing.L_Address}, ${listing.L_City}</h2>
    <p>$${listing.price.toLocaleString()} | ${listing.beds}bd/${listing.baths}ba | ${listing.sqft} sqft | ${listing.PhotoCount} photos</p>
    <p>${compLine}</p>
  `.trim();

  const { draft } = await draftEmail(to, subject, body);
  return draft;
}

// Use case 4: personalized recommendation digest -- reuses the same
// recommend.py bridge the orchestrator's recommendationAgent calls, so the
// email and the chat reply are always backed by the same recommendations.
export async function buildRecommendationDigestEmail(
  to: string, targetListingId: string, targetAddress: string, targetCity: string
): Promise<EmailDraft> {
  const result = await callPythonAgent("skills/recommendation/agent_cli.py", [targetListingId]);
  if (!result.ok) {
    throw new Error(`Could not generate recommendations: ${result.error}`);
  }

  const recs = result.recommendations as any[];
  const subject = `Homes like ${targetAddress}, ${targetCity}`;
  const body = recs.length === 0
    ? `<p>No comparable listings found for ${targetAddress}, ${targetCity}.</p>`
    : `<ul>${recs.map((r) =>
        `<li>${r.address}, ${r.city} — $${r.price.toLocaleString()} | ${r.beds}bd/${r.baths}ba | score ${r.similarity_score}/100</li>`
      ).join("")}</ul>`;

  const { draft } = await draftEmail(to, subject, body);
  return draft;
}
