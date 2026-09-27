MASTER PROMPT — FULL PRODUCT UI/UX, INTERACTION, FUNCTIONALITY & SYSTEM IMPLEMENTATION
Use this as the master implementation prompt for the existing ERP + POS + E-commerce SaaS codebase.

This is not a request for a cosmetic redesign. Treat it as a full product-grade UX, UI, interaction, workflow, validation, architecture, and implementation mandate for a production enterprise system.

ROLE — OPERATE AS A CROSS-FUNCTIONAL PRODUCT TEAM
Approach this project as if the implementation is being reviewed simultaneously by:

a 20-year senior UX/UI designer

a 20-year enterprise product designer

a 20-year senior full-stack architect

a 20-year systems architect

a 20-year database/application architect

a 20-year QA and test engineer

a 20-year product manager

a 20-year B2B SaaS specialist

a 20-year POS/ERP workflow designer

a 20-year e-commerce UX specialist

a 20-year information architect

a 20-year accessibility and responsive-design specialist

a 20-year technical operations/devops engineer

a 20-year product marketing/brand strategist

Do not think only as a frontend developer.

Think about:

What should the user see?
Why should they see it?
What should happen when they click it?
What data should change?
What validation should happen?
What happens if it fails?
What happens if they cancel?
What happens if two users perform the action simultaneously?
What permissions apply?
What happens on mobile?
What happens in Bangla?
What gets printed?
What gets audited?
What happens after deployment?

The final result must behave like a real enterprise product, not an elaborate dashboard template.

1. CORE PRODUCT VISION
The product consists of three connected experiences:

A. MASTER SAAS PANEL
Platform/operator-level control.

B. TENANT ERP / FACTORY MANAGEMENT / POS
Operational business software used by each tenant.

C. TENANT E-COMMERCE STOREFRONT + CMS
Public-facing commerce and brand experience.

All three must feel like parts of the same product ecosystem while retaining appropriate differences in information density and user behavior.

The product must feel:

Premium.
Modern.
Professional.
Stable.
Authoritative.
Fast.
Intuitive.
Enterprise-grade.
Human.
Operationally trustworthy.

Avoid:

generic SaaS template appearance

excessive gradients

unnecessary glassmorphism

neon/cyberpunk styling

giant rounded containers everywhere

excessive animation

meaningless charts

decorative UI that harms usability

AI-generated-looking layouts

excessive whitespace where operational density is required

dense legacy-ERP ugliness

inconsistent component behavior

2. EXISTING DASHBOARD IS THE BASELINE
The existing Dashboard design is considered acceptable and should not be unnecessarily reinvented.

Treat the existing Dashboard as the visual and interaction baseline.

Extract from it:

typography

spacing rhythm

card language

colors

border treatment

shadow philosophy

icon treatment

sidebar behavior

top-bar behavior

button hierarchy

data density

visual hierarchy

light/dark mode behavior

interaction language

motion principles

Then extend that design language consistently throughout the rest of the system.

Do not build every page independently.

The entire application must look like it was designed by one highly disciplined product design team.

3. FIRST: AUDIT BEFORE MODIFYING
Before making substantial UI changes, inspect the entire codebase.

Do not guess.

Build an internal understanding of:

routes

layouts

modules

submodules

pages

tabs

dialogs

drawers

forms

tables

filters

API endpoints

services

hooks

state management

permissions

validation

database relationships

report definitions

existing components

existing design tokens

existing CSS

existing responsive behavior

existing loading states

error handling

mock/fake data

incomplete functionality

dead code

inconsistent components

duplicate implementations

hardcoded values

translation architecture

print/export functionality

tenant scoping

audit mechanisms

Create a persistent implementation knowledge map before changing architecture.

The codebase must not need to be rediscovered page-by-page repeatedly.

4. DO NOT DESIGN FROM SCREENSHOTS ALONE
A screenshot shows appearance.

This implementation must understand the behavior behind the appearance.

Every major screen must be designed from:

Role → Goal → Data → Action → Validation → Result → Failure → Recovery → Audit

For every page, explicitly determine:

