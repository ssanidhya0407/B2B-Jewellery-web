# Quotation Lifecycle — Full Phased Workflow

> A concise, single-source-of-truth document describing the quotation tracker  
> from buyer intent → operations validation → sales pricing → negotiation → payment → closure.

---

## Quick Reference — The 8 Phases

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1          PHASE 2          PHASE 3          PHASE 4                        │
│ Buyer            Operations       Sales            Buyer                          │
│ ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐                  │
│ │  Submit  │ ──▶ │ Validate │ ──▶ │  Create  │ ──▶ │  Review  │                  │
│ │   Cart   │     │Inventory │     │  Quote   │     │  Quote   │                  │
│ └──────────┘     └──────────┘     └──────────┘     └──────────┘                  │
│                                                         │                         │
│                                         ┌───────────────┼───────────────┐         │
│                                         ▼               ▼               ▼         │
│                                    PHASE 5         PHASE 6         PHASE 7        │
│                                    ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│                                    │ Negotiate │    │  Accept  │    │  Reject  │   │
│                                    │  (opt.)  │    │ & Pay    │    │          │   │
│                                    └──────────┘    └──────────┘    └──────────┘   │
│                                         │               │                         │
│                                         ▼               ▼                         │
│                                    ┌──────────┐    PHASE 8                        │
│                                    │ Finalize │    ┌──────────┐                   │
│                                    │  Quote   │    │Fulfillment│                  │
│                                    └──────────┘    │ & Close  │                   │
│                                         │          └──────────┘                   │
│                                         └──▶ PHASE 6                              │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Buyer Submits Cart (REQUEST_INITIATED)

| Attribute | Value |
|-----------|-------|
| **Actor** | Buyer (external) |
| **Entry point** | `/app/cart/:id` → "Submit for Quote" button |
| **API** | `POST /api/carts/:id/submit` |
| **Cart status** | `draft` → **`submitted`** |
| **Quotation status** | *not yet created* |

### What happens
1. Buyer builds a cart from AI-recommended designs (internal inventory + manufacturer items).
2. Buyer adds quantities, optional notes, delivery preferences.
3. Buyer clicks **Submit for Quote**.
4. System validates cart has ≥ 1 item.
5. Cart status → `submitted`, timestamp captured.

### Notifications triggered
| To | Type | Message |
|----|------|---------|
| All Operations users | `new_request` | "New quote request from {buyer}" |
| Assigned Sales (if any) | `new_request` | "New quote request from {buyer}" |

### Data captured
- Cart items with recommendation item IDs
- Source type per item (`inventory` / `manufacturer` / `alibaba`)
- Buyer notes, delivery date preference, urgency
- Submission timestamp

---

## Phase 2 — Operations Validates Inventory (OPS_VALIDATION)

| Attribute | Value |
|-----------|-------|
| **Actor** | Operations team |
| **Entry point** | `/ops/requests/:id` in Web or `/requests/:id` in Dashboard |
| **API** | `POST /api/operations/carts/:id/validate-inventory` *(NEW)* |
| **Cart status** | `submitted` → **`under_review`** |
| **Quotation status** | *not yet created* |

### What happens
1. Operations team sees new request in dashboard.
2. Opens request — sees buyer info, items, source types, AI attributes.
3. **For each cart item**, system runs availability check:

   **Internal inventory items:**
   ```
   → Check inventory_skus.availableQuantity ≥ requested quantity
   → If yes: mark as ✅ IN_STOCK
   → If partial: mark as ⚠️ LOW_STOCK (available: X, requested: Y)
   → If zero: mark as ❌ OUT_OF_STOCK
   ```

   **Manufacturer / Alibaba items:**
   ```
   → Check manufacturer_catalog.stockStatus
   → Verify manufacturer isActive and isVerified
   → Mark as ✅ AVAILABLE / ⚠️ MADE_TO_ORDER / ❌ UNAVAILABLE
   → Capture lead time and MOQ
   ```

