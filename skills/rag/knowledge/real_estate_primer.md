# Real Estate Data Analyst Primer (condensed)

Source: Real Estate Data Analyst Primer -- Understanding MLS Data, Real
Estate Transactions, and the Analytics Workflow.

## What Is an MLS

A Multiple Listing Service (MLS) is a private, cooperative database operated
by a regional association of real estate brokers. Agents use it to share
listing information with each other -- a centralized marketplace for
properties. There is no single national MLS; each region operates its own
(e.g., CRMLS for Southern California). Consumer sites like Zillow and Redfin
pull data from MLS feeds via licensed agreements.

## The Transaction Lifecycle

Stage 1 -- Listing: the seller signs a listing agreement; the agent enters
ListPrice, LivingArea, BedroomsTotal, and address fields. The property enters
active market supply.

Stage 2 -- Buyer Preapproval & Offers: buyers typically get a mortgage
preapproval before making an offer. Listings that receive many competing
offers in a short window often close above list price -- detectable by
comparing ListPrice vs. ClosePrice alongside days-on-market.

Stage 3 -- Purchase Agreement & Escrow: when an offer is accepted, both
parties sign a purchase agreement locking in price, contingencies, and a
closing date (typically 30-45 days out). The property status changes to
Pending. Escrow is a neutral third-party account (title company or escrow
officer) holding the buyer's deposit and transaction funds until every
condition is met. Common contingencies:
- Inspection contingency -- buyer can cancel/renegotiate if inspection
  reveals significant issues.
- Appraisal contingency -- protects the buyer if the lender's appraisal
  comes in below the agreed price.
- Financing contingency -- lets the buyer exit if their loan falls through.

If a contingency fails, the deal can be cancelled and the property reverts
to Active, often labeled "Back on Market" (BOM).

Stage 4 -- Close: escrow closes, funds transfer, the deed is recorded.
CloseDate and ClosePrice are recorded. These fields only exist in sold
records -- active listings that never sell never have them.

## List Price vs. Close Price

- ListPrice: the seller's asking/marketing price; reflects seller
  expectations and agent strategy.
- ClosePrice: the true transaction value -- use this for price trend
  analysis.

**Sale-to-list ratio** = ClosePrice / ListPrice. Above 1.0 signals a
competitive seller's market (multiple offers driving price above asking).
Below 1.0 signals buyer leverage or an overpriced listing.

Example: ListPrice $875,000, ClosePrice $901,000 -> ratio =
901,000 / 875,000 = 1.030 -> sold 3% over asking.

The IDX market-stats skill (Week 5) reports this as a **list-to-close
ratio** (ClosePrice / ListPrice, expressed as a percentage) -- the same
concept, same formula, just expressed as a percent instead of a decimal
ratio (e.g. 99.4% means the average sale closed 0.6% under the original
list price).

## Commission Structure

Real estate commissions are typically 5-6% of the sale price, historically
split between the listing agent and the buyer's agent. Since 2024, NAR
settlement changes mean buyer-agent fees are negotiated separately rather
than automatically offered through the MLS. Neither buyer nor seller pays
agent fees upfront -- for the seller, commission is deducted from sale
proceeds at closing; commissions are fully contingent on the deal closing.

## Home Financing Basics

Down payment tiers: Low 3-5% (requires PMI), Mid 10%, Standard 20%
(eliminates PMI), High 25%+ (investor/jumbo). On a $500,000 home, 20% down
is $100,000, leaving a $400,000 loan (principal).

The 30-year fixed-rate mortgage is the most common U.S. loan structure.
Monthly payment on a $400,000 loan (20% down on a $500,000 home):

| Interest Rate | Monthly Payment | Total Interest Paid | Total Cost of Loan |
|---|---|---|---|
| 3.0% | $1,686 | $207,110 | $607,110 |
| 6.0% | $2,398 | $463,353 | $863,353 |
| 7.5% | $2,797 | $607,024 | $1,007,024 |

Rising rates directly compress buyer purchasing power and are a primary
driver of transaction-volume slowdowns.

## Listings Dataset vs. Sold Dataset

- Listings dataset: all properties entered into the MLS (active, expired,
  withdrawn, sold). Use for supply analysis.
- Sold dataset: subset of listings that completed a transaction. Always has
  ClosePrice and CloseDate. Use for price and volume analysis.

## MLS Status Codes (StandardStatus)

| Status | Meaning |
|---|---|
| Active | Property is live and available. DOM is actively accumulating. |
| Pending | Under contract, not yet closed. Excluded from active supply. ClosePrice not yet set. |
| Closed | Transaction completed. ClosePrice and CloseDate populated. |
| Back on Market | Returned to Active after a Pending deal fell through. DOM clock may have reset. |
| Expired | Listing term ended without a sale. |
| Withdrawn | Seller pulled the listing before expiry. |

Always filter to StandardStatus = Closed for price trend analyses, and to
StandardStatus = Active for measuring active inventory. Mixing statuses
(e.g. including Pending in a price analysis) is a common analyst error
because Pending records have no confirmed ClosePrice yet.

## Days on Market (DOM)

DOM measures how long a property has been listed before going under
contract or selling -- a direct indicator of demand. It is typically the
number of calendar days between ListingContractDate and either the Pending
date or CloseDate. **Cumulative Days on Market (CDOM)** adds DOM across
multiple listing periods for the same property (useful for spotting
relisted properties), and resets only on ownership change.

How to interpret DOM:
- Very Low (1-7 days): extremely competitive, likely multiple offers.
- Low (8-30 days): healthy demand, normal for active markets.
- Average (31-60 days): moderate, may reflect seasonal slowdown or slight
  overpricing.
- High (60+ days): weak demand -- overpriced, condition issues, or low
  buyer interest.

## Property Types

| Type | Notes |
|---|---|
| Single Family (SFR) | Detached home on its own lot. Owner controls the land. Highest price per unit typically. Standard benchmark for market trend dashboards. |
| Condo | Unit within a multi-unit building; common areas shared; HOA fees apply. Price/sqft differs from SFR. |
| Townhouse | Attached home, usually multi-story, shares walls; hybrid between SFR and condo. |
| Multi-Family | 2-4 unit residential; investor-oriented; priced on cap rate as much as comps. |
| Manufactured | Factory-built home on leased or owned land; often lower price points; may not qualify for conventional financing. |

Always filter by PropertyType before calculating median price, price/sqft,
or DOM -- mixing condos and single-family homes skews a ZIP-code median by
composition of what sold, not just by price movement.