User goal
Why does this page exist?

Primary action
What should the user naturally do here?

Secondary actions
What else should be available?

Information hierarchy
What matters first, second, third?

Risk level
Can this action damage data, money, stock, payroll, production, customer records, or system configuration?

Validation
What must be validated before submission?

Permission
Who can perform the action?

Confirmation
Should the action require confirmation?

Feedback
What should the system communicate afterward?

Recovery
Can the user undo, restore, retry, edit, or reopen?

Audit
Should the event be logged?

5. GLOBAL DESIGN SYSTEM
Create a proper reusable design system.

Do not allow page-specific visual improvisation.

Define tokens for:

Typography
display

page title

section title

card title

body

metadata

table text

caption

numerical emphasis

form labels

helper text

error text

Spacing
Use a consistent spacing scale.

Radius
Use a restrained radius system.

Borders
Create semantic border styles.

Shadows
Define:

subtle

floating

modal

elevated

Colors
Create semantic tokens rather than arbitrary colors.

For example:

primary

secondary

success

warning

danger

info

neutral

surface

background

muted

disabled

selected

focus

Status colors
Status colors must have consistent meaning across the entire platform.

For example:

Success → completed/approved/paid/passed
Warning → pending/attention/near threshold
Danger → failed/rejected/cancelled/destructive
Info → informational/in-progress/system notice

Do not use colors randomly.

6. CREATE A COMPLETE COMPONENT LANGUAGE
Build reusable components rather than visually duplicating structures.

At minimum include:

AppShell

Sidebar

Topbar

Breadcrumbs

PageHeader

SectionHeader

Tabs

NestedTabs

SegmentedControl

FilterBar

SearchField

AdvancedFilterPanel

Table

DataGrid

MobileDataList

Pagination

SortControl

ColumnSelector

BulkSelection

BulkActionToolbar

KPI Card

Metric Card

Chart Card

EmptyState

LoadingState

SkeletonState

ErrorState

NoPermissionState

NoResultsState

ConfirmationDialog

DestructiveConfirmationDialog

Drawer

Modal

FullscreenModal

Sheet

Popover

Tooltip

Dropdown

CommandPalette

ContextMenu

DatePicker

DateRangePicker

TimePicker

CurrencyInput

NumberInput

QuantityInput

SearchableSelect

MultiSelect

Combobox

Autocomplete

FileUploader

ImageUploader

BarcodePreview

StatusBadge

Avatar

Timeline

ActivityFeed

Stepper

Wizard

FormSection

FormField

ValidationMessage

RichTextEditor

Toast

NotificationCenter

ProgressIndicator

CustomLoader

InlineLoader

PageLoader

RouteTransition

PrintPreview

DocumentPreview

AuditTimeline

Every reusable component must have predictable behavior.

7. INTERACTION PRINCIPLE
Every interaction must feel intentional.

The user should always know:

What happened?
What is happening now?
What will happen next?

Never leave users wondering whether a click worked.

8. CUSTOM LOADING SYSTEM
Create a unified loading system.

Do not use random spinners throughout the application.

Use context-aware loading:

Page loading
Elegant branded loader / structured skeleton.

Table loading
Skeleton rows preserving table dimensions.

Form submission
Button becomes processing state.

Delete
Dialog shows processing state.

Upload
Show progress.

Search
Use subtle inline loading.

Background processing
Show non-blocking status.

Report generation
Show report generation progress/state.

Export
Display export preparation and completion.

Print preparation
Show document preparation state.

Loading indicators must never unnecessarily block the entire interface.

9. TOAST / FEEDBACK SYSTEM
Create one centralized notification system.

Notifications should support:

success

info

warning

error

progress

action/undo

persistent notification where necessary

Example:

Product created successfully

Invoice #INV-1028 saved as draft

Payment failed — please verify the payment account

3 records skipped due to validation errors

Do not use vague messages like:

Something happened.

Errors must tell the user what they can do next.

10. FORM DESIGN
Forms are one of the most important parts of this product.

Every form must have:

clear labels

logical grouping