4. Operations can add notes per item (procurement challenges, alternatives).
5. Operations clicks **"Forward to Sales"** which:
   - Sets cart status → `under_review`
   - Assigns a specific sales person (or leaves for any sales to pick up)
   - Stores validation results on each cart item

### Notifications triggered
| To | Type | Message |
|----|------|---------|
| Assigned Sales person | `request_validated` | "Request from {buyer} is validated and ready for quoting" |

### Data captured (NEW fields on CartItem)
| Field | Type | Description |
|-------|------|-------------|
| `inventoryStatus` | string | `in_stock` / `low_stock` / `out_of_stock` / `available` / `made_to_order` / `unavailable` |
| `availableSource` | string | `internal` / `manufacturer` / `alibaba` |
| `validatedQuantity` | int | Confirmed available qty |
| `operationsNotes` | string | Ops team notes |
| `validatedAt` | datetime | When validation was done |
| `validatedById` | uuid | Who validated |

---

## Phase 3 — Sales Creates Formal Quotation (QUOTE_DRAFTED)

| Attribute | Value |
|-----------|-------|
| **Actor** | Sales team |
| **Entry point** | `/sales/requests/:id` or `/sales/quotations` |
| **API** | `POST /api/sales/quotations` |
| **Cart status** | stays `under_review` |
| **Quotation status** | **`draft`** *(created)* |

### What happens
1. Sales person sees validated request with inventory status per item.
2. For each item, sales calculates pricing:

   **Internal inventory:**
   ```
   finalPrice = baseCost × (1 + marginPercentage / 100)
   ```
   
   **Manufacturer items:**
   ```
   finalPrice = estimated midpoint of (baseCostMin, baseCostMax) × (1 + margin / 100)
   ```

3. Sales uses the **markup lookup hierarchy** (category+source → category → source → global default).
4. Sales prepares formal quotation with:
   - Line items with final unit prices
   - Total amount
   - **Payment terms**: "50% advance, balance post-dispatch"
   - **Validity**: 48 hours from send time
   - **Delivery timeline** per item
   - Additional terms & conditions

5. Quotation saved as `draft` — not yet visible to buyer.
6. Sales can preview, adjust, save multiple times before sending.

### Data created
- `Quotation` record (status: `draft`)
- `QuotationItem` records for each cart item
- Calculated `quotedTotal`

---

## Phase 4 — Sales Sends Quote / Buyer Reviews (QUOTE_SENT)

| Attribute | Value |
|-----------|-------|
| **Actor** | Sales (sends) → Buyer (reviews) |
| **API send** | `POST /api/sales/quotations/:id/send` |
| **API view** | `GET /api/orders/quotations/:id` |
| **Cart status** | `under_review` → **`quoted`** |
| **Quotation status** | `draft` → **`sent`** |

### What happens — Sales sends
1. Sales clicks **"Send to Buyer"**.
2. System sets:
   - `quotation.status` → `sent`
   - `quotation.sentAt` → now
   - `quotation.expiresAt` → now + 48 hours
   - `cart.status` → `quoted`
3. Buyer receives notification + email.

### What happens — Buyer reviews
1. Buyer sees quotation in `/app/quotations` or `/app/cart/:id`.
2. Views all items with final pricing, terms, delivery timelines.
3. Sees **countdown timer** (48 hours from send).
4. Has 3 options:
   - ✅ **Accept** → Phase 6
   - 💬 **Negotiate** → Phase 5
   - ❌ **Reject** → Phase 7

### 48-Hour Expiry Rule
```
IF current_time > quotation.expiresAt AND quotation.status == 'sent':
    → quotation.status = 'expired'
    → Notify buyer: "Your quotation has expired"
    → Notify sales: "Quotation for {buyer} expired"
    → To re-quote: Operations must RE-VALIDATE inventory (Phase 2 restart)
```

