# SaaS E-commerce Operations Dashboard — MVP Plan

## Project Overview

This project is a SaaS dashboard for WordPress/WooCommerce stores.  
The dashboard is an external web application connected to WordPress through a lightweight WordPress Connector Plugin.

The system is built for Arabic stores first, with RTL UI, light mode, and dark mode.

The main goal of the MVP is to help store owners:

- Reduce employee workload
- Reduce human mistakes
- Manage products, orders, and customers from one simple dashboard
- Track sales performance
- Run basic automations
- Avoid using the default WordPress admin for daily operations

---

## Final Tech Stack

### Frontend

- React.js
- Tailwind CSS
- shadcn/ui
- RTL Arabic UI
- Light / Dark Mode
- React Router
- React Query
- React Hook Form
- Zod
- Axios

### Backend

- Express.js
- PostgreSQL
- Redis
- BullMQ
- JWT Authentication
- RBAC Permissions
- REST API
- Webhooks

### WordPress Connector Plugin

- PHP
- WordPress REST API
- WooCommerce integration
- Webhooks
- API key based connection

---

## System Architecture

```txt
React Dashboard
      |
      v
Express.js API
      |
      |---- PostgreSQL
      |---- Redis
      |---- BullMQ Workers
      |
      v
WordPress Connector Plugin
      |
      v
WooCommerce
```

---

## MVP Scope

### Included in MVP

- Multi-tenant SaaS structure
- Authentication
- Store owner and employee users
- Roles and permissions
- WordPress store connection
- Manual sync from WooCommerce
- Products sync
- Orders sync
- Customers sync
- Dashboard analytics
- Product management
- AI product description generation
- Orders management
- Customers overview
- Basic automations
- Notifications center
- Arabic RTL UI
- Light and dark mode

### Not Included in MVP

Do not build these in MVP:

- Advanced CRM
- Chatwoot integration
- WhatsApp CRM inbox
- Advanced marketing campaigns
- Smart coupons
- Fraud detection AI
- AI health score
- Shipping integrations
- Accounting
- Workflow builder
- Mobile app
- Multi-language dashboard

---

# Phase 0 — Repository & Project Setup

## Goal

Create the initial monorepo/project structure for frontend, backend, workers, and WordPress plugin.

## Suggested Structure

```txt
project-root/
  apps/
    dashboard/
    api/
    workers/
  plugins/
    wordpress-connector/
  packages/
    shared/
  docs/
    plan.md
```

## Tasks

- Create project structure.
- Setup React app in `apps/dashboard`.
- Setup Express app in `apps/api`.
- Setup BullMQ workers app in `apps/workers`.
- Setup WordPress plugin folder in `plugins/wordpress-connector`.
- Add shared types/helpers package if needed.
- Add environment files examples.
- Add basic README.
- Add linting and formatting.

## Acceptance Criteria

- Frontend app runs locally.
- Backend app runs locally.
- Workers app starts without errors.
- WordPress plugin folder exists with a valid plugin header.
- Environment examples exist.
- No unrelated features are implemented in this phase.

---

# Phase 1 — Frontend Foundation

## Goal

Build the Arabic RTL dashboard foundation with routing, layout, theme, and reusable UI components.

## Pages

```txt
/login
/register
/forgot-password
/reset-password
/dashboard
```

## Tasks

- Setup Tailwind CSS.
- Setup shadcn/ui.
- Configure RTL layout.
- Configure Arabic font.
- Add light/dark mode.
- Create base app layout:
  - Sidebar
  - Topbar
  - Main content area
  - Mobile sidebar
- Create auth pages UI only.
- Create dashboard placeholder page.
- Create shared UI components:
  - PageHeader
  - StatsCard
  - DataTable wrapper
  - EmptyState
  - LoadingState
  - ErrorState
  - ConfirmDialog
  - StatusBadge
  - SearchInput
  - FilterBar

## Navigation Labels

Use Arabic labels:

```txt
لوحة التحكم
المنتجات
الطلبات
العملاء
الموظفين والصلاحيات
الأتمتة
الإشعارات
الإعدادات
```

## Acceptance Criteria

- UI is fully RTL.
- Sidebar works on desktop and mobile.
- Light/dark mode works.
- Arabic labels are used.
- Auth pages exist as UI.
- No backend integration is required yet.

---

# Phase 2 — Backend Foundation

## Goal

Create the Express API foundation with database connection, authentication structure, validation, and error handling.

## Tasks

- Setup Express.js project.
- Setup PostgreSQL connection.
- Choose and configure ORM: Prisma or Drizzle.
- Setup Redis connection.
- Setup Zod validation.
- Setup centralized error handling.
- Setup request logging.
- Setup API response format.
- Setup health endpoint.

## Required Endpoints

```txt
GET /health
```

## Recommended API Response Shape

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