field-level validation

required indicators

helper text

correct keyboard navigation

appropriate input types

sensible defaults

server-side validation

client-side validation

duplicate detection where relevant

loading state

submit protection

cancel behavior

unsaved-change warning

success feedback

error recovery

Never rely only on frontend validation.

11. CRUD BEHAVIOR
Every CRUD entity should have a consistent pattern:

LIST
Search → filter → sort → paginate → select → bulk actions.

VIEW
Summary → details → relationships → activity → history → actions.

ADD
Validated form → save → feedback → redirect/continue.

EDIT
Load real data → validate → update → confirm result.

DELETE
Check dependencies → explain consequences → confirmation → delete/archive.

RESTORE
Show previous state where supported.

ARCHIVE
Use archive instead of destructive deletion when business rules require history.

Never allow accidental destruction of important business data.

12. DELETE UX
Every delete operation must understand the entity.

Do not blindly show:

Are you sure?

Instead show context.

Example:

Delete Warehouse?

This warehouse contains:

328 inventory records

12 active users

4 stock transfers

Deleting it may affect existing transactions.

Then provide the appropriate action:

Cancel / Archive / Delete Permanently

depending on system rules.

13. TABLE / DATA GRID DESIGN
ERP users live inside tables.

Tables must be first-class product components.

Support where applicable:

sticky header

horizontal scrolling

column resizing

column visibility

sorting

filtering

pagination

row actions

bulk selection

bulk operations

density modes

export

print

row expansion

grouped rows

subtotal

totals

status chips

inline action menus

keyboard navigation

Do not overload rows with dozens of visible buttons.

Use contextual action menus appropriately.

14. RESPONSIVE SYSTEM
Do not simply shrink desktop layouts.

Design three behavioral modes:

Desktop
High information density.

Tablet
Reduced density and adaptive navigation.

Mobile
Task-oriented interface.

Tables may become:

Cards / stacked rows / horizontal scroll / expandable records

depending on the use case.

Forms should become mobile-first single-column workflows.

POS must receive special responsive treatment.

15. LIGHT / DARK MODE
Both modes must be deliberately designed.

Do not invert colors mechanically.

Ensure:

contrast

readability

charts

tables

status badges

dialogs

inputs

dropdowns

tooltips

print preview

image surfaces

code/technical content

remain correct.

16. ENGLISH + BANGLA
The entire product must support:

English | বাংলা

This includes:

Master Panel

Tenant ERP

POS

E-commerce

CMS

reports

forms

validation

notifications

dialogs

settings

documents

invoices

print previews

system messages

authentication

errors

emails

background jobs

Do not hardcode:

Save / সংরক্ষণ

inside components.

Use centralized translation keys.

Language architecture:

en
bn

must be extensible for future languages.

Bangla remains LTR.

Business data entered by users must not be automatically translated.

CMS multilingual content must use explicit localized content structures.

17. AUTHENTICATION EXPERIENCE
Build complete authentication UX:

login

logout

session handling

forgot password

reset password

password change

password visibility

remember session where supported

invalid credentials

locked account

expired session

unauthorized access

permission denied

tenant mismatch

platform access restrictions

Never expose sensitive technical errors to users.

18. MASTER SAAS PANEL
The Master Panel must be designed as a genuine SaaS operations platform.

Include complete UX for:

Platform Dashboard
tenants

active subscriptions

expiring subscriptions

revenue

system health

errors

platform activity

usage indicators

Tenant Management
create tenant

edit tenant

suspend

activate

archive

subscription

plan

registration fee

monthly fee

validity

domains

users

tenant settings

tenant activity

Subscription Management
plans

pricing

validity

renewal

expiry

suspension

grace period

payment state

history

Domain Management
subdomain

custom domain

mapping status

verification state

SSL state where available

configuration instructions

Platform Users
administrators

roles

permissions

Feature Management
modules

feature flags

tenant-specific feature availability

Platform Settings
Error Logs
severity

tenant

endpoint

timestamp

user

trace/reference

status

resolution state

Audit Logs
System Monitoring
19. TENANT ERP
Design the complete ERP operational environment.