### Notifications triggered
| To | Type | Message |
|----|------|---------|
| Buyer | `quote_sent` | "Your quotation is ready — expires in 48hrs" |
| Buyer (at 36hrs) | `quote_expiring` | "⚠️ Quote expires in 12 hours!" |
| Buyer + Sales (at 48hrs) | `quote_expired` | "Quotation has expired" |

---

## Phase 5 — Negotiation (NEGOTIATION_ACTIVE)

| Attribute | Value |
|-----------|-------|
| **Actors** | Buyer ↔ Sales (turn-based) |
| **API (internal)** | `POST /api/internal/negotiations`, `POST .../counter`, `POST .../accept` |
| **API (buyer)** | `POST /api/negotiations/:id/counter`, `POST .../accept` |
| **Quotation status** | stays `sent` during negotiation |
| **Negotiation status** | `open` → `counter_buyer` ↔ `counter_seller` → `accepted` / `rejected` |

### How negotiation works

```
Round 0 (auto):   Sales opens negotiation → original quotation prices
                  Status: open (buyer's turn)

Round 1 (buyer):  Buyer proposes new prices
                  Status: counter_buyer (sales' turn)

Round 2 (sales):  Sales responds with adjusted prices
                  Status: counter_seller (buyer's turn)

Round N:          Continue until one side accepts or rejects
                  
ACCEPT:           Last round's prices become the final quotation prices
                  → Quotation items updated with negotiated prices
                  → Buyer can now accept the quotation (Phase 6)

REJECT/CLOSE:     Negotiation terminated
                  → Quotation stays as-is
                  → Buyer can still accept/reject original quote
```

### Negotiation rules
1. **Turn-based**: After buyer counters, only sales can respond (and vice versa)
2. **Minimum price guard**: Sales cannot accept below `baseCost + minMarkup` without admin approval
3. **Versioning**: Every round is tracked with proposer, prices, message, timestamp
4. **Expiry**: If quotation expires during negotiation, negotiation auto-closes

### Data tracked per round
| Field | Description |
|-------|-------------|
| `roundNumber` | Sequential (0, 1, 2...) |
| `proposedById` | Who made this proposal |
| `proposedTotal` | Total proposed in this round |
| `items[]` | Per-item proposed prices & quantities |
| `message` | Justification text |
| `createdAt` | Timestamp |

---

## Phase 6 — Acceptance & Payment (ORDER_CONFIRMED)

| Attribute | Value |
|-----------|-------|
| **Actor** | Buyer |
| **API accept** | `POST /api/orders/quotations/:id/accept` |
| **API pay** | `POST /api/orders/:id/pay` |
| **Quotation status** | `sent` → **`accepted`** |
| **Order status** | **`pending_payment`** → **`confirmed`** |

### Step 6A — Buyer Accepts Quotation
1. Buyer clicks **"Accept & Proceed to Payment"**.
2. System creates `Order` record:
   - Links to quotation and buyer
   - Assigns sales person who created quote
   - Status: `pending_payment`
   - Generates order number: `ORD-XXXXX`
3. Creates `OrderItem` records from quotation items.
4. Cart status → `closed`.

### Step 6B — 50% Advance Payment
1. System shows payment page with:
   - Total amount
   - **Required advance: 50%**
   - Payment methods: Card / UPI / Bank Transfer

2. **Card / UPI (instant)**:
   - Payment processed through gateway
   - On success: `payment.status` → `paid`
   - `order.paidAmount += amount`
   - If `paidAmount ≥ totalAmount × 0.50` → `order.status` → `confirmed`

3. **Bank Transfer (manual)**:
   - System shows bank details
   - Buyer makes transfer, gets `payment.status` = `pending`
   - **Operations confirms** via `POST /api/operations/payments/:id/confirm`
   - Then same flow as above

### 48-Hour Payment Expiry
```
IF current_time > order.createdAt + 48hrs AND order.status == 'pending_payment':
    → order.status = 'recheck'
    → quotation.status = 'expired'
    → Notify buyer: "Payment window expired"
    → Notify sales: "Order requires recheck"
    → Operations must re-validate inventory before re-quoting
```

