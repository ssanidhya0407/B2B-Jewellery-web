You are an expert full‑stack developer. You have been given access to the existing codebase of a B2B jewelry application. Some features are already implemented. Your task is to thoroughly review the current implementation and then design and integrate the new features described below. Ensure that all new code follows best practices, is well‑documented, and integrates seamlessly with the existing system.



New Features to Implement
1. Role‑Based Access Control
Introduce two distinct user roles: Operations Team and Sales Team.

Implement separate login flows or a single login that redirects to a role‑specific dashboard after authentication.

Ensure that each role only sees and can act upon the functionalities listed below.

2. Operations Team Dashboard & Capabilities
The operations team should have a dedicated dashboard with the following sections:

a) Overview / Metrics
Display counts of:

New quote requests

Pending quotes

Active orders

Show system health indicators:

API sync status with the two existing brand databases (e.g., last sync time, success/failure)

Alibaba scrape status (e.g., last scrape, items scraped, errors)

b) Configuration
Markup Management:

Ability to set/adjust markup percentages globally (applies to all products) or per category.

Store these settings in the database and apply them during quote calculations.

Alibaba Scraping Parameters:

Configure price limits, categories to scrape, frequency, etc.

These settings should control the background scraping job (assume a scraping service exists or needs to be integrated).

c) Monitoring
View status of API connections to the two brand databases.

Logs or indicators of connection health.

d) Product Approval
Review and approve new products added to inventory (either from scraping or manual entry).

Show a list of pending products with details, and provide an approve/reject action.

e) Notifications
Receive real‑time notifications (in‑app, email, or both) when a new quote request is submitted.

Clicking the notification opens the request details (see below).

f) Quote Request Details
When viewing a specific quote request, display:

Buyer information (name, company, contact details)

Selected products:

Indicate whether each product is from internal inventory or sourced via Alibaba.

Show product details: name, SKU, image, requested quantity.

Buyer’s notes/requirements.

System improvements section (for operations):

Add new products to inventory (manually or via integration)

Refine attribute extraction rules (likely related to scraping)

Update markup strategies (link to markup management)

Expand supplier base (add new supplier records)

g) Procurement & Fulfillment
For internal inventory items:

Place order with own brands (this may involve sending a purchase order via email or API – you need to design the flow).

Coordinate warehouse pickup/shipment (e.g., generate shipping labels, update status).

For Alibaba orders:

Place formal order with Alibaba suppliers (this may require integration with Alibaba’s ordering system or manual steps – design a process).

Manage supplier communication (track messages, deadlines).

Track manufacturing progress (update order status based on supplier input).

Shipping & Tracking:

After items are ready, arrange shipping to the buyer.

Update order status in the platform.

Provide tracking information to the buyer (via email/in‑app).

3. Sales Team Dashboard & Capabilities
The sales team has a separate dashboard focused on quote preparation, negotiation, and buyer communication.

a) Quote Request Details
Similar to operations view, but with focus on quote preparation:

Buyer information

Selected products (internal vs. Alibaba)

Quantities and notes

b) Quote Preparation
For Internal Inventory Items:

Check current stock availability (via integration with brand databases or internal stock system).

Verify current pricing from brand databases.

Apply the approved markup (global or category‑based) to calculate final price.

For Alibaba Items:

Initiate contact with Alibaba suppliers to get exact quotes (may involve sending a message via Alibaba or a manual process – design a workflow).

Negotiate pricing based on quantity (record negotiations).

Confirm availability and lead times.

Calculate final price with markup.

c) Creating Formal Quote
Compile all pricing into a formal quote document (PDF or in‑app view).

Include:

Delivery timelines

Payment terms (e.g., 50% advance, balance before shipment)

Any notes or conditions

Send the quote to the buyer through the platform (email notification with link to view quote).

d) Negotiation Management
Provide a messaging system for buyer‑sales communication (integrate with existing messaging if present).

Allow sales to:

Respond to buyer questions

Negotiate pricing, quantities, delivery modifications, customization requests

Track negotiation history.

e) Quote Revision
Update the quote based on negotiations.

Re‑confirm with suppliers if product details or prices change.

Send revised quote to buyer.

f) Order Management
Once the buyer accepts the quote, convert it into an order.

Record:

Ordered quantity

Final price

Timelines

Specification documents (upload design documents if applicable)

Trigger payment request.

g) Buyer Onboarding
Sales team can onboard new buyers (create buyer accounts, collect company details, etc.).

This may include integration with a CRM or manual entry.

4. Commission Mechanism for Sales Personnel
Each salesperson should have a commission percentage (or tier) defined (e.g., in their user profile).

Commission is calculated on the final delivered product value, according to the quantity actually delivered (not just ordered). If partial deliveries occur, commission should be based on the delivered portion.

Design a commission tracking system:

When an order is marked as delivered (or partially delivered), calculate commission = delivered value × commission rate.

Store commission records per order, per salesperson.

Provide a report for salespeople and admins.

5. Payment Integration
After order confirmation, the buyer must pay online within 48 hours; otherwise, the quote expires and the order enters a “recheck” state (i.e., sales/operations must re‑validate).

Payment methods:

Credit/debit card

Bank transfer (provide bank details and allow manual confirmation by operations)

UPI (integrate with a payment gateway like Razorpay, Stripe, etc. – choose based on region)

Implement payment status tracking:

Pending, Paid, Failed, Expired.

Upon successful payment, notify the operations team to begin procurement.

6. Quote Expiration Logic
When a quote is sent, set an expiration timestamp (48 hours from sending).

If not paid by then, automatically mark the quote as expired and move the associated order to “recheck” status.

in buyer profile the quation should show expired . 

Notify the sales team to follow up if needed.

7. Additional System Improvements (Operations)
Provide UI for adding new products to inventory manually.

Interface to refine attribute extraction rules (maybe a JSON editor or form) for scraped products.

Ability to add new suppliers (store supplier name, contact, integration details).



Your Task
Explore the existing codebase thoroughly. Understand the current architecture, tech stack, database models, and implemented features. Identify any potential conflicts or integration points.

Create a detailed implementation plan outlining the steps, new files, database migrations, and changes needed. Share this plan for review before coding.

Implement the features as described, following the plan. Ensure code quality, error handling, and security.

Write tests to cover new functionality.


Assume you have full access to the codebase and can make any necessary changes. If any requirements are unclear, make reasonable assumptions and document them.

Start by analyzing the current system and then provide a plan.