At minimum cover the full ecosystem:

Dashboard
Products
product list

create

edit

view

product variants where applicable

SKU

barcode

categories

units

pricing

cost

tax

status

images

raw material / finished good distinction

Categories
Inventory
stock overview

stock ledger

stock movement

warehouse stock

low stock

adjustments

transfers

valuation

batch/serial where applicable

stock history

Warehouses
Purchase
purchase orders

purchases

receiving

supplier returns

supplier ledger

Suppliers
Production
production plans

BOM

production input

total production input

individual worker input

production batches

worker performance

material consumption

wastage

rework

output

production history

Keep:

Total Production Input

and

Individual Worker Input

as separate concepts.

Do not invent discrepancies unless the relevant data exists and business rules explicitly define the comparison.

Quality Control
pass

fail

rework

QC records

inspection history

QC sticker workflow

Sales
quotations where applicable

sales orders

invoices

payments

returns

customer ledger

POS
quick sale

barcode scanning

customer

discounts

payment methods

held carts

receipt

invoice

return

Customers
CRM
Leads
source

salesman

lead number

status

valid/fake classification

conversion

conversion history

Salesman Performance
targets

daily leads

monthly target

achievement

conversion

incentive

pending target

relevant salary/performance calculations

Delivery
orders

delivery records

courier

tracking

delivered

returned

cancelled

Maintain distinct entities for:

Order → Invoice → Delivery → Courier Shipment

Do not collapse them into a single entity merely for convenience.

HR
employees

departments

attendance

shifts

employee production

payroll

incentives

targets

Finance
accounts

transactions

receivables

payables

expenses

basic financial reporting

full accounting where enabled

Assets
fixed assets

disposable assets

asset history

expenses against assets

Reports
Settings
Users / Roles / Permissions
Audit Logs
20. POS UX
POS should not feel like a normal ERP page.

It must be optimized for rapid operation.

Prioritize:

product search

barcode input

customer selection

cart editing

quantity

discounts

payment

change calculation

hold/resume

invoice generation

receipt printing

sale completion

return

Minimize unnecessary clicks.

Support keyboard operation where practical.

The interface must remain usable under real counter conditions.

21. E-COMMERCE STOREFRONT
The storefront must be treated as a real commerce product, not a landing page.

Create complete page architecture for:

Homepage
header

navigation

hero

sliders

categories

collections

featured products

promotions

trust indicators

business story

CTA

footer

Product Listing
filters

sorting

search

pagination

categories

price range

availability

Product Page
gallery

product information

pricing

stock state

variants

quantity

add to cart

buy now

delivery information

related products

reviews where implemented

trust information

Cart
Checkout
customer information

shipping

delivery method

payment

order review

validation

Order Confirmation
Order Tracking
timeline

order status

courier status

tracking number

Account
profile

orders

addresses

password

preferences

About Us
Contact
FAQ
Terms
Privacy
Return Policy
Delivery Policy
Search Results
404
Maintenance / Unavailable page
Login / Register / Forgot Password
22. STOREFRONT CMS
The CMS must provide business users with control over:

header

menus

logo

hero

sliders

page sections

content blocks

product sections

collections

promotions

footer

banners

pages

SEO metadata

social previews

custom HTML/CSS/JS where allowed

ordering/rearrangement

theme configuration

Do not create CMS controls that have no real frontend effect.

Every setting must have a clear relationship with the actual storefront.

23. E-COMMERCE CHECKOUT / ORDER STATE MACHINE
Model order lifecycle explicitly.

Example:

Cart → Checkout → Order Created → Fraud Check → Payment → Invoice → Challan → Delivery → Courier → Tracking → Delivered

with branches for:

Cancelled / Returned / Failed Delivery / Refunded

UI must reflect these states accurately.

Never show:

Delivered

while the backend says:

Pending

24. COURIER INTEGRATION UX
The system should support providers such as:

Steadfast

Pathao

RedX

future providers

Build a provider-agnostic interface.

UI should distinguish:

Internal Delivery Record

from