### Notifications triggered
| To | Type | Message |
|----|------|---------|
| Sales | `quote_accepted` | "{buyer} accepted your quotation" |
| Buyer | `order_created` | "Order #{number} created — complete payment" |
| Buyer | `payment_confirmed` | "Payment received for #{number}" |
| Operations | `order_confirmed` | "Order #{number} confirmed — begin procurement" |
| Buyer (at 36hrs) | `payment_expiring` | "⚠️ Payment window closes in 12 hours!" |

---

## Phase 7 — Rejection (QUOTE_REJECTED)

| Attribute | Value |
|-----------|-------|
| **Actor** | Buyer |
| **API** | `POST /api/orders/quotations/:id/reject` |
| **Quotation status** | `sent` → **`rejected`** |

### What happens
1. Buyer clicks **"Reject"** with optional reason.
2. Quotation marked as `rejected`.
3. Sales person notified with rejection reason.
4. Cart can be re-submitted for a new quotation cycle.

### Notifications triggered
| To | Type | Message |
|----|------|---------|
| Sales | `quote_rejected` | "{buyer} rejected quotation. Reason: {reason}" |

---

## Phase 8 — Fulfillment & Closure (ORDER_FULFILLED)

| Attribute | Value |
|-----------|-------|
| **Actors** | Operations (procurement/ship) → Sales (balance payment) → Buyer (confirm delivery) |
| **Order status** | `confirmed` → `in_procurement` → `shipped` → `delivered` |

### Step 8A — Procurement
1. Operations reviews confirmed order items:
   - **Internal inventory**: Pick from warehouse, deduct stock
   - **Manufacturer**: Place PO with manufacturer, track production
2. Creates `ProcurementRecord` per item source.
3. Order status → `in_procurement`.

### Step 8B — Dispatch
1. All items received/picked → Pack for shipping.
2. Creates `Shipment` record with tracking number, carrier.
3. Order status → `shipped`.
4. Buyer receives tracking notification.

### Step 8C — Balance Payment
1. After shipment, sales requests balance payment:
   ```
   balanceDue = totalAmount - paidAmount
   ```
2. Buyer pays remaining 50%.
3. On full payment: `order.paidAmount == order.totalAmount`.

### Step 8D — Delivery & Closure
1. Buyer confirms receipt (or auto-confirm after delivery proof).
2. Order status → `delivered`.
3. **Post-closure mapping** triggers:
   - Commission calculation: `deliveredAmount × salesPerson.commissionRate`
   - Manufacturer attribution per item
   - Supply chain data stored for reporting

### Notifications triggered
| To | Type | Message |
|----|------|---------|
| Buyer | `shipment_update` | "Order shipped — tracking: {number}" |
| Buyer | `balance_due` | "Balance payment of {amount} due" |
| Sales | `order_delivered` | "Order #{number} delivered" |
| Sales | `commission_earned` | "Commission of {amount} earned" |

---

## Quotation Status State Machine

```
                    ┌─────────────────────────┐
                    │                         │
                    ▼                         │
              ┌──────────┐              ┌──────────┐
              │  draft   │ ──────────▶  │   sent   │
              └──────────┘              └──────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          ▼                  ▼                  ▼
                    ┌──────────┐       ┌──────────┐       ┌──────────┐
                    │ accepted │       │ rejected │       │ expired  │
                    └──────────┘       └──────────┘       └──────────┘
                          │                                     │
                          ▼                                     ▼
                    ┌──────────┐                          ┌──────────┐
                    │  Order   │                          │ Recheck  │
                    │ Created  │                          │ (restart │
                    └──────────┘                          │  Ph. 2)  │
                                                          └──────────┘
```

## Order Status State Machine

```
    pending_payment ──▶ confirmed ──▶ in_procurement ──▶ shipped ──▶ delivered
          │                                                             │
          ▼                                                             ▼
       recheck                                                    Order Closed
     (expired)                                                   (commission
          │                                                      calculated)
          ▼
    Re-validate
    (Phase 2)
```

