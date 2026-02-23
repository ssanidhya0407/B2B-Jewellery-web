Business Requirements Document (BRD)
1. Purpose of This Document
This BRD defines the business logic, user journeys, system behavior, and backend requirements for the Visual Sourcing Platform.
The platform converts visual inspiration into manufacturable jewellery products, while positioning the company as the seller of record for all external users. External users never see suppliers; all sourcing intelligence is abstracted behind the platform.
This document is intended for:
Founders & leadership
Product managers
Engineering teams
Operations & sourcing teams

2. Business Objectives
Primary Objectives
Reduce time from inspiration → sellable product
Eliminate supplier discovery friction for customers
Maintain full control over pricing, quality, and delivery
Enable assisted commerce (human-in-the-loop, not fully automated)
Secondary Objectives
Increase utilization of internal inventory
Build reusable design intelligence (patterns)
Standardize sourcing and quotation workflows

3. User Types & Roles
3.1 External Users
Who they are:
Jewellery brands
Boutique retailers
Designers
Import-focused resellers
What they want:
Upload a reference image
Understand what is manufacturable
View indicative pricing, MOQ, and timelines
Place an intent to buy (not direct checkout)

3.2 Internal Users
A. Sales Users
Own customer communication
Own quotation and closure
B. Sourcing Users
Validate manufacturability
Map designs to inventory or manufacturers
C. Admin Users
Configure margins
Manage catalogs
Control permissions

4. High-Level System Overview
Frontend Layers
External User Interface (Web)
Internal Operations Dashboard
Backend Services
Image Processing Service
Design Pattern Engine
Recommendation Engine
Catalog & Inventory Service
External Manufacturer Intelligence Service (Alibaba)
Cart & Order Intent Service
Quotation & Sales Service
Admin & Configuration Service

5. Core Sourcing Logic (System Truth)
The system follows a strict, repeatable sourcing and recommendation logic for both the primary recommendation and all alternative designs.
5.1 Recommendation Structure
For every image uploaded by the user, the system generates:
1 Primary Buying Recommendation (closest manufacturable match)
3–4 Design Alternatives (attribute-similar options)
Each recommendation tile—primary or alternative—follows the same sourcing priority and pricing rules.

5.2 Sourcing Priority (Applied to Every Recommendation)
For each design option (Tile 1 and Tiles 2–4), the system executes the following logic independently:
Internal Inventory Check (Highest Priority)
The system first checks internal inventory for a matching or near-matching SKU
If available:
The design is marked as 
Exact inventory data is used:
Available quantity / MOQ
Delivery timeline
Internal base cost
Inventory-backed options are always preferred over manufacturer-backed options
External Manufacturer Check (Alibaba – Internal Only)
If no suitable internal SKU exists for that design option:
The system queries Alibaba manufacturer data internally
Identifies manufacturable equivalents based on attributes and patterns
Supplier identities are never exposed to the user
Pricing Logic (Platform-Controlled)
Manufacturer pricing from Alibaba is treated as an input cost signal only
The platform applies:
Quality and execution buffers
Operational overheads
Admin-configured margin rules
The user is shown only an indicative price range, never a supplier quote

5.3 Design Alternatives Generation Logic
Design alternatives (Tiles 2–4) are generated using the **Design Pattern
6. External User Journey (End-to-End)
Step 1: Image Upload
User Action:
Uploads a reference image (any source)
System Behavior:
Validates file type & size
Creates an Image Session
Assigns a session-level Image ID

Step 2: Image Interpretation
System Actions:
Extracts visual attributes:
Category (ring, necklace, bracelet, etc.)
Shape & structure
Metal visibility
Stone presence & density
Finish & surface cues
Converts raw attributes into internal design signals

Step 3: Inventory & Manufacturer Check (Behind the Scenes)
System Logic:
Searches Internal Inventory Catalog for closest design match
If match found:
Pulls SKU data (cost, MOQ, lead time)

If no internal match:
Queries Alibaba manufacturer dataset
Extracts cost range, MOQ norms, and lead times
Step 4: Recommendations Display
User Sees 4 Recommendation Tiles:
Tile 1 – Primary Buying Recommendation
Closest manufacturable match
Sourced from:
Internal inventory (if available), OR
Manufacturer-backed estimate (From Alibaba) 
Displays:
Product image / visual
Material description
Indicative price range
MOQ
Estimated delivery timeline
Tiles 2–4 – Design Direction Alternatives
Pattern-based alternatives
Visually distinct but attribute-aligned
Same pricing logic applied

Step 5: Intended Cart Creation
User Actions:
Adds designs to Intended Cart
Specifies quantity intent
Adds notes (optional)
System Behavior:
Saves cart state
Status set to Draft

Step 6: Request Submission
User Action:
Submits sourcing request
System Behavior:
Locks cart from further edits
Status changes to Submitted
Notifies internal sales team

7. Internal User Journeys
7.1 Sales User Journey
Views incoming requests
Reviews Intended Cart
Coordinates with sourcing team
Shares quotation with customer
Converts to order or closes request

7.2 Sourcing User Journey
Receives feasibility task
Reviews design attributes and intent
Maps design to:
Internal inventory SKU, OR
Approved manufacturer catalog
Confirms or updates:
Cost
MOQ
Lead time
Approves / modifies / rejects designs

7.3 Admin User Journey
Manages internal and manufacturer catalogs
Configures margin rules
Controls role-based access
Audits system usage and overrides

8. Backend Functional Requirements
8.1 Image Processing Service
Temporary image handling
Attribute extraction
Images deleted post-session
Only attributes are stored

8.2 Design Pattern Engine
Converts attributes into abstract design patterns
Stores patterns as reusable entities
Pattern Attributes:
Category
Shape
Stone density
Metal visibility
Finish
Occasion

8.3 Recommendation Engine
Logic Flow:
Image-to-inventory match (Tile 1 priority)
Image-to-manufacturer match (if inventory absent)
Pattern-to-catalog match for alternatives (Tiles 2–4)
Internal inventory always prioritized over manufacturers

8.4 Catalog & Inventory Service
Entities:
Internal inventory SKUs
Approved manufacturer SKUs
Attributes:
Material
Base cost
MOQ
Lead time
Customization scope

8.5 Cart & Order Intent Service
Responsibilities:
Manage Intended Cart
Track lifecycle states
States:
Draft
Submitted
Under Review
Quoted
Closed

8.6 Quotation & Sales Service
Applies margin rules
Generates quotations
Tracks approvals and revisions

8.7 Admin & Configuration Service
Margin configuration
Role-based access control
System thresholds and buffers

9. Data Models (High-Level)
Key Entities:
User
Image Session
Design Pattern
Recommendation Set
Intended Cart
Quotation
Order

10. Non-Functional Requirements
High availability
Secure access control
Audit logs for all internal actions
Scalable catalog and pattern architecture

11. Explicitly Out of Scope
Automated checkout
Supplier visibility to users
Brand-level analytics
Trend prediction or forecasting



The system always generates 1 primary recommendation + 3–4 alternatives


Every single tile (primary and alternatives) follows the same rule:


Check internal inventory first


Only if not available, check Alibaba internally


Alibaba pricing is just an input, final price is a platform-controlled range


End of BRD
