# Trestle / RESO Property Field Definitions (curated)

Source: Trestle Property MetaData documentation
(api-trestle.corelogic.com/trestle/Documentation/MetaData/Resource/Property).
This is the RESO (Real Estate Standards Organization) data dictionary CRMLS
and most U.S. MLSs are built on. Only fields relevant to `rets_property` and
`california_sold` are included below -- the full dictionary has hundreds of
agent-contact and commercial-property fields not used in this project.

## Core Identifiers

- **ListingKey** (String): A unique identifier for a listing record from the
  immediate source. `california_sold.ListingKey` and joins back to
  `rets_property.L_ListingID`.
- **ListingId**: The well-known identifier for the listing -- the value a
  human uses to look up a specific listing.
- **StandardStatus** (Enum): The status of the listing reflecting the state
  of the contract -- Active, Pending, Closed, Canceled, Expired, Withdrawn.
  Single-select field.
- **ModificationTimestamp** (DateTimeOffset): Automatically recorded
  timestamp of when the listing was last modified in the MLS system --
  used for incremental sync.

## Price Fields

- **ListPrice** (Decimal): The current price of the property as determined
  by the seller and the seller's broker.
- **OriginalListPrice** (Decimal): The original price on the initial
  agreement between the seller and the seller's broker.
- **PreviousListPrice** (Decimal): The most recent previous ListPrice of the
  listing -- enables price-reduction analysis.
- **ClosePrice** (Decimal): The amount of money paid by the purchaser to the
  seller for the property under the agreement.
- **PriceChangeTimestamp**: Automatically recorded timestamp of when the
  listing's price was last changed.

## Dates

- **ListingContractDate** (DateTime): The effective date of the agreement
  between the seller and the seller's broker.
- **PurchaseContractDate** (DateTime): For for-sale listings, the date an
  offer was accepted and the listing was no longer on market (buyer and
  seller signed the purchase agreement).
- **CloseDate** (DateTime): The date the purchase agreement was fulfilled --
  when the transaction officially closed.
- **OnMarketDate** / **OffMarketDate**: The date a listing was placed on, or
  taken off, the market.
- **PendingTimestamp**: When the listing's status was set to Pending.
- **BackOnMarketDate**: The date a listing that had gone off-market (e.g. a
  Pending deal that fell through) returned to being on-market.
- **WithdrawnDate**: Date the listing was withdrawn from the market while
  the listing agreement is still in effect (no offer accepted).
- **CancellationDate**: Date the listing agreement between seller and
  listing agent was cancelled.

## Days on Market

- **DaysOnMarket** (Int32): The number of days the listing is on market, as
  defined by the MLS's business rules.
- **CumulativeDaysOnMarket** (Int32): The number of days the property is on
  market, aggregated across multiple listing periods for the same property.

## Physical Property Fields

- **LivingArea** (Decimal): The total livable area within the structure
  (interior square footage).
- **BedroomsTotal** (Int32): The total number of bedrooms in the dwelling.
- **BathroomsTotalInteger** (Int32): The simple sum of the number of
  bathrooms -- e.g. two full baths + one half bath = 3.
- **YearBuilt** (Int32): The year an occupancy permit was first granted /
  the year the structure was built.
- **LotSizeAcres** / **LotSizeSquareFeet** (Decimal): The total lot size, in
  acres or square feet respectively. Must stay in sync with each other.
- **GarageSpaces** (Decimal): The number of spaces in the garage(s).
- **PoolPrivateYN** (Boolean): The property has a privately owned pool
  included in the sale.
- **ViewYN** (Boolean): The property has a notable view. The **View** field
  (Enum) then describes what kind (Mountains, Ocean, GolfCourse, etc.).
- **FireplaceYN** (Boolean): Does the property include a fireplace.
- **NewConstructionYN** (Boolean): Is the property newly constructed and
  never previously occupied.
- **ArchitecturalStyle** (Enum): A list describing the style of the
  structure -- e.g. Victorian, Ranch, Craftsman.
- **Cooling** / **Heating** (Enum): Lists describing the cooling/heating
  features of the property.
- **PropertyType** (Enum): Top-level type -- Residential, Lease, Land,
  Commercial Sale, etc.
- **PropertySubType** (Enum): Sub-type of the above -- Single Family
  Residence, Condominium, Townhouse, Manufactured on Land, Multi Family,
  etc.

## Location Fields

- **City** (String): The city in the listing address.
- **PostalCode** (String): The postal (ZIP) code portion of the address.
- **Latitude** / **Longitude** (Decimal): Geographic coordinates of the
  property, specified in degrees and decimal parts.
- **UnparsedAddress** (String): A text representation of the full civic
  address as a single entity.
- **CountyOrParish** (String): The county, parish, or other regional
  authority.
- **HighSchoolDistrict** (String): The name of the high school district
  whose catchment area includes the property.
- **SubdivisionName** (String): A neighborhood, community, complex, or
  builder tract name.

## HOA / Fees

- **AssociationFee** (Decimal): A fee paid by the homeowner to the Home
  Owners Association for upkeep of common areas.
- **AssociationAmenities** (Enum): Amenities provided by the HOA -- Pool,
  Clubhouse, Tennis, Golf, etc.

## Agent / Office Fields

- **ListAgentFirstName** / **ListAgentLastName** / **ListAgentFullName**:
  Name of the agent representing the seller.
- **ListOfficeName** (String): The legal name of the brokerage representing
  the seller.
- **BuyerAgentFirstName** / **BuyerAgentLastName** / **BuyerAgentFullName**:
  Name of the agent representing the buyer.
- **BuyerOfficeName** (String): The legal name of the brokerage representing
  the buyer.

## Investment / Land Fields

- **CapRate** (Decimal): Cap Rate is equivalent to the return on investment
  received if paying cash for a property -- the ratio between net operating
  income produced by an asset and its capital cost (original purchase
  price) or current market value.
- **ParcelNumber** (String): The assessor's parcel number (APN), typically
  issued by the county assessor.
- **TaxAnnualAmount** (Decimal): The annual property tax amount as of the
  last assessment.
- **TaxAssessedValue** (Int32): The property value as of the last tax
  assessment.