## Cart Status State Machine

```
    draft ──▶ submitted ──▶ under_review ──▶ quoted ──▶ closed
```

## Negotiation Status State Machine

```
    open ──▶ counter_buyer ◀──▶ counter_seller ──▶ accepted
                    │                    │               │
                    └───────┬────────────┘               ▼
                            ▼                       Quotation
                     rejected/closed                 updated
```

---

## Role Permissions Matrix

| Action | Buyer | Sales | Operations | Admin |
|--------|:-----:|:-----:|:----------:|:-----:|
| Submit cart (Phase 1) | ✅ | — | — | — |
| Validate inventory (Phase 2) | — | — | ✅ | ✅ |
| Forward to sales (Phase 2) | — | — | ✅ | ✅ |
| Create quotation (Phase 3) | — | ✅ | — | ✅ |
| Send quotation (Phase 4) | — | ✅ | — | ✅ |
| View quotation (Phase 4) | ✅ | ✅ | ✅ | ✅ |
| Counter-offer (Phase 5) | ✅ | ✅ | — | ✅ |
| Accept negotiation (Phase 5) | ✅ | ✅ | — | ✅ |
| Accept quotation (Phase 6) | ✅ | — | — | — |
| Make payment (Phase 6) | ✅ | — | — | — |
| Confirm bank payment (Phase 6) | — | — | ✅ | ✅ |
| Reject quotation (Phase 7) | ✅ | — | — | — |
| Manage procurement (Phase 8) | — | — | ✅ | ✅ |
| Create shipment (Phase 8) | — | — | ✅ | ✅ |
| Request balance payment (Phase 8) | — | ✅ | — | ✅ |
| View order tracking (Phase 8) | ✅ | ✅ | ✅ | ✅ |

---

## Where Each Phase Happens in the App

### Web App (`apps/web`)
| Phase | Route | Role |
|-------|-------|------|
| 1 | `/app/cart/:id` → Submit | Buyer |
| 2 | `/ops/requests/:id` → Validate & Forward | Operations |
| 3 | `/sales/quotations` → Create Quote | Sales |
| 4 | `/sales/quotations` → Send Quote | Sales |
| 4 | `/app/quotations` → View Quotes | Buyer |
| 5 | `/app/cart/:id` → Negotiate | Buyer |
| 5 | `/sales/requests/:id` → Counter | Sales |
| 6 | `/app/quotations` → Accept | Buyer |
| 6 | `/app/orders` → Pay | Buyer |
| 7 | `/app/quotations` → Reject | Buyer |
| 8 | `/ops/orders` → Procurement & Ship | Operations |
| 8 | `/app/orders` → Track | Buyer |

### Dashboard App (`apps/dashboard`)
| Phase | Route | Role |
|-------|-------|------|
| 2 | `/requests/:id` → Validate | Operations |
| 3 | `/quotations` → Create Quote | Sales |
| 3 | `/sales/quotations` → Create Quote | Sales |
| 8 | `/sales/orders` → Balance Payment | Sales |

---

## API Endpoints Per Phase

### Phase 1 — Buyer Submits
```
POST   /api/carts/:id/submit
```

### Phase 2 — Operations Validates *(NEW)*
```
POST   /api/operations/carts/:id/validate-inventory    ← NEW
POST   /api/operations/carts/:id/forward-to-sales      ← NEW
PUT    /api/quotations/requests/:cartId/status          (existing — set under_review)
```

### Phase 3 — Sales Creates Quote
```
POST   /api/sales/quotations                           (existing — create draft)
GET    /api/sales/check-stock                           (existing)
GET    /api/sales/markup/:category/:sourceType          (existing)
```

### Phase 4 — Sales Sends / Buyer Reviews
```
POST   /api/sales/quotations/:id/send                  (existing)
GET    /api/orders/quotations/:id                       (existing — buyer view)
GET    /api/orders/my-quotations                        (existing — buyer list)
```

