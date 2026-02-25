# User Flow Documentation

This document details the step-by-step flows for every possible process within the B2B Jewellery Visual Sourcing Platform.

---

## 1. Authentication & Onboarding
### Flow 1.1: Buyer Registration & Onboarding
- **Actors**: New External User (Buyer)
- **Path**: `/app/onboarding`
1. Buyer signs up or receives an invite.
2. Fills out Business Profile: Company Name, Business Type (Brand/Retailer), Location, and Jewelry Focus.
3. System verifies account and redirects to the Buyer Dashboard (`/app`).

---

## 2. Sourcing & Product Discovery
### Flow 2.1: Visual Sourcing Request
- **Actors**: Buyer
- **Path**: `/app/upload`
1. Buyer uploads a reference image (Inspiration).
2. Specifies the jewelry category (e.g., Ring, Necklace).
3. **AI Vision Engine**: Automatically extracts attributes (Metal type, Stone density, Shape).
4. **Recommendation Engine**: Displays 1 Primary Match + 3–4 Pattern-aligned Alternatives.
5. Buyer views "Indicative Price Ranges" and "Estimated MOQ" for each.

---

## 3. Cart & Request Submission
### Flow 3.1: Intended Cart Submission
- **Actors**: Buyer
- **Path**: `/app/cart`
1. Buyer adds one or more items from recommendations to the "Intended Cart".
2. Buyer specifies quantity, adds special notes, and sets urgency.
3. Buyer clicks **"Submit for Quote"**.
4. **System**: Locks the cart from edits; status changes from `draft` → `submitted`.
5. **Notification**: Internal Sales/Operations teams notified.

---

## 4. Internal Operations & Validation
### Flow 4.1: Fulfillment Feasibility (Operations)
- **Actors**: Operations/Sourcing Team
- **Path**: `/ops/requests/:id`
1. Operations reviews the submitted request.
2. **Stock Check**: Map each item to either `Internal Inventory` (Priority 1) or `Manufacturer/Alibaba` (Priority 2).
3. **Validation**: Mark items as `AVAILABLE`, `MADE_TO_ORDER`, or `UNAVAILABLE`.
4. Operations adds internal notes about lead times or procurement hurdles.
5. Operations clicks **"Forward to Sales"**.

---

## 5. Sales & Quotation
### Flow 5.1: Quotation Creation & Issuance
- **Actors**: Sales Team
- **Path**: `/sales/quotations/:id`
1. Sales reviews the validated items.
2. **Pricing Engine**:
    - *Internal Item*: `Base Cost x Margin Markup`.
    - *Manufacturer Item*: `Supplier Price + Buffer + Margin Markup`.
3. Sales enters delivery timeline and terms.
4. Sales clicks **"Send to Buyer"**.
5. **System**: Marks quotation as `sent`, sets 48-hour expiry; buyer is notified.

---

## 6. Negotiation & Closure
### Flow 6.1: Price Negotiation (Turn-Based)
- **Actors**: Buyer ↔ Sales
- **Path**: `/app/quotations/:id` (Buyer) | `/sales/quotations/:id` (Sales)
1. **Buyer**: Receives quote, can "Accept", "Reject", or "Counter-Offer".
2. **Countering**: Buyer proposes a new price/quantity and adds a message.
3. **Sales**: Receives counter, can "Accept", "Reject", or "Re-Counter" with a revised proposal.
4. **Conclusion**: Flow repeats until either party accepts or the 48-hour window expires.

---

## 7. Payment & Order Fulfillment
### Flow 7.1: Order Confirmation & Payment
- **Actors**: Buyer, Operations (Manual check)
- **Path**: `/app/orders/:id/pay`
1. Buyer chooses payment method: **Instant** (Card/UPI) or **Manual** (Bank Transfer).
2. **Instant**: System auto-updates status to `paid` upon success.
3. **Manual**: Buyer uploads proof of transfer; Operations must verify and click "Confirm Payment".
4. **Fulfillment**: Once ≥ 50% deposit is paid, status becomes `confirmed`.
5. Order moves through: `processing` → `shipped` → `delivered`.

---

## 8. Administrative Management
### Flow 8.1: Margin & Catalog Control
- **Actors**: Admin
- **Path**: `/settings`
1. Admin configures global markups (e.g., $+15%$ for Rings, $+20%$ for Gold).
2. Admin manages the **Internal Catalog** (Inventory CRUD).
3. Admin manages **Manufacturer Profiles** (Alibaba supplier links and reliablity tags).
4. Admin reviews system-wide health and commission reports.

---
*Generated based on project design documentation February 2026.*