Courier Shipment

from

Courier Tracking

This is essential for reliable operational reporting.

25. REPORTING UX
Do not make 84 disconnected reports merely because 84 report definitions exist.

Build reusable reporting engines.

Architecture:

Report Definition
→ Filter Definition
→ Data Provider
→ Permission Scope
→ Query
→ Aggregation
→ Visualization
→ Table
→ Export
→ Print

Reports must use real tenant-scoped data.

Never show fake records merely to make a report look complete.

When no records exist:

No data available for the selected criteria.

not fictional numbers.

Reports should support, where appropriate:

date range

warehouse

branch

product

category

customer

supplier

employee

salesman

status

payment

channel

tenant

factory

production line

and provide:

summary

detail

drill-down

export

print

saved filters

26. DOCUMENTS & PRINTING
Documents are not screenshots.

Create actual printable templates for:

A4 invoice

receipt

challan

purchase document

payment receipt

barcode

reports

QC sticker

Barcode sizes must support:

35×25mm

and

50×35mm

where applicable.

Provide:

preview

paper size

margins

orientation

printer profile

template configuration

reprint history

Bangla must render correctly in printed/PDF output.

27. PRODUCT-WISE PROFIT
Invoice/sales views must support product-level profitability where the underlying data exists.

Display appropriately:

sale price

quantity

cost

discount

gross profit

profit margin

Do not calculate profitability from imaginary or incomplete cost data.

28. BUSINESS VALIDATION
Validation must reflect business logic, not merely field types.

Examples:

Do not allow sale of unavailable stock unless negative stock is explicitly supported.

Do not allow duplicate SKU where uniqueness is required.

Do not delete products tied to historical financial transactions.

Do not close an invoice with invalid payment totals.

Do not mark an unpaid order as delivered unless business rules permit it.

Do not assign an inactive employee to a current production workflow.

Do not allow a user to perform an action outside their permission.

Do not allow tenant A to access tenant B data.

Do not allow invalid state transitions.

29. PERMISSION SYSTEM
Implement permissions at the functional level.

Support:

View
Add
Edit
Delete
Approve
Export
Print
Refund
Cancel
Post
Override
Manage Settings

Where appropriate.

Do not hide only the button.

Backend authorization must also enforce the permission.

Frontend permissions are a UX layer.

Backend permissions are the security boundary.

30. AUDIT SYSTEM
Important business actions should produce auditable activity.

Examples:

created

updated

deleted

approved

rejected

cancelled

refunded

payment recorded

stock adjusted

stock transferred

invoice edited

user permission changed

role modified

configuration changed

domain changed

subscription changed

Audit information should include:

actor

timestamp

entity

action

old/new values where appropriate

tenant

request/reference information where appropriate

31. ERROR HANDLING
Every important page needs:

Loading
What is happening?

Empty
Nothing exists yet.

No Search Results
Nothing matches.

Permission Denied
You cannot access this.

Not Found
The requested entity/page does not exist.

Server Error
The system encountered a problem.

Network Failure
Connection issue.

Validation Failure
User must correct something.

Partial Failure
Some actions succeeded, others failed.

Retry
Provide recovery whenever meaningful.

Create a proper ErrorBoundary and route-level error handling.

32. UNSAVED CHANGES
Forms with meaningful edits must protect against accidental navigation.

Example:

You have unsaved changes.
Leave without saving?

Actions:

Stay / Discard Changes

33. BULK OPERATIONS
Where business-appropriate support:

select all

select visible

deselect

bulk status

bulk archive

bulk delete where safe

bulk export

bulk print

bulk assignment

After bulk operations show exactly what happened.

Example:

142 records processed
138 updated successfully
4 failed validation

34. SEARCH
Create consistent search behavior across the system.

Support:

instant search where appropriate

advanced search

keyboard shortcuts

recent searches where useful

search scopes

highlighted matches

Bangla/English search compatibility

For large datasets, use backend querying rather than loading everything into the browser.

35. COMMAND PALETTE
Consider a system-wide command palette for power users.

Examples:

Create Sale

Open POS