### Phase 5 — Negotiation
```
POST   /api/internal/negotiations                       (existing — open)
POST   /api/internal/negotiations/:id/counter           (existing — seller counter)
POST   /api/internal/negotiations/:id/accept            (existing — seller accept)
POST   /api/negotiations/:id/counter                    (existing — buyer counter)
POST   /api/negotiations/:id/accept                     (existing — buyer accept)
```

### Phase 6 — Accept & Pay
```
POST   /api/orders/quotations/:id/accept                (existing)
POST   /api/orders/:id/pay                              (existing)
POST   /api/operations/payments/:id/confirm              (existing — bank transfer)
```

### Phase 7 — Reject
```
POST   /api/orders/quotations/:id/reject                (existing)
```

### Phase 8 — Fulfillment
```
POST   /api/operations/procurement                      (existing)
PUT    /api/operations/procurement/:id                   (existing)
POST   /api/operations/shipments                        (existing)
PUT    /api/operations/shipments/:id                     (existing)
PUT    /api/operations/orders/:id/status                 (existing)
POST   /api/sales/orders/:orderId/request-balance       ← NEW
```

---

## What Needs To Be Built (Gap Summary)

### ✅ Completed — Backend API Endpoints
| Endpoint | Purpose | Status |
|----------|---------|--------|
| `POST /api/operations/carts/:id/validate-inventory` | Automated inventory check per item | ✅ Done |
| `POST /api/operations/carts/:id/forward-to-sales` | Assign to sales + set under_review | ✅ Done |
| `GET /api/operations/sales-team` | Get sales team members for assignment | ✅ Done |
| `POST /api/operations/cron/expire-payments` | Expire overdue payments + quotations | ✅ Done |
| `POST /api/operations/cron/send-reminders` | Send 12hr-before-expiry reminders | ✅ Done |
| `GET /api/sales/assigned-requests` | Get carts assigned to this sales person | ✅ Done |
| `POST /api/sales/orders/:id/request-balance` | Trigger balance payment request | ✅ Done |
| `POST /api/sales/orders/:id/calculate-commission` | Calculate sales commission on delivery | ✅ Done |
| `GET /api/sales/tracker/:cartId` | Full quotation tracker timeline | ✅ Done |
| `GET /api/orders/tracker/:cartId` | Buyer-facing quotation tracker | ✅ Done |

### ✅ Completed — Schema Changes (pushed via `prisma db push`)
| Model | New Field | Purpose |
|-------|-----------|---------|
| `CartItem` | `inventoryStatus`, `availableSource`, `validatedQuantity`, `operationsNotes`, `validatedAt`, `validatedById` | Ops validation results |
| `IntendedCart` | `assignedSalesId`, `assignedAt`, `validatedByOpsId`, `validatedAt` | Sales assignment tracking |
| `Order` | `balanceRequestedAt`, `balanceDueAt`, `paymentExpiresAt` | Balance payment tracking |
| `OrderItem` | `actualManufacturerId`, `manufacturerName`, `procurementRecordId` | Procurement mapping |
| `Payment` | `proofDocumentUrl`, `verificationNotes`, `paymentType` | Payment details |
| `Quotation` | `quotationNumber` (unique, auto-generated QT-YYYY-NNNN) | Human-readable quote number |

### ✅ Completed — Backend Enhancements
| Enhancement | Details |
|-------------|---------|
| Quotation number auto-generation | `QT-YYYY-NNNN` format, sequential per year |
| `send()` sets `sentAt` + `expiresAt` | Quotation send now properly timestamps |
| Auto-commission on delivery | `updateOrderStatus('delivered')` auto-triggers commission calc |
| Shipment → Order status cascade | Shipment delivered → checks all shipments → auto-updates order |
| Inventory deduction on procurement | When procurement status → `received`, deducts from internal stock |