Error shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": ""
  }
}
```

## Acceptance Criteria

- API starts successfully.
- Database connection works.
- Redis connection works.
- `/health` returns success.
- Errors are returned in a consistent format.
- No business modules are required yet.

---

# Phase 3 — Auth, Tenants, Roles & Permissions

## Goal

Build the SaaS account foundation: users, stores, roles, and permissions.

## Core Concept

Each store is a tenant.

```txt
Store = Tenant
User can belong to one or more stores
Each user has a role per store
Each role has permissions
```

## Database Tables

```txt
users
stores
store_users
roles
permissions
role_permissions
user_roles
refresh_tokens
```

## Default Roles

```txt
Owner
Manager
Product Manager
Order Employee
Customer Support
Marketer
Accountant
Viewer
```

## Permissions

```txt
dashboard.view
products.view
products.create
products.edit
products.delete
orders.view
orders.edit
customers.view
team.view
team.create
team.edit
team.delete
automations.view
automations.edit
settings.view
settings.edit
```

## Backend Endpoints

```txt
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/me

GET  /stores/current
POST /stores
PATCH /stores/:id

GET    /roles
POST   /roles
PATCH  /roles/:id
DELETE /roles/:id

GET    /team
POST   /team/invite
PATCH  /team/:id
DELETE /team/:id
```

## Frontend Tasks

- Connect login/register pages to API.
- Store auth token securely.
- Add protected routes.
- Add permission guard component.
- Build team page.
- Build roles page.

## Acceptance Criteria

- Store owner can register.
- Store is created for owner.
- Owner role is assigned automatically.
- Login works.
- Protected routes work.
- Permissions can block UI actions.
- Team and roles pages are functional.

---

# Phase 4 — WordPress Connector Plugin Foundation

## Goal

Build a lightweight WordPress plugin that connects a WooCommerce store to the SaaS dashboard.

## Plugin Responsibilities

- Show connection status inside WordPress admin.
- Store SaaS API URL and API key.
- Verify connection with SaaS backend.
- Expose health endpoint.
- Prepare WooCommerce data sync.

## Plugin Admin Page

Create admin page:

```txt
SaaS Connector
```

Fields:

```txt
SaaS API URL
API Key
Connection Status
Connect Button
Disconnect Button
Manual Sync Button
Last Sync Time
```

## Plugin REST Endpoints

```txt
GET  /wp-json/saas/v1/health
POST /wp-json/saas/v1/connect
POST /wp-json/saas/v1/disconnect
POST /wp-json/saas/v1/sync
```

## Backend Endpoints

```txt
POST /wp/connect
POST /wp/verify
POST /wp/disconnect
GET  /stores/:id/connection-status
```

## Security Requirements

- Use API key authentication.
- Never expose raw API key after saving.
- Verify requests from WordPress.
- Verify requests from SaaS to WordPress.

## Acceptance Criteria

- Plugin can be installed in WordPress.
- Plugin admin page exists.
- Store can be connected to SaaS.
- SaaS dashboard shows connection status.
- Health check works from both sides.

---

# Phase 5 — WooCommerce Sync: Products, Orders, Customers

## Goal

Sync WooCommerce data into the SaaS database.

## Database Tables

```txt
products
product_images
orders
order_items
customers
external_mappings
sync_jobs
webhook_events
```

## Product Fields

```txt
id
store_id
wp_product_id
name
description
short_description
price
stock_quantity
status
image_url
created_at
updated_at
```

## Order Fields

```txt
id
store_id
wp_order_id
customer_id
order_number
status
total
currency
payment_method
created_at
updated_at
```

## Customer Fields

```txt
id
store_id
wp_customer_id
name
email
phone
total_spent
orders_count
last_order_at
created_at
updated_at
```

## Backend Endpoints

```txt
POST /sync/products
POST /sync/orders
POST /sync/customers
POST /sync/all
GET  /sync/status
```

## WordPress Plugin Tasks

- Fetch WooCommerce products.
- Fetch WooCommerce orders.
- Fetch WooCommerce customers.
- Send data to SaaS API.
- Save last sync time.
- Add manual sync button.

## BullMQ Jobs

```txt
sync_products
sync_orders
sync_customers
sync_all
```

## Acceptance Criteria

- Manual sync works.
- Products appear in SaaS dashboard.
- Orders appear in SaaS dashboard.
- Customers appear in SaaS dashboard.
- Repeated sync does not create duplicates.
- Data is scoped by store_id.

---

# Phase 6 — Products Module

## Goal

Allow store users to view, create, edit, import, and publish products from the SaaS dashboard.

## Frontend Pages

```txt
/products
/products/new
/products/:id
/products/import
```

## Features

- Product list
- Search
- Filters
- Product details
- Add product
- Edit product
- Save as draft
- Publish to WooCommerce
- Upload product image
- Import products from CSV/Excel
- Generate description using AI

## Backend Endpoints

```txt
GET    /products
GET    /products/:id
POST   /products
PATCH  /products/:id
DELETE /products/:id
POST   /products/:id/publish
POST   /products/import
POST   /products/ai-description
```

## AI Description Input

```txt
product_name
category
short_notes
tone
```

## AI Description Output

```txt
description
short_description
```

## WordPress Plugin Tasks

- Create product in WooCommerce.
- Update product in WooCommerce.
- Upload image if supported.
- Return WooCommerce product ID.

## BullMQ Jobs

```txt
publish_product_to_wp
generate_ai_description
import_products
```

## Acceptance Criteria

- User can view products.
- User can create product draft.
- User can publish product to WooCommerce.
- Product gets WooCommerce ID after publishing.
- User can edit product.
- AI generates description and short description.
- CSV/Excel import creates product drafts.

---

# Phase 7 — Orders Module

## Goal

Allow users to view and manage WooCommerce orders from the SaaS dashboard.

## Frontend Pages

```txt
/orders
/orders/:id
```

## Features

- Orders list
- Search
- Filter by status
- Filter by date
- Order details
- Customer information
- Order items
- Internal notes

## Backend Endpoints

```txt
GET   /orders
GET   /orders/:id
PATCH /orders/:id/notes
```

## Acceptance Criteria

- Orders list loads from SaaS database.
- Order details page works.
- Order items are shown.
- Customer summary is shown.
- Internal notes can be saved.
- User permissions are respected.

---

# Phase 8 — Customers Module

## Goal

Show customer data and purchase history without building a full CRM.

## Frontend Pages

```txt
/customers
/customers/:id
```

## Features

- Customers list
- Search by name/email/phone
- Customer details
- Total spent
- Orders count
- Last order date
- Customer order history
- Customer status label:
  - جديد
  - نشط
  - متأخر
  - VIP

## Backend Endpoints

```txt
GET /customers
GET /customers/:id
GET /customers/:id/orders
```

## Acceptance Criteria

- Customer list loads correctly.
- Customer details page works.
- Order history is shown.
- Customer stats are accurate.
- No advanced CRM features are added.

---

# Phase 9 — Dashboard Analytics

## Goal

Build the main dashboard with essential sales and operations insights.

## Dashboard Sections

### Cards

```txt
مبيعات اليوم
مبيعات الشهر
عدد الطلبات
عدد العملاء
المنتجات منخفضة المخزون
```

### Charts

```txt
Sales over time
Orders over time
```

### Tables

```txt
آخر الطلبات
أفضل المنتجات
منتجات منخفضة المخزون
آخر التنبيهات
```

## Backend Endpoints

```txt
GET /dashboard/summary
GET /dashboard/sales-chart
GET /dashboard/orders-chart
GET /dashboard/recent-orders
GET /dashboard/top-products
GET /dashboard/low-stock
```

## Acceptance Criteria

- Dashboard loads real data.
- Data is scoped by store_id.
- Charts work.
- Low stock products are shown.
- Recent orders are shown.
- Empty states are handled.

---

# Phase 10 — Automations MVP

## Goal

Build the first 3 automations only.

## Automations

### 1. Low Stock Alert

When product stock is below configured threshold, create notification.

Config:

```txt
threshold
enabled
```

### 2. Daily Sales Report

Every day, send/create report with:

```txt
sales_total
orders_count
top_products
low_stock_count
```

Config:

```txt
time
enabled
```

### 3. WhatsApp Order Message

When a new order is created, send a WhatsApp message to the customer.

Config:

```txt
message_template
enabled
```

## Database Tables

```txt
automations
automation_logs
notifications
```

## Backend Endpoints

```txt
GET   /automations
PATCH /automations/:id
GET   /automations/:id/logs
```

## BullMQ Queues

```txt
automationQueue
notificationQueue
reportQueue
whatsappQueue
```

## Jobs

```txt
low_stock_check
send_daily_report
send_whatsapp_order_message
```

## Acceptance Criteria

- User can enable/disable each automation.
- Low stock alert creates notifications.
- Daily sales report runs through BullMQ.
- WhatsApp order message job is queued after new order.
- Automation logs are stored.
- Failed automations are logged.

---

# Phase 11 — Notifications Center

## Goal

Create a central place for system notifications.

## Frontend Page

```txt
/notifications
```

## Notification Types

```txt
new_order
low_stock
failed_sync
failed_automation
daily_report
```

## Backend Endpoints

```txt
GET   /notifications
PATCH /notifications/:id/read
POST  /notifications/read-all
```

## Acceptance Criteria

- Notifications appear in dashboard.
- Notifications page works.
- User can mark notification as read.
- User can mark all as read.
- Notifications are store-scoped.

---

# Phase 12 — Settings Module

## Goal

Allow store owner/admin to manage store settings, integrations, and API keys.

## Frontend Pages

```txt
/settings
/settings/store
/settings/integrations
/settings/api
/settings/profile
```

## Features

- Store information
- Store connection status
- API key display/regeneration
- WhatsApp settings placeholder
- Profile settings
- Theme preference

## Backend Endpoints

```txt
GET   /settings/store
PATCH /settings/store
GET   /settings/api-key
POST  /settings/regenerate-api-key
GET   /settings/integrations
PATCH /settings/integrations/whatsapp
```

## Acceptance Criteria

- Store settings can be updated.
- API key can be regenerated.
- Connection status is visible.
- WhatsApp settings can be saved as config.
- Theme preference works in frontend.

---

# Phase 13 — Webhooks & Incremental Sync

## Goal

Move from manual sync only to real-time updates using WooCommerce hooks/webhooks.

## WordPress Hooks

```php
woocommerce_new_order
woocommerce_update_order
woocommerce_update_product
woocommerce_product_set_stock
user_register
profile_update
```

## Backend Webhook Endpoints

```txt
POST /wp/webhooks/orders
POST /wp/webhooks/products
POST /wp/webhooks/customers
```

## Requirements

- Verify webhook signature/API key.
- Store webhook event.
- Prevent duplicate processing.
- Queue background sync job.

## Acceptance Criteria

- New WooCommerce order appears in SaaS without manual sync.
- Updated product appears in SaaS.
- Stock updates appear in SaaS.
- Duplicate webhook events are ignored.
- Failed webhook events are logged.

---

# Phase 14 — QA, Permissions & Production Readiness

## Goal

Make MVP stable enough for a real pilot store.

## QA Checklist

### Auth

- Register works.
- Login works.
- Logout works.
- Refresh token works.
- Protected routes are protected.

### Permissions

- Owner can access everything.
- Product Manager can manage products only.
- Order Employee can view/manage orders only.
- Marketer cannot access sensitive settings.
- Viewer cannot create/edit/delete.

### Store Connection

- Plugin installs.
- API key connects store.
- Disconnect works.
- Health check works.

### Sync

- Products sync correctly.
- Orders sync correctly.
- Customers sync correctly.
- Duplicate sync does not duplicate records.

### UI

- RTL works on all pages.
- Dark mode works.
- Mobile sidebar works.
- Empty states exist.
- Loading states exist.
- Error states exist.

### Automations

- Low stock alert works.
- Daily report job works.
- WhatsApp job queues correctly.
- Failed jobs are logged.

## Acceptance Criteria

- MVP can be tested on one real WooCommerce store.
- No critical console errors.
- No database records leak between stores.
- Every page respects permissions.
- Core flows work end-to-end.

---

# Development Rules For Claude

## General Rules

- Implement one phase at a time only.
- Do not jump to future phases.
- Do not add features outside the current phase.
- Keep the project Arabic RTL first.
- Use clean, readable code.
- Keep frontend and backend separated.
- Do not put heavy business logic inside the WordPress plugin.
- The WordPress plugin should be a connector only.

## Before Starting Each Phase

Claude should:

1. Read this `plan.md` file.
2. Identify the current phase requested by the user.
3. List what will be implemented in this phase.
4. Check existing files before creating duplicates.
5. Implement only the current phase.
6. Run available checks/tests/builds.
7. Provide a final report.

## Final Report Format For Each Phase

```txt
Phase Completed: Phase X — Name

Implemented:
- ...

Files Created:
- ...

Files Modified:
- ...

Checks Run:
- ...

Notes / Remaining:
- ...
```

---

# Recommended Build Order

```txt
Phase 0  — Repository & Project Setup
Phase 1  — Frontend Foundation
Phase 2  — Backend Foundation
Phase 3  — Auth, Tenants, Roles & Permissions
Phase 4  — WordPress Connector Plugin Foundation
Phase 5  — WooCommerce Sync
Phase 6  — Products Module
Phase 7  — Orders Module
Phase 8  — Customers Module
Phase 9  — Dashboard Analytics
Phase 10 — Automations MVP
Phase 11 — Notifications Center
Phase 12 — Settings Module
Phase 13 — Webhooks & Incremental Sync
Phase 14 — QA, Permissions & Production Readiness
```

---

# MVP Success Definition

The MVP is successful when a store owner can:

1. Register an account.
2. Create/connect a WooCommerce store.
3. Install the WordPress connector plugin.
4. Sync products, orders, and customers.
5. View sales dashboard.
6. Add/edit/publish products from the SaaS dashboard.
7. View orders and customers.
8. Invite employees and assign roles.
9. Enable basic automations.
10. Use the system in Arabic RTL with light/dark mode.