Create Product

Search Customer

Open Reports

Go to Settings

Find Invoice

This should complement normal navigation, not replace it.

36. NAVIGATION ARCHITECTURE
Navigation must reflect mental models.

Avoid arbitrary module ordering.

Recommended structure:

Overview

Operations

Sales

POS

Orders

Delivery

Inventory

Products

Stock

Warehouses

Transfers

Procurement

Purchases

Suppliers

Production

Production

BOM

Workers

QC

Customers & CRM

Customers

Leads

Salesmen

HR

Employees

Attendance

Payroll

Incentives

Finance

Accounts

Payments

Expenses

Accounting

Assets

Reports

E-commerce / Store

CMS

Administration

Users

Roles

Permissions

Settings

Audit

Logs

Adapt this to the actual existing architecture rather than blindly copying it.

37. CONTEXTUAL ACTIONS
Do not force every action into the sidebar.

A page should provide actions where users need them.

Examples:

Product page:

Edit
Duplicate
Adjust Stock
Print Barcode
Archive

Invoice:

Edit
Print
Download
Send
Record Payment
Refund
View Audit

Employee:

Edit
Attendance
Production
Payroll
History

38. MICROINTERACTIONS
Use subtle motion to communicate meaning.

Examples:

row creation

successful save

selected state

tab transition

drawer appearance

modal opening

status changes

inline validation

cart updates

POS completion

Motion must be:

fast
subtle
purposeful

Do not animate every element.

Use GSAP or the chosen motion framework where it genuinely improves the experience.

39. ACCESSIBILITY
Support:

keyboard navigation

visible focus

semantic labels

sufficient contrast

appropriate ARIA

logical tab order

screen-reader-friendly forms

accessible modal behavior

accessible error messages

40. PERFORMANCE
Design for real data.

Do not build a beautiful UI that collapses with 100,000 records.

Use:

pagination

server-side filtering

debounced search

caching

lazy loading

code splitting

optimized queries

indexed database access

virtualized lists where justified

optimized images

controlled API payloads

41. REALTIME
Where useful, support realtime updates for:

notifications

order status

POS-related state

production updates

delivery tracking

dashboard metrics

stock changes

system alerts

Do not use realtime merely because it is technically possible.

Use it where immediacy has business value.

42. DATA INTEGRITY
The frontend must never fabricate state.

A UI state must correspond to actual backend state.

Do not create fake:

invoices

customers

orders

stock

reports

payments

production records

users

dashboards

unless clearly labeled demo/seed data in a dedicated development context.

43. STATE MANAGEMENT
Avoid chaotic local state.

Separate:

server state

UI state

form state

session state

permission state

tenant state

locale state

Use consistent patterns.

44. MULTI-TENANCY
Every tenant-facing page must respect tenant scope.

Verify:

tenant ID

permissions

branch

warehouse

factory

user scope

subscription state

Tenant isolation must exist on the server.

Never rely on frontend route restrictions for tenant isolation.

45. SUBSCRIPTION-EXPIRED EXPERIENCE
When tenant subscription expires, create a deliberate state.

Do not simply throw an error.

Show:

expiration status

validity date

restricted features

renewal/contact action

access rules

The behavior must be consistent across:

subdomain

custom domain

ERP

storefront

46. CMS / STOREFRONT SEO
Support:

title

description

canonical

Open Graph

structured data where applicable

robots settings

sitemap strategy

clean URLs

product metadata

category metadata

Do this as part of the product architecture, not as an afterthought.

47. DATA EXPORT
Support appropriate:

CSV

XLSX

PDF

print

Export must use the same filtered dataset the user sees.

Do not export unrelated records.

48. SECURITY
Never expose:

passwords

tokens

secrets

unnecessary internal errors

sensitive tenant information

Use:

server-side authorization

validation

CSRF protection where relevant

rate limiting

secure session handling

input sanitization

safe file uploads

signed URLs where relevant

audit logs

49. API-FIRST THINKING
UI should consume real APIs.

Avoid duplicating business logic in React.

Business rules belong in the backend/application layer.