### ✅ Completed — Frontend Implementation
| Page | Purpose | Status |
|------|---------|--------|
| `/ops/requests/[id]` | Validate inventory UI + forward-to-sales | ✅ Done |
| `/sales/requests/[id]` | Assigned request view + create & send quote | ✅ Done |
| `/sales/requests` | Assigned-to-me tab + all requests with filters | ✅ Done |
| `/app/quotations/[id]` | Buyer quotation detail with tracker timeline | ✅ Done |
| `/app/quotations` | Quotation list with detail links + tracker | ✅ Done |
| `/app/orders` | Orders with inline tracker toggle per order | ✅ Done |
| `QuotationTracker` component | Shared visual timeline (ops/sales/buyer) | ✅ Done |
| `lib/api.ts` | 9 new API client methods for workflow | ✅ Done |
| Cron scheduling setup | `@nestjs/schedule` for auto-expiry jobs | ⏳ Manual POST endpoints exist |

### ✅ Completed — Notifications (inline in services)
| Type | Trigger | Recipient |
|------|---------|-----------|
| `request_validated` | Phase 2 complete | Assigned sales |
| `payment_expired` | Payment past deadline | Buyer + Sales |
| `balance_due` | After shipment | Buyer |
| `commission_earned` | Order delivered | Sales |
| `quotation_expired` | Quote past expiry | Buyer |

---

## Tracker Display (What Each Role Sees)

### Buyer Quotation Tracker
```
┌─────────────────────────────────────────────────────────────────────┐
│ Quote #QT-2026-001                                    Status: SENT │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ● Submitted          ✓ Feb 15, 2:30 PM                           │
│  ● Under Review       ✓ Feb 15, 4:15 PM  (Ops validated)          │
│  ● Quote Received     ✓ Feb 16, 10:00 AM                          │
│  ○ Awaiting Response  ← YOU ARE HERE (expires Feb 18, 10:00 AM)   │
│  ○ Payment                                                         │
│  ○ Confirmed                                                       │
│  ○ Shipped                                                         │
│  ○ Delivered                                                       │
│                                                                     │
│  [Accept & Pay]  [Negotiate]  [Reject]                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Sales Quotation Tracker
```
┌─────────────────────────────────────────────────────────────────────┐
│ Request from ABC Jewellers                       Status: QUOTED    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ● Request Received   ✓ Feb 15, 2:30 PM                           │
│  ● Ops Validated      ✓ Feb 15, 4:15 PM  (3/3 items available)    │
│  ● Quote Drafted      ✓ Feb 16, 9:45 AM                           │
│  ● Quote Sent         ✓ Feb 16, 10:00 AM (expires 48h)            │
│  ○ Buyer Response     ← WAITING                                    │
│  ○ Negotiation                                                     │
│  ○ Order Created                                                   │
│  ○ Payment Received                                                │
│  ○ Fulfilled                                                       │
│                                                                     │
│  [View Quote]  [Revise Quote]  [Message Buyer]                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Operations Quotation Tracker
```
┌─────────────────────────────────────────────────────────────────────┐
│ Request #REQ-2026-015                       Status: SUBMITTED      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ● Received           ✓ Feb 15, 2:30 PM                           │
│  ○ Validate Inventory ← YOUR ACTION NEEDED                        │
│  ○ Forward to Sales                                                │
│  ○ Quoted                                                          │
│  ○ Order Confirmed                                                 │
│  ○ Procurement                                                     │
│  ○ Shipped                                                         │
│  ○ Delivered                                                       │
│                                                                     │
│  Item 1: Gold Ring      [Check Stock] → In Stock (45 available)    │
│  Item 2: Diamond Set    [Check Stock] → Made to Order (14 days)    │
│  Item 3: Silver Bangle  [Check Stock] → Low Stock (3 available)    │
│                                                                     │
│  [Validate All]  [Forward to Sales ▶]                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

*This document is the authoritative reference for the quotation lifecycle.  
All implementation should follow these phases exactly.*
