// skills/property-search/run.ts
// Week 3 finale — full pipeline: free-text query -> filters -> active listings.
import { parsePropertyQuery } from "./parse.ts";
import { searchActiveListings } from "./search.ts";

// Use the query typed on the command line, or a default.
const userQuery = process.argv.slice(2).join(" ") ||
  "3 bedroom homes in Irvine under 2m";

const filters = parsePropertyQuery(userQuery);
console.log("Query  :", userQuery);
console.log("Filters:", filters, "\n");

const listings = await searchActiveListings(filters);
console.log(`Found ${listings.length} matching active listings:\n`);
for (const r of listings) {
  console.log(
    `🏠 ${r.L_Address}, ${r.L_City}\n` +
    `   $${r.price?.toLocaleString()} | ${r.beds}bd/${r.baths}ba | ${r.sqft} sqft | ${r.type}\n`
  );
}
process.exit(0);