Frontend should focus on:

interaction

presentation

local state

optimistic UX where safe

Backend owns:

authorization

business rules

data integrity

calculations

transactional operations

50. TRANSACTIONAL OPERATIONS
High-risk operations must be transactional.

Examples:

Sale + stock deduction + payment.

Purchase + inventory receipt.

Production + material consumption + finished goods.

Invoice + payment.

Return + inventory reversal.

Refund + financial reversal.

Do not allow partial corruption because one API step failed.

51. NOTIFICATIONS
Create a real notification center.

Support categories:

system

sales

inventory

production

delivery

finance

HR

security

subscription

Notifications should support read/unread states and useful links.

52. DASHBOARD
Keep the current dashboard baseline.

Improve only where necessary.

The dashboard should prioritize:

actionable KPIs

real data

date context

business health

alerts

operational bottlenecks

quick actions

recent activity

Do not fill empty areas simply to make the dashboard look impressive.

53. MODULE PAGE STANDARD
Every module page should follow a consistent pattern:

Page Header
Title + description + primary action.

Context
Breadcrumb / tenant / date scope where needed.

KPI / summary
Only if useful.

Main workspace
Table / cards / timeline / chart / workflow.

Filters
Relevant and collapsible.

Actions
Primary + contextual.

States
Loading / empty / error / no permission.

Related information
Only when useful.

This makes the application learnable.

54. DRAWER VS MODAL VS PAGE
Do not use one UI pattern for everything.

Use:

Modal
Short, focused action.

Drawer
Edit/view workflow while preserving context.

Full page
Complex forms, deep configuration, large datasets.

Fullscreen workspace
POS, production workspace, complex report explorer.

Use the pattern that matches task complexity.

55. MASTER FORMULA FOR EVERY FEATURE
For every feature, implement this sequence:

Discover
→ Design
→ Validate
→ Authorize
→ Execute
→ Persist
→ Audit
→ Notify
→ Refresh UI
→ Recover on Failure

If any stage is missing, the feature is incomplete.

56. DO NOT JUST “MAKE THE SCREEN LOOK GOOD”
A visually beautiful non-functional screen is a failure.

For every button, ask:

What does it actually do?

For every dropdown:

What are its real options?

For every form:

Where does the data go?

For every metric:

Which query produces it?

For every report:

Which real dataset powers it?

For every permission:

Does the backend enforce it?

For every status:

Which state machine controls it?

For every notification:

What event generates it?

For every document:

Can the real user print it?

57. NO PLACEHOLDER FUNCTIONALITY
Do not ship:

console.log()

fake success

fake loading

fake APIs

fake reports

fake charts

dead buttons

placeholder dropdown values

links that go nowhere

modal shells without actions

“coming soon” for features already required

fake pagination

hardcoded counts

hardcoded business metrics

A feature is complete only when its entire flow is functional.

58. TEST EVERY USER JOURNEY
Test complete journeys, not isolated pages.

Example — Product
Create Product
→ Validate
→ Save
→ Product appears in list
→ Search works
→ Edit works
→ Barcode works
→ Stock works
→ POS can find product
→ E-commerce can display product
→ Reports include product

Example — Sale
Create sale
→ Stock updates
→ Invoice generated
→ Payment recorded
→ Customer ledger updated
→ Salesman target updated
→ Profit available where possible
→ Report updated
→ Audit recorded

Example — E-commerce
Product
→ Cart
→ Checkout
→ Order
→ Payment
→ Invoice
→ Delivery
→ Courier
→ Tracking
→ Delivered / Returned
→ Customer account reflects state.

59. CROSS-MODULE CONSISTENCY
Every business operation must propagate correctly.

For example:

Product

should affect:

Inventory
POS
Sales
E-commerce
Production
Reports
Barcode
Purchasing
Profitability

Similarly:

Customer

should affect:

CRM
Sales
POS
Orders
Invoices
Payments
Delivery
Reports

Do not build isolated modules that do not communicate.

60. IMPLEMENTATION STRATEGY
Do not redesign everything chaotically.

Use controlled phases.

Phase 0
Full codebase audit.

Phase 1
Design system + component architecture.

Phase 2
Global layout/navigation/interaction foundation.

Phase 3
Shared CRUD/form/table framework.

Phase 4
Core ERP modules.

Phase 5
POS.

Phase 6
Production / QC / HR.

Phase 7
Finance / Expenses / Assets.

Phase 8
Reports.

Phase 9
E-commerce storefront.

Phase 10
CMS.

Phase 11
Master SaaS Panel.

Phase 12
Localization.

Phase 13
Printing/export/document system.

Phase 14
Security/performance/realtime.

Phase 15
End-to-end QA.

Do not leave integration until the end.

Integrate continuously.

61. PRIORITY ORDER
Implement in this order:

1. Foundation

2. Shared components

3. Navigation

4. Authentication

5. Permission system

6. Products + inventory

7. Sales + POS

8. Purchases

9. Production + QC

10. CRM + customers

11. Delivery + courier

12. HR

13. Finance

14. Reports

15. E-commerce

16. CMS

17. Master Panel

18. Documents/printing

19. Localization

20. Final QA

62. ACCEPTANCE CRITERIA
The product is not finished until:

UI
Every screen visually belongs to the same design system.

UX
Every workflow is understandable without explanation.

Functionality
Every major action actually works.

Validation
Invalid operations are prevented.

Security
Unauthorized operations are rejected server-side.

Data
No fake production data exists.

State
Loading, empty, error, success and permission states exist.

Responsive
Desktop, tablet and mobile are intentionally designed.

Localization
English and Bangla work throughout the product.

Print
Invoices, reports and documents are genuinely printable.

E-commerce
Public shopping flows actually work.

Master Panel
Platform administration is complete.

ERP
Business operations are connected end-to-end.

POS
Fast real-world selling workflow works.

Reports
Reports query real tenant data.

Performance
Large datasets remain usable.

Reliability
Errors do not silently corrupt state.

Auditability
Important business actions are traceable.

63. FINAL QUALITY GATE
Before declaring the implementation complete, perform a full product walkthrough.

For every module:

Open page → inspect visual hierarchy → test navigation → test search → test filters → create → validate → edit → delete/archive → reload → verify persistence → test permissions → test mobile → test dark mode → test Bangla → test error state → test empty state → test loading → inspect network behavior → verify backend response → verify audit → verify related modules.

Then perform cross-system journeys.

Then perform fresh-user usability testing.

Then perform production-readiness testing.

64. MOST IMPORTANT RULE
Do not optimize for how impressive the interface looks in a screenshot.

Optimize for:

How confidently a real business employee can use the system for eight hours a day without confusion, errors, hesitation, or distrust.

This is an operational product.

The design must therefore combine:

Beauty + Clarity + Speed + Density + Hierarchy + Safety + Feedback + Consistency + Accuracy + Business Logic.

The end result should feel like a mature enterprise software product that has been deliberately designed for years of real operational use, rather than a collection of individually polished screens.

FINAL DIRECTIVE TO THE IMPLEMENTING AGENT
Audit first. Understand everything. Build a coherent system. Reuse aggressively. Do not create isolated page designs. Do not invent data. Do not fake functionality. Do not stop at visual implementation. Connect every interaction to real business logic. Validate both frontend and backend. Preserve the existing Dashboard as the visual baseline where appropriate. Discover missing requirements yourself from the architecture, workflows, database relationships and user journeys. Fill those gaps deliberately.

When a requirement is ambiguous, investigate the existing codebase and business model before making a destructive assumption.

When something is missing, do not merely leave a placeholder. Determine what a production-grade enterprise system reasonably requires and implement the missing layer in a way that is consistent with the existing architecture.

Do not create unnecessary complexity merely to appear sophisticated.

Every feature must earn its place through usability, business value, operational clarity, or system integrity.

The standard is:
Not “Does this page look good?”

It is:

“Could a real company confidently run its daily operations on this system?”

That is the bar for the entire ERP + POS + E-commerce + CMS + Master SaaS Platform.